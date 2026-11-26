// Caso de uso: responder una pregunta del paciente o del cuidador con DiaBot.
// Prueba los proveedores de IA en orden; si ninguno responde, la web usa su motor local.
const { ConsultaAsistente } = require('../../domain/entities/ConsultaAsistente');
const { PROMPT_BASE, armarContexto } = require('../../domain/services/PromptClinicoService');

class ConsultarDiaBotUseCase {
  // asistentes: lista de adaptadores que cumplen AsistenteIAPort
  constructor(asistentes = []) {
    this.asistentes = asistentes;
  }

  async ejecutar({ mensaje, contexto }) {
    const consulta = new ConsultaAsistente({ mensaje, contexto });
    if (!consulta.esValida()) {
      return { error: 'Mensaje vacío.' };
    }

    const instrucciones = PROMPT_BASE + '\n\n' + armarContexto(consulta.contexto);
    for (const asistente of this.asistentes) {
      if (!asistente.disponible()) continue;
      try {
        const texto = await asistente.responder(instrucciones, consulta.mensaje);
        if (texto) return { reply: texto, engine: asistente.nombre, usedLiveContext: true };
      } catch (_) {
        // si un proveedor falla se prueba el siguiente
      }
    }
    return { reply: null, engine: 'clinical-context-engine', usedLiveContext: true };
  }
}

module.exports = { ConsultarDiaBotUseCase };
