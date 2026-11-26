// Controlador principal del dashboard (navegacion, reloj y estado de sesion por rol)
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    // En la app el mapa en vivo se pasa a la seccion Mapa para que el inicio quede mas corto
    if (document.documentElement.classList.contains('dm-en-app')) {
      const tarjetaMapa = document.getElementById('map') && document.getElementById('map').closest('.dc-card');
      const vistaMapa = document.querySelector('#view-mapa .dc-view-header');
      if (tarjetaMapa && vistaMapa) vistaMapa.after(tarjetaMapa);
    }
    initLiveClock();
    initTabNavigation();
    initKPISync();
    initSessionState();
    initCookieConsent();
    initAccessibleModals();
  });

  // Reloj y fecha en tiempo real
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

  // 2. NAVEGACIÓN SPA Y REDIBUJADO DE MAPAS (Leaflet InvalidateSize)
  function initTabNavigation() {
    const navItems = document.querySelectorAll('[data-dc-tab]');
    const views = document.querySelectorAll('.dc-view');

    // Menu lateral en la web del celular: se abre con las 3 rayitas y se cierra al elegir una seccion
    const btnMenu = document.getElementById('dcMenuBtn');
    const veloMenu = document.getElementById('dcMenuVelo');
    function menuLateral(abrir) {
      document.body.classList.toggle('dc-menu-abierto', abrir);
      if (btnMenu) btnMenu.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    }
    if (btnMenu) btnMenu.addEventListener('click', () => menuLateral(!document.body.classList.contains('dc-menu-abierto')));
    if (veloMenu) veloMenu.addEventListener('click', () => menuLateral(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menuLateral(false); });

    window.switchView = function (targetTab) {
      menuLateral(false);
      // Normalizar tab: si se solicita 'medicamentos', redirigir a la vista 'salud'
      if (targetTab === 'medicamentos') targetTab = 'salud';
      targetTab = vistaPermitida(targetTab);
      cargarPaginaEmbebida(targetTab);
      window.scrollTo(0, 0);  // cada seccion se abre desde arriba
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

      // Corrección crítica de mapas en vistas ocultas
      // Forzar recálculo dimensional de Leaflet para evitar recuadros negros/grises
      const invalidarMapas = () => {
        if (window.liveMapInstance) window.liveMapInstance.invalidateSize();
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

  // Sincronización de KPIs en tiempo real
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

  // Arma el nombre que se muestra a partir del nombre o del correo
  function formatearNombreHumano(nombreOEmail) {
    if (!nombreOEmail) return { primerNombre: 'Usuario', nombreCompleto: 'Usuario DiaMon', iniciales: 'DM' };
    
    let str = String(nombreOEmail).trim();
    if (str.includes('@')) {
      str = str.split('@')[0];
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

  // 4. ESTADO DE SESIÓN (Invitado vs Usuario Autenticado)
  // Muestra el aviso del inicio cuando no hay paciente (invitado o admin sin vincular)
  // y esconde los datos clinicos para no mostrar a un paciente que no corresponde.
  function mostrarAvisoSinPaciente(usuario, paciente) {
    const sinPaciente = !paciente;
    document.body.classList.toggle('dm-sin-paciente', sinPaciente);

    const aviso = document.getElementById('dmAvisoSinPaciente');
    if (!aviso) return;
    aviso.style.display = sinPaciente ? 'block' : 'none';
    if (!sinPaciente) return;

    const titulo = document.getElementById('dmAvisoSinPacienteTitulo');
    const texto = document.getElementById('dmAvisoSinPacienteTexto');
    const botones = document.getElementById('dmAvisoSinPacienteBotones');
    const rol = window.DiaMonSesion.rolDe(usuario);
    const estiloBtn = 'border:none; border-radius:10px; padding:10px 16px; font-weight:700; cursor:pointer; text-decoration:none; color:#fff; background:linear-gradient(135deg, #0d9488, #0284c7);';

    if (rol === 'invitado') {
      titulo.textContent = 'Inicia sesión para ver el monitoreo';
      texto.textContent = 'Los datos de salud y la ubicación solo los ven la persona monitoreada y su cuidador.';
      botones.innerHTML = `<a href="login.html" style="${estiloBtn}"><i class="fas fa-sign-in-alt"></i> Iniciar sesión o crear cuenta</a>`;
    } else {
      titulo.textContent = rol === 'admin' ? 'Aún no supervisas a ningún paciente' : 'Aún no tienes un paciente vinculado';
      texto.textContent = 'Pídele al paciente su código (DM-XXXX) y vincúlalo para ver su glucosa, presión y ubicación.';
      botones.innerHTML = `<button type="button" style="${estiloBtn}" onclick="window.abrirModalPerfil(); setTimeout(() => window.mostrarVistaFamiliares(), 200);"><i class="fas fa-user-plus"></i> Vincular paciente</button>` +
        (rol === 'admin' ? ` <a href="admin.html" style="${estiloBtn} background:#0f172a;"><i class="fas fa-user-shield"></i> Panel de administración</a>` : '');
    }
  }

  // Secciones que solo tienen sentido si hay un paciente activo
  const VISTAS_CON_DATOS_PACIENTE = ['mapa', 'salud', 'reportes', 'alertas', 'zonas'];

  // Revisa si el usuario puede ver la seccion pedida, si no lo manda al inicio
  function vistaPermitida(tab) {
    const rol = window.DiaMonSesion.rolDe(window.DiaMonSesion.leerUsuario());
    const sinPaciente = document.body.classList.contains('dm-sin-paciente');
    if (rol === 'invitado' && ['seguridad', 'perfil', 'zonas', 'admin'].includes(tab)) return 'inicio';
    if (sinPaciente && VISTAS_CON_DATOS_PACIENTE.includes(tab)) return 'inicio';
    if (tab === 'admin' && rol !== 'admin') return 'inicio';
    if (tab === 'zonas' && rol !== 'admin' && rol !== 'cuidador') return 'inicio';
    return tab;
  }

  // Perfil, zonas y admin son las paginas de antes cargadas dentro del panel.
  // El iframe se carga la primera vez que se abre la seccion y se ajusta a su alto.
  function cargarPaginaEmbebida(tab) {
    const frame = document.querySelector(`#view-${tab} iframe.dm-pagina-embebida`);
    if (!frame) return;
    if (!frame.src) {
      frame.src = frame.dataset.src;
      const ajustarAlto = () => {
        try {
          const alto = frame.contentDocument.documentElement.scrollHeight;
          if (alto > 0) frame.style.height = alto + 'px';
        } catch (_) {}
      };
      frame.addEventListener('load', ajustarAlto);
      // El contenido cambia despues de cargar (Supabase, mapa), por eso se revisa seguido
      setInterval(ajustarAlto, 800);
    } else {
      // Al volver a abrirla se recarga para que muestre datos nuevos
      try { frame.contentWindow.location.reload(); } catch (_) {}
    }
  }

  async function initSessionState() {
    const greetingTitle = document.getElementById('dcWelcomeGreeting');
    const greetingSubtitle = document.getElementById('dcWelcomeSubtitle');
    const sidebarName = document.getElementById('sidebarUserName');
    const sidebarRole = document.getElementById('sidebarUserRole');
    const sidebarAuthAction = document.getElementById('sidebarAuthAction');
    const guestNoticeMeds = document.getElementById('guestNoticeMeds');
    const guestNoticeReport = document.getElementById('guestNoticeReport');

    // La sesion sale de Supabase. Si cambio el paciente que se mira (por ejemplo, el cuidador
    // vinculo uno nuevo en otro equipo), se recarga para que todo muestre al paciente correcto.
    const antes = window.DiaMonSesion.leerUsuario();
    let currentUser = null;
    try {
      currentUser = await window.DiaMonSesion.iniciarDesdeSupabase();
    } catch (_) {
      currentUser = antes; // sin internet se usa la ultima copia
    }
    const codAntes = antes && antes.pacienteVinculado ? antes.pacienteVinculado.codigoPaciente : null;
    const codAhora = currentUser && currentUser.pacienteVinculado ? currentUser.pacienteVinculado.codigoPaciente : null;
    if (codAntes !== codAhora && !sessionStorage.getItem('diamon_recargado')) {
      sessionStorage.setItem('diamon_recargado', '1');
      window.location.reload();
      return;
    }
    sessionStorage.removeItem('diamon_recargado');
    const pacienteActual = window.DiaMonSesion.pacienteActivo(currentUser);
    mostrarAvisoSinPaciente(currentUser, pacienteActual);
    // Clase del rol en el body para mostrar u ocultar opciones con CSS
    const rolBody = window.DiaMonSesion.rolDe(currentUser);
    ['invitado', 'usuario', 'cuidador', 'admin'].forEach(r => document.body.classList.toggle('dm-rol-' + r, r === rolBody));

    const btnMetasMedicoHeader = document.getElementById('btnMetasMedicoHeader');
    const btnConfigGeocercaBanner = document.getElementById('btnConfigGeocercaBanner');
    const btnMisMonitoreadosBanner = document.getElementById('btnMisMonitoreadosBanner');
    const btnPanelAdminBanner = document.getElementById('btnPanelAdminBanner');
    const badgeRolBanner = document.getElementById('badgeRolBanner');
    const casoPacienteNombre = document.getElementById('casoPacienteNombre');

    if (!currentUser) {
      // Estado invitado en la web
      if (greetingTitle) {
        greetingTitle.innerHTML = 'Bienvenido a <span style="color:var(--dc-primary);">DiaMon</span> 👋';
      }
      if (greetingSubtitle) {
        greetingSubtitle.innerHTML = 'Modo Invitado · Inicia sesión o crea tu cuenta como Paciente, Cuidador o Admin.';
      }
      if (sidebarName) sidebarName.textContent = 'Modo Invitado';
      if (sidebarRole) sidebarRole.textContent = 'Sin iniciar sesión';
      if (sidebarAuthAction) {
        sidebarAuthAction.innerHTML = `
          <button class="dc-btn-login-quick" onclick="window.location.href='login.html'" aria-label="Iniciar sesión en DiaMon">
            <i class="fas fa-sign-in-alt"></i> Iniciar sesión
          </button>
        `;
      }
      if (guestNoticeMeds) guestNoticeMeds.style.display = 'block';
      if (guestNoticeReport) guestNoticeReport.style.display = 'block';
    } else {
      // Usuario autenticado (Paciente, Cuidador o Admin)
      const rawNombre = currentUser.nombre || currentUser.email || 'Usuario';
      const { primerNombre, nombreCompleto, iniciales } = formatearNombreHumano(rawNombre);
      const rolActual = window.DiaMonSesion.rolDe(currentUser);
      const esAdmin = rolActual === 'admin';
      const esCuidador = rolActual === 'cuidador';
      const esPaciente = !esAdmin && !esCuidador;
      const esSupervisor = esAdmin || esCuidador;
      const paciente = pacienteActual;
      const codigoPropio = (paciente && paciente.codigoPaciente) || currentUser.codigoPaciente || '—';

      // Foto o iniciales del usuario
      const fotoUrl = currentUser.foto || currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || currentUser.picture || null;
      const sidebarAvatar = document.getElementById('sidebarAvatar');
      const userAvatarBtn = document.getElementById('userAvatarBtn');

      if (fotoUrl) {
        if (sidebarAvatar) {
          sidebarAvatar.innerHTML = `<img src="${fotoUrl}" alt="${nombreCompleto}" style="width:100%; height:100%; border-radius:50%; object-fit:cover; border:2px solid var(--dc-primary);">`;
        }
        if (userAvatarBtn) {
          userAvatarBtn.innerHTML = `<img src="${fotoUrl}" alt="${nombreCompleto}" style="width:34px; height:34px; border-radius:50%; object-fit:cover; border:2px solid var(--dc-primary); box-shadow:0 0 10px rgba(13,148,136,0.4);">`;
        }
      } else {
        if (sidebarAvatar) {
          sidebarAvatar.innerHTML = `<span style="font-size:14px; font-weight:700; color:#ffffff;">${iniciales}</span>`;
        }
        if (userAvatarBtn) {
          userAvatarBtn.innerHTML = `<span style="display:flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:50%; background:linear-gradient(135deg, #0d9488, #0284c7); color:#ffffff; font-size:12px; font-weight:700; border:2px solid var(--dc-primary);">${iniciales}</span>`;
        }
      }

      if (greetingTitle) {
        greetingTitle.innerHTML = `Hola, <span id="headerUserName">${primerNombre}</span> 👋`;
      }

      // Ajustar interfaz segun el rol para que Paciente sea mas simplificada y distinta de Cuidador y Admin
      if (esPaciente) {
        if (btnMetasMedicoHeader) btnMetasMedicoHeader.style.display = 'none';
        if (btnConfigGeocercaBanner) btnConfigGeocercaBanner.style.display = 'none';
        if (btnMisMonitoreadosBanner) btnMisMonitoreadosBanner.style.display = 'none';
        if (btnPanelAdminBanner) btnPanelAdminBanner.style.display = 'none';
        if (badgeRolBanner) {
          badgeRolBanner.innerHTML = `<i class="fas fa-user-check"></i> Panel del Paciente Monitoreado · Código: ${codigoPropio}`;
        }
        if (casoPacienteNombre) {
          casoPacienteNombre.textContent = `${nombreCompleto} · Código para tu Cuidador: ${codigoPropio}`;
        }
        if (window.casoEstudio && window.casoEstudio.paciente && codigoPropio !== 'DM-8492') {
          window.casoEstudio.paciente.nombre = nombreCompleto;
          window.casoEstudio.paciente.codigoPaciente = codigoPropio;
        }
      } else if (esCuidador) {
        if (btnMetasMedicoHeader) btnMetasMedicoHeader.style.display = 'inline-flex';
        if (btnConfigGeocercaBanner) btnConfigGeocercaBanner.style.display = 'inline-flex';
        if (btnMisMonitoreadosBanner) btnMisMonitoreadosBanner.style.display = 'inline-flex';
        if (btnPanelAdminBanner) btnPanelAdminBanner.style.display = 'none';
        const pacNombre = (paciente && paciente.nombre) ? paciente.nombre : 'Sin paciente';
        const totalVinc = Array.isArray(currentUser.pacientesVinculados) ? currentUser.pacientesVinculados.length : 1;
        if (badgeRolBanner) {
          badgeRolBanner.innerHTML = `<i class="fas fa-user-nurse"></i> Panel del Cuidador · ${totalVinc} Monitoreado(s)`;
        }
        if (casoPacienteNombre) {
          casoPacienteNombre.textContent = `Supervisando a: ${pacNombre} (${codigoPropio})`;
        }
      } else if (esAdmin) {
        if (btnMetasMedicoHeader) btnMetasMedicoHeader.style.display = 'inline-flex';
        if (btnConfigGeocercaBanner) btnConfigGeocercaBanner.style.display = 'inline-flex';
        if (btnMisMonitoreadosBanner) btnMisMonitoreadosBanner.style.display = 'inline-flex';
        if (btnPanelAdminBanner) btnPanelAdminBanner.style.display = 'inline-flex';
        if (badgeRolBanner) {
          badgeRolBanner.innerHTML = `<i class="fas fa-user-shield"></i> Panel de Administración General`;
        }
      }

      if (greetingSubtitle) {
        if (esSupervisor && paciente) {
          const pacNombre = paciente.nombre;
          const pacCod = paciente.codigoPaciente;
          const etiquetaRol = esAdmin ? 'Modo Administrador · Supervisando a:' : 'Cuidador Vinculado a:';
          greetingSubtitle.innerHTML = `${etiquetaRol} <strong>${pacNombre}</strong> · Código Único: <strong style="color:var(--dc-primary); background:var(--dc-primary-light); padding:2px 8px; border-radius:6px; font-family:monospace;">${pacCod}</strong>`;

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
        } else if (esPaciente) {
          greetingSubtitle.innerHTML = `Vista Simplificada del Paciente · Tu Código Único para compartir con tu cuidador es: <strong style="color:var(--dc-primary); background:var(--dc-primary-light); padding:2px 8px; border-radius:6px; font-family:monospace;">${codigoPropio}</strong>`;
        } else {
          greetingSubtitle.textContent = esAdmin ? 'Modo Administrador · Aún no supervisas a ningún paciente.' : 'Aún no tienes un paciente vinculado.';
        }
      }

      if (sidebarName) sidebarName.textContent = nombreCompleto;
      if (sidebarRole) {
        if (esAdmin) {
          sidebarRole.innerHTML = `Administrador · <a href="#" onclick="window.switchView('admin'); return false;" style="color:#5eead4; text-decoration:underline;">Panel Admin</a>`;
        } else if (esCuidador) {
          sidebarRole.textContent = `Cuidador (${codigoPropio})`;
        } else {
          sidebarRole.textContent = `Paciente (${codigoPropio})`;
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
      window.DiaMonSesion.limpiarSesion();
      if (window.supabaseClient && window.supabaseClient.auth) {
        try { await window.supabaseClient.auth.signOut(); } catch (_) {}
      }
      window.location.href = 'login.html';
    };
  }

  // Modales accesibles (auth & legal)
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

  // Consentimiento de cookies & analítica (habeas data)
  function initCookieConsent() {
    const banner = document.getElementById('dcCookieBanner');
    if (!banner) return;

    // En la app Android no hay cookies de terceros ni rastreo: no se muestra el aviso
    if (document.documentElement.classList.contains('dm-en-app')) return;
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

