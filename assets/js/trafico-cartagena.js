// ============================================================
// DiaMon — Módulo de Tráfico y Congestión Automática en Cartagena
// Detección automática por telemetría GPS, velocidad y geocercas
// ============================================================

const CORREDORES_TRAFICO_CARTAGENA = [
  {
    id: 'bazurto',
    nombre: 'Av. Pedro de Heredia — Mercado de Bazurto',
    nivel: 'pesado',
    color: '#ef4444',
    retrasoMinutos: 15,
    radioMetros: 500,
    centro: [10.4158, -75.5298],
    descripcion: 'Punto crítico comercial y paradas de buses. Trancón constante.',
    coordenadas: [
      [10.4132, -75.5255],
      [10.4150, -75.5280],
      [10.4165, -75.5315],
      [10.4180, -75.5340]
    ]
  },
  {
    id: 'bomba-el-amparo',
    nombre: 'Bomba El Amparo — Ronda Real — Castellana',
    nivel: 'pesado',
    color: '#ef4444',
    retrasoMinutos: 14,
    radioMetros: 600,
    centro: [10.3895, -75.4870],
    descripcion: 'Nodo principal sur de Cartagena. Alta congestión vehicular.',
    coordenadas: [
      [10.3870, -75.4830],
      [10.3895, -75.4870],
      [10.3920, -75.4910]
    ]
  },
  {
    id: 'cuatro-vientos',
    nombre: 'Cuatro Vientos — Los Ejecutivos',
    nivel: 'moderado',
    color: '#f59e0b',
    retrasoMinutos: 8,
    radioMetros: 450,
    centro: [10.4010, -75.5035],
    descripcion: 'Cruce semafórico e intersección con Zarzagocilla.',
    coordenadas: [
      [10.3980, -75.4990],
      [10.4010, -75.5035],
      [10.4045, -75.5080]
    ]
  },
  {
    id: 'puentes-manga',
    nombre: 'Puente Román y Puente Las Palmas (Manga)',
    nivel: 'moderado',
    color: '#f59e0b',
    retrasoMinutos: 10,
    radioMetros: 400,
    centro: [10.4170, -75.5420],
    descripcion: 'Acceso hacia el Centro y Getsemaní. Cuello de botella en hora pico.',
    coordenadas: [
      [10.4170, -75.5450],
      [10.4185, -75.5420],
      [10.4150, -75.5390]
    ]
  },
  {
    id: 'bocagrande-base',
    nombre: 'Av. San Martín / Base Naval (Entrada Bocagrande)',
    nivel: 'moderado',
    color: '#f59e0b',
    retrasoMinutos: 9,
    radioMetros: 450,
    centro: [10.4080, -75.5525],
    descripcion: 'Ingreso único al sector turístico de Bocagrande.',
    coordenadas: [
      [10.4120, -75.5510],
      [10.4080, -75.5525],
      [10.4030, -75.5540]
    ]
  },
  {
    id: 'via-al-mar',
    nombre: 'Av. Santander — Crespo y Marbella',
    nivel: 'fluido',
    color: '#10b981',
    retrasoMinutos: 0,
    radioMetros: 800,
    centro: [10.4300, -75.5430],
    descripcion: 'Corredor costero con flujo continuo.',
    coordenadas: [
      [10.4350, -75.5380],
      [10.4300, -75.5430],
      [10.4260, -75.5480]
    ]
  }
];

class TraficoCartagenaManager {
  constructor() {
    this.map = null;
    this.trafficLayerGroup = null;
    this.visible = true;
    this.ultimaPosicion = null;
    this.ultimoTiempo = null;
    this.velocidadActualKmH = 0;
    this.congestionesDetectadas = new Set();
    this.initBanner();
  }

  init(mapInstance) {
    if (!mapInstance) return;
    this.map = mapInstance;
    this.trafficLayerGroup = L.layerGroup().addTo(this.map);
    this.renderCorredores();
    this.bindEvents();
    window.traficoCartagenaInstance = this;
  }

  initBanner() {
    // Banner superior de tráfico desactivado para mantener la interfaz limpia
    const existente = document.getElementById('trafficAutoBanner');
    if (existente) existente.remove();
  }

  renderCorredores() {
    if (!this.trafficLayerGroup) return;
    this.trafficLayerGroup.clearLayers();

    if (!this.visible) return;

    CORREDORES_TRAFICO_CARTAGENA.forEach(c => {
      // Línea de flujo vehicular
      const poly = L.polyline(c.coordenadas, {
        color: c.color,
        weight: c.nivel === 'pesado' ? 7 : 5,
        opacity: 0.85,
        dashArray: c.nivel === 'pesado' ? '12, 6' : null,
        lineCap: 'round'
      });

      // Círculo de geocerca de detección automática
      const circle = L.circle(c.centro, {
        radius: c.radioMetros,
        color: c.color,
        fillColor: c.color,
        fillOpacity: 0.12,
        weight: 1,
        dashArray: '4, 4'
      });

      const badge = c.nivel === 'pesado'
        ? '<span style="background:#ef4444;color:white;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;">TRANCÓN DETECTADO (+15 min)</span>'
        : (c.nivel === 'moderado'
          ? '<span style="background:#f59e0b;color:#0b1220;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;">TRÁFICO MODERADO (+8 min)</span>'
          : '<span style="background:#10b981;color:white;padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700;">FLUIDO</span>');

      const popupContent = `
        <div style="font-family:'Inter',sans-serif; min-width:220px; color:#f8fafc;">
          <div style="margin-bottom:6px;">${badge}</div>
          <h4 style="margin:0 0 4px 0; font-size:13px; color:#38bdf8;">${c.nombre}</h4>
          <p style="margin:0 0 6px 0; font-size:11px; color:#94a3b8;">${c.descripcion}</p>
          <div style="font-size:11px; color:#e2e8f0; background:rgba(255,255,255,0.06); padding:4px 8px; border-radius:4px;">
            🤖 <strong>Detección automática:</strong> Geocerca de ${c.radioMetros}m activa.
          </div>
        </div>
      `;

      poly.bindPopup(popupContent, { className: 'custom-traffic-popup' });
      circle.bindPopup(popupContent, { className: 'custom-traffic-popup' });

      this.trafficLayerGroup.addLayer(poly);
      this.trafficLayerGroup.addLayer(circle);
    });
  }

  // ============================================================
  // DETECCIÓN AUTOMÁTICA EN TIEMPO REAL POR TELEMETRÍA GPS
  // ============================================================
  procesarTelemetriaGPS(lat, lng, velocidadReportada = null) {
    if (!lat || !lng) return;

    const ahora = Date.now();
    let velocidadCalculada = velocidadReportada;

    if (velocidadCalculada === null && this.ultimaPosicion && this.ultimoTiempo) {
      const deltaSeg = (ahora - this.ultimoTiempo) / 1000;
      if (deltaSeg > 0.5) {
        const distanciaKm = this.calcularDistanciaMetros(
          this.ultimaPosicion.lat, this.ultimaPosicion.lng,
          lat, lng
        ) / 1000;
        velocidadCalculada = (distanciaKm / (deltaSeg / 3600)); // km/h
      }
    }

    this.ultimaPosicion = { lat, lng };
    this.ultimoTiempo = ahora;
    this.velocidadActualKmH = Math.max(0, Math.round(velocidadCalculada || 0));

    // Evaluar geocercas de cuellos de botella de Cartagena
    this.evaluarCongestionAutomatica(lat, lng, this.velocidadActualKmH);
  }

  evaluarCongestionAutomatica(lat, lng, velocidad) {
    let trancónDetectado = null;

    for (const corredor of CORREDORES_TRAFICO_CARTAGENA) {
      const distMetros = this.calcularDistanciaMetros(lat, lng, corredor.centro[0], corredor.centro[1]);
      if (distMetros <= corredor.radioMetros) {
        trancónDetectado = corredor;
        break;
      }
    }

    const banner = document.getElementById('trafficAutoBanner');
    const titleEl = document.getElementById('trafficBannerTitle');
    const subEl = document.getElementById('trafficBannerSub');
    const badgeEl = document.getElementById('trafficSpeedBadge');

    if (badgeEl) badgeEl.textContent = `${velocidad} km/h`;

    if (trancónDetectado) {
      // El vehículo o usuario está dentro de una zona de trancón conocida en Cartagena
      const esLento = velocidad <= 18; // Menos de 18 km/h en vía principal = trancón

      if (banner) {
        banner.style.display = 'flex';
        banner.className = `traffic-live-banner ${trancónDetectado.nivel === 'pesado' ? 'heavy' : 'moderate'}`;
      }

      if (titleEl) {
        titleEl.innerHTML = `<i class="fas fa-traffic-light"></i> Trancón detectado en ${trancónDetectado.nombre.split('—')[1] || trancónDetectado.nombre}`;
      }

      if (subEl) {
        subEl.textContent = esLento
          ? `Velocidad reducida (${velocidad} km/h). Ajuste automático de +${trancónDetectado.retrasoMinutos} min activado.`
          : `Flujo moderado a ${velocidad} km/h. Monitoreando congestión…`;
      }

      // Si no habíamos aplicado el retraso en esta sesión de trayecto, aplicarlo automáticamente
      if (!this.congestionesDetectadas.has(trancónDetectado.id)) {
        this.congestionesDetectadas.add(trancónDetectado.id);

        if (window.safeWalkInstance && window.safeWalkInstance.isActive) {
          window.safeWalkInstance.aplicarRetrasoAutomatico(trancónDetectado.retrasoMinutos, trancónDetectado.nombre);
        }
      }
    } else {
      // Vía despejada
      if (banner && velocidad > 25) {
        banner.style.display = 'none';
      } else if (banner) {
        banner.className = 'traffic-live-banner fluid';
        if (titleEl) titleEl.innerHTML = '<i class="fas fa-check-circle" style="color:#10b981;"></i> Tráfico Fluido en Cartagena';
        if (subEl) subEl.textContent = `Desplazamiento normal (${velocidad} km/h) sin trancones reportados.`;
      }
    }
  }

  calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
    const R = 6371000; // metros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toggleVisibilidad() {
    this.visible = !this.visible;
    if (this.trafficLayerGroup) {
      if (this.visible) {
        this.renderCorredores();
      } else {
        this.trafficLayerGroup.clearLayers();
      }
    }
    return this.visible;
  }

  calcularRetrasoRuta(origen, destino, modoTransporte = 'transcaribe') {
    if (modoTransporte === 'pie') {
      return { minutosExtra: 0, motivo: 'Desplazamiento peatonal' };
    }

    let extra = 0;
    const puntos = [];

    if (destino.id === 'udc-san-agustin' || destino.id === 'mall-plaza' || destino.id === 'bocagrande') {
      extra += 15;
      puntos.push('Av. Pedro de Heredia / Bazurto');
    }

    if (destino.id === 'udc-zarzagocilla' || destino.id === 'casa') {
      extra += 10;
      puntos.push('Cuatro Vientos / Bomba El Amparo');
    }

    return {
      minutosExtra: extra,
      motivo: puntos.length > 0 ? puntos.join(' + ') : 'Tráfico regular'
    };
  }

  bindEvents() {
    const btnToggle = document.getElementById('btnToggleTrafico');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        const activa = this.toggleVisibilidad();
        btnToggle.classList.toggle('active', activa);
        btnToggle.innerHTML = activa
          ? '<i class="fas fa-traffic-light"></i> Tráfico CTG: <strong>Activo</strong>'
          : '<i class="fas fa-traffic-light"></i> Tráfico CTG: <strong>Oculto</strong>';
      });
    }
  }
}

window.TraficoCartagenaManager = TraficoCartagenaManager;
window.CORREDORES_TRAFICO_CARTAGENA = CORREDORES_TRAFICO_CARTAGENA;
