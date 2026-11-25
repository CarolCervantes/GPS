// Infraestructura - Adaptador de Salida: Notificador de Emergencias en Servidor
// Implementa NotificadorEmergenciaPort

'use strict';

const { NotificadorEmergenciaPort } = require('../../../../domain/ports/NotificadorEmergenciaPort');

class ConsoleNotificadorAdapter extends NotificadorEmergenciaPort {
  constructor({ silent = process.env.NODE_ENV === 'test' } = {}) {
    super();
    this.silent = silent;
    this.eventosEmitidos = [];
  }

  async notificarAlerta(alerta) {
    const registro = {
      evento: 'ALERTA_EMITIDA',
      alertaId: alerta.id,
      codigoPaciente: alerta.codigoPaciente,
      severidad: alerta.severidad,
      titulo: alerta.titulo,
      ts: new Date().toISOString()
    };
    this.eventosEmitidos.unshift(registro);
    if (this.eventosEmitidos.length > 50) this.eventosEmitidos.length = 50;
    return registro;
  }

  async notificarEscalamiento(alerta) {
    const registro = {
      evento: 'ALERTA_ESCALADA',
      alertaId: alerta.id,
      codigoPaciente: alerta.codigoPaciente,
      estado: alerta.estado,
      motivo: alerta.motivoCierre,
      ts: new Date().toISOString()
    };
    this.eventosEmitidos.unshift(registro);
    if (this.eventosEmitidos.length > 50) this.eventosEmitidos.length = 50;
    return registro;
  }
}

module.exports = { ConsoleNotificadorAdapter };
