/**
 * DiaMon - Drawer y Modal de Perfil Flotante (100% Sin Prompts Nativos)
 * Incluye carga de fotos desde Galería/Cámara móvil, edición integrada y gestión de familiares.
 */
(function () {
  'use strict';

  // Obtener usuario actual
  function obtenerUsuarioActual() {
    try {
      const demo = sessionStorage.getItem('diamon_demo_user');
      if (demo) return JSON.parse(demo);
    } catch (e) {}

    try {
      const stored = localStorage.getItem('diamon_current_user');
      if (stored) return JSON.parse(stored);
    } catch (e) {}

    return null;
  }

  function guardarUsuarioActual(user) {
    if (!user) return;
    sessionStorage.setItem('diamon_demo_user', JSON.stringify(user));
    localStorage.setItem('diamon_current_user', JSON.stringify(user));
    if (typeof window.actualizarInterfazUsuario === 'function') {
      window.actualizarInterfazUsuario();
    }
  }

  // Formatear nombre humano
  function formatearNombre(u) {
    if (!u) return 'Usuario Invitado';
    if (u.nombre && u.nombre.trim()) return u.nombre;
    if (u.email) {
      const handle = u.email.split('@')[0];
      if (handle.toLowerCase().includes('erick')) return 'Erick de Jesús Torres';
      return handle.charAt(0).toUpperCase() + handle.slice(1);
    }
    return 'Usuario DiaMon';
  }

  // Abrir Modal de Perfil
  window.abrirModalPerfil = function () {
    const backdrop = document.getElementById('dcProfileModal');
    if (!backdrop) return;

    renderizarVistaPrincipalPerfil();
    backdrop.style.display = 'flex';
    setTimeout(() => {
      backdrop.classList.add('active');
    }, 10);
  };

  // Cerrar Modal de Perfil
  window.cerrarModalPerfil = function (e) {
    if (e && e.target && e.target !== e.currentTarget && !e.target.closest('.dc-profile-close-btn')) {
      return;
    }
    const backdrop = document.getElementById('dcProfileModal');
    if (!backdrop) return;

    backdrop.classList.remove('active');
    setTimeout(() => {
      backdrop.style.display = 'none';
    }, 300);
  };

  // // VISTA PRINCIPAL: MI PERFIL (REGISTRADO VS INVITADO)
  // window.renderizarVistaPrincipalPerfil = function () {
    const container = document.getElementById('profileDrawerContent');
    const headerTitle = document.getElementById('profileDrawerHeaderTitle');
    if (!container) return;

    const user = obtenerUsuarioActual();
    const esInvitado = !user || user.esInvitado === true;

    if (!esInvitado) {
      // USUARIO REGISTRADO
      if (headerTitle) headerTitle.textContent = 'Mi Perfil';

      const nombre = formatearNombre(user);
      const email = user.email || 'usuario@diamon.salud';
      const rolTexto = user.rol === 'admin' ? 'Administrador' : (user.rol === 'cuidador' ? 'Cuidador / Familiar' : 'Paciente');
      const iniciales = nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'ET';
      const fotoUrl = user.foto || user.avatar_url || (user.user_metadata && user.user_metadata.avatar_url) || null;

      container.innerHTML = `
        <!-- Input invisible para abrir Galería / Cámara en móvil o archivos en PC -->
        <input type="file" id="dmProfilePhotoFileInput" accept="image/*" style="display:none;" onchange="window.procesarFotoGaleria(event)">

        <!-- Resumen de Usuario -->
        <div class="dc-profile-user-summary">
          <div class="dc-profile-avatar-wrapper" onclick="window.abrirSelectorGaleria()" style="cursor:pointer;" title="Cambiar foto desde tu galería">
            ${fotoUrl ? `
              <img src="${fotoUrl}" alt="${nombre}" class="dc-profile-big-avatar" id="drawerBigAvatarImg">
            ` : `
              <div class="dc-profile-big-avatar" id="drawerBigAvatarImg">${iniciales}</div>
            `}
            <button class="dc-profile-camera-badge" type="button" aria-label="Abrir galería de fotos" onclick="event.stopPropagation(); window.abrirSelectorGaleria();">
              <i class="fas fa-camera"></i>
            </button>
          </div>

          <div class="dc-profile-info-block">
            <h3 class="dc-profile-user-name">${nombre}</h3>
            <span class="dc-profile-role-badge">${rolTexto}</span>
            <div class="dc-profile-meta-row">
              <i class="far fa-envelope"></i>
              <span>${email}</span>
            </div>
            <div class="dc-profile-meta-row">
              <i class="fas fa-map-marker-alt" style="color:#ef4444;"></i>
              <span>Cartagena, Colombia</span>
            </div>
          </div>
        </div>

        <!-- 5 Menús de Navegación Oficiales (Tal cual Imagen 3) -->
        <div class="dc-profile-menu-list">
          <button class="dc-profile-menu-item" onclick="window.mostrarVistaEditarPerfil()">
            <div class="dc-profile-menu-left">
              <div class="dc-profile-menu-icon" style="background:#0f172a;">
                <i class="fas fa-user-edit"></i>
              </div>
              <div class="dc-profile-menu-text">
                <span class="dc-profile-menu-title">Editar perfil</span>
                <span class="dc-profile-menu-desc">Actualiza tu información personal</span>
              </div>
            </div>
            <i class="fas fa-chevron-right dc-profile-menu-chevron"></i>
          </button>

          <button class="dc-profile-menu-item" onclick="window.mostrarVistaFamiliares()">
            <div class="dc-profile-menu-left">
              <div class="dc-profile-menu-icon" style="background:#0f172a;">
                <i class="fas fa-users"></i>
              </div>
              <div class="dc-profile-menu-text">
                <span class="dc-profile-menu-title">Mis familiares</span>
                <span class="dc-profile-menu-desc">Gestiona los perfiles vinculados</span>
              </div>
            </div>
            <i class="fas fa-chevron-right dc-profile-menu-chevron"></i>
          </button>

          <button class="dc-profile-menu-item" onclick="window.irANotificaciones()">
            <div class="dc-profile-menu-left">
              <div class="dc-profile-menu-icon" style="background:#0f172a;">
                <i class="fas fa-bell"></i>
              </div>
              <div class="dc-profile-menu-text">
                <span class="dc-profile-menu-title">Notificaciones</span>
                <span class="dc-profile-menu-desc">Configura tus alertas médicas</span>
              </div>
            </div>
            <i class="fas fa-chevron-right dc-profile-menu-chevron"></i>
          </button>

          <button class="dc-profile-menu-item" onclick="window.irAPrivacidad()">
            <div class="dc-profile-menu-left">
              <div class="dc-profile-menu-icon" style="background:#0f172a;">
                <i class="fas fa-shield-alt"></i>
              </div>
              <div class="dc-profile-menu-text">
                <span class="dc-profile-menu-title">Privacidad y seguridad</span>
                <span class="dc-profile-menu-desc">Controla tus datos y permisos</span>
              </div>
            </div>
            <i class="fas fa-chevron-right dc-profile-menu-chevron"></i>
          </button>

          <button class="dc-profile-menu-item" onclick="window.mostrarVistaInfoApp()">
            <div class="dc-profile-menu-left">
              <div class="dc-profile-menu-icon" style="background:#0f172a;">
                <i class="fas fa-info-circle"></i>
              </div>
              <div class="dc-profile-menu-text">
                <span class="dc-profile-menu-title">Información de la app</span>
                <span class="dc-profile-menu-desc">Versión 1.0.0</span>
              </div>
            </div>
            <i class="fas fa-chevron-right dc-profile-menu-chevron"></i>
          </button>
        </div>

        <!-- Botón Inferior: Cerrar sesión -->
        <div class="dc-profile-bottom-action">
          <button class="dc-profile-btn-logout" onclick="window.mostrarConfirmacionCerrarSesion()">
            <i class="fas fa-sign-out-alt"></i>
            <span>Cerrar sesión</span>
          </button>
        </div>
      `;
    } else {
      // MODO INVITADO
      if (headerTitle) headerTitle.textContent = 'Mi Perfil (Invitado)';

      container.innerHTML = `
        <div class="dc-profile-user-summary">
          <div class="dc-profile-avatar-wrapper">
            <div class="dc-profile-big-avatar" style="background: linear-gradient(135deg, #475569, #64748b);">
              <i class="fas fa-user-secret" style="font-size:36px;"></i>
            </div>
          </div>

          <div class="dc-profile-info-block">
            <h3 class="dc-profile-user-name">Usuario Invitado</h3>
            <span class="dc-profile-role-badge" style="background:#fef3c7; color:#92400e;">Modo Demostración</span>
            <div class="dc-profile-meta-row">
              <i class="far fa-eye"></i>
              <span>Acceso de prueba temporal</span>
            </div>
            <div class="dc-profile-meta-row">
              <i class="fas fa-map-marker-alt" style="color:#ef4444;"></i>
              <span>Cartagena, Colombia</span>
            </div>
          </div>
        </div>

        <div class="dc-profile-guest-banner">
          <div class="dc-profile-guest-banner-title">
            <i class="fas fa-shield-alt"></i> Sesión no vinculada
          </div>
          <p>Estás explorando DiaMon en modo de prueba. Tus registros médicos, dosis y geocercas no se guardarán al salir del navegador.</p>
        </div>

        <div class="dc-profile-menu-list">
          <button class="dc-profile-menu-item" onclick="window.location.href='login.html'">
            <div class="dc-profile-menu-left">
              <div class="dc-profile-menu-icon" style="background:#2563eb;">
                <i class="fas fa-user-plus"></i>
              </div>
              <div class="dc-profile-menu-text">
                <span class="dc-profile-menu-title">Crear cuenta gratis</span>
                <span class="dc-profile-menu-desc">Registra tu perfil en 30 segundos</span>
              </div>
            </div>
            <i class="fas fa-chevron-right dc-profile-menu-chevron"></i>
          </button>

          <button class="dc-profile-menu-item" onclick="window.location.href='login.html'">
            <div class="dc-profile-menu-left">
              <div class="dc-profile-menu-icon" style="background:#0f172a;">
                <i class="fas fa-sign-in-alt"></i>
              </div>
              <div class="dc-profile-menu-text">
                <span class="dc-profile-menu-title">Iniciar sesión oficial</span>
                <span class="dc-profile-menu-desc">Accede con Google o tu correo</span>
              </div>
            </div>
            <i class="fas fa-chevron-right dc-profile-menu-chevron"></i>
          </button>

          <button class="dc-profile-menu-item" onclick="window.irAPrivacidad()">
            <div class="dc-profile-menu-left">
              <div class="dc-profile-menu-icon" style="background:#0f172a;">
                <i class="fas fa-lock"></i>
              </div>
              <div class="dc-profile-menu-text">
                <span class="dc-profile-menu-title">Privacidad de datos</span>
                <span class="dc-profile-menu-desc">Protección clínica Ley 1581</span>
              </div>
            </div>
            <i class="fas fa-chevron-right dc-profile-menu-chevron"></i>
          </button>

          <button class="dc-profile-menu-item" onclick="window.mostrarVistaInfoApp()">
            <div class="dc-profile-menu-left">
              <div class="dc-profile-menu-icon" style="background:#0f172a;">
                <i class="fas fa-info-circle"></i>
              </div>
              <div class="dc-profile-menu-text">
                <span class="dc-profile-menu-title">Información de la app</span>
                <span class="dc-profile-menu-desc">Versión 1.0.0 · DiaMon Cartagena</span>
              </div>
            </div>
            <i class="fas fa-chevron-right dc-profile-menu-chevron"></i>
          </button>
        </div>

        <div class="dc-profile-bottom-action">
          <button class="dc-profile-btn-login-guest" onclick="window.location.href='login.html'">
            <i class="fas fa-sign-in-alt"></i>
            <span>Iniciar sesión / Registrarse</span>
          </button>
        </div>
      `;
    }
  };

  // // SELECCIÓN DE FOTO DESDE GALERÍA / ARCHIVOS (SIN PROMPTS)
  // window.abrirSelectorGaleria = function () {
    const input = document.getElementById('dmProfilePhotoFileInput');
    if (input) {
      input.click();
    }
  };

  window.procesarFotoGaleria = function (e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = function (evt) {
      const dataUrl = evt.target.result;
      const user = obtenerUsuarioActual() || {
        nombre: 'Erick de Jesús Torres',
        email: 'erickdejesustorres02@gmail.com',
        rol: 'admin'
      };

      user.foto = dataUrl;
      guardarUsuarioActual(user);
      renderizarVistaPrincipalPerfil();
      mostrarToastPerfil('✓ Foto de perfil actualizada desde tu galería');
    };
    reader.readAsDataURL(file);
  };

  // // SUB-VISTA: EDITAR PERFIL (IN-DRAWER SIN PROMPTS)
  // window.mostrarVistaEditarPerfil = function () {
    const container = document.getElementById('profileDrawerContent');
    const headerTitle = document.getElementById('profileDrawerHeaderTitle');
    if (!container) return;

    if (headerTitle) headerTitle.textContent = 'Editar Perfil';

    const user = obtenerUsuarioActual() || {};
    const nombreActual = formatearNombre(user);
    const telActual = user.telefono || '+57 300 123 4567';
    const contactoSOSActual = user.contactoSOS || 'Carol Cervantes (+57 310 987 6543)';

    container.innerHTML = `
      <div class="dc-profile-subview">
        <div class="dc-profile-subview-header">
          <p class="dc-profile-subview-desc">Actualiza tus datos para la telemetría clínica y alertas SOS en Cartagena.</p>
        </div>

        <form onsubmit="window.guardarCambiosPerfil(event)" class="dc-profile-edit-form">
          <div class="dc-form-group">
            <label for="editNombreInput">Nombre Completo</label>
            <div class="dc-input-pill-wrapper">
              <i class="fas fa-user"></i>
              <input type="text" id="editNombreInput" value="${nombreActual}" required placeholder="Tu Nombre Completo">
            </div>
          </div>

          <div class="dc-form-group">
            <label for="editTelInput">Teléfono Móvil (GPS)</label>
            <div class="dc-input-pill-wrapper">
              <i class="fas fa-phone-alt"></i>
              <input type="tel" id="editTelInput" value="${telActual}" placeholder="+57 300 000 0000">
            </div>
          </div>

          <div class="dc-form-group">
            <label for="editSOSInput">Contacto Familiar de Emergencia SOS</label>
            <div class="dc-input-pill-wrapper">
              <i class="fas fa-heartbeat" style="color:#ef4444;"></i>
              <input type="text" id="editSOSInput" value="${contactoSOSActual}" placeholder="Nombre y Teléfono">
            </div>
          </div>

          <div class="dc-profile-subview-actions">
            <button type="button" class="dc-btn-subview-secondary" onclick="window.renderizarVistaPrincipalPerfil()">
              Volver
            </button>
            <button type="submit" class="dc-btn-subview-primary">
              <i class="fas fa-save"></i> Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    `;
  };

  window.guardarCambiosPerfil = function (e) {
    e.preventDefault();
    const nombreNuevo = document.getElementById('editNombreInput')?.value.trim();
    const telNuevo = document.getElementById('editTelInput')?.value.trim();
    const sosNuevo = document.getElementById('editSOSInput')?.value.trim();

    if (!nombreNuevo) return;

    const user = obtenerUsuarioActual() || {};
    user.nombre = nombreNuevo;
    user.telefono = telNuevo;
    user.contactoSOS = sosNuevo;

    guardarUsuarioActual(user);
    window.renderizarVistaPrincipalPerfil();
    mostrarToastPerfil('✓ Información personal guardada correctamente');
  };

  // // SUB-VISTA: MIS FAMILIARES (CÓDIGO ÚNICO + VINCULACIÓN)
  // window.mostrarVistaFamiliares = function () {
    const container = document.getElementById('profileDrawerContent');
    const headerTitle = document.getElementById('profileDrawerHeaderTitle');
    if (!container) return;

    if (headerTitle) headerTitle.textContent = 'Mis Familiares';

    const user = obtenerUsuarioActual() || {};
    const codigo = user.codigoPaciente || 'DM-8492';

    container.innerHTML = `
      <div class="dc-profile-subview">
        <div class="dc-family-card">
          <div class="dc-family-icon"><i class="fas fa-qrcode"></i></div>
          <h4 class="dc-family-title">Tu Código Único de Paciente</h4>
          <p class="dc-family-subtitle">Comparte este código con tus familiares o médico para que puedan supervisar tu glucosa y ubicación GPS en tiempo real.</p>

          <div class="dc-family-code-capsule">
            <span class="dc-family-code-text" id="dmUserCodeVal">${codigo}</span>
            <button class="dc-family-copy-btn" onclick="window.copiarCodigoPaciente('${codigo}')" title="Copiar código al portapapeles">
              <i class="far fa-copy"></i> <span id="copyBtnLabel">Copiar</span>
            </button>
          </div>
        </div>

        <h5 style="margin: 16px 0 8px 0; font-size:13.5px; font-weight:700; color:#0f172a;">Equipo de Cuidado Vinculado (Caso de Estudio)</h5>

        <div class="dc-family-linked-list">
          <div class="dc-family-linked-item">
            <div class="dc-family-linked-avatar" style="background:#0d9488;">DD</div>
            <div class="dc-family-linked-info">
              <strong>Damián Díaz Balseiro (DM-8492)</strong>
              <span>Paciente del Caso de Estudio · Barrio Chapacuá (10.39991, -75.47886)</span>
            </div>
            <span class="dc-family-status-badge">Activo</span>
          </div>

          <div class="dc-family-linked-item">
            <div class="dc-family-linked-avatar" style="background:#0284c7;">EV</div>
            <div class="dc-family-linked-info">
              <strong>Enf. Jefe Elizabeth Vargas Caro</strong>
              <span>Guía Clínica · Control Glucémico (Insulina 24 UI / Ozempic) y HTA</span>
            </div>
            <span class="dc-family-status-badge">Enfermera Jefe</span>
          </div>
        </div>

        <div class="dc-profile-subview-actions" style="margin-top:16px;">
          <button type="button" class="dc-btn-subview-secondary" style="width:100%;" onclick="window.renderizarVistaPrincipalPerfil()">
            <i class="fas fa-arrow-left"></i> Volver al Perfil
          </button>
        </div>
      </div>
    `;
  };

  window.copiarCodigoPaciente = function (codigo) {
    navigator.clipboard.writeText(codigo).then(() => {
      const lbl = document.getElementById('copyBtnLabel');
      if (lbl) lbl.textContent = '¡Copiado!';
      mostrarToastPerfil(`✓ Código ${codigo} copiado al portapapeles`);
      setTimeout(() => {
        if (lbl) lbl.textContent = 'Copiar';
      }, 2500);
    }).catch(() => {
      mostrarToastPerfil(`Código: ${codigo}`);
    });
  };

  // // SUB-VISTA: INFORMACIÓN DE LA APP (SIN ALERTS)
  // window.mostrarVistaInfoApp = function () {
    const container = document.getElementById('profileDrawerContent');
    const headerTitle = document.getElementById('profileDrawerHeaderTitle');
    if (!container) return;

    if (headerTitle) headerTitle.textContent = 'Información de la App';

    container.innerHTML = `
      <div class="dc-profile-subview">
        <div style="text-align:center; padding: 10px 0 16px 0;">
          <div style="width:56px; height:56px; border-radius:16px; background:#eff6ff; color:#2563eb; font-size:26px; display:inline-flex; align-items:center; justify-content:center; margin-bottom:8px;">
            <i class="fas fa-tint"></i>
          </div>
          <h4 style="margin:0; font-size:18px; font-weight:800; color:#0f172a;">DiaMon</h4>
          <span style="font-size:12px; color:#2563eb; font-weight:700;">Versión 1.0.0 (Production Build)</span>
        </div>

        <div class="dc-app-info-card">
          <div class="dc-app-info-row">
            <span>Sede de Operación</span>
            <strong>Cartagena de Indias, Colombia</strong>
          </div>
          <div class="dc-app-info-row">
            <span>Enlace Telemétrico</span>
            <strong style="color:#059669;">Satelital 4G / GPS Activo</strong>
          </div>
          <div class="dc-app-info-row">
            <span>Cifrado de Datos</span>
            <strong>AES-256 / Ley 1581 de 2012</strong>
          </div>
          <div class="dc-app-info-row">
            <span>Compatibilidad</span>
            <strong>PWA Celular & Escritorio</strong>
          </div>
        </div>

        <div class="dc-profile-subview-actions" style="margin-top:18px;">
          <button type="button" class="dc-btn-subview-secondary" style="width:100%;" onclick="window.renderizarVistaPrincipalPerfil()">
            <i class="fas fa-arrow-left"></i> Volver al Perfil
          </button>
        </div>
      </div>
    `;
  };

  // // SUB-VISTA: CONFIRMACIÓN CERRAR SESIÓN (SIN CONFIRM)
  // window.mostrarConfirmacionCerrarSesion = function () {
    const container = document.getElementById('profileDrawerContent');
    const headerTitle = document.getElementById('profileDrawerHeaderTitle');
    if (!container) return;

    if (headerTitle) headerTitle.textContent = 'Cerrar Sesión';

    container.innerHTML = `
      <div class="dc-profile-subview" style="text-align:center; padding: 20px 10px;">
        <div style="width:58px; height:58px; border-radius:50%; background:#fee2e2; color:#dc2626; font-size:24px; display:inline-flex; align-items:center; justify-content:center; margin-bottom:14px;">
          <i class="fas fa-sign-out-alt"></i>
        </div>

        <h4 style="margin:0 0 8px 0; font-size:18px; font-weight:700; color:#0f172a;">¿Deseas cerrar tu sesión?</h4>
        <p style="margin:0 0 24px 0; font-size:13px; color:#64748b; line-height:1.5;">
          Al cerrar sesión pasarás a Modo Invitado. Podrás volver a entrar con tu cuenta de Google o correo en cualquier momento.
        </p>

        <div class="dc-profile-subview-actions">
          <button type="button" class="dc-btn-subview-secondary" onclick="window.renderizarVistaPrincipalPerfil()">
            Cancelar
          </button>
          <button type="button" class="dc-btn-subview-danger" onclick="window.ejecutarCierreSesion()">
            Cerrar Sesión
          </button>
        </div>
      </div>
    `;
  };

  window.ejecutarCierreSesion = function () {
    sessionStorage.removeItem('diamon_demo_user');
    localStorage.removeItem('diamon_current_user');
    window.cerrarModalPerfil();
    mostrarToastPerfil('Has cerrado sesión correctamente');
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  // // NAVEGACIÓN DIRECTA
  // window.irANotificaciones = function () {
    window.cerrarModalPerfil();
    if (typeof window.switchView === 'function') {
      window.switchView('alertas');
    }
  };

  window.irAPrivacidad = function () {
    window.cerrarModalPerfil();
    if (typeof window.switchView === 'function') {
      window.switchView('seguridad');
    }
  };

  function mostrarToastPerfil(mensaje) {
    let toast = document.getElementById('dmProfileToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'dmProfileToast';
      document.body.appendChild(toast);
    }
    toast.className = 'dm-profile-toast show';
    toast.innerHTML = `<i class="fas fa-check-circle"></i> <span>${mensaje}</span>`;
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // Inicializar listeners al cargar
  document.addEventListener('DOMContentLoaded', () => {
    const avatarBtn = document.getElementById('userAvatarBtn');
    if (avatarBtn) {
      avatarBtn.onclick = () => window.abrirModalPerfil();
    }

    const sidebarProfile = document.querySelector('.dc-sidebar-profile');
    if (sidebarProfile) {
      sidebarProfile.onclick = () => window.abrirModalPerfil();
    }
  });

})();

