// Puerto de salida: de donde sale el codigo de administrador para compararlo.
class CodigoAdminPort {
  // true si el codigo recibido es el correcto
  coincide(codigo) {
    throw new Error('Falta implementar coincide()');
  }
}

module.exports = { CodigoAdminPort };
