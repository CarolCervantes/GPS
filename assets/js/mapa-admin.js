// Mapa GPS para administradores — adaptado de mapa/script.js
// Se inicializa solo cuando auth.js dispara el evento 'mapaAdminListo'
// (garantiza que #pageContent ya es visible y el contenedor tiene dimensiones reales).

const cartagenaCenterAdmin = [10.3910, -75.4794];

// Ruta circular predefinida alrededor de Cartagena para la opción de auto-ruta
const AUTO_RUTA = [
  [10.3910, -75.4794],
  [10.3956, -75.4850],
  [10.3885, -75.5030],
  [10.3820, -75.5050],
  [10.3750, -75.4980],
  [10.3700, -75.4880],
  [10.3720, -75.4780],
  [10.3800, -75.4760],
  [10.3870, -75.4740],
  [10.3910, -75.4794],
];

let mapaAdminInicializado = false;

document.addEventListener('mapaAdminListo', async function initMapaAdmin() {
  if (mapaAdminInicializado) return;
  mapaAdminInicializado = true;

  // Verificar que el usuario sea admin — auth.js ya fijó data-rol antes de disparar el evento.
  if (document.body.dataset.rol !== 'admin') {
    const restricted = document.getElementById('restrictedMessage');
    const pageContent = document.getElementById('pageContent');
    const detail = document.getElementById('restrictedDetail');
    if (detail) detail.textContent = 'Esta sección del mapa es solo para administradores.';
    if (restricted) restricted.style.display = 'block';
    if (pageContent) pageContent.style.display = 'none';
    return;
  }

  const mapEl = document.getElementById('mapaAdminMap');
  if (!mapEl) return;

  // Obtener userId del admin para guardar en Supabase
  const { data: { user: adminUser } } = await supabaseClient.auth.getUser();
  let adminUserId = adminUser?.id || null;
  let rutaTransmisionId = null;
  let transmisionActiva = false;
  let autoRutaActiva = false;

  const map = L.map('mapaAdminMap').setView(cartagenaCenterAdmin, 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Mapa © OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  // Forzar recálculo de dimensiones (el contenedor venía de display:none)
  map.invalidateSize();

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

  const form = {
    latitude: document.getElementById('mapaLatitude'),
    longitude: document.getElementById('mapaLongitude'),
    glucose: document.getElementById('mapaGlucose'),
    status: document.getElementById('mapaStatus'),
    type: document.getElementById('mapaType'),
  };

  const info = {
    glucose: document.getElementById('mapaInfoGlucose'),
    status: document.getElementById('mapaInfoStatus'),
    type: document.getElementById('mapaInfoType'),
  };

  const updateBtn = document.getElementById('mapaUpdateBtn');
  const simulateBtn = document.getElementById('mapaSimulateBtn');
  const stopBtn = document.getElementById('mapaStopBtn');
  const speedInput = document.getElementById('mapaSpeed');
  const routePointsEl = document.getElementById('mapaRoutePoints');
  const routeModeBtn = document.getElementById('mapaRouteModeBtn');
  const addRoutePointBtn = document.getElementById('mapaAddRoutePointBtn');
  const clearRouteBtn = document.getElementById('mapaClearRouteBtn');
  const transmitirBtn = document.getElementById('mapaTransmitirBtn');
  const detenerTransBtn = document.getElementById('mapaDetenerTransBtn');
  const transmitStatus = document.getElementById('mapaTransmitStatus');
  const autoRutaBtn = document.getElementById('mapaAutoRutaBtn');

  let routeModeActive = false;
  let routeMarkers = [];
  let routeAnimationActive = false;
  let route = [];

  // ========== CANAL DE BROADCAST — sincroniza estado completo con el dashboard ==========
  // Usa Supabase Realtime Broadcast (sin cambios en BD) para enviar lat/lng/glucosa/estado/tipo.

  const adminBroadcast = supabaseClient.channel('gps-admin-estado', {
    config: { broadcast: { self: false } },
  });
  adminBroadcast.subscribe();

  function broadcastEstado(lat, lng) {
    adminBroadcast.send({
      type: 'broadcast',
      event: 'estado',
      payload: {
        lat,
        lng,
        glucose: form.glucose?.value || '98',
        status: form.status?.value || 'Normal',
        type: form.type?.value || 'ambulance',
      },
    });
  }

  // ========== FUNCIONES DE RUTA LOCAL ==========

  function medicalPopupContent(lat, lng) {
    return `
      <div style="font-size:0.9rem;line-height:1.5;">
        <strong>${form.type.value === 'ambulance' ? 'Ambulancia' : 'Clínica'}</strong><br>
        <strong>Lat:</strong> ${lat.toFixed(5)}<br>
        <strong>Lng:</strong> ${lng.toFixed(5)}<br>
        <strong>Glucosa:</strong> ${form.glucose.value} mg/dL<br>
        <strong>Estado:</strong> ${form.status.value}
      </div>
    `;
  }

  const marker = L.marker(cartagenaCenterAdmin, {
    icon: icons[form.type.value],
    draggable: true,
  }).addTo(map);

  const routeLine = L.polyline(route, {
    color: '#f97316',
    weight: 4,
    dashArray: '8 6',
  }).addTo(map);

  marker.bindPopup(medicalPopupContent(cartagenaCenterAdmin[0], cartagenaCenterAdmin[1])).openPopup();

  marker.on('dragend', () => {
    const pos = marker.getLatLng();
    form.latitude.value = pos.lat.toFixed(5);
    form.longitude.value = pos.lng.toFixed(5);
    marker.setPopupContent(medicalPopupContent(pos.lat, pos.lng)).openPopup();
    broadcastEstado(pos.lat, pos.lng);
  });

  map.on('click', function (e) {
    if (routeModeActive) {
      addPointToRoute(e.latlng.lat, e.latlng.lng);
      return;
    }
    form.latitude.value = e.latlng.lat.toFixed(5);
    form.longitude.value = e.latlng.lng.toFixed(5);
    marker.setLatLng(e.latlng);
    marker.setPopupContent(medicalPopupContent(e.latlng.lat, e.latlng.lng)).openPopup();
    broadcastEstado(e.latlng.lat, e.latlng.lng);
  });

  function updateInfoCard() {
    if (info.glucose) info.glucose.textContent = form.glucose.value;
    if (info.status) info.status.textContent = form.status.value;
    if (info.type) info.type.textContent = form.type.value === 'ambulance' ? 'Ambulancia' : 'Clínica';
    const pos = marker.getLatLng();
    broadcastEstado(pos.lat, pos.lng);
  }

  function updateMarker() {
    const lat = parseFloat(form.latitude.value) || cartagenaCenterAdmin[0];
    const lng = parseFloat(form.longitude.value) || cartagenaCenterAdmin[1];
    const position = L.latLng(lat, lng);
    marker.setLatLng(position);
    marker.setIcon(icons[form.type.value]);
    marker.setPopupContent(medicalPopupContent(lat, lng)).openPopup();
    map.panTo(position, { animate: true, duration: 0.7 });
    updateInfoCard();
  }

  function updateRouteTextarea() {
    if (routePointsEl) {
      routePointsEl.value = route.map(
        ([lat, lng], i) => `${i + 1}. ${lat.toFixed(5)}, ${lng.toFixed(5)}`
      ).join('\n');
    }
  }

  function updateRouteMarkers() {
    routeMarkers.forEach(m => map.removeLayer(m));
    routeMarkers = route.map(([lat, lng], i) =>
      L.circleMarker([lat, lng], {
        radius: 6,
        color: '#0ea5e9',
        fillColor: '#fff',
        fillOpacity: 1,
        weight: 2,
      }).bindTooltip(`Punto ${i + 1}`, { permanent: false, direction: 'top' }).addTo(map)
    );
  }

  function drawRoute() {
    routeLine.setLatLngs(route);
    updateRouteMarkers();
  }

  function habilitarTransmitir() {
    if (transmitirBtn) transmitirBtn.disabled = route.length < 2 || transmisionActiva;
  }

  function addPointToRoute(lat, lng) {
    route.push([lat, lng]);
    drawRoute();
    updateRouteTextarea();
    habilitarTransmitir();
  }

  function addCurrentPointToRoute() {
    const pos = marker.getLatLng();
    addPointToRoute(pos.lat, pos.lng);
  }

  function clearRoute() {
    route = [];
    drawRoute();
    updateRouteTextarea();
    habilitarTransmitir();
  }

  function animateSegment(start, end, durationMs) {
    return new Promise(resolve => {
      const startTime = performance.now();
      const deltaLat = end[0] - start[0];
      const deltaLng = end[1] - start[1];

      function step(now) {
        if (!routeAnimationActive) return resolve(false);
        const t = Math.min((now - startTime) / durationMs, 1);
        const lat = start[0] + deltaLat * t;
        const lng = start[1] + deltaLng * t;
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

  // loop=true: repite la ruta desde el inicio al terminar (para auto-ruta)
  async function startMovement(loop = false) {
    if (routeAnimationActive || route.length < 2) return;
    routeAnimationActive = true;
    if (simulateBtn) simulateBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;

    const intervalMs = Math.max(300, parseFloat(speedInput.value) * 1000);

    do {
      marker.setLatLng(route[0]);
      form.latitude.value = route[0][0].toFixed(5);
      form.longitude.value = route[0][1].toFixed(5);
      map.panTo(route[0], { animate: false });

      let completed = true;
      for (let i = 1; i < route.length; i++) {
        if (!routeAnimationActive) { completed = false; break; }
        const moved = await animateSegment(route[i - 1], route[i], intervalMs);
        if (!moved) { completed = false; break; }
        form.latitude.value = route[i][0].toFixed(5);
        form.longitude.value = route[i][1].toFixed(5);

        // Broadcast posición actual al dashboard en tiempo real
        broadcastEstado(route[i][0], route[i][1]);
      }
      if (!completed) break;
    } while (loop && routeAnimationActive);

    routeAnimationActive = false;
    if (simulateBtn) simulateBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
  }

  function stopMovement() {
    routeAnimationActive = false;
    if (simulateBtn) simulateBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
    // Si había auto-ruta activa, resetear su botón también
    if (autoRutaActiva) {
      autoRutaActiva = false;
      if (autoRutaBtn) {
        autoRutaBtn.classList.remove('active');
        autoRutaBtn.innerHTML = '<i class="fas fa-route"></i> Ruta automática (loop)';
      }
    }
  }

  function toggleRouteMode() {
    routeModeActive = !routeModeActive;
    if (routeModeBtn) {
      routeModeBtn.classList.toggle('active', routeModeActive);
      routeModeBtn.textContent = routeModeActive ? 'Modo ruta activado' : 'Marcar recorrido con clic';
    }
  }

  // ========== RUTA AUTOMÁTICA ==========
  // Carga la ruta predefinida de Cartagena y la repite en loop indefinidamente.

  async function toggleAutoRuta() {
    if (autoRutaActiva) {
      // stopMovement se encarga de resetear autoRutaActiva y el botón
      stopMovement();
      return;
    }

    autoRutaActiva = true;
    route = [...AUTO_RUTA];
    drawRoute();
    updateRouteTextarea();
    habilitarTransmitir();

    if (autoRutaBtn) {
      autoRutaBtn.classList.add('active');
      autoRutaBtn.innerHTML = '<i class="fas fa-stop-circle"></i> Detener auto-ruta';
    }

    await startMovement(true);

    // Si la animación terminó sin que el usuario la detuviera manualmente
    if (autoRutaActiva) {
      autoRutaActiva = false;
      if (autoRutaBtn) {
        autoRutaBtn.classList.remove('active');
        autoRutaBtn.innerHTML = '<i class="fas fa-route"></i> Ruta automática (loop)';
      }
    }
  }

  // ========== TRANSMISIÓN A SUPABASE ==========

  async function transmitirRuta() {
    if (route.length < 2 || transmisionActiva || !adminUserId) return;

    if (transmitirBtn) transmitirBtn.disabled = true;

    const nombre = `Transmisión GPS ${new Date().toLocaleTimeString('es-CO')}`;
    const { data, error } = await supabaseClient
      .from('rutas')
      .insert({
        user_id: adminUserId,
        nombre,
        estado: 'en_curso',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creando ruta en Supabase:', error);
      if (transmitirBtn) transmitirBtn.disabled = route.length < 2;
      return;
    }

    rutaTransmisionId = data.id;
    transmisionActiva = true;

    // Pre-insertar TODOS los waypoints de una vez para que el recorrido
    // persista en la BD aunque el admin cierre la página antes de terminar.
    const intervalMs = Math.max(300, parseFloat(speedInput.value) * 1000);
    const t0 = Date.now();
    const waypoints = route.map((pt, i) => ({
      user_id: adminUserId,
      ruta_id: rutaTransmisionId,
      lat: pt[0],
      lng: pt[1],
      velocidad: parseFloat(speedInput?.value) || 0,
      ts: new Date(t0 + i * intervalMs).toISOString(),
    }));
    await supabaseClient.from('gps_lecturas').insert(waypoints).then(({ error: e }) => {
      if (e) console.warn('Error pre-insertando waypoints:', e.message);
    });

    // Notificar al dashboard que hay una nueva ruta activa
    adminBroadcast.send({
      type: 'broadcast',
      event: 'inicio-ruta',
      payload: { ruta_id: rutaTransmisionId, nombre },
    });

    if (detenerTransBtn) detenerTransBtn.disabled = false;
    if (transmitStatus) transmitStatus.style.display = 'flex';

    // Animación local + broadcast en vivo (sin insertar a Supabase por waypoint — ya pre-insertado)
    await startMovement(autoRutaActiva);

    if (transmisionActiva) await detenerTransmision();
  }

  async function detenerTransmision() {
    transmisionActiva = false;
    stopMovement();

    if (rutaTransmisionId) {
      const { error } = await supabaseClient
        .from('rutas')
        .update({ estado: 'completada' })
        .eq('id', rutaTransmisionId);
      if (error) console.warn('No se pudo actualizar estado de ruta:', error.message);
      rutaTransmisionId = null;
    }

    habilitarTransmitir();
    if (detenerTransBtn) detenerTransBtn.disabled = true;
    if (transmitStatus) transmitStatus.style.display = 'none';
  }

  // ========== EVENT LISTENERS ==========

  if (updateBtn) updateBtn.addEventListener('click', () => { updateMarker(); drawRoute(); });
  if (simulateBtn) simulateBtn.addEventListener('click', () => startMovement(false));
  if (stopBtn) stopBtn.addEventListener('click', stopMovement);
  if (routeModeBtn) routeModeBtn.addEventListener('click', toggleRouteMode);
  if (addRoutePointBtn) addRoutePointBtn.addEventListener('click', addCurrentPointToRoute);
  if (clearRouteBtn) clearRouteBtn.addEventListener('click', clearRoute);
  if (transmitirBtn) transmitirBtn.addEventListener('click', transmitirRuta);
  if (detenerTransBtn) detenerTransBtn.addEventListener('click', detenerTransmision);
  if (autoRutaBtn) autoRutaBtn.addEventListener('click', toggleAutoRuta);
  if (form.type) form.type.addEventListener('change', updateMarker);
  if (form.glucose) form.glucose.addEventListener('input', updateInfoCard);
  if (form.status) form.status.addEventListener('change', updateInfoCard);
  if (speedInput) {
    speedInput.addEventListener('input', () => {
      if (routeAnimationActive) {
        stopMovement();
        startMovement(autoRutaActiva);
      }
    });
  }

  updateInfoCard();
  updateRouteTextarea();
  drawRoute();
});
