import fs from 'fs';
import http from 'http';
import path from 'path';
import url from 'url';

const ROOT = path.dirname(url.fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || 8123);

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.map': 'application/json; charset=utf-8',
    '.data': 'application/octet-stream',
};

http.createServer((req, res) => {
    const pathname = decodeURIComponent(url.parse(req.url).pathname);
    let file = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
    if (!file.startsWith(ROOT)) {
        res.writeHead(403).end('forbidden');
        return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404).end('not found: ' + pathname);
        return;
    }
    res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}/`));
