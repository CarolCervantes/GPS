// Adaptador de entrada: recibe POST /api/validar-admin y llama al caso de uso.
const { leerCuerpo, responderJSON, permitirCORS } = require('./httpUtils');

function crearValidarAdminController(validarCodigoAdmin) {
  return async function validarAdminHttp(req, res) {
    permitirCORS(res);
    if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
    if (req.method !== 'POST') { responderJSON(res, 405, { valido: false, error: 'Usa POST' }); return; }

    const cuerpo = await leerCuerpo(req);
    responderJSON(res, 200, validarCodigoAdmin.ejecutar(cuerpo.codigo));
  };
}

module.exports = { crearValidarAdminController };
