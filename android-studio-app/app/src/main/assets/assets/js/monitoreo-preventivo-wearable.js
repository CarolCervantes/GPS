/**
 * DiaMon — Motor de Monitoreo Preventivo Sin Parche (Wearable: Reloj / Anillo / Banda)
 *
 * Implementa la idea clínica preventiva basada en biomarcadores indirectos:
 *   1. Conecta con reloj inteligente, anillo o banda (Bluetooth BLE GATT 0x180D / 0x1809,
 *      Puente Nativo window.DiaMonWearableBridge, o Simulador Clínico interactivo).
 *   2. Detecta alteraciones de ritmo cardíaco (BPM) y cambios de temperatura corporal (°C)
 *      como indicadores tempranos de una posible subida o bajada de azúcar.
 *   3. Dispara una ALARMA EN SIMULTÁNEO a la persona con diabetes y al cuidador.
 *   4. Cuenta regresiva de 1 MINUTO (60 segundos) para que el paciente confirme "Estoy bien".
 *   5. Si el paciente NO responde en 1 minuto (o solicita ayuda inmediata), el cuidador
 *      recibe automáticamente la UBICACIÓN GPS EXACTA + REPORTE COMPLETO DE SÍNTOMAS.
 */

(function () {
  'use strict';

  const STORAGE_KEYS = {
    BASELINE: 'diamon_wearable_baseline_v1',
    LECTURAS: 'diamon_wearable_lecturas_v1',
    INCIDENTES: 'diamon_wearable_incidentes_v1',
    VISTA_ROL: 'diamon_wearable_vista_rol_v1'
  };

  const CHANNEL_NAME = 'diamon_preventivo_wearable_sync';
  const syncChannel = ('BroadcastChannel' in window) ? new BroadcastChannel(CHANNEL_NAME) : null;

  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatearTiempoMMSS(segundos) {
    const s = Math.max(0, Math.ceil(Number(segundos) || 0));
    const min = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(min).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }

  function nombreTipoDispositivo(tipo) {
    return {
      reloj_inteligente: 'Reloj Inteligente (Smartwatch)',
      anillo_inteligente: 'Anillo Inteligente (Smart Ring)',
      banda_fitness: 'Banda Deportiva / Pulsera',
      sensor_ble: 'Sensor Biométrico BLE',
      simulador: 'Simulador Wearable'
    }[tipo] || 'Dispositivo Wearable';
  }

  class MonitoreoPreventivoWearableController {
    constructor() {
      const Hex = window.DiaMonHexagonal || {};
      this.DetectorService = Hex.DetectorGlucemicoPreventivoService;
      this.LecturaEntity = Hex.LecturaBiometricaEntity;
      this.UseCaseClass = Hex.MonitorearBiometriaPreventivaUseCase;
      this.BleAdapterClass = Hex.WebBluetoothWearableAdapter;
      this.SupabaseAdapterClass = Hex.SupabaseTelemetriaAdapter;

      this.baseline = this.cargarJSON(
        STORAGE_KEYS.BASELINE,
        this.DetectorService ? this.DetectorService.obtenerBaselineDefault() : {
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
        }
      );

      this.lecturas = this.cargarJSON(STORAGE_KEYS.LECTURAS, this.generarLecturasIniciales());
      this.incidentes = this.cargarJSON(STORAGE_KEYS.INCIDENTES, []);
      this.vistaRol = localStorage.getItem(STORAGE_KEYS.VISTA_ROL) || this.inferirVistaRolPorSesion();

      this.dispositivoTipo = 'reloj_inteligente';
      this.dispositivoNombre = 'Reloj Inteligente (Modo Preparado)';
      this.soloPulsoSinTemp = false;
      this.monitorContinuoActivo = false;
      this.monitorContinuoTimer = null;
      this.escuchaApiActiva = false;
      this.escuchaApiTimer = null;
      this.ultimaLecturaApiId = null;

      this.bleAdapter = this.BleAdapterClass ? new this.BleAdapterClass() : null;
      this.bleAndroidConectado = false;
      this.supabaseRepo = this.SupabaseAdapterClass
        ? new this.SupabaseAdapterClass(window.supabaseClient || null)
        : null;

      this.countdownTimer = null;
      this.alarmAudioInterval = null;
      this.audioSilenciado = false;
      this.supabaseLiveChannel = null;
      this.estadoCuidador = {
        fase: 'esperando', // 'esperando' | 'alarma_simultanea' | 'confirmado_bien' | 'escalada_emergencia'
        incidente: null,
        paqueteEscalamiento: null,
        segundosRestantes: 60
      };

      // Instanciar Caso de Uso Hexagonal con adaptador de notificación real
      this.useCase = this.UseCaseClass
        ? new this.UseCaseClass(this.supabaseRepo, {
            dispararAlarmaSimultanea: (incidente) => this.onAlarmaSimultaneaLocal(incidente),
            notificarConfirmacionPaciente: (incidente) => this.onPacienteConfirmoLocal(incidente),
            escalarACuidadorConUbicacionYSintomas: (paquete, incidente) => this.onEscalamientoCuidadorLocal(paquete, incidente)
          })
        : null;

      this.ultimaLectura = this.lecturas[0] || {
        ritmoCardiacoBpm: 72,
        temperaturaC: 36.5,
        dispositivoTipo: 'reloj_inteligente',
        dispositivoNombre: 'Reloj Inteligente (Modo Preparado)',
        fuente: 'simulador',
        ts: Date.now()
      };
      this.ultimaEvaluacion = this.DetectorService
        ? this.DetectorService.evaluarLectura(this.ultimaLectura, this.baseline)
        : null;

      this.configurarBLECallbacks();
      this.iniciarCanalesSincronizacion();
      this.exponerPuenteHardware();
    }

    cargarJSON(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw);
      } catch (_) {}
      try {
        localStorage.setItem(key, JSON.stringify(fallback));
      } catch (_) {}
      return JSON.parse(JSON.stringify(fallback));
    }

    guardarJSON(key, val) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch (_) {}
    }

    generarLecturasIniciales() {
      const ahora = Date.now();
      return [
        { id: 'bio-init-6', ritmoCardiacoBpm: 72, temperaturaC: 36.5, dispositivoTipo: 'reloj_inteligente', dispositivoNombre: 'Reloj Inteligente (Línea Base)', fuente: 'simulador', ts: ahora - 2 * 60000 },
        { id: 'bio-init-5', ritmoCardiacoBpm: 74, temperaturaC: 36.5, dispositivoTipo: 'reloj_inteligente', dispositivoNombre: 'Reloj Inteligente (Línea Base)', fuente: 'simulador', ts: ahora - 7 * 60000 },
        { id: 'bio-init-4', ritmoCardiacoBpm: 71, temperaturaC: 36.6, dispositivoTipo: 'reloj_inteligente', dispositivoNombre: 'Reloj Inteligente (Línea Base)', fuente: 'simulador', ts: ahora - 12 * 60000 },
        { id: 'bio-init-3', ritmoCardiacoBpm: 73, temperaturaC: 36.4, dispositivoTipo: 'reloj_inteligente', dispositivoNombre: 'Reloj Inteligente (Línea Base)', fuente: 'simulador', ts: ahora - 17 * 60000 },
        { id: 'bio-init-2', ritmoCardiacoBpm: 70, temperaturaC: 36.5, dispositivoTipo: 'reloj_inteligente', dispositivoNombre: 'Reloj Inteligente (Línea Base)', fuente: 'simulador', ts: ahora - 22 * 60000 },
        { id: 'bio-init-1', ritmoCardiacoBpm: 72, temperaturaC: 36.5, dispositivoTipo: 'reloj_inteligente', dispositivoNombre: 'Reloj Inteligente (Línea Base)', fuente: 'simulador', ts: ahora - 27 * 60000 }
      ];
    }

    obtenerSesionActiva() {
      try {
        const raw = sessionStorage.getItem('diamon_demo_user') || localStorage.getItem('diamon_current_user');
        return raw ? JSON.parse(raw) : null;
      } catch (_) {
        return null;
      }
    }

    inferirVistaRolPorSesion() {
      const ses = this.obtenerSesionActiva();
      if (!ses || !ses.rol) return 'dual';
      if (ses.rol === 'cuidador') return 'cuidador';
      if (ses.rol === 'usuario' || ses.rol === 'monitoreado') return 'paciente';
      return 'dual';
    }

    obtenerPacienteActual() {
      const base = (window.casoEstudio && window.casoEstudio.paciente)
        ? { ...window.casoEstudio.paciente }
        : {
            id: 'pac-damian-diaz-01',
            codigoPaciente: 'DM-8492',
            nombre: 'Damián Díaz Balseiro',
            cuidadorPrincipal: 'Familiar / Cuidador Principal',
            telefonoCuidador: '+57 300 456 7890',
            barrioResidencia: 'Barrio Chapacuá, Cartagena de Indias',
            coordenadasCasa: { lat: 10.39991, lng: -75.47886 }
          };

      const ses = this.obtenerSesionActiva();
      if (ses) {
        if (ses.rol === 'cuidador' && ses.pacienteVinculado) {
          const pv = ses.pacienteVinculado;
          if (typeof pv === 'object') {
            base.nombre = pv.nombre || base.nombre;
            base.codigoPaciente = pv.codigoPaciente || base.codigoPaciente;
          } else {
            base.codigoPaciente = pv;
          }
          if (ses.nombre) base.cuidadorPrincipal = ses.nombre;
        } else if (ses.rol === 'usuario' || ses.rol === 'monitoreado') {
          if (ses.nombre) base.nombre = ses.nombre;
          if (ses.codigoPaciente) base.codigoPaciente = ses.codigoPaciente;
        }
      }

      return base;
    }

    obtenerUbicacionGPSActual() {
      if (window.TelemetriaDiaMon && window.TelemetriaDiaMon.ubicacion) {
        return {
          lat: window.TelemetriaDiaMon.ubicacion.lat,
          lng: window.TelemetriaDiaMon.ubicacion.lng,
          zona: window.TelemetriaDiaMon.ubicacion.zona || 'Barrio Chapacuá, Cartagena de Indias',
          precision: window.TelemetriaDiaMon.ubicacion.precision || 10
        };
      }
      const pac = this.obtenerPacienteActual();
      return {
        lat: pac.coordenadasCasa?.lat || 10.39991,
        lng: pac.coordenadasCasa?.lng || -75.47886,
        zona: pac.barrioResidencia || 'Barrio Chapacuá, Cartagena de Indias',
        precision: 12
      };
    }

    // ============================================================
    // 1. PUENTE DE HARDWARE PARA RELOJ INTELIGENTE / ANILLO / BLE
    // ============================================================
    estaWearableConectado() {
      return Boolean((this.bleAdapter && this.bleAdapter.estaConectado()) || this.bleAndroidConectado);
    }

    exponerPuenteHardware() {
      window.DiaMonWearableBridge = {
        inyectarLecturaExterna: async (datos = {}) => {
          return this.procesarNuevaLectura({
            ritmoCardiacoBpm: datos.ritmoCardiacoBpm ?? datos.bpm ?? datos.heartRate,
            temperaturaC: datos.temperaturaC ?? datos.temperatura ?? datos.tempC ?? null,
            dispositivoTipo: datos.dispositivoTipo || this.dispositivoTipo,
            dispositivoNombre: datos.dispositivoNombre || datos.dispositivo || 'Reloj Inteligente Externo',
            fuente: datos.fuente || 'bridge_nativo',
            bateriaDispositivo: datos.bateriaDispositivo ?? datos.bateria ?? null
          });
        },
        onNativeBleStatus: (meta = {}) => {
          this.bleAndroidConectado = Boolean(meta.conectado);
          if (this.bleAndroidConectado) {
            this.dispositivoTipo = meta.dispositivoTipo || this.dispositivoTipo;
            this.dispositivoNombre = meta.nombre || nombreTipoDispositivo(this.dispositivoTipo);
            this.soloPulsoSinTemp = meta.soportaTemperatura === false;
            if (window.mostrarNotificacion) {
              const sensores = meta.soportaTemperatura
                ? 'Ritmo Cardíaco + Temperatura'
                : 'Ritmo Cardíaco (BLE Android)';
              window.mostrarNotificacion(`Conectado por Bluetooth Android a ${this.dispositivoNombre} (${sensores}).`, 'success');
            }
          } else {
            this.dispositivoNombre = `${nombreTipoDispositivo(this.dispositivoTipo)} (Modo Preparado)`;
            if (window.mostrarNotificacion) {
              window.mostrarNotificacion(`Dispositivo ${meta.nombre || 'BLE'} desconectado.`, 'warn');
            }
          }
          this.renderizarTodo();
        },
        conectarBluetoothBLE: (tipo) => this.conectarBluetoothBLE(tipo),
        desconectarBluetoothBLE: () => this.desconectarBluetoothBLE(),
        obtenerEstado: () => ({
          bleConectado: this.estaWearableConectado(),
          bleNativoAndroid: this.bleAndroidConectado,
          metadataBLE: this.bleAdapter ? this.bleAdapter.obtenerMetadataDispositivo() : null,
          ultimaLectura: this.ultimaLectura,
          ultimaEvaluacion: this.ultimaEvaluacion,
          incidenteActivo: this.useCase ? this.useCase.obtenerIncidenteActivo() : null,
          baseline: this.baseline
        })
      };
    }

    configurarBLECallbacks() {
      if (!this.bleAdapter) return;
      this.bleAdapter.suscribirLecturas((payload) => {
        this.dispositivoNombre = payload.dispositivoNombre;
        this.procesarNuevaLectura(payload);
      });
      this.bleAdapter.suscribirDesconexion(() => {
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion('⌚ Dispositivo Bluetooth desconectado.', 'warn');
        }
        this.renderizarTodo();
      });
    }

    async conectarBluetoothBLE(tipoOpcional) {
      const tipo = tipoOpcional || this.dispositivoTipo;
      // Si estamos en la App Android Studio, usar el adaptador BLE GATT nativo de Android
      if (window.DiaMonAndroid && typeof window.DiaMonAndroid.escanearYConectarWearable === 'function') {
        this.dispositivoTipo = tipo;
        window.DiaMonAndroid.escanearYConectarWearable(tipo);
        return;
      }

      if (!this.bleAdapter) return;
      try {
        const meta = await this.bleAdapter.conectar({ dispositivoTipo: tipo });
        this.dispositivoTipo = tipo;
        this.dispositivoNombre = meta.nombre || nombreTipoDispositivo(tipo);
        this.soloPulsoSinTemp = !meta.soportaTemperatura;

        if (window.mostrarNotificacion) {
          const sensores = meta.soportaTemperatura
            ? 'Ritmo Cardíaco + Temperatura'
            : 'Ritmo Cardíaco (sin sensor térmico BLE)';
          window.mostrarNotificacion(`Conectado a ${this.dispositivoNombre} (${sensores}).`, 'success');
        }
        this.renderizarTodo();
      } catch (err) {
        if (err && err.name === 'NotFoundError') return; // Usuario canceló selector BLE
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion(`Bluetooth BLE: ${err.message}`, 'info');
        } else {
          alert(`Bluetooth BLE: ${err.message}`);
        }
      }
    }

    async desconectarBluetoothBLE() {
      if (this.bleAndroidConectado && window.DiaMonAndroid && typeof window.DiaMonAndroid.desconectarWearable === 'function') {
        window.DiaMonAndroid.desconectarWearable();
        this.bleAndroidConectado = false;
        this.dispositivoNombre = `${nombreTipoDispositivo(this.dispositivoTipo)} (Modo Preparado)`;
        this.renderizarTodo();
        return;
      }
      if (!this.bleAdapter) return;
      await this.bleAdapter.desconectar();
      this.dispositivoNombre = `${nombreTipoDispositivo(this.dispositivoTipo)} (Modo Preparado)`;
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion('Dispositivo wearable desconectado.', 'info');
      }
      this.renderizarTodo();
    }

    // ============================================================
    // 2. SINCRONIZACIÓN SIMULTÁNEA PACIENTE <-> CUIDADOR
    // ============================================================
    iniciarCanalesSincronizacion() {
      if (syncChannel) {
        syncChannel.onmessage = (event) => {
          this.manejarEventoRemoto(event.data);
        };
      }

      if (window.supabaseClient && typeof window.supabaseClient.channel === 'function') {
        try {
          const pac = this.obtenerPacienteActual();
          const codCanal = String(pac.codigoPaciente || 'DM-8492').toLowerCase().replace(/[^a-z0-9-]/g, '');
          this.supabaseLiveChannel = window.supabaseClient.channel(`diamon-preventivo-${codCanal}`);
          this.supabaseLiveChannel
            .on('broadcast', { event: 'alerta-preventiva-wearable' }, ({ payload }) => {
              this.manejarEventoRemoto(payload);
            })
            .subscribe();
        } catch (_) {}
      }
    }

    emitirSincronizacion(type, payload = {}) {
      const msg = { type, origenTabId: this.tabId(), ...payload };
      if (syncChannel) {
        try { syncChannel.postMessage(msg); } catch (_) {}
      }
      if (this.supabaseLiveChannel) {
        try {
          this.supabaseLiveChannel.send({
            type: 'broadcast',
            event: 'alerta-preventiva-wearable',
            payload: msg
          });
        } catch (_) {}
      }
    }

    tabId() {
      if (!this._tabId) {
        this._tabId = 'tab-' + Math.random().toString(36).slice(2, 10);
      }
      return this._tabId;
    }

    manejarEventoRemoto(msg) {
      if (!msg || !msg.type || msg.origenTabId === this.tabId()) return;

      if (msg.type === 'LECTURA_WEARABLE' && msg.lectura) {
        this.ultimaLectura = msg.lectura;
        this.ultimaEvaluacion = msg.evaluacion || this.DetectorService.evaluarLectura(msg.lectura, this.baseline);
        this.lecturas.unshift(msg.lectura);
        this.lecturas = this.lecturas.slice(0, 30);
        this.renderizarTodo();
      }

      if (msg.type === 'ALARMA_SIMULTANEA' && msg.incidente) {
        this.estadoCuidador = {
          fase: 'alarma_simultanea',
          incidente: msg.incidente,
          paqueteEscalamiento: null,
          segundosRestantes: msg.incidente.segundosRestantes || 60
        };
        this.reproducirPulsoAlarma('preventiva');
        this.iniciarTemporizadorCuentaRegresiva(msg.incidente, false);
        if (this.vistaRol !== 'cuidador') {
          this.mostrarModalAlarmaPaciente(msg.incidente);
        }
        this.renderizarTodo();
      }

      if (msg.type === 'PACIENTE_CONFIRMO_BIEN' && msg.incidente) {
        this.detenerTemporizadorYAudio();
        this.cerrarModalAlarmaPaciente();
        this.estadoCuidador = {
          fase: 'confirmado_bien',
          incidente: msg.incidente,
          paqueteEscalamiento: null,
          segundosRestantes: 0
        };
        this.registrarIncidenteHistorial(msg.incidente);
        this.renderizarTodo();
      }

      if (msg.type === 'ESCALAMIENTO_CUIDADOR' && msg.paquete) {
        this.detenerTemporizadorYAudio();
        this.cerrarModalAlarmaPaciente();
        this.estadoCuidador = {
          fase: 'escalada_emergencia',
          incidente: msg.incidente || null,
          paqueteEscalamiento: msg.paquete,
          segundosRestantes: 0
        };
        this.reproducirPulsoAlarma('critica');
        if (msg.incidente) this.registrarIncidenteHistorial(msg.incidente);
        this.renderizarTodo();
      }
    }

    // ============================================================
    // 3. PROCESAMIENTO DE LECTURAS Y FLUJO DE ALARMA SIMULTÁNEA 60s
    // ============================================================
    async procesarNuevaLectura(datos) {
      if (!this.useCase) return null;

      const coords = this.obtenerUbicacionGPSActual();
      const paciente = this.obtenerPacienteActual();

      const resultado = await this.useCase.procesarLecturaWearable(
        {
          pacienteId: paciente.id,
          ritmoCardiacoBpm: datos.ritmoCardiacoBpm,
          temperaturaC: this.soloPulsoSinTemp && datos.fuente === 'simulador' ? null : datos.temperaturaC,
          dispositivoTipo: datos.dispositivoTipo || this.dispositivoTipo,
          dispositivoNombre: datos.dispositivoNombre || this.dispositivoNombre,
          fuente: datos.fuente || 'simulador',
          bateriaDispositivo: datos.bateriaDispositivo ?? null,
          coordenadas: coords,
          ts: datos.ts || Date.now()
        },
        paciente,
        this.baseline
      );

      this.ultimaLectura = resultado.lectura;
      this.ultimaEvaluacion = resultado.evaluacion;
      this.lecturas.unshift(resultado.lectura);
      if (this.lecturas.length > 30) this.lecturas = this.lecturas.slice(0, 30);
      this.guardarJSON(STORAGE_KEYS.LECTURAS, this.lecturas);

      this.emitirSincronizacion('LECTURA_WEARABLE', {
        lectura: resultado.lectura,
        evaluacion: resultado.evaluacion
      });

      this.renderizarTodo();
      return resultado;
    }

    // Fase 1: Alarma EN SIMULTÁNEO al paciente con diabetes y al cuidador
    onAlarmaSimultaneaLocal(incidente) {
      this.audioSilenciado = false;
      this.estadoCuidador = {
        fase: 'alarma_simultanea',
        incidente,
        paqueteEscalamiento: null,
        segundosRestantes: incidente.tiempoLimiteSegundos || 60
      };

      // 1. Notificar al cuidador en paralelo (Multi-pestaña + Supabase Realtime + Alertas 24/7)
      this.emitirSincronizacion('ALARMA_SIMULTANEA', { incidente });

      if (window.emitirAlerta24Horas) {
        const tipoAlerta = incidente.evaluacion.riesgo === 'posible_hipoglucemia'
          ? 'preventiva_hipoglucemia'
          : (incidente.evaluacion.riesgo === 'posible_hiperglucemia' ? 'preventiva_hiperglucemia' : 'preventiva_biometrica');

        window.emitirAlerta24Horas({
          titulo: `Alarma Simultánea: ${incidente.evaluacion.titulo}`,
          subtitulo: `${incidente.paciente.nombre} · ${incidente.lectura.ritmoCardiacoBpm} BPM${incidente.lectura.temperaturaC !== null ? ` · ${incidente.lectura.temperaturaC} °C` : ''} · Esperando respuesta (60s).`,
          tipo: tipoAlerta,
          color: 'amber',
          icono: 'fas fa-heart-pulse',
          badgeTexto: 'Esperando 60s',
          badgeClase: 'badge-aviso',
          coordenadas: null, // La ubicación GPS exacta se libera al cuidador si no responde en 1 minuto
          ubicacion: 'Esperando confirmación del paciente (ventana de 60s)',
          descripcion: `${incidente.evaluacion.resumenClinico} Síntomas: ${incidente.evaluacion.sintomasDetectados.join(' | ')}. Si el paciente no confirma estar bien en 1 minuto, se enviará ubicación GPS exacta y síntomas completos al cuidador.`
        });
      }

      // 2. Sonido, vibración y lectura en voz alta
      this.iniciarAudioAlarmaRepetitivo();
      if (navigator.vibrate) {
        try { navigator.vibrate([350, 150, 350, 150, 450]); } catch (_) {}
      }
      this.hablarAlerta(
        `Atención ${incidente.paciente.nombre}. ${incidente.evaluacion.titulo}. ` +
        `Ritmo cardíaco en ${incidente.lectura.ritmoCardiacoBpm} latidos por minuto. ` +
        `Tienes un minuto para presionar Estoy Bien, o avisaremos a tu cuidador con tu ubicación y síntomas.`
      );

      // 3. Mostrar pantalla de alarma al paciente (salvo si el usuario fijó modo exclusivo Solo Cuidador)
      if (this.vistaRol !== 'cuidador') {
        this.mostrarModalAlarmaPaciente(incidente);
      }

      // 4. Iniciar cuenta regresiva real de 1 minuto (60 segundos)
      this.iniciarTemporizadorCuentaRegresiva(incidente, true);
      this.renderizarTodo();
    }

    iniciarTemporizadorCuentaRegresiva(incidente, ejecutarEscalamientoAlVencer = true) {
      if (this.countdownTimer) clearInterval(this.countdownTimer);

      const limiteSeg = incidente.tiempoLimiteSegundos || 60;
      const venceEnTs = (incidente.iniciadoEnTs || Date.now()) + limiteSeg * 1000;

      const actualizarTick = () => {
        const restantes = Math.max(0, Math.ceil((venceEnTs - Date.now()) / 1000));
        incidente.segundosRestantes = restantes;
        this.estadoCuidador.segundosRestantes = restantes;

        const timerModal = document.getElementById('dmAlarmCountdownBig');
        const progressModal = document.getElementById('dmAlarmProgressFill');
        const timerCuidador = document.getElementById('dmCaregiverCountdown');

        if (timerModal) timerModal.textContent = formatearTiempoMMSS(restantes);
        if (progressModal) progressModal.style.width = `${(restantes / limiteSeg) * 100}%`;
        if (timerCuidador) timerCuidador.textContent = formatearTiempoMMSS(restantes);

        if (restantes <= 0) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
          if (ejecutarEscalamientoAlVencer && this.useCase && this.useCase.obtenerIncidenteActivo()) {
            this.escalarPorFaltaDeRespuesta();
          }
        }
      };

      actualizarTick();
      this.countdownTimer = setInterval(actualizarTick, 500);
    }

    async pacienteRespondeEstoyBien() {
      const activo = this.useCase?.obtenerIncidenteActivo();
      if (!activo) {
        this.detenerTemporizadorYAudio();
        this.cerrarModalAlarmaPaciente();
        return;
      }
      await this.useCase.confirmarPacienteEstaBien(
        activo.id,
        'Paciente confirmó en pantalla que se encuentra bien antes de cumplirse 1 minuto.'
      );
    }

    async pacientePideAyudaAhora() {
      const activo = this.useCase?.obtenerIncidenteActivo();
      if (!activo) return;
      const ubicacion = this.obtenerUbicacionGPSActual();
      await this.useCase.escalarAlCuidador(
        activo.id,
        ubicacion,
        'El paciente presionó "Necesito ayuda ahora" durante la alerta biométrica.'
      );
    }

    async escalarPorFaltaDeRespuesta(motivoCustom) {
      const activo = this.useCase?.obtenerIncidenteActivo();
      if (!activo) return;
      const ubicacion = this.obtenerUbicacionGPSActual();
      await this.useCase.escalarAlCuidador(
        activo.id,
        ubicacion,
        motivoCustom || 'El paciente no respondió a la alerta preventiva al cumplirse 1 minuto (60 segundos).'
      );
    }

    // Confirmación "Estoy Bien" recibida antes del minuto
    onPacienteConfirmoLocal(incidente) {
      this.detenerTemporizadorYAudio();
      this.cerrarModalAlarmaPaciente();
      this.reproducirTonoConfirmacion();

      this.estadoCuidador = {
        fase: 'confirmado_bien',
        incidente,
        paqueteEscalamiento: null,
        segundosRestantes: 0
      };

      this.registrarIncidenteHistorial(incidente);
      this.emitirSincronizacion('PACIENTE_CONFIRMO_BIEN', { incidente });

      if (window.emitirAlerta24Horas) {
        window.emitirAlerta24Horas({
          titulo: `Paciente confirmó estar bien (${incidente.segundosRespuesta}s)`,
          subtitulo: `${incidente.paciente.nombre} respondió la alerta preventiva antes del minuto. Escalamiento cancelado.`,
          tipo: 'sistema',
          color: 'green',
          icono: 'fas fa-check-circle',
          badgeTexto: 'Confirmada',
          badgeClase: 'badge-confirmada',
          coordenadas: null,
          ubicacion: 'Confirmado por el paciente',
          descripcion: `Se había detectado ${incidente.evaluacion.titulo} (${incidente.lectura.ritmoCardiacoBpm} BPM${incidente.lectura.temperaturaC !== null ? `, ${incidente.lectura.temperaturaC} °C` : ''}). El paciente confirmó estar bien en ${incidente.segundosRespuesta} segundos.`
        });
      }

      if (window.mostrarNotificacion) {
        window.mostrarNotificacion(`✅ ${incidente.paciente.nombre} confirmó estar bien (${incidente.segundosRespuesta}s). Cuidador notificado.`, 'success');
      }

      this.renderizarTodo();
    }

    // Fase 2: Escalamiento automático al cuidador con UBICACIÓN GPS + SÍNTOMAS
    onEscalamientoCuidadorLocal(paquete, incidente) {
      this.detenerTemporizadorYAudio();
      this.cerrarModalAlarmaPaciente();
      this.reproducirPulsoAlarma('critica');

      if (window.DiaMonAndroid && typeof window.DiaMonAndroid.vibrarEmergencia === 'function') {
        try { window.DiaMonAndroid.vibrarEmergencia(true); } catch (_) {}
      }
      if (navigator.vibrate) {
        try { navigator.vibrate([500, 150, 500, 150, 700]); } catch (_) {}
      }

      this.hablarAlerta(
        `Alerta crítica para el cuidador. ${paquete.paciente.nombre} no respondió en un minuto. ` +
        `Se envió su ubicación GPS en ${paquete.ubicacion.zona} y los síntomas detectados.`
      );

      this.estadoCuidador = {
        fase: 'escalada_emergencia',
        incidente,
        paqueteEscalamiento: paquete,
        segundosRestantes: 0
      };

      this.registrarIncidenteHistorial(incidente);
      this.emitirSincronizacion('ESCALAMIENTO_CUIDADOR', { paquete, incidente });

      if (window.emitirAlerta24Horas) {
        const tempTxt = paquete.signosVitales.temperaturaC !== null
          ? `${paquete.signosVitales.temperaturaC} °C`
          : 'Sin sensor térmico';
        window.emitirAlerta24Horas({
          titulo: `🚨 EMERGENCIA CUIDADOR: ${paquete.titulo}`,
          subtitulo: `Sin respuesta tras 1 min · Ubicación: ${paquete.ubicacion.zona} · ${paquete.signosVitales.ritmoCardiacoBpm} BPM · ${tempTxt}`,
          tipo: 'escalamiento_cuidador',
          color: 'red',
          icono: 'fas fa-ambulance',
          badgeTexto: 'Urgente GPS',
          badgeClase: 'badge-pendiente',
          coordenadas: { lat: paquete.ubicacion.lat, lng: paquete.ubicacion.lng },
          ubicacion: `${paquete.ubicacion.zona} (${paquete.ubicacion.lat.toFixed(5)}, ${paquete.ubicacion.lng.toFixed(5)})`,
          descripcion: `${paquete.motivo} Síntomas detectados por ${paquete.signosVitales.dispositivoNombre}: ${paquete.sintomasDetectados.join(' · ')}. Recomendación: ${paquete.recomendacionInmediata}`
        });
      }

      // Mostrar modal de emergencia al cuidador si estamos en vista cuidador o dual
      if (this.vistaRol !== 'paciente') {
        this.mostrarNotificacionEscalamientoCuidador(paquete);
      }

      this.renderizarTodo();
    }

    registrarIncidenteHistorial(incidente) {
      this.incidentes = this.incidentes.filter(i => i.id !== incidente.id);
      this.incidentes.unshift(incidente);
      if (this.incidentes.length > 20) this.incidentes = this.incidentes.slice(0, 20);
      this.guardarJSON(STORAGE_KEYS.INCIDENTES, this.incidentes);
    }

    // ============================================================
    // 4. AUDIO CLÍNICO Y VOZ
    // ============================================================
    iniciarAudioAlarmaRepetitivo() {
      this.detenerAudio();
      this.reproducirPulsoAlarma('preventiva');
      this.alarmAudioInterval = setInterval(() => {
        if (!this.audioSilenciado) {
          this.reproducirPulsoAlarma('preventiva');
        }
      }, 3500);
    }

    obtenerPrefsConfig() {
      try {
        const raw = localStorage.getItem('diamon_config_prefs_v1');
        if (raw) return JSON.parse(raw);
      } catch (_) {}
      return { sonidoAlertas: true, vozAlertas: true };
    }

    reproducirPulsoAlarma(nivel = 'preventiva') {
      const prefs = this.obtenerPrefsConfig();
      if (this.audioSilenciado || prefs.sonidoAlertas === false) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = nivel === 'critica' ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(nivel === 'critica' ? 920 : 780, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.28);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.34);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } catch (_) {}
    }

    reproducirTonoConfirmacion() {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24);
        gain.gain.setValueAtTime(0.14, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.45);
      } catch (_) {}
    }

    hablarAlerta(texto) {
      const prefs = this.obtenerPrefsConfig();
      if (!window.speechSynthesis || this.audioSilenciado || prefs.vozAlertas === false) return;
      try {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(texto);
        utt.lang = 'es-CO';
        utt.rate = 1.02;
        window.speechSynthesis.speak(utt);
      } catch (_) {}
    }

    toggleSilencioAlarma() {
      this.audioSilenciado = !this.audioSilenciado;
      if (this.audioSilenciado && window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch (_) {}
      }
      const btn = document.getElementById('dmBtnMuteAlarm');
      if (btn) {
        btn.innerHTML = this.audioSilenciado
          ? '<i class="fas fa-volume-mute"></i> Sonido silenciado'
          : '<i class="fas fa-volume-up"></i> Silenciar sonido';
      }
    }

    detenerAudio() {
      if (this.alarmAudioInterval) {
        clearInterval(this.alarmAudioInterval);
        this.alarmAudioInterval = null;
      }
    }

    detenerTemporizadorYAudio() {
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
      }
      this.detenerAudio();
    }

    // ============================================================
    // 5. MODAL PANTALLA COMPLETA ALARMA DEL PACIENTE (60 SEGUNDOS)
    // ============================================================
    mostrarModalAlarmaPaciente(incidente) {
      let overlay = document.getElementById('dmPreventiveAlarmOverlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'dmPreventiveAlarmOverlay';
        overlay.className = 'dm-preventive-alarm-overlay';
        overlay.setAttribute('role', 'alertdialog');
        overlay.setAttribute('aria-modal', 'true');
        document.body.appendChild(overlay);
      }

      const ev = incidente.evaluacion;
      const lec = incidente.lectura;
      const tempTexto = lec.temperaturaC !== null ? `${lec.temperaturaC.toFixed(1)} °C` : 'Sin sensor';
      const deltaTempTexto = ev.signos.deltaTemp !== null
        ? `${ev.signos.deltaTemp >= 0 ? '+' : ''}${ev.signos.deltaTemp.toFixed(1)} °C vs base`
        : 'Modo solo pulso';

      overlay.innerHTML = `
        <div class="dm-preventive-alarm-card">
          <div class="dm-alarm-header">
            <div class="dm-alarm-header-title">
              <i class="fas fa-exclamation-triangle"></i>
              <div style="text-align:left;">
                <div style="font-size:11px; font-weight:800; letter-spacing:0.06em; text-transform:uppercase; color:#fecaca;">
                  ALARMA PREVENTIVA SIMULTÁNEA · PACIENTE + CUIDADOR
                </div>
                <div style="font-size:18px; font-weight:900; color:#ffffff;">
                  ${escHtml(ev.titulo)}
                </div>
              </div>
            </div>
          </div>

          <div class="dm-alarm-body">
            <p style="font-size:14.5px; color:#e2e8f0; margin:0 0 8px 0; line-height:1.45;">
              Hola <strong>${escHtml(incidente.paciente.nombre)}</strong>, tu <strong>${escHtml(lec.dispositivoNombre)}</strong> detectó signos compatibles con una alteración de azúcar.
            </p>

            <div class="dm-alarm-countdown-wrap">
              <div style="font-size:12px; font-weight:700; text-transform:uppercase; color:#fca5a5; letter-spacing:0.05em;">
                Tiempo para confirmar que estás bien
              </div>
              <div class="dm-alarm-timer-big" id="dmAlarmCountdownBig">${formatearTiempoMMSS(incidente.segundosRestantes || 60)}</div>
              <div class="dm-alarm-progress-track">
                <div class="dm-alarm-progress-fill" id="dmAlarmProgressFill" style="width:100%;"></div>
              </div>
              <div style="font-size:12px; color:#cbd5e1; margin-top:8px;">
                Si no respondes en 1 minuto, <strong>${escHtml(incidente.paciente.cuidadorPrincipal)}</strong> recibirá automáticamente tu <strong>ubicación GPS</strong> y tus <strong>síntomas</strong>.
              </div>
            </div>

            <div class="dm-alarm-vitals-strip">
              <div class="dm-alarm-vital-box">
                <div style="font-size:11px; color:#94a3b8; font-weight:700; text-transform:uppercase;">Ritmo Cardíaco</div>
                <div style="font-size:26px; font-weight:900; color:#f87171;">${lec.ritmoCardiacoBpm} <span style="font-size:13px;">BPM</span></div>
                <div style="font-size:11.5px; color:#fecaca;">${ev.signos.deltaBpm >= 0 ? '+' : ''}${ev.signos.deltaBpm} BPM sobre base</div>
              </div>
              <div class="dm-alarm-vital-box">
                <div style="font-size:11px; color:#94a3b8; font-weight:700; text-transform:uppercase;">Temperatura Corporal</div>
                <div style="font-size:26px; font-weight:900; color:#38bdf8;">${tempTexto}</div>
                <div style="font-size:11.5px; color:#bae6fd;">${deltaTempTexto}</div>
              </div>
            </div>

            <div style="background:rgba(255,255,255,0.06); border-radius:12px; padding:10px 12px; text-align:left; margin-bottom:16px; font-size:12px; color:#e2e8f0;">
              <strong style="color:#5eead4;">Síntomas detectados:</strong>
              <ul style="margin:6px 0 0 18px; padding:0;">
                ${ev.sintomasDetectados.map(s => `<li>${escHtml(s)}</li>`).join('')}
              </ul>
            </div>

            <button type="button" class="dm-alarm-btn-ok" onclick="window.monitoreoWearable.pacienteRespondeEstoyBien()">
              <i class="fas fa-check-circle" style="font-size:26px;"></i>
              <span>ESTOY BIEN (Cancelar alerta)</span>
            </button>

            <button type="button" class="dm-alarm-btn-help" onclick="window.monitoreoWearable.pacientePideAyudaAhora()">
              <i class="fas fa-ambulance"></i>
              <span>NECESITO AYUDA AHORA (Enviar GPS y síntomas ya)</span>
            </button>

            <div class="dm-alarm-sub-actions">
              <button type="button" id="dmBtnMuteAlarm" class="dm-alarm-mini-btn" onclick="window.monitoreoWearable.toggleSilencioAlarma()">
                <i class="fas fa-volume-up"></i> Silenciar sonido
              </button>
              <button type="button" class="dm-alarm-mini-btn" onclick="window.monitoreoWearable.escalarPorFaltaDeRespuesta('Simulación de vencimiento de 1 minuto sin respuesta del paciente.')">
                <i class="fas fa-forward"></i> Simular fin de 1 minuto (Demo)
              </button>
            </div>
          </div>
        </div>
      `;

      overlay.classList.add('active');
    }

    cerrarModalAlarmaPaciente() {
      const overlay = document.getElementById('dmPreventiveAlarmOverlay');
      if (overlay) overlay.classList.remove('active');
    }

    mostrarNotificacionEscalamientoCuidador(paquete) {
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion(
          `🚨 ESCALAMIENTO CUIDADOR: ${paquete.paciente.nombre} no respondió en 1 min. Ubicación GPS y síntomas recibidos.`,
          'warn'
        );
      }
      // Si el usuario está en la pestaña wearable, enfocar el panel del cuidador
      const panel = document.getElementById('dmCaregiverLivePanel');
      if (panel && document.getElementById('view-wearable')?.classList.contains('active')) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    // ============================================================
    // 6. SIMULADOR CONTINUO Y ESCENARIOS RÁPIDOS
    // ============================================================
    toggleMonitorContinuo() {
      this.monitorContinuoActivo = !this.monitorContinuoActivo;
      if (this.monitorContinuoTimer) {
        clearInterval(this.monitorContinuoTimer);
        this.monitorContinuoTimer = null;
      }

      if (this.monitorContinuoActivo) {
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion('⌚ Monitor continuo wearable activado (muestreo cada 4s).', 'success');
        }
        this.monitorContinuoTimer = setInterval(() => {
          // Solo genera lecturas estables alrededor de la línea base mientras no haya alarma activa
          if (this.useCase?.obtenerIncidenteActivo()) return;
          const bpm = Math.round(this.baseline.bpmReposo + (Math.random() * 8 - 4));
          const temp = this.soloPulsoSinTemp
            ? null
            : Number((this.baseline.tempBaseC + (Math.random() * 0.3 - 0.15)).toFixed(1));
          this.procesarNuevaLectura({
            ritmoCardiacoBpm: bpm,
            temperaturaC: temp,
            dispositivoTipo: this.dispositivoTipo,
            dispositivoNombre: `${nombreTipoDispositivo(this.dispositivoTipo)} (En Vivo)`,
            fuente: 'simulador'
          });
        }, 4000);
      } else if (window.mostrarNotificacion) {
        window.mostrarNotificacion('⏸️ Monitor continuo pausado.', 'info');
      }

      this.renderizarTodo();
    }

    toggleEscuchaApiReloj() {
      this.escuchaApiActiva = !this.escuchaApiActiva;
      if (this.escuchaApiTimer) {
        clearInterval(this.escuchaApiTimer);
        this.escuchaApiTimer = null;
      }

      if (this.escuchaApiActiva) {
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion('📡 Escuchando lecturas externas de reloj inteligente en /api/wearable (cada 3s).', 'success');
        }
        this.consultarApiReloj();
        this.escuchaApiTimer = setInterval(() => this.consultarApiReloj(), 3000);
      } else if (window.mostrarNotificacion) {
        window.mostrarNotificacion('⏸️ Recepción API de reloj pausada.', 'info');
      }

      this.renderizarTodo();
    }

    async consultarApiReloj() {
      if (!window.location.protocol.startsWith('http')) return;
      try {
        const pac = this.obtenerPacienteActual();
        const codigo = encodeURIComponent(pac.codigoPaciente || 'DM-8492');
        const resp = await fetch(`/api/wearable?codigo=${codigo}`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (data && data.ok && data.ultimaLectura && data.ultimaLectura.id !== this.ultimaLecturaApiId) {
          this.ultimaLecturaApiId = data.ultimaLectura.id;
          this.dispositivoNombre = data.ultimaLectura.dispositivoNombre || 'Reloj Inteligente (API)';
          await this.procesarNuevaLectura({
            ...data.ultimaLectura,
            fuente: data.ultimaLectura.fuente || 'bridge_nativo'
          });
        }
      } catch (_) {}
    }

    async probarEnvioApiReloj() {
      if (!window.location.protocol.startsWith('http')) {
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion('ℹ️ Inicia el servidor local (node server.js) para probar POST /api/wearable.', 'info');
        }
        return;
      }
      try {
        const pac = this.obtenerPacienteActual();
        const resp = await fetch('/api/wearable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codigoPaciente: pac.codigoPaciente || 'DM-8492',
            ritmoCardiacoBpm: 76,
            temperaturaC: 36.6,
            dispositivoTipo: this.dispositivoTipo,
            dispositivoNombre: `${nombreTipoDispositivo(this.dispositivoTipo)} (HTTP API)`,
            bateriaDispositivo: 92
          })
        });
        const data = await resp.json();
        if (data && data.ok) {
          if (!this.escuchaApiActiva) {
            this.ultimaLecturaApiId = data.lectura.id;
            await this.procesarNuevaLectura(data.lectura);
          } else {
            await this.consultarApiReloj();
          }
          if (window.mostrarNotificacion) {
            window.mostrarNotificacion(`✅ POST /api/wearable verificado para ${pac.codigoPaciente || 'DM-8492'} (76 BPM · 36.6 °C).`, 'success');
          }
        }
      } catch (err) {
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion(`⚠️ Error al probar /api/wearable: ${err.message}`, 'warn');
        }
      }
    }

    seleccionarTipoDispositivo(tipo) {
      this.dispositivoTipo = tipo;
      if (!this.estaWearableConectado()) {
        this.dispositivoNombre = `${nombreTipoDispositivo(tipo)} (Modo Preparado)`;
      }
      this.renderizarTodo();
    }

    cambiarVistaRol(rol) {
      this.vistaRol = rol;
      localStorage.setItem(STORAGE_KEYS.VISTA_ROL, rol);
      this.renderizarTodo();
    }

    toggleSoloPulsoSinTemp(checked) {
      this.soloPulsoSinTemp = Boolean(checked);
      this.renderizarTodo();
    }

    async aplicarEscenarioRapido(escenario) {
      let bpm = this.baseline.bpmReposo;
      let temp = this.baseline.tempBaseC;
      let soloPulso = this.soloPulsoSinTemp;

      if (escenario === 'estable') {
        bpm = this.baseline.bpmReposo;
        temp = this.baseline.tempBaseC;
        this.estadoCuidador.fase = 'esperando';
      } else if (escenario === 'hipoglucemia') {
        bpm = 114;
        temp = 35.5;
        soloPulso = false;
      } else if (escenario === 'hiperglucemia') {
        bpm = 108;
        temp = 38.2;
        soloPulso = false;
      } else if (escenario === 'solo_pulso_critico') {
        bpm = 124;
        temp = null;
        soloPulso = true;
      }

      this.soloPulsoSinTemp = soloPulso;

      const sliderBpm = document.getElementById('dmSliderBpm');
      const sliderTemp = document.getElementById('dmSliderTemp');
      const chkSoloPulso = document.getElementById('dmCheckSoloPulso');
      if (sliderBpm) sliderBpm.value = bpm;
      if (sliderTemp && temp !== null) sliderTemp.value = temp;
      if (chkSoloPulso) chkSoloPulso.checked = soloPulso;

      this.actualizarLabelsSliders();

      await this.procesarNuevaLectura({
        ritmoCardiacoBpm: bpm,
        temperaturaC: soloPulso ? null : temp,
        dispositivoTipo: this.dispositivoTipo,
        dispositivoNombre: this.estaWearableConectado()
          ? this.dispositivoNombre
          : `${nombreTipoDispositivo(this.dispositivoTipo)} (Simulación Clínica)`,
        fuente: 'simulador'
      });
    }

    async evaluarDesdeSliders() {
      const bpm = Number(document.getElementById('dmSliderBpm')?.value || this.baseline.bpmReposo);
      const tempVal = Number(document.getElementById('dmSliderTemp')?.value || this.baseline.tempBaseC);
      const soloPulso = Boolean(document.getElementById('dmCheckSoloPulso')?.checked);
      this.soloPulsoSinTemp = soloPulso;

      await this.procesarNuevaLectura({
        ritmoCardiacoBpm: bpm,
        temperaturaC: soloPulso ? null : tempVal,
        dispositivoTipo: this.dispositivoTipo,
        dispositivoNombre: `${nombreTipoDispositivo(this.dispositivoTipo)} (Lectura Manual)`,
        fuente: 'manual'
      });
    }

    actualizarLabelsSliders() {
      const bpmVal = document.getElementById('dmSliderBpm')?.value;
      const tempVal = document.getElementById('dmSliderTemp')?.value;
      const lblBpm = document.getElementById('dmSliderBpmLabel');
      const lblTemp = document.getElementById('dmSliderTempLabel');
      if (lblBpm && bpmVal !== undefined) lblBpm.textContent = `${bpmVal} BPM`;
      if (lblTemp && tempVal !== undefined) {
        lblTemp.textContent = this.soloPulsoSinTemp ? 'Desactivado (Solo pulso)' : `${Number(tempVal).toFixed(1)} °C`;
      }
    }

    guardarBaselineDesdeFormulario(e) {
      if (e) e.preventDefault();
      const nuevo = {
        ...this.baseline,
        bpmReposo: Number(document.getElementById('dmBaseBpmReposo')?.value) || 72,
        bpmAlertaAlta: Number(document.getElementById('dmBaseBpmAlta')?.value) || 100,
        bpmAlertaBaja: Number(document.getElementById('dmBaseBpmBaja')?.value) || 52,
        tempBaseC: Number(document.getElementById('dmBaseTempNormal')?.value) || 36.5,
        tempBajaC: Number(document.getElementById('dmBaseTempBaja')?.value) || 35.8,
        tempAltaC: Number(document.getElementById('dmBaseTempAlta')?.value) || 37.7,
        tiempoRespuestaSegundos: Math.max(15, Math.min(180, Number(document.getElementById('dmBaseTiempoSeg')?.value) || 60))
      };

      this.baseline = nuevo;
      this.guardarJSON(STORAGE_KEYS.BASELINE, nuevo);
      this.ultimaEvaluacion = this.DetectorService.evaluarLectura(this.ultimaLectura, this.baseline);

      if (window.mostrarNotificacion) {
        window.mostrarNotificacion('✓ Línea base biométrica actualizada correctamente.', 'success');
      }
      this.renderizarTodo();
    }

    marcarEmergenciaCuidadorAtendida() {
      if (this.estadoCuidador.incidente) {
        this.estadoCuidador.incidente.estado = 'ATENDIDA';
        this.registrarIncidenteHistorial(this.estadoCuidador.incidente);
      }
      this.estadoCuidador = {
        fase: 'esperando',
        incidente: null,
        paqueteEscalamiento: null,
        segundosRestantes: this.baseline.tiempoRespuestaSegundos || 60
      };
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion('✓ Emergencia marcada como atendida por el cuidador.', 'success');
      }
      this.renderizarTodo();
    }

    // ============================================================
    // 7. RENDERIZADO DE UI (DASHBOARD INICIO + VISTA WEARABLE + SPARKLINE)
    // ============================================================
    renderizarTodo() {
      this.renderizarTarjetaInicio();
      this.renderizarVistaWearable();
      this.renderizarModoAbueloStrip();
    }

    renderizarTarjetaInicio() {
      const bpmEl = document.getElementById('homeWearableBpm');
      const bpmDeltaEl = document.getElementById('homeWearableBpmDelta');
      const tempEl = document.getElementById('homeWearableTemp');
      const tempDeltaEl = document.getElementById('homeWearableTempDelta');
      const riskEl = document.getElementById('homeWearableRisk');
      const riskSubEl = document.getElementById('homeWearableRiskSub');
      const statusBadge = document.getElementById('homeWearableConnBadge');

      if (!this.ultimaLectura || !this.ultimaEvaluacion) return;

      const ev = this.ultimaEvaluacion;
      const lec = this.ultimaLectura;

      if (bpmEl) bpmEl.textContent = `${lec.ritmoCardiacoBpm} BPM`;
      if (bpmDeltaEl) bpmDeltaEl.textContent = `${ev.signos.deltaBpm >= 0 ? '+' : ''}${ev.signos.deltaBpm} vs base (${this.baseline.bpmReposo})`;

      if (tempEl) tempEl.textContent = lec.temperaturaC !== null ? `${lec.temperaturaC.toFixed(1)} °C` : 'Solo Pulso';
      if (tempDeltaEl) {
        tempDeltaEl.textContent = ev.signos.deltaTemp !== null
          ? `${ev.signos.deltaTemp >= 0 ? '+' : ''}${ev.signos.deltaTemp.toFixed(1)} °C vs base (${this.baseline.tempBaseC})`
          : 'Sin sensor térmico';
      }

      if (riskEl) {
        const badgeCls = ev.severidad === 'critica' || ev.severidad === 'alta'
          ? 'danger'
          : (ev.severidad === 'preventiva' ? 'warn' : 'success');
        riskEl.className = `dc-kpi-badge ${badgeCls}`;
        riskEl.innerHTML = `<i class="fas ${ev.requiereAlarmaSimultanea ? 'fa-exclamation-triangle' : 'fa-shield-alt'}"></i> ${escHtml(ev.etiquetaCorta)}`;
      }
      if (riskSubEl) riskSubEl.textContent = ev.titulo;

      if (statusBadge) {
        const bleOn = this.estaWearableConectado();
        if (bleOn) {
          statusBadge.className = 'dc-kpi-badge success';
          statusBadge.innerHTML = `<i class="fab fa-bluetooth-b"></i> ${escHtml(this.dispositivoNombre)}`;
        } else if (this.monitorContinuoActivo) {
          statusBadge.className = 'dc-kpi-badge info';
          statusBadge.innerHTML = `<i class="fas fa-wave-square"></i> Monitor activo (${escHtml(nombreTipoDispositivo(this.dispositivoTipo))})`;
        } else {
          statusBadge.className = 'dc-kpi-badge info';
          statusBadge.innerHTML = `<i class="fas fa-link"></i> Listo para reloj / anillo`;
        }
      }
    }

    renderizarModoAbueloStrip() {
      const strip = document.getElementById('amWearableBiometriaStrip');
      if (!strip || !this.ultimaLectura || !this.ultimaEvaluacion) return;
      const tempTxt = this.ultimaLectura.temperaturaC !== null
        ? `${this.ultimaLectura.temperaturaC.toFixed(1)} °C`
        : 'Solo pulso';
      strip.innerHTML = `
        <span><i class="fas fa-heart-pulse" style="color:#f87171;"></i> Pulso: <strong>${this.ultimaLectura.ritmoCardiacoBpm} BPM</strong></span>
        <span>·</span>
        <span><i class="fas fa-thermometer-half" style="color:#38bdf8;"></i> Temp: <strong>${tempTxt}</strong></span>
        <span>·</span>
        <span style="color:${this.ultimaEvaluacion.requiereAlarmaSimultanea ? '#fca5a5' : '#86efac'}; font-weight:700;">${escHtml(this.ultimaEvaluacion.etiquetaCorta)}</span>
      `;
    }

    renderizarVistaWearable() {
      const container = document.getElementById('wearableDashboardContainer');
      if (!container || !this.ultimaLectura || !this.ultimaEvaluacion) return;

      const ev = this.ultimaEvaluacion;
      const lec = this.ultimaLectura;
      const bleOn = this.estaWearableConectado();
      const bleCompatible = Boolean(
        (window.DiaMonAndroid && typeof window.DiaMonAndroid.escanearYConectarWearable === 'function')
        || this.BleAdapterClass?.esCompatible()
      );
      const pac = this.obtenerPacienteActual();

      const hrEstadoClase = Math.abs(ev.signos.deltaBpm) >= this.baseline.deltaBpmSubito ||
        lec.ritmoCardiacoBpm >= this.baseline.bpmAlertaAlta ||
        lec.ritmoCardiacoBpm <= this.baseline.bpmAlertaBaja
        ? (ev.requiereAlarmaSimultanea ? 'estado-critico' : 'estado-alerta')
        : '';

      const tempEstadoClase = ev.signos.tieneSensorTemperatura &&
        (lec.temperaturaC <= this.baseline.tempBajaC || lec.temperaturaC >= this.baseline.tempAltaC)
        ? (ev.requiereAlarmaSimultanea ? 'estado-critico' : 'estado-alerta')
        : '';

      const riskBannerClass = ev.severidad === 'critica' || ev.severidad === 'alta'
        ? 'critica'
        : (ev.severidad === 'preventiva' ? 'vigilancia' : '');

      container.innerHTML = `
        <!-- HERO DEL MÓDULO SIN PARCHE -->
        <div class="dm-wearable-hero">
          <div class="dm-wearable-hero-row">
            <div>
              <span class="dm-wearable-pill-tag">
                <i class="fas fa-shield-heart"></i> Detección Preventiva Sin Parche · Reloj / Anillo / Banda
              </span>
              <h2>Monitor Biométrico Preventivo (Pulso + Temperatura)</h2>
              <p>
                Detecta alteraciones de <strong>ritmo cardíaco</strong> y <strong>temperatura corporal</strong> asociadas a bajadas o subidas de azúcar.
                Ante una anomalía, lanza una <strong>alarma simultánea</strong> al paciente y al cuidador; si el paciente no confirma estar bien en <strong>${this.baseline.tiempoRespuestaSegundos} segundos</strong>, el cuidador recibe su <strong>ubicación GPS y síntomas</strong>.
              </p>
            </div>
            <div>
              <div style="font-size:11px; color:#99f6e4; font-weight:700; margin-bottom:5px; text-transform:uppercase;">
                Perspectiva de Vista / Demo
              </div>
              <div class="dm-wearable-role-switcher" role="group" aria-label="Selector de vista paciente o cuidador">
                <button type="button" class="dm-role-tab-btn ${this.vistaRol === 'dual' ? 'active' : ''}" onclick="window.monitoreoWearable.cambiarVistaRol('dual')">
                  <i class="fas fa-columns"></i> Dual
                </button>
                <button type="button" class="dm-role-tab-btn ${this.vistaRol === 'paciente' ? 'active' : ''}" onclick="window.monitoreoWearable.cambiarVistaRol('paciente')">
                  <i class="fas fa-user"></i> Paciente
                </button>
                <button type="button" class="dm-role-tab-btn ${this.vistaRol === 'cuidador' ? 'active' : ''}" onclick="window.monitoreoWearable.cambiarVistaRol('cuidador')">
                  <i class="fas fa-user-nurse"></i> Cuidador
                </button>
              </div>
            </div>
          </div>

          <div class="dm-wearable-disclaimer">
            <i class="fas fa-info-circle" style="color:#5eead4; font-size:16px; flex-shrink:0;"></i>
            <span>${escHtml(ev.notaClinica)}</span>
          </div>
        </div>

        <!-- GRID PRINCIPAL: SENSORES Y CONTROL + PANEL EN VIVO DEL CUIDADOR -->
        <div class="dm-wearable-grid">
          <!-- COLUMNA IZQUIERDA: LECTURAS EN VIVO + CONEXIÓN + SIMULADOR -->
          <div>
            <!-- Tarjetas en vivo de Ritmo Cardíaco y Temperatura -->
            <div class="dm-wearable-sensors-grid">
              <div class="dm-sensor-live-card ${hrEstadoClase}">
                <div class="dm-sensor-top">
                  <span style="font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase;">Ritmo Cardíaco</span>
                  <div class="dm-sensor-icon heart ${this.monitorContinuoActivo || bleOn || ev.requiereAlarmaSimultanea ? 'pulsing' : ''}">
                    <i class="fas fa-heartbeat"></i>
                  </div>
                </div>
                <div class="dm-sensor-big-val">${lec.ritmoCardiacoBpm} <span>BPM</span></div>
                <div class="dm-sensor-sub">
                  <span>Base: <strong>${this.baseline.bpmReposo} BPM</strong></span>
                  <span style="font-weight:700; color:${Math.abs(ev.signos.deltaBpm) >= this.baseline.deltaBpmSubito ? '#dc2626' : '#0d9488'};">
                    ${ev.signos.deltaBpm >= 0 ? '+' : ''}${ev.signos.deltaBpm} BPM
                  </span>
                </div>
              </div>

              <div class="dm-sensor-live-card ${tempEstadoClase}">
                <div class="dm-sensor-top">
                  <span style="font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase;">Temperatura Corporal</span>
                  <div class="dm-sensor-icon temp">
                    <i class="fas fa-thermometer-half"></i>
                  </div>
                </div>
                <div class="dm-sensor-big-val">
                  ${lec.temperaturaC !== null ? `${lec.temperaturaC.toFixed(1)} <span>°C</span>` : `<span style="font-size:20px; color:#64748b;">Solo Pulso</span>`}
                </div>
                <div class="dm-sensor-sub">
                  <span>Base: <strong>${this.baseline.tempBaseC.toFixed(1)} °C</strong></span>
                  <span style="font-weight:700; color:${tempEstadoClase ? '#dc2626' : '#0284c7'};">
                    ${ev.signos.deltaTemp !== null ? `${ev.signos.deltaTemp >= 0 ? '+' : ''}${ev.signos.deltaTemp.toFixed(1)} °C` : 'Opcional'}
                  </span>
                </div>
              </div>
            </div>

            <!-- Diagnóstico Preventivo Actual -->
            <div class="dm-risk-banner ${riskBannerClass}">
              <div class="dm-risk-banner-title">
                <i class="fas ${ev.requiereAlarmaSimultanea ? 'fa-exclamation-triangle' : (ev.severidad === 'preventiva' ? 'fa-eye' : 'fa-check-circle')}"
                   style="color:${ev.requiereAlarmaSimultanea ? '#dc2626' : (ev.severidad === 'preventiva' ? '#d97706' : '#16a34a')};"></i>
                <span>${escHtml(ev.titulo)}</span>
              </div>
              <p class="dm-risk-banner-desc">${escHtml(ev.resumenClinico)}</p>
              <p class="dm-risk-banner-desc" style="margin-top:6px;"><strong>Protocolo sugerido:</strong> ${escHtml(ev.recomendacionInmediata)}</p>
              ${ev.sintomasDetectados.length > 0 ? `
                <div class="dm-symptom-chips">
                  ${ev.sintomasDetectados.map(s => `<span class="dm-symptom-chip"><i class="fas fa-bolt"></i> ${escHtml(s)}</span>`).join('')}
                </div>
              ` : ''}
            </div>

            <!-- Tarjeta de Conexión Wearable & Simulador -->
            <div class="dc-card" style="margin-bottom:20px;">
              <div class="dc-card-header">
                <div class="dc-card-title">
                  <i class="fab fa-bluetooth-b" style="color:#2563eb;"></i>
                  <span>Dispositivo Wearable &amp; Simulador de Pruebas</span>
                </div>
                <span class="dc-kpi-badge ${bleOn ? 'success' : 'info'}">
                  ${bleOn ? `BLE Conectado · ${escHtml(this.dispositivoNombre)}` : escHtml(this.dispositivoNombre)}
                </span>
              </div>

              <div class="dm-device-type-pills">
                <button type="button" class="dm-device-pill ${this.dispositivoTipo === 'reloj_inteligente' ? 'active' : ''}" onclick="window.monitoreoWearable.seleccionarTipoDispositivo('reloj_inteligente')">
                  <i class="fas fa-clock"></i>
                  <span>Reloj Inteligente</span>
                </button>
                <button type="button" class="dm-device-pill ${this.dispositivoTipo === 'anillo_inteligente' ? 'active' : ''}" onclick="window.monitoreoWearable.seleccionarTipoDispositivo('anillo_inteligente')">
                  <i class="fas fa-ring"></i>
                  <span>Anillo Inteligente</span>
                </button>
                <button type="button" class="dm-device-pill ${this.dispositivoTipo === 'banda_fitness' ? 'active' : ''}" onclick="window.monitoreoWearable.seleccionarTipoDispositivo('banda_fitness')">
                  <i class="fas fa-running"></i>
                  <span>Banda / Pulsera</span>
                </button>
              </div>

              <div class="dm-ble-actions">
                ${bleOn ? `
                  <button type="button" class="dm-btn-ble danger" onclick="window.monitoreoWearable.desconectarBluetoothBLE()">
                    <i class="fas fa-unlink"></i> Desconectar Bluetooth BLE
                  </button>
                ` : `
                  <button type="button" class="dm-btn-ble primary" onclick="window.monitoreoWearable.conectarBluetoothBLE()">
                    <i class="fab fa-bluetooth-b"></i> Conectar Reloj / Sensor BLE
                  </button>
                `}
                <button type="button" class="dm-btn-ble ${this.monitorContinuoActivo ? 'danger' : 'teal'}" onclick="window.monitoreoWearable.toggleMonitorContinuo()">
                  <i class="fas ${this.monitorContinuoActivo ? 'fa-pause' : 'fa-play'}"></i>
                  ${this.monitorContinuoActivo ? 'Pausar Monitor Continuo' : 'Iniciar Monitor Continuo'}
                </button>
              </div>

              <div style="font-size:11.5px; color:#64748b; line-height:1.45; margin-bottom:10px;">
                <i class="fas fa-plug" style="color:#0d9488;"></i>
                <strong>Conexión Bluetooth BLE:</strong> Perfiles estándar <code>0x180D</code> (Ritmo Cardíaco) + <code>0x1809</code> (Temperatura)
                ${bleCompatible ? '<span style="color:#16a34a; font-weight:700;">· Web Bluetooth disponible aquí</span>' : '· Disponible en Chrome/Edge HTTPS o vía puente nativo <code>DiaMonWearableBridge</code>'}.
              </div>

              <!-- Conector API HTTP para Relojes Inteligentes (Wear OS / MacroDroid / Atajos / ESP32) -->
              <div style="background:#f0fdfa; border:1px solid #99f6e4; border-radius:12px; padding:12px; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:6px;">
                  <strong style="font-size:12px; color:#0f766e;">
                    <i class="fas fa-wifi"></i> Enlace API para Reloj Inteligente (Código: <code>${escHtml(pac.codigoPaciente || 'DM-8492')}</code>)
                  </strong>
                  <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button type="button" class="dm-btn-ble ${this.escuchaApiActiva ? 'danger' : 'teal'}" style="flex:0 0 auto; min-width:auto; padding:6px 10px; font-size:11.5px;" onclick="window.monitoreoWearable.toggleEscuchaApiReloj()">
                      <i class="fas ${this.escuchaApiActiva ? 'fa-stop' : 'fa-satellite-dish'}"></i> ${this.escuchaApiActiva ? 'Detener API en Vivo' : 'Escuchar Reloj (API)'}
                    </button>
                    <button type="button" class="dm-btn-ble outline" style="flex:0 0 auto; min-width:auto; padding:6px 10px; font-size:11.5px;" onclick="window.monitoreoWearable.probarEnvioApiReloj()">
                      <i class="fas fa-paper-plane"></i> Probar POST
                    </button>
                  </div>
                </div>
                <div style="font-size:11px; color:#334155; line-height:1.45;">
                  Envía lecturas desde tu reloj (Wear OS, Gadgetbridge, MacroDroid, Atajos iOS o ESP32) a <code>POST /api/wearable</code>:
                  <code style="display:block; margin-top:4px; background:#061b2e; color:#5eead4; padding:7px 9px; border-radius:8px; font-size:10.5px; overflow-x:auto;">{"codigoPaciente":"${escHtml(pac.codigoPaciente || 'DM-8492')}","bpm":114,"temperaturaC":35.5,"dispositivo":"Mi Reloj"}</code>
                </div>
              </div>

              <!-- Controles interactivos para probar detección -->
              <div class="dm-sim-controls">
                <div style="font-size:12.5px; font-weight:800; color:#0f172a; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                  <span><i class="fas fa-sliders-h" style="color:#0d9488;"></i> Probar Detección Preventiva</span>
                  <label style="font-size:11.5px; font-weight:600; color:#475569; display:inline-flex; align-items:center; gap:5px; cursor:pointer;">
                    <input type="checkbox" id="dmCheckSoloPulso" ${this.soloPulsoSinTemp ? 'checked' : ''} onchange="window.monitoreoWearable.toggleSoloPulsoSinTemp(this.checked); window.monitoreoWearable.actualizarLabelsSliders();">
                    Reloj solo con ritmo cardíaco
                  </label>
                </div>

                <div class="dm-slider-row">
                  <div class="dm-slider-header">
                    <span>Ritmo Cardíaco (BPM)</span>
                    <span id="dmSliderBpmLabel" style="color:#dc2626;">${lec.ritmoCardiacoBpm} BPM</span>
                  </div>
                  <input type="range" id="dmSliderBpm" min="40" max="155" step="1" value="${lec.ritmoCardiacoBpm}" oninput="window.monitoreoWearable.actualizarLabelsSliders()">
                </div>

                <div class="dm-slider-row">
                  <div class="dm-slider-header">
                    <span>Temperatura Corporal (°C)</span>
                    <span id="dmSliderTempLabel" style="color:#0284c7;">${this.soloPulsoSinTemp ? 'Desactivado (Solo pulso)' : `${(lec.temperaturaC ?? 36.5).toFixed(1)} °C`}</span>
                  </div>
                  <input type="range" id="dmSliderTemp" min="34.5" max="39.8" step="0.1" value="${lec.temperaturaC ?? 36.5}" ${this.soloPulsoSinTemp ? 'disabled' : ''} oninput="window.monitoreoWearable.actualizarLabelsSliders()">
                </div>

                <button type="button" class="dm-btn-ble teal" style="width:100%; margin-bottom:8px;" onclick="window.monitoreoWearable.evaluarDesdeSliders()">
                  <i class="fas fa-stethoscope"></i> Evaluar Lectura Biométrica Ahora
                </button>

                <div class="dm-scenario-grid">
                  <button type="button" class="dm-scenario-btn hypo" onclick="window.monitoreoWearable.aplicarEscenarioRapido('hipoglucemia')">
                    <i class="fas fa-arrow-down"></i>
                    <div>
                      <div>Posible Bajada de Azúcar</div>
                      <div style="font-size:10.5px; font-weight:500;">114 BPM · 35.5 °C (Sudor frío)</div>
                    </div>
                  </button>
                  <button type="button" class="dm-scenario-btn hyper" onclick="window.monitoreoWearable.aplicarEscenarioRapido('hiperglucemia')">
                    <i class="fas fa-arrow-up"></i>
                    <div>
                      <div>Posible Subida de Azúcar</div>
                      <div style="font-size:10.5px; font-weight:500;">108 BPM · 38.2 °C (Temp. alta)</div>
                    </div>
                  </button>
                  <button type="button" class="dm-scenario-btn hr-only" onclick="window.monitoreoWearable.aplicarEscenarioRapido('solo_pulso_critico')">
                    <i class="fas fa-heartbeat"></i>
                    <div>
                      <div>Solo Pulso Crítico</div>
                      <div style="font-size:10.5px; font-weight:500;">124 BPM · Sin sensor temp.</div>
                    </div>
                  </button>
                  <button type="button" class="dm-scenario-btn normal" onclick="window.monitoreoWearable.aplicarEscenarioRapido('estable')">
                    <i class="fas fa-check-circle"></i>
                    <div>
                      <div>Restaurar Estable</div>
                      <div style="font-size:10.5px; font-weight:500;">${this.baseline.bpmReposo} BPM · ${this.baseline.tempBaseC.toFixed(1)} °C</div>
                    </div>
                  </button>
                </div>
              </div>

              <!-- Tendencia Biométrica Sparkline -->
              <div class="dm-sparkline-box">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:11.5px; font-weight:700; color:#475569;">
                  <span><i class="fas fa-chart-area" style="color:#0d9488;"></i> Tendencia Reciente (Últimas ${Math.min(12, this.lecturas.length)} lecturas)</span>
                  <span><span style="color:#dc2626;">● Pulso (BPM)</span> · <span style="color:#0284c7;">● Temp (°C)</span></span>
                </div>
                ${this.generarSparklineSVG()}
              </div>
            </div>
          </div>

          <!-- COLUMNA DERECHA: PANEL EN VIVO DEL CUIDADOR + BASELINE + HISTORIAL -->
          <div>
            <!-- Panel Receptor en Vivo del Cuidador -->
            <div id="dmCaregiverLivePanel" class="dm-caregiver-panel ${this.obtenerClasePanelCuidador()}" style="margin-bottom:20px;">
              ${this.generarHtmlPanelCuidador(pac)}
            </div>

            <!-- Configuración de Línea Base Personalizada -->
            <div class="dc-card" style="margin-bottom:20px;">
              <div class="dc-card-header">
                <div class="dc-card-title">
                  <i class="fas fa-sliders-h"></i>
                  <span>Línea Base y Umbrales del Paciente</span>
                </div>
              </div>
              <form onsubmit="window.monitoreoWearable.guardarBaselineDesdeFormulario(event)">
                <div class="dm-baseline-grid">
                  <div class="dm-baseline-field">
                    <label for="dmBaseBpmReposo">Pulso Reposo (BPM)</label>
                    <input type="number" id="dmBaseBpmReposo" min="45" max="110" value="${this.baseline.bpmReposo}">
                  </div>
                  <div class="dm-baseline-field">
                    <label for="dmBaseBpmAlta">Alerta Pulso Alto</label>
                    <input type="number" id="dmBaseBpmAlta" min="85" max="150" value="${this.baseline.bpmAlertaAlta}">
                  </div>
                  <div class="dm-baseline-field">
                    <label for="dmBaseBpmBaja">Alerta Pulso Bajo</label>
                    <input type="number" id="dmBaseBpmBaja" min="35" max="65" value="${this.baseline.bpmAlertaBaja}">
                  </div>
                  <div class="dm-baseline-field">
                    <label for="dmBaseTempNormal">Temp. Base (°C)</label>
                    <input type="number" id="dmBaseTempNormal" step="0.1" min="35.5" max="37.5" value="${this.baseline.tempBaseC}">
                  </div>
                  <div class="dm-baseline-field">
                    <label for="dmBaseTempBaja">Umbral Temp. Baja</label>
                    <input type="number" id="dmBaseTempBaja" step="0.1" min="34.0" max="36.3" value="${this.baseline.tempBajaC}">
                  </div>
                  <div class="dm-baseline-field">
                    <label for="dmBaseTempAlta">Umbral Temp. Alta</label>
                    <input type="number" id="dmBaseTempAlta" step="0.1" min="37.2" max="39.5" value="${this.baseline.tempAltaC}">
                  </div>
                </div>
                <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:10px; margin-top:12px; flex-wrap:wrap;">
                  <div class="dm-baseline-field" style="flex:1; min-width:170px;">
                    <label for="dmBaseTiempoSeg">Espera antes de enviar GPS al cuidador (seg)</label>
                    <input type="number" id="dmBaseTiempoSeg" min="15" max="180" value="${this.baseline.tiempoRespuestaSegundos}">
                  </div>
                  <button type="submit" class="dm-btn-ble teal" style="flex:0 0 auto; min-width:150px;">
                    <i class="fas fa-save"></i> Guardar Umbrales
                  </button>
                </div>
              </form>
            </div>

            <!-- Historial de Alertas Preventivas y Respuestas -->
            <div class="dc-card">
              <div class="dc-card-header">
                <div class="dc-card-title">
                  <i class="fas fa-history"></i>
                  <span>Historial de Alertas Preventivas</span>
                </div>
                <span style="font-size:11.5px; color:#64748b;">${this.incidentes.length} evento(s)</span>
              </div>
              <div class="dm-preventive-log-list">
                ${this.generarHtmlHistorialIncidentes()}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    obtenerClasePanelCuidador() {
      if (this.estadoCuidador.fase === 'alarma_simultanea') return 'waiting-patient';
      if (this.estadoCuidador.fase === 'escalada_emergencia') return 'escalated-emergency';
      if (this.estadoCuidador.fase === 'confirmado_bien') return 'confirmed-safe';
      return '';
    }

    generarHtmlPanelCuidador(pac) {
      const st = this.estadoCuidador;

      if (st.fase === 'alarma_simultanea' && st.incidente) {
        const inc = st.incidente;
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
            <div>
              <span style="background:#fef3c7; color:#b45309; font-size:11px; font-weight:800; padding:3px 9px; border-radius:999px; text-transform:uppercase;">
                <i class="fas fa-bell fa-shake"></i> Vista del Cuidador · Alarma Simultánea
              </span>
              <h3 style="font-size:16px; font-weight:800; color:#0f172a; margin:6px 0 0 0;">
                ${escHtml(inc.evaluacion.titulo)}
              </h3>
            </div>
            <div class="dm-caregiver-countdown-pill">
              <i class="far fa-clock"></i>
              <span id="dmCaregiverCountdown">${formatearTiempoMMSS(st.segundosRestantes)}</span>
            </div>
          </div>

          <p style="font-size:13px; color:#334155; margin:0 0 10px 0; line-height:1.5;">
            Se activó la alerta simultánea para <strong>${escHtml(inc.paciente.nombre)}</strong> y su cuidador <strong>${escHtml(inc.paciente.cuidadorPrincipal)}</strong>.
            Esperando confirmación de bienestar del paciente...
          </p>

          <div style="background:#ffffff; border:1px dashed #f59e0b; border-radius:10px; padding:10px 12px; font-size:12px; color:#78350f;">
            <i class="fas fa-lock"></i>
            <strong>Protocolo de 1 minuto:</strong> Si ${escHtml(inc.paciente.nombre)} no presiona <em>"Estoy bien"</em> antes de llegar a <strong>00:00</strong>, recibirás automáticamente aquí su <strong>ubicación GPS exacta</strong> y el <strong>reporte completo de síntomas</strong>.
          </div>

          ${this.vistaRol === 'cuidador' ? `
            <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
              <button type="button" class="dm-btn-ble outline" onclick="window.monitoreoWearable.escalarPorFaltaDeRespuesta('Simulación de vencimiento de 1 minuto desde vista Cuidador.')">
                <i class="fas fa-forward"></i> Simular vencimiento de 1 min
              </button>
            </div>
          ` : ''}
        `;
      }

      if (st.fase === 'confirmado_bien' && st.incidente) {
        const inc = st.incidente;
        return `
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
            <div style="width:40px; height:40px; border-radius:50%; background:#dcfce7; color:#16a34a; display:flex; align-items:center; justify-content:center; font-size:20px;">
              <i class="fas fa-check-circle"></i>
            </div>
            <div>
              <span style="font-size:11px; font-weight:800; color:#15803d; text-transform:uppercase;">Confirmación recibida a tiempo</span>
              <h3 style="font-size:16px; font-weight:800; color:#0f172a; margin:0;">
                ${escHtml(inc.paciente.nombre)} confirmó que está bien
              </h3>
            </div>
          </div>
          <p style="font-size:13px; color:#334155; margin:0; line-height:1.5;">
            Respondió en <strong>${inc.segundosRespuesta || 1} segundo(s)</strong> ante la alerta preventiva (${inc.lectura.ritmoCardiacoBpm} BPM${inc.lectura.temperaturaC !== null ? ` · ${inc.lectura.temperaturaC} °C` : ''}).
            No fue necesario escalar emergencia ni enviar rescate.
          </p>
        `;
      }

      if (st.fase === 'escalada_emergencia' && st.paqueteEscalamiento) {
        const p = st.paqueteEscalamiento;
        const telClean = (p.paciente.telefonoCuidador || '+573004567890').replace(/\s+/g, '');
        const waText = encodeURIComponent(
          `🚨 ALERTA DIAMON (Sin respuesta tras 1 min): ${p.paciente.nombre} presenta ${p.titulo}. ` +
          `Síntomas: ${p.sintomasDetectados.join('; ')}. ` +
          `Ubicación GPS: ${p.ubicacion.zona} (${p.ubicacion.googleMapsUrl})`
        );

        return `
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:10px;">
            <div>
              <span style="background:#dc2626; color:#ffffff; font-size:11px; font-weight:800; padding:3px 10px; border-radius:999px; text-transform:uppercase;">
                <i class="fas fa-ambulance"></i> EMERGENCIA ESCALADA AL CUIDADOR
              </span>
              <h3 style="font-size:17px; font-weight:900; color:#991b1b; margin:6px 0 2px 0;">
                ${escHtml(p.titulo)}
              </h3>
              <div style="font-size:12px; color:#7f1d1d; font-weight:600;">${escHtml(p.motivo)}</div>
            </div>
          </div>

          <!-- UBICACIÓN GPS RECIBIDA -->
          <div class="dm-caregiver-location-box">
            <div style="font-size:11.5px; font-weight:800; color:#dc2626; text-transform:uppercase; margin-bottom:4px;">
              <i class="fas fa-map-marker-alt"></i> Ubicación GPS Recibida
            </div>
            <div style="font-size:15px; font-weight:800; color:#0f172a;">${escHtml(p.ubicacion.zona)}</div>
            <div style="font-size:12px; color:#475569; margin-top:2px;">
              Lat: <strong>${Number(p.ubicacion.lat).toFixed(5)}</strong> · Lng: <strong>${Number(p.ubicacion.lng).toFixed(5)}</strong> (±${p.ubicacion.precision}m)
            </div>
          </div>

          <!-- SÍNTOMAS RECIBIDOS -->
          <div style="background:#ffffff; border:1px solid #fecaca; border-radius:12px; padding:12px 14px;">
            <div style="font-size:11.5px; font-weight:800; color:#b91c1c; text-transform:uppercase; margin-bottom:6px;">
              <i class="fas fa-notes-medical"></i> Síntomas Biométricos Detectados (${escHtml(p.signosVitales.dispositivoNombre)})
            </div>
            <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:8px; font-size:13px;">
              <span>❤️ <strong>${p.signosVitales.ritmoCardiacoBpm} BPM</strong> (${p.signosVitales.deltaBpm >= 0 ? '+' : ''}${p.signosVitales.deltaBpm})</span>
              <span>🌡️ <strong>${p.signosVitales.temperaturaC !== null ? `${p.signosVitales.temperaturaC.toFixed(1)} °C` : 'Solo pulso'}</strong></span>
            </div>
            <ul style="margin:0 0 8px 18px; padding:0; font-size:12.5px; color:#334155;">
              ${p.sintomasDetectados.map(s => `<li>${escHtml(s)}</li>`).join('')}
            </ul>
            <div style="font-size:12px; color:#0f172a; background:#fef2f2; padding:8px 10px; border-radius:8px;">
              <strong>Acción clínica sugerida:</strong> ${escHtml(p.recomendacionInmediata)}
            </div>
          </div>

          <div class="dm-caregiver-actions">
            <button type="button" class="dm-cg-action-btn" style="background:#2563eb; color:#ffffff;" onclick="window.verAlertaEnMapa(${p.ubicacion.lat}, ${p.ubicacion.lng}, '${escHtml(p.titulo)}')">
              <i class="fas fa-map-marked-alt"></i> Ver en Mapa GPS
            </button>
            <a href="${p.ubicacion.googleMapsUrl}" target="_blank" rel="noopener" class="dm-cg-action-btn" style="background:#0f172a; color:#ffffff;">
              <i class="fas fa-external-link-alt"></i> Google Maps
            </a>
            <a href="https://wa.me/${telClean.replace(/\D/g, '')}?text=${waText}" target="_blank" rel="noopener" class="dm-cg-action-btn" style="background:#16a34a; color:#ffffff;">
              <i class="fab fa-whatsapp"></i> Enviar Reporte WA
            </a>
            <a href="tel:123" class="dm-cg-action-btn" style="background:#dc2626; color:#ffffff;">
              <i class="fas fa-phone-alt"></i> Urgencias 123
            </a>
          </div>
          <button type="button" class="dm-btn-ble outline" style="width:100%; margin-top:8px;" onclick="window.monitoreoWearable.marcarEmergenciaCuidadorAtendida()">
            <i class="fas fa-check"></i> Marcar Emergencia como Atendida
          </button>
        `;
      }

      // Estado normal en espera
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="dm-status-pulse"></span>
            <h3 style="font-size:15.5px; font-weight:800; color:#0f172a; margin:0;">
              Panel en Vivo del Cuidador
            </h3>
          </div>
          <span class="dc-kpi-badge success">Escuchando 24/7</span>
        </div>
        <p style="font-size:12.5px; color:#475569; margin:0 0 10px 0; line-height:1.5;">
          Cuidador asignado: <strong>${escHtml(pac.cuidadorPrincipal)}</strong>.
          Cuando el reloj o anillo de <strong>${escHtml(pac.nombre)}</strong> detecte alteración de pulso/temperatura:
        </p>
        <div style="display:grid; grid-template-columns:1fr; gap:6px; font-size:12px; color:#334155;">
          <div style="background:#f8fafc; border-radius:8px; padding:8px 10px;">
            <strong>1. Alarma Simultánea (0s):</strong> Suena al mismo tiempo al paciente y aquí al cuidador.
          </div>
          <div style="background:#f8fafc; border-radius:8px; padding:8px 10px;">
            <strong>2. Ventana de 1 Minuto (60s):</strong> El paciente puede pulsar <em>"Estoy bien"</em> para cancelar el escalamiento.
          </div>
          <div style="background:#f8fafc; border-radius:8px; padding:8px 10px;">
            <strong>3. Sin Respuesta (60s):</strong> Se liberan automáticamente la <strong>ubicación GPS</strong> y los <strong>síntomas completos</strong>.
          </div>
        </div>
      `;
    }

    generarSparklineSVG() {
      const recientes = this.lecturas.slice(0, 12).reverse();
      if (recientes.length < 2) {
        return '<div style="font-size:12px; color:#64748b; text-align:center; padding:14px;">Esperando más lecturas...</div>';
      }

      const w = 360;
      const h = 92;
      const padX = 16;
      const stepX = (w - padX * 2) / Math.max(1, recientes.length - 1);

      const hrPoints = recientes.map((r, i) => {
        const x = padX + i * stepX;
        const clamped = Math.max(45, Math.min(145, r.ritmoCardiacoBpm));
        const y = h - 14 - ((clamped - 45) / 100) * (h - 26);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');

      const tempPoints = recientes
        .map((r, i) => {
          if (r.temperaturaC === null || r.temperaturaC === undefined) return null;
          const x = padX + i * stepX;
          const clamped = Math.max(34.5, Math.min(39.5, r.temperaturaC));
          const y = h - 14 - ((clamped - 34.5) / 5.0) * (h - 26);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .filter(Boolean)
        .join(' ');

      return `
        <svg viewBox="0 0 ${w} ${h}" style="width:100%; height:92px; display:block;" role="img" aria-label="Tendencia de ritmo cardíaco y temperatura">
          <line x1="${padX}" y1="20" x2="${w - padX}" y2="20" stroke="#e2e8f0" stroke-dasharray="3,3" />
          <line x1="${padX}" y1="50" x2="${w - padX}" y2="50" stroke="#e2e8f0" stroke-dasharray="3,3" />
          <line x1="${padX}" y1="78" x2="${w - padX}" y2="78" stroke="#e2e8f0" />
          <polyline fill="none" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${hrPoints}" />
          ${tempPoints ? `<polyline fill="none" stroke="#0284c7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4,3" points="${tempPoints}" />` : ''}
        </svg>
      `;
    }

    generarHtmlHistorialIncidentes() {
      if (this.incidentes.length === 0) {
        return `
          <div style="text-align:center; padding:20px 10px; color:#64748b; font-size:12.5px;">
            <i class="fas fa-shield-alt" style="font-size:24px; color:#16a34a; display:block; margin-bottom:6px;"></i>
            Aún no se han registrado alertas biométricas preventivas. Usa los escenarios de prueba para validar el protocolo de 60 segundos.
          </div>
        `;
      }

      return this.incidentes.map(inc => {
        const hora = new Date(inc.iniciadoEnTs || Date.now()).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        const esConfirmado = inc.estado === 'CONFIRMADO_BIEN';
        const esEscalado = inc.estado === 'ESCALADA_A_CUIDADOR';
        const badgeCls = esConfirmado ? 'success' : (esEscalado ? 'danger' : 'info');
        const badgeTxt = esConfirmado
          ? `Confirmado bien (${inc.segundosRespuesta || 1}s)`
          : (esEscalado ? 'Escalada c/ GPS + Síntomas' : 'Atendida');
        const tempTxt = inc.lectura?.temperaturaC !== null && inc.lectura?.temperaturaC !== undefined
          ? `${inc.lectura.temperaturaC} °C`
          : 'Solo pulso';

        return `
          <div class="dm-preventive-log-item">
            <div style="min-width:0;">
              <div style="font-size:13px; font-weight:800; color:#0f172a;">${escHtml(inc.evaluacion?.titulo || 'Alerta Biométrica')}</div>
              <div style="font-size:12px; color:#475569; margin-top:2px;">
                ${inc.lectura?.ritmoCardiacoBpm} BPM · ${tempTxt} · ${escHtml(inc.motivoCierre || '')}
              </div>
              ${inc.ubicacionEscalamiento ? `
                <div style="font-size:11.5px; color:#dc2626; margin-top:4px; font-weight:600;">
                  <i class="fas fa-map-marker-alt"></i> ${escHtml(inc.ubicacionEscalamiento.zona)}
                </div>
              ` : ''}
            </div>
            <div style="text-align:right; flex-shrink:0;">
              <span class="dc-kpi-badge ${badgeCls}" style="font-size:10.5px;">${badgeTxt}</span>
              <div style="font-size:11px; color:#94a3b8; margin-top:4px;">${hora}</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    window.monitoreoWearable = new MonitoreoPreventivoWearableController();
    window.monitoreoWearable.renderizarTodo();
  });
})();
