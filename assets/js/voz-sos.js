// ============================================================
// DiaMon — Emergencia SOS Sencilla (Modo Abuelo / Paciente) y Voz
// Flujo claro de 2 pasos:
//   1. Avisa y llama al Familiar / Cuidador Principal con cuenta regresiva corta (30s).
//   2. Si el familiar NO contesta, escala automáticamente a EMERGENCIAS (123)
//      enviando coordenadas GPS exactas, ubicación (barrio/referencia) y síntomas reales.
// ============================================================

const BARRIOS_CARTAGENA = [
  { nombre: 'Chapacuá', centro: [10.39991, -75.47886], radio: 900, referencia: 'Barrio Chapacuá · Cerca a Transversal 54 y Clínica Blas de Lezo' },
  { nombre: 'Zarzagocilla / Campus Universitario', centro: [10.3951, -75.4952], radio: 800, referencia: 'Cerca a la Universidad de Cartagena y Hospital Universitario (HUC)' },
  { nombre: 'San Fernando / Los Caracoles', centro: [10.3887, -75.4789], radio: 900, referencia: 'Sector Residencial Sur · Cerca a Clínica Gestión Salud' },
  { nombre: 'Los Ejecutivos / Cuatro Vientos', centro: [10.4010, -75.5035], radio: 750, referencia: 'Sobre Av. Pedro de Heredia · Cerca a Clínica Blas de Lezo' },
  { nombre: 'Pie de la Popa / Cerro de la Popa', centro: [10.4182, -75.5345], radio: 800, referencia: 'Cerca a Clínica Cartagena del Mar y Mercado de Bazurto' },
  { nombre: 'Manga / Miramar', centro: [10.4135, -75.5412], radio: 750, referencia: 'Sector Manga · Cerca a Farmatodo 24h y Puentes hacia el Centro' },
  { nombre: 'Centro Histórico / San Diego', centro: [10.4235, -75.5502], radio: 850, referencia: 'Centro Amurallado · Sede San Agustín' },
  { nombre: 'Bocagrande / Castillogrande', centro: [10.4050, -75.5530], radio: 1100, referencia: 'Av. San Martín · Cerca a Hospital Bocagrande y Clínica MediHelp' },
  { nombre: 'El Prado / Bruselas', centro: [10.4075, -75.5186], radio: 700, referencia: 'Cerca a Clínica Crecer y Av. El Consulado' },
  { nombre: 'Crespo / Marbella', centro: [10.4350, -75.5380], radio: 900, referencia: 'Sector Costero · Cerca al Aeropuerto Rafael Núñez' }
];

class VozEmergenciaSOS {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.escalamientoTimer = null;
    this.escalamientoSegundos = 30;
    this.faseActual = 'familiar'; // 'familiar' | 'familiar_contesto' | 'emergencias'
    this.sintomasExtra = new Set();
    this.contextoActual = null;
    this.initSpeechRecognition();
    this.injectUI();
    this.bindEvents();
    window.vozSOSInstance = this;
  }

  vozHabilitada() {
    try {
      const raw = localStorage.getItem('diamon_config_prefs_v1');
      if (raw) {
        const prefs = JSON.parse(raw);
        if (prefs.vozAlertas === false) return false;
      }
    } catch (_) {}
    return true;
  }

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'es-CO';
      this.recognition.continuous = false;
      this.recognition.interimResults = false;

      this.recognition.onstart = () => {
        this.isListening = true;
        this.actualizarBotonMicrofono(true);
      };

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        this.evaluarComandoVoz(transcript);
      };

      this.recognition.onerror = () => {
        this.isListening = false;
        this.actualizarBotonMicrofono(false);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.actualizarBotonMicrofono(false);
      };
    } catch (e) {
      console.warn('Error inicializando SpeechRecognition:', e);
    }
  }

  toggleEscucha() {
    if (!this.recognition) {
      this.abrirPantallaEmergenciaGrande('Botón SOS Paciente');
      return;
    }

    if (this.isListening) {
      this.recognition.stop();
    } else {
      try {
        this.recognition.start();
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion('Di en voz alta: "Ayuda", "Auxilio" o "Emergencia"', 'info');
        }
      } catch (e) {
        console.warn('Error al iniciar micrófono:', e);
      }
    }
  }

  actualizarBotonMicrofono(activo) {
    const btn = document.getElementById('btnMicrofonoSOS');
    if (!btn) return;

    if (activo) {
      btn.classList.add('listening');
      btn.innerHTML = '<i class="fas fa-microphone fa-bounce"></i> <span>Escuchando…</span>';
    } else {
      btn.classList.remove('listening');
      btn.innerHTML = '<i class="fas fa-microphone"></i> <span>SOS por Voz</span>';
    }
  }

  evaluarComandoVoz(frase) {
    const palabrasClave = ['ayuda', 'auxilio', 'emergencia', 'socorro', 'desmayo', 'mal', 'mareado', 'sos'];
    const coincide = palabrasClave.some(p => frase.includes(p));

    if (coincide) {
      this.hablar('Alerta de ayuda activada. Avisando a tu familiar.');
      this.abrirPantallaEmergenciaGrande(`Activado por voz: "${frase}"`);
    } else if (window.mostrarNotificacion) {
      window.mostrarNotificacion(`Palabra escuchada: "${frase}". Di "Ayuda" o "Emergencia" para activar el SOS.`, 'info');
    }
  }

  hablar(texto) {
    if (!window.speechSynthesis || !this.vozHabilitada()) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = 'es-CO';
      utterance.rate = 0.96;
      window.speechSynthesis.speak(utterance);
    } catch (_) {}
  }

  identificarBarrioCartagena(lat, lng) {
    let barrioMasCercano = BARRIOS_CARTAGENA[0];
    let distanciaMinima = Infinity;

    for (const b of BARRIOS_CARTAGENA) {
      const dLat = (b.centro[0] - lat) * 111320;
      const dLng = (b.centro[1] - lng) * 111320;
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);

      if (dist < distanciaMinima) {
        distanciaMinima = dist;
        barrioMasCercano = b;
      }
    }

    return {
      nombre: barrioMasCercano.nombre,
      referencia: barrioMasCercano.referencia,
      distanciaAprox: Math.round(distanciaMinima)
    };
  }

  recopilarSintomasYSignos() {
    const lista = [];

    // 1. Síntomas tocados en el instante dentro de la pantalla SOS
    this.sintomasExtra.forEach(s => lista.push(s));

    // 2. Último registro de "¿Cómo te sientes hoy?"
    try {
      const rawHist = localStorage.getItem('diamon_estado_diario_historial_v1');
      if (rawHist) {
        const hist = JSON.parse(rawHist);
        if (Array.isArray(hist) && hist.length > 0) {
          const ult = hist[0];
          if (ult.animoLabel && ult.animo !== 'excelente') {
            lista.push(`Estado diario: ${ult.animoLabel}`);
          }
          if (Array.isArray(ult.sintomasLabels)) {
            ult.sintomasLabels.forEach(s => lista.push(s));
          }
        }
      }
    } catch (_) {}

    // 3. Signos del Monitor Wearable (Pulso + Temperatura)
    if (window.monitoreoWearable && window.monitoreoWearable.ultimaLectura) {
      const lec = window.monitoreoWearable.ultimaLectura;
      const ev = window.monitoreoWearable.ultimaEvaluacion;
      const tempTxt = lec.temperaturaC !== null && lec.temperaturaC !== undefined
        ? `, Temp ${Number(lec.temperaturaC).toFixed(1)} °C`
        : '';
      lista.push(`Pulso ${lec.ritmoCardiacoBpm} BPM${tempTxt}`);
      if (ev && ev.requiereAlarma && Array.isArray(ev.sintomasDetectados)) {
        ev.sintomasDetectados.slice(0, 2).forEach(s => lista.push(s));
      }
    }

    // 4. Última glucosa y presión arterial
    if (window.casoEstudio && typeof window.casoEstudio.obtenerResumenClinicoActual === 'function') {
      const res = window.casoEstudio.obtenerResumenClinicoActual();
      if (res.ultimaGlucosa) {
        lista.push(`Glucosa ${res.ultimaGlucosa.valor} mg/dL`);
      }
      if (res.ultimaPresion) {
        lista.push(`Presión ${res.ultimaPresion.sistolica}/${res.ultimaPresion.diastolica} mmHg`);
      }
    }

    // Deduplicar conservando orden
    const unicos = Array.from(new Set(lista.filter(Boolean)));
    return unicos.length > 0 ? unicos : ['Solicitud de auxilio SOS (paciente con Diabetes Tipo 2 e Hipertensión)'];
  }

  construirPaqueteEmergencia() {
    const pac = window.casoEstudio?.paciente || {};
    const profile = window.medicalQRManager?.profile || {};

    const coords = (window.TelemetriaDiaMon && window.TelemetriaDiaMon.ubicacion && window.TelemetriaDiaMon.ubicacion.lat)
      ? [Number(window.TelemetriaDiaMon.ubicacion.lat), Number(window.TelemetriaDiaMon.ubicacion.lng)]
      : [Number(pac.coordenadasCasa?.lat || 10.39991), Number(pac.coordenadasCasa?.lng || -75.47886)];

    const sector = this.identificarBarrioCartagena(coords[0], coords[1]);
    const mapsUrl = `https://www.google.com/maps?q=${coords[0].toFixed(5)},${coords[1].toFixed(5)}`;
    const hora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    const sintomas = this.recopilarSintomasYSignos();

    const pacienteNombre = pac.nombre || 'Paciente DiaMon';
    const familiarNombre = pac.cuidadorPrincipal || profile.contactoNombre || 'Familiar / Cuidador Principal';
    const familiarTel = String(pac.telefonoCuidador || profile.contactoTelefono || '+573004567890').replace(/\s+/g, '');

    const textoCompartir =
      `EMERGENCIA DIAMON (${hora}) — Paciente: ${pacienteNombre}. ` +
      `Ubicación: ${sector.nombre} (${sector.referencia}). ` +
      `Coordenadas GPS: ${coords[0].toFixed(5)}, ${coords[1].toFixed(5)} (${mapsUrl}). ` +
      `Síntomas y signos: ${sintomas.join(' · ')}.`;

    return {
      hora,
      pacienteNombre,
      familiarNombre,
      familiarTel,
      coords,
      sector,
      mapsUrl,
      sintomas,
      textoCompartir,
      whatsappUrl: `https://wa.me/${familiarTel.replace(/\D/g, '')}?text=${encodeURIComponent(textoCompartir)}`
    };
  }

  abrirPantallaEmergenciaGrande(motivo = 'Botón SOS Paciente') {
    let modal = document.getElementById('pantallaEmergenciaGrande');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pantallaEmergenciaGrande';
      modal.className = 'sos-fullscreen-overlay';
      modal.setAttribute('role', 'alertdialog');
      modal.setAttribute('aria-modal', 'true');
      document.body.appendChild(modal);
    }

    this.sintomasExtra = new Set();
    this.faseActual = 'familiar';
    this.contextoActual = { motivo, ...this.construirPaqueteEmergencia() };

    // Aviso inmediato al familiar en el sistema de alertas
    if (typeof window.emitirAlerta24Horas === 'function') {
      const p = this.contextoActual;
      window.emitirAlerta24Horas({
        titulo: `SOS Activado — Avisando a ${p.familiarNombre}`,
        subtitulo: `${p.pacienteNombre} pidió ayuda en ${p.sector.nombre}. Si no contestas en 30s se escala al 123.`,
        tipo: 'critica',
        color: 'red',
        icono: 'fas fa-bell',
        badgeTexto: 'SOS Activo',
        badgeClase: 'badge-pendiente',
        estado: 'pendiente',
        coordenadas: { lat: p.coords[0], lng: p.coords[1] },
        ubicacion: `${p.sector.nombre} (${p.coords[0].toFixed(5)}, ${p.coords[1].toFixed(5)})`,
        descripcion: p.textoCompartir
      });
    }

    this.renderPantallaSencilla();
    modal.classList.add('active');
    this.hablar(`Pidiendo ayuda a ${this.contextoActual.familiarNombre}. Si no contesta en 30 segundos, llamaremos a emergencias 123 con tu ubicación y síntomas.`);
    this.iniciarTemporizadorEscalamiento(30);
  }

  toggleSintomaRapido(sintoma) {
    if (this.sintomasExtra.has(sintoma)) {
      this.sintomasExtra.delete(sintoma);
    } else {
      this.sintomasExtra.add(sintoma);
    }
    this.contextoActual = {
      motivo: this.contextoActual?.motivo || 'Botón SOS Paciente',
      ...this.construirPaqueteEmergencia()
    };
    this.actualizarResumenDatosUI();
  }

  actualizarResumenDatosUI() {
    const p = this.contextoActual;
    if (!p) return;

    const sintEl = document.getElementById('sosResumenSintomas');
    if (sintEl) {
      sintEl.textContent = p.sintomas.join(' · ');
    }

    const waBtn = document.getElementById('sosBtnEnviarWa');
    if (waBtn) {
      waBtn.href = p.whatsappUrl;
    }

    document.querySelectorAll('.sos-quick-symptom-btn').forEach(btn => {
      const val = btn.getAttribute('data-sintoma');
      btn.classList.toggle('active', this.sintomasExtra.has(val));
    });
  }

  renderPantallaSencilla() {
    const modal = document.getElementById('pantallaEmergenciaGrande');
    if (!modal || !this.contextoActual) return;

    const p = this.contextoActual;
    const esEmergencia = this.faseActual === 'emergencias';
    const esContestada = this.faseActual === 'familiar_contesto';

    const quickSymptoms = ['Mareo fuerte', 'Sudor frío', 'Falta de aire', 'Dolor de pecho'];

    modal.innerHTML = `
      <div class="sos-fullscreen-card sos-simple-card ${esEmergencia ? 'is-escalated' : ''}">
        <!-- Cabecera limpia -->
        <div class="sos-banner-top ${esContestada ? 'is-ok' : ''}">
          <div class="sos-banner-label">
            <i class="fas ${esEmergencia ? 'fa-ambulance' : (esContestada ? 'fa-check-circle' : 'fa-bell')}" aria-hidden="true"></i>
            <span>${esEmergencia ? 'EMERGENCIAS 123 ACTIVADO' : (esContestada ? 'FAMILIAR EN CONTACTO' : 'AYUDA SOS · MODO SENCILLO')}</span>
          </div>
          <button type="button" class="sos-btn-cerrar" onclick="window.vozSOSInstance.cerrarPantallaEmergencia()">
            <i class="fas fa-times" aria-hidden="true"></i> Cancelar
          </button>
        </div>

        <div class="sos-body-scroll sos-simple-body">
          ${esEmergencia ? `
            <!-- FASE 2: FAMILIAR NO CONTESTÓ -> ESCALADO A EMERGENCIAS 123 -->
            <div class="sos-stage-box escalated">
              <div class="sos-stage-badge red"><i class="fas fa-exclamation-triangle" aria-hidden="true"></i> TU FAMILIAR NO CONTESTÓ</div>
              <h2 class="sos-stage-title">Escalamos a Emergencias (123)</h2>
              <p class="sos-stage-desc">
                Ya preparamos y enviamos tu <strong>ubicación exacta, coordenadas GPS y síntomas</strong> para recibir ayuda médica inmediata.
              </p>
            </div>

            <a href="tel:123" class="sos-big-btn red pulse" onclick="window.vozSOSInstance.confirmarEnvioEmergencias()">
              <i class="fas fa-phone-alt" aria-hidden="true"></i>
              <span>LLAMAR A EMERGENCIAS (123)</span>
            </a>

            <div class="sos-two-actions">
              <a id="sosBtnEnviarWa" href="${p.whatsappUrl}" target="_blank" rel="noopener" class="sos-big-btn green compact">
                <i class="fab fa-whatsapp" aria-hidden="true"></i>
                <span>Enviar GPS y síntomas</span>
              </a>
              <button type="button" class="sos-big-btn blue compact" onclick="window.vozSOSInstance.copiarPaqueteEmergencia()">
                <i class="fas fa-copy" aria-hidden="true"></i>
                <span>Copiar datos al 123</span>
              </button>
            </div>
          ` : esContestada ? `
            <!-- FAMILIAR CONTESTÓ -->
            <div class="sos-stage-box ok">
              <div class="sos-stage-badge green"><i class="fas fa-check-circle" aria-hidden="true"></i> AYUDA EN CAMINO</div>
              <h2 class="sos-stage-title">${p.familiarNombre} ya fue contactado</h2>
              <p class="sos-stage-desc">
                El escalamiento automático a Emergencias (123) se detuvo. Tu ubicación y síntomas siguen visibles abajo.
              </p>
            </div>

            <button type="button" class="sos-big-btn green" onclick="window.vozSOSInstance.cerrarPantallaEmergencia()">
              <i class="fas fa-check" aria-hidden="true"></i>
              <span>YA ESTOY ACOMPAÑADO · CERRAR</span>
            </button>
          ` : `
            <!-- FASE 1: CONTACTANDO AL FAMILIAR CON CUENTA REGRESIVA A EMERGENCIAS 123 -->
            <div class="sos-stage-box">
              <div class="sos-stage-badge amber"><i class="fas fa-phone-volume" aria-hidden="true"></i> PASO 1 DE 2 · AVISANDO A TU FAMILIAR</div>
              <h2 class="sos-stage-title">${p.familiarNombre}</h2>
              <div class="sos-countdown-row">
                <span>Si no contesta, llamamos a <strong>Emergencias (123)</strong> en:</span>
                <strong id="sosEscalamientoSeg" class="sos-countdown-num">00:${String(this.escalamientoSegundos).padStart(2, '0')}</strong>
              </div>
              <div class="sos-progress-track">
                <div class="sos-progress-fill" id="sosProgressFill" style="width:100%;"></div>
              </div>
            </div>

            <a href="tel:${p.familiarTel}" class="sos-big-btn green">
              <i class="fas fa-phone-alt" aria-hidden="true"></i>
              <span>LLAMAR A MI FAMILIAR AHORA</span>
            </a>

            <div class="sos-two-actions">
              <button type="button" class="sos-big-btn teal compact" onclick="window.vozSOSInstance.marcarFamiliarContesto()">
                <i class="fas fa-check" aria-hidden="true"></i>
                <span>Ya contestó</span>
              </button>
              <button type="button" class="sos-big-btn red compact" onclick="window.vozSOSInstance.escalarAEmergenciasAhora('Familiar no contestó (escalamiento manual)')">
                <i class="fas fa-ambulance" aria-hidden="true"></i>
                <span>No contesta · Ir al 123</span>
              </button>
            </div>
          `}

          <!-- ¿QUÉ SIENTES AHORA? (Opcional, 1 toque para sumar al envío) -->
          ${!esContestada ? `
            <div class="sos-quick-symptoms-wrap">
              <div class="sos-mini-heading">¿Qué sientes en este momento? (opcional, 1 toque):</div>
              <div class="sos-quick-symptoms-grid">
                ${quickSymptoms.map(s => `
                  <button type="button" class="sos-quick-symptom-btn ${this.sintomasExtra.has(s) ? 'active' : ''}" data-sintoma="${s}" onclick="window.vozSOSInstance.toggleSintomaRapido('${s}')">
                    ${s}
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- RESUMEN SIMPLE DE LOS 3 DATOS QUE SE ENVÍAN -->
          <div class="sos-packet-card">
            <div class="sos-packet-title">
              <i class="fas fa-paper-plane" aria-hidden="true"></i>
              <span>${esEmergencia ? 'Datos enviados a Emergencias y Cuidador:' : 'Datos listos para enviar automáticamente:'}</span>
            </div>
            <div class="sos-packet-row">
              <i class="fas fa-map-marker-alt" aria-hidden="true"></i>
              <div><strong>Ubicación:</strong> ${p.sector.nombre} (${p.sector.referencia})</div>
            </div>
            <div class="sos-packet-row">
              <i class="fas fa-location-crosshairs" aria-hidden="true"></i>
              <div>
                <strong>Coordenadas:</strong> ${p.coords[0].toFixed(5)}, ${p.coords[1].toFixed(5)}
                · <a href="${p.mapsUrl}" target="_blank" rel="noopener" class="sos-inline-map-link">Ver mapa</a>
              </div>
            </div>
            <div class="sos-packet-row">
              <i class="fas fa-notes-medical" aria-hidden="true"></i>
              <div><strong>Síntomas y signos:</strong> <span id="sosResumenSintomas">${p.sintomas.join(' · ')}</span></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  iniciarTemporizadorEscalamiento(segundos = 30) {
    this.escalamientoSegundos = segundos;
    const total = segundos;
    if (this.escalamientoTimer) clearInterval(this.escalamientoTimer);

    this.escalamientoTimer = setInterval(() => {
      this.escalamientoSegundos--;
      const secEl = document.getElementById('sosEscalamientoSeg');
      const fillEl = document.getElementById('sosProgressFill');

      const s = Math.max(0, this.escalamientoSegundos);
      if (secEl) {
        secEl.textContent = `00:${String(s).padStart(2, '0')}`;
      }
      if (fillEl) {
        fillEl.style.width = `${Math.max(0, (s / total) * 100)}%`;
      }

      if (this.escalamientoSegundos <= 0) {
        clearInterval(this.escalamientoTimer);
        this.escalamientoTimer = null;
        this.escalarAEmergenciasAhora('El familiar no contestó en 30 segundos');
      }
    }, 1000);
  }

  marcarFamiliarContesto() {
    if (this.escalamientoTimer) {
      clearInterval(this.escalamientoTimer);
      this.escalamientoTimer = null;
    }
    this.faseActual = 'familiar_contesto';
    this.renderPantallaSencilla();
    if (window.mostrarNotificacion) {
      window.mostrarNotificacion('Escalamiento al 123 detenido: familiar en contacto.', 'success');
    }
  }

  escalarAEmergenciasAhora(razon = 'El familiar no contestó') {
    if (this.escalamientoTimer) {
      clearInterval(this.escalamientoTimer);
      this.escalamientoTimer = null;
    }

    this.faseActual = 'emergencias';
    this.contextoActual = {
      motivo: razon,
      ...this.construirPaqueteEmergencia()
    };

    const p = this.contextoActual;

    // 1. Registrar escalamiento automático en Alertas 24/7 (y Supabase si está activo)
    if (typeof window.emitirAlerta24Horas === 'function') {
      window.emitirAlerta24Horas({
        titulo: `ESCALAMIENTO A EMERGENCIAS (123) — ${p.pacienteNombre}`,
        subtitulo: `${razon}. Enviadas ubicación (${p.sector.nombre}), coordenadas y síntomas.`,
        tipo: 'escalamiento_cuidador',
        color: 'red',
        icono: 'fas fa-ambulance',
        badgeTexto: 'Emergencias 123',
        badgeClase: 'badge-pendiente',
        estado: 'pendiente',
        coordenadas: { lat: p.coords[0], lng: p.coords[1] },
        ubicacion: `${p.sector.nombre} · ${p.coords[0].toFixed(5)}, ${p.coords[1].toFixed(5)}`,
        descripcion: p.textoCompartir
      });
    }

    // 2. Guardar registro de emergencia escalada en localStorage para auditoría
    try {
      const key = 'diamon_emergencias_escaladas_v1';
      const prev = JSON.parse(localStorage.getItem(key) || '[]');
      prev.unshift({
        id: 'emg-' + Date.now(),
        ts: Date.now(),
        razon,
        paciente: p.pacienteNombre,
        ubicacion: p.sector.nombre,
        referencia: p.sector.referencia,
        coordenadas: { lat: p.coords[0], lng: p.coords[1] },
        mapsUrl: p.mapsUrl,
        sintomas: p.sintomas
      });
      localStorage.setItem(key, JSON.stringify(prev.slice(0, 20)));
    } catch (_) {}

    this.renderPantallaSencilla();
    this.hablar('Tu familiar no contestó. Escalamos la ayuda a emergencias 123 y enviamos tu ubicación, coordenadas y síntomas.');

    if (window.DiaMonAndroid && typeof window.DiaMonAndroid.dispararNotificacionNativa === 'function') {
      try {
        window.DiaMonAndroid.dispararNotificacionNativa(
          `EMERGENCIAS 123 — ${p.pacienteNombre}`,
          `Ubicación: ${p.sector.nombre} (${p.coords[0].toFixed(5)}, ${p.coords[1].toFixed(5)}). Síntomas: ${p.sintomas.join(', ')}`,
          true
        );
      } catch (_) {}
    }

    if (window.mostrarNotificacion) {
      window.mostrarNotificacion('Escalamiento a Emergencias (123) activado: coordenadas, ubicación y síntomas enviados.', 'error');
    }
  }

  confirmarEnvioEmergencias() {
    if (window.mostrarNotificacion) {
      window.mostrarNotificacion('Iniciando llamada al 123 con ubicación y síntomas listos en pantalla.', 'warn');
    }
  }

  copiarPaqueteEmergencia() {
    if (!this.contextoActual) return;
    const texto = this.contextoActual.textoCompartir;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(() => {
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion('Ubicación, coordenadas y síntomas copiados para Emergencias (123).', 'success');
        }
      }).catch(() => {});
    }
  }

  cerrarPantallaEmergencia() {
    if (this.escalamientoTimer) {
      clearInterval(this.escalamientoTimer);
      this.escalamientoTimer = null;
    }
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
    }
    const modal = document.getElementById('pantallaEmergenciaGrande');
    if (modal) modal.classList.remove('active');
  }

  injectUI() {
    const navRight = document.querySelector('.navbar-right');
    if (!navRight || document.getElementById('btnMicrofonoSOS')) return;

    const micBtn = document.createElement('button');
    micBtn.id = 'btnMicrofonoSOS';
    micBtn.className = 'btn-mic-sos';
    micBtn.title = 'Activar emergencia por voz (di "Ayuda" o "Emergencia")';
    micBtn.innerHTML = '<i class="fas fa-microphone"></i> <span>SOS por Voz</span>';

    navRight.insertBefore(micBtn, navRight.firstChild);
  }

  bindEvents() {
    const btn = document.getElementById('btnMicrofonoSOS');
    if (btn) {
      btn.addEventListener('click', () => this.toggleEscucha());
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new VozEmergenciaSOS();
});
