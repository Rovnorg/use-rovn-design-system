import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadInput } from '../src/input.mjs';
import { inferDocumentIntent, toProfessionalDocument, validateProfessionalDocument } from '../src/professional-model.mjs';
import { renderProfessional } from '../src/professional-render.mjs';

test('professional router respects explicit legal choice and uses conservative legal structures', () => {
  const document = validateProfessionalDocument({
    schemaVersion: 2, kind: 'document', metadata: { title: 'Synthetic mutual agreement' }, intent: { family: 'legal' },
    sections: [{ title: 'Terms', blocks: [
      { type: 'definition-list', items: [{ term: 'Example', definition: 'Synthetic test term.' }] },
      { type: 'clause', label: '1.', title: 'Purpose', text: 'A supplied sentence with a [local cross-reference](#section-1).' },
      { type: 'signature', parties: [{ name: 'Example party', role: 'Authorized signatory' }] }
    ] }]
  });
  assert.equal(document.intent.family, 'legal');
  assert.equal(document.sections[0].blocks[1].label, '1.');
  assert.equal(inferDocumentIntent({ metadata: { title: 'Executive decision memo' } }).intent.family, 'memo');
  assert.equal(inferDocumentIntent({ metadata: { title: 'Business plan', subject: 'Commercial terms' }, sections: [{ title: 'Commercial terms', blocks: [] }] }).intent.family, 'business-plan');
  assert.equal(inferDocumentIntent({ metadata: { title: 'Research report on contract workflows' }, sections: [{ title: 'Method', blocks: [] }] }).intent.family, 'report');
  assert.throws(() => validateProfessionalDocument({ ...document, sections: [{ ...document.sections[0], blocks: [{ type: 'paragraph', text: '<a href="#missing">Bad</a>' }] }] }), /Local link target/);
});

test('schema one content can move to the professional model without losing its blocks', () => {
  const professional = toProfessionalDocument({ schemaVersion: 1, metadata: { title: 'Business plan' }, sections: [{ title: 'Market', blocks: [{ type: 'paragraph', text: 'A supplied fact.' }, { type: 'table', headers: ['Metric'], rows: [['42']] }] }] });
  assert.equal(professional.schemaVersion, 2);
  assert.equal(professional.sections[0].blocks.length, 2);
  assert.equal(professional.intent.family, 'business-plan');
});

test('professional validation sanitizes rich fields and rejects presentation fields it cannot render', () => {
  const input = { schemaVersion: 2, kind: 'document', metadata: { title: 'Safe' }, sections: [{ title: 'One', blocks: [{ type: 'table', headers: ['Amount'], rows: [['42']], widths: [2], columnTypes: ['currency'], note: '<script>x</script>Visible' }, { type: 'cards', items: [{ title: 'A', html: '<img src=x onerror=alert(1)>Safe' }, { title: 'B', text: 'Safe' }] }] }], sources: [{ title: 'Source', description: '<script>x</script>Source note' }] };
  const validated = validateProfessionalDocument(input);
  assert.equal(validated.sections[0].blocks[0].note, 'Visible');
  assert.equal(validated.sources[0].description, 'Source note');
  assert.doesNotMatch(validated.sections[0].blocks[1].items[0].html, /onerror|img/);
  assert.throws(() => validateProfessionalDocument({ ...input, metadata: { title: 'Safe', coverImage: 'assets/bg1.png' } }), /coverImage/);
  assert.throws(() => validateProfessionalDocument({ ...input, sections: [{ ...input.sections[0], headerImage: 'assets/bg1.png' }] }), /headerImage/);
});

test('professional source conversion does not invent a legal date or version', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rovn-legal-source-'));
  try {
    const input = path.join(directory, 'agreement.md');
    await fs.writeFile(input, '# Mutual agreement\n\n## Terms\n\nSupplied terms only.');
    const source = await loadInput(input, { defaultMetadata: false });
    const document = toProfessionalDocument(source, { intent: { family: 'legal' } });
    assert.equal(document.metadata.date, undefined); assert.equal(document.metadata.version, undefined);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('legal renderer produces editable semantic HTML and a real PDF', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rovn-professional-'));
  try {
    const document = validateProfessionalDocument({ schemaVersion: 2, kind: 'document', metadata: { title: 'Synthetic agreement' }, intent: { family: 'legal' }, sections: [{ title: 'Terms', blocks: [{ type: 'clause', label: '1.', title: 'Scope', text: 'Exact supplied wording.' }, { type: 'signature', parties: [{ name: 'Example' }] }] }] });
    const out = path.join(directory, 'agreement.pdf'); const result = await renderProfessional(document, { out });
    assert.ok(result.pageCount >= 1);
    assert.equal((await fs.readFile(out)).subarray(0, 5).toString(), '%PDF-');
    const html = await fs.readFile(out.replace('.pdf', '.html'), 'utf8');
    assert.match(html, /family-legal/); assert.match(html, /class="clause"/); assert.match(html, /Exact supplied wording/);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
