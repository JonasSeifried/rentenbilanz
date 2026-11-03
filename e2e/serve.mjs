// Statischer Testserver: liefert dist/ unter / und unter /unterordner/ aus,
// mit den Headern aus public/_headers (wie Cloudflare Pages). Nur für Tests.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('../dist/', import.meta.url).pathname;
const port = Number(process.env.PORT || 4174);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain' };

const headerText = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');
const globalHeaders = {};
let inGlobal = false;
for (const line of headerText.split('\n')) {
  if (!line.trim() || line.startsWith('#')) continue;
  if (!line.startsWith(' ')) { inGlobal = line.trim() === '/*'; continue; }
  if (inGlobal) { const i = line.indexOf(':'); globalHeaders[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
}

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.startsWith('/unterordner/')) path = path.slice('/unterordner'.length);
  else if (path === '/unterordner') { res.writeHead(301, { Location: '/unterordner/' }); return res.end(); }
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(root, path));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  try {
    if (!(await stat(file)).isFile()) throw new Error();
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', ...globalHeaders });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('404'); }
}).listen(port, () => console.log('Testserver auf http://localhost:' + port));
