// ============ HISTORIAL DE RUTAS ============
// Carga rutas del usuario (o de admins si es cuidador) desde Supabase.
// Filtra por período: hoy / 7 días / 30 días / año.
// Muestra KPIs y tabla con detalle de cada ruta.

let todasLasRutas = [];
let periodoActivo = 'hoy';
let busqueda = '';

document.addEventListener('dashboardListo', async (e) => {
  const userId = e.detail?.user?.id;
  if (!userId) return;

  wirePeriodo();
  wireBusqueda();
  await cargarRutas(userId);
});

// ============ CARGA DE DATOS ============

async function cargarRutas(userId) {
  mostrarCargando();

  const rol = document.body.dataset.rol;
  let userIds = [userId];

  if (rol === 'cuidador') {
    // Cuidador: ver rutas de su persona monitoreada vinculada
    const { data: vincs } = await supabaseClient
      .from('vinculaciones')
      .select('monitoreado_id')
      .eq('cuidador_id', userId)
      .eq('estado', 'activa');
    if (vincs && vincs.length > 0) {
      userIds = vincs.map(v => v.monitoreado_id);
    } else {
      mostrarError('No tienes ninguna persona monitoreada vinculada aún.');
      return;
    }
  } else if (rol === 'usuario') {
    // Usuario genérico: ver rutas de los admins (transmisores de ubicación)
    const { data: admins } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('rol', 'admin');
    if (admins && admins.length > 0) {
      userIds = admins.map(a => a.id);
    }
  }
  // admin y monitoreado: ven sus propias rutas (userIds = [userId])

  const desde = calcularDesde(periodoActivo);

  let query = supabaseClient
    .from('rutas')
    .select('id, nombre, distancia_km, tiempo_min, glucosa_promedio, glucosa_max, glucosa_min, fecha, estado, created_at')
    .in('user_id', userIds)
    .order('created_at', { ascending: false });

  if (desde) query = query.gte('created_at', desde.toISOString());

  const { data, error } = await query;

  if (error) {
    mostrarError('No se pudieron cargar las rutas: ' + error.message);
    return;
  }

  todasLasRutas = data || [];
  aplicarFiltros();
}

// ============ FILTROS ============

function aplicarFiltros() {
  let filtradas = todasLasRutas;

  if (busqueda.trim()) {
    const q = busqueda.toLowerCase();
    filtradas = filtradas.filter(r =>
      (r.nombre || '').toLowerCase().includes(q)
    );
  }

  renderKPIs(filtradas);
  renderTabla(filtradas);
}

function wirePeriodo() {
  const btns = document.querySelectorAll('.segmented button');
  const periodos = ['hoy', '7dias', '30dias', 'año'];
  btns.forEach((btn, i) => {
    btn.addEventListener('click', async () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      periodoActivo = periodos[i] || 'hoy';
      // Necesitamos el userId — lo tomamos del usuario activo
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) await cargarRutas(user.id);
    });
  });
}

function wireBusqueda() {
  const input = document.getElementById('buscarRuta');
  if (!input) return;
  input.addEventListener('input', (e) => {
    busqueda = e.target.value;
    aplicarFiltros();
  });
}

function calcularDesde(periodo) {
  const ahora = new Date();
  if (periodo === 'hoy') {
    const d = new Date(ahora);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (periodo === '7dias') {
    const d = new Date(ahora);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (periodo === '30dias') {
    const d = new Date(ahora);
    d.setDate(d.getDate() - 30);
    return d;
  }
  if (periodo === 'año') {
    const d = new Date(ahora);
    d.setFullYear(d.getFullYear() - 1);
    return d;
  }
  return null;
}

// ============ KPIs ============

function renderKPIs(rutas) {
  const total = rutas.length;

  const distancia = rutas.reduce((s, r) => s + (parseFloat(r.distancia_km) || 0), 0);
  const tiempo = rutas.reduce((s, r) => s + (parseInt(r.tiempo_min) || 0), 0);

  const conGlucosa = rutas.filter(r => r.glucosa_promedio != null);
  const promGlucosa = conGlucosa.length
    ? Math.round(conGlucosa.reduce((s, r) => s + r.glucosa_promedio, 0) / conGlucosa.length)
    : 0;

  const maxGlucosa = conGlucosa.length
    ? Math.max(...conGlucosa.map(r => r.glucosa_max || r.glucosa_promedio))
    : 0;

  const minGlucosa = conGlucosa.length
    ? Math.min(...conGlucosa.map(r => r.glucosa_min || r.glucosa_promedio))
    : 0;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = val;
  };

  set('historialTotal', total);
  set('historialDistance', distancia.toFixed(1) + '<span class="unit">km</span>');
  set('historialTime', Math.round(tiempo / 60 * 10) / 10 + '<span class="unit">h</span>');
  set('historialAvg', (promGlucosa || '—') + (promGlucosa ? '<span class="unit">mg/dL</span>' : ''));
  set('historialMax', (maxGlucosa || '—') + (maxGlucosa ? '<span class="unit">mg/dL</span>' : ''));
  set('historialMin', (minGlucosa || '—') + (minGlucosa ? '<span class="unit">mg/dL</span>' : ''));
}

// ============ TABLA ============

function renderTabla(rutas) {
  const tbody = document.getElementById('tablaRutasBody');
  if (!tbody) return;

  if (rutas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty">Sin rutas en este período.</td></tr>';
    return;
  }

  tbody.innerHTML = rutas.map(r => {
    const fecha = r.fecha
      ? new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
      : formatearFechaISO(r.created_at);

    const distancia = r.distancia_km != null ? r.distancia_km + ' km' : '—';
    const tiempo = r.tiempo_min != null ? r.tiempo_min + ' min' : '—';
    const promGlucosa = r.glucosa_promedio != null ? r.glucosa_promedio + ' mg/dL' : '—';
    const maxGlucosa = r.glucosa_max != null ? r.glucosa_max + ' mg/dL' : '—';

    const estadoClase = {
      completada: 'badge-completada',
      en_curso:   'badge-activa',
      cancelada:  'badge-cancelada',
    }[r.estado] || 'badge-completada';

    const estadoTexto = {
      completada: 'Completada',
      en_curso:   'En curso',
      cancelada:  'Cancelada',
    }[r.estado] || r.estado;

    return `
      <tr>
        <td>${fecha}</td>
        <td>${escHtml(r.nombre || 'Sin nombre')}</td>
        <td>${distancia}</td>
        <td>${tiempo}</td>
        <td>${promGlucosa}</td>
        <td>${maxGlucosa}</td>
        <td><span class="estado-pill ${estadoClase}">${estadoTexto}</span></td>
      </tr>
    `;
  }).join('');
}

// ============ UTILS ============

function formatearFechaISO(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

function mostrarCargando() {
  const tbody = document.getElementById('tablaRutasBody');
  if (tbody) tbody.innerHTML = '<tr class="loading-row"><td colspan="7">Cargando rutas…</td></tr>';
}

function mostrarError(msg) {
  const tbody = document.getElementById('tablaRutasBody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="empty">${escHtml(msg)}</td></tr>`;
}
