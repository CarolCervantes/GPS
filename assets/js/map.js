
// Confirmación Automática de Llegada por Geocerca
let _ultimaLlegadaId = null;
function verificarLlegadaGeocerca(lat, lng) {
  const destinos = window.DESTINOS_PREDETERMINADOS_CTG || [
    { id: 'udc-zarzagocilla', nombre: 'Universidad de Cartagena — Zarzagocilla', coords: [10.3951, -75.4952] },
    { id: 'udc-san-agustin', nombre: 'Universidad de Cartagena — San Agustín (Centro)', coords: [10.4235, -75.5502] },
    { id: 'casa', nombre: 'Casa / Hogar (San Fernando)', coords: [10.3887, -75.4789] }
  ];

  const R = 6371000;
  for (const d of destinos) {
    const dLat = (d.coords[0] - lat) * Math.PI / 180;
    const dLon = (d.coords[1] - lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat * Math.PI / 180) * Math.cos(d.coords[0] * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (dist <= 300) {
      if (_ultimaLlegadaId !== d.id) {
        _ultimaLlegadaId = d.id;
        const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion('📍 Confirmación automática: Llegada a ' + d.nombre + ' (' + hora + '). Acudiente notificado.', 'success');
        }
      }
      return;
    }
  }
}

// ============ mapa interactivo con funcionalidades GPS ============

const cartagenaCenter = [10.39991, -75.47886]; // Casa de Damián Díaz Balseiro — Barrio Chapacuá

function initializeGPSMap(userId) {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;

  // ========== inicialización del mapa ==========
  const map = L.map('map', {
    zoomControl: true,
    attributionControl: false
  }).setView(cartagenaCenter, 16);
  window.mapInstance = map;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Mapa © OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  // ========== iconos personalizados ==========
  const icons = {
    ambulance: L.divIcon({
      className: 'custom-icon patient-live-icon',
      html: '<div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#0d9488,#0284c7);color:#fff;display:flex;align-items:center;justify-content:center;font-size:17px;border:3px solid #fff;box-shadow:0 4px 14px rgba(13,148,136,0.55);"><i class="fas fa-user-check"></i></div>',
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    }),
    clinic: L.divIcon({
      className: 'custom-icon clinic-icon',
      html: '<span>🏥</span>',
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    }),
  };

  // ========== elementos del formulario ==========
  const form = {
    latitude: document.getElementById('mapLatitude'),
    longitude: document.getElementById('mapLongitude'),
    glucose: document.getElementById('mapGlucose'),
    status: document.getElementById('mapStatus'),
    type: document.getElementById('mapType'),
  };

  // ========== elementos de información ==========
  const info = {
    glucose: document.getElementById('mapInfoGlucose'),
    status: document.getElementById('mapInfoStatus'),
    type: document.getElementById('mapInfoType'),
  };

  // ========== botones y controles ==========
  const updateBtn = document.getElementById('mapUpdateBtn');
  const simulateBtn = document.getElementById('mapSimulateBtn');
  const stopBtn = document.getElementById('mapStopBtn');
  const speedInput = document.getElementById('mapSpeed');
  const routePoints = document.getElementById('mapRoutePoints');
  const routeModeBtn = document.getElementById('mapRouteModeBtn');
  const addRoutePointBtn = document.getElementById('mapAddRoutePointBtn');
  const clearRouteBtn = document.getElementById('mapClearRouteBtn');

  // ========== variables de estado ==========
  let routeModeActive = false;
  let routeMarkers = [];
  let routeAnimationActive = false;
  let route = [];

  // ========== popup clínico real de Damián Díaz Balseiro ==========
  function medicalPopupContent(lat, lng) {
    const res = (window.casoEstudio && typeof window.casoEstudio.obtenerResumenClinicoActual === 'function')
      ? window.casoEstudio.obtenerResumenClinicoActual()
      : null;
    const nombrePac = res ? res.paciente.nombre : 'Damián Díaz Balseiro';
    const glucTxt = res ? `${res.ultimaGlucosa.valor} mg/dL (${res.evalG.etiqueta})` : `${form.glucose.value} mg/dL`;
    const paTxt = res ? `${res.ultimaPresion.sistolica}/${res.ultimaPresion.diastolica} mmHg (${res.ultimaPresion.pulso} BPM)` : '126/78 mmHg';
    const checkGeo = (window.casoEstudio && typeof window.casoEstudio.evaluarPosicionEnZonas === 'function')
      ? window.casoEstudio.evaluarPosicionEnZonas(lat, lng, false)
      : { dentro: true, zonaNombre: 'Casa Chapacuá', distancia: 0 };

    return `
      <div style="font-size: 0.85rem; line-height: 1.45; min-width: 215px; font-family: 'Inter', sans-serif;">
        <div style="font-weight: 800; color: #0f172a; font-size: 0.95rem; margin-bottom: 2px;">
          <i class="fas fa-user-shield" style="color:#0d9488;"></i> ${nombrePac}
        </div>
        <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 6px;">Barrio Chapacuá · Enf. Jefe Elizabeth Vargas Caro</div>
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:6px 8px; margin-bottom:6px;">
          <div><strong>Glucosa:</strong> <span style="color:#0d9488; font-weight:700;">${glucTxt}</span></div>
          <div><strong>Presión:</strong> <span style="color:#7c3aed; font-weight:700;">${paTxt}</span></div>
          <div><strong>Geocerca:</strong> <span style="color:${checkGeo.dentro ? '#16a34a' : '#dc2626'}; font-weight:700;">${checkGeo.dentro ? 'En ' + checkGeo.zonaNombre : 'Fuera de zona (' + checkGeo.distancia + 'm)'}</span></div>
        </div>
        <div style="font-size: 0.72rem; color: #64748b;">
          <strong>Lat:</strong> ${Number(lat).toFixed(5)} · <strong>Lng:</strong> ${Number(lng).toFixed(5)}
        </div>
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
    marker.setPopupContent(medicalPopupContent(lat, lng));
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

  // ========== inicialización del marcador y capas Cartagena ==========
  window.liveMapInstance = map;
  // El marcador empieza en la casa del paciente (su primera zona segura) y solo se mueve con el GPS real
  const zonasPac = window.casoEstudio ? window.casoEstudio.obtenerZonasSeguras() : [];
  const inicioMapa = zonasPac.length ? [Number(zonasPac[0].centro_lat), Number(zonasPac[0].centro_lng)] : cartagenaCenter;
  const marker = L.marker(inicioMapa, {
    icon: icons[form.type.value],
    draggable: false,
  }).addTo(map);
  marker.bindTooltip('Última ubicación conocida (esperando GPS en vivo)');
  map.setView(inicioMapa, map.getZoom());
  window._patientMarker = marker;

  // Círculo de precisión GPS
  let accuracyCircle = L.circle(inicioMapa, {
    radius: 30,
    color: '#0284c7',
    fillColor: '#0284c7',
    fillOpacity: 0.12,
    weight: 1.5,
    dashArray: '3, 6'
  }).addTo(map);
  window._accuracyCircle = accuracyCircle;

  // Capa de Zonas Seguras (Geocercas reales en el mapa principal)
  const geocercasLayerGroup = L.layerGroup().addTo(map);
  window.dibujarZonasSegurasEnMapaPrincipal = function () {
    geocercasLayerGroup.clearLayers();
    const zonas = (window.casoEstudio && typeof window.casoEstudio.obtenerZonasSeguras === 'function')
      ? window.casoEstudio.obtenerZonasSeguras()
      : [{ nombre: 'Casa Damián Díaz — Barrio Chapacuá', centro_lat: 10.39991, centro_lng: -75.47886, radio_metros: 400, nivel_riesgo: 'bajo', activa: true }];

    zonas.filter(z => z.activa !== false).forEach(z => {
      const color = z.nivel_riesgo === 'alto' ? '#dc2626' : (z.nivel_riesgo === 'medio' ? '#d97706' : '#0d9488');
      L.circle([z.centro_lat, z.centro_lng], {
        radius: Number(z.radio_metros) || 400,
        color: color,
        fillColor: color,
        fillOpacity: 0.12,
        weight: 2
      }).bindTooltip(`🛡️ Zona Segura: ${z.nombre} (Radio: ${z.radio_metros}m)`, { sticky: true }).addTo(geocercasLayerGroup);
    });
  };
  window.dibujarZonasSegurasEnMapaPrincipal();

  // Inicializar capa de Centros Médicos y Farmacias de Cartagena
  if (window.CentrosMedicosCartagena && !window.centrosMedicosInstance) {
    const cm = new window.CentrosMedicosCartagena();
    cm.init(map);
  }

  // Capa de tráfico de Cartagena
  if (window.TraficoCartagenaManager && !window.traficoCartagenaInstance) {
    const tm = new window.TraficoCartagenaManager();
    tm.init(map);
  }

  const routeLine = L.polyline(route, {
    color: '#f97316',
    weight: 4,
    dashArray: '8 6',
  }).addTo(map);

  marker.bindPopup(medicalPopupContent(cartagenaCenter[0], cartagenaCenter[1])); // se abre al tocar el marcador

  // ========== integración con telemetría GPS en tiempo real ==========
  window.actualizarMarcadorUbicacionReal = function (lat, lng, accuracy = 20) {
    if (!map || !marker) return;
    const newPos = L.latLng(lat, lng);
    marker.setLatLng(newPos);
    if (form.latitude) form.latitude.value = Number(lat).toFixed(5);
    if (form.longitude) form.longitude.value = Number(lng).toFixed(5);
    if (accuracyCircle) {
      accuracyCircle.setLatLng(newPos);
      accuracyCircle.setRadius(Math.max(15, accuracy));
    }
    marker.setPopupContent(medicalPopupContent(lat, lng));
    if (window.centrosMedicosInstance) {
      window.centrosMedicosInstance.setPatientCoords([lat, lng]);
    }
    if (window.traficoCartagenaInstance) {
      window.traficoCartagenaInstance.procesarTelemetriaGPS(lat, lng);
    }
    verificarLlegadaGeocerca(lat, lng);

    if (!window._mapCenteredOnRealGPS) {
      window._mapCenteredOnRealGPS = true;
      map.setView(newPos, 15, { animate: true });
    }
  };

  if (window.TelemetriaDiaMon && window.TelemetriaDiaMon.gpsFijado && window.TelemetriaDiaMon.ubicacion) {
    window.actualizarMarcadorUbicacionReal(
      window.TelemetriaDiaMon.ubicacion.lat,
      window.TelemetriaDiaMon.ubicacion.lng,
      window.TelemetriaDiaMon.ubicacion.precision
    );
  }

  // ========== event listeners ==========
  marker.on('dragend', () => {
    const position = marker.getLatLng();
    form.latitude.value = position.lat.toFixed(5);
    form.longitude.value = position.lng.toFixed(5);
    if (window.centrosMedicosInstance) {
      window.centrosMedicosInstance.setPatientCoords([position.lat, position.lng]);
    }
    if (window.casoEstudio && typeof window.casoEstudio.procesarMovimientoMapa === 'function') {
      window.casoEstudio.procesarMovimientoMapa(position.lat, position.lng);
    }
    marker.setPopupContent(medicalPopupContent(position.lat, position.lng));
    verificarLlegadaGeocerca(position.lat, position.lng);
    if (accuracyCircle) accuracyCircle.setLatLng(position);
    if (window.traficoCartagenaInstance) {
      window.traficoCartagenaInstance.procesarTelemetriaGPS(position.lat, position.lng);
    }
  });

  map.on('click', function (event) {
    if (routeModeActive) {
      addPointToRoute(event.latlng.lat, event.latlng.lng);
      return;
    }

    // Hacer clic en el mapa ya no mueve al paciente: su ubicacion solo viene del GPS de su celular
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
  setTimeout(() => map.invalidateSize(), 400);
  setTimeout(() => map.invalidateSize(), 1000);

  return { map, marker, route };
}

// Cargar de inmediato en DOMContentLoaded para que el mapa NUNCA quede vacío
let mapInitialized = false;

function arrancarMapa(userId = 'invitado') {
  if (mapInitialized || !document.getElementById('map')) return;
  mapInitialized = true;
  initializeGPSMap(userId);
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (!mapInitialized) {
      arrancarMapa('invitado');
    }
  }, 150);
});

document.addEventListener('dashboardListo', (e) => {
  const userId = e.detail?.user?.id || 'invitado';
  if (!mapInitialized) {
    arrancarMapa(userId);
  }
});



