// Contenedor: aqui se conectan los casos de uso con sus adaptadores.
// Es el unico lugar que sabe que se usa Claude, Gemini o variables de entorno.
const { ConsultarDiaBotUseCase } = require('../application/usecases/ConsultarDiaBotUseCase');
const { ValidarCodigoAdminUseCase } = require('../application/usecases/ValidarCodigoAdminUseCase');
const { ClaudeAsistenteAdapter } = require('./adapters/out/ia/ClaudeAsistenteAdapter');
const { GeminiAsistenteAdapter } = require('./adapters/out/ia/GeminiAsistenteAdapter');
const { CodigoAdminEnvAdapter } = require('./adapters/out/config/CodigoAdminEnvAdapter');
const { crearDiaBotController } = require('./adapters/in/http/DiaBotController');
const { crearValidarAdminController } = require('./adapters/in/http/ValidarAdminController');

// Se arma cada vez que se pide, asi toma las claves aunque se carguen despues (archivo .env)
function crearContenedor(env = process.env) {
  const consultarDiaBot = new ConsultarDiaBotUseCase([
    new ClaudeAsistenteAdapter(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL),
    new GeminiAsistenteAdapter(env.GEMINI_API_KEY, env.GEMINI_MODEL)
  ]);
  // Si no se configuro la variable se usa el codigo del proyecto (solo para pruebas en local)
  const validarCodigoAdmin = new ValidarCodigoAdminUseCase(
    new CodigoAdminEnvAdapter(env.DIAMON_ADMIN_CODE || 'DIAMON-ADMIN-2026')
  );

  return {
    consultarDiaBot,
    validarCodigoAdmin,
    diabotHttp: crearDiaBotController(consultarDiaBot),
    validarAdminHttp: crearValidarAdminController(validarCodigoAdmin)
  };
}

module.exports = { crearContenedor };
