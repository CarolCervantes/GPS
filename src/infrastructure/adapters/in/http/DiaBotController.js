// Adaptador de entrada: recibe POST /api/diabot y llama al caso de uso.
const { leerCuerpo, responderJSON, permitirCORS } = require('./httpUtils');

function crearDiaBotController(consultarDiaBot) {
  return async function diabotHttp(req, res) {
    permitirCORS(res);
    if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
    if (req.method !== 'POST') { responderJSON(res, 405, { error: 'Método no permitido. Usa POST.' }); return; }

    try {
      const cuerpo = await leerCuerpo(req);
      const resultado = await consultarDiaBot.ejecutar({ mensaje: cuerpo.message, contexto: cuerpo.context });
      responderJSON(res, resultado.error ? 400 : 200, resultado);
    } catch (err) {
      // si algo falla, la web responde con su motor local
      responderJSON(res, 200, { reply: null, engine: 'clinical-context-engine', usedLiveContext: true });
    }
  };
}

module.exports = { crearDiaBotController };
