// Dominio: Puerto de Salida para Repositorio de Registros Clínicos
// Arquitectura Hexagonal - Output Port

(function (root) {
  'use strict';

  class RegistroClinicoRepositoryPort {
    async crear(_registro) {
      throw new Error('RegistroClinicoRepositoryPort.crear() not implemented');
    }

    async listarPorPaciente(_codigoPaciente, _filtro = {}) {
      throw new Error('RegistroClinicoRepositoryPort.listarPorPaciente() not implemented');
    }

    async obtenerPorId(_id) {
      throw new Error('RegistroClinicoRepositoryPort.obtenerPorId() not implemented');
    }

    async actualizar(_id, _cambios) {
      throw new Error('RegistroClinicoRepositoryPort.actualizar() not implemented');
    }

    async eliminar(_id) {
      throw new Error('RegistroClinicoRepositoryPort.eliminar() not implemented');
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RegistroClinicoRepositoryPort };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.RegistroClinicoRepositoryPort = RegistroClinicoRepositoryPort;
})(typeof window !== 'undefined' ? window : globalThis);
