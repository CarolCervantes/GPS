// Adaptador de salida: el codigo de administrador se lee de la variable de entorno DIAMON_ADMIN_CODE.
const crypto = require('crypto');
const { CodigoAdminPort } = require('../../../../domain/ports/CodigoAdminPort');

class CodigoAdminEnvAdapter extends CodigoAdminPort {
  constructor(codigo) {
    super();
    this.codigo = String(codigo || '').toUpperCase();
  }

  coincide(recibido) {
    const a = Buffer.from(String(recibido));
    const b = Buffer.from(this.codigo);
    // timingSafeEqual compara sin dar pistas por el tiempo de respuesta
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}

module.exports = { CodigoAdminEnvAdapter };
