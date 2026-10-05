import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { root, localizeDocument } from './runtime.mjs';
import { validateProfessionalDocument } from './professional-model.mjs';
import { renderProfessionalHtml } from './professional-browser.mjs';
const run = promisify(execFile);

export async function renderProfessional(input, { out, screenshots = false, input: inputPath } = {}) {
  if (!out || path.extname(out).toLowerCase() !== '.pdf') throw new Error('Professional PDF output must end in .pdf.');
  try { await run('pdfinfo', ['-v']); if (screenshots) await run('pdftoppm', ['-v']); }
  catch (error) { throw new Error(`Professional PDF verification requires Poppler pdfinfo${screenshots ? ' and pdftoppm' : ''}: ${error.message}`); }
  const doc = await localizeDocument(validateProfessionalDocument(input), inputPath || out);
  const html = await renderProfessionalHtml(doc);
  await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1056, height: 816 }, deviceScaleFactor: 1 });
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    await page.route('**/*', route => route.request().url().startsWith('data:') ? route.continue() : route.abort());
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    // The inline report can run before embedded images have decoded.
    // Recheck only this asynchronous condition after load; retain every other issue.
    await page.evaluate(async () => { await Promise.all([...document.images].map(image => image.decode())); });
    const report = await page.evaluate(() => {
      const result = window.ROVN_PROFESSIONAL_RESULT;
      result.issues = result.issues.filter(issue => issue !== 'Unreadable image');
      for (const image of document.images) if (!image.complete || !image.naturalWidth) result.issues.push('Unreadable image');
      return result;
    });
    report.warnings = Object.keys(doc.footnotes).length ? ['Professional PDF renders supplied footnotes as linked endnotes. Use a supported Word or specialist route when page-associated footnotes are required.'] : [];
    if (failures.length || report.issues.length) throw new Error([...failures, ...report.issues].join('\n'));
    await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true, tagged: true, outline: true, displayHeaderFooter: false });
    await page.evaluate(() => document.querySelectorAll('script').forEach(node => node.remove()));
    const finalHtml = await page.content(); await fs.writeFile(out.replace(/\.pdf$/, '.html'), '<!doctype html>\n' + finalHtml.replace(/^<!DOCTYPE html>/i, ''));
    // Chromium's PDF page tree is authoritative for this route; a visual HTML sheet can span pages.
    const info = await run('pdfinfo', [out]);
    const pageCount = Number(info.stdout.match(/^Pages:\s+(\d+)$/m)?.[1]);
    if (!Number.isSafeInteger(pageCount) || pageCount < 1) throw new Error('pdfinfo did not return a valid page count.');
    if (screenshots) {
      const dir = out.replace(/\.pdf$/, '-pages'); await fs.mkdir(dir, { recursive: true });
      for (const file of await fs.readdir(dir)) if (/^(?:page-\d+|\d{3})\.png$/.test(file)) await fs.unlink(path.join(dir, file));
      try {
        await run('pdftoppm', ['-png', '-r', '144', out, path.join(dir, 'page')]);
      } catch (error) { throw new Error(`PDF page screenshots require pdftoppm: ${error.message}`); }
      const files = (await fs.readdir(dir)).filter(file => /^page-\d+\.png$/.test(file)).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
      if (files.length !== pageCount) throw new Error(`PDF screenshot count ${files.length} does not match PDF page count ${pageCount}.`);
      await Promise.all(files.map((file, index) => fs.rename(path.join(dir, file), path.join(dir, `${String(index + 1).padStart(3, '0')}.png`))));
    }
    const rendererFiles = ['src/professional-browser.mjs', 'src/professional-model.mjs', 'src/professional.css', 'src/professional-render.mjs', 'src/runtime.mjs', 'assets/brand/rovn-lockup.svg', 'assets/fonts/inter/InterVariable.woff2', 'assets/fonts/inter/InterVariable-Italic.woff2', 'assets/fonts/Crimson_Pro/CrimsonPro-VariableFont_wght.ttf', 'assets/fonts/Crimson_Pro/CrimsonPro-Italic-VariableFont_wght.ttf', 'assets/fonts/fragment-mono/FragmentMono-Regular.woff2'];
    if (doc.intent.family === 'proposal') rendererFiles.push('src/proposal.css');
    const professionalSources = await Promise.all(rendererFiles.map(file => fs.readFile(path.join(root, file))));
    const result = { ...report, pageCount, chromiumVersion: browser.version(), pdf: path.resolve(out), professionalRendererHash: createHash('sha256').update(Buffer.concat(professionalSources)).digest('hex') };
    await fs.writeFile(out.replace(/\.pdf$/, '.qa.json'), JSON.stringify(result, null, 2) + '\n');
    return result;
  } finally { await browser?.close(); }
}
