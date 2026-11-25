// Infraestructura - Adaptador de Entrada HTTP para Telemetría Wearable (/api/wearable)
// Delega 100% al Caso de Uso ProcesarTelemetriaWearableUseCase

'use strict';

const { applyCors, sendJson, parseBody, parseQuery } = require('./httpUtils');

class WearableHttpController {
  constructor(procesarTelemetriaWearableUseCase) {
    this.useCase = procesarTelemetriaWearableUseCase;
  }

  async handle(req, res) {
    applyCors(res, 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method === 'GET') {
      const query = parseQuery(req);
      const codigo = query.codigo || query.codigoPaciente || 'DM-8492';
      const limite = Number(query.limite) || 10;
      const estado = await this.useCase.consultarEstado(codigo, limite);
      sendJson(res, 200, { ok: true, ...estado });
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'Método no permitido. Usa GET o POST.' });
      return;
    }

    try {
      const body = parseBody(req);
      const resultado = await this.useCase.registrarLectura(body);
      sendJson(res, 200, { ok: true, ...resultado });
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: err.message || 'No se pudo procesar la lectura del wearable.'
      });
    }
  }
}

module.exports = { WearableHttpController };
