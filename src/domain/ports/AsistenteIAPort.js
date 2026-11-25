// Dominio: Puerto de Salida para Proveedor de Inteligencia Artificial Clínica (DiaBot)
// Arquitectura Hexagonal - Output Port

(function (root) {
  'use strict';

  class AsistenteIAPort {
    estaConfigurado() {
      return false;
    }

    async generarRespuesta(_consulta, _instruccionSistema) {
      throw new Error('AsistenteIAPort.generarRespuesta() not implemented');
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AsistenteIAPort };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.AsistenteIAPort = AsistenteIAPort;
})(typeof window !== 'undefined' ? window : globalThis);
