#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { renderOffice } from '../src/office.mjs';

const [input, ...rest] = process.argv.slice(2);
const outFlag = rest.indexOf('--out');
if (!input || outFlag < 0 || !rest[outFlag + 1] || rest.length !== 2) {
  throw new Error('Usage: node scripts/export-office.mjs model.v2.json --out output.docx|output.pptx|output.xlsx');
}
const out = path.resolve(rest[outFlag + 1]);
const format = path.extname(out).slice(1).toLowerCase();
const model = JSON.parse(await fs.readFile(path.resolve(input), 'utf8'));
const result = await renderOffice(model, { out, format });
console.log(JSON.stringify(result, null, 2));
