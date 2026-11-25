// ============================================================
// DiaMon — Ficha Médica Digital & Código QR en Tiempo Real (PulseCard)
// Muestra al escanear: Perfil del paciente + Qué condición tiene + Cómo va hoy
// ============================================================

const DEFAULT_MEDICAL_PROFILE = {
  codigoPaciente: 'DM-8492',
  nombre: 'Damián Díaz Balseiro',
  edad: 74,
  pesoKg: 73,
  condicion: 'Diabetes Mellitus Tipo 2 Insulinorrequiriente + Hipertensión Arterial + Neuropatía Diabética',
  tipoDiabetes: 'tipo2_hta',
  tratamiento: '8AM: Pantoprazol, Metformina, Firialta, Nifedipina | 2PM: Valsartán | 8PM: Atorvastatina, Metformina, Gabapentina, Lipotic, Nifedipino | 9PM: Insulina 24 UI | Sábados: Ozempic',
  glucosaObjetivo: 'Glucosa: 80 - 180 mg/dL | Presión Arterial: < 140/90 mmHg',
  grupoSanguineo: 'O+',
  alergias: 'Ninguna alergia medicamentosa reportada',
  contactoNombre: 'Valentina Díaz Martínez (Familiar / Cuidadora)',
  contactoTelefono: '+57 300 456 7890',
  contactoRelacion: 'Familiar / Cuidadora Principal',
  medicoTratante: 'Enf. Jefe Elizabeth Vargas Caro',
  medicoTelefono: '+57 310 987 6543',
  ciudad: 'Barrio Chapacuá, Cartagena de Indias',
  centroReferencia: 'Hospital Universitario del Caribe / Clínica Blas de Lezo',
  notasEmergencia: 'Paciente adulto mayor (74 años) en Chapacuá, Cartagena. Usa Insulina Basal 24 UI (9:00 PM), Ozempic semanal (sábados) y antihipertensivos (Valsartán 2:00 PM + Nifedipina 8 AM/8 PM). Si presenta sudoración fría o mareo estando consciente, aplicar Regla 15-15 (15g de azúcar rápida) y medir presión sentado.'
};

const DETECTED_LAN_FALLBACK = 'http://192.168.1.7:8000';

class MedicalQRManager {
  constructor() {
    this.storageKey = 'diamon_medical_profile';
    this.baseOverrideKey = 'diamon_qr_base_override';
    this.profile = this.loadProfile();
    this.qrMode = 'web'; // 'web' | 'texto'
    this.qrInstance = null;
    this.bindLiveListeners();
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
    this.refreshAllQRs();
    return this.profile;
  }

  bindLiveListeners() {
    window.addEventListener('storage', () => {
      this.profile = this.loadProfile();
      this.refreshAllQRs();
    });
  }

  obtenerFechaHoyISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  obtenerUidSupabaseActivo() {
    try {
      if (window.currentUser && typeof window.currentUser.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(window.currentUser.id)) {
        return window.currentUser.id;
      }
      const keys = Object.keys(localStorage);
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
          const parsed = JSON.parse(localStorage.getItem(k) || 'null');
          const id = parsed?.user?.id;
          if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id)) return id;
        }
      }
    } catch (_) {}
    return '';
  }

  getLivePatientState() {
    let res = null;
    if (window.casoEstudio && typeof window.casoEstudio.obtenerResumenClinicoActual === 'function') {
      res = window.casoEstudio.obtenerResumenClinicoActual();
    }

    // Nombre y código dinámicos si inició sesión otro paciente
    let nombre = this.profile.nombre || DEFAULT_MEDICAL_PROFILE.nombre;
    let codigo = this.profile.codigoPaciente || DEFAULT_MEDICAL_PROFILE.codigoPaciente;
    try {
      const ses = JSON.parse(sessionStorage.getItem('diamon_demo_user') || localStorage.getItem('diamon_current_user') || 'null');
      if (ses) {
        if (ses.rol === 'usuario' && ses.nombre) {
          nombre = ses.nombre;
          if (ses.codigoPaciente) codigo = ses.codigoPaciente;
        } else if (ses.pacienteVinculado && ses.pacienteVinculado.nombre) {
          nombre = ses.pacienteVinculado.nombre;
          if (ses.pacienteVinculado.codigoPaciente) codigo = ses.pacienteVinculado.codigoPaciente;
        }
      }
    } catch (_) {}

    const glucosaVal = res?.ultimaGlucosa?.valor ?? 114;
    const glucosaCtx = res?.ultimaGlucosa?.contexto ?? 'ayunas';
    const glucosaLabel = res?.evalG?.etiqueta ?? 'En meta clínica';
    const glucosaClase = res?.evalG?.clase ?? 'success';
    const tir = res?.enRangoG ?? 100;

    const sis = res?.ultimaPresion?.sistolica ?? 126;
    const dia = res?.ultimaPresion?.diastolica ?? 78;
    const pulso = res?.ultimaPresion?.pulso ?? 71;
    const presionLabel = res?.evalP?.etiqueta ?? 'Presión Controlada';
    const presionClase = res?.evalP?.clase ?? 'success';

    // Cumplimiento de medicamentos de hoy (bitmask 5 bloques)
    const hoy = this.obtenerFechaHoyISO();
    let medsBitmask = 0;
    let medsTomadas = 0;
    const medsTotal = 5;
    try {
      const savedMeds = JSON.parse(localStorage.getItem('diamon_meds_cumplimiento_' + hoy) || '{}');
      ['med-1', 'med-2', 'med-3', 'med-4', 'med-5'].forEach((id, idx) => {
        if (savedMeds[id]?.tomada) {
          medsBitmask |= (1 << idx);
          medsTomadas++;
        }
      });
    } catch (_) {}

    // Estado diario de bienestar (check-in)
    let animo = 'estable';
    try {
      const savedEst = JSON.parse(localStorage.getItem('diamon_estado_diario_' + hoy) || 'null');
      if (savedEst && savedEst.estado) {
        animo = savedEst.estado; // 'bien' | 'regular' | 'mal'
      }
    } catch (_) {}

    // Coordenadas GPS actuales
    const coords = window.TelemetriaDiaMon?.ubicacion || res?.paciente?.coordenadasCasa || { lat: 10.39991, lng: -75.47886 };
    const lat = Number(coords.lat || 10.39991).toFixed(5);
    const lng = Number(coords.lng || -75.47886).toFixed(5);

    return {
      uid: this.obtenerUidSupabaseActivo(),
      codigo,
      nombre,
      edad: res?.paciente?.edad || this.profile.edad || 74,
      pesoKg: res?.paciente?.pesoKg || this.profile.pesoKg || 73,
      sangre: this.profile.grupoSanguineo || 'O+',
      condicion: this.profile.condicion || DEFAULT_MEDICAL_PROFILE.condicion,
      alergias: this.profile.alergias || DEFAULT_MEDICAL_PROFILE.alergias,
      contactoNombre: this.profile.contactoNombre || DEFAULT_MEDICAL_PROFILE.contactoNombre,
      contactoTelefono: this.profile.contactoTelefono || DEFAULT_MEDICAL_PROFILE.contactoTelefono,
      medico: this.profile.medicoTratante || DEFAULT_MEDICAL_PROFILE.medicoTratante,
      hospital: this.profile.centroReferencia || DEFAULT_MEDICAL_PROFILE.centroReferencia,
      glucosaVal,
      glucosaCtx,
      glucosaLabel,
      glucosaClase,
      tir,
      sis,
      dia,
      pulso,
      presionLabel,
      presionClase,
      medsBitmask,
      medsTomadas,
      medsTotal,
      animo,
      lat,
      lng
    };
  }

  getBaseUrlForQR() {
    try {
      const custom = (localStorage.getItem(this.baseOverrideKey) || '').trim().replace(/\/+$/, '');
      if (custom) return custom;
    } catch (_) {}

    const proto = window.location.protocol;
    const host = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';

    if (proto === 'file:' || !host) {
      return DETECTED_LAN_FALLBACK;
    }
    if (host === 'localhost' || host === '127.0.0.1') {
      return `http://192.168.1.7${port || ':8000'}`;
    }

    const pathDir = window.location.pathname.includes('/pages/')
      ? window.location.pathname.split('/pages/')[0]
      : window.location.pathname.replace(/\/[^\/]*$/, '');
    return `${window.location.origin}${pathDir}`.replace(/\/+$/, '');
  }

  setBaseUrlOverride(newBaseUrl) {
    const clean = (newBaseUrl || '').trim().replace(/\/+$/, '');
    try {
      if (clean) {
        localStorage.setItem(this.baseOverrideKey, clean);
      } else {
        localStorage.removeItem(this.baseOverrideKey);
      }
    } catch (_) {}
    this.refreshAllQRs();
  }

  getEmergencyURL(useRelativeForLocalClick = false) {
    const st = this.getLivePatientState();
    const params = new URLSearchParams();
    if (st.uid) params.set('u', st.uid);
    params.set('id', st.codigo);
    params.set('n', st.nombre);
    params.set('ed', String(st.edad));
    params.set('gs', st.sangre);
    params.set('g', String(st.glucosaVal));
    params.set('gc', st.glucosaCtx);
    params.set('tir', String(st.tir));
    params.set('pa', `${st.sis}-${st.dia}`);
    params.set('p', String(st.pulso));
    params.set('mb', String(st.medsBitmask));
    params.set('an', st.animo);
    params.set('la', String(st.lat));
    params.set('ln', String(st.lng));
    params.set('tel', st.contactoTelefono.replace(/\s+/g, ''));

    // Solo anexar campos personalizados si cambiaron frente al caso base para mantener el QR ultra-corto y fácil de escanear
    if (st.alergias && !st.alergias.toLowerCase().includes('ninguna')) {
      params.set('al', st.alergias.slice(0, 60));
    }

    if (useRelativeForLocalClick) {
      const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';
      return `${prefix}ficha-emergencia.html?${params.toString()}`;
    }

    const base = this.getBaseUrlForQR();
    const hasFicha = base.endsWith('ficha-emergencia.html');
    const endpoint = hasFicha
      ? base
      : (base.endsWith('/pages') ? `${base}/ficha-emergencia.html` : `${base}/pages/ficha-emergencia.html`);
    return `${endpoint}?${params.toString()}`;
  }

  getOfflinePlainText() {
    const st = this.getLivePatientState();
    return [
      `DIAMON FICHA MEDICA (${st.codigo})`,
      `Paciente: ${st.nombre} (${st.edad}a | Sangre ${st.sangre})`,
      `Tiene: DM2 Insulinorrequiriente + HTA + Neuropatia`,
      `Como va: Glucosa ${st.glucosaVal} mg/dL (${st.glucosaLabel}) | PA ${st.sis}/${st.dia} mmHg (${st.pulso} BPM) | Dosis hoy: ${st.medsTomadas}/${st.medsTotal}`,
      `GPS: ${st.lat},${st.lng} (Chapacua, Cartagena)`,
      `SOS Familiar: ${st.contactoTelefono} | Urgencias: 123`
    ].join('\n');
  }

  getQRPayloadText() {
    return this.qrMode === 'texto' ? this.getOfflinePlainText() : this.getEmergencyURL(false);
  }

  generateQR(containerId = 'qrcodeCanvas', size = 200) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    const payload = this.getQRPayloadText();

    if (typeof QRCode !== 'undefined') {
      try {
        this.qrInstance = new QRCode(container, {
          text: payload,
          width: size,
          height: size,
          colorDark: '#081426',
          colorLight: '#FFFFFF',
          correctLevel: QRCode.CorrectLevel.L
        });
      } catch (err) {
        console.error('[MedicalQR] Error generando QR:', err);
        container.innerHTML = '<div style="padding:16px;font-size:12px;color:#ef4444;">Error generando QR</div>';
      }
    } else {
      container.innerHTML = `
        <div style="padding: 20px; font-size: 12px; color: #8893a3; text-align:center;">
          Librería QR cargando...
        </div>
      `;
    }

    const urlPreview = document.getElementById('qrUrlPreview');
    if (urlPreview) {
      urlPreview.href = this.getEmergencyURL(true);
    }
  }

  cambiarModoQR(nuevoModo) {
    this.qrMode = nuevoModo === 'texto' ? 'texto' : 'web';
    this.refreshAllQRs();
  }

  copiarEnlaceFicha() {
    const url = this.getEmergencyURL(false);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion('Enlace de la ficha médica del paciente copiado al portapapeles.', 'success');
        }
      }).catch(() => {});
    }
  }

  refreshAllQRs() {
    if (document.getElementById('pulseCardSummary')) {
      this.renderPulseCardSummary('pulseCardSummary');
    }
    const modal = document.getElementById('qrModal');
    if (modal && modal.classList.contains('active')) {
      this.renderModalContent(modal);
      setTimeout(() => this.generateQR('qrcodeModalContainer', 215), 40);
    }
  }

  renderPulseCardSummary(containerId = 'pulseCardSummary') {
    const el = document.getElementById(containerId);
    if (!el) return;

    const st = this.getLivePatientState();
    const localPreviewHref = this.getEmergencyURL(true);
    const qrBaseActual = this.getBaseUrlForQR();

    el.innerHTML = `
      <div class="pulsecard-container" style="border:1px solid rgba(56,189,248,0.3);">
        <div class="pulsecard-badge-top">
          <span><i class="fas fa-qrcode"></i> TARJETA QR DEL PACIENTE — PERFIL, DIAGNÓSTICO Y ESTADO EN VIVO</span>
          <span class="blood-type-badge">${st.sangre}</span>
        </div>

        <div class="pulsecard-body" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:20px; align-items:center;">
          <div>
            <div class="pulsecard-patient">
              <div style="font-size:11px; color:#38bdf8; font-weight:700; margin-bottom:2px;">CÓDIGO ${st.codigo} · ${st.edad} AÑOS</div>
              <h3 class="pulsecard-name">${st.nombre}</h3>
              <span class="pulsecard-condition">${st.condicion}</span>
            </div>

            <!-- Resumen rápido: ¿Cómo va hoy? -->
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-bottom:14px;">
              <div style="background:rgba(15,23,42,0.75); border:1px solid rgba(94,234,212,0.25); border-radius:10px; padding:8px 10px;">
                <div style="font-size:10px; color:#94a3b8; text-transform:uppercase;">Glucosa hoy</div>
                <div style="font-size:15px; font-weight:800; color:#5eead4;">${st.glucosaVal} <small style="font-size:10px;">mg/dL</small></div>
                <div style="font-size:10px; color:#cbd5e1;">${st.glucosaLabel}</div>
              </div>
              <div style="background:rgba(15,23,42,0.75); border:1px solid rgba(56,189,248,0.25); border-radius:10px; padding:8px 10px;">
                <div style="font-size:10px; color:#94a3b8; text-transform:uppercase;">Presión / Pulso</div>
                <div style="font-size:15px; font-weight:800; color:#38bdf8;">${st.sis}/${st.dia}</div>
                <div style="font-size:10px; color:#cbd5e1;">${st.pulso} BPM</div>
              </div>
              <div style="background:rgba(15,23,42,0.75); border:1px solid rgba(251,191,36,0.25); border-radius:10px; padding:8px 10px;">
                <div style="font-size:10px; color:#94a3b8; text-transform:uppercase;">Dosis de hoy</div>
                <div style="font-size:15px; font-weight:800; color:#fbbf24;">${st.medsTomadas}/${st.medsTotal}</div>
                <div style="font-size:10px; color:#cbd5e1;">Esquema diario</div>
              </div>
            </div>

            <div class="pulsecard-details-grid">
              <div class="pulsecard-item full-width">
                <span class="pulsecard-label">Alergias</span>
                <span class="pulsecard-val alert-text">${st.alergias || 'Ninguna conocida'}</span>
              </div>
              <div class="pulsecard-item full-width">
                <span class="pulsecard-label">Contacto SOS Principal</span>
                <a href="tel:${st.contactoTelefono.replace(/\s+/g, '')}" class="pulsecard-contact-btn">
                  <i class="fas fa-phone-alt"></i> ${st.contactoNombre} (${st.contactoTelefono})
                </a>
              </div>
              <div class="pulsecard-item full-width">
                <span class="pulsecard-label">Hospital de Referencia</span>
                <span class="pulsecard-val"><i class="fas fa-hospital-alt"></i> ${st.hospital}</span>
              </div>
            </div>
          </div>

          <!-- Columna Derecha: Código QR listo para escanear -->
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(15,23,42,0.65); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:16px; text-align:center;">
            <div style="font-size:11px; font-weight:700; color:#38bdf8; margin-bottom:8px;">
              <i class="fas fa-mobile-alt"></i> ESCANEA CON LA CÁMARA DEL CELULAR
            </div>
            <div style="background:#ffffff; padding:12px; border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,0.45); display:inline-block;">
              <div id="qrcodeInlineSummary"></div>
            </div>
            <div style="font-size:11px; color:#94a3b8; margin-top:10px; line-height:1.4; max-width:250px;">
              Al escanear muestra el <strong>perfil</strong>, <strong>qué padece</strong>, <strong>qué medicamentos usa</strong> y <strong>cómo va hoy</strong>.
            </div>
            <div style="font-size:10px; color:#64748b; margin-top:4px; word-break:break-all;">
              Red activa: <code>${qrBaseActual}</code>
            </div>
          </div>
        </div>

        <div class="pulsecard-footer" style="flex-wrap:wrap;">
          <button class="btn-pulsecard-action" onclick="window.medicalQRManager.abrirModalQR()">
            <i class="fas fa-expand"></i> Ampliar / Configurar QR
          </button>
          <a href="${localPreviewHref}" target="_blank" class="btn-pulsecard-action secondary">
            <i class="fas fa-external-link-alt"></i> Ver lo que aparece al escanear
          </a>
          <button class="btn-pulsecard-action secondary" onclick="window.medicalQRManager.copiarEnlaceFicha()">
            <i class="fas fa-copy"></i> Copiar Enlace QR
          </button>
        </div>
      </div>
    `;

    setTimeout(() => {
      this.generateQR('qrcodeInlineSummary', 185);
    }, 50);
  }

  renderModalContent(modal) {
    const st = this.getLivePatientState();
    const localPreviewHref = this.getEmergencyURL(true);
    const currentBase = this.getBaseUrlForQR();
    const isWeb = this.qrMode === 'web';

    modal.innerHTML = `
      <div class="diamon-modal-card" style="max-width:480px;">
        <div class="diamon-modal-header">
          <div class="modal-title">
            <i class="fas fa-qrcode" style="color:var(--brand, #38bdf8);"></i>
            <h3>Código QR del Paciente — PulseCard</h3>
          </div>
          <button class="modal-close-btn" onclick="document.getElementById('qrModal').classList.remove('active')" aria-label="Cerrar">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="diamon-modal-body text-center" style="padding:18px 20px;">
          <!-- Selector de Modo: Web en Vivo vs Texto Sin Internet -->
          <div style="display:inline-flex; background:#090f1c; border:1px solid rgba(255,255,255,0.12); border-radius:10px; padding:3px; margin-bottom:12px; gap:4px;">
            <button type="button" onclick="window.medicalQRManager.cambiarModoQR('web')" style="border:none; padding:6px 12px; border-radius:8px; font-size:11.5px; font-weight:700; cursor:pointer; background:${isWeb ? '#0284c7' : 'transparent'}; color:${isWeb ? '#fff' : '#94a3b8'};">
              <i class="fas fa-globe"></i> Ficha Web en Vivo
            </button>
            <button type="button" onclick="window.medicalQRManager.cambiarModoQR('texto')" style="border:none; padding:6px 12px; border-radius:8px; font-size:11.5px; font-weight:700; cursor:pointer; background:${!isWeb ? '#0d9488' : 'transparent'}; color:${!isWeb ? '#fff' : '#94a3b8'};">
              <i class="fas fa-wifi-slash"></i> Texto Directo (Sin Red)
            </button>
          </div>

          <p style="font-size:12px; color:#cbd5e1; margin:0 0 12px 0; line-height:1.45;">
            ${isWeb
              ? 'Escanea con cualquier celular en la misma red Wi-Fi (o dominio público) para abrir el <strong>perfil completo, diagnóstico, medicamentos y signos vitales actuales</strong>.'
              : 'Modo sin internet: al escanear, la cámara del teléfono leerá directamente en pantalla el resumen médico y cómo va el paciente.'}
          </p>

          <div class="qr-wrapper" style="display:inline-block; padding:14px; background:#ffffff; border-radius:14px; box-shadow:0 8px 28px rgba(0,0,0,0.5);">
            <div id="qrcodeModalContainer"></div>
          </div>

          <!-- Chips en vivo incluidos en el QR -->
          <div style="margin-top:14px;">
            <div style="font-weight:800; color:#f8fafc; font-size:16px;">${st.nombre} <span style="font-size:12px; color:#38bdf8;">(${st.codigo} · ${st.sangre})</span></div>
            <div style="font-size:11.5px; color:#f87171; font-weight:600; margin-top:2px;">${st.condicion}</div>
            <div style="display:flex; justify-content:center; gap:8px; flex-wrap:wrap; margin-top:8px; font-size:11px;">
              <span style="background:rgba(16,185,129,0.15); color:#34d399; border:1px solid rgba(16,185,129,0.3); padding:3px 9px; border-radius:20px; font-weight:700;">
                🩸 Glucosa: ${st.glucosaVal} mg/dL
              </span>
              <span style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); padding:3px 9px; border-radius:20px; font-weight:700;">
                ❤️ PA: ${st.sis}/${st.dia} (${st.pulso} BPM)
              </span>
              <span style="background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid rgba(245,158,11,0.3); padding:3px 9px; border-radius:20px; font-weight:700;">
                💊 Hoy: ${st.medsTomadas}/${st.medsTotal}
              </span>
            </div>
          </div>

          ${isWeb ? `
          <!-- Ajuste rápido de IP / Dominio por si cambian de red Wi-Fi o usan URL en la nube -->
          <div style="margin-top:14px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.08); text-align:left;">
            <label style="display:block; font-size:11px; color:#94a3b8; margin-bottom:4px;">
              <i class="fas fa-network-wired"></i> Dirección servidor para escaneo desde celulares (IP Wi-Fi o URL pública):
            </label>
            <div style="display:flex; gap:6px;">
              <input id="qrCustomBaseInput" type="text" value="${currentBase}" placeholder="Ej: http://192.168.1.7:8000" style="flex:1; background:#090f1c; border:1px solid rgba(148,163,184,0.3); color:#f8fafc; border-radius:8px; padding:7px 10px; font-size:12px;">
              <button type="button" onclick="window.medicalQRManager.setBaseUrlOverride(document.getElementById('qrCustomBaseInput').value)" style="background:#0284c7; color:#fff; border:none; border-radius:8px; padding:7px 12px; font-size:12px; font-weight:700; cursor:pointer;">
                Aplicar
              </button>
            </div>
          </div>
          ` : ''}
        </div>

        <div class="diamon-modal-footer" style="justify-content:space-between; flex-wrap:wrap;">
          <button class="btn-custom btn-login" onclick="window.medicalQRManager.copiarEnlaceFicha()" style="font-size:12px; padding:8px 12px;">
            <i class="fas fa-copy"></i> Copiar Link
          </button>
          <div style="display:flex; gap:8px;">
            <button class="btn-custom btn-login" onclick="window.print()" style="font-size:12px; padding:8px 12px;">
              <i class="fas fa-print"></i> Imprimir
            </button>
            <a href="${localPreviewHref}" target="_blank" class="btn-custom btn-register" style="font-size:12px; padding:8px 14px; text-decoration:none;">
              <i class="fas fa-eye"></i> Ver Ficha Escaneada
            </a>
          </div>
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
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
      });
      document.body.appendChild(modal);
    }

    this.renderModalContent(modal);
    modal.classList.add('active');
    setTimeout(() => {
      this.generateQR('qrcodeModalContainer', 215);
    }, 60);
  }
}

window.medicalQRManager = new MedicalQRManager();
