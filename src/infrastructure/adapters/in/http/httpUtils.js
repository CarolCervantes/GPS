// Infraestructura - Utilidades HTTP compartidas por los Adaptadores de Entrada (Vercel y server.js)
'use strict';

function applyCors(res, methods = 'GET, POST, PUT, PATCH, DELETE, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  if (req.body === undefined || req.body === null) return {};
  if (typeof req.body === 'string') {
    const trimmed = req.body.trim();
    if (!trimmed) return {};
    return JSON.parse(trimmed);
  }
  return req.body;
}

function parseQuery(req) {
  const result = {};
  if (req.query && typeof req.query === 'object') {
    Object.assign(result, req.query);
  }
  if (req.url) {
    try {
      const parsed = new URL(req.url, 'http://localhost');
      parsed.searchParams.forEach((value, key) => {
        if (result[key] === undefined) {
          result[key] = value;
        }
      });
    } catch (_) {
      // URL relativa inválida; ignorar
    }
  }
  return result;
}

module.exports = {
  applyCors,
  sendJson,
  parseBody,
  parseQuery
};
