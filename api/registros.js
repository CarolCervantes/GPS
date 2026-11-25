/**
 * DiaMon - Endpoint Serverless / Local: CRUD de Registros Clínicos (/api/registros)
 * Soporta GET, POST, PUT, DELETE con evaluación automática en el Dominio Hexagonal.
 */

'use strict';

const { getDefaultContainer } = require('../src/infrastructure/container');

module.exports = async function registrosHandler(req, res) {
  const { controllers } = getDefaultContainer();
  return controllers.registros.handle(req, res);
};
