import { refreshIcons } from './icons.js';
import * as Dashboard from './pages/dashboard.js';
import * as Financeiro from './pages/financeiro.js';
import * as Habitos from './pages/habitos.js';
import * as Exercicios from './pages/exercicios.js';
import * as Alimentos from './pages/alimentos.js';
import * as Lembretes from './pages/lembretes.js';
import * as Agenda from './pages/agenda.js';
import * as Anotacoes from './pages/anotacoes.js';
import * as Devocional from './pages/devocional.js';
import * as Ajustes from './pages/ajustes.js';
import * as Login from './pages/login.js';
import { getCurrentUser, isAuthenticated } from './auth.js';

const pages = {
  '': Dashboard,
  'dashboard': Dashboard,
  'financeiro': Financeiro,
  'habitos': Habitos,
  'exercicios': Exercicios,
  'alimentos': Alimentos,
  'lembretes': Lembretes,
  'agenda': Agenda,
  'anotacoes': Anotacoes,
  'devocional': Devocional,
  'ajustes': Ajustes,
  'login': Login,
};

function getRoute() {
  return window.location.hash.replace('#', '') || '';
}

function updateSidebarActive(route) {
  const effectiveRoute = route || 'dashboard';
  const user = getCurrentUser();
  const userName = user?.name || 'Usuário';

  document.querySelectorAll('.nav-item').forEach(item => {
    const link = item.querySelector('[data-link]');
    if (link) {
      const linkRoute = link.getAttribute('data-link');
      item.classList.toggle('active', linkRoute === effectiveRoute);
    }
  });

  document.querySelectorAll('.bottom-nav .nav-link').forEach(link => {
    const dataRoute = link.getAttribute('data-route') || '';
    link.classList.toggle('active', dataRoute === effectiveRoute || (effectiveRoute === 'dashboard' && dataRoute === ''));
  });

  // Update page title in header greeting area
  const greetEl = document.getElementById('greeting-text');
  const PAGE_TITLES = {
    '': `Olá, ${userName}`,
    'dashboard': `Olá, ${userName}`,
    'financeiro': 'Controle Financeiro',
    'habitos': 'Hábitos Diários',
    'exercicios': 'Exercícios',
    'alimentos': 'Alimentação',
    'lembretes': 'Tarefas',
    'agenda': 'Compromissos',
    'anotacoes': 'Anotações',
    'devocional': 'Devocional Diário',
    'ajustes': 'Ajustes',
    'login': 'Acesso',
  };
  if (greetEl) greetEl.textContent = PAGE_TITLES[route] || 'KAIRÓS';
}

function updateShellVisibility(isAuthed, route) {
  const app = document.getElementById('app');
  if (!app) return;
  const hideShell = !isAuthed || route === 'login';
  app.classList.toggle('auth-locked', hideShell);
}

export function navigate(route) {
  const container = document.getElementById('page-content');
  if (!container) return;

  const authed = isAuthenticated();
  if (!authed && route !== 'login') {
    window.location.hash = 'login';
    return;
  }
  if (authed && route === 'login') {
    window.location.hash = '';
    return;
  }

  const page = pages[route] || Dashboard;
  container.innerHTML = page.render();
  refreshIcons();
  if (page.init) page.init(container);
  updateShellVisibility(authed, route);
  updateSidebarActive(route);
  window.scrollTo(0, 0);
}

export function initRouter() {
  // Sidebar nav links
  document.querySelectorAll('[data-link]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const route = link.getAttribute('data-link');
      window.location.hash = route === 'dashboard' ? '' : route;
    });
  });

  // Bottom nav links
  document.querySelectorAll('.bottom-nav .nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const route = link.getAttribute('data-route') || '';
      window.location.hash = route;
    });
  });

  window.addEventListener('hashchange', () => navigate(getRoute()));

  navigate(getRoute());
}
