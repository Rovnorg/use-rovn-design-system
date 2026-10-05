/** Native, editable Office exports. These adapters deliberately accept only
 * explicit v2 document models: prose is never guessed into a slide or sheet. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { chromium } from 'playwright';
import { inline } from './input.mjs';
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer,
  HeadingLevel, Packer, PageBreak, PageNumber, Paragraph, Table, TableCell,
  TableOfContents, TableRow, TextRun, WidthType, FootnoteReferenceRun, Bookmark, InternalHyperlink, ImageRun,
} from 'docx';
import pptxgen from 'pptxgenjs';
import ExcelJS from 'exceljs';

// Native Office keeps white canvases, the original mark and editorial display type.
// Amber supports the identity; data remains on a conventional white grid.
const BRAND = { amber: 'B66A09', ink: '15181E', muted: '5B616B', line: 'D9DDE3' };
// These are Office-facing font names. Native packages do not embed the bundled
// web fonts, so the recipient needs the matching desktop font installed.
const BASE_FONT = 'Inter';
const EDITORIAL_FONT = 'Crimson Pro';
const LONG_FORM_FAMILIES = new Set(['report', 'legal']);
const BRAND_LOCKUP_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'brand', 'rovn-lockup.svg');
let brandLockupPromise;
const linkPattern = /^(https?:\/\/|mailto:|#)[^\s]+$/i;
const blockTypes = new Set(['paragraph', 'lead', 'heading', 'list-item', 'table', 'code', 'callout', 'cards', 'image', 'rule', 'key-values', 'signature', 'clause', 'definition-list', 'page-break']);

function required(condition, message) { if (!condition) throw new Error(message); }
function onlyKeys(value, allowed, label) { required(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object.`); for (const key of Object.keys(value)) required(allowed.includes(key), `${label}.${key} is not supported and would be ignored.`); }
function text(value, label = 'Text') { required(typeof value === 'string', `${label} must be a string.`); return value; }
function array(value, label) { required(Array.isArray(value), `${label} must be an array.`); return value; }
function safeUrl(value, label = 'Link') { text(value, label); required(linkPattern.test(value), `${label} must be an https, http, mailto, or validated local-anchor link.`); return value; }
function safeName(value, label) { required(/^[^\\/:*?"<>|]{1,31}$/.test(value), `${label} must be 1–31 characters and cannot contain Excel-reserved characters.`); return value; }
function validIsoDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value; }
function ensureOut(out, format) { required(typeof out === 'string' && out, 'out is required.'); required(path.extname(out).toLowerCase() === `.${format}`, `Output path must end in .${format}.`); return out; }
function plain(value = '') { return new JSDOM(`<body>${String(value)}</body>`).window.document.body.textContent || ''; }
async function brandLockup() {
  brandLockupPromise ??= (async () => {
    const svg = await fs.readFile(BRAND_LOCKUP_PATH);
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 274, height: 68 }, deviceScaleFactor: 2 });
      await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:274px;height:68px}</style>${svg.toString()}`);
      return { svg, png: await page.locator('svg').screenshot({ type: 'png' }) };
    } finally { await browser.close(); }
  })();
  return brandLockupPromise;
}
const narrativeMetadataKeys = ['title', 'author', 'date', 'version', 'subtitle', 'recipient', 'sender', 'subject', 'confidentiality', 'eyebrow', 'summary', 'smallPrint'];
const narrativeIntentKeys = ['family', 'audience', 'purpose', 'readingMode', 'editable', 'confidentiality', 'readerAction', 'designRationale'];
const inlineTags = new Set(['STRONG', 'B', 'EM', 'I', 'CODE', 'S', 'STRIKE', 'SUP', 'SUB', 'BR', 'A', 'SPAN']);
function normaliseNarrative(input) {
  required(input?.schemaVersion === 2 && input.kind === 'document', 'DOCX requires schemaVersion: 2 and kind: "document".');
  onlyKeys(input, ['schemaVersion', 'kind', 'metadata', 'intent', 'sections', 'footnotes', 'sources', 'appendix', 'routerReasons'], 'document');
  required(input.metadata && typeof input.metadata === 'object', 'Document metadata is required.'); onlyKeys(input.metadata, narrativeMetadataKeys, 'metadata'); text(input.metadata.title, 'metadata.title');
  narrativeMetadataKeys.filter(key => key !== 'title' && input.metadata[key] != null).forEach(key => text(input.metadata[key], `metadata.${key}`));
  required(input.intent && typeof input.intent === 'object', 'Document intent is required.'); onlyKeys(input.intent, narrativeIntentKeys, 'intent');
  required(['memo', 'business-plan', 'report', 'board', 'proposal', 'legal', 'letter', 'sop', 'case-study', 'pricing'].includes(input.intent.family), 'Document intent.family is unsupported.');
  ['audience', 'purpose', 'readingMode', 'confidentiality', 'readerAction', 'designRationale'].forEach(key => { if (input.intent[key] != null) text(input.intent[key], `intent.${key}`); });
  if (input.intent.editable != null) required(typeof input.intent.editable === 'boolean', 'intent.editable must be true or false.');
  array(input.sections, 'sections'); required(input.sections.length > 0, 'Document needs at least one section.');
  if (input.footnotes != null) required(typeof input.footnotes === 'object' && !Array.isArray(input.footnotes), 'footnotes must be an object.');
  if (input.sources != null) array(input.sources, 'sources');
  if (input.appendix != null) array(input.appendix, 'appendix');
  if (input.routerReasons != null) array(input.routerReasons, 'routerReasons').forEach((reason, index) => text(reason, `routerReasons ${index}`));
  const doc = structuredClone(input); doc.footnotes ??= {}; doc.sources ??= []; doc.appendix ??= [];
  const seenSectionIds = new Set(); doc.sections.forEach((section, index) => {
    onlyKeys(section, ['id', 'title', 'blocks', 'pageBreakBefore'], `section ${index}`); text(section?.title, `section ${index}.title`); array(section.blocks, `section ${index}.blocks`);
    if (section.id == null) section.id = `section-${index + 1}`; else text(section.id, `section ${index}.id`);
    required(/^[A-Za-z][\w-]*$/.test(section.id), `section ${index}.id must be a stable Word bookmark name.`); required(!seenSectionIds.has(section.id), `Duplicate section bookmark ID: ${section.id}`); seenSectionIds.add(section.id);
    if (section.pageBreakBefore != null) required(typeof section.pageBreakBefore === 'boolean', `section ${index}.pageBreakBefore must be true or false.`);
  });
  const anchors = new Set(doc.sections.map(s => s.id));
  const footnoteRefs = new Set();
  function checkInline(value, label) {
    if (value == null) return;
    text(value, label);
    const dom = new JSDOM(`<body>${value}</body>`).window.document;
    const visit = node => {
      if (node.nodeType === 3) return;
      required(node.nodeType === 1, `${label} contains unsupported inline markup.`);
      const tag = node.tagName; required(inlineTags.has(tag), `${label} contains unsupported inline <${tag.toLowerCase()}> markup.`);
      const attributes = [...node.attributes].map(attribute => attribute.name);
      const allowedAttributes = tag === 'A' ? ['href'] : tag === 'SPAN' ? ['data-note'] : [];
      attributes.forEach(attribute => required(allowedAttributes.includes(attribute), `${label} attribute ${attribute} is not supported and would be ignored.`));
      if (tag === 'A') { required(node.hasAttribute('href'), `${label} link needs href.`); const href = safeUrl(node.getAttribute('href'), `${label} link`); if (href.startsWith('#')) required(anchors.has(href.slice(1)), `${label} local anchor does not exist: ${href}`); }
      if (tag === 'SPAN' && node.hasAttribute('data-note')) { required(/^\d+$/.test(node.dataset.note), 'DOCX footnote IDs must be numeric.'); footnoteRefs.add(node.dataset.note); }
      node.childNodes.forEach(visit);
    };
    dom.body.childNodes.forEach(visit);
  }
  function checkBlock(block) {
    required(block && typeof block === 'object' && blockTypes.has(block.type), `Unsupported DOCX component: ${block?.type || 'unknown'}.`);
    const allowed = {
      paragraph: ['id', 'type', 'text', 'html', 'caption', 'note'], lead: ['id', 'type', 'text', 'html', 'caption', 'note'],
      heading: ['id', 'type', 'text', 'level', 'caption', 'note'], 'list-item': ['id', 'type', 'text', 'html', 'depth', 'marker', 'caption', 'note'],
      table: ['id', 'type', 'headers', 'rows', 'caption', 'note', 'orientation', 'widths', 'columnTypes'], code: ['id', 'type', 'text', 'language', 'caption', 'note'],
      'key-values': ['id', 'type', 'items', 'caption', 'note'], signature: ['id', 'type', 'parties', 'caption', 'note'],
      clause: ['id', 'type', 'label', 'title', 'text', 'html', 'caption', 'note'], 'definition-list': ['id', 'type', 'items', 'caption', 'note'], 'page-break': ['id', 'type'],
    };
    required(allowed[block.type], `DOCX does not export ${block.type}; transform it into supported narrative blocks explicitly so content cannot be lost.`);
    onlyKeys(block, allowed[block.type], `${block.type} block`);
    if (block.id != null) text(block.id, `${block.type}.id`);
    if (block.html == null && ['paragraph', 'lead', 'list-item', 'clause'].includes(block.type) && block.text != null) block.html = inline(block.text);
    if (block.html != null) checkInline(block.html, `${block.type}.html`); else if (['paragraph', 'lead', 'list-item', 'clause'].includes(block.type) && block.text != null) checkInline(block.text, `${block.type}.text`); else if (block.text != null) text(block.text, `${block.type}.text`);
    if (['paragraph', 'lead', 'list-item'].includes(block.type)) required(block.html != null || block.text != null, `${block.type} needs html or text.`);
    if (block.type === 'heading') { text(block.text, 'heading.text'); required(Number.isInteger(block.level) && block.level >= 1 && block.level <= 4, 'heading.level must be an integer from 1 to 4 for DOCX.'); }
    if (block.type === 'list-item') { if (block.depth != null) required(Number.isInteger(block.depth) && block.depth >= 0 && block.depth <= 8, 'list-item.depth must be an integer from 0 to 8.'); if (block.marker != null) { text(block.marker, 'list-item.marker'); required(block.marker.length > 0, 'list-item.marker cannot be empty.'); } }
    if (block.type === 'code') { text(block.text, 'code.text'); if (block.language != null) text(block.language, 'code.language'); }
    if (block.type === 'table') {
      array(block.headers, 'table.headers'); array(block.rows, 'table.rows'); required(block.headers.length > 0 && block.rows.every(r => Array.isArray(r) && r.length === block.headers.length), 'Table rows must match headers.');
      [...block.headers, ...block.rows.flat()].forEach((v, i) => checkInline(v, `table cell ${i}`));
      required(block.orientation !== 'landscape', 'DOCX landscape table sections are not implemented; split the table or use the XLSX adapter.');
      required(block.widths == null && block.columnTypes == null, 'DOCX table widths and typed columns are not implemented; use the XLSX adapter or remove the presentation-only fields explicitly.');
    }
    if (block.caption != null) checkInline(block.caption, `${block.type}.caption`);
    if (block.note != null) checkInline(block.note, `${block.type}.note`);
    if (block.type === 'key-values') { array(block.items, 'key-values.items'); required(block.items.length > 0, 'key-values needs one or more items.'); block.items.forEach((item, i) => { onlyKeys(item, ['label', 'value'], `key-values item ${i}`); text(item?.label, `key-values item ${i}.label`); text(item?.value, `key-values item ${i}.value`); }); }
    if (block.type === 'definition-list') { array(block.items, 'definition-list.items'); required(block.items.length > 0, 'definition-list needs one or more items.'); block.items.forEach((item, i) => { onlyKeys(item, ['term', 'definition'], `definition ${i}`); text(item?.term, `definition ${i}.term`); text(item?.definition, `definition ${i}.definition`); }); }
    if (block.type === 'signature') { array(block.parties, 'signature.parties'); required(block.parties.length > 0, 'signature needs one or more parties.'); block.parties.forEach((party, i) => { onlyKeys(party, ['name', 'role', 'organization'], `signature party ${i}`); text(party?.name, `signature party ${i}.name`); if (party.role != null) text(party.role, `signature party ${i}.role`); if (party.organization != null) text(party.organization, `signature party ${i}.organization`); }); }
    if (block.type === 'clause') { text(block.label, 'clause.label'); if (block.title != null) text(block.title, 'clause.title'); required(block.html != null || block.text != null, 'clause needs html or text.'); }
    if (['cards', 'callout', 'image', 'rule'].includes(block.type)) throw new Error(`DOCX does not export ${block.type}; transform it into narrative blocks explicitly so content cannot be lost.`);
  }
  doc.sections.forEach(section => section.blocks.forEach(checkBlock));
  doc.appendix.forEach(checkBlock); Object.entries(doc.footnotes).forEach(([key, value]) => { required(/^\d+$/.test(key), 'DOCX footnote IDs must be numeric.'); checkInline(value, `footnote ${key}`); }); footnoteRefs.forEach(key => required(Object.hasOwn(doc.footnotes, key), `DOCX footnote reference ${key} has no definition.`));
  doc.sources.forEach((source, index) => { onlyKeys(source, ['title', 'item', 'url', 'label', 'description'], `source ${index}`); text(source.title, `source ${index}.title`); if (source.item != null) text(source.item, `source ${index}.item`); if (source.url != null) safeUrl(source.url, `source ${index}.url`); if (source.label != null) { text(source.label, `source ${index}.label`); required(source.url, `source ${index}.label needs source.url so it is not omitted.`); } if (source.description != null) checkInline(source.description, `source ${index}.description`); });
  return doc;
}

export function validateOfficeDocument(input) { return normaliseNarrative(input); }

/** Presentation v2 is intentionally semantic and bounded: every slide declares
 * a layout and editable text/table objects. It is not a prose-to-slides converter. */
export function validatePresentation(input) {
  required(input?.schemaVersion === 2 && input.kind === 'presentation', 'PPTX requires schemaVersion: 2 and kind: "presentation".');
  text(input.metadata?.title, 'metadata.title'); array(input.slides, 'slides'); required(input.slides.length > 0, 'Presentation needs at least one slide.');
  onlyKeys(input, ['schemaVersion', 'kind', 'metadata', 'slides'], 'presentation'); onlyKeys(input.metadata, ['title', 'author'], 'presentation.metadata');
  // Geometry is checked asynchronously against the actual slide boxes before
  // writing a PPTX. Character counts do not predict wrapping or glyph width.
  const fits = (value, _limit, label) => text(value, label);
  const result = structuredClone(input); result.metadata ||= {}; result.slides.forEach((slide, i) => {
    required(['title', 'section', 'two-column', 'data-table', 'closing'].includes(slide?.layout), `slide ${i}.layout is unsupported.`);
    const known = { title: ['layout', 'title', 'subtitle', 'body', 'notes'], section: ['layout', 'title', 'subtitle', 'body', 'notes'], 'two-column': ['layout', 'title', 'subtitle', 'left', 'right', 'notes'], 'data-table': ['layout', 'title', 'subtitle', 'table', 'notes'], closing: ['layout', 'title', 'subtitle', 'contact', 'notes'] }; onlyKeys(slide, known[slide.layout], `slide ${i}`);
    fits(slide.title, 0, `slide ${i}.title`); if (slide.subtitle != null) fits(slide.subtitle, 0, `slide ${i}.subtitle`);
    if (slide.notes != null) text(slide.notes, `slide ${i}.notes`);
    if (slide.layout === 'two-column') { onlyKeys(slide.left, ['heading', 'items'], `slide ${i}.left`); onlyKeys(slide.right, ['heading', 'items'], `slide ${i}.right`); fits(slide.left?.heading, 0, `slide ${i}.left.heading`); array(slide.left?.items, `slide ${i}.left.items`).forEach((v, j) => fits(v, 0, `slide ${i}.left.items.${j}`)); required(slide.left.items.length <= 4, `slide ${i}.left has more than four items; split the slide.`); fits(slide.right?.heading, 0, `slide ${i}.right.heading`); array(slide.right?.items, `slide ${i}.right.items`).forEach((v, j) => fits(v, 0, `slide ${i}.right.items.${j}`)); required(slide.right.items.length <= 4, `slide ${i}.right has more than four items; split the slide.`); }
    if (slide.layout === 'data-table') { onlyKeys(slide.table, ['headers', 'rows'], `slide ${i}.table`); array(slide.table?.headers, `slide ${i}.table.headers`).forEach((v, j) => fits(v, 0, `slide ${i}.table.headers.${j}`)); required(slide.table.headers.length <= 8, `slide ${i}.table has more than eight columns; use a workbook or split the table.`); array(slide.table?.rows, `slide ${i}.table.rows`).forEach((row, j) => { required(Array.isArray(row) && row.length === slide.table.headers.length, `slide ${i}.table row ${j} must match header count.`); row.forEach((v, k) => { text(v, `slide ${i}.table.rows.${j}.${k}`); fits(v, 0, `slide ${i}.table.rows.${j}.${k}`); }); }); required(slide.table.rows.length <= 8, `slide ${i}.table has more than eight rows; use a workbook or split the table.`); }
    if (slide.layout === 'closing') fits(slide.contact, 0, `slide ${i}.contact`);
    if ((slide.layout === 'title' || slide.layout === 'section') && slide.body != null) fits(slide.body, 0, `slide ${i}.body`);
  }); return result;
}

/** Workbook v2 uses typed cell values. Formula cells require a supplied cached
 * value because ExcelJS writes formulas but does not calculate them. */
export function validateWorkbook(input) {
  required(input?.schemaVersion === 2 && input.kind === 'workbook', 'XLSX requires schemaVersion: 2 and kind: "workbook".');
  text(input.metadata?.title, 'metadata.title'); array(input.sheets, 'sheets'); required(input.sheets.length > 0, 'Workbook needs at least one sheet.');
  onlyKeys(input, ['schemaVersion', 'kind', 'metadata', 'sheets'], 'workbook'); onlyKeys(input.metadata, ['title', 'author'], 'workbook.metadata');
  const result = structuredClone(input); const names = new Set();
  result.sheets.forEach((sheet, i) => { safeName(sheet?.name, `sheet ${i}.name`); required(!names.has(sheet.name), `Duplicate sheet name: ${sheet.name}`); names.add(sheet.name); array(sheet.columns, `sheet ${i}.columns`); array(sheet.rows, `sheet ${i}.rows`); required(sheet.columns.length > 0, `sheet ${i} needs columns.`);
    onlyKeys(sheet, ['name', 'columns', 'rows', 'orientation'], `sheet ${i}`); const keys = new Set(); sheet.columns.forEach((column, c) => { onlyKeys(column, ['key', 'header', 'type', 'width'], `sheet ${i}.column ${c}`); text(column?.key, `sheet ${i}.column ${c}.key`); required(!keys.has(column.key), `sheet ${i} has duplicate column key: ${column.key}`); keys.add(column.key); text(column?.header, `sheet ${i}.column ${c}.header`); required(['text', 'number', 'currency', 'percent', 'date', 'formula'].includes(column.type), `sheet ${i}.column ${c}.type is unsupported.`); if (column.width != null) required(Number.isFinite(column.width) && column.width >= 6 && column.width <= 80, `sheet ${i}.column ${c}.width must be 6–80.`); });
    if (sheet.orientation != null) required(['portrait', 'landscape'].includes(sheet.orientation), `sheet ${i}.orientation must be portrait or landscape.`); sheet.rows.forEach((row, r) => { required(row && typeof row === 'object' && !Array.isArray(row), `sheet ${i}.row ${r} must be an object.`); for (const key of Object.keys(row)) required(keys.has(key), `sheet ${i}.row ${r}.${key} does not match a declared column and would be ignored.`); sheet.columns.forEach(column => { const value = row[column.key]; required(value !== undefined, `sheet ${i}.row ${r} is missing ${column.key}.`); if (column.type === 'formula') { required(value && typeof value === 'object' && typeof value.formula === 'string' && Object.hasOwn(value, 'result'), `Formula ${column.key} needs {formula, result}; result is a supplied cache, not calculation.`); required(!/[|\[\]"'\\]/.test(value.formula) && !/\b(?:DDE|RTD|WEBSERVICE|HYPERLINK)\b/i.test(value.formula), `Formula ${column.key} uses an unsupported external or DDE-capable expression.`); required(typeof value.result === 'string' || typeof value.result === 'boolean' || (typeof value.result === 'number' && Number.isFinite(value.result)), `Formula ${column.key}.result must be a finite scalar.`); } else if (column.type === 'number' || column.type === 'currency' || column.type === 'percent') required(typeof value === 'number' && Number.isFinite(value), `${column.key} must be a finite number.`); else if (column.type === 'date') required((typeof value === 'string' && validIsoDate(value)) || (value instanceof Date && !Number.isNaN(value.valueOf())), `${column.key} must be a valid ISO YYYY-MM-DD string or Date.`); else text(value, column.key); }); });
  }); return result;
}

function inlineRuns(html, font, anchors = new Set(), initial = {}) {
  const doc = new JSDOM(`<body>${html || ''}</body>`).window.document;
  const runs = [];
  function visit(node, state = {}) {
    if (node.nodeType === 3) { if (node.textContent) runs.push(new TextRun({ text: node.textContent, font: state.code ? 'Fragment Mono' : font, bold: state.bold, italics: state.italics, strike: state.strike, superScript: state.superScript, subScript: state.subScript, break: state.break })); return; }
    if (node.nodeType !== 1) return;
    const next = { ...state, bold: state.bold || ['STRONG', 'B'].includes(node.tagName), italics: state.italics || ['EM', 'I'].includes(node.tagName), code: state.code || node.tagName === 'CODE', strike: state.strike || ['S', 'STRIKE'].includes(node.tagName), superScript: state.superScript || node.tagName === 'SUP', subScript: state.subScript || node.tagName === 'SUB' };
    if (node.tagName === 'BR') { runs.push(new TextRun({ break: 1, font })); return; }
    if (node.tagName === 'A') { const href = safeUrl(node.getAttribute('href')); const children = []; const before = runs.length; node.childNodes.forEach(child => visit(child, next)); children.push(...runs.splice(before)); if (href.startsWith('#')) { const anchor = href.slice(1); required(anchors.has(anchor), `DOCX local anchor does not exist: ${href}`); runs.push(new InternalHyperlink({ anchor, children })); } else runs.push(new ExternalHyperlink({ link: href, children })); return; }
    if (node.tagName === 'SPAN' && node.dataset.note) { required(/^\d+$/.test(node.dataset.note), 'Footnote IDs must be numeric for DOCX.'); runs.push(new FootnoteReferenceRun(Number(node.dataset.note))); return; }
    node.childNodes.forEach(child => visit(child, next));
  }
  doc.body.childNodes.forEach(node => visit(node, initial)); return runs.length ? runs : [new TextRun({ text: '', font })];
}
function blockHtml(block) { return block.html ?? block.text ?? ''; }
function docxParagraph(block, font, legal, anchors) {
  if (block.type === 'page-break') return new Paragraph({ children: [new PageBreak()] });
  if (block.type === 'heading') return new Paragraph({ text: block.text, heading: [HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5][block.level - 1], keepNext: true });
  if (block.type === 'clause') return new Paragraph({ children: [new TextRun({ text: `${block.label}${block.title ? ` ${block.title}` : ''} `, bold: true, font }), ...inlineRuns(blockHtml(block), font, anchors)], spacing: { after: 120 } });
  if (block.type === 'list-item') return new Paragraph({ children: [new TextRun({ text: `${block.marker || '•'} `, font }), ...inlineRuns(blockHtml(block), font, anchors)], indent: { left: 360 * ((block.depth || 0) + 1), hanging: 240 }, spacing: { after: 70 } });
  if (block.type === 'code') return [block.language ? new Paragraph({ children: [new TextRun({ text: `Language: ${block.language}`, font, italics: true, size: 18 })], spacing: { before: 80, after: 20 } }) : null, new Paragraph({ text: block.text, style: 'Code', spacing: { after: 120 } })].filter(Boolean);
  return new Paragraph({ children: inlineRuns(blockHtml(block), font, anchors), spacing: { after: block.type === 'lead' ? 180 : 100 }, indent: legal && block.type === 'paragraph' ? { firstLine: 360 } : undefined });
}
function docxTable(headers, rows, font, anchors) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: BRAND.line };
  const cell = (value, bold = false) => new TableCell({ children: [new Paragraph({ children: inlineRuns(value, font, anchors, { bold }) })], borders: { top: border, bottom: border, left: border, right: border } });
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, children: headers.map(h => cell(h, true)) }), ...rows.map(row => new TableRow({ children: row.map(value => cell(value)) }))] });
}
function docxNeedsContents(doc) {
  if (!['business-plan', 'report', 'board'].includes(doc.intent.family)) return false;
  const words = [];
  const add = value => { if (typeof value === 'string') words.push(plain(value)); };
  const addBlock = block => {
    add(block.html ?? block.text); add(block.label); add(block.title); block.headers?.forEach(add); block.rows?.flat().forEach(add);
    block.items?.forEach(item => { add(item.label); add(item.value); add(item.term); add(item.definition); });
  };
  doc.sections.forEach(section => { add(section.title); section.blocks.forEach(addBlock); }); doc.appendix.forEach(addBlock);
  return words.join(' ').trim().split(/\s+/).filter(Boolean).length > 900;
}
function docxProfile(family) {
  const longForm = LONG_FORM_FAMILIES.has(family);
  const compact = ['memo', 'letter', 'sop'].includes(family);
  const commercial = ['proposal', 'pricing'].includes(family);
  return {
    bodyFont: BASE_FONT,
    displayFont: EDITORIAL_FONT,
    bodySize: longForm ? 23 : 22,
    line: longForm ? 300 : compact ? 264 : 282,
    titleSize: longForm ? 56 : commercial ? 54 : compact ? 48 : 52,
    heading1: longForm ? 32 : commercial ? 30 : 28,
    heading2: longForm ? 27 : 25,
    heading3: 22,
    titleAfter: commercial ? 240 : longForm ? 300 : 200,
    margin: longForm
      ? { top: 960, right: 1080, bottom: 960, left: 1080 }
      : { top: 720, right: 840, bottom: 720, left: 840 },
  };
}
async function renderDocx(input, out) {
  const doc = normaliseNarrative(input); const legal = doc.intent.family === 'legal'; const profile = docxProfile(doc.intent.family); const font = profile.bodyFont; const brand = await brandLockup();
  const children = [
    new Paragraph({ children: [new ImageRun({ data: brand.svg, type: 'svg', fallback: { data: brand.png, type: 'png', transformation: { width: 137, height: 34 } }, transformation: { width: 137, height: 34 } })], spacing: { after: 160 } }),
    new Paragraph({ text: doc.metadata.title, heading: HeadingLevel.TITLE, alignment: legal ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: { after: profile.titleAfter } }),
  ];
  if (doc.metadata.subtitle) children.push(new Paragraph({ text: doc.metadata.subtitle, spacing: { after: 120 } }));
  const meta = [['Eyebrow', doc.metadata.eyebrow], ['Summary', doc.metadata.summary], ['Date', doc.metadata.date], ['Author', doc.metadata.author], ['Recipient', doc.metadata.recipient], ['Sender', doc.metadata.sender], ['Subject', doc.metadata.subject], ['Confidentiality', doc.metadata.confidentiality], ['Intent confidentiality', doc.intent.confidentiality !== doc.metadata.confidentiality ? doc.intent.confidentiality : undefined], ['Version', doc.metadata.version]].filter(([, value]) => value);
  if (meta.length) children.push(...meta.map(([label, value], index) => new Paragraph({ children: [new TextRun({ text: `${label}: `, font, size: 18, color: BRAND.muted }), new TextRun({ text: String(value), font, size: 18, color: BRAND.muted })], spacing: { after: index === meta.length - 1 ? 220 : 40, line: 240 } })));
  if (docxNeedsContents(doc)) children.push(new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-3' }));
  const anchors = new Set(doc.sections.map(section => section.id));
  function appendBlock(block) {
    if (block.caption && block.type !== 'signature') children.push(new Paragraph({ children: inlineRuns(block.caption, font, anchors, { italics: true }), spacing: { before: 100 } }));
    if (block.type === 'table') children.push(docxTable(block.headers, block.rows, font, anchors));
    else if (block.type === 'key-values') children.push(docxTable(['Item', 'Value'], block.items.map(item => [item.label, item.value]), font, anchors));
    else if (block.type === 'definition-list') children.push(...block.items.flatMap(item => [new Paragraph({ children: [new TextRun({ text: item.term, bold: true, font })] }), new Paragraph({ text: item.definition, indent: { left: 360 }, spacing: { after: 80 } })]));
    else if (block.type === 'signature') { if (block.caption) children.push(new Paragraph({ text: block.caption, spacing: { before: 160 } })); children.push(...block.parties.flatMap(party => [new Paragraph({ text: '________________________________________', spacing: { before: 240 } }), new Paragraph({ text: [party.name, party.role, party.organization].filter(Boolean).join('\n') })])); }
    else { const rendered = docxParagraph(block, font, legal, anchors); children.push(...(Array.isArray(rendered) ? rendered : [rendered])); }
    if (block.note) children.push(new Paragraph({ children: inlineRuns(block.note, font, anchors, { italics: true }), spacing: { after: 100 } }));
  }
  for (const section of doc.sections) {
    if (section.title) children.push(new Paragraph({ children: [new Bookmark({ id: section.id, children: [new TextRun({ text: section.title, font: profile.displayFont, bold: true })] })], heading: HeadingLevel.HEADING_1, pageBreakBefore: section.pageBreakBefore, keepNext: true }));
    else children.push(new Paragraph({ children: [new Bookmark({ id: section.id, children: [] })], spacing: { before: 0, after: 0 }, pageBreakBefore: section.pageBreakBefore }));
    section.blocks.forEach(appendBlock);
  }
  if (doc.appendix.length) { children.push(new Paragraph({ text: 'Appendix', heading: HeadingLevel.HEADING_1, pageBreakBefore: true })); doc.appendix.forEach(appendBlock); }
  if (doc.sources.length) {
    children.push(new Paragraph({ text: 'Sources', heading: HeadingLevel.HEADING_1, pageBreakBefore: doc.appendix.length === 0 }));
    for (const source of doc.sources) {
      required(source && typeof source === 'object' && typeof source.title === 'string', 'Every source needs a title.');
      const sourceRuns = [new TextRun({ text: source.title, bold: true, font })];
      if (source.item) sourceRuns.push(new TextRun({ text: ` — ${source.item}`, font }));
      if (source.url) sourceRuns.push(new TextRun({ text: ' ' }), new ExternalHyperlink({ link: safeUrl(source.url, 'Source URL'), children: [new TextRun({ text: source.label || source.url, font, color: '0563C1', underline: {} })] }));
      children.push(new Paragraph({ children: sourceRuns, spacing: { after: 90 } }));
      if (source.description) children.push(new Paragraph({ children: inlineRuns(source.description, font, anchors), indent: { left: 360 }, spacing: { after: 90 } }));
    }
  }
  if (doc.metadata.smallPrint) children.push(new Paragraph({ text: doc.metadata.smallPrint, spacing: { before: 160 } }));
  const footnotes = Object.fromEntries(Object.entries(doc.footnotes).map(([id, html]) => [id, { children: [new Paragraph({ children: inlineRuns(html, font, anchors) })] }]));
  const file = new Document({ creator: doc.metadata.author || '', title: doc.metadata.title, description: `Editable ${doc.intent.family} document`, footnotes, styles: { default: { document: { run: { font, size: profile.bodySize, color: BRAND.ink }, paragraph: { spacing: { line: profile.line } } }, heading1: { run: { font: profile.displayFont, size: profile.heading1, bold: true, color: BRAND.ink } }, heading2: { run: { font: profile.displayFont, size: profile.heading2, bold: true, color: BRAND.ink } }, heading3: { run: { font: profile.displayFont, size: profile.heading3, bold: true, color: BRAND.ink } }, title: { run: { font: profile.displayFont, size: profile.titleSize, bold: false, color: BRAND.ink } }, Code: { run: { font: 'Fragment Mono', size: 18, color: BRAND.ink } } } }, sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: profile.margin } }, footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Page ', font, color: BRAND.muted }), new TextRun({ children: [PageNumber.CURRENT], font, color: BRAND.muted })] })] }) }, children }] });
  await fs.mkdir(path.dirname(out), { recursive: true }); await fs.writeFile(out, await Packer.toBuffer(file));
  const fontLimit = 'Office does not embed the declared Crimson Pro, Inter, or Fragment Mono font files; recipients need those fonts for exact typography.';
  return { artifact: out, verified: ['OOXML package written', 'editable Word paragraphs/tables/styles'], limitations: [fontLimit, 'Table of contents fields update when opened in a compatible editor.'] };
}

function pptText(slide, value, options) { slide.addText(value, { fontFace: BASE_FONT, color: BRAND.ink, margin: 0, breakLine: false, ...options }); }
function footer(slide, number) { pptText(slide, `RōVN  |  ${number}`, { x: 0.5, y: 7.08, w: 12.3, h: 0.18, fontSize: 7, color: BRAND.muted, align: 'right' }); }
const PPT_BOXES = {
  title: { title: { x: 0.7, y: 1.16, w: 11.4, h: 0.68, font: EDITORIAL_FONT, size: 35, bold: false }, subtitle: { x: 0.7, y: 2.0, w: 10.8, h: 0.3, font: BASE_FONT, size: 13 }, body: { x: 0.7, y: 3.02, w: 7.6, h: 1.6, font: BASE_FONT, size: 18 } },
  section: { title: { x: 0.7, y: 2.22, w: 10.8, h: 0.7, font: EDITORIAL_FONT, size: 36, bold: false }, subtitle: { x: 0.7, y: 3.08, w: 9.8, h: 0.3, font: BASE_FONT, size: 13 }, body: { x: 0.7, y: 3.82, w: 7.4, h: 1.45, font: BASE_FONT, size: 18 } },
  standard: { title: { x: 0.7, y: 1.02, w: 11.4, h: 0.48, font: EDITORIAL_FONT, size: 25, bold: false }, subtitle: { x: 0.7, y: 1.62, w: 10.8, h: 0.28, font: BASE_FONT, size: 12 }, body: { x: 0.7, y: 2.14, w: 7.6, h: 1.8, font: BASE_FONT, size: 18 } },
  columnHeading: { x: 0.7, y: 2.28, w: 5.15, h: 0.32, font: BASE_FONT, size: 15, bold: true },
  columnItems: { x: 0.7, y: 2.86, w: 5.15, h: 2.95, font: BASE_FONT, size: 13 },
  closing: { x: 0.7, y: 2.45, w: 7.2, h: 0.4, font: BASE_FONT, size: 17 },
  table: { x: 0.7, y: 2.0, w: 11.9, h: 4.5, font: BASE_FONT, size: 11, margin: 0.08 },
};
function pptLayout(layout) { return layout === 'title' ? PPT_BOXES.title : layout === 'section' ? PPT_BOXES.section : PPT_BOXES.standard; }
function boxPoints(box) { return { width: box.w * 72, height: box.h * 72 }; }
async function preflightPresentation(deck) {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const [inter, crimson] = await Promise.all([
    fs.readFile(path.join(root, '..', 'assets', 'fonts', 'inter', 'InterVariable.woff2')),
    fs.readFile(path.join(root, '..', 'assets', 'fonts', 'Crimson_Pro', 'CrimsonPro-VariableFont_wght.ttf')),
  ]);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>@font-face{font-family:'${BASE_FONT}';src:url(data:font/woff2;base64,${inter.toString('base64')}) format('woff2');font-weight:100 900}@font-face{font-family:'${EDITORIAL_FONT}';src:url(data:font/ttf;base64,${crimson.toString('base64')}) format('truetype');font-weight:200 900}</style>`);
    await page.evaluate(async fonts => { await Promise.all(fonts.map(font => document.fonts.load(font))); await document.fonts.ready; for (const font of fonts) if (!document.fonts.check(font)) throw new Error(`Presentation preflight could not load ${font}.`); }, [`400 16px "${BASE_FONT}"`, `700 16px "${BASE_FONT}"`, `400 16px "${EDITORIAL_FONT}"`]);
    const jobs = [];
    const add = (slide, label, value, box, { paragraphGap = 0 } = {}) => { if (value == null) return; jobs.push({ slide, label, value: Array.isArray(value) ? value : [value], width: boxPoints(box).width, height: boxPoints(box).height, font: box.font, size: box.size, bold: Boolean(box.bold), paragraphGap }); };
    const tableRows = new Map();
    deck.slides.forEach((slide, index) => {
      const layout = pptLayout(slide.layout);
      add(index + 1, 'title', slide.title, layout.title); add(index + 1, 'subtitle', slide.subtitle, layout.subtitle);
      if (slide.layout === 'title' || slide.layout === 'section') add(index + 1, 'body', slide.body, layout.body);
      if (slide.layout === 'two-column') { add(index + 1, 'left heading', slide.left.heading, PPT_BOXES.columnHeading); add(index + 1, 'left items', slide.left.items, PPT_BOXES.columnItems, { paragraphGap: 9 }); add(index + 1, 'right heading', slide.right.heading, PPT_BOXES.columnHeading); add(index + 1, 'right items', slide.right.items, PPT_BOXES.columnItems, { paragraphGap: 9 }); }
      if (slide.layout === 'closing') add(index + 1, 'contact', slide.contact, PPT_BOXES.closing);
      if (slide.layout === 'data-table') {
        const box = PPT_BOXES.table; const available = boxPoints(box); const columnWidth = available.width / slide.table.headers.length - (box.margin * 72 * 2);
        const cells = [slide.table.headers, ...slide.table.rows].map((row, rowIndex) => row.map((value, cellIndex) => ({ slide: index + 1, label: `table row ${rowIndex + 1}, column ${cellIndex + 1}`, value: [value], width: columnWidth, height: Infinity, font: BASE_FONT, size: box.size, bold: rowIndex === 0, paragraphGap: 0 })));
        tableRows.set(index + 1, { available, cells, margin: box.margin * 72 });
      }
    });
    const measured = await page.evaluate(items => {
      const canvas = document.createElement('canvas'); const context = canvas.getContext('2d');
      function measure(item) {
        const textWidth = value => Math.max(...[item.font, 'Arial'].map(font => { context.font = `${item.bold ? '700 ' : ''}${item.size}px "${font}"`; return context.measureText(value).width; }));
        const lineHeight = item.size * 1.34; let lines = 0; let widest = 0; let unbreakable = false;
        for (const value of item.value) for (const paragraph of value.split('\n')) {
          const words = paragraph.match(/\S+\s*/g) || ['']; let line = '';
          for (const word of words) {
            const wordWidth = textWidth(word.trimEnd());
            if (wordWidth > item.width + 0.01) { unbreakable = true; widest = Math.max(widest, wordWidth); continue; }
            const candidate = line + word;
            if (line && textWidth(candidate.trimEnd()) > item.width) { widest = Math.max(widest, textWidth(line.trimEnd())); lines++; line = word; }
            else line = candidate;
          }
          widest = Math.max(widest, textWidth(line.trimEnd())); lines++;
        }
        const required = lines * lineHeight + Math.max(0, item.value.length - 1) * item.paragraphGap;
        return { ...item, lines, widest, required, unbreakable, lineHeight };
      }
      return items.map(measure);
    }, jobs);
    for (const metric of measured) required(!metric.unbreakable && metric.required <= metric.height + 0.01, `PPTX slide ${metric.slide} ${metric.label} overflows its fixed box (${Math.ceil(metric.required)}pt required, ${Math.floor(metric.height)}pt available). Split the content into another slide.`);
    const tableMetrics = await Promise.all([...tableRows].map(async ([slide, detail]) => {
      const flattened = detail.cells.flat(); const result = await page.evaluate(items => {
        const canvas = document.createElement('canvas'); const context = canvas.getContext('2d');
        return items.map(item => { const textWidth = text => Math.max(...[item.font, 'Arial'].map(font => { context.font = `${item.bold ? '700 ' : ''}${item.size}px "${font}"`; return context.measureText(text).width; })); const value = item.value[0]; let lines = 0, unbreakable = false; for (const paragraph of value.split('\n')) { const words = paragraph.match(/\S+\s*/g) || ['']; let line = ''; for (const word of words) { if (textWidth(word.trimEnd()) > item.width + .01) { unbreakable = true; continue; } const candidate = line + word; if (line && textWidth(candidate.trimEnd()) > item.width) { lines++; line = word; } else line = candidate; } lines++; } return { label: item.label, unbreakable, required: Math.max(30.24, lines * item.size * 1.34 + item.margin * 2) }; }); }, flattened.map(item => ({ ...item, margin: detail.margin })));
      const heights = []; for (let row = 0; row < detail.cells.length; row++) { const cells = result.slice(row * detail.cells[row].length, (row + 1) * detail.cells[row].length); for (const cell of cells) required(!cell.unbreakable, `PPTX slide ${slide} ${cell.label} contains an unbreakable value wider than its table cell.`); heights.push(Math.max(...cells.map(cell => cell.required))); }
      required(heights.reduce((total, height) => total + height, 0) <= detail.available.height + .01, `PPTX slide ${slide} table overflows its fixed box. Use fewer rows, fewer columns, or a workbook.`); return [slide, heights.map(height => height / 72)];
    }));
    return new Map(tableMetrics);
  } finally { await browser.close(); }
}
async function renderPptx(input, out) {
  const deck = validatePresentation(input); const tableHeights = await preflightPresentation(deck); const pptx = new pptxgen(); pptx.layout = 'LAYOUT_WIDE'; pptx.author = deck.metadata.author || 'Rōvn'; pptx.subject = deck.metadata.title; pptx.title = deck.metadata.title; pptx.company = 'Rōvn'; pptx.lang = 'en-US'; pptx.theme = { headFontFace: EDITORIAL_FONT, bodyFontFace: BASE_FONT, lang: 'en-US' };
  deck.slides.forEach((spec, index) => { const slide = pptx.addSlide(); const layout = pptLayout(spec.layout); slide.background = { color: 'FFFFFF' };
    slide.addImage({ path: BRAND_LOCKUP_PATH, x: 0.7, y: spec.layout === 'section' ? 1.54 : 0.42, w: 1.37, h: 0.342 });
    if (spec.layout === 'section') { slide.addShape(pptx.ShapeType.line, { x: 0.7, y: 1.99, w: 1.36, h: 0, line: { color: BRAND.ink, width: 1.1 } }); slide.addShape(pptx.ShapeType.line, { x: 1.76, y: 1.99, w: 0.3, h: 0, line: { color: BRAND.amber, width: 1.1 } }); }
    else slide.addShape(pptx.ShapeType.line, { x: 2.28, y: 0.59, w: 0.3, h: 0, line: { color: BRAND.amber, width: 1.1 } });
    pptText(slide, spec.title, { ...layout.title, fontFace: layout.title.font, fontSize: layout.title.size, bold: layout.title.bold, color: BRAND.ink, breakLine: false }); if (spec.subtitle) pptText(slide, spec.subtitle, { ...layout.subtitle, fontSize: layout.subtitle.size, color: BRAND.muted });
    if (spec.layout === 'title' || spec.layout === 'section') { if (spec.body) pptText(slide, spec.body, { ...layout.body, fontSize: layout.body.size, color: BRAND.ink, breakLine: false }); }
    if (spec.layout === 'two-column') { slide.addShape(pptx.ShapeType.line, { x: 6.5, y: 2.12, w: 0, h: 3.72, line: { color: BRAND.line, width: 0.75 } }); for (const [col, x] of [[spec.left, 0.7], [spec.right, 6.82]]) { pptText(slide, col.heading, { ...PPT_BOXES.columnHeading, x, fontSize: PPT_BOXES.columnHeading.size, bold: true }); slide.addShape(pptx.ShapeType.line, { x, y: 2.7, w: 5.0, h: 0, line: { color: BRAND.line, width: 0.75 } }); slide.addText(col.items.map(item => ({ text: item, options: { bullet: { indent: 16 }, hanging: 3, breakLine: true } })), { ...PPT_BOXES.columnItems, x, fontFace: BASE_FONT, color: BRAND.ink, fontSize: PPT_BOXES.columnItems.size, breakLine: false, paraSpaceAfterPt: 9, margin: 0 }); } }
    if (spec.layout === 'data-table') { slide.addShape(pptx.ShapeType.line, { x: PPT_BOXES.table.x, y: 2.46, w: PPT_BOXES.table.w, h: 0, line: { color: BRAND.line, width: 1 } }); slide.addTable([spec.table.headers.map(text => ({ text, options: { bold: true, color: BRAND.ink } })), ...spec.table.rows], { ...PPT_BOXES.table, border: { type: 'solid', color: BRAND.line, pt: 0.75 }, color: BRAND.ink, fontFace: BASE_FONT, fontSize: PPT_BOXES.table.size, margin: PPT_BOXES.table.margin, autoFit: false, rowH: tableHeights.get(index + 1), bold: false, paraSpaceAfterPt: 0, valign: 'middle' }); }
    if (spec.layout === 'closing') { pptText(slide, spec.contact, { ...PPT_BOXES.closing, fontSize: PPT_BOXES.closing.size, color: BRAND.ink }); }
    if (spec.notes) slide.addNotes(spec.notes); footer(slide, index + 1);
  }); await fs.mkdir(path.dirname(out), { recursive: true }); await pptx.writeFile({ fileName: out, compression: true });
  return { artifact: out, verified: ['OOXML presentation package written', 'editable PowerPoint text, tables, and shapes'], limitations: ['Office does not embed the declared Crimson Pro or Inter font files; recipients need them for exact typography.', 'PPTX uses fixed layout boxes and rejects unknown layouts; content must be edited when it exceeds its declared layout.'] };
}

function columnFormat(type) { return ({ currency: '$#,##0.00;[Red]-$#,##0.00', percent: '0.0%', date: 'yyyy-mm-dd', number: '#,##0.00' })[type]; }
async function renderXlsx(input, out) {
  const bookModel = validateWorkbook(input); const workbook = new ExcelJS.Workbook(); workbook.creator = bookModel.metadata.author || 'Rōvn'; workbook.created = new Date(); workbook.properties.title = bookModel.metadata.title;
  for (const spec of bookModel.sheets) { const sheet = workbook.addWorksheet(spec.name, { properties: { tabColor: { argb: `FF${BRAND.amber}` } }, views: [{ state: 'frozen', ySplit: 1 }] }); sheet.columns = spec.columns.map(column => ({ header: column.header, key: column.key, width: column.width || Math.min(48, Math.max(12, column.header.length + 4)) })); const header = sheet.getRow(1); header.font = { name: BASE_FONT, bold: true, color: { argb: `FF${BRAND.ink}` } }; header.border = { bottom: { style: 'medium', color: { argb: `FF${BRAND.line}` } } }; header.alignment = { vertical: 'middle', wrapText: true }; header.height = 26;
    spec.rows.forEach(row => { const record = {}; for (const column of spec.columns) { const value = row[column.key]; record[column.key] = column.type === 'formula' ? { formula: value.formula, result: value.result } : column.type === 'date' && typeof value === 'string' ? new Date(value) : value; } sheet.addRow(record); });
    for (const column of spec.columns) { const cells = sheet.getColumn(column.key); cells.font = { name: BASE_FONT, size: 10 }; cells.alignment = { vertical: 'top', wrapText: column.type === 'text' }; const fmt = columnFormat(column.type); if (fmt) cells.numFmt = fmt; }
    header.font = { name: BASE_FONT, bold: true, color: { argb: `FF${BRAND.ink}` } }; header.border = { bottom: { style: 'medium', color: { argb: `FF${BRAND.line}` } } }; header.alignment = { vertical: 'middle', wrapText: true };
    sheet.autoFilter = { from: 'A1', to: { row: Math.max(1, sheet.rowCount), column: spec.columns.length } }; sheet.pageSetup = { orientation: spec.orientation || 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
  } await fs.mkdir(path.dirname(out), { recursive: true }); await workbook.xlsx.writeFile(out);
  return { artifact: out, verified: ['OOXML workbook package written', 'editable worksheets, typed values, and formulas with supplied cached results'], limitations: ['ExcelJS does not calculate formulas. Formula result values are supplied caches; open in Excel/LibreOffice to recalculate.', 'Office does not embed the declared Inter font files; recipients need it for exact typography.'] };
}

export async function renderOffice(doc, { out, format } = {}) {
  required(['docx', 'pptx', 'xlsx'].includes(format), 'format must be docx, pptx, or xlsx.'); ensureOut(out, format);
  if (format === 'docx') return renderDocx(doc, out);
  if (format === 'pptx') return renderPptx(doc, out);
  return renderXlsx(doc, out);
}
