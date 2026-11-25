// Infraestructura - Adaptador de Entrada HTTP para Alertas 24/7 y Escalamiento SOS (/api/alertas)
// Delega 100% al Caso de Uso GestionarAlertasEmergenciaUseCase

'use strict';

const { applyCors, sendJson, parseBody, parseQuery } = require('./httpUtils');

class AlertasHttpController {
  constructor(gestionarAlertasUseCase) {
    this.useCase = gestionarAlertasUseCase;
  }

  async handle(req, res) {
    applyCors(res, 'GET, POST, PATCH, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      const query = parseQuery(req);

      if (req.method === 'GET') {
        const codigo = query.codigo || query.codigoPaciente || 'DM-8492';
        const limite = Number(query.limite) || 30;
        const alertas = await this.useCase.listarAlertas(codigo, limite);
        sendJson(res, 200, {
          ok: true,
          codigoPaciente: String(codigo).trim().toUpperCase(),
          total: alertas.length,
          alertas
        });
        return;
      }

      if (req.method === 'POST') {
        const body = parseBody(req);
        const alerta = await this.useCase.emitirAlerta(body);
        sendJson(res, 201, { ok: true, alerta });
        return;
      }

      if (req.method === 'PATCH') {
        const body = parseBody(req);
        const id = query.id || body.id;
        const alerta = await this.useCase.actualizarEstadoAlerta(id, body.estado, body.motivo || null);
        sendJson(res, 200, { ok: true, alerta });
        return;
      }

      sendJson(res, 405, { ok: false, error: 'Método no permitido. Usa GET, POST o PATCH.' });
    } catch (err) {
      const notFound = /No existe/i.test(err.message || '');
      sendJson(res, notFound ? 404 : 400, {
        ok: false,
        error: err.message || 'Error al gestionar alertas de emergencia.'
      });
    }
  }
}

module.exports = { AlertasHttpController };
