// Funciones para leer la sesion del usuario desde un solo lugar.
// Antes cada archivo leia el localStorage a su manera y por eso salian datos mezclados.
(function () {
  'use strict';

  // La app Android abre esta misma web dentro de un WebView y agrega "DiaMonApp" al user agent.
  // Con eso se esconden cosas que solo sirven en el navegador (login con Google, descargar el APK).
  const ES_APP = /DiaMonApp/.test(navigator.userAgent);
  if (ES_APP) {
    document.documentElement.classList.add('dm-en-app');
    const estilo = document.createElement('style');
    estilo.textContent = 'html.dm-en-app .dm-solo-web { display: none !important; }';
    document.head.appendChild(estilo);
    // Estilos de la version movil (una columna, menos informacion en el inicio)
    const cssApp = document.createElement('link');
    cssApp.rel = 'stylesheet';
    cssApp.href = '../assets/css/app-movil.css';
    document.head.appendChild(cssApp);
  }

  // Dentro de la app las paginas se abren como archivos (file://), asi que las llamadas
  // al servidor (/api/...) se mandan a la pagina publicada en Vercel.
  const SERVIDOR_PUBLICADO = 'https://diamon-gps-salud.vercel.app';
  function urlApi(ruta) {
    return window.location.protocol === 'file:' ? SERVIDOR_PUBLICADO + ruta : ruta;
  }

  // Lee el usuario guardado al iniciar sesion (o null si es invitado)
  function leerUsuario() {
    try {
      const raw = sessionStorage.getItem('diamon_demo_user') || localStorage.getItem('diamon_current_user');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  // El rol 'monitoreado' de Supabase es lo mismo que 'usuario' (paciente) en la web
  function rolDe(usuario) {
    if (!usuario) return 'invitado';
    if (usuario.rol === 'monitoreado') return 'usuario';
    return usuario.rol || 'usuario';
  }

  // Devuelve el paciente que se debe mostrar en el dashboard segun el rol:
  // - paciente: el mismo
  // - cuidador: el paciente que vinculo con el codigo
  // - admin: solo si vinculo uno a proposito (un admin no es paciente)
  // - invitado: nadie
  function pacienteActivo(usuario) {
    const rol = rolDe(usuario);
    if (rol === 'invitado') return null;

    const vinculado = usuario.pacienteVinculado || null;

    if (rol === 'usuario') {
      return vinculado || { nombre: usuario.nombre, codigoPaciente: usuario.codigoPaciente };
    }

    if (!vinculado || !vinculado.codigoPaciente) return null;

    // Cuentas de admin viejas quedaron vinculadas consigo mismas, eso no cuenta
    if (rol === 'admin' && vinculado.nombre === usuario.nombre && !vinculado.email) return null;

    return vinculado;
  }

  // Borra todo lo de la sesion para que no quede nada del usuario anterior
  function limpiarSesion() {
    sessionStorage.removeItem('diamon_demo_user');
    localStorage.removeItem('diamon_current_user');
    localStorage.removeItem('diamon_abrir_abuelo');
    // En la app Android se apaga el envio de ubicacion en segundo plano
    if (window.DiaMonNativo && typeof window.DiaMonNativo.detenerUbicacion === 'function') {
      window.DiaMonNativo.detenerUbicacion();
    }
  }

  // Pregunta al servidor si el codigo de administrador es correcto
  async function validarCodigoAdmin(codigo) {
    try {
      const resp = await fetch(urlApi('/api/validar-admin'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo })
      });
      const data = await resp.json();
      return data.valido === true;
    } catch (_) {
      return false;
    }
  }

  // Convierte la contraseña en un hash SHA-256 (con el correo como sal) para no guardarla tal cual.
  // Antes se usaba btoa, que no protege nada porque se puede revertir.
  async function hashClave(email, clave) {
    const datos = new TextEncoder().encode(String(email).toLowerCase() + ':' + clave);
    const hash = await crypto.subtle.digest('SHA-256', datos);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Arma la sesion con los datos de Supabase (perfil, rol y pacientes vinculados).
  // Lo que se guarda en el navegador es solo una copia para pintar rapido la pagina;
  // la informacion real siempre sale de la base de datos.
  async function iniciarDesdeSupabase() {
    const sb = window.supabaseClient;
    if (!sb) return null;

    const { data } = await sb.auth.getSession();
    const sesion = data && data.session;
    if (!sesion) {
      limpiarSesion();
      return null;
    }

    const { data: perfil, error } = await sb
      .from('profiles')
      .select('id, nombre, rol, codigo_paciente')
      .eq('id', sesion.user.id)
      .single();
    if (error || !perfil) {
      limpiarSesion();
      return null;
    }

    const rol = (perfil.rol === 'monitoreado' || perfil.rol === 'usuario') ? 'usuario' : perfil.rol;
    let pacientes = [];

    if (rol === 'cuidador' || rol === 'admin') {
      // El cuidador escribio el codigo del paciente al registrarse: se vincula en su primer ingreso
      const pendiente = sesion.user.user_metadata && sesion.user.user_metadata.codigo_vincular;
      if (pendiente) {
        await sb.rpc('vincular_con_codigo', { p_codigo: pendiente });
        await sb.auth.updateUser({ data: { codigo_vincular: null } });
      }
      const { data: lista } = await sb.rpc('mis_pacientes');
      pacientes = (lista || []).map(p => ({ id: p.id, nombre: p.nombre, codigoPaciente: p.codigo_paciente }));
    }

    // Si ya estaba mirando a un paciente se queda en ese; si no, el primero de la lista
    const anterior = leerUsuario();
    const codigoAnterior = anterior && anterior.pacienteVinculado && anterior.pacienteVinculado.codigoPaciente;
    const elegido = pacientes.find(p => p.codigoPaciente === codigoAnterior) || pacientes[0] || null;

    const usuario = {
      id: perfil.id,
      email: sesion.user.email,
      nombre: perfil.nombre,
      rol,
      codigoPaciente: rol === 'usuario' ? perfil.codigo_paciente : (elegido ? elegido.codigoPaciente : null),
      pacienteVinculado: rol === 'usuario'
        ? { id: perfil.id, nombre: perfil.nombre, email: sesion.user.email, codigoPaciente: perfil.codigo_paciente }
        : elegido,
      pacientesVinculados: pacientes
    };
    sessionStorage.removeItem('diamon_demo_user');
    localStorage.setItem('diamon_current_user', JSON.stringify(usuario));
    return usuario;
  }

  // Cambia el paciente que se esta mirando (cuidador o admin con varios pacientes)
  function elegirPaciente(codigo) {
    const usuario = leerUsuario();
    if (!usuario || !Array.isArray(usuario.pacientesVinculados)) return false;
    const pac = usuario.pacientesVinculados.find(p => p.codigoPaciente === codigo);
    if (!pac) return false;
    usuario.pacienteVinculado = pac;
    usuario.codigoPaciente = pac.codigoPaciente;
    localStorage.setItem('diamon_current_user', JSON.stringify(usuario));
    return true;
  }

  window.DiaMonSesion = { leerUsuario, rolDe, pacienteActivo, limpiarSesion, validarCodigoAdmin, hashClave, urlApi,
    iniciarDesdeSupabase, elegirPaciente, esApp: ES_APP };
})();
