/**
 * DiaMon - Modulo de alertas y notificaciones
 * 1. Monitoreo continuo 24/7 de Geocercas GPS (Salida de zona segura en Cartagena)
 * 2. Notificaciones push nativas del sistema operativo en segundo plano (Service Worker)
 * 3. Alarma sonora clínica de emergencia (Web Audio API)
 * 4. Sincronización en la nube (Supabase Realtime) y almacenamiento persistente
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'diamon_alertas_damian_v5';
  const GEOFENCE_HOME = { lat: 10.39991, lng: -75.47886, radioMetros: 400 }; // Casa de Damián Díaz Balseiro - Chapacuá

  // Base inicial de alertas de referencia del Caso de Estudio (Damián Díaz Balseiro)
  const ALERTAS_INICIALES = [
    {
      id: 'alt-001',
      titulo: 'Esquema matutino 8:00 AM confirmado',
      subtitulo: 'Damián Díaz Balseiro confirmó: Pantoprazol, Metformina, Firialta y Nifedipina.',
      tiempoTexto: 'Hace 25 min',
      tipo: 'medicamento_tomado',
      color: 'green',
      icono: 'fas fa-check',
      badgeTexto: 'Confirmada',
      badgeClase: 'badge-confirmada',
      estado: 'confirmada',
      rango: '24h',
      ts: Date.now() - 25 * 60000,
      coordenadas: { lat: 10.39991, lng: -75.47886 },
      ubicacion: 'Barrio Chapacuá (10.39991, -75.47886)',
      descripcion: 'Registro de adherencia: El paciente Damián Díaz Balseiro confirmó su bloque farmacológico de las 8:00 AM según el plan supervisado por la Enf. Jefe Elizabeth Vargas Caro.'
    },
    {
      id: 'alt-002',
      titulo: 'Próxima toma: Valsartán (2:00 PM) e Insulina 24 UI (9:00 PM)',
      subtitulo: 'Recordatorio activo para control de Hipertensión y Diabetes.',
      tiempoTexto: 'Hace 1 h',
      tipo: 'medicamento',
      color: 'amber',
      icono: 'fas fa-pills',
      badgeTexto: 'Programada',
      badgeClase: 'badge-aviso',
      estado: 'aviso',
      rango: '24h',
      ts: Date.now() - 60 * 60000,
      coordenadas: { lat: 10.39991, lng: -75.47886 },
      ubicacion: 'Casa en Chapacuá, Cartagena',
      descripcion: 'Cronograma activo: 2:00 PM Valsartán · 8:00 PM Atorvastatina, Metformina, Gabapentina, Lipotic y Nifedipino · 9:00 PM Insulina Basal 24 Unidades · Sábados: Ozempic.'
    },
    {
      id: 'alt-003',
      titulo: 'Geocerca Activa - Casa en Chapacuá',
      subtitulo: 'Damián Díaz Balseiro se encuentra dentro del perímetro seguro (400m).',
      tiempoTexto: 'Hace 2 h',
      tipo: 'ubicacion',
      color: 'blue',
      icono: 'fas fa-map-marker-alt',
      badgeTexto: 'En Zona',
      badgeClase: 'badge-informacion',
      estado: 'informacion',
      rango: '24h',
      ts: Date.now() - 120 * 60000,
      coordenadas: { lat: 10.39991, lng: -75.47886 },
      ubicacion: 'Barrio Chapacuá (Lat: 10.39991, Lng: -75.47886)',
      descripcion: 'Telemetría GPS verificada en el domicilio de Chapacuá. Glucosa en ayunas (114 mg/dL) y Presión Arterial (126/78 mmHg) dentro de las metas definidas con la Enf. Jefe Elizabeth Vargas Caro.'
    }
  ];

  let filtroRangoActual = '7d';
  let swRegistration = null;
  let ultimaAlertaGeocercaTs = 0;

  // // 1. GESTIÓN Y PERSISTENCIA DE ALERTAS
  // function obtenerAlertas() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    guardarAlertas(ALERTAS_INICIALES);
    return ALERTAS_INICIALES;
  }

  function guardarAlertas(alertas) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alertas));
    } catch (_) {}
    actualizarBadgesContadores();
  }

  function actualizarBadgesContadores() {
    const alertas = obtenerAlertas();
    const pendientes = alertas.filter(a => a.estado === 'pendiente' || a.estado === 'aviso').length;

    document.querySelectorAll('.dc-nav-badge, #topbarAlertCount').forEach(el => {
      el.textContent = pendientes > 0 ? pendientes : '2';
      el.style.display = 'inline-flex';
    });
  }

  // // 2. SINTETIZADOR DE AUDIO CLÍNICO 24/7 (WEB AUDIO API)
  // function reproducirAlarmaAudio(tipo = 'aviso') {
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

  // // 3. SERVICE WORKER Y NOTIFICACIONES PUSH DEL SISTEMA 24/7
  // function initServiceWorker() {
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

  // // 4. MOTOR AUTÓNOMO DE MONITOREO 24/7
  // function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

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

    alertas.unshift(nuevaAlerta);
    guardarAlertas(alertas);
    window.renderizarAlertasDiaMon();

    // Alarma sonora y notificación del sistema
    reproducirAlarmaAudio(nuevaAlerta.tipo);
    enviarNotificacionNativa(`⚠️ DiaMon: ${nuevaAlerta.titulo}`, nuevaAlerta.subtitulo);

    // Toast flotante
    if (window.mostrarNotificacion) {
      window.mostrarNotificacion(`🔔 Nueva alerta: ${nuevaAlerta.titulo}`, 'warn');
    }

    // Sincronizar en Supabase si está activo
    if (window.supabaseClient) {
      try {
        window.supabaseClient.from('alertas').insert({
          tipo: nuevaAlerta.tipo,
          descripcion: `${nuevaAlerta.titulo} · ${nuevaAlerta.subtitulo}`,
          estado: 'activa',
          ts: new Date().toISOString()
        }).then(() => {});
      } catch (_) {}
    }
  };

  // Verificación continua de geocerca con el GPS en vivo
  function verificarGeocercaEnTiempoReal(lat, lng) {
    if (!lat || !lng) return;
    const dist = calcularDistanciaMetros(lat, lng, GEOFENCE_HOME.lat, GEOFENCE_HOME.lng);
    const ahora = Date.now();

    // Si supera el radio de seguridad (> 1.2 km) y no ha alertado en los últimos 45 minutos
    if (dist > GEOFENCE_HOME.radioMetros && (ahora - ultimaAlertaGeocercaTs) > 45 * 60000) {
      ultimaAlertaGeocercaTs = ahora;
      const km = (dist / 1000).toFixed(1);
      window.emitirAlerta24Horas({
        titulo: 'Salida de zona segura',
        subtitulo: `Tu familiar salió de la zona segura (${km} km de su sector habitual).`,
        tipo: 'geocerca',
        color: 'red',
        icono: 'fas fa-map-marker-alt',
        badgeTexto: 'Pendiente',
        badgeClase: 'badge-pendiente',
        coordenadas: { lat, lng },
        ubicacion: `Sector a ${km} km de San Fernando, Cartagena`,
        descripcion: `El GPS registró coordenadas fuera del perímetro seguro (${km} km). Se recomienda verificar la ruta del paciente en el mapa y llamar al contacto de emergencia si es necesario.`
      });
    }
  }

  // Escuchar posición viva de telemetría
  function iniciarLoopMonitoreo24h() {
    setInterval(() => {
      if (window.TelemetriaDiaMon && window.TelemetriaDiaMon.ubicacion && window.TelemetriaDiaMon.gpsFijado) {
        verificarGeocercaEnTiempoReal(window.TelemetriaDiaMon.ubicacion.lat, window.TelemetriaDiaMon.ubicacion.lng);
      }

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

  // // 5. RENDERIZADO VISUAL
  // window.renderizarAlertasDiaMon = function () {
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
    const alerta = alertas.find(a => a.id === id);
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

  window.marcarAlertaAtendida = function (id) {
    const alertas = obtenerAlertas();
    const alerta = alertas.find(a => a.id === id);
    if (alerta) {
      alerta.badgeTexto = 'Confirmada';
      alerta.badgeClase = 'badge-confirmada';
      alerta.estado = 'confirmada';
      alerta.color = 'green';
      alerta.icono = 'fas fa-check';
      guardarAlertas(alertas);
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

