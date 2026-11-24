/**
 * DiaMon — Configuración Central de Proveedores OAuth 2.0 / OpenID Connect
 * Permite autenticación oficial con Google, Facebook y Apple.
 */
(function() {
  'use strict';

  // Client ID oficial de Google Cloud Console para DiaMon Salud
  const OFFICIAL_GOOGLE_CLIENT_ID = '996609470554-unnot3vpbhtkco29k8ghks02pkkn6i59.apps.googleusercontent.com';

  window.DIAMON_OAUTH_CONFIG = {
    get googleClientId() {
      return localStorage.getItem('diamon_oauth_google_client_id') || OFFICIAL_GOOGLE_CLIENT_ID;
    },
    set googleClientId(val) {
      if (val) localStorage.setItem('diamon_oauth_google_client_id', val.trim());
    },

    get facebookAppId() {
      return localStorage.getItem('diamon_oauth_fb_app_id') || '';
    },
    set facebookAppId(val) {
      if (val) localStorage.setItem('diamon_oauth_fb_app_id', val.trim());
    },

    get appleClientId() {
      return localStorage.getItem('diamon_oauth_apple_client_id') || '';
    },
    set appleClientId(val) {
      if (val) localStorage.setItem('diamon_oauth_apple_client_id', val.trim());
    },

    get isGoogleConfigured() {
      return true;
    },

    get isFacebookConfigured() {
      const id = this.facebookAppId;
      return Boolean(id && !id.includes('1084920482910384'));
    },

    get isAppleConfigured() {
      const id = this.appleClientId;
      return Boolean(id && !id.includes('co.diamon.salud.client'));
    },

    /**
     * Retorna la URI oficial de redirección basada en el origen actual.
     * Soporta localhost:8080, diamon-salud.vercel.app y cualquier dominio de despliegue.
     */
    getRedirectUri: function() {
      const origin = window.location.origin;
      const pathname = window.location.pathname;
      const basePath = pathname.substring(0, pathname.lastIndexOf('/') + 1);
      return `${origin}${basePath}oauth-callback.html`;
    }
  };

})();
