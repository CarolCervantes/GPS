// Logica principal del caso de estudio (diabetes, hipertension y GPS en Chapacua)
(function () {
  'use strict';

  const STORAGE_KEYS = {
    PACIENTE: 'diamon_damian_paciente_v5',
    METAS: 'diamon_damian_metas_v5',
    GLUCOSA: 'diamon_damian_glucosa_v5',
    PRESION: 'diamon_damian_presion_v5',
    MEDICAMENTOS: 'diamon_damian_meds_v5',
    ZONAS: 'diamon_damian_zonas_v5',
    REGISTROS: 'diamon_damian_registros_v5'
  };

  // Canales para sincronizar entre pestañas y entre dispositivos
  const syncChannel = ('BroadcastChannel' in window) ? new BroadcastChannel('diamon_telemetria_sync') : null;
  let supabaseLiveChannel = null;

  // Datos base del paciente del caso de estudio
  const PACIENTE_CASO_DEFAULT = {
    id: 'pac-damian-diaz-01',
    codigoPaciente: 'DM-8492',
    nombre: 'Damián Díaz Balseiro',
    edad: 74,
    parentesco: 'Abuelo / Paciente del Caso de Estudio',
    diagnosticoPrincipal: 'Diabetes Mellitus Tipo 2 Insulinorrequiriente + Hipertensión Arterial + Neuropatía Diabética',
    grupoSanguineo: 'O+',
    pesoKg: 73,
    alergias: 'Ninguna alergia medicamentosa reportada',
    eps: 'EPS / Red Asistencial Cartagena de Indias',
    centroReferencia: 'Hospital Universitario del Caribe / Clínica Blas de Lezo',
    profesionalGuia: 'Enf. Jefe Elizabeth Vargas Caro',
    registroProfesional: 'Guía Clínica Adulto Mayor · Control Glucémico y Cardiovascular',
    cuidadorPrincipal: 'Familiar / Cuidador Principal',
    telefonoCuidador: '+57 300 456 7890',
    telefonoEmergencia2: '+57 310 987 6543',
    barrioResidencia: 'Barrio Chapacuá, Cartagena de Indias',
    coordenadasCasa: { lat: 10.39991, lng: -75.47886 },
    radioSeguroMetros: 400
  };

  const ZONAS_SEGURAS_DEFAULT = [
    {
      id: 1,
      nombre: 'Casa Damián Díaz — Barrio Chapacuá',
      centro_lat: 10.39991,
      centro_lng: -75.47886,
      radio_metros: 400,
      nivel_riesgo: 'bajo',
      activa: true
    }
  ];

  // Metas clínicas pautadas con la Enf. Jefe Elizabeth Vargas Caro
  const METAS_CASO_DEFAULT = {
    glucosaMin: 80,           // < 80 mg/dL alerta preventiva en adulto mayor con Insulina 24 UI
    glucosaMetaAyunas: 135,   // Meta en ayunas: 80 - 135 mg/dL
    glucosaMaxPost: 180,      // Meta postprandial 2h: < 180 mg/dL
    glucosaCriticaAlta: 240,  // Hiperglucemia crítica
    sistolicaMin: 95,
    sistolicaMax: 140,        // Meta HTA (con Valsartán + Nifedipino): < 140/90 mmHg
    sistolicaCritica: 160,    // Crisis hipertensiva
    diastolicaMin: 60,
    diastolicaMax: 90,
    diastolicaCritica: 100
  };

  // Esquema farmacológico real completo de Damián Díaz Balseiro
  const ESQUEMA_MEDICAMENTOS_DAMIAN = [
    {
      id: 'med-8am-bloque',
      nombre: 'Pantoprazol + Metformina + Firialta + Nifedipina',
      indicacion: 'Protector gástrico · Diabetes · Protección renal/cardiovascular · Hipertensión',
      horario: '08:00 AM',
      dosis: 'Esquema matutino completo (4 medicamentos)',
      momento: 'Mañana (8:00 AM)',
      icono: 'fa-sun',
      color: 'teal',
      itemsDetalle: ['Pantoprazol (Ayunas)', 'Metformina', 'Firialta (Finerenona)', 'Nifedipina']
    },
    {
      id: 'med-2pm-valsartan',
      nombre: 'Valsartán',
      indicacion: 'Control de Hipertensión Arterial (ARA-II)',
      horario: '02:00 PM',
      dosis: '1 toma vespertina',
      momento: 'Tarde (2:00 PM)',
      icono: 'fa-heartbeat',
      color: 'blue',
      itemsDetalle: ['Valsartán (2:00 PM)']
    },
    {
      id: 'med-8pm-bloque',
      nombre: 'Atorvastatina + Metformina + Gabapentina + Lipotic + Nifedipino',
      indicacion: 'Colesterol · Diabetes · Neuropatía periférica (Gabapentina + Ácido Tióctico) · HTA',
      horario: '08:00 PM',
      dosis: 'Esquema nocturno oral (5 medicamentos)',
      momento: 'Noche (8:00 PM)',
      icono: 'fa-moon',
      color: 'amber',
      itemsDetalle: ['Atorvastatina', 'Metformina', 'Gabapentina', 'Lipotic', 'Nifedipino']
    },
    {
      id: 'med-9pm-insulina',
      nombre: 'Insulina Basal — 24 Unidades',
      indicacion: 'Control glucémico basal nocturno (vía subcutánea)',
      horario: '09:00 PM',
      dosis: '24 UI subcutáneas a las 9:00 PM',
      momento: 'Noche (9:00 PM)',
      icono: 'fa-syringe',
      color: 'red',
      itemsDetalle: ['Insulina 24 Unidades (9:00 PM)']
    },
    {
      id: 'med-sab-ozempic',
      nombre: 'Ozempic (Semaglutida Semanal)',
      indicacion: 'Agonista GLP-1 · Control glucémico y protección cardiovascular semanal',
      horario: 'Sábados',
      dosis: 'Aplicación subcutánea 1 vez por semana (Sábados)',
      momento: 'Semanal (Sábados)',
      icono: 'fa-calendar-check',
      color: 'purple',
      itemsDetalle: ['Ozempic — Dosis de los Sábados']
    }
  ];

  // Historial real de 7 días de Damián Díaz Balseiro en Chapacuá
  function generarHistorialInicialGlucosa() {
    const ahora = Date.now();
    const h = 3600 * 1000;
    return [
      { id: 'gl-1', valor: 114, contexto: 'ayunas', ContextoLabel: 'En ayunas (8:00 AM)', notas: 'Buena respuesta a las 24 UI de insulina de las 9:00 PM. Tomó esquema de 8 AM.', ts: ahora - 2 * h },
      { id: 'gl-2', valor: 146, contexto: 'postprandial_2h', ContextoLabel: '2h después de almuerzo', notas: 'Estable en casa en Chapacuá. Tomó Valsartán de las 2:00 PM.', ts: ahora - 18 * h },
      { id: 'gl-3', valor: 109, contexto: 'ayunas', ContextoLabel: 'En ayunas (8:00 AM)', notas: 'Sin síntomas de hipoglucemia nocturna.', ts: ahora - 26 * h },
      { id: 'gl-4', valor: 158, contexto: 'nocturna', ContextoLabel: 'Antes de Insulina 9:00 PM', notas: 'Se aplicaron 24 unidades de insulina tras esquema oral de 8:00 PM.', ts: ahora - 40 * h },
      { id: 'gl-5', valor: 121, contexto: 'ayunas', ContextoLabel: 'En ayunas', notas: 'Control supervisado según pauta de Enf. Jefe Elizabeth Vargas Caro.', ts: ahora - 50 * h },
      { id: 'gl-6', valor: 138, contexto: 'preprandial', ContextoLabel: 'Antes de almuerzo', notas: 'Caminata suave por Chapacuá. Sin dolor neuropático gracias a Gabapentina + Lipotic.', ts: ahora - 68 * h },
      { id: 'gl-7', valor: 119, contexto: 'ayunas', ContextoLabel: 'Sábado (Día de Ozempic)', notas: 'Aplicación semanal de Ozempic completada sin novedades.', ts: ahora - 92 * h }
    ];
  }

  function generarHistorialInicialPresion() {
    const ahora = Date.now();
    const h = 3600 * 1000;
    return [
      { id: 'pa-1', sistolica: 126, diastolica: 78, pulso: 71, brazo: 'izquierdo', postura: 'sentado', notas: 'Control posterior a Nifedipina (8:00 AM). En meta (<140/90 mmHg).', ts: ahora - 2 * h },
      { id: 'pa-2', sistolica: 132, diastolica: 80, pulso: 74, brazo: 'izquierdo', postura: 'sentado', notas: 'Toma de la tarde tras Valsartán (2:00 PM).', ts: ahora - 19 * h },
      { id: 'pa-3', sistolica: 128, diastolica: 76, pulso: 70, brazo: 'izquierdo', postura: 'sentado', notas: 'Toma nocturna posterior a Nifedipino (8:00 PM).', ts: ahora - 42 * h },
      { id: 'pa-4', sistolica: 138, diastolica: 86, pulso: 77, brazo: 'izquierdo', postura: 'sentado', notas: 'Tarde calurosa en Chapacuá, Cartagena. Se mantuvo hidratado.', ts: ahora - 66 * h },
      { id: 'pa-5', sistolica: 124, diastolica: 76, pulso: 69, brazo: 'izquierdo', postura: 'sentado', notas: 'Presión arterial óptima.', ts: ahora - 90 * h }
    ];
  }

  // Recorridos reales de Damián Díaz Balseiro desde su casa en Chapacuá (10.39991, -75.47886)
  const RECORRIDOS_CHAPACUA = {
    parque: {
      nombre: 'Recorrido en Chapacuá: Casa (10.39991, -75.47886) → Parque → Droguería',
      puntos: [
        { lat: 10.39991, lng: -75.47886, etiqueta: 'Casa Damián Díaz — Barrio Chapacuá' },
        { lat: 10.40045, lng: -75.47830, etiqueta: 'Calle Residencial Chapacuá (85m de casa)' },
        { lat: 10.40110, lng: -75.47775, etiqueta: 'Parque / Cancha de Chapacuá (180m de casa)' },
        { lat: 10.40160, lng: -75.47710, etiqueta: 'Droguería & Tienda Chapacuá (270m)' }
      ]
    },
    salida_geocerca: {
      nombre: 'Salida del perímetro de Chapacuá (> 400m)',
      puntos: [
        { lat: 10.39991, lng: -75.47886, etiqueta: 'Casa en Chapacuá (Inicio)' },
        { lat: 10.40190, lng: -75.48090, etiqueta: 'Salida de Chapacuá (315m)' },
        { lat: 10.40410, lng: -75.48380, etiqueta: 'Av. La Cordialidad / Transversal 54 (715m — Fuera de zona)' }
      ]
    }
  };

  // ============================================================
  // 2. GESTOR CENTRAL DEL CASO DE ESTUDIO + EMISOR GPS REAL
  // ============================================================
  class CasoEstudioManager {
    constructor() {
      this.paciente = this.cargarJSON(STORAGE_KEYS.PACIENTE, PACIENTE_CASO_DEFAULT);
      this.metas = this.cargarJSON(STORAGE_KEYS.METAS, METAS_CASO_DEFAULT);
      this.glucosas = this.cargarJSON(STORAGE_KEYS.GLUCOSA, generarHistorialInicialGlucosa());
      this.presiones = this.cargarJSON(STORAGE_KEYS.PRESION, generarHistorialInicialPresion());
      this.zonas = this.cargarJSON(STORAGE_KEYS.ZONAS, ZONAS_SEGURAS_DEFAULT);
      this.simulacionTimer = null;
      this.gpsLiveWatchId = null;
      this.transmitiendoGPSReal = false;
      this.modoAdultoMayor = false;
      this._ultimaAlertaGeocercaMapTs = 0;

      this.sincronizarFichaQROficial();
      this.initSyncChannels();
    }

    obtenerZonasSeguras() {
      this.zonas = this.cargarJSON(STORAGE_KEYS.ZONAS, ZONAS_SEGURAS_DEFAULT);
      return this.zonas;
    }

    guardarZonasSeguras(nuevasZonas) {
      this.zonas = nuevasZonas;
      this.guardarJSON(STORAGE_KEYS.ZONAS, nuevasZonas);
      if (typeof window.dibujarZonasSegurasEnMapaPrincipal === 'function') {
        window.dibujarZonasSegurasEnMapaPrincipal();
      }
      this.emitirPorCanales('ZONAS_ACTUALIZADAS');
    }

    evaluarPosicionEnZonas(lat, lng, dispararAlertaSiSale = false) {
      const activas = this.obtenerZonasSeguras().filter(z => z.activa !== false);
      if (activas.length === 0) {
        return { dentro: true, zonaNombre: 'Sin geocerca activa', distancia: 0 };
      }

      let menorDist = Infinity;
      let zonaCercana = activas[0];

      for (const z of activas) {
        const d = Math.round(this.calcularDistanciaMetros(lat, lng, Number(z.centro_lat), Number(z.centro_lng)));
        if (d < menorDist) {
          menorDist = d;
          zonaCercana = z;
        }
        if (d <= Number(z.radio_metros)) {
          return { dentro: true, zonaNombre: z.nombre, distancia: d, radio: Number(z.radio_metros) };
        }
      }

      // Está fuera de todas las zonas seguras activas
      if (dispararAlertaSiSale && window.emitirAlerta24Horas && (Date.now() - this._ultimaAlertaGeocercaMapTs) > 8000) {
        this._ultimaAlertaGeocercaMapTs = Date.now();
        window.emitirAlerta24Horas({
          titulo: 'Salida de Zona Segura — ' + zonaCercana.nombre,
          subtitulo: `${this.paciente.nombre} está a ${menorDist} metros del centro de ${zonaCercana.nombre} (Radio permitido: ${zonaCercana.radio_metros}m).`,
          tipo: 'geocerca',
          color: 'red',
          icono: 'fas fa-map-marker-alt',
          badgeTexto: 'Fuera de Zona',
          badgeClase: 'badge-pendiente',
          coordenadas: { lat, lng },
          ubicacion: `Coordenadas: ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`,
          descripcion: `El motor de geocercas detectó que la posición actual de ${this.paciente.nombre} (${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}) supera el radio de seguridad de ${zonaCercana.radio_metros}m configurado para "${zonaCercana.nombre}". Distancia medida: ${menorDist} metros.`
        });
      }

      return { dentro: false, zonaNombre: zonaCercana.nombre, distancia: menorDist, radio: Number(zonaCercana.radio_metros) };
    }

    procesarMovimientoMapa(lat, lng) {
      const check = this.evaluarPosicionEnZonas(lat, lng, true);
      const etiqueta = check.dentro
        ? `${check.zonaNombre} (${check.distancia}m del centro)`
        : `Fuera de ${check.zonaNombre} (${check.distancia}m)`;

      if (window.TelemetriaDiaMon) {
        window.TelemetriaDiaMon.ubicacion.lat = lat;
        window.TelemetriaDiaMon.ubicacion.lng = lng;
        window.TelemetriaDiaMon.ubicacion.zona = etiqueta;
        window.TelemetriaDiaMon.gpsFijado = true;
      }

      const ubicEl = document.getElementById('kpiUbicacionVal');
      if (ubicEl) ubicEl.textContent = etiqueta;

      const estadoGeoEl = document.getElementById('casoGeocercaEstado');
      if (estadoGeoEl) {
        if (!check.dentro) {
          estadoGeoEl.className = 'dc-kpi-badge danger';
          estadoGeoEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> Fuera de zona (${check.distancia}m)`;
        } else {
          estadoGeoEl.className = 'dc-kpi-badge success';
          estadoGeoEl.innerHTML = `<i class="fas fa-shield-alt"></i> En zona (${check.distancia}m)`;
        }
      }

      this.emitirPorCanales('GPS_EN_VIVO', {
        lat, lng, precision: 5, etiqueta,
        coords: { lat, lng, precision: 5, etiqueta }
      });
    }

    cargarJSON(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw);
      } catch (_) {}
      localStorage.setItem(key, JSON.stringify(fallback));
      return JSON.parse(JSON.stringify(fallback));
    }

    guardarJSON(key, data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (_) {}
    }

    sincronizarFichaQROficial() {
      if (window.medicalQRManager) {
        window.medicalQRManager.saveProfile({
          nombre: this.paciente.nombre,
          condicion: this.paciente.diagnosticoPrincipal,
          tratamiento: '8AM: Pantoprazol, Metformina, Firialta, Nifedipina | 2PM: Valsartán | 8PM: Atorvastatina, Metformina, Gabapentina, Lipotic, Nifedipino | 9PM: Insulina 24 UI | Sáb: Ozempic',
          glucosaObjetivo: `Glucosa: ${this.metas.glucosaMin}-${this.metas.glucosaMaxPost} mg/dL | PA: < ${this.metas.sistolicaMax}/${this.metas.diastolicaMax} mmHg`,
          grupoSanguineo: this.paciente.grupoSanguineo,
          alergias: this.paciente.alergias,
          contactoNombre: this.paciente.cuidadorPrincipal,
          contactoTelefono: this.paciente.telefonoCuidador,
          medicoTratante: this.paciente.profesionalGuia,
          centroReferencia: this.paciente.centroReferencia,
          notasEmergencia: `Paciente de Chapacuá (Cartagena) en tratamiento con Insulina 24 UI nocturna, Ozempic semanal y antihipertensivos (Valsartán + Nifedipino). Si presenta sudoración fría o mareo estando consciente, aplicar Regla 15-15 (15g de azúcar rápida) y medir tensión arterial.`
        });
      }
    }

    initSyncChannels() {
      // 1. Sincronización instantánea entre pestañas del mismo navegador
      if (syncChannel) {
        syncChannel.onmessage = (event) => {
          const msg = event.data;
          if (!msg || !msg.type) return;
          this.recargarDesdeStorage();
          if (msg.type === 'GPS_EN_VIVO' && msg.coords) {
            this.aplicarCoordenadaRecibida(msg.coords.lat, msg.coords.lng, msg.coords.etiqueta, msg.coords.precision);
          }
          this.actualizarTodaLaUI();
        };
      }

      window.addEventListener('storage', () => {
        this.recargarDesdeStorage();
        this.actualizarTodaLaUI();
      });

      // 2. Sincronización en tiempo real entre DOS CELULARES distintos vía Supabase Realtime Broadcast
      if (window.supabaseClient && typeof window.supabaseClient.channel === 'function') {
        try {
          supabaseLiveChannel = window.supabaseClient.channel('diamon-damian-live');
          supabaseLiveChannel
            .on('broadcast', { event: 'telemetria-damian' }, ({ payload }) => {
              if (!payload) return;
              if (payload.lat && payload.lng) {
                this.aplicarCoordenadaRecibida(payload.lat, payload.lng, payload.etiqueta || 'GPS Móvil en Vivo', payload.precision || 6);
              }
              if (payload.glucosa) {
                this.glucosas.unshift(payload.glucosa);
                this.guardarJSON(STORAGE_KEYS.GLUCOSA, this.glucosas);
              }
              if (payload.presion) {
                this.presiones.unshift(payload.presion);
                this.guardarJSON(STORAGE_KEYS.PRESION, this.presiones);
              }
              this.actualizarTodaLaUI();
            })
            .subscribe();
        } catch (_) {}
      }
    }

    recargarDesdeStorage() {
      this.paciente = this.cargarJSON(STORAGE_KEYS.PACIENTE, PACIENTE_CASO_DEFAULT);
      this.metas = this.cargarJSON(STORAGE_KEYS.METAS, METAS_CASO_DEFAULT);
      this.glucosas = this.cargarJSON(STORAGE_KEYS.GLUCOSA, generarHistorialInicialGlucosa());
      this.presiones = this.cargarJSON(STORAGE_KEYS.PRESION, generarHistorialInicialPresion());
    }

    emitirPorCanales(type, payload = {}) {
      if (syncChannel) {
        try { syncChannel.postMessage({ type, ...payload }); } catch (_) {}
      }
      if (supabaseLiveChannel) {
        try {
          supabaseLiveChannel.send({
            type: 'broadcast',
            event: 'telemetria-damian',
            payload: { type, ...payload }
          });
        } catch (_) {}
      }
    }

    // ============================================================
    // 3. EMISOR GPS SATELITAL REAL (DESDE CUALQUIER CELULAR / PC)
    // No necesitas el celular físico del abuelo: cualquier celular
    // donde abras la app puede actuar como el transmisor GPS en vivo
    // ============================================================
    toggleTransmisionGPSReal() {
      const btn = document.getElementById('btnTransmitirGPSReal');

      if (this.transmitiendoGPSReal) {
        this.transmitiendoGPSReal = false;
        if (this.gpsLiveWatchId !== null && 'geolocation' in navigator) {
          navigator.geolocation.clearWatch(this.gpsLiveWatchId);
          this.gpsLiveWatchId = null;
        }
        if (btn) {
          btn.style.background = '#0d9488';
          btn.innerHTML = '<i class="fas fa-satellite"></i> Activar GPS Real de este Dispositivo';
        }
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion('🛰️ Transmisión GPS continua pausada.', 'info');
        }
        return;
      }

      if (!('geolocation' in navigator)) {
        alert('Este navegador no dispone de sensor GPS.');
        return;
      }

      this.transmitiendoGPSReal = true;
      if (btn) {
        btn.style.background = '#16a34a';
        btn.innerHTML = '<i class="fas fa-satellite-dish fa-fade"></i> Transmitiendo GPS Real en Vivo...';
      }
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion('📡 Emisor GPS real activado: transmitiendo coordenadas reales al mapa y a Supabase.', 'success');
      }

      this.gpsLiveWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = Math.round(pos.coords.accuracy || 8);
          const etiqueta = `GPS Satelital en Vivo (±${acc}m)`;

          this.aplicarCoordenadaRecibida(lat, lng, etiqueta, acc);
          this.emitirPorCanales('GPS_EN_VIVO', {
            lat, lng, precision: acc, etiqueta,
            coords: { lat, lng, precision: acc, etiqueta }
          });
        },
        (err) => {
          console.warn('Error en watchPosition:', err.message);
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 12000 }
      );
    }

    aplicarCoordenadaRecibida(lat, lng, etiqueta, precision = 6) {
      if (window.TelemetriaDiaMon) {
        window.TelemetriaDiaMon.ubicacion.lat = lat;
        window.TelemetriaDiaMon.ubicacion.lng = lng;
        window.TelemetriaDiaMon.ubicacion.zona = etiqueta;
        window.TelemetriaDiaMon.ubicacion.precision = precision;
        window.TelemetriaDiaMon.gpsFijado = true;
      }

      const ubicEl = document.getElementById('kpiUbicacionVal');
      const ubicBadge = document.getElementById('kpiUbicacionBadge');
      if (ubicEl) ubicEl.textContent = etiqueta;
      if (ubicBadge) {
        ubicBadge.className = 'dc-kpi-badge success';
        ubicBadge.innerHTML = `<i class="fas fa-satellite-dish"></i> En vivo (±${precision}m)`;
      }

      if (typeof window.actualizarMarcadorUbicacionReal === 'function') {
        window.actualizarMarcadorUbicacionReal(lat, lng, precision);
      }

      const dist = this.calcularDistanciaMetros(
        lat, lng,
        this.paciente.coordenadasCasa.lat,
        this.paciente.coordenadasCasa.lng
      );

      const estadoGeoEl = document.getElementById('casoGeocercaEstado');
      if (estadoGeoEl) {
        if (dist > this.paciente.radioSeguroMetros) {
          estadoGeoEl.className = 'dc-kpi-badge danger';
          estadoGeoEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> Fuera de Chapacuá (${Math.round(dist)}m)`;
        } else {
          estadoGeoEl.className = 'dc-kpi-badge success';
          estadoGeoEl.innerHTML = `<i class="fas fa-shield-alt"></i> En Chapacuá (${Math.round(dist)}m)`;
        }
      }
    }

    // ============================================================
    // 4. EVALUACIÓN CLÍNICA CON METAS PERSONALIZADAS
    // ============================================================
    evaluarGlucosa(valor, contexto = 'ayunas') {
      const m = this.metas;
      const v = Number(valor);
      if (v < 70) {
        return { nivel: 'critica_baja', etiqueta: 'Hipoglucemia Severa', clase: 'danger', requiereAlerta: true, protocolo: 'Aplicar Regla 15-15 de inmediato (15g de carbohidratos simples). Precaución con la dosis de Insulina 24 UI.' };
      }
      if (v < m.glucosaMin) {
        return { nivel: 'baja', etiqueta: `Alerta Preventiva (<${m.glucosaMin})`, clase: 'danger', requiereAlerta: true, protocolo: 'Riesgo de hipoglucemia en paciente que usa Insulina 24 UI y Metformina. Tomar colación y medir en 15 min.' };
      }
      if (v >= m.glucosaCriticaAlta) {
        return { nivel: 'critica_alta', etiqueta: 'Hiperglucemia Crítica', clase: 'danger', requiereAlerta: true, protocolo: 'Hidratación con agua pura, verificar toma de Metformina / Insulina 24 UI y consultar con Enf. Jefe Elizabeth Vargas Caro.' };
      }
      const tope = (contexto === 'ayunas' || contexto === 'preprandial') ? m.glucosaMetaAyunas : m.glucosaMaxPost;
      if (v > tope) {
        return { nivel: 'alta', etiqueta: `Elevada (${contexto === 'ayunas' ? 'ayunas' : 'post-comida'})`, clase: 'warn', requiereAlerta: v > m.glucosaMaxPost, protocolo: 'Vigilar hidratación y cumplimiento de Metformina (8 AM / 8 PM).' };
      }
      return { nivel: 'normal', etiqueta: 'En meta clínica', clase: 'success', requiereAlerta: false, protocolo: 'Glucemia dentro del rango pautado por la Enf. Jefe Elizabeth Vargas Caro.' };
    }

    evaluarPresion(sistolica, diastolica) {
      const m = this.metas;
      const sis = Number(sistolica);
      const dia = Number(diastolica);
      if (sis >= m.sistolicaCritica || dia >= m.diastolicaCritica) {
        return { nivel: 'crisis_hta', etiqueta: 'Crisis Hipertensiva', clase: 'danger', requiereAlerta: true, protocolo: 'Reposo sentado inmediato, verificar si tomó Nifedipina (8 AM/8 PM) y Valsartán (2 PM), y contactar asistencia médica.' };
      }
      if (sis < m.sistolicaMin || dia < m.diastolicaMin) {
        return { nivel: 'hipotension', etiqueta: 'Hipotensión (Riesgo Caída)', clase: 'danger', requiereAlerta: true, protocolo: 'Sentarse o recostarse de inmediato para evitar mareo por vasodilatación.' };
      }
      if (sis > m.sistolicaMax || dia > m.diastolicaMax) {
        return { nivel: 'elevada', etiqueta: 'Presión Elevada', clase: 'warn', requiereAlerta: true, protocolo: 'Supera 140/90 mmHg. Repetir medición en 10 minutos tras reposo.' };
      }
      return { nivel: 'normal', etiqueta: 'Presión Controlada', clase: 'success', requiereAlerta: false, protocolo: 'Respuesta adecuada al esquema de Nifedipina + Valsartán + Firialta.' };
    }

    // ============================================================
    // 5. REGISTRO REAL DE GLUCOSA Y PRESIÓN ARTERIAL
    // ============================================================
    async registrarGlucosaManual({ valor, contexto = 'ayunas', notas = '' }) {
      const v = parseInt(valor, 10);
      if (isNaN(v) || v < 25 || v > 600) {
        throw new Error('Ingresa un valor de glucosa válido entre 25 y 600 mg/dL.');
      }

      const mapaContexto = {
        ayunas: 'En ayunas (8:00 AM)',
        preprandial: 'Antes de comida',
        postprandial_2h: '2h después de comer',
        nocturna: 'Pre-Insulina (9:00 PM)',
        rescate: 'Control por síntoma / mareo'
      };

      const evalClinica = this.evaluarGlucosa(v, contexto);
      const nuevaLectura = {
        id: 'gl-' + Date.now(),
        valor: v,
        contexto,
        ContextoLabel: mapaContexto[contexto] || 'Control capilar',
        notas: notas.trim() || evalClinica.protocolo,
        evaluacion: evalClinica,
        ts: Date.now()
      };

      this.glucosas.unshift(nuevaLectura);
      this.guardarJSON(STORAGE_KEYS.GLUCOSA, this.glucosas);

      if (window.supabaseClient) {
        try {
          const { data: { user } } = await window.supabaseClient.auth.getUser();
          if (user) {
            await window.supabaseClient.from('glucosa_lecturas').insert({
              user_id: user.id,
              valor: v,
              fuente: 'meter',
              notas: `[${nuevaLectura.ContextoLabel}] ${nuevaLectura.notas}`,
              ts: new Date(nuevaLectura.ts).toISOString()
            });
          }
        } catch (_) {}
      }

      if (evalClinica.requiereAlerta && window.emitirAlerta24Horas) {
        const coords = window.TelemetriaDiaMon?.ubicacion || this.paciente.coordenadasCasa;
        window.emitirAlerta24Horas({
          titulo: `${evalClinica.etiqueta}: ${v} mg/dL`,
          subtitulo: `${this.paciente.nombre} registró ${v} mg/dL (${nuevaLectura.ContextoLabel}).`,
          tipo: v < this.metas.glucosaMin ? 'glucosa_baja' : 'glucosa_alta',
          color: evalClinica.clase === 'danger' ? 'red' : 'amber',
          icono: 'fas fa-tint',
          badgeTexto: evalClinica.clase === 'danger' ? 'Urgente' : 'Atención',
          badgeClase: evalClinica.clase === 'danger' ? 'badge-pendiente' : 'badge-aviso',
          coordenadas: { lat: coords.lat, lng: coords.lng },
          ubicacion: coords.zona || this.paciente.barrioResidencia,
          descripcion: `Lectura de glucómetro de ${this.paciente.nombre}: ${v} mg/dL (${nuevaLectura.ContextoLabel}). Pauta de ${this.paciente.profesionalGuia}: ${evalClinica.protocolo}`
        });
      }

      this.actualizarTodaLaUI();
      this.emitirPorCanales('GLUCOSA_ACTUALIZADA', { glucosa: nuevaLectura });
      return nuevaLectura;
    }

    async registrarPresionManual({ sistolica, diastolica, pulso = 72, brazo = 'izquierdo', postura = 'sentado', notas = '' }) {
      const sis = parseInt(sistolica, 10);
      const dia = parseInt(diastolica, 10);
      const bpm = parseInt(pulso, 10) || 72;

      if (isNaN(sis) || sis < 50 || sis > 260 || isNaN(dia) || dia < 30 || dia > 160) {
        throw new Error('Ingresa valores válidos de presión arterial (ej. 126 / 78 mmHg).');
      }

      const evalPA = this.evaluarPresion(sis, dia);
      const nuevaPA = {
        id: 'pa-' + Date.now(),
        sistolica: sis,
        diastolica: dia,
        pulso: bpm,
        brazo,
        postura,
        notas: notas.trim() || evalPA.protocolo,
        evaluacion: evalPA,
        ts: Date.now()
      };

      this.presiones.unshift(nuevaPA);
      this.guardarJSON(STORAGE_KEYS.PRESION, this.presiones);

      if (evalPA.requiereAlerta && window.emitirAlerta24Horas) {
        const coords = window.TelemetriaDiaMon?.ubicacion || this.paciente.coordenadasCasa;
        window.emitirAlerta24Horas({
          titulo: `${evalPA.etiqueta}: ${sis}/${dia} mmHg`,
          subtitulo: `${this.paciente.nombre} registró PA de ${sis}/${dia} mmHg y pulso ${bpm} BPM.`,
          tipo: 'geocerca',
          color: evalPA.clase === 'danger' ? 'red' : 'amber',
          icono: 'fas fa-heartbeat',
          badgeTexto: evalPA.clase === 'danger' ? 'Crítica' : 'Vigilar',
          badgeClase: evalPA.clase === 'danger' ? 'badge-pendiente' : 'badge-aviso',
          coordenadas: { lat: coords.lat, lng: coords.lng },
          ubicacion: coords.zona || this.paciente.barrioResidencia,
          descripcion: `Tensiómetro digital (${this.paciente.nombre}): ${sis}/${dia} mmHg (${bpm} BPM). Esquema antihipertensivo: Nifedipina (8 AM / 8 PM) y Valsartán (2 PM). Protocolo: ${evalPA.protocolo}`
        });
      }

      this.actualizarTodaLaUI();
      this.emitirPorCanales('PRESION_ACTUALIZADA', { presion: nuevaPA });

      if (window.supabaseClient) {
        try {
          const { data: { user } } = await window.supabaseClient.auth.getUser();
          if (user) {
            await window.supabaseClient.from('presion_arterial').insert({
              user_id: user.id,
              sistolica: sis,
              diastolica: dia,
              pulso_bpm: bpm,
              brazo: brazo || 'izquierdo',
              postura: postura || 'sentado',
              sintomas: notas.trim() || evalPA.protocolo
            });
          }
        } catch (e) {
          console.warn('[CasoEstudio] Supabase offline o sin sesion para presion:', e);
        }
      }

      return nuevaPA;
    }

    async guardarMetasPersonalizadas(nuevasMetas, datosPaciente = {}) {
      this.metas = { ...this.metas, ...nuevasMetas };
      this.paciente = { ...this.paciente, ...datosPaciente };
      this.guardarJSON(STORAGE_KEYS.METAS, this.metas);
      this.guardarJSON(STORAGE_KEYS.PACIENTE, this.paciente);
      this.sincronizarFichaQROficial();
      this.actualizarTodaLaUI();
      this.emitirPorCanales('METAS_ACTUALIZADAS');

      if (window.supabaseClient) {
        try {
          const { data: { user } } = await window.supabaseClient.auth.getUser();
          if (user) {
            await window.supabaseClient.from('metas_paciente').upsert({
              user_id: user.id,
              glucosa_min: parseInt(this.metas.glucosaMin, 10) || 80,
              glucosa_meta_ayunas: parseInt(this.metas.glucosaMetaAyunas, 10) || 135,
              glucosa_max_post: parseInt(this.metas.glucosaMaxPost, 10) || 180,
              sistolica_min: parseInt(this.metas.sistolicaMin, 10) || 95,
              sistolica_max: parseInt(this.metas.sistolicaMax, 10) || 140,
              diastolica_min: parseInt(this.metas.diastolicaMin, 10) || 60,
              diastolica_max: parseInt(this.metas.diastolicaMax, 10) || 90,
              profesional_nombre: this.paciente.profesionalGuia || 'Enf. Jefe Elizabeth Vargas Caro',
              profesional_registro: this.paciente.registroProfesional || 'Caso de Estudio Barrio Chapacua',
              updated_at: new Date().toISOString()
            });
          }
        } catch (e) {
          console.warn('[CasoEstudio] Supabase offline o sin sesion para metas:', e);
        }
      }
    }

    // ============================================================
    // 6. ESCENARIOS DE TELEMETRÍA EN CHAPACUÁ (REALES + DEMO JURADO)
    // ============================================================
    simularEscenarioSustentacion(escenario) {
      if (this.simulacionTimer) {
        clearInterval(this.simulacionTimer);
        this.simulacionTimer = null;
      }

      if (escenario === 'hipoglucemia') {
        this.registrarGlucosaManual({
          valor: 64,
          contexto: 'rescate',
          notas: 'Alerta clínica en Chapacuá: Damián Díaz reporta sudoración fría y mareo. Se activa Regla 15-15.'
        });
        return;
      }

      if (escenario === 'crisis_hta') {
        this.registrarPresionManual({
          sistolica: 164,
          diastolica: 96,
          pulso: 86,
          brazo: 'izquierdo',
          postura: 'sentado',
          notas: 'Pico hipertensivo detectado en control vespertino. Verificar toma de Valsartán (2:00 PM) y Nifedipino.'
        });
        return;
      }

      if (escenario === 'dosis_omitida') {
        if (window.emitirAlerta24Horas) {
          window.emitirAlerta24Horas({
            titulo: 'Retraso en Insulina 24 UI (9:00 PM)',
            subtitulo: `${this.paciente.nombre} aún no ha confirmado su aplicación de 24 unidades de Insulina de las 9:00 PM.`,
            tipo: 'medicamento',
            color: 'amber',
            icono: 'fas fa-syringe',
            badgeTexto: 'Por confirmar',
            badgeClase: 'badge-aviso',
            coordenadas: this.paciente.coordenadasCasa,
            ubicacion: this.paciente.barrioResidencia,
            descripcion: `El monitor de adherencia farmacológica detectó que pasaron 30 minutos desde la hora programada para las 24 unidades de Insulina (9:00 PM) tras la toma nocturna de Atorvastatina, Metformina, Gabapentina, Lipotic y Nifedipino (8:00 PM).`
          });
        }
        return;
      }

      if (escenario === 'recorrido_seguro' || escenario === 'salida_geocerca') {
        const cfg = escenario === 'salida_geocerca' ? RECORRIDOS_CHAPACUA.salida_geocerca : RECORRIDOS_CHAPACUA.parque;
        let idx = 0;
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion(`🛰️ Reproduciendo telemetría GPS en Chapacuá: ${cfg.nombre}`, 'info');
        }

        const emitirPaso = () => {
          if (idx >= cfg.puntos.length) {
            clearInterval(this.simulacionTimer);
            this.simulacionTimer = null;
            return;
          }
          const pt = cfg.puntos[idx];
          idx++;

          this.aplicarCoordenadaRecibida(pt.lat, pt.lng, pt.etiqueta, 5);
          this.emitirPorCanales('GPS_EN_VIVO', {
            lat: pt.lat, lng: pt.lng, precision: 5, etiqueta: pt.etiqueta,
            coords: { lat: pt.lat, lng: pt.lng, precision: 5, etiqueta: pt.etiqueta }
          });

          const dist = this.calcularDistanciaMetros(
            pt.lat, pt.lng,
            this.paciente.coordenadasCasa.lat,
            this.paciente.coordenadasCasa.lng
          );

          if (dist > this.paciente.radioSeguroMetros && idx === cfg.puntos.length && window.emitirAlerta24Horas) {
            window.emitirAlerta24Horas({
              titulo: 'Salida de Geocerca — Barrio Chapacuá',
              subtitulo: `${this.paciente.nombre} superó el perímetro de Chapacuá (${(dist / 1000).toFixed(2)} km · ${pt.etiqueta}).`,
              tipo: 'geocerca',
              color: 'red',
              icono: 'fas fa-map-marker-alt',
              badgeTexto: 'Fuera de Zona',
              badgeClase: 'badge-pendiente',
              coordenadas: { lat: pt.lat, lng: pt.lng },
              ubicacion: pt.etiqueta,
              descripcion: `El GPS detectó que ${this.paciente.nombre} salió del radio seguro de ${this.paciente.radioSeguroMetros} metros configurado alrededor de su casa en el barrio Chapacuá, Cartagena.`
            });
          }
        };

        emitirPaso();
        this.simulacionTimer = setInterval(emitirPaso, 2000);
      }
    }

    calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // ============================================================
    // 7. ACTUALIZACIÓN DE INTERFAZ Y MODALES
    // ============================================================
    obtenerResumenClinicoActual() {
      const ultimaGlucosa = this.glucosas[0] || { valor: 114, contexto: 'ayunas', ContextoLabel: 'En ayunas (8:00 AM)', ts: Date.now() };
      const ultimaPresion = this.presiones[0] || { sistolica: 126, diastolica: 78, pulso: 71, ts: Date.now() };
      const evalG = this.evaluarGlucosa(ultimaGlucosa.valor, ultimaGlucosa.contexto);
      const evalP = this.evaluarPresion(ultimaPresion.sistolica, ultimaPresion.diastolica);

      const promedioG = Math.round(this.glucosas.reduce((acc, item) => acc + Number(item.valor), 0) / Math.max(1, this.glucosas.length));
      const enRangoG = Math.round(
        (this.glucosas.filter(g => g.valor >= this.metas.glucosaMin && g.valor <= this.metas.glucosaMaxPost).length / Math.max(1, this.glucosas.length)) * 100
      );

      return {
        paciente: this.paciente,
        metas: this.metas,
        ultimaGlucosa,
        ultimaPresion,
        evalG,
        evalP,
        promedioG,
        enRangoG
      };
    }

    actualizarTodaLaUI() {
      const res = this.obtenerResumenClinicoActual();

      const kpiGVal = document.getElementById('kpiGlucoseVal');
      const kpiGBadge = document.getElementById('kpiGlucoseBadge');
      if (kpiGVal) kpiGVal.textContent = `${res.ultimaGlucosa.valor} mg/dL`;
      if (kpiGBadge) {
        kpiGBadge.className = `dc-kpi-badge ${res.evalG.clase}`;
        kpiGBadge.innerHTML = `<i class="fas fa-check-circle"></i> ${res.evalG.etiqueta} (${res.ultimaGlucosa.ContextoLabel})`;
      }

      const kpiPAVal = document.getElementById('kpiPresionVal');
      const kpiPABadge = document.getElementById('kpiPresionBadge');
      if (kpiPAVal) kpiPAVal.textContent = `${res.ultimaPresion.sistolica}/${res.ultimaPresion.diastolica} mmHg`;
      if (kpiPABadge) {
        kpiPABadge.className = `dc-kpi-badge ${res.evalP.clase}`;
        kpiPABadge.innerHTML = `<i class="fas fa-heartbeat"></i> ${res.evalP.etiqueta} · ${res.ultimaPresion.pulso} BPM`;
      }

      const bannerNombre = document.getElementById('casoPacienteNombre');
      const bannerDiag = document.getElementById('casoPacienteDiag');
      const bannerMetaG = document.getElementById('casoMetaGlucosa');
      const bannerMetaPA = document.getElementById('casoMetaPresion');
      const bannerProf = document.getElementById('casoProfesionalGuia');

      if (bannerNombre) bannerNombre.textContent = `${res.paciente.nombre} · ${res.paciente.barrioResidencia}`;
      if (bannerDiag) bannerDiag.textContent = res.paciente.diagnosticoPrincipal;
      if (bannerMetaG) bannerMetaG.textContent = `${res.metas.glucosaMin}–${res.metas.glucosaMaxPost} mg/dL`;
      if (bannerMetaPA) bannerMetaPA.textContent = `< ${res.metas.sistolicaMax}/${res.metas.diastolicaMax} mmHg`;
      if (bannerProf) bannerProf.textContent = res.paciente.profesionalGuia;

      this.renderHistorialRecienteDashboard();
      this.actualizarVistaAdultoMayor(res);

      const repPromG = document.getElementById('repKpiGlucosaProm');
      const repPromPA = document.getElementById('repKpiPresionUlt');
      const repTIR = document.getElementById('repKpiTiempoRango');
      if (repPromG) repPromG.textContent = `${res.promedioG} mg/dL`;
      if (repPromPA) repPromPA.textContent = `${res.ultimaPresion.sistolica}/${res.ultimaPresion.diastolica} mmHg`;
      if (repTIR) repTIR.textContent = `${res.enRangoG}% en meta`;

      if (window.medicalQRManager && typeof window.medicalQRManager.refreshAllQRs === 'function') {
        window.medicalQRManager.refreshAllQRs();
      }
    }

    renderHistorialRecienteDashboard() {
      const container = document.getElementById('listaBitacoraClinica');
      if (!container) return;

      const combinados = [
        ...this.glucosas.slice(0, 4).map(g => ({
          tipo: 'glucosa',
          titulo: `Glucosa: ${g.valor} mg/dL`,
          sub: `${g.ContextoLabel} · ${g.notas}`,
          evalObj: this.evaluarGlucosa(g.valor, g.contexto),
          ts: g.ts
        })),
        ...this.presiones.slice(0, 4).map(p => ({
          tipo: 'presion',
          titulo: `Presión: ${p.sistolica}/${p.diastolica} mmHg (${p.pulso} BPM)`,
          sub: `Brazo ${p.brazo}, ${p.postura} · ${p.notas}`,
          evalObj: this.evaluarPresion(p.sistolica, p.diastolica),
          ts: p.ts
        }))
      ].sort((a, b) => b.ts - a.ts).slice(0, 6);

      container.innerHTML = combinados.map(item => {
        const hora = new Date(item.ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        const fecha = new Date(item.ts).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
        const icon = item.tipo === 'glucosa' ? 'fa-tint' : 'fa-heartbeat';
        const dotColor = item.evalObj.clase === 'danger' ? 'amber' : (item.tipo === 'glucosa' ? 'green' : 'purple');
        return `
          <div class="dc-timeline-step">
            <div class="dc-timeline-dot ${dotColor}"><i class="fas ${icon}" aria-hidden="true"></i></div>
            <div class="dc-timeline-content">
              <div style="min-width:0; flex:1;">
                <div class="dc-timeline-title" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span>${item.titulo}</span>
                  <span class="dc-kpi-badge ${item.evalObj.clase}" style="font-size:10px; padding:1px 7px;">${item.evalObj.etiqueta}</span>
                </div>
                <div class="dc-timeline-desc" style="white-space:normal;">${item.sub}</div>
              </div>
              <div class="dc-timeline-time">${fecha} · ${hora}</div>
            </div>
          </div>
        `;
      }).join('');
    }

    abrirModalRegistroClinico(tabInicial = 'glucosa') {
      let modal = document.getElementById('modalRegistroClinico');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalRegistroClinico';
        modal.className = 'dc-modal-backdrop';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        document.body.appendChild(modal);
      }

      const m = this.metas;
      modal.innerHTML = `
        <div class="dc-modal-dialog" style="max-width:540px; width:95%; background:#ffffff; border-radius:20px; padding:24px; position:relative; box-shadow:0 20px 50px rgba(15,23,42,0.25);">
          <button class="dc-modal-close" onclick="document.getElementById('modalRegistroClinico').style.display='none'" aria-label="Cerrar">
            <i class="fas fa-times"></i>
          </button>

          <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
            <div style="width:38px; height:38px; border-radius:10px; background:var(--dc-primary-light); color:var(--dc-primary); display:flex; align-items:center; justify-content:center; font-size:18px;">
              <i class="fas fa-notes-medical"></i>
            </div>
            <div>
              <h3 style="font-size:18px; font-weight:700; color:var(--dc-text-heading); margin:0;">Registrar Signos Vitales</h3>
              <p style="font-size:12px; color:var(--dc-text-muted); margin:0;">Paciente: <strong>${this.paciente.nombre}</strong> · ${this.paciente.barrioResidencia}</p>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; background:#f1f5f9; padding:5px; border-radius:12px; margin:16px 0;">
            <button type="button" id="btnTabRegGlucosa" onclick="window.casoEstudio.cambiarTabModal('glucosa')" style="padding:9px; border:none; border-radius:9px; font-weight:600; font-size:12.5px; cursor:pointer; background:${tabInicial === 'glucosa' ? '#ffffff' : 'transparent'}; color:${tabInicial === 'glucosa' ? 'var(--dc-primary)' : '#475569'};">
              <i class="fas fa-tint"></i> Glucosa
            </button>
            <button type="button" id="btnTabRegPresion" onclick="window.casoEstudio.cambiarTabModal('presion')" style="padding:9px; border:none; border-radius:9px; font-weight:600; font-size:12.5px; cursor:pointer; background:${tabInicial === 'presion' ? '#ffffff' : 'transparent'}; color:${tabInicial === 'presion' ? 'var(--dc-primary)' : '#475569'};">
              <i class="fas fa-heartbeat"></i> Presión (HTA)
            </button>
            <button type="button" id="btnTabRegMetas" onclick="window.casoEstudio.cambiarTabModal('metas')" style="padding:9px; border:none; border-radius:9px; font-weight:600; font-size:12.5px; cursor:pointer; background:${tabInicial === 'metas' ? '#ffffff' : 'transparent'}; color:${tabInicial === 'metas' ? 'var(--dc-primary)' : '#475569'};">
              <i class="fas fa-user-md"></i> Ficha &amp; Metas
            </button>
          </div>

          <!-- FORMULARIO GLUCOSA -->
          <form id="formModalGlucosa" style="display:${tabInicial === 'glucosa' ? 'block' : 'none'};" onsubmit="window.casoEstudio.submitGlucosaModal(event)">
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px; margin-bottom:14px; font-size:12px; color:#475569;">
              <strong>Pauta de ${this.paciente.profesionalGuia}:</strong> Ayunas ${m.glucosaMin}–${m.glucosaMetaAyunas} mg/dL · Postprandial &lt; ${m.glucosaMaxPost} mg/dL.
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
              <div>
                <label style="font-size:12px; font-weight:600; color:#334155; display:block; margin-bottom:4px;">Valor Glucómetro (mg/dL) *</label>
                <input type="number" id="inputModalGlucosaVal" required min="25" max="600" placeholder="Ej: 114" style="width:100%; padding:11px 12px; border:1.5px solid #cbd5e1; border-radius:10px; font-size:16px; font-weight:700;">
              </div>
              <div>
                <label style="font-size:12px; font-weight:600; color:#334155; display:block; margin-bottom:4px;">Momento de la toma</label>
                <select id="inputModalGlucosaCtx" style="width:100%; padding:11px 12px; border:1.5px solid #cbd5e1; border-radius:10px; font-size:13px;">
                  <option value="ayunas">En ayunas (8:00 AM)</option>
                  <option value="preprandial">Antes de almuerzo (2:00 PM)</option>
                  <option value="postprandial_2h">2 horas después de comer</option>
                  <option value="nocturna">Antes de Insulina 24 UI (9:00 PM)</option>
                  <option value="rescate">Control por síntoma / mareo</option>
                </select>
              </div>
            </div>
            <div style="margin-bottom:16px;">
              <label style="font-size:12px; font-weight:600; color:#334155; display:block; margin-bottom:4px;">Observaciones</label>
              <input type="text" id="inputModalGlucosaNotas" placeholder="Ej: Control posterior a toma de Metformina..." style="width:100%; padding:10px 12px; border:1.5px solid #cbd5e1; border-radius:10px; font-size:13px;">
            </div>
            <button type="submit" style="width:100%; padding:13px; border:none; border-radius:12px; background:var(--dc-primary); color:#ffffff; font-weight:700; font-size:14px; cursor:pointer;">
              <i class="fas fa-check-circle"></i> Guardar Lectura de Glucosa
            </button>
          </form>

          <!-- FORMULARIO PRESIÓN ARTERIAL -->
          <form id="formModalPresion" style="display:${tabInicial === 'presion' ? 'block' : 'none'};" onsubmit="window.casoEstudio.submitPresionModal(event)">
            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px; margin-bottom:14px; font-size:12px; color:#475569;">
              <strong>Control de Hipertensión (Nifedipina 8 AM/8 PM + Valsartán 2 PM):</strong> Meta &lt; ${m.sistolicaMax}/${m.diastolicaMax} mmHg.
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:12px;">
              <div>
                <label style="font-size:12px; font-weight:600; color:#334155; display:block; margin-bottom:4px;">Sistólica *</label>
                <input type="number" id="inputModalPASis" required min="50" max="250" placeholder="126" style="width:100%; padding:11px; border:1.5px solid #cbd5e1; border-radius:10px; font-size:16px; font-weight:700;">
              </div>
              <div>
                <label style="font-size:12px; font-weight:600; color:#334155; display:block; margin-bottom:4px;">Diastólica *</label>
                <input type="number" id="inputModalPADia" required min="30" max="150" placeholder="78" style="width:100%; padding:11px; border:1.5px solid #cbd5e1; border-radius:10px; font-size:16px; font-weight:700;">
              </div>
              <div>
                <label style="font-size:12px; font-weight:600; color:#334155; display:block; margin-bottom:4px;">Pulso (BPM)</label>
                <input type="number" id="inputModalPAPulso" min="35" max="210" value="71" style="width:100%; padding:11px; border:1.5px solid #cbd5e1; border-radius:10px; font-size:15px;">
              </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
              <div>
                <label style="font-size:12px; font-weight:600; color:#334155; display:block; margin-bottom:4px;">Brazo</label>
                <select id="inputModalPABrazo" style="width:100%; padding:10px; border:1.5px solid #cbd5e1; border-radius:10px; font-size:13px;">
                  <option value="izquierdo">Brazo izquierdo</option>
                  <option value="derecho">Brazo derecho</option>
                </select>
              </div>
              <div>
                <label style="font-size:12px; font-weight:600; color:#334155; display:block; margin-bottom:4px;">Postura</label>
                <select id="inputModalPAPostura" style="width:100%; padding:10px; border:1.5px solid #cbd5e1; border-radius:10px; font-size:13px;">
                  <option value="sentado">Sentado (5 min reposo)</option>
                  <option value="acostado">Acostado</option>
                  <option value="de_pie">De pie</option>
                </select>
              </div>
            </div>
            <div style="margin-bottom:16px;">
              <label style="font-size:12px; font-weight:600; color:#334155; display:block; margin-bottom:4px;">Notas</label>
              <input type="text" id="inputModalPANotas" placeholder="Ej: Toma posterior a Valsartán de las 2:00 PM..." style="width:100%; padding:10px 12px; border:1.5px solid #cbd5e1; border-radius:10px; font-size:13px;">
            </div>
            <button type="submit" style="width:100%; padding:13px; border:none; border-radius:12px; background:var(--dc-primary); color:#ffffff; font-weight:700; font-size:14px; cursor:pointer;">
              <i class="fas fa-heartbeat"></i> Guardar Presión Arterial
            </button>
          </form>

          <!-- FORMULARIO METAS -->
          <form id="formModalMetas" style="display:${tabInicial === 'metas' ? 'block' : 'none'};" onsubmit="window.casoEstudio.submitMetasModal(event)">
            <div style="display:grid; grid-template-columns:2fr 1fr; gap:10px; margin-bottom:10px;">
              <div>
                <label style="font-size:11.5px; font-weight:600; color:#334155;">Nombre del Paciente (Abuelo)</label>
                <input type="text" id="inputMetaPacNombre" value="${this.paciente.nombre}" required style="width:100%; padding:9px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px;">
              </div>
              <div>
                <label style="font-size:11.5px; font-weight:600; color:#334155;">Barrio / Sector</label>
                <input type="text" id="inputMetaPacBarrio" value="${this.paciente.barrioResidencia}" required style="width:100%; padding:9px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px;">
              </div>
            </div>
            <div style="margin-bottom:10px;">
              <label style="font-size:11.5px; font-weight:600; color:#334155;">Enfermera Jefe / Profesional que guió los parámetros</label>
              <input type="text" id="inputMetaProfGuia" value="${this.paciente.profesionalGuia}" required style="width:100%; padding:9px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px;">
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
              <div>
                <label style="font-size:11.5px; font-weight:600; color:#334155;">Glucosa Mínima Segura (mg/dL)</label>
                <input type="number" id="inputMetaGMin" value="${m.glucosaMin}" required style="width:100%; padding:9px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px;">
              </div>
              <div>
                <label style="font-size:11.5px; font-weight:600; color:#334155;">Glucosa Máxima Post (mg/dL)</label>
                <input type="number" id="inputMetaGMax" value="${m.glucosaMaxPost}" required style="width:100%; padding:9px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px;">
              </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
              <div>
                <label style="font-size:11.5px; font-weight:600; color:#334155;">Tope Sistólica (mmHg)</label>
                <input type="number" id="inputMetaPASisMax" value="${m.sistolicaMax}" required style="width:100%; padding:9px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px;">
              </div>
              <div>
                <label style="font-size:11.5px; font-weight:600; color:#334155;">Tope Diastólica (mmHg)</label>
                <input type="number" id="inputMetaPADiaMax" value="${m.diastolicaMax}" required style="width:100%; padding:9px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px;">
              </div>
            </div>
            <button type="submit" style="width:100%; padding:12px; border:none; border-radius:12px; background:var(--dc-primary); color:#ffffff; font-weight:700; font-size:13.5px; cursor:pointer;">
              <i class="fas fa-save"></i> Guardar Parámetros Clínicos
            </button>
          </form>
        </div>
      `;

      modal.style.display = 'flex';
    }

    cambiarTabModal(tab) {
      const tabs = ['glucosa', 'presion', 'metas'];
      tabs.forEach(t => {
        const form = document.getElementById(
          t === 'glucosa' ? 'formModalGlucosa' : (t === 'presion' ? 'formModalPresion' : 'formModalMetas')
        );
        const btn = document.getElementById(
          t === 'glucosa' ? 'btnTabRegGlucosa' : (t === 'presion' ? 'btnTabRegPresion' : 'btnTabRegMetas')
        );
        if (form) form.style.display = (t === tab) ? 'block' : 'none';
        if (btn) {
          btn.style.background = (t === tab) ? '#ffffff' : 'transparent';
          btn.style.color = (t === tab) ? 'var(--dc-primary)' : '#475569';
        }
      });
    }

    async submitGlucosaModal(e) {
      e.preventDefault();
      try {
        const valor = document.getElementById('inputModalGlucosaVal').value;
        const contexto = document.getElementById('inputModalGlucosaCtx').value;
        const notas = document.getElementById('inputModalGlucosaNotas').value;
        const lectura = await this.registrarGlucosaManual({ valor, contexto, notas });
        document.getElementById('modalRegistroClinico').style.display = 'none';
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion(`✓ Glucosa registrada: ${lectura.valor} mg/dL (${lectura.evaluacion.etiqueta})`, 'success');
        }
      } catch (err) {
        alert(err.message);
      }
    }

    async submitPresionModal(e) {
      e.preventDefault();
      try {
        const sistolica = document.getElementById('inputModalPASis').value;
        const diastolica = document.getElementById('inputModalPADia').value;
        const pulso = document.getElementById('inputModalPAPulso').value;
        const brazo = document.getElementById('inputModalPABrazo').value;
        const postura = document.getElementById('inputModalPAPostura').value;
        const notas = document.getElementById('inputModalPANotas').value;
        const pa = await this.registrarPresionManual({ sistolica, diastolica, pulso, brazo, postura, notas });
        document.getElementById('modalRegistroClinico').style.display = 'none';
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion(`✓ Presión registrada: ${pa.sistolica}/${pa.diastolica} mmHg (${pa.evaluacion.etiqueta})`, 'success');
        }
      } catch (err) {
        alert(err.message);
      }
    }

    submitMetasModal(e) {
      e.preventDefault();
      const nombre = document.getElementById('inputMetaPacNombre').value.trim();
      const barrioResidencia = document.getElementById('inputMetaPacBarrio').value.trim();
      const profesionalGuia = document.getElementById('inputMetaProfGuia').value.trim();
      const glucosaMin = parseInt(document.getElementById('inputMetaGMin').value, 10) || 80;
      const glucosaMaxPost = parseInt(document.getElementById('inputMetaGMax').value, 10) || 180;
      const sistolicaMax = parseInt(document.getElementById('inputMetaPASisMax').value, 10) || 140;
      const diastolicaMax = parseInt(document.getElementById('inputMetaPADiaMax').value, 10) || 90;

      this.guardarMetasPersonalizadas(
        { glucosaMin, glucosaMaxPost, sistolicaMax, diastolicaMax },
        { nombre, barrioResidencia, profesionalGuia }
      );
      document.getElementById('modalRegistroClinico').style.display = 'none';
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion('✓ Ficha de Damián Díaz Balseiro actualizada.', 'success');
      }
    }

    // Vista simplificada de lectura grande para el paciente o adulto mayor
    toggleModoAdultoMayor(forzar) {
      this.modoAdultoMayor = forzar !== undefined ? forzar : !this.modoAdultoMayor;
      let overlay = document.getElementById('vistaAdultoMayorOverlay');

      if (!this.modoAdultoMayor) {
        if (overlay) overlay.style.display = 'none';
        return;
      }

      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'vistaAdultoMayorOverlay';
        overlay.style.cssText = 'position:fixed; inset:0; background:linear-gradient(155deg, #061b2e 0%, #082f49 55%, #042f2e 100%); color:#ffffff; z-index:9500; overflow-y:auto; padding:20px; font-family:var(--dc-font-main);';
        document.body.appendChild(overlay);
      }

      const res = this.obtenerResumenClinicoActual();
      let nombreMostrar = res.paciente.nombre || 'Damián Díaz Balseiro';
      try {
        const ses = JSON.parse(sessionStorage.getItem('diamon_demo_user') || localStorage.getItem('diamon_current_user') || 'null');
        if (ses && ses.rol === 'usuario' && ses.nombre) {
          nombreMostrar = ses.nombre;
        } else if (ses && ses.pacienteVinculado && ses.pacienteVinculado.nombre) {
          nombreMostrar = ses.pacienteVinculado.nombre;
        }
      } catch (_) {}

      overlay.innerHTML = `
        <div style="max-width:640px; margin:0 auto;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:14px; border-bottom:1px solid rgba(255,255,255,0.15); flex-wrap:wrap; gap:10px;">
            <div>
              <span style="background:linear-gradient(135deg, #0d9488, #0284c7); color:#ffffff; font-size:12px; font-weight:700; padding:4px 10px; border-radius:20px; text-transform:uppercase;">
                <i class="fas fa-universal-access"></i> Vista Simplificada del Paciente
              </span>
              <h2 style="font-size:26px; font-weight:800; margin:8px 0 0 0; color:#ffffff;">Hola, ${nombreMostrar}</h2>
            </div>
            <button onclick="window.casoEstudio.toggleModoAdultoMayor(false)" style="background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25); color:#ffffff; padding:10px 16px; border-radius:12px; font-size:14px; font-weight:700; cursor:pointer;">
              <i class="fas fa-exchange-alt"></i> Volver al Panel
            </button>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:16px;">
            <div style="background:rgba(15, 42, 64, 0.85); border:2px solid rgba(94,234,212,0.3); border-radius:18px; padding:16px; text-align:center;">
              <div style="font-size:15px; color:#94a3b8; font-weight:600;">Mi Azúcar (Glucosa)</div>
              <div id="amGlucosaVal" style="font-size:34px; font-weight:800; color:#5eead4; margin:4px 0;">${res.ultimaGlucosa.valor} <span style="font-size:17px;">mg/dL</span></div>
              <div style="font-size:13.5px; color:#86efac; font-weight:600;">${res.evalG.etiqueta}</div>
            </div>
            <div style="background:rgba(15, 42, 64, 0.85); border:2px solid rgba(56,189,248,0.3); border-radius:18px; padding:16px; text-align:center;">
              <div style="font-size:15px; color:#94a3b8; font-weight:600;">Mi Presión Arterial</div>
              <div id="amPresionVal" style="font-size:34px; font-weight:800; color:#38bdf8; margin:4px 0;">${res.ultimaPresion.sistolica}/${res.ultimaPresion.diastolica}</div>
              <div style="font-size:13.5px; color:#86efac; font-weight:600;">${res.evalP.etiqueta}</div>
            </div>
          </div>

          <!-- Recordatorio claro de sus horarios de medicamentos -->
          <div style="background:rgba(15, 42, 64, 0.85); border:1px solid rgba(94,234,212,0.35); border-radius:16px; padding:14px 16px; margin-bottom:16px; font-size:14px; line-height:1.5;">
            <div style="font-weight:800; color:#5eead4; margin-bottom:6px; font-size:15px;"><i class="fas fa-clock"></i> Mis Horarios de Medicamentos:</div>
            <div>• <strong>8:00 AM:</strong> Pantoprazol, Metformina, Firialta y Nifedipina</div>
            <div>• <strong>2:00 PM:</strong> Valsartán</div>
            <div>• <strong>8:00 PM:</strong> Atorvastatina, Metformina, Gabapentina, Lipotic y Nifedipino</div>
            <div>• <strong>9:00 PM:</strong> Insulina (24 Unidades) · <strong>Sábados:</strong> Ozempic</div>
          </div>

          <!-- 4 BOTONES GIGANTES -->
          <div style="display:grid; grid-template-columns:1fr; gap:14px;">
            <button onclick="if(window.vozSOSInstance) window.vozSOSInstance.abrirPantallaEmergenciaGrande('Botón SOS Paciente');" style="background:linear-gradient(135deg, #dc2626, #b91c1c); border:none; border-radius:20px; padding:22px; color:#ffffff; font-size:21px; font-weight:800; display:flex; align-items:center; justify-content:center; gap:14px; cursor:pointer; box-shadow:0 10px 25px rgba(220,38,38,0.4);">
              <i class="fas fa-bell" style="font-size:28px;"></i> ¡PEDIR AYUDA SOS A MI CUIDADOR!
            </button>

            <button onclick="window.casoEstudio.confirmarPastillaRapidaAbuelo()" style="background:linear-gradient(135deg, #0d9488, #0284c7); border:none; border-radius:20px; padding:20px; color:#ffffff; font-size:19px; font-weight:700; display:flex; align-items:center; justify-content:center; gap:12px; cursor:pointer;">
              <i class="fas fa-pills" style="font-size:26px;"></i> YA TOMÉ MIS MEDICAMENTOS / INSULINA
            </button>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
              <button onclick="window.casoEstudio.abrirModalRegistroClinico('glucosa')" style="background:rgba(15, 42, 64, 0.9); border:2px solid #5eead4; border-radius:18px; padding:18px 12px; color:#ffffff; font-size:17px; font-weight:700; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:8px;">
                <i class="fas fa-tint" style="font-size:26px; color:#5eead4;"></i>
                <span>Anotar mi Azúcar</span>
              </button>

              <button onclick="window.casoEstudio.abrirModalRegistroClinico('presion')" style="background:rgba(15, 42, 64, 0.9); border:2px solid #38bdf8; border-radius:18px; padding:18px 12px; color:#ffffff; font-size:17px; font-weight:700; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:8px;">
                <i class="fas fa-heartbeat" style="font-size:26px; color:#38bdf8;"></i>
                <span>Anotar mi Presión</span>
              </button>
            </div>
          </div>
        </div>
      `;

      overlay.style.display = 'block';
    }

    actualizarVistaAdultoMayor(res) {
      const gEl = document.getElementById('amGlucosaVal');
      const pEl = document.getElementById('amPresionVal');
      if (gEl) gEl.innerHTML = `${res.ultimaGlucosa.valor} <span style="font-size:17px;">mg/dL</span>`;
      if (pEl) pEl.textContent = `${res.ultimaPresion.sistolica}/${res.ultimaPresion.diastolica}`;
    }

    async confirmarPastillaRapidaAbuelo() {
      const hora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

      if (window.supabaseClient) {
        try {
          const { data: { user } } = await window.supabaseClient.auth.getUser();
          if (user) {
            await window.supabaseClient.from('tomas_medicamento').upsert({
              user_id: user.id,
              medicamento_id: 'esquema-general',
              medicamento_nombre: 'Esquema Integral Damián Díaz (DM2 + HTA)',
              dosis: 'Dosis programada según horario',
              horario_programado: hora,
              fecha: new Date().toISOString().split('T')[0],
              tomada: true,
              confirmado_por: 'paciente',
              ts: new Date().toISOString()
            }, { onConflict: 'user_id,medicamento_id,fecha' });
          }
        } catch (e) {
          console.warn('[CasoEstudio] Supabase offline o sin sesion para toma medicamento:', e);
        }
      }

      if (window.emitirAlerta24Horas) {
        window.emitirAlerta24Horas({
          titulo: 'Medicación confirmada por Damián Díaz Balseiro',
          subtitulo: `Confirmó su toma correspondiente del esquema (8 AM / 2 PM / 8 PM / Insulina 24 UI) a las ${hora}.`,
          tipo: 'medicamento_tomado',
          color: 'green',
          icono: 'fas fa-check',
          badgeTexto: 'Confirmada',
          badgeClase: 'badge-confirmada',
          coordenadas: this.paciente.coordenadasCasa,
          ubicacion: this.paciente.barrioResidencia,
          descripcion: `El paciente Damián Díaz Balseiro confirmó la toma de su esquema prescrito desde su interfaz móvil en el barrio Chapacuá a las ${hora}.`
        });
      }
      if (window.mostrarNotificacion) {
        window.mostrarNotificacion('✓ ¡Excelente, Don Damián! Se avisó a tu familia que ya tomaste tu dosis.', 'success');
      }
    }
  }

  window.ESQUEMA_MEDICAMENTOS_CASO = ESQUEMA_MEDICAMENTOS_DAMIAN;
  window.casoEstudio = new CasoEstudioManager();

  document.addEventListener('DOMContentLoaded', () => {
    window.casoEstudio.actualizarTodaLaUI();
    if (window.location.hash === '#modo-abuelo' || localStorage.getItem('diamon_abrir_abuelo') === '1') {
      localStorage.removeItem('diamon_abrir_abuelo');
      window.casoEstudio.toggleModoAdultoMayor(true);
    }
  });
})();
