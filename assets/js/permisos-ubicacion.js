// DiaMon — Módulo de Solicitud y Permisos de Ubicación GPS
// Notificación inicial clínica para monitoreo continuo del paciente

class PermisosUbicacionManager {
  constructor() {
    this.storageKey = 'diamon_permiso_ubicacion_tipo';
    this.init();
  }

  init() {
    // Solo el paciente comparte su ubicacion. Al invitado, admin o cuidador no se le pide.
    if (window.DiaMonSesion && window.DiaMonSesion.rolDe(window.DiaMonSesion.leerUsuario()) !== 'usuario') return;

    // Si ya tomó la decisión antes, solo re-iniciar el seguimiento si fue aceptado
    const saved = localStorage.getItem(this.storageKey);
    if (!saved) {
      // Mostrar modal tras 800ms de cargar la página
      setTimeout(() => this.mostrarModalPermiso(), 800);
    } else if (saved === 'siempre' || saved === 'en_uso') {
      this.activarGeolocalizacionNativa(saved === 'siempre');
    }
  }

  mostrarModalPermiso() {
    if (document.getElementById('modalPermisoUbicacion')) return;

    const modal = document.createElement('div');
    modal.id = 'modalPermisoUbicacion';
    modal.className = 'diamon-modal-overlay active';
    modal.innerHTML = `
      <div class="diamon-modal-card permiso-card">
        <div class="permiso-header">
          <div class="permiso-icon-circle">
            <i class="fas fa-map-marker-alt"></i>
          </div>
          <h3 class="permiso-title">Permiso de Ubicación para tu Monitoreo</h3>
          <p class="permiso-desc">
            Para que tu familiar registrado y el servicio de emergencias de Cartagena puedan ubicarte si sufres una descompensación de glucosa o activas el SOS, DiaMon necesita acceso a tu ubicación GPS.
          </p>
        </div>

        <div class="permiso-options-list">
          <button class="permiso-btn-option recommended" onclick="window.permisosUbicacionInstance.seleccionarOpcion('siempre')">
            <div class="permiso-opt-icon"><i class="fas fa-shield-alt"></i></div>
            <div class="permiso-opt-text">
              <strong>Permitir siempre / En todo momento</strong>
              <span>Recomendado: Garantiza seguimiento si la pantalla se bloquea en la calle o buseta.</span>
            </div>
            <span class="permiso-tag-rec">Recomendado</span>
          </button>

          <button class="permiso-btn-option" onclick="window.permisosUbicacionInstance.seleccionarOpcion('en_uso')">
            <div class="permiso-opt-icon"><i class="fas fa-mobile-alt"></i></div>
            <div class="permiso-opt-text">
              <strong>Solo mientras la app esté abierta</strong>
              <span>El GPS se pausa si cambias de app o se apaga la pantalla.</span>
            </div>
          </button>
        </div>

        <div class="permiso-footer-note">
          <i class="fas fa-lock"></i> Tus datos de localización solo son visibles para tus familiares autorizados.
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  seleccionarOpcion(tipo) {
    const modal = document.getElementById('modalPermisoUbicacion');
    if (tipo === 'en_uso') {
      // Mostrar alerta de seguridad recomendando cambiar a "siempre"
      this.mostrarAlertaSeguridadParcial();
    } else {
      if (modal) modal.remove();
      this.guardarYActivar('siempre');
    }
  }

  mostrarAlertaSeguridadParcial() {
    const modal = document.getElementById('modalPermisoUbicacion');
    if (!modal) return;

    modal.innerHTML = `
      <div class="diamon-modal-card permiso-card alerta-seguridad">
        <div class="permiso-header">
          <div class="permiso-icon-circle warning">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <h3 class="permiso-title" style="color:#f59e0b;">Aviso de Seguridad para tu Protección</h3>
          <p class="permiso-desc">
            Has elegido <strong>"Solo mientras la app esté abierta"</strong>. Ten en cuenta que si vas en transporte público por Cartagena o caminando y tu celular se bloquea o guardas el teléfono en el bolsillo, <u>tu familiar no podrá ver tu ubicación en tiempo real</u> si sufres un desmayo o hipoglucemia.
          </p>
        </div>

        <div class="permiso-actions-vertical">
          <button class="btn-custom" style="background:#0284c7; color:white; font-weight:700; padding:12px; font-size:13px; width:100%;" onclick="window.permisosUbicacionInstance.guardarYActivar('siempre')">
            <i class="fas fa-check-shield"></i> Cambiar a Permitir Siempre (Más seguro)
          </button>

          <button class="btn-custom" style="background:rgba(255,255,255,0.08); color:#cbd5e1; padding:10px; font-size:12px; width:100%; border:1px solid rgba(255,255,255,0.15);" onclick="window.permisosUbicacionInstance.guardarYActivar('en_uso')">
            Entendido, continuar solo con app en uso
          </button>
        </div>
      </div>
    `;
  }

  guardarYActivar(tipo) {
    const modal = document.getElementById('modalPermisoUbicacion');
    if (modal) modal.remove();

    try {
      localStorage.setItem(this.storageKey, tipo);
    } catch (_) {}

    this.activarGeolocalizacionNativa(tipo === 'siempre');
    if (window.casoEstudio && !window.casoEstudio.transmitiendoGPSReal) {
      window.casoEstudio.toggleTransmisionGPSReal();
    }

    if (window.mostrarNotificacion) {
      window.mostrarNotificacion(
        tipo === 'siempre' ? 'Ubicación configurada: Monitoreo continuo activo' : 'Ubicación configurada: Solo en primer plano',
        'info'
      );
    }
  }

  activarGeolocalizacionNativa(modoContinuo = true) {
    if (!navigator.geolocation) return;

    const opciones = {
      enableHighAccuracy: true,
      maximumAge: modoContinuo ? 2000 : 10000,
      timeout: 30000
    };

    navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const precision = Math.round(pos.coords.accuracy || 5);
        const velocidad = Math.round((pos.coords.speed || 0) * 3.6);

        // Actualizar telemetría global
        if (window.saludDiariaInstance) {
          window.saludDiariaInstance.actualizarEstadoGPS(true, precision);
        }

        // Si tenemos la instancia de centros médicos o tráfico, alimentar posición
        if (window.centrosMedicosInstance) {
          window.centrosMedicosInstance.setPatientCoords([lat, lng]);
        }

        if (window.traficoCartagenaInstance) {
          window.traficoCartagenaInstance.procesarTelemetriaGPS(lat, lng, velocidad);
        }

        // Si el mapa ya está cargado, actualizar marcador paciente con precisión y centrado
        if (typeof window.actualizarMarcadorUbicacionReal === 'function') {
          window.actualizarMarcadorUbicacionReal(lat, lng, precision);
        } else if (window.liveMapInstance && window._patientMarker) {
          window._patientMarker.setLatLng([lat, lng]);
        }
      },
      (err) => {
        console.warn('Geolocalización nativa:', err.message);
        if (window.saludDiariaInstance) {
          window.saludDiariaInstance.actualizarEstadoGPS(false);
        }
      },
      opciones
    );
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.permisosUbicacionInstance = new PermisosUbicacionManager();
});

// Desde la seccion Seguridad el paciente puede volver a elegir el permiso de ubicacion
window.cambiarPermisoUbicacion = function () {
  const gestor = window.permisosUbicacionInstance;
  if (gestor) gestor.mostrarModalPermiso();
};

// Texto que dice que permiso esta activo ahora
document.addEventListener('DOMContentLoaded', () => {
  const estado = document.getElementById('estadoPermisoUbicacion');
  if (!estado) return;
  const textos = {
    siempre: 'Activo todo el tiempo. Toca para cambiarlo.',
    en_uso: 'Activo solo con la app abierta. Toca para cambiarlo.'
  };
  estado.textContent = textos[localStorage.getItem('diamon_permiso_ubicacion_tipo')] || 'Aún no has elegido. Toca para decidir.';
});
