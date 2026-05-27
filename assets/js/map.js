// ============ MAPA INTERACTIVO CON FUNCIONALIDADES GPS ============

const cartagenaCenter = [10.3910, -75.4794];

function initializeGPSMap(userId) {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;

  // ========== INICIALIZACIÓN DEL MAPA ==========
  const map = L.map('map', {
    zoomControl: true,
    attributionControl: false
  }).setView(cartagenaCenter, 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Mapa © OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  // ========== ICONOS PERSONALIZADOS ==========
  const icons = {
    ambulance: L.divIcon({
      className: 'custom-icon ambulance-icon',
      html: '<span>🚑</span>',
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    }),
    clinic: L.divIcon({
      className: 'custom-icon clinic-icon',
      html: '<span>🏥</span>',
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    }),
  };

  // ========== ELEMENTOS DEL FORMULARIO ==========
  const form = {
    latitude: document.getElementById('mapLatitude'),
    longitude: document.getElementById('mapLongitude'),
    glucose: document.getElementById('mapGlucose'),
    status: document.getElementById('mapStatus'),
    type: document.getElementById('mapType'),
  };

  // ========== ELEMENTOS DE INFORMACIÓN ==========
  const info = {
    glucose: document.getElementById('mapInfoGlucose'),
    status: document.getElementById('mapInfoStatus'),
    type: document.getElementById('mapInfoType'),
  };

  // ========== BOTONES Y CONTROLES ==========
  const updateBtn = document.getElementById('mapUpdateBtn');
  const simulateBtn = document.getElementById('mapSimulateBtn');
  const stopBtn = document.getElementById('mapStopBtn');
  const speedInput = document.getElementById('mapSpeed');
  const routePoints = document.getElementById('mapRoutePoints');
  const routeModeBtn = document.getElementById('mapRouteModeBtn');
  const addRoutePointBtn = document.getElementById('mapAddRoutePointBtn');
  const clearRouteBtn = document.getElementById('mapClearRouteBtn');

  // ========== VARIABLES DE ESTADO ==========
  let routeModeActive = false;
  let routeMarkers = [];
  let routeAnimationActive = false;
  let route = [];

  // ========== ESTADO SUPABASE ==========
  let rutaActivaId = null;
  let realtimeChannel = null;
  let cachedAdminIds = [];
  let gpsPoints = [];

  // ========== BADGE DE ESTADO DE RUTA ==========
  function mostrarEstadoRuta(estado) {
    const badge = document.getElementById('gpsRouteBadge');
    const nombreEl = document.getElementById('gpsRouteName');
    if (!badge) return;
    const cfg = {
      cargando:      { texto: 'Cargando...', clase: 'badge-loading' },
      activa:        { texto: 'Ruta activa', clase: 'badge-active'  },
      sinRuta:       { texto: 'Sin ruta activa', clase: 'badge-idle' },
      error:         { texto: 'Error de conexión', clase: 'badge-error' },
      sincronizando: { texto: 'En tiempo real', clase: 'badge-live'  },
    }[estado] || { texto: 'Sin ruta activa', clase: 'badge-idle' };
    badge.textContent = cfg.texto;
    badge.className = `gps-route-badge ${cfg.clase}`;
  }

  // ========== FUNCIONES AUXILIARES ==========
  function medicalPopupContent(lat, lng) {
    return `
      <div style="font-size: 0.95rem; line-height: 1.4;">
        <strong>${form.type.value === 'ambulance' ? 'Ambulancia' : 'Clínica'}</strong><br>
        <strong>Lat:</strong> ${lat.toFixed(5)}<br>
        <strong>Lng:</strong> ${lng.toFixed(5)}<br>
        <strong>Glucosa:</strong> ${form.glucose.value} mg/dL<br>
        <strong>Estado:</strong> ${form.status.value}
      </div>
    `;
  }

  function updateInfoCard() {
    if (info.glucose) info.glucose.textContent = form.glucose.value;
    if (info.status) info.status.textContent = form.status.value;
    if (info.type) info.type.textContent = form.type.value === 'ambulance' ? 'Ambulancia' : 'Clínica';
  }

  function updateRouteTextarea() {
    if (routePoints) {
      routePoints.value = route.map(([lat, lng], index) =>
        `${index + 1}. ${lat.toFixed(5)}, ${lng.toFixed(5)}`
      ).join('\n');
    }
  }

  function updateRouteMarkers() {
    routeMarkers.forEach(m => map.removeLayer(m));
    routeMarkers = route.map(([lat, lng], index) => {
      return L.circleMarker([lat, lng], {
        radius: 6,
        color: '#0ea5e9',
        fillColor: '#fff',
        fillOpacity: 1,
        weight: 2,
      }).bindTooltip(`Punto ${index + 1}`, { permanent: false, direction: 'top' }).addTo(map);
    });
  }

  function drawRoute() {
    routeLine.setLatLngs(route);
    updateRouteMarkers();
  }

  function addPointToRoute(lat, lng) {
    route.push([lat, lng]);
    drawRoute();
    updateRouteTextarea();
  }

  function addCurrentPointToRoute() {
    const position = marker.getLatLng();
    addPointToRoute(position.lat, position.lng);
  }

  function clearRoute() {
    route = [];
    drawRoute();
    updateRouteTextarea();
  }

  function toggleRouteMode() {
    routeModeActive = !routeModeActive;
    if (routeModeBtn) {
      routeModeBtn.classList.toggle('active', routeModeActive);
      routeModeBtn.textContent = routeModeActive ? 'Modo ruta activado' : 'Marcar recorrido con clic';
    }
  }

  function getSimulatedRoute() {
    return [
      [10.3910, -75.4794],
      [10.3945, -75.4740],
      [10.3978, -75.4810],
      [10.4020, -75.4794],
      [10.3970, -75.4720],
      [10.3910, -75.4794],
    ];
  }

  function updateMarker() {
    const lat = parseFloat(form.latitude.value) || cartagenaCenter[0];
    const lng = parseFloat(form.longitude.value) || cartagenaCenter[1];
    const position = L.latLng(lat, lng);

    marker.setLatLng(position);
    marker.setIcon(icons[form.type.value]);
    marker.setPopupContent(medicalPopupContent(lat, lng)).openPopup();
    map.panTo(position, { animate: true, duration: 0.7 });
    updateInfoCard();
  }

  function animateSegment(start, end, durationMs) {
    return new Promise(resolve => {
      const startTime = performance.now();
      const startLat = start[0];
      const startLng = start[1];
      const deltaLat = end[0] - startLat;
      const deltaLng = end[1] - startLng;

      function step(now) {
        if (!routeAnimationActive) {
          return resolve(false);
        }

        const elapsed = now - startTime;
        const t = Math.min(elapsed / durationMs, 1);
        const lat = startLat + deltaLat * t;
        const lng = startLng + deltaLng * t;
        const position = L.latLng(lat, lng);
        marker.setLatLng(position);
        marker.setPopupContent(medicalPopupContent(lat, lng));
        map.panTo(position, { animate: false });

        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          resolve(true);
        }
      }

      requestAnimationFrame(step);
    });
  }

  async function startMovement() {
    if (routeAnimationActive || route.length < 2) return;
    routeAnimationActive = true;
    if (simulateBtn) simulateBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;

    if (!route.length) {
      route = getSimulatedRoute();
      drawRoute();
      updateRouteTextarea();
    }

    const intervalMs = Math.max(300, parseFloat(speedInput.value) * 1000);

    if (!marker.getLatLng().equals(L.latLng(route[0]))) {
      marker.setLatLng(route[0]);
      form.latitude.value = route[0][0].toFixed(5);
      form.longitude.value = route[0][1].toFixed(5);
      map.panTo(route[0], { animate: false });
    }

    for (let i = 1; i < route.length; i += 1) {
      if (!routeAnimationActive) break;
      const [lat, lng] = route[i];
      const moved = await animateSegment(route[i - 1], route[i], intervalMs);
      if (!moved) break;
      form.latitude.value = lat.toFixed(5);
      form.longitude.value = lng.toFixed(5);

      // Guardar punto en Supabase si hay una ruta activa
      if (rutaActivaId) {
        supabaseClient
          .from('gps_lecturas')
          .insert({
            user_id: userId,
            ruta_id: rutaActivaId,
            lat,
            lng,
            velocidad: parseFloat(speedInput?.value) || 0,
          })
          .then(({ error }) => {
            if (error) console.warn('No se pudo guardar punto GPS:', error.message);
          });
      }
    }

    routeAnimationActive = false;
    if (simulateBtn) simulateBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
  }

  function stopMovement() {
    routeAnimationActive = false;
    if (simulateBtn) simulateBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
  }

  // ========== INICIALIZACIÓN DEL MARCADOR ==========
  const marker = L.marker(cartagenaCenter, {
    icon: icons[form.type.value],
    draggable: true,
  }).addTo(map);

  const routeLine = L.polyline(route, {
    color: '#f97316',
    weight: 4,
    dashArray: '8 6',
  }).addTo(map);

  marker.bindPopup(medicalPopupContent(cartagenaCenter[0], cartagenaCenter[1])).openPopup();

  // ========== EVENT LISTENERS ==========
  marker.on('dragend', () => {
    const position = marker.getLatLng();
    form.latitude.value = position.lat.toFixed(5);
    form.longitude.value = position.lng.toFixed(5);
    marker.setPopupContent(medicalPopupContent(position.lat, position.lng)).openPopup();
  });

  map.on('click', function (event) {
    if (routeModeActive) {
      addPointToRoute(event.latlng.lat, event.latlng.lng);
      return;
    }

    form.latitude.value = event.latlng.lat.toFixed(5);
    form.longitude.value = event.latlng.lng.toFixed(5);
    marker.setLatLng(event.latlng);
    marker.setPopupContent(medicalPopupContent(event.latlng.lat, event.latlng.lng)).openPopup();
  });

  if (updateBtn) updateBtn.addEventListener('click', () => {
    updateMarker();
    drawRoute();
  });
  if (simulateBtn) simulateBtn.addEventListener('click', startMovement);
  if (stopBtn) stopBtn.addEventListener('click', stopMovement);
  if (routeModeBtn) routeModeBtn.addEventListener('click', toggleRouteMode);
  if (addRoutePointBtn) addRoutePointBtn.addEventListener('click', addCurrentPointToRoute);
  if (clearRouteBtn) clearRouteBtn.addEventListener('click', clearRoute);
  if (form.type) form.type.addEventListener('change', updateMarker);
  if (form.glucose) form.glucose.addEventListener('input', updateInfoCard);
  if (form.status) form.status.addEventListener('change', updateInfoCard);
  if (speedInput) speedInput.addEventListener('input', () => {
    if (routeAnimationActive) {
      stopMovement();
      startMovement();
    }
  });

  updateInfoCard();
  updateRouteTextarea();
  drawRoute();

  setTimeout(() => map.invalidateSize(), 100);

  // ========== CARGA DE RUTA DESDE SUPABASE ==========

  async function cargarPuntosExistentes(rutaId) {
    const { data, error } = await supabaseClient
      .from('gps_lecturas')
      .select('lat, lng, ts')
      .eq('ruta_id', rutaId)
      .order('ts', { ascending: true });

    if (error) {
      console.error('Error cargando lecturas GPS:', error);
      mostrarEstadoRuta('error');
      return;
    }

    if (!data || data.length === 0) {
      mostrarEstadoRuta('activa');
      return;
    }

    gpsPoints = data.map(r => [r.lat, r.lng]);
    routeLine.setLatLngs(gpsPoints);

    // No mover el marcador aquí — el canal broadcast controla la posición en vivo.
    // Solo ajustar la vista para mostrar el recorrido completo.
    if (gpsPoints.length >= 2) {
      map.fitBounds(routeLine.getBounds(), { padding: [30, 30] });
    }

    mostrarEstadoRuta('sincronizando');
  }

  function suscribirRealtime(rutaId) {
    if (realtimeChannel) {
      supabaseClient.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabaseClient
      .channel(`gps-ruta-${rutaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'gps_lecturas',
          filter: `ruta_id=eq.${rutaId}`,
        },
        (payload) => {
          const { lat, lng } = payload.new;
          if (lat == null || lng == null) return;
          // Solo actualizar la línea del recorrido.
          // El marcador de posición actual lo controla el canal broadcast.
          gpsPoints.push([lat, lng]);
          routeLine.setLatLngs(gpsPoints);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          mostrarEstadoRuta('sincronizando');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          mostrarEstadoRuta('error');
        }
      });
  }

  async function cargarRutaActiva() {
    mostrarEstadoRuta('cargando');

    // Paso 1: obtener IDs a monitorear según rol del usuario actual
    const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
    const { data: currentProfile } = await supabaseClient
      .from('profiles').select('rol').eq('id', currentUser.id).single();
    const currentRol = currentProfile?.rol;

    let adminIds = [];

    if (currentRol === 'cuidador') {
      // Cuidador: ver ubicación de su persona monitoreada vinculada
      const { data: vincs } = await supabaseClient
        .from('vinculaciones')
        .select('monitoreado_id')
        .eq('cuidador_id', currentUser.id)
        .eq('estado', 'activa');
      adminIds = vincs?.map(v => v.monitoreado_id) || [];
    } else {
      // Admin, usuario, monitoreado: ver ubicación de los admins (quienes transmiten)
      const { data: admins, error: adminsError } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('rol', 'admin');
      if (adminsError) {
        console.error('Error obteniendo admins:', adminsError);
        mostrarEstadoRuta('error');
        return;
      }
      adminIds = admins?.map(a => a.id) || [];
    }

    cachedAdminIds = adminIds;

    if (adminIds.length === 0) {
      mostrarEstadoRuta('sinRuta');
      return;
    }

    // Paso 2: buscar ruta activa de cualquier admin
    const { data, error } = await supabaseClient
      .from('rutas')
      .select('id, nombre')
      .in('user_id', adminIds)
      .eq('estado', 'en_curso')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        mostrarEstadoRuta('sinRuta');
        return;
      }
      console.error('Error buscando ruta activa:', error);
      mostrarEstadoRuta('error');
      return;
    }

    rutaActivaId = data.id;

    const rutaNombreEl = document.getElementById('gpsRouteName');
    if (rutaNombreEl) rutaNombreEl.textContent = data.nombre || 'Ruta activa';

    await cargarPuntosExistentes(rutaActivaId);
    suscribirRealtime(rutaActivaId);
  }

  cargarRutaActiva();

  // ========== BROADCAST DEL ADMIN — recibe estado completo en tiempo real ==========
  // Canal dual:
  //   'estado'      → posición + glucosa + estado + tipo (se emite en cada waypoint)
  //   'inicio-ruta' → el admin inició una nueva transmisión (activa suscripción automática)

  function mostrarInfoEnVivo(glucose, status, type) {
    const bar = document.getElementById('liveInfoBar');
    if (!bar) return;
    bar.style.display = 'flex';
    const gEl = document.getElementById('liveGlucose');
    const sEl = document.getElementById('liveStatus');
    const tEl = document.getElementById('liveType');
    if (gEl) gEl.textContent = glucose;
    if (sEl) sEl.textContent = status;
    if (tEl) tEl.textContent = type === 'ambulance' ? 'Ambulancia' : 'Clínica';
  }

  // Activa seguimiento de una nueva ruta: carga waypoints pre-insertados y suscribe realtime
  async function activarRuta(rutaId, nombre) {
    if (rutaActivaId === rutaId) return; // ya estamos siguiendo esta ruta
    gpsPoints = [];
    routeLine.setLatLngs([]);
    rutaActivaId = rutaId;
    const rutaNombreEl = document.getElementById('gpsRouteName');
    if (rutaNombreEl) rutaNombreEl.textContent = nombre || 'Ruta activa';
    await cargarPuntosExistentes(rutaId);
    suscribirRealtime(rutaId);
  }

  const adminBroadcast = supabaseClient.channel('gps-admin-estado');
  adminBroadcast
    .on('broadcast', { event: 'estado' }, ({ payload }) => {
      const { lat, lng, glucose, status, type } = payload;
      if (lat == null || lng == null) return;

      const pos = L.latLng(lat, lng);
      marker.setLatLng(pos);
      if (form.latitude) form.latitude.value = lat.toFixed(5);
      if (form.longitude) form.longitude.value = lng.toFixed(5);
      if (form.glucose) form.glucose.value = glucose;
      if (form.status) form.status.value = status;
      if (form.type) form.type.value = type;

      marker.setIcon(icons[type] || icons.ambulance);
      marker.setPopupContent(medicalPopupContent(lat, lng));
      updateInfoCard();

      mostrarInfoEnVivo(glucose, status, type);
    })
    .on('broadcast', { event: 'inicio-ruta' }, ({ payload }) => {
      // El admin acaba de iniciar una transmisión: activar seguimiento automático
      activarRuta(payload.ruta_id, payload.nombre);
    })
    .subscribe();

  window.addEventListener('beforeunload', () => {
    if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
    supabaseClient.removeChannel(adminBroadcast);
  });

  return { map, marker, route };
}

// Cargar cuando el dashboard esté listo (auth verificada)
let mapInitialized = false;
document.addEventListener('dashboardListo', (e) => {
  if (mapInitialized || !document.getElementById('map')) return;
  mapInitialized = true;
  const userId = e.detail?.user?.id;
  if (!userId) return;
  initializeGPSMap(userId);
});
