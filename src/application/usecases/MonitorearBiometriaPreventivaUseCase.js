// Aplicación: Caso de Uso de Monitoreo Biométrico Preventivo y Escalamiento al Cuidador (60s)
// Arquitectura Hexagonal - Capa de Aplicación
// Flujo:
//   1. Recibe lectura biométrica (ritmo cardíaco + temperatura opcional) desde cualquier wearable.
//   2. Evalúa riesgo preventivo de bajada/subida de azúcar mediante el Dominio.
//   3. Si requiere alarma -> dispara alarma EN SIMULTÁNEO a paciente y cuidador con cuenta regresiva de 1 minuto.
//   4. Si el paciente responde "Estoy bien" antes del minuto -> cancela escalamiento y avisa al cuidador.
//   5. Si NO responde en 1 minuto (o pide ayuda inmediata) -> envía ubicación GPS + síntomas al cuidador.

(function (root) {
  'use strict';

  const DetectorService = (typeof module !== 'undefined' && module.exports)
    ? require('../../domain/services/DetectorGlucemicoPreventivoService').DetectorGlucemicoPreventivoService
    : root.DiaMonHexagonal?.DetectorGlucemicoPreventivoService;

  const LecturaEntity = (typeof module !== 'undefined' && module.exports)
    ? require('../../domain/entities/LecturaBiometricaEntity').LecturaBiometricaEntity
    : root.DiaMonHexagonal?.LecturaBiometricaEntity;

  class MonitorearBiometriaPreventivaUseCase {
    constructor(repositoryAdapter = null, notificadorAdapter = null) {
      this.repository = repositoryAdapter;
      this.notificador = notificadorAdapter;
      this.incidenteActivo = null;
    }

    async procesarLecturaWearable(rawLectura, paciente = {}, baseline = {}) {
      const lectura = rawLectura instanceof LecturaEntity
        ? rawLectura
        : new LecturaEntity(rawLectura);

      const evaluacion = DetectorService.evaluarLectura(lectura, baseline);

      if (this.repository && typeof this.repository.guardarBiometriaWearable === 'function') {
        await this.repository.guardarBiometriaWearable(lectura, evaluacion);
      }

      let incidenteActivado = null;

      if (evaluacion.requiereAlarmaSimultanea) {
        const hayIncidenteActivo = this.incidenteActivo &&
          this.incidenteActivo.estado === 'ALARMA_SIMULTANEA_ACTIVA';

        if (!hayIncidenteActivo) {
          const ahoraIso = new Date().toISOString();
          incidenteActivado = {
            id: `prev-${Date.now()}`,
            estado: 'ALARMA_SIMULTANEA_ACTIVA',
            iniciadoEnTs: Date.now(),
            iniciadoEnIso: ahoraIso,
            tiempoLimiteSegundos: evaluacion.tiempoLimiteSegundos || 60,
            segundosRestantes: evaluacion.tiempoLimiteSegundos || 60,
            paciente: {
              id: paciente.id || lectura.pacienteId,
              nombre: paciente.nombre || 'Damián Díaz Balseiro',
              codigoPaciente: paciente.codigoPaciente || 'DM-8492',
              cuidadorPrincipal: paciente.cuidadorPrincipal || 'Familiar / Cuidador Principal',
              telefonoCuidador: paciente.telefonoCuidador || '+57 300 456 7890'
            },
            lectura: {
              id: lectura.id,
              ritmoCardiacoBpm: lectura.ritmoCardiacoBpm,
              temperaturaC: lectura.temperaturaC,
              dispositivoTipo: lectura.dispositivoTipo,
              dispositivoNombre: lectura.dispositivoNombre,
              fuente: lectura.fuente,
              ts: lectura.ts
            },
            evaluacion,
            notificadoPacienteEn: ahoraIso,
            notificadoCuidadorSimultaneoEn: ahoraIso,
            confirmadoEn: null,
            escaladoEn: null,
            ubicacionEscalamiento: null,
            motivoCierre: null
          };

          this.incidenteActivo = incidenteActivado;

          if (this.repository && typeof this.repository.guardarAlertaPreventiva === 'function') {
            await this.repository.guardarAlertaPreventiva(incidenteActivado);
          }

          if (this.notificador && typeof this.notificador.dispararAlarmaSimultanea === 'function') {
            await this.notificador.dispararAlarmaSimultanea(incidenteActivado);
          }
        }
      }

      return {
        lectura,
        evaluacion,
        incidenteActivado,
        incidenteActivo: this.incidenteActivo
      };
    }

    async confirmarPacienteEstaBien(incidenteId, nota = 'El paciente confirmó que se encuentra bien.') {
      if (!this.incidenteActivo) return null;
      if (incidenteId && this.incidenteActivo.id !== incidenteId) return null;

      const ahoraTs = Date.now();
      const segundosRespuesta = Math.max(
        1,
        Math.round((ahoraTs - this.incidenteActivo.iniciadoEnTs) / 1000)
      );

      this.incidenteActivo.estado = 'CONFIRMADO_BIEN';
      this.incidenteActivo.confirmadoEn = new Date(ahoraTs).toISOString();
      this.incidenteActivo.segundosRespuesta = segundosRespuesta;
      this.incidenteActivo.motivoCierre = nota;

      const incidenteCerrado = { ...this.incidenteActivo };
      this.incidenteActivo = null;

      if (this.repository && typeof this.repository.actualizarAlertaPreventiva === 'function') {
        await this.repository.actualizarAlertaPreventiva(incidenteCerrado);
      }

      if (this.notificador && typeof this.notificador.notificarConfirmacionPaciente === 'function') {
        await this.notificador.notificarConfirmacionPaciente(incidenteCerrado);
      }

      return incidenteCerrado;
    }

    async escalarAlCuidador(incidenteId, ubicacionGPS = {}, motivo = 'El paciente no respondió a la alerta en 1 minuto.') {
      if (!this.incidenteActivo) return null;
      if (incidenteId && this.incidenteActivo.id !== incidenteId) return null;

      const lat = Number(ubicacionGPS.lat ?? 10.39991);
      const lng = Number(ubicacionGPS.lng ?? -75.47886);
      const zona = ubicacionGPS.zona || 'Barrio Chapacuá, Cartagena de Indias';
      const precision = ubicacionGPS.precision || 10;
      const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

      const ahoraIso = new Date().toISOString();
      this.incidenteActivo.estado = 'ESCALADA_A_CUIDADOR';
      this.incidenteActivo.escaladoEn = ahoraIso;
      this.incidenteActivo.segundosRestantes = 0;
      this.incidenteActivo.motivoCierre = motivo;
      this.incidenteActivo.ubicacionEscalamiento = {
        lat,
        lng,
        zona,
        precision,
        googleMapsUrl
      };

      const paqueteCuidador = {
        incidenteId: this.incidenteActivo.id,
        estado: this.incidenteActivo.estado,
        escaladoEn: ahoraIso,
        motivo,
        paciente: this.incidenteActivo.paciente,
        riesgo: this.incidenteActivo.evaluacion.riesgo,
        titulo: this.incidenteActivo.evaluacion.titulo,
        resumenClinico: this.incidenteActivo.evaluacion.resumenClinico,
        recomendacionInmediata: this.incidenteActivo.evaluacion.recomendacionInmediata,
        sintomasDetectados: [...this.incidenteActivo.evaluacion.sintomasDetectados],
        signosVitales: {
          ritmoCardiacoBpm: this.incidenteActivo.lectura.ritmoCardiacoBpm,
          deltaBpm: this.incidenteActivo.evaluacion.signos.deltaBpm,
          temperaturaC: this.incidenteActivo.lectura.temperaturaC,
          deltaTemp: this.incidenteActivo.evaluacion.signos.deltaTemp,
          dispositivoNombre: this.incidenteActivo.lectura.dispositivoNombre,
          dispositivoTipo: this.incidenteActivo.lectura.dispositivoTipo
        },
        ubicacion: this.incidenteActivo.ubicacionEscalamiento
      };

      const incidenteEscalado = { ...this.incidenteActivo };
      this.incidenteActivo = null;

      if (this.repository && typeof this.repository.actualizarAlertaPreventiva === 'function') {
        await this.repository.actualizarAlertaPreventiva(incidenteEscalado);
      }

      if (this.notificador && typeof this.notificador.escalarACuidadorConUbicacionYSintomas === 'function') {
        await this.notificador.escalarACuidadorConUbicacionYSintomas(paqueteCuidador, incidenteEscalado);
      }

      return paqueteCuidador;
    }

    obtenerIncidenteActivo() {
      return this.incidenteActivo;
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MonitorearBiometriaPreventivaUseCase };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.MonitorearBiometriaPreventivaUseCase = MonitorearBiometriaPreventivaUseCase;
})(typeof window !== 'undefined' ? window : globalThis);
