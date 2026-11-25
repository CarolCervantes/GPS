// Infraestructura - Adaptador de Entrada HTTP de Diagnóstico Arquitectónico (/api/salud)
'use strict';

const { applyCors, sendJson } = require('./httpUtils');

class SaludHttpController {
  constructor(metadata = {}) {
    this.metadata = metadata;
  }

  async handle(req, res) {
    applyCors(res, 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== 'GET') {
      sendJson(res, 405, { ok: false, error: 'Método no permitido. Usa GET.' });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      servicio: 'DiaMon GPS Salud — Backend Hexagonal',
      arquitectura: 'Hexagonal (Puertos y Adaptadores)',
      version: '1.3.0',
      timestamp: new Date().toISOString(),
      capas: {
        domain: [
          'PacienteEntity',
          'LecturaBiometricaEntity',
          'RegistroClinicoEntity',
          'AlertaEmergenciaEntity',
          'ConsultaDiaBotEntity',
          'EvaluadorClinicoDomainService',
          'DetectorGlucemicoPreventivoService',
          'PromptClinicoDomainService'
        ],
        ports: [
          'TelemetriaRepositoryPort',
          'WearableSensorPort',
          'WearableRepositoryPort',
          'RegistroClinicoRepositoryPort',
          'AlertaEmergenciaRepositoryPort',
          'AsistenteIAPort',
          'NotificadorEmergenciaPort'
        ],
        application: [
          'MonitorearPacienteUseCase',
          'MonitorearBiometriaPreventivaUseCase',
          'ProcesarTelemetriaWearableUseCase',
          'ConsultarDiaBotUseCase',
          'GestionarRegistrosClinicosUseCase',
          'GestionarAlertasEmergenciaUseCase'
        ],
        adaptersIn: [
          'WearableHttpController (/api/wearable)',
          'DiaBotHttpController (/api/diabot)',
          'RegistrosHttpController (/api/registros)',
          'AlertasHttpController (/api/alertas)',
          'SaludHttpController (/api/salud)'
        ],
        adaptersOut: {
          registrosPersistence: this.metadata.supabaseConfigurado ? 'SupabasePostgREST + InMemoryFallback' : 'InMemoryRegistroClinicoRepositoryAdapter',
          wearablePersistence: 'InMemoryWearableRepositoryAdapter',
          alertasPersistence: 'InMemoryAlertaRepositoryAdapter',
          aiProvider: this.metadata.geminiConfigurado ? 'GeminiAsistenteAdapter (gemini-2.5-flash)' : 'ClinicalContextEngineFallback',
          notificador: 'ConsoleNotificadorAdapter'
        }
      },
      endpoints: [
        'GET /api/salud',
        'GET|POST /api/wearable',
        'POST /api/diabot',
        'GET|POST|PUT|DELETE /api/registros',
        'GET|POST|PATCH /api/alertas'
      ]
    });
  }
}

module.exports = { SaludHttpController };
