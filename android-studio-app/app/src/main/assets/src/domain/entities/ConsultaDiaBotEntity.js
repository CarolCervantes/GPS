// Dominio: Entidad Consulta Clínica para el Asistente DiaBot
// Arquitectura Hexagonal - Capa de Dominio (Sin dependencias externas)

(function (root) {
  'use strict';

  class ConsultaDiaBotEntity {
    constructor(props = {}) {
      const msg = String(props.message || props.mensaje || '').trim();
      if (!msg) {
        throw new Error('Mensaje vacío.');
      }
      this.message = msg.slice(0, 600);

      const ctx = (props.context && typeof props.context === 'object') ? props.context : {};
      this.context = {
        nombre: String(ctx.nombre || 'Damián Díaz Balseiro').slice(0, 120),
        diagnostico: String(ctx.diagnostico || 'Diabetes Mellitus Tipo 2 Insulinorrequiriente + Hipertensión Arterial + Neuropatía Diabética').slice(0, 220),
        glucosa: String(ctx.glucosa || '114 mg/dL').slice(0, 60),
        contextoGlucosa: String(ctx.contextoGlucosa || 'En ayunas').slice(0, 60),
        estadoGlucosa: String(ctx.estadoGlucosa || 'En meta clínica').slice(0, 80),
        presion: String(ctx.presion || '126/78 mmHg').slice(0, 60),
        pulso: String(ctx.pulso || '71 BPM').slice(0, 40),
        estadoPresion: String(ctx.estadoPresion || 'Controlada').slice(0, 80),
        temperaturaCorporal: String(ctx.temperaturaCorporal || '36.5 °C').slice(0, 40),
        estadoWearablePreventivo: String(ctx.estadoWearablePreventivo || 'Estable').slice(0, 80),
        profesional: String(ctx.profesional || 'Enf. Jefe Elizabeth Vargas Caro').slice(0, 120),
        metaGlucosa: String(ctx.metaGlucosa || '80-180 mg/dL').slice(0, 60),
        metaPresion: String(ctx.metaPresion || '140/90 mmHg').slice(0, 60),
        ubicacion: String(ctx.ubicacion || 'Barrio Chapacuá, Cartagena de Indias').slice(0, 160)
      };

      this.history = Array.isArray(props.history) ? props.history.slice(-6) : [];
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ConsultaDiaBotEntity };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.ConsultaDiaBotEntity = ConsultaDiaBotEntity;
})(typeof window !== 'undefined' ? window : globalThis);
