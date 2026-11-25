// Infraestructura - Adaptador de Salida: Persistencia en Memoria para Alertas 24/7
// Implementa AlertaEmergenciaRepositoryPort

'use strict';

const { AlertaEmergenciaRepositoryPort } = require('../../../../domain/ports/AlertaEmergenciaRepositoryPort');

class InMemoryAlertaRepositoryAdapter extends AlertaEmergenciaRepositoryPort {
  constructor(maxAlertas = 150) {
    super();
    this.maxAlertas = maxAlertas;
    this.alertas = new Map();
  }

  async crear(alerta) {
    this.alertas.set(alerta.id, alerta);
    if (this.alertas.size > this.maxAlertas) {
      const oldestKey = this.alertas.keys().next().value;
      this.alertas.delete(oldestKey);
    }
    return alerta;
  }

  async listarPorPaciente(codigoPaciente, limite = 30) {
    const codigoNorm = String(codigoPaciente || 'DM-8492').trim().toUpperCase();
    const max = Math.max(1, Math.min(100, Number(limite) || 30));
    return Array.from(this.alertas.values())
      .filter(a => a.codigoPaciente === codigoNorm)
      .sort((a, b) => new Date(b.creadaEn).getTime() - new Date(a.creadaEn).getTime())
      .slice(0, max);
  }

  async obtenerPorId(id) {
    return this.alertas.get(id) || null;
  }

  async actualizar(alerta) {
    if (!this.alertas.has(alerta.id)) return null;
    this.alertas.set(alerta.id, alerta);
    return alerta;
  }
}

module.exports = { InMemoryAlertaRepositoryAdapter };
