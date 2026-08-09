/* Zero-dependency production static server for web/out.
 * Honours $PORT (Railway/most hosts) and serves the static export with
 * directory-index + .html resolution and a 404 fallback. */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));      // .../web
const ROOT = join(HERE, 'out');
const PORT = process.env.PORT || 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

async function resolveFile(p) {
  for (const cand of [p, join(p, 'index.html'), p + '.html']) {
    try { const s = await stat(cand); if (s.isFile()) return cand; } catch {}
  }
  return null;
}

createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = normalize(url).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
    let file = await resolveFile(join(ROOT, rel));
    let status = 200;
    if (!file) { file = (await resolveFile(join(ROOT, '404.html'))) || join(ROOT, 'index.html'); status = file.endsWith('404.html') ? 404 : 200; }
    const body = await readFile(file);
    res.statusCode = status;
    res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.end(body);
  } catch {
    res.statusCode = 500; res.end('Internal Server Error');
  }
}).listen(PORT, () => console.log(`ExamPath web serving ${ROOT} on :${PORT}`));
