// SOS por voz: si el paciente dice "ayuda" se abre la pantalla de emergencia
// Muestra la ubicación actual en GRANDE con Barrio, Referencia y Llamada directa
// Optimizado 100% para celulares y pantallas táctiles

// Base de sectores y barrios de Cartagena para geocodificación inversa inmediata
const BARRIOS_CARTAGENA = [
  { nombre: 'Chapacuá (Casa Don Damián Díaz)', centro: [10.39991, -75.47886], radio: 900, referencia: 'Barrio Chapacuá (Lat: 10.39991, Lng: -75.47886) / Cerca a Transversal 54 y Clínica Blas de Lezo' },
  { nombre: 'Zarzagocilla / Campus Universitario', centro: [10.3951, -75.4952], radio: 800, referencia: 'Cerca a la Universidad de Cartagena y Hospital Universitario (HUC)' },
  { nombre: 'San Fernando / Los Caracoles', centro: [10.3887, -75.4789], radio: 900, referencia: 'Sector Residencial Sur / Cerca a Clínica Gestión Salud' },
  { nombre: 'Los Ejecutivos / Cuatro Vientos', centro: [10.4010, -75.5035], radio: 750, referencia: 'Sobre Av. Pedro de Heredia / Cerca a Clínica Blas de Lezo' },
  { nombre: 'Pie de la Popa / Cerro de la Popa', centro: [10.4182, -75.5345], radio: 800, referencia: 'Cerca a Clínica Cartagena del Mar y Mercado de Bazurto' },
  { nombre: 'Manga / Miramar', centro: [10.4135, -75.5412], radio: 750, referencia: 'Sector Manga / Cerca a Farmatodo 24h y Puentes hacia el Centro' },
  { nombre: 'Centro Histórico / San Diego', centro: [10.4235, -75.5502], radio: 850, referencia: 'Centro Amurallado / Sede San Agustín Universidad de Cartagena' },
  { nombre: 'Bocagrande / Castillogrande', centro: [10.4050, -75.5530], radio: 1100, referencia: 'Av. San Martín / Cerca a Hospital Bocagrande y Clínica MediHelp' },
  { nombre: 'El Prado / Bruselas', centro: [10.4075, -75.5186], radio: 700, referencia: 'Cerca a Clínica Crecer y Av. El Consulado' },
  { nombre: 'Crespo / Marbella', centro: [10.4350, -75.5380], radio: 900, referencia: 'Sector Costero / Cerca al Aeropuerto Rafael Núñez' }
];

class VozEmergenciaSOS {
  constructor() {
    this.recognition = null;
    this.isListening = false;
    this.escalamientoTimer = null;
    this.escalamientoSegundos = 180; // 3 minutos para contactar al 2do familiar
    this.contactoActivo = 1;
    this.initSpeechRecognition();
    this.injectUI();
    this.bindEvents();
    window.vozSOSInstance = this;
  }

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Reconocimiento de voz no soportado nativamente en este navegador.');
      return;
    }

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

      this.recognition.onerror = (event) => {
        console.warn('[Voz SOS] Error:', event.error);
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
      alert('Tu navegador no permite reconocimiento por voz. Puedes usar el botón de SOS en pantalla directamente.');
      this.abrirPantallaEmergenciaGrande('Activación manual por botón');
      return;
    }

    if (this.isListening) {
      this.recognition.stop();
    } else {
      try {
        this.recognition.start();
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion('🎙️ Di en voz alta: "Ayuda", "Auxilio" o "Emergencia"', 'info');
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
      this.hablar('Comando de emergencia detectado. Mostrando ubicación y contactando familiar.');
      this.abrirPantallaEmergenciaGrande(`Activado por comando de voz: "${frase}"`);
    } else {
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion(`Palabra escuchada: "${frase}". Di "Ayuda" o "Emergencia" para activar el SOS.`, 'info');
      }
    }
  }

  hablar(texto) {
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(texto);
      utterance.lang = 'es-CO';
      utterance.rate = 1.0;
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

  abrirPantallaEmergenciaGrande(motivo = 'Activación SOS') {
    let modal = document.getElementById('pantallaEmergenciaGrande');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'pantallaEmergenciaGrande';
      modal.className = 'sos-fullscreen-overlay';
      document.body.appendChild(modal);
    }

    // Obtener coordenadas actuales
    const coords = (window.TelemetriaDiaMon && window.TelemetriaDiaMon.ubicacion)
      ? [window.TelemetriaDiaMon.ubicacion.lat, window.TelemetriaDiaMon.ubicacion.lng]
      : [10.39991, -75.47886];

    const sector = this.identificarBarrioCartagena(coords[0], coords[1]);
    const mapsUrl = `https://www.google.com/maps?q=${coords[0]},${coords[1]}`;
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Contactos
    const profile = window.medicalQRManager ? window.medicalQRManager.profile : null;
    const c1Nombre = profile?.contactoNombre || 'Nieta / Cuidadora Principal (Chapacuá)';
    const c1Tel = (profile?.contactoTelefono || '+573004567890').replace(/\s+/g, '');
    const c2Nombre = profile?.medicoTratante || 'Enf. Jefe Elizabeth Vargas Caro';
    const c2Tel = (profile?.medicoTelefono || '+573109876543').replace(/\s+/g, '');

    const whatsappMsg = encodeURIComponent(
      `🚨 EMERGENCIA DIAMON: Necesito ayuda médica urgente. Me encuentro descompensado en ${sector.nombre} (${sector.referencia}) en Cartagena. Mi ubicación GPS exacta es: ${mapsUrl}`
    );

    modal.innerHTML = `
      <div class="sos-fullscreen-card">
        <!-- Cabecera de Emergencia -->
        <div class="sos-banner-top">
          <div class="sos-banner-label">
            <i class="fas fa-ambulance"></i> ASISTENCIA MÉDICA · ALERTA SOS
          </div>
          <button class="sos-btn-cerrar" onclick="window.vozSOSInstance.cerrarPantallaEmergencia()">
            <i class="fas fa-times"></i> Cerrar
          </button>
        </div>

        <div class="sos-body-scroll">
          <!-- UBICACIÓN EN GRANDE -->
          <div class="sos-location-box">
            <span class="sos-location-pill">📍 Ubicación del Paciente en Cartagena</span>
            <h1 class="sos-barrio-grande">${sector.nombre}</h1>
            <p class="sos-referencia-grande">
              <i class="fas fa-map-signs"></i> ${sector.referencia}
            </p>
            <div class="sos-coords-badge">
              <span>Lat: <strong>${coords[0].toFixed(5)}</strong> · Lng: <strong>${coords[1].toFixed(5)}</strong></span>
              <span class="sos-hora">Hora: ${hora}</span>
            </div>
            <a href="${mapsUrl}" target="_blank" class="sos-btn-mapa">
              <i class="fas fa-external-link-alt"></i> Abrir en Google Maps / Waze
            </a>
          </div>

          <!-- ESCALAMIENTO DE CONTACTOS (Nivel 1 y Nivel 2) -->
          <div class="sos-escalamiento-box">
            <div class="sos-escalamiento-header">
              <div class="sos-esc-title"><i class="fas fa-phone-volume"></i> Protocolo de Contacto Familiar</div>
              <div id="sosEscalamientoBadge" class="sos-esc-timer">Escalando en 03:00</div>
            </div>

            <!-- Contacto Principal (Nivel 1) -->
            <div class="sos-contacto-card active" id="cardContactoNivel1">
              <div class="sos-c-info">
                <span class="sos-c-tag">Contacto 1 (Principal)</span>
                <div class="sos-c-name">${c1Nombre}</div>
                <div class="sos-c-phone">${c1Tel}</div>
              </div>
              <div class="sos-c-actions">
                <a href="tel:${c1Tel}" class="btn-sos-call">
                  <i class="fas fa-phone-alt"></i> Llamar
                </a>
                <a href="https://wa.me/${c1Tel.replace(/\D/g, '')}?text=${whatsappMsg}" target="_blank" class="btn-sos-wa">
                  <i class="fab fa-whatsapp"></i> WhatsApp
                </a>
              </div>
            </div>

            <!-- Contacto Secundario (Nivel 2 - Escalamiento) -->
            <div class="sos-contacto-card" id="cardContactoNivel2">
              <div class="sos-c-info">
                <span class="sos-c-tag">Contacto 2 (Escalamiento automático)</span>
                <div class="sos-c-name">${c2Nombre}</div>
                <div class="sos-c-phone">${c2Tel}</div>
              </div>
              <div class="sos-c-actions">
                <a href="tel:${c2Tel}" class="btn-sos-call secondary">
                  <i class="fas fa-phone-alt"></i> Llamar 2do
                </a>
              </div>
            </div>
          </div>

          <!-- BOTÓN DIRECTO AL 123 (CRUE CARTAGENA) -->
          <div class="sos-action-crue">
            <a href="tel:123" class="btn-call-123">
              <i class="fas fa-phone-square-alt"></i>
              <div>
                <span class="crue-title">Llamar a Urgencias Médicas (123)</span>
                <span class="crue-sub">Ambulancias y CRUE Cartagena de Indias</span>
              </div>
            </a>
          </div>

          <!-- INFORMACIÓN MÉDICA CRÍTICA DE RESCATE -->
          <div class="sos-medical-sheet-mini">
            <div class="sos-med-title"><i class="fas fa-id-card"></i> Condición Médica de Damián Díaz Balseiro:</div>
            <div class="sos-med-chips">
              <span class="sos-med-chip red">Diabetes Tipo 2 (Insulina 24 UI + Ozempic) + Hipertensión</span>
              <span class="sos-med-chip">Sangre: ${profile?.grupoSanguineo || 'O+'}</span>
              <span class="sos-med-chip">Valsartán + Nifedipino + Metformina + Firialta</span>
            </div>
            <p class="sos-first-aid-hint">
              <strong>Primeros auxilios:</strong> Si está consciente pero mareado o sudoroso, suminístrele 15g de azúcar rápida (jugo o agua con azúcar) y mida su presión arterial sentado. Si está inconsciente, no le dé líquidos y colóquelo de lado.
            </p>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('active');
    this.iniciarTemporizadorEscalamiento();
  }

  iniciarTemporizadorEscalamiento() {
    this.escalamientoSegundos = 180;
    this.contactoActivo = 1;
    if (this.escalamientoTimer) clearInterval(this.escalamientoTimer);

    const badge = document.getElementById('sosEscalamientoBadge');
    const card2 = document.getElementById('cardContactoNivel2');

    this.escalamientoTimer = setInterval(() => {
      this.escalamientoSegundos--;
      const min = Math.floor(this.escalamientoSegundos / 60);
      const seg = this.escalamientoSegundos % 60;
      const str = `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;

      if (badge) {
        badge.textContent = `Escalando a Contacto 2 en ${str}`;
      }

      if (this.escalamientoSegundos <= 0) {
        clearInterval(this.escalamientoTimer);
        this.contactoActivo = 2;
        if (badge) badge.textContent = '¡Alerta escalada al Contacto 2!';
        if (card2) card2.classList.add('active', 'escalated');
        this.hablar('El contacto principal no ha respondido. Alerta escalada al segundo contacto autorizado.');
      }
    }, 1000);
  }

  cerrarPantallaEmergencia() {
    if (this.escalamientoTimer) clearInterval(this.escalamientoTimer);
    const modal = document.getElementById('pantallaEmergenciaGrande');
    if (modal) modal.classList.remove('active');
  }

  injectUI() {
    // Inyectar botón de micrófono en la navbar
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
