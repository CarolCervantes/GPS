// Dominio: Puerto de Salida para Repositorio de Alertas de Emergencia 24/7
// Arquitectura Hexagonal - Output Port

(function (root) {
  'use strict';

  class AlertaEmergenciaRepositoryPort {
    async crear(_alerta) {
      throw new Error('AlertaEmergenciaRepositoryPort.crear() not implemented');
    }

    async listarPorPaciente(_codigoPaciente, _limite = 30) {
      throw new Error('AlertaEmergenciaRepositoryPort.listarPorPaciente() not implemented');
    }

    async obtenerPorId(_id) {
      throw new Error('AlertaEmergenciaRepositoryPort.obtenerPorId() not implemented');
    }

    async actualizar(_alerta) {
      throw new Error('AlertaEmergenciaRepositoryPort.actualizar() not implemented');
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AlertaEmergenciaRepositoryPort };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.AlertaEmergenciaRepositoryPort = AlertaEmergenciaRepositoryPort;
})(typeof window !== 'undefined' ? window : globalThis);
