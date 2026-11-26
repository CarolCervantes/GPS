// Inicio de sesion y registro con Supabase (Paciente y Cuidador).
// El rol de admin no se puede pedir al registrarse: lo asigna otro admin desde el panel.
(function () {
  'use strict';


  // Ya no se guardan cuentas en el navegador: todo el registro y el login es con Supabase.

  function formatearNombreLimpio(rawStr) {
    if (!rawStr) return 'Usuario DiaMon';
    const palabras = String(rawStr).trim().split(/\s+/).filter(Boolean);
    return palabras.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  // Traduce los errores de Supabase a mensajes claros
  function mensajeError(error) {
    const m = String((error && error.message) || '').toLowerCase();
    if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
    if (m.includes('email not confirmed')) return 'Tu correo aún no está confirmado. Abre el enlace que te enviamos a tu correo y luego inicia sesión.';
    if (m.includes('already registered') || m.includes('already been registered')) return 'Ese correo ya tiene una cuenta. Inicia sesión.';
    if (m.includes('rate limit') || (error && error.status === 429)) return 'Se enviaron muchos correos seguidos. Espera unos minutos e intenta de nuevo.';
    if (m.includes('password')) return 'La contraseña no cumple los requisitos (mínimo 6 caracteres).';
    if (m.includes('invalid') && m.includes('email')) return 'El correo no es válido.';
    return 'No se pudo completar: ' + ((error && error.message) || 'revisa tu conexión a internet.');
  }

  let currentTab = 'login';
  let currentRole = 'usuario';

  document.addEventListener('DOMContentLoaded', () => {
    // Si ya hay una sesion abierta no tiene sentido mostrar el login, se va directo al panel
    if (window.DiaMonSesion && window.DiaMonSesion.leerUsuario()) {
      window.location.replace('index.html');
      return;
    }
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
    const sb = window.supabaseClient;

    // Iniciar sesión: solo con Supabase (el rol y los pacientes salen de la base de datos)
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        limpiarStatus();

        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        const password = document.getElementById('loginPassword').value;
        if (!email || !password) {
          mostrarStatus('Por favor ingresa tu correo electrónico y tu contraseña.', 'error');
          return;
        }

        activarBotonCarga(loginSubmitBtn, 'Verificando...');
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) {
          desactivarBotonCarga(loginSubmitBtn, 'Entrar al Sistema');
          mostrarStatus(mensajeError(error), 'error');
          return;
        }

        const usuario = await window.DiaMonSesion.iniciarDesdeSupabase();
        if (!usuario) {
          desactivarBotonCarga(loginSubmitBtn, 'Entrar al Sistema');
          mostrarStatus('Entraste, pero no se encontró tu perfil en la base de datos. Avisa al administrador.', 'error');
          return;
        }
        mostrarStatus(`¡Bienvenido(a), ${usuario.nombre}!`, 'success');
        setTimeout(() => { window.location.href = 'index.html'; }, 500);
      });
    }

    // Crear cuenta: se crea en Supabase y despues hay que confirmar el correo e iniciar sesion
    if (formRegister) {
      formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        limpiarStatus();

        const nombre = formatearNombreLimpio(document.getElementById('regNombre').value);
        const email = document.getElementById('regEmail').value.trim().toLowerCase();
        const password = document.getElementById('regPassword').value;
        const codigo = (document.getElementById('regPatientCode')?.value || '').trim().toUpperCase();

        if (!nombre || !email || !password) {
          mostrarStatus('Por favor completa todos los campos del registro.', 'error');
          return;
        }
        if (password.length < 6) {
          mostrarStatus('La contraseña debe tener al menos 6 caracteres.', 'error');
          return;
        }
        if (currentRole === 'cuidador' && !/^DM-\d{4}$/.test(codigo)) {
          mostrarStatus('Escribe el código del paciente que vas a cuidar (ejemplo: DM-8492).', 'error');
          return;
        }

        activarBotonCarga(regSubmitBtn, 'Registrando...');
        const datos = { nombre, rol: currentRole === 'cuidador' ? 'cuidador' : 'monitoreado' };
        // El cuidador queda vinculado con este codigo la primera vez que inicie sesion
        if (currentRole === 'cuidador') datos.codigo_vincular = codigo;

        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { data: datos, emailRedirectTo: window.location.origin + '/pages/login.html' }
        });
        desactivarBotonCarga(regSubmitBtn, 'Crear Cuenta en DiaMon');

        if (error) {
          mostrarStatus(mensajeError(error), 'error');
          return;
        }
        // Supabase no avisa con error si el correo ya existe: devuelve un usuario sin identidades
        if (data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          mostrarStatus('Ese correo ya tiene una cuenta. Inicia sesión.', 'error');
          return;
        }

        // No se entra directo: se cierra cualquier sesion y se pasa a "Iniciar sesión"
        await sb.auth.signOut();
        window.DiaMonSesion.limpiarSesion();
        formRegister.reset();
        const tabLogin = document.querySelector('.dm-tab-pill-btn[data-tab="login"]');
        if (tabLogin) tabLogin.click();
        document.getElementById('loginEmail').value = email;
        mostrarStatus(`Cuenta creada para ${nombre}. Te enviamos un correo a ${email}: confírmalo y luego inicia sesión aquí.`, 'success');
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

    // Pide a Supabase que vuelva a mandar el correo para confirmar la cuenta
    window.reenviarConfirmacion = async function () {
      const email = document.getElementById('loginEmail')?.value.trim().toLowerCase();
      if (!email) {
        mostrarStatus('Escribe tu correo arriba para reenviarte el enlace de confirmación.', 'error');
        return;
      }
      const { error } = await window.supabaseClient.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: window.location.origin + '/pages/login.html' }
      });
      if (error) {
        mostrarStatus(mensajeError(error), 'error');
        return;
      }
      mostrarStatus(`Listo, te enviamos otro correo de confirmación a ${email}. Revisa también la carpeta de spam.`, 'success');
    };

    // Envia el correo para cambiar la contraseña (el enlace vuelve a esta misma pagina)
    window.mostrarRecuperacion = async function () {
      const email = document.getElementById('loginEmail')?.value.trim().toLowerCase();
      if (!email) {
        mostrarStatus('Escribe tu correo arriba para enviarte el enlace de recuperación.', 'error');
        return;
      }
      const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/pages/login.html'
      });
      if (error) {
        mostrarStatus(mensajeError(error), 'error');
        return;
      }
      mostrarStatus(`Si ${email} tiene cuenta, te llegará un enlace para cambiar la contraseña (revisa spam).`, 'success');
    };

    // Al abrir el enlace del correo, Supabase avisa con PASSWORD_RECOVERY: se pide la contraseña nueva
    window.supabaseClient.auth.onAuthStateChange((evento) => {
      if (evento !== 'PASSWORD_RECOVERY') return;
      const form = document.getElementById('dmFormLogin');
      if (!form) return;
      form.innerHTML = `
        <h3 style="color:#fff; margin:0 0 10px;">Escribe tu contraseña nueva</h3>
        <input type="password" id="nuevaClave" class="dm-input" placeholder="Contraseña nueva (mínimo 6)" minlength="6" required
          style="width:100%; padding:14px; border-radius:14px; margin-bottom:12px;">
        <button type="submit" class="dm-action-pill-button"><span class="dm-btn-text">Guardar contraseña</span></button>`;
      form.onsubmit = async (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        const clave = document.getElementById('nuevaClave').value;
        if (clave.length < 6) { mostrarStatus('La contraseña debe tener al menos 6 caracteres.', 'error'); return; }
        const { error } = await window.supabaseClient.auth.updateUser({ password: clave });
        if (error) { mostrarStatus(mensajeError(error), 'error'); return; }
        await window.supabaseClient.auth.signOut();
        mostrarStatus('Contraseña cambiada. Ya puedes iniciar sesión.', 'success');
        setTimeout(() => window.location.replace('login.html'), 1500);
      };
    });
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
