import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import ExcelJS from 'exceljs';
import { renderOffice, validateOfficeDocument, validatePresentation, validateWorkbook } from '../src/office.mjs';

const narrative = {
  schemaVersion: 2, kind: 'document', metadata: { title: 'Synthetic executive memo', author: 'Test Author', sender: 'Test Sender', subject: 'Native Office proof', confidentiality: 'Internal handling' }, intent: { family: 'memo', confidentiality: 'Editorial purpose only' },
  sections: [{ id: 'findings', title: 'Findings', blocks: [
    { type: 'paragraph', html: 'A <strong>retained fact</strong> has <code>code</code>, <sup>up</sup>, <sub>down</sub>, <s>strike</s>, a <a href="https://example.com/evidence">source link</a>, a <a href="#second">local cross-reference</a>, and a note<span data-note="1">1</span>.' },
    { type: 'paragraph', text: '**MUST BOLD** and `inline code` with a literal <img src="x" alt="literal image">.' },
    { type: 'heading', text: 'Deep retained heading', level: 4 },
    { type: 'code', text: 'const retained = true;', language: 'javascript' },
    { type: 'key-values', items: [{ label: 'Status', value: 'Ready' }] },
    { type: 'table', caption: 'Retained table caption', note: 'Retained table note', headers: ['Metric', 'Value'], rows: [['<a href="https://example.com/evidence">Pilot sites</a>', '3']] },
    { type: 'signature', caption: 'Acknowledged by:', parties: [{ name: 'Test Signer', role: 'Founder' }] },
  ] }, { id: 'second', title: 'Second section', blocks: [{ type: 'list-item', marker: '1.', text: 'Exact ordered marker.' }] }], footnotes: { '1': 'Synthetic source note.' }, sources: [{ title: 'Evidence register', url: 'https://example.com/evidence', label: 'Evidence link', description: 'Retained source description.' }], appendix: [],
};
const deck = { schemaVersion: 2, kind: 'presentation', metadata: { title: 'Synthetic deck' }, slides: [
  { layout: 'title', title: 'Synthetic deck', subtitle: 'Editable objects' },
  { layout: 'two-column', title: 'Decision', left: { heading: 'Keep', items: ['Source content'] }, right: { heading: 'Check', items: ['Overflow limits'] }, notes: 'Speaker note.' },
  { layout: 'data-table', title: 'Table', table: { headers: ['Metric', 'Value'], rows: [['Sites', '3']] } },
  { layout: 'closing', title: 'Thank you', contact: 'contact@example.org' },
] };
const workbook = { schemaVersion: 2, kind: 'workbook', metadata: { title: 'Synthetic workbook' }, sheets: [{ name: 'Model', columns: [
  { key: 'price', header: 'Price', type: 'currency' }, { key: 'units', header: 'Units', type: 'number' }, { key: 'total', header: 'Total', type: 'formula' },
], rows: [{ price: 25, units: 2, total: { formula: 'A2*B2', result: 50 } }] }] };

async function zipText(file) { const zip = await JSZip.loadAsync(await fs.readFile(file)); const parts = await Promise.all(Object.values(zip.files).filter(file => /\.(xml|rels)$/.test(file.name)).map(file => file.async('string'))); return parts.join('\n'); }
test('DOCX is a native package preserving narrative text, link and footnote structures', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rovn-office-'));
  try { const out = path.join(dir, 'memo.docx'); const result = await renderOffice(narrative, { out, format: 'docx' }); const text = await zipText(out);
    assert.ok((await fs.stat(out)).size > 1000); assert.match(text, /retained fact/); assert.match(text, /MUST BOLD/); assert.doesNotMatch(text, /\*\*MUST BOLD\*\*/); assert.match(text, /inline code/); assert.match(text, /Fragment Mono/); assert.match(text, /literal image/); assert.match(text, /https:\/\/example.com\/evidence/); assert.match(text, /Synthetic source note/); assert.match(text, /Test Signer/); assert.equal((text.match(/Acknowledged by:/g) || []).length, 1); assert.match(text, /w:anchor="second"/); assert.match(text, /Exact ordered marker/); assert.match(text, /Retained table caption/); assert.match(text, /Retained table note/); assert.match(text, /Retained source description/); assert.match(text, /w:vertAlign/); assert.match(text, /<dc:creator>Test Author<\/dc:creator>/); assert.match(text, /Author: /); assert.match(text, /Test Sender/); assert.match(text, /Internal handling/); assert.match(text, /Editorial purpose only/); assert.match(text, /Deep retained heading/); assert.match(text, /w:pStyle w:val="Heading5"/); assert.match(text, /Language: javascript/); assert.match(text, /<w:pgSz[^>]*w:w="12240"[^>]*w:h="15840"/); assert.match(text, /<w:instrText[^>]*>PAGE<\/w:instrText>/); assert.equal(result.artifact, out);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('PPTX is an editable 16:9 package with notes, tables and no arbitrary prose conversion', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rovn-office-'));
  try { const out = path.join(dir, 'deck.pptx'); await renderOffice(deck, { out, format: 'pptx' }); const text = await zipText(out);
    assert.ok((await fs.stat(out)).size > 1000); assert.match(text, /Synthetic deck/); assert.match(text, /Source content/); assert.match(text, /Speaker note/); assert.match(text, /<a:tbl/); assert.match(text, /srgbClr val="1C1A18"/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('XLSX retains typed values and formula cached result without claiming calculation', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rovn-office-'));
  try { const out = path.join(dir, 'model.xlsx'); const result = await renderOffice(workbook, { out, format: 'xlsx' }); const loaded = new ExcelJS.Workbook(); await loaded.xlsx.readFile(out); const sheet = loaded.getWorksheet('Model');
    assert.equal(sheet.getCell('A2').value, 25); assert.equal(sheet.getCell('A1').font.bold, true); assert.equal(sheet.getCell('A1').font.color.argb, 'FFFFFFFF'); assert.deepEqual(sheet.getCell('C2').value, { formula: 'A2*B2', result: 50 }); assert.match(result.limitations[0], /does not calculate formulas/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('models reject silent data loss and layouts that exceed tested boxes', () => {
  assert.throws(() => validateOfficeDocument({ ...narrative, sections: [{ title: 'Bad', blocks: [{ type: 'image', src: 'x' }] }] }), /does not export image/);
  assert.throws(() => validateOfficeDocument({ ...narrative, sections: [{ title: 'Bad', blocks: [{ type: 'paragraph', html: 'Missing<span data-note="2">2</span>' }] }] }), /has no definition/);
  assert.throws(() => validatePresentation({ ...deck, slides: [{ layout: 'two-column', title: 'Bad', left: { heading: 'L', items: Array(8).fill('item') }, right: { heading: 'R', items: [] } }] }), /more than four items/);
  assert.throws(() => validateWorkbook({ ...workbook, sheets: [{ ...workbook.sheets[0], rows: [{ price: 1, units: 2, total: { formula: 'A2*B2' } }] }] }), /supplied cache/);
  assert.throws(() => validateWorkbook({ ...workbook, sheets: [{ ...workbook.sheets[0], rows: [{ price: Infinity, units: 2, total: { formula: 'A2*B2', result: 2 } }] }] }), /finite number/);
  assert.throws(() => validateWorkbook({ ...workbook, sheets: [{ ...workbook.sheets[0], rows: [{ price: 2, units: 2, total: { formula: '=DDE("x")', result: 2 } }] }] }), /external or DDE/);
  assert.throws(() => validatePresentation({ ...deck, slides: [{ layout: 'data-table', title: 'Bad', table: { headers: ['A'], rows: [[{ value: 'ignored' }]] } }] }), /must be a string/);
  assert.throws(() => validatePresentation({ ...deck, slides: [{ layout: 'title', title: 'Ignored field', body: 'Visible', unrendered: 'x' }] }), /would be ignored/);
});
test('DOCX v2 rejects unrenderable structure and inline markup before package creation', async () => {
  assert.deepEqual(validateOfficeDocument({ ...narrative, routerReasons: ['family supplied by the author'] }).routerReasons, ['family supplied by the author']);
  assert.throws(() => validateOfficeDocument({ ...narrative, unexpected: true }), /document\.unexpected/);
  assert.throws(() => validateOfficeDocument({ ...narrative, metadata: { ...narrative.metadata, family: 'memo' } }), /metadata\.family/);
  assert.throws(() => validateOfficeDocument({ ...narrative, intent: { ...narrative.intent, editable: 'true' } }), /intent\.editable/);
  assert.throws(() => validateOfficeDocument({ ...narrative, sections: [{ ...narrative.sections[0], pageBreakBefore: 'false' }] }), /pageBreakBefore/);
  assert.throws(() => validateOfficeDocument({ ...narrative, sections: [{ ...narrative.sections[0], blocks: [{ type: 'heading', text: 'Bad level', level: 5 }] }] }), /heading\.level/);
  assert.throws(() => validateOfficeDocument({ ...narrative, sections: [{ ...narrative.sections[0], blocks: [{ type: 'heading', text: 'Generated number', level: 1, number: 'A1' }] }] }), /heading block\.number/);
  assert.throws(() => validateOfficeDocument({ ...narrative, sections: [{ ...narrative.sections[0], blocks: [{ type: 'list-item', text: 'Bad list', depth: '2', marker: '1.' }] }] }), /list-item\.depth/);
  const unsupported = { ...narrative, sections: [{ ...narrative.sections[0], blocks: [{ type: 'paragraph', html: 'Visible<img src="x" alt="MUST KEEP ALT">' }] }] };
  assert.throws(() => validateOfficeDocument(unsupported), /unsupported inline <img>/);
  assert.throws(() => validateOfficeDocument({ ...narrative, sections: [{ ...narrative.sections[0], blocks: [{ type: 'paragraph', html: '<strong class="decorative">Visible</strong>' }] }] }), /attribute class/);
  assert.doesNotThrow(() => validateOfficeDocument({ ...narrative, sections: [{ ...narrative.sections[0], blocks: [{ type: 'paragraph', html: 'Visible <span>Purpose</span>' }] }] }));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rovn-office-')); const out = path.join(dir, 'unsupported.docx');
  try { await assert.rejects(() => renderOffice(unsupported, { out, format: 'docx' }), /unsupported inline <img>/); await assert.rejects(fs.stat(out), /ENOENT/); } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('DOCX contents field is limited to long report-like documents', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rovn-office-'));
  const threeMemoSections = [...narrative.sections, { id: 'third', title: 'Third', blocks: [{ type: 'paragraph', text: 'A short memo section.' }] }];
  const reportSections = Array.from({ length: 3 }, (_, index) => ({ id: `report-${index + 1}`, title: `Report ${index + 1}`, blocks: [{ type: 'paragraph', text: 'measured content '.repeat(155) }] }));
  try {
    const memo = path.join(dir, 'memo.docx'); const report = path.join(dir, 'report.docx');
    await renderOffice({ ...narrative, sections: threeMemoSections }, { out: memo, format: 'docx' });
    await renderOffice({ ...narrative, intent: { ...narrative.intent, family: 'report' }, sections: reportSections }, { out: report, format: 'docx' });
    assert.doesNotMatch(await zipText(memo), /TOC/); assert.match(await zipText(report), /TOC/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('PPTX geometry preflight rejects wide-glyph content before package creation', async () => {
  const W = n => 'W'.repeat(n); const boundary = { schemaVersion: 2, kind: 'presentation', metadata: { title: 'Bounds' }, slides: [
    { layout: 'title', title: W(54), subtitle: W(90), body: W(250) },
    { layout: 'two-column', title: W(60), left: { heading: W(52), items: Array(4).fill(W(90)) }, right: { heading: W(52), items: Array(4).fill(W(90)) } },
    { layout: 'data-table', title: W(60), table: { headers: Array(8).fill(W(45)), rows: Array.from({ length: 8 }, () => Array(8).fill(W(50))) } },
  ] }; const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rovn-office-'));
  const multilineTable = { schemaVersion: 2, kind: 'presentation', metadata: { title: 'Multiline table' }, slides: [{ layout: 'data-table', title: 'Measured rows', table: { headers: ['A', 'B'], rows: Array.from({ length: 8 }, () => [Array(14).fill('measure').join(' '), Array(14).fill('measure').join(' ')]) } }] };
  try { await assert.rejects(() => renderOffice(boundary, { out: path.join(dir, 'bounds.pptx'), format: 'pptx' }), /overflows|unbreakable/); await assert.rejects(fs.stat(path.join(dir, 'bounds.pptx')), /ENOENT/); await assert.rejects(() => renderOffice(multilineTable, { out: path.join(dir, 'multiline-table.pptx'), format: 'pptx' }), /table overflows/); } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
