/**
 * DiaMon - Endpoint Serverless / Local: Diagnóstico del Backend Hexagonal (/api/salud)
 */

'use strict';

const { getDefaultContainer } = require('../src/infrastructure/container');

module.exports = async function saludHandler(req, res) {
  const { controllers } = getDefaultContainer();
  return controllers.salud.handle(req, res);
};
