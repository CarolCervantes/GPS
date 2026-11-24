// Dominio: Reglas de negocio de Geocercas y Signos Vitales (Glucosa y Presión Arterial)
// Arquitectura Hexagonal - Capa de Dominio

(function (root) {
  'use strict';

  class EvaluadorClinicoDomainService {
    static calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    static verificarGeocerca(lat, lng, centroLat = 10.39991, centroLng = -75.47886, radioMetros = 400) {
      const distancia = Math.round(this.calcularDistanciaMetros(lat, lng, centroLat, centroLng));
      return {
        dentro: distancia <= radioMetros,
        distanciaMetros: distancia,
        radioPermitido: radioMetros
      };
    }

    static evaluarGlucosa(valor, metas = { glucosaMin: 80, glucosaMaxPost: 180 }) {
      const v = Number(valor);
      if (v < metas.glucosaMin) return { estado: 'hipoglucemia', severidad: 'critica', enRango: false };
      if (v > metas.glucosaMaxPost) return { estado: 'hiperglucemia', severidad: 'alerta', enRango: false };
      return { estado: 'normal', severidad: 'estable', enRango: true };
    }

    static evaluarPresion(sistolica, diastolica, metas = { sistolicaMax: 140, diastolicaMax: 90 }) {
      const sis = Number(sistolica);
      const dia = Number(diastolica);
      if (sis >= 160 || dia >= 100) return { estado: 'crisis_hipertensiva', severidad: 'critica', enRango: false };
      if (sis > metas.sistolicaMax || dia > metas.diastolicaMax) return { estado: 'elevada', severidad: 'alerta', enRango: false };
      return { estado: 'controlada', severidad: 'estable', enRango: true };
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EvaluadorClinicoDomainService };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.EvaluadorClinicoDomainService = EvaluadorClinicoDomainService;
})(typeof window !== 'undefined' ? window : globalThis);
