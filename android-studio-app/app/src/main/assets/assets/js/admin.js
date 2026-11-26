// Panel de administración:
// - Carga KPIs (admin_kpis RPC)
// - Lista usuarios (admin_list_users RPC)
// - Promover/Degradar (admin_set_role RPC)
// - Solo se ejecuta si body[data-rol]="admin"

document.addEventListener('DOMContentLoaded', () => {
  // Esperamos a que auth.js fije data-rol antes de cargar nada.
  const tryStart = () => {
    const rol = document.body.dataset.rol;
    if (rol === 'admin') initAdmin();
    else if (rol && rol !== 'admin') mostrarSoloAdmin();
    // si aún no hay rol (auth.js todavía resolviendo), reintenta
  };

  const obs = new MutationObserver(() => tryStart());
  obs.observe(document.body, { attributes: true, attributeFilter: ['data-rol'] });
  setTimeout(tryStart, 100);
});

function mostrarSoloAdmin() {
  const detalle = document.getElementById('restrictedDetail');
  if (detalle) {
    detalle.textContent = 'Tu cuenta no tiene permisos de administrador. Pide a un admin que te promueva.';
  }
  // Re-mostrar el bloque restringido (auth.js lo había ocultado al detectar sesión)
  const restricted = document.getElementById('restrictedMessage');
  const pageContent = document.getElementById('pageContent');
  if (restricted) restricted.style.display = 'block';
  if (pageContent) pageContent.style.display = 'none';
}

let estadoUsuarios = [];
let filtroBusqueda = '';
let filtroRol = '';

async function initAdmin() {
  await cargarUsuarios();
  cargarKPIs();
  wireFiltros();
  initVinculaciones();
}

// Las consultas de Supabase no tienen .catch(), por eso se usa try/catch
async function llamarRpc(nombre, params) {
  try {
    return await supabaseClient.rpc(nombre, params);
  } catch (err) {
    return { data: null, error: err };
  }
}

async function cargarKPIs() {
  {
    const { data, error } = await llamarRpc('admin_kpis');
    if (!error && data) {
      const row = data[0] || {};
      setText('kpiTotal',   row.total_usuarios ?? 0);
      setText('kpiAdmins',  row.total_admins   ?? 0);
      setText('kpiSemana',  row.ultimos_7d     ?? 0);
      setText('kpiMes',     row.ultimos_30d    ?? 0);
      return;
    }
  }
  // Si la funcion de KPIs falla se calculan con la lista de usuarios
  const ahora = Date.now();
  const dias = (u) => (ahora - new Date(u.created_at || 0).getTime()) / 86400000;
  setText('kpiTotal',  estadoUsuarios.length);
  setText('kpiAdmins', estadoUsuarios.filter(u => u.rol === 'admin').length);
  setText('kpiSemana', estadoUsuarios.filter(u => dias(u) <= 7).length);
  setText('kpiMes',    estadoUsuarios.filter(u => dias(u) <= 30).length);
}

async function cargarUsuarios() {
  const tbody = document.getElementById('tablaUsuariosBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr class="loading-row"><td colspan="4">cargando usuarios…</td></tr>';

  const { data, error } = await llamarRpc('admin_list_users');
  if (error || !Array.isArray(data)) {
    estadoUsuarios = [];
    tbody.innerHTML = `<tr><td colspan="4" class="empty">No se pudieron cargar los usuarios: ${escapeHtml(error ? error.message : 'sin respuesta')}. Inicia sesión con una cuenta de administrador.</td></tr>`;
    return;
  }
  estadoUsuarios = data;
  renderUsuarios();
}

function renderUsuarios() {
  const tbody = document.getElementById('tablaUsuariosBody');
  if (!tbody) return;

  const filtered = estadoUsuarios.filter(u => {
    if (filtroRol && rolVisible(u.rol) !== filtroRol) return false;
    if (filtroBusqueda) {
      const q = filtroBusqueda.toLowerCase();
      const hit = (u.nombre || '').toLowerCase().includes(q) ||
                  (u.email || '').toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty">Sin coincidencias.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(u => filaUsuario(u)).join('');
  tbody.querySelectorAll('.role-toggle:not(.btn-eliminar)').forEach(btn => {
    btn.addEventListener('click', () => alternarRol(btn));
  });
  tbody.querySelectorAll('.btn-eliminar').forEach(btn => {
    btn.addEventListener('click', () => confirmarEliminar(btn));
  });
  tbody.querySelectorAll('.btn-ver').forEach(btn => {
    btn.addEventListener('click', () => verCuenta(btn.dataset.ver));
  });
}

// En la base de datos el paciente puede estar como 'monitoreado' o 'usuario'; en pantalla siempre es "paciente"
function rolVisible(rol) {
  return (rol === 'monitoreado' || rol === 'usuario') ? 'paciente' : rol;
}

function filaUsuario(u) {
  const isAdmin = u.rol === 'admin';
  const action = isAdmin ? 'Revocar' : 'Promover';
  const targetRol = isAdmin ? 'usuario' : 'admin';
  return `
    <tr data-user="${u.id}">
      <td>
        <div class="user-cell ${isAdmin ? 'is-admin' : ''}">
          <div class="user-avatar"><i class="fas ${isAdmin ? 'fa-user-shield' : 'fa-user'}"></i></div>
          <div class="user-meta">
            <span class="name">${escapeHtml(u.nombre || 'Sin nombre')}</span>
            <span class="email">${escapeHtml(u.email || '')}</span>
          </div>
        </div>
      </td>
      <td>
        <span class="role-pill ${rolVisible(u.rol) === 'paciente' ? 'monitoreado' : u.rol}">${rolVisible(u.rol)}</span>
      </td>
      <td class="date">${formatearFecha(u.created_at)}</td>
      <td style="text-align:right; display:flex; gap:6px; justify-content:flex-end; align-items:center;">
        <button class="btn-ver" data-ver="${u.id}" title="Ver la información de esta cuenta" style="border:1px solid #0d9488; color:#0d9488; background:#fff; border-radius:8px; padding:6px 10px; font-size:11px; font-weight:700; cursor:pointer;"><i class="fas fa-eye"></i> VER</button>
        <button class="role-toggle" data-target="${u.id}" data-new-rol="${targetRol}">${action}</button>
        <button class="role-toggle btn-eliminar" data-target="${u.id}" data-nombre="${escapeHtml(u.nombre || u.email)}" title="Eliminar usuario">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    </tr>`;
}

async function alternarRol(btn) {
  const targetId = btn.dataset.target;
  const newRol = btn.dataset.newRol;
  btn.classList.add('is-loading');
  btn.disabled = true;

  const { error } = await llamarRpc('admin_set_role', { target_user: targetId, new_role: newRol });

  btn.classList.remove('is-loading');
  btn.disabled = false;

  if (error) {
    toast(error.message, 'error');
    return;
  }

  // Actualiza estado local
  const u = estadoUsuarios.find(x => x.id === targetId);
  if (u) u.rol = newRol;
  toast(`Rol actualizado exitosamente a: ${newRol}.`, 'exito');

  renderUsuarios();
  cargarKPIs();
}

function wireFiltros() {
  const busca = document.getElementById('buscarUsuario');
  if (busca) {
    busca.addEventListener('input', (e) => {
      filtroBusqueda = e.target.value;
      renderUsuarios();
    });
  }

  const grupo = document.getElementById('filtroRol');
  if (grupo) {
    grupo.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        grupo.querySelectorAll('button').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        filtroRol = b.dataset.rol || '';
        renderUsuarios();
      });
    });
  }
}

// Utils
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatearFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

let toastTimer;
function toast(msg, tipo) {
  const t = document.getElementById('adminToast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'admin-toast ' + (tipo || '');
  // forzar reflow para reiniciar transición
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// Eliminar usuario

async function confirmarEliminar(btn) {
  const targetId = btn.dataset.target;
  const nombre = btn.dataset.nombre || 'este usuario';

  const ok = confirm(`¿Eliminar a "${nombre}"?\n\nEsta acción no se puede deshacer y borrará todos sus datos.`);
  if (!ok) return;

  btn.classList.add('is-loading');
  btn.disabled = true;

  const { error } = await llamarRpc('admin_delete_user', { target_user: targetId });

  btn.classList.remove('is-loading');
  btn.disabled = false;

  if (error) {
    toast('No se pudo eliminar: ' + error.message, 'error');
    return;
  }

  estadoUsuarios = estadoUsuarios.filter(u => u.id !== targetId);
  toast(`Usuario eliminado correctamente.`, 'exito');
  renderUsuarios();
  cargarKPIs();
}

// ============ vinculaciones cuidador <-> paciente ============

async function initVinculaciones() {
  await cargarSelectores();
  await cargarVinculaciones();

  const btn = document.getElementById('btnVincular');
  if (btn) btn.addEventListener('click', crearVinculacion);
}

async function cargarSelectores() {
  // Reutiliza la lista de usuarios ya cargada en estadoUsuarios
  const cuidadores   = estadoUsuarios.filter(u => u.rol === 'cuidador');
  const monitoreados = estadoUsuarios.filter(u => rolVisible(u.rol) === 'paciente');

  const selC = document.getElementById('selectCuidador');
  const selM = document.getElementById('selectMonitoreado');
  if (!selC || !selM) return;

  selC.innerHTML = '<option value="">— Seleccionar cuidador —</option>' +
    cuidadores.map(u => `<option value="${u.id}">${escapeHtml(u.nombre)} (${escapeHtml(u.email)})</option>`).join('');

  selM.innerHTML = '<option value="">— Seleccionar paciente —</option>' +
    monitoreados.map(u => `<option value="${u.id}">${escapeHtml(u.nombre)} (${escapeHtml(u.email)})</option>`).join('');
}

async function cargarVinculaciones() {
  const tbody = document.getElementById('tablaVinculacionesBody');
  if (!tbody) return;

  let data = null, error = null;
  try {
    ({ data, error } = await supabaseClient
      .from('vinculaciones')
      .select('id, cuidador_id, monitoreado_id, estado')
      .order('created_at', { ascending: false }));
  } catch (err) { error = err; }

  if (error) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty">Error: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty">Sin vinculaciones registradas.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(v => {
    const cuidador    = estadoUsuarios.find(u => u.id === v.cuidador_id);
    const monitoreado = estadoUsuarios.find(u => u.id === v.monitoreado_id);
    const estadoClass = v.estado === 'activa' ? 'badge-completada' : 'badge-cancelada';
    return `
      <tr>
        <td>${escapeHtml(cuidador?.nombre || v.cuidador_id.slice(0,8))}</td>
        <td>${escapeHtml(monitoreado?.nombre || v.monitoreado_id.slice(0,8))}</td>
        <td><span class="estado-pill ${estadoClass}">${v.estado}</span></td>
        <td style="text-align:right;">
          ${v.estado === 'activa'
            ? `<button class="role-toggle btn-eliminar" onclick="desvincular('${v.cuidador_id}','${v.monitoreado_id}')">Desvincular</button>`
            : '—'
          }
        </td>
      </tr>`;
  }).join('');
}

async function crearVinculacion() {
  const cuidadorId    = document.getElementById('selectCuidador')?.value;
  const monitoreadoId = document.getElementById('selectMonitoreado')?.value;

  if (!cuidadorId || !monitoreadoId) {
    toast('Selecciona un cuidador y una persona monitoreada.', 'error');
    return;
  }

  const { error } = await llamarRpc('admin_vincular', { p_cuidador: cuidadorId, p_monitoreado: monitoreadoId });

  if (error) { toast('Error: ' + error.message, 'error'); return; }

  toast('Vinculación creada correctamente.', 'exito');
  await cargarVinculaciones();
}

async function desvincular(cuidadorId, monitoreadoId) {
  const { error } = await llamarRpc('admin_desvincular', { p_cuidador: cuidadorId, p_monitoreado: monitoreadoId });

  if (error) { toast('Error: ' + error.message, 'error'); return; }

  toast('Vinculación desactivada.', 'exito');
  await cargarVinculaciones();
}


// ============ ver la informacion de una cuenta ============
// El admin puede leer todas las tablas (reglas RLS "admin lee"), asi que aqui se arma un resumen de la cuenta.
async function verCuenta(id) {
  const u = estadoUsuarios.find(x => x.id === id);
  if (!u) return;
  const esPaciente = rolVisible(u.rol) === 'paciente';
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const hora = (ts) => ts ? new Date(ts).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';

  const [perfil, vincs, glu, pre, gps, ale, tom, bat] = await Promise.all([
    supabaseClient.from('profiles').select('codigo_paciente, diagnostico, barrio').eq('id', id).maybeSingle(),
    supabaseClient.from('vinculaciones').select('cuidador_id, monitoreado_id, estado').or(`cuidador_id.eq.${id},monitoreado_id.eq.${id}`),
    esPaciente ? supabaseClient.from('glucosa_lecturas').select('valor, ts').eq('user_id', id).order('ts', { ascending: false }).limit(1) : { data: [] },
    esPaciente ? supabaseClient.from('presion_arterial').select('sistolica, diastolica, ts').eq('user_id', id).order('ts', { ascending: false }).limit(1) : { data: [] },
    esPaciente ? supabaseClient.from('gps_lecturas').select('lat, lng, ts').eq('user_id', id).order('ts', { ascending: false }).limit(1) : { data: [] },
    esPaciente ? supabaseClient.from('alertas').select('id', { count: 'exact', head: true }).eq('user_id', id).eq('estado', 'activa') : { count: 0 },
    esPaciente ? supabaseClient.from('tomas_medicamento').select('id', { count: 'exact', head: true }).eq('user_id', id).gte('ts', hoy.toISOString()) : { count: 0 },
    esPaciente ? supabaseClient.from('registros').select('notas, ts').eq('user_id', id).eq('tipo', 'dispositivo').order('ts', { ascending: false }).limit(1) : { data: [] }
  ]);

  const nombreDe = (uid) => (estadoUsuarios.find(x => x.id === uid) || {}).nombre || uid.slice(0, 8);
  const lista = (vincs.data || []).filter(v => v.estado === 'activa')
    .map(v => v.cuidador_id === id ? 'Cuida a ' + nombreDe(v.monitoreado_id) : 'Su cuidador: ' + nombreDe(v.cuidador_id));
  const p = perfil.data || {};
  const g = (glu.data || [])[0], pr = (pre.data || [])[0], ub = (gps.data || [])[0];
  let bateria = '—';
  try { const b = (bat.data || [])[0]; if (b) bateria = JSON.parse(b.notas).bateria + '% (' + hora(b.ts) + ')'; } catch (_) {}

  const filas = [
    ['Correo', escapeHtml(u.email || '')],
    ['Rol', rolVisible(u.rol)],
    ['Registrado', formatearFecha(u.created_at)],
    ['Vinculaciones', lista.length ? lista.map(escapeHtml).join('<br>') : 'Ninguna']
  ];
  if (esPaciente) {
    filas.push(
      ['Código', escapeHtml(p.codigo_paciente || '—')],
      ['Diagnóstico', escapeHtml(p.diagnostico || 'Sin registrar')],
      ['Barrio', escapeHtml(p.barrio || 'Sin registrar')],
      ['Última glucosa', g ? `${g.valor} mg/dL · ${hora(g.ts)}` : 'Sin lecturas'],
      ['Última presión', pr ? `${pr.sistolica}/${pr.diastolica} mmHg · ${hora(pr.ts)}` : 'Sin lecturas'],
      ['Última ubicación', ub ? `<a href="https://www.google.com/maps?q=${ub.lat},${ub.lng}" target="_blank" rel="noopener">Ver en el mapa</a> · ${hora(ub.ts)}` : 'Sin GPS'],
      ['Batería del celular', bateria],
      ['Alertas activas', String(ale.count || 0)],
      ['Medicamentos marcados hoy', String(tom.count || 0)]
    );
  }

  document.getElementById('modalVerCuenta')?.remove();
  const m = document.createElement('div');
  m.id = 'modalVerCuenta';
  m.style.cssText = 'position:fixed; inset:0; background:rgba(2,6,23,0.55); display:flex; align-items:center; justify-content:center; z-index:9999; padding:16px;';
  m.innerHTML = `
    <div style="background:#fff; color:#0f172a; border-radius:14px; width:100%; max-width:460px; max-height:90vh; overflow:auto; padding:22px; font-family:inherit;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="margin:0; font-size:18px;"><i class="fas fa-user" style="color:#0d9488;"></i> ${escapeHtml(u.nombre || 'Sin nombre')}</h3>
        <button type="button" id="cerrarVerCuenta" style="border:0; background:#f1f5f9; border-radius:8px; width:32px; height:32px; cursor:pointer;">✕</button>
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        ${filas.map(([k, v]) => `<tr><td style="padding:7px 8px 7px 0; color:#64748b; vertical-align:top; width:42%;">${k}</td><td style="padding:7px 0; font-weight:600;">${v}</td></tr>`).join('')}
      </table>
    </div>`;
  document.body.appendChild(m);
  const cerrar = () => m.remove();
  m.addEventListener('click', (e) => { if (e.target === m) cerrar(); });
  document.getElementById('cerrarVerCuenta').addEventListener('click', cerrar);
}
