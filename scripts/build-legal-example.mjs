// Mechanical fixture transformation; never a legal drafting or execution tool.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import MarkdownIt from 'markdown-it';
import { JSDOM } from 'jsdom';
import { cleanInline } from '../src/input.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'examples/professional/sources/commonpaper-nda');
const md = new MarkdownIt({ html: true, typographer: false }); // trusted, pinned licensed fixture only
const source = await fs.readFile(path.join(sourceDir, 'Mutual-NDA.md'), 'utf8');
const dom = new JSDOM(`<body>${md.render(source)}</body>`).window.document;
const clauseNodes = [...dom.querySelectorAll('body > ol > li')];
if (clauseNodes.length !== 11) throw new Error('The pinned Common Paper fixture must have exactly 11 clauses.');
const clauses = clauseNodes.map((node, index) => {
  const html = cleanInline(node.innerHTML.replace(/<\/?p>/g, '').trim());
  const before = node.textContent.replace(/\s+/g, ' ').trim();
  const after = new JSDOM(`<body>${html}</body>`).window.document.body.textContent.replace(/\s+/g, ' ').trim();
  if (before !== after) throw new Error(`Text changed in clause ${index + 1}.`);
  return { type: 'clause', label: `${index + 1}.`, html };
});
const attribution = [...dom.querySelectorAll('body > p')].at(-1);
if (!attribution?.textContent.includes('CC BY 4.0')) throw new Error('Missing source attribution.');
const model = {
  schemaVersion: 2, kind: 'document',
  metadata: { title: 'Common Paper Mutual NDA — Standard Terms', subtitle: 'Version 1.0 · licensed reference sample', confidentiality: 'Layout reference only — cover page not included; not ready for signature' },
  intent: { family: 'legal' },
  sections: [{ id: 'standard-terms', title: 'Standard Terms', blocks: [...clauses, { type:'paragraph', html:cleanInline(attribution.innerHTML) }] }],
  footnotes:{}, sources:[], appendix:[]
};
const digest = createHash('sha256').update(source).digest('hex');
await fs.writeFile(path.join(root, 'examples/professional/legal-reference.json'), `${JSON.stringify(model, null, 2)}\n`);
console.log(JSON.stringify({ clauses: clauses.length, textPreserved: true, sourceSha256:digest, sourceRevision:'2a3068b6c0ab6015c440f541d5b215bc3ac2f4cb', omitted:'Cover page intentionally not part of this Standard Terms reference. No execution-ready agreement is claimed.' }, null, 2));
