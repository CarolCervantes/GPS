// Sistema Autónomo de Alertas e Incidencias Clínicas 24/7
// - Monitoreo continuo 24/7 de Geocercas GPS (Salida de zona segura en Cartagena)
// - Notificaciones push nativas del sistema operativo en segundo plano (Service Worker)
// - Alarma sonora clínica de emergencia (Web Audio API)
// - Sincronización en la nube (Supabase Realtime) y almacenamiento persistente
(function () {
  'use strict';

  let filtroRangoActual = '7d';
  let swRegistration = null;

  // Gestión y persistencia de alertas
  // Las alertas viven en Supabase. Aqui solo hay una copia en memoria para pintarlas.
  let alertasCache = [];

  function obtenerAlertas() {
    return alertasCache;
  }

  // Cuando caso-estudio.js trae los datos del paciente, llegan tambien sus alertas
  window.addEventListener('diamon-datos', (e) => {
    alertasCache = (e.detail && e.detail.alertas) || [];
    actualizarBadgesContadores();
    window.renderizarAlertasDiaMon();
  });

  function actualizarBadgesContadores() {
    const alertas = obtenerAlertas();
    const pendientes = alertas.filter(a => a.estado === 'pendiente' || a.estado === 'aviso').length;

    // El numero es el de alertas pendientes de verdad; si no hay, se esconde
    document.querySelectorAll('.dc-nav-badge, .dc-btn-badge, #topbarAlertCount').forEach(el => {
      el.textContent = pendientes;
      el.style.display = pendientes > 0 ? 'inline-flex' : 'none';
    });
  }

  // Sintetizador de audio clínico 24/7 (Web audio API)
  function reproducirAlarmaAudio(tipo = 'aviso') {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      if (tipo === 'geocerca' || tipo === 'critica') {
        // Alarma urgente de emergencia: dos pulsos en tono agudo (880Hz -> 440Hz)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);

        setTimeout(() => {
          try {
            const ctx2 = new AudioCtx();
            const osc2 = ctx2.createOscillator();
            const gain2 = ctx2.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx2.destination);
            osc2.type = 'sawtooth';
            osc2.frequency.setValueAtTime(988, ctx2.currentTime);
            gain2.gain.setValueAtTime(0.25, ctx2.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx2.currentTime + 0.35);
            osc2.start(ctx2.currentTime);
            osc2.stop(ctx2.currentTime + 0.35);
          } catch (_) {}
        }, 380);
      } else {
        // Tono amable de aviso / recordatorio de salud
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      console.warn('Audio de alerta no reproducible en este contexto:', e);
    }
  }

  window.probarSonidoAlerta = function () {
    reproducirAlarmaAudio('geocerca');
    if (window.mostrarNotificacion) {
      window.mostrarNotificacion('🔊 Alarma acústica 24/7 verificada en tu dispositivo.', 'info');
    }
  };

  // Service worker y notificaciones push del sistema 24/7
  function initServiceWorker() {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      const swPath = window.location.pathname.includes('/pages/') ? '../sw.js' : '/sw.js';
      navigator.serviceWorker.register(swPath)
        .then((reg) => {
          swRegistration = reg;
          console.log('[DiaMon 24/7] Service Worker registrado correctamente.');
        })
        .catch((err) => {
          console.warn('[DiaMon 24/7] Service worker registro omitido:', err);
        });
    }

    actualizarBotonNotificacionesUI();
  }

  function actualizarBotonNotificacionesUI() {
    const btn = document.getElementById('btnNotif24h');
    if (!btn) return;

    if (!('Notification' in window)) {
      btn.style.display = 'none';
      return;
    }

    if (Notification.permission === 'granted') {
      btn.classList.add('active');
      btn.innerHTML = '<i class="fas fa-check-circle" style="color:#16a34a;"></i> Push 24/7 Activas';
      btn.title = 'Las alertas sonarán en tu celular o computador incluso con la pantalla apagada.';
    } else {
      btn.classList.remove('active');
      btn.innerHTML = '<i class="fas fa-bell"></i> Activar Push 24/7';
      btn.title = 'Haz clic para recibir alertas en segundo plano cuando tu familiar se mueva.';
    }
  }

  window.activarNotificaciones24h = async function () {
    if (!('Notification' in window)) {
      alert('Tu navegador no soporta notificaciones de sistema.');
      return;
    }

    try {
      const permiso = await Notification.requestPermission();
      actualizarBotonNotificacionesUI();

      if (permiso === 'granted') {
        reproducirAlarmaAudio('aviso');
        enviarNotificacionNativa(
          '🟢 DiaMon: Alertas 24/7 Activadas',
          'Recibirás avisos de geocerca, glucosa y medicamentos en tiempo real en Cartagena.'
        );
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion('🔔 Notificaciones del sistema activadas correctamente 24/7.', 'success');
        }
      } else {
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion('⚠️ Permiso de notificaciones denegado en el navegador.', 'warn');
        }
      }
    } catch (e) {
      console.warn('Error solicitando permisos:', e);
    }
  };

  function enviarNotificacionNativa(titulo, cuerpo, url = '/index.html#view-alertas') {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    if (swRegistration && swRegistration.showNotification) {
      swRegistration.showNotification(titulo, {
        body: cuerpo,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        vibrate: [300, 100, 300],
        tag: 'diamon-alert-tag-' + Date.now(),
        renotify: true,
        data: { url: url }
      });
    } else {
      try {
        new Notification(titulo, {
          body: cuerpo,
          icon: '/favicon.ico',
          vibrate: [300, 100, 300]
        });
      } catch (_) {}
    }
  }

  // Crear alertas y revisar cada 20 segundos (batería)

  window.emitirAlerta24Horas = function (alertaData) {
    const alertas = obtenerAlertas();
    const nuevaAlerta = {
      id: 'alt-' + Date.now(),
      titulo: alertaData.titulo || 'Alerta del Sistema',
      subtitulo: alertaData.subtitulo || 'Incidencia detectada por telemetría.',
      tiempoTexto: 'Hace un momento',
      tipo: alertaData.tipo || 'geocerca',
      color: alertaData.color || 'red',
      icono: alertaData.icono || 'fas fa-exclamation-triangle',
      badgeTexto: alertaData.badgeTexto || 'Pendiente',
      badgeClase: alertaData.badgeClase || 'badge-pendiente',
      estado: alertaData.estado || 'pendiente',
      rango: '24h',
      ts: Date.now(),
      coordenadas: alertaData.coordenadas || null,
      ubicacion: alertaData.ubicacion || 'Cartagena de Indias',
      descripcion: alertaData.descripcion || 'Incidencia generada automáticamente por el monitor 24/7.'
    };

    // Se guarda en Supabase con el id del paciente; los demas equipos la reciben en tiempo real
    if (window.DiaMonDatos && window.DiaMonDatos.pacienteId()) {
      window.DiaMonDatos.guardarAlerta(nuevaAlerta).then(guardada => {
        nuevaAlerta.id = guardada.id;
      }).catch(err => console.warn('No se pudo guardar la alerta en Supabase:', err));
    }
    alertas.unshift(nuevaAlerta);
    actualizarBadgesContadores();
    window.renderizarAlertasDiaMon();

    // Alarma sonora y notificación del sistema
    reproducirAlarmaAudio(nuevaAlerta.tipo);
    enviarNotificacionNativa(`⚠️ DiaMon: ${nuevaAlerta.titulo}`, nuevaAlerta.subtitulo);

    if (window.mostrarNotificacion) {
      window.mostrarNotificacion(`🔔 Nueva alerta: ${nuevaAlerta.titulo}`, 'warn');
    }
  };

  // Verificación continua de geocerca con el GPS en vivo
  // Escuchar posición viva de telemetría
  function iniciarLoopMonitoreo24h() {
    setInterval(() => {
      // La salida de zona segura la revisa caso-estudio.js con las zonas del paciente

      // Monitoreo de batería baja
      if (window.TelemetriaDiaMon && window.TelemetriaDiaMon.bateria) {
        const bat = window.TelemetriaDiaMon.bateria;
        if (bat.disponible && bat.nivel <= 15 && !bat.cargando && !window._alertaBateriaEnviada) {
          window._alertaBateriaEnviada = true;
          window.emitirAlerta24Horas({
            titulo: 'Batería baja en sensor',
            subtitulo: `Nivel crítico (${bat.nivel}%). Conecta el cargador.`,
            tipo: 'sistema',
            color: 'amber',
            icono: 'fas fa-battery-quarter',
            badgeTexto: 'Aviso',
            badgeClase: 'badge-aviso'
          });
        }
      }
    }, 20000);
  }

  // Renderizado visual
  window.renderizarAlertasDiaMon = function () {
    const containers = [
      document.getElementById('alertsList'),
      document.getElementById('alertsListSecurity')
    ].filter(Boolean);

    if (containers.length === 0) return;

    const alertas = obtenerAlertas();
    let filtradas = alertas;

    if (filtroRangoActual === '24h') {
      filtradas = alertas.filter(a => a.rango === '24h' || (Date.now() - (a.ts || 0)) <= 24 * 3600000);
    }

    let rowsHtml = '';
    if (filtradas.length === 0) {
      rowsHtml = `
        <div style="padding: 40px 20px; text-align: center; color: #64748b;">
          <i class="fas fa-shield-alt" style="font-size: 36px; color: #16a34a; margin-bottom: 12px; display: block;"></i>
          <p style="font-size: 15px; font-weight: 600; color: #1e293b; margin: 0 0 4px 0;">No hay alertas en este periodo</p>
          <span style="font-size: 13px;">Todos los recorridos de Cartagena y mediciones se encuentran estables.</span>
        </div>
      `;
    } else {
      filtradas.forEach(alerta => {
        rowsHtml += `
          <div class="dm-alert-row" onclick="window.abrirDetalleAlerta('${alerta.id}')" role="button" tabindex="0" aria-label="${alerta.titulo}: ${alerta.subtitulo}">
            <div class="dm-alert-left">
              <div class="dm-alert-icon-circle ${alerta.color}">
                <i class="${alerta.icono}"></i>
              </div>
              <div class="dm-alert-text">
                <div class="dm-alert-title">${alerta.titulo}</div>
                <div class="dm-alert-subtitle">${alerta.subtitulo}</div>
              </div>
            </div>

            <div class="dm-alert-right">
              <div class="dm-alert-time">${alerta.tiempoTexto}</div>
              <div class="dm-alert-badge ${alerta.badgeClase}">${alerta.badgeTexto}</div>
            </div>
          </div>
        `;
      });
    }

    containers.forEach(c => {
      c.innerHTML = rowsHtml;
    });

    actualizarBadgesContadores();
  };

  // Dropdown de filtros
  window.toggleDropdownFiltroAlertas = function (e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('menuFiltroDias');
    const btn = document.getElementById('btnFiltroDias');
    if (!menu) return;

    const isOpen = menu.style.display === 'flex';
    menu.style.display = isOpen ? 'none' : 'flex';
    if (btn) btn.classList.toggle('active', !isOpen);
  };

  window.seleccionarFiltroRango = function (rango, etiqueta) {
    filtroRangoActual = rango;
    const label = document.getElementById('filtroDiasLabel');
    if (label) label.textContent = etiqueta;

    document.querySelectorAll('.dm-dropdown-item').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.trim() === etiqueta);
    });

    const menu = document.getElementById('menuFiltroDias');
    if (menu) menu.style.display = 'none';
    const btn = document.getElementById('btnFiltroDias');
    if (btn) btn.classList.remove('active');

    window.renderizarAlertasDiaMon();
  };

  document.addEventListener('click', (e) => {
    const wrapper = document.querySelector('.dm-alerts-dropdown-wrapper');
    const menu = document.getElementById('menuFiltroDias');
    const btn = document.getElementById('btnFiltroDias');
    if (menu && wrapper && !wrapper.contains(e.target)) {
      menu.style.display = 'none';
      if (btn) btn.classList.remove('active');
    }
  });

  // Modal de detalle
  window.abrirDetalleAlerta = function (id) {
    const alertas = obtenerAlertas();
    const alerta = alertas.find(a => String(a.id) === String(id));
    if (!alerta) return;

    const previo = document.getElementById('dmAlertModalDetail');
    if (previo) previo.remove();

    const modal = document.createElement('div');
    modal.id = 'dmAlertModalDetail';
    modal.className = 'dm-alert-modal-overlay';
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };

    modal.innerHTML = `
      <div class="dm-alert-modal-card">
        <button class="dm-alert-modal-close" onclick="document.getElementById('dmAlertModalDetail').remove()" title="Cerrar">
          <i class="fas fa-times"></i>
        </button>

        <div class="dm-alert-modal-header">
          <div class="dm-alert-icon-circle ${alerta.color}">
            <i class="${alerta.icono}"></i>
          </div>
          <div>
            <h3 style="font-size:18px; font-weight:800; color:#0f172a; margin:0 0 4px 0;">${alerta.titulo}</h3>
            <span class="dm-alert-badge ${alerta.badgeClase}">${alerta.badgeTexto}</span>
          </div>
        </div>

        <div class="dm-alert-modal-body">
          <p>${alerta.descripcion}</p>

          <div class="dm-alert-modal-meta">
            <div><i class="far fa-clock"></i> <strong>Momento:</strong> ${alerta.tiempoTexto}</div>
            ${alerta.ubicacion ? `<div><i class="fas fa-map-marker-alt"></i> <strong>Lugar:</strong> ${alerta.ubicacion}</div>` : ''}
            <div><i class="fas fa-satellite"></i> <strong>Protocolo 24/7:</strong> Satélites GPS & Sensor Biomédico</div>
          </div>

          <div class="dm-alert-modal-actions">
            ${alerta.coordenadas ? `
              <button class="dm-btn-modal-primary" onclick="window.verAlertaEnMapa(${alerta.coordenadas.lat}, ${alerta.coordenadas.lng}, '${alerta.titulo}')">
                <i class="fas fa-map-marked-alt"></i> Ver en Mapa GPS
              </button>
            ` : `
              <button class="dm-btn-modal-primary" onclick="window.marcarAlertaAtendida('${alerta.id}')">
                <i class="fas fa-check-circle"></i> Marcar como Atendida
              </button>
            `}
            <button class="dm-btn-modal-secondary" onclick="document.getElementById('dmAlertModalDetail').remove()">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  };

  window.verAlertaEnMapa = function (lat, lng, titulo) {
    const modal = document.getElementById('dmAlertModalDetail');
    if (modal) modal.remove();

    if (typeof window.switchView === 'function') {
      window.switchView('mapa');
    }

    setTimeout(() => {
      if (window.actualizarMarcadorUbicacionReal) {
        window.actualizarMarcadorUbicacionReal(lat, lng, 10);
      }
      if (window.mapInstance) {
        window.mapInstance.setView([lat, lng], 16, { animate: true });
      }
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion(`📍 Visualizando punto de alerta: ${titulo}`, 'info');
      }
    }, 300);
  };

  // Alerta creada en otro equipo (por ejemplo el SOS del celular del paciente): suena y avisa aqui
  window.alertaNuevaRecibida = function (fila) {
    if (alertasCache.some(a => String(a.id) === String(fila.id))) return;
    const a = window.DiaMonDatos.aAlerta(fila);
    reproducirAlarmaAudio(a.tipo);
    enviarNotificacionNativa(`⚠️ DiaMon: ${a.titulo}`, a.subtitulo);
    if (window.mostrarNotificacion) window.mostrarNotificacion(`🔔 Nueva alerta: ${a.titulo}`, 'warn');
  };

  window.marcarAlertaAtendida = function (id) {
    const alertas = obtenerAlertas();
    const alerta = alertas.find(a => String(a.id) === String(id));
    if (alerta) {
      if (window.DiaMonDatos) window.DiaMonDatos.cambiarEstadoAlerta(alerta.id).catch(() => {});
      alerta.badgeTexto = 'Confirmada';
      alerta.badgeClase = 'badge-confirmada';
      alerta.estado = 'confirmada';
      alerta.color = 'green';
      alerta.icono = 'fas fa-check';
      actualizarBadgesContadores();
      window.renderizarAlertasDiaMon();
    }
    const modal = document.getElementById('dmAlertModalDetail');
    if (modal) modal.remove();
    if (window.mostrarNotificacion) {
      window.mostrarNotificacion('✓ Incidencia atendida con éxito.', 'success');
    }
  };

  // Inicialización global
  document.addEventListener('DOMContentLoaded', () => {
    initServiceWorker();
    window.renderizarAlertasDiaMon();
    iniciarLoopMonitoreo24h();
  });
})();
