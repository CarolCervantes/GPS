// Dominio: Entidad Alerta de Emergencia / Preventiva 24/7
// Arquitectura Hexagonal - Capa de Dominio (Sin dependencias externas)

(function (root) {
  'use strict';

  const TIPOS_ALERTA_VALIDOS = [
    'sos_manual',
    'sos_voz',
    'hipoglucemia',
    'hiperglucemia',
    'crisis_hipertensiva',
    'geocerca',
    'wearable_preventiva',
    'bienestar_sintomas'
  ];

  const SEVERIDADES_VALIDAS = ['critica', 'alta', 'media', 'info'];

  const ESTADOS_ALERTA_VALIDOS = [
    'activa',
    'confirmada_bien',
    'escalada_cuidador',
    'escalada_123',
    'resuelta'
  ];

  function normalizarCodigo(raw) {
    const limpio = String(raw || 'DM-8492').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    return limpio || 'DM-8492';
  }

  class AlertaEmergenciaEntity {
    constructor(props = {}) {
      this.id = props.id || `alr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      this.codigoPaciente = normalizarCodigo(props.codigoPaciente || props.codigo || props.pacienteId);
      this.pacienteNombre = String(props.pacienteNombre || props.paciente || 'Damián Díaz Balseiro').trim().slice(0, 120);

      const tipo = String(props.tipo || 'sos_manual').trim().toLowerCase();
      this.tipo = TIPOS_ALERTA_VALIDOS.includes(tipo) ? tipo : 'sos_manual';

      const severidad = String(props.severidad || 'critica').trim().toLowerCase();
      this.severidad = SEVERIDADES_VALIDAS.includes(severidad) ? severidad : 'alta';

      const estado = String(props.estado || 'activa').trim().toLowerCase();
      this.estado = ESTADOS_ALERTA_VALIDOS.includes(estado) ? estado : 'activa';

      const titulo = String(props.titulo || '').trim();
      if (!titulo) {
        throw new Error('El título de la alerta es obligatorio.');
      }
      this.titulo = titulo.slice(0, 160);
      this.mensaje = String(props.mensaje || titulo).trim().slice(0, 600);
      this.sintomas = Array.isArray(props.sintomas)
        ? props.sintomas.map(s => String(s).trim()).filter(Boolean).slice(0, 12)
        : [];
      this.signosVitales = props.signosVitales && typeof props.signosVitales === 'object'
        ? { ...props.signosVitales }
        : null;

      if (props.ubicacion && typeof props.ubicacion === 'object') {
        const lat = Number(props.ubicacion.lat);
        const lng = Number(props.ubicacion.lng);
        const tieneCoords = !isNaN(lat) && !isNaN(lng);
        this.ubicacion = {
          lat: tieneCoords ? Number(lat.toFixed(6)) : null,
          lng: tieneCoords ? Number(lng.toFixed(6)) : null,
          zona: String(props.ubicacion.zona || 'Barrio Chapacuá, Cartagena de Indias').trim().slice(0, 160),
          googleMapsUrl: tieneCoords
            ? `https://www.google.com/maps?q=${Number(lat.toFixed(6))},${Number(lng.toFixed(6))}`
            : null
        };
      } else {
        this.ubicacion = null;
      }

      this.origen = String(props.origen || 'web').trim().slice(0, 40);
      this.motivoCierre = props.motivoCierre ? String(props.motivoCierre).trim().slice(0, 300) : null;
      this.creadaEn = props.creadaEn || new Date().toISOString();
      this.actualizadaEn = props.actualizadaEn || this.creadaEn;
    }

    transicionarEstado(nuevoEstado, motivo = null) {
      const estadoNorm = String(nuevoEstado || '').trim().toLowerCase();
      if (!ESTADOS_ALERTA_VALIDOS.includes(estadoNorm)) {
        throw new Error(`Estado de alerta inválido: "${nuevoEstado}". Permitidos: ${ESTADOS_ALERTA_VALIDOS.join(', ')}.`);
      }
      this.estado = estadoNorm;
      if (motivo) {
        this.motivoCierre = String(motivo).trim().slice(0, 300);
      }
      this.actualizadaEn = new Date().toISOString();
      return this;
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      AlertaEmergenciaEntity,
      TIPOS_ALERTA_VALIDOS,
      SEVERIDADES_VALIDAS,
      ESTADOS_ALERTA_VALIDOS
    };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.AlertaEmergenciaEntity = AlertaEmergenciaEntity;
})(typeof window !== 'undefined' ? window : globalThis);
