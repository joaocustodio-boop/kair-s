import { store } from '../store.js';
import { refreshIcons } from '../icons.js';

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const COLORS = ['blue', 'green', 'purple', 'yellow', 'red'];

function renderNote(note) {
  return `
    <div class="note-card color-${note.color}" data-id="${note.id}">
      ${note.pinned ? `<div class="note-pinned-badge"><i data-lucide="pin"></i></div>` : ''}
      <div class="note-card-header">
        <span class="note-card-title">${escapeHtml(note.title)}</span>
      </div>
      <div class="note-card-content">${escapeHtml(note.content)}</div>
      <div class="note-card-footer">
        <div class="note-tags">
          ${note.tags.map(tag => `<span class="note-tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
        <div class="note-card-actions">
          <button class="btn-icon ${note.pinned ? 'active' : ''}" data-action="pin" data-id="${note.id}" title="${note.pinned ? 'Desafixar' : 'Fixar'}">
            <i data-lucide="pin"></i>
          </button>
          <button class="btn-icon" data-action="edit" data-id="${note.id}" title="Editar">
            <i data-lucide="pen"></i>
          </button>
          <button class="btn-icon danger" data-action="delete" data-id="${note.id}" title="Excluir">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderModal(note = null) {
  const isEdit = !!note;
  return `
    <div class="modal-overlay" id="note-modal">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">${isEdit ? 'Editar Nota' : 'Nova Nota'}</span>
          <button class="btn-icon" id="modal-close"><i data-lucide="x"></i></button>
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">Título</label>
          <input type="text" id="note-title" class="form-input" placeholder="Título da nota..." value="${note ? escapeHtml(note.title) : ''}" />
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">Conteúdo</label>
          <textarea id="note-content" class="form-textarea" placeholder="Escreva sua nota..." rows="6">${note ? escapeHtml(note.content) : ''}</textarea>
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">Tags (separadas por vírgula)</label>
          <input type="text" id="note-tags" class="form-input" placeholder="trabalho, pessoal, dev..." value="${note ? escapeHtml(note.tags.join(', ')) : ''}" />
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Cor</label>
          <div class="color-picker">
            ${COLORS.map(c => `<div class="color-option ${c} ${(note?.color || 'blue') === c ? 'selected' : ''}" data-color="${c}"></div>`).join('')}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="modal-cancel">Cancelar</button>
          <button class="btn btn-primary" id="modal-save" data-id="${note?.id || ''}">
            <i data-lucide="save"></i> ${isEdit ? 'Salvar' : 'Criar Nota'}
          </button>
        </div>
      </div>
    </div>
  `;
}

export function render(search = '') {
  const { notes } = store.get('anotacoes');
  let filtered = notes;
  if (search) {
    const q = search.toLowerCase();
    filtered = notes.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  const pinned = filtered.filter(n => n.pinned);
  const unpinned = filtered.filter(n => !n.pinned);
  const sorted = [...pinned, ...unpinned];

  return `
    <div class="page-anotacoes">
      <div class="page-header">
        <div>
          <h2 class="page-title">Anotações</h2>
          <p class="page-subtitle">${notes.length} nota${notes.length !== 1 ? 's' : ''}</p>
        </div>
        <button class="btn btn-primary" id="new-note-btn">
          <i data-lucide="plus"></i> Nova Nota
        </button>
      </div>

      <div class="notes-search-bar">
        <i data-lucide="search"></i>
        <input type="text" id="notes-search" class="form-input" placeholder="Buscar anotações..." value="${escapeHtml(search)}" />
      </div>

      <div class="notes-grid" id="notes-grid">
        ${sorted.length ? sorted.map(renderNote).join('') : `<p class="empty-state" style="grid-column:1/-1">${search ? 'Nenhuma nota encontrada' : 'Nenhuma anotação ainda. Crie a primeira!'}</p>`}
      </div>
    </div>
  `;
}

export function init(container, search = '') {
  function rerender(q = search) {
    container.innerHTML = render(q);
    refreshIcons();
    init(container, q);
  }

  function openModal(noteId = null) {
    const { notes } = store.get('anotacoes');
    const note = noteId ? notes.find(n => n.id === noteId) : null;
    const overlay = document.createElement('div');
    overlay.innerHTML = renderModal(note);
    document.body.appendChild(overlay.firstElementChild);
    refreshIcons();

    let selectedColor = note?.color || 'blue';

    // Color picker
    document.querySelectorAll('.color-option').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        selectedColor = opt.dataset.color;
      });
    });

    function closeModal() {
      const modal = document.getElementById('note-modal');
      if (modal) modal.remove();
    }

    document.getElementById('modal-close')?.addEventListener('click', closeModal);
    document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
    document.getElementById('note-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'note-modal') closeModal();
    });

    document.getElementById('modal-save')?.addEventListener('click', () => {
      const title = document.getElementById('note-title').value.trim();
      const content = document.getElementById('note-content').value.trim();
      const tagsRaw = document.getElementById('note-tags').value.trim();
      const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

      if (!title) return;

      if (note) {
        store.update('anotacoes', data => {
          const n = data.notes.find(n => n.id === note.id);
          if (n) { n.title = title; n.content = content; n.tags = tags; n.color = selectedColor; n.updatedAt = new Date().toISOString(); }
          return data;
        });
      } else {
        store.update('anotacoes', data => {
          data.notes.unshift({
            id: store.nextId(data.notes),
            title, content, tags, color: selectedColor,
            pinned: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          return data;
        });
      }

      closeModal();
      rerender();
    });
  }

  container.querySelector('#new-note-btn')?.addEventListener('click', () => openModal());

  // Search
  let searchTimeout;
  container.querySelector('#notes-search')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => rerender(e.target.value), 300);
  });

  // Note actions
  container.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => openModal(parseInt(btn.dataset.id)));
  });

  container.querySelectorAll('[data-action="pin"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      store.update('anotacoes', data => {
        const note = data.notes.find(n => n.id === id);
        if (note) note.pinned = !note.pinned;
        return data;
      });
      rerender();
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      if (!confirm('Excluir esta nota?')) return;
      store.update('anotacoes', data => {
        data.notes = data.notes.filter(n => n.id !== id);
        return data;
      });
      rerender();
    });
  });
}
