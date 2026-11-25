// Dominio: Puerto de Salida para Notificación de Emergencias 24/7
// Arquitectura Hexagonal - Output Port

(function (root) {
  'use strict';

  class NotificadorEmergenciaPort {
    async notificarAlerta(_alerta) {
      throw new Error('NotificadorEmergenciaPort.notificarAlerta() not implemented');
    }

    async notificarEscalamiento(_alerta) {
      throw new Error('NotificadorEmergenciaPort.notificarEscalamiento() not implemented');
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NotificadorEmergenciaPort };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.NotificadorEmergenciaPort = NotificadorEmergenciaPort;
})(typeof window !== 'undefined' ? window : globalThis);
