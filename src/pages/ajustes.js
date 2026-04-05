import {
  getCurrentUser,
  getCurrentFamily,
  getFamilyMembers,
  updateUserProfile,
  updateUserPassword,
  createFamily,
  joinFamilyByCode,
  addDependentChild,
  updateDependentChild,
} from '../auth.js';
import { refreshIcons } from '../icons.js';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function avatarFromName(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Usuario')}&background=5850ec&color=fff`;
}

function memberAvatar(member) {
  return member?.photoUrl || avatarFromName(member?.name || 'Usuario');
}

export function render(state = {}) {
  const { editingChildId = null } = state;
  const user = getCurrentUser();
  const family = getCurrentFamily();
  const members = getFamilyMembers();

  const displayName = user?.name || 'Usuário';
  const photoUrl = user?.photoUrl || avatarFromName(displayName);

  return `
    <div class="page-ajustes">
      <div class="page-header">
        <div>
          <h2 class="page-title">Ajustes</h2>
          <p class="page-subtitle">Foto, senha e modo família</p>
        </div>
      </div>

      <div class="content-section ajustes-card">
        <h3 class="form-title">Perfil</h3>
        <div class="ajustes-profile-row">
          <img src="${escapeHtml(photoUrl)}" alt="Foto de perfil" class="ajustes-avatar" id="ajustes-avatar-preview" />
          <div style="flex:1">
            <div class="form-row">
              <label class="form-label">Nome</label>
              <input id="ajustes-name" class="form-input" type="text" value="${escapeHtml(displayName)}" placeholder="Seu nome" />
            </div>
            <div class="form-row">
              <label class="form-label">URL da foto (opcional)</label>
              <input id="ajustes-photo-url" class="form-input" type="text" value="${escapeHtml(user?.photoUrl || '')}" placeholder="https://..." />
            </div>
            <div class="form-row form-row-inline">
              <input id="ajustes-photo-file" type="file" accept="image/*" style="display:none" />
              <button id="ajustes-photo-upload" class="btn btn-secondary" type="button">
                <i data-lucide="camera"></i> Enviar foto
              </button>
              <button id="ajustes-save-profile" class="btn btn-primary" type="button">
                <i data-lucide="save"></i> Salvar perfil
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="content-section ajustes-card">
        <h3 class="form-title">Senha</h3>
        <div class="form-row form-row-inline">
          <input id="ajustes-new-password" class="form-input" type="password" placeholder="Nova senha (mínimo 4 caracteres)" />
          <button id="ajustes-save-password" class="btn btn-primary" type="button">
            <i data-lucide="lock"></i> Alterar senha
          </button>
        </div>
      </div>

      <div class="content-section ajustes-card">
        <h3 class="form-title">Modo Família</h3>
        ${family ? `
          <p class="page-subtitle">Família ativa: <strong>${escapeHtml(family.name)}</strong></p>
          <p class="page-subtitle">Código de convite: <strong>${escapeHtml(family.code)}</strong></p>
          <div class="ajustes-members-grid">
            ${members.map((m) => `
              <div class="ajustes-member-item">
                <img src="${escapeHtml(memberAvatar(m))}" alt="${escapeHtml(m.name)}" class="ajustes-member-avatar" />
                <div style="flex:1;min-width:0">
                  <span>${escapeHtml(m.name)}${m.isDependent ? ' (filho)' : ''}</span>
                  ${m.birthDate ? `<small style="display:block;color:var(--text-muted)">Nascimento: ${escapeHtml(m.birthDate)}</small>` : ''}
                </div>
                ${m.isDependent ? `
                  <button class="btn btn-secondary" data-action="edit-child" data-id="${escapeHtml(m.id)}" type="button" style="padding:6px 10px;font-size:0.75rem">
                    <i data-lucide="pencil"></i> Editar
                  </button>
                ` : ''}
              </div>
              ${m.isDependent && editingChildId === m.id ? `
                <div class="ajustes-child-edit-card">
                  <div class="form-row">
                    <input id="ajustes-edit-child-name-${escapeHtml(m.id)}" class="form-input" type="text" value="${escapeHtml(m.name)}" placeholder="Nome do filho" />
                  </div>
                  <div class="form-row form-row-inline">
                    <input id="ajustes-edit-child-birth-${escapeHtml(m.id)}" class="form-input" type="date" value="${escapeHtml(m.birthDate || '')}" style="max-width:180px" />
                    <input id="ajustes-edit-child-photo-file-${escapeHtml(m.id)}" type="file" accept="image/*" style="display:none" />
                    <button data-action="edit-child-photo-upload" data-id="${escapeHtml(m.id)}" class="btn btn-secondary" type="button">
                      <i data-lucide="image-plus"></i> Foto
                    </button>
                    <button data-action="save-child" data-id="${escapeHtml(m.id)}" class="btn btn-primary" type="button">
                      <i data-lucide="save"></i> Salvar
                    </button>
                    <button data-action="cancel-edit-child" class="btn btn-secondary" type="button">Cancelar</button>
                  </div>
                  <div class="form-row">
                    <input id="ajustes-edit-child-photo-url-${escapeHtml(m.id)}" class="form-input" type="text" value="${escapeHtml(m.photoUrl || '')}" placeholder="URL da foto do filho" />
                  </div>
                </div>
              ` : ''}
            `).join('')}
          </div>

          <div class="form-row form-row-inline">
            <input id="ajustes-child-name" class="form-input" type="text" placeholder="Nome do filho (sem celular)" />
            <input id="ajustes-child-birth" class="form-input" type="date" style="max-width:180px" />
            <input id="ajustes-child-photo-file" type="file" accept="image/*" style="display:none" />
            <button id="ajustes-child-photo-upload" class="btn btn-secondary" type="button">
              <i data-lucide="image-plus"></i> Foto
            </button>
            <button id="ajustes-add-child" class="btn btn-secondary" type="button">
              <i data-lucide="baby"></i> Adicionar filho
            </button>
          </div>
          <div class="form-row">
            <input id="ajustes-child-photo-url" class="form-input" type="text" placeholder="URL da foto do filho (ou use botão Foto)" />
          </div>
        ` : `
          <div class="form-row form-row-inline">
            <input id="ajustes-family-name" class="form-input" type="text" placeholder="Nome da família" />
            <button id="ajustes-create-family" class="btn btn-primary" type="button">
              <i data-lucide="users"></i> Criar família
            </button>
          </div>
          <div class="form-row form-row-inline">
            <input id="ajustes-family-code" class="form-input" type="text" placeholder="Código da família" />
            <button id="ajustes-join-family" class="btn btn-secondary" type="button">
              <i data-lucide="user-plus"></i> Entrar com código
            </button>
          </div>
        `}
      </div>
    </div>
  `;
}

export function init(container, stateArg) {
  const state = stateArg || { editingChildId: null };

  function rerender() {
    container.innerHTML = render(state);
    refreshIcons();
    init(container, state);
  }

  const fileInput = container.querySelector('#ajustes-photo-file');
  const photoUrlInput = container.querySelector('#ajustes-photo-url');
  const avatarPreview = container.querySelector('#ajustes-avatar-preview');

  container.querySelector('#ajustes-photo-upload')?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('A foto deve ter no máximo 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = String(event.target?.result || '');
      if (!dataUrl) return;
      if (photoUrlInput) photoUrlInput.value = dataUrl;
      if (avatarPreview) avatarPreview.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });

  const childPhotoFileInput = container.querySelector('#ajustes-child-photo-file');
  const childPhotoUrlInput = container.querySelector('#ajustes-child-photo-url');

  container.querySelector('#ajustes-child-photo-upload')?.addEventListener('click', () => {
    childPhotoFileInput?.click();
  });

  childPhotoFileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('A foto deve ter no máximo 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = String(event.target?.result || '');
      if (!dataUrl) return;
      if (childPhotoUrlInput) childPhotoUrlInput.value = dataUrl;
    };
    reader.readAsDataURL(file);
  });

  container.querySelector('#ajustes-save-profile')?.addEventListener('click', async () => {
    const name = String(container.querySelector('#ajustes-name')?.value || '').trim();
    const photoUrl = String(container.querySelector('#ajustes-photo-url')?.value || '').trim();
    try {
      await updateUserProfile({ name, photoUrl });
      alert('Perfil atualizado com sucesso!');
      rerender();
    } catch (err) {
      alert(err?.message || 'Não foi possível salvar o perfil.');
    }
  });

  container.querySelector('#ajustes-save-password')?.addEventListener('click', async () => {
    const newPassword = String(container.querySelector('#ajustes-new-password')?.value || '').trim();
    try {
      await updateUserPassword(newPassword);
      alert('Senha alterada com sucesso!');
      rerender();
    } catch (err) {
      alert(err?.message || 'Não foi possível alterar a senha.');
    }
  });

  container.querySelector('#ajustes-create-family')?.addEventListener('click', async () => {
    const name = String(container.querySelector('#ajustes-family-name')?.value || '').trim();
    try {
      await createFamily(name);
      alert('Família criada com sucesso!');
      rerender();
    } catch (err) {
      alert(err?.message || 'Não foi possível criar a família.');
    }
  });

  container.querySelector('#ajustes-join-family')?.addEventListener('click', async () => {
    const code = String(container.querySelector('#ajustes-family-code')?.value || '').trim();
    try {
      await joinFamilyByCode(code);
      alert('Você entrou na família.');
      rerender();
    } catch (err) {
      alert(err?.message || 'Não foi possível entrar na família.');
    }
  });

  container.querySelector('#ajustes-add-child')?.addEventListener('click', async () => {
    const name = String(container.querySelector('#ajustes-child-name')?.value || '').trim();
    const birthDate = String(container.querySelector('#ajustes-child-birth')?.value || '').trim();
    const photoUrl = String(container.querySelector('#ajustes-child-photo-url')?.value || '').trim();
    try {
      await addDependentChild({ name, birthDate, photoUrl });
      alert('Filho adicionado com sucesso!');
      rerender();
    } catch (err) {
      alert(err?.message || 'Não foi possível adicionar o filho.');
    }
  });

  container.querySelectorAll('[data-action="edit-child"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.editingChildId = String(btn.dataset.id || '');
      rerender();
    });
  });

  container.querySelectorAll('[data-action="cancel-edit-child"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.editingChildId = null;
      rerender();
    });
  });

  container.querySelectorAll('[data-action="edit-child-photo-upload"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = String(btn.dataset.id || '');
      container.querySelector(`#ajustes-edit-child-photo-file-${id}`)?.click();
    });
  });

  container.querySelectorAll('input[id^="ajustes-edit-child-photo-file-"]').forEach((input) => {
    input.addEventListener('change', (e) => {
      const id = String(input.id.replace('ajustes-edit-child-photo-file-', ''));
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alert('A foto deve ter no máximo 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = String(event.target?.result || '');
        if (!dataUrl) return;
        const urlInput = container.querySelector(`#ajustes-edit-child-photo-url-${id}`);
        if (urlInput) urlInput.value = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  });

  container.querySelectorAll('[data-action="save-child"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = String(btn.dataset.id || '');
      const name = String(container.querySelector(`#ajustes-edit-child-name-${id}`)?.value || '').trim();
      const birthDate = String(container.querySelector(`#ajustes-edit-child-birth-${id}`)?.value || '').trim();
      const photoUrl = String(container.querySelector(`#ajustes-edit-child-photo-url-${id}`)?.value || '').trim();

      try {
        await updateDependentChild({ dependentId: id, name, birthDate, photoUrl });
        alert('Filho atualizado com sucesso!');
        state.editingChildId = null;
        rerender();
      } catch (err) {
        alert(err?.message || 'Não foi possível atualizar o filho.');
      }
    });
  });
}
