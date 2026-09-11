import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { loadInput } from '../src/input.mjs';
import { toProfessionalDocument, validateProfessionalDocument, professionalFamilies } from '../src/professional-model.mjs';
import { renderProfessionalHtml } from '../src/professional-browser.mjs';
import { localizeDocument } from '../src/runtime.mjs';
import { validateOfficeDocument, validatePresentation, validateWorkbook } from '../src/office.mjs';

test('all narrative gallery sources prepare into the shared Word-compatible model', async () => {
  const dir = new URL('../examples/professional/', import.meta.url);
  for (const name of (await fs.readdir(dir)).filter(name => name.endsWith('.md'))) {
    const source = await loadInput(fileURLToPath(new URL(name, dir)), { defaultMetadata: false });
    const model = toProfessionalDocument(source);
    assert.doesNotThrow(() => validateOfficeDocument(model), name);
    assert.ok(model.sections.every(section => section.letter === undefined), name);
  }
});

test('every narrative family retains all supplied display metadata', async () => {
  const metadata = {title:'Unique title',subtitle:'Unique subtitle',author:'Unique author',sender:'Unique sender',recipient:'Unique recipient',subject:'Unique subject',date:'2026-09-11',version:'Draft 9',confidentiality:'Not approved',eyebrow:'Unique eyebrow',summary:'Unique summary',smallPrint:'Unique qualification'};
  for (const family of professionalFamilies) {
    const model=validateProfessionalDocument({schemaVersion:2,kind:'document',metadata,intent:{family,confidentiality:'Additional handling'},sections:[{title:'Supplied heading',blocks:[{type:'paragraph',text:'Supplied paragraph.'}]}]});
    const dom=new JSDOM(await renderProfessionalHtml(model));
    const header=dom.window.document.querySelector('body > header').textContent;
    for (const value of [...Object.values(metadata),'Additional handling']) assert.ok(header.includes(value),`${family} missing ${value}`);
    dom.window.close();
  }
});

test('image preparation refuses files outside source or bundled assets', async () => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rovn-image-scope-'));
  assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));
  try {
    const sourceDir=path.join(dir,'source'); await fs.mkdir(sourceDir);
    await fs.copyFile(new URL('../assets/bg1.png',import.meta.url),path.join(dir,'private.png'));
    const model={metadata:{},sections:[{blocks:[{type:'image',src:'../private.png'}]}],appendix:[]};
    await assert.rejects(localizeDocument(model,path.join(sourceDir,'input.md')),/approved source directory/);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});

test('captions and code language survive rendering; orphan source labels fail', async () => {
  const model={schemaVersion:2,kind:'document',metadata:{title:'Captions'},intent:{family:'report'},sections:[{title:'Fields',blocks:[{type:'paragraph',text:'Body',caption:'Paragraph qualification'},{type:'code',text:'const x = 42;',language:'javascript',caption:'Literal code caption'}]}]};
  const dom=new JSDOM(await renderProfessionalHtml(validateProfessionalDocument(model)));
  const visible=dom.window.document.body.textContent;
  for (const value of ['Paragraph qualification','Literal code caption','javascript','const x = 42;']) assert.ok(visible.includes(value),value);
  dom.window.close();
  assert.throws(()=>validateProfessionalDocument({...model,sources:[{title:'Source',label:'Missing destination'}]}),/label requires a URL/);
});

test('explicit presentation and workbook gallery sources satisfy their native schemas', async () => {
  const read = async name => JSON.parse(await fs.readFile(new URL(`../examples/professional/${name}.json`, import.meta.url), 'utf8'));
  assert.equal(validatePresentation(await read('pilot-deck')).slides.length, 6);
  assert.equal(validateWorkbook(await read('pricing-workbook')).sheets.length, 3);
});

test('professional schema preserves hierarchy and breaks and rejects destructive coercion', async () => {
  const input={schemaVersion:2,kind:'document',metadata:{title:'Hierarchy'},intent:{family:'memo'},sections:[{title:'Section',pageBreakBefore:true,blocks:[{type:'heading',level:4,text:'Deep heading'},{type:'page-break'}]}],footnotes:{7:'Seventh supplied note'}};
  const html=await renderProfessionalHtml(validateProfessionalDocument(input));
  assert.match(html,/<h6[^>]*>Deep heading/);
  assert.match(html,/section-1 manual-break/);
  assert.match(html,/note-label">7\.<\/span>/);
  for (const patch of [{footnotes:{1:{secret:'DO NOT COERCE'}}},{sources:[{title:'Source',item:{secret:'DO NOT COERCE'}}]},{metadata:{title:'Hierarchy',unknown:'Lost'}}]) assert.throws(()=>validateProfessionalDocument({...input,...patch}));
  for (const block of [{type:'heading',text:'Deep',level:'2'},{type:'list-item',text:'Item',marker:{}},{type:'code',text:42}]) assert.throws(()=>validateProfessionalDocument({...input,sections:[{title:'Section',blocks:[block]}]}));
  assert.throws(()=>validateProfessionalDocument({...input,sections:[{...input.sections[0],pageBreakBefore:'false'}]}));
});
