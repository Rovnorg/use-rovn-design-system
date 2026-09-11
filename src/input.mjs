import fs from 'node:fs/promises';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import matter from 'gray-matter';
import mammoth from 'mammoth';
import sanitize from 'sanitize-html';
import { JSDOM } from 'jsdom';
import { normalizeCalloutIcon } from './icons.mjs';

export const md = new MarkdownIt({ html: false, typographer: false, linkify: true }).use(footnote);
// Notion exports callouts as <aside> wrappers around Markdown. Parse their content,
// without enabling arbitrary HTML or changing examples inside fenced code blocks.
md.block.ruler.before('html_block', 'notion_aside', (state, start, end, silent) => {
  const line = n => state.src.slice(state.bMarks[n] + state.tShift[n], state.eMarks[n]).trim();
  if (line(start) !== '<aside>') return false;
  let close = start + 1;
  while (close < end && line(close) !== '</aside>') close++;
  if (close === end) throw new Error('Unclosed Notion <aside> callout.');
  if (silent) return true;
  const lines = Array.from({ length: close - start - 1 }, (_, i) => state.src.slice(state.bMarks[start + i + 1], state.eMarks[start + i + 1]));
  const first = lines.findIndex(s => s.trim());
  if (first >= 0 && /^[\p{Extended_Pictographic}\uFE0F\u200D\s]+$/u.test(lines[first])) lines.splice(first, 1);
  const token = state.push('blockquote_open', 'blockquote', 1); token.attrSet('class', 'notion-aside');
  state.md.block.parse(lines.join('\n'), state.md, state.env, state.tokens);
  state.push('blockquote_close', 'blockquote', -1); state.line = close + 1;
  return true;
}, { alt: ['paragraph', 'reference', 'blockquote'] });
const inlineTags = ['strong', 'em', 'a', 'code', 'br', 'sup', 'sub', 's', 'span'];
export function cleanInline(html) {
  // Markdown deliberately treats raw HTML as text. Legal source templates commonly use
  // inert span placeholders; retain their supplied words without printing the tag syntax.
  const source = String(html ?? '').replace(/&lt;\/?span(?:\s[\s\S]*?)?&gt;/gi, '');
  return sanitize(source, { allowedTags: inlineTags,
    allowedAttributes: { a: ['href', 'class'], sup: ['class'], span: ['data-note'] },
    allowedSchemes: ['https', 'http', 'mailto'], allowProtocolRelative: false,
    allowedSchemesByTag: { a: ['https', 'http', 'mailto'] },
    allowVulnerableTags: false,
    transformTags: { a: (tagName, attribs) => ({ tagName, attribs }) } });
}
export const inline = text => cleanInline(md.renderInline(String(text ?? '')));
export function sectionLetter(index) {
  let result = ''; for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result;
  return result;
}

function readBlocks(nodes, footnotes, warnings) {
  const blocks = [];
  for (const node of nodes) {
    const tag = node.tagName?.toLowerCase();
    if (!tag) continue;
    if (node.classList.contains('footnotes') || node.classList.contains('footnotes-sep')) continue;
    if (/^h[1-6]$/.test(tag)) blocks.push({ type: 'heading', level: Number(tag[1]), text: node.textContent.trim() });
    else if (tag === 'p') {
      const images = [...node.querySelectorAll('img')];
      for (const img of images) { blocks.push({ type: 'image', src: img.getAttribute('src'), alt: img.alt, caption: img.title || img.alt }); img.remove(); }
      if (node.textContent.trim()) blocks.push({ type: 'paragraph', html: cleanInline(node.innerHTML) });
    } else if (tag === 'ul' || tag === 'ol') {
      const start = Number(node.getAttribute('start') || 1);
      function list(listNode, depth = 0) {
        [...listNode.children].forEach((li, i) => {
          const nested = [...li.children].filter(e => ['UL', 'OL'].includes(e.tagName)); nested.forEach(e => e.remove());
          const html = li.innerHTML.replace(/<\/?p[^>]*>/g, '');
          blocks.push({ type: 'list-item', html: cleanInline(html), depth, marker: listNode.tagName === 'OL' ? `${(depth ? 1 : start) + i}.` : depth ? '⚬' : '•' });
          nested.forEach(e => list(e, depth + 1));
        });
      }
      list(node);
    } else if (tag === 'blockquote') {
      if ([...node.children].some(n => n.tagName !== 'P')) throw new Error('A blockquote contains structured content. Convert its lists/tables/code into separate supported components.');
      const paras = [...node.querySelectorAll('p')];
      let text = paras.map(p => p.innerHTML).join('<br><br>');
      const match = node.textContent.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);
      if (match) text = text.replace(/^\[!\w+\]\s*/, '');
      blocks.push({ type: 'callout', variant: match || node.classList.contains('notion-aside') ? 4 : 5, title: match?.[1] || '', html: cleanInline(text) });
    } else if (tag === 'table') {
      const rows = [...node.querySelectorAll('tr')].map(tr => [...tr.children].map(td => cleanInline(td.innerHTML)));
      blocks.push({ type: 'table', headers: rows.shift() || [], rows, variant: 1 });
    } else if (tag === 'pre') {
      const code = node.querySelector('code');
      if (code?.className === 'language-rovn') {
        let custom; try { custom = JSON.parse(code.textContent); } catch { throw new Error('Invalid JSON in a rovn component fence (```rovn).'); }
        blocks.push(custom);
      } else blocks.push({ type: 'code', text: node.textContent.replace(/\n$/, ''), language: code?.className.replace('language-', '') || '' });
    } else if (tag === 'hr') blocks.push({ type: 'rule' });
    else if (tag === 'div' || tag === 'section') blocks.push(...readBlocks([...node.children], footnotes, warnings));
    else throw new Error(`Unsupported document element <${tag}>. Convert it to a supported component first.`);
  }
  return blocks;
}

export async function loadInput(filename, { defaultMetadata = true } = {}) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.json') {
    const prepared = JSON.parse(await fs.readFile(filename, 'utf8'));
    return prepared.schemaVersion === 2 ? prepared : validateDocument(prepared, { defaultMetadata });
  }
  let metadata = {}, html, warnings = [];
  if (ext === '.md' || ext === '.markdown') {
    const parsed = matter(await fs.readFile(filename, 'utf8')); metadata = parsed.data;
    html = md.render(parsed.content);
  } else if (ext === '.docx') {
    const result = await mammoth.convertToHtml({ path: filename }, { includeDefaultStyleMap: true, convertImage: mammoth.images.imgElement(async image => ({ src: `data:${image.contentType};base64,${await image.read('base64')}` })) });
    html = result.value; warnings = result.messages.map(m => m.message);
    if (warnings.some(w => /unrecognised|unrecognized|unsupported/i.test(w))) throw new Error('DOCX contains unsupported content: ' + warnings.join('; '));
  } else throw new Error('Input must be Markdown, DOCX, or a prepared .rovn.json document.');
  const doc = new JSDOM(html).window.document;
  const notes = {};
  for (const li of doc.querySelectorAll('.footnote-item')) {
    li.querySelectorAll('.footnote-backref').forEach(e => e.remove());
    notes[li.id.replace('fn', '')] = cleanInline(li.innerHTML.replace(/<\/?p[^>]*>/g, ''));
  }
  // Mammoth DOCX footnote definitions and references.
  for (const li of doc.querySelectorAll('li[id^="footnote-"]')) {
    li.querySelectorAll('a[href^="#footnote-ref"]').forEach(e => e.remove());
    const key = li.id.replace('footnote-', ''); notes[key] = cleanInline(li.innerHTML.replace(/<\/?p[^>]*>/g, '')); li.remove();
  }
  for (const a of doc.querySelectorAll('a[href^="#fn"], a[href^="#footnote-"]')) {
    const key = a.getAttribute('href').replace(/^#(?:footnote-|fn)/, '');
    if (notes[key]) { const span = doc.createElement('span'); span.dataset.note = key; span.textContent = key; (a.parentElement?.tagName === 'SUP' ? a.parentElement : a).replaceWith(span); }
  }
  doc.querySelectorAll('ol:empty').forEach(e => e.remove());
  let blocks = readBlocks([...doc.body.children], notes, warnings);
  let title = metadata.title;
  if (blocks[0]?.type === 'heading' && blocks[0].level === 1 && (!title || title.trim() === blocks[0].text.trim())) { title ||= blocks[0].text; blocks.shift(); }
  title ||= path.basename(filename, ext).replace(/[-_]/g, ' ');
  const minLevel = Math.min(...blocks.filter(b => b.type === 'heading').map(b => b.level), 2);
  const sections = []; let current;
  for (const block of blocks) {
    if (block.type === 'heading' && block.level <= minLevel) {
      current = { title: block.text, blocks: [] }; sections.push(current);
    } else {
      if (!current) { current = { title: 'Overview', generatedTitle: true, blocks: [] }; sections.push(current); }
      if (block.type === 'heading') block.level = block.level - minLevel;
      current.blocks.push(block);
    }
  }
  const sources = Array.isArray(metadata.sources) ? metadata.sources : [];
  const appendix = [];
  // An explicit Sources/References heading is source material, not an ordinary body section.
  for (let i = sections.length - 1; i >= 0; i--) if (/^(sources|references|bibliography|appendix)$/i.test(sections[i].title)) appendix.unshift(...sections.splice(i, 1)[0].blocks);
  return validateDocument({ schemaVersion: 1, metadata: { ...metadata, title }, options: { darkPages: metadata.darkPages ?? true }, sections, footnotes: notes, sources, appendix, warnings }, { defaultMetadata });
}

const types = new Set(['paragraph', 'lead', 'heading', 'list-item', 'table', 'code', 'callout', 'cards', 'image', 'image-column', 'image-band', 'rule']);
export function validateDocument(input, { defaultMetadata = true } = {}) {
  if (input.schemaVersion !== 1) throw new Error('Expected schemaVersion: 1.');
  if (!input.metadata?.title || !Array.isArray(input.sections) || !input.sections.length) throw new Error('Document needs a title and at least one section.');
  const doc = structuredClone(input); doc.footnotes ||= {}; doc.sources ||= []; doc.appendix ||= []; doc.warnings ||= [];
  doc.options ||= {};
  if (doc.options.darkPages == null) doc.options.darkPages = true;
  if (typeof doc.options.darkPages !== 'boolean') throw new Error('options.darkPages must be true or false.');
  for (const key of ['title', 'subtitle', 'eyebrow', 'summary', 'smallPrint', 'author', 'date', 'version']) {
    if (doc.metadata[key] != null) doc.metadata[key] = key === 'date' && doc.metadata[key] instanceof Date ? doc.metadata[key].toISOString().slice(0, 10) : String(doc.metadata[key]);
  }
  if (defaultMetadata) { doc.metadata.version ||= '1'; doc.metadata.date ||= new Date().toISOString().slice(0, 10); }
  if (!doc.metadata.author) doc.warnings.push('No author supplied; author field omitted.');
  doc.warnings = [...new Set(doc.warnings)];
  if (!Array.isArray(doc.sources) || !Array.isArray(doc.appendix) || !Array.isArray(doc.warnings)) throw new Error('Sources, appendix, and warnings must be arrays.');
  doc.sources.forEach(source => {
    if (!source || typeof source !== 'object' || !source.title) throw new Error('Each source needs a title.');
    doc.options ||= {};
  if (doc.options.darkPages == null) doc.options.darkPages = true;
  if (typeof doc.options.darkPages !== 'boolean') throw new Error('options.darkPages must be true or false.');
  for (const key of ['title', 'item', 'url', 'label']) if (source[key] != null) source[key] = String(source[key]);
    if (source.url && !/^https?:\/\//i.test(source.url)) throw new Error('Source URLs must use https:// or http://.');
    if (source.description) source.description = cleanInline(source.description);
  });
  let serial = 0;
  const ids = new Set();
  function reserve(block) {
    if (block.id) {
      if (!/^[a-zA-Z][\w-]*$/.test(block.id) || /^(section-|source-|sources-heading$|appendix$)/.test(block.id) || ids.has(block.id)) throw new Error('Invalid or duplicate component ID: ' + block.id);
      ids.add(block.id);
    }
    block.blocks?.forEach(reserve);
  }
  doc.sections.forEach(s => s.blocks?.forEach(reserve)); doc.appendix.forEach(reserve);
  function validate(block) {
    if (!types.has(block.type)) throw new Error(`Unsupported component: ${block.type}`);
    if (!block.id) { do { block.id = `block-${++serial}`; } while (ids.has(block.id)); ids.add(block.id); }
    if (block.caption != null) block.caption = cleanInline(block.caption);
    block.images?.forEach(i => { if (i.caption != null) i.caption = cleanInline(i.caption); });
    if (block.html != null) block.html = cleanInline(block.html);
    else if (block.text != null && !['code', 'heading'].includes(block.type)) block.html = inline(block.text);
    if (block.type === 'heading' && !block.text) throw new Error('Heading text is required.');
    if (block.type === 'callout') { block.variant ||= 1; if (![1, 2, 3, 4, 5, 6].includes(block.variant)) throw new Error('Callout variant must be 1–6.'); }
    if (block.type === 'callout') normalizeCalloutIcon(block);
    if (block.type === 'cards') {
      if (!Array.isArray(block.items) || block.items.length < 2 || block.items.length > 3) throw new Error('Cards need two or three items.');
      block.variant ||= 'numbered';
      if (!['numbered', 'icons', 'ruled-numbered', 'ruled-icons'].includes(block.variant)) throw new Error('Unknown cards variant.');
      block.items.forEach(item => { item.html = item.html != null ? cleanInline(item.html) : inline(item.text); });
    }
    if (block.type === 'table') {
      if (!block.headers?.length || !Array.isArray(block.rows) || block.rows.some(r => r.length !== block.headers.length)) throw new Error('Table rows must match the header column count.');
      block.headers = block.headers.map(cleanInline); block.rows = block.rows.map(r => r.map(cleanInline));
      if (block.widths && (block.widths.length !== block.headers.length || block.widths.some(n => !Number.isFinite(n) || n <= 0))) throw new Error('Table widths must be positive numbers, one per column.');
    }
    if (block.type.startsWith('image')) {
      if (block.type === 'image-column') {
        if (!block.images?.length || block.images.length > 2 || !block.blocks?.length || block.images.some(i => !i.src)) throw new Error('Image columns need one or two images and text blocks.');
        if (block.blocks.some(b => !['paragraph', 'heading', 'callout', 'list-item'].includes(b.type))) throw new Error('Image-column text supports paragraphs, headings, callouts, and lists.');
        block.blocks.forEach(validate);
      }
      else if (!block.src) throw new Error('Image src is required.');
    }
  }
  doc.sections.forEach((section, i) => {
    if (!section.title || !Array.isArray(section.blocks)) throw new Error('Every section needs title and blocks.');
    section.id = `section-${i + 1}`; section.letter = sectionLetter(i); let sub = 0;
    section.blocks.forEach(b => { validate(b); if (b.type === 'heading' && (b.level || 1) === 1) b.number = section.letter + (++sub); });
  });
  doc.appendix.forEach(validate);
  Object.keys(doc.footnotes).forEach(k => { doc.footnotes[k] = cleanInline(doc.footnotes[k]); });
  return doc;
}
