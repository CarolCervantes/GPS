// Control de vencimiento de medicamentos e insulinas (28 dias despues de abrir la pluma)
// Regla clínica de 28 días para insulinas en uso a temperatura ambiente

const INVENTARIO_MEDICAMENTOS_DEFECTO = [
  {
    id: 'insulina-24ui',
    nombre: 'Insulina Basal (24 UI — 9:00 PM · Pluma en uso)',
    tipo: 'insulina_en_uso',
    fechaApertura: calcularFechaAtras(10),
    diasVidaUtil: 28,
    lote: 'L-84920'
  },
  {
    id: 'ozempic-semanal',
    nombre: 'Ozempic Semaglutida (Dosis Sábados · Pluma en uso)',
    tipo: 'insulina_en_uso',
    fechaApertura: calcularFechaAtras(6),
    diasVidaUtil: 42,
    lote: 'OZ-51204'
  },
  {
    id: 'firialta-valsartan-nifedipina',
    nombre: 'Firialta + Valsartán + Nifedipino (Blíster Mensual)',
    tipo: 'tableta',
    fechaVencimiento: '2027-09-30',
    diasVidaUtil: null,
    lote: 'CV-9921'
  },
  {
    id: 'metformina-gabapentina-lipotic',
    nombre: 'Metformina + Gabapentina + Lipotic + Atorvastatina + Pantoprazol',
    tipo: 'tableta',
    fechaVencimiento: '2027-11-15',
    diasVidaUtil: null,
    lote: 'DM-3001'
  }
];

function calcularFechaAtras(diasAtras) {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  return d.toISOString().split('T')[0];
}

class VencimientoMedicamentosManager {
  constructor() {
    // El inventario se guarda en la ficha del paciente en Supabase (ficha.inventario)
    this.ficha = {};
    this.inventario = [];
    this.init();
    window.addEventListener('diamon-datos', (e) => {
      const perfil = e.detail && e.detail.perfil;
      this.ficha = (perfil && perfil.ficha) || {};
      const esDamian = document.documentElement.classList.contains('dm-caso-damian');
      this.inventario = Array.isArray(this.ficha.inventario)
        ? this.ficha.inventario
        : (esDamian ? [...INVENTARIO_MEDICAMENTOS_DEFECTO] : []);
      this.render();
    });
  }

  async guardarInventario() {
    this.ficha = { ...this.ficha, inventario: this.inventario };
    this.render();
    try {
      await window.DiaMonDatos.guardarPerfilPaciente({ ficha: this.ficha });
    } catch (_) {
      if (window.mostrarNotificacion) window.mostrarNotificacion('No se pudo guardar el cambio. Revisa tu conexión.', 'warn');
    }
  }

  init() {
    this.render();
    window.vencimientoMedsInstance = this;
  }

  render() {
    const container = document.getElementById('vencimientoMedsWidget');
    if (!container) return;

    const itemsHTML = this.inventario.map(item => {
      if (item.tipo === 'insulina_en_uso') {
        const diasTranscurridos = this.calcularDiasDesde(item.fechaApertura);
        const diasRestantes = Math.max(0, item.diasVidaUtil - diasTranscurridos);
        const porcentaje = Math.min(100, Math.round((diasTranscurridos / item.diasVidaUtil) * 100));

        let estadoColor = '#10b981';
        let estadoClase = 'optimo';
        let estadoTexto = `${diasRestantes} días restantes`;

        if (diasRestantes <= 0) {
          estadoColor = '#ef4444';
          estadoClase = 'vencido';
          estadoTexto = '⚠️ Vencida (Más de 28 días en uso)';
        } else if (diasRestantes <= 5) {
          estadoColor = '#f59e0b';
          estadoClase = 'alerta';
          estadoTexto = `⚠️ Vence pronto (${diasRestantes} días)`;
        }

        return `
          <div class="venc-item ${estadoClase}">
            <div class="venc-item-header">
              <div>
                <div class="venc-name"><i class="fas fa-syringe"></i> ${item.nombre}</div>
                <div class="venc-sub">Abierta el ${item.fechaApertura} · Día ${diasTranscurridos} de ${item.diasVidaUtil}</div>
              </div>
              <span class="venc-badge ${estadoClase}">${estadoTexto}</span>
            </div>
            <div class="venc-progress-track">
              <div class="venc-progress-bar" style="width: ${porcentaje}%; background: ${estadoColor};"></div>
            </div>
            <div class="venc-item-footer">
              <span class="venc-hint"><i class="fas fa-info-circle"></i> Regla clínica: Las insulinas duran 28 días a temp. ambiente tras abrirse.</span>
              <button class="venc-btn-renovar" onclick="window.vencimientoMedsInstance.renovarInsulina('${item.id}')">
                Abrí nueva pluma hoy
              </button>
              <button class="venc-btn-renovar" style="background:#475569;" onclick="window.vencimientoMedsInstance.editar('${item.id}')">Editar</button>
            </div>
            ${this.formEdicion(item)}
          </div>
        `;
      } else {
        // Insumo o tableta: se revisa si ya vencio o vence en menos de 30 dias
        const diasParaVencer = Math.floor((new Date(item.fechaVencimiento + 'T00:00:00') - new Date()) / 86400000);
        const clase = diasParaVencer < 0 ? 'critico' : diasParaVencer <= 30 ? 'advertencia' : 'normal';
        const texto = diasParaVencer < 0 ? 'Vencido' : diasParaVencer <= 30 ? `Vence en ${diasParaVencer} días` : 'Vigente';
        return `
          <div class="venc-item ${clase}">
            <div class="venc-item-header">
              <div>
                <div class="venc-name"><i class="fas fa-box"></i> ${item.nombre}</div>
                <div class="venc-sub">Lote: ${item.lote || '—'} · Vence: ${item.fechaVencimiento}</div>
              </div>
              <span class="venc-badge ${clase}">${texto}</span>
            </div>
            <div class="venc-item-footer">
              <span></span>
              <button class="venc-btn-renovar" style="background:#475569;" onclick="window.vencimientoMedsInstance.editar('${item.id}')">Editar</button>
            </div>
            ${this.formEdicion(item)}
          </div>
        `;
      }
    }).join('');

    container.innerHTML = `
      <article class="card" style="margin-top: var(--space-4);">
        <div class="card-header">
          <i class="fas fa-calendar-times" style="color: #f59e0b;"></i>
          <h4>Control de Vencimiento de Medicamentos</h4>
        </div>
        <p style="font-size: 11px; color: var(--fg-3); margin: 0 0 12px 0;">
          Supervisa los 28 días de vida útil de tus plumas abiertas para asegurar que la insulina mantenga su potencia.
        </p>
        <div class="venc-list">
          ${itemsHTML}
        </div>
      </article>
    `;
  }

  calcularDiasDesde(fechaStr) {
    const fechaApertura = new Date(fechaStr);
    const hoy = new Date();
    const diffMs = hoy - fechaApertura;
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  // Formulario oculto para editar nombre, lote y fecha de un medicamento
  formEdicion(item) {
    const esInsulina = item.tipo === 'insulina_en_uso';
    const estilo = 'width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:6px; font-family:inherit;';
    return `
      <div id="venc-edit-${item.id}" style="display:none; margin-top:10px;">
        <input id="venc-nombre-${item.id}" value="${item.nombre}" placeholder="Nombre" style="${estilo}">
        <input id="venc-lote-${item.id}" value="${item.lote || ''}" placeholder="Lote" style="${estilo}">
        <label style="font-size:11px; color:#64748b;">${esInsulina ? 'Fecha en que se abrió' : 'Fecha de vencimiento'}</label>
        <input id="venc-fecha-${item.id}" type="date" value="${esInsulina ? item.fechaApertura : item.fechaVencimiento}" style="${estilo}">
        <button class="venc-btn-renovar" onclick="window.vencimientoMedsInstance.guardarEdicion('${item.id}')">Guardar</button>
      </div>`;
  }

  editar(id) {
    const form = document.getElementById('venc-edit-' + id);
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
  }

  guardarEdicion(id) {
    const item = this.inventario.find(i => i.id === id);
    if (!item) return;
    const fecha = document.getElementById('venc-fecha-' + id).value;
    item.nombre = document.getElementById('venc-nombre-' + id).value.trim() || item.nombre;
    item.lote = document.getElementById('venc-lote-' + id).value.trim();
    if (fecha) {
      if (item.tipo === 'insulina_en_uso') item.fechaApertura = fecha;
      else item.fechaVencimiento = fecha;
    }
    this.guardarInventario();
    if (window.mostrarNotificacion) window.mostrarNotificacion('Medicamento actualizado.', 'success');
  }

  renovarInsulina(id) {
    const item = this.inventario.find(i => i.id === id);
    if (!item) return;

    const hoy = new Date().toISOString().split('T')[0];
    item.fechaApertura = hoy;
    this.guardarInventario();

    if (window.mostrarNotificacion) {
      window.mostrarNotificacion(`Fecha de apertura de ${item.nombre} reiniciada a hoy. 28 días de vida útil.`, 'success');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new VencimientoMedicamentosManager();
});
