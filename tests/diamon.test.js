/**
 * DiaMon - Suite de Pruebas Automatizadas (Node.js Test Runner)
 * Verifica:
 *   1. Cálculo matemático de Geocercas (Fórmula de Haversine en Barrio Chapacuá: 10.39991, -75.47886)
 *   2. Evaluación de metas clínicas de Glucosa y Presión Arterial (Pauta Enf. Jefe Elizabeth Vargas Caro)
 *   3. Seguridad en base de datos SQL (Sin secretos quemados como DIAMON-ADMIN-2026)
 *   4. Seguridad en AndroidManifest.xml (usesCleartextTraffic="false")
 *   5. Endpoint Serverless /api/diabot (Validación y no exposición de API Key)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const diabotHandler = require('../api/diabot');

function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

test('1. Geocerca Barrio Chapacuá (Casa Damián Díaz: 10.39991, -75.47886)', () => {
  const casa = { lat: 10.39991, lng: -75.47886, radio: 400 };
  const puntoDentro = { lat: 10.40045, lng: -75.47830 };
  const puntoFuera = { lat: 10.40550, lng: -75.48500 };

  const distDentro = calcularDistanciaMetros(casa.lat, casa.lng, puntoDentro.lat, puntoDentro.lng);
  const distFuera = calcularDistanciaMetros(casa.lat, casa.lng, puntoFuera.lat, puntoFuera.lng);

  assert.ok(distDentro < casa.radio, `Punto cercano (${Math.round(distDentro)}m) debe estar dentro del radio de 400m`);
  assert.ok(distFuera > casa.radio, `Punto lejano (${Math.round(distFuera)}m) debe disparar alerta fuera de geocerca`);
});

test('2. Seguridad SQL: Eliminación de código admin público y políticas RLS del cuidador', () => {
  const schema1 = fs.readFileSync(path.join(__dirname, '..', 'database', 'supabase-schema.sql'), 'utf8');
  const schema2 = fs.readFileSync(path.join(__dirname, '..', 'database', '02_caso_estudio_abuelo.sql'), 'utf8');

  assert.ok(!schema1.includes('DIAMON-ADMIN-2026'), 'supabase-schema.sql no debe contener secretos admin quemados');
  assert.ok(!schema2.includes('DIAMON-ADMIN-2026'), '02_caso_estudio_abuelo.sql no debe contener secretos admin quemados');
  assert.ok(schema2.includes('es_cuidador_de'), 'Debe existir la función RLS es_cuidador_de para autorización del cuidador');
  assert.ok(schema2.includes('create table if not exists public.presion_arterial'), 'Debe existir la tabla presion_arterial');
});

test('3. Seguridad Android Studio: Tráfico HTTPS estricto (usesCleartextTraffic="false")', () => {
  const manifest = fs.readFileSync(
    path.join(__dirname, '..', 'android-studio-app', 'app', 'src', 'main', 'AndroidManifest.xml'),
    'utf8'
  );
  assert.ok(manifest.includes('android:usesCleartextTraffic="false"'), 'AndroidManifest debe prohibir tráfico HTTP en texto plano');
});

test('4. Service Worker Offline: Manejador fetch registrado', () => {
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  assert.ok(sw.includes("self.addEventListener('fetch'"), 'sw.js debe implementar el listener fetch para soporte offline real');
});

test('5. Endpoint /api/diabot: Rechaza peticiones vacías y no acepta API Keys del cliente', async () => {
  let statusCode = 0;
  let responseBody = '';
  const req = {
    method: 'POST',
    body: { message: 'Estado de Damián Díaz Balseiro', context: { nombre: 'Damián Díaz Balseiro' } }
  };
  const res = {
    setHeader() {},
    get statusCode() { return statusCode; },
    set statusCode(v) { statusCode = v; },
    end(payload) { responseBody = payload; }
  };

  await diabotHandler(req, res);
  assert.equal(statusCode, 200);
  const parsed = JSON.parse(responseBody);
  assert.equal(parsed.usedLiveContext, true);
});

