// // DiaMon - PulseCard: Identificación Médica y Código QR de Emergencia
// Genera y gestiona la ficha de emergencia accesible por QR
// const DEFAULT_MEDICAL_PROFILE = {
  nombre: 'Damián Díaz Balseiro',
  condicion: 'Diabetes Mellitus Tipo 2 Insulinorrequiriente + Hipertensión Arterial + Neuropatía Diabética',
  tipoDiabetes: 'tipo2_hta',
  tratamiento: '8AM: Pantoprazol, Metformina, Firialta, Nifedipina | 2PM: Valsartán | 8PM: Atorvastatina, Metformina, Gabapentina, Lipotic, Nifedipino | 9PM: Insulina 24 UI | Sábados: Ozempic',
  glucosaObjetivo: 'Glucosa: 80 - 180 mg/dL | Presión Arterial: < 140/90 mmHg',
  grupoSanguineo: 'O+',
  alergias: 'Ninguna alergia medicamentosa reportada',
  contactoNombre: 'Valentina Díaz Martínez (Nieta / Cuidadora Principal)',
  contactoTelefono: '+57 300 456 7890',
  contactoRelacion: 'Nieta / Cuidadora Principal',
  medicoTratante: 'Enf. Jefe Elizabeth Vargas Caro',
  medicoTelefono: '+57 310 987 6543',
  ciudad: 'Barrio Chapacuá, Cartagena de Indias',
  centroReferencia: 'Hospital Universitario del Caribe / Clínica Blas de Lezo',
  notasEmergencia: 'Paciente de Chapacuá (Cartagena) en tratamiento con Insulina 24 UI a las 9:00 PM, Ozempic los sábados y antihipertensivos (Valsartán 2:00 PM + Nifedipina 8 AM/8 PM). Si presenta sudoración fría o mareo estando consciente, aplicar Regla 15-15 (15g de azúcar rápida) y medir presión arterial sentado.'
};

class MedicalQRManager {
  constructor() {
    this.storageKey = 'diamon_medical_profile';
    this.profile = this.loadProfile();
    this.qrInstance = null;
  }

  loadProfile() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        return { ...DEFAULT_MEDICAL_PROFILE, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Error leyendo perfil médico local:', e);
    }
    return { ...DEFAULT_MEDICAL_PROFILE };
  }

  saveProfile(updatedData) {
    this.profile = { ...this.profile, ...updatedData };
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.profile));
    } catch (e) {
      console.warn('Error guardando perfil médico:', e);
    }
    this.generateQR();
    return this.profile;
  }

  getEmergencyURL() {
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '');
    const pagePrefix = window.location.pathname.includes('/pages/') ? '' : '/pages';
    const compactData = {
      n: this.profile.nombre,
      c: this.profile.condicion,
      t: this.profile.tratamiento,
      s: this.profile.grupoSanguineo,
      a: this.profile.alergias,
      cn: this.profile.contactoNombre,
      ct: this.profile.contactoTelefono,
      h: this.profile.centroReferencia,
      m: this.profile.notasEmergencia
    };
    const jsonStr = JSON.stringify(compactData);
    const encoded = encodeURIComponent(jsonStr);
    return `${baseUrl}${pagePrefix}/ficha-emergencia.html#${encoded}`;
  }

  generateQR(containerId = 'qrcodeCanvas') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    const emergencyURL = this.getEmergencyURL();

    if (typeof QRCode !== 'undefined') {
      this.qrInstance = new QRCode(container, {
        text: emergencyURL,
        width: 190,
        height: 190,
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
              <h3>Identificación Médica - PulseCard</h3>
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

