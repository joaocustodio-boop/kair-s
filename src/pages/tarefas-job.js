import { store } from '../store.js';
import { refreshIcons } from '../icons.js';

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const STATUS = {
  todo: { label: 'A Fazer', next: 'doing', nextLabel: '→ Iniciar', col: 'col-todo' },
  doing: { label: 'Em Andamento', prev: 'todo', prevLabel: '← Voltar', next: 'done', nextLabel: '→ Concluir', col: 'col-doing' },
  done: { label: 'Concluído', prev: 'doing', prevLabel: '← Reabrir', col: 'col-done' },
};

function renderCard(task) {
  const s = STATUS[task.status];
  const priorityLabel = { high: 'Alta', medium: 'Média', low: 'Baixa' }[task.priority];
  const dueStr = task.dueDate ? new Date(task.dueDate + 'T12:00:00').toLocaleDateString('pt-BR') : '';
  const isOverdue = task.dueDate && task.dueDate < new Date().toISOString().split('T')[0] && task.status !== 'done';

  return `
    <div class="kanban-card" data-id="${task.id}">
      <div class="kanban-card-title">${escapeHtml(task.title)}</div>
      ${task.description ? `<div class="kanban-card-desc">${escapeHtml(task.description)}</div>` : ''}
      <div class="kanban-card-footer">
        <div style="display:flex;flex-direction:column;gap:4px">
          <span class="priority-badge priority-${task.priority}">${priorityLabel}</span>
          ${task.project ? `<span class="kanban-card-project">📁 ${escapeHtml(task.project)}</span>` : ''}
          ${dueStr ? `<span class="kanban-card-project" style="${isOverdue ? 'color:#ef4444;font-weight:600' : ''}">📅 ${dueStr}${isOverdue ? ' ⚠️' : ''}</span>` : ''}
        </div>
        <div class="kanban-card-actions">
          ${s.prev ? `<button class="kanban-move-btn" data-action="move" data-id="${task.id}" data-to="${s.prev}" title="${s.prevLabel}">${s.prevLabel}</button>` : ''}
          ${s.next ? `<button class="kanban-move-btn" data-action="move" data-id="${task.id}" data-to="${s.next}" title="${s.nextLabel}">${s.nextLabel}</button>` : ''}
          <button class="btn-icon danger" data-action="delete" data-id="${task.id}">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderColumn(status, tasks) {
  const s = STATUS[status];
  const filtered = tasks.filter(t => t.status === status);
  return `
    <div class="kanban-col ${s.col}">
      <div class="kanban-col-header">
        <span class="kanban-col-title">${s.label}</span>
        <span class="kanban-col-count">${filtered.length}</span>
      </div>
      ${filtered.length ? filtered.map(renderCard).join('') : `<p class="empty-state" style="padding:20px 0;font-size:0.8125rem">Nenhuma tarefa</p>`}
    </div>
  `;
}

export function render() {
  const { tasks } = store.get('tarefasJob');
  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'done').length;
  const doing = tasks.filter(t => t.status === 'doing').length;

  return `
    <div class="page-tarefas-job">
      <div class="page-header">
        <div>
          <h2 class="page-title">Tarefas de Trabalho</h2>
          <p class="page-subtitle">${doing} em andamento &middot; ${done}/${total} concluídas</p>
        </div>
      </div>

      <div class="add-section">
        <h3 class="form-title">Nova Tarefa</h3>
        <div class="form-row">
          <input type="text" id="job-title" class="form-input" placeholder="Título da tarefa..." />
        </div>
        <div class="form-row">
          <input type="text" id="job-desc" class="form-input" placeholder="Descrição (opcional)..." />
        </div>
        <div class="form-row form-row-inline">
          <input type="text" id="job-project" class="form-input" placeholder="Projeto..." />
          <select id="job-priority" class="form-select" style="max-width:160px">
            <option value="low">Prioridade Baixa</option>
            <option value="medium" selected>Prioridade Média</option>
            <option value="high">Prioridade Alta</option>
          </select>
          <input type="date" id="job-due" class="form-input" style="max-width:180px" placeholder="Prazo" />
          <button class="btn btn-primary" id="job-add">
            <i data-lucide="plus"></i> Adicionar
          </button>
        </div>
      </div>

      <div class="kanban-board">
        ${renderColumn('todo', tasks)}
        ${renderColumn('doing', tasks)}
        ${renderColumn('done', tasks)}
      </div>
    </div>
  `;
}

export function init(container) {
  function rerender() {
    container.innerHTML = render();
    refreshIcons();
    init(container);
  }

  container.querySelector('#job-add')?.addEventListener('click', () => {
    const title = container.querySelector('#job-title').value.trim();
    const description = container.querySelector('#job-desc').value.trim();
    const project = container.querySelector('#job-project').value.trim();
    const priority = container.querySelector('#job-priority').value;
    const dueDate = container.querySelector('#job-due').value;
    if (!title) return;

    store.update('tarefasJob', data => {
      data.tasks.push({
        id: store.nextId(data.tasks),
        title, description, project, priority, dueDate,
        status: 'todo',
        createdAt: new Date().toISOString()
      });
      return data;
    });
    rerender();
  });

  container.querySelector('#job-title')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') container.querySelector('#job-add')?.click();
  });

  container.querySelectorAll('[data-action="move"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const to = btn.dataset.to;
      store.update('tarefasJob', data => {
        const task = data.tasks.find(t => t.id === id);
        if (task) task.status = to;
        return data;
      });
      rerender();
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      store.update('tarefasJob', data => {
        data.tasks = data.tasks.filter(t => t.id !== id);
        return data;
      });
      rerender();
    });
  });
}
