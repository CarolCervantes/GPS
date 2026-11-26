// Capa de datos: todo lo del paciente se lee y se guarda en Supabase.
// Asi la web y la app ven siempre lo mismo, y cuando alguien cambia algo
// los demas equipos se enteran solos (Supabase Realtime).
(function () {
  'use strict';

  const sb = () => window.supabaseClient;

  // Id (uuid) del paciente que se esta mirando: el mismo paciente, o el que tiene vinculado el cuidador
  function pacienteId() {
    const ses = window.DiaMonSesion;
    const pac = ses ? ses.pacienteActivo(ses.leerUsuario()) : null;
    return pac && pac.id && /^[0-9a-f-]{36}$/i.test(pac.id) ? pac.id : null;
  }

  // Fecha AAAA-MM-DD en hora local
  function hoyISO(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const ETIQUETAS_CONTEXTO = {
    ayunas: 'En ayunas',
    preprandial: 'Antes de comida',
    postprandial_2h: '2h después de comer',
    nocturna: 'Antes de la insulina (noche)',
    rescate: 'Control por síntoma / mareo'
  };

  // ---------- Conversion entre las columnas de la base y lo que usa la pagina ----------
  const aGlucosa = (r) => ({
    id: r.id, valor: r.valor, contexto: r.contexto || 'ayunas',
    ContextoLabel: ETIQUETAS_CONTEXTO[r.contexto] || 'Control capilar',
    notas: r.notas || '', ts: new Date(r.ts).getTime()
  });
  const aPresion = (r) => ({
    id: r.id, sistolica: r.sistolica, diastolica: r.diastolica, pulso: r.pulso_bpm,
    brazo: r.brazo || 'izquierdo', postura: r.postura || 'sentado', notas: r.sintomas || '', ts: new Date(r.ts).getTime()
  });
  const aMetas = (r) => r && ({
    glucosaMin: r.glucosa_min, glucosaMetaAyunas: r.glucosa_meta_ayunas, glucosaMaxPost: r.glucosa_max_post,
    sistolicaMin: r.sistolica_min, sistolicaMax: r.sistolica_max, diastolicaMin: r.diastolica_min, diastolicaMax: r.diastolica_max,
    profesional: r.profesional_nombre
  });
  // La tabla solo acepta ciertos tipos y estados; el tipo y el aspecto originales van en "datos"
  const TIPOS_BD = ['zona_segura', 'geocerca', 'gps_perdido', 'glucosa_alta', 'glucosa_baja', 'presion_alta', 'presion_baja',
    'medicacion_pendiente', 'medicamento', 'medicamento_tomado', 'ubicacion', 'emergencia_manual', 'sistema'];
  const TIPO_EQUIVALENTE = { sos: 'emergencia_manual', presion: 'presion_alta', recordatorio: 'sistema' };
  const aAlerta = (r) => {
    const d = r.datos || {};
    const { tiempoTexto, rango, ...d2 } = d;  // alertas viejas traian estos textos fijos
    const base = { ...d2, id: r.id, titulo: r.titulo || r.descripcion, subtitulo: r.descripcion,
      tipo: d.tipoOriginal || r.tipo, estado: r.estado === 'activa' ? (d.estadoOriginal || 'pendiente') : 'confirmada',
      ts: new Date(r.ts).getTime() };
    if (r.estado !== 'activa') {
      Object.assign(base, { badgeTexto: 'Confirmada', badgeClase: 'badge-confirmada', color: 'green', icono: 'fas fa-check' });
    }
    return base;
  };

  // ---------- Lectura ----------
  async function cargarTodo() {
    const id = pacienteId();
    if (!id || !sb()) return null;
    const hace60 = new Date(Date.now() - 60 * 86400000).toISOString();

    const [perfil, metas, glu, pa, zonas, alertas, tomas, gps, disp] = await Promise.all([
      sb().from('profiles').select('id, nombre, codigo_paciente, diagnostico, barrio, profesional_guia, ficha, ficha_token').eq('id', id).maybeSingle(),
      sb().from('metas_paciente').select('*').eq('user_id', id).maybeSingle(),
      sb().from('glucosa_lecturas').select('*').eq('user_id', id).gte('ts', hace60).order('ts', { ascending: false }).limit(300),
      sb().from('presion_arterial').select('*').eq('user_id', id).gte('ts', hace60).order('ts', { ascending: false }).limit(300),
      sb().from('zonas_seguras').select('*').eq('user_id', id).order('created_at'),
      sb().from('alertas').select('*').eq('user_id', id).gte('ts', hace60).order('ts', { ascending: false }).limit(200),
      sb().from('tomas_medicamento').select('*').eq('user_id', id).gte('fecha', hoyISO(new Date(Date.now() - 60 * 86400000))),
      sb().from('gps_lecturas').select('lat, lng, ts').eq('user_id', id).order('ts', { ascending: false }).limit(1),
      sb().from('registros').select('notas, ts').eq('user_id', id).eq('tipo', 'dispositivo').order('ts', { ascending: false }).limit(1)
    ]);

    return {
      perfil: perfil.data,
      metas: aMetas(metas.data),
      glucosas: (glu.data || []).map(aGlucosa),
      presiones: (pa.data || []).map(aPresion),
      zonas: zonas.data || [],
      alertas: (alertas.data || []).map(aAlerta),
      tomas: tomas.data || [],
      dispositivo: disp.data && disp.data[0] ? { ...JSON.parse(disp.data[0].notas || '{}'), ts: new Date(disp.data[0].ts).getTime() } : null,
      ultimoGPS: gps.data && gps.data[0] ? { lat: gps.data[0].lat, lng: gps.data[0].lng, ts: new Date(gps.data[0].ts).getTime() } : null
    };
  }

  // ---------- Escritura (siempre con el id del paciente, la escriba el paciente o su cuidador) ----------
  async function guardarGlucosa({ valor, contexto, notas, ts }) {
    const { data, error } = await sb().from('glucosa_lecturas').insert({
      user_id: pacienteId(), valor, contexto, notas, fuente: 'meter', ts: new Date(ts || Date.now()).toISOString()
    }).select().single();
    if (error) throw error;
    return aGlucosa(data);
  }

  async function guardarPresion({ sistolica, diastolica, pulso, brazo, postura, notas, ts }) {
    const { data, error } = await sb().from('presion_arterial').insert({
      user_id: pacienteId(), sistolica, diastolica, pulso_bpm: pulso, brazo, postura, sintomas: notas,
      ts: new Date(ts || Date.now()).toISOString()
    }).select().single();
    if (error) throw error;
    return aPresion(data);
  }

  async function guardarMetas(m, profesional) {
    const { error } = await sb().from('metas_paciente').upsert({
      user_id: pacienteId(),
      glucosa_min: m.glucosaMin, glucosa_meta_ayunas: m.glucosaMetaAyunas, glucosa_max_post: m.glucosaMaxPost,
      sistolica_min: m.sistolicaMin, sistolica_max: m.sistolicaMax, diastolica_min: m.diastolicaMin, diastolica_max: m.diastolicaMax,
      profesional_nombre: profesional, updated_at: new Date().toISOString()
    });
    if (error) throw error;
  }

  async function guardarPerfilPaciente(cambios) {
    const { error } = await sb().from('profiles').update(cambios).eq('id', pacienteId());
    if (error) throw error;
  }

  async function guardarZona(zona) {
    const fila = {
      user_id: pacienteId(), nombre: zona.nombre, tipo_zona: 'circular',
      centro_lat: zona.centro_lat, centro_lng: zona.centro_lng, radio_metros: zona.radio_metros,
      nivel_riesgo: zona.nivel_riesgo || 'bajo', activa: zona.activa !== false
    };
    const q = zona.id ? sb().from('zonas_seguras').update(fila).eq('id', zona.id) : sb().from('zonas_seguras').insert(fila);
    const { error } = await q;
    if (error) throw error;
  }

  async function eliminarZona(id) {
    const { error } = await sb().from('zonas_seguras').delete().eq('id', id);
    if (error) throw error;
  }

  async function guardarAlerta(a) {
    // tiempoTexto y rango no se guardan: se calculan con la hora real al mostrar la alerta
    const { titulo, subtitulo, tipo, estado, id, ts, tiempoTexto, rango, ...resto } = a;
    let tipoBD = TIPOS_BD.includes(tipo) ? tipo : (TIPO_EQUIVALENTE[tipo] || 'sistema');
    if (tipo === 'presion' && /hipotensi/i.test(titulo || '')) tipoBD = 'presion_baja';
    const { data, error } = await sb().from('alertas').insert({
      user_id: pacienteId(), titulo, descripcion: subtitulo || titulo, tipo: tipoBD, estado: 'activa',
      datos: { ...resto, tipoOriginal: tipo, estadoOriginal: estado || 'pendiente' }, ts: new Date().toISOString()
    }).select().single();
    if (error) throw error;
    return aAlerta(data);
  }

  // Atender una alerta la deja como "resuelta" en la base
  async function cambiarEstadoAlerta(id) {
    const { error } = await sb().from('alertas').update({ estado: 'resuelta' }).eq('id', id);
    if (error) throw error;
  }

  // Marca o desmarca un medicamento de un dia (una fila por medicamento y fecha)
  async function guardarToma({ medicamentoId, nombre, horario, fecha, tomada, quien, dosis }) {
    const id = pacienteId();
    const { data: existente } = await sb().from('tomas_medicamento').select('id')
      .eq('user_id', id).eq('medicamento_id', medicamentoId).eq('fecha', fecha).maybeSingle();
    // La columna dosis es obligatoria en la tabla; si no llega se usa la pauta de la enfermera
    const fila = { user_id: id, medicamento_id: medicamentoId, medicamento_nombre: nombre, horario_programado: horario,
      dosis: dosis || 'Según la pauta de la enfermera',
      fecha, tomada, confirmado_por: quien, ts: new Date().toISOString() };
    const { error } = existente
      ? await sb().from('tomas_medicamento').update(fila).eq('id', existente.id)
      : await sb().from('tomas_medicamento').insert(fila);
    if (error) throw error;
  }

  // Registros generales (por ejemplo el estado de animo del dia)
  async function guardarRegistro(tipo, valor, notas) {
    const { error } = await sb().from('registros').insert({ user_id: pacienteId(), tipo, valor: String(valor), notas });
    if (error) throw error;
  }

  async function leerRegistrosDelDia(tipo, fecha = hoyISO()) {
    const desde = new Date(fecha + 'T00:00:00').toISOString();
    const hasta = new Date(fecha + 'T23:59:59').toISOString();
    const { data } = await sb().from('registros').select('*').eq('user_id', pacienteId()).eq('tipo', tipo)
      .gte('ts', desde).lte('ts', hasta).order('ts', { ascending: false });
    return data || [];
  }

  // La ubicacion se guarda como maximo cada 30 s para no llenar la base
  let ultimoGPSGuardado = 0;
  async function guardarGPS(lat, lng) {
    if (Date.now() - ultimoGPSGuardado < 30000) return;
    ultimoGPSGuardado = Date.now();
    await sb().from('gps_lecturas').insert({ user_id: pacienteId(), lat, lng, ts: new Date().toISOString() });
  }

  // ---------- Tiempo real ----------
  // Llama a alCambiar(tabla, fila) cada vez que otro equipo cambia algo del paciente
  function escucharCambios(alCambiar) {
    const id = pacienteId();
    if (!id || !sb()) return;
    const canal = sb().channel('datos-' + id);
    ['glucosa_lecturas', 'presion_arterial', 'alertas', 'zonas_seguras', 'tomas_medicamento', 'metas_paciente', 'gps_lecturas', 'registros']
      .forEach(tabla => canal.on('postgres_changes', { event: '*', schema: 'public', table: tabla, filter: 'user_id=eq.' + id },
        (p) => alCambiar(tabla, p.new, p.eventType)));
    canal.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: 'id=eq.' + id },
      (p) => alCambiar('profiles', p.new, 'UPDATE'));
    canal.subscribe();
  }

  window.DiaMonDatos = {
    pacienteId, hoyISO, cargarTodo, guardarGlucosa, guardarPresion, guardarMetas, guardarPerfilPaciente,
    guardarZona, eliminarZona, guardarAlerta, cambiarEstadoAlerta, guardarToma, guardarRegistro,
    leerRegistrosDelDia, guardarGPS, escucharCambios, aAlerta, aGlucosa, aPresion
  };
})();
