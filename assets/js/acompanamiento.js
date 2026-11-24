// ============================================================
// DiaMon — Sistema de Acompañamiento Inteligente GPS ("Safe Walk")
// Con cálculo de tráfico en Cartagena, notificación familiar y diario de síntomas
// ============================================================

const DESTINOS_PREDETERMINADOS_CTG = [
  { id: 'udc-zarzagocilla', nombre: 'Universidad de Cartagena — Zarzagocilla', baseMinutos: 20, coords: [10.3951, -75.4952] },
  { id: 'udc-san-agustin', nombre: 'Universidad de Cartagena — San Agustín (Centro)', baseMinutos: 35, coords: [10.4235, -75.5502] },
  { id: 'casa', nombre: 'Casa / Hogar (San Fernando)', baseMinutos: 15, coords: [10.3887, -75.4789] },
  { id: 'mall-plaza', nombre: 'Mall Plaza El Castillo (Chambacú)', baseMinutos: 30, coords: [10.4245, -75.5390] },
  { id: 'bocagrande', nombre: 'Plaza Bocagrande', baseMinutos: 40, coords: [10.4080, -75.5510] }
];

class SafeWalkCompanion {
  constructor() {
    this.isActive = false;
    this.totalSeconds = 0;
    this.remainingSeconds = 0;
    this.timerInterval = null;
    this.graceInterval = null;
    this.graceRemaining = 45;
    this.destination = null;
    this.modoTransporte = 'transcaribe';
    this.retrasoTrafico = 0;
    this.routeLine = null;
    this.destMarker = null;
    this.audioContext = null;
    this.alarmOscillator = null;
    this.init();
  }

  init() {
    this.bindEvents();
    this.actualizarSugerenciaTrafico();
    window.safeWalkInstance = this;
  }

  bindEvents() {
    const startBtn = document.getElementById('btnStartSafeWalk');
    const arriveBtn = document.getElementById('btnSafeWalkArrived');
    const extendBtn = document.getElementById('btnSafeWalkExtend');
    const cancelBtn = document.getElementById('btnSafeWalkCancel');
    const destSelect = document.getElementById('safeWalkDestSelect');
    const transportSelect = document.getElementById('safeWalkTransportSelect');

    if (destSelect) {
      destSelect.addEventListener('change', () => this.actualizarSugerenciaTrafico());
    }

    if (transportSelect) {
      transportSelect.addEventListener('change', (e) => {
        this.modoTransporte = e.target.value;
        this.actualizarSugerenciaTrafico();
      });
    }

    if (startBtn) {
      startBtn.addEventListener('click', () => {
        const destId = destSelect ? destSelect.value : 'udc-zarzagocilla';
        const minsInput = document.getElementById('safeWalkMinutes');
        const minutes = minsInput ? parseInt(minsInput.value, 10) : 25;
        this.startWalk(destId, minutes);
      });
    }

    if (arriveBtn) arriveBtn.addEventListener('click', () => this.confirmArrival());
    if (extendBtn) extendBtn.addEventListener('click', () => this.extendTime(5));
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.cancelWalk());

    // Botones de síntomas en ruta
    document.querySelectorAll('.btn-symptom-quick').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sintoma = e.currentTarget.dataset.symptom;
        this.registrarSintomaEnRuta(sintoma);
      });
    });
  }

  actualizarSugerenciaTrafico() {
    const destSelect = document.getElementById('safeWalkDestSelect');
    const destId = destSelect ? destSelect.value : 'udc-zarzagocilla';
    const foundDest = DESTINOS_PREDETERMINADOS_CTG.find(d => d.id === destId) || DESTINOS_PREDETERMINADOS_CTG[0];

    let extra = 0;
    let motivo = '';

    if (window.traficoCartagenaInstance) {
      const calc = window.traficoCartagenaInstance.calcularRetrasoRuta([10.3910, -75.4794], foundDest, this.modoTransporte);
      extra = calc.minutosExtra;
      motivo = calc.motivo;
    } else {
      extra = (foundDest.id === 'udc-san-agustin' || foundDest.id === 'bocagrande') ? 15 : 8;
      motivo = 'Trancón habitual en Pedro de Heredia / Bazurto';
    }

    this.retrasoTrafico = extra;
    const totalSugerido = foundDest.baseMinutos + extra;

    // Actualizar select de minutos
    const minsSelect = document.getElementById('safeWalkMinutes');
    if (minsSelect) {
      minsSelect.value = String(totalSugerido);
      if (!minsSelect.value) {
        // Si no existe opción exacta, seleccionar la más cercana
        minsSelect.value = totalSugerido > 40 ? '60' : (totalSugerido > 25 ? '40' : '25');
      }
    }

    // Actualizar badge de aviso de tráfico
    const trafficNotice = document.getElementById('safeWalkTrafficNotice');
    if (trafficNotice) {
      if (extra > 0 && this.modoTransporte !== 'pie') {
        trafficNotice.style.display = 'block';
        trafficNotice.innerHTML = `
          <i class="fas fa-traffic-light" style="color:#ef4444;"></i>
          <span><strong>Trancón Cartagena (+${extra} min):</strong> ${motivo}. Tiempo ajustado a <strong>${totalSugerido} min</strong>.</span>
        `;
      } else {
        trafficNotice.style.display = 'none';
      }
    }
  }

  startWalk(destId, minutes) {
    const foundDest = DESTINOS_PREDETERMINADOS_CTG.find(d => d.id === destId) || DESTINOS_PREDETERMINADOS_CTG[0];
    this.destination = foundDest;
    this.totalSeconds = minutes * 60;
    this.remainingSeconds = this.totalSeconds;
    this.isActive = true;

    // Actualizar UI
    const setupCard = document.getElementById('safeWalkSetup');
    const activeCard = document.getElementById('safeWalkActive');
    const destNameEl = document.getElementById('safeWalkActiveDest');
    const badgeTrans = document.getElementById('safeWalkActiveTransport');

    if (setupCard) setupCard.style.display = 'none';
    if (activeCard) activeCard.style.display = 'block';
    if (destNameEl) destNameEl.textContent = this.destination.nombre;
    if (badgeTrans) {
      badgeTrans.textContent = this.modoTransporte === 'pie'
        ? 'A pie'
        : (this.modoTransporte === 'transcaribe' ? 'Transcaribe / Bus' : 'Vehículo / Moto');
    }

    this.trazarRutaEnMapa();
    this.updateTimerDisplay();

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.tick();
    }, 1000);

    if (window.mostrarNotificacion) {
      window.mostrarNotificacion(`Acompañamiento iniciado hacia ${this.destination.nombre} (${minutes} min con ajuste de tráfico)`, 'success');
    }
  }

  tick() {
    if (!this.isActive) return;

    this.remainingSeconds--;
    this.updateTimerDisplay();

    if (this.remainingSeconds <= 0) {
      clearInterval(this.timerInterval);
      this.triggerExpirationProtocol();
    }
  }

  updateTimerDisplay() {
    const timerText = document.getElementById('safeWalkTimerText');
    const progressBar = document.getElementById('safeWalkProgressBar');

    if (timerText) {
      const mins = Math.floor(Math.max(0, this.remainingSeconds) / 60);
      const secs = Math.max(0, this.remainingSeconds) % 60;
      timerText.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    if (progressBar && this.totalSeconds > 0) {
      const pct = Math.min(100, Math.max(0, ((this.totalSeconds - this.remainingSeconds) / this.totalSeconds) * 100));
      progressBar.style.width = `${pct}%`;
    }
  }

  aplicarRetrasoAutomatico(minutos, motivo) {
    if (!this.isActive) return;
    this.totalSeconds += minutos * 60;
    this.remainingSeconds += minutos * 60;
    this.updateTimerDisplay();

    if (window.mostrarNotificacion) {
      window.mostrarNotificacion('🚦 Trancón detectado en tiempo real en ' + motivo + '. +' + minutos + ' min añadidos.', 'warn');
    }
  }

  extendTime(minutes = 5) {
    this.totalSeconds += minutes * 60;
    this.remainingSeconds += minutes * 60;
    this.updateTimerDisplay();
    if (window.mostrarNotificacion) {
      window.mostrarNotificacion(`Tiempo extendido +${minutes} min (por congestión en Cartagena)`, 'info');
    }
  }

  confirmArrival() {
    this.stopAlarm();
    this.isActive = false;
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.graceInterval) clearInterval(this.graceInterval);

    this.limpiarMapa();

    const setupCard = document.getElementById('safeWalkSetup');
    const activeCard = document.getElementById('safeWalkActive');
    const alertModal = document.getElementById('safeWalkAlarmModal');

    if (setupCard) setupCard.style.display = 'block';
    if (activeCard) activeCard.style.display = 'none';
    if (alertModal) alertModal.classList.remove('active');

    this.playSuccessChime();

    // Modal de confirmación de llegada con opción de WhatsApp al familiar
    this.mostrarModalLlegadaExitosa();
  }

  mostrarModalLlegadaExitosa() {
    const profile = window.medicalQRManager ? window.medicalQRManager.profile : null;
    const phone = profile?.contactoTelefono || '+573001234567';
    const cleanPhone = phone.replace(/\D/g, '');
    const destName = this.destination ? this.destination.nombre : 'mi destino en Cartagena';

    const msg = encodeURIComponent(`¡Hola! Ya llegué a salvo a ${destName}. Mi monitoreo DiaMon reporta que me encuentro bien y estable.`);
    const waLink = `https://wa.me/${cleanPhone}?text=${msg}`;

    let modal = document.getElementById('arrivalSuccessModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'arrivalSuccessModal';
      modal.className = 'diamon-modal-overlay active';
      modal.innerHTML = `
        <div class="diamon-modal-card" style="border: 2px solid #10b981; max-width:400px;">
          <div class="diamon-modal-header" style="background:#064e3b;">
            <div class="modal-title">
              <i class="fas fa-check-circle" style="color:#34d399; font-size:20px;"></i>
              <h3 style="color:#d1fae5;">¡Llegada Confirmada!</h3>
            </div>
            <button class="modal-close-btn" onclick="document.getElementById('arrivalSuccessModal').classList.remove('active')">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="diamon-modal-body text-center">
            <p style="font-size:13px; color:#f8fafc; margin-bottom:14px;">
              Has completado tu recorrido con éxito y a tiempo. El temporizador ha finalizado de forma segura.
            </p>
            <a id="btnSendArrivalWA" href="${waLink}" target="_blank" class="btn-custom" style="background:#25D366; color:#0b1220; font-weight:700; width:100%; display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:10px 14px; text-decoration:none;">
              <i class="fab fa-whatsapp" style="font-size:18px;"></i> Avisar a mi acudiente por WhatsApp
            </a>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    } else {
      const waBtn = document.getElementById('btnSendArrivalWA');
      if (waBtn) waBtn.href = waLink;
      modal.classList.add('active');
    }
  }

  registrarSintomaEnRuta(sintoma) {
    const coords = (window.centrosMedicosInstance && window.centrosMedicosInstance.patientCoords)
      ? window.centrosMedicosInstance.patientCoords
      : [10.3910, -75.4794];

    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (window.mostrarNotificacion) {
      window.mostrarNotificacion(`Síntoma registrado en ruta (${sintoma}) a las ${hora}.`, 'warn');
    }

    if (sintoma === 'mareo' || sintoma === 'sudoracion') {
      alert(`⚠️ Advertencia DiaMon: Has registrado ${sintoma.toUpperCase()}. Si estás en un bus o caminando por Cartagena, busca sombra de inmediato, toma 15g de azúcar rápida y comunícate con tu acudiente.`);
    }
  }

  cancelWalk() {
    this.stopAlarm();
    this.isActive = false;
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.graceInterval) clearInterval(this.graceInterval);

    this.limpiarMapa();

    const setupCard = document.getElementById('safeWalkSetup');
    const activeCard = document.getElementById('safeWalkActive');
    const alertModal = document.getElementById('safeWalkAlarmModal');

    if (setupCard) setupCard.style.display = 'block';
    if (activeCard) activeCard.style.display = 'none';
    if (alertModal) alertModal.classList.remove('active');
  }

  trazarRutaEnMapa() {
    const map = window.liveMapInstance;
    if (!map || !this.destination) return;

    this.limpiarMapa();

    const origen = (window.centrosMedicosInstance && window.centrosMedicosInstance.patientCoords)
      ? window.centrosMedicosInstance.patientCoords
      : [10.3910, -75.4794];

    const destCoords = this.destination.coords;

    const destIcon = L.divIcon({
      className: 'dest-pin',
      html: `
        <div style="background:#10b981; border:2px solid white; color:white; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:16px; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
          🏁
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    this.destMarker = L.marker(destCoords, { icon: destIcon })
      .bindPopup(`<strong>Destino:</strong> ${this.destination.nombre}`)
      .addTo(map);

    this.routeLine = L.polyline([origen, destCoords], {
      color: '#10b981',
      weight: 5,
      opacity: 0.85,
      dashArray: '10, 8'
    }).addTo(map);

    map.fitBounds(this.routeLine.getBounds(), { padding: [60, 60] });
  }

  limpiarMapa() {
    const map = window.liveMapInstance;
    if (!map) return;
    if (this.routeLine) {
      map.removeLayer(this.routeLine);
      this.routeLine = null;
    }
    if (this.destMarker) {
      map.removeLayer(this.destMarker);
      this.destMarker = null;
    }
  }

  triggerExpirationProtocol() {
    this.startAudioAlarm();

    let modal = document.getElementById('safeWalkAlarmModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'safeWalkAlarmModal';
      modal.className = 'diamon-modal-overlay active';
      modal.innerHTML = `
        <div class="diamon-modal-card" style="border: 2px solid #ef4444; box-shadow: 0 0 30px rgba(239,68,68,0.5);">
          <div class="diamon-modal-header" style="background:#450a0a;">
            <div class="modal-title">
              <i class="fas fa-exclamation-triangle" style="color:#ef4444; font-size:22px;"></i>
              <h3 style="color:#fecaca;">¡Tiempo de Llegada Cumplido!</h3>
            </div>
          </div>
          <div class="diamon-modal-body text-center">
            <p style="font-size:14px; color:#f8fafc; margin-bottom:12px;">
              Tu tiempo estimado de llegada ha vencido. Confirma si estás atrapado en un trancón o si llegaste bien.
            </p>
            <div style="font-size:32px; font-weight:800; color:#ef4444; font-family:var(--font-mono); margin-bottom:16px;" id="graceCountdown">
              00:45
            </div>
            <div style="display:flex; flex-direction:column; gap:10px;">
              <button class="btn-custom" style="background:#10b981; color:#064e3b; font-weight:700; padding:12px; font-size:14px;" onclick="window.safeWalkInstance.confirmArrival()">
                <i class="fas fa-check-circle"></i> Ya llegué a salvo
              </button>
              <button class="btn-custom" style="background:#f59e0b; color:#0b1220; font-weight:700; padding:10px; font-size:13px;" onclick="window.safeWalkInstance.extendTime(10); document.getElementById('safeWalkAlarmModal').classList.remove('active'); window.safeWalkInstance.stopAlarm();">
                <i class="fas fa-traffic-light"></i> Estoy en un trancón (+10 min)
              </button>
              <button class="btn-custom" style="background:#dc2626; color:white; padding:10px; font-size:13px;" onclick="window.safeWalkInstance.dispararSOS()">
                <i class="fas fa-ambulance"></i> Necesito ayuda médica (SOS)
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    } else {
      modal.classList.add('active');
    }

    this.graceRemaining = 45;
    const graceEl = document.getElementById('graceCountdown');
    if (this.graceInterval) clearInterval(this.graceInterval);

    this.graceInterval = setInterval(() => {
      this.graceRemaining--;
      if (graceEl) {
        graceEl.textContent = `00:${String(Math.max(0, this.graceRemaining)).padStart(2, '0')}`;
      }
      if (this.graceRemaining <= 0) {
        clearInterval(this.graceInterval);
        this.dispararSOS();
      }
    }, 1000);
  }

  dispararSOS() {
    this.stopAlarm();
    const modal = document.getElementById('safeWalkAlarmModal');
    if (modal) modal.classList.remove('active');

    const profile = window.medicalQRManager ? window.medicalQRManager.profile : null;
    const phone = profile?.contactoTelefono || '+573001234567';
    const cleanPhone = phone.replace(/\D/g, '');

    const coords = (window.centrosMedicosInstance && window.centrosMedicosInstance.patientCoords)
      ? window.centrosMedicosInstance.patientCoords
      : [10.3910, -75.4794];

    const mapsLink = `https://www.google.com/maps?q=${coords[0]},${coords[1]}`;
    const smsMsg = encodeURIComponent(`ALERTA DiaMon: No he confirmado mi llegada a mi destino. Mi última ubicación GPS en Cartagena es: ${mapsLink}`);

    alert(`⚠️ ALERTA SOS ACTIVADA: Notificando a tu acudiente (${phone}).`);
    window.open(`https://wa.me/${cleanPhone}?text=${smsMsg}`, '_blank');
  }

  startAudioAlarm() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.audioContext = new AudioCtx();
      
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, this.audioContext.currentTime);
      gain.gain.setValueAtTime(0.15, this.audioContext.currentTime);

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start();
      this.alarmOscillator = osc;
    } catch (e) {
      console.warn('Audio contextual bloqueado:', e);
    }
  }

  stopAlarm() {
    try {
      if (this.alarmOscillator) {
        this.alarmOscillator.stop();
        this.alarmOscillator.disconnect();
        this.alarmOscillator = null;
      }
      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }
    } catch (_) {}
  }

  playSuccessChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15);
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.30);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (_) {}
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new SafeWalkCompanion();
});
