/**
 * DiaMon — Dashboard Controller Profesional
 * 1. Navegación por pestañas SPA con redibujado garantizado de mapas (Leaflet invalidateSize)
 * 2. Reloj en vivo y calendario dinámico
 * 3. Gestión reactiva de sesión (Invitado vs Usuario vs Admin)
 * 4. Control de Modales (Autenticación y Políticas Legales)
 * 5. Banner de Consentimiento de Cookies (Habeas Data & GDPR)
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    initLiveClock();
    initTabNavigation();
    initKPISync();
    initSessionState();
    initCookieConsent();
    initAccessibleModals();
  });

  // ============================================================
  // 1. RELOJ Y FECHA EN TIEMPO REAL
  // ============================================================
  function initLiveClock() {
    const clockEl = document.getElementById('dcLiveClock');
    const dateEl = document.getElementById('dcLiveDate');

    function update() {
      const now = new Date();
      if (clockEl) {
        clockEl.textContent = now.toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
      }
      if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('es-CO', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }
    }

    update();
    setInterval(update, 1000);
  }

  // ============================================================
  // 2. NAVEGACIÓN SPA Y REDIBUJADO DE MAPAS (Leaflet InvalidateSize)
  // ============================================================
  function initTabNavigation() {
    const navItems = document.querySelectorAll('[data-dc-tab]');
    const views = document.querySelectorAll('.dc-view');

    window.switchView = function (targetTab) {
      // Activar botón del sidebar
      // Actualizar estado en sidebar desktop y en barra móvil
      navItems.forEach(item => {
        if (item.getAttribute('data-dc-tab') === targetTab) {
          item.classList.add('active');
          item.setAttribute('aria-current', 'page');
        } else {
          item.classList.remove('active');
          item.removeAttribute('aria-current');
        }
      });

      document.querySelectorAll('.dc-mob-nav-btn').forEach(mItem => {
        if (mItem.getAttribute('data-dc-tab') === targetTab) {
          mItem.classList.add('active');
        } else {
          mItem.classList.remove('active');
        }
      });

      // Conmutar vista
      views.forEach(view => {
        if (view.id === `view-${targetTab}`) {
          view.classList.add('active');
        } else {
          view.classList.remove('active');
        }
      });

      // CORRECCIÓN CRÍTICA DE MAPAS EN VISTAS OCULTAS
      // Forzar recálculo dimensional de Leaflet para evitar recuadros negros/grises
      const invalidarMapas = () => {
        if (window.mapInstance && typeof window.mapInstance.invalidateSize === 'function') {
          window.mapInstance.invalidateSize();
        }
        if (window.historyMapInstance && typeof window.historyMapInstance.invalidateSize === 'function') {
          window.historyMapInstance.invalidateSize();
        }
        window.dispatchEvent(new Event('resize'));
      };

      // Disparar en cascada mientras transiciona la vista
      setTimeout(invalidarMapas, 60);
      setTimeout(invalidarMapas, 200);
      setTimeout(invalidarMapas, 450);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    navItems.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = btn.getAttribute('data-dc-tab');
        if (tab) window.switchView(tab);
      });
    });

    document.querySelectorAll('.dc-mob-nav-btn').forEach(mBtn => {
      mBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = mBtn.getAttribute('data-dc-tab');
        if (tab) window.switchView(tab);
      });
    });

    document.querySelectorAll('.dc-back-btn').forEach(backBtn => {
      backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.switchView('inicio');
      });
    });
  }

  // ============================================================
  // 3. SINCRONIZACIÓN DE KPIS EN TIEMPO REAL
  // ============================================================
  function initKPISync() {
    const targetNode = document.getElementById('glucoseValue') || document.getElementById('liveGlucose');
    const kpiGlucVal = document.getElementById('kpiGlucoseVal');

    if (targetNode && kpiGlucVal) {
      const observer = new MutationObserver(() => {
        const txt = targetNode.textContent.trim();
        if (txt && txt !== '—') {
          kpiGlucVal.textContent = txt + ' mg/dL';
        }
      });
      observer.observe(targetNode, { childList: true, characterData: true, subtree: true });
    }
  }

  // Formateador inteligente de nombres humanos
  function formatearNombreHumano(nombreOEmail) {
    if (!nombreOEmail) return { primerNombre: 'Usuario', nombreCompleto: 'Usuario DiaMon', iniciales: 'DM' };
    
    let str = String(nombreOEmail).trim();
    if (str.includes('@')) {
      str = str.split('@')[0];
    }

    const lower = str.toLowerCase();
    if (lower.includes('erickdejesustorres') || lower.includes('ericktorres') || lower.includes('erickdejesus')) {
      return {
        primerNombre: 'Erick',
        nombreCompleto: 'Erick de Jesús Torres',
        iniciales: 'ET'
      };
    }

    // Limpiar dígitos al final (ej: erick02 -> erick)
    let clean = str.replace(/\d+$/g, '');
    clean = clean.replace(/[._-]+/g, ' ');
    clean = clean.replace(/([a-z])([A-Z])/g, '$1 $2');

    const palabras = clean.split(' ').map(p => p.trim()).filter(Boolean);
    if (palabras.length === 0) return { primerNombre: 'Usuario', nombreCompleto: 'Usuario', iniciales: 'U' };

    const palabrasCap = palabras.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    const nombreCompleto = palabrasCap.join(' ');
    const primerNombre = palabrasCap[0];
    const iniciales = palabrasCap.length > 1 
      ? (palabrasCap[0][0] + palabrasCap[palabrasCap.length - 1][0]).toUpperCase()
      : palabrasCap[0].slice(0, 2).toUpperCase();

    return { primerNombre, nombreCompleto, iniciales };
  }

  // ============================================================
  // 4. ESTADO DE SESIÓN (Invitado vs Usuario Autenticado)
  // ============================================================
  async function initSessionState() {
    const greetingTitle = document.getElementById('dcWelcomeGreeting');
    const greetingSubtitle = document.getElementById('dcWelcomeSubtitle');
    const sidebarName = document.getElementById('sidebarUserName');
    const sidebarRole = document.getElementById('sidebarUserRole');
    const sidebarAuthAction = document.getElementById('sidebarAuthAction');
    const guestNoticeMeds = document.getElementById('guestNoticeMeds');
    const guestNoticeReport = document.getElementById('guestNoticeReport');

    let currentUser = null;

    try {
      if (window.supabaseClient && window.supabaseClient.auth) {
        const { data } = await window.supabaseClient.auth.getUser();
        currentUser = data?.user || null;
      }
    } catch (_) {}

    // Modo Demo local si se guardó en sessionStorage o localStorage
    const localDemoSession = sessionStorage.getItem('diamon_demo_user') || localStorage.getItem('diamon_current_user');
    if (!currentUser && localDemoSession) {
      try {
        currentUser = JSON.parse(localDemoSession);
      } catch (_) {}
    }

    if (!currentUser) {
      window.location.replace('login.html');
      return;
    } else {
      // USUARIO / CUIDADOR / ADMIN AUTENTICADO
      const rawNombre = currentUser.nombre || currentUser.email || 'Usuario';
      const { primerNombre, nombreCompleto, iniciales } = formatearNombreHumano(rawNombre);
      const esAdmin = currentUser.rol === 'admin';
      const esCuidador = currentUser.rol === 'cuidador';
      const esSupervisor = esAdmin || esCuidador;
      const paciente = currentUser.pacienteVinculado || null;

      // Foto de perfil oficial (Google Avatar / Proveedor OAuth) o Iniciales
      const fotoUrl = currentUser.foto || currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || currentUser.picture || null;
      const sidebarAvatar = document.getElementById('sidebarAvatar');
      const userAvatarBtn = document.getElementById('userAvatarBtn');

      if (fotoUrl) {
        if (sidebarAvatar) {
          sidebarAvatar.innerHTML = `<img src="${fotoUrl}" alt="${nombreCompleto}" style="width:100%; height:100%; border-radius:50%; object-fit:cover; border:2px solid var(--dc-primary);">`;
        }
        if (userAvatarBtn) {
          userAvatarBtn.innerHTML = `<img src="${fotoUrl}" alt="${nombreCompleto}" style="width:34px; height:34px; border-radius:50%; object-fit:cover; border:2px solid var(--dc-primary); box-shadow:0 0 10px rgba(37,99,235,0.4);">`;
        }
      } else {
        if (sidebarAvatar) {
          sidebarAvatar.innerHTML = `<span style="font-size:14px; font-weight:700; color:#ffffff;">${iniciales}</span>`;
        }
        if (userAvatarBtn) {
          userAvatarBtn.innerHTML = `<span style="display:flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg, #1d4ed8, #3b82f6); color:#ffffff; font-size:12px; font-weight:700; border:2px solid var(--dc-primary);">${iniciales}</span>`;
        }
      }

      if (greetingTitle) {
        greetingTitle.innerHTML = `Hola, <span id="headerUserName">${primerNombre}</span> 👋`;
      }

      if (greetingSubtitle) {
        if (esSupervisor && paciente) {
          const pacNombre = typeof paciente === 'object' ? paciente.nombre : 'Damián Díaz Balseiro';
          const pacCod = typeof paciente === 'object' ? paciente.codigoPaciente : paciente;
          const etiquetaRol = esAdmin ? 'Modo Administrador · Supervisando a:' : 'Cuidador Vinculado a:';
          greetingSubtitle.innerHTML = `${etiquetaRol} <strong>${pacNombre}</strong> · Código Único: <strong style="color:var(--dc-primary); background:var(--dc-primary-light); padding:2px 8px; border-radius:6px; font-family:monospace;">${pacCod}</strong>`;
          
          // Reflejar datos de telemetría específicos del paciente vinculado
          if (typeof paciente === 'object') {
            const kpiG = document.getElementById('kpiGlucoseVal');
            const kpiU = document.getElementById('kpiUbicacionVal');
            const kpiP = document.getElementById('kpiPasosVal');
            if (kpiG && paciente.glucosa) kpiG.textContent = paciente.glucosa + ' mg/dL';
            if (kpiU && paciente.ubicacion && (!window.TelemetriaDiaMon || !window.TelemetriaDiaMon.gpsFijado)) {
              kpiU.textContent = paciente.ubicacion;
            }
            if (kpiP && typeof paciente.pasos === 'number' && paciente.pasos > 0) {
              kpiP.textContent = paciente.pasos.toLocaleString();
            }
          }
        } else if (!esSupervisor && currentUser.codigoPaciente) {
          greetingSubtitle.innerHTML = `Paciente del Caso de Estudio · Código Único: <strong style="color:var(--dc-primary); background:var(--dc-primary-light); padding:2px 8px; border-radius:6px; font-family:monospace;">${currentUser.codigoPaciente}</strong> · Barrio Chapacuá`;
        } else {
          greetingSubtitle.textContent = 'Monitoreo clínico en tiempo real · Barrio Chapacuá, Cartagena de Indias.';
        }
      }

      if (sidebarName) sidebarName.textContent = nombreCompleto;
      if (sidebarRole) {
        if (esAdmin) {
          sidebarRole.innerHTML = `Administrador · <a href="admin.html" style="color:#5eead4; text-decoration:underline;">Panel Admin</a>`;
        } else if (esCuidador) {
          const pacCod = typeof paciente === 'object' ? paciente.codigoPaciente : (paciente || 'DM-8492');
          sidebarRole.textContent = `Cuidador (${pacCod})`;
        } else {
          sidebarRole.textContent = `Paciente (${currentUser.codigoPaciente || 'DM-8492'})`;
        }
      }
      if (sidebarAuthAction) {
        sidebarAuthAction.innerHTML = `
          <button class="dc-profile-logout" onclick="window.cerrarSesionDiaMon()" title="Cerrar sesión" aria-label="Cerrar sesión">
            <i class="fas fa-sign-out-alt"></i>
          </button>
        `;
      }
      if (guestNoticeMeds) guestNoticeMeds.style.display = 'none';
      if (guestNoticeReport) guestNoticeReport.style.display = 'none';
    }

    window.actualizarInterfazUsuario = initSessionState;

    window.cerrarSesionDiaMon = async function () {
      sessionStorage.removeItem('diamon_demo_user');
      localStorage.removeItem('diamon_current_user');
      if (window.supabaseClient && window.supabaseClient.auth) {
        try { await window.supabaseClient.auth.signOut(); } catch (_) {}
      }
      window.location.href = 'login.html';
    };

    window.iniciarDemoDiaMon = function (rol = 'usuario') {
      const demoUser = rol === 'admin'
        ? { id: 'admin-demo', nombre: 'Dra. María Martínez', email: 'admin@diamon.co', rol: 'admin' }
        : { id: 'familiar-demo', nombre: 'Carlos Mendoza', email: 'familiar@diamon.co', rol: 'usuario' };
      
      sessionStorage.setItem('diamon_demo_user', JSON.stringify(demoUser));
      window.cerrarModalAuth();
      initSessionState();
    };
  }

  // ============================================================
  // 5. MODALES ACCESIBLES (Auth & Legal)
  // ============================================================
  function initAccessibleModals() {
    const authModal = document.getElementById('dcAuthModal');
    const legalModal = document.getElementById('dcLegalModal');

    window.abrirModalAuth = function() { window.location.href = 'login.html'; };

    window.cerrarModalAuth = function () {
      if (!authModal) return;
      authModal.style.display = 'none';
      authModal.setAttribute('aria-hidden', 'true');
    };

    window.abrirModalLegal = function (seccion = 'privacidad') {
      if (!legalModal) return;
      legalModal.style.display = 'flex';
      legalModal.setAttribute('aria-hidden', 'false');
      window.switchLegalTab(seccion);
    };

    window.cerrarModalLegal = function () {
      if (!legalModal) return;
      legalModal.style.display = 'none';
      legalModal.setAttribute('aria-hidden', 'true');
    };

    // Pestañas de Auth
    window.switchAuthTab = function (tab) {
      const loginTabBtn = document.getElementById('tabBtnLogin');
      const regTabBtn = document.getElementById('tabBtnRegister');
      const formLogin = document.getElementById('modalFormLogin');
      const formReg = document.getElementById('modalFormRegister');

      if (tab === 'login') {
        loginTabBtn?.classList.add('active');
        regTabBtn?.classList.remove('active');
        if (formLogin) formLogin.style.display = 'block';
        if (formReg) formReg.style.display = 'none';
      } else {
        regTabBtn?.classList.add('active');
        loginTabBtn?.classList.remove('active');
        if (formLogin) formLogin.style.display = 'none';
        if (formReg) formReg.style.display = 'block';
      }
    };

    // Pestañas Legales
    window.switchLegalTab = function (seccion) {
      document.querySelectorAll('.dc-legal-nav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.legalTab === seccion);
      });
      document.querySelectorAll('.dc-legal-pane').forEach(p => {
        p.classList.toggle('active', p.id === `legal-pane-${seccion}`);
      });
    };

    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.cerrarModalAuth();
        window.cerrarModalLegal();
      }
    });
  }

  // ============================================================
  // 6. CONSENTIMIENTO DE COOKIES & ANALÍTICA (Habeas Data)
  // ============================================================
  function initCookieConsent() {
    const banner = document.getElementById('dcCookieBanner');
    if (!banner) return;

    const consent = localStorage.getItem('diamon_cookie_consent');
    if (!consent) {
      setTimeout(() => {
        banner.style.display = 'flex';
      }, 500);
    }

    window.guardarConsentimientoCookies = function (tipo) {
      localStorage.setItem('diamon_cookie_consent', tipo);
      banner.style.display = 'none';
    };
  }

})();

