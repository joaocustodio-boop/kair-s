import {
  completePasswordRecovery,
  loginUser,
  preparePasswordRecoverySession,
  requestPasswordReset,
  registerUser,
  createFamily,
  joinFamilyByCode,
  leaveFamilyAsync,
  addDependentChild,
  getCurrentUser,
  getCurrentFamily,
  getFamilyMembers,
} from '../auth.js';
import { refreshIcons } from '../icons.js';

function getAuthMode() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const isRecoveryFlow = searchParams.get('mode') === 'recovery'
    || searchParams.get('type') === 'recovery'
    || hashParams.get('type') === 'recovery'
    || hashParams.has('access_token')
    || searchParams.has('access_token')
    || searchParams.has('code');

  if (isRecoveryFlow) {
    return 'reset';
  }
  return 'login';
}

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
              <div class="form-row form-row-inline" style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border-color)">
                <button id="auth-leave-family" class="btn btn-secondary" type="button" style="background-color:#ff6b6b;color:white;border:none">
                  <i data-lucide="log-out"></i> Sair da Família
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

        ${mode === 'reset' ? `
          <div class="form-row">
            <p class="page-subtitle" style="margin:0">Defina sua nova senha para concluir a recuperação.</p>
          </div>
          <div class="form-row">
            <input id="auth-reset-password" class="form-input" type="password" placeholder="Nova senha" />
          </div>
          <div class="form-row">
            <button id="auth-reset-btn" class="btn btn-primary" type="button">
              <i data-lucide="key-round"></i> Salvar nova senha
            </button>
          </div>
        ` : mode === 'recover' ? `
          <div class="form-row">
            <input id="auth-recover-email" class="form-input" type="email" placeholder="Seu email" />
          </div>
          <div class="form-row">
            <button id="auth-recover-btn" class="btn btn-primary" type="button">
              <i data-lucide="mail"></i> Enviar link de recuperação
            </button>
          </div>
          <div class="form-row">
            <button class="btn btn-secondary" type="button" data-auth-tab="login">
              Voltar para login
            </button>
          </div>
        ` : mode === 'login' ? `
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
          <div class="form-row" style="margin-top:8px">
            <button class="btn btn-secondary" type="button" data-auth-tab="recover">
              Recuperar senha
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
  let tab = getAuthMode();
  let error = '';
  let isReady = tab !== 'reset';

  function rerender() {
    if (!isReady) {
      container.innerHTML = `
        <div class="auth-screen">
          <div class="auth-card">
            <h2 class="page-title">Validando link...</h2>
            <p class="page-subtitle">Aguarde alguns segundos.</p>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = render(tab, error);
    refreshIcons();
    bindEvents();
  }

  function bindEvents() {
    container.querySelectorAll('[data-auth-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (getAuthMode() === 'reset') {
          return;
        }
        tab = btn.getAttribute('data-auth-tab') || 'login';
        error = '';
        rerender();
      });
    });

    container.querySelector('#auth-login-btn')?.addEventListener('click', async () => {
      const email = container.querySelector('#auth-login-email')?.value || '';
      const password = container.querySelector('#auth-login-password')?.value || '';
      try {
        await loginUser(email, password);
        window.location.hash = '';
      } catch (err) {
        error = err?.message || 'Falha no login.';
        rerender();
      }
    });

    container.querySelector('#auth-register-btn')?.addEventListener('click', async () => {
      const name = container.querySelector('#auth-register-name')?.value || '';
      const email = container.querySelector('#auth-register-email')?.value || '';
      const password = container.querySelector('#auth-register-password')?.value || '';
      try {
        await registerUser({ name, email, password });
        tab = 'login';
        error = '';
        window.location.hash = 'login';
        rerender();
      } catch (err) {
        error = err?.message || 'Falha no cadastro.';
        rerender();
      }
    });

    container.querySelector('#auth-recover-btn')?.addEventListener('click', async () => {
      const email = container.querySelector('#auth-recover-email')?.value || '';
      try {
        await requestPasswordReset(email);
        error = 'Enviamos o link de recuperacao para seu email.';
        tab = 'login';
        rerender();
      } catch (err) {
        error = err?.message || 'Nao foi possivel enviar o link de recuperacao.';
        rerender();
      }
    });

    container.querySelector('#auth-reset-btn')?.addEventListener('click', async () => {
      const newPassword = container.querySelector('#auth-reset-password')?.value || '';
      try {
        await completePasswordRecovery(newPassword);
        tab = 'login';
        error = 'Senha redefinida com sucesso. Faca login com a nova senha.';
        rerender();
      } catch (err) {
        error = err?.message || 'Nao foi possivel redefinir a senha.';
        rerender();
      }
    });

    container.querySelector('#auth-create-family')?.addEventListener('click', async () => {
      const name = container.querySelector('#auth-family-name')?.value || '';
      try {
        await createFamily(name);
        rerender();
      } catch (err) {
        error = err?.message || 'Não foi possível criar a família.';
        rerender();
      }
    });

    container.querySelector('#auth-join-family')?.addEventListener('click', async () => {
      const code = container.querySelector('#auth-family-code')?.value || '';
      try {
        await joinFamilyByCode(code);
        rerender();
      } catch (err) {
        error = err?.message || 'Não foi possível entrar na família.';
        rerender();
      }
    });

    container.querySelector('#auth-leave-family')?.addEventListener('click', async () => {
      if (!confirm('Você tem certeza que deseja sair da família?')) {
        return;
      }
      try {
        await leaveFamilyAsync();
        error = '';
        rerender();
      } catch (err) {
        error = err?.message || 'Não foi possível sair da família.';
        rerender();
      }
    });

    container.querySelector('#auth-enter-app')?.addEventListener('click', () => {
      window.location.hash = '';
    });

    container.querySelector('#auth-add-child')?.addEventListener('click', async () => {
      const name = container.querySelector('#auth-child-name')?.value || '';
      const birthDate = container.querySelector('#auth-child-birth')?.value || '';
      try {
        await addDependentChild({ name, birthDate });
        rerender();
      } catch (err) {
        error = err?.message || 'Não foi possível adicionar o filho.';
        rerender();
      }
    });
  }

  rerender();

  if (tab === 'reset') {
    (async () => {
      try {
        await preparePasswordRecoverySession();
      } catch (err) {
        tab = 'login';
        error = err?.message || 'Link de recuperacao invalido ou expirado.';
      } finally {
        isReady = true;
        rerender();
      }
    })();
  }
}
