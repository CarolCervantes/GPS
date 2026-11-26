// Caso de uso: revisar si el codigo de administrador que escribio alguien es el correcto.
class ValidarCodigoAdminUseCase {
  // codigoAdmin: adaptador que cumple CodigoAdminPort
  constructor(codigoAdmin) {
    this.codigoAdmin = codigoAdmin;
  }

  ejecutar(codigo) {
    const limpio = String(codigo || '').trim().toUpperCase();
    return { valido: limpio.length > 0 && this.codigoAdmin.coincide(limpio) };
  }
}

module.exports = { ValidarCodigoAdminUseCase };
