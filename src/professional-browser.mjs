import fs from 'node:fs/promises';
import path from 'node:path';
import { root } from './runtime.mjs';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const data = async filename => `data:${path.extname(filename) === '.ttf' ? 'font/ttf' : 'font/woff2'};base64,${(await fs.readFile(filename)).toString('base64')}`;
function rich(value) { return String(value || '').replace(/<span data-note="([^"]+)">([\s\S]*?)<\/span>/g, (_, key, label) => `<sup class="note-ref"><a href="#note-${escape(key)}" aria-label="Note ${escape(key)}">${label}</a></sup>`); }
function plain(value) { return String(value || '').replace(/<[^>]+>/g, ' ').replace(/&(?:amp|lt|gt|quot|#39);/g, ' ').replace(/\s+/g, ' ').trim(); }
function expected(block) {
  if (block.type === 'table') return plain([block.caption, ...block.headers, ...block.rows.flat(), block.note].join(' '));
  if (block.type === 'cards') return plain(block.items.flatMap(item => [item.title, item.html]).join(' '));
  if (block.type === 'key-values') return plain(block.items.flatMap(item => [item.label, item.value]).join(' '));
  if (block.type === 'definition-list') return plain(block.items.flatMap(item => [item.term, item.definition]).join(' '));
  if (block.type === 'clause') return plain([block.label, block.title, block.html, block.note].join(' '));
  if (block.type === 'list-item') return plain([block.marker, block.html, block.note].join(' '));
  if (block.type === 'signature') return plain([block.caption, ...block.parties.flatMap(party => [party.name, party.role, party.organization]), block.note].join(' '));
  if (block.type === 'image' || block.type === 'image-band') return plain(block.caption);
  if (block.type === 'image-column') return plain(block.blocks.map(expected).join(' ') + block.images.map(image => image.caption || '').join(' '));
  return plain([block.html || block.text || '', block.title, block.label, block.marker, block.note].join(' '));
}
function attributes(block) { const text = expected(block); return `id="${escape(block.id)}" data-block="${escape(block.id)}"${text ? ` data-expected="${escape(text)}"` : ''}`; }
function note(block) { return block.note ? `<small class="block-note">${rich(block.note)}</small>` : ''; }
function blockHtml(block, family) {
  const content = blockBodyHtml(block, family);
  if (!block.caption || ['table','image','image-band','signature'].includes(block.type)) return content;
  return `<figure class="captioned-block"><figcaption data-block="${escape(block.id)}-caption" data-expected="${escape(plain(block.caption))}">${rich(block.caption)}</figcaption>${content}</figure>`;
}
function blockBodyHtml(block, family) {
  const headingLevel = (block.level || 1) + 2;
  switch (block.type) {
    case 'paragraph': return `<p ${attributes(block)}>${rich(block.html)}${note(block)}</p>`;
    case 'lead': return `<p class="lead" ${attributes(block)}>${rich(block.html)}${note(block)}</p>`;
    case 'heading': return `<h${headingLevel} ${attributes(block)}>${escape(block.text)}${note(block)}</h${headingLevel}>`;
    case 'list-item': return `<div class="list-item depth-${block.depth || 0}" style="margin-left:${(block.depth || 0)*.22}in" ${attributes(block)}><span>${escape(block.marker ?? '•')}</span><div>${rich(block.html)}${note(block)}</div></div>`;
    case 'callout': return `<aside class="callout variant-${block.variant || 1}" ${attributes(block)}>${block.title ? `<strong>${escape(block.title)}</strong>` : ''}<div>${rich(block.html)}</div>${note(block)}</aside>`;
    case 'cards': return `<div class="cards ${escape(block.variant || 'numbered')}" ${attributes(block)}>${block.items.map((item, index) => `<article><span>${index + 1}</span><h3>${escape(item.title || '')}</h3><div>${rich(item.html)}</div></article>`).join('')}${note(block)}</div>`;
    case 'table': { const total = (block.widths || block.headers.map(() => 1)).reduce((sum, width) => sum + width, 0); return `<figure class="table-wrap ${block.orientation === 'landscape' ? 'landscape-sheet' : ''}" ${attributes(block)}>${block.caption ? `<figcaption>${rich(block.caption)}</figcaption>` : ''}<table><colgroup>${(block.widths || block.headers.map(() => 1)).map(width => `<col style="width:${width / total * 100}%">`).join('')}</colgroup><thead><tr>${block.headers.map((header, index) => `<th scope="col" class="${escape(block.columnTypes?.[index] || 'text')}">${rich(header)}</th>`).join('')}</tr></thead><tbody>${block.rows.map(row => `<tr>${row.map((cell, index) => `<td class="${escape(block.columnTypes?.[index] || 'text')}">${rich(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>${block.note ? `<small>${rich(block.note)}</small>` : ''}</figure>`; }
    case 'code': return `<div ${attributes(block)}>${block.language ? `<small class="code-language" data-block="${escape(block.id)}-language" data-expected="${escape(block.language)}">${escape(block.language)}</small>` : ''}<pre><code>${escape(block.text)}</code></pre>${note(block)}</div>`;
    case 'image': return `<figure class="image" ${attributes(block)}><img src="${escape(block.src)}" alt="${escape(block.alt || '')}" style="${block.height ? `max-height:${block.height}px;` : ''}object-fit:${block.crop || block.decorative ? 'cover' : 'contain'}">${block.caption ? `<figcaption>${rich(block.caption)}</figcaption>` : ''}${note(block)}</figure>`;
    case 'image-band': return `<figure class="image-band" ${attributes(block)}><img src="${escape(typeof block.src === 'object' ? block.src.src : block.src)}" alt="${escape(block.alt || '')}" style="object-fit:${block.crop || block.decorative ? 'cover' : 'contain'}">${block.caption ? `<figcaption>${rich(block.caption)}</figcaption>` : ''}${note(block)}</figure>`;
    case 'image-column': return `<div class="image-column" ${attributes(block)}><div>${block.blocks.map(child => blockHtml(child, family)).join('')}</div><div>${block.images.map(image => `<figure><img src="${escape(image.src)}" alt="${escape(image.alt || '')}">${image.caption ? `<figcaption>${rich(image.caption)}</figcaption>` : ''}</figure>`).join('')}</div>${note(block)}</div>`;
    case 'rule': return `<hr ${attributes(block)}>`;
    case 'key-values': return `<dl class="key-values" ${attributes(block)}>${block.items.map(item => `<div><dt>${escape(item.label)}</dt><dd>${escape(item.value)}</dd></div>`).join('')}${note(block)}</dl>`;
    case 'definition-list': return `<dl class="definitions" ${attributes(block)}>${block.items.map(item => `<div><dt>${escape(item.term)}</dt><dd>${escape(item.definition)}</dd></div>`).join('')}${note(block)}</dl>`;
    case 'clause': return `<section class="clause" ${attributes(block)}><h3><span>${escape(block.label)}</span>${block.title ? ` ${escape(block.title)}` : ''}</h3><div>${rich(block.html)}${note(block)}</div></section>`;
    case 'signature': return `<section class="signatures" ${attributes(block)}>${block.caption ? `<p>${escape(block.caption)}</p>` : ''}<div>${block.parties.map(party => `<section><div class="sign-line"></div><strong>${escape(party.name)}</strong>${party.role ? `<span>${escape(party.role)}</span>` : ''}${party.organization ? `<span>${escape(party.organization)}</span>` : ''}</section>`).join('')}</div>${note(block)}</section>`;
    case 'page-break': return `<div class="manual-break" aria-hidden="true" ${attributes(block)}></div>`;
    default: throw new Error(`Unsupported professional block ${block.type}`);
  }
}
function familyLabel(family) { return ({ 'business-plan': 'Business plan', 'case-study': 'Case study', sop: 'Operating procedure' })[family] || family; }
function metadataHtml(meta, intent) {
  const entries = [['Prepared by',meta.author],['From',meta.sender],['For',meta.recipient],['Subject',meta.subject],['Date',meta.date],['Version',meta.version],['Handling',meta.confidentiality]];
  if (intent.confidentiality && intent.confidentiality !== meta.confidentiality) entries.push(['Intent handling',intent.confidentiality]);
  return `<dl class="metadata">${entries.filter(([,value])=>value).map(([label,value])=>`<div><dt>${escape(label)}</dt><dd data-metadata="${escape(label)}">${escape(value)}</dd></div>`).join('')}</dl>`;
}
function cover(doc) {
  const meta = doc.metadata; const family = doc.intent.family;
  const conventional = ['legal','letter'].includes(family);
  return `<header class="${family==='legal'?'legal-heading':family==='letter'?'letter-heading':'cover'}">${meta.eyebrow || !conventional ? `<div class="eyebrow">${escape(meta.eyebrow || `Rōvn · ${familyLabel(family)}`)}</div>` : ''}<h1>${escape(meta.title)}</h1>${meta.subtitle?`<p>${escape(meta.subtitle)}</p>`:''}${meta.summary?`<p class="cover-summary">${escape(meta.summary)}</p>`:''}${metadataHtml(meta,doc.intent)}${meta.smallPrint?`<small class="cover-small-print">${escape(meta.smallPrint)}</small>`:''}</header>`;
}
function needsContents(doc) { const words = doc.sections.flatMap(section => section.blocks).map(expected).join(' ').trim().split(/\s+/).filter(Boolean).length; return ['business-plan', 'report', 'board'].includes(doc.intent.family) && words > 900; }
function contents(doc) { return `<nav class="contents" aria-label="Contents"><h2>Contents</h2><ol>${doc.sections.filter(section => section.title).map(section => `<li><a href="#${escape(section.id)}">${escape(section.title)}</a></li>`).join('')}${(doc.sources.length || doc.appendix.length) ? '<li><a href="#appendix">References and appendix</a></li>' : ''}</ol></nav>`; }
function references(doc) {
  if (!doc.sources.length && !doc.appendix.length) return '';
  return `<section id="appendix" class="appendix"><h2>References and appendix</h2>${doc.sources.length ? `<ol class="sources">${doc.sources.map(source => `<li><strong>${escape(source.title)}</strong>${source.item ? ` ${escape(source.item)}` : ''}${source.url ? ` <a href="${escape(source.url)}">${escape(source.label || source.url)}</a>` : ''}${source.description ? `<div>${rich(source.description)}</div>` : ''}</li>`).join('')}</ol>` : ''}${doc.appendix.map(block => blockHtml(block, doc.intent.family)).join('')}</section>`;
}
function sectionHeader(section, index, family) {
  if (!section.title) return '';
  const number = String(index + 1).padStart(2, '0');
  const title = escape(section.title); const id = escape(section.id);
  if (family === 'proposal') return `<header class="proposal-heading"><div><small>Scope ${number}</small><h2 id="${id}-title">${title}</h2></div><span>→</span></header>`;
  if (family === 'business-plan') return `<header class="plan-heading"><span>${number}</span><div><small>Business plan</small><h2 id="${id}-title">${title}</h2></div></header>`;
  if (family === 'case-study') return `<header class="case-heading"><small>Case evidence ${number}</small><h2 id="${id}-title">${title}</h2></header>`;
  if (family === 'sop') return `<header class="sop-heading"><span>${index + 1}</span><div><small>Operating step</small><h2 id="${id}-title">${title}</h2></div></header>`;
  if (family === 'pricing') return `<header class="pricing-heading"><small>Commercial schedule ${number}</small><h2 id="${id}-title">${title}</h2></header>`;
  if (family === 'board') return `<header class="board-heading"><small>Board readout · ${number}</small><h2 id="${id}-title">${title}</h2></header>`;
  return `<header><span>${number}</span><h2 id="${id}-title">${title}</h2></header>`;
}
export async function renderProfessionalHtml(doc) {
  const [inter, crimson, mono] = await Promise.all([data(path.join(root, 'assets/fonts/inter/InterVariable.woff2')), data(path.join(root, 'assets/fonts/Crimson_Pro/CrimsonPro-VariableFont_wght.ttf')), data(path.join(root, 'assets/fonts/fragment-mono/FragmentMono-Regular.woff2'))]);
  const family = doc.intent.family;
  const body = `${cover(doc)}${needsContents(doc) ? contents(doc) : ''}${doc.sections.map((section, index) => `<section class="sheet section section-${index + 1}${section.pageBreakBefore ? ' manual-break' : ''}" id="${escape(section.id)}" ${section.title ? `aria-labelledby="${escape(section.id)}-title"` : ''}>${sectionHeader(section, index, family)}${section.blocks.map(block => blockHtml(block, family)).join('')}</section>`).join('')}${references(doc)}${Object.keys(doc.footnotes).length ? `<section class="notes"><h2>Notes</h2><ol>${Object.entries(doc.footnotes).map(([key, note]) => `<li id="note-${escape(key)}"><span class="note-label">${escape(key)}.</span> ${rich(note)}</li>`).join('')}</ol></section>` : ''}`;
  const css = `@font-face{font-family:Inter;src:url(${inter}) format('woff2')}@font-face{font-family:Crimson;src:url(${crimson}) format('truetype')}@font-face{font-family:FragmentMono;src:url(${mono}) format('woff2')}${/* layout stylesheet follows */''}${await fs.readFile(path.join(root, 'src/professional.css'), 'utf8')}`;
  const familyCss = `.proposal-heading{display:flex!important;justify-content:space-between;align-items:end;background:#29241f;color:#fff;border:0!important;padding:.22in .25in!important}.proposal-heading h2{color:#fff;margin:.04in 0 0}.proposal-heading small{letter-spacing:.1em;text-transform:uppercase;color:#e6ab61}.proposal-heading>span{font:24pt Crimson,Georgia,serif}.plan-heading{display:grid!important;grid-template-columns:1.35in 1fr!important;gap:.2in!important;border:0!important;padding:0!important;align-items:end}.plan-heading>span{font:600 52pt/.8 Crimson,Georgia,serif;color:#d8b58d;letter-spacing:-.08em}.plan-heading small,.case-heading small,.pricing-heading small,.board-heading small,.sop-heading small{font-size:8pt;letter-spacing:.1em;text-transform:uppercase;color:#a85d15}.plan-heading h2{font-size:30pt!important;margin:.06in 0 0}.case-heading{display:block!important;border-left:5px solid #945c2a!important;border-bottom:0!important;padding:.06in 0 .06in .16in!important}.case-heading h2,.pricing-heading h2,.board-heading h2{margin:.06in 0 0}.sop-heading{display:grid!important;grid-template-columns:.45in 1fr!important;gap:.13in!important;border:0!important;background:#f5eadc;padding:.14in!important}.sop-heading>span{display:grid;place-items:center;width:.32in;height:.32in;border-radius:50%;background:#cd7d1f;color:#fff;font-weight:700}.sop-heading h2{margin:.03in 0 0!important;font-size:18pt!important}.pricing-heading{display:block!important;border-top:3px solid #27231e!important;border-bottom:0!important;padding-top:.1in!important}.board-heading{display:block!important;border-top:3px solid #e5a23d!important;border-bottom:0!important;padding-top:.1in!important}.family-memo .sheet{break-before:auto}.family-board .section-1{break-before:auto}`;
  const compactCss = !needsContents(doc) && !['legal', 'letter'].includes(family) ? `.family-${family} .cover{min-height:1.15in;padding:.34in 0 .16in;break-after:auto}.family-${family} .cover h1{font-size:25pt;margin:.1in 0 .05in}.family-${family} .cover dl{margin:.12in 0 0}.family-${family} .section>header{margin:.2in 0 .12in}.family-${family} .section>header h2{font-size:21pt}.family-${family} .proposal-heading{padding:.13in .2in!important}.appendix,.notes{break-before:auto}` : '.appendix,.notes{break-before:auto}';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(doc.metadata.title)}</title><style>${css}${familyCss}${compactCss}</style></head><body class="family-${escape(family)}">${body}<script>window.ROVN_PROFESSIONAL_RESULT=(()=>{const issues=[];const normalize=s=>s.replace(/\\s+/g,'').trim();for(const a of document.querySelectorAll('a[href^="#"]'))if(!document.getElementById(a.getAttribute('href').slice(1)))issues.push('Broken local link: '+a.getAttribute('href'));for(const node of document.querySelectorAll('img'))if(!node.getAttribute('src')||!node.complete||!node.naturalWidth)issues.push('Unreadable image');for(const node of document.querySelectorAll('[data-expected]'))if(!normalize(node.textContent).includes(normalize(node.dataset.expected)))issues.push('Content changed or missing: '+node.dataset.block);for(const node of document.querySelectorAll('[data-block],table,pre')){const r=node.getBoundingClientRect();if(r.left<-1||r.right>document.documentElement.clientWidth+1)issues.push('Horizontal overflow: '+(node.dataset.block||node.tagName));}for(const node of document.querySelectorAll('pre,.callout,.cards,.image,.image-band,.image-column,.signatures'))if(node.getBoundingClientRect().height>880)issues.push('Unsafe unsplittable block: '+(node.dataset.block||node.className));return {version:'professional-v2',family:${JSON.stringify(family)},routerReasons:${JSON.stringify(doc.routerReasons)},issues,pageCount:0,preservedContentFields:document.querySelectorAll('[data-expected]').length}})()</script></body></html>`;
  return html;
}
