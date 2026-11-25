/**
 * DiaMon — Centro de Configuración Funcional
 * Conecta la vista #view-configuracion con:
 *   1. Ficha del paciente, cuidador, código de vinculación y contacto SOS (caso-estudio + QR)
 *   2. Metas clínicas (glucosa/presión) y geocerca GPS en vivo (Leaflet + alertas-sistema)
 *   3. Línea base y temporizador del Monitor Wearable Sin Parche (monitoreo-preventivo-wearable)
 *   4. Preferencias persistentes de audio, lectura por voz, escucha API wearable y Push 24/7
 *   5. Accesibilidad clínica (accesibilidad.js) y preferencia de panel izquierdo compacto
 *   6. Respaldo real en JSON y restablecimiento controlado de datos locales
 */
(function () {
  'use strict';

  const PREFS_KEY = 'diamon_config_prefs_v1';
  const SIDEBAR_KEY = 'diamon_sidebar_collapsed';
  const WEARABLE_BASELINE_KEY = 'diamon_wearable_baseline_v1';

  const DEFAULT_PREFS = {
    sonidoAlertas: true,
    vozAlertas: true,
    autoEscuchaWearable: false
  };

  function leerJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return fallback;
  }

  function guardarJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {}
  }

  function notificar(msg, tipo = 'success') {
    if (typeof window.mostrarNotificacion === 'function') {
      window.mostrarNotificacion(msg, tipo);
    }
  }

  class ConfiguracionSistemaController {
    constructor() {
      this.prefs = { ...DEFAULT_PREFS, ...leerJSON(PREFS_KEY, {}) };
      guardarJSON(PREFS_KEY, this.prefs);
      this._inicializado = false;
    }

    obtenerPrefs() {
      this.prefs = { ...DEFAULT_PREFS, ...leerJSON(PREFS_KEY, {}) };
      return { ...this.prefs };
    }

    guardarPrefs(patch) {
      this.prefs = { ...this.obtenerPrefs(), ...patch };
      guardarJSON(PREFS_KEY, this.prefs);
      this.aplicarPrefsEnModulos();
      this.actualizarHeroYContadores();
      return this.prefs;
    }

    aplicarPrefsEnModulos() {
      const prefs = this.obtenerPrefs();
      if (window.monitoreoWearable) {
        window.monitoreoWearable.audioSilenciado = !prefs.sonidoAlertas;
      }
    }

    init() {
      if (this._inicializado) {
        this.sincronizarUI();
        return;
      }
      this._inicializado = true;

      this.bindEventos();
      this.aplicarPrefsEnModulos();
      this.sincronizarUI();

      // Si el usuario activó escucha automática del reloj por API, encenderla
      if (this.prefs.autoEscuchaWearable && window.monitoreoWearable && !window.monitoreoWearable.escuchaApiActiva) {
        setTimeout(() => {
          if (window.monitoreoWearable && !window.monitoreoWearable.escuchaApiActiva) {
            window.monitoreoWearable.toggleEscuchaApiReloj();
          }
        }, 800);
      }
    }

    bindEventos() {
      const formPaciente = document.getElementById('cfgFormPaciente');
      if (formPaciente) {
        formPaciente.addEventListener('submit', (e) => this.guardarDatosPaciente(e));
      }

      const formClinico = document.getElementById('cfgFormClinico');
      if (formClinico) {
        formClinico.addEventListener('submit', (e) => this.guardarClinicoYGeocerca(e));
      }

      const formWearable = document.getElementById('cfgFormWearable');
      if (formWearable) {
        formWearable.addEventListener('submit', (e) => this.guardarUmbralesWearable(e));
      }

      const sliderRadio = document.getElementById('cfgGeocercaRadio');
      if (sliderRadio) {
        sliderRadio.addEventListener('input', () => {
          const lbl = document.getElementById('cfgGeocercaRadioLabel');
          if (lbl) lbl.textContent = `${sliderRadio.value} m`;
        });
      }

      // Toggles de Audio, Voz y Auto-escucha Wearable
      const chkSonido = document.getElementById('cfgToggleSonido');
      if (chkSonido) {
        chkSonido.addEventListener('change', () => {
          this.guardarPrefs({ sonidoAlertas: chkSonido.checked });
          notificar(
            chkSonido.checked
              ? 'Alarma sonora de emergencias activada.'
              : 'Alarma sonora silenciada. Las alertas visuales y Push siguen activas.',
            'info'
          );
        });
      }

      const chkVoz = document.getElementById('cfgToggleVoz');
      if (chkVoz) {
        chkVoz.addEventListener('change', () => {
          this.guardarPrefs({ vozAlertas: chkVoz.checked });
          if (!chkVoz.checked && window.speechSynthesis) {
            try { window.speechSynthesis.cancel(); } catch (_) {}
          }
          notificar(
            chkVoz.checked
              ? 'Avisos y lectura por voz activados.'
              : 'Avisos hablados desactivados.',
            'info'
          );
        });
      }

      const chkAutoWear = document.getElementById('cfgToggleAutoWearable');
      if (chkAutoWear) {
        chkAutoWear.addEventListener('change', () => {
          this.guardarPrefs({ autoEscuchaWearable: chkAutoWear.checked });
          if (window.monitoreoWearable) {
            const actualmenteActiva = !!window.monitoreoWearable.escuchaApiActiva;
            if (chkAutoWear.checked !== actualmenteActiva) {
              window.monitoreoWearable.toggleEscuchaApiReloj();
            }
          }
        });
      }

      // Toggles de Accesibilidad (sincronizados con AccesibilidadManager)
      const bindAccess = (elId, prop) => {
        const el = document.getElementById(elId);
        if (!el) return;
        el.addEventListener('change', () => {
          if (window.accesibilidadInstance) {
            window.accesibilidadInstance.config[prop] = el.checked;
            window.accesibilidadInstance.guardarConfig();
          } else {
            const cfg = leerJSON('diamon_accesibilidad_config', {
              textoGrande: false,
              altoContraste: false,
              botonesGrandes: false
            });
            cfg[prop] = el.checked;
            guardarJSON('diamon_accesibilidad_config', cfg);
          }
        });
      };

      bindAccess('cfgAccessTextoGrande', 'textoGrande');
      bindAccess('cfgAccessAltoContraste', 'altoContraste');
      bindAccess('cfgAccessBotonesGrandes', 'botonesGrandes');

      // Toggle Panel Izquierdo Compacto
      const chkSidebar = document.getElementById('cfgToggleSidebarCompacto');
      if (chkSidebar) {
        chkSidebar.addEventListener('change', () => {
          const compacto = chkSidebar.checked;
          try {
            localStorage.setItem(SIDEBAR_KEY, compacto ? '1' : '0');
          } catch (_) {}
          if (typeof window.toggleSidebarDiaMon === 'function' && window.innerWidth > 768) {
            // toggleSidebarDiaMon(forzarAbierto): true = expandido, false = recogido
            window.toggleSidebarDiaMon(!compacto);
          }
          notificar(
            compacto
              ? 'Panel lateral fijado en modo compacto por defecto.'
              : 'Panel lateral fijado en modo expandido por defecto.',
            'info'
          );
        });
      }
    }

    sincronizarUI() {
      const caso = window.casoEstudio;
      const pac = caso?.paciente || {};
      const metas = caso?.metas || {};
      const zonas = caso && typeof caso.obtenerZonasSeguras === 'function' ? caso.obtenerZonasSeguras() : [];
      const zonaPrincipal = zonas.find(z => z.activa !== false) || zonas[0] || {
        centro_lat: pac.coordenadasCasa?.lat || 10.39991,
        centro_lng: pac.coordenadasCasa?.lng || -75.47886,
        radio_metros: pac.radioSeguroMetros || 400
      };

      // 1. Paciente, Cuidador y Contacto SOS
      this.setVal('cfgPacNombre', pac.nombre || 'Damián Díaz Balseiro');
      this.setVal('cfgPacCodigo', pac.codigoPaciente || 'DM-8492');
      this.setVal('cfgPacCuidador', pac.cuidadorPrincipal || 'Familiar / Cuidador Principal');
      this.setVal('cfgPacTelefono', pac.telefonoCuidador || '+57 300 456 7890');
      this.setVal('cfgPacBarrio', pac.barrioResidencia || 'Barrio Chapacuá, Cartagena de Indias');
      this.setVal('cfgPacProfesional', pac.profesionalGuia || 'Enf. Jefe Elizabeth Vargas Caro');

      // 2. Metas Clínicas y Geocerca
      this.setVal('cfgGlucosaMin', metas.glucosaMin ?? 80);
      this.setVal('cfgGlucosaMax', metas.glucosaMaxPost ?? 180);
      this.setVal('cfgPaSistolicaMax', metas.sistolicaMax ?? 140);
      this.setVal('cfgPaDiastolicaMax', metas.diastolicaMax ?? 90);

      const radio = Number(zonaPrincipal.radio_metros) || Number(pac.radioSeguroMetros) || 400;
      const clampedRadio = Math.max(100, Math.min(3000, radio));
      this.setVal('cfgGeocercaRadio', clampedRadio);
      const lblRadio = document.getElementById('cfgGeocercaRadioLabel');
      if (lblRadio) lblRadio.textContent = `${radio} m`;
      this.setVal('cfgGeocercaLat', Number(zonaPrincipal.centro_lat ?? 10.39991).toFixed(5));
      this.setVal('cfgGeocercaLng', Number(zonaPrincipal.centro_lng ?? -75.47886).toFixed(5));

      // 3. Wearable Baseline
      const base = window.monitoreoWearable?.baseline || leerJSON(WEARABLE_BASELINE_KEY, {
        bpmReposo: 72,
        bpmAlertaAlta: 100,
        bpmAlertaBaja: 52,
        tempBaseC: 36.5,
        tempBajaC: 35.8,
        tempAltaC: 37.7,
        tiempoRespuestaSegundos: 60
      });
      this.setVal('cfgWearBpmReposo', base.bpmReposo ?? 72);
      this.setVal('cfgWearBpmAlta', base.bpmAlertaAlta ?? 100);
      this.setVal('cfgWearBpmBaja', base.bpmAlertaBaja ?? 52);
      this.setVal('cfgWearTempBase', base.tempBaseC ?? 36.5);
      this.setVal('cfgWearTempBaja', base.tempBajaC ?? 35.8);
      this.setVal('cfgWearTempAlta', base.tempAltaC ?? 37.7);
      this.setVal('cfgWearTiempoEscala', base.tiempoRespuestaSegundos ?? 60);

      // 4. Audio, Voz y Auto-escucha
      const prefs = this.obtenerPrefs();
      this.setChecked('cfgToggleSonido', prefs.sonidoAlertas);
      this.setChecked('cfgToggleVoz', prefs.vozAlertas);
      this.setChecked('cfgToggleAutoWearable', prefs.autoEscuchaWearable);

      // 5. Accesibilidad y Sidebar
      const acc = window.accesibilidadInstance?.config || leerJSON('diamon_accesibilidad_config', {});
      this.setChecked('cfgAccessTextoGrande', !!acc.textoGrande);
      this.setChecked('cfgAccessAltoContraste', !!acc.altoContraste);
      this.setChecked('cfgAccessBotonesGrandes', !!acc.botonesGrandes);

      let sidebarCompacto = false;
      try {
        sidebarCompacto = localStorage.getItem(SIDEBAR_KEY) === '1';
      } catch (_) {}
      this.setChecked('cfgToggleSidebarCompacto', sidebarCompacto);

      // 6. Hero, Push y Contadores
      this.actualizarEstadoPush();
      this.actualizarHeroYContadores();
    }

    setVal(id, val) {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null) el.value = val;
    }

    setChecked(id, checked) {
      const el = document.getElementById(id);
      if (el) el.checked = !!checked;
    }

    actualizarEstadoPush() {
      const titleEl = document.getElementById('cfgPushStatusTitle');
      const descEl = document.getElementById('cfgPushStatusDesc');
      const btnEl = document.getElementById('cfgBtnActivarPush');
      const statPush = document.getElementById('cfgStatPush');

      if (window.DiaMonAndroid && typeof window.DiaMonAndroid.esAppAndroid === 'function') {
        if (titleEl) titleEl.textContent = 'Notificaciones Nativas Android 24/7 Activas';
        if (descEl) descEl.textContent = 'Canal de emergencias Android y vibración nativa conectados con DiaMon.';
        if (btnEl) {
          btnEl.innerHTML = '<i class="fas fa-bell" aria-hidden="true"></i> Probar notificación';
          btnEl.onclick = () => {
            window.DiaMonAndroid.dispararNotificacionNativa(
              'DiaMon 24/7 Verificado',
              'Las notificaciones nativas y vibración de emergencia están activas en este teléfono.',
              false
            );
          };
        }
        if (statPush) statPush.textContent = 'Android 24/7';
        return;
      }

      if (!('Notification' in window)) {
        if (titleEl) titleEl.textContent = 'Push 24/7 no soportado';
        if (descEl) descEl.textContent = 'Este navegador no soporta notificaciones nativas del sistema.';
        if (btnEl) btnEl.style.display = 'none';
        if (statPush) statPush.textContent = 'No disponible';
        return;
      }

      const perm = Notification.permission;
      if (perm === 'granted') {
        if (titleEl) titleEl.textContent = 'Notificaciones Push 24/7 Activas';
        if (descEl) descEl.textContent = 'Recibirás alertas críticas incluso si cambias de pestaña o bloqueas el equipo.';
        if (btnEl) {
          btnEl.innerHTML = '<i class="fas fa-check-circle" aria-hidden="true"></i> Activas';
          btnEl.disabled = false;
        }
        if (statPush) statPush.textContent = 'Activas';
      } else if (perm === 'denied') {
        if (titleEl) titleEl.textContent = 'Notificaciones bloqueadas en el navegador';
        if (descEl) descEl.textContent = 'Habilita el permiso desde el candado de la barra de direcciones para recibir alertas Push.';
        if (btnEl) {
          btnEl.innerHTML = '<i class="fas fa-ban" aria-hidden="true"></i> Bloqueadas';
        }
        if (statPush) statPush.textContent = 'Bloqueadas';
      } else {
        if (titleEl) titleEl.textContent = 'Notificaciones Push 24/7 Pendientes';
        if (descEl) descEl.textContent = 'Actívalas para recibir avisos instantáneos de geocerca, glucosa y wearable.';
        if (btnEl) {
          btnEl.innerHTML = '<i class="fas fa-bell" aria-hidden="true"></i> Activar Push';
        }
        if (statPush) statPush.textContent = 'Pendiente';
      }
    }

    actualizarHeroYContadores() {
      const caso = window.casoEstudio;
      const pac = caso?.paciente || {};
      const zonas = caso && typeof caso.obtenerZonasSeguras === 'function' ? caso.obtenerZonasSeguras() : [];
      const zonaActiva = zonas.find(z => z.activa !== false) || zonas[0];
      const radio = Number(zonaActiva?.radio_metros) || Number(pac.radioSeguroMetros) || 400;
      const prefs = this.obtenerPrefs();

      const heroTitle = document.getElementById('cfgHeroTitle');
      const statCodigo = document.getElementById('cfgStatCodigo');
      const statGeocerca = document.getElementById('cfgStatGeocerca');
      const statAudio = document.getElementById('cfgStatAudio');

      if (heroTitle) heroTitle.textContent = `Perfil activo: ${pac.nombre || 'Damián Díaz Balseiro'}`;
      if (statCodigo) statCodigo.textContent = pac.codigoPaciente || 'DM-8492';
      if (statGeocerca) statGeocerca.textContent = `${radio} m`;
      if (statAudio) {
        if (prefs.sonidoAlertas && prefs.vozAlertas) statAudio.textContent = 'Sonido + Voz';
        else if (prefs.sonidoAlertas) statAudio.textContent = 'Solo sonido';
        else if (prefs.vozAlertas) statAudio.textContent = 'Solo voz';
        else statAudio.textContent = 'Silenciados';
      }

      // Contadores de almacenamiento real
      const glucosas = caso?.glucosas || leerJSON('diamon_damian_glucosa_v5', []);
      const presiones = caso?.presiones || leerJSON('diamon_damian_presion_v5', []);
      const rutas = leerJSON('diamon_rutas_historicas_v1', []);
      const lecturasWear = window.monitoreoWearable?.lecturas || leerJSON('diamon_wearable_lecturas_v1', []);

      const setTxt = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(v);
      };
      setTxt('cfgCountGlucosa', Array.isArray(glucosas) ? glucosas.length : 0);
      setTxt('cfgCountPresion', Array.isArray(presiones) ? presiones.length : 0);
      setTxt('cfgCountRutas', Array.isArray(rutas) ? rutas.length : 0);
      setTxt('cfgCountWearable', Array.isArray(lecturasWear) ? lecturasWear.length : 0);
    }

    guardarDatosPaciente(e, silencioso = false) {
      if (e) e.preventDefault();
      if (!window.casoEstudio) return false;

      const nombre = (document.getElementById('cfgPacNombre')?.value || '').trim();
      const codigoPaciente = (document.getElementById('cfgPacCodigo')?.value || '').trim().toUpperCase() || 'DM-8492';
      const cuidadorPrincipal = (document.getElementById('cfgPacCuidador')?.value || '').trim();
      const telefonoCuidador = (document.getElementById('cfgPacTelefono')?.value || '').trim();
      const barrioResidencia = (document.getElementById('cfgPacBarrio')?.value || '').trim();
      const profesionalGuia = (document.getElementById('cfgPacProfesional')?.value || '').trim();

      if (!nombre) {
        notificar('Ingresa el nombre del paciente.', 'warn');
        return false;
      }

      window.casoEstudio.guardarMetasPersonalizadas({}, {
        nombre,
        codigoPaciente,
        cuidadorPrincipal: cuidadorPrincipal || 'Familiar / Cuidador Principal',
        telefonoCuidador: telefonoCuidador || '+57 300 456 7890',
        barrioResidencia: barrioResidencia || 'Barrio Chapacuá, Cartagena de Indias',
        profesionalGuia: profesionalGuia || 'Enf. Jefe Elizabeth Vargas Caro'
      });

      if (window.medicalQRManager && typeof window.medicalQRManager.renderPulseCardSummary === 'function') {
        window.medicalQRManager.renderPulseCardSummary('pulseCardSummary');
      }
      if (window.monitoreoWearable && typeof window.monitoreoWearable.renderizarTodo === 'function') {
        window.monitoreoWearable.renderizarTodo();
      }

      this.actualizarHeroYContadores();
      if (!silencioso) {
        notificar('Datos del paciente, cuidador y contacto SOS actualizados.', 'success');
      }
      return true;
    }

    guardarClinicoYGeocerca(e, silencioso = false) {
      if (e) e.preventDefault();
      if (!window.casoEstudio) return false;

      const glucosaMin = parseInt(document.getElementById('cfgGlucosaMin')?.value, 10) || 80;
      const glucosaMaxPost = parseInt(document.getElementById('cfgGlucosaMax')?.value, 10) || 180;
      const sistolicaMax = parseInt(document.getElementById('cfgPaSistolicaMax')?.value, 10) || 140;
      const diastolicaMax = parseInt(document.getElementById('cfgPaDiastolicaMax')?.value, 10) || 90;
      const radioSeguroMetros = Math.max(100, Math.min(3000, parseInt(document.getElementById('cfgGeocercaRadio')?.value, 10) || 400));
      const lat = parseFloat(document.getElementById('cfgGeocercaLat')?.value);
      const lng = parseFloat(document.getElementById('cfgGeocercaLng')?.value);

      if (glucosaMin >= glucosaMaxPost) {
        notificar('La glucosa mínima debe ser menor que la glucosa máxima.', 'warn');
        return false;
      }

      const coordsValidas = !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
      const coordenadasCasa = coordsValidas
        ? { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) }
        : (window.casoEstudio.paciente.coordenadasCasa || { lat: 10.39991, lng: -75.47886 });

      window.casoEstudio.guardarMetasPersonalizadas(
        { glucosaMin, glucosaMaxPost, sistolicaMax, diastolicaMax },
        { radioSeguroMetros, coordenadasCasa }
      );

      // Actualizar también la zona segura activa y redibujar en Leaflet
      const zonas = window.casoEstudio.obtenerZonasSeguras();
      if (Array.isArray(zonas) && zonas.length > 0) {
        const idx = zonas.findIndex(z => z.activa !== false);
        const targetIdx = idx >= 0 ? idx : 0;
        zonas[targetIdx] = {
          ...zonas[targetIdx],
          centro_lat: coordenadasCasa.lat,
          centro_lng: coordenadasCasa.lng,
          radio_metros: radioSeguroMetros,
          activa: true
        };
        window.casoEstudio.guardarZonasSeguras(zonas);
      } else {
        window.casoEstudio.guardarZonasSeguras([{
          id: 1,
          nombre: `Casa ${window.casoEstudio.paciente.nombre} — Zona Segura`,
          centro_lat: coordenadasCasa.lat,
          centro_lng: coordenadasCasa.lng,
          radio_metros: radioSeguroMetros,
          nivel_riesgo: 'bajo',
          activa: true
        }]);
      }

      this.actualizarHeroYContadores();
      if (!silencioso) {
        notificar(`Metas clínicas y geocerca de ${radioSeguroMetros}m aplicadas al mapa y alertas.`, 'success');
      }
      return true;
    }

    usarMiGpsComoGeocerca() {
      const aplicar = (lat, lng) => {
        this.setVal('cfgGeocercaLat', Number(lat).toFixed(5));
        this.setVal('cfgGeocercaLng', Number(lng).toFixed(5));
        notificar('Coordenadas GPS actuales cargadas. Pulsa "Aplicar metas y geocerca" para guardar.', 'info');
      };

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => aplicar(pos.coords.latitude, pos.coords.longitude),
          () => {
            const tele = window.TelemetriaDiaMon?.ubicacion;
            if (tele && tele.lat && tele.lng) {
              aplicar(tele.lat, tele.lng);
            } else {
              notificar('No se pudo obtener GPS del navegador. Verifica el permiso de ubicación.', 'warn');
            }
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      } else {
        notificar('Tu navegador no soporta geolocalización.', 'warn');
      }
    }

    guardarUmbralesWearable(e, silencioso = false) {
      if (e) e.preventDefault();

      const actual = window.monitoreoWearable?.baseline || leerJSON(WEARABLE_BASELINE_KEY, {});
      const nuevo = {
        ...actual,
        bpmReposo: Math.max(45, Math.min(110, Number(document.getElementById('cfgWearBpmReposo')?.value) || 72)),
        bpmAlertaAlta: Math.max(80, Math.min(160, Number(document.getElementById('cfgWearBpmAlta')?.value) || 100)),
        bpmAlertaBaja: Math.max(35, Math.min(70, Number(document.getElementById('cfgWearBpmBaja')?.value) || 52)),
        tempBaseC: Number(document.getElementById('cfgWearTempBase')?.value) || 36.5,
        tempBajaC: Number(document.getElementById('cfgWearTempBaja')?.value) || 35.8,
        tempAltaC: Number(document.getElementById('cfgWearTempAlta')?.value) || 37.7,
        tiempoRespuestaSegundos: Math.max(15, Math.min(180, Number(document.getElementById('cfgWearTiempoEscala')?.value) || 60))
      };

      guardarJSON(WEARABLE_BASELINE_KEY, nuevo);

      if (window.monitoreoWearable) {
        window.monitoreoWearable.baseline = nuevo;
        if (window.monitoreoWearable.DetectorService && window.monitoreoWearable.ultimaLectura) {
          window.monitoreoWearable.ultimaEvaluacion = window.monitoreoWearable.DetectorService.evaluarLectura(
            window.monitoreoWearable.ultimaLectura,
            nuevo
          );
        }
        if (typeof window.monitoreoWearable.renderizarTodo === 'function') {
          window.monitoreoWearable.renderizarTodo();
        }
      }

      if (!silencioso) {
        notificar(`Umbrales del Monitor Wearable guardados (espera: ${nuevo.tiempoRespuestaSegundos}s).`, 'success');
      }
      return true;
    }

    restaurarDefaultsWearable() {
      const Hex = window.DiaMonHexagonal || {};
      const defaults = Hex.DetectorGlucemicoPreventivoService
        ? Hex.DetectorGlucemicoPreventivoService.obtenerBaselineDefault()
        : {
            bpmReposo: 72,
            bpmAlertaAlta: 100,
            bpmCriticaAlta: 115,
            bpmAlertaBaja: 52,
            deltaBpmSubito: 22,
            tempBaseC: 36.5,
            tempBajaC: 35.8,
            tempCriticaBajaC: 35.4,
            tempAltaC: 37.7,
            tempCriticaAltaC: 38.2,
            deltaTempBajaC: -0.6,
            deltaTempAltaC: 0.8,
            tiempoRespuestaSegundos: 60
          };

      guardarJSON(WEARABLE_BASELINE_KEY, defaults);
      if (window.monitoreoWearable) {
        window.monitoreoWearable.baseline = { ...defaults };
        if (window.monitoreoWearable.DetectorService && window.monitoreoWearable.ultimaLectura) {
          window.monitoreoWearable.ultimaEvaluacion = window.monitoreoWearable.DetectorService.evaluarLectura(
            window.monitoreoWearable.ultimaLectura,
            window.monitoreoWearable.baseline
          );
        }
        window.monitoreoWearable.renderizarTodo();
      }
      this.sincronizarUI();
      notificar('Valores clínicos por defecto restaurados para el Monitor Wearable.', 'info');
    }

    guardarTodo() {
      const ok1 = this.guardarDatosPaciente(null, true);
      const ok2 = this.guardarClinicoYGeocerca(null, true);
      const ok3 = this.guardarUmbralesWearable(null, true);
      if (ok1 && ok2 && ok3) {
        notificar('Toda la configuración de DiaMon fue guardada y aplicada.', 'success');
      }
    }

    async activarPush() {
      if (typeof window.activarNotificaciones24h === 'function') {
        await window.activarNotificaciones24h();
      } else if ('Notification' in window) {
        await Notification.requestPermission();
      }
      this.actualizarEstadoPush();
    }

    probarAudio() {
      if (typeof window.probarSonidoAlerta === 'function') {
        window.probarSonidoAlerta(true);
      } else {
        notificar('Motor de audio no disponible en esta vista.', 'warn');
      }
    }

    probarVoz() {
      if (window.accesibilidadInstance && typeof window.accesibilidadInstance.leerResumenVoz === 'function') {
        window.accesibilidadInstance.leerResumenVoz();
      } else if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance('Prueba de voz de DiaMon completada. El monitoreo clínico se encuentra activo.');
        utt.lang = 'es-CO';
        window.speechSynthesis.speak(utt);
      } else {
        notificar('Tu navegador no soporta síntesis de voz.', 'warn');
      }
    }

    exportarRespaldoJSON() {
      const payload = {
        aplicacion: 'DiaMon — Sistema Integral de Monitoreo GPS & Diabetes 24/7',
        exportadoEn: new Date().toISOString(),
        paciente: window.casoEstudio?.paciente || leerJSON('diamon_damian_paciente_v5', null),
        metasClinicas: window.casoEstudio?.metas || leerJSON('diamon_damian_metas_v5', null),
        zonasSeguras: window.casoEstudio?.obtenerZonasSeguras?.() || leerJSON('diamon_damian_zonas_v5', []),
        glucosas: window.casoEstudio?.glucosas || leerJSON('diamon_damian_glucosa_v5', []),
        presiones: window.casoEstudio?.presiones || leerJSON('diamon_damian_presion_v5', []),
        estadosDiarios: leerJSON('diamon_estado_diario_historial_v1', []),
        rutasHistoricas: leerJSON('diamon_rutas_historicas_v1', []),
        wearable: {
          baseline: window.monitoreoWearable?.baseline || leerJSON(WEARABLE_BASELINE_KEY, null),
          lecturas: window.monitoreoWearable?.lecturas || leerJSON('diamon_wearable_lecturas_v1', []),
          incidentes: window.monitoreoWearable?.incidentes || leerJSON('diamon_wearable_incidentes_v1', [])
        },
        alertas: leerJSON('diamon_alertas_damian_v5', []),
        preferencias: this.obtenerPrefs(),
        accesibilidad: leerJSON('diamon_accesibilidad_config', {})
      };

      const fecha = new Date().toISOString().slice(0, 10);
      const nombreArchivo = `diamon-respaldo-${fecha}.json`;
      const jsonStr = JSON.stringify(payload, null, 2);

      // En Android Studio, guardar en Documentos y abrir hoja nativa de compartir
      if (window.DiaMonAndroid && typeof window.DiaMonAndroid.exportarRespaldoJson === 'function') {
        try {
          window.DiaMonAndroid.exportarRespaldoJson(nombreArchivo, jsonStr);
          notificar(`Respaldo generado en Android: ${nombreArchivo}`, 'success');
          return;
        } catch (_) {}
      }

      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notificar(`Respaldo descargado: ${nombreArchivo}`, 'success');
    }

    restablecerDatosDemo() {
      const ok = window.confirm(
        '¿Restablecer los datos locales de demostración (paciente, metas, rutas locales, lecturas wearable y preferencias)? Esta acción recargará el panel.'
      );
      if (!ok) return;

      const keys = [
        'diamon_damian_paciente_v5',
        'diamon_damian_metas_v5',
        'diamon_damian_glucosa_v5',
        'diamon_damian_presion_v5',
        'diamon_damian_meds_v5',
        'diamon_damian_zonas_v5',
        'diamon_damian_registros_v5',
        'diamon_alertas_damian_v5',
        'diamon_estado_diario_historial_v1',
        'diamon_rutas_historicas_v1',
        'diamon_wearable_baseline_v1',
        'diamon_wearable_lecturas_v1',
        'diamon_wearable_incidentes_v1',
        'diamon_wearable_vista_rol_v1',
        'diamon_accesibilidad_config',
        'diamon_config_prefs_v1',
        'diamon_sidebar_collapsed'
      ];

      keys.forEach((k) => {
        try { localStorage.removeItem(k); } catch (_) {}
      });

      window.location.reload();
    }
  }

  window.DiaMonConfiguracion = new ConfiguracionSistemaController();

  document.addEventListener('DOMContentLoaded', () => {
    window.DiaMonConfiguracion.init();
  });
})();
