const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const appRoot = app.isPackaged
  ? path.join(process.resourcesPath, 'game')
  : path.resolve(__dirname, '../..');
let server;

function closeLocalServer() {
  if (server?.listening) server.close();
}

function startLocalServer() {
  server = http.createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed');
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    } catch (_) {
      response.writeHead(400).end('Bad request');
      return;
    }

    const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
    const filename = path.resolve(appRoot, relativePath);
    const normalizedRoot = path.resolve(appRoot) + path.sep;
    if (!filename.startsWith(normalizedRoot)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    fs.stat(filename, (statError, stats) => {
      if (statError || !stats.isFile()) {
        response.writeHead(404).end('Not found');
        return;
      }
      response.writeHead(200, {
        'Content-Type': MIME_TYPES[path.extname(filename).toLowerCase()] || 'application/octet-stream',
        'Content-Length': stats.size,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      fs.createReadStream(filename).pipe(response);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve(server.address().port);
    });
  });
}

async function openGame() {
  const port = await startLocalServer();
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#221f2e',
    title: '宝可梦幸存者',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${port}/`)) event.preventDefault();
  });
  window.once('ready-to-show', () => window.show());
  window.on('closed', closeLocalServer);
  await window.loadURL(`http://127.0.0.1:${port}/?desktop=1`);
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on('second-instance', () => BrowserWindow.getAllWindows()[0]?.focus());
  app.whenReady().then(openGame).catch((error) => {
    console.error('Could not start Pokemon Survivor:', error);
    app.quit();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', closeLocalServer);
}
