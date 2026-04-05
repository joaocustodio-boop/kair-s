import { store, today } from '../store.js';
import { refreshIcons } from '../icons.js';
import heroFallback from '../assets/hero.png';
import {
  fetchExercises, filterExercises, IMG_BASE,
  CAT_PT, EQUIP_PT, MUSCLE_PT, LEVEL_PT, SPLITS, pt,
} from '../exerciseApi.js';

const PAGE_SIZE = 12;
const WEEK_DAYS = [
  { key: 'mon', label: 'Seg' },
  { key: 'tue', label: 'Ter' },
  { key: 'wed', label: 'Qua' },
  { key: 'thu', label: 'Qui' },
  { key: 'fri', label: 'Sex' },
  { key: 'sat', label: 'Sab' },
  { key: 'sun', label: 'Dom' },
];

const SPLIT_TERMS_PT = {
  'Push / Pull / Legs (PPL)': 'Empurrar / Puxar / Pernas (PPL)',
  'Upper / Lower': 'Superior / Inferior',
  Push: 'Empurrar',
  Pull: 'Puxar',
  Legs: 'Pernas',
  Upper: 'Superior',
  Lower: 'Inferior',
};

function ptSplitTerm(value) {
  const raw = String(value || '').trim();
  return SPLIT_TERMS_PT[raw] || raw;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function resolveExerciseImage(src) {
  if (!src) return heroFallback;
  const normalized = String(src);
  if (/raw\.githubusercontent\.com\/exercisedb\/exercisedb\.github\.io\/main\/exercises\//i.test(normalized)) {
    return heroFallback;
  }
  return /^https?:\/\//i.test(src) ? src : `${IMG_BASE}${src}`;
}

function isBlockedExerciseImage(src) {
  return /raw\.githubusercontent\.com\/exercisedb\/exercisedb\.github\.io\/main\/exercises\//i.test(String(src || ''));
}

function pickExerciseImage(ex) {
  const images = Array.isArray(ex?.images) ? ex.images : [];
  if (!images.length) return heroFallback;

  const validImages = images.filter((s) => !isBlockedExerciseImage(s));
  const preferred = validImages.find((s) => /\.gif(\?|$)/i.test(String(s)))
    || validImages.find((s) => /\.(jpg|jpeg|png|webp)(\?|$)/i.test(String(s)))
    || validImages[0]
    || images.find((s) => /\.(jpg|jpeg|png|webp)(\?|$)/i.test(String(s)))
    || images[0];
  return resolveExerciseImage(preferred);
}

function pickCardImage(ex) {
  const images = Array.isArray(ex?.images) ? ex.images : [];
  if (!images.length) return heroFallback;

  const validImages = images.filter((s) => !isBlockedExerciseImage(s));
  const preferred = validImages.find((s) => /\.(jpg|jpeg|png|webp)(\?|$)/i.test(String(s)))
    || validImages[0]
    || images.find((s) => /\.(jpg|jpeg|png|webp)(\?|$)/i.test(String(s)))
    || images[0];

  return resolveExerciseImage(preferred);
}

function getGifImage(ex) {
  const images = Array.isArray(ex?.images) ? ex.images : [];
  const validImages = images.filter((s) => !isBlockedExerciseImage(s));
  return validImages.find((s) => /\.gif(\?|$)/i.test(String(s))) || null;
}

function getPreviewFrames(ex) {
  const images = Array.isArray(ex?.images) ? ex.images : [];
  const validImages = images.filter((s) => !isBlockedExerciseImage(s));
  return validImages
    .filter((s) => /\.(jpg|jpeg|png|webp)(\?|$)/i.test(String(s)))
    .slice(0, 2)
    .map(resolveExerciseImage)
    .filter(Boolean);
}

function renderImageFallback() {
  return '<div class="expl-no-img"><span>Sem imagem</span></div>';
}

const EXERCISE_TYPES = [
  { value: 'cardio',      label: 'Cardio' },
  { value: 'strength',    label: 'Musculação' },
  { value: 'flexibility', label: 'Flexibilidade' },
  { value: 'sport',       label: 'Esporte' },
  { value: 'other',       label: 'Outro' },
];

// ─── Estado do explorador ─────────────────────────────────────────────────────
let _exState = {
  tab:       'meus',      // 'meus' | 'explorar' | 'splits'
  exercises: [],
  filtered:  [],
  page:      0,
  loading:   false,
  error:     null,
  filters:   { category: '', equipment: '', level: '', place: '', muscle: '', query: '' },
  detail:    null,        // exercício aberto no modal
  split:     null,        // split ativo
  splitDay:  null,        // dia do split ativo
  weeklyPlan: null,       // distribuição semanal automática
  meusWeeklySelection: null, // seleção de dia na aba Meus
};
let _reminderTickerId = null;

function getWeekKeyByDate(dateStr = today()) {
  const day = new Date(`${dateStr}T12:00:00`).getDay();
  const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return map[day] || 'mon';
}

function getTrainingSlotsPerWeek(daysCount) {
  if (daysCount <= 1) return [1];
  if (daysCount === 2) return [1, 4];
  if (daysCount === 3) return [1, 3, 5];
  if (daysCount === 4) return [1, 2, 4, 5];
  if (daysCount === 5) return [1, 2, 3, 5, 6];
  if (daysCount === 6) return [1, 2, 3, 4, 5, 6];
  return [0, 1, 2, 3, 4, 5, 6];
}

function getFrequencyOptions() {
  return [2, 3, 4, 5, 6, 7];
}

function clampFrequency(value) {
  const num = Number.parseInt(value, 10);
  const options = getFrequencyOptions();
  if (!Number.isFinite(num)) return 4;
  if (num < options[0]) return options[0];
  if (num > options[options.length - 1]) return options[options.length - 1];
  return num;
}

function createWeeklyPlan(splitKey, frequencyInput) {
  const splitDef = SPLITS[splitKey];
  if (!splitDef) return null;

  const frequency = clampFrequency(frequencyInput ?? splitDef.days.length);
  const slots = getTrainingSlotsPerWeek(frequency);
  const assignments = Object.fromEntries(WEEK_DAYS.map((day) => [day.key, null]));

  // Preenche exatamente a frequencia escolhida, repetindo os dias do split quando necessario.
  for (let i = 0; i < frequency; i++) {
    const dayDef = splitDef.days[i % splitDef.days.length];
    const slotIndex = slots[i] ?? slots[slots.length - 1] ?? 1;
    const weekKey = WEEK_DAYS[slotIndex]?.key || 'mon';
    const current = assignments[weekKey];
    const sessions = current?.sessions ? [...current.sessions] : [];
    sessions.push({
      dayIndex: i % splitDef.days.length,
      dayName: dayDef.name,
      muscles: dayDef.muscles,
    });
    assignments[weekKey] = {
      sessions,
      dayIndex: sessions[0].dayIndex,
      dayName: sessions[0].dayName,
      muscles: sessions.flatMap((s) => s.muscles),
      sessionCount: sessions.length,
    };
  }

  return {
    splitKey,
    splitLabel: splitDef.label,
    frequency,
    createdAt: new Date().toISOString(),
    assignments,
  };
}

function getStoredWeeklyPlan() {
  const ex = store.get('exercicios');
  return ex?.weeklyPlan || null;
}

function setStoredWeeklyPlan(plan) {
  store.update('exercicios', (data) => {
    data.weeklyPlan = plan;
    return data;
  });
  _exState.weeklyPlan = plan;
  _exState.meusWeeklySelection = null;
}

function getReminderState(rawReminder) {
  const reminder = rawReminder && typeof rawReminder === 'object' ? rawReminder : {};
  return {
    enabled: !!reminder.enabled,
    time: /^\d{2}:\d{2}$/.test(String(reminder.time || '')) ? String(reminder.time) : '19:00',
    lastNotifiedDate: reminder.lastNotifiedDate || null,
  };
}

function setStoredReminder(reminderPatch) {
  store.update('exercicios', (data) => {
    const current = getReminderState(data.reminder);
    data.reminder = {
      ...current,
      ...reminderPatch,
    };
    return data;
  });
}

function isReminderDue(reminder, now = new Date()) {
  const [hour, minute] = String(reminder.time || '19:00').split(':').map((n) => Number.parseInt(n, 10));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  const due = new Date(now);
  due.setHours(hour, minute, 0, 0);
  return now >= due;
}

function hasWorkoutToday(logs) {
  return (logs || []).some((log) => log.date === today());
}

function notifyWorkoutReminder() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  new Notification('Hora do treino', {
    body: 'Seu lembrete de treino está ativo. Bora manter o ritmo hoje.',
    tag: 'workout-reminder',
    renotify: false,
  });
  return true;
}

function maybeTriggerWorkoutReminder() {
  const exData = store.get('exercicios');
  const reminder = getReminderState(exData.reminder);
  const plan = exData.weeklyPlan;
  const todayEntry = plan?.assignments?.[getWeekKeyByDate()] || null;
  if (!reminder.enabled || !todayEntry) return;
  if (reminder.lastNotifiedDate === today()) return;
  if (hasWorkoutToday(exData.logs)) return;
  if (!isReminderDue(reminder)) return;
  if (!notifyWorkoutReminder()) return;
  setStoredReminder({ lastNotifiedDate: today() });
}

function ensureWorkoutReminderTicker() {
  if (_reminderTickerId !== null) return;
  _reminderTickerId = window.setInterval(() => {
    maybeTriggerWorkoutReminder();
  }, 60000);
}

function renderWeeklyPlanner(options = {}) {
  const { readOnly = false, enableDaySelection = false, selectedWeekday = null } = options;
  const plan = _exState.weeklyPlan;
  const todayKey = getWeekKeyByDate();
  const todayEntry = plan?.assignments?.[todayKey] || null;
  const selectedSplitKey = plan?.splitKey || Object.keys(SPLITS)[0];
  const splitDefaultFrequency = SPLITS[selectedSplitKey]?.days?.length || 4;
  const selectedFrequency = clampFrequency(plan?.frequency ?? splitDefaultFrequency);
  const keepTag = plan?.keepPlan ? '<span class="badge split-keep-badge">Mantido</span>' : '';

  return `
    <div class="split-auto card">
      <div class="split-auto-head">
        <div>
          <h3 class="split-auto-title">Distribuição semanal automática</h3>
          <p class="split-auto-subtitle">${readOnly ? 'Sua divisão da semana.' : 'Gere sua agenda da semana com base em uma divisão.'}</p>
        </div>
      </div>

      ${readOnly ? '' : `
        <div class="split-auto-controls">
          <select class="form-select" id="split-auto-select">
            ${Object.entries(SPLITS).map(([key, split]) => `
              <option value="${key}" ${selectedSplitKey === key ? 'selected' : ''}>${split.label}</option>
            `).join('')}
          </select>
          <select class="form-select" id="split-auto-frequency">
            ${getFrequencyOptions().map((freq) => `
              <option value="${freq}" ${selectedFrequency === freq ? 'selected' : ''}>${freq}x por semana</option>
            `).join('')}
          </select>
          <button class="btn btn-primary" id="split-auto-generate">
            <i data-lucide="wand-sparkles"></i> Gerar semana
          </button>
          <button class="btn btn-secondary" id="split-auto-save">
            <i data-lucide="bookmark-check"></i> Salvar e manter
          </button>
          ${plan ? `
            <button class="btn btn-secondary" id="split-auto-clear">
              <i data-lucide="trash-2"></i> Limpar
            </button>
          ` : ''}
        </div>
      `}

      ${plan ? `
        <div class="split-auto-status">
          <span class="badge">Plano atual: ${escapeHtml(ptSplitTerm(plan.splitLabel || ''))} • ${plan.frequency || selectedFrequency}x/semana</span>
          ${keepTag}
          ${!readOnly && todayEntry ? `
            <button class="btn btn-secondary btn-sm" id="split-open-today">
              <i data-lucide="calendar-check-2"></i> Abrir treino de hoje
            </button>
          ` : todayEntry ? '' : '<span class="split-rest-note">Hoje é descanso</span>'}
        </div>
        <div class="split-week-grid">
          ${WEEK_DAYS.map((day) => {
            const entry = plan.assignments?.[day.key];
            const isToday = day.key === todayKey;
            const label = entry
              ? `${ptSplitTerm(entry.dayName)}${entry.sessionCount > 1 ? ` (+${entry.sessionCount - 1})` : ''}`
              : 'Descanso';
            const canSelectInMeus = readOnly && enableDaySelection && !!entry;
            const dayTag = canSelectInMeus || (!readOnly && !!entry) ? 'button' : 'div';
            const dayAttrs = canSelectInMeus
              ? `data-meus-weekday="${day.key}" data-meus-dayidx="${entry.dayIndex}" data-meus-split="${plan.splitKey}"`
              : (!readOnly && !!entry
                ? `data-auto-weekday="${day.key}" data-auto-dayidx="${entry.dayIndex}" data-auto-split="${plan.splitKey}"`
                : '');
            const selectedClass = canSelectInMeus && selectedWeekday === day.key ? 'selected' : '';
            return `
              <${dayTag} class="split-week-day ${isToday ? 'today' : ''} ${entry ? 'has-training' : 'rest'} ${selectedClass}"
                      ${dayAttrs}>
                <span class="split-week-day-name">${day.label}</span>
                <span class="split-week-day-workout">${escapeHtml(label)}</span>
              </${dayTag}>`;
          }).join('')}
        </div>
      ` : '<p class="empty-state" style="margin-top:10px">Ainda não há plano semanal. Gere o primeiro em um clique.</p>'}
    </div>`;
}

function renderWorkoutReminderCard() {
  const { logs, weeklyPlan, reminder: rawReminder } = store.get('exercicios');
  const reminder = getReminderState(rawReminder);
  const todayEntry = weeklyPlan?.assignments?.[getWeekKeyByDate()] || null;
  const reminderStatus = !reminder.enabled
    ? 'Lembrete desativado.'
    : hasWorkoutToday(logs)
      ? 'Treino de hoje já registrado. Excelente.'
      : todayEntry
        ? `Lembrete ativo para ${reminder.time}.`
        : 'Hoje é descanso no plano semanal.';

  return `
    <div class="split-auto card treino-reminder-card">
      <div class="split-auto-head">
        <div>
          <h3 class="split-auto-title">Lembrete de treino</h3>
          <p class="split-auto-subtitle">Salve um horário fixo para manter sua rotina semanal.</p>
        </div>
      </div>

      <div class="split-auto-controls">
        <label class="reminder-toggle">
          <input type="checkbox" id="ex-reminder-enabled" ${reminder.enabled ? 'checked' : ''} />
          <span>Ativar lembrete diário</span>
        </label>
        <input type="time" id="ex-reminder-time" class="form-input" value="${reminder.time}" ${reminder.enabled ? '' : 'disabled'} style="max-width:180px" />
        <button class="btn btn-primary" id="ex-reminder-save">
          <i data-lucide="bell-ring"></i> Salvar lembrete
        </button>
      </div>
      <div class="split-auto-status">
        <span class="split-rest-note">${escapeHtml(reminderStatus)}</span>
      </div>
    </div>`;
}

function renderLog(log) {
  const d = new Date(log.date + 'T12:00:00').toLocaleDateString('pt-BR');
  const typeLabel = EXERCISE_TYPES.find(t => t.value === log.type)?.label || log.type;
  return `
    <div class="exercise-log-item" data-id="${log.id}">
      <div class="exercise-log-icon"><i data-lucide="dumbbell"></i></div>
      <div class="exercise-log-info">
        <div class="exercise-log-name">${escapeHtml(log.name)}</div>
        <div class="exercise-log-meta">${typeLabel} &middot; ${log.duration} min &middot; ${d}${log.notes ? ' &middot; ' + escapeHtml(log.notes) : ''}</div>
      </div>
      <button class="btn-icon danger" data-action="delete-log" data-id="${log.id}">
        <i data-lucide="trash-2"></i>
      </button>
    </div>`;
}

// ─── Aba Meus Treinos ─────────────────────────────────────────────────────────
function renderMeus() {
  const { logs } = store.get('exercicios');
  const recentLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  const plan = _exState.weeklyPlan;
  const sel = _exState.meusWeeklySelection;
  const splitKey = sel?.splitKey;
  const splitDay = Number.isInteger(sel?.dayIndex) ? sel.dayIndex : null;
  const splitDef = splitKey ? SPLITS[splitKey] : null;
  const dayDef = splitDef && splitDay !== null ? splitDef.days[splitDay] : null;
  const dayExs = dayDef && _exState.exercises.length
    ? dayDef.muscles.flatMap((m) =>
        filterExercises(_exState.exercises, { muscle: m, category: 'strength' }).slice(0, 4)
          .map((e) => ({ ...e, _forMuscle: m }))
      ).filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i).slice(0, 16)
    : [];
  const selectedWeekLabel = sel ? (WEEK_DAYS.find((w) => w.key === sel.weekday)?.label || '') : '';
  const hasPlan = !!plan;

  return `
    <div class="content-section">
      ${renderWeeklyPlanner({
        readOnly: true,
        enableDaySelection: true,
        selectedWeekday: sel?.weekday || null,
      })}

      ${renderWorkoutReminderCard()}

      ${hasPlan ? `
        <div class="content-section" style="margin-top:14px">
          <h3 class="section-label">📌 Treino da semana${selectedWeekLabel ? ` • ${selectedWeekLabel}` : ''}</h3>
          ${!sel ? '<p class="empty-state">Clique em um dia da semana para ver os cards dos treinos.</p>' : ''}
          ${sel && _exState.loading ? `
            <div class="expl-loading" style="padding:12px 0 4px">
              <i data-lucide="loader" class="spin"></i>
              <p>Carregando exercícios...</p>
            </div>
          ` : ''}
          ${sel && !_exState.loading && !_exState.exercises.length ? `
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <p class="empty-state" style="margin:0">Toque para carregar os exercícios deste dia.</p>
              <button class="btn btn-secondary btn-sm" id="meus-load-day-cards">
                <i data-lucide="refresh-cw"></i> Carregar cards
              </button>
            </div>
          ` : ''}
          ${sel && _exState.exercises.length ? `
            <div class="expl-grid">
              ${dayExs.length ? dayExs.map((ex) => renderExCard(ex)).join('') : '<p class="empty-state" style="grid-column:1/-1">Sem sugestões para este dia.</p>'}
            </div>
          ` : ''}
        </div>
      ` : ''}

      <h3 class="section-label">🏋️ Registrar Treino</h3>
      <div class="add-section">
        <div class="form-row form-row-inline">
          <input type="text" id="ex-name" class="form-input" placeholder="Ex: Supino, Agachamento..." />
          <select id="ex-type" class="form-select" style="max-width:160px">
            ${EXERCISE_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
          </select>
        </div>
        <div class="form-row form-row-inline">
          <input type="number" id="ex-duration" class="form-input" placeholder="Duração (min)" min="1" style="max-width:150px" />
          <input type="date" id="ex-date" class="form-input" value="${today()}" style="max-width:180px" />
          <input type="text" id="ex-notes" class="form-input" placeholder="Observações (opcional)" />
        </div>
        <button class="btn btn-primary" id="ex-add"><i data-lucide="plus"></i> Registrar Treino</button>
      </div>

      <h3 class="section-label" style="margin-top:24px">📋 Histórico</h3>
      <div class="exercise-log-list" id="log-list">
        ${recentLogs.length ? recentLogs.map(renderLog).join('') : '<p class="empty-state">Nenhum treino registrado ainda</p>'}
      </div>

      ${_exState.detail ? renderDetail(_exState.detail) : ''}
    </div>`;
}

// ─── Aba Explorar ─────────────────────────────────────────────────────────────
function renderExplorar() {
  const { loading, error, filtered, page, filters, detail } = _exState;
  const cats   = [...new Set((_exState.exercises || []).map(e => e.category))].sort();
  const equips = [...new Set((_exState.exercises || []).map(e => e.equipment))].sort();
  const levels = ['beginner', 'intermediate', 'expert'];
  const places = [
    { value: 'casa', label: 'Casa' },
    { value: 'academia', label: 'Academia' },
  ];

  const slice  = filtered.slice(0, (page + 1) * PAGE_SIZE);
  const hasMore = filtered.length > slice.length;

  if (loading) return `
    <div class="expl-loading">
      <i data-lucide="loader" class="spin"></i>
      <p>Carregando banco de exercícios...</p>
    </div>`;

  if (error) return `
    <div class="expl-error">
      <i data-lucide="circle-alert"></i>
      <p>${error}</p>
      <button class="btn btn-secondary" id="expl-retry">Tentar novamente</button>
    </div>`;

  return `
    <!-- Filtros -->
    <div class="expl-filters card">
      <div class="expl-search-wrap">
        <i data-lucide="search"></i>
        <input type="text" class="form-input" id="expl-query"
          placeholder="Buscar exercício..." value="${escapeHtml(filters.query)}" />
      </div>
      <div class="expl-filter-row">
        <select class="form-select" id="expl-cat">
          <option value="">Categoria</option>
          ${cats.map(c => `<option value="${c}" ${filters.category === c ? 'selected' : ''}>${pt(CAT_PT, c)}</option>`).join('')}
        </select>
        <select class="form-select" id="expl-equip">
          <option value="">Equipamento</option>
          ${equips.map(e => `<option value="${e}" ${filters.equipment === e ? 'selected' : ''}>${pt(EQUIP_PT, e)}</option>`).join('')}
        </select>
        <select class="form-select" id="expl-level">
          <option value="">Nível</option>
          ${levels.map(l => `<option value="${l}" ${filters.level === l ? 'selected' : ''}>${pt(LEVEL_PT, l)}</option>`).join('')}
        </select>
        <select class="form-select" id="expl-place">
          <option value="">Local</option>
          ${places.map(p => `<option value="${p.value}" ${filters.place === p.value ? 'selected' : ''}>${p.label}</option>`).join('')}
        </select>
        ${(filters.category || filters.equipment || filters.level || filters.place || filters.query) ? `
          <button class="btn btn-secondary" id="expl-clear-filters" style="white-space:nowrap">
            <i data-lucide="x"></i> Limpar
          </button>` : ''}
      </div>
      <p class="expl-count">${filtered.length} exercício${filtered.length !== 1 ? 's' : ''}</p>
    </div>

    <!-- Grid -->
    <div class="expl-grid" id="expl-grid">
      ${slice.map(ex => renderExCard(ex)).join('')}
      ${!slice.length ? '<p class="empty-state" style="grid-column:1/-1">Nenhum exercício encontrado</p>' : ''}
    </div>

    ${hasMore ? `
      <div style="text-align:center;margin-top:16px">
        <button class="btn btn-secondary" id="expl-more">
          Ver mais (${filtered.length - slice.length} restantes)
        </button>
      </div>` : ''}

    <!-- Modal de detalhe -->
    ${detail ? renderDetail(detail) : ''}
  `;
}

function renderExCard(ex) {
  const img = pickCardImage(ex);
  const muscle = ex.primaryMuscles?.[0] ?? '';
  const levelClass = ex.level === 'beginner' ? 'level-ini' : ex.level === 'expert' ? 'level-adv' : 'level-int';
  return `
    <div class="expl-card" data-exid="${escapeHtml(ex.id)}">
      <div class="expl-card-img">
        <img src="${img}" alt="${escapeHtml(ex.name)}" loading="lazy" onerror="this.onerror=null; this.src='${heroFallback}'" />
        <span class="expl-level-badge ${levelClass}">${pt(LEVEL_PT, ex.level)}</span>
      </div>
      <div class="expl-card-body">
        <p class="expl-card-name">${escapeHtml(ex.name)}</p>
        <p class="expl-card-meta">
          ${muscle ? `<span>${pt(MUSCLE_PT, muscle)}</span>` : ''}
          ${ex.equipment ? `<span>${pt(EQUIP_PT, ex.equipment)}</span>` : ''}
        </p>
      </div>
    </div>`;
}

function renderDetail(ex) {
  const gif = getGifImage(ex);
  const frameImgs = getPreviewFrames(ex);
  const category = String(ex?.category || '').toLowerCase();
  const repsSuggestion = (category === 'stretching' || category === 'flexibility' || category === 'cardio')
    ? '30-45s'
    : ex?.level === 'expert'
      ? '6-10 reps'
      : ex?.level === 'intermediate'
        ? '8-12 reps'
        : '10-15 reps';
  const seriesSuggestion = (category === 'stretching' || category === 'flexibility' || category === 'cardio')
    ? '2-3 séries'
    : ex?.level === 'expert'
      ? '4-5 séries'
      : ex?.level === 'intermediate'
        ? '3-4 séries'
        : '3 séries';
  const executionMedia = gif
    ? { kind: 'gif', src: resolveExerciseImage(gif) }
    : frameImgs.length >= 2
      ? { kind: 'frames', srcA: frameImgs[0], srcB: frameImgs[1] }
      : { kind: 'image', src: pickExerciseImage(ex) };
  const muscles = [
    ...(ex.primaryMuscles || []).map(m => `<span class="muscle-tag primary">${pt(MUSCLE_PT, m)}</span>`),
    ...(ex.secondaryMuscles || []).map(m => `<span class="muscle-tag secondary">${pt(MUSCLE_PT, m)}</span>`),
  ].join('');
  const focusLabel = pt(MUSCLE_PT, ex.primaryMuscles?.[0]) || pt(CAT_PT, ex.category);

  return `
    <div class="expl-modal-overlay" id="expl-modal">
      <div class="expl-modal">
        <div class="expl-modal-header">
          <div class="expl-modal-title-wrap">
            <span class="expl-modal-kicker">Exercício</span>
            <h3>${escapeHtml(ex.name)}</h3>
            <p class="expl-modal-subtitle">Foco principal em ${escapeHtml(focusLabel)}</p>
          </div>
          <button class="btn-icon" id="expl-modal-close"><i data-lucide="x"></i></button>
        </div>

        <div class="expl-modal-meta">
          <span class="badge">${pt(CAT_PT, ex.category)}</span>
          <span class="badge">${pt(EQUIP_PT, ex.equipment)}</span>
          <span class="badge">${pt(LEVEL_PT, ex.level)}</span>
          ${muscles}
        </div>

        ${ex.instructions?.length ? `
          <div class="expl-instructions">
            <h4>Execução</h4>
            <div class="expl-exec-layout">
              <div class="expl-exec-media-col">
                <div class="expl-exec-media">
                  ${executionMedia.kind === 'gif'
                    ? `<img src="${executionMedia.src}" alt="Demonstração de ${escapeHtml(ex.name)}" loading="lazy" onerror="this.onerror=null; this.src='${heroFallback}'" />`
                    : executionMedia.kind === 'frames'
                      ? `<div class="expl-exec-anim">
                           <img src="${executionMedia.srcA}" alt="Demonstração de ${escapeHtml(ex.name)}" loading="lazy" onerror="this.onerror=null; this.src='${heroFallback}'" />
                           <img src="${executionMedia.srcB}" alt="Demonstração de ${escapeHtml(ex.name)}" loading="lazy" onerror="this.onerror=null; this.src='${heroFallback}'" />
                         </div>`
                      : `<img src="${executionMedia.src}" alt="Demonstração de ${escapeHtml(ex.name)}" loading="lazy" onerror="this.onerror=null; this.src='${heroFallback}'" />`
                  }
                </div>
                <div class="expl-exec-tools">
                  <div class="expl-reps-box">
                    <span>Repetições sugeridas</span>
                    <strong>${repsSuggestion}</strong>
                  </div>
                  <div class="expl-series-box">
                    <span>Séries sugeridas</span>
                    <strong>${seriesSuggestion}</strong>
                  </div>
                </div>
              </div>
              <div class="expl-exec-steps">
                <div class="expl-exec-caption">Passo a passo</div>
                <ol class="expl-exec-list">
                  ${ex.instructions.map(s => `<li><span>${escapeHtml(s)}</span></li>`).join('')}
                </ol>
              </div>
            </div>
          </div>` : ''}

        <button class="btn btn-primary" id="expl-use-exercise" style="width:100%;margin-top:16px"
          data-name="${escapeHtml(ex.name)}" data-cat="${ex.category}">
          <i data-lucide="plus"></i> Adicionar ao treino
        </button>
      </div>
    </div>`;
}

// ─── Aba Splits ───────────────────────────────────────────────────────────────
function renderSplits() {
  const { split, splitDay, exercises } = _exState;

  const planner = renderWeeklyPlanner();
  const reminderCard = renderWorkoutReminderCard();

  if (!split) {
    return `
      ${planner}
      ${reminderCard}
      <div class="splits-grid">
        ${Object.entries(SPLITS).map(([key, s]) => `
          <div class="split-card" data-split="${key}">
            <div class="split-card-title">${s.label}</div>
            <div class="split-card-desc">${s.desc}</div>
            <div class="split-days-preview">
              ${s.days.map(d => `<span class="split-day-chip">${d.name}</span>`).join('')}
            </div>
          </div>`).join('')}
      </div>`;
  }

  const def = SPLITS[split];
  if (splitDay === null || splitDay === undefined) {
    return `
      ${planner}
      ${reminderCard}
      <button class="btn btn-secondary" id="split-back" style="margin-bottom:20px">
        <i data-lucide="arrow-left"></i> Voltar
      </button>
      <h3 style="margin-bottom:16px">${def.label}</h3>
      <div class="splits-days-list">
        ${def.days.map((d, i) => `
          <div class="split-day-card" data-dayidx="${i}">
            <div class="split-day-title">${d.name}</div>
            <div class="split-day-muscles">
              ${d.muscles.map(m => `<span class="muscle-tag">${pt(MUSCLE_PT, m)}</span>`).join('')}
            </div>
            <button class="btn btn-secondary btn-sm" data-dayidx="${i}" style="margin-top:12px">
              <i data-lucide="dumbbell"></i> Ver exercícios
            </button>
          </div>`).join('')}
      </div>`;
  }

  const dayDef    = def.days[splitDay];
  const dayExs    = exercises.length
    ? dayDef.muscles.flatMap(m =>
        filterExercises(exercises, { muscle: m, category: 'strength' }).slice(0, 4)
          .map(e => ({ ...e, _forMuscle: m }))
      ).filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i).slice(0, 16)
    : [];

  return `
    ${planner}
    ${reminderCard}
    <button class="btn btn-secondary" id="split-back-day" style="margin-bottom:20px">
      <i data-lucide="arrow-left"></i> Voltar
    </button>
    <h3 style="margin-bottom:4px">${def.label} — ${dayDef.name}</h3>
    <p style="color:var(--text-secondary);font-size:.875rem;margin-bottom:20px">
      Músculos: ${dayDef.muscles.map(m => pt(MUSCLE_PT, m)).join(', ')}
    </p>
    ${!exercises.length ? `<p class="empty-state">Carregue a aba Explorar primeiro para ver os exercícios</p>` : ''}
    <div class="expl-grid">
      ${dayExs.map(ex => renderExCard(ex)).join('')}
    </div>
    ${_exState.detail ? renderDetail(_exState.detail) : ''}
  `;
}

// ─── Render principal ─────────────────────────────────────────────────────────
export function render() {
  const { logs } = store.get('exercicios');
  const tab = _exState.tab;

  return `
    <div class="page-exercicios">
      <div class="page-header">
        <div>
          <h2 class="page-title">Exercícios</h2>
          <p class="page-subtitle">${logs.length} treino${logs.length !== 1 ? 's' : ''} registrado${logs.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <!-- Tabs -->
      <div class="ex-tabs">
        <button class="ex-tab ${tab === 'meus'    ? 'active' : ''}" data-tab="meus">
          <i data-lucide="calendar"></i> Meus Treinos
        </button>
        <button class="ex-tab ${tab === 'explorar' ? 'active' : ''}" data-tab="explorar">
          <i data-lucide="search"></i> Explorar
        </button>
        <button class="ex-tab ${tab === 'splits'  ? 'active' : ''}" data-tab="splits">
          <i data-lucide="sliders-horizontal"></i> Divisões
        </button>
      </div>

      <!-- Conteúdo da aba -->
      <div id="ex-tab-content">
        ${tab === 'meus'    ? renderMeus()    : ''}
        ${tab === 'explorar' ? renderExplorar() : ''}
        ${tab === 'splits'  ? renderSplits()  : ''}
      </div>
    </div>`;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export async function init(container) {
  _exState.weeklyPlan = getStoredWeeklyPlan();
  ensureWorkoutReminderTicker();
  maybeTriggerWorkoutReminder();
  refreshIcons();
  _attachCommon(container);

  if (_exState.tab === 'explorar' && !_exState.exercises.length && !_exState.loading) {
    await _loadExercises(container);
  }
  if (_exState.tab === 'splits' && !_exState.exercises.length && !_exState.loading) {
    // carrega em background para splits
    _loadExercises(container).catch(() => {});
  }
}

async function _loadExercises(container) {
  _exState.loading = true;
  _exState.error   = null;
  _redraw(container);

  try {
    const data = await fetchExercises();
    _exState.exercises = data;
    _applyFilters();
  } catch (e) {
    _exState.error = 'Não foi possível carregar os exercícios. Verifique sua conexão.';
  } finally {
    _exState.loading = false;
  }
  _redraw(container);
}

function _applyFilters() {
  _exState.filtered = filterExercises(_exState.exercises, _exState.filters)
    .sort((a, b) => {
      const aAnim = getGifImage(a) || getPreviewFrames(a).length >= 2 ? 1 : 0;
      const bAnim = getGifImage(b) || getPreviewFrames(b).length >= 2 ? 1 : 0;
      if (aAnim !== bAnim) return bAnim - aAnim;
      return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    });
  _exState.page     = 0;
}

function _redraw(container) {
  container.innerHTML = render();
  refreshIcons();
  _attachCommon(container);
}

// ─── Listeners ────────────────────────────────────────────────────────────────
function _attachCommon(container) {
  // Tabs
  container.querySelectorAll('.ex-tab').forEach(btn => {
    btn.addEventListener('click', async () => {
      _exState.tab = btn.dataset.tab;
      _exState.detail = null;
      _redraw(container);
      if (_exState.tab === 'explorar' && !_exState.exercises.length && !_exState.loading) {
        await _loadExercises(container);
      }
      if (_exState.tab === 'splits' && !_exState.exercises.length && !_exState.loading) {
        _loadExercises(container).catch(() => {});
      }
    });
  });

  if (_exState.tab === 'meus')     _attachMeus(container);
  if (_exState.tab === 'explorar') _attachExplorar(container);
  if (_exState.tab === 'splits')   _attachSplits(container);
}

function _attachWeeklyPlanner(container, switchToSplitsOnOpen = false) {
  container.querySelector('#split-auto-select')?.addEventListener('change', (e) => {
    const selectedSplit = e.target.value;
    const splitFrequency = clampFrequency(SPLITS[selectedSplit]?.days?.length || 4);
    const frequencyEl = container.querySelector('#split-auto-frequency');
    if (frequencyEl && !_exState.weeklyPlan) {
      frequencyEl.value = String(splitFrequency);
    }
  });

  container.querySelector('#split-auto-generate')?.addEventListener('click', () => {
    const selectedSplit = container.querySelector('#split-auto-select')?.value;
    const selectedFrequency = container.querySelector('#split-auto-frequency')?.value;
    const plan = createWeeklyPlan(selectedSplit, selectedFrequency);
    if (!plan) return;
    setStoredWeeklyPlan({
      ...plan,
      keepPlan: false,
    });
    _redraw(container);
  });

  container.querySelector('#split-auto-save')?.addEventListener('click', () => {
    const selectedSplit = container.querySelector('#split-auto-select')?.value;
    const selectedFrequency = container.querySelector('#split-auto-frequency')?.value;
    const plan = createWeeklyPlan(selectedSplit, selectedFrequency);
    if (!plan) return;
    setStoredWeeklyPlan({
      ...plan,
      keepPlan: true,
    });
    _redraw(container);
  });

  container.querySelector('#split-auto-clear')?.addEventListener('click', () => {
    setStoredWeeklyPlan(null);
    _redraw(container);
  });

  container.querySelector('#split-open-today')?.addEventListener('click', () => {
    const plan = _exState.weeklyPlan;
    if (!plan) return;
    const todayEntry = plan.assignments?.[getWeekKeyByDate()];
    if (!todayEntry) return;
    _exState.split = plan.splitKey;
    _exState.splitDay = todayEntry.dayIndex;
    if (switchToSplitsOnOpen) {
      _exState.tab = 'splits';
    }
    _redraw(container);
  });

  container.querySelectorAll('[data-auto-dayidx][data-auto-split]').forEach((btn) => {
    btn.addEventListener('click', () => {
      _exState.split = btn.dataset.autoSplit;
      _exState.splitDay = parseInt(btn.dataset.autoDayidx, 10);
      if (switchToSplitsOnOpen) {
        _exState.tab = 'splits';
      }
      _redraw(container);
    });
  });
}

function _attachMeus(container) {
  function rerender() { _redraw(container); }

  _attachReminderControls(container);

  container.querySelectorAll('[data-meus-dayidx][data-meus-split][data-meus-weekday]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      _exState.meusWeeklySelection = {
        splitKey: btn.dataset.meusSplit,
        dayIndex: parseInt(btn.dataset.meusDayidx, 10),
        weekday: btn.dataset.meusWeekday,
      };

      if (!_exState.exercises.length && !_exState.loading) {
        await _loadExercises(container);
        return;
      }
      _redraw(container);
    });
  });

  container.querySelector('#meus-load-day-cards')?.addEventListener('click', async () => {
    if (_exState.loading) return;
    await _loadExercises(container);
  });

  container.querySelectorAll('.expl-card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.exid;
      _exState.detail = _exState.exercises.find((e) => e.id === id) || null;
      _redraw(container);
    });
  });

  _attachModal(container);

  container.querySelector('#ex-add')?.addEventListener('click', () => {
    const name     = container.querySelector('#ex-name').value.trim();
    const type     = container.querySelector('#ex-type').value;
    const duration = parseInt(container.querySelector('#ex-duration').value);
    const date     = container.querySelector('#ex-date').value;
    const notes    = container.querySelector('#ex-notes').value.trim();
    if (!name || !duration || !date) return;
    store.update('exercicios', data => {
      data.logs.push({ id: store.nextId(data.logs), name, type, duration, date, notes });
      return data;
    });
    rerender();
  });

  container.querySelectorAll('[data-action="delete-log"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id);
      store.update('exercicios', data => { data.logs = data.logs.filter(l => l.id !== id); return data; });
      rerender();
    });
  });
}

function _attachExplorar(container) {
  // Retry
  container.querySelector('#expl-retry')?.addEventListener('click', () => _loadExercises(container));

  // Limpar filtros
  container.querySelector('#expl-clear-filters')?.addEventListener('click', () => {
    _exState.filters = { category: '', equipment: '', level: '', place: '', muscle: '', query: '' };
    _applyFilters();
    _redraw(container);
  });

  // Filtros
  let qTimer = null;
  container.querySelector('#expl-query')?.addEventListener('input', e => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      _exState.filters.query = e.target.value.trim();
      _applyFilters();
      _redraw(container);
    }, 300);
  });

  container.querySelector('#expl-cat')?.addEventListener('change', e => {
    _exState.filters.category = e.target.value;
    _applyFilters(); _redraw(container);
  });
  container.querySelector('#expl-equip')?.addEventListener('change', e => {
    _exState.filters.equipment = e.target.value;
    _applyFilters(); _redraw(container);
  });
  container.querySelector('#expl-level')?.addEventListener('change', e => {
    _exState.filters.level = e.target.value;
    _applyFilters(); _redraw(container);
  });
  container.querySelector('#expl-place')?.addEventListener('change', e => {
    _exState.filters.place = e.target.value;
    _applyFilters(); _redraw(container);
  });

  // Ver mais
  container.querySelector('#expl-more')?.addEventListener('click', () => {
    _exState.page++;
    _redraw(container);
  });

  // Abrir detalhe ao clicar no card
  container.querySelectorAll('.expl-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.exid;
      _exState.detail = _exState.exercises.find(e => e.id === id) || null;
      _redraw(container);
    });
  });

  _attachModal(container);
}

function _attachModal(container) {
  container.querySelector('#expl-modal-close')?.addEventListener('click', () => {
    _exState.detail = null; _redraw(container);
  });
  container.querySelector('#expl-modal-overlay, #expl-modal')?.addEventListener('click', e => {
    if (e.target.id === 'expl-modal') { _exState.detail = null; _redraw(container); }
  });

  container.querySelector('#expl-use-exercise')?.addEventListener('click', e => {
    const name = e.currentTarget.dataset.name;
    const cat  = e.currentTarget.dataset.cat;
    const typeMap = { strength: 'strength', cardio: 'cardio', stretching: 'flexibility' };
    _exState.detail = null;
    _exState.tab    = 'meus';
    _redraw(container);
    // Pré-preenche o formulário
    const nameInput = container.querySelector('#ex-name');
    const typeInput = container.querySelector('#ex-type');
    if (nameInput) { nameInput.value = name; nameInput.focus(); }
    if (typeInput && typeMap[cat]) typeInput.value = typeMap[cat];
  });
}

function _attachReminderControls(container) {
  const reminderEnabledEl = container.querySelector('#ex-reminder-enabled');
  const reminderTimeEl = container.querySelector('#ex-reminder-time');

  reminderEnabledEl?.addEventListener('change', () => {
    if (reminderTimeEl) reminderTimeEl.disabled = !reminderEnabledEl.checked;
  });

  container.querySelector('#ex-reminder-save')?.addEventListener('click', async () => {
    const enabled = !!reminderEnabledEl?.checked;
    const time = reminderTimeEl?.value || '19:00';

    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        // Ignora erros de permissao para nao travar a experiencia.
      }
    }

    setStoredReminder({
      enabled,
      time,
      lastNotifiedDate: null,
    });
    maybeTriggerWorkoutReminder();
    _redraw(container);
  });
}

function _attachSplits(container) {
  _attachWeeklyPlanner(container, false);
  _attachReminderControls(container);

  // Escolher split
  container.querySelectorAll('.split-card').forEach(card => {
    card.addEventListener('click', () => {
      _exState.split    = card.dataset.split;
      _exState.splitDay = null;
      _redraw(container);
    });
  });

  // Escolher dia
  container.querySelectorAll('[data-dayidx]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      _exState.splitDay = parseInt(el.dataset.dayidx, 10);
      _redraw(container);
    });
  });

  // Voltar
  container.querySelector('#split-back')?.addEventListener('click', () => {
    _exState.split = null; _exState.splitDay = null; _redraw(container);
  });
  container.querySelector('#split-back-day')?.addEventListener('click', () => {
    _exState.splitDay = null; _redraw(container);
  });

  // Cards de exercício dentro do split
  container.querySelectorAll('.expl-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.exid;
      _exState.detail = _exState.exercises.find(e => e.id === id) || null;
      _redraw(container);
    });
  });

  _attachModal(container);
}
