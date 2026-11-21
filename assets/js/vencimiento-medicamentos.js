// ============================================================
// DiaMon — Control de Vencimiento de Medicamentos e Insulinas
// Regla clínica de 28 días para insulinas en uso a temperatura ambiente
// ============================================================

const INVENTARIO_MEDICAMENTOS_DEFECTO = [
  {
    id: 'insulina-glargina',
    nombre: 'Insulina Glargina (Pluma en uso)',
    tipo: 'insulina_en_uso',
    fechaApertura: calcularFechaAtras(12), // Abierta hace 12 días por defecto
    diasVidaUtil: 28,
    lote: 'L-84920'
  },
  {
    id: 'insulina-lispro',
    nombre: 'Insulina Lispro Rápida (Pluma en uso)',
    tipo: 'insulina_en_uso',
    fechaApertura: calcularFechaAtras(5), // Abierta hace 5 días
    diasVidaUtil: 28,
    lote: 'L-51204'
  },
  {
    id: 'tiras-reactivas',
    nombre: 'Tiras Reactivas Accu-Chek (Caja 50 und)',
    tipo: 'insumo',
    fechaVencimiento: '2027-08-30',
    diasVidaUtil: null,
    lote: 'T-9921'
  },
  {
    id: 'metformina-850',
    nombre: 'Metformina 850 mg (Caja blister)',
    tipo: 'tableta',
    fechaVencimiento: '2027-11-15',
    diasVidaUtil: null,
    lote: 'M-3001'
  }
];

function calcularFechaAtras(diasAtras) {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  return d.toISOString().split('T')[0];
}

class VencimientoMedicamentosManager {
  constructor() {
    this.storageKey = 'diamon_vencimiento_medicamentos';
    this.inventario = this.cargarInventario();
    this.init();
  }

  cargarInventario() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [...INVENTARIO_MEDICAMENTOS_DEFECTO];
  }

  guardarInventario() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.inventario));
    } catch (_) {}
    this.render();
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
            </div>
          </div>
        `;
      } else {
        // Insumo o tableta
        return `
          <div class="venc-item normal">
            <div class="venc-item-header">
              <div>
                <div class="venc-name"><i class="fas fa-box"></i> ${item.nombre}</div>
                <div class="venc-sub">Lote: ${item.lote} · Vence: ${item.fechaVencimiento}</div>
              </div>
              <span class="venc-badge normal">Vigente</span>
            </div>
          </div>
        `;
      }
    }).join('');

    container.innerHTML = `
      <article class="card" style="margin-top: var(--space-4);">
        <div class="card-header">
          <i class="fas fa-calendar-times" style="color: #f59e0b;"></i>
          <h4>Control de Vencimiento de Insulinas</h4>
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
