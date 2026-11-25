// Dominio: Entidad Lectura Biométrica de Wearable (Reloj Inteligente, Anillo o Banda)
// Arquitectura Hexagonal - Capa de Dominio (Sin dependencias externas)

(function (root) {
  'use strict';

  const TIPOS_DISPOSITIVO_VALIDOS = [
    'reloj_inteligente',
    'anillo_inteligente',
    'banda_fitness',
    'sensor_ble',
    'simulador'
  ];

  class LecturaBiometricaEntity {
    constructor(props = {}) {
      this.id = props.id || `bio-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      this.pacienteId = props.pacienteId || 'pac-damian-diaz-01';

      const bpm = Number(props.ritmoCardiacoBpm);
      if (isNaN(bpm) || bpm < 25 || bpm > 240) {
        throw new Error('El ritmo cardíaco debe estar entre 25 y 240 BPM.');
      }
      this.ritmoCardiacoBpm = Math.round(bpm);

      if (props.temperaturaC === null || props.temperaturaC === undefined || props.temperaturaC === '') {
        this.temperaturaC = null;
      } else {
        const temp = Number(props.temperaturaC);
        if (isNaN(temp) || temp < 31.0 || temp > 43.0) {
          throw new Error('La temperatura corporal debe estar entre 31.0 °C y 43.0 °C.');
        }
        this.temperaturaC = Number(temp.toFixed(1));
      }

      this.dispositivoTipo = TIPOS_DISPOSITIVO_VALIDOS.includes(props.dispositivoTipo)
        ? props.dispositivoTipo
        : 'reloj_inteligente';
      this.dispositivoNombre = props.dispositivoNombre || 'Reloj Inteligente DiaMon';
      this.fuente = props.fuente || 'simulador';
      this.bateriaDispositivo = props.bateriaDispositivo != null ? Number(props.bateriaDispositivo) : null;
      this.enReposo = props.enReposo !== false;
      this.coordenadas = props.coordenadas || null;
      this.ts = props.ts || Date.now();
    }

    tieneTemperatura() {
      return this.temperaturaC !== null;
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LecturaBiometricaEntity, TIPOS_DISPOSITIVO_VALIDOS };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.LecturaBiometricaEntity = LecturaBiometricaEntity;
})(typeof window !== 'undefined' ? window : globalThis);
