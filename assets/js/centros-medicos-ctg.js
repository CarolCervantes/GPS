// // DiaMon - Directorio y Capa de Centros Médicos en Cartagena de Indias
// Clínicas de urgencias, hospitales y farmacias 24h
// const CENTROS_MEDICOS_CARTAGENA = [
  {
    id: 'huc',
    nombre: 'Hospital Universitario del Caribe (HUC)',
    tipo: 'hospital',
    urgencias24h: true,
    direccion: 'Calle 29 # 50-50, Zarzagocilla',
    barrio: 'Zarzagocilla',
    telefono: '(+57) 605 672 4340',
    telefonoRaw: 'tel:+576056724340',
    coordenadas: [10.39512, -75.49524],
    servicios: ['Urgencias 24h Nivel III/IV', 'UCI Adultos', 'Laboratorio Clínico', 'Atención Diabética'],
    destacado: 'Hospital público de alta complejidad'
  },
  {
    id: 'blas-de-lezo',
    nombre: 'Clínica Blas de Lezo',
    tipo: 'clinica',
    urgencias24h: true,
    direccion: 'Cra. 59 # 25-108, Los Ejecutivos',
    barrio: 'Los Ejecutivos',
    telefono: '(+57) 605 669 8000',
    telefonoRaw: 'tel:+576056698000',
    coordenadas: [10.40021, -75.50284],
    servicios: ['Urgencias 24h', 'Hospitalización', 'Endocrinología', 'UCI'],
    destacado: 'Atención de emergencias 24 horas'
  },
  {
    id: 'nuevo-bocagrande',
    nombre: 'Nuevo Hospital Bocagrande',
    tipo: 'hospital',
    urgencias24h: true,
    direccion: 'Cra. 6 # 5-49, Bocagrande',
    barrio: 'Bocagrande',
    telefono: '(+57) 605 665 5270',
    telefonoRaw: 'tel:+576056655270',
    coordenadas: [10.40220, -75.55390],
    servicios: ['Urgencias 24h', 'Trauma y Cirugía', 'Monitoreo Metabólico'],
    destacado: 'Zona turística y Bocagrande'
  },
  {
    id: 'medihelp',
    nombre: 'Clínica MediHelp Services',
    tipo: 'clinica',
    urgencias24h: true,
    direccion: 'Cra. 6 # 5-101, Castillogrande',
    barrio: 'Castillogrande',
    telefono: '(+57) 605 655 1000',
    telefonoRaw: 'tel:+576056551000',
    coordenadas: [10.39805, -75.55620],
    servicios: ['Urgencias Internacionales 24h', 'UCI', 'Ambulancias medicalizadas'],
    destacado: 'Alta tecnología en Castillogrande'
  },
  {
    id: 'cartagena-del-mar',
    nombre: 'Clínica Cartagena del Mar',
    tipo: 'clinica',
    urgencias24h: true,
    direccion: 'Calle 30 # 20-71, Pie de la Popa',
    barrio: 'Pie de la Popa',
    telefono: '(+57) 605 656 9140',
    telefonoRaw: 'tel:+576056569140',
    coordenadas: [10.41825, -75.53450],
    servicios: ['Urgencias 24h', 'Medicina Interna', 'Unidad de Cuidados Especiales'],
    destacado: 'Acceso rápido Pie de la Popa y Manga'
  },
  {
    id: 'gestion-salud',
    nombre: 'Clínica General del Caribe (Gestión Salud)',
    tipo: 'clinica',
    urgencias24h: true,
    direccion: 'Calle 31 # 80-92, San Fernando',
    barrio: 'San Fernando',
    telefono: '(+57) 605 653 5555',
    telefonoRaw: 'tel:+576056535555',
    coordenadas: [10.38870, -75.47890],
    servicios: ['Urgencias 24h', 'Cirugía', 'Consulta Especializada'],
    destacado: 'Ubicación central sur de Cartagena'
  },
  {
    id: 'clinica-crecer',
    nombre: 'Clínica Crecer',
    tipo: 'clinica',
    urgencias24h: true,
    direccion: 'Transversal 38 # 22-86, Prado',
    barrio: 'El Prado',
    telefono: '(+57) 605 672 3800',
    telefonoRaw: 'tel:+576056723800',
    coordenadas: [10.40750, -75.51860],
    servicios: ['Urgencias Pediátricas y Adultos 24h', 'UCI', 'Laboratorio'],
    destacado: 'Zona Prado / Bruselas'
  },
  {
    id: 'cruz-roja',
    nombre: 'Cruz Roja Colombiana - Seccional Bolívar',
    tipo: 'hospital',
    urgencias24h: false,
    direccion: 'Av. Pedro de Heredia, Sector España',
    barrio: 'España',
    telefono: '(+57) 605 662 5888',
    telefonoRaw: 'tel:+576056625888',
    coordenadas: [10.41200, -75.52600],
    servicios: ['Atención Médica Inmediata', 'Servicio de Ambulancias', 'Banco de Sangre'],
    destacado: 'Ambulancias y respuesta rápida'
  },
  {
    id: 'farmatodo-bocagrande',
    nombre: 'Farmatodo Bocagrande (24 Horas)',
    tipo: 'farmacia',
    urgencias24h: true,
    direccion: 'Cra. 3 # 6-39, Bocagrande',
    barrio: 'Bocagrande',
    telefono: '(+57) 605 693 0000',
    telefonoRaw: 'tel:+576056930000',
    coordenadas: [10.40550, -75.55280],
    servicios: ['Farmacia 24 Horas', 'Tiras Reactivas y Glucómetros', 'Insulinas con cadena de frío', 'Inyectología'],
    destacado: 'Farmacia 24h con insumos para diabetes'
  },
  {
    id: 'farmatodo-manga',
    nombre: 'Farmatodo Manga (24 Horas)',
    tipo: 'farmacia',
    urgencias24h: true,
    direccion: 'Av. Miramar Calle 25 # 21-82, Manga',
    barrio: 'Manga',
    telefono: '(+57) 605 693 0000',
    telefonoRaw: 'tel:+576056930000',
    coordenadas: [10.41350, -75.54120],
    servicios: ['Farmacia 24 Horas', 'Glucosa oral y colaciones rápidas', 'Medicamentos diabéticos'],
    destacado: 'Farmacia 24h en Manga'
  },
  {
    id: 'rebaja-popa',
    nombre: 'Drogas La Rebaja - Pie de la Popa',
    tipo: 'farmacia',
    urgencias24h: true,
    direccion: 'Calle 30 # 21-12, Pie de la Popa',
    barrio: 'Pie de la Popa',
    telefono: '01 8000 914 104',
    telefonoRaw: 'tel:018000914104',
    coordenadas: [10.41900, -75.53300],
    servicios: ['Disponibilidad de Insulina', 'Medicamentos Genéricos y Comerciales', 'Domicilio 24h'],
    destacado: 'Dispensario con insulinas'
  },
  {
    id: 'drogueria-inglesa-centro',
    nombre: 'Droguería Inglesa - Centro Histórico',
    tipo: 'farmacia',
    urgencias24h: false,
    direccion: 'Calle San Agustín # 6-18, Centro Amurallado',
    barrio: 'Centro Histórico',
    telefono: '(+57) 605 664 2133',
    telefonoRaw: 'tel:+576056642133',
    coordenadas: [10.42350, -75.55020],
    servicios: ['Farmacia general', 'Glucómetros', 'Primeros auxilios'],
    destacado: 'Ubicación turística céntrica'
  }
];

class CentrosMedicosCartagena {
  constructor() {
    this.map = null;
    this.markersGroup = null;
    this.routePolyline = null;
    this.filtroActual = 'todos';
    this.visible = true;
    this.patientCoords = [10.3910, -75.4794]; // Defecto Cartagena
  }

  init(mapInstance) {
    if (!mapInstance) return;
    this.map = mapInstance;
    this.markersGroup = L.layerGroup().addTo(this.map);
    this.renderMarkers();
    this.bindEvents();
    window.centrosMedicosInstance = this;
  }

  setPatientCoords(coords) {
    if (coords && coords.length === 2) {
      this.patientCoords = coords;
      this.actualizarDistanciasEnPopups();
    }
  }

  calcularDistanciaKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2);
  }

  getIcon(centro) {
    let emoji = '🏥';
    let bg = '#B23A48';
    let borderColor = '#ff7b8b';

    if (centro.tipo === 'farmacia') {
      emoji = '💊';
      bg = '#2A9D8F';
      borderColor = '#48cae4';
    } else if (centro.tipo === 'hospital') {
      emoji = '🚑';
      bg = '#D62828';
      borderColor = '#ff9e9e';
    }

    return L.divIcon({
      className: 'custom-medical-pin',
      html: `
        <div style="
          background: ${bg};
          border: 2px solid ${borderColor};
          color: white;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.4);
          cursor: pointer;
          transition: transform 0.2s;
        " title="${centro.nombre}">
          ${emoji}
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -18]
    });
  }

  generarPopupHTML(centro) {
    const dist = this.calcularDistanciaKm(
      this.patientCoords[0], this.patientCoords[1],
      centro.coordenadas[0], centro.coordenadas[1]
    );

    const badgeUrg = centro.urgencias24h
      ? `<span style="background:rgba(239,68,68,0.2);color:#ef4444;border:1px solid #ef4444;padding:2px 7px;border-radius:12px;font-size:10px;font-weight:700;">URGENCIAS 24H</span>`
      : `<span style="background:rgba(59,130,246,0.2);color:#60a5fa;border:1px solid #60a5fa;padding:2px 7px;border-radius:12px;font-size:10px;font-weight:700;">HORARIO REGULAR</span>`;

    const serviciosHTML = centro.servicios
      .map(s => `<li style="margin:2px 0;font-size:11px;color:#cbd5e1;">• ${s}</li>`)
      .join('');

    return `
      <div style="font-family:'Inter',sans-serif; min-width:240px; max-width:290px; color:#f8fafc;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <span style="font-size:10px; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; font-weight:600;">
            ${centro.barrio} · Cartagena
          </span>
          ${badgeUrg}
        </div>
        <h4 style="margin:0 0 4px 0; font-size:14px; font-weight:700; color:#38bdf8; line-height:1.2;">
          ${centro.nombre}
        </h4>
        <p style="margin:0 0 8px 0; font-size:11px; color:#94a3b8;">
          📍 ${centro.direccion}
        </p>
        <div style="background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.08); padding:6px 8px; border-radius:6px; margin-bottom:8px;">
          <div style="font-size:11px; font-weight:600; color:#e2e8f0; margin-bottom:3px;">
            Servicios clave:
          </div>
          <ul style="padding-left:4px; margin:0; list-style:none;">
            ${serviciosHTML}
          </ul>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-size:11px; color:#cbd5e1;">
          <span>📏 Distancia estimada:</span>
          <strong style="color:#f59e0b; font-size:12px;">${dist} km</strong>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          <a href="${centro.telefonoRaw}" style="
            background:#0284c7;
            color:white;
            text-decoration:none;
            padding:6px 8px;
            border-radius:6px;
            font-size:11px;
            font-weight:600;
            text-align:center;
            display:flex;
            align-items:center;
            justify-content:center;
            gap:4px;
          ">
            📞 Llamar
          </a>
          <button onclick="window.centrosMedicosInstance.trazarRutaHacia([${centro.coordenadas}])" style="
            background:#10b981;
            color:white;
            border:none;
            padding:6px 8px;
            border-radius:6px;
            font-size:11px;
            font-weight:600;
            cursor:pointer;
            display:flex;
            align-items:center;
            justify-content:center;
            gap:4px;
          ">
            🧭 Trazar ruta
          </button>
        </div>
      </div>
    `;
  }

  renderMarkers() {
    if (!this.markersGroup) return;
    this.markersGroup.clearLayers();

    if (!this.visible) return;

    const lista = CENTROS_MEDICOS_CARTAGENA.filter(c => {
      if (this.filtroActual === 'todos') return true;
      if (this.filtroActual === 'urgencias') return c.urgencias24h;
      if (this.filtroActual === 'hospitales') return c.tipo === 'hospital' || c.tipo === 'clinica';
      if (this.filtroActual === 'farmacias') return c.tipo === 'farmacia';
      return true;
    });

    lista.forEach(centro => {
      const marker = L.marker(centro.coordenadas, {
        icon: this.getIcon(centro)
      });
      marker.bindPopup(this.generarPopupHTML(centro), {
        className: 'custom-medical-popup'
      });
      this.markersGroup.addLayer(marker);
    });
  }

  trazarRutaHacia(destinoCoords) {
    if (!this.map) return;

    if (this.routePolyline) {
      this.map.removeLayer(this.routePolyline);
    }

    const puntos = [this.patientCoords, destinoCoords];
    this.routePolyline = L.polyline(puntos, {
      color: '#38bdf8',
      weight: 4,
      dashArray: '8, 8',
      opacity: 0.9
    }).addTo(this.map);

    this.map.fitBounds(this.routePolyline.getBounds(), { padding: [50, 50] });

    if (window.mostrarNotificacion) {
      window.mostrarNotificacion('Ruta trazada hacia centro médico en Cartagena', 'info');
    }
  }

  filtrar(filtro) {
    this.filtroActual = filtro;
    this.renderMarkers();
  }

  toggleVisibilidad() {
    this.visible = !this.visible;
    if (this.markersGroup) {
      if (this.visible) {
        this.renderMarkers();
      } else {
        this.markersGroup.clearLayers();
        if (this.routePolyline) {
          this.map.removeLayer(this.routePolyline);
          this.routePolyline = null;
        }
      }
    }
    return this.visible;
  }

  actualizarDistanciasEnPopups() {
    this.renderMarkers();
  }

  bindEvents() {
    // Si hay botones de filtro en la interfaz
    document.querySelectorAll('[data-med-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('[data-med-filter]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.filtrar(e.currentTarget.dataset.medFilter);
      });
    });

    const toggleBtn = document.getElementById('btnToggleCentrosCartagena');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const estado = this.toggleVisibilidad();
        toggleBtn.classList.toggle('active', estado);
        toggleBtn.innerHTML = estado
          ? '<i class="fas fa-hospital-alt"></i> Clínicas CTG: <strong>Activas</strong>'
          : '<i class="fas fa-hospital-alt"></i> Clínicas CTG: <strong>Ocultas</strong>';
      });
    }
  }
}

window.CentrosMedicosCartagena = CentrosMedicosCartagena;
window.CENTROS_MEDICOS_CARTAGENA = CENTROS_MEDICOS_CARTAGENA;

