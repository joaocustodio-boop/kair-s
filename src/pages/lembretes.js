import { store } from '../store.js';
import { refreshIcons } from '../icons.js';
import { getCurrentUser, getCurrentFamily, getFamilyMembers, createFamily, findFamilyByCode, requestFamilyJoinByCode } from '../auth.js';

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderTask(task) {
  const priorityLabel = { high: 'Alta', medium: 'Média', low: 'Baixa' }[task.priority] || task.priority;
  const members = getFamilyMembers();
  const assignedName = members.find((m) => m.id === task.assignedTo)?.name || 'Sem responsável';

  return `
    <div class="task-row ${task.completed ? 'completed' : ''}" data-id="${task.id}">
      <button class="task-check-btn" data-action="toggle" data-id="${task.id}">
        <i data-lucide="${task.completed ? 'circle-check' : 'circle'}"></i>
      </button>
      <div class="task-info">
        <span class="task-text">${escapeHtml(task.text)}</span>
        <div class="task-meta">
          <span class="priority-badge priority-${task.priority}">${priorityLabel}</span>
          <span class="tag">Para: ${escapeHtml(assignedName)}</span>
        </div>
      </div>
      <button class="btn-icon danger" data-action="delete" data-id="${task.id}">
        <i data-lucide="trash-2"></i>
      </button>
    </div>
  `;
}

export function render(filter = 'all') {
  const { tasks } = store.get('lembretes');
  const user = getCurrentUser();
  const family = getCurrentFamily();
  const members = getFamilyMembers();
  let filtered = tasks;
  if (filter === 'my') filtered = tasks.filter((t) => t.assignedTo === user?.id);
  if (filter === 'done') filtered = tasks.filter(t => t.completed);

  const pending = filtered.filter(t => !t.completed);
  const done = filtered.filter(t => t.completed);
  const totalPending = tasks.filter(t => !t.completed).length;

  return `
    <div class="page-lembretes">
      <div class="page-header">
        <div>
          <h2 class="page-title">Tarefas</h2>
          <p class="page-subtitle">${totalPending} pendente${totalPending !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div class="add-section">
        <h3 class="form-title">Modo Família</h3>
        ${family ? `
          <p class="page-subtitle">Família: <strong>${escapeHtml(family.name)}</strong> | Código: <strong>${escapeHtml(family.code)}</strong></p>
          <p class="page-subtitle">Membros: ${members.map((m) => escapeHtml(m.name)).join(', ')}</p>
        ` : `
          <div class="form-row form-row-inline">
            <input type="text" id="family-name-input" class="form-input" placeholder="Nome da família" />
            <button class="btn btn-secondary" id="create-family-btn" type="button">
              <i data-lucide="users"></i> Criar família
            </button>
          </div>
          <div class="form-row form-row-inline">
            <input type="text" id="family-code-input" class="form-input" placeholder="Código para entrar" />
            <button class="btn btn-secondary" id="join-family-btn" type="button">
              <i data-lucide="send"></i> Solicitar acesso
            </button>
          </div>
        `}
      </div>

      <div class="add-section">
        <h3 class="form-title">Nova Tarefa</h3>
        <div class="form-row">
          <input type="text" id="task-input" class="form-input" placeholder="Descrição da tarefa..." />
        </div>
        <div class="form-row form-row-inline">
          <select id="task-priority" class="form-select">
            <option value="low">Prioridade Baixa</option>
            <option value="medium" selected>Prioridade Média</option>
            <option value="high">Prioridade Alta</option>
          </select>
          <select id="task-assignee" class="form-select">
            ${members.map((m) => `<option value="${m.id}" ${m.id === user?.id ? 'selected' : ''}>Para: ${escapeHtml(m.name)}</option>`).join('')}
          </select>
          <button class="btn btn-primary" id="add-task-btn">
            <i data-lucide="plus"></i> Adicionar
          </button>
        </div>
      </div>

      <div class="filter-tabs">
        <button class="filter-tab ${filter === 'all' ? 'active' : ''}" data-filter="all">Todas</button>
        <button class="filter-tab ${filter === 'my' ? 'active' : ''}" data-filter="my">Atribuídas a mim</button>
        <button class="filter-tab ${filter === 'done' ? 'active' : ''}" data-filter="done">Concluídas</button>
      </div>

      <div class="content-section">
        <h3 class="section-label">Pendentes (${pending.length})</h3>
        <div id="pending-tasks">
          ${pending.length ? pending.map(renderTask).join('') : '<p class="empty-state">Nenhuma tarefa pendente! 🎉</p>'}
        </div>
      </div>

      ${done.length > 0 ? `
      <div class="content-section">
        <h3 class="section-label">Concluídas (${done.length})</h3>
        <div id="done-tasks">
          ${done.map(renderTask).join('')}
        </div>
      </div>
      ` : ''}
    </div>
  `;
}

export function init(container, filter = 'all') {
  const currentUser = getCurrentUser();

  function rerender(f = filter) {
    container.innerHTML = render(f);
    refreshIcons();
    init(container, f);
  }

  container.querySelector('#create-family-btn')?.addEventListener('click', async () => {
    const name = String(container.querySelector('#family-name-input')?.value || '').trim();
    try {
      await createFamily(name);
      rerender();
    } catch (err) {
      alert(err?.message || 'Não foi possível criar a família.');
    }
  });

  container.querySelector('#join-family-btn')?.addEventListener('click', async () => {
    const code = String(container.querySelector('#family-code-input')?.value || '').trim();
    try {
      const foundFamily = await findFamilyByCode(code);
      if (!foundFamily) {
        alert('Código de família não encontrado.');
        return;
      }
      await requestFamilyJoinByCode(code);
      alert('Solicitação enviada para o criador da família.');
      rerender();
    } catch (err) {
      alert(err?.message || 'Não foi possível solicitar acesso à família.');
    }
  });

  container.querySelector('#add-task-btn')?.addEventListener('click', () => {
    const input = container.querySelector('#task-input');
    const priority = container.querySelector('#task-priority').value;
    const assignedTo = String(container.querySelector('#task-assignee')?.value || currentUser?.id || '');
    const text = input.value.trim();
    if (!text) return;

    store.update('lembretes', data => {
      data.tasks.unshift({
        id: store.nextId(data.tasks),
        text, priority,
        assignedTo,
        createdBy: currentUser?.id || null,
        completed: false,
        createdAt: new Date().toISOString()
      });
      return data;
    });
    rerender();
  });

  container.querySelector('#task-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') container.querySelector('#add-task-btn')?.click();
  });

  container.querySelectorAll('[data-action="toggle"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      store.update('lembretes', data => {
        const task = data.tasks.find(t => t.id === id);
        if (task) task.completed = !task.completed;
        return data;
      });
      rerender();
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      store.update('lembretes', data => {
        data.tasks = data.tasks.filter(t => t.id !== id);
        return data;
      });
      rerender();
    });
  });

  container.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      rerender(tab.dataset.filter);
    });
  });
}
