// Controlador de inicio de sesion y registro (Paciente, Cuidador y Admin)
(function () {
  'use strict';

  const CODIGO_ADMIN_SISTEMA = 'DIAMON-ADMIN-2026';

  // Paciente principal del caso de estudio
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

  function obtenerBasePacientes() {
    let db = { 'DM-8492': PACIENTE_CASO_ESTUDIO };
    try {
      const raw = localStorage.getItem('diamon_pacientes_db');
      if (raw) {
        db = Object.assign(db, JSON.parse(raw));
      }
    } catch (_) {}
    return db;
  }

  function guardarPacienteEnBase(pacienteObj) {
    if (!pacienteObj || !pacienteObj.codigoPaciente) return;
    const db = obtenerBasePacientes();
    db[pacienteObj.codigoPaciente] = pacienteObj;
    try {
      localStorage.setItem('diamon_pacientes_db', JSON.stringify(db));
    } catch (_) {}
  }

  // Guardar la cuenta registrada para recordar su rol y sus pacientes vinculados al iniciar sesion
  function obtenerCuentasRegistradas() {
    try {
      const raw = localStorage.getItem('diamon_cuentas_db');
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {};
  }

  function guardarCuentaRegistrada(email, datosCuenta) {
    if (!email) return;
    const cuentas = obtenerCuentasRegistradas();
    cuentas[email.toLowerCase()] = datosCuenta;
    try {
      localStorage.setItem('diamon_cuentas_db', JSON.stringify(cuentas));
    } catch (_) {}
  }

  function generarCodigoPacienteUnico() {
    const db = obtenerBasePacientes();
    let code = 'DM-' + Math.floor(1000 + Math.random() * 9000);
    while (db[code]) {
      code = 'DM-' + Math.floor(1000 + Math.random() * 9000);
    }
    return code;
  }

  function buscarPacientePorEmail(email) {
    if (!email) return null;
    const db = obtenerBasePacientes();
    return Object.values(db).find(p => (p.email || '').toLowerCase() === email.toLowerCase()) || null;
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

  let currentTab = 'login';
  let currentRole = 'usuario';

  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initRoleSwitch();
    initFormSubmit();
    initGlobalHelpers();
  });

  function actualizarVisibilidadCodigoRegistro() {
    const regAdminTray = document.getElementById('regAdminCodeTray');
    const regInput = document.getElementById('regPatientCode');
    if (!regAdminTray) return;

    // El codigo solo se pide al Crear Cuenta para Cuidador o Admin (nunca en Iniciar Sesion)
    if (currentTab === 'register' && currentRole === 'cuidador') {
      regAdminTray.classList.add('show');
      if (regInput) {
        regInput.placeholder = 'Código único del paciente a supervisar';
        regInput.value = '';
      }
    } else if (currentTab === 'register' && currentRole === 'admin') {
      regAdminTray.classList.add('show');
      if (regInput) {
        regInput.placeholder = 'Código de autorización de Administrador';
        regInput.value = '';
      }
    } else {
      regAdminTray.classList.remove('show');
    }
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
        actualizarVisibilidadCodigoRegistro();
        limpiarStatus();
      });
    });
  }

  function initRoleSwitch() {
    const roleBtns = document.querySelectorAll('.dm-role-choice-btn');

    roleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        roleBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
        currentRole = btn.dataset.role;

        actualizarVisibilidadCodigoRegistro();
        limpiarStatus();
      });
    });
  }

  function initFormSubmit() {
    const formLogin = document.getElementById('dmFormLogin');
    const formRegister = document.getElementById('dmFormRegister');
    const loginSubmitBtn = document.getElementById('dmLoginSubmitBtn');
    const regSubmitBtn = document.getElementById('dmRegSubmitBtn');

    // INICIAR SESIÓN (Solo correo y contraseña, recupera lo que se registró antes)
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        limpiarStatus();

        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        const password = document.getElementById('loginPassword').value.trim();

        if (!email || !password) {
          mostrarStatus('Por favor ingresa tu correo electrónico y tu contraseña.', 'error');
          return;
        }

        const cuentas = obtenerCuentasRegistradas();
        const cuentaGuardada = cuentas[email] || null;

        // Si intenta entrar como Admin pero su cuenta no fue registrada con codigo de Admin
        if (currentRole === 'admin' && (!cuentaGuardada || cuentaGuardada.rol !== 'admin')) {
          mostrarStatus('Esta cuenta no está registrada como Administrador. Regístrate primero con tu código de autorización.', 'error');
          return;
        }

        let pacienteSeleccionado = PACIENTE_CASO_ESTUDIO;
        let listaPacientesVinculados = [PACIENTE_CASO_ESTUDIO];

        if (cuentaGuardada) {
          if (cuentaGuardada.pacienteVinculado) {
            pacienteSeleccionado = cuentaGuardada.pacienteVinculado;
          }
          if (Array.isArray(cuentaGuardada.pacientesVinculados) && cuentaGuardada.pacientesVinculados.length > 0) {
            listaPacientesVinculados = cuentaGuardada.pacientesVinculados;
          } else {
            listaPacientesVinculados = [pacienteSeleccionado];
          }
        } else if (currentRole === 'usuario') {
          const pacExistente = buscarPacientePorEmail(email);
          if (pacExistente) {
            pacienteSeleccionado = pacExistente;
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
              ubicacion: 'Ubicación GPS Activa (Lat: 10.39991, Lng: -75.47886)',
              bateria: 95,
              pasos: 1200
            };
            guardarPacienteEnBase(pacienteSeleccionado);
          }
          listaPacientesVinculados = [pacienteSeleccionado];
        }

        activarBotonCarga(loginSubmitBtn, 'Autenticando...');

        const sb = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
        if (sb && sb.auth) {
          try {
            const { data, error } = await sb.auth.signInWithPassword({ email, password });
            if (!error && data && data.user) {
              const { data: profile } = await sb
                .from('profiles')
                .select('nombre, rol')
                .eq('id', data.user.id)
                .single();

              const rolFinal = cuentaGuardada?.rol || (profile?.rol === 'monitoreado' ? 'usuario' : (profile?.rol || currentRole));
              const nombreFinal = cuentaGuardada?.nombre || profile?.nombre || data.user.user_metadata?.nombre || formatearNombreLimpio(email);

              const sessionObj = {
                id: data.user.id,
                nombre: nombreFinal,
                email: data.user.email,
                rol: rolFinal,
                codigoPaciente: pacienteSeleccionado.codigoPaciente,
                pacienteVinculado: pacienteSeleccionado,
                pacientesVinculados: listaPacientesVinculados,
                autenticadoSupabase: true
              };

              sessionStorage.setItem('diamon_demo_user', JSON.stringify(sessionObj));
              localStorage.setItem('diamon_current_user', JSON.stringify(sessionObj));
              mostrarStatus(`¡Bienvenido(a), ${sessionObj.nombre}!`, 'success');
              setTimeout(() => { window.location.href = 'index.html'; }, 500);
              return;
            }
          } catch (_) {}
        }

        // Si se registro localmente en el navegador, validamos credenciales seguras
        const passMatch = cuentaGuardada ? (
          (cuentaGuardada.passwordHash && cuentaGuardada.passwordHash === btoa(encodeURIComponent(password))) ||
          (cuentaGuardada.password && cuentaGuardada.password === password)
        ) : true;
        if (cuentaGuardada && (cuentaGuardada.passwordHash || cuentaGuardada.password) && !passMatch) {
          desactivarBotonCarga(loginSubmitBtn, 'Entrar al Sistema');
          mostrarStatus('Contraseña incorrecta. Verifica tus datos.', 'error');
          return;
        }

        const rolFinal = cuentaGuardada?.rol || currentRole;
        const nombreFinal = cuentaGuardada?.nombre || (rolFinal === 'usuario' ? pacienteSeleccionado.nombre : formatearNombreLimpio(email));

        const sessionFallback = {
          id: cuentaGuardada?.id || ((rolFinal === 'admin' ? 'adm-' : (rolFinal === 'cuidador' ? 'cuid-' : 'pac-')) + Date.now()),
          nombre: nombreFinal,
          email: email,
          rol: rolFinal,
          codigoPaciente: pacienteSeleccionado.codigoPaciente,
          pacienteVinculado: pacienteSeleccionado,
          pacientesVinculados: listaPacientesVinculados
        };
        sessionStorage.setItem('diamon_demo_user', JSON.stringify(sessionFallback));
        localStorage.setItem('diamon_current_user', JSON.stringify(sessionFallback));
        mostrarStatus(`¡Bienvenido(a), ${sessionFallback.nombre}! Ingresando...`, 'success');
        setTimeout(() => { window.location.href = 'index.html'; }, 500);
      });
    }

    // CREAR CUENTA (Aqui se valida el codigo del paciente para Cuidador o el codigo para Admin)
    if (formRegister) {
      formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        limpiarStatus();

        const rawNombre = document.getElementById('regNombre').value.trim();
        const email = document.getElementById('regEmail').value.trim().toLowerCase();
        const password = document.getElementById('regPassword').value;
        const codeInput = (document.getElementById('regPatientCode')?.value || '').trim().toUpperCase();

        if (!rawNombre || !email || !password) {
          mostrarStatus('Por favor completa todos los campos del registro.', 'error');
          return;
        }

        if (password.length < 6) {
          mostrarStatus('La contraseña debe tener al menos 6 caracteres.', 'error');
          return;
        }

        if (currentRole === 'admin') {
          if (!codeInput || codeInput !== CODIGO_ADMIN_SISTEMA) {
            mostrarStatus('Código de autorización de Administrador inválido.', 'error');
            return;
          }
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
          if (!codeInput) {
            mostrarStatus('Ingresa el código único del paciente que vas a supervisar.', 'error');
            return;
          }
          if (!dbPacientes[codeInput]) {
            mostrarStatus(`No se encontró ningún paciente registrado con el código "${codeInput}".`, 'error');
            return;
          }
          pacienteAsignado = dbPacientes[codeInput];
        }

        const rolSupabase = currentRole === 'cuidador' ? 'cuidador' : (currentRole === 'usuario' ? 'monitoreado' : 'admin');
        const cuentaLocalData = {
          id: (currentRole === 'admin' ? 'adm-' : (currentRole === 'cuidador' ? 'cuid-' : 'pac-')) + Date.now(),
          nombre: nombreLimpio,
          email: email,
          passwordHash: btoa(encodeURIComponent(password)), // Codificación de seguridad en almacenamiento local
          rol: currentRole,
          codigoPaciente: pacienteAsignado.codigoPaciente,
          pacienteVinculado: pacienteAsignado,
          pacientesVinculados: [pacienteAsignado]
        };
        guardarCuentaRegistrada(email, cuentaLocalData);

        activarBotonCarga(regSubmitBtn, 'Registrando...');

        const sb = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
        if (sb && sb.auth) {
          try {
            const { data, error } = await sb.auth.signUp({
              email,
              password,
              options: {
                data: {
                  nombre: nombreLimpio,
                  rol: rolSupabase
                }
              }
            });

            if (error) {
              console.error('[DiaMon Auth] Error en Supabase signUp:', error);
              desactivarBotonCarga(regSubmitBtn, 'Crear Cuenta en DiaMon');
              const msgLower = String(error.message || '').toLowerCase();
              if (error.status === 429 || msgLower.includes('rate limit')) {
                mostrarStatus('Límite de correos de Supabase alcanzado. Ve a Authentication -> Providers -> Email en Supabase y desactiva "Confirm email".', 'error');
              } else if (msgLower.includes('database error')) {
                mostrarStatus('Error en Supabase al crear perfil: ejecuta database/03_fixes_supabase.sql en el SQL Editor de Supabase.', 'error');
              } else {
                mostrarStatus(`No se pudo registrar en Supabase: ${error.message}`, 'error');
              }
              return;
            }

            if (data && data.user) {
              if (data.session) {
                try {
                  await sb.from('profiles').upsert({
                    id: data.user.id,
                    nombre: nombreLimpio,
                    rol: rolSupabase
                  });
                } catch (_) {}
              }

              cuentaLocalData.id = data.user.id;
              guardarCuentaRegistrada(email, cuentaLocalData);

              const sessionObj = {
                id: data.user.id,
                nombre: nombreLimpio,
                email: email,
                rol: currentRole,
                codigoPaciente: pacienteAsignado.codigoPaciente,
                pacienteVinculado: pacienteAsignado,
                pacientesVinculados: [pacienteAsignado],
                autenticadoSupabase: true
              };

              sessionStorage.setItem('diamon_demo_user', JSON.stringify(sessionObj));
              localStorage.setItem('diamon_current_user', JSON.stringify(sessionObj));
              const msgExtra = currentRole === 'usuario' ? ` Tu código único es ${pacienteAsignado.codigoPaciente}.` : '';
              if (data.session) {
                mostrarStatus(`¡Cuenta creada en Supabase!${msgExtra}`, 'success');
              } else {
                mostrarStatus(`Cuenta registrada en Supabase (auth.users y public.profiles), pendiente de confirmación de correo. Confirma tu email o desactiva "Confirm email" en Supabase Auth.${msgExtra}`, 'success');
              }
              setTimeout(() => { window.location.href = 'index.html'; }, data.session ? 700 : 1800);
              return;
            }
          } catch (err) {
            console.error('[DiaMon Auth] Excepción conectando con Supabase signUp:', err);
            desactivarBotonCarga(regSubmitBtn, 'Crear Cuenta en DiaMon');
            mostrarStatus(`Error conectando con Supabase: ${err?.message || 'Verifica tu conexión a internet'}.`, 'error');
            return;
          }
        }

        const sessionLocal = {
          id: cuentaLocalData.id,
          nombre: nombreLimpio,
          email: email,
          rol: currentRole,
          codigoPaciente: pacienteAsignado.codigoPaciente,
          pacienteVinculado: pacienteAsignado,
          pacientesVinculados: [pacienteAsignado]
        };
        sessionStorage.setItem('diamon_demo_user', JSON.stringify(sessionLocal));
        localStorage.setItem('diamon_current_user', JSON.stringify(sessionLocal));
        const msgExtra = currentRole === 'usuario' ? ` Tu código para compartir con tu cuidador es ${pacienteAsignado.codigoPaciente}.` : '';
        mostrarStatus(`¡Cuenta creada para ${nombreLimpio}!${msgExtra}`, 'success');
        setTimeout(() => { window.location.href = 'index.html'; }, 700);
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
    if (textSpan) textSpan.textContent = textoOriginal || 'Entrar al Sistema';
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

    window.mostrarRecuperacion = async function () {
      const email = document.getElementById('loginEmail')?.value.trim();
      if (!email) {
        mostrarStatus('Escribe tu correo electrónico arriba para enviarte el enlace de recuperación.', 'error');
        return;
      }
      if (window.supabaseClient && window.supabaseClient.auth) {
        await window.supabaseClient.auth.resetPasswordForEmail(email).catch(() => {});
      }
      mostrarStatus(`Si ${email} está registrado, se enviará el enlace de restablecimiento.`, 'success');
    };
  }

  function mostrarStatus(txt, tipo) {
    const el = document.getElementById('authStatusMsg');
    if (!el) return;
    el.textContent = txt;
    el.className = 'dm-status-msg ' + tipo;
    el.style.display = 'block';
  }

  function limpiarStatus() {
    const el = document.getElementById('authStatusMsg');
    if (!el) return;
    el.className = 'dm-status-msg';
    el.textContent = '';
    el.style.display = 'none';
  }

})();
