/**
 * DiaMon - Endpoint Serverless / Local: Gestión y Escalamiento de Alertas 24/7 (/api/alertas)
 * Soporta GET, POST, PATCH para alertas preventivas, SOS Modo Abuelo y escalamiento al 123.
 */

'use strict';

const { getDefaultContainer } = require('../src/infrastructure/container');

module.exports = async function alertasHandler(req, res) {
  const { controllers } = getDefaultContainer();
  return controllers.alertas.handle(req, res);
};
