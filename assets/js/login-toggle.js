// Estación de monitoreo:
// - Cross-fade entre los formularios de login y registro
// - Role selector (segmented control deslizante)
// - Reveal del campo "código admin" cuando se elige admin en registro
// - Rotación de mensajes del marquee + latencia ambiente

document.addEventListener('DOMContentLoaded', () => {
  // ---------- Cross-fade login / registro ----------
  const tabs = document.querySelectorAll('.auth-tab');
  const tabsContainer = document.getElementById('authTabs');
  const forms = document.querySelectorAll('.auth-form');

  function activar(target) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.target === target));
    forms.forEach(f => {
      f.classList.remove('active');
      void f.offsetWidth; // reflow para reiniciar stagger
      if (f.id === target + 'Form') f.classList.add('active');
    });
    if (tabsContainer) tabsContainer.dataset.active = target;
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => activar(tab.dataset.target));
  });

  // ---------- Role selector ----------
  const HINTS = {
    login: {
      usuario:     'Acceso estándar al monitoreo personal.',
      cuidador:    'Familiar o cuidador — puedes ver la ubicación y alertas de tu persona monitoreada.',
      monitoreado: 'Persona monitoreada — tu ubicación es visible para tu cuidador.',
      admin:       'Requiere <span class="em">código de administrador</span> como segundo factor.'
    },
    register: {
      usuario:     'Cuenta estándar — solo verás tus propios datos.',
      cuidador:    'Podrás monitorear la ubicación de una persona a tu cargo y recibir sus alertas.',
      monitoreado: 'Tu ubicación será compartida con tu cuidador asignado.',
      admin:       'Requiere <span class="em">código secreto</span> provisto por el administrador.'
    }
  };

  document.querySelectorAll('.role-selector').forEach(selector => {
    const opts = selector.querySelectorAll('.role-opt');
    const isLogin = !!selector.closest('#loginForm');
    const isRegister = !!selector.closest('#registerForm');

    opts.forEach(opt => {
      opt.addEventListener('click', () => {
        const rol = opt.dataset.role;
        selector.dataset.role = rol;
        opts.forEach(o => o.classList.toggle('active', o.dataset.role === rol));

        // Sincronizar el input hidden hermano
        const hidden = selector.parentElement.querySelector('input[type="hidden"]');
        if (hidden) hidden.value = rol;

        // Iluminar (no ocultar) la sección de código de admin
        const section = document.getElementById(isLogin ? 'loginAdminSection' : 'registerAdminSection');
        if (section) section.dataset.active = String(rol === 'admin');

        // Actualizar hint
        const hintEl = document.getElementById(isLogin ? 'loginRoleHint' : 'registerRoleHint');
        if (hintEl) {
          hintEl.innerHTML = HINTS[isLogin ? 'login' : 'register'][rol];
          hintEl.classList.toggle('admin', rol === 'admin');
        }

        // Cambiar label del submit
        if (isLogin) {
          const label = document.getElementById('loginSubmitLabel');
          if (label) label.textContent = rol === 'admin' ? 'Entrar como administrador' : 'Entrar a la estación';
        }
        if (isRegister) {
          const label = document.getElementById('registerSubmitLabel');
          if (label) label.textContent = rol === 'admin' ? 'Crear cuenta de administrador' : 'Crear cuenta';
        }

        // Focus en el código cuando se elige admin (UX: ya está visible, solo enfocamos)
        if (rol === 'admin' && section) {
          setTimeout(() => section.querySelector('input')?.focus(), 120);
        }
      });
    });
  });

  // ---------- Marquee de mensajes del sistema ----------
  const items = document.querySelectorAll('.marquee-item');
  if (items.length > 1) {
    let idx = 0;
    setInterval(() => {
      items[idx].classList.remove('active');
      idx = (idx + 1) % items.length;
      items[idx].classList.add('active');
    }, 3200);
  }

  // ---------- Latencia ambiente ----------
  const lat = document.getElementById('telLatency');
  if (lat) {
    setInterval(() => {
      const ms = 9 + Math.floor(Math.random() * 8);
      lat.textContent = ms + ' ms';
    }, 2400);
  }
});
