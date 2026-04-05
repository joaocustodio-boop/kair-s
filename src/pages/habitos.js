import { store, today } from '../store.js';
import { refreshIcons } from '../icons.js';

const ICONS = [
  { value: 'droplets', label: 'Água' },
  { value: 'sparkles', label: 'Bem-estar' },
  { value: 'book-open', label: 'Leitura' },
  { value: 'activity', label: 'Atividade' },
  { value: 'heart', label: 'Saúde' },
  { value: 'flame', label: 'Foco' },
  { value: 'star', label: 'Meta' },
  { value: 'dumbbell', label: 'Treino' },
  { value: 'zap', label: 'Energia' },
  { value: 'pill', label: 'Remédio' },
];
const WEEKDAY_OPTIONS = [
  { key: 'sun', label: 'Dom' },
  { key: 'mon', label: 'Seg' },
  { key: 'tue', label: 'Ter' },
  { key: 'wed', label: 'Qua' },
  { key: 'thu', label: 'Qui' },
  { key: 'fri', label: 'Sex' },
  { key: 'sat', label: 'Sab' },
];
let _habitReminderOpenId = null;
let _vitaminReminderOpenId = null;
let _habitReminderTickerId = null;
let _selectedDate = today();
let _deleteDialog = null;

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function shiftDate(dateStr, deltaDays) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().split('T')[0];
}

function formatDateLabel(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function isTodayDate(dateStr) {
  return dateStr === today();
}

function isValidDateStr(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function toDateOnly(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (isValidDateStr(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
  return null;
}

function inferCreatedAt(item) {
  const createdAt = toDateOnly(item?.createdAt);
  if (createdAt) return createdAt;
  const completed = Array.isArray(item?.completedDates) ? item.completedDates.filter(isValidDateStr).sort() : [];
  return completed[0] || today();
}

function normalizeRetiredAt(item) {
  return toDateOnly(item?.retiredAt);
}

function normalizeExcludedDates(item) {
  if (!Array.isArray(item?.excludedDates)) return [];
  return item.excludedDates.filter(isValidDateStr);
}

function isItemActiveOnDate(item, dateStr = _selectedDate) {
  const createdAt = inferCreatedAt(item);
  const retiredAt = normalizeRetiredAt(item);
  const excludedDates = normalizeExcludedDates(item);
  if (dateStr < createdAt) return false;
  if (retiredAt && dateStr >= retiredAt) return false;
  if (excludedDates.includes(dateStr)) return false;
  return true;
}

function openDeleteDialog(kind, id, name) {
  _deleteDialog = {
    kind,
    id,
    name,
    date: _selectedDate,
    mode: null,
  };
}

function closeDeleteDialog() {
  _deleteDialog = null;
}

function applyDeleteModeToItem(item, mode, dateStr) {
  if (mode === 'all') return null;

  if (mode === 'single') {
    const excludedDates = Array.from(new Set([...normalizeExcludedDates(item), dateStr]));
    return {
      ...item,
      excludedDates,
      completedDates: (item.completedDates || []).filter((d) => String(d) !== dateStr),
    };
  }

  const createdAt = inferCreatedAt(item);
  if (dateStr <= createdAt) return null;

  return {
    ...item,
    retiredAt: dateStr,
    excludedDates: normalizeExcludedDates(item).filter((d) => d < dateStr),
    completedDates: (item.completedDates || []).filter((d) => String(d) < dateStr),
  };
}

function renderDeleteDialog() {
  if (!_deleteDialog) return '';
  const typeLabel = _deleteDialog.kind === 'habit' ? 'hábito' : 'vitamina';
  const name = escapeHtml(_deleteDialog.name || 'item');
  const dateLabel = escapeHtml(formatDateLabel(_deleteDialog.date));
  const selectedMode = _deleteDialog.mode;
  const isSelected = (mode) => (selectedMode === mode ? 'is-selected' : '');
  return `
    <div class="modal-overlay" data-action="delete-overlay">
      <div class="modal delete-scope-modal" role="dialog" aria-modal="true" aria-labelledby="delete-scope-title">
        <div class="modal-header" style="margin-bottom: 12px;">
          <h3 class="modal-title" id="delete-scope-title">Como deseja excluir?</h3>
        </div>
        <p class="delete-scope-subtitle">
          Você está excluindo o ${typeLabel} <strong>${name}</strong> na data <strong>${dateLabel}</strong>.
        </p>
        <div class="delete-scope-grid">
          <button class="delete-scope-option ${isSelected('all')}" data-action="delete-scope" data-mode="all">
            <strong>Toda a série</strong>
            <span>Remove o item para todas as datas.</span>
          </button>
          <button class="delete-scope-option ${isSelected('single')}" data-action="delete-scope" data-mode="single">
            <strong>Apenas essa</strong>
            <span>Remove somente nesta data.</span>
          </button>
          <button class="delete-scope-option ${isSelected('forward')}" data-action="delete-scope" data-mode="forward">
            <strong>Essa e futuras</strong>
            <span>Remove desta data em diante.</span>
          </button>
        </div>
        <div class="modal-footer" style="margin-top: 14px;">
          <button class="btn btn-danger" data-action="delete-confirm" ${selectedMode ? '' : 'disabled'}>
            Excluir agora
          </button>
          <button class="btn btn-secondary" data-action="delete-cancel">Cancelar</button>
        </div>
      </div>
    </div>
  `;
}

function calcStreak(completedDates) {
  if (!completedDates.length) return 0;
  const sorted = [...completedDates].sort().reverse();
  let streak = 0;
  const now = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    if (sorted.includes(ds)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

function normalizeHabitReminder(reminder) {
  const base = reminder && typeof reminder === 'object' ? reminder : {};
  const legacyHourly = base.recurrence === 'hourly-8-20';
  const intervalHours = Number.parseInt(base.intervalHours, 10);
  const weekdays = Array.isArray(base.weekdays) && base.weekdays.length
    ? base.weekdays.filter((day) => WEEKDAY_OPTIONS.some((option) => option.key === day))
    : WEEKDAY_OPTIONS.map((day) => day.key);
  return {
    enabled: !!base.enabled,
    recurrence: base.recurrence === 'recurring' || legacyHourly ? 'recurring' : 'fixed',
    time: /^\d{2}:\d{2}$/.test(String(base.time || '')) ? String(base.time) : '08:00',
    intervalHours: Number.isFinite(intervalHours) && intervalHours >= 1 && intervalHours <= 12 ? intervalHours : 1,
    windowStart: /^\d{2}:\d{2}$/.test(String(base.windowStart || '')) ? String(base.windowStart) : '08:00',
    windowEnd: /^\d{2}:\d{2}$/.test(String(base.windowEnd || '')) ? String(base.windowEnd) : '20:00',
    weekdays,
    lastNotifiedDate: base.lastNotifiedDate || null,
    lastNotifiedSlot: base.lastNotifiedSlot || null,
  };
}

function getCurrentWeekdayKey(dateStr = today()) {
  const day = new Date(`${dateStr}T12:00:00`).getDay();
  return WEEKDAY_OPTIONS[day]?.key || 'sun';
}

function isReminderDue(reminderTime, now = new Date()) {
  const [hour, minute] = String(reminderTime || '08:00').split(':').map((n) => Number.parseInt(n, 10));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  const due = new Date(now);
  due.setHours(hour, minute, 0, 0);
  return now >= due;
}

function parseTimeToMinutes(value) {
  const [hour, minute] = String(value || '').split(':').map((n) => Number.parseInt(n, 10));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return (hour * 60) + minute;
}

function formatTimeShort(value) {
  const [hour, minute] = String(value || '').split(':');
  if (minute === '00') return `${Number.parseInt(hour || '0', 10)}h`;
  return `${hour}:${minute}`;
}

function getReminderStatusLabel(reminder) {
  if (!reminder.enabled) return 'Sem lembrete';
  if (reminder.recurrence === 'recurring') {
    return `A cada ${reminder.intervalHours}h, das ${formatTimeShort(reminder.windowStart)} às ${formatTimeShort(reminder.windowEnd)}`;
  }
  return `Lembrete ${reminder.time}`;
}

function getRecurringReminderSlot(reminder, now = new Date()) {
  const intervalMinutes = reminder.intervalHours * 60;
  const startMinutes = parseTimeToMinutes(reminder.windowStart);
  const endMinutes = parseTimeToMinutes(reminder.windowEnd);
  const currentMinutes = (now.getHours() * 60) + now.getMinutes();

  if (startMinutes === null || endMinutes === null || intervalMinutes <= 0) return null;
  if (startMinutes > endMinutes) return null;
  if (currentMinutes < startMinutes) return null;

  let slotMinutes = startMinutes;
  while ((slotMinutes + intervalMinutes) <= endMinutes && (slotMinutes + intervalMinutes) <= currentMinutes) {
    slotMinutes += intervalMinutes;
  }

  if (slotMinutes > endMinutes || slotMinutes > currentMinutes) return null;

  const hour = String(Math.floor(slotMinutes / 60)).padStart(2, '0');
  const minute = String(slotMinutes % 60).padStart(2, '0');
  return `${today()}-${hour}:${minute}`;
}

function getReminderNotificationState(reminder, now = new Date()) {
  if (!reminder.enabled) return { shouldNotify: false, slotKey: null };
  if (!reminder.weekdays.includes(getCurrentWeekdayKey())) return { shouldNotify: false, slotKey: null };
  if (reminder.recurrence === 'recurring') {
    const slotKey = getRecurringReminderSlot(reminder, now);
    if (!slotKey) return { shouldNotify: false, slotKey: null };
    if (reminder.lastNotifiedSlot === slotKey) return { shouldNotify: false, slotKey };
    return { shouldNotify: true, slotKey };
  }

  if (reminder.lastNotifiedDate === today()) return { shouldNotify: false, slotKey: today() };
  if (!isReminderDue(reminder.time, now)) return { shouldNotify: false, slotKey: today() };
  return { shouldNotify: true, slotKey: today() };
}

function ensureHabitReminderTicker() {
  if (_habitReminderTickerId !== null) return;
  _habitReminderTickerId = window.setInterval(() => {
    maybeTriggerHabitReminders();
  }, 60000);
}

function maybeTriggerHabitReminders() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const data = getHabitosData();
  const now = new Date();
  const t = today();
  const notifiedIds = [];
  const notifiedVitaminIds = [];

  for (const habit of data.habits) {
    if (!isItemActiveOnDate(habit, t)) continue;
    const reminder = normalizeHabitReminder(habit.reminder);
    const doneToday = Array.isArray(habit.completedDates) && habit.completedDates.includes(t);
    const notificationState = getReminderNotificationState(reminder, now);
    if (!reminder.enabled || doneToday) continue;
    if (!notificationState.shouldNotify) continue;

    new Notification('Lembrete de hábito', {
      body: `Hora de: ${habit.name}`,
      tag: `habit-reminder-${habit.id}`,
      renotify: false,
    });
    notifiedIds.push({ id: habit.id, slotKey: notificationState.slotKey });
  }

  for (const vitamin of (data.vitamins || [])) {
    if (!isItemActiveOnDate(vitamin, t)) continue;
    const reminder = normalizeHabitReminder(vitamin.reminder);
    const doneToday = Array.isArray(vitamin.completedDates) && vitamin.completedDates.includes(t);
    const notificationState = getReminderNotificationState(reminder, now);
    if (!reminder.enabled || doneToday) continue;
    if (!notificationState.shouldNotify) continue;

    new Notification('Lembrete de vitamina', {
      body: `Hora de tomar: ${vitamin.name}`,
      tag: `vitamin-reminder-${vitamin.id}`,
      renotify: false,
    });
    notifiedVitaminIds.push({ id: vitamin.id, slotKey: notificationState.slotKey });
  }

  if (!notifiedIds.length && !notifiedVitaminIds.length) return;

  store.update('habitos', (updated) => {
    updated.habits = (updated.habits || []).map((habit) => {
      const notified = notifiedIds.find((entry) => entry.id === habit.id);
      if (!notified) return habit;
      return {
        ...habit,
        reminder: {
          ...normalizeHabitReminder(habit.reminder),
          lastNotifiedDate: t,
          lastNotifiedSlot: notified.slotKey,
        },
      };
    });
    updated.vitamins = (updated.vitamins || []).map((vitamin) => {
      const notified = notifiedVitaminIds.find((entry) => entry.id === vitamin.id);
      if (!notified) return vitamin;
      return {
        ...vitamin,
        reminder: {
          ...normalizeHabitReminder(vitamin.reminder),
          lastNotifiedDate: t,
          lastNotifiedSlot: notified.slotKey,
        },
      };
    });
    return updated;
  });
}

function getHabitosData() {
  const data = store.get('habitos');
  if (!Array.isArray(data.habits)) data.habits = [];
  let shouldPersist = false;

  data.habits = data.habits.map((habit) => {
    const normalizedCompleted = Array.isArray(habit.completedDates) ? habit.completedDates : [];
    const normalizedReminder = normalizeHabitReminder(habit.reminder);
    const createdAt = inferCreatedAt(habit);
    const retiredAt = normalizeRetiredAt(habit);
    const excludedDates = normalizeExcludedDates(habit);
    const changedCompleted = normalizedCompleted !== habit.completedDates;
    const changedReminder = JSON.stringify(normalizedReminder) !== JSON.stringify(habit.reminder || {});
    const changedCreatedAt = createdAt !== habit.createdAt;
    const changedRetiredAt = retiredAt !== habit.retiredAt;
    const changedExcludedDates = JSON.stringify(excludedDates) !== JSON.stringify(habit.excludedDates || []);
    if (changedCompleted || changedReminder || changedCreatedAt || changedRetiredAt || changedExcludedDates) shouldPersist = true;
    return {
      ...habit,
      createdAt,
      retiredAt,
      excludedDates,
      completedDates: normalizedCompleted,
      reminder: normalizedReminder,
    };
  });

  if (!Array.isArray(data.vitamins)) {
    const exerciciosData = store.get('exercicios');
    data.vitamins = Array.isArray(exerciciosData?.vitamins) ? exerciciosData.vitamins : [];
    shouldPersist = true;
  }

  data.vitamins = data.vitamins.map((vitamin) => {
    const normalizedCompleted = Array.isArray(vitamin.completedDates) ? vitamin.completedDates : [];
    const normalizedReminder = normalizeHabitReminder(vitamin.reminder);
    const createdAt = inferCreatedAt(vitamin);
    const retiredAt = normalizeRetiredAt(vitamin);
    const excludedDates = normalizeExcludedDates(vitamin);
    const changedCompleted = normalizedCompleted !== vitamin.completedDates;
    const changedReminder = JSON.stringify(normalizedReminder) !== JSON.stringify(vitamin.reminder || {});
    const changedCreatedAt = createdAt !== vitamin.createdAt;
    const changedRetiredAt = retiredAt !== vitamin.retiredAt;
    const changedExcludedDates = JSON.stringify(excludedDates) !== JSON.stringify(vitamin.excludedDates || []);
    if (changedCompleted || changedReminder || changedCreatedAt || changedRetiredAt || changedExcludedDates) shouldPersist = true;
    return {
      ...vitamin,
      createdAt,
      retiredAt,
      excludedDates,
      completedDates: normalizedCompleted,
      reminder: normalizedReminder,
    };
  });

  if (shouldPersist) store.set('habitos', data);

  return data;
}

function renderReminderPanel(kind, id, reminder) {
  const enabledAttr = kind === 'habit' ? `data-reminder-enabled="${id}"` : `data-vitamin-reminder-enabled="${id}"`;
  const modeAttr = kind === 'habit' ? `data-reminder-mode="${id}"` : `data-vitamin-reminder-mode="${id}"`;
  const timeAttr = kind === 'habit' ? `data-reminder-time="${id}"` : `data-vitamin-reminder-time="${id}"`;
  const intervalAttr = kind === 'habit' ? `data-reminder-interval="${id}"` : `data-vitamin-reminder-interval="${id}"`;
  const startAttr = kind === 'habit' ? `data-reminder-start="${id}"` : `data-vitamin-reminder-start="${id}"`;
  const endAttr = kind === 'habit' ? `data-reminder-end="${id}"` : `data-vitamin-reminder-end="${id}"`;
  const weekdayAttr = kind === 'habit' ? 'data-reminder-weekday' : 'data-vitamin-reminder-weekday';
  const saveAction = kind === 'habit' ? 'save-reminder' : 'save-vitamin-reminder';
  const title = kind === 'habit' ? 'Ativar lembrete deste hábito' : 'Ativar lembrete desta vitamina';
  const fixedGroupAttr = kind === 'habit' ? `data-reminder-fixed-group="${id}"` : `data-vitamin-reminder-fixed-group="${id}"`;
  const recurringGroupAttr = kind === 'habit' ? `data-reminder-recurring-group="${id}"` : `data-vitamin-reminder-recurring-group="${id}"`;

  return `
    <div class="habit-reminder-panel">
      <div class="habit-reminder-help">
        Escolha entre um horário fixo ou um lembrete recorrente com intervalo e faixa de horário.
      </div>
      <label class="reminder-toggle">
        <input type="checkbox" ${enabledAttr} ${reminder.enabled ? 'checked' : ''} />
        <span>${title}</span>
      </label>
      <div class="habit-reminder-weekdays">
        <span class="habit-reminder-weekdays-label">Dias da semana</span>
        <div class="habit-reminder-weekdays-grid">
          ${WEEKDAY_OPTIONS.map((day) => `
            <label class="habit-reminder-day ${reminder.weekdays.includes(day.key) ? 'active' : ''}">
              <input type="checkbox" ${weekdayAttr}="${id}" value="${day.key}" ${reminder.weekdays.includes(day.key) ? 'checked' : ''} />
              <span>${day.label}</span>
            </label>
          `).join('')}
        </div>
      </div>
      <div class="habit-reminder-fields">
        <label class="habit-reminder-field">
          <span>Tipo</span>
          <select class="form-select habit-reminder-mode" ${modeAttr}>
            <option value="fixed" ${reminder.recurrence === 'fixed' ? 'selected' : ''}>Horário fixo</option>
            <option value="recurring" ${reminder.recurrence === 'recurring' ? 'selected' : ''}>Recorrente ajustável</option>
          </select>
        </label>
        <div class="habit-reminder-group ${reminder.recurrence === 'fixed' ? '' : 'is-hidden'}" ${fixedGroupAttr}>
          <label class="habit-reminder-field">
            <span>Hora fixa</span>
            <input type="time" class="form-input" ${timeAttr} value="${reminder.time}" ${reminder.enabled ? '' : 'disabled'} />
          </label>
        </div>
        <div class="habit-reminder-group habit-reminder-group-recurring ${reminder.recurrence === 'recurring' ? '' : 'is-hidden'}" ${recurringGroupAttr}>
          <label class="habit-reminder-field">
            <span>Intervalo</span>
            <input type="number" class="form-input habit-reminder-step" ${intervalAttr} value="${reminder.intervalHours}" min="1" max="12" ${reminder.enabled ? '' : 'disabled'} placeholder="Ex: 1" />
          </label>
          <label class="habit-reminder-field">
            <span>Início</span>
            <input type="time" class="form-input" ${startAttr} value="${reminder.windowStart}" ${reminder.enabled ? '' : 'disabled'} />
          </label>
          <label class="habit-reminder-field">
            <span>Fim</span>
            <input type="time" class="form-input" ${endAttr} value="${reminder.windowEnd}" ${reminder.enabled ? '' : 'disabled'} />
          </label>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" data-action="${saveAction}" data-id="${id}">
        <i data-lucide="save"></i> Salvar lembrete
      </button>
    </div>`;
}

function _syncReminderFields(container, kind, id) {
  const isHabit = kind === 'habit';
  const enabledInput = container.querySelector(isHabit ? `[data-reminder-enabled="${id}"]` : `[data-vitamin-reminder-enabled="${id}"]`);
  const modeInput = container.querySelector(isHabit ? `[data-reminder-mode="${id}"]` : `[data-vitamin-reminder-mode="${id}"]`);
  const timeInput = container.querySelector(isHabit ? `[data-reminder-time="${id}"]` : `[data-vitamin-reminder-time="${id}"]`);
  const intervalInput = container.querySelector(isHabit ? `[data-reminder-interval="${id}"]` : `[data-vitamin-reminder-interval="${id}"]`);
  const startInput = container.querySelector(isHabit ? `[data-reminder-start="${id}"]` : `[data-vitamin-reminder-start="${id}"]`);
  const endInput = container.querySelector(isHabit ? `[data-reminder-end="${id}"]` : `[data-vitamin-reminder-end="${id}"]`);
  const fixedGroup = container.querySelector(isHabit ? `[data-reminder-fixed-group="${id}"]` : `[data-vitamin-reminder-fixed-group="${id}"]`);
  const recurringGroup = container.querySelector(isHabit ? `[data-reminder-recurring-group="${id}"]` : `[data-vitamin-reminder-recurring-group="${id}"]`);
  const enabled = !!enabledInput?.checked;
  const recurring = modeInput?.value === 'recurring';

  if (timeInput) timeInput.disabled = !enabled || recurring;
  if (intervalInput) intervalInput.disabled = !enabled || !recurring;
  if (startInput) startInput.disabled = !enabled || !recurring;
  if (endInput) endInput.disabled = !enabled || !recurring;
  fixedGroup?.classList.toggle('is-hidden', recurring);
  recurringGroup?.classList.toggle('is-hidden', !recurring);
}

function renderHabit(h) {
  const isActiveOnSelectedDate = isItemActiveOnDate(h, _selectedDate);
  const done = h.completedDates.includes(_selectedDate);
  const streak = calcStreak(h.completedDates);
  const reminder = normalizeHabitReminder(h.reminder);
  const isReminderOpen = _habitReminderOpenId === h.id;
  const reminderLabel = getReminderStatusLabel(reminder);

  return `
    <div class="habit-card ${done ? 'done' : ''} ${isActiveOnSelectedDate ? '' : 'inactive-on-date'}" data-id="${h.id}">
      <div class="habit-item ${done ? 'done' : ''}" data-id="${h.id}">
        <button class="habit-toggle" data-action="toggle" data-id="${h.id}" ${isActiveOnSelectedDate ? '' : 'disabled'}>
          <i data-lucide="check"></i>
        </button>
        <div class="habit-icon">
          <i data-lucide="${h.icon}"></i>
        </div>
        <div class="habit-info">
          <span class="habit-name">${escapeHtml(h.name)}</span>
          <span class="habit-streak">
            ${streak > 0 ? `🔥 <span>${streak} dia${streak !== 1 ? 's' : ''}</span> seguido${streak !== 1 ? 's' : ''}` : 'Comece hoje!'}
          </span>
          <span class="habit-reminder-status ${reminder.enabled ? 'on' : ''}">
            <i data-lucide="bell"></i> ${escapeHtml(reminderLabel)}
          </span>
          ${isActiveOnSelectedDate ? '' : `<span class="habit-streak">Disponível a partir de ${escapeHtml(formatDateLabel(inferCreatedAt(h)))}</span>`}
        </div>
        <button class="btn btn-secondary btn-sm habit-reminder-btn" data-action="open-reminder" data-id="${h.id}">
          <i data-lucide="bell-ring"></i> Lembrete
        </button>
        <button class="btn-icon danger" data-action="delete" data-id="${h.id}">
          <i data-lucide="trash-2"></i>
        </button>
      </div>

      ${isReminderOpen ? renderReminderPanel('habit', h.id, reminder) : ''}
    </div>
  `;
}

function renderVitamin(v) {
  const isActiveOnSelectedDate = isItemActiveOnDate(v, _selectedDate);
  const done = (v.completedDates || []).includes(_selectedDate);
  const reminder = normalizeHabitReminder(v.reminder);
  const isReminderOpen = _vitaminReminderOpenId === v.id;
  const reminderLabel = getReminderStatusLabel(reminder);
  return `
    <div class="habit-card ${done ? 'done' : ''} ${isActiveOnSelectedDate ? '' : 'inactive-on-date'}" data-id="${v.id}">
      <div class="vitamin-item ${done ? 'done' : ''}" data-id="${v.id}">
        <button class="vitamin-check" data-action="toggle-vitamin" data-id="${v.id}" ${isActiveOnSelectedDate ? '' : 'disabled'}>
          <i data-lucide="check"></i>
        </button>
        <div class="vitamin-info">
          <div class="vitamin-name">${escapeHtml(v.name)}</div>
          <div class="vitamin-dose">${escapeHtml(v.dose || '-')}</div>
          <span class="habit-reminder-status ${reminder.enabled ? 'on' : ''}">
            <i data-lucide="bell"></i> ${escapeHtml(reminderLabel)}
          </span>
          ${isActiveOnSelectedDate ? '' : `<span class="habit-streak">Disponível a partir de ${escapeHtml(formatDateLabel(inferCreatedAt(v)))}</span>`}
        </div>
        <button class="btn btn-secondary btn-sm habit-reminder-btn" data-action="open-vitamin-reminder" data-id="${v.id}">
          <i data-lucide="bell-ring"></i> Lembrete
        </button>
        <button class="btn-icon danger" data-action="delete-vitamin" data-id="${v.id}">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
      ${isReminderOpen ? renderReminderPanel('vitamin', v.id, reminder) : ''}
    </div>
  `;
}

export function render() {
  const { habits, vitamins } = getHabitosData();
  const activeHabits = habits.filter((h) => isItemActiveOnDate(h, _selectedDate));
  const activeVitamins = vitamins.filter((v) => isItemActiveOnDate(v, _selectedDate));
  const doneCount = activeHabits.filter(h => h.completedDates.includes(_selectedDate)).length;
  const pct = activeHabits.length > 0 ? Math.round((doneCount / activeHabits.length) * 100) : 0;
  const vitDone = activeVitamins.filter(v => (v.completedDates || []).includes(_selectedDate)).length;
  const vitPct = activeVitamins.length > 0 ? Math.round((vitDone / activeVitamins.length) * 100) : 0;
  const selectedDateLabel = formatDateLabel(_selectedDate);
  const isTodayView = isTodayDate(_selectedDate);
  const disableNext = _selectedDate >= today();

  return `
    <div class="page-habitos">
      <div class="page-header">
        <div>
          <h2 class="page-title">Hábitos Diários</h2>
          <p class="page-subtitle">${doneCount} de ${activeHabits.length} hábitos concluídos ${isTodayView ? 'hoje' : 'na data selecionada'} (${pct}%) &middot; ${vitDone}/${activeVitamins.length} vitaminas ${isTodayView ? 'hoje' : 'na data selecionada'}</p>
        </div>
      </div>

      <div class="off-history-nav" style="margin-bottom:16px">
        <button class="btn btn-secondary btn-sm" id="hab-date-prev">
          <i data-lucide="chevron-left"></i>
        </button>
        <div class="off-history-label">
          <span>${isTodayView ? 'Hoje' : 'Histórico'}</span>
          <strong>${escapeHtml(selectedDateLabel)}</strong>
        </div>
        <button class="btn btn-secondary btn-sm" id="hab-date-today" ${isTodayView ? 'disabled' : ''}>
          Hoje
        </button>
        <button class="btn btn-secondary btn-sm" id="hab-date-next" ${disableNext ? 'disabled' : ''}>
          <i data-lucide="chevron-right"></i>
        </button>
      </div>

      <div class="habit-progress-card">
        <div class="habit-progress-row">
          <div class="habit-progress-head">
            <span>Hábitos</span>
            <strong>${doneCount}/${activeHabits.length}</strong>
          </div>
          <div class="habit-progress-track">
            <div class="habit-progress-fill" style="width:${pct}%"></div>
          </div>
        </div>
        <div class="habit-progress-row vitamin-progress-row">
          <div class="habit-progress-head">
            <span>Vitaminas</span>
            <strong>${vitDone}/${activeVitamins.length}</strong>
          </div>
          <div class="habit-progress-track">
            <div class="habit-progress-fill vitamin-progress-fill" style="width:${vitPct}%"></div>
          </div>
        </div>
      </div>

      <div class="add-section">
        <h3 class="form-title">Novo Hábito</h3>
        <div class="form-row form-row-inline">
          <input type="text" id="habit-name" class="form-input" placeholder="Nome do hábito..." />
          <div class="habit-icon-picker">
            <div class="habit-icon-picker-preview" id="habit-icon-preview">
              <i data-lucide="${ICONS[0].value}"></i>
            </div>
            <select id="habit-icon" class="form-select" style="max-width:180px">
              ${ICONS.map((icon) => `<option value="${icon.value}">${icon.label}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary" id="habit-add">
            <i data-lucide="plus"></i> Adicionar
          </button>
        </div>
      </div>

      <div class="content-section">
        <h3 class="section-label">Seus Hábitos</h3>
        <div class="habit-list" id="habit-list">
          ${habits.length ? habits.map(renderHabit).join('') : '<p class="empty-state">Nenhum hábito cadastrado. Adicione um acima!</p>'}
        </div>
      </div>

      <div class="content-section">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h3 class="section-label" style="margin-bottom:0">💊 Vitaminas & Suplementos</h3>
          <span class="badge">${vitDone}/${activeVitamins.length}</span>
        </div>
        <div class="vitamin-list" id="vitamin-list">
          ${vitamins.length ? vitamins.map(renderVitamin).join('') : '<p class="empty-state">Nenhuma vitamina cadastrada.</p>'}
        </div>
        <div class="add-section" style="margin-top:16px;margin-bottom:0">
          <div class="form-row form-row-inline">
            <input type="text" id="vit-name" class="form-input" placeholder="Nome (ex: Vitamina C)" />
            <input type="text" id="vit-dose" class="form-input" placeholder="Dose (ex: 500mg)" style="max-width:140px" />
            <button class="btn btn-secondary" id="vit-add">
              <i data-lucide="plus"></i> Adicionar
            </button>
          </div>
        </div>
      </div>

      ${renderDeleteDialog()}
    </div>
  `;
}

export function init(container) {
  ensureHabitReminderTicker();
  maybeTriggerHabitReminders();

  function rerender() {
    container.innerHTML = render();
    refreshIcons();
    init(container);
  }

  function runDeleteWithMode(mode) {
    if (!_deleteDialog || !['all', 'single', 'forward'].includes(mode)) return;
    const { kind, id, date } = _deleteDialog;
    store.update('habitos', (data) => {
      if (kind === 'habit') {
        data.habits = (data.habits || []).map((habit) => {
          if (habit.id !== id) return habit;
          return applyDeleteModeToItem(habit, mode, date);
        }).filter(Boolean);
        return data;
      }

      if (!Array.isArray(data.vitamins)) data.vitamins = [];
      data.vitamins = data.vitamins.map((vitamin) => {
        if (vitamin.id !== id) return vitamin;
        return applyDeleteModeToItem(vitamin, mode, date);
      }).filter(Boolean);
      return data;
    });
    closeDeleteDialog();
    rerender();
  }

  container.querySelector('#habit-add')?.addEventListener('click', () => {
    const name = container.querySelector('#habit-name').value.trim();
    const icon = container.querySelector('#habit-icon').value;
    if (!name) return;

    store.update('habitos', data => {
      data.habits.push({ id: store.nextId(data.habits), name, icon, createdAt: _selectedDate, completedDates: [] });
      return data;
    });
    rerender();
  });

  container.querySelector('#habit-name')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') container.querySelector('#habit-add')?.click();
  });

  container.querySelector('#habit-icon')?.addEventListener('change', (e) => {
    const preview = container.querySelector('#habit-icon-preview');
    if (!preview) return;
    preview.innerHTML = `<i data-lucide="${e.target.value}"></i>`;
    refreshIcons();
  });

  container.querySelectorAll('[data-action="toggle"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      store.update('habitos', data => {
        const habit = data.habits.find(h => h.id === id);
        if (!habit) return data;
        if (!isItemActiveOnDate(habit, _selectedDate)) return data;
        const idx = habit.completedDates.indexOf(_selectedDate);
        if (idx >= 0) {
          habit.completedDates.splice(idx, 1);
        } else {
          habit.completedDates.push(_selectedDate);
        }
        return data;
      });
      rerender();
    });
  });

  container.querySelector('#hab-date-prev')?.addEventListener('click', () => {
    _selectedDate = shiftDate(_selectedDate, -1);
    rerender();
  });

  container.querySelector('#hab-date-next')?.addEventListener('click', () => {
    const nextDate = shiftDate(_selectedDate, 1);
    if (nextDate > today()) return;
    _selectedDate = nextDate;
    rerender();
  });

  container.querySelector('#hab-date-today')?.addEventListener('click', () => {
    _selectedDate = today();
    rerender();
  });

  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const habit = getHabitosData().habits.find((h) => h.id === id);
      if (!habit) return;
      openDeleteDialog('habit', id, habit.name);
      rerender();
    });
  });

  container.querySelectorAll('[data-action="open-reminder"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id, 10);
      _habitReminderOpenId = _habitReminderOpenId === id ? null : id;
      _vitaminReminderOpenId = null;
      rerender();
    });
  });

  container.querySelectorAll('[data-action="open-vitamin-reminder"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id, 10);
      _vitaminReminderOpenId = _vitaminReminderOpenId === id ? null : id;
      _habitReminderOpenId = null;
      rerender();
    });
  });

  container.querySelectorAll('[data-reminder-enabled]').forEach((input) => {
    input.addEventListener('change', () => {
      const id = parseInt(input.dataset.reminderEnabled, 10);
      _syncReminderFields(container, 'habit', id);
    });
  });

  container.querySelectorAll('[data-reminder-weekday]').forEach((input) => {
    input.addEventListener('change', () => {
      const label = input.closest('.habit-reminder-day');
      label?.classList.toggle('active', input.checked);
    });
  });

  container.querySelectorAll('[data-reminder-mode]').forEach((input) => {
    input.addEventListener('change', () => {
      const id = parseInt(input.dataset.reminderMode, 10);
      _syncReminderFields(container, 'habit', id);
    });
  });

  container.querySelectorAll('[data-action="save-reminder"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id, 10);
      const enabledInput = container.querySelector(`[data-reminder-enabled="${id}"]`);
      const modeInput = container.querySelector(`[data-reminder-mode="${id}"]`);
      const timeInput = container.querySelector(`[data-reminder-time="${id}"]`);
      const intervalInput = container.querySelector(`[data-reminder-interval="${id}"]`);
      const startInput = container.querySelector(`[data-reminder-start="${id}"]`);
      const endInput = container.querySelector(`[data-reminder-end="${id}"]`);
      const weekdayInputs = [...container.querySelectorAll(`[data-reminder-weekday="${id}"]`)];
      const enabled = !!enabledInput?.checked;
      const recurrence = modeInput?.value === 'recurring' ? 'recurring' : 'fixed';
      const reminderTime = timeInput?.value || '08:00';
      const intervalHours = Number.parseInt(intervalInput?.value || '1', 10);
      const windowStart = startInput?.value || '08:00';
      const windowEnd = endInput?.value || '20:00';
      const weekdays = weekdayInputs.filter((input) => input.checked).map((input) => input.value);

      if (enabled && 'Notification' in window && Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch {
          // Ignora erro de permissao para manter o fluxo.
        }
      }

      store.update('habitos', (data) => {
        data.habits = (data.habits || []).map((habit) => {
          if (habit.id !== id) return habit;
          return {
            ...habit,
            reminder: {
              ...normalizeHabitReminder(habit.reminder),
              enabled,
              recurrence,
              time: reminderTime,
              intervalHours: Number.isFinite(intervalHours) && intervalHours >= 1 ? intervalHours : 1,
              windowStart,
              windowEnd,
              weekdays: weekdays.length ? weekdays : WEEKDAY_OPTIONS.map((day) => day.key),
              lastNotifiedDate: null,
              lastNotifiedSlot: null,
            },
          };
        });
        return data;
      });

      maybeTriggerHabitReminders();
      rerender();
    });
  });

  container.querySelectorAll('[data-vitamin-reminder-enabled]').forEach((input) => {
    input.addEventListener('change', () => {
      const id = parseInt(input.dataset.vitaminReminderEnabled, 10);
      _syncReminderFields(container, 'vitamin', id);
    });
  });

  container.querySelectorAll('[data-vitamin-reminder-weekday]').forEach((input) => {
    input.addEventListener('change', () => {
      const label = input.closest('.habit-reminder-day');
      label?.classList.toggle('active', input.checked);
    });
  });

  container.querySelectorAll('[data-vitamin-reminder-mode]').forEach((input) => {
    input.addEventListener('change', () => {
      const id = parseInt(input.dataset.vitaminReminderMode, 10);
      _syncReminderFields(container, 'vitamin', id);
    });
  });

  container.querySelectorAll('[data-action="save-vitamin-reminder"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id, 10);
      const enabledInput = container.querySelector(`[data-vitamin-reminder-enabled="${id}"]`);
      const modeInput = container.querySelector(`[data-vitamin-reminder-mode="${id}"]`);
      const timeInput = container.querySelector(`[data-vitamin-reminder-time="${id}"]`);
      const intervalInput = container.querySelector(`[data-vitamin-reminder-interval="${id}"]`);
      const startInput = container.querySelector(`[data-vitamin-reminder-start="${id}"]`);
      const endInput = container.querySelector(`[data-vitamin-reminder-end="${id}"]`);
      const weekdayInputs = [...container.querySelectorAll(`[data-vitamin-reminder-weekday="${id}"]`)];
      const enabled = !!enabledInput?.checked;
      const recurrence = modeInput?.value === 'recurring' ? 'recurring' : 'fixed';
      const reminderTime = timeInput?.value || '08:00';
      const intervalHours = Number.parseInt(intervalInput?.value || '1', 10);
      const windowStart = startInput?.value || '08:00';
      const windowEnd = endInput?.value || '20:00';
      const weekdays = weekdayInputs.filter((input) => input.checked).map((input) => input.value);

      if (enabled && 'Notification' in window && Notification.permission === 'default') {
        try {
          await Notification.requestPermission();
        } catch {
          // Ignora erro de permissao para manter o fluxo.
        }
      }

      store.update('habitos', (data) => {
        data.vitamins = (data.vitamins || []).map((vitamin) => {
          if (vitamin.id !== id) return vitamin;
          return {
            ...vitamin,
            reminder: {
              ...normalizeHabitReminder(vitamin.reminder),
              enabled,
              recurrence,
              time: reminderTime,
              intervalHours: Number.isFinite(intervalHours) && intervalHours >= 1 ? intervalHours : 1,
              windowStart,
              windowEnd,
              weekdays: weekdays.length ? weekdays : WEEKDAY_OPTIONS.map((day) => day.key),
              lastNotifiedDate: null,
              lastNotifiedSlot: null,
            },
          };
        });
        return data;
      });

      maybeTriggerHabitReminders();
      rerender();
    });
  });

  container.querySelectorAll('[data-action="toggle-vitamin"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      store.update('habitos', data => {
        if (!Array.isArray(data.vitamins)) data.vitamins = [];
        const vitamin = data.vitamins.find(v => v.id === id);
        if (!vitamin) return data;
        if (!isItemActiveOnDate(vitamin, _selectedDate)) return data;
        if (!Array.isArray(vitamin.completedDates)) vitamin.completedDates = [];
        const idx = vitamin.completedDates.indexOf(_selectedDate);
        if (idx >= 0) vitamin.completedDates.splice(idx, 1);
        else vitamin.completedDates.push(_selectedDate);
        return data;
      });
      rerender();
    });
  });

  container.querySelectorAll('[data-action="delete-vitamin"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      const vitamin = getHabitosData().vitamins.find((v) => v.id === id);
      if (!vitamin) return;
      openDeleteDialog('vitamin', id, vitamin.name);
      rerender();
    });
  });

  container.querySelector('[data-action="delete-overlay"]')?.addEventListener('click', (event) => {
    if (event.target !== event.currentTarget) return;
    closeDeleteDialog();
    rerender();
  });

  container.querySelector('[data-action="delete-cancel"]')?.addEventListener('click', () => {
    closeDeleteDialog();
    rerender();
  });

  container.querySelectorAll('[data-action="delete-scope"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!_deleteDialog) return;
      _deleteDialog.mode = String(btn.dataset.mode || '');
      rerender();
    });
  });

  container.querySelector('[data-action="delete-confirm"]')?.addEventListener('click', () => {
    if (!_deleteDialog?.mode) return;
    runDeleteWithMode(_deleteDialog.mode);
  });

  container.querySelector('#vit-add')?.addEventListener('click', () => {
    const name = container.querySelector('#vit-name')?.value.trim();
    const dose = container.querySelector('#vit-dose')?.value.trim();
    if (!name) return;

    store.update('habitos', data => {
      if (!Array.isArray(data.vitamins)) data.vitamins = [];
      data.vitamins.push({
        id: store.nextId(data.vitamins),
        name,
        dose,
        createdAt: _selectedDate,
        completedDates: [],
      });
      return data;
    });
    rerender();
  });
}
