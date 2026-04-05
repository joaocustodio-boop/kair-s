import { store, today } from '../store.js';
import { refreshIcons } from '../icons.js';
import { getFamilyMembers } from '../auth.js';

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const TYPE_LABELS = { reuniao: 'Reunião', medico: 'Médico', pessoal: 'Pessoal', outro: 'Outro' };

function avatarFromMember(member) {
  const name = String(member?.name || 'Pessoa');
  return member?.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=5850ec&color=fff`;
}

function formatDateLabel(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit'
  });
}

function resolveAttendeeMembers(attendeeIds = [], memberMap = {}) {
  if (!Array.isArray(attendeeIds) || attendeeIds.length === 0) return [];
  return attendeeIds
    .map((id) => memberMap[id])
    .filter(Boolean);
}

function renderAttendeesSummary(attendeeIds = [], memberMap = {}) {
  const attendees = resolveAttendeeMembers(attendeeIds, memberMap);
  if (!attendees.length) return '';

  return `
    <div class="attendees-block">
      <p><strong>Pessoas:</strong></p>
      <div class="attendees-stack">
        ${attendees.map((m) => `
          <span class="attendee-chip" title="${escapeHtml(m.name)}">
            <img src="${escapeHtml(avatarFromMember(m))}" alt="${escapeHtml(m.name)}" class="attendee-chip-avatar" />
            <span>${escapeHtml(m.name)}</span>
          </span>
        `).join('')}
      </div>
    </div>
  `;
}

function renderAttendeesPicker(members, selectedIds = []) {
  if (!members.length) {
    return '<p class="page-subtitle" style="margin:0">Crie/entre em uma família para selecionar pessoas no compromisso.</p>';
  }

  return `
    <div class="event-attendees-grid">
      ${members.map((m) => `
        <label class="event-attendee-option">
          <input type="checkbox" class="event-attendee-check" name="evt-attendees" value="${escapeHtml(m.id)}" ${selectedIds.includes(m.id) ? 'checked' : ''} />
          <img src="${escapeHtml(avatarFromMember(m))}" alt="${escapeHtml(m.name)}" class="event-attendee-avatar" />
          <span>${escapeHtml(m.name)}${m.isDependent ? ' (filho)' : ''}</span>
        </label>
      `).join('')}
    </div>
  `;
}

function renderUpcomingCard(evt, expandedId, memberMap) {
  const isExpanded = expandedId === evt.id;
  const isToday = evt.date === today();
  const summary = `${escapeHtml(evt.title)} · ${formatDateLabel(evt.date)} · ${evt.startTime}${evt.endTime ? ' – ' + evt.endTime : ''}`;

  return `
    <article class="upcoming-card ${isExpanded ? 'expanded' : ''} type-${evt.type}" data-id="${evt.id}">
      <button class="upcoming-line" data-action="toggle-details" data-id="${evt.id}" type="button" title="Abrir detalhes">
        ${isToday ? '<span class="badge" style="font-size:0.625rem">Hoje</span>' : ''}
        <span class="upcoming-line-text">${summary}</span>
      </button>
      ${isExpanded ? `
        <div class="upcoming-details">
          ${evt.location ? `<p><strong>Local:</strong> ${escapeHtml(evt.location)}</p>` : ''}
          ${evt.notes ? `<p><strong>Observações:</strong> ${escapeHtml(evt.notes)}</p>` : ''}
          ${renderAttendeesSummary(evt.attendeeIds || [], memberMap)}
          <div class="upcoming-details-footer">
            <span class="event-type-badge event-type-${evt.type}">${TYPE_LABELS[evt.type] || evt.type}</span>
            <button class="btn-icon danger" data-action="delete" data-id="${evt.id}" type="button" title="Excluir">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      ` : ''}
    </article>
  `;
}

function renderCalendar(events, currentDate = new Date()) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();
  
  const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const eventsByDate = {};
  events.forEach(evt => {
    if (!eventsByDate[evt.date]) eventsByDate[evt.date] = [];
    eventsByDate[evt.date].push(evt);
  });
  
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  let calendarHtml = `
    <div class="calendar">
      <div class="calendar-header">
        <div class="calendar-header-row">
          <button class="btn-icon" data-action="calendar-prev" type="button" title="Mês anterior">
            <i data-lucide="chevron-left"></i>
          </button>
          <h3>${monthName}</h3>
          <button class="btn-icon" data-action="calendar-next" type="button" title="Próximo mês">
            <i data-lucide="chevron-right"></i>
          </button>
        </div>
        <p>Clique em qualquer dia para criar compromisso</p>
      </div>
      <div class="calendar-weekdays">
        ${weekDays.map(day => `<div class="calendar-weekday">${day}</div>`).join('')}
      </div>
      <div class="calendar-days">
  `;
  
  // Empty cells for days before first day of month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarHtml += '<div class="calendar-day empty"></div>';
  }
  
  // Days of month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = dateStr === today();
    const dayEvents = eventsByDate[dateStr] || [];
    
    calendarHtml += `
      <div class="calendar-day-cell ${isToday ? 'today' : ''}">
        <button class="calendar-day-hit" data-action="open-modal-date" data-date="${dateStr}" type="button" title="Adicionar compromisso em ${formatDateLabel(dateStr)}">
          <span class="calendar-day-plus">+</span>
        </button>
        <div class="calendar-day-num">${day}</div>
        <div class="calendar-day-events">
          ${dayEvents.slice(0, 2).map(evt => `
            <button class="calendar-event-mini calendar-event-mini-btn type-${evt.type}" data-action="open-event-detail" data-id="${evt.id}" type="button" title="${escapeHtml(evt.title)}">
              ${escapeHtml(evt.title.substring(0, 10))}
            </button>
          `).join('')}
          ${dayEvents.length > 2 ? `<div class="calendar-event-more">+${dayEvents.length - 2}</div>` : ''}
        </div>
      </div>
    `;
  }
  
  // Empty cells for days after last day of month
  const totalCells = Math.ceil((startingDayOfWeek + daysInMonth) / 7) * 7;
  for (let i = startingDayOfWeek + daysInMonth; i < totalCells; i++) {
    calendarHtml += '<div class="calendar-day empty"></div>';
  }
  
  calendarHtml += '</div></div>';
  return calendarHtml;
}

function renderDetailModal(eventDetail, memberMap) {
  if (!eventDetail) return '';

  return `
    <div class="event-modal is-open" id="event-detail-modal" aria-hidden="false">
      <div class="event-modal-backdrop" data-action="close-detail-modal"></div>
      <div class="event-modal-dialog">
        <div class="event-modal-header">
          <h3>${escapeHtml(eventDetail.title)}</h3>
          <button class="btn-icon" data-action="close-detail-modal" type="button" title="Fechar">
            <i data-lucide="x"></i>
          </button>
        </div>

        <div class="upcoming-details" style="border-top:0;padding:0 0 8px 0;">
          <p><strong>Data:</strong> ${formatDateLabel(eventDetail.date)}</p>
          <p><strong>Horário:</strong> ${eventDetail.startTime}${eventDetail.endTime ? ' – ' + eventDetail.endTime : ''}</p>
          ${eventDetail.location ? `<p><strong>Local:</strong> ${escapeHtml(eventDetail.location)}</p>` : ''}
          ${eventDetail.notes ? `<p><strong>Observações:</strong> ${escapeHtml(eventDetail.notes)}</p>` : ''}
          ${renderAttendeesSummary(eventDetail.attendeeIds || [], memberMap)}
          <div class="upcoming-details-footer">
            <span class="event-type-badge event-type-${eventDetail.type}">${TYPE_LABELS[eventDetail.type] || eventDetail.type}</span>
            <button class="btn-icon danger" data-action="delete" data-id="${eventDetail.id}" type="button" title="Excluir">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderModal(showModal, selectedDate, members, selectedAttendees = []) {
  return `
    <div class="event-modal ${showModal ? 'is-open' : ''}" id="event-modal" aria-hidden="${showModal ? 'false' : 'true'}">
      <div class="event-modal-backdrop" data-action="close-modal"></div>
      <div class="event-modal-dialog">
        <div class="event-modal-header">
          <h3>Novo Compromisso</h3>
          <button class="btn-icon" data-action="close-modal" type="button" title="Fechar">
            <i data-lucide="x"></i>
          </button>
        </div>

        <div class="form-row">
          <input type="text" id="evt-title" class="form-input" placeholder="Título do compromisso..." />
        </div>
        <div class="form-row form-row-inline">
          <div class="form-group" style="flex:1">
            <label class="form-label">Data</label>
            <input type="date" id="evt-date" class="form-input" value="${selectedDate}" />
          </div>
          <div class="form-group">
            <label class="form-label">Início</label>
            <input type="time" id="evt-start" class="form-input" value="09:00" style="max-width:120px" />
          </div>
          <div class="form-group">
            <label class="form-label">Término</label>
            <input type="time" id="evt-end" class="form-input" style="max-width:120px" />
          </div>
        </div>
        <div class="form-row form-row-inline">
          <input type="text" id="evt-location" class="form-input" placeholder="Local / Link..." />
          <select id="evt-type" class="form-select" style="max-width:160px">
            <option value="reuniao">Reunião</option>
            <option value="pessoal">Pessoal</option>
            <option value="medico">Médico</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div class="form-row">
          <input type="text" id="evt-notes" class="form-input" placeholder="Observações (opcional)..." />
        </div>
        <div class="form-row">
          <div style="width:100%">
            <label class="form-label">Pessoas do compromisso</label>
            ${renderAttendeesPicker(members, selectedAttendees)}
          </div>
        </div>
        <div class="event-modal-actions">
          <button class="btn btn-secondary" data-action="close-modal" type="button">Cancelar</button>
          <button class="btn btn-primary" id="evt-add" type="button">
            <i data-lucide="plus"></i> Salvar Compromisso
          </button>
        </div>
      </div>
    </div>
  `;
}

export function render(state = {}) {
  const {
    showModal = false,
    selectedDate = today(),
    expandedId = null,
    currentMonth = new Date(),
    detailEventId = null,
    selectedAttendees = [],
  } = state;
  const { events } = store.get('agenda');
  const members = getFamilyMembers();
  const memberMap = Object.fromEntries(members.map((m) => [m.id, m]));
  const t = today();
  const upcoming = events.filter(e => e.date >= t).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  const eventDetail = detailEventId ? events.find(evt => evt.id === detailEventId) : null;

  return `
    <div class="page-agenda">
      <div class="page-header">
        <div>
          <h2 class="page-title">Compromissos</h2>
          <p class="page-subtitle">${upcoming.length} próximo${upcoming.length !== 1 ? 's' : ''}</p>
        </div>
        <button class="btn btn-primary" id="open-event-modal" type="button">
          <i data-lucide="plus"></i> Novo compromisso
        </button>
      </div>

      <div class="content-section">
        <h3 class="section-label">📅 Próximos Compromissos</h3>
        <div class="upcoming-row" id="event-list">
          ${upcoming.length ? upcoming.map(evt => renderUpcomingCard(evt, expandedId, memberMap)).join('') : '<p class="empty-state">Nenhum compromisso futuro</p>'}
        </div>
      </div>

      <div class="content-section">
        <h3 class="section-label">📋 Visualização em Calendário</h3>
        <div id="calendar-view">
          ${renderCalendar(events, currentMonth)}
        </div>
      </div>

      ${renderModal(showModal, selectedDate, members, selectedAttendees)}
      ${renderDetailModal(eventDetail, memberMap)}
    </div>
  `;
}

export function init(container, stateArg) {
  const state = stateArg || {
    showModal: false,
    selectedDate: today(),
    expandedId: null,
    currentMonth: new Date(),
    detailEventId: null,
    selectedAttendees: [],
  };

  function rerender() {
    container.innerHTML = render(state);
    refreshIcons();
    init(container, state);
  }

  function closeModal() {
    state.showModal = false;
    rerender();
  }

  function closeDetailModal() {
    state.detailEventId = null;
    rerender();
  }

  function openModal(dateValue = today()) {
    state.selectedDate = dateValue;
    state.selectedAttendees = [];
    state.showModal = true;
    rerender();
  }

  function addEventFromModal() {
    const title = String(container.querySelector('#evt-title')?.value || '').trim();
    const date = String(container.querySelector('#evt-date')?.value || '').trim();
    const startTime = String(container.querySelector('#evt-start')?.value || '').trim();
    const endTime = String(container.querySelector('#evt-end')?.value || '').trim();
    const location = String(container.querySelector('#evt-location')?.value || '').trim();
    const type = String(container.querySelector('#evt-type')?.value || 'outro').trim();
    const notes = String(container.querySelector('#evt-notes')?.value || '').trim();
    const attendeeIds = Array.from(container.querySelectorAll('input[name="evt-attendees"]:checked'))
      .map((el) => String(el.value || '').trim())
      .filter(Boolean);

    if (!title || !date || !startTime) return;

    store.update('agenda', data => {
      data.events.push({
        id: store.nextId(data.events),
        title, date, startTime, endTime, location, type, notes, attendeeIds
      });
      return data;
    });

    state.showModal = false;
    state.selectedDate = date;
    state.selectedAttendees = [];
    rerender();
  }

  container.querySelectorAll('[data-action="calendar-prev"]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() - 1, 1);
      rerender();
    });
  });

  container.querySelectorAll('[data-action="calendar-next"]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() + 1, 1);
      rerender();
    });
  });

  container.querySelector('#open-event-modal')?.addEventListener('click', () => {
    openModal(today());
  });

  container.querySelectorAll('[data-action="open-modal-date"]').forEach(dayBtn => {
    dayBtn.addEventListener('click', () => {
      const dateValue = String(dayBtn.dataset.date || today());
      openModal(dateValue);
    });
  });

  container.querySelectorAll('[data-action="open-event-detail"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(String(btn.dataset.id), 10);
      state.detailEventId = Number.isNaN(id) ? null : id;
      rerender();
    });
  });

  container.querySelectorAll('[data-action="close-modal"]').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  container.querySelectorAll('[data-action="close-detail-modal"]').forEach(btn => {
    btn.addEventListener('click', closeDetailModal);
  });

  container.querySelector('#evt-add')?.addEventListener('click', addEventFromModal);

  container.querySelector('#evt-title')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') addEventFromModal();
  });

  container.querySelectorAll('[data-action="toggle-details"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(String(btn.dataset.id), 10);
      state.expandedId = state.expandedId === id ? null : id;
      rerender();
    });
  });

  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(String(btn.dataset.id), 10);
      store.update('agenda', data => {
        data.events = data.events.filter(e => e.id !== id);
        return data;
      });
      if (state.expandedId === id) state.expandedId = null;
      if (state.detailEventId === id) state.detailEventId = null;
      rerender();
    });
  });
}
