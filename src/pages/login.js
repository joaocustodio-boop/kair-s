import {
  loginUser,
  registerUser,
  createFamily,
  joinFamilyByCode,
  addDependentChild,
  getCurrentUser,
  getCurrentFamily,
  getFamilyMembers,
} from '../auth.js';
import { refreshIcons } from '../icons.js';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function render(mode = 'login', error = '') {
  const user = getCurrentUser();
  const family = getCurrentFamily();
  const members = getFamilyMembers();

  if (user) {
    return `
      <div class="auth-screen">
        <div class="auth-card">
          <h2 class="page-title">Bem-vindo, ${escapeHtml(user.name)} 👋</h2>
          <p class="page-subtitle">Configure seu modo família para compartilhar dados e tarefas.</p>

          <div class="auth-family-box">
            ${family ? `
              <h3 class="form-title">Família Ativa</h3>
              <p><strong>${escapeHtml(family.name)}</strong></p>
              <p class="page-subtitle">Código de convite: <strong>${escapeHtml(family.code)}</strong></p>
              <p class="page-subtitle">Membros: ${members.map((m) => escapeHtml(m.name)).join(', ')}</p>
              <div class="form-row form-row-inline" style="margin-top:10px">
                <input id="auth-child-name" class="form-input" type="text" placeholder="Nome do filho (sem celular)" />
                <input id="auth-child-birth" class="form-input" type="date" style="max-width:180px" />
                <button id="auth-add-child" class="btn btn-secondary" type="button">
                  <i data-lucide="baby"></i> Adicionar Filho
                </button>
              </div>
            ` : `
              <h3 class="form-title">Modo Família</h3>
              <div class="form-row">
                <input id="auth-family-name" class="form-input" type="text" placeholder="Nome da família" />
                <button id="auth-create-family" class="btn btn-primary" type="button">
                  <i data-lucide="users"></i> Criar Família
                </button>
              </div>
              <div class="form-row form-row-inline" style="margin-top:8px">
                <input id="auth-family-code" class="form-input" type="text" placeholder="Código da família" />
                <button id="auth-join-family" class="btn btn-secondary" type="button">
                  <i data-lucide="user-plus"></i> Entrar com Código
                </button>
              </div>
            `}
          </div>

          <div class="form-row" style="margin-top:16px">
            <button id="auth-enter-app" class="btn btn-primary" type="button">
              <i data-lucide="arrow-right"></i> Entrar no app
            </button>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="auth-screen">
      <div class="auth-card">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
          <img src="/Image.png" alt="KAIRÓS" class="logo-animated" style="width:64px;height:64px;object-fit:contain;display:block;" />
          <h2 class="page-title" style="margin:0;">KAIRÓS</h2>
        </div>
        <p class="page-subtitle">Entre com sua conta para acessar seus dados.</p>

        ${error ? `<div class="auth-error">${escapeHtml(error)}</div>` : ''}

        <div class="filter-tabs" style="margin: 12px 0 20px">
          <button class="filter-tab ${mode === 'login' ? 'active' : ''}" data-auth-tab="login">Login</button>
          <button class="filter-tab ${mode === 'register' ? 'active' : ''}" data-auth-tab="register">Cadastro</button>
        </div>

        ${mode === 'login' ? `
          <div class="form-row">
            <input id="auth-login-email" class="form-input" type="email" placeholder="Seu email" />
          </div>
          <div class="form-row">
            <input id="auth-login-password" class="form-input" type="password" placeholder="Sua senha" />
          </div>
          <div class="form-row">
            <button id="auth-login-btn" class="btn btn-primary" type="button">
              <i data-lucide="log-in"></i> Entrar
            </button>
          </div>
        ` : `
          <div class="form-row">
            <input id="auth-register-name" class="form-input" type="text" placeholder="Seu nome" />
          </div>
          <div class="form-row">
            <input id="auth-register-email" class="form-input" type="email" placeholder="Seu email" />
          </div>
          <div class="form-row">
            <input id="auth-register-password" class="form-input" type="password" placeholder="Crie uma senha" />
          </div>
          <div class="form-row">
            <button id="auth-register-btn" class="btn btn-primary" type="button">
              <i data-lucide="user-plus"></i> Criar Conta
            </button>
          </div>
        `}
      </div>
    </div>
  `;
}

export function init(container) {
  let tab = 'login';
  let error = '';

  function rerender() {
    container.innerHTML = render(tab, error);
    refreshIcons();
    bindEvents();
  }

  function bindEvents() {
    container.querySelectorAll('[data-auth-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        tab = btn.getAttribute('data-auth-tab') || 'login';
        error = '';
        rerender();
      });
    });

    container.querySelector('#auth-login-btn')?.addEventListener('click', () => {
      const email = container.querySelector('#auth-login-email')?.value || '';
      const password = container.querySelector('#auth-login-password')?.value || '';
      try {
        loginUser(email, password);
        window.location.hash = '';
      } catch (err) {
        error = err?.message || 'Falha no login.';
        rerender();
      }
    });

    container.querySelector('#auth-register-btn')?.addEventListener('click', () => {
      const name = container.querySelector('#auth-register-name')?.value || '';
      const email = container.querySelector('#auth-register-email')?.value || '';
      const password = container.querySelector('#auth-register-password')?.value || '';
      try {
        registerUser({ name, email, password });
        tab = 'login';
        error = '';
        window.location.hash = 'login';
        rerender();
      } catch (err) {
        error = err?.message || 'Falha no cadastro.';
        rerender();
      }
    });

    container.querySelector('#auth-create-family')?.addEventListener('click', () => {
      const name = container.querySelector('#auth-family-name')?.value || '';
      try {
        createFamily(name);
        rerender();
      } catch (err) {
        error = err?.message || 'Não foi possível criar a família.';
        rerender();
      }
    });

    container.querySelector('#auth-join-family')?.addEventListener('click', () => {
      const code = container.querySelector('#auth-family-code')?.value || '';
      try {
        joinFamilyByCode(code);
        rerender();
      } catch (err) {
        error = err?.message || 'Não foi possível entrar na família.';
        rerender();
      }
    });

    container.querySelector('#auth-enter-app')?.addEventListener('click', () => {
      window.location.hash = '';
    });

    container.querySelector('#auth-add-child')?.addEventListener('click', () => {
      const name = container.querySelector('#auth-child-name')?.value || '';
      const birthDate = container.querySelector('#auth-child-birth')?.value || '';
      try {
        addDependentChild({ name, birthDate });
        rerender();
      } catch (err) {
        error = err?.message || 'Não foi possível adicionar o filho.';
        rerender();
      }
    });
  }

  rerender();
}
