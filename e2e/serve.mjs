// Statischer Testserver: liefert dist/ unter / und unter /unterordner/ aus, mit den Headern aus
// public/_headers (wie Cloudflare Pages: pro Pfadmuster, `*` als Platzhalter). Nur für Tests.
// Optional: dist-harness/ (Komponenten-Testseite, siehe e2e/harness/) unter /__harness/.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('../dist/', import.meta.url).pathname;
const harnessRoot = new URL('../dist-harness/', import.meta.url).pathname;
const port = Number(process.env.PORT || 4174);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.txt': 'text/plain', '.png': 'image/png', '.json': 'application/json',
};

// `_headers` lesen: Zeilen ohne Einrückung sind Pfadmuster, eingerückte Zeilen Header dazu.
const rules = [];
for (const line of (await readFile(new URL('../public/_headers', import.meta.url), 'utf8')).split('\n')) {
  if (!line.trim() || line.trim().startsWith('#')) continue;
  if (!/^\s/.test(line)) { rules.push({ re: patternToRegExp(line.trim()), headers: {} }); continue; }
  const i = line.indexOf(':');
  if (i > 0 && rules.length) {
    let value = line.slice(i + 1).trim();
    const name = line.slice(0, i).trim();
    // Die CSP der Tests ist strenger als die ausgelieferte, solange `_headers` noch 'unsafe-inline' für
    // Styles erlaubt: Statische style-Attribute in Komponenten fallen so schon lokal als CSP-Verletzung auf.
    if (name.toLowerCase() === 'content-security-policy') value = value.replace(/(style-src[^;]*?)\s*'unsafe-inline'/, '$1');
    rules.at(-1).headers[name] = value;
  }
}
function patternToRegExp(p) {
  return new RegExp('^' + p.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
}
const headersFor = (path) => Object.assign({}, ...rules.filter(r => r.re.test(path)).map(r => r.headers));

async function send(res, status, file, path) {
  res.writeHead(status, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', ...headersFor(path) });
  res.end(await readFile(file));
}

createServer(async (req, res) => {
  let path;
  try { path = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch { res.writeHead(400); return res.end('400'); }
  const urlPath = path;
  let base = root;
  if (path.startsWith('/__harness/')) { base = harnessRoot; path = path.slice('/__harness'.length); }
  else if (path.startsWith('/unterordner/')) path = path.slice('/unterordner'.length);
  else if (path === '/unterordner') { res.writeHead(301, { Location: '/unterordner/' }); return res.end(); }
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(base, path));
  if (!file.startsWith(base)) { res.writeHead(403); return res.end(); }
  try {
    if (!(await stat(file)).isFile()) throw new Error();
    await send(res, 200, file, urlPath);
  } catch {
    // Wie Cloudflare Pages: Gibt es eine 404.html, wird sie mit Status 404 ausgeliefert.
    try { await send(res, 404, join(root, '404.html'), urlPath); }
    catch { res.writeHead(404, headersFor(urlPath)); res.end('404'); }
  }
}).listen(port, () => console.log('Testserver auf http://localhost:' + port));
