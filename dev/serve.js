/* Server statico per le prove locali: IndexedDB non funziona da file://.
   node dev/serve.js  →  http://localhost:8080 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const RADICE = process.cwd();
const PORTA = +process.env.PORTA || 8080;
const TIPI = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.webmanifest':'application/manifest+json',
  '.svg':'image/svg+xml', '.png':'image/png' };

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = join(RADICE, normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(RADICE)) throw new Error('fuori radice');
    await stat(file);
    res.writeHead(200, { 'content-type': TIPI[extname(file)] || 'application/octet-stream',
                         'cache-control': 'no-store' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('non trovato');
  }
}).listen(PORTA, () => console.log('Serra su http://localhost:' + PORTA));
