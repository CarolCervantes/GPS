/**
 * DiaMon - Suite de Pruebas de Arquitectura Hexagonal (Backend + Dominio + Android)
 * Valida:
 *   1. Pureza de dependencias (Dominio y Aplicación sin dependencias de Infraestructura ni SDK Android)
 *   2. Entidades de Dominio e invariantes clínicas
 *   3. Casos de Uso aislados con Puertos simulados (sin HTTP ni base de datos real)
 *   4. Controladores HTTP / Endpoints Vercel (/api/salud, /api/registros, /api/alertas, /api/wearable, /api/diabot)
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { RegistroClinicoEntity } = require('../src/domain/entities/RegistroClinicoEntity');
const { AlertaEmergenciaEntity } = require('../src/domain/entities/AlertaEmergenciaEntity');
const { ConsultaDiaBotEntity } = require('../src/domain/entities/ConsultaDiaBotEntity');
const { PromptClinicoDomainService } = require('../src/domain/services/PromptClinicoDomainService');

const { GestionarRegistrosClinicosUseCase } = require('../src/application/usecases/GestionarRegistrosClinicosUseCase');
const { GestionarAlertasEmergenciaUseCase } = require('../src/application/usecases/GestionarAlertasEmergenciaUseCase');
const { ConsultarDiaBotUseCase } = require('../src/application/usecases/ConsultarDiaBotUseCase');
const { ProcesarTelemetriaWearableUseCase } = require('../src/application/usecases/ProcesarTelemetriaWearableUseCase');

const { createBackendContainer } = require('../src/infrastructure/container');
const saludHandler = require('../api/salud');
const registrosHandler = require('../api/registros');
const alertasHandler = require('../api/alertas');

function crearMockRes() {
  let statusCode = 0;
  let body = '';
  const headers = {};
  return {
    setHeader(k, v) { headers[k.toLowerCase()] = v; },
    get headers() { return headers; },
    get statusCode() { return statusCode; },
    set statusCode(v) { statusCode = v; },
    end(payload) { body = payload || ''; },
    json() { return JSON.parse(body || '{}'); }
  };
}

function listarArchivosRecursivo(dir) {
  const archivos = [];
  if (!fs.existsSync(dir)) return archivos;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      archivos.push(...listarArchivosRecursivo(full));
    } else {
      archivos.push(full);
    }
  }
  return archivos;
}

test('H1. Pureza Hexagonal JS: src/domain y src/application no importan infraestructura ni HTTP/FS', () => {
  const domainFiles = listarArchivosRecursivo(path.join(__dirname, '..', 'src', 'domain'));
  const appFiles = listarArchivosRecursivo(path.join(__dirname, '..', 'src', 'application'));

  assert.ok(domainFiles.length >= 10, 'Debe haber entidades, servicios y puertos en src/domain');
  assert.ok(appFiles.length >= 6, 'Debe haber casos de uso en src/application');

  for (const file of domainFiles) {
    const code = fs.readFileSync(file, 'utf8');
    assert.ok(!/require\(['"][^'"]*infrastructure/i.test(code), `${path.basename(file)} no debe importar infrastructure`);
    assert.ok(!/require\(['"](node:)?(http|https|fs)['"]\)/i.test(code), `${path.basename(file)} no debe importar http/fs`);
    assert.ok(!/\bfetch\s*\(/.test(code), `${path.basename(file)} no debe llamar a fetch() directamente`);
  }

  for (const file of appFiles) {
    const code = fs.readFileSync(file, 'utf8');
    assert.ok(!/require\(['"][^'"]*infrastructure/i.test(code), `${path.basename(file)} no debe importar infrastructure`);
  }
});

test('H2. Pureza Hexagonal Android: domain/ y application/ Java sin imports de android.*', () => {
  const javaBase = path.join(__dirname, '..', 'android-studio-app', 'app', 'src', 'main', 'java', 'co', 'diamon', 'salud', 'gps');
  const domainJava = listarArchivosRecursivo(path.join(javaBase, 'domain'));
  const appJava = listarArchivosRecursivo(path.join(javaBase, 'application'));

  assert.ok(domainJava.length >= 4, 'Android domain debe contener entidad y puertos (Repositorio, Wearable, Notificador)');
  assert.ok(appJava.length >= 2, 'Android application debe contener los casos de uso');

  for (const file of [...domainJava, ...appJava]) {
    const code = fs.readFileSync(file, 'utf8');
    assert.ok(!/^\s*import\s+android\./m.test(code), `${path.basename(file)} no debe depender del SDK android.*`);
    assert.ok(!/^\s*import\s+androidx\./m.test(code), `${path.basename(file)} no debe depender de androidx.*`);
  }
});

test('H3. Entidades de Dominio: validan invariantes clínicas de registros, alertas y consultas DiaBot', () => {
  const regGlucosa = new RegistroClinicoEntity({ tipo: 'glucosa', glucosaMgDl: 112, contexto: 'Ayunas' });
  assert.equal(regGlucosa.glucosaMgDl, 112);
  assert.equal(regGlucosa.codigoPaciente, 'DM-8492');

  assert.throws(() => new RegistroClinicoEntity({ tipo: 'glucosa', glucosaMgDl: 999 }), /20 y 600/);
  assert.throws(() => new RegistroClinicoEntity({ tipo: 'presion', sistolica: 80, diastolica: 120 }), /diastólica debe ser menor/);
  assert.throws(() => new RegistroClinicoEntity({ tipo: 'invalido' }), /inválido/);

  const alerta = new AlertaEmergenciaEntity({
    titulo: 'SOS Modo Abuelo',
    tipo: 'sos_manual',
    ubicacion: { lat: 10.39991, lng: -75.47886, zona: 'Chapacuá' }
  });
  assert.ok(alerta.ubicacion.googleMapsUrl.includes('10.39991,-75.47886'));
  alerta.transicionarEstado('escalada_123', 'Familiar no respondió en 30s');
  assert.equal(alerta.estado, 'escalada_123');
  assert.throws(() => alerta.transicionarEstado('estado_inexistente'), /inválido/);

  assert.throws(() => new ConsultaDiaBotEntity({ message: '   ' }), /Mensaje vacío/);
  const consulta = new ConsultaDiaBotEntity({ message: '¿Cómo está mi glucosa?' });
  const prompt = PromptClinicoDomainService.construirInstruccionCompleta(consulta.context);
  assert.ok(prompt.includes('Damián Díaz Balseiro'));
  assert.ok(prompt.includes('Regla 15-15'));
});

test('H4. Casos de Uso aislados con Mocks: Registros generan alertas automáticas en hipoglucemia y crisis HTA', async () => {
  const registrosGuardados = [];
  const alertasGuardadas = [];
  const notificaciones = [];

  const mockRegistroRepo = {
    async crear(r) { registrosGuardados.push(r); return r; },
    async listarPorPaciente() { return registrosGuardados; },
    async obtenerPorId(id) { return registrosGuardados.find(r => r.id === id) || null; },
    async actualizar(id, reg) {
      const idx = registrosGuardados.findIndex(r => r.id === id);
      if (idx === -1) return null;
      registrosGuardados[idx] = reg;
      return reg;
    },
    async eliminar(id) {
      const idx = registrosGuardados.findIndex(r => r.id === id);
      if (idx === -1) return false;
      registrosGuardados.splice(idx, 1);
      return true;
    }
  };
  const mockAlertaRepo = {
    async crear(a) { alertasGuardadas.push(a); return a; }
  };
  const mockNotificador = {
    async notificarAlerta(a) { notificaciones.push(a); }
  };

  const useCase = new GestionarRegistrosClinicosUseCase({
    registroRepository: mockRegistroRepo,
    alertaRepository: mockAlertaRepo,
    notificador: mockNotificador
  });

  // Hipoglucemia -> debe generar alerta crítica automáticamente
  const resHipo = await useCase.registrar({ tipo: 'glucosa', glucosaMgDl: 62, contexto: 'Ayunas' });
  assert.equal(resHipo.evaluacion.estado, 'hipoglucemia');
  assert.ok(resHipo.alertaGenerada);
  assert.equal(resHipo.alertaGenerada.tipo, 'hipoglucemia');
  assert.equal(alertasGuardadas.length, 1);
  assert.equal(notificaciones.length, 1);

  // Crisis hipertensiva -> debe generar alerta crítica automáticamente
  const resHTA = await useCase.registrar({ tipo: 'presion', sistolica: 172, diastolica: 104, pulsoBpm: 92 });
  assert.equal(resHTA.evaluacion.estado, 'crisis_hipertensiva');
  assert.equal(alertasGuardadas.length, 2);

  // Salida de geocerca -> alerta automática
  const resGPS = await useCase.registrar({ tipo: 'gps', lat: 10.4200, lng: -75.5000, zona: 'Centro' });
  assert.equal(resGPS.evaluacion.dentro, false);
  assert.equal(alertasGuardadas.length, 3);
});

test('H5. ConsultarDiaBotUseCase: usa puerto IA inyectado y cae a fallback si no hay API key', async () => {
  const ucConMockIA = new ConsultarDiaBotUseCase({
    asistenteIA: {
      estaConfigurado() { return true; },
      async generarRespuesta(consulta) {
        return { reply: `Respuesta IA para: ${consulta.message}`, engine: 'mock-gemini' };
      }
    }
  });
  const resIA = await ucConMockIA.ejecutar({ message: '¿Debo tomar Valsartán a las 2 PM?' });
  assert.equal(resIA.engine, 'mock-gemini');
  assert.ok(resIA.reply.includes('Valsartán'));

  const ucSinIA = new ConsultarDiaBotUseCase({
    asistenteIA: { estaConfigurado() { return false; } }
  });
  const resFallback = await ucSinIA.ejecutar({ message: 'Estado actual' });
  assert.equal(resFallback.engine, 'clinical-context-engine');
  assert.equal(resFallback.reply, null);
  assert.equal(resFallback.usedLiveContext, true);
});

test('H6. ProcesarTelemetriaWearableUseCase + Alertas: dispara alerta preventiva automática', async () => {
  const container = createBackendContainer();
  const res = await container.useCases.procesarTelemetriaWearable.registrarLectura({
    codigoPaciente: 'DM-7777',
    bpm: 118,
    temperaturaC: 35.3,
    dispositivoNombre: 'Smartwatch Test'
  });

  assert.equal(res.evaluacion.riesgo, 'posible_hipoglucemia');
  assert.ok(res.alertaGenerada, 'Debe crear alerta preventiva automáticamente en el repositorio');

  const alertas = await container.useCases.gestionarAlertasEmergencia.listarAlertas('DM-7777');
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].tipo, 'wearable_preventiva');
});

test('H7. Endpoints HTTP /api/salud, /api/registros (CRUD) y /api/alertas (Escalamiento)', async () => {
  // 1. /api/salud
  const resSalud = crearMockRes();
  await saludHandler({ method: 'GET', url: '/api/salud' }, resSalud);
  assert.equal(resSalud.statusCode, 200);
  const bodySalud = resSalud.json();
  assert.equal(bodySalud.ok, true);
  assert.ok(bodySalud.arquitectura.includes('Hexagonal'));
  assert.ok(bodySalud.endpoints.includes('GET|POST|PUT|DELETE /api/registros'));

  // 2. /api/registros CRUD completo
  const resCreate = crearMockRes();
  await registrosHandler({
    method: 'POST',
    url: '/api/registros',
    body: { codigoPaciente: 'DM-TEST', tipo: 'glucosa', glucosaMgDl: 118, contexto: 'Ayunas' }
  }, resCreate);
  assert.equal(resCreate.statusCode, 201);
  const createdId = resCreate.json().registro.id;
  assert.ok(createdId);

  const resList = crearMockRes();
  await registrosHandler({ method: 'GET', url: '/api/registros?codigo=DM-TEST&tipo=glucosa' }, resList);
  assert.equal(resList.statusCode, 200);
  assert.ok(resList.json().registros.some(r => r.id === createdId));

  const resUpdate = crearMockRes();
  await registrosHandler({
    method: 'PUT',
    url: `/api/registros?id=${createdId}`,
    body: { glucosaMgDl: 124, notas: 'Corregido tras verificación' }
  }, resUpdate);
  assert.equal(resUpdate.statusCode, 200);
  assert.equal(resUpdate.json().registro.glucosaMgDl, 124);

  const resDelete = crearMockRes();
  await registrosHandler({ method: 'DELETE', url: `/api/registros?id=${createdId}` }, resDelete);
  assert.equal(resDelete.statusCode, 200);
  assert.equal(resDelete.json().eliminado, true);

  // 3. /api/alertas POST -> PATCH -> GET
  const resAlertaPost = crearMockRes();
  await alertasHandler({
    method: 'POST',
    url: '/api/alertas',
    body: {
      codigoPaciente: 'DM-TEST',
      tipo: 'sos_manual',
      severidad: 'critica',
      titulo: 'SOS Modo Abuelo — Mareo fuerte',
      sintomas: ['Mareo fuerte', 'Sudor frío'],
      ubicacion: { lat: 10.39991, lng: -75.47886, zona: 'Chapacuá' }
    }
  }, resAlertaPost);
  assert.equal(resAlertaPost.statusCode, 201);
  const alertaId = resAlertaPost.json().alerta.id;

  const resAlertaPatch = crearMockRes();
  await alertasHandler({
    method: 'PATCH',
    url: '/api/alertas',
    body: { id: alertaId, estado: 'escalada_123', motivo: 'Sin respuesta de familiar en 30s' }
  }, resAlertaPatch);
  assert.equal(resAlertaPatch.statusCode, 200);
  assert.equal(resAlertaPatch.json().alerta.estado, 'escalada_123');
});
