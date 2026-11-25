/**
 * DiaMon — Adaptador Cliente HTTP del Frontend hacia el Backend Hexagonal (/api/*)
 * Arquitectura Hexagonal: Conecta la capa de presentación Web/PWA (Adaptador Primario)
 * con los endpoints hexagonales (/api/salud, /api/registros, /api/alertas, /api/wearable, /api/diabot)
 * manteniendo tolerancia total a fallos y modo offline en WebView Android (file://).
 */

(function (root) {
  'use strict';

  const BACKEND_URL_KEY = 'diamon_backend_url_v1';

  class DiaMonBackendClientAdapter {
    constructor() {
      this.ultimoEstadoBackend = null;
    }

    obtenerBaseUrl() {
      try {
        const custom = localStorage.getItem(BACKEND_URL_KEY);
        if (custom && /^https?:\/\//i.test(custom.trim())) {
          return custom.trim().replace(/\/+$/, '');
        }
      } catch (_) {}

      if (typeof window !== 'undefined' && window.location && /^https?:$/i.test(window.location.protocol)) {
        return window.location.origin;
      }
      return null; // Modo offline local (file:// en Android WebView sin URL remota configurada)
    }

    configurarBaseUrl(url) {
      try {
        if (!url) {
          localStorage.removeItem(BACKEND_URL_KEY);
        } else if (/^https?:\/\//i.test(url.trim())) {
          localStorage.setItem(BACKEND_URL_KEY, url.trim().replace(/\/+$/, ''));
        }
      } catch (_) {}
    }

    obtenerCodigoPacienteActivo() {
      try {
        return window.casoEstudio?.paciente?.codigoPaciente || 'DM-8492';
      } catch (_) {
        return 'DM-8492';
      }
    }

    async _request(endpoint, options = {}) {
      const base = this.obtenerBaseUrl();
      if (!base || typeof fetch !== 'function') {
        return { ok: false, offline: true };
      }

      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 5000) : null;

      try {
        const resp = await fetch(`${base}${endpoint}`, {
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller ? controller.signal : undefined
        });
        const data = await resp.json().catch(() => ({}));
        return { ok: resp.ok, status: resp.status, data };
      } catch (err) {
        return { ok: false, offline: true, error: err.message };
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    async verificarSaludBackend() {
      const res = await this._request('/api/salud');
      if (res.ok && res.data) {
        this.ultimoEstadoBackend = res.data;
      }
      return res;
    }

    async sincronizarRegistroClinico(payload) {
      return this._request('/api/registros', {
        method: 'POST',
        body: {
          codigoPaciente: this.obtenerCodigoPacienteActivo(),
          pacienteNombre: window.casoEstudio?.paciente?.nombre || 'Damián Díaz Balseiro',
          origen: (window.DiaMonAndroid && typeof window.DiaMonAndroid.esAppAndroid === 'function') ? 'android_apk' : 'web_pwa',
          ...payload
        }
      });
    }

    async listarRegistrosClinicos(tipo = null, limite = 30) {
      const codigo = encodeURIComponent(this.obtenerCodigoPacienteActivo());
      const qTipo = tipo ? `&tipo=${encodeURIComponent(tipo)}` : '';
      return this._request(`/api/registros?codigo=${codigo}${qTipo}&limite=${limite}`);
    }

    async sincronizarAlertaEmergencia(payload) {
      return this._request('/api/alertas', {
        method: 'POST',
        body: {
          codigoPaciente: this.obtenerCodigoPacienteActivo(),
          pacienteNombre: window.casoEstudio?.paciente?.nombre || 'Damián Díaz Balseiro',
          origen: (window.DiaMonAndroid && typeof window.DiaMonAndroid.esAppAndroid === 'function') ? 'android_apk' : 'web_pwa',
          ...payload
        }
      });
    }

    async actualizarEstadoAlerta(id, estado, motivo = null) {
      return this._request('/api/alertas', {
        method: 'PATCH',
        body: { id, estado, motivo }
      });
    }

    async enviarLecturaWearable(payload) {
      return this._request('/api/wearable', {
        method: 'POST',
        body: {
          codigoPaciente: this.obtenerCodigoPacienteActivo(),
          ...payload
        }
      });
    }
  }

  const instancia = new DiaMonBackendClientAdapter();
  root.DiaMonBackendAdapter = instancia;
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.DiaMonBackendClientAdapter = DiaMonBackendClientAdapter;
})(typeof window !== 'undefined' ? window : globalThis);
