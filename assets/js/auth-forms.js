// Conecta los formularios combinados (login + registro) con Supabase Auth.
// - Login: valida que el rol seleccionado coincida con el rol real del usuario.
// - Registro: si se elige "Administrador", envía admin_code en user_metadata.
//   El trigger del servidor valida el código (validación NO confiable en cliente).

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const mensaje = document.getElementById('authMensaje');

  function mostrarMensaje(texto, tipo) {
    if (!mensaje) { alert(texto); return; }
    mensaje.textContent = texto;
    mensaje.className = 'auth-mensaje ' + tipo;
  }

  function limpiarMensaje() {
    if (!mensaje) return;
    mensaje.className = 'auth-mensaje';
    mensaje.textContent = '';
  }

  function lockSubmit(form, locked, labelLockedText) {
    const btn = form.querySelector('.auth-submit');
    if (!btn) return;
    btn.disabled = locked;
    btn.style.opacity = locked ? '0.7' : '';
    btn.style.cursor = locked ? 'not-allowed' : '';
    if (locked && labelLockedText) {
      const label = btn.querySelector('span:first-child');
      if (label) btn.dataset.originalLabel = label.textContent, label.textContent = labelLockedText;
    } else if (!locked && btn.dataset.originalLabel) {
      const label = btn.querySelector('span:first-child');
      if (label) label.textContent = btn.dataset.originalLabel;
      delete btn.dataset.originalLabel;
    }
  }

  // ============ LOGIN ============
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      limpiarMensaje();

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const rolSeleccionado = document.getElementById('login-rol').value;
      const adminCode = (document.getElementById('login-admin-code')?.value || '').trim();

      // Validación temprana del código si se selecciona admin
      if (rolSeleccionado === 'admin' && adminCode.length === 0) {
        mostrarMensaje('Ingresa el código de administrador para continuar.', 'error');
        return;
      }

      lockSubmit(loginForm, true, 'Verificando…');

      // 1) Verificar el código de admin ANTES de tocar la sesión.
      //    Si el código es inválido, no autenticamos para evitar dejar
      //    una sesión a medias.
      if (rolSeleccionado === 'admin') {
        const { data: codigoOk, error: codeErr } = await supabaseClient
          .rpc('verificar_codigo_admin', { code: adminCode });

        if (codeErr) {
          lockSubmit(loginForm, false);
          mostrarMensaje('No se pudo verificar el código: ' + codeErr.message, 'error');
          return;
        }
        if (!codigoOk) {
          lockSubmit(loginForm, false);
          mostrarMensaje('Código de administrador incorrecto.', 'error');
          return;
        }
      }

      // 2) Autenticar con email + password.
      const { data: signInData, error } = await supabaseClient.auth.signInWithPassword({ email, password });

      if (error) {
        lockSubmit(loginForm, false);
        if (error.message === 'Invalid login credentials') {
          mostrarMensaje('Correo o contraseña incorrectos', 'error');
        } else if (error.message === 'Email not confirmed') {
          mostrarMensaje('Debes confirmar tu correo antes de iniciar sesión', 'error');
        } else {
          mostrarMensaje(error.message, 'error');
        }
        return;
      }

      // 3) Comprobar rol real en BD.
      const userId = signInData.user.id;
      const { data: profile, error: profileError } = await supabaseClient
        .from('profiles')
        .select('rol')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        await supabaseClient.auth.signOut();
        lockSubmit(loginForm, false);
        mostrarMensaje('No se pudo verificar tu rol. Intenta de nuevo.', 'error');
        return;
      }

      const rolReal = profile.rol;

      // 4) Si seleccionó "admin" y NO lo es en BD, deshacer sesión.
      if (rolSeleccionado === 'admin' && rolReal !== 'admin') {
        await supabaseClient.auth.signOut();
        lockSubmit(loginForm, false);
        mostrarMensaje(
          'Esta cuenta no tiene permisos de administrador. Selecciona "Usuario" para continuar.',
          'error'
        );
        return;
      }

      // Login válido — redirige
      window.location.href = 'index.html';
    });
  }

  // ============ REGISTRO ============
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      limpiarMensaje();

      const nombre = document.getElementById('register-name').value.trim();
      const email = document.getElementById('register-email').value.trim();
      const password = document.getElementById('register-password').value;
      const rolSeleccionado = document.getElementById('register-rol').value;
      const adminCode = (document.getElementById('register-admin-code')?.value || '').trim();

      if (nombre.length < 3) {
        mostrarMensaje('El nombre debe tener al menos 3 caracteres', 'error');
        return;
      }
      if (password.length < 6) {
        mostrarMensaje('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
      }
      if (rolSeleccionado === 'admin' && adminCode.length === 0) {
        mostrarMensaje('Para registrarte como administrador necesitas un código.', 'error');
        return;
      }

      lockSubmit(registerForm, true, 'Creando cuenta…');

      // user_metadata se envía al trigger handle_new_user.
      // Si admin_code coincide con el secreto del servidor, el trigger asigna rol=admin.
      // Para cuidador y monitoreado se envía el rol directamente en metadata.
      const metadata = { nombre };
      if (rolSeleccionado === 'admin') metadata.admin_code = adminCode;
      if (rolSeleccionado === 'cuidador' || rolSeleccionado === 'monitoreado') {
        metadata.rol = rolSeleccionado;
      }

      const { error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: metadata }
      });

      lockSubmit(registerForm, false);

      if (error) {
        if (error.message === 'User already registered') {
          mostrarMensaje('Este correo electrónico ya está registrado', 'error');
        } else {
          mostrarMensaje(error.message, 'error');
        }
        return;
      }

      const mensajes = {
        admin:       '¡Cuenta de administrador creada! Ya puedes iniciar sesión.',
        cuidador:    '¡Cuenta de cuidador creada! Un administrador debe vincularte con tu persona monitoreada.',
        monitoreado: '¡Cuenta creada! Un administrador debe vincularte con tu cuidador.',
        usuario:     '¡Cuenta creada exitosamente! Ya puedes iniciar sesión.',
      };
      const mensajeExito = mensajes[rolSeleccionado] || mensajes.usuario;
      mostrarMensaje(mensajeExito, 'exito');
      registerForm.reset();
      // Cerrar el campo de admin code si estaba abierto
      document.getElementById('adminCodeField')?.classList.remove('open');
      document.querySelectorAll('.role-selector').forEach(sel => {
        sel.dataset.role = 'usuario';
        sel.querySelectorAll('.role-opt').forEach(o => o.classList.toggle('active', o.dataset.role === 'usuario'));
      });
      const reg = document.getElementById('register-rol');
      if (reg) reg.value = 'usuario';
    });
  }
});
