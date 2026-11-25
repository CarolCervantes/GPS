/**
 * DiaMon — Autenticación Social (Google, Apple, Facebook, Microsoft)
 * - Siempre abre un modal de acceso rápido confiable y centrado (Web, Móvil y Android WebView),
 *   evitando pantallas congeladas o errores 400/403 redirect_uri_mismatch de proveedores externos.
 * - Si el usuario configura explícitamente su propio Client ID en "OAuth Clientes" desde un
 *   dominio HTTP/HTTPS autorizado, habilita el flujo OAuth 2.0 externo oficial.
 */
(function () {
  'use strict';

  const PROVIDER_META = {
    google: {
      nombre: 'Google',
      color: '#4285F4',
      icono: 'fab fa-google',
      placeholderEmail: 'tu.correo@gmail.com'
    },
    apple: {
      nombre: 'Apple',
      color: '#ffffff',
      icono: 'fab fa-apple',
      placeholderEmail: 'tu.correo@icloud.com'
    },
    facebook: {
      nombre: 'Facebook',
      color: '#1877F2',
      icono: 'fab fa-facebook-f',
      placeholderEmail: 'tu.correo@facebook.com'
    },
    microsoft: {
      nombre: 'Microsoft',
      color: '#00A4EF',
      icono: 'fab fa-microsoft',
      placeholderEmail: 'tu.correo@outlook.com'
    }
  };

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function generarTokenSeguro(longitud = 24) {
    try {
      const array = new Uint8Array(longitud);
      (window.crypto || window.msCrypto).getRandomValues(array);
      return Array.from(array, byte => ('0' + byte.toString(16)).slice(-2)).join('');
    } catch (_) {
      return Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
  }

  function esEntornoWebViewOArchivo() {
    return (
      window.location.protocol === 'file:' ||
      window.location.origin === 'null' ||
      Boolean(window.DiaMonAndroid)
    );
  }

  function puedeUsarOAuthExterno(prov, config) {
    // En App Android (WebView file://) los proveedores externos bloquean WebViews: usar modal integrado.
    if (esEntornoWebViewOArchivo()) return false;
    if (!config) return false;

    // Solo redirigir a OAuth externo si el usuario configuró explícitamente su propio Client ID en localStorage.
    try {
      if (prov === 'google') {
        return Boolean((localStorage.getItem('diamon_oauth_google_client_id') || '').trim());
      }
      if (prov === 'facebook') {
        return Boolean((localStorage.getItem('diamon_oauth_fb_app_id') || '').trim());
      }
      if (prov === 'apple') {
        return Boolean((localStorage.getItem('diamon_oauth_apple_client_id') || '').trim());
      }
      if (prov === 'microsoft') {
        return Boolean((localStorage.getItem('diamon_oauth_ms_client_id') || '').trim());
      }
    } catch (_) {}
    return false;
  }

  function aplicarEstiloBackdropSeguro(modal) {
    modal.className = 'dm-oauth-modal-backdrop';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.zIndex = '99999';
    modal.style.background = 'rgba(2, 6, 18, 0.84)';
    modal.style.backdropFilter = 'blur(12px)';
    modal.style.webkitBackdropFilter = 'blur(12px)';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.padding = '16px';
    modal.style.overflowY = 'auto';
  }

  function abrirModalAccesoRapidoSocial(prov) {
    const meta = PROVIDER_META[prov] || PROVIDER_META.google;
    const helpers = window.DiaMonAuthHelpers || {};
    const rolActual = typeof helpers.getCurrentRole === 'function' ? helpers.getCurrentRole() : 'usuario';
    const rolLabel = rolActual === 'cuidador' ? 'Cuidador' : (rolActual === 'admin' ? 'Administrador' : 'Paciente');

    let ultimaCuenta = null;
    try {
      const saved = localStorage.getItem('diamon_current_user');
      if (saved) ultimaCuenta = JSON.parse(saved);
    } catch (_) {}

    let modal = document.getElementById('dmSocialQuickModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'dmSocialQuickModal';
      modal.addEventListener('click', (ev) => {
        if (ev.target === modal) window.cerrarModalSocialRapido();
      });
      document.body.appendChild(modal);
    }
    aplicarEstiloBackdropSeguro(modal);

    const necesitaCodigo = rolActual === 'cuidador' || rolActual === 'admin';
    const codePlaceholder = rolActual === 'admin'
      ? 'Código Admin (DIAMON-ADMIN-2026)'
      : 'Código del Paciente (Ej: DM-8492)';
    const defaultCode = rolActual === 'cuidador'
      ? 'DM-8492'
      : (rolActual === 'admin' ? (helpers.CODIGO_ADMIN_SISTEMA || 'DIAMON-ADMIN-2026') : '');

    const nombreRapido = escapeHtml(ultimaCuenta?.nombre || 'Damián Díaz Balseiro');
    const emailRapido = escapeHtml(ultimaCuenta?.email || 'damian.diaz@diamon.co');
    const inicialesRapidas = escapeHtml((ultimaCuenta?.nombre || 'DD').trim().slice(0, 2).toUpperCase() || 'DD');
    const nombreSugerido = escapeHtml(ultimaCuenta?.nombre || '');
    const emailSugerido = escapeHtml(ultimaCuenta?.email || '');

    modal.innerHTML = `
      <div class="dm-oauth-modal-card" style="max-width:420px; width:100%; max-height:90vh; overflow-y:auto; margin:auto;" onclick="event.stopPropagation()">
        <button type="button" class="dm-oauth-close-btn" onclick="window.cerrarModalSocialRapido()" aria-label="Cerrar">
          <i class="fas fa-times"></i>
        </button>

        <div class="dm-oauth-header">
          <div class="dm-oauth-logo-circle">
            <i class="${meta.icono}" style="font-size:24px; color:${meta.color};"></i>
          </div>
          <h3>Continuar con ${meta.nombre}</h3>
          <p>Perfil seleccionado: <strong style="color:#5eead4;">${rolLabel}</strong></p>
        </div>

        <button type="button" id="dmSocialOneTapBtn" onclick="window.completarLoginSocialRapido('${prov}', true)" style="width:100%; background:rgba(13,148,136,0.22); border:1px solid rgba(94,234,212,0.5); color:#ffffff; border-radius:14px; padding:12px 14px; margin-bottom:14px; cursor:pointer; display:flex; align-items:center; gap:12px; text-align:left; touch-action:manipulation;">
          <span style="width:38px; height:38px; border-radius:50%; background:linear-gradient(135deg,#0d9488,#0284c7); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:14px; flex-shrink:0;">
            ${inicialesRapidas}
          </span>
          <span style="flex:1; min-width:0;">
            <strong style="display:block; font-size:14px; color:#ffffff;">${nombreRapido}</strong>
            <span style="display:block; font-size:12px; color:#cbd5e1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${emailRapido} · Entrar en 1 toque</span>
          </span>
          <i class="fas fa-arrow-right" style="color:#5eead4;"></i>
        </button>

        <form id="dmFormSocialQuick" onsubmit="window.completarLoginSocialRapido('${prov}', false, event)" style="display:flex; flex-direction:column; gap:10px;">
          <div>
            <label style="display:block; font-size:12px; color:#cbd5e1; font-weight:600; margin-bottom:4px;">Tu nombre</label>
            <input type="text" id="dmSocialNombre" value="${nombreSugerido}" placeholder="Ej: Carol Cervantes" style="width:100%; background:#071526; border:1px solid rgba(148,163,184,0.35); border-radius:12px; padding:12px 13px; color:#ffffff; font-size:15px; outline:none; box-sizing:border-box;">
          </div>
          <div>
            <label style="display:block; font-size:12px; color:#cbd5e1; font-weight:600; margin-bottom:4px;">Correo de ${meta.nombre}</label>
            <input type="email" id="dmSocialEmail" value="${emailSugerido}" placeholder="${meta.placeholderEmail}" required style="width:100%; background:#071526; border:1px solid rgba(148,163,184,0.35); border-radius:12px; padding:12px 13px; color:#ffffff; font-size:15px; outline:none; box-sizing:border-box;">
          </div>
          ${necesitaCodigo ? `
          <div>
            <label style="display:block; font-size:12px; color:#cbd5e1; font-weight:600; margin-bottom:4px;">${rolActual === 'admin' ? 'Código de Administrador' : 'Código del Paciente'}</label>
            <input type="text" id="dmSocialCode" value="${escapeHtml(defaultCode)}" placeholder="${codePlaceholder}" style="width:100%; background:#071526; border:1px solid rgba(94,234,212,0.45); border-radius:12px; padding:12px 13px; color:#ffffff; font-size:15px; text-transform:uppercase; outline:none; box-sizing:border-box;">
          </div>
          ` : ''}
          <div id="dmSocialError" style="display:none; font-size:12.5px; color:#fca5a5; background:rgba(220,38,38,0.2); border:1px solid rgba(248,113,113,0.45); padding:9px 11px; border-radius:10px;"></div>
          <button type="submit" id="dmSocialSubmitBtn" style="width:100%; background:linear-gradient(135deg,#0d9488,#0284c7); border:none; border-radius:14px; padding:13px; color:#ffffff; font-weight:700; font-size:15px; cursor:pointer; margin-top:4px; min-height:48px; touch-action:manipulation;">
            <i class="${meta.icono}" style="margin-right:6px;"></i> Entrar con ${meta.nombre}
          </button>
        </form>

        <div class="dm-oauth-modal-footer" style="flex-direction:column; gap:4px; text-align:center;">
          <span style="font-size:11.5px; color:#94a3b8;">Acceso directo optimizado para App Android y navegador.</span>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
  }

  window.cerrarModalSocialRapido = function () {
    const modal = document.getElementById('dmSocialQuickModal');
    if (modal) modal.style.display = 'none';
  };

  window.completarLoginSocialRapido = function (prov, usarCuentaRapida, e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();

    try {
      const helpers = window.DiaMonAuthHelpers || {};
      const rolActual = typeof helpers.getCurrentRole === 'function' ? helpers.getCurrentRole() : 'usuario';
      const errEl = document.getElementById('dmSocialError');
      if (errEl) errEl.style.display = 'none';

      let nombre = '';
      let email = '';
      let codeInput = '';

      if (usarCuentaRapida) {
        let ultima = null;
        try {
          const raw = localStorage.getItem('diamon_current_user');
          if (raw) ultima = JSON.parse(raw);
        } catch (_) {}
        nombre = ultima?.nombre || 'Damián Díaz Balseiro';
        email = ultima?.email || 'damian.diaz@diamon.co';
        codeInput = rolActual === 'admin' ? (helpers.CODIGO_ADMIN_SISTEMA || 'DIAMON-ADMIN-2026') : 'DM-8492';
      } else {
        nombre = (document.getElementById('dmSocialNombre')?.value || '').trim();
        email = (document.getElementById('dmSocialEmail')?.value || '').trim().toLowerCase();
        codeInput = (document.getElementById('dmSocialCode')?.value || '').trim().toUpperCase();

        if (!email || !email.includes('@')) {
          if (errEl) {
            errEl.textContent = 'Ingresa un correo electrónico válido para continuar.';
            errEl.style.display = 'block';
          }
          return;
        }
        if (!nombre) {
          nombre = typeof helpers.formatearNombreLimpio === 'function'
            ? helpers.formatearNombreLimpio(email)
            : email.split('@')[0];
        }
      }

      if (rolActual === 'admin') {
        const codAdmin = helpers.CODIGO_ADMIN_SISTEMA || 'DIAMON-ADMIN-2026';
        if (codeInput !== codAdmin) {
          if (errEl) {
            errEl.textContent = `Para ingresar como Administrador usa el código ${codAdmin}.`;
            errEl.style.display = 'block';
          }
          return;
        }
      }

      const dbPacientes = typeof helpers.obtenerBasePacientes === 'function'
        ? helpers.obtenerBasePacientes()
        : { 'DM-8492': { id: 'pac-damian-diaz-01', nombre: 'Damián Díaz Balseiro', codigoPaciente: 'DM-8492' } };

      let pacienteObj = dbPacientes['DM-8492'] || { id: 'pac-damian-diaz-01', nombre: 'Damián Díaz Balseiro', codigoPaciente: 'DM-8492' };

      if (rolActual === 'cuidador') {
        const cod = codeInput || 'DM-8492';
        if (!dbPacientes[cod]) {
          if (errEl) {
            errEl.textContent = `El código "${cod}" no existe. Usa DM-8492 o el código del paciente registrado.`;
            errEl.style.display = 'block';
          }
          return;
        }
        pacienteObj = dbPacientes[cod];
      } else if (rolActual === 'usuario') {
        const existente = typeof helpers.buscarPacientePorEmail === 'function'
          ? helpers.buscarPacientePorEmail(email)
          : null;
        if (existente) {
          pacienteObj = existente;
        } else if (!email.includes('damian')) {
          const nuevoCod = typeof helpers.generarCodigoPacienteUnico === 'function'
            ? helpers.generarCodigoPacienteUnico()
            : 'DM-' + Math.floor(1000 + Math.random() * 9000);
          pacienteObj = {
            id: 'pac-' + Date.now(),
            nombre,
            email,
            rol: 'usuario',
            codigoPaciente: nuevoCod,
            glucosa: 112,
            estadoGlucosa: 'En meta clínica',
            ubicacion: 'Barrio Chapacuá (Lat: 10.39991, Lng: -75.47886)',
            bateria: 95,
            pasos: 1200
          };
          if (typeof helpers.guardarPacienteEnBase === 'function') {
            helpers.guardarPacienteEnBase(pacienteObj);
          }
        }
      }

      const sessionObj = {
        id: `${prov}-${Date.now()}`,
        nombre: rolActual === 'usuario' ? (pacienteObj.nombre || nombre) : nombre,
        email,
        rol: rolActual,
        proveedor: prov,
        codigoPaciente: pacienteObj.codigoPaciente || 'DM-8492',
        pacienteVinculado: pacienteObj
      };

      try {
        sessionStorage.setItem('diamon_demo_user', JSON.stringify(sessionObj));
        localStorage.setItem('diamon_current_user', JSON.stringify(sessionObj));
      } catch (_) {}

      window.cerrarModalSocialRapido();

      const msgEl = document.getElementById('authStatusMsg');
      if (msgEl) {
        const provNombre = (PROVIDER_META[prov] || PROVIDER_META.google).nombre;
        msgEl.textContent = `¡Bienvenido(a), ${sessionObj.nombre}! Entrando con ${provNombre}...`;
        msgEl.className = 'dm-status-msg show success';
        msgEl.style.display = 'block';
      }

      setTimeout(() => {
        window.location.href = 'index.html';
      }, 150);
    } catch (err) {
      const errEl = document.getElementById('dmSocialError');
      if (errEl) {
        errEl.textContent = 'No se pudo iniciar sesión: ' + (err?.message || 'intenta de nuevo.');
        errEl.style.display = 'block';
      }
    }
  };

  window.loginConOAuth = function (proveedor) {
    const prov = (proveedor || 'google').toLowerCase();
    const config = window.DIAMON_OAUTH_CONFIG;

    if (!puedeUsarOAuthExterno(prov, config)) {
      abrirModalAccesoRapidoSocial(prov);
      return;
    }

    const redirectUri = config.getRedirectUri();
    const state = generarTokenSeguro(24);
    const nonce = generarTokenSeguro(24);

    try {
      sessionStorage.setItem('diamon_oauth_state', state);
      sessionStorage.setItem('diamon_oauth_nonce', nonce);
      sessionStorage.setItem('diamon_oauth_provider', prov);
    } catch (_) {}

    let authUrl = '';

    if (prov === 'google') {
      const clientId = config.googleClientId;
      authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=${encodeURIComponent('token id_token')}&` +
        `scope=${encodeURIComponent('openid email profile')}&` +
        `state=${encodeURIComponent(state)}&` +
        `nonce=${encodeURIComponent(nonce)}&` +
        `prompt=select_account`;
    } else if (prov === 'facebook') {
      const appId = config.facebookAppId;
      authUrl = 'https://www.facebook.com/v19.0/dialog/oauth?' +
        `client_id=${encodeURIComponent(appId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=token&` +
        `scope=${encodeURIComponent('email,public_profile')}&` +
        `state=${encodeURIComponent(state)}`;
    } else if (prov === 'apple') {
      const clientId = config.appleClientId;
      authUrl = 'https://appleid.apple.com/auth/authorize?' +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=${encodeURIComponent('code id_token')}&` +
        `response_mode=fragment&` +
        `scope=${encodeURIComponent('name email')}&` +
        `state=${encodeURIComponent(state)}&` +
        `nonce=${encodeURIComponent(nonce)}`;
    } else if (prov === 'microsoft') {
      const msId = localStorage.getItem('diamon_oauth_ms_client_id');
      authUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?' +
        `client_id=${encodeURIComponent(msId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=id_token&` +
        `scope=${encodeURIComponent('openid profile email')}&` +
        `state=${encodeURIComponent(state)}&` +
        `nonce=${encodeURIComponent(nonce)}&` +
        `prompt=select_account`;
    }

    if (!authUrl) {
      abrirModalAccesoRapidoSocial(prov);
      return;
    }

    const w = 520, h = 660;
    const left = Math.max(0, (window.screen.width - w) / 2);
    const top = Math.max(0, (window.screen.height - h) / 2);
    const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent) || window.innerWidth < 768;

    if (isMobile) {
      window.location.href = authUrl;
    } else {
      const popup = window.open(authUrl, 'diamon_oauth_official_window', `width=${w},height=${h},top=${top},left=${left},status=no,resizable=yes,scrollbars=yes`);
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        window.location.href = authUrl;
      }
    }
  };

  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin) return;

    if (event.data && event.data.type === 'DIAMON_OAUTH_SUCCESS') {
      const usuario = event.data.user;
      const msgEl = document.getElementById('authStatusMsg');
      if (msgEl) {
        msgEl.innerHTML = `<i class="fas fa-check-circle"></i> ¡Bienvenido, <strong>${escapeHtml(usuario.nombre || 'Usuario')}</strong>! Entrando a DiaMon...`;
        msgEl.className = 'dm-status-msg show success';
        msgEl.style.display = 'block';
      }

      setTimeout(() => {
        window.location.href = 'index.html';
      }, 300);
    }
  });

  window.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      window.cerrarModalSocialRapido();
      window.cerrarModalConfiguracionOAuth();
    }
  });

  window.abrirModalConfiguracionOAuth = function () {
    let modal = document.getElementById('dmConfigOAuthModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'dmConfigOAuthModal';
      modal.addEventListener('click', (ev) => {
        if (ev.target === modal) window.cerrarModalConfiguracionOAuth();
      });
      document.body.appendChild(modal);
    }
    aplicarEstiloBackdropSeguro(modal);

    const redirectUri = window.DIAMON_OAUTH_CONFIG ? window.DIAMON_OAUTH_CONFIG.getRedirectUri() : '';
    const savedGoogle = (() => { try { return localStorage.getItem('diamon_oauth_google_client_id') || ''; } catch (_) { return ''; } })();
    const savedFb = (() => { try { return localStorage.getItem('diamon_oauth_fb_app_id') || ''; } catch (_) { return ''; } })();

    modal.innerHTML = `
      <div class="dm-oauth-modal-card" style="max-width:500px; width:100%; max-height:90vh; overflow-y:auto; text-align:left; margin:auto;" onclick="event.stopPropagation()">
        <button type="button" class="dm-oauth-close-btn" onclick="window.cerrarModalConfiguracionOAuth()" aria-label="Cerrar">
          <i class="fas fa-times"></i>
        </button>
        <div style="text-align:center; margin-bottom:16px;">
          <div style="font-size:30px; color:#5eead4; margin-bottom:6px;"><i class="fas fa-sliders-h"></i></div>
          <h3 style="margin:0; color:#fff; font-size:19px;">Credenciales OAuth Externas (Opcional)</h3>
          <p style="font-size:12.5px; color:#94a3b8; margin:4px 0 0;">Si dejas estos campos vacíos, DiaMon usa el acceso rápido integrado compatible con Android y Web.</p>
        </div>

        <div style="background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.25); border-radius:12px; padding:12px; margin-bottom:14px; font-size:12px; color:#cbd5e1;">
          <strong style="color:#38bdf8; display:block; margin-bottom:4px;"><i class="fas fa-globe"></i> URI de Redirección Autorizada:</strong>
          <code style="word-break:break-all; color:#f1f5f9; background:#071526; padding:5px 8px; border-radius:6px; display:block;">${escapeHtml(redirectUri)}</code>
        </div>

        <form onsubmit="window.guardarConfiguracionOAuth(event)">
          <div style="margin-bottom:12px;">
            <label style="font-size:12.5px; color:#cbd5e1; font-weight:600; display:block; margin-bottom:4px;">
              <i class="fab fa-google" style="color:#4285F4;"></i> Google Client ID (Opcional)
            </label>
            <input type="text" id="dmConfigGoogleClientId" placeholder="Vacío = Acceso rápido integrado" style="width:100%; background:#071526; border:1px solid rgba(148,163,184,0.3); border-radius:10px; padding:10px; color:#fff; font-size:13px; box-sizing:border-box;" value="${escapeHtml(savedGoogle)}">
          </div>

          <div style="margin-bottom:12px;">
            <label style="font-size:12.5px; color:#cbd5e1; font-weight:600; display:block; margin-bottom:4px;">
              <i class="fab fa-facebook" style="color:#1877f2;"></i> Facebook App ID (Opcional)
            </label>
            <input type="text" id="dmConfigFbAppId" placeholder="Vacío = Acceso rápido integrado" style="width:100%; background:#071526; border:1px solid rgba(148,163,184,0.3); border-radius:10px; padding:10px; color:#fff; font-size:13px; box-sizing:border-box;" value="${escapeHtml(savedFb)}">
          </div>

          <button type="submit" style="width:100%; background:linear-gradient(135deg,#0d9488,#0284c7); border:none; border-radius:12px; padding:12px; color:#fff; font-weight:700; cursor:pointer; font-size:14px; margin-top:8px;">
            Guardar Credenciales
          </button>
        </form>
      </div>
    `;

    modal.style.display = 'flex';
  };

  window.cerrarModalConfiguracionOAuth = function () {
    const modal = document.getElementById('dmConfigOAuthModal');
    if (modal) modal.style.display = 'none';
  };

  window.guardarConfiguracionOAuth = function (e) {
    if (e) e.preventDefault();
    const gId = (document.getElementById('dmConfigGoogleClientId')?.value || '').trim();
    const fbId = (document.getElementById('dmConfigFbAppId')?.value || '').trim();

    try {
      if (gId) localStorage.setItem('diamon_oauth_google_client_id', gId);
      else localStorage.removeItem('diamon_oauth_google_client_id');

      if (fbId) localStorage.setItem('diamon_oauth_fb_app_id', fbId);
      else localStorage.removeItem('diamon_oauth_fb_app_id');
    } catch (_) {}

    window.cerrarModalConfiguracionOAuth();
    const msgEl = document.getElementById('authStatusMsg');
    if (msgEl) {
      msgEl.innerHTML = `<i class="fas fa-check-circle"></i> Configuración OAuth guardada correctamente.`;
      msgEl.className = 'dm-status-msg show success';
      msgEl.style.display = 'block';
    }
  };
})();
