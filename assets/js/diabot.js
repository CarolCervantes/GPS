// ============================================================
// DiaMon — DiaBot: Asistente Virtual Clínico Educativo
// Respuestas interactivas de orientación para personas con diabetes
// ============================================================

const DIABOT_KNOWLEDGE_BASE = [
  {
    keywords: ['trancon', 'trafico', 'bazurto', 'tarde', 'demora', 'bus', 'transcaribe', 'amparo', 'pedro de heredia'],
    titulo: '🚦 Trancones en Cartagena y Riesgos para Diabéticos',
    respuesta: 'Quedar atrapado en un trancón (ej. Mercado de Bazurto, Pedro de Heredia o Bomba El Amparo) representa un riesgo real:<ul style="margin:8px 0 8px 18px; padding:0;"><li><strong>Retraso en las comidas:</strong> Si te aplicaste insulina y el transporte se retrasa 40 minutos en Bazurto, corres alto riesgo de hipoglucemia en la ruta. DiaMon suma automáticamente minutos extra por congestión.</li><li><strong>Estrés térmico y vehicular:</strong> El calor dentro del bus o colectivo y el estrés vial elevan el cortisol, provocando oscilaciones bruscas de glucosa.</li><li><strong>Regla de oro:</strong> Lleva siempre en tu bolso una colación rápida (galletas o sobre de glucosa) y agua cuando cruces la Av. Pedro de Heredia.</li></ul>'
  },

  {
    keywords: ['hipo', 'baja', 'mareo', 'sudor', 'temblor', 'palidez', 'desmayo', '60', '70', '50'],
    titulo: '🚨 Protocolo de Hipoglucemia (Glucosa < 70 mg/dL)',
    respuesta: `Si estás experimentando temblores, sudoración fría, mareo o visión borrosa, aplica de inmediato la <strong>Regla 15-15</strong>:
      <ol style="margin:8px 0 8px 18px; padding:0;">
        <li><strong>Consume 15 gramos de carbohidratos rápidos:</strong> 1/2 vaso de jugo de frutas, 3 cucharaditas de azúcar disueltas en agua, o 1 cucharada de miel.</li>
        <li><strong>Espera 15 minutos</strong> en reposo sentado.</li>
        <li><strong>Vuelve a medir tu glucosa.</strong> Si sigue por debajo de 70 mg/dL, repite el consumo de 15g.</li>
        <li>Una vez normalizada, consume una comida sólida o colación con carbohidratos complejos (galletas integrales, pan).</li>
      </ol>
      <em>Si sientes desvanecimiento severo, pulsa el botón SOS de DiaMon o pide auxilio inmediato.</em>`
  },
  {
    keywords: ['hiper', 'alta', '200', '250', '300', 'sed', 'orina', 'boca seca'],
    titulo: '⚠️ Manejo de Hiperglucemia (Glucosa > 180-200 mg/dL)',
    respuesta: `Niveles elevados de glucosa pueden provocar sed excesiva, boca seca y fatiga:
      <ul style="margin:8px 0 8px 18px; padding:0;">
        <li><strong>Hidratación urgente:</strong> Bebe abundante agua pura (no jugos ni gaseosas) para ayudar a tus riñones a eliminar el exceso de glucosa.</li>
        <li><strong>Verifica tu dosis de corrección:</strong> Solo si tu médico endocrinólogo te ha pautado un factor de sensibilidad a la insulina rápida.</li>
        <li><strong>No realices ejercicio intenso:</strong> Si tu glucosa supera 250 mg/dL, el ejercicio puede elevar aún más la glucosa y generar cetonas.</li>
        <li>Si presentas náuseas, vómito o aliento frutal (posible cetoacidosis), acude a Urgencias (puedes ver las clínicas más cercanas en el mapa).</li>
      </ul>`
  },
  {
    keywords: ['calor', 'cartagena', 'temperatura', 'clima', 'costa', 'humedad', 'sol', 'playa'],
    titulo: '☀️ Alerta Climática: Calor en Cartagena y Cuidado de la Insulina',
    respuesta: `El clima cálido de Cartagena de Indias (>32°C con alta humedad) afecta a los pacientes diabéticos:
      <ul style="margin:8px 0 8px 18px; padding:0;">
        <li><strong>La insulina se degrada con el calor:</strong> Nunca dejes tus plumas o viales expuestos al sol ni dentro de vehículos. La insulina en uso debe conservarse a menos de 30°C; en la calle, usa estuche térmico con gel refrigerante (sin congelarla).</li>
        <li><strong>Mayor riesgo de deshidratación:</strong> En Cartagena el sudor constante concentra la glucosa en la sangre. Lleva siempre tu termo de agua potable.</li>
        <li><strong>Absorción acelerada:</strong> El calor y la vasodilatación pueden hacer que la insulina se absorba más rápido de lo habitual, aumentando el riesgo de hipoglucemia si caminas bajo el sol del mediodía.</li>
      </ul>`
  },
  {
    keywords: ['acompañamiento', 'safe walk', 'viaje', 'recorrido', 'ruta', 'destino', 'tiempo'],
    titulo: '🧭 Sistema de Acompañamiento Inteligente GPS',
    respuesta: `El Acompañamiento Seguro de DiaMon te protege en tus desplazamientos por Cartagena:
      <ol style="margin:8px 0 8px 18px; padding:0;">
        <li>Elige tu destino (ej. Universidad de Cartagena, trabajo o regreso a casa) y tu tiempo estimado.</li>
        <li>DiaMon monitorea la cuenta regresiva mientras avanzas.</li>
        <li>Al llegar, pulsa <strong>"He llegado a salvo"</strong> para registrar tu trayecto con éxito.</li>
        <li>Si el tiempo vence sin confirmación, se activa el protocolo SOS con alarma sonora y notificación directa a tu familiar.</li>
      </ol>`
  },
  {
    keywords: ['clinica', 'hospital', 'urgencia', 'doctor', 'medico', 'farmacia', 'huc', 'blas de lezo', 'bocagrande'],
    titulo: '🏥 Red de Urgencias Médicas en Cartagena de Indias',
    respuesta: `Centros hospitalarios con urgencias 24h activos en el mapa DiaMon:
      <ul style="margin:8px 0 8px 18px; padding:0;">
        <li><strong>Hospital Universitario del Caribe (HUC):</strong> Zarzagocilla — Tel: (605) 6724340</li>
        <li><strong>Clínica Blas de Lezo:</strong> Los Ejecutivos / Av. Pedro de Heredia — Tel: (605) 6698000</li>
        <li><strong>Nuevo Hospital Bocagrande:</strong> Cra 6 # 5-49 — Tel: (605) 6655270</li>
        <li><strong>Clínica MediHelp Services:</strong> Castillogrande — Tel: (605) 6551000</li>
        <li><strong>Farmacias 24h:</strong> Farmatodo Bocagrande y Manga (con insulinas e insumos).</li>
      </ul>
      <em>Puedes ver la distancia exacta y trazar la ruta en el mapa en vivo.</em>`
  },
  {
    keywords: ['qr', 'pulsecard', 'tarjeta', 'identificacion', 'escanear', 'emergencia', 'carnet'],
    titulo: '📱 PulseCard e Identificación Médica QR',
    respuesta: `Tu PulseCard permite a paramédicos o acudientes acceder a tu ficha médica al instante:
      <ul style="margin:8px 0 8px 18px; padding:0;">
        <li>Guarda tu tipo de diabetes, insulinas que usas, alergias y contacto de emergencia en <strong>Mi Perfil</strong>.</li>
        <li>Genera un código QR dinámico que puedes guardar en tu teléfono o imprimir.</li>
        <li>Al escanear el QR con cualquier cámara, se abre tu ficha con botón de llamada directa a tu familiar sin necesidad de contraseña.</li>
      </ul>`
  },
  {
    keywords: ['alimento', 'comida', 'dieta', 'fruta', 'azucar', 'comer', 'desayuno'],
    titulo: '🥗 Recomendaciones Nutricionales Clave',
    respuesta: `Para mantener niveles estables de glucemia:
      <ul style="margin:8px 0 8px 18px; padding:0;">
        <li>Prioriza carbohidratos con fibra (avena, legumbres, vegetales verdes) que tienen absorción lenta.</li>
        <li>Evita bebidas azucaradas, jugos ultraprocesados y harinas refinadas.</li>
        <li>Lleva siempre en tu bolso o mochila una colación de rescate (frutos secos, sobre de glucosa o galletas).</li>
      </ul>`
  },
  {
    keywords: ['quien eres', 'diabot', 'ayuda', 'hola', 'buenas', 'que haces', 'funciones'],
    titulo: '👋 ¡Hola! Soy DiaBot, tu asistente de DiaMon',
    respuesta: `Estoy aquí para ayudarte a cuidar tu salud y sacar el máximo provecho de DiaMon:
      <br>Puedo responderte sobre:
      <ul style="margin:6px 0 8px 18px; padding:0;">
        <li>¿Qué hacer ante un bajón de azúcar (hipoglucemia)?</li>
        <li>Recomendaciones ante el calor de Cartagena.</li>
        <li>Cómo usar el Acompañamiento Inteligente GPS.</li>
        <li>Urgencias médicas y farmacias 24 horas en Cartagena.</li>
        <li>Tu Ficha Médica PulseCard y Código QR.</li>
      </ul>`
  }
];

class DiaBotAssistant {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.init();
  }

  init() {
    this.injectWidgetHTML();
    this.bindEvents();
    // Mensaje de bienvenida inicial
    this.addBotMessage('¡Hola! Soy <strong>DiaBot</strong>, tu asistente de monitoreo. ¿Cómo te sientes hoy o sobre qué tema tienes dudas?');
  }

  injectWidgetHTML() {
    if (document.getElementById('diabotWidget')) return;

    const widget = document.createElement('div');
    widget.id = 'diabotWidget';
    widget.className = 'diabot-widget-container';
    widget.innerHTML = `
      <!-- Botón Flotante Toggle -->
      <button id="diabotToggleBtn" class="diabot-toggle-btn" aria-label="Abrir Asistente DiaBot">
        <div class="diabot-avatar-pulse">
          <i class="fas fa-robot"></i>
        </div>
        <span class="diabot-btn-label">DiaBot</span>
        <span class="diabot-online-dot"></span>
      </button>

      <!-- Ventana de Chat -->
      <div id="diabotChatWindow" class="diabot-chat-window" style="display:none;">
        <div class="diabot-header">
          <div class="diabot-header-left">
            <div class="diabot-header-avatar">
              <i class="fas fa-robot"></i>
            </div>
            <div>
              <div class="diabot-title">DiaBot Clínico</div>
              <div class="diabot-subtitle"><span class="dot-live"></span> En línea · Guía para Pacientes</div>
            </div>
          </div>
          <div class="diabot-header-actions">
            <button id="diabotClearBtn" class="diabot-btn-icon" title="Limpiar conversación">
              <i class="fas fa-trash-alt"></i>
            </button>
            <button id="diabotCloseBtn" class="diabot-btn-icon" title="Cerrar chat">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>

        <!-- Chips de sugerencias rápidas -->
        <div class="diabot-chips-container">
          <button class="diabot-chip" data-prompt="hipo">🚨 Bajón de glucosa</button>
          <button class="diabot-chip" data-prompt="calor">☀️ Calor en Cartagena</button>
          <button class="diabot-chip" data-prompt="clinica">🏥 Urgencias en Cartagena</button>
          <button class="diabot-chip" data-prompt="acompañamiento">🧭 Acompañamiento GPS</button>
          <button class="diabot-chip" data-prompt="qr">📱 Código QR Médico</button>
          <button class="diabot-chip" data-prompt="trancon">🚦 Trancones Cartagena</button>
        </div>

        <!-- Mensajes -->
        <div id="diabotMessages" class="diabot-messages-body"></div>

        <!-- Disclaimer ético -->
        <div class="diabot-disclaimer">
          <i class="fas fa-info-circle"></i> Asistente informativo. No diagnostica ni reemplaza al médico.
        </div>

        <!-- Input -->
        <form id="diabotForm" class="diabot-input-bar">
          <input type="text" id="diabotInput" placeholder="Pregúntame sobre glucosa, calor, GPS..." autocomplete="off">
          <button type="submit" id="diabotSendBtn" aria-label="Enviar pregunta">
            <i class="fas fa-paper-plane"></i>
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(widget);
  }

  bindEvents() {
    const toggleBtn = document.getElementById('diabotToggleBtn');
    const closeBtn = document.getElementById('diabotCloseBtn');
    const clearBtn = document.getElementById('diabotClearBtn');
    const form = document.getElementById('diabotForm');
    const input = document.getElementById('diabotInput');

    if (toggleBtn) toggleBtn.addEventListener('click', () => this.toggleChat());
    if (closeBtn) closeBtn.addEventListener('click', () => this.toggleChat(false));
    if (clearBtn) clearBtn.addEventListener('click', () => this.clearChat());

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        this.handleUserMessage(text);
        input.value = '';
      });
    }

    // Chips
    document.querySelectorAll('.diabot-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const prompt = e.currentTarget.dataset.prompt;
        this.handleUserMessage(prompt);
      });
    });
  }

  toggleChat(forceState) {
    this.isOpen = forceState !== undefined ? forceState : !this.isOpen;
    const win = document.getElementById('diabotChatWindow');
    const toggle = document.getElementById('diabotToggleBtn');
    if (!win) return;

    if (this.isOpen) {
      win.style.display = 'flex';
      toggle.classList.add('active');
      const input = document.getElementById('diabotInput');
      if (input) setTimeout(() => input.focus(), 200);
      this.scrollToBottom();
    } else {
      win.style.display = 'none';
      toggle.classList.remove('active');
    }
  }

  clearChat() {
    const body = document.getElementById('diabotMessages');
    if (body) body.innerHTML = '';
    this.addBotMessage('Conversación reiniciada. ¿En qué más puedo orientarte hoy?');
  }

  handleUserMessage(text) {
    this.addUserMessage(text);

    // Simular escritura natural
    this.showTypingIndicator();

    setTimeout(() => {
      this.removeTypingIndicator();
      const respuesta = this.findAnswer(text);
      this.addBotMessage(respuesta);
    }, 550);
  }

  findAnswer(userText) {
    const lower = userText.toLowerCase();

    for (const item of DIABOT_KNOWLEDGE_BASE) {
      if (item.keywords.some(k => lower.includes(k))) {
        return `<strong>${item.titulo}</strong><br>${item.respuesta}`;
      }
    }

    // Respuesta general inteligente de contingencia
    return `Gracias por tu consulta. Para esa situación particular, ten presente:<br>
      • Mantén tu registro de glucosa actualizado en la pestaña <strong>Registros</strong>.<br>
      • Si sientes algún síntoma repentino (mareo, náuseas o confusión), consulta las clínicas cercanas en el mapa de Cartagena o pulsa el botón <strong>SOS</strong>.<br>
      • Recuerda que cualquier ajuste en tu tratamiento de insulina debe ser indicado por tu médico tratante.`;
  }

  addUserMessage(text) {
    const body = document.getElementById('diabotMessages');
    if (!body) return;
    const msg = document.createElement('div');
    msg.className = 'diabot-msg diabot-msg-user';
    msg.innerHTML = `<div class="diabot-bubble">${this.escapeHTML(text)}</div>`;
    body.appendChild(msg);
    this.scrollToBottom();
  }

  addBotMessage(html) {
    const body = document.getElementById('diabotMessages');
    if (!body) return;
    const msg = document.createElement('div');
    msg.className = 'diabot-msg diabot-msg-bot';
    msg.innerHTML = `
      <div class="diabot-bot-icon"><i class="fas fa-robot"></i></div>
      <div class="diabot-bubble">${html}</div>
    `;
    body.appendChild(msg);
    this.scrollToBottom();
  }

  showTypingIndicator() {
    const body = document.getElementById('diabotMessages');
    if (!body) return;
    const typing = document.createElement('div');
    typing.id = 'diabotTyping';
    typing.className = 'diabot-msg diabot-msg-bot';
    typing.innerHTML = `
      <div class="diabot-bot-icon"><i class="fas fa-robot"></i></div>
      <div class="diabot-bubble typing-dots">
        <span></span><span></span><span></span>
      </div>
    `;
    body.appendChild(typing);
    this.scrollToBottom();
  }

  removeTypingIndicator() {
    const typing = document.getElementById('diabotTyping');
    if (typing) typing.remove();
  }

  scrollToBottom() {
    const body = document.getElementById('diabotMessages');
    if (body) {
      body.scrollTop = body.scrollHeight;
    }
  }

  escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.diabotInstance = new DiaBotAssistant();
});
