// Infraestructura - Adaptador de Entrada HTTP para Asistente Clínico DiaBot (/api/diabot)
// Delega 100% al Caso de Uso ConsultarDiaBotUseCase

'use strict';

const { applyCors, sendJson, parseBody } = require('./httpUtils');

class DiaBotHttpController {
  constructor(consultarDiaBotUseCase) {
    this.useCase = consultarDiaBotUseCase;
  }

  async handle(req, res) {
    applyCors(res, 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Método no permitido. Usa POST.' });
      return;
    }

    try {
      const body = parseBody(req);
      const respuesta = await this.useCase.ejecutar(body);
      sendJson(res, 200, respuesta);
    } catch (err) {
      if (err.message === 'Mensaje vacío.') {
        sendJson(res, 400, { error: 'Mensaje vacío.' });
        return;
      }
      sendJson(res, 200, {
        reply: null,
        engine: 'clinical-context-engine',
        error: err.message
      });
    }
  }
}

module.exports = { DiaBotHttpController };
