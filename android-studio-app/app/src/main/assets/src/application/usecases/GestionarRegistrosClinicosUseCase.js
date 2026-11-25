// Aplicación: Caso de Uso CRUD de Registros Clínicos + Evaluación Automática y Alertas
// Arquitectura Hexagonal - Capa de Aplicación

(function (root) {
  'use strict';

  const RegistroEntity = (typeof module !== 'undefined' && module.exports)
    ? require('../../domain/entities/RegistroClinicoEntity').RegistroClinicoEntity
    : root.DiaMonHexagonal?.RegistroClinicoEntity;

  const AlertaEntity = (typeof module !== 'undefined' && module.exports)
    ? require('../../domain/entities/AlertaEmergenciaEntity').AlertaEmergenciaEntity
    : root.DiaMonHexagonal?.AlertaEmergenciaEntity;

  const EvaluadorClinico = (typeof module !== 'undefined' && module.exports)
    ? require('../../domain/services/EvaluadorClinicoDomainService').EvaluadorClinicoDomainService
    : root.DiaMonHexagonal?.EvaluadorClinicoDomainService;

  class GestionarRegistrosClinicosUseCase {
    constructor({ registroRepository, alertaRepository = null, notificador = null } = {}) {
      if (!registroRepository) {
        throw new Error('GestionarRegistrosClinicosUseCase requiere registroRepository.');
      }
      this.registroRepository = registroRepository;
      this.alertaRepository = alertaRepository;
      this.notificador = notificador;
    }

    async registrar(rawData = {}, metas = {}) {
      const registro = rawData instanceof RegistroEntity
        ? rawData
        : new RegistroEntity(rawData);

      let alertaGenerada = null;

      // Evaluación clínica automática en el Dominio
      if (registro.tipo === 'glucosa' && EvaluadorClinico) {
        registro.evaluacion = EvaluadorClinico.evaluarGlucosa(registro.glucosaMgDl, {
          glucosaMin: metas.glucosaMin || 80,
          glucosaMaxPost: metas.glucosaMaxPost || 180
        });

        if (!registro.evaluacion.enRango && AlertaEntity) {
          const esHipo = registro.evaluacion.estado === 'hipoglucemia';
          alertaGenerada = new AlertaEntity({
            codigoPaciente: registro.codigoPaciente,
            pacienteNombre: registro.pacienteNombre,
            tipo: esHipo ? 'hipoglucemia' : 'hiperglucemia',
            severidad: esHipo ? 'critica' : 'alta',
            titulo: esHipo
              ? `Hipoglucemia detectada (${registro.glucosaMgDl} mg/dL)`
              : `Hiperglucemia registrada (${registro.glucosaMgDl} mg/dL)`,
            mensaje: esHipo
              ? `Glucosa baja (${registro.glucosaMgDl} mg/dL). Aplicar Regla 15-15 y avisar al cuidador.`
              : `Glucosa sobre meta clínica (${registro.glucosaMgDl} mg/dL). Verificar hidratación y esquema médico.`,
            signosVitales: { glucosaMgDl: registro.glucosaMgDl, contexto: registro.contexto },
            ubicacion: registro.coordenadas,
            origen: registro.origen
          });
        }
      } else if (registro.tipo === 'presion' && EvaluadorClinico) {
        registro.evaluacion = EvaluadorClinico.evaluarPresion(registro.sistolica, registro.diastolica, {
          sistolicaMax: metas.sistolicaMax || 140,
          diastolicaMax: metas.diastolicaMax || 90
        });

        if (registro.evaluacion.estado === 'crisis_hipertensiva' && AlertaEntity) {
          alertaGenerada = new AlertaEntity({
            codigoPaciente: registro.codigoPaciente,
            pacienteNombre: registro.pacienteNombre,
            tipo: 'crisis_hipertensiva',
            severidad: 'critica',
            titulo: `Crisis hipertensiva (${registro.sistolica}/${registro.diastolica} mmHg)`,
            mensaje: 'Presión arterial en rango crítico. Reposo inmediato y contacto con cuidador o emergencias 123.',
            signosVitales: {
              sistolica: registro.sistolica,
              diastolica: registro.diastolica,
              pulsoBpm: registro.pulsoBpm
            },
            ubicacion: registro.coordenadas,
            origen: registro.origen
          });
        }
      } else if (registro.tipo === 'gps' && registro.coordenadas && EvaluadorClinico) {
        const geocerca = metas.geocerca || { lat: 10.39991, lng: -75.47886, radioMetros: 400 };
        registro.evaluacion = EvaluadorClinico.verificarGeocerca(
          registro.coordenadas.lat,
          registro.coordenadas.lng,
          geocerca.lat,
          geocerca.lng,
          geocerca.radioMetros
        );

        if (!registro.evaluacion.dentro && AlertaEntity) {
          alertaGenerada = new AlertaEntity({
            codigoPaciente: registro.codigoPaciente,
            pacienteNombre: registro.pacienteNombre,
            tipo: 'geocerca',
            severidad: 'alta',
            titulo: `Salida de geocerca segura (${registro.evaluacion.distanciaMetros} m)`,
            mensaje: `El paciente se encuentra a ${registro.evaluacion.distanciaMetros} m del centro seguro (radio permitido: ${registro.evaluacion.radioPermitido} m).`,
            ubicacion: registro.coordenadas,
            origen: registro.origen
          });
        }
      }

      const guardado = await this.registroRepository.crear(registro);

      if (alertaGenerada) {
        if (this.alertaRepository && typeof this.alertaRepository.crear === 'function') {
          await this.alertaRepository.crear(alertaGenerada);
        }
        if (this.notificador && typeof this.notificador.notificarAlerta === 'function') {
          await this.notificador.notificarAlerta(alertaGenerada);
        }
      }

      return {
        registro: guardado,
        evaluacion: registro.evaluacion,
        alertaGenerada
      };
    }

    async listar(codigoPaciente = 'DM-8492', filtro = {}) {
      return this.registroRepository.listarPorPaciente(codigoPaciente, filtro);
    }

    async obtenerPorId(id) {
      if (!id) throw new Error('Debe indicar el ID del registro.');
      return this.registroRepository.obtenerPorId(id);
    }

    async actualizar(id, cambios = {}) {
      if (!id) throw new Error('Debe indicar el ID del registro a actualizar.');
      const existente = await this.registroRepository.obtenerPorId(id);
      if (!existente) {
        throw new Error(`No existe un registro clínico con ID ${id}.`);
      }

      const combinado = new RegistroEntity({
        ...existente,
        ...cambios,
        id: existente.id,
        creadoEn: existente.creadoEn,
        actualizadoEn: new Date().toISOString()
      });

      if (combinado.tipo === 'glucosa' && EvaluadorClinico) {
        combinado.evaluacion = EvaluadorClinico.evaluarGlucosa(combinado.glucosaMgDl);
      } else if (combinado.tipo === 'presion' && EvaluadorClinico) {
        combinado.evaluacion = EvaluadorClinico.evaluarPresion(combinado.sistolica, combinado.diastolica);
      }

      return this.registroRepository.actualizar(id, combinado);
    }

    async eliminar(id) {
      if (!id) throw new Error('Debe indicar el ID del registro a eliminar.');
      const eliminado = await this.registroRepository.eliminar(id);
      if (!eliminado) {
        throw new Error(`No existe un registro clínico con ID ${id}.`);
      }
      return { eliminado: true, id };
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GestionarRegistrosClinicosUseCase };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.GestionarRegistrosClinicosUseCase = GestionarRegistrosClinicosUseCase;
})(typeof window !== 'undefined' ? window : globalThis);
