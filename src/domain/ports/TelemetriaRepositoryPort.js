// Puerto del repositorio para definir los metodos de guardado de telemetria
(function (root) {
  'use strict';

  class TelemetriaRepositoryPort {
    async guardarGlucosa(_lectura) { throw new Error('Port method not implemented'); }
    async guardarPresion(_lectura) { throw new Error('Port method not implemented'); }
    async guardarPosicionGPS(_punto) { throw new Error('Port method not implemented'); }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TelemetriaRepositoryPort };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.TelemetriaRepositoryPort = TelemetriaRepositoryPort;
})(typeof window !== 'undefined' ? window : globalThis);
