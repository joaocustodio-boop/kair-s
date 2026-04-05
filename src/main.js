import './style.css';
import './pages/pages.css';
import './pages/splash-devo.css';
import { refreshIcons } from './icons.js';
import { initRouter } from './router.js';
import { getCurrentUser, isAuthenticated, logoutUser } from './auth.js';
import { store } from './store.js';

// ── Desabilita zoom em WebView (Android/iOS) ────────────────────────────────
const disableWebViewZoom = () => {
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
  });

  // Force viewport exatamente 1:1
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  disableWebViewZoom();
  initTheme();
  initSidebar();
  initAuthHeader();
  initNotifications();
  initUserProfile();
  updateDate();
  initXpToast();
  initRouter();
  refreshIcons();
  window.addEventListener('auth:changed', () => {
    initAuthHeader();
    updateProfilePanel();
  });
});

const initAuthHeader = () => {
  const user = getCurrentUser();
  const greet = document.getElementById('greeting-text');

  if (greet && user && isAuthenticated()) {
    greet.textContent = `Olá, ${user.name}`;
  }

  updateProfilePanel();
  refreshIcons();
};

// Theme Management
const initTheme = () => {
  const html = document.documentElement;
  const themes = ['light', 'dark'];

  const savedTheme = localStorage.getItem('theme');
  const defaultTheme = (savedTheme && themes.includes(savedTheme)) ? savedTheme : 'light';
  html.setAttribute('data-theme', defaultTheme);
  updateThemeUI(defaultTheme);

  const toggleTheme = () => {
    const currentTheme = html.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeUI(newTheme);
  };


  document.getElementById('header-theme-toggle')?.addEventListener('click', toggleTheme);

  function updateThemeUI(theme) {
    const isDark = theme === 'dark';

    // Header icons
    const headerSun  = document.getElementById('header-theme-icon-light');
    const headerMoon = document.getElementById('header-theme-icon-dark');
    if (headerSun)  headerSun.style.display  = isDark ? 'none'  : 'block';
    if (headerMoon) headerMoon.style.display = isDark ? 'block' : 'none';
  }
};

// Notifications
const initNotifications = () => {
  const btn      = document.getElementById('header-notif-btn');
  const panel    = document.getElementById('notif-panel');
  const dot      = document.getElementById('notif-dot');
  const list     = document.getElementById('notif-list');
  const markBtn  = document.getElementById('notif-mark-btn');
  if (!btn || !panel) return;

  const buildItems = () => {
    const items = [];
    const todayStr    = new Date().toISOString().split('T')[0];
    const tomorrowStr = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })();

    try {
      const { events = [] } = store.get('agenda');
      events
        .filter(ev => ev.date === todayStr || ev.date === tomorrowStr)
        .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''))
        .slice(0, 3)
        .forEach(ev => {
          const label = ev.date === todayStr ? 'Hoje' : 'Amanhã';
          items.push({ icon: 'calendar', color: 'blue', title: ev.title, sub: `${label} às ${ev.startTime || '--:--'}` });
        });
    } catch { /* sem dados */ }

    try {
      const { tasks = [] } = store.get('lembretes');
      tasks
        .filter(t => !t.completed && t.priority === 'high')
        .slice(0, 3)
        .forEach(t => items.push({ icon: 'alert-circle', color: 'red', title: t.text, sub: 'Tarefa urgente pendente' }));
    } catch { /* sem dados */ }

    try {
      const { habits = [] } = store.get('habitos');
      const done  = habits.filter(h => (h.completedDates || []).includes(todayStr)).length;
      const total = habits.length;
      if (total > 0) {
        items.push({
          icon:  done === total ? 'check-circle' : 'circle',
          color: done === total ? 'green' : 'amber',
          title: `Hábitos hoje: ${done}/${total}`,
          sub:   done === total ? 'Todos concluídos!' : `${total - done} hábito(s) pendente(s)`,
        });
      }
    } catch { /* sem dados */ }

    return items;
  };

  const render = () => {
    const items = buildItems();
    if (dot) dot.style.display = items.some(i => i.color === 'red' || i.color === 'amber') ? 'block' : 'none';
    if (!list) return;
    if (items.length === 0) {
      list.innerHTML = '<div class="notif-empty"><span class="notif-empty-icon">✓</span>Tudo em dia!</div>';
      return;
    }
    list.innerHTML = items.map(item => `
      <div class="notif-item notif-color-${item.color}">
        <span class="notif-item-icon"><i data-lucide="${item.icon}"></i></span>
        <div class="notif-item-body">
          <span class="notif-item-title">${item.title}</span>
          <small class="notif-item-sub">${item.sub}</small>
        </div>
      </div>
    `).join('');
    refreshIcons();
  };

  const closeAll = () => {
    panel.style.display = 'none';
    const pp = document.getElementById('profile-panel');
    if (pp) pp.style.display = 'none';
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = panel.style.display !== 'none';
    closeAll();
    if (!isOpen) { render(); panel.style.display = 'block'; }
  });

  markBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.style.display = 'none';
    if (dot) dot.style.display = 'none';
  });

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== btn) panel.style.display = 'none';
  });

  // Mostrar dot inicial
  render();
};

// User Profile panel
const updateProfilePanel = () => {
  const user = getCurrentUser();
  const gami = store.get('gamificacao');

  const nameEl  = document.getElementById('profile-panel-name');
  const levelEl = document.getElementById('profile-panel-level');
  const panelImg = document.getElementById('profile-panel-img');
  const headerImg = document.getElementById('user-profile-img');

  const displayName = user?.name || 'Usuário';
  const avatarUrl = user?.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=5850ec&color=fff`;

  if (nameEl)   nameEl.textContent  = displayName;
  if (levelEl)  levelEl.textContent = `Nível ${gami.level} · ${gami.totalPoints} XP`;
  if (panelImg)  panelImg.src  = avatarUrl;
  if (headerImg) headerImg.src = avatarUrl;
};

const initUserProfile = () => {
  const btn      = document.getElementById('header-profile-btn');
  const panel    = document.getElementById('profile-panel');
  const logoutBtn = document.getElementById('profile-logout-btn');
  const settingsBtn = document.getElementById('profile-settings-btn');

  if (!btn || !panel) return;

  const closeAll = () => {
    panel.style.display = 'none';
    const np = document.getElementById('notif-panel');
    if (np) np.style.display = 'none';
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = panel.style.display !== 'none';
    closeAll();
    if (!isOpen) { updateProfilePanel(); panel.style.display = 'block'; refreshIcons(); }
  });

  logoutBtn?.addEventListener('click', async () => {
    await logoutUser();
    panel.style.display = 'none';
    window.location.hash = 'login';
    refreshIcons();
  });

  settingsBtn?.addEventListener('click', () => {
    window.location.hash = 'ajustes';
    closeAll();
  });

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== btn) panel.style.display = 'none';
  });
};

// Sidebar Logic
const initSidebar = () => {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle');
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const layoutMain = document.querySelector('.layout-main');

  toggleBtn?.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    layoutMain.classList.toggle('sidebar-collapsed');
  });

  mobileToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (sidebar.classList.contains('active') && !sidebar.contains(e.target)) {
      sidebar.classList.remove('active');
    }
  });
};

// Dynamic Date
const updateDate = () => {
  const dateEl = document.getElementById('current-date');
  if (!dateEl) return;
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const formatted = new Intl.DateTimeFormat('pt-BR', options).format(now);
  dateEl.textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const initXpToast = () => {
  let root = document.getElementById('xp-toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'xp-toast-root';
    root.className = 'xp-toast-root';
    document.body.appendChild(root);
  }

  window.addEventListener('gamification:points-earned', (ev) => {
    const detail = ev?.detail || {};
    const points = Number(detail.points || 0);
    const entries = Array.isArray(detail.entries) ? detail.entries : [];
    if (!points) return;

    const firstReason = entries[0]?.reason || 'Ação concluída';
    const extra = entries.length > 1 ? ` +${entries.length - 1}` : '';
    const toast = document.createElement('div');
    toast.className = 'xp-toast';
    toast.innerHTML = `
      <strong>+${points} XP</strong>
      <span>${firstReason}${extra}</span>
    `;

    root.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 220);
    }, 2200);
  });
};
