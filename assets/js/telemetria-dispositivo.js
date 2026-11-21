/**
 * DiaMon — Telemetría en Tiempo Real del Dispositivo
 * 1. Batería en tiempo real (Battery Status API)
 * 2. Ubicación GPS en vivo (Geolocation API con watchPosition + Geocodificación Inversa Nominatim)
 * 3. Podómetro con Reinicio Automático cada 24 horas (Medianoche 00:00:00 / DeviceMotion API)
 */

(function () {
  'use strict';

  // Almacén de estado de telemetría
  const Telemetria = {
    bateria: { nivel: 87, cargando: false, disponible: false },
    ubicacion: { lat: 10.3910, lng: -75.4794, precision: 15, zona: 'Obteniendo GPS...', fijado: false },
    pasos: 0,
    pasosFecha: '',
    watchId: null,
    gpsFijado: false
  };

  // Cache de geocodificación para evitar llamadas redundantes
  const geocodingCache = new Map();

  document.addEventListener('DOMContentLoaded', () => {
    initBateriaEnTiempoReal();
    initUbicacionEnTiempoReal();
    initPodometro24Horas();
  });

  // ============================================================
  // 1. BATERÍA EN TIEMPO REAL
  // ============================================================
  function initBateriaEnTiempoReal() {
    const batEl = document.getElementById('kpiBateriaVal');
    const batBadge = document.getElementById('kpiBateriaBadge');

    function actualizarUI(nivel, cargando) {
      if (batEl) {
        batEl.innerHTML = `${nivel}% ${cargando ? '<i class="fas fa-bolt" style="color:#eab308; font-size:16px;"></i>' : ''}`;
      }
      if (batBadge) {
        if (cargando) {
          batBadge.className = 'dc-kpi-badge info';
          batBadge.innerHTML = '<i class="fas fa-charging-station"></i> Cargando';
        } else if (nivel > 50) {
          batBadge.className = 'dc-kpi-badge success';
          batBadge.innerHTML = '<i class="fas fa-check-circle"></i> Óptima';
        } else if (nivel > 20) {
          batBadge.className = 'dc-kpi-badge warn';
          batBadge.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Media';
        } else {
          batBadge.className = 'dc-kpi-badge danger';
          batBadge.innerHTML = '<i class="fas fa-battery-empty"></i> Batería baja';
        }
      }
    }

    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        Telemetria.bateria.disponible = true;
        Telemetria.bateria.nivel = Math.round(battery.level * 100);
        Telemetria.bateria.cargando = battery.charging;

        actualizarUI(Telemetria.bateria.nivel, Telemetria.bateria.cargando);

        battery.addEventListener('levelchange', () => {
          Telemetria.bateria.nivel = Math.round(battery.level * 100);
          actualizarUI(Telemetria.bateria.nivel, Telemetria.bateria.cargando);
        });

        battery.addEventListener('chargingchange', () => {
          Telemetria.bateria.cargando = battery.charging;
          actualizarUI(Telemetria.bateria.nivel, Telemetria.bateria.cargando);
        });
      }).catch(() => {
        actualizarUI(Telemetria.bateria.nivel, false);
      });
    } else {
      actualizarUI(Telemetria.bateria.nivel, false);
    }
  }

  // ============================================================
  // 2. UBICACIÓN GPS EN TIEMPO REAL CON GEOCODIFICACIÓN INVERSA
  // ============================================================

  // Estimador local enriquecido de zonas de Cartagena y Colombia (fallback ultrarrápido)
  function estimarZonaLocal(lat, lng) {
    if (lat >= 10.415 && lat <= 10.435 && lng >= -75.560 && lng <= -75.540) return 'Centro Histórico, Cartagena';
    if (lat >= 10.380 && lat <= 10.410 && lng >= -75.565 && lng <= -75.545) return 'Bocagrande, Cartagena';
    if (lat >= 10.395 && lat <= 10.415 && lng >= -75.560 && lng <= -75.545) return 'El Laguito, Cartagena';
    if (lat >= 10.400 && lat <= 10.420 && lng >= -75.545 && lng <= -75.525) return 'Manga, Cartagena';
    if (lat >= 10.420 && lat <= 10.435 && lng >= -75.540 && lng <= -75.520) return 'Pie de la Popa, Cartagena';
    if (lat >= 10.430 && lat <= 10.450 && lng >= -75.530 && lng <= -75.500) return 'Crespo, Cartagena';
    if (lat >= 10.420 && lat <= 10.440 && lng >= -75.545 && lng <= -75.530) return 'El Cabrero, Cartagena';
    if (lat >= 10.380 && lat <= 10.405 && lng >= -75.510 && lng <= -75.470) return 'San Fernando, Cartagena';
    if (lat >= 10.385 && lat <= 10.405 && lng >= -75.515 && lng <= -75.490) return 'Zarzagocilla, Cartagena';
    if (lat >= 10.370 && lat <= 10.400 && lng >= -75.490 && lng <= -75.450) return 'El Pozón, Cartagena';
    if (lat >= 10.380 && lat <= 10.410 && lng >= -75.530 && lng <= -75.500) return 'Los Caracoles, Cartagena';
    if (lat >= 10.300 && lat <= 10.360 && lng >= -75.460 && lng <= -75.400) return 'Turbaco, Bolívar';

    // Región general de Cartagena
    if (lat >= 10.25 && lat <= 10.55 && lng >= -75.65 && lng <= -75.35) {
      return 'Cartagena de Indias';
    }
    return `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
  }

  // Geocodificación inversa real mediante OpenStreetMap Nominatim
  async function obtenerNombreGeografico(lat, lng) {
    const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    if (geocodingCache.has(key)) {
      return geocodingCache.get(key);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
        {
          signal: controller.signal,
          headers: { 'Accept-Language': 'es,es-CO;q=0.9,en;q=0.5' }
        }
      );
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        if (data && data.address) {
          const a = data.address;
          const barrio = a.suburb || a.neighbourhood || a.quarter || a.residential || a.city_district || a.road || '';
          const ciudad = a.city || a.town || a.municipality || a.village || a.county || '';

          let resultado = '';
          if (barrio && ciudad) {
            resultado = `${barrio}, ${ciudad}`;
          } else if (barrio) {
            resultado = `${barrio}, Cartagena`;
          } else if (ciudad) {
            resultado = ciudad;
          } else if (data.name) {
            resultado = data.name;
          }

          if (resultado) {
            geocodingCache.set(key, resultado);
            return resultado;
          }
        }
      }
    } catch (_) {
      // Si falla Nominatim, recurrir al estimador local
    }

    const fallback = estimarZonaLocal(lat, lng);
    geocodingCache.set(key, fallback);
    return fallback;
  }

  function initUbicacionEnTiempoReal() {
    const ubicEl = document.getElementById('kpiUbicacionVal');
    const ubicBadge = document.getElementById('kpiUbicacionBadge');
    const etaBadge = document.querySelector('.dc-map-badge-eta span');

    async function aplicarPosicionGPS(latitude, longitude, accuracy) {
      Telemetria.ubicacion.lat = latitude;
      Telemetria.ubicacion.lng = longitude;
      Telemetria.ubicacion.precision = Math.round(accuracy || 10);
      Telemetria.gpsFijado = true;

      // Actualizar badge GPS
      if (ubicBadge) {
        ubicBadge.className = 'dc-kpi-badge success';
        ubicBadge.innerHTML = `<i class="fas fa-circle" style="font-size:6px; color:#16a34a;"></i> GPS en vivo (±${Telemetria.ubicacion.precision}m)`;
      }

      // Geocodificación inversa para nombre legible
      const zona = await obtenerNombreGeografico(latitude, longitude);
      Telemetria.ubicacion.zona = zona;

      if (ubicEl) {
        ubicEl.textContent = zona;
        ubicEl.title = `${zona} · Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`;
      }
      if (etaBadge) {
        etaBadge.textContent = `Ubicación en vivo · ${zona}`;
      }

      // Sincronizar en sesión de usuario si está logueado
      try {
        const sesionUser = sessionStorage.getItem('diamon_demo_user');
        if (sesionUser) {
          const userObj = JSON.parse(sesionUser);
          if (userObj && userObj.rol !== 'admin') {
            userObj.ubicacion = zona;
            sessionStorage.setItem('diamon_demo_user', JSON.stringify(userObj));
          }
        }
      } catch (_) {}

      // Actualizar marcador y círculo en el mapa Leaflet
      if (typeof window.actualizarMarcadorUbicacionReal === 'function') {
        window.actualizarMarcadorUbicacionReal(latitude, longitude, accuracy);
      }
    }

    // Fallback por IP en caso de que el navegador no tenga hardware GPS o esté bloqueado
    async function fallbackPorIP() {
      if (Telemetria.gpsFijado) return;
      try {
        const resp = await fetch('https://ipapi.co/json/');
        if (resp.ok) {
          const d = await resp.json();
          if (d && d.latitude && d.longitude && !Telemetria.gpsFijado) {
            const lat = parseFloat(d.latitude);
            const lng = parseFloat(d.longitude);
            const zona = [d.city, d.region].filter(Boolean).join(', ') || 'Cartagena de Indias';

            Telemetria.ubicacion.lat = lat;
            Telemetria.ubicacion.lng = lng;
            Telemetria.ubicacion.zona = zona;
            Telemetria.ubicacion.precision = 300;

            if (ubicEl && !Telemetria.gpsFijado) {
              ubicEl.textContent = zona;
              ubicEl.title = `${zona} (Aprox. por Red)`;
            }
            if (ubicBadge && !Telemetria.gpsFijado) {
              ubicBadge.className = 'dc-kpi-badge info';
              ubicBadge.innerHTML = '<i class="fas fa-network-wired"></i> Red aproximada';
            }
            if (typeof window.actualizarMarcadorUbicacionReal === 'function' && !Telemetria.gpsFijado) {
              window.actualizarMarcadorUbicacionReal(lat, lng, 300);
            }
          }
        }
      } catch (_) {}
    }

    // Iniciar captura GPS nativa
    if ('geolocation' in navigator) {
      if (ubicBadge) {
        ubicBadge.className = 'dc-kpi-badge info';
        ubicBadge.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size:8px;"></i> Buscando GPS...';
      }

      // Obtener posición inmediata
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          aplicarPosicionGPS(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        },
        (err) => {
          console.warn('GPS inmediato inicial:', err.message);
          fallbackPorIP();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      // Mantener seguimiento continuo en tiempo real
      Telemetria.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          aplicarPosicionGPS(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        },
        (err) => {
          console.warn('GPS continuo:', err.message);
          if (!Telemetria.gpsFijado) fallbackPorIP();
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
    } else {
      fallbackPorIP();
    }

    // Función manual invocable desde la UI para refrescar GPS al instante
    window.actualizarUbicacionGPSManual = function () {
      const syncIcon = document.getElementById('gpsSyncIcon');
      if (syncIcon) syncIcon.classList.add('fa-spin');

      if (ubicBadge) {
        ubicBadge.className = 'dc-kpi-badge info';
        ubicBadge.innerHTML = '<i class="fas fa-satellite fa-spin"></i> Conectando...';
      }

      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (syncIcon) syncIcon.classList.remove('fa-spin');
            aplicarPosicionGPS(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
            if (window.mostrarNotificacion) {
              window.mostrarNotificacion('📍 Ubicación en tiempo real actualizada con éxito.', 'success');
            }
          },
          (err) => {
            if (syncIcon) syncIcon.classList.remove('fa-spin');
            console.warn('GPS Manual:', err.message);
            fallbackPorIP();
            if (window.mostrarNotificacion) {
              window.mostrarNotificacion('⚠️ Señal GPS débil: Verificando red local.', 'warn');
            }
          },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
      } else {
        if (syncIcon) syncIcon.classList.remove('fa-spin');
        fallbackPorIP();
      }
    };
  }

  // ============================================================
  // 3. PODÓMETRO CON REINICIO ESTRICTO CADA 24 HORAS
  // ============================================================
  function initPodometro24Horas() {
    const pasosEl = document.getElementById('kpiPasosVal');
    const pasosBadge = document.getElementById('kpiPasosBadge');

    function obtenerFechaHoy() {
      // YYYY-MM-DD en hora local
      return new Date().toLocaleDateString('en-CA');
    }

    function guardarHistorialDia(fecha, pasos) {
      if (!fecha || pasos <= 0) return;
      try {
        let historial = [];
        const raw = localStorage.getItem('diamon_historial_pasos');
        if (raw) historial = JSON.parse(raw);
        historial = historial.filter(item => item.fecha !== fecha);
        historial.unshift({ fecha, pasos, guardadoEn: new Date().toISOString() });
        // Mantener últimos 30 días
        if (historial.length > 30) historial = historial.slice(0, 30);
        localStorage.setItem('diamon_historial_pasos', JSON.stringify(historial));
      } catch (_) {}
    }

    function renderPasos() {
      if (pasosEl) pasosEl.textContent = Telemetria.pasos.toLocaleString();
      if (pasosBadge) {
        pasosBadge.innerHTML = '<i class="fas fa-history"></i> Reinicio 24h';
        pasosBadge.title = `Pasos acumulados hoy (${Telemetria.pasosFecha}). Se reinician automáticamente a medianoche.`;
      }
    }

    // Verificar si cambió el día (ciclo de 24 horas)
    function verificarCiclo24Horas() {
      const hoy = obtenerFechaHoy();
      const fechaGuardada = localStorage.getItem('diamon_pasos_fecha');

      if (!fechaGuardada) {
        // Primera vez en el sistema: comienza en 0 pasos para el día actual
        Telemetria.pasos = 0;
        Telemetria.pasosFecha = hoy;
        localStorage.setItem('diamon_pasos_fecha', hoy);
        localStorage.setItem('diamon_pasos_hoy', '0');
      } else if (fechaGuardada !== hoy) {
        // ¡Han pasado 24 horas o cambió el día!
        const pasosAyer = parseInt(localStorage.getItem('diamon_pasos_hoy') || '0', 10);
        guardarHistorialDia(fechaGuardada, pasosAyer);

        // Reinicio estricto a 0
        Telemetria.pasos = 0;
        Telemetria.pasosFecha = hoy;
        localStorage.setItem('diamon_pasos_fecha', hoy);
        localStorage.setItem('diamon_pasos_hoy', '0');

        console.log(`[DiaMon Podómetro] Ciclo de 24h cumplido. Pasos reiniciados a 0 para el día ${hoy}.`);
      } else {
        // Mismo día: recuperar pasos acumulados de hoy (base 0)
        let guardados = parseInt(localStorage.getItem('diamon_pasos_hoy') || '0', 10);
        if (isNaN(guardados) || guardados < 0) guardados = 0;
        Telemetria.pasos = guardados;
        Telemetria.pasosFecha = hoy;
      }

      renderPasos();
    }

    // Programar reinicio exacto a las 00:00:00 (medianoche)
    function programarReinicioMedianoche() {
      const ahora = new Date();
      // Medianoche siguiente: 00:00:01 del día de mañana
      const manana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1, 0, 0, 1);
      const msHastaMedianoche = manana.getTime() - ahora.getTime();

      setTimeout(() => {
        verificarCiclo24Horas();
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion('🕛 Medianoche: Podómetro reiniciado a 0 pasos para el nuevo día.', 'info');
        }
        // Programar el siguiente ciclo continuo de 24 horas (86,400,000 ms)
        setInterval(() => {
          verificarCiclo24Horas();
          if (window.mostrarNotificacion) {
            window.mostrarNotificacion('🕛 Medianoche: Podómetro reiniciado a 0 pasos para el nuevo día.', 'info');
          }
        }, 24 * 60 * 60 * 1000);
      }, msHastaMedianoche);
    }

    // Inicializar estado del podómetro
    verificarCiclo24Horas();
    programarReinicioMedianoche();

    // Verificación periódica por si el celular entra en suspensión o reposo durante la medianoche
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        verificarCiclo24Horas();
      }
    });
    setInterval(verificarCiclo24Horas, 30000);

    // Detección de pasos con acelerómetro de dispositivo móvil (DeviceMotionEvent)
    let lastMag = 0;
    let stepCooldown = false;

    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', (e) => {
        const acc = e.accelerationIncludingGravity || e.acceleration;
        if (!acc || acc.x === null) return;

        const x = acc.x || 0;
        const y = acc.y || 0;
        const z = acc.z || 0;
        const mag = Math.sqrt(x * x + y * y + z * z);

        // Umbral de paso humano estándar
        if (!stepCooldown && mag > 12.2 && (mag - lastMag) > 3.0) {
          stepCooldown = true;
          verificarCiclo24Horas(); // Asegurar fecha correcta antes de sumar
          Telemetria.pasos += 1;
          localStorage.setItem('diamon_pasos_hoy', Telemetria.pasos);
          renderPasos();

          setTimeout(() => {
            stepCooldown = false;
          }, 350); // Cooldown entre pasos para evitar rebotes
        }
        lastMag = mag;
      });
    }

    // Funciones globales expuestas para pruebas y reinicio manual
    window.simularPasoEnPC = function (cantidad = 10) {
      verificarCiclo24Horas();
      Telemetria.pasos += cantidad;
      localStorage.setItem('diamon_pasos_hoy', Telemetria.pasos);
      renderPasos();
    };

    window.reiniciarPasosManual24h = function () {
      const hoy = obtenerFechaHoy();
      Telemetria.pasos = 0;
      Telemetria.pasosFecha = hoy;
      localStorage.setItem('diamon_pasos_fecha', hoy);
      localStorage.setItem('diamon_pasos_hoy', '0');
      renderPasos();
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion('🔄 Podómetro reiniciado manualmente a 0 pasos.', 'info');
      }
    };
  }

  // Exportar al ámbito global
  window.TelemetriaDiaMon = Telemetria;
})();
