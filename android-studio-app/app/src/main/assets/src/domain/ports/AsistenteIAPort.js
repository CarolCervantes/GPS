// Puerto de salida: lo que el sistema necesita de un proveedor de IA.
// Cada adaptador (Claude, Gemini) implementa estos metodos.
class AsistenteIAPort {
  // true si el adaptador tiene su clave configurada
  disponible() {
    throw new Error('Falta implementar disponible()');
  }

  // Devuelve el texto de la respuesta, o null si no pudo responder
  async responder(instrucciones, mensaje) {
    throw new Error('Falta implementar responder()');
  }
}

module.exports = { AsistenteIAPort };
