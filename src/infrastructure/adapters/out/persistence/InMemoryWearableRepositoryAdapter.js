// Infraestructura - Adaptador de Salida: Persistencia en Memoria para Telemetría Wearable
// Implementa WearableRepositoryPort

'use strict';

const { WearableRepositoryPort } = require('../../../../domain/ports/WearableRepositoryPort');

class InMemoryWearableRepositoryAdapter extends WearableRepositoryPort {
  constructor(maxPorPaciente = 30) {
    super();
    this.maxPorPaciente = maxPorPaciente;
    this.storePorPaciente = new Map();
  }

  async guardarLectura(codigoPaciente, entrada) {
    const actuales = this.storePorPaciente.get(codigoPaciente) || [];
    actuales.unshift(entrada);
    if (actuales.length > this.maxPorPaciente) {
      actuales.length = this.maxPorPaciente;
    }
    this.storePorPaciente.set(codigoPaciente, actuales);
    return entrada;
  }

  async obtenerHistorial(codigoPaciente, limite = 10) {
    const registros = this.storePorPaciente.get(codigoPaciente) || [];
    return registros.slice(0, Math.max(1, Number(limite) || 10));
  }
}

module.exports = { InMemoryWearableRepositoryAdapter };
