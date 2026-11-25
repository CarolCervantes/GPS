// Infraestructura - Adaptador de Salida Híbrido: Supabase PostgREST + Fallback en Memoria
// Permite que el backend hexagonal persista en Supabase cuando existan variables de entorno
// (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY o SUPABASE_ANON_KEY), manteniendo operación segura sin caída.

'use strict';

const { RegistroClinicoRepositoryPort } = require('../../../../domain/ports/RegistroClinicoRepositoryPort');
const { InMemoryRegistroClinicoRepositoryAdapter } = require('./InMemoryRegistroClinicoRepositoryAdapter');

class SupabaseRegistroClinicoRepositoryAdapter extends RegistroClinicoRepositoryPort {
  constructor({
    supabaseUrl = process.env.SUPABASE_URL || '',
    supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '',
    fallbackRepository = new InMemoryRegistroClinicoRepositoryAdapter(),
    fetchImpl = (typeof fetch === 'function' ? fetch : null)
  } = {}) {
    super();
    this.supabaseUrl = String(supabaseUrl || '').replace(/\/+$/, '');
    this.supabaseKey = String(supabaseKey || '').trim();
    this.fallback = fallbackRepository;
    this.fetchImpl = fetchImpl;
  }

  estaConfigurado() {
    return Boolean(this.supabaseUrl && this.supabaseKey && this.fetchImpl);
  }

  async _sincronizarPostgREST(registro) {
    if (!this.estaConfigurado()) return { synced: false, reason: 'not_configured' };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const resp = await this.fetchImpl(`${this.supabaseUrl}/rest/v1/registros`, {
        method: 'POST',
        headers: {
          apikey: this.supabaseKey,
          Authorization: `Bearer ${this.supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          tipo: registro.tipo,
          valor: typeof registro.resumenTexto === 'function' ? registro.resumenTexto() : String(registro.tipo),
          notas: `${registro.codigoPaciente} · ${registro.pacienteNombre}${registro.notas ? ` · ${registro.notas}` : ''}`
        }),
        signal: controller.signal
      });
      return { synced: resp.ok, status: resp.status };
    } catch (err) {
      return { synced: false, reason: err.message };
    } finally {
      clearTimeout(timer);
    }
  }

  async crear(registro) {
    const guardado = await this.fallback.crear(registro);
    await this._sincronizarPostgREST(guardado);
    return guardado;
  }

  async listarPorPaciente(codigoPaciente, filtro = {}) {
    return this.fallback.listarPorPaciente(codigoPaciente, filtro);
  }

  async obtenerPorId(id) {
    return this.fallback.obtenerPorId(id);
  }

  async actualizar(id, registroActualizado) {
    return this.fallback.actualizar(id, registroActualizado);
  }

  async eliminar(id) {
    return this.fallback.eliminar(id);
  }
}

module.exports = { SupabaseRegistroClinicoRepositoryAdapter };
