// Valida el codigo de administrador en el servidor.
// Antes el codigo estaba escrito en el JavaScript del navegador y cualquiera lo podia ver con F12.
// En Vercel se configura la variable de entorno DIAMON_ADMIN_CODE con el codigo real.
const crypto = require('crypto');

function codigoAdmin() {
  // Si no se configuro la variable se usa el codigo del proyecto (solo para pruebas en local)
  return process.env.DIAMON_ADMIN_CODE || 'DIAMON-ADMIN-2026';
}

module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ valido: false, error: 'Usa POST' }));
    return;
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }

  const recibido = Buffer.from(String(body.codigo || '').trim().toUpperCase());
  const esperado = Buffer.from(codigoAdmin().toUpperCase());

  // timingSafeEqual compara sin dar pistas por el tiempo de respuesta
  const valido = recibido.length === esperado.length && crypto.timingSafeEqual(recibido, esperado);

  res.statusCode = 200;
  res.end(JSON.stringify({ valido }));
};
