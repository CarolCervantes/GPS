// Ficha medica y codigo QR de emergencia (PulseCard)

class MedicalQRManager {
  constructor() {
    // La ficha es del paciente activo y se guarda en su perfil de Supabase (columna ficha)
    const ses = window.DiaMonSesion;
    const pac = ses ? ses.pacienteActivo(ses.leerUsuario()) : null;
    this.codigo = (pac && pac.codigoPaciente) || 'DM-8492';
    this.profile = { nombre: (pac && pac.nombre) || '', condicion: '', tratamiento: '', grupoSanguineo: '', alergias: '',
      contactoNombre: '', contactoTelefono: '', centroReferencia: '', notasEmergencia: '' };
    this.qrInstance = null;
  }

  // caso-estudio.js la llena cuando llegan los datos de Supabase
  cargarDesdePerfil(datos) {
    this.profile = { ...this.profile, ...datos };
    this.generateQR();
    if (typeof window.alCargarFichaMedica === 'function') window.alCargarFichaMedica(this.profile);
  }

  // Texto que va dentro del QR. Va la ficha completa en texto para que se pueda leer
  // con cualquier celular aunque no tenga internet. Se quitan tildes para que todos los lectores lo muestren bien.
  // El QR lleva un enlace a la ficha de emergencia en la pagina publicada.
  // La clave (fichaToken) es secreta: sin ella nadie puede ver la ficha del paciente.
  getTextoQR() {
    const local = /localhost|127\.0\.0\.1/.test(window.location.hostname) || window.location.protocol === 'file:';
    const base = local ? 'https://diamon-gps-salud.vercel.app' : window.location.origin;
    return this.profile.fichaToken ? `${base}/pages/ficha-emergencia.html?t=${this.profile.fichaToken}` : base;
  }

  // Guarda la ficha en el perfil del paciente (Supabase) y vuelve a dibujar el QR
  async saveProfile(updatedData) {
    this.profile = { ...this.profile, ...updatedData };
    const { nombre, condicion, fichaToken, ...ficha } = this.profile;
    if (window.DiaMonDatos && window.DiaMonDatos.pacienteId()) {
      await window.DiaMonDatos.guardarPerfilPaciente({ ficha, diagnostico: condicion });
    }
    this.generateQR();
    return this.profile;
  }

  // "Abrir ficha" y el QR llevan al mismo enlace
  getEmergencyURL() {
    return this.getTextoQR();
  }


  generateQR(containerId = 'qrcodeCanvas') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    const emergencyURL = this.getEmergencyURL();

    if (typeof QRCode !== 'undefined') {
      this.qrInstance = new QRCode(container, {
        text: this.getTextoQR(),
        width: 300,
        height: 300,
        colorDark: '#0B1220',
        colorLight: '#FFFFFF',
        correctLevel: QRCode.CorrectLevel.M
      });
    } else {
      container.innerHTML = `
        <div style="padding: 20px; font-size: 12px; color: #8893a3; text-align:center;">
          Librería QR cargando...
        </div>
      `;
    }

    // Actualizar vista previa de texto si existe
    const urlPreview = document.getElementById('qrUrlPreview');
    if (urlPreview) {
      urlPreview.href = emergencyURL;
    }
  }

  renderPulseCardSummary(containerId = 'pulseCardSummary') {
    const el = document.getElementById(containerId);
    if (!el) return;

    el.innerHTML = `
      <div class="pulsecard-container">
        <div class="pulsecard-badge-top">
          <span><i class="fas fa-heartbeat"></i> ID MÉDICA DE EMERGENCIA</span>
          <span class="blood-type-badge">${this.profile.grupoSanguineo}</span>
        </div>
        
        <div class="pulsecard-body">
          <div class="pulsecard-patient">
            <h3 class="pulsecard-name">${this.profile.nombre}</h3>
            <span class="pulsecard-condition">${this.profile.condicion}</span>
          </div>

          <div class="pulsecard-details-grid">
            <div class="pulsecard-item">
              <span class="pulsecard-label">Alergias</span>
              <span class="pulsecard-val alert-text">${this.profile.alergias || 'Ninguna conocida'}</span>
            </div>
            <div class="pulsecard-item">
              <span class="pulsecard-label">Tratamiento</span>
              <span class="pulsecard-val">${this.profile.tratamiento}</span>
            </div>
            <div class="pulsecard-item full-width">
              <span class="pulsecard-label">Contacto SOS Principal</span>
              <a href="tel:${this.profile.contactoTelefono.replace(/\s+/g, '')}" class="pulsecard-contact-btn">
                <i class="fas fa-phone-alt"></i> ${this.profile.contactoNombre} (${this.profile.contactoTelefono})
              </a>
            </div>
            <div class="pulsecard-item full-width">
              <span class="pulsecard-label">Hospital de Referencia (Cartagena)</span>
              <span class="pulsecard-val"><i class="fas fa-hospital-alt"></i> ${this.profile.centroReferencia}</span>
            </div>
          </div>
        </div>

        <div class="pulsecard-footer">
          <button class="btn-pulsecard-action" onclick="window.medicalQRManager.abrirModalQR()">
            <i class="fas fa-qrcode"></i> Mostrar Código QR
          </button>
          <a href="${this.getEmergencyURL()}" target="_blank" class="btn-pulsecard-action secondary">
            <i class="fas fa-external-link-alt"></i> Ver Ficha Completa
          </a>
        </div>
      </div>
    `;
  }

  abrirModalQR() {
    let modal = document.getElementById('qrModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'qrModal';
      modal.className = 'diamon-modal-overlay';
      modal.innerHTML = `
        <div class="diamon-modal-card">
          <div class="diamon-modal-header">
            <div class="modal-title">
              <i class="fas fa-qrcode" style="color:var(--brand);"></i>
              <h3>Identificación Médica — PulseCard</h3>
            </div>
            <button class="modal-close-btn" onclick="document.getElementById('qrModal').classList.remove('active')">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="diamon-modal-body text-center">
            <p style="font-size:12px; color:var(--fg-3); margin-bottom:14px;">
              Escanea este código con cualquier teléfono para ver la ficha médica y contacto SOS en caso de emergencia.
            </p>
            <div class="qr-wrapper" style="display:inline-block; padding:14px; background:white; border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,0.4);">
              <div id="qrcodeModalContainer"></div>
            </div>
            <div style="margin-top:16px;">
              <div style="font-weight:700; color:var(--fg-1); font-size:15px;" id="modalPatientName">${this.profile.nombre}</div>
              <div style="font-size:12px; color:#ef4444; font-weight:600; margin-top:2px;">${this.profile.condicion}</div>
            </div>
          </div>

          <div class="diamon-modal-footer">
            <button class="btn-custom btn-login" onclick="window.print()">
              <i class="fas fa-print"></i> Imprimir Tarjeta
            </button>
            <a href="${this.getEmergencyURL()}" target="_blank" class="btn-custom btn-register">
              <i class="fas fa-eye"></i> Abrir Ficha
            </a>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    modal.classList.add('active');
    setTimeout(() => {
      this.generateQR('qrcodeModalContainer');
    }, 100);
  }
}

window.medicalQRManager = new MedicalQRManager();
