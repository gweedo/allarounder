// Serves the static export (`out/`) the way Cloudflare Pages does, so E2E
// runs against what actually ships rather than `next dev`:
//   /foo  -> foo.html, else foo/index.html
//   /     -> index.html
//   miss  -> 404.html with status 404
// Zero dependencies on purpose: CI runs it with plain `node`.
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "out");
const port = Number(process.env.PORT ?? 3100);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function isFile(file) {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

function resolve(urlPath) {
  const clean = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  const base = path.join(root, clean);
  if (!base.startsWith(root)) return null;
  const candidates = clean.endsWith("/")
    ? [path.join(base, "index.html"), base.replace(/[/\\]$/, "") + ".html"]
    : [base, `${base}.html`, path.join(base, "index.html")];
  return candidates.find(isFile) ?? null;
}

createServer((req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  const file = resolve(pathname);
  const status = file ? 200 : 404;
  const body = file ?? path.join(root, "404.html");
  res.writeHead(status, { "content-type": TYPES[path.extname(body)] ?? "application/octet-stream" });
  createReadStream(body).pipe(res);
}).listen(port, () => {
  console.log(`Serving ${root} on http://localhost:${port}`);
});
