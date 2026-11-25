// Infraestructura - Composition Root (Contenedor de Inyección de Dependencias Hexagonal)
// Ensambla Adaptadores de Salida -> Casos de Uso -> Adaptadores de Entrada HTTP

'use strict';

// Casos de Uso (Capa de Aplicación)
const { ProcesarTelemetriaWearableUseCase } = require('../application/usecases/ProcesarTelemetriaWearableUseCase');
const { ConsultarDiaBotUseCase } = require('../application/usecases/ConsultarDiaBotUseCase');
const { GestionarRegistrosClinicosUseCase } = require('../application/usecases/GestionarRegistrosClinicosUseCase');
const { GestionarAlertasEmergenciaUseCase } = require('../application/usecases/GestionarAlertasEmergenciaUseCase');

// Adaptadores de Salida (Infraestructura Driven)
const { InMemoryWearableRepositoryAdapter } = require('./adapters/out/persistence/InMemoryWearableRepositoryAdapter');
const { InMemoryRegistroClinicoRepositoryAdapter } = require('./adapters/out/persistence/InMemoryRegistroClinicoRepositoryAdapter');
const { SupabaseRegistroClinicoRepositoryAdapter } = require('./adapters/out/persistence/SupabaseRegistroClinicoRepositoryAdapter');
const { InMemoryAlertaRepositoryAdapter } = require('./adapters/out/persistence/InMemoryAlertaRepositoryAdapter');
const { GeminiAsistenteAdapter } = require('./adapters/out/ai/GeminiAsistenteAdapter');
const { ConsoleNotificadorAdapter } = require('./adapters/out/notifications/ConsoleNotificadorAdapter');

// Adaptadores de Entrada HTTP (Infraestructura Driving)
const { WearableHttpController } = require('./adapters/in/http/WearableHttpController');
const { DiaBotHttpController } = require('./adapters/in/http/DiaBotHttpController');
const { RegistrosHttpController } = require('./adapters/in/http/RegistrosHttpController');
const { AlertasHttpController } = require('./adapters/in/http/AlertasHttpController');
const { SaludHttpController } = require('./adapters/in/http/SaludHttpController');

function createBackendContainer(overrides = {}) {
  const wearableRepository = overrides.wearableRepository || new InMemoryWearableRepositoryAdapter();
  const alertaRepository = overrides.alertaRepository || new InMemoryAlertaRepositoryAdapter();

  const fallbackRegistros = new InMemoryRegistroClinicoRepositoryAdapter();
  const registroRepository = overrides.registroRepository || new SupabaseRegistroClinicoRepositoryAdapter({
    fallbackRepository: fallbackRegistros
  });

  const asistenteIA = overrides.asistenteIA || new GeminiAsistenteAdapter();
  const notificador = overrides.notificador || new ConsoleNotificadorAdapter();

  // Casos de Uso con Inyección de Puertos
  const procesarTelemetriaWearableUseCase = new ProcesarTelemetriaWearableUseCase({
    wearableRepository,
    alertaRepository,
    notificador
  });

  const consultarDiaBotUseCase = new ConsultarDiaBotUseCase({
    asistenteIA
  });

  const gestionarRegistrosClinicosUseCase = new GestionarRegistrosClinicosUseCase({
    registroRepository,
    alertaRepository,
    notificador
  });

  const gestionarAlertasEmergenciaUseCase = new GestionarAlertasEmergenciaUseCase({
    alertaRepository,
    notificador
  });

  // Controladores HTTP (Adaptadores de Entrada)
  const controllers = {
    wearable: new WearableHttpController(procesarTelemetriaWearableUseCase),
    diabot: new DiaBotHttpController(consultarDiaBotUseCase),
    registros: new RegistrosHttpController(gestionarRegistrosClinicosUseCase),
    alertas: new AlertasHttpController(gestionarAlertasEmergenciaUseCase),
    salud: new SaludHttpController({
      supabaseConfigurado: typeof registroRepository.estaConfigurado === 'function'
        ? registroRepository.estaConfigurado()
        : false,
      geminiConfigurado: typeof asistenteIA.estaConfigurado === 'function'
        ? asistenteIA.estaConfigurado()
        : false
    })
  };

  return {
    ports: {
      wearableRepository,
      registroRepository,
      alertaRepository,
      asistenteIA,
      notificador
    },
    useCases: {
      procesarTelemetriaWearable: procesarTelemetriaWearableUseCase,
      consultarDiaBot: consultarDiaBotUseCase,
      gestionarRegistrosClinicos: gestionarRegistrosClinicosUseCase,
      gestionarAlertasEmergencia: gestionarAlertasEmergenciaUseCase
    },
    controllers
  };
}

let defaultContainer = null;

function getDefaultContainer() {
  if (!defaultContainer) {
    defaultContainer = createBackendContainer();
  }
  return defaultContainer;
}

module.exports = {
  createBackendContainer,
  getDefaultContainer
};
