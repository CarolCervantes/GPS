// Dominio: Detector Preventivo de Descompensación Glucémica por Biomarcadores (Sin Parche)
// Analiza alteraciones de ritmo cardíaco (BPM) y cambios de temperatura corporal (°C)
// provenientes de un reloj inteligente, anillo o banda para prevenir accidentes graves.
// Arquitectura Hexagonal - Capa de Dominio (Sin dependencias externas)

(function (root) {
  'use strict';

  const BASELINE_PREVENTIVA_DEFAULT = {
    bpmReposo: 72,
    bpmAlertaAlta: 100,
    bpmCriticaAlta: 115,
    bpmAlertaBaja: 52,
    deltaBpmSubito: 22,
    tempBaseC: 36.5,
    tempBajaC: 35.8,
    tempCriticaBajaC: 35.4,
    tempAltaC: 37.7,
    tempCriticaAltaC: 38.2,
    deltaTempBajaC: -0.6,
    deltaTempAltaC: 0.8,
    tiempoRespuestaSegundos: 60
  };

  class DetectorGlucemicoPreventivoService {
    static obtenerBaselineDefault() {
      return { ...BASELINE_PREVENTIVA_DEFAULT };
    }

    static evaluarLectura(lectura, baselinePersonal = {}) {
      const base = { ...BASELINE_PREVENTIVA_DEFAULT, ...(baselinePersonal || {}) };
      const bpm = Number(lectura.ritmoCardiacoBpm);
      const hasTemp = lectura.temperaturaC !== null &&
        lectura.temperaturaC !== undefined &&
        lectura.temperaturaC !== '' &&
        !isNaN(Number(lectura.temperaturaC));
      const temp = hasTemp ? Number(Number(lectura.temperaturaC).toFixed(1)) : null;

      const deltaBpm = Math.round(bpm - base.bpmReposo);
      const deltaTemp = hasTemp ? Number((temp - base.tempBaseC).toFixed(2)) : null;

      // 1. Detección de alteraciones individuales
      const taquicardia = bpm >= base.bpmAlertaAlta || deltaBpm >= base.deltaBpmSubito;
      const taquicardiaSevera = bpm >= base.bpmCriticaAlta || deltaBpm >= (base.deltaBpmSubito + 13);
      const bradicardia = bpm <= base.bpmAlertaBaja;

      const descensoTermico = hasTemp && (temp <= base.tempBajaC || deltaTemp <= base.deltaTempBajaC);
      const descensoTermicoCritico = hasTemp && temp <= base.tempCriticaBajaC;
      const elevacionTermica = hasTemp && (temp >= base.tempAltaC || deltaTemp >= base.deltaTempAltaC);
      const elevacionTermicaCritica = hasTemp && temp >= base.tempCriticaAltaC;

      const sintomasDetectados = [];

      if (taquicardiaSevera) {
        sintomasDetectados.push(`Taquicardia marcada: ${bpm} BPM (${deltaBpm >= 0 ? '+' : ''}${deltaBpm} BPM sobre reposo)`);
      } else if (taquicardia) {
        sintomasDetectados.push(`Ritmo cardíaco acelerado: ${bpm} BPM (${deltaBpm >= 0 ? '+' : ''}${deltaBpm} BPM sobre reposo)`);
      } else if (bradicardia) {
        sintomasDetectados.push(`Ritmo cardíaco bajo (bradicardia): ${bpm} BPM (${deltaBpm} BPM respecto a reposo)`);
      }

      if (descensoTermicoCritico) {
        sintomasDetectados.push(`Descenso térmico periférico pronunciado: ${temp.toFixed(1)} °C (${deltaTemp.toFixed(1)} °C · posible sudoración fría)`);
      } else if (descensoTermico) {
        sintomasDetectados.push(`Bajada de temperatura corporal: ${temp.toFixed(1)} °C (${deltaTemp.toFixed(1)} °C · signo de sudoración fría)`);
      } else if (elevacionTermicaCritica) {
        sintomasDetectados.push(`Temperatura corporal muy elevada: ${temp.toFixed(1)} °C (+${deltaTemp.toFixed(1)} °C · estrés metabólico/fiebre)`);
      } else if (elevacionTermica) {
        sintomasDetectados.push(`Aumento de temperatura corporal: ${temp.toFixed(1)} °C (+${deltaTemp.toFixed(1)} °C sobre línea base)`);
      }

      // 2. Correlación clínica preventiva (sin parche CGM)
      let riesgo = 'estable';
      let severidad = 'normal';
      let requiereAlarmaSimultanea = false;
      let titulo = 'Signos Biométricos Estables';
      let etiquetaCorta = 'Estable';
      let resumenClinico = 'Ritmo cardíaco y temperatura dentro de la línea base habitual del paciente.';
      let recomendacionInmediata = 'Continuar monitoreo preventivo normal desde el dispositivo wearable.';

      if ((taquicardia || bradicardia) && descensoTermico) {
        riesgo = 'posible_hipoglucemia';
        severidad = 'critica';
        requiereAlarmaSimultanea = true;
        titulo = 'Posible Bajada de Azúcar (Hipoglucemia)';
        etiquetaCorta = 'Posible Hipoglucemia';
        resumenClinico = 'Alteración del ritmo cardíaco combinada con descenso de temperatura corporal (compatible con respuesta adrenérgica y sudoración fría).';
        recomendacionInmediata = 'Confirmar de inmediato si el paciente está bien. Si está consciente y presenta mareo o temblor, aplicar Regla 15-15 (15g de azúcar rápida) y comprobar con glucómetro.';
      } else if (taquicardia && elevacionTermica) {
        riesgo = 'posible_hiperglucemia';
        severidad = 'critica';
        requiereAlarmaSimultanea = true;
        titulo = 'Posible Subida de Azúcar (Hiperglucemia)';
        etiquetaCorta = 'Posible Hiperglucemia';
        resumenClinico = 'Ritmo cardíaco acelerado acompañado de aumento de temperatura corporal (compatible con descompensación hiperglucémica, deshidratación o estrés metabólico).';
        recomendacionInmediata = 'Confirmar bienestar del paciente, verificar hidratación con agua pura, revisar esquema de insulina/medicación y medir con glucómetro capilar.';
      } else if (taquicardiaSevera || bradicardia || descensoTermicoCritico || elevacionTermicaCritica) {
        riesgo = 'anomalia_biometrica_critica';
        severidad = 'alta';
        requiereAlarmaSimultanea = true;
        titulo = hasTemp
          ? 'Alteración Biométrica Súbita (Posible Descompensación)'
          : 'Alteración Cardíaca Súbita (Sensor Solo Pulso)';
        etiquetaCorta = 'Riesgo Preventivo';
        resumenClinico = hasTemp
          ? 'Uno de los biomarcadores superó el umbral preventivo crítico. Se activa verificación preventiva para evitar un accidente mayor.'
          : 'Tu wearable solo reporta ritmo cardíaco y detectó un cambio brusco fuera de tu rango seguro. Se activa alerta preventiva de seguridad.';
        recomendacionInmediata = 'Responder la alerta en los próximos 60 segundos para confirmar que se encuentra bien; de lo contrario, el cuidador recibirá ubicación GPS y síntomas.';
      } else if (taquicardia || descensoTermico || elevacionTermica) {
        riesgo = 'vigilancia';
        severidad = 'preventiva';
        requiereAlarmaSimultanea = false;
        titulo = 'Variación Biométrica en Vigilancia';
        etiquetaCorta = 'En Vigilancia';
        resumenClinico = 'Variación moderada en un solo sensor. Se mantiene observación cercana por si aparece un segundo síntoma.';
        recomendacionInmediata = 'Mantener reposo unos minutos, hidratarse y vigilar síntomas como sudoración, mareo, sed intensa o temblor.';
      }

      return {
        riesgo,
        severidad,
        requiereAlarmaSimultanea,
        titulo,
        etiquetaCorta,
        resumenClinico,
        recomendacionInmediata,
        sintomasDetectados,
        signos: {
          ritmoCardiacoBpm: bpm,
          deltaBpm,
          temperaturaC: temp,
          deltaTemp,
          tieneSensorTemperatura: hasTemp
        },
        tiempoLimiteSegundos: Number(base.tiempoRespuestaSegundos) || 60,
        esEstimacionPreventiva: true,
        notaClinica: 'Detección preventiva basada en síntomas fisiológicos (ritmo cardíaco y temperatura). No mide la glucosa directamente ni sustituye el glucómetro.'
      };
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DetectorGlucemicoPreventivoService, BASELINE_PREVENTIVA_DEFAULT };
  }
  root.DiaMonHexagonal = root.DiaMonHexagonal || {};
  root.DiaMonHexagonal.DetectorGlucemicoPreventivoService = DetectorGlucemicoPreventivoService;
})(typeof window !== 'undefined' ? window : globalThis);
