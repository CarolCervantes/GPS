/**
 * DiaMon — Autenticación Oficial OAuth 2.0 & OpenID Connect
 * Redirección y ventanas emergentes oficiales a los proveedores (Google, Facebook, Apple)
 * CERO formularios simulados o réplicas manuales.
 */
(function () {
  'use strict';

  function generarTokenSeguro(longitud = 24) {
    const array = new Uint8Array(longitud);
    (window.crypto || window.msCrypto).getRandomValues(array);
    return Array.from(array, byte => ('0' + byte.toString(16)).slice(-2)).join('');
  }

  window.loginConOAuth = function (proveedor) {
    const prov = (proveedor || 'google').toLowerCase();
    const config = window.DIAMON_OAUTH_CONFIG;
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
      authUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?' +
        `client_id=d3590ed6-52b3-4102-aeff-aad2292ab01c&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=id_token&` +
        `scope=${encodeURIComponent('openid profile email')}&` +
        `state=${encodeURIComponent(state)}&` +
        `nonce=${encodeURIComponent(nonce)}&` +
        `prompt=select_account`;
    }

    if (!authUrl) return;

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
