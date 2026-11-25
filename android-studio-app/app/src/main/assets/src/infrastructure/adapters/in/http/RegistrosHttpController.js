// Infraestructura - Adaptador de Entrada HTTP para Registros Clínicos CRUD (/api/registros)
// Delega 100% al Caso de Uso GestionarRegistrosClinicosUseCase

'use strict';

const { applyCors, sendJson, parseBody, parseQuery } = require('./httpUtils');

class RegistrosHttpController {
  constructor(gestionarRegistrosUseCase) {
    this.useCase = gestionarRegistrosUseCase;
  }

  async handle(req, res) {
    applyCors(res, 'GET, POST, PUT, DELETE, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      const query = parseQuery(req);

      if (req.method === 'GET') {
        if (query.id) {
          const registro = await this.useCase.obtenerPorId(query.id);
          if (!registro) {
            sendJson(res, 404, { ok: false, error: `Registro ${query.id} no encontrado.` });
            return;
          }
          sendJson(res, 200, { ok: true, registro });
          return;
        }

        const codigo = query.codigo || query.codigoPaciente || 'DM-8492';
        const registros = await this.useCase.listar(codigo, {
          tipo: query.tipo || null,
          limite: query.limite || 50
        });
        sendJson(res, 200, {
          ok: true,
          codigoPaciente: String(codigo).trim().toUpperCase(),
          total: registros.length,
          registros
        });
        return;
      }

      if (req.method === 'POST') {
        const body = parseBody(req);
        const resultado = await this.useCase.registrar(body, body.metas || {});
        sendJson(res, 201, { ok: true, ...resultado });
        return;
      }

      if (req.method === 'PUT') {
        const body = parseBody(req);
        const id = query.id || body.id;
        const actualizado = await this.useCase.actualizar(id, body);
        sendJson(res, 200, { ok: true, registro: actualizado });
        return;
      }

      if (req.method === 'DELETE') {
        const body = parseBody(req);
        const id = query.id || body.id;
        const resultado = await this.useCase.eliminar(id);
        sendJson(res, 200, { ok: true, ...resultado });
        return;
      }

      sendJson(res, 405, { ok: false, error: 'Método no permitido. Usa GET, POST, PUT o DELETE.' });
    } catch (err) {
      const notFound = /No existe/i.test(err.message || '');
      sendJson(res, notFound ? 404 : 400, {
        ok: false,
        error: err.message || 'Error al procesar registros clínicos.'
      });
    }
  }
}

module.exports = { RegistrosHttpController };
