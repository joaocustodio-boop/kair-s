import { store, today } from '../store.js';
import { getCurrentUser } from '../auth.js';
import { refreshIcons } from '../icons.js';

const WEEK_TARGET_EXERCISES = 4;
const WEEK_TARGET_DEVOTIONAL = 7;
const DAILY_KCAL_GOAL_FALLBACK = 2000;

let _openVitalCard = 'finance';
let _selectedChampionMonth = null;
let _clockTicker = null;

function fmt(n) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function monthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || '—';
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
}

function formatNowParts(now = new Date()) {
  const date = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(now);
  const time = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);
  return { date, time };
}

function weekDates(baseDate = today()) {
  const d = new Date(`${baseDate}T12:00:00`);
  const dow = d.getDay();
  const out = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(d);
    cur.setDate(d.getDate() - dow + i);
    out.push(cur.toISOString().split('T')[0]);
  }
  return out;
}

function buildSparklinePoints(values) {
  const width = 118;
  const height = 34;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values.map((v, i) => {
    const x = i * step;
    const y = height - ((v / max) * height);
    return `${x},${Math.max(2, Math.min(height - 2, y)).toFixed(2)}`;
  }).join(' ');
}

function computeThreeWeekTrend(transactions, type) {
  const now = new Date(`${today()}T12:00:00`);
  const buckets = [0, 0, 0];
  for (const t of transactions) {
    if (t.type !== type) continue;
    const d = new Date(`${t.date}T12:00:00`);
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays < 0 || diffDays > 20) continue;
    const bucket = 2 - Math.floor(diffDays / 7);
    if (bucket >= 0 && bucket <= 2) buckets[bucket] += Number(t.amount) || 0;
  }
  return buckets;
}

function monthExpenseAverage(transactions) {
  const grouped = new Map();
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    const key = String(t.date || '').slice(0, 7);
    if (!key) continue;
    grouped.set(key, (grouped.get(key) || 0) + (Number(t.amount) || 0));
  }
  const values = [...grouped.values()];
  if (!values.length) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function exerciseSummary(logs) {
  const dates = new Set(weekDates());
  const weekLogs = logs.filter((log) => dates.has(log.date));
  const done = weekLogs.length;
  const last = [...logs].sort((a, b) => `${b.date}${b.createdAt || ''}`.localeCompare(`${a.date}${a.createdAt || ''}`))[0] || null;
  const pct = Math.min(100, Math.round((done / WEEK_TARGET_EXERCISES) * 100));
  return { done, target: WEEK_TARGET_EXERCISES, last, pct };
}

function foodSummary(alimentos) {
  const entries = (alimentos.entries || []).filter((e) => e.date === today());
  const totalKcal = Math.round(entries.reduce((sum, e) => sum + (Number(e.kcal) || 0), 0));
  const goal = Number(alimentos.dailyGoal) || DAILY_KCAL_GOAL_FALLBACK;
  const pct = Math.min(100, Math.round((totalKcal / Math.max(goal, 1)) * 100));
  const last = [...entries].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;

  const macroGoals = {
    protein: Math.round((goal * 0.3) / 4),
    carbs: Math.round((goal * 0.4) / 4),
    fats: Math.round((goal * 0.3) / 9),
  };
  const macroCurrent = {
    protein: Math.round((totalKcal * 0.3) / 4),
    carbs: Math.round((totalKcal * 0.4) / 4),
    fats: Math.round((totalKcal * 0.3) / 9),
  };

  return {
    totalKcal,
    goal,
    pct,
    last,
    macros: {
      proteinPct: Math.min(100, Math.round((macroCurrent.protein / Math.max(macroGoals.protein, 1)) * 100)),
      carbsPct: Math.min(100, Math.round((macroCurrent.carbs / Math.max(macroGoals.carbs, 1)) * 100)),
      fatsPct: Math.min(100, Math.round((macroCurrent.fats / Math.max(macroGoals.fats, 1)) * 100)),
    },
  };
}

function devotionalSummary(completedDays) {
  const dates = weekDates();
  const done = dates.filter((date) => completedDays.includes(date)).length;
  const pct = Math.min(100, Math.round((done / WEEK_TARGET_DEVOTIONAL) * 100));
  const lastDate = [...completedDays].sort().reverse()[0] || null;
  return { done, target: WEEK_TARGET_DEVOTIONAL, pct, lastDate };
}

function financeSummary(transactions) {
  const month = today().slice(0, 7);
  const monthTransactions = transactions.filter((t) => String(t.date || '').startsWith(month));
  const income = monthTransactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const expense = monthTransactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const balance = income - expense;
  const avg = monthExpenseAverage(transactions);
  return {
    income,
    expense,
    balance,
    expenseAboveAverage: avg > 0 && expense > avg,
    incomeTrend: computeThreeWeekTrend(monthTransactions, 'income'),
    expenseTrend: computeThreeWeekTrend(monthTransactions, 'expense'),
    balanceTrend: computeThreeWeekTrend(monthTransactions, 'income').map((v, i) => v - computeThreeWeekTrend(monthTransactions, 'expense')[i]),
  };
}

function todayCommitments(events) {
  const t = today();
  return [...events]
    .filter((e) => e.date === t)
    .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')))
    .slice(0, 6);
}

function buildPriorityRows(lembretes, workTasks, missions) {
  const personal = lembretes.filter((t) => !t.completed).slice(0, 3).map((t) => ({
    id: t.id,
    source: 'lembrete',
    label: t.text,
    done: false,
    chip: t.priority === 'high' ? 'Alta' : t.priority === 'medium' ? 'Média' : 'Baixa',
  }));

  const work = workTasks.filter((t) => t.status !== 'done').slice(0, 2).map((t) => ({
    id: t.id,
    source: 'work',
    label: t.title,
    done: false,
    chip: 'Work',
  }));

  const missionRows = missions.map((m) => ({
    id: m.id,
    source: 'mission',
    label: m.label,
    done: m.done,
    chip: 'Missão',
  }));

  return [...missionRows, ...personal, ...work].slice(0, 5);
}

function renderSparkline(values, cls) {
  return `
    <svg viewBox="0 0 118 34" class="dash-sparkline ${cls}" aria-hidden="true">
      <polyline points="${buildSparklinePoints(values)}"></polyline>
    </svg>
  `;
}

function renderVitalCard(data) {
  const { finance, exercise, food, devo } = data;
  const cardOpen = (key) => _openVitalCard === key ? 'open' : '';

  return `
    <div class="dash-vital-grid">
      <article class="dash-vital-card ${cardOpen('finance')}">
        <button class="dash-vital-head" data-action="toggle-vital" data-card="finance">
          <h3>Resumo Financeiro Inteligente</h3>
          <i data-lucide="chevron-down"></i>
        </button>
        <div class="dash-vital-main">
          <div class="dash-fin-line"><span>Entradas</span><strong>${fmt(finance.income)}</strong>${renderSparkline(finance.incomeTrend, 'income')}</div>
          <div class="dash-fin-line"><span>Saídas</span><strong>${fmt(finance.expense)}</strong>${renderSparkline(finance.expenseTrend, 'expense')}</div>
          <div class="dash-fin-line"><span>Saldo</span><strong>${fmt(finance.balance)}</strong>${renderSparkline(finance.balanceTrend, 'balance')}</div>
          ${finance.expenseAboveAverage ? '<div class="dash-alert-badge">Gasto acima da média</div>' : ''}
          <a href="#financeiro" class="btn btn-secondary btn-sm">Detalhes Financeiros</a>
        </div>
        <div class="dash-vital-details ${cardOpen('finance')}">
          <p>Tendência das últimas 3 semanas com visão comparativa de entradas e saídas.</p>
          <a href="#financeiro" class="dash-history-link">Ver Histórico Completo</a>
        </div>
      </article>

      <article class="dash-vital-card ${cardOpen('exercise')}">
        <button class="dash-vital-head" data-action="toggle-vital" data-card="exercise">
          <h3>Performance de Exercícios</h3>
          <i data-lucide="chevron-down"></i>
        </button>
        <div class="dash-vital-main">
          <div class="dash-progress-row"><span>${exercise.done} / ${exercise.target} treinos</span><strong>${exercise.pct}%</strong></div>
          <div class="dash-ring" style="--p:${exercise.pct}%"><span>${exercise.pct}%</span></div>
          <small>Último treino: ${exercise.last ? `${escapeHtml(exercise.last.type || 'Treino')} • ${escapeHtml(exercise.last.date)}` : 'Sem registro'}</small>
        </div>
        <div class="dash-vital-details ${cardOpen('exercise')}">
          <div class="dash-quick-actions">
            <a class="btn btn-secondary btn-sm" href="#exercicios">Registrar treino</a>
            <a class="btn btn-secondary btn-sm" href="#exercicios">Editar treino</a>
          </div>
          <a href="#exercicios" class="dash-history-link">Ver Histórico Completo</a>
        </div>
      </article>

      <article class="dash-vital-card ${cardOpen('food')}">
        <button class="dash-vital-head" data-action="toggle-vital" data-card="food">
          <h3>Alimentação Equilibrada</h3>
          <i data-lucide="chevron-down"></i>
        </button>
        <div class="dash-vital-main">
          <div class="dash-progress-row"><span>${food.totalKcal} / ${food.goal} kcal</span><strong>${food.pct}%</strong></div>
          <div class="dash-progress-track"><span style="width:${food.pct}%"></span></div>
          <small>Última refeição: ${food.last ? `${escapeHtml(food.last.name)} • ${new Date(food.last.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Nenhum registro hoje'}</small>
          <div class="dash-macro-row">
            <label>Proteínas <span>${food.macros.proteinPct}%</span></label><div class="dash-macro-track"><span style="width:${food.macros.proteinPct}%"></span></div>
            <label>Carbos <span>${food.macros.carbsPct}%</span></label><div class="dash-macro-track"><span style="width:${food.macros.carbsPct}%"></span></div>
            <label>Gorduras <span>${food.macros.fatsPct}%</span></label><div class="dash-macro-track"><span style="width:${food.macros.fatsPct}%"></span></div>
          </div>
        </div>
        <div class="dash-vital-details ${cardOpen('food')}">
          <div class="dash-quick-actions">
            <a class="btn btn-secondary btn-sm" href="#alimentos">Registrar refeição</a>
            <a class="btn btn-secondary btn-sm" href="#alimentos">Editar refeição</a>
          </div>
          <a href="#alimentos" class="dash-history-link">Ver Histórico Completo</a>
        </div>
      </article>

      <article class="dash-vital-card ${cardOpen('devo')}">
        <button class="dash-vital-head" data-action="toggle-vital" data-card="devo">
          <h3>Progresso Devocional</h3>
          <i data-lucide="chevron-down"></i>
        </button>
        <div class="dash-vital-main">
          <div class="dash-progress-row"><span>${devo.done} / ${devo.target} semana</span><strong>${devo.pct}%</strong></div>
          <div class="dash-progress-track"><span style="width:${devo.pct}%"></span></div>
          <small>Último devocional: ${devo.lastDate ? new Date(`${devo.lastDate}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem registro'}</small>
        </div>
        <div class="dash-vital-details ${cardOpen('devo')}">
          <div class="dash-quick-actions">
            <a class="btn btn-secondary btn-sm" href="#devocional">Abrir devocional</a>
            <a class="btn btn-secondary btn-sm" href="#devocional">Atualizar plano</a>
          </div>
          <a href="#devocional" class="dash-history-link">Ver Histórico Completo</a>
        </div>
      </article>
    </div>
  `;
}

function renderTaskAndAchievements(data) {
  const { priorityRows, rewards } = data;
  return `
    <section class="dash-panel">
      <div class="dash-panel-head">
        <h4>Tarefas Prioritárias</h4>
        <span class="badge">${priorityRows.length}</span>
      </div>
      <div class="dash-task-list">
        ${priorityRows.map((row) => `
          <div class="dash-task-item ${row.done ? 'done' : ''}">
            <button class="dash-neo-check ${row.done ? 'done' : ''}" ${row.source === 'lembrete' ? `data-action="toggle-priority" data-id="${row.id}"` : 'disabled'}>
              <i data-lucide="check"></i>
            </button>
            <div class="dash-task-copy">
              <strong>${escapeHtml(row.label)}</strong>
              <small>${escapeHtml(row.chip)}</small>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="dash-quick-add">
        <input id="dash-quick-task" class="form-input" placeholder="Adicionar tarefa rápida" />
        <button class="btn btn-primary btn-sm" id="dash-quick-task-add"><i data-lucide="plus"></i></button>
      </div>
      <a href="#lembretes" class="dash-history-link">Ver Histórico Completo</a>
    </section>

    <section class="dash-panel">
      <div class="dash-panel-head">
        <h4>Conquistas</h4>
      </div>
      <div class="dash-achievement-list">
        ${(rewards.length ? rewards : [{ reason: 'Complete ações para receber XP', points: 0 }]).map((reward) => `
          <div class="dash-achievement-item">
            <span class="dash-achievement-icon"><i data-lucide="award"></i></span>
            <div>
              <strong>${escapeHtml(reward.reason)}</strong>
              <small>${reward.points ? `+${reward.points} XP` : 'Sem pontuação recente'}</small>
            </div>
          </div>
        `).join('')}
      </div>
      <a href="#dashboard" class="dash-history-link">Ver Histórico Completo</a>
    </section>
  `;
}

function renderTemporalAndChampions(data) {
  const { commitments, champions, selectedChampion, seasonTarget } = data;
  return `
    <section class="dash-panel">
      <div class="dash-panel-head">
        <h4>Compromissos do Dia</h4>
      </div>
      <div class="dash-commitment-list">
        ${commitments.length ? commitments.map((ev) => {
          const joinable = /https?:\/\/|meet|zoom/i.test(String(ev.location || ''));
          return `
            <div class="dash-commitment-item">
              <div class="dash-commitment-time">${escapeHtml(ev.startTime || '--:--')}</div>
              <div class="dash-commitment-copy">
                <strong>${escapeHtml(ev.title)}</strong>
                <small><i data-lucide="map-pin"></i> ${escapeHtml(ev.location || 'Sem local')}</small>
              </div>
              <div class="dash-commitment-actions">
                ${joinable ? `<a class="btn btn-secondary btn-sm" href="${escapeHtml(ev.location)}" target="_blank">Join Meeting</a>` : ''}
                <a class="btn btn-secondary btn-sm" href="#agenda">View Details</a>
              </div>
            </div>
          `;
        }).join('') : '<p class="empty-state" style="padding:12px 0">Sem compromissos para hoje.</p>'}
      </div>
      <a href="#agenda" class="dash-history-link">Ver Histórico Completo</a>
    </section>

    <section class="dash-panel">
      <div class="dash-panel-head">
        <h4>Campeões Mensais</h4>
      </div>
      <div class="dash-champion-list">
        ${champions.length ? champions.map((champ) => {
          const pct = Math.min(100, Math.round(((Number(champ.points) || 0) / Math.max(seasonTarget, 1)) * 100));
          const active = _selectedChampionMonth === champ.month;
          return `
            <button class="dash-champion-item ${active ? 'active' : ''}" data-action="champion-details" data-month="${escapeHtml(champ.month)}">
              <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(monthLabel(champ.month))}&background=1f2b45&color=fff" alt="${escapeHtml(champ.month)}" />
              <div class="dash-champion-copy">
                <strong>${monthLabel(champ.month)}</strong>
                <small>${champ.wonTop1 ? 'Top 1 do mês' : 'Ranking mensal'}</small>
                <div class="dash-progress-track"><span style="width:${pct}%"></span></div>
              </div>
              <span>${champ.points} XP</span>
            </button>
          `;
        }).join('') : '<p class="empty-state" style="padding:12px 0">Sem campeões mensais ainda.</p>'}
      </div>
      ${selectedChampion ? `
        <div class="dash-champion-detail">
          <h5>${monthLabel(selectedChampion.month)}</h5>
          <p>Pontuação: <strong>${selectedChampion.points} XP</strong></p>
          <p>${selectedChampion.wonTop1 ? `Premiação aplicada: +${selectedChampion.reward || 0} XP` : 'Sem premiação neste fechamento.'}</p>
        </div>
      ` : ''}
      <a href="#dashboard" class="dash-history-link">Ver Histórico Completo</a>
    </section>
  `;
}

export function render() {
  const financeiro = store.get('financeiro');
  const habitos = store.get('habitos');
  const lembretes = store.get('lembretes');
  const agenda = store.get('agenda');
  const tarefasJob = store.get('tarefasJob');
  const exercicios = store.get('exercicios');
  const devocional = store.get('devocional');
  const alimentos = store.get('alimentos');
  const gamificacao = store.get('gamificacao');

  const user = getCurrentUser();
  const userName = user?.name || 'Usuário';
  const nowParts = formatNowParts();

  const finance = financeSummary(financeiro.transactions || []);
  const exercise = exerciseSummary(exercicios.logs || []);
  const food = foodSummary(alimentos || { entries: [] });
  const devo = devotionalSummary(devocional.completedDays || []);

  const missionRows = [
    { id: 'm-habit', label: 'Concluir 3 hábitos hoje', done: ((habitos.habits || []).filter((h) => (h.completedDates || []).includes(today())).length >= 3) },
    { id: 'm-workout', label: 'Registrar 1 treino hoje', done: (exercicios.logs || []).some((log) => log.date === today()) },
    { id: 'm-devo', label: 'Finalizar o devocional de hoje', done: (devocional.completedDays || []).includes(today()) },
  ];
  const priorityRows = buildPriorityRows(lembretes.tasks || [], tarefasJob.tasks || [], missionRows);

  const commitments = todayCommitments(agenda.events || []);
  const rewards = (gamificacao.recent || []).slice(0, 4);
  const champions = (gamificacao.champions || []).slice(0, 6);
  const selectedChampion = champions.find((c) => c.month === _selectedChampionMonth) || null;
  const seasonTarget = Number(gamificacao.seasonTargetPoints) || 500;

  return `
    <div class="page-dashboard-pro">
      <section class="dash-command-header">
        <div>
          <p class="dash-label">Centro de Comando Vital</p>
          <h2>FocusDash</h2>
          <p>Olá, ${escapeHtml(userName)}. Pronto para dominar o dia?</p>
        </div>
        <div class="dash-now" id="dash-now">
          <strong>${escapeHtml(nowParts.time)}</strong>
          <span>${escapeHtml(nowParts.date)}</span>
        </div>
      </section>

      ${renderVitalCard({ finance, exercise, food, devo })}

      <section class="dash-focus-layout">
        <div class="dash-focus-col">
          ${renderTaskAndAchievements({ priorityRows, rewards })}
        </div>
        <div class="dash-focus-col">
          ${renderTemporalAndChampions({ commitments, champions, selectedChampion, seasonTarget })}
        </div>
      </section>
    </div>
  `;
}

export function init(container) {
  function rerender() {
    container.innerHTML = render();
    refreshIcons();
    init(container);
  }

  function updateClockLabel() {
    if (!document.body.contains(container)) {
      if (_clockTicker) {
        window.clearInterval(_clockTicker);
        _clockTicker = null;
      }
      return;
    }
    const now = container.querySelector('#dash-now');
    if (!now) return;
    const parts = formatNowParts();
    now.innerHTML = `<strong>${escapeHtml(parts.time)}</strong><span>${escapeHtml(parts.date)}</span>`;
  }

  if (_clockTicker) {
    window.clearInterval(_clockTicker);
    _clockTicker = null;
  }
  _clockTicker = window.setInterval(updateClockLabel, 30000);

  container.querySelectorAll('[data-action="toggle-vital"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.dataset.card;
      _openVitalCard = _openVitalCard === card ? '' : card;
      rerender();
    });
  });

  container.querySelectorAll('[data-action="toggle-priority"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number.parseInt(btn.dataset.id, 10);
      store.update('lembretes', (data) => {
        data.tasks = (data.tasks || []).map((task) => task.id !== id ? task : { ...task, completed: !task.completed });
        return data;
      });
      rerender();
    });
  });

  container.querySelector('#dash-quick-task-add')?.addEventListener('click', () => {
    const input = container.querySelector('#dash-quick-task');
    const text = String(input?.value || '').trim();
    if (text.length < 3) return;
    store.update('lembretes', (data) => {
      data.tasks = Array.isArray(data.tasks) ? data.tasks : [];
      data.tasks.unshift({
        id: store.nextId(data.tasks),
        text,
        priority: 'medium',
        category: 'pessoal',
        completed: false,
        createdAt: new Date().toISOString(),
      });
      return data;
    });
    rerender();
  });

  container.querySelector('#dash-quick-task')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    container.querySelector('#dash-quick-task-add')?.click();
  });

  container.querySelectorAll('[data-action="champion-details"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const month = String(btn.dataset.month || '');
      _selectedChampionMonth = _selectedChampionMonth === month ? null : month;
      rerender();
    });
  });

  refreshIcons();
}
