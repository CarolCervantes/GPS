// ============ APP.JS — Dashboard principal ============
// Gestiona el historyMap (conectado a Supabase) y el guardado periódico de glucosa.

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; OpenStreetMap &copy; CARTO';

// El historyMap se inicializa en DOMContentLoaded pero carga datos desde Supabase
// tras recibir el evento dashboardListo (auth completada).

let historyMap = null;
let lineaHistorial = null;
let marcadorInicio = null;
let marcadorFin = null;
let tabActiva = 'hoy';
let adminIds = [];

// ============ INICIALIZAR HISTORY MAP ============
document.addEventListener('DOMContentLoaded', () => {
  const historyMapEl = document.getElementById('historyMap');
  if (!historyMapEl) return;

  historyMap = L.map('historyMap', {
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
  });

  L.tileLayer(TILE_URL, { attribution: TILE_ATTR, subdomains: 'abcd', maxZoom: 19 }).addTo(historyMap);
  historyMap.setView([10.3910, -75.4794], 13);

  // Re-invalidate after fonts / layout settle
  setTimeout(() => historyMap.invalidateSize(), 300);
  setTimeout(() => historyMap.invalidateSize(), 800);

  // Tabs
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      tabActiva = tab.dataset.type;
      if (adminIds.length > 0) cargarHistorial(tabActiva);
    });
  });
});

// ============ CARGA DE DATOS TRAS AUTH ============
document.addEventListener('dashboardListo', async (e) => {
  const userId = e.detail?.user?.id;
  if (!userId) return;

  const rol = document.body.dataset.rol;

  if (rol === 'cuidador') {
    // Cuidador: obtiene IDs de sus personas monitoreadas vinculadas
    const { data: vincs } = await supabaseClient
      .from('vinculaciones')
      .select('monitoreado_id')
      .eq('cuidador_id', userId)
      .eq('estado', 'activa');
    adminIds = vincs?.map(v => v.monitoreado_id) || [];
  } else {
    // Admin y demás: obtener IDs de admins (quienes transmiten ubicación)
    const { data: admins } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('rol', 'admin');
    adminIds = admins?.map(a => a.id) || [];
  }

  if (adminIds.length > 0) {
    await cargarHistorial('hoy');
  } else if (rol === 'cuidador') {
    mostrarHistorialVacio('Aún no tienes una persona monitoreada vinculada. Contacta al administrador.');
  } else {
    mostrarHistorialVacio('Sin administradores registrados');
  }

  // Guardar glucosa inicial y programar guardados periódicos
  const valor = await guardarGlucosaAleatoria(userId);
  if (valor) actualizarPulso(valor);
  setInterval(async () => {
    const v = await guardarGlucosaAleatoria(userId);
    if (v) actualizarPulso(v);
  }, 5 * 60 * 1000);

  // Cargar lecturas recientes para el panel de tendencias
  cargarLecturasRecientes(userId);
});

// ============ PANEL GLUCOSA — PULSE RING ============
function actualizarPulso(valor) {
  const pulseEl  = document.getElementById('glucosePulse');
  const valueEl  = document.getElementById('glucoseValue');
  const labelEl  = document.getElementById('glucoseLabel');
  if (!pulseEl) return;

  valueEl.textContent = valor;
  pulseEl.classList.remove('warn', 'alert');

  if (valor < 70) {
    labelEl.textContent = 'Glucosa baja';
    pulseEl.classList.add('alert');
  } else if (valor > 180) {
    labelEl.textContent = 'Glucosa alta';
    pulseEl.classList.add('warn');
  } else {
    labelEl.textContent = 'En rango normal';
  }
}

async function cargarLecturasRecientes(userId) {
  const { data } = await supabaseClient
    .from('glucosa_lecturas')
    .select('valor, ts')
    .eq('user_id', userId)
    .order('ts', { ascending: false })
    .limit(10);

  if (!data || data.length === 0) return;

  // Actualizar pulse con valor más reciente
  actualizarPulso(data[0].valor);

  // Actualizar tendencia (delta entre primera y segunda lectura)
  if (data.length >= 2) {
    const delta = data[0].valor - data[1].valor;
    const deltaEl = document.getElementById('trendDelta');
    if (deltaEl) {
      deltaEl.textContent = (delta >= 0 ? '+' : '') + delta;
      deltaEl.className = 'trend-delta ' + (delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat');
    }
  }

  // Actualizar lecturas recientes (primeras 3)
  const readingsList = document.getElementById('readingsList');
  if (!readingsList) return;
  const labels = ['ahora', 'hace 1h', 'hace 2h'];
  const items = readingsList.querySelectorAll('.reading');
  data.slice(0, 3).forEach((lec, i) => {
    if (!items[i]) return;
    const valueSpan = items[i].querySelector('.value');
    const badgeSpan = items[i].querySelector('.badge');
    if (valueSpan) {
      valueSpan.textContent = lec.valor + ' mg/dL';
      valueSpan.className = 'value ' + (lec.valor > 180 ? 'high' : lec.valor < 70 ? 'high' : 'normal');
    }
    if (badgeSpan) {
      if (lec.valor > 180) { badgeSpan.textContent = 'Alta'; badgeSpan.className = 'badge high'; }
      else if (lec.valor < 70) { badgeSpan.textContent = 'Baja'; badgeSpan.className = 'badge high'; }
      else { badgeSpan.textContent = 'Normal'; badgeSpan.className = 'badge normal'; }
    }
  });

  // Calcular porcentajes de rangos (últimas 10 lecturas)
  const enRango = data.filter(l => l.valor >= 70 && l.valor <= 180).length;
  const alta    = data.filter(l => l.valor > 180).length;
  const baja    = data.filter(l => l.valor < 70).length;
  const total   = data.length;
  const pNormal = Math.round(enRango / total * 100);
  const pAlta   = Math.round(alta / total * 100);
  const pBaja   = Math.round(baja / total * 100);

  const setRange = (id, pct) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = pct + '%';
    const bar = el.closest('.range-cell')?.querySelector('.range-bar span');
    if (bar) bar.style.width = pct + '%';
  };
  setRange('rangeNormal', pNormal);
  setRange('rangeHigh', pAlta);
  setRange('rangeLow', pBaja);
}

// ============ CARGAR HISTORIAL DESDE SUPABASE ============
async function cargarHistorial(periodo) {
  if (!historyMap || adminIds.length === 0) return;

  mostrarHistorialCargando();

  const desde = calcularDesde(periodo);

  // Paso 1: obtener rutas completadas del periodo
  let query = supabaseClient
    .from('rutas')
    .select('id')
    .in('user_id', adminIds)
    .eq('estado', 'completada');

  if (desde) query = query.gte('created_at', desde.toISOString());

  const { data: rutas, error: rutasError } = await query;

  if (rutasError) {
    console.error('Error cargando rutas historial:', rutasError);
    mostrarHistorialVacio('Error al cargar datos');
    return;
  }

  if (!rutas || rutas.length === 0) {
    mostrarHistorialVacio('Sin recorridos en este período');
    return;
  }

  const rutaIds = rutas.map(r => r.id);

  // Paso 2: cargar todos los puntos GPS de esas rutas
  const { data: puntos, error: puntosError } = await supabaseClient
    .from('gps_lecturas')
    .select('lat, lng, ts, ruta_id')
    .in('ruta_id', rutaIds)
    .order('ts', { ascending: true });

  if (puntosError) {
    console.error('Error cargando puntos GPS:', puntosError);
    mostrarHistorialVacio('Error al cargar puntos GPS');
    return;
  }

  if (!puntos || puntos.length === 0) {
    mostrarHistorialVacio('Sin puntos GPS registrados');
    return;
  }

  dibujarHistorial(puntos, rutas.length);
}

function calcularDesde(periodo) {
  const ahora = new Date();
  if (periodo === 'hoy') {
    const inicio = new Date(ahora);
    inicio.setHours(0, 0, 0, 0);
    return inicio;
  }
  if (periodo === 'semana') {
    const d = new Date(ahora);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (periodo === 'mes') {
    const d = new Date(ahora);
    d.setDate(d.getDate() - 30);
    return d;
  }
  return null;
}

function dibujarHistorial(puntos, numRutas) {
  if (!historyMap) return;

  ocultarHistorialVacio();

  // Limpiar capas anteriores
  if (lineaHistorial) historyMap.removeLayer(lineaHistorial);
  if (marcadorInicio) historyMap.removeLayer(marcadorInicio);
  if (marcadorFin) historyMap.removeLayer(marcadorFin);

  const latlngs = puntos.map(p => [p.lat, p.lng]);

  lineaHistorial = L.polyline(latlngs, {
    color: '#E89A3C',
    weight: 3,
    opacity: 0.9,
    lineCap: 'round',
    lineJoin: 'round',
  }).addTo(historyMap);

  // Marcador de inicio (punto verde)
  marcadorInicio = L.circleMarker(latlngs[0], {
    radius: 6,
    color: '#22c55e',
    fillColor: '#22c55e',
    fillOpacity: 1,
    weight: 2,
  }).bindTooltip('Inicio', { direction: 'top' }).addTo(historyMap);

  // Marcador de fin (punto rojo)
  const ultimo = latlngs[latlngs.length - 1];
  marcadorFin = L.circleMarker(ultimo, {
    radius: 6,
    color: '#ef4444',
    fillColor: '#ef4444',
    fillOpacity: 1,
    weight: 2,
  }).bindTooltip('Fin', { direction: 'top' }).addTo(historyMap);

  historyMap.invalidateSize();
  historyMap.fitBounds(lineaHistorial.getBounds(), { padding: [20, 20] });

  // Actualizar métricas en el panel
  const puntosEl = document.getElementById('historyPuntos');
  const rutasEl = document.getElementById('historyRutas');
  if (puntosEl) puntosEl.textContent = puntos.length;
  if (rutasEl) rutasEl.textContent = numRutas;
}

function mostrarHistorialVacio(mensaje) {
  if (!historyMap) return;
  if (lineaHistorial) historyMap.removeLayer(lineaHistorial);
  if (marcadorInicio) historyMap.removeLayer(marcadorInicio);
  if (marcadorFin) historyMap.removeLayer(marcadorFin);
  lineaHistorial = null;
  marcadorInicio = null;
  marcadorFin = null;

  const puntosEl = document.getElementById('historyPuntos');
  const rutasEl  = document.getElementById('historyRutas');
  const emptyEl  = document.getElementById('historyEmpty');
  const msgEl    = document.getElementById('historyEmptyMsg');
  if (puntosEl) puntosEl.textContent = '—';
  if (rutasEl)  rutasEl.textContent  = '—';
  if (emptyEl)  emptyEl.style.display = 'flex';
  if (msgEl)    msgEl.textContent    = mensaje;
}

function ocultarHistorialVacio() {
  const emptyEl = document.getElementById('historyEmpty');
  if (emptyEl) emptyEl.style.display = 'none';
}

function mostrarHistorialCargando() {
  const rutasEl = document.getElementById('historyRutas');
  if (rutasEl) rutasEl.textContent = 'Cargando...';
}

// ============ GUARDAR GLUCOSA ALEATORIA ============
// Genera un valor aleatorio dentro del rango normal (70–180 mg/dL)
// y lo guarda en glucosa_lecturas y en registros para que aparezca
// en las páginas de Registros y Reportes.
async function guardarGlucosaAleatoria(userId) {
  const valor = Math.floor(Math.random() * (160 - 80 + 1)) + 80; // 80–160 mg/dL
  const ahora = new Date().toISOString();

  supabaseClient.from('glucosa_lecturas').insert({
    user_id: userId,
    valor,
    ts: ahora,
    fuente: 'cgm',
  }).then(({ error }) => {
    if (error) console.warn('Error guardando glucosa_lecturas:', error.message);
  });

  supabaseClient.from('registros').insert({
    user_id: userId,
    tipo: 'glucosa',
    valor: `${valor} mg/dL`,
    etiquetas: ['cgm', valor > 140 ? 'elevada' : 'normal'],
    notas: 'Lectura automática del monitor continuo',
    ts: ahora,
  }).then(({ error }) => {
    if (error) console.warn('Error guardando registro glucosa:', error.message);
  });

  return valor;
}
