// Aplicación: Caso de Uso de Consulta al Asistente Clínico DiaBot IA
// Arquitectura Hexagonal - Capa de Aplicación (Depende solo de Dominio y AsistenteIAPort)

(function (root) {
  'use strict';

  const ConsultaEntity = (typeof module !== 'undefined' && module.exports)
    ? require('../../domain/entities/ConsultaDiaBotEntity').ConsultaDiaBotEntity
    : root.DiaMonHexagonal?.ConsultaDiaBotEntity;

  const PromptService = (typeof module !== 'undefined' && module.exports)
    ? require('../../domain/services/PromptClinicoDomainService').PromptClinicoDomainService
    : root.DiaMonHexagonal?.PromptClinicoDomainService;

  class ConsultarDiaBotUseCase {
    constructor({ asistenteIA } = {}) {
      this.asistenteIA = asistenteIA || null;
    }

    async ejecutar(rawPayload = {}) {
      const consulta = new ConsultaEntity(rawPayload);
      const instruccionSistema = PromptService.construirInstruccionCompleta(consulta.context);

      if (this.asistenteIA && typeof this.asistenteIA.estaConfigurado === 'function' && this.asistenteIA.estaConfigurado()) {
        try {
          const resultado = await this.asistenteIA.generarRespuesta(consulta, instruccionSistema);
          if (resultado && resultado.reply) {
            return {
              reply: resultado.reply,
              engine: resultado.engine || 'gemini-2.5-flash',
              usedLiveContext: true
            };
          }
        } catch (err) {
          return {
            reply: null,
            engine: 'clinical-context-engine',
            usedLiveContext: true,
            fallbackReason: err.message
          };
        }
      }

      // Fallback determinístico: el motor clínico contextual integrado en el cliente responde con signos reales
      return {
        reply: null,
        engine: 'clinical-context-engine',
        usedLiveContext: true
      };
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ConsultarDiaBotUseCase };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.ConsultarDiaBotUseCase = ConsultarDiaBotUseCase;
})(typeof window !== 'undefined' ? window : globalThis);
