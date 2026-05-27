// ============ UBICACIÓN REAL DEL MONITOREADO ============
// Solo activo para rol "monitoreado".
// Usa navigator.geolocation para obtener coordenadas reales
// y las envía a gps_lecturas en Supabase cada 5 segundos.

let ubicacionUserId = null;
let ubicacionRutaId = null;
let watchId = null;
let intervaloEnvio = null;
let ultimaPos = null;
let compartiendo = false;

document.addEventListener('dashboardListo', async (e) => {
  ubicacionUserId = e.detail?.user?.id;
  const rol = document.body.dataset.rol;
  console.log('[debug] ubicacion-real dashboardListo', { ubicacionUserId, bodyRole: rol });
  if (rol !== 'monitoreado') return;

  inyectarBotonSOS();
});

// ============ INYECTAR BOTÓN ============
function inyectarBotonSOS() {
  const wrap = document.getElementById('sosWrap');
  console.log('[debug] inyectarBotonSOS', { wrap: !!wrap, existingBtnSOS: !!(wrap && wrap.querySelector('#btnSOS')) });
  if (!wrap) return;

  // Agregar botón de compartir ubicación antes del SOS
  const btnUbicacion = document.createElement('button');
  btnUbicacion.id = 'btnCompartirUbicacion';
  btnUbicacion.className = 'btn-compartir-ubicacion';
  btnUbicacion.innerHTML = '<i class="fas fa-location-arrow"></i> Compartir mi ubicación';
  wrap.insertBefore(btnUbicacion, wrap.firstChild);

  // Indicador de estado
  const indicador = document.createElement('div');
  indicador.id = 'ubicacionIndicador';
  indicador.className = 'ubicacion-indicador';
  indicador.style.display = 'none';
  indicador.innerHTML = `
    <span class="ubicacion-dot"></span>
    <span id="ubicacionStatus">Transmitiendo ubicación…</span>
    <button id="btnDetenerUbicacion" class="btn-detener-ubicacion">
      <i class="fas fa-stop"></i> Detener
    </button>
  `;
  wrap.insertBefore(indicador, btnUbicacion.nextSibling);

  btnUbicacion.addEventListener('click', iniciarCompartir);
  document.getElementById('btnDetenerUbicacion')?.addEventListener('click', detenerCompartir);
}

// ============ INICIAR ============
async function iniciarCompartir() {
  if (!navigator.geolocation) {
    alert('Tu navegador no soporta geolocalización.');
    return;
  }

  if (!confirm('¿Compartir tu ubicación en tiempo real con tu cuidador?')) return;

  const btn = document.getElementById('btnCompartirUbicacion');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando…';

  // Crear una ruta activa para este monitoreado
  const { data: ruta, error } = await supabaseClient
    .from('rutas')
    .insert({
      user_id: ubicacionUserId,
      nombre: 'Ubicación en tiempo real',
      estado: 'en_curso',
      fecha: new Date().toISOString().split('T')[0],
    })
    .select('id')
    .single();

  if (error) {
    alert('Error al iniciar: ' + error.message);
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-location-arrow"></i> Compartir mi ubicación';
    return;
  }

  ubicacionRutaId = ruta.id;
  compartiendo = true;

  // Escuchar posición del GPS
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      ultimaPos = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        velocidad: pos.coords.speed || 0,
      };
      actualizarStatus(`${ultimaPos.lat.toFixed(5)}, ${ultimaPos.lng.toFixed(5)}`);
    },
    (err) => {
      actualizarStatus('Error GPS: ' + err.message);
    },
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
  );

  // Enviar a Supabase cada 5 segundos
  intervaloEnvio = setInterval(enviarPosicion, 5000);

  // Mostrar indicador
  btn.style.display = 'none';
  document.getElementById('ubicacionIndicador').style.display = 'flex';
}

// ============ ENVIAR POSICIÓN ============
async function enviarPosicion() {
  if (!ultimaPos || !compartiendo) return;

  await supabaseClient.from('gps_lecturas').insert({
    user_id:   ubicacionUserId,
    ruta_id:   ubicacionRutaId,
    lat:       ultimaPos.lat,
    lng:       ultimaPos.lng,
    velocidad: ultimaPos.velocidad,
    ts:        new Date().toISOString(),
  });
}

// ============ DETENER ============
async function detenerCompartir() {
  compartiendo = false;

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  if (intervaloEnvio) {
    clearInterval(intervaloEnvio);
    intervaloEnvio = null;
  }

  // Marcar ruta como completada
  if (ubicacionRutaId) {
    await supabaseClient
      .from('rutas')
      .update({ estado: 'completada' })
      .eq('id', ubicacionRutaId);
    ubicacionRutaId = null;
  }

  // Restaurar botón
  document.getElementById('ubicacionIndicador').style.display = 'none';
  const btn = document.getElementById('btnCompartirUbicacion');
  btn.style.display = 'flex';
  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-location-arrow"></i> Compartir mi ubicación';
}

// ============ UTILS ============
function actualizarStatus(texto) {
  const el = document.getElementById('ubicacionStatus');
  if (el) el.textContent = texto;
}
