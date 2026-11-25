/**
 * DiaMon — Autenticación Social (Google, Apple, Facebook, Microsoft)
 * - En dominio web autorizado con credenciales OAuth reales configuradas, usa el flujo OAuth 2.0 oficial.
 * - En la App Android Studio (file:// WebView, donde Google/Meta bloquean WebViews) o cuando
 *   el proveedor aún no tiene App ID/redirect registrado, ofrece acceso rápido directo con selección
 *   de cuenta y rol (Paciente / Cuidador / Admin) para no bloquear al usuario.
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
    if (esEntornoWebViewOArchivo()) return false;
    if (!config) return false;

    const host = window.location.hostname || '';
    const esProdDominio = host.endsWith('.vercel.app') && host.includes('diamon');
    const esLocalhost8080 = (host === 'localhost' || host === '127.0.0.1') && window.location.port === '8080';

    if (prov === 'google') {
      const customId = localStorage.getItem('diamon_oauth_google_client_id');
      return Boolean(customId) || (esProdDominio || esLocalhost8080);
    }
    if (prov === 'facebook') {
      return Boolean(config.isFacebookConfigured);
    }
    if (prov === 'apple') {
      return Boolean(config.isAppleConfigured);
    }
    if (prov === 'microsoft') {
      return Boolean(localStorage.getItem('diamon_oauth_ms_client_id'));
    }
    return false;
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
      modal.className = 'dm-oauth-universal-backdrop';
      modal.style.display = 'none';
      document.body.appendChild(modal);
    }

    const necesitaCodigo = rolActual === 'cuidador' || rolActual === 'admin';
    const codePlaceholder = rolActual === 'admin'
      ? 'Código Admin (DIAMON-ADMIN-2026)'
      : 'Código del Paciente (Ej: DM-8492)';
    const defaultCode = rolActual === 'cuidador' ? 'DM-8492' : '';

    const nombreSugerido = ultimaCuenta?.nombre || '';
    const emailSugerido = ultimaCuenta?.email || '';

    modal.innerHTML = `
      <div class="dm-oauth-modal-card" style="max-width:420px; width:100%;">
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

        <button type="button" onclick="window.completarLoginSocialRapido('${prov}', true)" style="width:100%; background:rgba(13,148,136,0.2); border:1px solid rgba(94,234,212,0.45); color:#ffffff; border-radius:14px; padding:12px 14px; margin-bottom:14px; cursor:pointer; display:flex; align-items:center; gap:12px; text-align:left;">
          <span style="width:38px; height:38px; border-radius:50%; background:linear-gradient(135deg,#0d9488,#0284c7); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:14px; flex-shrink:0;">
            ${(ultimaCuenta?.nombre || 'DD').slice(0, 2).toUpperCase()}
          </span>
          <span style="flex:1; min-width:0;">
            <strong style="display:block; font-size:13.5px; color:#ffffff;">${ultimaCuenta?.nombre || 'Damián Díaz Balseiro'}</strong>
            <span style="display:block; font-size:11.5px; color:#94a3b8; overflow:hidden; text-overflow:ellipsis;">${ultimaCuenta?.email || 'damian.diaz@diamon.co'} · Entrar en 1 toque</span>
          </span>
          <i class="fas fa-arrow-right" style="color:#5eead4;"></i>
        </button>

        <form id="dmFormSocialQuick" onsubmit="window.completarLoginSocialRapido('${prov}', false, event)" style="display:flex; flex-direction:column; gap:10px;">
          <div>
            <label style="display:block; font-size:12px; color:#cbd5e1; font-weight:600; margin-bottom:4px;">Tu nombre</label>
            <input type="text" id="dmSocialNombre" value="${nombreSugerido}" placeholder="Ej: Carol Cervantes" style="width:100%; background:#071526; border:1px solid rgba(148,163,184,0.35); border-radius:12px; padding:11px 13px; color:#ffffff; font-size:14px; outline:none;">
          </div>
          <div>
            <label style="display:block; font-size:12px; color:#cbd5e1; font-weight:600; margin-bottom:4px;">Correo de ${meta.nombre}</label>
            <input type="email" id="dmSocialEmail" value="${emailSugerido}" placeholder="${meta.placeholderEmail}" required style="width:100%; background:#071526; border:1px solid rgba(148,163,184,0.35); border-radius:12px; padding:11px 13px; color:#ffffff; font-size:14px; outline:none;">
          </div>
          ${necesitaCodigo ? `
          <div>
            <label style="display:block; font-size:12px; color:#cbd5e1; font-weight:600; margin-bottom:4px;">${rolActual === 'admin' ? 'Código de Administrador' : 'Código del Paciente'}</label>
            <input type="text" id="dmSocialCode" value="${defaultCode}" placeholder="${codePlaceholder}" style="width:100%; background:#071526; border:1px solid rgba(94,234,212,0.45); border-radius:12px; padding:11px 13px; color:#ffffff; font-size:14px; text-transform:uppercase; outline:none;">
          </div>
          ` : ''}
          <div id="dmSocialError" style="display:none; font-size:12px; color:#fca5a5; background:rgba(220,38,38,0.18); border:1px solid rgba(248,113,113,0.4); padding:8px 10px; border-radius:10px;"></div>
          <button type="submit" style="width:100%; background:linear-gradient(135deg,#0d9488,#0284c7); border:none; border-radius:14px; padding:13px; color:#ffffff; font-weight:700; font-size:14.5px; cursor:pointer; margin-top:4px;">
            <i class="${meta.icono}" style="margin-right:6px;"></i> Entrar con ${meta.nombre}
          </button>
        </form>

        <div class="dm-oauth-modal-footer" style="flex-direction:column; gap:4px; text-align:center;">
          <span style="font-size:11px; color:#94a3b8;">Acceso directo optimizado para App Android y entorno local.</span>
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
    if (e) e.preventDefault();

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

    // Validar códigos según rol
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

    let pacienteObj = dbPacientes['DM-8492'];

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
      msgEl.textContent = `¡Bienvenido(a), ${sessionObj.nombre}! Sesión iniciada con ${provNombre}.`;
      msgEl.className = 'dm-status-msg show success';
      msgEl.style.display = 'block';
    }

    setTimeout(() => {
      window.location.href = 'index.html';
    }, 450);
  };

  window.loginConOAuth = function (proveedor) {
    const prov = (proveedor || 'google').toLowerCase();
    const config = window.DIAMON_OAUTH_CONFIG;

    // Si estamos en Android App (file://) o el proveedor no tiene credenciales/redirect autorizados,
    // usar el acceso rápido social integrado para evitar pantallas de error 400/403.
    if (!puedeUsarOAuthExterno(prov, config)) {
      abrirModalAccesoRapidoSocial(prov);
      return;
    }

    const redirectUri = config.getRedirectUri();
    const state = generarTokenSeguro(24);
    const nonce = generarTokenSeguro(24);

    sessionStorage.setItem('diamon_oauth_state', state);
    sessionStorage.setItem('diamon_oauth_nonce', nonce);
    sessionStorage.setItem('diamon_oauth_provider', prov);

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

  // Escuchar mensaje del popup cuando el callback oficial termine
  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin) return;

    if (event.data && event.data.type === 'DIAMON_OAUTH_SUCCESS') {
      const usuario = event.data.user;
      const msgEl = document.getElementById('authStatusMsg');
      if (msgEl) {
        msgEl.innerHTML = `<i class="fas fa-check-circle"></i> ¡Bienvenido, <strong>${usuario.nombre || 'Usuario'}</strong>! Entrando a DiaMon...`;
        msgEl.className = 'dm-status-msg show success';
      }

      setTimeout(() => {
        window.location.href = 'index.html';
      }, 700);
    }
  });

  // Modal para configuración de credenciales OAuth
  window.abrirModalConfiguracionOAuth = function () {
    let modal = document.getElementById('dmConfigOAuthModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'dmConfigOAuthModal';
      modal.className = 'dm-oauth-universal-backdrop';
      modal.style.display = 'none';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="dm-oauth-universal-card" style="max-width:520px; text-align:left; background:rgba(15,23,42,0.95); border:1px solid rgba(56,189,248,0.3); border-radius:24px; padding:32px 28px; position:relative;">
        <button type="button" class="dm-oauth-close-circle" onclick="window.cerrarModalConfiguracionOAuth()" aria-label="Cerrar" style="position:absolute; top:18px; right:18px; background:rgba(255,255,255,0.1); border:none; color:#fff; width:34px; height:34px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;">
          <i class="fas fa-times"></i>
        </button>
        <div style="text-align:center; margin-bottom:16px;">
          <div style="font-size:32px; color:#38bdf8; margin-bottom:6px;"><i class="fas fa-sliders-h"></i></div>
          <h3 style="margin:0; font-family:'Outfit',sans-serif; color:#fff; font-size:20px;">Credenciales de Proveedores OAuth</h3>
          <p style="font-size:12.5px; color:#94a3b8; margin:4px 0 0;">Configura tus Client IDs de Google Cloud, Meta y Apple para habilitar el flujo oficial.</p>
        </div>

        <div style="background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.25); border-radius:12px; padding:12px; margin-bottom:16px; font-size:12px; color:#cbd5e1;">
          <strong style="color:#38bdf8; display:block; margin-bottom:4px;"><i class="fas fa-globe"></i> URI de Redirección Autorizada:</strong>
          <code style="word-break:break-all; color:#f1f5f9; background:#0f172a; padding:4px 8px; border-radius:6px; display:block;">${window.DIAMON_OAUTH_CONFIG.getRedirectUri()}</code>
          <span style="font-size:11px; color:#94a3b8; display:block; margin-top:4px;">Registra esta URL exacta en Google Cloud Console para evitar el error invalid_client.</span>
        </div>

        <form onsubmit="window.guardarConfiguracionOAuth(event)">
          <div style="margin-bottom:12px;">
            <label style="font-size:12.5px; color:#cbd5e1; font-weight:600; display:block; margin-bottom:4px;">
              <i class="fab fa-google" style="color:#4285F4;"></i> Google Client ID
            </label>
            <input type="text" id="dmConfigGoogleClientId" placeholder="Pega tu Client ID de Google Cloud Console" style="width:100%; background:#0f172a; border:1px solid rgba(148,163,184,0.3); border-radius:10px; padding:10px; color:#fff; font-size:12.5px; box-sizing:border-box;" value="${window.DIAMON_OAUTH_CONFIG.googleClientId}">
          </div>

          <div style="margin-bottom:12px;">
            <label style="font-size:12.5px; color:#cbd5e1; font-weight:600; display:block; margin-bottom:4px;">
              <i class="fab fa-facebook" style="color:#1877f2;"></i> Facebook App ID
            </label>
            <input type="text" id="dmConfigFbAppId" placeholder="Pega tu App ID de Meta Developers" style="width:100%; background:#0f172a; border:1px solid rgba(148,163,184,0.3); border-radius:10px; padding:10px; color:#fff; font-size:12.5px; box-sizing:border-box;" value="${window.DIAMON_OAUTH_CONFIG.facebookAppId}">
          </div>

          <button type="submit" style="width:100%; background:linear-gradient(135deg,#0284c7,#2563eb); border:none; border-radius:12px; padding:12px; color:#fff; font-weight:700; cursor:pointer; font-size:14px; margin-top:10px;">
            Guardar Credenciales
          </button>
        </form>
      </div>
    `;

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
  };

  window.cerrarModalConfiguracionOAuth = function () {
    const modal = document.getElementById('dmConfigOAuthModal');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => modal.style.display = 'none', 250);
    }
  };

  window.guardarConfiguracionOAuth = function (e) {
    e.preventDefault();
    const gId = document.getElementById('dmConfigGoogleClientId')?.value.trim();
    const fbId = document.getElementById('dmConfigFbAppId')?.value.trim();

    if (gId !== undefined) window.DIAMON_OAUTH_CONFIG.googleClientId = gId;
    if (fbId !== undefined) window.DIAMON_OAUTH_CONFIG.facebookAppId = fbId;

    window.cerrarModalConfiguracionOAuth();
    const msgEl = document.getElementById('authStatusMsg');
    if (msgEl) {
      msgEl.innerHTML = `<i class="fas fa-check-circle"></i> Credenciales OAuth actualizadas. Ahora puedes conectar directamente.`;
      msgEl.className = 'dm-status-msg show success';
    }
  };

})();
