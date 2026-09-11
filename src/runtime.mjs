import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = { '.gif': 'image/gif', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
export async function dataUrl(filename) {
  return `data:${mime[path.extname(filename).toLowerCase()] || 'application/octet-stream'};base64,${(await fs.readFile(filename)).toString('base64')}`;
}
export async function localizeDocument(doc, inputPath) {
  const base = path.dirname(path.resolve(inputPath));
  async function image(src) {
    if (typeof src !== 'string') throw new Error('Image source must be a local path or an embedded supported image.');
    if (/^data:image\/(png|jpeg|webp|gif);base64,/.test(src)) return src;
    if (/^https?:/i.test(src)) throw new Error(`Download this source image locally before rendering: ${src}`);
    const bundled = src.startsWith('/assets/') || src.startsWith('assets/');
    let filename = bundled ? path.join(root, src.replace(/^\//, '')) : path.resolve(base, src);
    if (!['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(path.extname(filename).toLowerCase())) throw new Error('Unsupported image type: ' + src);
    const [sourceRoot, assetRoot, realFile] = await Promise.all([fs.realpath(base), fs.realpath(path.join(root,'assets')), fs.realpath(filename)]);
    const contained = [sourceRoot, assetRoot].some(approvedRoot => { const relative = path.relative(approvedRoot, realFile); return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative); });
    if (!contained) throw new Error(`Image leaves its approved source directory: ${src}. Review the exact external file and copy it into the input directory if authorized.`);
    filename = realFile;
    return dataUrl(filename);
  }
  const amber = new Set(['assets/bg1.png', 'assets/bg2.png', 'assets/bg3.png', 'assets/bg4.png']);
  async function amberImage(src) {
    if (src && typeof src === 'object' && src.mood === 'amber' && typeof src.src === 'string') {
      return { ...src, src: await image(src.src) };
    }
    if (typeof src !== 'string') throw new Error('Custom cover/header imagery needs { src, mood: "amber" } after visual review.');
    if (!amber.has(src.replace(/^\//, ''))) throw new Error('Cover and header images must be from the approved amber set: assets/bg1.png through bg4.png.');
    return '/' + src.replace(/^\//, '');
  }
  if (doc.metadata.coverImage) doc.metadata.coverImage = await amberImage(doc.metadata.coverImage);
  async function block(b) {
    if (b.src) b.src = await image(b.src);
    if (b.amberSrc) b.amberSrc = await amberImage(b.amberSrc);
    if (b.images) for (const i of b.images) i.src = await image(i.src);
    if (b.blocks) for (const child of b.blocks) await block(child);
  }
  for (const s of doc.sections) {
    if (s.headerImage) s.headerImage = await amberImage(s.headerImage);
    for (const b of s.blocks) await block(b);
  }
  for (const b of doc.appendix) await block(b);
  return doc;
}
export async function serve(html) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (url === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return; }
      if (!/^\/(assets|templates|src)\//.test(url)) throw new Error('Not allowed');
      const filename = path.resolve(root, '.' + url);
      if (!filename.startsWith(root + path.sep)) throw new Error('Not allowed');
      res.setHeader('Content-Type', mime[path.extname(filename)] || 'application/octet-stream'); res.end(await fs.readFile(filename));
    } catch { res.statusCode = 404; res.end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}
export async function inlineAssets(html) {
  const urls = [...new Set([...html.matchAll(/(?:url\(["']?|src=["'])(\/assets\/[^"')]+)["']?\)?/g)].map(m => m[1]))];
  for (const url of urls) html = html.replaceAll(url, await dataUrl(path.join(root, url.slice(1))));
  return html;
}
