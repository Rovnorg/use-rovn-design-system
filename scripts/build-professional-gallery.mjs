#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = process.argv[2];
if (!output) throw new Error('Usage: node scripts/build-professional-gallery.mjs OUTPUT_DIRECTORY');
const destination = path.resolve(output);
const entries = ['executive-memo','business-plan','technical-report','proposal','letter','sop','board-paper','case-study','pricing','legal-reference'];
const report = { generatedAt:new Date().toISOString(), status:'generated candidates; requires independent content and visual review', examples:[], failures:[] };
await fs.mkdir(destination, {recursive:true});
async function command(script, args) {
  const result = await run(process.execPath,[path.join(root, 'scripts', script), ...args],{cwd:root,maxBuffer:8*1024*1024});
  return result.stdout.trim();
}
for (const name of entries) {
  const input = path.join(root,'examples/professional',name+(name==='legal-reference'?'.json':'.md'));
  const dir = path.join(destination,name);
  await fs.mkdir(dir,{recursive:true});
  try {
    await fs.copyFile(input,path.join(dir,path.basename(input)));
    const prepared = path.join(dir,`${name}.rovn.json`);
    await command('render.mjs',[input,'--prepare',prepared]);
    const pdf = path.join(dir,`${name}.pdf`);
    const pdfLog = await command('render.mjs',[prepared,'--out',pdf,'--screenshots']);
    const docx = path.join(dir,`${name}.docx`);
    const officeLog = await command('export-office.mjs',[prepared,'--out',docx]);
    const hashes={};
    for (const p of [input,prepared,pdf,docx]) hashes[path.basename(p)]=createHash('sha256').update(await fs.readFile(p)).digest('hex');
    report.examples.push({name,pdf:JSON.parse(pdfLog),office:JSON.parse(officeLog),hashes});
    console.log(`${name}: PDF and DOCX generated`);
  } catch(error) { report.failures.push({name,error:error.stderr||error.message}); console.error(`${name}: ${error.stderr||error.message}`); }
}
for (const [name,ext] of [['pilot-deck','pptx'],['pricing-workbook','xlsx']]) {
  try {
    const dir=path.join(destination,name); await fs.mkdir(dir,{recursive:true});
    const input=path.join(root,'examples/professional',`${name}.json`); await fs.copyFile(input,path.join(dir,`${name}.json`));
    const result=JSON.parse(await command('export-office.mjs',[input,'--out',path.join(dir,`${name}.${ext}`)]));
    report.examples.push({name,office:result}); console.log(`${name}: ${ext} generated`);
  } catch(error) { report.failures.push({name,error:error.stderr||error.message}); console.error(`${name}: ${error.stderr||error.message}`); }
}
await fs.writeFile(path.join(destination,'generation-record.json'),JSON.stringify(report,null,2)+'\n');
if(report.failures.length) process.exitCode=1;
