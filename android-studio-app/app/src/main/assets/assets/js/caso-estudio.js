// Logica principal del caso de estudio (diabetes, hipertension y GPS en Chapacua)
(function () {
  'use strict';

  // Damian (DM-8492) es el caso de estudio. Otros pacientes registrados tienen sus propios datos.
  const CODIGO_CASO = 'DM-8492';
  function codigoPacienteActivo() {
    const ses = window.DiaMonSesion;
    if (!ses) return CODIGO_CASO;
    const pac = ses.pacienteActivo(ses.leerUsuario());
    return (pac && pac.codigoPaciente) || CODIGO_CASO;
  }
  const CODIGO_ACTIVO = codigoPacienteActivo();
  // Solo se usan los datos de Damian si el paciente de la sesion es el (no para el admin ni para otros pacientes)
  const pacSesion = window.DiaMonSesion ? window.DiaMonSesion.pacienteActivo(window.DiaMonSesion.leerUsuario()) : null;
  const ES_CASO_DAMIAN = !!(pacSesion && pacSesion.codigoPaciente === CODIGO_CASO);
  document.documentElement.classList.toggle('dm-caso-damian', ES_CASO_DAMIAN);

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
    cuidadorPrincipal: 'Valentina Díaz (nieta y cuidadora)',
    telefonoCuidador: '+57 300 523 0379',
    telefonoEmergencia2: '+57 310 987 6543',
    barrioResidencia: 'Barrio Chapacuá, Cartagena de Indias',
    coordenadasCasa: { lat: 10.39991, lng: -75.47886 },
    radioSeguroMetros: 400
  };

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
      nombre: 'Pantoprazol + Metformina + Firialta + Nifedipino',
      indicacion: 'Protector gástrico · Diabetes · Protección renal/cardiovascular · Hipertensión',
      horario: '08:00 AM',
      dosis: 'Esquema matutino completo (4 medicamentos)',
      momento: 'Mañana (8:00 AM)',
      icono: 'fa-sun',
      color: 'teal',
      itemsDetalle: ['Pantoprazol (Ayunas)', 'Metformina', 'Firialta (Finerenona)', 'Nifedipino']
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

  // Datos iniciales de un paciente nuevo (sin nada inventado)
  function pacienteNuevoDefault() {
    const ses = window.DiaMonSesion ? window.DiaMonSesion.pacienteActivo(window.DiaMonSesion.leerUsuario()) : null;
    return {
      id: 'pac-' + CODIGO_ACTIVO,
      codigoPaciente: CODIGO_ACTIVO,
      nombre: (ses && ses.nombre) || 'Paciente',
      diagnosticoPrincipal: 'Diagnóstico sin registrar',
      profesionalGuia: 'Profesional de salud sin asignar',
      barrioResidencia: 'Dirección sin registrar',
      coordenadasCasa: null,
      radioSeguroMetros: 400
    };
  }

  // Gestor central del caso de estudio + emisor GPS real
  class CasoEstudioManager {
    constructor() {
      // Todo empieza vacio y se llena con lo que hay en Supabase (cargarDesdeSupabase)
      this.paciente = ES_CASO_DAMIAN ? { ...PACIENTE_CASO_DEFAULT } : pacienteNuevoDefault();
      this.metas = { ...METAS_CASO_DEFAULT };
      this.glucosas = [];
      this.presiones = [];
      this.zonas = [];
      this.tomas = [];
      this.gpsLiveWatchId = null;
      this.transmitiendoGPSReal = false;
      this.modoAdultoMayor = false;
      this._ultimaAlertaGeocercaMapTs = 0;

      this.initSyncChannels();
      this.cargarDesdeSupabase();
    }

    obtenerZonasSeguras() {
      return this.zonas;
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
      if (dispararAlertaSiSale && window.emitirAlerta24Horas && (Date.now() - this._ultimaAlertaGeocercaMapTs) > 5 * 60000) {
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

    // Trae del paciente: perfil, metas, lecturas, zonas, medicamentos y ultima ubicacion
    async cargarDesdeSupabase() {
      if (!window.DiaMonDatos || !window.DiaMonDatos.pacienteId()) return;
      try {
        const d = await window.DiaMonDatos.cargarTodo();
        if (!d) return;
        if (d.perfil) {
          const f = d.perfil.ficha || {};
          this.paciente = {
            ...this.paciente,
            id: d.perfil.id,
            nombre: d.perfil.nombre,
            codigoPaciente: d.perfil.codigo_paciente,
            fichaToken: d.perfil.ficha_token,
            diagnosticoPrincipal: d.perfil.diagnostico || 'Diagnóstico sin registrar',
            barrioResidencia: d.perfil.barrio || 'Dirección sin registrar',
            profesionalGuia: d.perfil.profesional_guia || 'Profesional de salud sin asignar',
            grupoSanguineo: f.grupoSanguineo || '',
            alergias: f.alergias || '',
            cuidadorPrincipal: f.contactoNombre || '',
            telefonoCuidador: f.contactoTelefono || '',
            centroReferencia: f.centroReferencia || '',
            ficha: f
          };
        }
        if (d.metas) {
          Object.keys(d.metas).forEach(k => { if (d.metas[k] != null && k !== 'profesional') this.metas[k] = d.metas[k]; });
        }
        this.glucosas = d.glucosas;
        this.presiones = d.presiones;
        this.zonas = d.zonas;
        this.tomas = d.tomas;
        if (this.zonas[0]) {
          this.paciente.coordenadasCasa = { lat: Number(this.zonas[0].centro_lat), lng: Number(this.zonas[0].centro_lng) };
        }
        // La ultima ubicacion guardada se muestra mientras llega el GPS en vivo (sin generar alertas)
        if (!d.ultimoGPS && !this.transmitiendoGPSReal && window.DiaMonSesion.rolDe(window.DiaMonSesion.leerUsuario()) !== 'usuario') {
          // El celular del paciente nunca ha enviado su ubicacion: se dice claro y se muestra su casa como referencia
          const ubicEl = document.getElementById('kpiUbicacionVal');
          const ubicBadge = document.getElementById('kpiUbicacionBadge');
          if (ubicEl) ubicEl.textContent = 'Sin GPS del paciente todavía';
          if (ubicBadge) { ubicBadge.className = 'dc-kpi-badge info'; ubicBadge.innerHTML = '<i class="fas fa-home"></i> Mostrando su casa en el mapa'; }
        }
        if (d.ultimoGPS && !this.transmitiendoGPSReal) {
          const hora = new Date(d.ultimoGPS.ts).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
          this.aplicarCoordenadaRecibida(d.ultimoGPS.lat, d.ultimoGPS.lng, `Última ubicación (${hora})`, 10, false);
        }
        this.sincronizarFichaQROficial();
        if (typeof window.dibujarZonasSegurasEnMapaPrincipal === 'function') {
          window.dibujarZonasSegurasEnMapaPrincipal(this.zonas);
        }
        this.actualizarTodaLaUI();
        // Aviso para alertas, medicamentos y reporte, que tambien usan estos datos
        window.dispatchEvent(new CustomEvent('diamon-datos', { detail: d }));
      } catch (e) {
        console.warn('No se pudieron cargar los datos del paciente desde Supabase', e);
      }
    }

    sincronizarFichaQROficial() {
      if (!window.medicalQRManager) return;
      const f = this.paciente.ficha || {};
      window.medicalQRManager.cargarDesdePerfil({
        nombre: this.paciente.nombre,
        condicion: this.paciente.diagnosticoPrincipal,
        tratamiento: f.tratamiento || (ES_CASO_DAMIAN ? '8AM: Pantoprazol, Metformina, Firialta, Nifedipino | 2PM: Valsartán | 8PM: Atorvastatina, Metformina, Gabapentina, Lipotic, Nifedipino | 9PM: Insulina 24 UI | Sáb: Ozempic' : ''),
        glucosaObjetivo: `Glucosa en ayunas ${this.metas.glucosaMin}-${this.metas.glucosaMetaAyunas} mg/dL, después de comer < ${this.metas.glucosaMaxPost} mg/dL | PA: < ${this.metas.sistolicaMax}/${this.metas.diastolicaMax} mmHg`,
        grupoSanguineo: f.grupoSanguineo || '',
        alergias: f.alergias || '',
        contactoNombre: f.contactoNombre || '',
        contactoTelefono: f.contactoTelefono || '',
        medicoTratante: this.paciente.profesionalGuia,
        fichaToken: this.paciente.fichaToken,
        centroReferencia: f.centroReferencia || '',
        notasEmergencia: f.notasEmergencia || (ES_CASO_DAMIAN ? 'En tratamiento con insulina 24 UI en la noche, Ozempic los sábados y antihipertensivos (Valsartán + Nifedipino). Si presenta sudoración fría o mareo estando consciente, aplicar la regla 15-15 (15 g de azúcar rápida) y medir la presión.' : '')
      });
    }

    initSyncChannels() {
      // Otra pestaña del mismo navegador mando una ubicacion
      if (syncChannel) {
        syncChannel.onmessage = (event) => {
          const msg = event.data;
          if (msg && msg.type === 'GPS_EN_VIVO' && msg.coords) {
            this.aplicarCoordenadaRecibida(msg.coords.lat, msg.coords.lng, msg.coords.etiqueta, msg.coords.precision, false);
          }
        };
      }

      if (window.supabaseClient && typeof window.supabaseClient.channel === 'function') {
        try {
          // Ubicacion en vivo del celular del paciente (canal por paciente)
          supabaseLiveChannel = window.supabaseClient.channel('diamon-live-' + CODIGO_ACTIVO);
          supabaseLiveChannel
            .on('broadcast', { event: 'telemetria' }, ({ payload }) => {
              if (payload && payload.lat && payload.lng) {
                this.aplicarCoordenadaRecibida(payload.lat, payload.lng, payload.etiqueta || 'GPS en vivo', payload.precision || 6, false);
              }
            })
            .subscribe();
        } catch (_) {}
      }

      // Cuando alguien cambia algo del paciente en otro equipo se vuelve a cargar (agrupando cambios seguidos)
      if (window.DiaMonDatos) {
        let espera = null;
        window.DiaMonDatos.escucharCambios((tabla, fila, evento) => {
          // Ubicacion guardada por el celular del paciente (por ejemplo desde el servicio en segundo plano)
          if (tabla === 'gps_lecturas') {
            if (fila && fila.lat && !this.transmitiendoGPSReal) {
              const horaGPS = new Date(fila.ts || Date.now()).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
              this.aplicarCoordenadaRecibida(fila.lat, fila.lng, `GPS del celular · ${horaGPS}`, 10, false);
            }
            return;
          }
          if (tabla === 'alertas' && evento === 'INSERT' && typeof window.alertaNuevaRecibida === 'function') {
            window.alertaNuevaRecibida(fila);
          }
          clearTimeout(espera);
          espera = setTimeout(() => this.cargarDesdeSupabase(), 400);
        });
      }
    }

    emitirPorCanales(type, payload = {}) {
      if (syncChannel) {
        try { syncChannel.postMessage({ type, ...payload }); } catch (_) {}
      }
      if (supabaseLiveChannel) {
        try {
          supabaseLiveChannel.send({
            type: 'broadcast',
            event: 'telemetria',
            payload: { type, ...payload }
          });
        } catch (_) {}
      }
    }

    // Emisor GPS satelital real (desde cualquier celular / pc)
    // No necesitas el celular físico del abuelo: cualquier celular
    // donde abras la app puede actuar como el transmisor GPS en vivo
    toggleTransmisionGPSReal() {
      const btn = document.getElementById('btnTransmitirGPSReal');

      if (this.transmitiendoGPSReal) {
        this.transmitiendoGPSReal = false;
        if (window.DiaMonNativo && typeof window.DiaMonNativo.detenerUbicacion === 'function') {
          window.DiaMonNativo.detenerUbicacion();
        }
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
      // Dentro de la app Android se activa tambien el servicio que sigue enviando la ubicacion con la pantalla apagada
      if (window.DiaMonNativo && typeof window.DiaMonNativo.iniciarUbicacion === 'function') {
        window.DiaMonNativo.iniciarUbicacion();
      }
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
          this._ultimaPosicion = { lat, lng, precision: acc, etiqueta };
          if (window.DiaMonDatos) window.DiaMonDatos.guardarGPS(lat, lng).catch(() => {});
          this.emitirPorCanales('GPS_EN_VIVO', {
            lat, lng, precision: acc, etiqueta,
            coords: { lat, lng, precision: acc, etiqueta }
          });
        },
        (err) => {
          console.warn('Error en watchPosition:', err.message);
          // Lo mas comun: la ubicacion del celular esta apagada o no hay senal de GPS
          if (window.mostrarNotificacion && !this._avisoGPS) {
            this._avisoGPS = true;
            window.mostrarNotificacion('No llega señal de GPS. Revisa que la Ubicación del celular esté encendida.', 'warn');
          }
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }
      );
    }

    aplicarCoordenadaRecibida(lat, lng, etiqueta, precision = 6, alertar = true) {
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
        // Si es la ultima posicion guardada (no en vivo) se dice cuando fue
        const enVivo = alertar || !/^Última ubicación/.test(etiqueta);
        ubicBadge.className = 'dc-kpi-badge ' + (enVivo ? 'success' : 'info');
        ubicBadge.innerHTML = enVivo ? `<i class="fas fa-satellite-dish"></i> En vivo (±${precision}m)` : '<i class="fas fa-history"></i> Última conocida';
      }

      if (typeof window.actualizarMarcadorUbicacionReal === 'function') {
        window.actualizarMarcadorUbicacionReal(lat, lng, precision);
      }
      // "Ver en Google Maps" abre la ultima posicion real del paciente (antes tenia una coordenada fija)
      const btnMaps = document.getElementById('btnGoogleMapsPaciente');
      if (btnMaps) btnMaps.href = `https://www.google.com/maps?q=${lat},${lng}`;
      if (window.centrosMedicosInstance) window.centrosMedicosInstance.setPatientCoords([lat, lng]);

      // Se compara con las zonas seguras del paciente (y avisa si sale de todas)
      const estadoGeoEl = document.getElementById('casoGeocercaEstado');
      const check = this.evaluarPosicionEnZonas(lat, lng, alertar);
      if (estadoGeoEl && check) {
        if (check.zonaNombre === 'Sin geocerca activa') {
          estadoGeoEl.className = 'dc-kpi-badge info';
          estadoGeoEl.innerHTML = '<i class="fas fa-info-circle"></i> Sin zonas seguras';
        } else if (!check.dentro) {
          estadoGeoEl.className = 'dc-kpi-badge danger';
          estadoGeoEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> Fuera de zona segura (${Math.round(check.distancia)}m)`;
        } else {
          estadoGeoEl.className = 'dc-kpi-badge success';
          estadoGeoEl.innerHTML = `<i class="fas fa-shield-alt"></i> En ${check.zonaNombre}`;
        }
      }
    }

    // Evaluación clínica con metas personalizadas
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
        return { nivel: 'crisis_hta', etiqueta: 'Crisis Hipertensiva', clase: 'danger', requiereAlerta: true, protocolo: 'Reposo sentado inmediato, verificar si tomó Nifedipino (8 AM/8 PM) y Valsartán (2 PM), y contactar asistencia médica.' };
      }
      if (sis < m.sistolicaMin || dia < m.diastolicaMin) {
        return { nivel: 'hipotension', etiqueta: 'Hipotensión (Riesgo Caída)', clase: 'danger', requiereAlerta: true, protocolo: 'Sentarse o recostarse de inmediato para evitar mareo por vasodilatación.' };
      }
      if (sis > m.sistolicaMax || dia > m.diastolicaMax) {
        return { nivel: 'elevada', etiqueta: 'Presión Elevada', clase: 'warn', requiereAlerta: true, protocolo: 'Supera 140/90 mmHg. Repetir medición en 10 minutos tras reposo.' };
      }
      return { nivel: 'normal', etiqueta: 'Presión Controlada', clase: 'success', requiereAlerta: false, protocolo: 'Respuesta adecuada al esquema de Nifedipino + Valsartán + Firialta.' };
    }

    // Registro real de glucosa y presión arterial
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

      // Se guarda en Supabase con el id del paciente (lo registre el paciente o su cuidador)
      const guardada = await window.DiaMonDatos.guardarGlucosa({ valor: v, contexto, notas: nuevaLectura.notas, ts: nuevaLectura.ts });
      nuevaLectura.id = guardada.id;
      this.glucosas.unshift(nuevaLectura);

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

      const guardadaPA = await window.DiaMonDatos.guardarPresion({ sistolica: sis, diastolica: dia, pulso: bpm, brazo, postura, notas: nuevaPA.notas, ts: nuevaPA.ts });
      nuevaPA.id = guardadaPA.id;
      this.presiones.unshift(nuevaPA);

      if (evalPA.requiereAlerta && window.emitirAlerta24Horas) {
        const coords = window.TelemetriaDiaMon?.ubicacion || this.paciente.coordenadasCasa;
        window.emitirAlerta24Horas({
          titulo: `${evalPA.etiqueta}: ${sis}/${dia} mmHg`,
          subtitulo: `${this.paciente.nombre} registró PA de ${sis}/${dia} mmHg y pulso ${bpm} BPM.`,
          tipo: 'presion',
          color: evalPA.clase === 'danger' ? 'red' : 'amber',
          icono: 'fas fa-heartbeat',
          badgeTexto: evalPA.clase === 'danger' ? 'Crítica' : 'Vigilar',
          badgeClase: evalPA.clase === 'danger' ? 'badge-pendiente' : 'badge-aviso',
          coordenadas: { lat: coords.lat, lng: coords.lng },
          ubicacion: coords.zona || this.paciente.barrioResidencia,
          descripcion: `Tensiómetro digital (${this.paciente.nombre}): ${sis}/${dia} mmHg (${bpm} BPM). Esquema antihipertensivo: Nifedipino (8 AM / 8 PM) y Valsartán (2 PM). Protocolo: ${evalPA.protocolo}`
        });
      }

      this.actualizarTodaLaUI();

      return nuevaPA;
    }

    async guardarMetasPersonalizadas(nuevasMetas, datosPaciente = {}) {
      this.metas = { ...this.metas, ...nuevasMetas };
      this.paciente = { ...this.paciente, ...datosPaciente };
      await window.DiaMonDatos.guardarMetas(this.metas, this.paciente.profesionalGuia);
      await window.DiaMonDatos.guardarPerfilPaciente({
        nombre: this.paciente.nombre,
        barrio: this.paciente.barrioResidencia,
        profesional_guia: this.paciente.profesionalGuia
      });
      this.sincronizarFichaQROficial();
      this.actualizarTodaLaUI();
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

    // Actualización de interfaz y modales
    obtenerResumenClinicoActual() {
      // Si todavia no hay lecturas se muestra un guion, nada inventado
      const sinLectura = { etiqueta: 'Sin lecturas', clase: 'info', requiereAlerta: false, protocolo: '' };
      const ultimaGlucosa = this.glucosas[0] || { valor: '—', contexto: 'ayunas', ContextoLabel: 'aún no registrada', ts: null };
      const ultimaPresion = this.presiones[0] || { sistolica: '—', diastolica: '—', pulso: '—', ts: null };
      const evalG = this.glucosas[0] ? this.evaluarGlucosa(ultimaGlucosa.valor, ultimaGlucosa.contexto) : sinLectura;
      const evalP = this.presiones[0] ? this.evaluarPresion(ultimaPresion.sistolica, ultimaPresion.diastolica) : sinLectura;

      const promedioG = this.glucosas.length === 0 ? '—' : Math.round(this.glucosas.reduce((acc, item) => acc + Number(item.valor), 0) / Math.max(1, this.glucosas.length));
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
      if (kpiGVal) kpiGVal.textContent = this.glucosas.length ? `${res.ultimaGlucosa.valor} mg/dL` : '—';
      if (kpiGBadge) {
        kpiGBadge.className = `dc-kpi-badge ${res.evalG.clase}`;
        kpiGBadge.innerHTML = `<i class="fas fa-check-circle"></i> ${res.evalG.etiqueta} (${res.ultimaGlucosa.ContextoLabel})`;
      }

      const kpiPAVal = document.getElementById('kpiPresionVal');
      const kpiPABadge = document.getElementById('kpiPresionBadge');
      if (kpiPAVal) kpiPAVal.textContent = this.presiones.length ? `${res.ultimaPresion.sistolica}/${res.ultimaPresion.diastolica} mmHg` : '—';
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
      if (bannerMetaG) bannerMetaG.textContent = `ayunas ${res.metas.glucosaMin}–${res.metas.glucosaMetaAyunas}, después de comer < ${res.metas.glucosaMaxPost} mg/dL`;
      if (bannerMetaPA) bannerMetaPA.textContent = `< ${res.metas.sistolicaMax}/${res.metas.diastolicaMax} mmHg`;
      if (bannerProf) bannerProf.textContent = res.paciente.profesionalGuia;

      this.renderHistorialRecienteDashboard();
      this.actualizarVistaAdultoMayor(res);

      // El reporte del dia se actualiza en reporte-diario.js
      if (window.renderReporteDiario) window.renderReporteDiario();
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

      if (combinados.length === 0) {
        container.innerHTML = '<p style="font-size:13px; color:var(--dc-text-muted); margin:6px 0;">Aún no hay lecturas registradas. Usa "Registrar Glucosa / Presión".</p>';
        return;
      }

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
              <strong>Control de Hipertensión (Nifedipino 8 AM/8 PM + Valsartán 2 PM):</strong> Meta &lt; ${m.sistolicaMax}/${m.diastolicaMax} mmHg.
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

    // Boton SOS del paciente: crea la alerta y la envia al cuidador con la ubicacion
    activarSOSPaciente() {
      const ubic = (window.TelemetriaDiaMon && window.TelemetriaDiaMon.gpsFijado) ? window.TelemetriaDiaMon.ubicacion : this._ultimaPosicion;
      if (window.emitirAlerta24Horas) {
        window.emitirAlerta24Horas({
          titulo: `SOS: ${this.paciente.nombre} pidió ayuda`,
          subtitulo: 'El paciente presionó el botón de emergencia.',
          tipo: 'sos',
          color: 'red',
          icono: 'fas fa-bell',
          badgeTexto: 'Pendiente',
          badgeClase: 'badge-pendiente',
          coordenadas: ubic ? { lat: ubic.lat, lng: ubic.lng } : null,
          ubicacion: ubic ? `${Number(ubic.lat).toFixed(5)}, ${Number(ubic.lng).toFixed(5)}` : 'Ubicación no disponible',
          descripcion: 'Llama al paciente y revisa su ubicación en el mapa. Si no responde, llama al 123.'
        });
      }
      if (window.vozSOSInstance) window.vozSOSInstance.abrirPantallaEmergenciaGrande('Botón SOS Paciente');
      if (window.mostrarNotificacion) window.mostrarNotificacion('Se envió la alerta SOS a tu cuidador.', 'success');
    }

    // Vista simplificada de lectura grande para el paciente o adulto mayor
    toggleModoAdultoMayor(forzar) {
      this.modoAdultoMayor = forzar !== undefined ? forzar : !this.modoAdultoMayor;
      let overlay = document.getElementById('vistaAdultoMayorOverlay');

      // La vista simplificada es solo para el paciente con sesion iniciada
      const ses = window.DiaMonSesion ? window.DiaMonSesion.leerUsuario() : null;
      const esPaciente = window.DiaMonSesion && window.DiaMonSesion.rolDe(ses) === 'usuario';
      if (this.modoAdultoMayor && !esPaciente) {
        this.modoAdultoMayor = false;
        if (window.mostrarNotificacion) {
          window.mostrarNotificacion('La vista simplificada es solo para la cuenta del paciente.', 'warn');
        }
      }

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
      // Aqui siempre es el paciente, asi que se saluda con su propio nombre
      const nombreMostrar = ses.nombre || res.paciente.nombre;

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
            <div>• <strong>8:00 AM:</strong> Pantoprazol, Metformina, Firialta y Nifedipino</div>
            <div>• <strong>2:00 PM:</strong> Valsartán</div>
            <div>• <strong>8:00 PM:</strong> Atorvastatina, Metformina, Gabapentina, Lipotic y Nifedipino</div>
            <div>• <strong>9:00 PM:</strong> Insulina (24 Unidades) · <strong>Sábados:</strong> Ozempic</div>
          </div>

          <!-- 4 BOTONES GIGANTES -->
          <div style="display:grid; grid-template-columns:1fr; gap:14px;">
            <button onclick="window.casoEstudio.activarSOSPaciente();" style="background:linear-gradient(135deg, #dc2626, #b91c1c); border:none; border-radius:20px; padding:22px; color:#ffffff; font-size:21px; font-weight:800; display:flex; align-items:center; justify-content:center; gap:14px; cursor:pointer; box-shadow:0 10px 25px rgba(220,38,38,0.4);">
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

      // Se marca la toma que corresponde a la hora actual (la misma lista de Salud y Medicamentos)
      const h = new Date().getHours() + new Date().getMinutes() / 60;
      const medId = h < 12 ? 'med-1' : h < 17 ? 'med-2' : h < 20.75 ? 'med-3' : 'med-4';
      const med = (window.MEDICAMENTOS_DIARIOS || []).find(m => m.id === medId) || { nombre: 'Esquema del día', horario: hora };
      await window.DiaMonDatos.guardarToma({
        medicamentoId: medId, nombre: med.nombre, horario: med.horario, dosis: med.dosis,
        fecha: window.DiaMonDatos.hoyISO(), tomada: true, quien: 'paciente'
      });

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

    // En la cuenta del paciente la ubicacion se transmite sola si ya dio permiso.
    // Asi el celular del paciente puede quedarse en casa transmitiendo y el cuidador lo ve desde donde este.
    const ses = window.DiaMonSesion ? window.DiaMonSesion.leerUsuario() : null;
    const permiso = localStorage.getItem('diamon_permiso_ubicacion_tipo');
    if (window.DiaMonSesion && window.DiaMonSesion.rolDe(ses) === 'usuario' && (permiso === 'siempre' || permiso === 'en_uso')) {
      window.casoEstudio.toggleTransmisionGPSReal();
    }

    // Se reenvia la ultima posicion cada 30 s para que quien abra el panel despues tambien la vea
    setInterval(() => {
      const caso = window.casoEstudio;
      if (caso.transmitiendoGPSReal && caso._ultimaPosicion) {
        const p = caso._ultimaPosicion;
        caso.emitirPorCanales('GPS_EN_VIVO', { ...p, coords: p });
      }
    }, 30000);
    if (window.location.hash === '#modo-abuelo' || localStorage.getItem('diamon_abrir_abuelo') === '1') {
      localStorage.removeItem('diamon_abrir_abuelo');
      window.casoEstudio.toggleModoAdultoMayor(true);
    }
  });
})();
