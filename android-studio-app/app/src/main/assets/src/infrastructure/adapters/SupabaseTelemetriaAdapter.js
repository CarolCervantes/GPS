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

    async guardarBiometriaWearable(lectura, evaluacion = {}) {
      if (!this.client || !this.client.auth) return { stored: 'local', lectura };
      try {
        const { data: authData } = await this.client.auth.getUser();
        const userId = authData?.user?.id;
        if (!userId) return { stored: 'local', lectura };

        const { data, error } = await this.client.from('biometria_wearable').insert({
          user_id: userId,
          dispositivo_tipo: lectura.dispositivoTipo,
          dispositivo_nombre: lectura.dispositivoNombre,
          fuente: lectura.fuente,
          ritmo_cardiaco_bpm: lectura.ritmoCardiacoBpm,
          temperatura_c: lectura.temperaturaC,
          delta_bpm: evaluacion?.signos?.deltaBpm ?? null,
          delta_temp: evaluacion?.signos?.deltaTemp ?? null,
          riesgo_detectado: evaluacion?.riesgo || 'estable',
          sintomas_detectados: evaluacion?.sintomasDetectados || [],
          bateria_dispositivo: lectura.bateriaDispositivo ?? null,
          lat: lectura.coordenadas?.lat ?? null,
          lng: lectura.coordenadas?.lng ?? null,
          ts: new Date(lectura.ts || Date.now()).toISOString()
        });
        return { stored: error ? 'local' : 'supabase', data, error };
      } catch (error) {
        return { stored: 'local', lectura, error };
      }
    }

    async guardarAlertaPreventiva(incidente) {
      if (!this.client || !this.client.auth) return { stored: 'local', incidente };
      try {
        const { data: authData } = await this.client.auth.getUser();
        const userId = authData?.user?.id;
        if (!userId) return { stored: 'local', incidente };

        const { data, error } = await this.client.from('alertas_preventivas_biometricas').insert({
          incidente_ref: incidente.id,
          user_id: userId,
          estado: 'activa_esperando_respuesta',
          riesgo_glucemico: incidente.evaluacion?.riesgo || 'anomalia_biometrica_critica',
          ritmo_cardiaco_bpm: incidente.lectura?.ritmoCardiacoBpm,
          temperatura_c: incidente.lectura?.temperaturaC ?? null,
          sintomas_detectados: incidente.evaluacion?.sintomasDetectados || [],
          tiempo_limite_seg: incidente.tiempoLimiteSegundos || 60,
          dispositivo_nombre: incidente.lectura?.dispositivoNombre || 'Wearable',
          ts: incidente.iniciadoEnIso || new Date().toISOString()
        });
        return { stored: error ? 'local' : 'supabase', data, error };
      } catch (error) {
        return { stored: 'local', incidente, error };
      }
    }

    async actualizarAlertaPreventiva(incidente) {
      if (!this.client || !this.client.auth) return { stored: 'local', incidente };
      try {
        const { data: authData } = await this.client.auth.getUser();
        const userId = authData?.user?.id;
        if (!userId) return { stored: 'local', incidente };

        const estadoSql = incidente.estado === 'CONFIRMADO_BIEN'
          ? 'confirmado_bien'
          : (incidente.estado === 'ESCALADA_A_CUIDADOR' ? 'escalada_sin_respuesta' : 'atendida');

        const { data, error } = await this.client
          .from('alertas_preventivas_biometricas')
          .update({
            estado: estadoSql,
            respondido_en: incidente.confirmadoEn || null,
            escalado_en: incidente.escaladoEn || null,
            ubicacion_lat: incidente.ubicacionEscalamiento?.lat ?? null,
            ubicacion_lng: incidente.ubicacionEscalamiento?.lng ?? null,
            ubicacion_texto: incidente.ubicacionEscalamiento?.zona ?? null
          })
          .eq('incidente_ref', incidente.id)
          .eq('user_id', userId);
        return { stored: error ? 'local' : 'supabase', data, error };
      } catch (error) {
        return { stored: 'local', incidente, error };
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SupabaseTelemetriaAdapter };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.SupabaseTelemetriaAdapter = SupabaseTelemetriaAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
