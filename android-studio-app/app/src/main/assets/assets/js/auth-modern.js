// Controlador de login y registro para los 3 roles: Paciente, Cuidador y Admin
(function () {
  'use strict';

  const CODIGO_ADMIN_SISTEMA = 'DIAMON-ADMIN-2026';

  // Paciente principal del caso de estudio (mi abuelo)
  const PACIENTE_CASO_ESTUDIO = {
    id: 'pac-damian-diaz-01',
    nombre: 'Damián Díaz Balseiro',
    email: 'damian.diaz@diamon.co',
    rol: 'usuario',
    codigoPaciente: 'DM-8492',
    glucosa: 114,
    estadoGlucosa: 'En meta clínica (Fuente: Glucómetro Manual)',
    ubicacion: 'Barrio Chapacuá (Lat: 10.39991, Lng: -75.47886)',
    bateria: 87,
    pasos: 1240
  };

  // Cargar o inicializar la lista de pacientes registrados
  function obtenerBasePacientes() {
    let db = { 'DM-8492': PACIENTE_CASO_ESTUDIO };
    try {
      const raw = localStorage.getItem('diamon_pacientes_db');
      if (raw) {
        const parsed = JSON.parse(raw);
        db = Object.assign(db, parsed);
      }
    } catch (_) {}
    return db;
  }

  // Guardar un nuevo paciente con su codigo DM-XXXX para que un cuidador lo pueda vincular
  function guardarPacienteEnBase(pacienteObj) {
    if (!pacienteObj || !pacienteObj.codigoPaciente) return;
    const db = obtenerBasePacientes();
    db[pacienteObj.codigoPaciente] = pacienteObj;
    try {
      localStorage.setItem('diamon_pacientes_db', JSON.stringify(db));
    } catch (_) {}
    renderizarChipsPacientes();
  }

  // Generar un codigo unico de 4 digitos para pacientes nuevos
  function generarCodigoPacienteUnico() {
    const db = obtenerBasePacientes();
    let code = 'DM-' + Math.floor(1000 + Math.random() * 9000);
    while (db[code]) {
      code = 'DM-' + Math.floor(1000 + Math.random() * 9000);
    }
    return code;
  }

  // Buscar si el paciente ya se registro antes por su correo
  function buscarPacientePorEmail(email) {
    if (!email) return null;
    const db = obtenerBasePacientes();
    const lista = Object.values(db);
    return lista.find(p => (p.email || '').toLowerCase() === email.toLowerCase()) || null;
  }

  function formatearNombreLimpio(rawStr) {
    if (!rawStr) return 'Usuario DiaMon';
    let str = String(rawStr).trim();
    if (str.includes('@')) str = str.split('@')[0];
    let clean = str.replace(/\d+$/g, '').replace(/[._-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
    const palabras = clean.split(' ').map(p => p.trim()).filter(Boolean);
    if (palabras.length === 0) return 'Usuario';
    return palabras.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  function conTimeout(promesa, ms = 3500) {
    return Promise.race([
      promesa,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ]);
  }

  let currentTab = 'login';
  let currentRole = 'usuario';

  window.DiaMonAuthHelpers = {
    CODIGO_ADMIN_SISTEMA,
    PACIENTE_CASO_ESTUDIO,
    obtenerBasePacientes,
    guardarPacienteEnBase,
    generarCodigoPacienteUnico,
    buscarPacientePorEmail,
    formatearNombreLimpio,
    getCurrentRole: () => currentRole
  };

  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initRoleSwitch();
    initFormSubmit();
    initGlobalHelpers();
    renderizarChipsPacientes();
  });

  // Mostrar botones rapidos con los codigos de pacientes disponibles o el codigo admin
  function renderizarChipsPacientes() {
    const rows = [
      document.getElementById('loginDemoCodesRow'),
      document.getElementById('regDemoCodesRow')
    ];

    if (currentRole === 'admin') {
      rows.forEach(row => {
        if (!row) return;
        row.innerHTML = `
          <span class="dm-demo-label">Código Admin:</span>
          <button type="button" class="dm-code-chip" onclick="window.cargarCodigoDemo('${CODIGO_ADMIN_SISTEMA}')">${CODIGO_ADMIN_SISTEMA}</button>
        `;
      });
      return;
    }

    const db = obtenerBasePacientes();
    const codigos = Object.keys(db);
    rows.forEach(row => {
      if (!row) return;
      const chipsHtml = codigos.map(cod => {
        const p = db[cod];
        return `<button type="button" class="dm-code-chip" onclick="window.cargarCodigoDemo('${cod}')">${cod} (${p.nombre})</button>`;
      }).join(' ');
      row.innerHTML = `<span class="dm-demo-label">Pacientes registrados:</span> ${chipsHtml}`;
    });
  }

  function initTabs() {
    const tabBtns = document.querySelectorAll('.dm-tab-pill-btn');
    const formLogin = document.getElementById('dmFormLogin');
    const formRegister = document.getElementById('dmFormRegister');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        currentTab = btn.dataset.tab;

        if (currentTab === 'login') {
          formLogin.style.display = 'flex';
          formRegister.style.display = 'none';
        } else {
          formLogin.style.display = 'none';
          formRegister.style.display = 'flex';
        }
        limpiarStatus();
      });
    });
  }

  function initRoleSwitch() {
    const roleBtns = document.querySelectorAll('.dm-role-choice-btn');
    const loginAdminTray = document.getElementById('loginAdminCodeTray');
    const regAdminTray = document.getElementById('regAdminCodeTray');
    const loginInput = document.getElementById('loginPatientCode');
    const regInput = document.getElementById('regPatientCode');

    roleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        roleBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
        currentRole = btn.dataset.role;

        if (currentRole === 'cuidador') {
          if (loginAdminTray) loginAdminTray.classList.add('show');
          if (regAdminTray) regAdminTray.classList.add('show');
          if (loginInput) {
            loginInput.placeholder = 'Código Único del Paciente (Ej: DM-8492)';
            loginInput.value = '';
          }
          if (regInput) {
            regInput.placeholder = 'Código Único del Paciente a supervisar';
            regInput.value = '';
          }
          renderizarChipsPacientes();
        } else if (currentRole === 'admin') {
          if (loginAdminTray) loginAdminTray.classList.add('show');
          if (regAdminTray) regAdminTray.classList.add('show');
          if (loginInput) {
            loginInput.placeholder = 'Código de Administrador (DIAMON-ADMIN-2026)';
            loginInput.value = '';
          }
          if (regInput) {
            regInput.placeholder = 'Código de Administrador (DIAMON-ADMIN-2026)';
            regInput.value = '';
          }
          renderizarChipsPacientes();
        } else {
          if (loginAdminTray) loginAdminTray.classList.remove('show');
          if (regAdminTray) regAdminTray.classList.remove('show');
        }
        limpiarStatus();
      });
    });
  }

  function initFormSubmit() {
    const formLogin = document.getElementById('dmFormLogin');
    const formRegister = document.getElementById('dmFormRegister');
    const loginSubmitBtn = document.getElementById('dmLoginSubmitBtn');
    const regSubmitBtn = document.getElementById('dmRegSubmitBtn');

    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        limpiarStatus();

        try {
          const email = (document.getElementById('loginEmail')?.value || '').trim().toLowerCase();
          const password = (document.getElementById('loginPassword')?.value || '').trim();
          const codeInput = (document.getElementById('loginPatientCode')?.value || '').trim().toUpperCase();

          if (!email || !password) {
            mostrarStatus('Por favor ingresa tu correo electrónico y tu contraseña.', 'error');
            return;
          }

          if (currentRole === 'admin') {
            if (codeInput !== CODIGO_ADMIN_SISTEMA) {
              mostrarStatus(`Para ingresar como Administrador debes colocar el código ${CODIGO_ADMIN_SISTEMA}.`, 'error');
              return;
            }
          }

          const dbPacientes = obtenerBasePacientes();
          let pacienteSeleccionado = PACIENTE_CASO_ESTUDIO;

          if (currentRole === 'cuidador') {
            const codTarget = codeInput || 'DM-8492';
            if (!dbPacientes[codTarget]) {
              mostrarStatus(`El código "${codTarget}" no existe. Usa DM-8492 o el código del paciente registrado.`, 'error');
              return;
            }
            pacienteSeleccionado = dbPacientes[codTarget];
          } else if (currentRole === 'usuario') {
            const pacEncontrado = buscarPacientePorEmail(email);
            if (pacEncontrado) {
              pacienteSeleccionado = pacEncontrado;
            } else if (email.includes('damian')) {
              pacienteSeleccionado = PACIENTE_CASO_ESTUDIO;
            } else {
              const nuevoCod = generarCodigoPacienteUnico();
              pacienteSeleccionado = {
                id: 'pac-' + Date.now(),
                nombre: formatearNombreLimpio(email),
                email: email,
                rol: 'usuario',
                codigoPaciente: nuevoCod,
                glucosa: 110,
                estadoGlucosa: 'En meta clínica',
                ubicacion: 'Barrio Chapacuá (Lat: 10.39991, Lng: -75.47886)',
                bateria: 95,
                pasos: 1200
              };
              guardarPacienteEnBase(pacienteSeleccionado);
            }
          }

          activarBotonCarga(loginSubmitBtn, 'Autenticando...');

          // Intentar login con Supabase Auth solo si hay red y cliente real (máx 2.2s para nunca congelar)
          const puedeSupabase = navigator.onLine !== false &&
            window.supabaseClient &&
            !window.supabaseClient.__isOfflineStub &&
            window.supabaseClient.auth;

          if (puedeSupabase) {
            try {
              const { data, error } = await conTimeout(
                window.supabaseClient.auth.signInWithPassword({ email, password }),
                2200
              );
              if (!error && data && data.user) {
                let profile = null;
                try {
                  const respProf = await conTimeout(
                    window.supabaseClient
                      .from('profiles')
                      .select('nombre, rol')
                      .eq('id', data.user.id)
                      .single(),
                    1800
                  );
                  profile = respProf?.data || null;
                } catch (_) {}

                const nombreFinal = profile?.nombre || data.user.user_metadata?.nombre || (currentRole === 'usuario' ? pacienteSeleccionado.nombre : formatearNombreLimpio(email));
                if (currentRole === 'usuario') {
                  pacienteSeleccionado.nombre = nombreFinal;
                  guardarPacienteEnBase(pacienteSeleccionado);
                }

                const sessionObj = {
                  id: data.user.id,
                  nombre: nombreFinal,
                  email: data.user.email,
                  rol: currentRole,
                  codigoPaciente: pacienteSeleccionado.codigoPaciente,
                  pacienteVinculado: pacienteSeleccionado,
                  autenticadoSupabase: true
                };

                try {
                  sessionStorage.setItem('diamon_demo_user', JSON.stringify(sessionObj));
                  localStorage.setItem('diamon_current_user', JSON.stringify(sessionObj));
                } catch (_) {}
                mostrarStatus(`¡Sesión verificada! Bienvenido(a), ${sessionObj.nombre}.`, 'success');
                setTimeout(() => { window.location.href = 'index.html'; }, 250);
                return;
              }
            } catch (_) {}
          }

          // Respaldo local inmediato (nunca bloquea al usuario)
          const sessionFallback = {
            id: (currentRole === 'admin' ? 'adm-' : (currentRole === 'cuidador' ? 'cuid-' : 'pac-')) + Date.now(),
            nombre: currentRole === 'usuario' ? pacienteSeleccionado.nombre : formatearNombreLimpio(email),
            email: email,
            rol: currentRole,
            codigoPaciente: pacienteSeleccionado.codigoPaciente,
            pacienteVinculado: pacienteSeleccionado
          };
          try {
            sessionStorage.setItem('diamon_demo_user', JSON.stringify(sessionFallback));
            localStorage.setItem('diamon_current_user', JSON.stringify(sessionFallback));
          } catch (_) {}
          mostrarStatus(`¡Bienvenido(a), ${sessionFallback.nombre}! Ingresando al sistema...`, 'success');
          setTimeout(() => { window.location.href = 'index.html'; }, 250);
        } catch (err) {
          desactivarBotonCarga(loginSubmitBtn, 'Entrar al Sistema');
          mostrarStatus('No se pudo completar el inicio de sesión: ' + (err?.message || 'intenta de nuevo.'), 'error');
        }
      });
    }

    if (formRegister) {
      formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        limpiarStatus();

        try {
          const rawNombre = (document.getElementById('regNombre')?.value || '').trim();
          const email = (document.getElementById('regEmail')?.value || '').trim().toLowerCase();
          const password = document.getElementById('regPassword')?.value || '';
          const codeInput = (document.getElementById('regPatientCode')?.value || '').trim().toUpperCase();

          if (!rawNombre || !email || !password) {
            mostrarStatus('Por favor completa todos los campos del registro.', 'error');
            return;
          }

          if (password.length < 6) {
            mostrarStatus('La contraseña debe tener al menos 6 caracteres.', 'error');
            return;
          }

          if (currentRole === 'admin' && codeInput !== CODIGO_ADMIN_SISTEMA) {
            mostrarStatus(`Para registrarte como Administrador debes ingresar el código ${CODIGO_ADMIN_SISTEMA}.`, 'error');
            return;
          }

          const nombreLimpio = formatearNombreLimpio(rawNombre);
          const dbPacientes = obtenerBasePacientes();
          let pacienteAsignado = PACIENTE_CASO_ESTUDIO;

          if (currentRole === 'usuario') {
            const nuevoCodigo = generarCodigoPacienteUnico();
            pacienteAsignado = {
              id: 'pac-' + Date.now(),
              nombre: nombreLimpio,
              email: email,
              rol: 'usuario',
              codigoPaciente: nuevoCodigo,
              glucosa: 108,
              estadoGlucosa: 'En meta clínica',
              ubicacion: 'Ubicación GPS Activa (Lat: 10.39991, Lng: -75.47886)',
              bateria: 98,
              pasos: 950
            };
            guardarPacienteEnBase(pacienteAsignado);
          } else if (currentRole === 'cuidador') {
            const codTarget = codeInput || 'DM-8492';
            if (!dbPacientes[codTarget]) {
              mostrarStatus(`El código de paciente "${codTarget}" no existe. Regístralo primero o usa DM-8492.`, 'error');
              return;
            }
            pacienteAsignado = dbPacientes[codTarget];
          }

          const rolSupabase = currentRole === 'cuidador' ? 'cuidador' : (currentRole === 'usuario' ? 'monitoreado' : 'admin');

          activarBotonCarga(regSubmitBtn, 'Creando cuenta...');

          const puedeSupabase = navigator.onLine !== false &&
            window.supabaseClient &&
            !window.supabaseClient.__isOfflineStub &&
            window.supabaseClient.auth;

          if (puedeSupabase) {
            try {
              const { data, error } = await conTimeout(
                window.supabaseClient.auth.signUp({
                  email,
                  password,
                  options: {
                    data: {
                      nombre: nombreLimpio,
                      rol: rolSupabase
                    }
                  }
                }),
                2200
              );

              if (!error && data && data.user) {
                const sessionObj = {
                  id: data.user.id,
                  nombre: nombreLimpio,
                  email: email,
                  rol: currentRole,
                  codigoPaciente: pacienteAsignado.codigoPaciente,
                  pacienteVinculado: pacienteAsignado,
                  autenticadoSupabase: true
                };

                try {
                  sessionStorage.setItem('diamon_demo_user', JSON.stringify(sessionObj));
                  localStorage.setItem('diamon_current_user', JSON.stringify(sessionObj));
                } catch (_) {}
                const msgExtra = currentRole === 'usuario' ? ` Tu código de paciente es ${pacienteAsignado.codigoPaciente}.` : '';
                mostrarStatus(`¡Cuenta registrada!${msgExtra} Ingresando al panel...`, 'success');
                setTimeout(() => { window.location.href = 'index.html'; }, 350);
                return;
              }
            } catch (_) {}
          }

          const sessionLocal = {
            id: (currentRole === 'admin' ? 'adm-' : (currentRole === 'cuidador' ? 'cuid-' : 'pac-')) + Date.now(),
            nombre: nombreLimpio,
            email: email,
            rol: currentRole,
            codigoPaciente: pacienteAsignado.codigoPaciente,
            pacienteVinculado: pacienteAsignado
          };
          try {
            sessionStorage.setItem('diamon_demo_user', JSON.stringify(sessionLocal));
            localStorage.setItem('diamon_current_user', JSON.stringify(sessionLocal));
          } catch (_) {}
          const msgExtra = currentRole === 'usuario' ? ` Tu código para compartir con tu cuidador es ${pacienteAsignado.codigoPaciente}.` : '';
          mostrarStatus(`¡Cuenta creada para ${nombreLimpio}!${msgExtra}`, 'success');
          setTimeout(() => { window.location.href = 'index.html'; }, 350);
        } catch (err) {
          desactivarBotonCarga(regSubmitBtn, 'Crear Cuenta en DiaMon');
          mostrarStatus('No se pudo crear la cuenta: ' + (err?.message || 'intenta de nuevo.'), 'error');
        }
      });
    }
  }

  function activarBotonCarga(btn, textoCarga) {
    if (!btn) return;
    btn.classList.add('loading');
    btn.disabled = true;
    const textSpan = btn.querySelector('.dm-btn-text');
    if (textSpan) textSpan.textContent = textoCarga || 'Ingresando...';
  }

  function desactivarBotonCarga(btn, textoOriginal) {
    if (!btn) return;
    btn.classList.remove('loading');
    btn.disabled = false;
    const textSpan = btn.querySelector('.dm-btn-text');
    if (textSpan && textoOriginal) textSpan.textContent = textoOriginal;
  }

  function initGlobalHelpers() {
    window.togglePasswordVisibility = function (fieldId, btn) {
      const input = document.getElementById(fieldId);
      if (!input) return;
      const icon = btn.querySelector('i');
      if (input.type === 'password') {
        input.type = 'text';
        if (icon) { icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); }
      } else {
        input.type = 'password';
        if (icon) { icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
      }
    };

    window.cargarCodigoDemo = function (cod) {
      const inputs = [
        document.getElementById('loginPatientCode'),
        document.getElementById('regPatientCode')
      ];
      inputs.forEach(inp => { if (inp) inp.value = cod; });
      mostrarStatus(`Código ${cod} seleccionado.`, 'success');
    };

    window.entrarComoInvitadoRapido = function (ev) {
      if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
      try {
        sessionStorage.removeItem('diamon_demo_user');
      } catch (_) {}
      window.location.href = 'index.html';
    };

    window.mostrarRecuperacion = async function () {
      const email = document.getElementById('loginEmail')?.value.trim();
      if (!email) {
        mostrarStatus('Escribe tu correo electrónico arriba para enviarte el enlace de recuperación.', 'error');
        return;
      }
      if (window.supabaseClient && !window.supabaseClient.__isOfflineStub && window.supabaseClient.auth) {
        try {
          await conTimeout(window.supabaseClient.auth.resetPasswordForEmail(email), 2200);
        } catch (_) {}
      }
      mostrarStatus(`Si ${email} está registrado, Supabase enviará el enlace de restablecimiento.`, 'success');
    };
  }

  function mostrarStatus(txt, tipo) {
    const el = document.getElementById('authStatusMsg');
    if (!el) return;
    el.textContent = txt;
    el.className = 'dm-status-msg ' + tipo;
    el.style.display = 'block';
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (_) {}
  }

  function limpiarStatus() {
    const el = document.getElementById('authStatusMsg');
    if (!el) return;
    el.className = 'dm-status-msg';
    el.textContent = '';
    el.style.display = 'none';
  }

})();
