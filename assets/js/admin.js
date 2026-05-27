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
    else if (rol === 'usuario') mostrarSoloAdmin();
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
  cargarKPIs();
  await cargarUsuarios();
  wireFiltros();
  initVinculaciones();
}

async function cargarKPIs() {
  const { data, error } = await supabaseClient.rpc('admin_kpis');
  if (error) {
    toast('No se pudieron cargar los KPIs: ' + error.message, 'error');
    return;
  }
  const row = (data && data[0]) || {};
  setText('kpiTotal',   row.total_usuarios ?? 0);
  setText('kpiAdmins',  row.total_admins   ?? 0);
  setText('kpiSemana',  row.ultimos_7d     ?? 0);
  setText('kpiMes',     row.ultimos_30d    ?? 0);
}

async function cargarUsuarios() {
  const tbody = document.getElementById('tablaUsuariosBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr class="loading-row"><td colspan="4">cargando usuarios…</td></tr>';

  const { data, error } = await supabaseClient.rpc('admin_list_users');
  if (error) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty">Error: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  estadoUsuarios = data || [];
  renderUsuarios();
}

function renderUsuarios() {
  const tbody = document.getElementById('tablaUsuariosBody');
  if (!tbody) return;

  const filtered = estadoUsuarios.filter(u => {
    if (filtroRol && u.rol !== filtroRol) return false;
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
        <span class="role-pill ${u.rol}">${u.rol}</span>
      </td>
      <td class="date">${formatearFecha(u.created_at)}</td>
      <td style="text-align:right; display:flex; gap:6px; justify-content:flex-end; align-items:center;">
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

  const { error } = await supabaseClient.rpc('admin_set_role', {
    target_user: targetId,
    new_role: newRol
  });

  btn.classList.remove('is-loading');
  btn.disabled = false;

  if (error) {
    toast(error.message, 'error');
    return;
  }

  // Actualiza estado local
  const u = estadoUsuarios.find(x => x.id === targetId);
  if (u) u.rol = newRol;
  toast(newRol === 'admin' ? 'Usuario promovido a admin.' : 'Usuario degradado a usuario.', 'exito');

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

// ---------- Utils ----------
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

// ---------- Eliminar usuario ----------

async function confirmarEliminar(btn) {
  const targetId = btn.dataset.target;
  const nombre = btn.dataset.nombre || 'este usuario';

  const ok = confirm(`¿Eliminar a "${nombre}"?\n\nEsta acción no se puede deshacer y borrará todos sus datos.`);
  if (!ok) return;

  btn.classList.add('is-loading');
  btn.disabled = true;

  const { error } = await supabaseClient.rpc('admin_delete_user', { target_user: targetId });

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

// ============ VINCULACIONES CUIDADOR <-> MONITOREADO ============

async function initVinculaciones() {
  await cargarSelectores();
  await cargarVinculaciones();

  const btn = document.getElementById('btnVincular');
  if (btn) btn.addEventListener('click', crearVinculacion);
}

async function cargarSelectores() {
  // Reutiliza la lista de usuarios ya cargada en estadoUsuarios
  const cuidadores   = estadoUsuarios.filter(u => u.rol === 'cuidador');
  const monitoreados = estadoUsuarios.filter(u => u.rol === 'monitoreado');

  const selC = document.getElementById('selectCuidador');
  const selM = document.getElementById('selectMonitoreado');
  if (!selC || !selM) return;

  selC.innerHTML = '<option value="">— Seleccionar cuidador —</option>' +
    cuidadores.map(u => `<option value="${u.id}">${escapeHtml(u.nombre)} (${escapeHtml(u.email)})</option>`).join('');

  selM.innerHTML = '<option value="">— Seleccionar monitoreado —</option>' +
    monitoreados.map(u => `<option value="${u.id}">${escapeHtml(u.nombre)} (${escapeHtml(u.email)})</option>`).join('');
}

async function cargarVinculaciones() {
  const tbody = document.getElementById('tablaVinculacionesBody');
  if (!tbody) return;

  const { data, error } = await supabaseClient
    .from('vinculaciones')
    .select('id, cuidador_id, monitoreado_id, estado')
    .order('created_at', { ascending: false });

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

  const { error } = await supabaseClient.rpc('admin_vincular', {
    p_cuidador:    cuidadorId,
    p_monitoreado: monitoreadoId,
  });

  if (error) { toast('Error: ' + error.message, 'error'); return; }

  toast('Vinculación creada correctamente.', 'exito');
  await cargarVinculaciones();
}

async function desvincular(cuidadorId, monitoreadoId) {
  const { error } = await supabaseClient.rpc('admin_desvincular', {
    p_cuidador:    cuidadorId,
    p_monitoreado: monitoreadoId,
  });

  if (error) { toast('Error: ' + error.message, 'error'); return; }

  toast('Vinculación desactivada.', 'exito');
  await cargarVinculaciones();
}
