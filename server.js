const http = require('http');
const fs = require('fs');
const path = require('path');
const diabotHandler = require('./api/diabot');

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.sql': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(self)');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let reqPath = req.url.split('?')[0].split('#')[0];

  // Endpoint de IA Real para DiaBot (/api/diabot)
  if (reqPath === '/api/diabot') {
    let rawBody = '';
    req.on('data', chunk => { rawBody += chunk.toString(); });
    req.on('end', () => {
      try {
        req.body = rawBody ? JSON.parse(rawBody) : {};
      } catch (_) {
        req.body = {};
      }
      diabotHandler(req, res);
    });
    return;
  }

  if (reqPath === '/' || reqPath === '') {
    reqPath = '/pages/index.html';
  }

  let filePath = path.join(ROOT, reqPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Prohibido');
    return;
  }

  // Si piden /login.html o /index.html en la raíz, servir desde /pages/ automáticamente
  if ((!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) && path.extname(reqPath) === '.html' && !reqPath.startsWith('/pages/')) {
    const candidateInPages = path.join(ROOT, 'pages', path.basename(reqPath));
    if (fs.existsSync(candidateInPages) && fs.statSync(candidateInPages).isFile()) {
      filePath = candidateInPages;
    }
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Archivo no encontrado');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`DiaMon servidor web y API IA corriendo en http://localhost:${PORT}/pages/index.html`);
});

