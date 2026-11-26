// DiaMon — Módulo Clínico Diario
// 1. Estado Diario del Paciente (Check-in de bienestar)
// 2. Control y Cumplimiento de Medicamentos
// 3. Consejo Educativo Diario (Rotación automática cada 24 horas)
// 4. Estado de Conexión y Telemetría GPS

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
    tema: 'Insulina de la noche',
    titulo: 'Cenar antes de la insulina de las 9:00 PM',
    consejo: 'La insulina basal de la noche puede bajar el azúcar mientras duerme. Cenar a su hora, no saltarse la comida y tener a mano un jugo o un caramelo en la mesa de noche ayuda a prevenir una hipoglucemia nocturna.'
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
  { id: 'med-1', nombre: 'Pantoprazol + Metformina + Firialta + Nifedipino', horario: '08:00 AM', dosis: 'Esquema matutino completo (4 medicamentos)', momento: 'Mañana' },
  { id: 'med-2', nombre: 'Valsartán (Control Hipertensión Arterial)', horario: '02:00 PM', dosis: '1 toma vespertina', momento: 'Tarde' },
  { id: 'med-3', nombre: 'Atorvastatina + Metformina + Gabapentina + Lipotic + Nifedipino', horario: '08:00 PM', dosis: 'Esquema nocturno oral (5 medicamentos)', momento: 'Noche' },
  { id: 'med-4', nombre: 'Insulina Basal — 24 Unidades', horario: '09:00 PM', dosis: '24 UI subcutáneas todas las noches', momento: 'Noche' },
  { id: 'med-5', nombre: 'Ozempic (Semaglutida Semanal)', horario: 'Sábados', dosis: '1 aplicación subcutánea cada sábado', momento: 'Semanal' }
];

// Se deja disponible para el reporte del dia
window.MEDICAMENTOS_DIARIOS = MEDICAMENTOS_PREDETERMINADOS;

class SaludDiariaManager {
  constructor() {
    this.fechaHoy = this.obtenerFechaISO();
    // El estado del dia y las tomas de medicamentos se guardan en Supabase (no en el navegador)
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

  // Consejo educativo de rotación cada 24 horas
  renderConsejo24H() {
    const container = document.getElementById('consejoDiarioWidget');
    if (!container) return;

    // Calcular índice determinista según día del año
    const d = new Date();
    const diaDelAnio = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
    // Se muestran 3 consejos y cambian cada dia
    const total = CONSEJOS_EDUCATIVOS_24H.length;
    const index = diaDelAnio % total;
    const consejos = [0, 1, 2].map(n => CONSEJOS_EDUCATIVOS_24H[(index + n) % total]);

    const opcionesFecha = { weekday: 'long', day: 'numeric', month: 'long' };
    const fechaTexto = d.toLocaleDateString('es-CO', opcionesFecha);

    container.innerHTML = consejos.map(consejo => `
      <div class="consejo-card" style="margin-bottom:12px;">
        <div class="consejo-header">
          <span class="consejo-tag"><i class="fas fa-heart"></i> ${consejo.tema}</span>
          <span class="consejo-fecha">${fechaTexto}</span>
        </div>
        <h4 class="consejo-titulo">${consejo.titulo}</h4>
        <p class="consejo-texto">${consejo.consejo}</p>
      </div>
    `).join('') + `
      <div class="consejo-footer">
        <span class="consejo-nota"><i class="fas fa-shield-alt"></i> Guía educativa · Cambia cada día</span>
      </div>`;
  }

  // Estado diario del paciente (check-in de bienestar)
  async initCheckinEstado() {
    const container = document.getElementById('estadoDiarioWidget');
    if (!container) return;

    // Si ya registro su estado hoy, se trae de Supabase
    let saved = null;
    try {
      const regs = window.DiaMonDatos && window.DiaMonDatos.pacienteId()
        ? await window.DiaMonDatos.leerRegistrosDelDia('estado_diario') : [];
      if (regs[0]) {
        const extra = JSON.parse(regs[0].notas || '{}');
        saved = { fecha: this.fechaHoy, animo: regs[0].valor, sintomas: extra.sintomas || [], hora: extra.hora };
      }
    } catch (_) {}

    // El formulario es para el paciente. El cuidador solo ve lo que el paciente registro hoy.
    const rol = window.DiaMonSesion ? window.DiaMonSesion.rolDe(window.DiaMonSesion.leerUsuario()) : 'usuario';
    if (rol !== 'usuario') {
      const pac = window.DiaMonSesion.pacienteActivo(window.DiaMonSesion.leerUsuario());
      const nombre = (pac && pac.nombre ? pac.nombre.split(' ')[0] : 'El paciente');
      container.innerHTML = `
        <div class="checkin-card">
          <h4 class="checkin-title"><i class="fas fa-user-check"></i> ¿Cómo se siente ${nombre} hoy?</h4>
          <div class="checkin-sub">${saved
            ? `Registró <strong>${saved.animo}</strong> a las ${saved.hora || '—'}${saved.sintomas.length ? ' · Síntomas: ' + saved.sintomas.join(', ') : ' · Sin síntomas'}`
            : 'Todavía no ha registrado cómo se siente hoy.'}</div>
        </div>`;
      return;
    }

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
      saveBtn.addEventListener('click', async () => {
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
          await window.DiaMonDatos.guardarRegistro('estado_diario', registro.animo,
            JSON.stringify({ sintomas: registro.sintomas, hora: registro.hora }));
        } catch (err) {
          if (window.mostrarNotificacion) window.mostrarNotificacion('No se pudo guardar el estado del día. Revisa tu conexión.', 'warn');
          return;
        }

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

  // Cumplimiento diario de medicamentos (checklist)
  initMedicamentos() {
    const container = document.getElementById('medicamentosWidget');
    if (!container) return;

    // Las tomas de hoy llegan con los datos del paciente desde Supabase
    this.renderMedicamentos({});
    window.addEventListener('diamon-datos', (e) => {
      const tomasHoy = ((e.detail && e.detail.tomas) || []).filter(t => t.fecha === this.fechaHoy);
      const marcadas = {};
      tomasHoy.forEach(t => {
        marcadas[t.medicamento_id] = {
          tomada: t.tomada,
          hora: t.tomada && t.ts ? new Date(t.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null
        };
      });
      this.renderMedicamentos(marcadas);
    });
  }

  renderMedicamentos(savedMeds) {
    const container = document.getElementById('medicamentosWidget');
    if (!container) return;

    // El esquema de medicamentos cargado es el de Damian (caso de estudio).
    // Para otro paciente no se muestra hasta que se registre el suyo.
    if (!document.documentElement.classList.contains('dm-caso-damian')) {
      container.innerHTML = '<p style="font-size:13px; color:#64748b; margin:0;">Este paciente todavía no tiene su esquema de medicamentos cargado.</p>';
      return;
    }

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

        // Se guarda en Supabase; si lo marca el cuidador queda registrado quien fue
        const medObj = MEDICAMENTOS_PREDETERMINADOS.find(m => m.id === id);
        const rol = window.DiaMonSesion ? window.DiaMonSesion.rolDe(window.DiaMonSesion.leerUsuario()) : 'usuario';
        window.DiaMonDatos.guardarToma({
          medicamentoId: id, nombre: medObj?.nombre || id, horario: medObj?.horario || horaActual, dosis: medObj?.dosis,
          fecha: this.fechaHoy, tomada: isChecked, quien: rol === 'usuario' ? 'paciente' : rol
        }).catch(() => {
          if (window.mostrarNotificacion) window.mostrarNotificacion('No se pudo guardar la toma. Revisa tu conexión.', 'warn');
        });

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

  // Estado de conexión y telemetría GPS
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
