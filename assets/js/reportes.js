let reporteData = {
    nombre_usuario: 'Usuario',
    fecha_generacion: new Date().toLocaleDateString('es-CO'),
    total_registros: 0,
    promedio: 0,
    maximo: 0,
    minimo: 0,
    desviacion: 0,
    cv: 0,
    porc_en_rango: 0,
    porc_alto: 0,
    porc_bajo: 0,
    indice_control: 0
};

const COLORS = {
    brand: '#3CB4C9',
    brandSoft: 'rgba(60, 180, 201, 0.10)',
    fg3: '#8893A3',
    fg4: '#5A6473',
    grid: 'rgba(255, 255, 255, 0.04)'
};

function initTendenciaChart() {
    const ctx = document.getElementById('tendenciaChart');
    if (!ctx) return;

    ctx.__chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['01', '08', '15', '22', '31'],
            datasets: [{
                label: 'Promedio diario (mg/dL)',
                data: [180, 150, 130, 120, 110],
                borderColor: COLORS.brand,
                backgroundColor: COLORS.brandSoft,
                borderWidth: 1.5,
                fill: true,
                tension: 0.35,
                pointRadius: 3,
                pointBackgroundColor: COLORS.brand,
                pointBorderColor: '#0B1220',
                pointBorderWidth: 1.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1A2738',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    titleColor: '#E8EEF5',
                    bodyColor: '#B8C2CF',
                    titleFont: { family: 'JetBrains Mono', size: 11, weight: '500' },
                    bodyFont: { family: 'JetBrains Mono', size: 11 },
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false
                }
            },
            scales: {
                y: {
                    min: 50, max: 250,
                    grid: { color: COLORS.grid, drawBorder: false },
                    border: { display: false },
                    ticks: {
                        color: COLORS.fg4,
                        font: { family: 'JetBrains Mono', size: 10 },
                        stepSize: 50
                    }
                },
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: {
                        color: COLORS.fg4,
                        font: { family: 'JetBrains Mono', size: 10 }
                    }
                }
            }
        }
    });
}

function generarVistaPrevia(data) {
    let mensajeRecomendacion = '';
    if (data.porc_en_rango >= 70) {
        mensajeRecomendacion = '✓ Mantienes tu glucosa en rango la mayor parte del tiempo.';
    } else if (data.porc_alto > data.porc_bajo) {
        mensajeRecomendacion = 'Tu glucosa tiende a estar alta. Considera ajustar tu alimentación.';
    } else {
        mensajeRecomendacion = 'Tu glucosa tiende a estar baja. Revisa tu medicación con tu médico.';
    }

    return `
        <div class="reporte-preview">
            <div class="brand-row"><i class="fas fa-tint"></i></div>
            <h2>DiaMon · Reporte de Salud</h2>
            <div class="meta">${data.nombre_usuario} · ${data.fecha_generacion}</div>
            <h3>Resumen general</h3>
            <div class="preview-grid">
                <div class="preview-card"><div class="label">Total registros</div><div class="value">${data.total_registros}</div></div>
                <div class="preview-card"><div class="label">Glucosa promedio</div><div class="value">${data.promedio} mg/dL</div></div>
                <div class="preview-card"><div class="label">Glucosa máxima</div><div class="value">${data.maximo} mg/dL</div></div>
                <div class="preview-card"><div class="label">Glucosa mínima</div><div class="value">${data.minimo} mg/dL</div></div>
            </div>
            <h3>Tiempo en rangos</h3>
            <div class="preview-grid">
                <div class="preview-card normal"><div class="label">En rango · 70–180</div><div class="value">${data.porc_en_rango}%</div></div>
                <div class="preview-card warn"><div class="label">Alto · &gt;180</div><div class="value">${data.porc_alto}%</div></div>
                <div class="preview-card alert"><div class="label">Bajo · &lt;70</div><div class="value">${data.porc_bajo}%</div></div>
                <div class="preview-card"><div class="label">Índice de control</div><div class="value">${data.indice_control}/10</div></div>
            </div>
            <h3>Estadísticas avanzadas</h3>
            <div class="preview-grid">
                <div class="preview-card"><div class="label">Desviación estándar</div><div class="value">${data.desviacion} mg/dL</div></div>
                <div class="preview-card"><div class="label">Coeficiente de variación</div><div class="value">${data.cv}%</div></div>
            </div>
            <div class="recom">${mensajeRecomendacion}</div>
        </div>`;
}

function abrirModal(contenido) {
    const modal = document.getElementById('reporteModal');
    const modalBody = document.getElementById('modalBody');
    if (!modal || !modalBody) return;
    modalBody.innerHTML = contenido;
    modal.classList.add('show');
}

function cerrarModal() {
    const modal = document.getElementById('reporteModal');
    if (modal) modal.classList.remove('show');
}

function generarReporte() {
    abrirModal(generarVistaPrevia(reporteData));
}

function descargarPDF() {
    const jsPDF = window.jspdf?.jsPDF;
    if (!jsPDF) {
        console.error('jsPDF no está cargado');
        return;
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const data = reporteData;

    // Encabezado
    doc.setFillColor(14, 165, 233);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('DiaMon — Reporte de Salud', 14, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`${data.nombre_usuario}  ·  ${data.fecha_generacion}`, 14, 22);

    // Sección: Resumen general
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Resumen general', 14, 42);

    if (typeof doc.autoTable === 'function') {
        doc.autoTable({
            startY: 46,
            head: [['Métrica', 'Valor']],
            body: [
                ['Total registros', String(data.total_registros)],
                ['Glucosa promedio', `${data.promedio} mg/dL`],
                ['Glucosa máxima', `${data.maximo} mg/dL`],
                ['Glucosa mínima', `${data.minimo} mg/dL`],
                ['Desviación estándar', `${data.desviacion} mg/dL`],
                ['Coeficiente de variación', `${data.cv}%`],
            ],
            styles: { fontSize: 10, cellPadding: 4 },
            headStyles: { fillColor: [14, 165, 233], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { left: 14, right: 14 },
        });

        // Sección: Tiempo en rangos
        const afterTable = doc.lastAutoTable.finalY + 8;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.text('Tiempo en rangos', 14, afterTable);

        doc.autoTable({
            startY: afterTable + 4,
            head: [['Rango', 'Porcentaje']],
            body: [
                ['En rango · 70–180 mg/dL', `${data.porc_en_rango}%`],
                ['Alto · > 180 mg/dL', `${data.porc_alto}%`],
                ['Bajo · < 70 mg/dL', `${data.porc_bajo}%`],
                ['Índice de control', `${data.indice_control}/10`],
            ],
            styles: { fontSize: 10, cellPadding: 4 },
            headStyles: { fillColor: [94, 168, 137], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { left: 14, right: 14 },
        });
    }

    // Recomendación
    let recom = '';
    if (data.porc_en_rango >= 70) recom = 'Mantienes tu glucosa en rango la mayor parte del tiempo. Buen control.';
    else if (data.porc_alto > data.porc_bajo) recom = 'Tu glucosa tiende a estar alta. Considera ajustar tu alimentación.';
    else recom = 'Tu glucosa tiende a estar baja. Revisa tu medicación con tu médico.';

    const yRecom = (doc.lastAutoTable?.finalY ?? 150) + 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(90, 100, 115);
    doc.text(recom, 14, yRecom, { maxWidth: 182 });

    // Pie de página
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 160, 175);
    doc.text('DiaMon · Generado automáticamente · No reemplaza consejo médico', 14, 285);

    const fecha = new Date().toISOString().split('T')[0];
    doc.save(`reporte-diamon-${fecha}.pdf`);
}

function cargarReportes() {
    const lista = document.getElementById('reportesLista');
    if (!lista) return;
    lista.innerHTML = '<div class="reporte-vacio"><i class="fas fa-folder-open"></i><p>Aún no hay reportes guardados.</p></div>';
}

function initReportesEventos() {
    const btnGenerar = document.getElementById('btnGenerarReporte');
    const btnPDF = document.getElementById('btnDescargarPDF');
    const closeModalBtn = document.querySelector('.modal-close');
    const cerrarModalBtn = document.querySelector('.btn-cerrar-modal');
    const modal = document.getElementById('reporteModal');

    if (btnGenerar) btnGenerar.addEventListener('click', generarReporte);
    if (btnPDF) btnPDF.addEventListener('click', descargarPDF);
    if (closeModalBtn) closeModalBtn.addEventListener('click', cerrarModal);
    if (cerrarModalBtn) cerrarModalBtn.addEventListener('click', cerrarModal);
    if (modal) {
        modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });
    }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModal(); });
}

document.addEventListener('DOMContentLoaded', () => {
    initTendenciaChart();
    initReportesEventos();
    cargarReportes();
    initFlatpickr();
});

document.addEventListener('dashboardListo', async (e) => {
    const userId = e.detail?.user?.id;
    if (!userId) return;

    const nombre = e.detail?.user?.user_metadata?.nombre || e.detail?.user?.email || 'Usuario';
    reporteData.nombre_usuario = nombre;

    // Cargar lecturas de glucosa del último mes
    const hace30 = new Date();
    hace30.setDate(hace30.getDate() - 30);

    const { data: lecturas } = await supabaseClient
        .from('glucosa_lecturas')
        .select('valor, ts')
        .eq('user_id', userId)
        .gte('ts', hace30.toISOString())
        .order('ts', { ascending: false });

    if (!lecturas || lecturas.length === 0) return;

    const valores = lecturas.map(l => l.valor);
    const promedio = Math.round(valores.reduce((a, b) => a + b, 0) / valores.length);
    const maximo   = Math.max(...valores);
    const minimo   = Math.min(...valores);
    const varianza = valores.reduce((s, v) => s + Math.pow(v - promedio, 2), 0) / valores.length;
    const desviacion = Math.round(Math.sqrt(varianza));
    const cv = Math.round((desviacion / promedio) * 100);

    const enRango = valores.filter(v => v >= 70 && v <= 180).length;
    const alto    = valores.filter(v => v > 180).length;
    const bajo    = valores.filter(v => v < 70).length;

    reporteData.total_registros = lecturas.length;
    reporteData.promedio = promedio;
    reporteData.maximo   = maximo;
    reporteData.minimo   = minimo;
    reporteData.desviacion = desviacion;
    reporteData.cv = cv;
    reporteData.porc_en_rango = Math.round(enRango / valores.length * 100);
    reporteData.porc_alto     = Math.round(alto    / valores.length * 100);
    reporteData.porc_bajo     = Math.round(bajo    / valores.length * 100);
    reporteData.indice_control = Math.min(10, Math.round(reporteData.porc_en_rango / 10));

    // Actualizar UI con los datos reales
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('reportesTotal',    lecturas.length);
    set('reportesPromedio', promedio + ' mg/dL');
    set('reportesMaximo',   maximo + ' mg/dL');
    set('reportesMinimo',   minimo + ' mg/dL');
    set('reportesDesviacion', desviacion + ' mg/dL');
    set('reportesCV',       cv + '%');
    set('reportesEnRango',  reporteData.porc_en_rango);

    // Actualizar gráfico con datos reales (últimos 5 días)
    actualizarGrafico(lecturas);
});

function actualizarGrafico(lecturas) {
    // Agrupar por día y calcular promedio diario
    const porDia = {};
    lecturas.forEach(l => {
        const dia = new Date(l.ts).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
        if (!porDia[dia]) porDia[dia] = [];
        porDia[dia].push(l.valor);
    });
    const dias = Object.keys(porDia).slice(-5).reverse();
    const promedios = dias.map(d => Math.round(porDia[d].reduce((a, b) => a + b, 0) / porDia[d].length));

    const ctx = document.getElementById('tendenciaChart');
    if (!ctx || !ctx.__chartInstance) return;
    const chart = ctx.__chartInstance;
    chart.data.labels = dias;
    chart.data.datasets[0].data = promedios;
    chart.update();
}

function initFlatpickr() {
    const input = document.getElementById('periodoReporte');
    if (!input || typeof flatpickr === 'undefined') return;
    flatpickr(input, {
        locale: typeof flatpickr.l10ns?.es !== 'undefined' ? 'es' : 'default',
        plugins: [],
        allowInput: true,
        dateFormat: 'Y-m',
        defaultDate: new Date().toISOString().slice(0, 7),
    });
}
