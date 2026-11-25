// Aplicación: Caso de Uso de Gestión y Escalamiento de Alertas 24/7 (Familiar -> 123)
// Arquitectura Hexagonal - Capa de Aplicación

(function (root) {
  'use strict';

  const AlertaEntity = (typeof module !== 'undefined' && module.exports)
    ? require('../../domain/entities/AlertaEmergenciaEntity').AlertaEmergenciaEntity
    : root.DiaMonHexagonal?.AlertaEmergenciaEntity;

  class GestionarAlertasEmergenciaUseCase {
    constructor({ alertaRepository, notificador = null } = {}) {
      if (!alertaRepository) {
        throw new Error('GestionarAlertasEmergenciaUseCase requiere alertaRepository.');
      }
      this.alertaRepository = alertaRepository;
      this.notificador = notificador;
    }

    async emitirAlerta(rawData = {}) {
      const alerta = rawData instanceof AlertaEntity
        ? rawData
        : new AlertaEntity(rawData);

      const guardada = await this.alertaRepository.crear(alerta);

      if (this.notificador && typeof this.notificador.notificarAlerta === 'function') {
        await this.notificador.notificarAlerta(guardada);
      }

      return guardada;
    }

    async listarAlertas(codigoPaciente = 'DM-8492', limite = 30) {
      return this.alertaRepository.listarPorPaciente(codigoPaciente, limite);
    }

    async actualizarEstadoAlerta(id, nuevoEstado, motivo = null) {
      if (!id) throw new Error('Debe indicar el ID de la alerta.');
      const encontrada = await this.alertaRepository.obtenerPorId(id);
      if (!encontrada) {
        throw new Error(`No existe una alerta con ID ${id}.`);
      }

      const entidad = encontrada instanceof AlertaEntity
        ? encontrada
        : new AlertaEntity(encontrada);

      entidad.transicionarEstado(nuevoEstado, motivo);
      const actualizada = await this.alertaRepository.actualizar(entidad);

      if (
        (entidad.estado === 'escalada_cuidador' || entidad.estado === 'escalada_123') &&
        this.notificador &&
        typeof this.notificador.notificarEscalamiento === 'function'
      ) {
        await this.notificador.notificarEscalamiento(actualizada);
      }

      return actualizada;
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GestionarAlertasEmergenciaUseCase };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.GestionarAlertasEmergenciaUseCase = GestionarAlertasEmergenciaUseCase;
})(typeof window !== 'undefined' ? window : globalThis);
