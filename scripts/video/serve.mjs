/**
 * Preview server for the pitch video.
 *
 *   node serve.mjs            # http://localhost:4173
 *   PORT=8080 node serve.mjs
 *
 * Serves the video pipeline directory, so the exported master, the web cut and
 * the poster/thumbnail are all reachable from a browser. Range requests are
 * implemented, otherwise browsers refuse to seek inside an mp4.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);

const MIME = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.wav': 'audio/wav',
  '.json': 'application/json',
  '.mjs': 'text/javascript',
};

/** Landing page: the exported cuts plus their poster, ready to click. */
function index() {
  const out = path.join(__dirname, 'out');
  const files = fs.existsSync(out) ? fs.readdirSync(out).sort() : [];
  const video = files.filter((f) => f.endsWith('.mp4'));
  const link = (f) => `<li><a href="/out/${f}">${f}</a> · ${size(path.join(out, f))}</li>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>PrivateOps · pitch video</title>
  <style>
    body{background:#04070d;color:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Arial,sans-serif;
         margin:0;padding:56px 64px}
    h1{font-size:34px;margin:0 0 6px} p{color:#8ea0b8}
    ul{line-height:2;font-size:19px} a{color:#a3e635}
    .hero{margin-top:28px;max-width:1100px}
    video{width:100%;border-radius:16px;border:1px solid rgba(255,255,255,.10);background:#000}
    img{width:520px;border-radius:12px;border:1px solid rgba(255,255,255,.10)}
    code{background:#0b1220;border-radius:6px;padding:3px 8px}
  </style></head><body>
    <h1>PrivateOps · 2-minute pitch</h1>
    <p>Streams straight from <code>scripts/video/out</code>.</p>
    <ul>${video.map(link).join('')}<li><a href="/assets/thumbnail.png">assets/thumbnail.png</a></li></ul>
    <div class="hero">
      <video src="/out/${video.find((f) => f.includes('720p')) || video[0] || ''}"
             poster="/out/poster.png" controls playsinline preload="metadata"></video>
    </div>
  </body></html>`;
}

const size = (f) => `${(fs.statSync(f).size / 1024 / 1024).toFixed(1)} MB`;

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');

    if (!rel) {
      const body = index();
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': Buffer.byteLength(body) });
      res.end(body);
      return;
    }

    const file = path.join(__dirname, rel);
    // Never serve anything outside the pipeline directory.
    if (!file.startsWith(__dirname) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }

    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const total = fs.statSync(file).size;
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');

    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(Number(range[2]), total - 1) : total - 1;
      if (start >= total || start > end) {
        res.writeHead(416, { 'content-range': `bytes */${total}` });
        res.end();
        return;
      }
      res.writeHead(206, {
        'content-type': type,
        'content-length': end - start + 1,
        'content-range': `bytes ${start}-${end}/${total}`,
        'accept-ranges': 'bytes',
        'cache-control': 'no-cache',
      });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      'content-type': type,
      'content-length': total,
      'accept-ranges': 'bytes',
      'cache-control': 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => {
    console.log(`[serve] http://localhost:${PORT}  (serving ${__dirname})`);
  });
