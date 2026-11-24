// Adaptador para guardar las lecturas de glucosa, presion y GPS en Supabase
(function (root) {
  'use strict';

  class SupabaseTelemetriaAdapter {
    constructor(supabaseClient) {
      this.client = supabaseClient;
    }

    async guardarGlucosa(lectura) {
      if (!this.client) return { stored: 'local', lectura };
      const { data, error } = await this.client.from('glucosa_lecturas').insert(lectura);
      return { stored: error ? 'local' : 'supabase', data, error };
    }

    async guardarPresion(lectura) {
      if (!this.client) return { stored: 'local', lectura };
      const { data, error } = await this.client.from('presion_arterial').insert(lectura);
      return { stored: error ? 'local' : 'supabase', data, error };
    }

    async guardarPosicionGPS(punto) {
      if (!this.client) return { stored: 'local', punto };
      const { data, error } = await this.client.from('gps_lecturas').insert({
        lat: punto.lat,
        lng: punto.lng
      });
      return { stored: error ? 'local' : 'supabase', data, error };
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SupabaseTelemetriaAdapter };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.SupabaseTelemetriaAdapter = SupabaseTelemetriaAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
