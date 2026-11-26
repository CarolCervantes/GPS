// Entidad: una pregunta que se le hace a DiaBot.
// Valida el mensaje antes de que llegue a cualquier proveedor de IA.
class ConsultaAsistente {
  constructor({ mensaje, contexto } = {}) {
    this.mensaje = String(mensaje || '').trim().slice(0, 600);
    this.contexto = contexto && typeof contexto === 'object' ? contexto : {};
  }

  esValida() {
    return this.mensaje.length > 0;
  }
}

module.exports = { ConsultaAsistente };
