// ============ APP.JS — Motor Real de Rutas Históricas y Grabación GPS ============
// Combina persistencia local (localStorage) + sincronización real con Supabase (rutas + gps_lecturas).
// Soporta:
//   - Filtrado real por período: Hoy / Últimos 7 días / Último mes
//   - Grabación de recorridos GPS en vivo (Geolocation API watchPosition)
//   - Trazado interactivo de rutas haciendo clic en el mapa (con ruteo por calles OSRM + fallback)
//   - Reproducción animada de cualquier recorrido histórico
//   - Sincronización inmediata al abrir/redimensionar la pestaña de Mapa

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '&copy; OpenStreetMap contributors';
const RUTAS_STORAGE_KEY = 'diamon_rutas_historicas_v1';

const COLORES_RUTA = ['#0d9488', '#0284c7', '#f59e0b', '#8b5cf6', '#ef4444', '#10b981'];

let historyMap = null;
let historyLayerGroup = null;
let drawLayerGroup = null;
let playbackMarker = null;
let playbackTimer = null;

let tabActiva = 'hoy';
let rutaSeleccionadaId = null;
let adminIds = [];
let supabaseRutasCache = [];

// Estado de grabación GPS real
let grabacionActiva = false;
let grabacionWatchId = null;
let grabacionTimer = null;
let grabacionInicioTs = null;
let grabacionPuntos = [];
let grabacionPolyline = null;

// Estado de trazado manual en el mapa histórico
let modoTrazoActivo = false;
let trazoPuntos = [];

function escRutaHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function haversineMetros(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcularDistanciaKm(puntos) {
  if (!Array.isArray(puntos) || puntos.length < 2) return 0;
  let metros = 0;
  for (let i = 1; i < puntos.length; i++) {
    metros += haversineMetros(
      Number(puntos[i - 1].lat), Number(puntos[i - 1].lng),
      Number(puntos[i].lat), Number(puntos[i].lng)
    );
  }
  return Number((metros / 1000).toFixed(2));
}

function generarRutasBaseCartagena() {
  const ahora = Date.now();
  const h = 3600 * 1000;
  const d = 24 * h;

  const r1Puntos = [
    { lat: 10.39991, lng: -75.47886, etiqueta: 'Casa Chapacuá (Salida)', ts: ahora - 2 * h },
    { lat: 10.40028, lng: -75.47850, ts: ahora - 2 * h + 180000 },
    { lat: 10.40068, lng: -75.47812, ts: ahora - 2 * h + 360000 },
    { lat: 10.40105, lng: -75.47775, etiqueta: 'Parque de Chapacuá', ts: ahora - 2 * h + 600000 },
    { lat: 10.40152, lng: -75.47718, etiqueta: 'Droguería Chapacuá', ts: ahora - 2 * h + 900000 },
    { lat: 10.40088, lng: -75.47792, ts: ahora - 2 * h + 1200000 },
    { lat: 10.39991, lng: -75.47886, etiqueta: 'Casa Chapacuá (Llegada)', ts: ahora - 2 * h + 1500000 }
  ];

  const r2Puntos = [
    { lat: 10.39991, lng: -75.47886, etiqueta: 'Casa Chapacuá', ts: ahora - 2 * d },
    { lat: 10.40080, lng: -75.48350, ts: ahora - 2 * d + 300000 },
    { lat: 10.40140, lng: -75.48920, ts: ahora - 2 * d + 600000 },
    { lat: 10.40095, lng: -75.49580, ts: ahora - 2 * d + 900000 },
    { lat: 10.40021, lng: -75.50284, etiqueta: 'Clínica Blas de Lezo', ts: ahora - 2 * d + 1320000 }
  ];

  const r3Puntos = [
    { lat: 10.39991, lng: -75.47886, etiqueta: 'Casa Chapacuá', ts: ahora - 5 * d },
    { lat: 10.39820, lng: -75.48390, ts: ahora - 5 * d + 360000 },
    { lat: 10.39640, lng: -75.48980, ts: ahora - 5 * d + 780000 },
    { lat: 10.39512, lng: -75.49524, etiqueta: 'Hospital Universitario del Caribe (HUC)', ts: ahora - 5 * d + 1200000 }
  ];

  const r4Puntos = [
    { lat: 10.39991, lng: -75.47886, etiqueta: 'Casa Chapacuá', ts: ahora - 14 * d },
    { lat: 10.39480, lng: -75.47890, ts: ahora - 14 * d + 420000 },
    { lat: 10.38870, lng: -75.47890, etiqueta: 'Clínica Gestión Salud (San Fernando)', ts: ahora - 14 * d + 960000 },
    { lat: 10.39460, lng: -75.47895, ts: ahora - 14 * d + 1600000 },
    { lat: 10.39991, lng: -75.47886, etiqueta: 'Regreso a Casa', ts: ahora - 14 * d + 2100000 }
  ];

  return [
    {
      id: 'ruta-base-hoy-1',
      nombre: 'Caminata Chapacuá — Parque y Droguería',
      distancia_km: calcularDistanciaKm(r1Puntos),
      tiempo_min: 25,
      glucosa_promedio: 118,
      glucosa_max: 126,
      glucosa_min: 110,
      estado: 'completada',
      origen: 'local_base',
      ts: ahora - 2 * h,
      fecha: new Date(ahora - 2 * h).toLocaleDateString('en-CA'),
      puntos: r1Puntos
    },
    {
      id: 'ruta-base-sem-1',
      nombre: 'Control Médico — Clínica Blas de Lezo',
      distancia_km: calcularDistanciaKm(r2Puntos),
      tiempo_min: 22,
      glucosa_promedio: 132,
      glucosa_max: 146,
      glucosa_min: 118,
      estado: 'completada',
      origen: 'local_base',
      ts: ahora - 2 * d,
      fecha: new Date(ahora - 2 * d).toLocaleDateString('en-CA'),
      puntos: r2Puntos
    },
    {
      id: 'ruta-base-sem-2',
      nombre: 'Laboratorio Clínico — Hospital Universitario (HUC)',
      distancia_km: calcularDistanciaKm(r3Puntos),
      tiempo_min: 20,
      glucosa_promedio: 115,
      glucosa_max: 124,
      glucosa_min: 108,
      estado: 'completada',
      origen: 'local_base',
      ts: ahora - 5 * d,
      fecha: new Date(ahora - 5 * d).toLocaleDateString('en-CA'),
      puntos: r3Puntos
    },
    {
      id: 'ruta-base-mes-1',
      nombre: 'Retiro Medicamentos EPS — San Fernando',
      distancia_km: calcularDistanciaKm(r4Puntos),
      tiempo_min: 35,
      glucosa_promedio: 128,
      glucosa_max: 139,
      glucosa_min: 116,
      estado: 'completada',
      origen: 'local_base',
      ts: ahora - 14 * d,
      fecha: new Date(ahora - 14 * d).toLocaleDateString('en-CA'),
      puntos: r4Puntos
    }
  ];
}

function cargarRutasLocales() {
  try {
    const raw = localStorage.getItem(RUTAS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  const base = generarRutasBaseCartagena();
  guardarRutasLocales(base);
  return base;
}

function guardarRutasLocales(rutas) {
  try {
    localStorage.setItem(RUTAS_STORAGE_KEY, JSON.stringify(rutas));
  } catch (_) {}
}

function obtenerTodasLasRutasCombinadas() {
  const locales = cargarRutasLocales();
  const mapa = new Map();
  locales.forEach(r => mapa.set(String(r.id), r));
  supabaseRutasCache.forEach(r => mapa.set(String(r.id), r));
  return Array.from(mapa.values()).sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

function calcularDesde(periodo) {
  const ahora = new Date();
  if (periodo === 'hoy') {
    const inicio = new Date(ahora);
    inicio.setHours(0, 0, 0, 0);
    return inicio.getTime();
  }
  if (periodo === 'semana' || periodo === '7dias') {
    return ahora.getTime() - 7 * 24 * 3600 * 1000;
  }
  if (periodo === 'mes' || periodo === '30dias') {
    return ahora.getTime() - 30 * 24 * 3600 * 1000;
  }
  return 0;
}

function filtrarRutasPorPeriodo(periodo) {
  const desdeTs = calcularDesde(periodo);
  return obtenerTodasLasRutasCombinadas().filter(r => {
    const ts = r.ts || (r.created_at ? new Date(r.created_at).getTime() : Date.now());
    return ts >= desdeTs;
  });
}

// ============ RUTEO POR CALLES REALES (OSRM con fallback automático) ============
async function obtenerRutaPorCallesOSRM(waypoints, perfil = 'driving') {
  if (!Array.isArray(waypoints) || waypoints.length < 2) return waypoints;
  try {
    const coordsStr = waypoints.map(p => `${Number(p.lng).toFixed(6)},${Number(p.lat).toFixed(6)}`).join(';');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const url = `https://router.project-osrm.org/route/v1/${perfil}/${coordsStr}?overview=full&geometries=geojson`;
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) return waypoints;
    const data = await resp.json();
    const coords = data?.routes?.[0]?.geometry?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      const startTs = waypoints[0].ts || Date.now();
      return coords.map(([lng, lat], idx) => ({
        lat,
        lng,
        ts: startTs + idx * 15000
      }));
    }
  } catch (_) {}
  return waypoints;
}

// ============ GUARDAR NUEVA RUTA (LOCAL + SUPABASE) ============
async function guardarNuevaRutaHistorica({ nombre, puntos, tiempoMin = null, glucosaPromedio = null, origen = 'gps_grabado' }) {
  if (!Array.isArray(puntos) || puntos.length < 2) {
    throw new Error('Se necesitan al menos 2 puntos GPS para guardar una ruta.');
  }

  const puntosNorm = puntos.map((p, idx) => ({
    lat: Number(p.lat ?? p[0]),
    lng: Number(p.lng ?? p[1]),
    etiqueta: p.etiqueta || (idx === 0 ? 'Inicio' : (idx === puntos.length - 1 ? 'Fin' : '')),
    ts: p.ts || Date.now()
  }));

  const distKm = calcularDistanciaKm(puntosNorm);
  const durMin = tiempoMin != null
    ? Math.max(1, Math.round(tiempoMin))
    : Math.max(1, Math.round((puntosNorm[puntosNorm.length - 1].ts - puntosNorm[0].ts) / 60000) || Math.ceil(distKm * 12));

  const resClin = window.casoEstudio?.obtenerResumenClinicoActual?.();
  const gProm = glucosaPromedio ?? resClin?.ultimaGlucosa?.valor ?? 116;

  const nuevaRuta = {
    id: 'ruta-' + Date.now(),
    nombre: (nombre || '').trim() || `Recorrido GPS · ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`,
    distancia_km: distKm,
    tiempo_min: durMin,
    glucosa_promedio: gProm,
    glucosa_max: gProm,
    glucosa_min: gProm,
    estado: 'completada',
    origen,
    ts: Date.now(),
    fecha: new Date().toLocaleDateString('en-CA'),
    puntos: puntosNorm
  };

  // 1. Guardar inmediatamente en localStorage
  const locales = cargarRutasLocales();
  locales.unshift(nuevaRuta);
  guardarRutasLocales(locales);

  // 2. Intentar sincronizar en Supabase si hay sesión autenticada real
  if (typeof supabaseClient !== 'undefined' && supabaseClient?.auth) {
    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        const { data: rutaDB, error: errRuta } = await supabaseClient
          .from('rutas')
          .insert({
            user_id: user.id,
            nombre: nuevaRuta.nombre,
            distancia_km: nuevaRuta.distancia_km,
            tiempo_min: nuevaRuta.tiempo_min,
            glucosa_promedio: nuevaRuta.glucosa_promedio,
            glucosa_max: nuevaRuta.glucosa_max,
            glucosa_min: nuevaRuta.glucosa_min,
            fecha: nuevaRuta.fecha,
            estado: 'completada'
          })
          .select('id')
          .single();

        if (!errRuta && rutaDB?.id) {
          const filasGps = puntosNorm.map(pt => ({
            user_id: user.id,
            ruta_id: rutaDB.id,
            lat: pt.lat,
            lng: pt.lng,
            ts: new Date(pt.ts).toISOString()
          }));
          await supabaseClient.from('gps_lecturas').insert(filasGps);
        }
      }
    } catch (_) {}
  }

  // Seleccionar la ruta recién guardada y refrescar vista en Hoy
  tabActiva = 'hoy';
  rutaSeleccionadaId = nuevaRuta.id;
  actualizarTabsActivasUI('hoy');
  renderizarHistorialPeriodo('hoy');

  if (window.mostrarNotificacion) {
    window.mostrarNotificacion(`Ruta guardada: "${nuevaRuta.nombre}" (${distKm} km · ${puntosNorm.length} puntos).`, 'success');
  }

  return nuevaRuta;
}

function eliminarRutaHistorica(rutaId) {
  const locales = cargarRutasLocales().filter(r => String(r.id) !== String(rutaId));
  guardarRutasLocales(locales);
  supabaseRutasCache = supabaseRutasCache.filter(r => String(r.id) !== String(rutaId));
  if (String(rutaSeleccionadaId) === String(rutaId)) {
    rutaSeleccionadaId = null;
  }
  detenerReproduccionRuta();
  renderizarHistorialPeriodo(tabActiva);
  if (window.mostrarNotificacion) {
    window.mostrarNotificacion('Recorrido eliminado del historial local.', 'info');
  }
}

// ============ RENDERIZADO DEL MAPA HISTÓRICO Y LISTA DE RUTAS ============
function actualizarTabsActivasUI(periodo) {
  document.querySelectorAll('.history-tabs .tab').forEach(btn => {
    const activo = btn.dataset.type === periodo;
    btn.classList.toggle('active', activo);
    btn.setAttribute('aria-selected', String(activo));
  });
}

function detenerReproduccionRuta() {
  if (playbackTimer) {
    clearInterval(playbackTimer);
    playbackTimer = null;
  }
  if (playbackMarker && historyMap) {
    historyMap.removeLayer(playbackMarker);
    playbackMarker = null;
  }
}

function reproducirRutaHistorica(rutaId) {
  const ruta = obtenerTodasLasRutasCombinadas().find(r => String(r.id) === String(rutaId));
  if (!ruta || !ruta.puntos || ruta.puntos.length < 2 || !historyMap) return;

  rutaSeleccionadaId = ruta.id;
  renderizarHistorialPeriodo(tabActiva);
  detenerReproduccionRuta();

  const pts = ruta.puntos;
  let idx = 0;

  const iconPlay = L.divIcon({
    className: 'dm-playback-pin',
    html: '<div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#0d9488,#0284c7);color:#fff;border:3px solid #fff;box-shadow:0 3px 12px rgba(13,148,136,0.65);display:flex;align-items:center;justify-content:center;font-size:11px;"><i class="fas fa-walking"></i></div>',
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });

  playbackMarker = L.marker([pts[0].lat, pts[0].lng], { icon: iconPlay, zIndexOffset: 1000 })
    .bindTooltip(`Reproduciendo: ${escRutaHtml(ruta.nombre)}`, { direction: 'top' })
    .addTo(historyMap);

  if (window.mostrarNotificacion) {
    window.mostrarNotificacion(`Reproduciendo recorrido: ${ruta.nombre}`, 'info');
  }

  playbackTimer = setInterval(() => {
    idx++;
    if (idx >= pts.length) {
      detenerReproduccionRuta();
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion(`Recorrido completado: ${ruta.nombre} (${ruta.distancia_km} km).`, 'success');
      }
      return;
    }
    const p = pts[idx];
    if (playbackMarker) {
      playbackMarker.setLatLng([p.lat, p.lng]);
      historyMap.panTo([p.lat, p.lng], { animate: true, duration: 0.45 });
    }
  }, 550);
}

function renderizarHistorialPeriodo(periodo = tabActiva) {
  tabActiva = periodo;
  if (!historyMap || !historyLayerGroup) return;

  detenerReproduccionRuta();
  historyLayerGroup.clearLayers();

  const rutas = filtrarRutasPorPeriodo(periodo);
  const emptyEl = document.getElementById('historyEmpty');
  const msgEl = document.getElementById('historyEmptyMsg');
  const puntosEl = document.getElementById('historyPuntos');
  const rutasEl = document.getElementById('historyRutas');
  const distEl = document.getElementById('historyDistancia');
  const tiempoEl = document.getElementById('historyTiempo');
  const listaEl = document.getElementById('historyRoutesList');

  if (rutas.length === 0) {
    if (emptyEl) emptyEl.style.display = 'flex';
    if (msgEl) msgEl.textContent = 'Sin recorridos registrados en este período. Graba o traza una ruta nueva.';
    if (puntosEl) puntosEl.textContent = '0';
    if (rutasEl) rutasEl.textContent = '0';
    if (distEl) distEl.textContent = '0 km';
    if (tiempoEl) tiempoEl.textContent = '0 min';
    if (listaEl) {
      listaEl.innerHTML = '<div style="text-align:center; padding:16px; font-size:12.5px; color:#64748b;">No hay recorridos en este período. Usa <strong>Grabar GPS</strong> o <strong>Trazar en Mapa</strong> para crear uno real.</div>';
    }
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  // Si la ruta seleccionada no pertenece a este periodo, mostrar todas
  const rutaEnPeriodo = rutas.some(r => String(r.id) === String(rutaSeleccionadaId));
  if (!rutaEnPeriodo) rutaSeleccionadaId = null;

  const rutasADibujar = rutaSeleccionadaId
    ? rutas.filter(r => String(r.id) === String(rutaSeleccionadaId))
    : rutas;

  const allBounds = [];
  let totalPuntos = 0;
  let totalKm = 0;
  let totalMin = 0;

  rutas.forEach(r => {
    totalPuntos += (r.puntos || []).length;
    totalKm += Number(r.distancia_km) || 0;
    totalMin += Number(r.tiempo_min) || 0;
  });

  rutasADibujar.forEach((ruta, idx) => {
    const pts = (ruta.puntos || []).filter(p => p && !isNaN(Number(p.lat)) && !isNaN(Number(p.lng)));
    if (pts.length < 2) return;

    const color = COLORES_RUTA[idx % COLORES_RUTA.length];
    const latlngs = pts.map(p => [Number(p.lat), Number(p.lng)]);
    allBounds.push(...latlngs);

    const poly = L.polyline(latlngs, {
      color,
      weight: rutaSeleccionadaId ? 5 : 4,
      opacity: 0.92,
      lineCap: 'round',
      lineJoin: 'round'
    }).bindPopup(`
      <div style="font-family:'Inter',sans-serif; font-size:12.5px; min-width:190px;">
        <strong style="color:#0f172a;">${escRutaHtml(ruta.nombre)}</strong><br>
        <span style="color:#475569;">Distancia: <strong>${ruta.distancia_km} km</strong> · Duración: <strong>${ruta.tiempo_min} min</strong></span><br>
        <span style="color:#64748b; font-size:11px;">${pts.length} puntos GPS · ${ruta.fecha || ''}</span>
      </div>
    `).addTo(historyLayerGroup);

    poly.on('click', () => {
      rutaSeleccionadaId = ruta.id;
      renderizarHistorialPeriodo(tabActiva);
    });

    // Marcador inicio (verde)
    L.circleMarker(latlngs[0], {
      radius: 7,
      color: '#ffffff',
      fillColor: '#16a34a',
      fillOpacity: 1,
      weight: 2.5
    }).bindTooltip(`Inicio: ${escRutaHtml(pts[0].etiqueta || ruta.nombre)}`, { direction: 'top' }).addTo(historyLayerGroup);

    // Marcador fin (rojo)
    const fin = latlngs[latlngs.length - 1];
    L.circleMarker(fin, {
      radius: 7,
      color: '#ffffff',
      fillColor: '#dc2626',
      fillOpacity: 1,
      weight: 2.5
    }).bindTooltip(`Fin: ${escRutaHtml(pts[pts.length - 1].etiqueta || ruta.nombre)}`, { direction: 'top' }).addTo(historyLayerGroup);
  });

  if (puntosEl) puntosEl.textContent = String(totalPuntos);
  if (rutasEl) rutasEl.textContent = String(rutas.length);
  if (distEl) distEl.textContent = `${totalKm.toFixed(2)} km`;
  if (tiempoEl) tiempoEl.textContent = `${totalMin} min`;

  // Ajustar cámara si el mapa es visible
  if (allBounds.length > 0) {
    historyMap._ultimoBounds = L.latLngBounds(allBounds);
    const mapContainer = document.getElementById('historyMap');
    if (mapContainer && mapContainer.offsetWidth > 0 && mapContainer.offsetHeight > 0) {
      historyMap.invalidateSize(true);
      historyMap.fitBounds(historyMap._ultimoBounds, { padding: [28, 28], maxZoom: 17 });
    }
  }

  // Renderizar lista interactiva de rutas del período
  if (listaEl) {
    listaEl.innerHTML = `
      ${rutaSeleccionadaId ? `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:6px 10px; background:#f0fdfa; border:1px solid #99f6e4; border-radius:8px; font-size:12px;">
          <span style="color:#0f766e; font-weight:700;"><i class="fas fa-filter"></i> Viendo 1 recorrido seleccionado</span>
          <button type="button" onclick="window.DiaMonRutasHistoricas.verTodas()" style="background:#0d9488; color:#fff; border:none; border-radius:6px; padding:4px 10px; font-size:11.5px; font-weight:700; cursor:pointer;">
            Ver todas (${rutas.length})
          </button>
        </div>
      ` : ''}
      ${rutas.map((r, idx) => {
        const activa = String(r.id) === String(rutaSeleccionadaId);
        const color = COLORES_RUTA[idx % COLORES_RUTA.length];
        const fechaTxt = new Date(r.ts || Date.now()).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
        const horaTxt = new Date(r.ts || Date.now()).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:10px 12px; border-radius:11px; border:1.5px solid ${activa ? '#0d9488' : '#e2e8f0'}; background:${activa ? '#f0fdfa' : '#f8fafc'}; margin-bottom:8px; cursor:pointer; transition:all 0.15s;"
               onclick="window.DiaMonRutasHistoricas.seleccionarRuta('${escRutaHtml(r.id)}')">
            <div style="display:flex; align-items:center; gap:10px; min-width:0; flex:1;">
              <span style="width:12px; height:12px; border-radius:50%; background:${color}; flex-shrink:0;"></span>
              <div style="min-width:0;">
                <div style="font-size:13px; font-weight:700; color:#0f172a; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escRutaHtml(r.nombre)}</div>
                <div style="font-size:11.5px; color:#64748b;">
                  ${fechaTxt} · ${horaTxt} · <strong>${r.distancia_km} km</strong> · ${r.tiempo_min} min · ${(r.puntos || []).length} pts
                </div>
              </div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;" onclick="event.stopPropagation();">
              <button type="button" onclick="window.DiaMonRutasHistoricas.reproducir('${escRutaHtml(r.id)}')" title="Reproducir recorrido en el mapa"
                      style="background:linear-gradient(135deg,#0d9488,#0284c7); color:#fff; border:none; border-radius:8px; padding:6px 10px; font-size:11.5px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
                <i class="fas fa-play"></i> Ver
              </button>
              <button type="button" onclick="window.DiaMonRutasHistoricas.eliminar('${escRutaHtml(r.id)}')" title="Eliminar recorrido"
                      style="background:#fff; color:#dc2626; border:1px solid #fecaca; border-radius:8px; padding:6px 8px; font-size:11.5px; cursor:pointer;">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>
        `;
      }).join('')}
    `;
  }
}

// ============ GRABADOR REAL DE RECORRIDO GPS EN VIVO ============
function actualizarBarraGrabacionUI() {
  const btn = document.getElementById('btnGrabarRutaGPS');
  const statusBar = document.getElementById('historyRecorderStatus');
  if (btn) {
    if (grabacionActiva) {
      btn.style.background = '#dc2626';
      btn.innerHTML = '<i class="fas fa-stop-circle"></i> Detener y Guardar Ruta';
    } else {
      btn.style.background = 'linear-gradient(135deg, #0d9488, #0284c7)';
      btn.innerHTML = '<i class="fas fa-record-vinyl"></i> Grabar Recorrido GPS';
    }
  }
  if (statusBar) {
    if (!grabacionActiva) {
      statusBar.style.display = 'none';
      return;
    }
    const seg = Math.floor((Date.now() - (grabacionInicioTs || Date.now())) / 1000);
    const mm = String(Math.floor(seg / 60)).padStart(2, '0');
    const ss = String(seg % 60).padStart(2, '0');
    const km = calcularDistanciaKm(grabacionPuntos);
    statusBar.style.display = 'flex';
    statusBar.innerHTML = `
      <span><i class="fas fa-circle" style="color:#ef4444; font-size:9px;"></i> <strong>Grabando GPS en vivo</strong> · ${mm}:${ss} · ${grabacionPuntos.length} punto(s) · ${km} km</span>
      <span style="font-size:11px; opacity:0.9;">También puedes hacer clic en el mapa para añadir puntos</span>
    `;
  }
}

function agregarPuntoAGrabacion(lat, lng, etiqueta = '') {
  if (!grabacionActiva) return;
  const ultimo = grabacionPuntos[grabacionPuntos.length - 1];
  if (ultimo && haversineMetros(ultimo.lat, ultimo.lng, lat, lng) < 3) return;

  grabacionPuntos.push({ lat: Number(lat), lng: Number(lng), etiqueta, ts: Date.now() });

  if (historyMap && drawLayerGroup) {
    if (!grabacionPolyline) {
      grabacionPolyline = L.polyline([], { color: '#ef4444', weight: 4, dashArray: '6,6' }).addTo(drawLayerGroup);
    }
    grabacionPolyline.setLatLngs(grabacionPuntos.map(p => [p.lat, p.lng]));
    L.circleMarker([lat, lng], { radius: 5, color: '#fff', fillColor: '#ef4444', fillOpacity: 1, weight: 2 }).addTo(drawLayerGroup);
    historyMap.panTo([lat, lng], { animate: true });
  }
  actualizarBarraGrabacionUI();
}

async function toggleGrabacionRutaGPS() {
  if (grabacionActiva) {
    // Detener y guardar
    grabacionActiva = false;
    if (grabacionWatchId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(grabacionWatchId);
      grabacionWatchId = null;
    }
    if (grabacionTimer) {
      clearInterval(grabacionTimer);
      grabacionTimer = null;
    }

    const durMin = Math.max(1, Math.round((Date.now() - (grabacionInicioTs || Date.now())) / 60000));
    const puntosCapturados = [...grabacionPuntos];
    grabacionPuntos = [];
    grabacionPolyline = null;
    if (drawLayerGroup) drawLayerGroup.clearLayers();
    actualizarBarraGrabacionUI();

    if (puntosCapturados.length < 2) {
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion('Se necesitan al menos 2 puntos distintos para guardar la ruta. Camina unos metros o haz clic en el mapa.', 'warn');
      }
      return;
    }

    const rutaPorCalles = puntosCapturados.length <= 8
      ? await obtenerRutaPorCallesOSRM(puntosCapturados, 'foot')
      : puntosCapturados;

    await guardarNuevaRutaHistorica({
      nombre: `Recorrido GPS Real · ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`,
      puntos: rutaPorCalles,
      tiempoMin: durMin,
      origen: 'gps_grabado'
    });
    return;
  }

  // Iniciar grabación
  if (modoTrazoActivo) toggleModoTrazoManual(false);
  grabacionActiva = true;
  grabacionInicioTs = Date.now();
  grabacionPuntos = [];
  if (drawLayerGroup) drawLayerGroup.clearLayers();
  grabacionPolyline = null;

  // Punto inicial inmediato si ya hay GPS fijado
  if (window.TelemetriaDiaMon?.ubicacion) {
    agregarPuntoAGrabacion(
      window.TelemetriaDiaMon.ubicacion.lat,
      window.TelemetriaDiaMon.ubicacion.lng,
      'Punto de inicio'
    );
  }

  if ('geolocation' in navigator) {
    grabacionWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        agregarPuntoAGrabacion(pos.coords.latitude, pos.coords.longitude);
        if (typeof window.actualizarMarcadorUbicacionReal === 'function') {
          window.actualizarMarcadorUbicacionReal(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        }
      },
      (err) => console.warn('GPS grabación:', err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 }
    );
  }

  grabacionTimer = setInterval(actualizarBarraGrabacionUI, 1000);
  actualizarBarraGrabacionUI();

  if (window.mostrarNotificacion) {
    window.mostrarNotificacion('Grabación GPS iniciada. Muévete o haz clic en el mapa para registrar puntos.', 'success');
  }
}

// ============ TRAZADO MANUAL POR CALLES EN EL MAPA HISTÓRICO ============
function toggleModoTrazoManual(forzar) {
  modoTrazoActivo = typeof forzar === 'boolean' ? forzar : !modoTrazoActivo;
  const btn = document.getElementById('btnTrazarRutaMapa');
  const barraTrazo = document.getElementById('historyDrawToolbar');

  if (modoTrazoActivo) {
    if (grabacionActiva) toggleGrabacionRutaGPS();
    trazoPuntos = [];
    if (drawLayerGroup) drawLayerGroup.clearLayers();
    if (btn) {
      btn.style.background = '#0f766e';
      btn.style.color = '#ffffff';
      btn.innerHTML = '<i class="fas fa-times"></i> Cancelar Trazo';
    }
    if (barraTrazo) barraTrazo.style.display = 'flex';
    if (window.mostrarNotificacion) {
      window.mostrarNotificacion('Modo trazo activo: haz clic en 2 o más puntos del mapa y pulsa "Guardar Ruta".', 'info');
    }
  } else {
    trazoPuntos = [];
    if (drawLayerGroup) drawLayerGroup.clearLayers();
    if (btn) {
      btn.style.background = '#ffffff';
      btn.style.color = '#0f172a';
      btn.innerHTML = '<i class="fas fa-route"></i> Trazar en Mapa';
    }
    if (barraTrazo) barraTrazo.style.display = 'none';
  }
  actualizarContadorTrazo();
}

function actualizarContadorTrazo() {
  const el = document.getElementById('historyDrawCount');
  if (el) {
    const km = calcularDistanciaKm(trazoPuntos);
    el.textContent = `${trazoPuntos.length} punto(s) · ${km} km`;
  }
}

function agregarPuntoTrazoManual(lat, lng) {
  if (!modoTrazoActivo || !drawLayerGroup) return;
  trazoPuntos.push({ lat: Number(lat), lng: Number(lng), ts: Date.now() });
  drawLayerGroup.clearLayers();

  if (trazoPuntos.length >= 2) {
    L.polyline(trazoPuntos.map(p => [p.lat, p.lng]), {
      color: '#0284c7',
      weight: 4,
      dashArray: '8, 6'
    }).addTo(drawLayerGroup);
  }
  trazoPuntos.forEach((p, idx) => {
    L.circleMarker([p.lat, p.lng], {
      radius: 6,
      color: '#ffffff',
      fillColor: idx === 0 ? '#16a34a' : '#0284c7',
      fillOpacity: 1,
      weight: 2
    }).bindTooltip(`Punto ${idx + 1}`).addTo(drawLayerGroup);
  });
  actualizarContadorTrazo();
}

async function guardarTrazoManualComoRuta() {
  if (trazoPuntos.length < 2) {
    if (window.mostrarNotificacion) {
      window.mostrarNotificacion('Marca al menos 2 puntos en el mapa antes de guardar.', 'warn');
    }
    return;
  }
  const inputNombre = document.getElementById('historyDrawName');
  const nombre = inputNombre?.value?.trim() || `Ruta trazada · ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
  const puntosCalles = await obtenerRutaPorCallesOSRM(trazoPuntos, 'driving');

  await guardarNuevaRutaHistorica({
    nombre,
    puntos: puntosCalles,
    origen: 'trazo_manual'
  });

  if (inputNombre) inputNombre.value = '';
  toggleModoTrazoManual(false);
}

// ============ CARGAR RUTAS REALES DESDE SUPABASE (SI HAY SESIÓN) ============
async function cargarHistorialSupabase() {
  if (typeof supabaseClient === 'undefined' || !supabaseClient || adminIds.length === 0) return;

  try {
    const { data: rutas, error: rutasError } = await supabaseClient
      .from('rutas')
      .select('id, nombre, distancia_km, tiempo_min, glucosa_promedio, glucosa_max, glucosa_min, fecha, estado, created_at')
      .in('user_id', adminIds)
      .order('created_at', { ascending: false })
      .limit(30);

    if (rutasError || !rutas || rutas.length === 0) return;

    const rutaIds = rutas.map(r => r.id);
    const { data: puntos } = await supabaseClient
      .from('gps_lecturas')
      .select('lat, lng, ts, ruta_id')
      .in('ruta_id', rutaIds)
      .order('ts', { ascending: true });

    const puntosPorRuta = new Map();
    (puntos || []).forEach(p => {
      const k = String(p.ruta_id);
      if (!puntosPorRuta.has(k)) puntosPorRuta.set(k, []);
      puntosPorRuta.get(k).push({
        lat: Number(p.lat),
        lng: Number(p.lng),
        ts: p.ts ? new Date(p.ts).getTime() : Date.now()
      });
    });

    supabaseRutasCache = rutas
      .map(r => {
        const pts = puntosPorRuta.get(String(r.id)) || [];
        return {
          ...r,
          id: `sb-${r.id}`,
          distancia_km: r.distancia_km != null ? Number(r.distancia_km) : calcularDistanciaKm(pts),
          tiempo_min: r.tiempo_min || 15,
          origen: 'supabase',
          ts: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
          puntos: pts
        };
      })
      .filter(r => r.puntos.length >= 2);

    renderizarHistorialPeriodo(tabActiva);
  } catch (err) {
    console.warn('Error sincronizando rutas Supabase:', err);
  }
}

// ============ INICIALIZACIÓN DEL MAPA HISTÓRICO ============
document.addEventListener('DOMContentLoaded', () => {
  const historyMapEl = document.getElementById('historyMap');
  if (!historyMapEl || typeof L === 'undefined') return;

  historyMap = L.map('historyMap', {
    zoomControl: true,
    attributionControl: false,
    dragging: true,
    scrollWheelZoom: true,
    touchZoom: true
  }).setView([10.39991, -75.47886], 15);

  L.tileLayer(TILE_URL, { attribution: TILE_ATTR, subdomains: 'abc', maxZoom: 19 }).addTo(historyMap);
  historyLayerGroup = L.layerGroup().addTo(historyMap);
  drawLayerGroup = L.layerGroup().addTo(historyMap);
  window.historyMapInstance = historyMap;

  // Clic en el mapa histórico: añade punto si estamos grabando o trazando
  historyMap.on('click', (e) => {
    if (grabacionActiva) {
      agregarPuntoAGrabacion(e.latlng.lat, e.latlng.lng);
    } else if (modoTrazoActivo) {
      agregarPuntoTrazoManual(e.latlng.lat, e.latlng.lng);
    }
  });

  // Tabs reales: Hoy / Últimos 7 días / Último mes
  document.querySelectorAll('.history-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const periodo = tab.dataset.type || 'hoy';
      rutaSeleccionadaId = null;
      actualizarTabsActivasUI(periodo);
      renderizarHistorialPeriodo(periodo);
    });
  });

  // Render inicial real inmediato
  renderizarHistorialPeriodo('hoy');

  // Observer para re-ajustar zoom cuando #view-mapa se vuelve visible
  const viewMapa = document.getElementById('view-mapa');
  if (viewMapa && typeof MutationObserver !== 'undefined') {
    const obs = new MutationObserver(() => {
      if (viewMapa.classList.contains('active')) {
        refrescarVistaMapaHistorico();
      }
    });
    obs.observe(viewMapa, { attributes: true, attributeFilter: ['class'] });
  }
});

function refrescarVistaMapaHistorico() {
  if (!historyMap) return;
  const ajustar = () => {
    historyMap.invalidateSize(true);
    if (historyMap._ultimoBounds && historyMap._ultimoBounds.isValid()) {
      historyMap.fitBounds(historyMap._ultimoBounds, { padding: [28, 28], maxZoom: 17 });
    }
  };
  setTimeout(ajustar, 80);
  setTimeout(ajustar, 260);
}

// Exponer API global para controles HTML, mapa principal, SafeWalk y historial.html
window.DiaMonRutasHistoricas = {
  obtenerTodas: obtenerTodasLasRutasCombinadas,
  filtrarPorPeriodo: filtrarRutasPorPeriodo,
  renderizarPeriodo: renderizarHistorialPeriodo,
  refrescarMapaVista: refrescarVistaMapaHistorico,
  guardarNuevaRuta: guardarNuevaRutaHistorica,
  obtenerRutaPorCallesOSRM,
  toggleGrabacionGPS: toggleGrabacionRutaGPS,
  toggleModoTrazo: toggleModoTrazoManual,
  guardarTrazoManual: guardarTrazoManualComoRuta,
  reproducir: reproducirRutaHistorica,
  eliminar: eliminarRutaHistorica,
  seleccionarRuta: (id) => {
    rutaSeleccionadaId = id;
    renderizarHistorialPeriodo(tabActiva);
  },
  verTodas: () => {
    rutaSeleccionadaId = null;
    renderizarHistorialPeriodo(tabActiva);
  }
};

// ============ CARGA DE DATOS TRAS AUTH (SUPABASE) ============
document.addEventListener('dashboardListo', async (e) => {
  const userId = e.detail?.user?.id;
  if (!userId || typeof supabaseClient === 'undefined') return;

  const rol = document.body.dataset.rol;

  try {
    if (rol === 'cuidador') {
      const { data: vincs } = await supabaseClient
        .from('vinculaciones')
        .select('monitoreado_id')
        .eq('cuidador_id', userId)
        .eq('estado', 'activa');
      adminIds = vincs?.map(v => v.monitoreado_id) || [userId];
    } else {
      const { data: admins } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('rol', 'admin');
      const ids = admins?.map(a => a.id) || [];
      adminIds = Array.from(new Set([userId, ...ids]));
    }

    await cargarHistorialSupabase();

    const targetUserId = (rol === 'cuidador' && adminIds.length > 0) ? adminIds[0] : userId;
    cargarLecturasRecientes(targetUserId);
  } catch (_) {}
});

// ============ PANEL GLUCOSA — PULSE RING ============
function actualizarPulso(valor) {
  const pulseEl = document.getElementById('glucosePulse');
  const valueEl = document.getElementById('glucoseValue');
  const labelEl = document.getElementById('glucoseLabel');
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
  if (typeof supabaseClient === 'undefined' || !supabaseClient) return;
  const { data } = await supabaseClient
    .from('glucosa_lecturas')
    .select('valor, ts')
    .eq('user_id', userId)
    .order('ts', { ascending: false })
    .limit(10);

  if (!data || data.length === 0) return;

  actualizarPulso(data[0].valor);

  if (data.length >= 2) {
    const delta = data[0].valor - data[1].valor;
    const deltaEl = document.getElementById('trendDelta');
    if (deltaEl) {
      deltaEl.textContent = (delta >= 0 ? '+' : '') + delta;
      deltaEl.className = 'trend-delta ' + (delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat');
    }
  }

  const readingsList = document.getElementById('readingsList');
  if (!readingsList) return;
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
}
