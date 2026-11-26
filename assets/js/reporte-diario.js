// Reporte del dia: junta las lecturas, los medicamentos marcados y las alertas de una fecha
// y permite descargarlo en PDF para llevarlo al control con la enfermera.
(function () {
  'use strict';

  // Fecha en formato AAAA-MM-DD (igual que la usa salud-diaria.js)
  function fechaISO(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function fechaElegida() {
    const input = document.getElementById('reporteFecha');
    return (input && input.value) || fechaISO(new Date());
  }

  function codigoPaciente() {
    const ses = window.DiaMonSesion;
    const pac = ses ? ses.pacienteActivo(ses.leerUsuario()) : null;
    return (pac && pac.codigoPaciente) || 'DM-8492';
  }

  // Ultimos datos del paciente que llegaron de Supabase
  let datosBD = {};
  window.addEventListener('diamon-datos', (e) => {
    datosBD = e.detail || {};
    window.renderReporteDiario();
  });

  function hora(ts) {
    return new Date(ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }

  // Arma todos los datos del dia elegido
  function datosDelDia() {
    const caso = window.casoEstudio;
    const fecha = fechaElegida();
    const delDia = (ts) => ts && fechaISO(new Date(ts)) === fecha;

    const glucosas = (caso ? caso.glucosas : []).filter(g => delDia(g.ts)).sort((a, b) => a.ts - b.ts);
    const presiones = (caso ? caso.presiones : []).filter(p => delDia(p.ts)).sort((a, b) => a.ts - b.ts);

    // Medicamentos y alertas salen de los datos que trajo Supabase
    const marcados = {};
    (datosBD.tomas || []).filter(t => t.fecha === fecha).forEach(t => {
      marcados[t.medicamento_id] = {
        tomada: t.tomada,
        hora: t.tomada && t.ts ? new Date(t.ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : null
      };
    });
    const esDamian = document.documentElement.classList.contains('dm-caso-damian');
    const meds = esDamian ? (window.MEDICAMENTOS_DIARIOS || []) : [];
    const medsTomados = meds.filter(m => marcados[m.id] && marcados[m.id].tomada);

    const alertas = (datosBD.alertas || []).filter(a => delDia(a.ts));

    return { fecha, paciente: caso ? caso.paciente : {}, metas: caso ? caso.metas : {}, glucosas, presiones, meds, medsTomados, marcados, alertas, caso };
  }

  window.renderReporteDiario = function () {
    const detalle = document.getElementById('reporteDetalle');
    if (!detalle) return;
    const d = datosDelDia();
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

    if (d.glucosas.length) {
      const prom = Math.round(d.glucosas.reduce((acc, g) => acc + Number(g.valor), 0) / d.glucosas.length);
      const enMeta = d.glucosas.filter(g => g.valor >= d.metas.glucosaMin && g.valor <= d.metas.glucosaMaxPost).length;
      set('repKpiGlucosaProm', prom + ' mg/dL');
      set('repKpiTiempoRango', `${enMeta} de ${d.glucosas.length} en meta`);
    } else {
      set('repKpiGlucosaProm', '—');
      set('repKpiTiempoRango', 'Sin lecturas');
    }
    const ultPA = d.presiones[d.presiones.length - 1];
    set('repKpiPresionUlt', ultPA ? `${ultPA.sistolica}/${ultPA.diastolica} mmHg` : '—');
    set('repKpiPresionMeta', `Meta < ${d.metas.sistolicaMax}/${d.metas.diastolicaMax} mmHg`);
    set('repKpiMeds', d.meds.length ? `${d.medsTomados.length} / ${d.meds.length}` : '—');
    set('repKpiAlertas', String(d.alertas.length));

    const lista = (items) => items.length ? '<ul style="margin:4px 0 12px; padding-left:18px;">' + items.join('') + '</ul>' : '<p style="margin:4px 0 12px; color:var(--dc-text-muted);">Sin registros.</p>';
    detalle.innerHTML =
      '<strong>Glucosa</strong>' + lista(d.glucosas.map(g => `<li>${hora(g.ts)} · ${g.valor} mg/dL (${g.ContextoLabel || g.contexto}) — ${d.caso.evaluarGlucosa(g.valor, g.contexto).etiqueta}</li>`)) +
      '<strong>Presión arterial</strong>' + lista(d.presiones.map(p => `<li>${hora(p.ts)} · ${p.sistolica}/${p.diastolica} mmHg, pulso ${p.pulso} — ${d.caso.evaluarPresion(p.sistolica, p.diastolica).etiqueta}</li>`)) +
      '<strong>Medicamentos</strong>' + lista(d.meds.map(m => `<li>${m.horario} · ${m.nombre}: ${d.marcados[m.id] && d.marcados[m.id].tomada ? 'tomado' + (d.marcados[m.id].hora ? ' a las ' + d.marcados[m.id].hora : '') : 'no marcado'}</li>`)) +
      '<strong>Alertas</strong>' + lista(d.alertas.map(a => `<li>${hora(a.ts)} · ${a.titulo}</li>`));
  };

  window.descargarReporteDiarioPDF = function () {
    const jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) {
      alert('No se pudo cargar el generador de PDF. Revisa la conexión a internet.');
      return;
    }
    const d = datosDelDia();
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    let y = 18;
    // Escribe una linea y salta de pagina si ya no cabe
    const linea = (texto, tam = 10, negrita = false) => {
      doc.setFont('helvetica', negrita ? 'bold' : 'normal');
      doc.setFontSize(tam);
      doc.splitTextToSize(texto, 180).forEach(t => {
        if (y > 280) { doc.addPage(); y = 18; }
        doc.text(t, 15, y);
        y += tam * 0.5;
      });
      y += 1.5;
    };

    linea('DiaMon - Reporte del día ' + d.fecha, 15, true);
    linea(`Paciente: ${d.paciente.nombre || '-'} (${codigoPaciente()})`);
    linea(`Diagnóstico: ${d.paciente.diagnosticoPrincipal || '-'}`);
    linea(`Metas (${d.paciente.profesionalGuia || '-'}): glucosa en ayunas ${d.metas.glucosaMin}-${d.metas.glucosaMetaAyunas} mg/dL, después de comer < ${d.metas.glucosaMaxPost} mg/dL, presión < ${d.metas.sistolicaMax}/${d.metas.diastolicaMax} mmHg`);
    y += 3;

    linea('Glucosa', 12, true);
    if (!d.glucosas.length) linea('Sin lecturas.');
    d.glucosas.forEach(g => linea(`${hora(g.ts)}  ${g.valor} mg/dL  (${g.ContextoLabel || g.contexto})  ${d.caso.evaluarGlucosa(g.valor, g.contexto).etiqueta}`));

    linea('Presión arterial', 12, true);
    if (!d.presiones.length) linea('Sin lecturas.');
    d.presiones.forEach(p => linea(`${hora(p.ts)}  ${p.sistolica}/${p.diastolica} mmHg  pulso ${p.pulso}  ${d.caso.evaluarPresion(p.sistolica, p.diastolica).etiqueta}`));

    linea('Medicamentos', 12, true);
    if (!d.meds.length) linea('Sin esquema de medicamentos cargado.');
    d.meds.forEach(m => linea(`${m.horario}  ${m.nombre}: ${d.marcados[m.id] && d.marcados[m.id].tomada ? 'tomado' : 'no marcado'}`));

    linea('Alertas', 12, true);
    if (!d.alertas.length) linea('Sin alertas.');
    d.alertas.forEach(a => linea(`${hora(a.ts)}  ${a.titulo}`));

    y += 4;
    linea('Generado por DiaMon el ' + new Date().toLocaleString('es-CO') + '. Este reporte no reemplaza la valoración del profesional de salud.', 8);
    doc.save(`reporte-diamon-${codigoPaciente()}-${d.fecha}.pdf`);
  };

  document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('reporteFecha');
    if (input) {
      input.value = fechaISO(new Date());
      input.max = input.value;
      input.addEventListener('change', window.renderReporteDiario);
    }
    window.renderReporteDiario();
  });
})();
