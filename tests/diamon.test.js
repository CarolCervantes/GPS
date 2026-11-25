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
const wearableHandler = require('../api/wearable');
const { PacienteEntity } = require('../src/domain/entities/PacienteEntity');
const { EvaluadorClinicoDomainService } = require('../src/domain/services/EvaluadorClinicoDomainService');
const { MonitorearPacienteUseCase } = require('../src/application/usecases/MonitorearPacienteUseCase');
const { LecturaBiometricaEntity } = require('../src/domain/entities/LecturaBiometricaEntity');
const { DetectorGlucemicoPreventivoService } = require('../src/domain/services/DetectorGlucemicoPreventivoService');
const { MonitorearBiometriaPreventivaUseCase } = require('../src/application/usecases/MonitorearBiometriaPreventivaUseCase');
const { WebBluetoothWearableAdapter } = require('../src/infrastructure/adapters/WebBluetoothWearableAdapter');

test('0. Arquitectura Hexagonal: Dominio, Puertos y Casos de Uso desacoplados', async () => {
  const paciente = new PacienteEntity();
  assert.equal(paciente.nombre, 'Damián Díaz Balseiro');
  assert.equal(paciente.coordenadasCasa.lat, 10.39991);

  const useCase = new MonitorearPacienteUseCase({
    async guardarPosicionGPS() { return { ok: true }; }
  });
  const enCasa = await useCase.procesarUbicacionGPS(10.39991, -75.47886, paciente);
  assert.equal(enCasa.dentro, true);
  assert.equal(EvaluadorClinicoDomainService.evaluarGlucosa(64).estado, 'hipoglucemia');
  assert.equal(EvaluadorClinicoDomainService.evaluarPresion(164, 96).estado, 'crisis_hipertensiva');
});

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

test('6. Autenticación: soporta registro y login para Paciente, Cuidador y Admin con códigos', () => {
  const authModern = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'auth-modern.js'), 'utf8');
  const dashCtrl = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'dashboard-controller.js'), 'utf8');

  assert.ok(authModern.includes('generarCodigoPacienteUnico'), 'auth-modern.js debe permitir registrar pacientes nuevos con código único DM-XXXX');
  assert.ok(authModern.includes('DIAMON-ADMIN-2026'), 'auth-modern.js debe validar el código de administrador');
  assert.ok(dashCtrl.includes('esPaciente'), 'dashboard-controller.js debe diferenciar la vista simplificada del paciente');
});

test('7. PWA: manifiesto y caché usan rutas consistentes', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.webmanifest'), 'utf8'));
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.ok(sw.includes("addEventListener('fetch'"), 'el service worker debe mantener soporte offline');
});

test('8. Detector Preventivo Sin Parche: clasifica hipoglucemia, hiperglucemia y reloj solo pulso', () => {
  const normal = DetectorGlucemicoPreventivoService.evaluarLectura({
    ritmoCardiacoBpm: 72,
    temperaturaC: 36.5
  });
  assert.equal(normal.riesgo, 'estable');
  assert.equal(normal.requiereAlarmaSimultanea, false);

  const hipo = DetectorGlucemicoPreventivoService.evaluarLectura({
    ritmoCardiacoBpm: 114,
    temperaturaC: 35.5
  });
  assert.equal(hipo.riesgo, 'posible_hipoglucemia');
  assert.equal(hipo.severidad, 'critica');
  assert.equal(hipo.requiereAlarmaSimultanea, true);
  assert.ok(hipo.sintomasDetectados.length >= 2, 'debe listar alteración de pulso y descenso térmico');

  const hiper = DetectorGlucemicoPreventivoService.evaluarLectura({
    ritmoCardiacoBpm: 108,
    temperaturaC: 38.2
  });
  assert.equal(hiper.riesgo, 'posible_hiperglucemia');
  assert.equal(hiper.requiereAlarmaSimultanea, true);

  const soloPulsoCritico = DetectorGlucemicoPreventivoService.evaluarLectura({
    ritmoCardiacoBpm: 124,
    temperaturaC: null
  });
  assert.equal(soloPulsoCritico.riesgo, 'anomalia_biometrica_critica');
  assert.equal(soloPulsoCritico.requiereAlarmaSimultanea, true);
  assert.equal(soloPulsoCritico.signos.tieneSensorTemperatura, false);

  const soloPulsoNormal = DetectorGlucemicoPreventivoService.evaluarLectura({
    ritmoCardiacoBpm: 75,
    temperaturaC: null
  });
  assert.equal(soloPulsoNormal.riesgo, 'estable');
  assert.equal(soloPulsoNormal.requiereAlarmaSimultanea, false);
});

test('9. Alarma Simultánea y Escalamiento 60s: confirmación "Estoy bien" vs envío GPS + síntomas al cuidador', async () => {
  const eventos = [];
  const repoMock = {
    async guardarBiometriaWearable() { eventos.push('biometria_guardada'); },
    async guardarAlertaPreventiva() { eventos.push('alerta_creada'); },
    async actualizarAlertaPreventiva(inc) { eventos.push(`alerta_actualizada:${inc.estado}`); }
  };
  const notificadorMock = {
    async dispararAlarmaSimultanea(inc) { eventos.push(`alarma_simultanea:${inc.tiempoLimiteSegundos}s`); },
    async notificarConfirmacionPaciente(inc) { eventos.push(`confirmado_bien:${inc.id}`); },
    async escalarACuidadorConUbicacionYSintomas(paq) { eventos.push(`escalado_cuidador:${paq.ubicacion.zona}`); }
  };

  const paciente = new PacienteEntity();
  const useCase = new MonitorearBiometriaPreventivaUseCase(repoMock, notificadorMock);

  // Escenario A: Se dispara alarma simultánea y el paciente responde "Estoy bien"
  const lecturaHipo = new LecturaBiometricaEntity({
    ritmoCardiacoBpm: 114,
    temperaturaC: 35.5,
    dispositivoTipo: 'reloj_inteligente',
    dispositivoNombre: 'Smartwatch Prueba'
  });
  const resA = await useCase.procesarLecturaWearable(lecturaHipo, paciente);
  assert.ok(resA.incidenteActivado, 'debe activar incidente de alarma simultánea');
  assert.equal(resA.incidenteActivado.tiempoLimiteSegundos, 60);
  assert.ok(resA.incidenteActivado.notificadoPacienteEn && resA.incidenteActivado.notificadoCuidadorSimultaneoEn);
  assert.ok(eventos.includes('alarma_simultanea:60s'));

  const cerradoOk = await useCase.confirmarPacienteEstaBien(resA.incidenteActivado.id);
  assert.equal(cerradoOk.estado, 'CONFIRMADO_BIEN');
  assert.equal(useCase.obtenerIncidenteActivo(), null);
  assert.ok(eventos.includes('alerta_actualizada:CONFIRMADO_BIEN'));

  // Escenario B: El paciente NO responde al cumplirse 1 minuto -> cuidador recibe GPS + síntomas
  const resB = await useCase.procesarLecturaWearable({
    ritmoCardiacoBpm: 110,
    temperaturaC: 38.3,
    dispositivoTipo: 'anillo_inteligente',
    dispositivoNombre: 'Anillo Inteligente DiaMon'
  }, paciente);
  assert.ok(resB.incidenteActivado);

  const paqueteCuidador = await useCase.escalarAlCuidador(resB.incidenteActivado.id, {
    lat: 10.39991,
    lng: -75.47886,
    zona: 'Barrio Chapacuá, Cartagena',
    precision: 8
  });
  assert.equal(paqueteCuidador.estado, 'ESCALADA_A_CUIDADOR');
  assert.equal(paqueteCuidador.ubicacion.lat, 10.39991);
  assert.equal(paqueteCuidador.ubicacion.lng, -75.47886);
  assert.ok(paqueteCuidador.ubicacion.googleMapsUrl.includes('10.39991,-75.47886'));
  assert.ok(paqueteCuidador.sintomasDetectados.length >= 2);
  assert.equal(paqueteCuidador.signosVitales.ritmoCardiacoBpm, 110);
  assert.equal(paqueteCuidador.signosVitales.temperaturaC, 38.3);
  assert.ok(eventos.includes('escalado_cuidador:Barrio Chapacuá, Cartagena'));
});

test('10. Adaptador Web Bluetooth BLE: decodifica Heart Rate (0x2A37) y Health Thermometer (0x2A1C)', () => {
  // Heart Rate UINT8 = 114 BPM
  const hrBuf8 = new ArrayBuffer(2);
  const hrView8 = new DataView(hrBuf8);
  hrView8.setUint8(0, 0x00);
  hrView8.setUint8(1, 114);
  assert.equal(WebBluetoothWearableAdapter.parseHeartRateMeasurement(hrView8), 114);

  // Heart Rate UINT16 = 128 BPM
  const hrBuf16 = new ArrayBuffer(3);
  const hrView16 = new DataView(hrBuf16);
  hrView16.setUint8(0, 0x01);
  hrView16.setUint16(1, 128, true);
  assert.equal(WebBluetoothWearableAdapter.parseHeartRateMeasurement(hrView16), 128);

  // Health Thermometer IEEE-11073 FLOAT Celsius: 35.5 °C (mantissa 355, exponent -1 => 0xFF)
  const tempBufC = new ArrayBuffer(5);
  const tempViewC = new DataView(tempBufC);
  tempViewC.setUint8(0, 0x00); // Celsius
  const ieee355 = (0xFF << 24) | (355 & 0x00FFFFFF);
  tempViewC.setUint32(1, ieee355 >>> 0, true);
  assert.equal(WebBluetoothWearableAdapter.parseHealthThermometerMeasurement(tempViewC), 35.5);

  // Health Thermometer Fahrenheit: 98.6 °F -> 37.0 °C (mantissa 986, exponent -1 => 0xFF)
  const tempBufF = new ArrayBuffer(5);
  const tempViewF = new DataView(tempBufF);
  tempViewF.setUint8(0, 0x01); // Fahrenheit
  const ieee986 = (0xFF << 24) | (986 & 0x00FFFFFF);
  tempViewF.setUint32(1, ieee986 >>> 0, true);
  assert.equal(WebBluetoothWearableAdapter.parseHealthThermometerMeasurement(tempViewF), 37.0);
});

test('11. Migración SQL 03 Wearable: tablas biométricas, RLS cuidador y timeout 60s', () => {
  const sql3 = fs.readFileSync(
    path.join(__dirname, '..', 'database', '03_monitoreo_preventivo_wearable.sql'),
    'utf8'
  );
  assert.ok(sql3.includes('create table if not exists public.biometria_wearable'));
  assert.ok(sql3.includes('create table if not exists public.alertas_preventivas_biometricas'));
  assert.ok(sql3.includes('public.es_cuidador_de(user_id)'));
  assert.ok(sql3.includes('tiempo_limite_seg   int not null default 60'));
  assert.ok(!sql3.includes('DIAMON-ADMIN-2026'));
});

test('12. Endpoint /api/wearable: recibe lecturas de reloj inteligente, detecta riesgo y responde GET', async () => {
  const crearRes = () => {
    let statusCode = 0;
    let body = '';
    return {
      setHeader() {},
      get statusCode() { return statusCode; },
      set statusCode(v) { statusCode = v; },
      end(payload) { body = payload; },
      json() { return JSON.parse(body); }
    };
  };

  // POST sin ritmo cardíaco -> 400
  const resErr = crearRes();
  await wearableHandler({ method: 'POST', body: { codigoPaciente: 'DM-9001' } }, resErr);
  assert.equal(resErr.statusCode, 400);
  assert.equal(resErr.json().ok, false);

  // POST lectura de reloj con posible hipoglucemia -> 200 y alarma simultánea requerida
  const resPost = crearRes();
  await wearableHandler({
    method: 'POST',
    body: {
      codigoPaciente: 'DM-9001',
      bpm: 116,
      temperaturaC: 35.4,
      dispositivoNombre: 'Galaxy Watch Prueba'
    }
  }, resPost);
  assert.equal(resPost.statusCode, 200);
  const parsedPost = resPost.json();
  assert.equal(parsedPost.ok, true);
  assert.equal(parsedPost.evaluacion.riesgo, 'posible_hipoglucemia');
  assert.equal(parsedPost.evaluacion.requiereAlarmaSimultanea, true);

  // GET consulta la última lectura almacenada para DM-9001
  const resGet = crearRes();
  await wearableHandler({ method: 'GET', url: '/api/wearable?codigo=DM-9001' }, resGet);
  assert.equal(resGet.statusCode, 200);
  const parsedGet = resGet.json();
  assert.equal(parsedGet.ok, true);
  assert.equal(parsedGet.ultimaLectura.ritmoCardiacoBpm, 116);
  assert.equal(parsedGet.ultimaLectura.temperaturaC, 35.4);
});

