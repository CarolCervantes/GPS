// ============ REGISTROS DE USUARIO ============
// Carga y gestiona los registros de salud del usuario desde Supabase.

let todosLosRegistros = [];
let registrosFiltrados = [];
let filtroTipoActivo = 'todos';
let filtroBusqueda = '';
let filtroFechaActiva = null;

document.addEventListener('dashboardListo', async (e) => {
  const userId = e.detail?.user?.id;
  if (!userId) return;

  await cargarDatos(userId);
  initFiltros();
  initPDF();

  flatpickr('#filtroFecha', {
    locale: 'es',
    dateFormat: 'Y-m-d',
    allowInput: true,
    disableMobile: true,
    onChange: (dates) => {
      filtroFechaActiva = dates[0] || null;
      aplicarFiltros();
    },
    onReady: (_, __, fp) => {
      // Botón limpiar fecha
      const clearBtn = document.createElement('button');
      clearBtn.textContent = 'Limpiar';
      clearBtn.className = 'flatpickr-clear-btn';
      clearBtn.addEventListener('click', () => {
        fp.clear();
        filtroFechaActiva = null;
        aplicarFiltros();
        fp.close();
      });
      fp.calendarContainer.appendChild(clearBtn);
    },
  });
});

async function cargarDatos(userId) {
  const hace30Dias = new Date();
  hace30Dias.setDate(hace30Dias.getDate() - 30);

  const [{ data: registros }, { data: glucosaData }] = await Promise.all([
    supabaseClient
      .from('registros')
      .select('*')
      .eq('user_id', userId)
      .order('ts', { ascending: false }),
    supabaseClient
      .from('glucosa_lecturas')
      .select('valor, ts')
      .eq('user_id', userId)
      .gte('ts', hace30Dias.toISOString())
      .order('ts', { ascending: false }),
  ]);

  todosLosRegistros = registros || [];
  registrosFiltrados = [...todosLosRegistros];

  renderTabla(registrosFiltrados);
  calcularKPIs(todosLosRegistros);
  calcularGlucosaStats(glucosaData || []);
}

// ========== RENDER TABLA ==========

function formatearFecha(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function badgeTipo(tipo) {
  const colores = {
    glucosa:     '#E89A3C',
    actividad:   '#5EA889',
    alimentacion:'#f97316',
    medicacion:  '#C084FC',
    nota:        '#6b7280',
  };
  const color = colores[tipo] || '#6b7280';
  return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:0.7rem;font-weight:600;text-transform:capitalize;background:${color}22;color:${color};">${tipo}</span>`;
}

function renderTabla(registros) {
  const tbody = document.getElementById('tablaRegistrosBody');
  if (!tbody) return;

  if (!registros || registros.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Sin registros todavía.</td></tr>';
    return;
  }

  tbody.innerHTML = registros.map(r => `
    <tr>
      <td>${formatearFecha(r.ts)}</td>
      <td>${badgeTipo(r.tipo)}</td>
      <td>${r.valor || '—'}</td>
      <td>${r.etiquetas?.join(', ') || '—'}</td>
      <td>${r.notas || '—'}</td>
      <td></td>
    </tr>
  `).join('');
}

// ========== KPIs ==========

function calcularKPIs(registros) {
  const conteo = { glucosa: 0, actividad: 0, alimentacion: 0, medicacion: 0 };
  registros.forEach(r => {
    if (conteo[r.tipo] !== undefined) conteo[r.tipo]++;
  });

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('totalRegistros', registros.length);
  set('totalGlucosa', conteo.glucosa);
  set('totalActividad', conteo.actividad);
  set('totalAlimentacion', conteo.alimentacion);
  set('totalMedicacion', conteo.medicacion);
}

// ========== ESTADÍSTICAS GLUCOSA ==========

function calcularGlucosaStats(lecturas) {
  if (!lecturas || lecturas.length === 0) return;

  const valores = lecturas.map(l => l.valor).filter(v => v != null);
  if (valores.length === 0) return;

  const suma = valores.reduce((a, b) => a + b, 0);
  const prom = Math.round(suma / valores.length);
  const max = Math.max(...valores);
  const min = Math.min(...valores);

  const enRango = valores.filter(v => v >= 70 && v <= 180).length;
  const alto = valores.filter(v => v > 180).length;
  const bajo = valores.filter(v => v < 70).length;
  const total = valores.length;

  const pctEnRango = Math.round((enRango / total) * 100);
  const pctAlto = Math.round((alto / total) * 100);
  const pctBajo = Math.round((bajo / total) * 100);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('glucosaPromedio', `${prom} mg/dL`);
  set('glucosaMax', `${max} mg/dL`);
  set('glucosaMin', `${min} mg/dL`);

  const fillBarra = (selector, pct) => {
    const el = document.querySelector(selector);
    if (el) el.style.width = `${pct}%`;
  };
  const fillPct = (selector, pct) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = `${pct}%`;
  };

  fillBarra('.rango-fill.en-rango', pctEnRango);
  fillPct('.rango-item:nth-child(1) .rango-pct', pctEnRango);
  fillBarra('.rango-fill.alto', pctAlto);
  fillPct('.rango-item:nth-child(2) .rango-pct', pctAlto);
  fillBarra('.rango-fill.bajo', pctBajo);
  fillPct('.rango-item:nth-child(3) .rango-pct', pctBajo);
}

// ========== FILTROS ==========

function initFiltros() {
  // Botones segmentados por tipo
  const segmentBtns = document.querySelectorAll('.segmented button');
  segmentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      segmentBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filtroTipoActivo = btn.textContent.toLowerCase().trim();
      if (filtroTipoActivo === 'todos') filtroTipoActivo = 'todos';
      aplicarFiltros();
    });
  });

  // Búsqueda por texto
  const buscarInput = document.getElementById('buscarRegistro');
  if (buscarInput) {
    buscarInput.addEventListener('input', (e) => {
      filtroBusqueda = e.target.value.toLowerCase();
      aplicarFiltros();
    });
  }
}

function aplicarFiltros() {
  registrosFiltrados = todosLosRegistros.filter(r => {
    // Filtro tipo
    if (filtroTipoActivo !== 'todos' && r.tipo !== filtroTipoActivo) return false;

    // Filtro búsqueda
    if (filtroBusqueda) {
      const texto = `${r.tipo} ${r.valor} ${r.notas || ''} ${r.etiquetas?.join(' ') || ''}`.toLowerCase();
      if (!texto.includes(filtroBusqueda)) return false;
    }

    // Filtro fecha
    if (filtroFechaActiva) {
      const fechaRegistro = new Date(r.ts);
      const mismoAnio = fechaRegistro.getFullYear() === filtroFechaActiva.getFullYear();
      const mismoMes = fechaRegistro.getMonth() === filtroFechaActiva.getMonth();
      const mismoDia = fechaRegistro.getDate() === filtroFechaActiva.getDate();
      if (!mismoAnio || !mismoMes || !mismoDia) return false;
    }

    return true;
  });

  renderTabla(registrosFiltrados);
  calcularKPIs(registrosFiltrados);
}

// ========== DESCARGA PDF ==========

function initPDF() {
  const btn = document.getElementById('btnDescargarPDF');
  if (!btn) return;
  btn.addEventListener('click', () => descargarPDF(registrosFiltrados));
}

function descargarPDF(registros) {
  if (typeof window.jspdf === 'undefined') {
    alert('La librería de PDF aún no ha cargado. Espera un momento e intenta de nuevo.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Encabezado
  doc.setFillColor(14, 165, 233);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('DiaMon — Registros de salud', 14, 14);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generado: ${new Date().toLocaleDateString('es-CO', { dateStyle: 'long' })}`, 14, 22);

  // Tabla de registros
  doc.setTextColor(0, 0, 0);
  const filas = registros.map(r => [
    formatearFecha(r.ts),
    r.tipo || '—',
    r.valor || '—',
    r.etiquetas?.join(', ') || '—',
    r.notas || '—',
  ]);

  doc.autoTable({
    startY: 34,
    head: [['Fecha', 'Tipo', 'Valor', 'Etiquetas', 'Notas']],
    body: filas.length > 0 ? filas : [['Sin registros', '', '', '', '']],
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [14, 165, 233], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 25 },
      2: { cellWidth: 25 },
      3: { cellWidth: 40 },
      4: { cellWidth: 55 },
    },
  });

  // Pie de página
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${pageCount}`, 14, doc.internal.pageSize.height - 8);
    doc.text('DiaMon • Sistema de monitoreo glucémico', 105, doc.internal.pageSize.height - 8, { align: 'center' });
  }

  doc.save(`registros-diamon-${new Date().toISOString().split('T')[0]}.pdf`);
}
