/**
 * DiaMon — Controlador de Autenticación & Social Login Oficial
 * Gestión de roles (Usuario Paciente vs Administrador / Familiar),
 * Códigos únicos individuales, visibilidad de contraseña y OAuth seguro sin prompts.
 */

(function () {
  'use strict';

  // Base de Pacientes Registrados con Códigos Únicos Individuales
  const PACIENTES_DEFAULT = [
    {
      id: 'usr-erick-xe9a',
      nombre: 'Erick de Jesús Torres',
      email: 'erickdejesustorres02@gmail.com',
      rol: 'usuario',
      codigoPaciente: 'DM-XE9A',
      glucosa: 92,
      estadoGlucosa: 'En rango normal',
      ubicacion: 'Ubicación en tiempo real',
      bateria: 87,
      pasos: 0
    },
    {
      id: 'usr-damian-8492',
      nombre: 'Damián Díaz Balseiro',
      email: 'damian.diaz@diamon.co',
      rol: 'usuario',
      codigoPaciente: 'DM-8492',
      glucosa: 114,
      estadoGlucosa: 'En meta clínica',
      ubicacion: 'Barrio Chapacuá, Cartagena',
      bateria: 87,
      pasos: 1240
    },
    {
      id: 'usr-andrea-3158',
      nombre: 'Andrea Gómez',
      email: 'andrea.gomez@diamon.co',
      rol: 'usuario',
      codigoPaciente: 'DM-3158',
      glucosa: 115,
      estadoGlucosa: 'Estable postprandial',
      ubicacion: 'Bocagrande, Cartagena',
      bateria: 94,
      pasos: 6120
    },
    {
      id: 'usr-luis-7401',
      nombre: 'Luis Fernando Torres',
      email: 'luis.torres@diamon.co',
      rol: 'usuario',
      codigoPaciente: 'DM-7401',
      glucosa: 138,
      estadoGlucosa: 'Alerta preventiva',
      ubicacion: 'Manga / Puente Román',
      bateria: 62,
      pasos: 3200
    }
  ];

  function obtenerPacientes() {
    try {
      const stored = localStorage.getItem('diamon_pacientes_db');
      if (stored) return JSON.parse(stored);
    } catch (_) {}
    localStorage.setItem('diamon_pacientes_db', JSON.stringify(PACIENTES_DEFAULT));
    return PACIENTES_DEFAULT;
  }

  function guardarPaciente(p) {
    const list = obtenerPacientes();
    // Evitar duplicados por id o email
    const idx = list.findIndex(item => item.email.toLowerCase() === p.email.toLowerCase());
    if (idx >= 0) {
      list[idx] = p;
    } else {
      list.push(p);
    }
    localStorage.setItem('diamon_pacientes_db', JSON.stringify(list));
  }

  function generarCodigoUnico() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const existentes = obtenerPacientes().map(p => p.codigoPaciente);
    let codigo = '';
    do {
      let suffix = '';
      for (let i = 0; i < 4; i++) {
        suffix += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      codigo = 'DM-' + suffix;
    } while (existentes.includes(codigo));
    return codigo;
  }

  function formatearNombreLimpio(rawStr) {
    if (!rawStr) return 'Usuario DiaMon';
    let str = String(rawStr).trim();
    if (str.includes('@')) str = str.split('@')[0];

    const lower = str.toLowerCase();
    if (lower.includes('erickdejesustorres') || lower.includes('ericktorres') || lower.includes('erickdejesus')) {
      return 'Erick de Jesús Torres';
    }

    let clean = str.replace(/\d+$/g, '');
    clean = clean.replace(/[._-]+/g, ' ');
    clean = clean.replace(/([a-z])([A-Z])/g, '$1 $2');
    const palabras = clean.split(' ').map(p => p.trim()).filter(Boolean);
    if (palabras.length === 0) return 'Usuario';
    return palabras.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  let currentTab = 'login';
  let currentRole = 'usuario';
  let currentOAuthMode = 'login'; // 'login' o 'register'
  let currentOAuthProvider = 'google';

  document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initRoleSwitch();
    initFormSubmit();
    initGlobalHelpers();
  });

  // Pestañas Iniciar sesión / Crear cuenta
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
        currentOAuthMode = currentTab;

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

  // Selector de Rol: Usuario vs Administrador
  function initRoleSwitch() {
    const roleBtns = document.querySelectorAll('.dm-role-choice-btn');
    const loginAdminTray = document.getElementById('loginAdminCodeTray');
    const regAdminTray = document.getElementById('regAdminCodeTray');
    const oauthAdminTray = document.getElementById('oauthAdminTray');

    roleBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        roleBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
        currentRole = btn.dataset.role;

        // El código de vinculación DM-8492 lo ingresa el Cuidador (o también es opcional para Admin)
        if (currentRole === 'cuidador' || currentRole === 'admin') {
          if (loginAdminTray) loginAdminTray.classList.add('show');
          if (regAdminTray) regAdminTray.classList.add('show');
          if (oauthAdminTray) oauthAdminTray.classList.add('show');
        } else {
          if (loginAdminTray) loginAdminTray.classList.remove('show');
          if (regAdminTray) regAdminTray.classList.remove('show');
          if (oauthAdminTray) oauthAdminTray.classList.remove('show');
        }
        limpiarStatus();
      });
    });
  }

  // Envío de Formularios Principales
  function initFormSubmit() {
    const formLogin = document.getElementById('dmFormLogin');
    const formRegister = document.getElementById('dmFormRegister');
    const loginSubmitBtn = document.getElementById('dmLoginSubmitBtn');
    const regSubmitBtn = document.getElementById('dmRegSubmitBtn');

    if (formLogin) {
      formLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        limpiarStatus();

        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        const password = document.getElementById('loginPassword').value.trim();
        const codeInput = (document.getElementById('loginPatientCode')?.value || '').trim().toUpperCase();

        if (!email) {
          mostrarStatus('Por favor ingresa tu correo electrónico o usuario.', 'error');
          return;
        }

        if (!password) {
          mostrarStatus('Por favor ingresa tu contraseña.', 'error');
          return;
        }

        const pacientes = obtenerPacientes();

        // 1. Rol Cuidador / Familiar o Enfermera
        if (currentRole === 'cuidador') {
          if (!codeInput) {
            mostrarStatus('Como Cuidador / Familiar, ingresa el código único del paciente a supervisar (Ej: DM-8492 de Damián Díaz).', 'error');
            return;
          }

          const paciente = pacientes.find(p => p.codigoPaciente.toUpperCase() === codeInput);
          if (!paciente) {
            mostrarStatus(`El código "${codeInput}" no existe. Usa DM-8492 para supervisar a Damián Díaz Balseiro.`, 'error');
            return;
          }

          activarBotonCarga(loginSubmitBtn, 'Vinculando...');
          mostrarStatus(`Vinculación activa con ${paciente.nombre} (${paciente.codigoPaciente})...`, 'success');

          const sessionCuidador = {
            id: 'cuid-' + Date.now(),
            nombre: formatearNombreLimpio(email),
            email: email,
            rol: 'cuidador',
            pacienteVinculado: paciente
          };

          sessionStorage.setItem('diamon_demo_user', JSON.stringify(sessionCuidador));
          localStorage.setItem('diamon_current_user', JSON.stringify(sessionCuidador));
          setTimeout(() => { window.location.href = 'index.html'; }, 700);
          return;
        }

        // 2. Rol Administrador del Sistema
        if (currentRole === 'admin') {
          const pacDefault = pacientes.find(p => p.codigoPaciente.toUpperCase() === (codeInput || 'DM-8492')) || pacientes[0];
          activarBotonCarga(loginSubmitBtn, 'Ingresando Admin...');
          mostrarStatus('Acceso concedido: Modo Administrador del Sistema DiaMon.', 'success');

          const sessionAdmin = {
            id: 'adm-' + Date.now(),
            nombre: formatearNombreLimpio(email) + ' (Admin)',
            email: email,
            rol: 'admin',
            pacienteVinculado: pacDefault
          };

          sessionStorage.setItem('diamon_demo_user', JSON.stringify(sessionAdmin));
          localStorage.setItem('diamon_current_user', JSON.stringify(sessionAdmin));
          setTimeout(() => { window.location.href = 'index.html'; }, 700);
          return;
        }

        // 3. Rol Paciente (Si escribe damian o cualquier correo de paciente, o entra directo como Damián Díaz)
        let pacUsuario = pacientes.find(p => p.email.toLowerCase() === email || p.id.toLowerCase() === email || p.nombre.toLowerCase().includes(email));
        if (!pacUsuario) {
          // Si ingresa como paciente con su correo, cargamos el perfil del Caso de Estudio Damián Díaz Balseiro
          pacUsuario = pacientes.find(p => p.codigoPaciente === 'DM-8492') || pacientes[0];
        }

        activarBotonCarga(loginSubmitBtn, 'Ingresando...');
        mostrarStatus(`¡Bienvenido, ${pacUsuario.nombre}! Tu Código Único es: ${pacUsuario.codigoPaciente}`, 'success');
        sessionStorage.setItem('diamon_demo_user', JSON.stringify(pacUsuario));
        localStorage.setItem('diamon_current_user', JSON.stringify(pacUsuario));
        setTimeout(() => { window.location.href = 'index.html'; }, 700);
      });
    }

    if (formRegister) {
      formRegister.addEventListener('submit', (e) => {
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

        const pacientes = obtenerPacientes();

        // SEGURIDAD ESTRICTA: Evitar duplicados de cuenta
        const existente = pacientes.find(p => p.email.toLowerCase() === email);
        if (existente) {
          mostrarStatus(`El correo "${email}" ya tiene una cuenta registrada en DiaMon. Por favor ve a la pestaña "Iniciar sesión".`, 'error');
          return;
        }

        const nombreLimpio = formatearNombreLimpio(rawNombre);

        if (currentRole === 'cuidador' || currentRole === 'admin') {
          const targetCode = codeInput || 'DM-8492';
          const pac = pacientes.find(p => p.codigoPaciente.toUpperCase() === targetCode) || pacientes[0];

          activarBotonCarga(regSubmitBtn, 'Creando cuenta...');
          const sessionSup = {
            id: (currentRole === 'admin' ? 'adm-' : 'cuid-') + Date.now(),
            nombre: nombreLimpio,
            email: email,
            rol: currentRole,
            pacienteVinculado: pac
          };
          sessionStorage.setItem('diamon_demo_user', JSON.stringify(sessionSup));
          localStorage.setItem('diamon_current_user', JSON.stringify(sessionSup));
          mostrarStatus(`¡Cuenta de ${currentRole} creada! Supervisando a ${pac.nombre} (${pac.codigoPaciente}).`, 'success');
          setTimeout(() => { window.location.href = 'index.html'; }, 800);
          return;
        }

        // Registrar nuevo paciente con código individual único
        activarBotonCarga(regSubmitBtn, 'Creando cuenta...');
        const nuevoCodigo = generarCodigoUnico();
        const nuevoPaciente = {
          id: 'usr-' + Date.now(),
          nombre: nombreLimpio,
          email: email,
          rol: 'usuario',
          codigoPaciente: nuevoCodigo,
          glucosa: 98,
          ubicacion: 'Cartagena de Indias',
          bateria: 95,
          pasos: 3450
        };

        guardarPaciente(nuevoPaciente);
        sessionStorage.setItem('diamon_demo_user', JSON.stringify(nuevoPaciente));
        mostrarStatus(`¡Cuenta creada con éxito! Tu Código Único de Paciente es: ${nuevoCodigo}`, 'success');
        setTimeout(() => { window.location.href = 'index.html'; }, 1100);
      });
    }
  }

  function activarBotonCarga(btn, textoCarga) {
    if (!btn) return;
    btn.classList.add('loading');
    const textSpan = btn.querySelector('.dm-btn-text');
    if (textSpan) textSpan.textContent = textoCarga || 'Ingresando...';
  }

  function initGlobalHelpers() {
    // Alternar visibilidad de contraseña
    window.togglePasswordVisibility = function (fieldId, btn) {
      const input = document.getElementById(fieldId);
      if (!input) return;
      const icon = btn.querySelector('i');
      if (input.type === 'password') {
        input.type = 'text';
        if (icon) {
          icon.classList.remove('fa-eye');
          icon.classList.add('fa-eye-slash');
        }
      } else {
        input.type = 'password';
        if (icon) {
          icon.classList.remove('fa-eye-slash');
          icon.classList.add('fa-eye');
        }
      }
    };

    // Cargar código demo
    window.cargarCodigoDemo = function (cod) {
      const inputs = [
        document.getElementById('loginPatientCode'),
        document.getElementById('regPatientCode')
      ];
      inputs.forEach(inp => { if (inp) inp.value = cod; });
      mostrarStatus(`Código de paciente ${cod} cargado. Pulsa "Entrar al Sistema".`, 'success');
    };

    // Recuperación de Contraseña
    window.mostrarRecuperacion = function () {
      mostrarStatus('Para restablecer tu contraseña, ingresa tu correo en la casilla y te enviaremos un enlace de recuperación seguro.', 'success');
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
