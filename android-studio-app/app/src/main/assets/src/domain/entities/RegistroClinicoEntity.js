// Dominio: Entidad Registro Clínico (Glucosa, Presión Arterial, Medicamentos, Estado Diario, GPS)
// Arquitectura Hexagonal - Capa de Dominio (Sin dependencias de infraestructura)

(function (root) {
  'use strict';

  const TIPOS_REGISTRO_VALIDOS = [
    'glucosa',
    'presion',
    'medicamento',
    'estado_diario',
    'gps'
  ];

  function normalizarCodigoPaciente(raw) {
    const limpio = String(raw || 'DM-8492').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    return limpio || 'DM-8492';
  }

  class RegistroClinicoEntity {
    constructor(props = {}) {
      this.id = props.id || `reg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      this.codigoPaciente = normalizarCodigoPaciente(props.codigoPaciente || props.codigo || props.pacienteId);
      this.pacienteNombre = String(props.pacienteNombre || props.paciente || 'Damián Díaz Balseiro').trim().slice(0, 120);

      const tipo = String(props.tipo || '').trim().toLowerCase();
      if (!TIPOS_REGISTRO_VALIDOS.includes(tipo)) {
        throw new Error(`Tipo de registro clínico inválido: "${tipo}". Permitidos: ${TIPOS_REGISTRO_VALIDOS.join(', ')}.`);
      }
      this.tipo = tipo;

      this.glucosaMgDl = null;
      this.sistolica = null;
      this.diastolica = null;
      this.pulsoBpm = null;
      this.contexto = String(props.contexto || '').trim().slice(0, 80);
      this.medicamento = String(props.medicamento || '').trim().slice(0, 160);
      this.animo = String(props.animo || '').trim().slice(0, 60);
      this.sintomas = Array.isArray(props.sintomas)
        ? props.sintomas.map(s => String(s).trim()).filter(Boolean).slice(0, 12)
        : [];
      this.notas = String(props.notas || '').trim().slice(0, 500);
      this.coordenadas = null;

      if (this.tipo === 'glucosa') {
        const valor = Number(props.glucosaMgDl ?? props.valor ?? props.glucosa);
        if (isNaN(valor) || valor < 20 || valor > 600) {
          throw new Error('La glucosa capilar debe estar entre 20 y 600 mg/dL.');
        }
        this.glucosaMgDl = Math.round(valor);
        this.contexto = this.contexto || 'Capilar';
      }

      if (this.tipo === 'presion') {
        const sis = Number(props.sistolica ?? props.sys);
        const dia = Number(props.diastolica ?? props.dia);
        if (isNaN(sis) || sis < 50 || sis > 260) {
          throw new Error('La presión sistólica debe estar entre 50 y 260 mmHg.');
        }
        if (isNaN(dia) || dia < 30 || dia > 160) {
          throw new Error('La presión diastólica debe estar entre 30 y 160 mmHg.');
        }
        if (dia >= sis) {
          throw new Error('La presión diastólica debe ser menor que la sistólica.');
        }
        this.sistolica = Math.round(sis);
        this.diastolica = Math.round(dia);
        if (props.pulsoBpm !== undefined && props.pulsoBpm !== null && props.pulsoBpm !== '') {
          const pulso = Number(props.pulsoBpm);
          if (isNaN(pulso) || pulso < 25 || pulso > 240) {
            throw new Error('El pulso debe estar entre 25 y 240 BPM.');
          }
          this.pulsoBpm = Math.round(pulso);
        }
      }

      if (this.tipo === 'medicamento' && !this.medicamento) {
        throw new Error('Debe especificar el nombre del medicamento o esquema tomado.');
      }

      if (props.coordenadas && typeof props.coordenadas === 'object') {
        const lat = Number(props.coordenadas.lat);
        const lng = Number(props.coordenadas.lng);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          this.coordenadas = {
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
            zona: String(props.coordenadas.zona || '').trim().slice(0, 120)
          };
        }
      } else if (this.tipo === 'gps') {
        const lat = Number(props.lat);
        const lng = Number(props.lng);
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          throw new Error('Las coordenadas GPS (lat, lng) son obligatorias y deben ser válidas.');
        }
        this.coordenadas = {
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
          zona: String(props.zona || 'Cartagena de Indias').trim().slice(0, 120)
        };
      }

      this.origen = String(props.origen || 'web').trim().slice(0, 40);
      this.evaluacion = props.evaluacion || null;
      this.creadoEn = props.creadoEn || new Date().toISOString();
      this.actualizadoEn = props.actualizadoEn || this.creadoEn;
    }

    resumenTexto() {
      if (this.tipo === 'glucosa') return `${this.glucosaMgDl} mg/dL (${this.contexto})`;
      if (this.tipo === 'presion') return `${this.sistolica}/${this.diastolica} mmHg${this.pulsoBpm ? ` · ${this.pulsoBpm} BPM` : ''}`;
      if (this.tipo === 'medicamento') return `Medicamento: ${this.medicamento}`;
      if (this.tipo === 'estado_diario') return `Bienestar: ${this.animo || 'Registrado'}${this.sintomas.length ? ` (${this.sintomas.join(', ')})` : ''}`;
      if (this.tipo === 'gps' && this.coordenadas) return `GPS: ${this.coordenadas.lat}, ${this.coordenadas.lng}`;
      return this.notas || this.tipo;
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RegistroClinicoEntity, TIPOS_REGISTRO_VALIDOS, normalizarCodigoPaciente };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.RegistroClinicoEntity = RegistroClinicoEntity;
})(typeof window !== 'undefined' ? window : globalThis);
