// ============ zonas seguras ============
let mapaZonas = null;
let marcadorActual = null;
let circuloActual = null;
let zonasData = [];
let circulosPorZona = {};
let usuarioId = null;       // ID del usuario logueado
let zonaOwner = null;       // ID de quien "posee" las zonas (el monitoreado)
let zonaOwnerNombre = null;


document.addEventListener('dashboardListo', async (e) => {
  usuarioId = e.detail?.user?.id;
  if (!usuarioId) return;

  const rol = document.body.dataset.rol;

  iniciarMapa();

  const banner = document.getElementById('monitoreadoBanner');
  const bannerName = document.getElementById('monitBannerName');
  // El nombre sale del paciente que el cuidador o admin tiene vinculado
  let pacienteSesion = null;
  try {
    const ses = JSON.parse(sessionStorage.getItem('diamon_demo_user') || localStorage.getItem('diamon_current_user') || 'null');
    pacienteSesion = ses && ses.pacienteVinculado;
  } catch (_) {}
  if (banner) banner.style.display = pacienteSesion ? 'flex' : 'none';
  if (bannerName && pacienteSesion) {
    bannerName.textContent = `${pacienteSesion.nombre} (${pacienteSesion.codigoPaciente})`;
  }

  // Las zonas son del paciente: si entra el cuidador, se usan las del paciente que tiene vinculado
  zonaOwner = (pacienteSesion && pacienteSesion.id) || usuarioId;
  zonaOwnerNombre = pacienteSesion ? pacienteSesion.nombre : null;

  await cargarZonas();
  wireFormulario();
  ocultarFormulario();
});

// ============ mapa ============
function iniciarMapa() {
  mapaZonas = L.map('mapZonas', { zoomControl: true }).setView([10.39991, -75.47886], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(mapaZonas);

  mapaZonas.on('click', (e) => {
    const { lat, lng } = e.latlng;
    colocarMarcador(lat, lng);
  });
}

function colocarMarcador(lat, lng) {
  if (marcadorActual) mapaZonas.removeLayer(marcadorActual);
  if (circuloActual) mapaZonas.removeLayer(circuloActual);

  marcadorActual = L.marker([lat, lng]).addTo(mapaZonas);

  const radio = parseInt(document.getElementById('zonaRadio')?.value) || 300;
  circuloActual = L.circle([lat, lng], {
    radius: radio,
    color: '#3CB4C9',
    fillColor: '#3CB4C9',
    fillOpacity: 0.1,
    weight: 2,
  }).addTo(mapaZonas);

  document.getElementById('zonaLat').value = lat.toFixed(6);
  document.getElementById('zonaLng').value = lng.toFixed(6);

  document.getElementById('mapaHint').style.display = 'none';
}

// ============ cargar zonas ============
async function cargarZonas() {
  const ownerId = zonaOwner || usuarioId;
  // Las zonas solo vienen de Supabase
  const { data, error } = await supabaseClient
    .from('zonas_seguras')
    .select('*')
    .eq('user_id', ownerId)
    .eq('activa', true)
    .order('created_at', { ascending: false });
  if (error) mostrarMsgZona('No se pudieron cargar las zonas: ' + error.message, 'error');
  zonasData = data || [];
  renderLista();
  renderCirculosEnMapa();
}

function renderLista() {
  const lista = document.getElementById('zonasList');
  if (!lista) return;

  if (zonasData.length === 0) {
    lista.innerHTML = '<div class="zonas-empty"><i class="fas fa-map-marked-alt"></i><p>Sin zonas creadas</p></div>';
    return;
  }

  lista.innerHTML = zonasData.map(z => {
    const colorRiesgo = { bajo: 'var(--signal-normal)', medio: 'var(--signal-warn)', alto: 'var(--signal-alert)' }[z.nivel_riesgo] || 'var(--fg-3)';
    return `
      <div class="zona-item" data-id="${z.id}">
        <div class="zona-item-header">
          <div class="zona-item-icon" style="color:${colorRiesgo}">
            <i class="fas fa-shield-alt"></i>
          </div>
          <div class="zona-item-info">
            <div class="zona-item-name">${escZona(z.nombre)}</div>
            <div class="zona-item-meta">${z.radio_metros}m · riesgo ${z.nivel_riesgo}</div>
          </div>
        </div>
        <div class="zona-item-actions">
          <button class="zona-action-btn" onclick="centrarZona(${z.centro_lat}, ${z.centro_lng})" title="Ver en mapa">
            <i class="fas fa-crosshairs"></i>
          </button>
          <button class="zona-action-btn zona-action-edit" onclick="editarZona(${z.id})" title="Editar">
            <i class="fas fa-pen"></i>
          </button>
          <button class="zona-action-btn zona-action-del" onclick="eliminarZona(${z.id})" title="Eliminar">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      </div>`;
  }).join('');
}

function renderCirculosEnMapa() {
  // Limpiar círculos anteriores
  Object.values(circulosPorZona).forEach(c => mapaZonas.removeLayer(c));
  circulosPorZona = {};

  zonasData.forEach(z => {
    const color = { bajo: '#5EA889', medio: '#E89A3C', alto: '#B23A48' }[z.nivel_riesgo] || '#3CB4C9';
    const c = L.circle([z.centro_lat, z.centro_lng], {
      radius: z.radio_metros,
      color,
      fillColor: color,
      fillOpacity: 0.12,
      weight: 2,
    }).addTo(mapaZonas).bindPopup(`<b>${z.nombre}</b><br>Radio: ${z.radio_metros}m<br>Riesgo: ${z.nivel_riesgo}`);
    circulosPorZona[z.id] = c;
  });

  // Ajustar vista si hay zonas
  if (zonasData.length > 0) {
    const grupo = L.featureGroup(Object.values(circulosPorZona));
    mapaZonas.fitBounds(grupo.getBounds().pad(0.2));
  }
}

// ============ acciones ============
function centrarZona(lat, lng) {
  mapaZonas.setView([lat, lng], 15);
}

function editarZona(id) {
  const z = zonasData.find(z => z.id === id);
  if (!z) return;

  document.getElementById('zonaEditId').value = z.id;
  document.getElementById('zonaNombre').value = z.nombre;
  document.getElementById('zonaRadio').value = z.radio_metros;
  document.getElementById('zonaRiesgo').value = z.nivel_riesgo;
  document.getElementById('zonaLat').value = z.centro_lat;
  document.getElementById('zonaLng').value = z.centro_lng;
  document.getElementById('zonaFormTitle').innerHTML = '<i class="fas fa-pen"></i> Editar zona';

  colocarMarcador(z.centro_lat, z.centro_lng);
  mostrarFormulario();
}

async function eliminarZona(id) {
  if (!confirm('¿Eliminar esta zona segura?')) return;

  const { error } = await supabaseClient
    .from('zonas_seguras')
    .update({ activa: false })
    .eq('id', id);
  if (error) mostrarMsgZona('No se pudo eliminar: ' + error.message, 'error');

  await cargarZonas();
}

// ============ formulario ============
function wireFormulario() {
  document.getElementById('btnNuevaZona')?.addEventListener('click', () => {
    limpiarFormulario();
    mostrarFormulario();
  });

  document.getElementById('btnCancelarZona')?.addEventListener('click', () => {
    ocultarFormulario();
  });

  document.getElementById('btnGuardarZona')?.addEventListener('click', guardarZona);

  // Actualizar radio del círculo en tiempo real
  document.getElementById('zonaRadio')?.addEventListener('input', () => {
    const lat = parseFloat(document.getElementById('zonaLat').value);
    const lng = parseFloat(document.getElementById('zonaLng').value);
    if (!isNaN(lat) && !isNaN(lng)) colocarMarcador(lat, lng);
  });
}

async function guardarZona() {
  const nombre = document.getElementById('zonaNombre')?.value?.trim();
  const radio  = parseInt(document.getElementById('zonaRadio')?.value);
  const riesgo = document.getElementById('zonaRiesgo')?.value;
  const lat    = parseFloat(document.getElementById('zonaLat')?.value);
  const lng    = parseFloat(document.getElementById('zonaLng')?.value);
  const editId = document.getElementById('zonaEditId')?.value;

  if (!nombre) { mostrarMsgZona('El nombre es obligatorio.', 'error'); return; }
  if (!lat || !lng) { mostrarMsgZona('Haz clic en el mapa para definir el centro.', 'error'); return; }

  const btn = document.getElementById('btnGuardarZona');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando…';

  const payload = {
    user_id: zonaOwner || usuarioId,
    nombre,
    radio_metros: radio || 300,
    nivel_riesgo: riesgo,
    centro_lat: lat,
    centro_lng: lng,
    activa: true,
  };

  const { error } = editId
    ? await supabaseClient.from('zonas_seguras').update(payload).eq('id', editId)
    : await supabaseClient.from('zonas_seguras').insert(payload);

  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-save"></i> Guardar zona';

  if (error) { mostrarMsgZona('No se pudo guardar: ' + error.message, 'error'); return; }
  mostrarMsgZona('Zona segura guardada' + (zonaOwnerNombre ? ' para ' + zonaOwnerNombre : '') + ' y sincronizada con el mapa principal.', 'exito');
  setTimeout(ocultarFormulario, 900);
  await cargarZonas();
}

function mostrarFormulario() {
  document.getElementById('zonaForm').style.display = 'block';
}

function ocultarFormulario() {
  document.getElementById('zonaForm').style.display = 'none';
  limpiarFormulario();
}

function limpiarFormulario() {
  document.getElementById('zonaEditId').value = '';
  document.getElementById('zonaNombre').value = '';
  document.getElementById('zonaRadio').value = 300;
  document.getElementById('zonaRiesgo').value = 'medio';
  document.getElementById('zonaLat').value = '';
  document.getElementById('zonaLng').value = '';
  document.getElementById('zonaFormTitle').innerHTML = '<i class="fas fa-plus-circle"></i> Nueva zona segura';
  document.getElementById('mapaHint').style.display = '';
  if (marcadorActual) { mapaZonas.removeLayer(marcadorActual); marcadorActual = null; }
  if (circuloActual)  { mapaZonas.removeLayer(circuloActual);  circuloActual = null; }
}

function mostrarMsgZona(texto, tipo) {
  const el = document.getElementById('zonaMsg');
  if (!el) return;
  el.textContent = texto;
  el.className = 'perfil-mensaje ' + tipo;
  setTimeout(() => { el.textContent = ''; el.className = 'perfil-mensaje'; }, 4000);
}

function escZona(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}
