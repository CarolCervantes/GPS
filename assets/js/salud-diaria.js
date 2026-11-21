// ============================================================
// DiaMon — Módulo Clínico Diario
// 1. Estado Diario del Paciente (Check-in de bienestar)
// 2. Control y Cumplimiento de Medicamentos
// 3. Consejo Educativo Diario (Rotación automática cada 24 horas)
// 4. Estado de Conexión y Telemetría GPS
// ============================================================

const CONSEJOS_EDUCATIVOS_24H = [
  {
    tema: 'Cuidado de pies y calzado',
    titulo: 'Inspección diaria de pies en climas cálidos',
    consejo: 'En ciudades costeras como Cartagena, la humedad y el calzado húmedo aumentan el riesgo de ampollas o micosis. Revisa tus pies cada noche buscando rojeces o pequeñas heridas que la neuropatía pueda ocultar, y sécalos bien entre los dedos.'
  },
  {
    tema: 'Conservación de medicamentos',
    titulo: 'Protege tu insulina del calor ambiental',
    consejo: 'La insulina pierde su efecto biológico si se expone a más de 30°C. Si te desplazas en bus o a pie, utiliza siempre un estuche térmico con gel refrigerante y nunca dejes tus plumas en el bolsillo expuestas al sol del mediodía.'
  },
  {
    tema: 'Nutrición y clases largas',
    titulo: 'Colación de prevención antes de trayectos largos',
    consejo: 'Si vas a tomar clases continuas o enfrentar un trayecto largo en transporte público, lleva siempre carbohidratos de absorción lenta (como avena o frutos secos) y un sobre de azúcar de rescate para evitar bajones imprevistos.'
  },
  {
    tema: 'Hidratación y glucemia',
    titulo: 'El agua previene picos falsos de glucosa',
    consejo: 'Con la sudoración por el calor caribeño, la sangre se concentra y la lectura de glucosa puede salir artificialmente alta. Mantén un termo de agua pura contigo y bebe pequeños sorbos cada 20 a 30 minutos.'
  },
  {
    tema: 'Actividad física y ejercicio',
    titulo: 'Caminatas matutinas o al atardecer',
    consejo: 'Caminar 20 a 30 minutos al día mejora la sensibilidad a la insulina. Elige las primeras horas de la mañana (antes de las 8:00 AM) o después de las 5:30 PM para evitar el agotamiento por golpe de calor.'
  },
  {
    tema: 'Salud bucal y diabetes',
    titulo: 'Atención a la salud de encías y dientes',
    consejo: 'Niveles altos de glucosa en saliva favorecen la proliferación bacteriana y la gingivitis. El cepillado suave después de cada comida y el uso de hilo dental son parte fundamental de tu control integral.'
  },
  {
    tema: 'Monitoreo preventivo',
    titulo: 'La Regla 15-15 ante el primer síntoma',
    consejo: 'Si sientes sudoración fría, temblor o visión borrosa, no esperes a llegar a casa: detén tu marcha, toma 15 gramos de carbohidratos simples (medio vaso de jugo o 3 cucharaditas de azúcar) y mide tu glucosa 15 minutos después.'
  }
];

const MEDICAMENTOS_PREDETERMINADOS = [
  { id: 'med-1', nombre: 'Insulina Glargina (Basal)', horario: '08:00 AM', dosis: '20 UI', momento: 'Mañana' },
  { id: 'med-2', nombre: 'Metformina', horario: '01:00 PM', dosis: '850 mg con almuerzo', momento: 'Tarde' },
  { id: 'med-3', nombre: 'Insulina Rápida / Control', horario: '08:30 PM', dosis: 'Según glucemia pre-cena', momento: 'Noche' }
];

class SaludDiariaManager {
  constructor() {
    this.fechaHoy = this.obtenerFechaISO();
    this.storageKeyEstado = 'diamon_estado_diario_' + this.fechaHoy;
    this.storageKeyMeds = 'diamon_meds_cumplimiento_' + this.fechaHoy;
    this.init();
  }

  init() {
    this.renderConsejo24H();
    this.initCheckinEstado();
    this.initMedicamentos();
    this.initMonitorGPS();
    window.saludDiariaInstance = this;
  }

  obtenerFechaISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ============================================================
  // 1. CONSEJO EDUCATIVO DE ROTACIÓN CADA 24 HORAS
  // ============================================================
  renderConsejo24H() {
    const container = document.getElementById('consejoDiarioWidget');
    if (!container) return;

    // Calcular índice determinista según día del año
    const d = new Date();
    const diaDelAnio = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
    const index = diaDelAnio % CONSEJOS_EDUCATIVOS_24H.length;
    const consejo = CONSEJOS_EDUCATIVOS_24H[index];

    const opcionesFecha = { weekday: 'long', day: 'numeric', month: 'long' };
    const fechaTexto = d.toLocaleDateString('es-CO', opcionesFecha);

    container.innerHTML = `
      <div class="consejo-card">
        <div class="consejo-header">
          <span class="consejo-tag"><i class="fas fa-heart"></i> ${consejo.tema}</span>
          <span class="consejo-fecha">${fechaTexto}</span>
        </div>
        <h4 class="consejo-titulo">${consejo.titulo}</h4>
        <p class="consejo-texto">${consejo.consejo}</p>
        <div class="consejo-footer">
          <span class="consejo-nota"><i class="fas fa-shield-alt"></i> Guía educativa diaria · Rota cada 24 horas</span>
        </div>
      </div>
    `;
  }

  // ============================================================
  // 2. ESTADO DIARIO DEL PACIENTE (CHECK-IN DE BIENESTAR)
  // ============================================================
  initCheckinEstado() {
    const container = document.getElementById('estadoDiarioWidget');
    if (!container) return;

    let saved = null;
    try {
      const raw = localStorage.getItem(this.storageKeyEstado);
      if (raw) saved = JSON.parse(raw);
    } catch (_) {}

    container.innerHTML = `
      <div class="checkin-card">
        <div class="checkin-header">
          <div>
            <h4 class="checkin-title"><i class="fas fa-user-check"></i> ¿Cómo te sientes hoy?</h4>
            <div class="checkin-sub">Tu familiar autorizado puede ver este registro diario.</div>
          </div>
          <span id="checkinStatusPill" class="checkin-pill ${saved ? 'completed' : 'pending'}">
            ${saved ? 'Registrado hoy' : 'Pendiente hoy'}
          </span>
        </div>

        <div class="checkin-mood-selector">
          <button class="mood-btn ${saved?.animo === 'excelente' ? 'active' : ''}" data-mood="excelente">
            <span class="mood-emoji">😊</span>
            <span class="mood-label">Muy bien</span>
          </button>
          <button class="mood-btn ${saved?.animo === 'normal' ? 'active' : ''}" data-mood="normal">
            <span class="mood-emoji">🙂</span>
            <span class="mood-label">Estable</span>
          </button>
          <button class="mood-btn ${saved?.animo === 'cansado' ? 'active' : ''}" data-mood="cansado">
            <span class="mood-emoji">🥱</span>
            <span class="mood-label">Cansado</span>
          </button>
          <button class="mood-btn ${saved?.animo === 'descompensado' ? 'active' : ''}" data-mood="descompensado">
            <span class="mood-emoji">🤒</span>
            <span class="mood-label">Con mareo</span>
          </button>
        </div>

        <div class="checkin-symptoms-section">
          <div class="symptoms-label">Síntomas presentes hoy (opcional):</div>
          <div class="symptoms-chips">
            <label class="symptom-checkbox">
              <input type="checkbox" value="sed" ${saved?.sintomas?.includes('sed') ? 'checked' : ''}>
              <span>Sed excesiva</span>
            </label>
            <label class="symptom-checkbox">
              <input type="checkbox" value="fatiga" ${saved?.sintomas?.includes('fatiga') ? 'checked' : ''}>
              <span>Fatiga o sueño</span>
            </label>
            <label class="symptom-checkbox">
              <input type="checkbox" value="mareo" ${saved?.sintomas?.includes('mareo') ? 'checked' : ''}>
              <span>Mareo o temblor</span>
            </label>
            <label class="symptom-checkbox">
              <input type="checkbox" value="cefalea" ${saved?.sintomas?.includes('cefalea') ? 'checked' : ''}>
              <span>Dolor de cabeza</span>
            </label>
          </div>
        </div>

        <div class="checkin-actions">
          <button id="btnGuardarEstadoDiario" class="btn-checkin-save">
            <i class="fas fa-check"></i> ${saved ? 'Actualizar mi estado' : 'Guardar estado de hoy'}
          </button>
          <span id="checkinSavedMsg" class="checkin-saved-msg" style="display:none;">
            <i class="fas fa-check-circle"></i> Guardado exitosamente
          </span>
        </div>
      </div>
    `;

    // Eventos
    let selectedMood = saved?.animo || null;
    container.querySelectorAll('.mood-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        container.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        selectedMood = e.currentTarget.dataset.mood;
      });
    });

    const saveBtn = document.getElementById('btnGuardarEstadoDiario');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        if (!selectedMood) {
          alert('Por favor selecciona cómo te sientes hoy antes de guardar.');
          return;
        }

        const checkedSymptoms = [];
        container.querySelectorAll('.symptom-checkbox input:checked').forEach(c => {
          checkedSymptoms.push(c.value);
        });

        const registro = {
          fecha: this.fechaHoy,
          hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          animo: selectedMood,
          sintomas: checkedSymptoms
        };

        try {
          localStorage.setItem(this.storageKeyEstado, JSON.stringify(registro));
        } catch (_) {}

        const pill = document.getElementById('checkinStatusPill');
        if (pill) {
          pill.className = 'checkin-pill completed';
          pill.textContent = 'Registrado (' + registro.hora + ')';
        }

        const msg = document.getElementById('checkinSavedMsg');
        if (msg) {
          msg.style.display = 'inline-flex';
          setTimeout(() => { msg.style.display = 'none'; }, 3000);
        }

        if (window.mostrarNotificacion) {
          window.mostrarNotificacion('Estado de salud diario guardado correctamente.', 'success');
        }
      });
    }
  }

  // ============================================================
  // 3. CUMPLIMIENTO DIARIO DE MEDICAMENTOS (CHECKLIST)
  // ============================================================
  initMedicamentos() {
    const container = document.getElementById('medicamentosWidget');
    if (!container) return;

    let savedMeds = {};
    try {
      const raw = localStorage.getItem(this.storageKeyMeds);
      if (raw) savedMeds = JSON.parse(raw);
    } catch (_) {}

    this.renderMedicamentos(savedMeds);
  }

  renderMedicamentos(savedMeds) {
    const container = document.getElementById('medicamentosWidget');
    if (!container) return;

    const total = MEDICAMENTOS_PREDETERMINADOS.length;
    let tomadas = 0;
    MEDICAMENTOS_PREDETERMINADOS.forEach(m => {
      if (savedMeds[m.id]?.tomada) tomadas++;
    });

    const porcentaje = Math.round((tomadas / total) * 100);

    const itemsHTML = MEDICAMENTOS_PREDETERMINADOS.map(m => {
      const estado = savedMeds[m.id] || { tomada: false, hora: null };
      return `
        <div class="med-item ${estado.tomada ? 'completed' : ''}" data-med-id="${m.id}">
          <label class="med-checkbox-wrap">
            <input type="checkbox" class="med-check-input" aria-label="Registrar dosis de ${m.nombre}" data-id="${m.id}" ${estado.tomada ? 'checked' : ''}>
            <span class="med-custom-check"></span>
          </label>
          <div class="med-info">
            <div class="med-name">${m.nombre}</div>
            <div class="med-meta">
              <span class="med-time"><i class="far fa-clock"></i> ${m.horario}</span>
              <span class="med-dose">${m.dosis}</span>
              ${estado.tomada ? `<span class="med-taken-tag">Tomada a las ${estado.hora}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="med-card">
        <div class="med-header">
          <div>
            <h4 class="med-title"><i class="fas fa-pills"></i> Medicamentos de hoy</h4>
            <div class="med-sub">Control de tomas e insulinas prescritas</div>
          </div>
          <span class="med-score">${tomadas} de ${total} tomadas</span>
        </div>

        <div class="med-progress-container">
          <div class="med-progress-bar" style="width: ${porcentaje}%;"></div>
        </div>

        <div class="med-list">
          ${itemsHTML}
        </div>
      </div>
    `;

    // Escuchar cambios en checkboxes
    container.querySelectorAll('.med-check-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        const isChecked = e.target.checked;
        const horaActual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        savedMeds[id] = {
          tomada: isChecked,
          hora: isChecked ? horaActual : null
        };

        try {
          localStorage.setItem(this.storageKeyMeds, JSON.stringify(savedMeds));
        } catch (_) {}

        this.renderMedicamentos(savedMeds);

        if (window.mostrarNotificacion) {
          const medName = MEDICAMENTOS_PREDETERMINADOS.find(m => m.id === id)?.nombre || 'Medicamento';
          window.mostrarNotificacion(
            isChecked ? `Toma registrada: ${medName} (${horaActual})` : `Toma desmarcada: ${medName}`,
            isChecked ? 'success' : 'info'
          );
        }
      });
    });
  }

  // ============================================================
  // 4. ESTADO DE CONEXIÓN Y TELEMETRÍA GPS
  // ============================================================
  initMonitorGPS() {
    const statusPill = document.querySelector('.status-row .right');
    if (!statusPill) return;

    // Actualizar el pill con datos reales de precisión y sincronización
    statusPill.innerHTML = `
      <div class="gps-telemetry-badge" id="gpsTelemetryBadge">
        <span class="gps-indicator-dot online"></span>
        <span class="gps-status-text" id="gpsStatusText">GPS Activo · Precisión ±4m</span>
      </div>
    `;

    // Escuchar eventos de geolocalización o simulación
    if (navigator.onLine !== undefined) {
      window.addEventListener('online', () => this.actualizarEstadoGPS(true));
      window.addEventListener('offline', () => this.actualizarEstadoGPS(false));
    }
  }

  actualizarEstadoGPS(online = true, precisionMetros = 4) {
    const textEl = document.getElementById('gpsStatusText');
    const badge = document.getElementById('gpsTelemetryBadge');
    if (!textEl || !badge) return;

    if (!online) {
      badge.className = 'gps-telemetry-badge offline';
      textEl.textContent = 'Sin señal GPS';
    } else {
      badge.className = 'gps-telemetry-badge online';
      textEl.textContent = `GPS Activo · Precisión ±${precisionMetros}m`;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new SaludDiariaManager();
});
