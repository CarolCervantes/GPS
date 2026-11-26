// Utilidades HTTP compartidas por los controladores (sirven en Vercel y en server.js).

// Lee el cuerpo JSON de la peticion. Vercel ya lo trae en req.body; en server.js se lee del stream.
function leerCuerpo(req) {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') {
      try { return Promise.resolve(JSON.parse(req.body || '{}')); } catch (_) { return Promise.resolve({}); }
    }
    return Promise.resolve(req.body || {});
  }
  return new Promise((resolve) => {
    let crudo = '';
    req.on('data', parte => { crudo += parte; });
    req.on('end', () => {
      try { resolve(crudo ? JSON.parse(crudo) : {}); } catch (_) { resolve({}); }
    });
  });
}

function responderJSON(res, codigo, datos) {
  res.statusCode = codigo;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(datos));
}

// Permite llamar la API desde la app Android (que abre las paginas como file://)
function permitirCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = { leerCuerpo, responderJSON, permitirCORS };
