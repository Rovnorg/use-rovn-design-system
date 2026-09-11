import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {JSDOM} from 'jsdom';
const run=promisify(execFile);
async function render(input,name,args=[]) {
  const out=path.resolve(`tmp/tests/${name}.pdf`);
  await run(process.execPath,['scripts/render.mjs',input,'--out',out,'--layout','report-v1',...args],{maxBuffer:2e6});
  const qa=JSON.parse(await fs.readFile(out.replace('.pdf','.qa.json'),'utf8'));
  const html=await fs.readFile(out.replace('.pdf','.html'),'utf8');
  assert.equal((await fs.readFile(out)).subarray(0,5).toString(),'%PDF-');
  assert.deepEqual(qa.issues,[]);assert.equal(qa.pages[0].printed,null);assert.equal(qa.pages[1].printed,1);
  assert.equal(qa.pages.filter(p=>p.kind!=='body' && p.theme==='dark').length,0);
  for(let i=1;i<qa.darkBodyIndices.length;i++)assert.ok(qa.darkBodyIndices[i]-qa.darkBodyIndices[i-1]>1);
  assert.ok(!html.includes('src="/assets/'));assert.ok(!html.includes('url(/assets/'));assert.ok(html.includes('data:font/woff2;base64,'));
  const dom=new JSDOM(html).window.document;
  for(const a of dom.querySelectorAll('[data-kind="toc"] a')) {
    const target=dom.getElementById(a.getAttribute('href').slice(1));assert.ok(target,'ToC target exists');
    const row=a.closest('[data-p="2.0.1.1.0"]');
    if(row)assert.equal(Number(row.lastElementChild.textContent),Number(target.closest('.page').dataset.page));
  }
  for(const p of dom.querySelectorAll('.page')) {
    for(const ref of p.querySelectorAll('.page-content [data-note]'))assert.ok(p.querySelector(`[data-note-definition="${ref.dataset.note}"]`),'footnote stays on citation page');
  }
  return {qa,dom};
}
test('sample uses local branded components, resolved ToC, appendix, footnotes and balanced dark pages',async()=>{
  const {qa,dom}=await render('examples/sample.md','sample');
  assert.equal(qa.bodyPageCount,8);assert.equal(qa.darkBodyIndices.length,2);
  assert.equal(qa.pages.filter(p=>p.kind==='body' && p.opener).length,7);
  assert.ok(dom.querySelector('[data-type="image-band"]'));
  assert.equal(dom.querySelector('[data-type="image-band"]').style.height,'377px');
  assert.ok(dom.querySelector('[data-type="image-column"]'));
  assert.ok(qa.preservedContentFields>30);
});
test('overflow preserves prose, table cells, rich cards and literal code; long ToC converges past Z',async()=>{
  await fs.mkdir('tmp/tests',{recursive:true});
  const prose='A precise claim with the number 42 and its qualification. '.repeat(140);
  const code=Array.from({length:150},(_,i)=>`  const item${i} = ${i};\n`).join('');
  const d={schemaVersion:1,metadata:{title:'Pagination verification',author:'Test',date:'2026-09-08'},sections:[{title:'Long content',blocks:[
    {type:'heading',text:'Flow'}, {type:'paragraph',id:'long-prose',text:prose},
    {type:'table',headers:['ID','Description','State'],rows:Array.from({length:35},(_,i)=>[String(i),'Description for '+i+'. '+('A retained detail. '.repeat(6)),'Ready'])},
    {type:'cards',variant:'numbered',items:[{title:'One',text:'First item. '.repeat(300)},{title:'Two',text:'Second item. '.repeat(150)}]},
    {type:'code',id:'literal-code',text:code},
    {type:'paragraph',html:'Two supplied notes <span data-note="1">1</span> and <span data-note="2">2</span>.'}
  ]},...Array.from({length:26},(_,i)=>({title:'Section '+(i+2),blocks:[{type:'heading',text:'A detailed subsection title that must wrap without colliding with the contents page number'},{type:'paragraph',text:'A supplied fact for section '+(i+2)+'.'}]}))],footnotes:{'1':'First note.','2':'Second note.'},sources:Array.from({length:16},(_,i)=>({title:'Source '+i,url:'https://example.com/'+i,description:'A supplied description. '.repeat(12)}))};
  const input='tmp/tests/stress.rovn.json';await fs.writeFile(input,JSON.stringify(d));
  const {qa,dom}=await render(input,'stress');
  assert.ok(qa.pages.filter(p=>p.kind==='toc').length>1);assert.ok(qa.pages.filter(p=>p.kind==='appendix').length>1);
  assert.ok(qa.bodyPageCount>27);assert.ok(qa.darkBodyIndices.length/qa.bodyPageCount>=.2);assert.ok(qa.darkBodyIndices.length/qa.bodyPageCount<=.25);
  assert.equal([...dom.querySelectorAll('[data-flow="literal-code"]')].map(n=>n.textContent).join(''),code);
  assert.equal([...dom.querySelectorAll('[data-flow="long-prose"]')].map(n=>n.textContent).join(''),prose);
  assert.ok(dom.querySelectorAll('[data-table-row="head"]').length>1);
  assert.ok(qa.pages.some(p=>p.section==='AA'));
  for(let i=1;i<=d.sources.length;i++)assert.equal(dom.querySelectorAll(`[data-type="source"][data-block="source-${i}"]`).length,1,'bibliography entries stay intact');
});

test('dark toggle preserves pagination and Lucide artwork inherits both template palettes',async()=>{
  await fs.mkdir('tmp/tests',{recursive:true});
  const d={schemaVersion:1,metadata:{title:'Icon verification',author:'Test',coverImage:{src:'assets/bg1.png',mood:'amber'}},options:{darkPages:false},sections:Array.from({length:8},(_,i)=>({title:'Section '+(i+1),blocks:[
    {type:'callout',variant:3,icon:'shield-check',title:'Privacy',text:'Protect the supplied documents.'},
    {type:'callout',variant:4,icon:'calendar-clock',title:'Renewal',text:'Check the expiry date.'},
    {type:'callout',variant:6,icon:'graduation-cap',title:'Learning',text:'Keep the certificate.'},
    {type:'callout',variant:4,icon:'none',text:'This callout has no icon.'}
  ]}))};
  const input='tmp/tests/icons.rovn.json';await fs.writeFile(input,JSON.stringify(d));
  const light=await render(input,'icons-light');
  const mixed=await render(input,'icons-mixed',['--dark-pages','on']);
  const forcedLight=await render(input,'icons-forced-light',['--dark-pages','off']);
  assert.equal(light.qa.darkPagesEnabled,false);assert.equal(mixed.qa.darkPagesEnabled,true);
  assert.equal(light.qa.darkBodyIndices.length,0);assert.equal(mixed.qa.darkBodyIndices.length,2);assert.equal(forcedLight.qa.darkBodyIndices.length,0);
  assert.equal(light.qa.pageCount,mixed.qa.pageCount);assert.equal(light.qa.preservedContentFields,mixed.qa.preservedContentFields);
  const icon=mixed.dom.querySelector('[data-theme="dark"] [data-lucide="shield-check"]');
  assert.equal(icon.style.color,'rgba(249, 244, 234, 0.4)');assert.equal(icon.getAttribute('stroke'),'currentColor');
  assert.equal(icon.querySelectorAll('path').length,2);assert.equal(icon.getAttribute('width'),'24');
  assert.equal(light.dom.querySelector('[data-lucide="shield-check"]').style.color,'rgba(27, 24, 20, 0.4)');
  assert.equal(light.dom.querySelectorAll('[data-type="callout"] svg[style*="visibility: hidden"]').length,8);
  await assert.rejects(()=>run(process.execPath,['scripts/render.mjs',input,'--dark-pages','maybe']),/must be on or off/);
});
