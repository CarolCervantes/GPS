// Aplicación: Caso de Uso para Recepción y Consulta de Telemetría Wearable
// Arquitectura Hexagonal - Capa de Aplicación (Depende solo de Dominio y Puertos)

(function (root) {
  'use strict';

  const LecturaEntity = (typeof module !== 'undefined' && module.exports)
    ? require('../../domain/entities/LecturaBiometricaEntity').LecturaBiometricaEntity
    : root.DiaMonHexagonal?.LecturaBiometricaEntity;

  const AlertaEntity = (typeof module !== 'undefined' && module.exports)
    ? require('../../domain/entities/AlertaEmergenciaEntity').AlertaEmergenciaEntity
    : root.DiaMonHexagonal?.AlertaEmergenciaEntity;

  const DetectorService = (typeof module !== 'undefined' && module.exports)
    ? require('../../domain/services/DetectorGlucemicoPreventivoService').DetectorGlucemicoPreventivoService
    : root.DiaMonHexagonal?.DetectorGlucemicoPreventivoService;

  function normalizarCodigo(raw) {
    const limpio = String(raw || 'DM-8492').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    return limpio || 'DM-8492';
  }

  class ProcesarTelemetriaWearableUseCase {
    constructor({ wearableRepository, alertaRepository = null, notificador = null } = {}) {
      if (!wearableRepository) {
        throw new Error('ProcesarTelemetriaWearableUseCase requiere wearableRepository.');
      }
      this.wearableRepository = wearableRepository;
      this.alertaRepository = alertaRepository;
      this.notificador = notificador;
    }

    async registrarLectura(payload = {}) {
      const codigoPaciente = normalizarCodigo(payload.codigoPaciente || payload.codigo);
      const bpmRaw = payload.ritmoCardiacoBpm ?? payload.bpm ?? payload.heartRate;

      if (bpmRaw === undefined || bpmRaw === null || bpmRaw === '') {
        throw new Error('Falta el campo ritmoCardiacoBpm (o bpm).');
      }

      const tempRaw = payload.temperaturaC ?? payload.temperatura ?? payload.tempC ?? null;

      const lectura = new LecturaEntity({
        pacienteId: codigoPaciente,
        ritmoCardiacoBpm: bpmRaw,
        temperaturaC: tempRaw,
        dispositivoTipo: payload.dispositivoTipo || 'reloj_inteligente',
        dispositivoNombre: String(payload.dispositivoNombre || payload.dispositivo || 'Reloj Inteligente (API)').slice(0, 80),
        fuente: payload.fuente || 'bridge_nativo',
        bateriaDispositivo: payload.bateriaDispositivo ?? payload.bateria ?? null,
        coordenadas: payload.coordenadas || null,
        ts: payload.ts || Date.now()
      });

      const evaluacion = DetectorService.evaluarLectura(lectura, payload.baseline || {});
      const entrada = {
        codigoPaciente,
        lectura,
        evaluacion,
        recibidoEn: new Date().toISOString()
      };

      await this.wearableRepository.guardarLectura(codigoPaciente, entrada);

      let alertaGenerada = null;
      if (evaluacion.requiereAlarmaSimultanea && AlertaEntity) {
        alertaGenerada = new AlertaEntity({
          codigoPaciente,
          tipo: 'wearable_preventiva',
          severidad: evaluacion.severidad === 'critica' ? 'critica' : 'alta',
          estado: 'activa',
          titulo: evaluacion.titulo || 'Anomalía preventiva detectada por reloj inteligente',
          mensaje: evaluacion.resumenClinico || 'Alteración biométrica detectada.',
          sintomas: evaluacion.sintomasDetectados || [],
          signosVitales: {
            ritmoCardiacoBpm: lectura.ritmoCardiacoBpm,
            temperaturaC: lectura.temperaturaC,
            riesgo: evaluacion.riesgo,
            dispositivoNombre: lectura.dispositivoNombre
          },
          ubicacion: lectura.coordenadas || null,
          origen: lectura.fuente
        });

        if (this.alertaRepository && typeof this.alertaRepository.crear === 'function') {
          await this.alertaRepository.crear(alertaGenerada);
        }
        if (this.notificador && typeof this.notificador.notificarAlerta === 'function') {
          await this.notificador.notificarAlerta(alertaGenerada);
        }
      }

      return {
        codigoPaciente,
        lectura,
        evaluacion,
        alertaGenerada,
        recibidoEn: entrada.recibidoEn
      };
    }

    async consultarEstado(rawCodigo, limite = 10) {
      const codigoPaciente = normalizarCodigo(rawCodigo);
      const registros = await this.wearableRepository.obtenerHistorial(codigoPaciente, limite);
      const ultimo = registros[0] || null;

      return {
        codigoPaciente,
        totalLecturas: registros.length,
        ultimaLectura: ultimo ? ultimo.lectura : null,
        ultimaEvaluacion: ultimo ? ultimo.evaluacion : null,
        historialReciente: registros.slice(0, limite)
      };
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ProcesarTelemetriaWearableUseCase };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.ProcesarTelemetriaWearableUseCase = ProcesarTelemetriaWearableUseCase;
})(typeof window !== 'undefined' ? window : globalThis);
