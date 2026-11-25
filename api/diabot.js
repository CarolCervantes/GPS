/**
 * DiaMon - Endpoint Serverless / Local: Asistente Clínico DiaBot IA (/api/diabot)
 * Adaptador de Entrada delgado hacia el Backend Hexagonal (src/infrastructure/container.js)
 */

'use strict';

const { getDefaultContainer } = require('../src/infrastructure/container');

module.exports = async function diabotHandler(req, res) {
  const { controllers } = getDefaultContainer();
  return controllers.diabot.handle(req, res);
};
