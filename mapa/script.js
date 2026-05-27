const cartagenaCenter = [10.3910, -75.4794];
const map = L.map('map').setView(cartagenaCenter, 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: 'Mapa © OpenStreetMap contributors',
  maxZoom: 19,
}).addTo(map);

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
  latitude: document.getElementById('latitude'),
  longitude: document.getElementById('longitude'),
  glucose: document.getElementById('glucose'),
  status: document.getElementById('status'),
  type: document.getElementById('type'),
};

const info = {
  glucose: document.getElementById('infoGlucose'),
  status: document.getElementById('infoStatus'),
  type: document.getElementById('infoType'),
};

const updateBtn = document.getElementById('updateBtn');
const simulateBtn = document.getElementById('simulateBtn');
const stopBtn = document.getElementById('stopBtn');
const speedInput = document.getElementById('speed');
const routePoints = document.getElementById('routePoints');
const routeModeBtn = document.getElementById('routeModeBtn');
const addRoutePointBtn = document.getElementById('addRoutePointBtn');
const clearRouteBtn = document.getElementById('clearRouteBtn');

let routeModeActive = false;
let routeMarkers = [];
let routeAnimationActive = false;
let route = [];

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

function updateInfoCard() {
  info.glucose.textContent = form.glucose.value;
  info.status.textContent = form.status.value;
  info.type.textContent = form.type.value === 'ambulance' ? 'Ambulancia' : 'Clínica';
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

function updateRouteTextarea() {
  routePoints.value = route.map(([lat, lng], index) => `${index + 1}. ${lat.toFixed(5)}, ${lng.toFixed(5)}`).join('\n');
}

function updateRouteMarkers() {
  routeMarkers.forEach(marker => map.removeLayer(marker));
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
  simulateBtn.disabled = true;
  stopBtn.disabled = false;

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
  simulateBtn.disabled = false;
  stopBtn.disabled = true;
}

function stopMovement() {
  routeAnimationActive = false;
  simulateBtn.disabled = false;
  stopBtn.disabled = true;
}

function toggleRouteMode() {
  routeModeActive = !routeModeActive;
  routeModeBtn.classList.toggle('active', routeModeActive);
  routeModeBtn.textContent = routeModeActive ? 'Modo ruta activado' : 'Marcar recorrido con clic';
}

updateBtn.addEventListener('click', () => {
  updateMarker();
  drawRoute();
});
simulateBtn.addEventListener('click', startMovement);
stopBtn.addEventListener('click', stopMovement);
routeModeBtn.addEventListener('click', toggleRouteMode);
addRoutePointBtn.addEventListener('click', addCurrentPointToRoute);
clearRouteBtn.addEventListener('click', clearRoute);
form.type.addEventListener('change', updateMarker);
form.glucose.addEventListener('input', updateInfoCard);
form.status.addEventListener('change', updateInfoCard);
speedInput.addEventListener('input', () => {
  if (routeAnimationActive) {
    stopMovement();
    startMovement();
  }
});

updateInfoCard();
updateRouteTextarea();
drawRoute();

// Placeholder para integrar datos de Supabase más adelante
async function loadMedicalData() {
  // Aquí puedes llamar a Supabase o a tu API para obtener ubicación y datos.
  // Ejemplo:
  // const { data } = await supabase.from('ambulancias').select('*').eq('ciudad','Cartagena');
}
