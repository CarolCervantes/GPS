// ============ perfil de usuario ============

document.addEventListener('dashboardListo', async (e) => {
  const user = e.detail?.user;
  if (!user) return;

  await cargarPerfil(user);
  wireGuardarNombre(user.id);
  wireCambiarClave();
  wireCerrarSesion();
  await initVinculacionCuidador(user.id);
});

// ============ cargar datos ============

// Los ids de Supabase son UUID. Las cuentas creadas solo en el navegador tienen otro formato.
function esIdSupabase(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');
}

// Datos de la sesion guardada al iniciar sesion (sirve cuando la cuenta no es de Supabase)
function leerSesionLocal() {
  try {
    return JSON.parse(sessionStorage.getItem('diamon_demo_user') || localStorage.getItem('diamon_current_user') || 'null');
  } catch (_) {
    return null;
  }
}

async function cargarPerfil(user) {
  let profile = null;
  if (esIdSupabase(user.id)) {
    const { data } = await supabaseClient
      .from('profiles')
      .select('nombre, rol, created_at')
      .eq('id', user.id)
      .single();
    profile = data;
  }
  const local = leerSesionLocal() || {};

  const nombre = profile?.nombre || local.nombre || user.email;
  const rol    = profile?.rol || local.rol || 'usuario';
  const creado = profile?.created_at || local.creado_en || local.created_at;
  const fecha  = creado
    ? new Date(creado).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';
  const idCorto = String(user.id || '').slice(0, 8) + '…';

  // Avatar con inicial
  const avatarEl = document.getElementById('perfilAvatar');
  if (avatarEl) {
    avatarEl.innerHTML = nombre ? `<span>${nombre.charAt(0).toUpperCase()}</span>` : '<i class="fas fa-user"></i>';
    if (rol === 'admin') avatarEl.classList.add('is-admin');
  }

  set('perfilAvatarName', nombre);
  set('perfilAvatarEmail', user.email);
  set('perfilFecha', fecha);
  set('perfilId', idCorto);

  // Input nombre
  const inputNombre = document.getElementById('inputNombre');
  if (inputNombre) inputNombre.value = nombre || '';

  // Input correo
  const inputCorreo = document.getElementById('inputCorreo');
  if (inputCorreo) inputCorreo.value = user.email;

  // Tarjeta de rol
  aplicarRolUI(rol);
}

function aplicarRolUI(rol) {
  const card    = document.getElementById('perfilRolCard');
  const icon    = document.getElementById('perfilRolIcon');
  const value   = document.getElementById('perfilRolValue');
  const desc    = document.getElementById('perfilRolDesc');

  const config = {
    admin: {
      iconClass: 'fas fa-user-shield',
      label: 'Administrador',
      descripcion: 'Tienes acceso completo: puedes gestionar usuarios, vincular cuidadores con personas monitoreadas, configurar zonas seguras y supervisar toda la plataforma.',
      cardClass: 'rol-admin',
    },
    cuidador: {
      iconClass: 'fas fa-user-friends',
      label: 'Cuidador / Familiar',
      descripcion: 'Puedes ver en tiempo real la ubicación de tu persona monitoreada, configurar zonas seguras y recibir alertas cuando salga de ellas.',
      cardClass: 'rol-cuidador',
    },
    monitoreado: {
      iconClass: 'fas fa-map-marker-alt',
      label: 'Persona monitoreada',
      descripcion: 'Tu ubicación es compartida con tu cuidador asignado. Puedes generar una alerta de emergencia manual desde el dashboard.',
      cardClass: 'rol-monitoreado',
    },
    usuario: {
      iconClass: 'fas fa-user',
      label: 'Usuario',
      descripcion: 'Puedes consultar tu ubicación en tiempo real, ver tu historial de rutas y revisar tus registros de salud.',
      cardClass: 'rol-usuario',
    },
  }[rol] || {
    iconClass: 'fas fa-user',
    label: rol,
    descripcion: '',
    cardClass: '',
  };

  if (card)  { card.className = 'perfil-rol-card ' + config.cardClass; }
  if (icon)  { icon.innerHTML = `<i class="${config.iconClass}"></i>`; }
  if (value) { value.textContent = config.label; }
  if (desc)  { desc.textContent = config.descripcion; }
}

// ============ guardar nombre ============

function wireGuardarNombre(userId) {
  const btn = document.getElementById('btnGuardarNombre');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const input = document.getElementById('inputNombre');
    const nombre = input?.value?.trim();

    if (!nombre || nombre.length < 2) {
      mostrarMensaje('perfilMensaje', 'El nombre debe tener al menos 2 caracteres.', 'error');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando…';

    let error = null;
    if (esIdSupabase(userId)) {
      ({ error } = await supabaseClient
        .from('profiles')
        .update({ nombre, updated_at: new Date().toISOString() })
        .eq('id', userId));
    }
    // Tambien se guarda en la sesion y en la cuenta del navegador
    if (!error) guardarNombreLocal(nombre);

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check"></i> Guardar';

    if (error) {
      mostrarMensaje('perfilMensaje', 'Error al guardar: ' + error.message, 'error');
      return;
    }

    // Actualizar navbar en tiempo real
    const headerName = document.getElementById('headerUserName');
    const dropdownName = document.getElementById('dropdownName');
    const avatarName = document.getElementById('perfilAvatarName');
    const avatarEl = document.getElementById('perfilAvatar');

    if (headerName) headerName.textContent = nombre;
    if (dropdownName) {
      // Conservar el badge de admin si existe
      const badge = dropdownName.querySelector('.role-badge');
      dropdownName.textContent = nombre;
      if (badge) dropdownName.appendChild(badge);
    }
    if (avatarName) avatarName.textContent = nombre;
    if (avatarEl) avatarEl.innerHTML = `<span>${nombre.charAt(0).toUpperCase()}</span>`;

    mostrarMensaje('perfilMensaje', 'Nombre actualizado correctamente.', 'exito');
  });
}

function guardarNombreLocal(nombre) {
  const local = leerSesionLocal();
  if (!local) return;
  local.nombre = nombre;
  sessionStorage.setItem('diamon_demo_user', JSON.stringify(local));
  localStorage.setItem('diamon_current_user', JSON.stringify(local));
}

// ============ cambiar contraseña ============

function wireCambiarClave() {
  const btn = document.getElementById('btnCambiarClave');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const input = document.getElementById('inputNuevaClave');
    const clave = input?.value;

    if (!clave || clave.length < 6) {
      mostrarMensaje('perfilClaveMsg', 'La contraseña debe tener al menos 6 caracteres.', 'error');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cambiando…';

    const { data: ses } = await supabaseClient.auth.getSession();
    if (!ses || !ses.session) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-lock"></i> Cambiar';
      mostrarMensaje('perfilClaveMsg', 'Tu cuenta no es de Supabase (entraste con Google o se creó solo en este navegador). La contraseña la maneja ese proveedor.', 'error');
      return;
    }
    const { error } = await supabaseClient.auth.updateUser({ password: clave });

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-lock"></i> Cambiar';

    if (error) {
      mostrarMensaje('perfilClaveMsg', 'Error: ' + error.message, 'error');
      return;
    }

    input.value = '';
    mostrarMensaje('perfilClaveMsg', 'Contraseña cambiada correctamente.', 'exito');
  });
}

// ============ cerrar sesión ============

function wireCerrarSesion() {
  const btn = document.getElementById('btnCerrarSesion');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    sessionStorage.removeItem('diamon_demo_user');
    localStorage.removeItem('diamon_current_user');
    try { await supabaseClient.auth.signOut(); } catch (_) {}
    // window.top para salir del panel completo si el perfil esta dentro del dashboard
    window.top.location.href = 'login.html';
  });
}

// ============ utils ============

function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}

function mostrarMensaje(id, texto, tipo) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = texto;
  el.className = 'perfil-mensaje ' + tipo;
  setTimeout(() => { el.textContent = ''; el.className = 'perfil-mensaje'; }, 4000);
}

// ============ vinculación cuidador <-> monitoreado ============

async function initVinculacionCuidador(userId) {
  const seccion = document.getElementById('seccionVinculacion');
  if (!seccion) return;

  const rol = document.body.dataset.rol;
  // La busqueda por correo es de Supabase, con cuentas del navegador se vincula con el codigo
  if (rol !== 'cuidador' || !esIdSupabase(userId)) return;

  seccion.style.display = 'block';

  // Ver si ya tiene una vinculación activa
  const { data: vincs } = await supabaseClient
    .from('vinculaciones')
    .select('id, monitoreado_id')
    .eq('cuidador_id', userId)
    .eq('estado', 'activa')
    .limit(1);

  if (vincs && vincs.length > 0) {
    let perfilMon = null;
    try {
      const { data: pData } = await supabaseClient
        .from('profiles')
        .select('id, nombre')
        .eq('id', vincs[0].monitoreado_id)
        .single();
      perfilMon = pData;
    } catch (_) {}
    mostrarVinculacionActiva({ ...vincs[0], profiles: perfilMon }, userId);
  } else {
    mostrarBuscador();
  }

  wireBusqueda(userId);
}

function mostrarVinculacionActiva(vinc, cuidadorId) {
  document.getElementById('vinculacionActiva').style.display = 'block';
  document.getElementById('buscarMonitoreado').style.display = 'none';

  const nombre = vinc.profiles?.nombre || vinc.perfil_monitoreado?.nombre || 'Persona monitoreada';
  const card = document.getElementById('vinculacionActivaCard');
  if (card) {
    card.innerHTML = `
      <div class="vinc-avatar"><i class="fas fa-map-marker-alt"></i></div>
      <div>
        <div class="vinc-nombre">${escHtml(nombre)}</div>
        <div class="vinc-label">Vinculado · activo</div>
      </div>
      <i class="fas fa-check-circle vinc-check"></i>
    `;
  }

  const btnDesvincular = document.getElementById('btnDesvincular');
  if (btnDesvincular) {
    btnDesvincular.addEventListener('click', async () => {
      if (!confirm('¿Desvincular? Ya no podrás ver su ubicación ni recibir sus alertas.')) return;

      const { error } = await supabaseClient
        .from('vinculaciones')
        .update({ estado: 'inactiva' })
        .eq('cuidador_id', cuidadorId)
        .eq('monitoreado_id', vinc.monitoreado_id);

      if (error) {
        mostrarMensaje('vinculacionMsg', 'Error: ' + error.message, 'error');
        return;
      }

      mostrarMensaje('vinculacionMsg', 'Desvinculado correctamente.', 'exito');
      setTimeout(() => mostrarBuscador(), 1000);
      document.getElementById('vinculacionActiva').style.display = 'none';
      document.getElementById('buscarMonitoreado').style.display = 'block';
    });
  }
}

function mostrarBuscador() {
  document.getElementById('vinculacionActiva').style.display = 'none';
  document.getElementById('buscarMonitoreado').style.display = 'block';
  document.getElementById('resultadoBusqueda').style.display = 'none';
}

function wireBusqueda(cuidadorId) {
  const btn = document.getElementById('btnBuscarMonitoreado');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const correo = document.getElementById('inputBuscarCorreo')?.value?.trim();
    if (!correo) {
      mostrarMensaje('vinculacionMsg', 'Escribe un correo para buscar.', 'error');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando…';

    // Buscar en auth.users via la tabla profiles + email
    const { data: usuarios } = await supabaseClient
      .from('profiles')
      .select('id, nombre, rol')
      .eq('rol', 'monitoreado');

    // Buscar el correo comparando con auth
    // Como no podemos consultar auth.users directamente, usamos la función RPC
    const { data: encontrado, error } = await supabaseClient
      .rpc('buscar_monitoreado_por_email', { p_email: correo });

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-search"></i> Buscar';

    const resultado = document.getElementById('resultadoBusqueda');
    resultado.style.display = 'block';

    if (error || !encontrado || encontrado.length === 0) {
      resultado.innerHTML = `
        <div class="vinc-no-encontrado">
          <i class="fas fa-user-slash"></i>
          No se encontró ninguna persona monitoreada con ese correo.
        </div>`;
      return;
    }

    const persona = encontrado[0];
    resultado.innerHTML = `
      <div class="vinc-encontrado">
        <div class="vinc-avatar"><i class="fas fa-map-marker-alt"></i></div>
        <div style="flex:1;">
          <div class="vinc-nombre">${escHtml(persona.nombre || correo)}</div>
          <div class="vinc-label">Rol: monitoreado</div>
        </div>
        <button class="perfil-save-btn" id="btnConfirmarVinc">
          <i class="fas fa-link"></i> Vincularme
        </button>
      </div>`;

    document.getElementById('btnConfirmarVinc').addEventListener('click', async () => {
      await crearVinculacion(cuidadorId, persona.id, persona.nombre || correo);
    });
  });
}

async function crearVinculacion(cuidadorId, monitoreadoId, nombre) {
  const btn = document.getElementById('btnConfirmarVinc');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Vinculando…'; }

  const { error } = await supabaseClient
    .from('vinculaciones')
    .upsert({
      cuidador_id:    cuidadorId,
      monitoreado_id: monitoreadoId,
      estado:         'activa',
    }, { onConflict: 'cuidador_id,monitoreado_id' });

  if (error) {
    mostrarMensaje('vinculacionMsg', 'Error: ' + error.message, 'error');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-link"></i> Vincularme'; }
    return;
  }

  mostrarMensaje('vinculacionMsg', `¡Vinculado con ${nombre} correctamente!`, 'exito');
  document.getElementById('resultadoBusqueda').style.display = 'none';
  document.getElementById('inputBuscarCorreo').value = '';

  // Mostrar la tarjeta de vinculación activa
  mostrarVinculacionActiva({ monitoreado_id: monitoreadoId, profiles: { nombre, id: monitoreadoId } }, cuidadorId);
}

// escHtml
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}
