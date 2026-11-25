/**
 * DiaMon - Endpoint Serverless / Local: Telemetría de Reloj Inteligente (/api/wearable)
 * Adaptador de Entrada delgado hacia el Backend Hexagonal (src/infrastructure/container.js)
 */

'use strict';

const { getDefaultContainer } = require('../src/infrastructure/container');

module.exports = async function wearableHandler(req, res) {
  const { controllers } = getDefaultContainer();
  return controllers.wearable.handle(req, res);
};
