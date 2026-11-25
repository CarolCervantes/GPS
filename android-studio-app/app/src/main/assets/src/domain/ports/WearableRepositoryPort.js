// Dominio: Puerto de Salida para Persistencia de Telemetría Wearable
// Arquitectura Hexagonal - Output Port

(function (root) {
  'use strict';

  class WearableRepositoryPort {
    async guardarLectura(_codigoPaciente, _entrada) {
      throw new Error('WearableRepositoryPort.guardarLectura() not implemented');
    }

    async obtenerHistorial(_codigoPaciente, _limite = 10) {
      throw new Error('WearableRepositoryPort.obtenerHistorial() not implemented');
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WearableRepositoryPort };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.WearableRepositoryPort = WearableRepositoryPort;
})(typeof window !== 'undefined' ? window : globalThis);
