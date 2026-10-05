import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { inferDocumentIntent, validateProfessionalDocument, professionalFamilies } from '../src/professional-model.mjs';
import { renderProfessionalHtml } from '../src/professional-browser.mjs';
const run = promisify(execFile);

test('reader action and audience guide selection; incidental body words do not', () => {
  assert.equal(inferDocumentIntent({ metadata:{title:'October update'}, intent:{audience:'Board of directors',readerAction:'Make a decision about the pilot'} }).intent.family,'board');
  assert.equal(inferDocumentIntent({ metadata:{title:'October update'}, intent:{readerAction:'Compare packages and prices'} }).intent.family,'pricing');
  assert.equal(inferDocumentIntent({ metadata:{title:'October update'}, intent:{readerAction:'Follow the process steps'} }).intent.family,'sop');
  assert.equal(inferDocumentIntent({ metadata:{title:'Observed workflow'}, sections:[{title:'Evidence',blocks:[{type:'paragraph',text:'Our research examines contract pricing and proposal approvals.'}]}] }).intent.family,'report');
  assert.equal(inferDocumentIntent({ metadata:{title:'October update'}, intent:{family:'report',readerAction:'Compare packages and prices'} }).intent.family,'report');
  assert.equal(inferDocumentIntent({ metadata:{title:'Client proposal'}, intent:{readerAction:'Decide whether to approve'} }).intent.family,'proposal');
  assert.equal(inferDocumentIntent({ metadata:{title:'Statement of work'}, intent:{audience:'Board',readerAction:'Approve'} }).intent.family,'proposal');
  assert.equal(inferDocumentIntent({ metadata:{title:'Standard operating procedure'}, intent:{audience:'Committee',readerAction:'Approve'} }).intent.family,'sop');
});

test('reused prepared v1 JSON defaults to the current design without inventing dates', async () => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rovn-design-route-'));
  try {
    const input=path.join(dir,'memo.json'), prepared=path.join(dir,'prepared.json');
    await fs.writeFile(input,JSON.stringify({schemaVersion:1,metadata:{title:'Decision memo'},sections:[{title:'Decision',blocks:[{type:'paragraph',text:'Preserve this exact sentence and $42.'}]}]}));
    await run(process.execPath,['scripts/render.mjs',input,'--prepare',prepared]);
    const doc=JSON.parse(await fs.readFile(prepared,'utf8'));
    assert.equal(doc.schemaVersion,2); assert.equal(doc.intent.family,'memo');
    assert.equal(doc.metadata.date,undefined);
    assert.equal(doc.sections[0].blocks[0].text,'Preserve this exact sentence and $42.');
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});

test('every professional family keeps a white canvas, real brand mark and properly registered type', async () => {
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:816,height:1056}});
    for(const family of professionalFamilies) {
      const doc=validateProfessionalDocument({schemaVersion:2,kind:'document',metadata:{title:'Synthetic design specimen'},intent:{family},sections:[{title:'Supplied evidence',blocks:[{type:'paragraph',text:'A supplied sentence.'},{type:'callout',title:'Note',text:'A qualification.'},{type:'table',headers:['Item','Value'],rows:[['Example','42']]}]}]});
      await page.setContent(await renderProfessionalHtml(doc));
      await page.evaluate(() => document.fonts.ready);
      const result=await page.evaluate(()=>{
        const surfaces=[...document.querySelectorAll('html,body,header,aside,table,thead,th,td')];
        return {backgrounds:surfaces.map(e=>getComputedStyle(e).backgroundColor),images:surfaces.map(e=>getComputedStyle(e).backgroundImage),logo:document.querySelector('.brandline svg')?.getAttribute('aria-label'),faces:[...document.fonts].map(f=>({family:f.family,weight:f.weight,style:f.style})),synthesis:getComputedStyle(document.body).fontSynthesis};
      });
      assert.ok(result.backgrounds.every(c=>['rgb(255, 255, 255)','rgba(0, 0, 0, 0)'].includes(c)),family);
      assert.ok(result.images.every(v=>v==='none'),family);
      assert.equal(result.logo,'Rōvn');
      assert.equal(result.synthesis,'none');
      assert.ok(result.faces.some(f=>f.family==='Inter' && f.weight==='100 900' && f.style==='normal'));
      assert.ok(result.faces.some(f=>f.family==='Crimson' && f.weight==='200 900' && f.style==='italic'));
    }
  } finally { await browser.close(); }
});

test('authored emphasis panels retain accessible contrast and never tint the page', async () => {
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    const doc=validateProfessionalDocument({schemaVersion:2,kind:'document',metadata:{title:'Authored emphasis'},intent:{family:'report'},sections:[{title:'Findings',blocks:[{type:'callout',variant:2,title:'Ink panel',text:'Supplied finding.'},{type:'callout',variant:3,title:'Amber panel',text:'Supplied next action.'}]}]});
    await page.setContent(await renderProfessionalHtml(doc));
    const values=await page.evaluate(()=>[...document.querySelectorAll('body,.variant-2,.variant-2 strong,.variant-3')].map(e=>({background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color})));
    assert.equal(values[0].background,'rgb(255, 255, 255)');
    const luminance=color=>{const c=color.match(/\d+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
    const contrast=(a,b)=>{const v=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (v[0]+.05)/(v[1]+.05);};
    assert.ok(contrast(values[1].background,values[1].color)>=4.5);
    assert.ok(contrast(values[1].background,values[2].color)>=4.5);
    assert.ok(contrast(values[3].background,values[3].color)>=4.5);
  } finally { await browser.close(); }
});
