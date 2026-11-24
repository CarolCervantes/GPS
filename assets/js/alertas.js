// ============ ALERTAS.JS ============
// Carga alertas reales desde Supabase, muestra SOS para monitoreados,
// y suscribe en tiempo real para notificar al cuidador.

let alertasUserId = null;
let alertasRol = null;

document.addEventListener('dashboardListo', async (e) => {
  alertasUserId = e.detail?.user?.id;
  alertasRol = document.body.dataset.rol;
  if (!alertasUserId) return;

  await cargarAlertas();
  suscribirAlertas();
  configurarSOS();
});

// ============ CARGAR ALERTAS ============
async function cargarAlertas() {
  const lista = document.getElementById('alertsList');
  if (!lista) return;

  // Determinar qué user_ids mostrar según rol
  let userIds = [alertasUserId];

  if (alertasRol === 'cuidador') {
    // Ver alertas de las personas que monitorea
    const { data: vincs } = await supabaseClient
      .from('vinculaciones')
      .select('monitoreado_id')
      .eq('cuidador_id', alertasUserId)
      .eq('estado', 'activa');
    if (vincs?.length) userIds = vincs.map(v => v.monitoreado_id);
  } else if (alertasRol === 'admin') {
    // Admin ve todas las alertas
    userIds = null;
  }

  let query = supabaseClient
    .from('alertas')
    .select('id, tipo, descripcion, estado, ts, user_id')
    .order('ts', { ascending: false })
    .limit(10);

  if (userIds) query = query.in('user_id', userIds);

  const { data, error } = await query;

  if (error) {
    lista.innerHTML = `<div class="alert-empty">No se pudieron cargar las alertas.</div>`;
    return;
  }

  renderAlertas(data || []);
  actualizarBadge(data?.filter(a => a.estado === 'activa').length || 0);
}

function renderAlertas(alertas) {
  const lista = document.getElementById('alertsList');
  if (!lista) return;

  if (alertas.length === 0) {
    lista.innerHTML = '<div class="alert-empty"><i class="fas fa-check-circle"></i> Sin alertas recientes</div>';
    return;
  }

  lista.innerHTML = alertas.map(a => {
    const config = configAlerta(a.tipo);
    const tiempo = tiempoRelativo(a.ts);
    const estadoClass = a.estado === 'activa' ? 'alerta-activa' : '';
    return `
      <div class="alert ${config.clase} ${estadoClass}" data-id="${a.id}">
        <i class="${config.icono}"></i>
        <div style="flex:1;">
          <div class="alert-title">${config.titulo}</div>
          <div class="alert-desc">${escAlt(a.descripcion || '')} · ${tiempo}</div>
        </div>
        ${a.estado === 'activa' ? `
          <button class="alerta-resolver-btn" onclick="resolverAlerta(${a.id})" title="Marcar como resuelta">
            <i class="fas fa-check"></i>
          </button>` : ''}
      </div>`;
  }).join('');
}

function configAlerta(tipo) {
  return {
    emergencia_manual: { clase: 'high-alert',    icono: 'fas fa-exclamation-circle', titulo: 'Emergencia manual (SOS)' },
    zona_segura:       { clase: 'warning-alert',  icono: 'fas fa-map-marker-alt',    titulo: 'Salió de zona segura' },
    glucosa_alta:      { clase: 'warning-alert',  icono: 'fas fa-arrow-up',          titulo: 'Glucosa alta' },
    glucosa_baja:      { clase: 'high-alert',     icono: 'fas fa-arrow-down',        titulo: 'Glucosa baja' },
    gps_perdido:       { clase: 'warning-alert',  icono: 'fas fa-satellite-dish',    titulo: 'Señal GPS perdida' },
  }[tipo] || { clase: '', icono: 'fas fa-bell', titulo: tipo };
}

// ============ RESOLVER ALERTA ============
async function resolverAlerta(id) {
  const { error } = await supabaseClient
    .from('alertas')
    .update({ estado: 'resuelta' })
    .eq('id', id);

  if (!error) await cargarAlertas();
}

// ============ SUSCRIPCIÓN REALTIME ============
function suscribirAlertas() {
  supabaseClient
    .channel('alertas-realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'alertas',
    }, async (payload) => {
      // Solo recargar si es una alerta relevante para este usuario
      await cargarAlertas();
      mostrarToastAlerta(payload.new);
    })
    .subscribe();
}

function mostrarToastAlerta(alerta) {
  const config = configAlerta(alerta.tipo);
  const toast = document.createElement('div');
  toast.className = 'alerta-toast';
  toast.innerHTML = `<i class="${config.icono}"></i> <span>${config.titulo}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 50);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 4000);
}

// ============ BADGE DEL CAMPANERO ============
function actualizarBadge(count) {
  const badge = document.getElementById('bellBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 9 ? '9+' : count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// ============ BOTÓN SOS ============
function configurarSOS() {
  const wrap = document.getElementById('sosWrap');
  const btn  = document.getElementById('btnSOS');
  if (!wrap || !btn) return;

  // Solo visible para personas monitoreadas
  if (alertasRol === 'monitoreado') {
    wrap.style.display = 'block';
  }

  btn.addEventListener('click', async () => {
    if (!confirm('¿Confirmas que necesitas ayuda? Se enviará una alerta de emergencia a tu cuidador.')) return;

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando…';

    const { error } = await supabaseClient.from('alertas').insert({
      user_id:     alertasUserId,
      tipo:        'emergencia_manual',
      descripcion: 'Alerta de emergencia activada manualmente por el usuario.',
      estado:      'activa',
    });

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-exclamation-circle"></i> EMERGENCIA · SOS';

    if (error) {
      alert('Error al enviar alerta: ' + error.message);
      return;
    }

    // Feedback visual temporal
    btn.classList.add('sos-enviado');
    btn.innerHTML = '<i class="fas fa-check"></i> Alerta enviada';
    setTimeout(() => {
      btn.classList.remove('sos-enviado');
      btn.innerHTML = '<i class="fas fa-exclamation-circle"></i> EMERGENCIA · SOS';
    }, 5000);

    await cargarAlertas();
  });
}

// ============ UTILS ============
function tiempoRelativo(iso) {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'hace ' + Math.round(diff) + 's';
  if (diff < 3600) return 'hace ' + Math.round(diff / 60) + ' min';
  if (diff < 86400) return 'hace ' + Math.round(diff / 3600) + 'h';
  return 'hace ' + Math.round(diff / 86400) + 'd';
}

function escAlt(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
