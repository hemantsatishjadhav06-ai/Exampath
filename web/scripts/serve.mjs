// Minimal static file server for local preview of the exported site (web/out/).
// Resolves trailing-slash folder URLs to their index.html (matches the export).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "out");
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

async function resolve(pathname) {
  let p = decodeURIComponent(pathname.split("?")[0]);
  p = normalize(p).replace(/^(\.\.[/\\])+/, "");
  const candidates = [];
  if (p.endsWith("/")) candidates.push(join(OUT, p, "index.html"));
  else {
    candidates.push(join(OUT, p));
    candidates.push(join(OUT, p, "index.html"));
    candidates.push(join(OUT, p + ".html"));
  }
  for (const c of candidates) {
    try {
      const s = await stat(c);
      if (s.isFile()) return c;
    } catch {}
  }
  return null;
}

const server = createServer(async (req, res) => {
  const file = await resolve(req.url || "/");
  if (!file) {
    const nf = join(OUT, "404.html");
    try {
      const body = await readFile(nf);
      res.writeHead(404, { "Content-Type": MIME[".html"] });
      res.end(body);
      return;
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(500);
    res.end("500");
  }
});

server.listen(PORT, () => {
  console.log(`ExamPath preview running at http://localhost:${PORT}`);
});
