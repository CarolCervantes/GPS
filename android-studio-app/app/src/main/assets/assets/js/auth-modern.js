/**
 * DiaMon - Controlador de Autenticación Oficial con Supabase Auth (JWT)
 * Soporta los 3 roles del Caso de Estudio:
 *   - Paciente (monitoreado): Damián Díaz Balseiro (Barrio Chapacuá)
 *   - Cuidador / Familiar (cuidador): Valentina Díaz Martínez & Enf. Jefe Elizabeth Vargas Caro
 *   - Administrador (admin)
 */

(function () {
  'use strict';

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

        if (currentRole === 'cuidador') {
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

  function initFormSubmit() {
    const formLogin = document.getElementById('dmFormLogin');
    const formRegister = document.getElementById('dmFormRegister');
    const loginSubmitBtn = document.getElementById('dmLoginSubmitBtn');
    const regSubmitBtn = document.getElementById('dmRegSubmitBtn');

    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        limpiarStatus();

        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        const password = document.getElementById('loginPassword').value.trim();
        const codeInput = (document.getElementById('loginPatientCode')?.value || '').trim().toUpperCase();

        if (!email || !password) {
          mostrarStatus('Por favor ingresa tu correo electrónico y tu contraseña.', 'error');
          return;
        }

        if (currentRole === 'cuidador' && codeInput && codeInput !== 'DM-8492') {
          mostrarStatus(`El código "${codeInput}" no corresponde al paciente del Caso de Estudio (Usa DM-8492 para Damián Díaz Balseiro).`, 'error');
          return;
        }

        activarBotonCarga(loginSubmitBtn, 'Autenticando en Supabase...');

        // 1. Autenticación real con Supabase Auth (JWT)
        if (window.supabaseClient && window.supabaseClient.auth) {
          try {
            const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
            if (!error && data && data.user) {
              const { data: profile } = await window.supabaseClient
                .from('profiles')
                .select('nombre, rol')
                .eq('id', data.user.id)
                .single();

              const sessionObj = {
                id: data.user.id,
                nombre: profile?.nombre || data.user.user_metadata?.nombre || formatearNombreLimpio(email),
                email: data.user.email,
                rol: profile?.rol || currentRole,
                codigoPaciente: 'DM-8492',
                pacienteVinculado: PACIENTE_CASO_ESTUDIO,
                autenticadoSupabase: true
              };

              sessionStorage.setItem('diamon_demo_user', JSON.stringify(sessionObj));
              localStorage.setItem('diamon_current_user', JSON.stringify(sessionObj));
              mostrarStatus(`¡Sesión JWT verificada en Supabase! Bienvenido(a), ${sessionObj.nombre}.`, 'success');
              setTimeout(() => { window.location.href = 'index.html'; }, 600);
              return;
            } else if (error && !error.message.toLowerCase().includes('fetch')) {
              desactivarBotonCarga(loginSubmitBtn, 'Entrar al Sistema');
              mostrarStatus(`Supabase Auth: ${error.message}. Si aún no has creado tu usuario en Supabase, ve a la pestaña "Crear cuenta".`, 'error');
              return;
            }
          } catch (_) {
            // Si no hay conexión de red disponible en el salón, informa claramente
          }
        }

        desactivarBotonCarga(loginSubmitBtn, 'Entrar al Sistema');
        mostrarStatus('No se pudo verificar la credencial con Supabase Auth. Crea tu cuenta en la pestaña "Crear cuenta" o verifica tu conexión.', 'error');
      });
    }

    if (formRegister) {
      formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        limpiarStatus();

        const rawNombre = document.getElementById('regNombre').value.trim();
        const email = document.getElementById('regEmail').value.trim().toLowerCase();
        const password = document.getElementById('regPassword').value;

        if (!rawNombre || !email || !password) {
          mostrarStatus('Por favor completa todos los campos del registro.', 'error');
          return;
        }

        if (password.length < 6) {
          mostrarStatus('La contraseña debe tener al menos 6 caracteres.', 'error');
          return;
        }

        const nombreLimpio = formatearNombreLimpio(rawNombre);
        const rolSupabase = currentRole === 'cuidador' ? 'cuidador' : (currentRole === 'usuario' ? 'monitoreado' : 'usuario');

        activarBotonCarga(regSubmitBtn, 'Registrando en Supabase...');

        if (window.supabaseClient && window.supabaseClient.auth) {
          try {
            const { data, error } = await window.supabaseClient.auth.signUp({
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
              desactivarBotonCarga(regSubmitBtn, 'Crear Cuenta en DiaMon');
              mostrarStatus(`Supabase Auth: ${error.message}`, 'error');
              return;
            }

            if (data && data.user) {
              const sessionObj = {
                id: data.user.id,
                nombre: nombreLimpio,
                email: email,
                rol: rolSupabase === 'monitoreado' ? 'usuario' : rolSupabase,
                codigoPaciente: 'DM-8492',
                pacienteVinculado: PACIENTE_CASO_ESTUDIO,
                autenticadoSupabase: true
              };

              sessionStorage.setItem('diamon_demo_user', JSON.stringify(sessionObj));
              localStorage.setItem('diamon_current_user', JSON.stringify(sessionObj));
              mostrarStatus(`¡Cuenta registrada en Supabase! Ingresando al panel...`, 'success');
              setTimeout(() => { window.location.href = 'index.html'; }, 800);
              return;
            }
          } catch (err) {
            desactivarBotonCarga(regSubmitBtn, 'Crear Cuenta en DiaMon');
            mostrarStatus('Error de red al conectar con Supabase Auth: ' + err.message, 'error');
          }
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

    window.cargarCodigoDemo = function (cod) {
      const inputs = [
        document.getElementById('loginPatientCode'),
        document.getElementById('regPatientCode')
      ];
      inputs.forEach(inp => { if (inp) inp.value = cod; });
      mostrarStatus(`Código del Caso de Estudio (${cod} - Damián Díaz Balseiro) seleccionado.`, 'success');
    };

    window.mostrarRecuperacion = async function () {
      const email = document.getElementById('loginEmail')?.value.trim();
      if (!email) {
        mostrarStatus('Escribe tu correo electrónico en la casilla superior para enviarte el enlace de recuperación.', 'error');
        return;
      }
      if (window.supabaseClient && window.supabaseClient.auth) {
        await window.supabaseClient.auth.resetPasswordForEmail(email).catch(() => {});
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
  }

  function limpiarStatus() {
    const el = document.getElementById('authStatusMsg');
    if (!el) return;
    el.className = 'dm-status-msg';
    el.textContent = '';
    el.style.display = 'none';
  }

})();

