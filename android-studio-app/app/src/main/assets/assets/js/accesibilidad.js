// // DiaMon - Modo de Accesibilidad Clínica
// Diseñado para personas con baja visión, retinopatía diabética o temblor motor
// class AccesibilidadManager {
  constructor() {
    this.storageKey = 'diamon_accesibilidad_config';
    this.config = this.cargarConfig();
    this.injectButton();
    this.aplicarConfiguracion();
    window.accesibilidadInstance = this;
  }

  cargarConfig() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      textoGrande: false,
      altoContraste: false,
      botonesGrandes: false
    };
  }

  guardarConfig() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.config));
    } catch (_) {}
    this.aplicarConfiguracion();
  }

  aplicarConfiguracion() {
    const root = document.documentElement;

    // 1. Texto Grande
    if (this.config.textoGrande) {
      root.classList.add('access-large-text');
    } else {
      root.classList.remove('access-large-text');
    }

    // 2. Alto Contraste
    if (this.config.altoContraste) {
      root.classList.add('access-high-contrast');
    } else {
      root.classList.remove('access-high-contrast');
    }

    // 3. Botones Grandes
    if (this.config.botonesGrandes) {
      root.classList.add('access-large-buttons');
    } else {
      root.classList.remove('access-large-buttons');
    }

    this.actualizarChecksModal();
  }

  injectButton() {
    const navRight = document.querySelector('.navbar-right');
    if (!navRight || document.getElementById('btnOpenAccesibilidad')) return;

    const btn = document.createElement('button');
    btn.id = 'btnOpenAccesibilidad';
    btn.className = 'btn-access-nav';
    btn.title = 'Opciones de accesibilidad visual y lectura';
    btn.innerHTML = '<i class="fas fa-universal-access"></i> <span class="hide-mobile">Accesibilidad</span>';
    btn.onclick = () => this.abrirModal();

    navRight.insertBefore(btn, navRight.firstChild);
  }

  abrirModal() {
    let modal = document.getElementById('modalAccesibilidad');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalAccesibilidad';
      modal.className = 'diamon-modal-overlay';
      modal.innerHTML = `
        <div class="diamon-modal-card" style="max-width: 420px;">
          <div class="diamon-modal-header">
            <div class="modal-title">
              <i class="fas fa-universal-access" style="color: #38bdf8;"></i>
              <h3>Opciones de Accesibilidad</h3>
            </div>
            <button class="modal-close-btn" onclick="document.getElementById('modalAccesibilidad').classList.remove('active')">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="diamon-modal-body">
            <p style="font-size: 12px; color: #94a3b8; margin-bottom: 16px;">
              Configuraciones pensadas para facilitar la lectura si experimentas visión borrosa o temblor en las manos:
            </p>

            <div class="access-option-row">
              <div class="access-option-info">
                <strong>Texto Grande (+25%)</strong>
                <span>Aumenta el tamaño de letra en todo el sistema</span>
              </div>
              <label class="access-switch">
                <input type="checkbox" id="checkAccessTextoGrande" onchange="window.accesibilidadInstance.toggle('textoGrande')">
                <span class="access-slider"></span>
              </label>
            </div>

            <div class="access-option-row">
              <div class="access-option-info">
                <strong>Alto Contraste Clínico</strong>
                <span>Fondo profundo con letras blancas nítidas para retinopatía</span>
              </div>
              <label class="access-switch">
                <input type="checkbox" id="checkAccessAltoContraste" onchange="window.accesibilidadInstance.toggle('altoContraste')">
                <span class="access-slider"></span>
              </label>
            </div>

            <div class="access-option-row">
              <div class="access-option-info">
                <strong>Botones Táctiles Amplios (50px)</strong>
                <span>Facilita tocar los botones si tienes temblor en los dedos</span>
              </div>
              <label class="access-switch">
                <input type="checkbox" id="checkAccessBotonesGrandes" onchange="window.accesibilidadInstance.toggle('botonesGrandes')">
                <span class="access-slider"></span>
              </label>
            </div>

            <!-- Botón de lectura en voz alta -->
            <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.08);">
              <button class="btn-custom btn-login" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px;" onclick="window.accesibilidadInstance.leerResumenVoz()">
                <i class="fas fa-volume-up"></i> Leer mi estado actual en voz alta
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    this.actualizarChecksModal();
    modal.classList.add('active');
  }

  actualizarChecksModal() {
    const c1 = document.getElementById('checkAccessTextoGrande');
    const c2 = document.getElementById('checkAccessAltoContraste');
    const c3 = document.getElementById('checkAccessBotonesGrandes');

    if (c1) c1.checked = !!this.config.textoGrande;
    if (c2) c2.checked = !!this.config.altoContraste;
    if (c3) c3.checked = !!this.config.botonesGrandes;
  }

  toggle(prop) {
    this.config[prop] = !this.config[prop];
    this.guardarConfig();
  }

  leerResumenVoz() {
    if (!window.speechSynthesis) {
      alert('Tu navegador no soporta síntesis de voz.');
      return;
    }

    const glucosaVal = document.getElementById('glucoseValue')?.textContent || '98';
    const coords = (window.centrosMedicosInstance && window.centrosMedicosInstance.patientCoords)
      ? window.centrosMedicosInstance.patientCoords
      : [10.3910, -75.4794];

    const sector = window.vozSOSInstance
      ? window.vozSOSInstance.identificarBarrioCartagena(coords[0], coords[1]).nombre
      : 'Cartagena';

    const texto = `Hola. Tu glucosa registrada es de ${glucosaVal} miligramos por decilitro. Tu ubicación actual es en ${sector}, Cartagena. El sistema de monitoreo se encuentra activo.`;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-CO';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new AccesibilidadManager();
});

