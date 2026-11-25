const http = require('http');
const fs = require('fs');
const path = require('path');

// Adaptadores de Entrada HTTP del Backend Hexagonal (mismos handlers que Vercel Serverless)
const API_ROUTES = {
  '/api/diabot': require('./api/diabot'),
  '/api/wearable': require('./api/wearable'),
  '/api/registros': require('./api/registros'),
  '/api/alertas': require('./api/alertas'),
  '/api/salud': require('./api/salud')
};

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
  '.sql': 'text/plain; charset=utf-8',
  '.apk': 'application/vnd.android.package-archive'
};

function dispatchApiHandler(handler, req, res) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    handler(req, res);
    return;
  }

  let rawBody = '';
  req.on('data', chunk => { rawBody += chunk.toString(); });
  req.on('end', () => {
    try {
      req.body = rawBody ? JSON.parse(rawBody) : {};
    } catch (_) {
      req.body = {};
    }
    handler(req, res);
  });
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('X-Frame-Options', 'DENY');
  }
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(self), bluetooth=(self)');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let reqPath = req.url.split('?')[0].split('#')[0];

  // Despacho a Endpoints del Backend Hexagonal (/api/*)
  if (API_ROUTES[reqPath]) {
    dispatchApiHandler(API_ROUTES[reqPath], req, res);
    return;
  }

  // Descarga directa de la APK Android
  if (reqPath === '/descargar-apk') {
    const apkAssets = path.join(ROOT, 'assets', 'DiaMon-GPS.apk');
    const apkDebug = path.join(ROOT, 'android-studio-app', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
    const targetApk = fs.existsSync(apkAssets) ? apkAssets : apkDebug;
    if (fs.existsSync(targetApk)) {
      const stat = fs.statSync(targetApk);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="DiaMon-GPS.apk"',
        'Content-Length': stat.size
      });
      fs.createReadStream(targetApk).pipe(res);
      return;
    }
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

server.listen(PORT, () => {
  console.log(`DiaMon servidor web y Backend Hexagonal corriendo en http://localhost:${PORT}/pages/index.html (API salud: http://localhost:${PORT}/api/salud)`);
});
