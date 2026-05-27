// Gestiona la sesión de Supabase en todas las páginas:
// - Rellena el dropdown del navbar con datos del usuario
// - Muestra/oculta los enlaces de iniciar sesión/registrarse
// - Si el rol es 'admin': inyecta el strip superior y el nav-link "Admin"
// - Si la página tiene #restrictedMessage y #pageContent, los conmuta según sesión
// - Maneja la apertura del dropdown y el logout

document.addEventListener('DOMContentLoaded', async () => {
  const headerUserName = document.getElementById('headerUserName');
  const dropdownName = document.getElementById('dropdownName');
  const dropdownEmail = document.getElementById('dropdownEmail');
  const authLinks = document.querySelectorAll('.auth-link');
  const profileLinks = document.querySelectorAll('.profile-link');
  const logoutBtn = document.getElementById('logoutBtn');
  const userAvatarBtn = document.getElementById('userAvatarBtn');
  const dropdownMenu = document.getElementById('dropdownMenu');
  const userMenu = userAvatarBtn ? userAvatarBtn.closest('.user-menu') : null;
  const restrictedMessage = document.getElementById('restrictedMessage');
  const pageContent = document.getElementById('pageContent');

  // Verificación síncrona: si hay token en localStorage, ocultar #restrictedMessage
  // de inmediato para evitar el flash mientras auth async resuelve.
  try {
    const haySession = Object.keys(localStorage).some(
      k => k.startsWith('sb-') && k.endsWith('-auth-token')
    );
    if (haySession && restrictedMessage) {
      restrictedMessage.style.display = 'none';
    }
  } catch (_) {}

  function setDropdownOpen(open) {
    if (!dropdownMenu) return;
    dropdownMenu.classList.toggle('show', open);
    if (userMenu) userMenu.classList.toggle('open', open);
  }

  if (userAvatarBtn && dropdownMenu) {
    userAvatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setDropdownOpen(!dropdownMenu.classList.contains('show'));
    });
    document.addEventListener('click', (e) => {
      if (!userAvatarBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
        setDropdownOpen(false);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    });
  }

  const { data: { user } } = await supabaseClient.auth.getUser();

  if (!user) {
    authLinks.forEach(el => el.style.display = '');
    profileLinks.forEach(el => el.style.display = 'none');
    if (restrictedMessage) {
      restrictedMessage.style.display = 'block';
      if (pageContent) pageContent.style.display = 'none';
    }
    document.body.dataset.rol = 'anon';
    return;
  }

  let nombre = user.email;
  let rol = 'usuario';
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('nombre, rol')
    .eq('id', user.id)
    .single();
  if (profile) {
    if (profile.nombre) nombre = profile.nombre;
    if (profile.rol) rol = profile.rol;
  }

  if (headerUserName) headerUserName.textContent = nombre;
  if (dropdownName) {
    dropdownName.textContent = nombre;
    if (rol === 'admin') {
      const badge = document.createElement('span');
      badge.className = 'role-badge';
      badge.textContent = 'ADMIN';
      dropdownName.appendChild(badge);
    }
  }
  if (dropdownEmail) dropdownEmail.textContent = user.email;

  document.body.dataset.rol = rol;

  if (rol === 'admin') {
    inyectarAdminUI();
    cargarAdminCSS();
  }

  // Badge de rol visible en el dropdown para cuidador y monitoreado
  if ((rol === 'cuidador' || rol === 'monitoreado') && dropdownName) {
    const badge = document.createElement('span');
    badge.className = 'role-badge role-badge-' + rol;
    badge.textContent = rol === 'cuidador' ? 'CUIDADOR' : 'MONITOREADO';
    dropdownName.appendChild(badge);
  }

  authLinks.forEach(el => el.style.display = 'none');
  profileLinks.forEach(el => el.style.display = '');

  if (restrictedMessage) restrictedMessage.style.display = 'none';
  if (pageContent) pageContent.style.display = '';

  // Exponer usuario para que map.js lo consuma
  window.currentUser = user;
  document.dispatchEvent(new CustomEvent('dashboardListo', { detail: { user } }));

  // Notificar a mapa-admin.js que el contenido ya es visible y el mapa puede inicializarse.
  document.dispatchEvent(new CustomEvent('mapaAdminListo'));

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await supabaseClient.auth.signOut();
      window.location.href = 'index.html';
    });
  }
});

// ---------- Inyección de UI cuando el rol es admin ----------
function inyectarAdminUI() {
  // 1) Strip superior — "MODO ADMINISTRADOR"
  const shell = document.querySelector('.shell');
  if (shell && !document.querySelector('.admin-strip')) {
    const strip = document.createElement('div');
    strip.className = 'admin-strip';
    strip.innerHTML = `
      <span class="dot"></span>
      <span class="text">Modo administrador · estación maestra</span>
      <span class="dot"></span>
    `;
    shell.insertBefore(strip, shell.firstChild);
  }

  // 2) Nav link "Admin" — solo si no existe ya
  const menu = document.querySelector('.navbar-menu');
  if (menu && !menu.querySelector('.nav-admin')) {
    const link = document.createElement('a');
    link.href = 'admin.html';
    link.className = 'nav-link nav-admin';
    link.textContent = 'Admin';
    // Marcar como activo si estamos en admin.html
    if (window.location.pathname.endsWith('admin.html')) {
      link.classList.add('active');
    }
    menu.appendChild(link);
  }

  // 3) Nav link "Mapa GPS" — solo si no existe ya
  if (menu && !menu.querySelector('.nav-mapa')) {
    const mapaLink = document.createElement('a');
    mapaLink.href = 'mapa-admin.html';
    mapaLink.className = 'nav-link nav-admin nav-mapa';
    mapaLink.textContent = 'Mapa GPS';
    if (window.location.pathname.endsWith('mapa-admin.html')) {
      mapaLink.classList.add('active');
    }
    menu.appendChild(mapaLink);
  }
}

function cargarAdminCSS() {
  // Si la hoja ya está cargada (en admin.html), no la duplicamos
  if (document.querySelector('link[href$="admin.css"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'assets/css/admin.css';
  document.head.appendChild(link);
}
