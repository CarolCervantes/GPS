// Infraestructura - Adaptador de Salida: Persistencia en Memoria para Registros Clínicos
// Implementa RegistroClinicoRepositoryPort

'use strict';

const { RegistroClinicoRepositoryPort } = require('../../../../domain/ports/RegistroClinicoRepositoryPort');

class InMemoryRegistroClinicoRepositoryAdapter extends RegistroClinicoRepositoryPort {
  constructor(maxRegistros = 200) {
    super();
    this.maxRegistros = maxRegistros;
    this.registros = new Map();
  }

  async crear(registro) {
    this.registros.set(registro.id, registro);
    if (this.registros.size > this.maxRegistros) {
      const oldestKey = this.registros.keys().next().value;
      this.registros.delete(oldestKey);
    }
    return registro;
  }

  async listarPorPaciente(codigoPaciente, filtro = {}) {
    const codigoNorm = String(codigoPaciente || 'DM-8492').trim().toUpperCase();
    const tipoFiltro = filtro.tipo ? String(filtro.tipo).trim().toLowerCase() : null;
    const limite = Math.max(1, Math.min(100, Number(filtro.limite) || 50));

    const lista = Array.from(this.registros.values())
      .filter(r => r.codigoPaciente === codigoNorm)
      .filter(r => !tipoFiltro || r.tipo === tipoFiltro)
      .sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime());

    return lista.slice(0, limite);
  }

  async obtenerPorId(id) {
    return this.registros.get(id) || null;
  }

  async actualizar(id, registroActualizado) {
    if (!this.registros.has(id)) return null;
    this.registros.set(id, registroActualizado);
    return registroActualizado;
  }

  async eliminar(id) {
    return this.registros.delete(id);
  }
}

module.exports = { InMemoryRegistroClinicoRepositoryAdapter };
