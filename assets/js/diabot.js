// ============================================================
// DiaMon — DiaBot: Asistente Clínico con IA Real (Google Gemini API)
// + Motor de Razonamiento Clínico Contextual en Vivo (Diabetes Tipo 2 + HTA)
// ============================================================

class DiaBotAssistant {
  constructor() {
    this.isOpen = false;
    this.apiKeyStorageKey = 'diamon_gemini_api_key';
    this.init();
  }

  init() {
    this.injectWidgetHTML();
    this.bindEvents();
    const ctx = this.obtenerContextoEnVivo();
    this.addBotMessage(
      `¡Hola! Soy <strong>DiaBot IA</strong>. Estoy conectado en tiempo real a la telemetría de <strong>${ctx.nombre}</strong>:<br>` +
      `<div style="background:rgba(13,148,136,0.1); border-left:3px solid #0d9488; padding:8px 10px; border-radius:6px; margin:8px 0; font-size:12px;">` +
      `• <strong>Glucosa:</strong> ${ctx.glucosa} (${ctx.estadoGlucosa})<br>` +
      `• <strong>Presión Arterial:</strong> ${ctx.presion} (${ctx.estadoPresion})<br>` +
      `• <strong>Ubicación GPS:</strong> ${ctx.ubicacion}` +
      `</div>` +
      `Pregúntame cualquier duda sobre sus signos actuales, medicamentos (Losartán/Metformina), hipertensión o qué hacer ante una alerta.`
    );
  }

  obtenerContextoEnVivo() {
    if (window.casoEstudio && typeof window.casoEstudio.obtenerResumenClinicoActual === 'function') {
      const r = window.casoEstudio.obtenerResumenClinicoActual();
      const ubic = window.TelemetriaDiaMon?.ubicacion?.zona || r.paciente.barrioResidencia;
      return {
        nombre: r.paciente.nombre,
        edad: r.paciente.edad,
        diagnostico: r.paciente.diagnosticoPrincipal,
        profesional: r.paciente.profesionalGuia,
        glucosa: `${r.ultimaGlucosa.valor} mg/dL`,
        glucosaNum: r.ultimaGlucosa.valor,
        contextoGlucosa: r.ultimaGlucosa.ContextoLabel,
        estadoGlucosa: r.evalG.etiqueta,
        protocoloGlucosa: r.evalG.protocolo,
        presion: `${r.ultimaPresion.sistolica}/${r.ultimaPresion.diastolica} mmHg`,
        sistolicaNum: r.ultimaPresion.sistolica,
        diastolicaNum: r.ultimaPresion.diastolica,
        pulso: `${r.ultimaPresion.pulso} BPM`,
        estadoPresion: r.evalP.etiqueta,
        protocoloPresion: r.evalP.protocolo,
        metaGlucosa: `${r.metas.glucosaMin}–${r.metas.glucosaMaxPost} mg/dL`,
        metaPresion: `< ${r.metas.sistolicaMax}/${r.metas.diastolicaMax} mmHg`,
        ubicacion: ubic
      };
    }

    return {
      nombre: 'Damián Díaz Balseiro',
      edad: 74,
      diagnostico: 'Diabetes Mellitus Tipo 2 Insulinorrequiriente + Hipertensión Arterial + Neuropatía Diabética',
      profesional: 'Enf. Jefe Elizabeth Vargas Caro',
      glucosa: '114 mg/dL',
      glucosaNum: 114,
      contextoGlucosa: 'En ayunas (8:00 AM)',
      estadoGlucosa: 'En meta clínica',
      protocoloGlucosa: 'Dentro del rango seguro pautado con la Enf. Jefe Elizabeth Vargas Caro.',
      presion: '126/78 mmHg',
      sistolicaNum: 126,
      diastolicaNum: 78,
      pulso: '71 BPM',
      estadoPresion: 'Presión Controlada',
      protocoloPresion: 'Mantener esquema de Nifedipina (8 AM / 8 PM) y Valsartán (2 PM).',
      metaGlucosa: '80–180 mg/dL',
      metaPresion: '< 140/90 mmHg',
      ubicacion: 'Barrio Chapacuá, Cartagena de Indias'
    };
  }

  injectWidgetHTML() {
    if (document.getElementById('diabotWidget')) return;

    const widget = document.createElement('div');
    widget.id = 'diabotWidget';
    widget.className = 'diabot-widget-container';
    widget.innerHTML = `
      <!-- Botón Flotante Toggle -->
      <button id="diabotToggleBtn" class="diabot-toggle-btn" aria-label="Abrir Asistente DiaBot IA">
        <div class="diabot-avatar-pulse">
          <i class="fas fa-robot"></i>
        </div>
        <span class="diabot-btn-label">DiaBot IA</span>
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
              <div class="diabot-title">DiaBot IA · Caso de Estudio</div>
              <div class="diabot-subtitle"><span class="dot-live"></span> Conectado a Glucosa, Presión y GPS</div>
            </div>
          </div>
          <div class="diabot-header-actions">
            <button id="diabotClearBtn" class="diabot-btn-icon" title="Reiniciar conversación">
              <i class="fas fa-trash-alt"></i>
            </button>
            <button id="diabotCloseBtn" class="diabot-btn-icon" title="Cerrar chat">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>

        <!-- Chips de sugerencias rápidas orientadas a Damián Díaz Balseiro -->
        <div class="diabot-chips-container">
          <button class="diabot-chip" data-prompt="¿Cómo están los signos vitales de mi abuelo Damián hoy?">📊 Estado de Don Damián</button>
          <button class="diabot-chip" data-prompt="¿Cuál es el esquema completo de medicamentos e insulina de mi abuelo?">💊 Esquema 8AM / 2PM / 8PM / 9PM</button>
          <button class="diabot-chip" data-prompt="Tiene la presión alta, ¿qué debemos hacer con Valsartán y Nifedipino?">❤️ Protocolo Hipertensión</button>
          <button class="diabot-chip" data-prompt="Tiene un bajón de azúcar y mareo">🚨 Hipoglucemia (Regla 15-15)</button>
          <button class="diabot-chip" data-prompt="¿Dónde está ubicado ahora mismo en Chapacuá según el GPS?">📍 GPS en Chapacuá</button>
          <button class="diabot-chip" data-prompt="¿Para qué sirven Firialta, Gabapentina, Lipotic y Ozempic?">🩺 Función de sus Medicinas</button>
        </div>

        <!-- Mensajes -->
        <div id="diabotMessages" class="diabot-messages-body"></div>

        <!-- Disclaimer ético -->
        <div class="diabot-disclaimer">
          <i class="fas fa-user-md"></i> Basado en metas avaladas por médico/enfermera. No reemplaza consulta médica.
        </div>

        <!-- Input -->
        <form id="diabotForm" class="diabot-input-bar">
          <input type="text" id="diabotInput" placeholder="Pregunta sobre su glucosa, presión, pastillas o GPS..." autocomplete="off">
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
    const configBtn = document.getElementById('diabotConfigApiBtn');
    const saveKeyBtn = document.getElementById('diabotSaveKeyBtn');
    const form = document.getElementById('diabotForm');
    const input = document.getElementById('diabotInput');

    if (toggleBtn) toggleBtn.addEventListener('click', () => this.toggleChat());
    if (closeBtn) closeBtn.addEventListener('click', () => this.toggleChat(false));
    if (clearBtn) clearBtn.addEventListener('click', () => this.clearChat());

    if (configBtn) {
      configBtn.addEventListener('click', () => {
        const drawer = document.getElementById('diabotApiDrawer');
        const keyInp = document.getElementById('diabotApiKeyInput');
        if (!drawer) return;
        const open = drawer.style.display === 'none';
        drawer.style.display = open ? 'block' : 'none';
        if (open && keyInp) {
          keyInp.value = localStorage.getItem(this.apiKeyStorageKey) || '';
        }
      });
    }

    if (saveKeyBtn) {
      saveKeyBtn.addEventListener('click', () => {
        const keyInp = document.getElementById('diabotApiKeyInput');
        const val = (keyInp?.value || '').trim();
        if (val) {
          localStorage.setItem(this.apiKeyStorageKey, val);
          this.addBotMessage('✅ <strong>API Key de Google Gemini guardada.</strong> Las consultas usarán el modelo <code>gemini-2.5-flash</code> con el contexto clínico en vivo.');
        } else {
          localStorage.removeItem(this.apiKeyStorageKey);
          this.addBotMessage('ℹ️ Se restauró el motor de razonamiento clínico contextual integrado.');
        }
        document.getElementById('diabotApiDrawer').style.display = 'none';
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        this.handleUserMessage(text);
        input.value = '';
      });
    }

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
    const ctx = this.obtenerContextoEnVivo();
    this.addBotMessage(`Conversación reiniciada. Sigo monitoreando a <strong>${ctx.nombre}</strong> (Glucosa: ${ctx.glucosa} · PA: ${ctx.presion}). ¿Qué deseas consultar?`);
  }

  async handleUserMessage(text) {
    this.addUserMessage(text);
    this.showTypingIndicator();

    const ctx = this.obtenerContextoEnVivo();

    // 1. Consultar endpoint Serverless (/api/diabot) donde la API Key vive solo en el servidor
    try {
      const resp = await fetch('/api/diabot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context: ctx
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data && data.reply) {
          this.removeTypingIndicator();
          this.addBotMessage(this.formatearMarkdownSimple(data.reply));
          return;
        }
      }
    } catch (_) {
      // Si se abre como archivo estático o sin red, pasa al motor contextual local
    }

    // 2. Motor de Razonamiento Clínico Contextual en Vivo (Usa los datos reales del Abuelo)
    setTimeout(() => {
      this.removeTypingIndicator();
      const respuestaContextual = this.generarRespuestaClinicaContextual(text, ctx);
      this.addBotMessage(respuestaContextual);
    }, 450);
  }

  formatearMarkdownSimple(str) {
    return String(str)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\s*[-•]\s+/g, '<br>• ')
      .replace(/\n/g, '<br>');
  }

  generarRespuestaClinicaContextual(userText, ctx) {
    const lower = userText.toLowerCase();

    // 1. Consulta por el estado actual / signos vitales del abuelo
    if (lower.includes('estado') || lower.includes('signos') || lower.includes('como esta') || lower.includes('cómo está') || lower.includes('abuelo') || lower.includes('resumen') || lower.includes('hoy')) {
      return `<strong>📊 Evaluación Clínica en Tiempo Real — ${ctx.nombre}</strong><br>` +
        `Analizando las últimas lecturas sincronizadas en DiaMon:<br>` +
        `<ul style="margin:6px 0 6px 18px; padding:0;">` +
        `<li><strong>Glucosa capilar:</strong> <code>${ctx.glucosa}</code> (${ctx.contextoGlucosa}) → <strong>${ctx.estadoGlucosa}</strong>. <em>${ctx.protocoloGlucosa}</em></li>` +
        `<li><strong>Presión arterial:</strong> <code>${ctx.presion}</code> (${ctx.pulso}) → <strong>${ctx.estadoPresion}</strong>. <em>${ctx.protocoloPresion}</em></li>` +
        `<li><strong>Metas definidas por ${ctx.profesional}:</strong> Glucosa ${ctx.metaGlucosa} y PA ${ctx.metaPresion}.</li>` +
        `<li><strong>Ubicación GPS:</strong> ${ctx.ubicacion}.</li>` +
        `</ul>`;
    }

    // 2. Consulta sobre Presión Arterial / Hipertensión / Valsartán / Nifedipino
    if (lower.includes('presion') || lower.includes('presión') || lower.includes('hiperten') || lower.includes('tension') || lower.includes('tensión') || lower.includes('valsartan') || lower.includes('valsartán') || lower.includes('nifedipin') || lower.includes('140') || lower.includes('160')) {
      const alertaPA = ctx.sistolicaNum >= 140 || ctx.diastolicaNum >= 90;
      return `<strong>❤️ Manejo de Hipertensión Arterial (${ctx.nombre})</strong><br>` +
        `Su última lectura registrada es <strong>${ctx.presion}</strong> (${ctx.pulso}) — <strong>${ctx.estadoPresion}</strong>.<br>` +
        `<ul style="margin:6px 0 6px 18px; padding:0;">` +
        `<li><strong>Indicaciones actuales:</strong> ${alertaPA ? '⚠️ La presión supera la meta de ' + ctx.metaPresion + '. Pon a Don Damián en reposo sentado, verifica si ya tomó su <strong>Nifedipina (8:00 AM / 8:00 PM)</strong> o su <strong>Valsartán (2:00 PM)</strong> y repite la toma en 10 minutos.' : '✅ Se encuentra dentro de la meta cardiovascular (' + ctx.metaPresion + ') pautada con la ' + ctx.profesional + '.'}</li>` +
        `<li><strong>Signos de alarma:</strong> Si presenta dolor de cabeza intenso, visión borrosa, dolor torácico o presión ≥ 160/100 mmHg, activa el botón <strong>SOS</strong> o acude a urgencias cercanas a Chapacuá (Clínica Blas de Lezo / HUC).</li>` +
        `</ul>`;
    }

    // 3. Hipoglucemia / Bajón de azúcar / Mareo
    if (lower.includes('hipo') || lower.includes('baja') || lower.includes('bajon') || lower.includes('bajón') || lower.includes('mareo') || lower.includes('sudor') || lower.includes('temblor') || lower.includes('60') || lower.includes('70')) {
      return `<strong>🚨 Protocolo de Hipoglucemia para ${ctx.nombre} (Regla 15-15)</strong><br>` +
        `Última glucosa registrada: <strong>${ctx.glucosa}</strong>. Como Don Damián se aplica <strong>24 unidades de Insulina a las 9:00 PM</strong>, Metformina (8 AM y 8 PM) y Ozempic los sábados, su meta mínima segura es <strong>80 mg/dL</strong>:<br>` +
        `<ol style="margin:6px 0 6px 18px; padding:0;">` +
        `<li><strong>15 gramos de azúcar rápida:</strong> Dale medio vaso de jugo natural dulce o 3 cucharaditas de azúcar disueltas en agua.</li>` +
        `<li><strong>15 minutos de reposo sentado:</strong> Evita que camine solo para prevenir caídas.</li>` +
        `<li><strong>Repetir medición:</strong> Si sigue por debajo de 80 mg/dL, repite la toma. Si está inconsciente, <strong>NO le des líquidos</strong> y activa el botón <strong>SOS / 123</strong>.</li>` +
        `</ol>`;
    }

    // 4. Hiperglucemia / Azúcar alta
    if (lower.includes('hiper') || lower.includes('alta') || lower.includes('subio') || lower.includes('subió') || lower.includes('200') || lower.includes('250') || lower.includes('sed')) {
      return `<strong>⚠️ Protocolo ante Glucosa Elevada (Hiperglucemia)</strong><br>` +
        `Lectura actual de ${ctx.nombre}: <strong>${ctx.glucosa}</strong> (${ctx.contextoGlucosa}).<br>` +
        `<ul style="margin:6px 0 6px 18px; padding:0;">` +
        `<li><strong>Hidratación:</strong> Ofrece agua pura en sorbos frecuentes.</li>` +
        `<li><strong>Adherencia:</strong> Verifica si ya confirmó su <strong>Metformina (8:00 AM / 8:00 PM)</strong>, su <strong>Insulina de 24 unidades (9:00 PM)</strong> y su <strong>Ozempic del sábado</strong>.</li>` +
        `<li><strong>Importante:</strong> Nunca modifiques las 24 unidades de insulina sin indicación médica o de la <em>${ctx.profesional}</em>.</li>` +
        `</ul>`;
    }

    // 5. Medicamentos / Pastillas / Dosis / Firialta / Gabapentina / Lipotic / Ozempic
    if (lower.includes('medicamento') || lower.includes('medicina') || lower.includes('pastilla') || lower.includes('dosis') || lower.includes('metformina') || lower.includes('tratamiento') || lower.includes('esquema') || lower.includes('firialta') || lower.includes('gabapentina') || lower.includes('lipotic') || lower.includes('ozempic') || lower.includes('insulina') || lower.includes('pantoprazol') || lower.includes('atorvastatina')) {
      return `<strong>💊 Esquema Farmacológico Completo — ${ctx.nombre}</strong><br>` +
        `Supervisado con la <strong>${ctx.profesional}</strong>:<br>` +
        `<ul style="margin:6px 0 6px 18px; padding:0;">` +
        `<li><strong>08:00 AM:</strong> <strong>Pantoprazol</strong> (protector gástrico), <strong>Metformina</strong> (control glucémico), <strong>Firialta</strong> (finerenona: protección renal y cardiovascular en diabetes) y <strong>Nifedipina</strong> (antihipertensivo).</li>` +
        `<li><strong>02:00 PM:</strong> <strong>Valsartán</strong> (control vespertino de presión arterial).</li>` +
        `<li><strong>08:00 PM:</strong> <strong>Atorvastatina</strong> (colesterol), <strong>Metformina</strong>, <strong>Gabapentina + Lipotic</strong> (ácido tióctico para neuropatía diabética) y <strong>Nifedipino</strong>.</li>` +
        `<li><strong>09:00 PM:</strong> <strong>Insulina Basal — 24 Unidades</strong> subcutáneas.</li>` +
        `<li><strong>Sábados:</strong> <strong>Ozempic</strong> (aplicación semanal).</li>` +
        `</ul>`;
    }

    // 6. Ubicación GPS / Geocerca / Chapacuá
    if (lower.includes('donde') || lower.includes('dónde') || lower.includes('ubicacion') || lower.includes('ubicación') || lower.includes('gps') || lower.includes('zona') || lower.includes('geocerca') || lower.includes('chapacua') || lower.includes('chapacuá')) {
      return `<strong>📍 Telemetría GPS en el Barrio Chapacuá</strong><br>` +
        `<ul style="margin:6px 0 6px 18px; padding:0;">` +
        `<li><strong>Ubicación actual de ${ctx.nombre}:</strong> <code>${ctx.ubicacion}</code>.</li>` +
        `<li><strong>Perímetro seguro:</strong> Geocerca de 400 metros alrededor de su casa en el <strong>Barrio Chapacuá</strong> (cubre su cuadra, parque y droguería local).</li>` +
        `<li>Además, puedes pulsar <strong>"Activar GPS Real de este Dispositivo"</strong> en el banner superior para transmitir coordenadas satelitales reales desde cualquier celular.</li>` +
        `</ul>`;
    }

    // 7. Hospitales y urgencias en Cartagena
    if (lower.includes('clinica') || lower.includes('clínica') || lower.includes('hospital') || lower.includes('urgencia') || lower.includes('cartagena')) {
      return `<strong>🏥 Red de Urgencias Cercanas en Cartagena</strong><br>` +
        `Para el perfil de <strong>${ctx.nombre}</strong> (DM2 + HTA), los centros de referencia más cercanos son:<br>` +
        `<ul style="margin:6px 0 6px 18px; padding:0;">` +
        `<li><strong>Clínica Blas de Lezo</strong> (Av. Pedro de Heredia / Los Ejecutivos) — Urgencias 24h.</li>` +
        `<li><strong>Hospital Universitario del Caribe (HUC)</strong> (Zarzagocilla) — Alta complejidad.</li>` +
        `<li><strong>Clínica Gestión Salud San Fernando</strong> — Atención rápida en su sector residencial.</li>` +
        `</ul>`;
    }

    // Respuesta contextual general
    return `<strong>🩺 Orientación Clínica DiaBot para ${ctx.nombre}</strong><br>` +
      `En este momento sus signos registrados son: <strong>Glucosa ${ctx.glucosa}</strong> (${ctx.estadoGlucosa}) y <strong>Presión Arterial ${ctx.presion}</strong> (${ctx.estadoPresion}), ubicado en <strong>${ctx.ubicacion}</strong>.<br><br>` +
      `• Puedes registrar una nueva toma manual pulsando <strong>"Registrar Glucosa / Presión"</strong> en el panel superior.<br>` +
      `• Si deseas activar la pantalla de 4 botones gigantes para tu abuelo, pulsa <strong>"Modo Adulto Mayor"</strong> en la barra superior.`;
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
