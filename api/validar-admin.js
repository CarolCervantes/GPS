// Entrada de Vercel para POST /api/validar-admin.
// La logica esta en src/ (arquitectura hexagonal): caso de uso ValidarCodigoAdminUseCase.
const { crearContenedor } = require('../src/infrastructure/container');

module.exports = (req, res) => crearContenedor().validarAdminHttp(req, res);
