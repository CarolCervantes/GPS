// Entrada de Vercel para POST /api/diabot.
// La logica esta en src/ (arquitectura hexagonal): caso de uso ConsultarDiaBotUseCase.
const { crearContenedor } = require('../src/infrastructure/container');

module.exports = (req, res) => crearContenedor().diabotHttp(req, res);
