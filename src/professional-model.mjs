import { cleanInline, inline, validateDocument } from './input.mjs';

export const professionalFamilies = new Set(['memo', 'business-plan', 'report', 'board', 'proposal', 'legal', 'letter', 'sop', 'case-study', 'pricing']);
const blockTypes = new Set(['paragraph', 'lead', 'heading', 'list-item', 'table', 'code', 'callout', 'cards', 'image', 'image-column', 'image-band', 'rule', 'key-values', 'signature', 'clause', 'definition-list', 'page-break']);
const metadataKeys = ['title','author','date','version','subtitle','recipient','sender','subject','confidentiality','eyebrow','summary','smallPrint'];
const intentKeys = ['family','audience','purpose','readingMode','confidentiality','editable'];
function onlyKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${label}.${key} is not supported and would be ignored.`);
}

function string(value, name, required = false) {
  if (value == null) { if (required) throw new Error(`${name} is required.`); return undefined; }
  if (typeof value !== 'string') throw new Error(`${name} must be a string.`);
  return value;
}
function normalizeIntent(raw = {}, metadata = {}) {
  onlyKeys(raw, intentKeys, 'intent');
  const supplied = raw.family || metadata.family || metadata.documentFamily || metadata.type;
  if (supplied != null && !professionalFamilies.has(supplied)) throw new Error(`Unsupported document family: ${supplied}.`);
  const intent = {};
  for (const key of ['audience', 'purpose', 'readingMode', 'confidentiality']) if ((raw[key] ?? metadata[key]) != null) intent[key] = string(raw[key] ?? metadata[key], `intent.${key}`);
  const editable = raw.editable ?? metadata.editable;
  if (editable !== undefined) {
    if (typeof editable !== 'boolean') throw new Error('intent.editable must be true or false.');
    intent.editable = editable;
  }
  if (supplied) intent.family = supplied;
  return intent;
}

export function inferDocumentIntent({ metadata = {}, sections = [], intent = {} }) {
  const provided = normalizeIntent(intent, metadata);
  if (provided.family) return { intent: provided, reasons: ['family supplied by the author'] };
  const title = [metadata.title, metadata.subject, metadata.subtitle].filter(Boolean).join(' ').toLowerCase();
  const body = sections.flatMap(s => [s.title, ...(s.blocks || []).map(b => b.title || b.text || '')]).join(' ').toLowerCase();
  if (sections.some(section => section.blocks?.some(block => ['clause', 'signature', 'definition-list'].includes(block.type)))) return { intent: { ...provided, family: 'legal' }, reasons: ['inferred legal from legal-only structured blocks'] };
  const rules = [
    ['legal', /\b(agreement|addendum|amendment|contract)\b/, 'legal document title'],
    ['pricing', /\b(pricing|price list|rate card|fees|commercial terms)\b/, 'commercial pricing language'],
    ['proposal', /\b(proposal|statement of work|sow|scope of work|deliverables)\b/, 'proposal or scope language'],
    ['sop', /\b(sop|standard operating procedure|procedure|runbook|checklist)\b/, 'operating procedure language'],
    ['business-plan', /\b(business plan|go-to-market|market analysis|financial plan|strategy)\b/, 'strategy or plan language'],
    ['board', /\b(board|investor update|diligence|investment committee)\b/, 'board or diligence audience'],
    ['case-study', /\b(case study|customer story|outcome|before and after)\b/, 'case-study language'],
    ['letter', /\b(dear |sincerely|to:|from:|re:)\b/, 'correspondence conventions'],
    ['memo', /\b(memo|decision|recommendation|briefing|executive summary)\b/, 'memo or decision language']
  ];
  const explicitTitleFamily = /\bbusiness plan\b/.test(title) ? ['business-plan', null, 'business-plan title'] : /\b(case study|customer story)\b/.test(title) ? ['case-study', null, 'case-study title'] : /\b(research|technical) report\b/.test(title) ? ['report', null, 'report title'] : undefined;
  const match = explicitTitleFamily || rules.find(([, pattern]) => pattern.test(title)) || rules.find(([family, pattern]) => family !== 'legal' && pattern.test(body)) || (/(^|\b)(agreement|addendum|amendment|contract)(\b|$)/.test(body) ? ['legal', null, 'legal document terminology in body'] : undefined);
  const family = match?.[0] || 'report';
  return { intent: { ...provided, family }, reasons: [match ? `inferred ${family} from ${match[2]}` : 'defaulted to report for general long-form material'] };
}

function normalizeBlock(block, ids, counter) {
  if (!block || typeof block !== 'object' || !blockTypes.has(block.type)) throw new Error(`Unsupported professional component: ${block?.type}.`);
  const result = structuredClone(block);
  for (const key of ['id','text','html','title','label','caption','note','alt','language']) if (result[key] != null) string(result[key], `${result.type}.${key}`);
  result.id ||= `block-${counter.value++}`;
  if (!/^[A-Za-z][\w-]*$/.test(result.id) || ids.has(result.id)) throw new Error(`Invalid or duplicate component ID: ${result.id}`);
  ids.add(result.id);
  if (result.html != null) result.html = cleanInline(result.html);
  else if (result.text != null && !['heading', 'code', 'clause'].includes(result.type)) result.html = inline(result.text);
  if (result.type === 'heading') {
    result.text = string(result.text, 'heading text', true);
    if (result.level != null && (!Number.isInteger(result.level) || result.level < 1 || result.level > 4)) throw new Error('heading level must be an integer from 1 to 4.');
    if (result.number != null) throw new Error('heading.number is not supported; include an authored label in heading.text.');
  }
  if (result.caption != null) result.caption = cleanInline(result.caption);
  if (result.note != null) result.note = cleanInline(result.note);
  if (result.type === 'list-item' && result.depth != null && (!Number.isInteger(result.depth) || result.depth < 0 || result.depth > 8)) throw new Error('list-item depth must be an integer from 0 to 8.');
  if (result.type === 'list-item' && result.marker != null) string(result.marker, 'list-item marker');
  if (result.type === 'code') { string(result.text, 'code text', true); if (result.language != null) string(result.language, 'code language'); }
  if (result.type === 'callout' && result.variant != null && ![1, 2, 3, 4, 5, 6].includes(result.variant)) throw new Error('Callout variant must be 1–6.');
  if (result.images) result.images = result.images.map(image => ({ ...image, caption: image.caption == null ? image.caption : cleanInline(string(image.caption,'image caption')) }));
  if (result.type === 'image' && result.height != null && (!Number.isFinite(result.height) || result.height <= 0 || result.height > 900)) throw new Error('image height must be a positive number no greater than 900.');
  if (result.type === 'image-band' && result.amberSrc != null) throw new Error('image-band amberSrc is not supported by professional-v2.');
  if (result.type === 'clause') {
    result.label = string(result.label, 'clause label', true);
    result.title = string(result.title, 'clause title');
    if (result.html == null && result.text == null) throw new Error('A clause needs html or text.');
    result.html = cleanInline(result.html ?? inline(result.text));
  }
  if (result.type === 'key-values') {
    if (!Array.isArray(result.items) || !result.items.length) throw new Error('key-values needs one or more items.');
    result.items = result.items.map(item => ({ label: string(item?.label, 'key-value label', true), value: string(item?.value, 'key-value value', true) }));
  }
  if (result.type === 'definition-list') {
    if (!Array.isArray(result.items) || !result.items.length) throw new Error('definition-list needs one or more items.');
    result.items = result.items.map(item => ({ term: string(item?.term, 'definition term', true), definition: string(item?.definition, 'definition', true) }));
  }
  if (result.type === 'signature') {
    if (!Array.isArray(result.parties) || !result.parties.length) throw new Error('signature needs one or more parties.');
    result.parties = result.parties.map(party => ({ name: string(party?.name, 'signature party name', true), role: string(party?.role, 'signature party role'), organization: string(party?.organization, 'signature party organization') }));
    result.caption = string(result.caption, 'signature caption');
  }
  if (result.type === 'table') {
    if (!Array.isArray(result.headers) || !result.headers.length || !Array.isArray(result.rows) || result.rows.some(row => !Array.isArray(row) || row.length !== result.headers.length)) throw new Error('Table rows must match the header column count.');
    result.headers = result.headers.map(cell => cleanInline(string(cell,'table header',true))); result.rows = result.rows.map(row => row.map(cell => cleanInline(string(cell,'table cell',true))));
    if (result.orientation && !['portrait', 'landscape'].includes(result.orientation)) throw new Error('Table orientation must be portrait or landscape.');
    if (result.columnTypes && (result.columnTypes.length !== result.headers.length || result.columnTypes.some(t => !['text', 'number', 'currency', 'percent'].includes(t)))) throw new Error('Table columnTypes must match its columns.');
    if (result.widths && (result.widths.length !== result.headers.length || result.widths.some(width => !Number.isFinite(width) || width <= 0))) throw new Error('Table widths must be positive numbers, one per column.');
  }
  if (result.type === 'cards') {
    if (!Array.isArray(result.items) || result.items.length < 2 || result.items.length > 3) throw new Error('Cards need two or three items.');
    result.items = result.items.map(item => ({ ...item, title: string(item.title, 'card title', true), html: cleanInline(item.html != null ? string(item.html,'card html') : inline(string(item.text,'card text',true))) }));
  }
  if (result.type === 'image-column') result.blocks = result.blocks?.map(child => normalizeBlock(child, ids, counter));
  return result;
}

function validateAnchors(doc) {
  const targets = new Set([...doc.sections.map(section => section.id), ...doc.sections.flatMap(section => section.blocks.map(block => block.id)), ...doc.appendix.map(block => block.id)]);
  const fields = [];
  const visit = block => { if (block.html) fields.push(block.html); block.blocks?.forEach(visit); };
  doc.sections.forEach(section => section.blocks.forEach(visit)); doc.appendix.forEach(visit);
  for (const field of fields) for (const [, anchor] of field.matchAll(/href=["']#([^"']+)["']/g)) if (!targets.has(anchor)) throw new Error(`Local link target does not exist: #${anchor}.`);
}

export function validateProfessionalDocument(input) {
  if (input?.schemaVersion !== 2 || input?.kind !== 'document') throw new Error('Expected a schemaVersion: 2 document.');
  if (!input.metadata?.title || !Array.isArray(input.sections) || !input.sections.length) throw new Error('Document needs a title and at least one section.');
  const doc = structuredClone(input); doc.metadata = { ...doc.metadata }; doc.footnotes ||= {}; doc.sources ||= []; doc.appendix ||= [];
  if (doc.options?.darkPages != null) throw new Error('options.darkPages is not supported by professional-v2; use report-v1.');
  for (const key of ['title', 'author', 'date', 'version', 'subtitle', 'recipient', 'sender', 'subject', 'confidentiality', 'eyebrow', 'summary', 'smallPrint']) if (doc.metadata[key] != null) doc.metadata[key] = string(doc.metadata[key], `metadata.${key}`);
  if (doc.metadata.coverImage != null) throw new Error('metadata.coverImage is not supported by professional-v2; use report-v1 for amber image covers.');
  onlyKeys(doc, ['schemaVersion','kind','metadata','intent','sections','footnotes','sources','appendix','routerReasons'], 'document');
  onlyKeys(doc.metadata, metadataKeys, 'metadata');
  if (doc.routerReasons != null && (!Array.isArray(doc.routerReasons) || doc.routerReasons.some(value => typeof value !== 'string'))) throw new Error('routerReasons must be an array of diagnostic strings.');
  if (!Array.isArray(doc.sources) || !Array.isArray(doc.appendix)) throw new Error('sources and appendix must be arrays.');
  if (!doc.footnotes || typeof doc.footnotes !== 'object' || Array.isArray(doc.footnotes)) throw new Error('footnotes must be an object.');
  const inferred = inferDocumentIntent(doc); doc.intent = inferred.intent; doc.routerReasons = inferred.reasons;
  const ids = new Set(); const counter = { value: 1 };
  doc.sections = doc.sections.map((section, index) => {
    if (typeof section?.title !== 'string' || !Array.isArray(section.blocks)) throw new Error('Every section needs a string title and blocks; an empty title is allowed for untitled prose.');
    if (section.headerImage != null) throw new Error('section.headerImage is not supported by professional-v2; use report-v1 for amber image headers.');
    onlyKeys(section, ['id','title','blocks','pageBreakBefore'], 'section');
    if (section.pageBreakBefore != null && typeof section.pageBreakBefore !== 'boolean') throw new Error('section.pageBreakBefore must be a boolean.');
    section.title = string(section.title, 'section title', true);
    if (section.id != null) string(section.id,'section id');
    const id = section.id || `section-${index + 1}`;
    if (!/^[A-Za-z][\w-]*$/.test(id) || ids.has(id)) throw new Error(`Invalid or duplicate section ID: ${id}`);
    ids.add(id);
    return { ...section, id, blocks: section.blocks.map(block => normalizeBlock(block, ids, counter)) };
  });
  doc.appendix = doc.appendix.map(block => normalizeBlock(block, ids, counter));
  doc.footnotes = Object.fromEntries(Object.entries(doc.footnotes).map(([key, value]) => { if (!/^[A-Za-z0-9][\w-]*$/.test(key)) throw new Error('Note IDs must contain only letters, numbers, underscores or hyphens.'); return [key, cleanInline(string(value,'note definition',true))]; }));
  doc.sources.forEach(source => {
    onlyKeys(source, ['title','item','url','label','description'], 'source');
    if (!source.title) throw new Error('Each source needs a title.');
    for (const key of ['title','item','url','label','description']) if (source[key] != null) string(source[key], `source.${key}`);
    if (source.url && !/^https?:\/\//i.test(source.url)) throw new Error('Source URLs must use https:// or http://.');
    if (source.label != null && !source.url) throw new Error('Source label requires a URL so it can be preserved as link text.');
    if (source.description != null) source.description = cleanInline(source.description);
  });
  validateAnchors(doc);
  return doc;
}

export function toProfessionalDocument(legacy, { intent = legacy.metadata?.intent || {} } = {}) {
  const source = validateDocument(legacy, { defaultMetadata: false });
  // validateDocument generates report-only letters, heading counters and table
  // presentation variants. A professional family supplies its own styling;
  // supplied heading text, list markers, clause labels and cell contents remain.
  const migrateBlock = block => {
    const next = { ...block };
    if (next.type === 'heading') delete next.number;
    if (next.type === 'table') delete next.variant;
    if (next.blocks) next.blocks = next.blocks.map(migrateBlock);
    return next;
  };
  const sections = source.sections.map(({ letter, generatedTitle, ...section }) => ({ ...section, title: generatedTitle ? '' : section.title, blocks: section.blocks.map(migrateBlock) }));
  const routingIntent = normalizeIntent(intent, source.metadata);
  const metadata = { ...source.metadata };
  for (const key of ['family','documentFamily','type','audience','purpose','readingMode','editable','intent','sources']) delete metadata[key];
  return validateProfessionalDocument({
    schemaVersion: 2, kind: 'document', metadata, intent: routingIntent,
    sections, footnotes: source.footnotes, sources: source.sources, appendix: source.appendix.map(migrateBlock)
  });
}
