import { getDataScopeKey } from './auth.js';

const KEYS = {
  financeiro: 'fd-financeiro',
  habitos: 'fd-habitos',
  exercicios: 'fd-exercicios',
  alimentos: 'fd-alimentos',
  lembretes: 'fd-lembretes',
  agenda: 'fd-agenda',
  tarefasJob: 'fd-tarefas-job',
  anotacoes: 'fd-anotacoes',
  devocional: 'fd-devocional',
  music: 'fd-music',
  gamificacao: 'fd-gamificacao',
};

function scopedKey(key) {
  const base = KEYS[key];
  const scope = getDataScopeKey();
  return `${base}::${scope}`;
}

export const today = () => new Date().toISOString().split('T')[0];

const defaults = {
  financeiro: {
    transactions: [
      { id: 1, type: 'income', category: 'Salário', description: 'Salário mensal', amount: 5000, date: '2026-04-01' },
      { id: 2, type: 'expense', category: 'Alimentação', description: 'Supermercado', amount: 450, date: '2026-04-02' },
      { id: 3, type: 'expense', category: 'Transporte', description: 'Combustível', amount: 200, date: '2026-04-03' },
    ]
  },
  habitos: {
    habits: [
      { id: 1, name: 'Beber 2L de água', icon: 'droplets', completedDates: [] },
      { id: 2, name: 'Meditação 10 min', icon: 'sparkles', completedDates: [] },
      { id: 3, name: 'Leitura 20 min', icon: 'book-open', completedDates: [] },
      { id: 4, name: 'Exercício físico', icon: 'activity', completedDates: [] },
    ],
    vitamins: [
      { id: 1, name: 'Vitamina C', dose: '500mg', completedDates: [] },
      { id: 2, name: 'Vitamina D', dose: '1000UI', completedDates: [] },
      { id: 3, name: 'Ômega 3', dose: '1g', completedDates: [] },
    ],
  },
  exercicios: {
    logs: [],
    weeklyPlan: null,
    reminder: {
      enabled: false,
      time: '19:00',
      lastNotifiedDate: null,
    },
  },
  alimentos: {
    entries: [],
  },
  lembretes: {
    tasks: [
      { id: 1, text: 'Revisão do projeto XYZ', priority: 'high', category: 'trabalho', completed: false, createdAt: new Date().toISOString() },
      { id: 2, text: 'Comprar mantimentos', priority: 'medium', category: 'pessoal', completed: false, createdAt: new Date().toISOString() },
      { id: 3, text: 'Enviar relatório trimestral', priority: 'high', category: 'trabalho', completed: true, createdAt: new Date().toISOString() },
    ]
  },
  agenda: {
    events: [
      { id: 1, title: 'Reunião de Alinhamento', date: '2026-04-04', startTime: '14:00', endTime: '15:30', location: 'Google Meet', type: 'reuniao', notes: '' },
      { id: 2, title: 'Consulta Médica', date: '2026-04-08', startTime: '10:00', endTime: '11:00', location: 'Clínica Central', type: 'medico', notes: 'Trazer exames' },
      { id: 3, title: 'Aniversário da Maria', date: '2026-04-15', startTime: '19:00', endTime: '22:00', location: 'Restaurante Central', type: 'pessoal', notes: '' },
    ]
  },
  tarefasJob: {
    tasks: [
      { id: 1, title: 'Implementar feature X', description: 'Nova funcionalidade de login social', status: 'doing', priority: 'high', project: 'Projeto Alpha', dueDate: '2026-04-10', createdAt: new Date().toISOString() },
      { id: 2, title: 'Code review PR #42', description: '', status: 'todo', priority: 'medium', project: 'Projeto Alpha', dueDate: '', createdAt: new Date().toISOString() },
      { id: 3, title: 'Deploy versão 2.1', description: 'Subir nova versão para produção', status: 'done', priority: 'high', project: 'Projeto Beta', dueDate: '2026-04-05', createdAt: new Date().toISOString() },
      { id: 4, title: 'Atualizar documentação API', description: '', status: 'todo', priority: 'low', project: 'Projeto Beta', dueDate: '2026-04-20', createdAt: new Date().toISOString() },
    ]
  },
  anotacoes: {
    notes: [
      { id: 1, title: 'Ideias para o projeto', content: 'Implementar sistema de cache para melhorar performance. Considerar Redis.\nTambém verificar a otimização do banco de dados.', tags: ['trabalho', 'dev'], color: 'blue', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), pinned: true },
      { id: 2, title: 'Lista de compras', content: 'Arroz, feijão, macarrão, frango, legumes, frutas', tags: ['pessoal'], color: 'green', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), pinned: false },
    ]
  },
  devocional: {
    prayers: [],
    reflections: [],
    completedDays: [],
  },
  music: {
    favorites: [],
    currentSongId: null,
    history: [],
  },
  gamificacao: {
    totalPoints: 0,
    level: 1,
    monthly: [],
    recent: [],
    badges: [],
    missionBonusDates: [],
    champions: [],
    seasonTargetPoints: 500,
    lastChampionAwardMonth: null,
    updatedAt: new Date().toISOString(),
  },
};

function ensureGamificationShape(data) {
  const safe = data && typeof data === 'object' ? data : {};
  return {
    totalPoints: Number.isFinite(safe.totalPoints) ? safe.totalPoints : 0,
    level: Number.isFinite(safe.level) ? safe.level : 1,
    monthly: Array.isArray(safe.monthly) ? safe.monthly : [],
    recent: Array.isArray(safe.recent) ? safe.recent : [],
    badges: Array.isArray(safe.badges) ? safe.badges : [],
    missionBonusDates: Array.isArray(safe.missionBonusDates) ? safe.missionBonusDates : [],
    champions: Array.isArray(safe.champions) ? safe.champions : [],
    seasonTargetPoints: Number.isFinite(safe.seasonTargetPoints) ? safe.seasonTargetPoints : 500,
    lastChampionAwardMonth: safe.lastChampionAwardMonth || null,
    updatedAt: safe.updatedAt || new Date().toISOString(),
  };
}

function previousMonthKey(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return null;
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(year, month - 1, 1);
  d.setMonth(d.getMonth() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function pointsForLevel(totalPoints) {
  return Math.floor((totalPoints || 0) / 300) + 1;
}

function addedCount(prevList, nextList) {
  const a = Array.isArray(prevList) ? prevList.length : 0;
  const b = Array.isArray(nextList) ? nextList.length : 0;
  return Math.max(0, b - a);
}

function countCompletedDatesAdded(prevItems, nextItems) {
  const prevMap = new Map((Array.isArray(prevItems) ? prevItems : []).map((item) => [item.id, new Set(item.completedDates || [])]));
  let total = 0;
  for (const item of (Array.isArray(nextItems) ? nextItems : [])) {
    const prevDates = prevMap.get(item.id) || new Set();
    for (const d of (item.completedDates || [])) {
      if (!prevDates.has(d)) total++;
    }
  }
  return total;
}

function countTaskTransitionDone(prevTasks, nextTasks) {
  const prevMap = new Map((Array.isArray(prevTasks) ? prevTasks : []).map((task) => [task.id, task]));
  let total = 0;
  for (const task of (Array.isArray(nextTasks) ? nextTasks : [])) {
    const before = prevMap.get(task.id);
    if (before && !before.completed && task.completed) total++;
  }
  return total;
}

function countWorkStatusDone(prevTasks, nextTasks) {
  const prevMap = new Map((Array.isArray(prevTasks) ? prevTasks : []).map((task) => [task.id, task.status]));
  let total = 0;
  for (const task of (Array.isArray(nextTasks) ? nextTasks : [])) {
    const before = prevMap.get(task.id);
    if (before && before !== 'done' && task.status === 'done') total++;
  }
  return total;
}

function collectAwards(key, current, updated) {
  const awards = [];
  const addAward = (count, pointsEach, reason) => {
    if (!count || count <= 0) return;
    awards.push({
      reason,
      count,
      points: count * pointsEach,
    });
  };

  if (key === 'habitos') {
    addAward(countCompletedDatesAdded(current.habits, updated.habits), 10, 'Hábito concluído');
    addAward(countCompletedDatesAdded(current.vitamins, updated.vitamins), 5, 'Vitamina marcada');
  }

  if (key === 'exercicios') {
    addAward(addedCount(current.logs, updated.logs), 25, 'Treino registrado');
    const createdPlan = !current.weeklyPlan && !!updated.weeklyPlan;
    addAward(createdPlan ? 1 : 0, 20, 'Plano semanal criado');
  }

  if (key === 'lembretes') {
    addAward(countTaskTransitionDone(current.tasks, updated.tasks), 15, 'Tarefa concluída');
  }

  if (key === 'tarefasJob') {
    addAward(countWorkStatusDone(current.tasks, updated.tasks), 20, 'Tarefa de trabalho concluída');
  }

  if (key === 'devocional') {
    addAward(addedCount(current.completedDays, updated.completedDays), 18, 'Devocional concluído');
    addAward(addedCount(current.prayers, updated.prayers), 8, 'Oração registrada');
    addAward(addedCount(current.reflections, updated.reflections), 10, 'Reflexão registrada');
  }

  if (key === 'agenda') {
    addAward(addedCount(current.events, updated.events), 6, 'Compromisso adicionado');
  }

  if (key === 'anotacoes') {
    addAward(addedCount(current.notes, updated.notes), 4, 'Anotação criada');
  }

  if (key === 'financeiro') {
    addAward(addedCount(current.transactions, updated.transactions), 3, 'Lançamento financeiro');
  }

  return awards;
}

function addRecentEvent(gamification, reason, points, count = 1) {
  gamification.recent.unshift({
    id: Date.now() + Math.floor(Math.random() * 1000),
    date: today(),
    reason,
    count,
    points,
  });
}

function grantBadgeIfMissing(gamification, id, title, description) {
  const exists = gamification.badges.some((badge) => badge.id === id);
  if (exists) return;
  gamification.badges.unshift({
    id,
    title,
    description,
    unlockedAt: today(),
  });
}

function applyBadgeRules(gamification) {
  const monthKey = today().slice(0, 7);
  const month = gamification.monthly.find((m) => m.month === monthKey) || { points: 0 };
  const activeDays = new Set((gamification.recent || []).map((ev) => ev.date)).size;

  if (gamification.totalPoints >= 100) {
    grantBadgeIfMissing(gamification, 'starter', 'Iniciante', 'Chegue a 100 XP totais.');
  }
  if (gamification.totalPoints >= 500) {
    grantBadgeIfMissing(gamification, 'warrior', 'Guerreiro', 'Chegue a 500 XP totais.');
  }
  if (gamification.totalPoints >= 1000) {
    grantBadgeIfMissing(gamification, 'legend', 'Lenda', 'Chegue a 1000 XP totais.');
  }
  if (month.points >= 300) {
    grantBadgeIfMissing(gamification, `month-300-${monthKey}`, 'Campeão do Mês', 'Alcance 300 XP no mês atual.');
  }
  if (activeDays >= 7) {
    grantBadgeIfMissing(gamification, 'consistency-7', 'Consistência', 'Realize ações com pontuação em 7 dias diferentes.');
  }

  gamification.badges = gamification.badges.slice(0, 30);
}

function resolveMissionState(storeApi) {
  const t = today();
  const { habits } = storeApi.get('habitos');
  const { logs } = storeApi.get('exercicios');
  const { completedDays } = storeApi.get('devocional');

  const habitsDone = habits.filter((h) => (h.completedDates || []).includes(t)).length;
  const workoutDone = logs.filter((l) => l.date === t).length;
  const devoDone = (completedDays || []).includes(t) ? 1 : 0;

  return {
    habitsDone,
    workoutDone,
    devoDone,
    allDone: habitsDone >= 3 && workoutDone >= 1 && devoDone >= 1,
  };
}

function applyDailyMissionBonus(storeApi, gamification) {
  const t = today();
  const state = resolveMissionState(storeApi);
  if (!state.allDone) return;
  if (gamification.missionBonusDates.includes(t)) return;

  const monthKey = t.slice(0, 7);
  let month = gamification.monthly.find((m) => m.month === monthKey);
  if (!month) {
    month = { month: monthKey, points: 0, actions: 0 };
    gamification.monthly.push(month);
  }

  gamification.totalPoints += 50;
  month.points += 50;
  month.actions += 1;
  gamification.missionBonusDates.push(t);
  gamification.missionBonusDates = gamification.missionBonusDates.slice(-180);
  addRecentEvent(gamification, 'Missões diárias completas', 50, 1);
}

function applyMonthlyChampionAward(gamification) {
  const currentMonth = today().slice(0, 7);
  const prevMonth = previousMonthKey(currentMonth);
  if (!prevMonth) return;
  if (gamification.lastChampionAwardMonth === prevMonth) return;

  const prevEntry = gamification.monthly.find((m) => m.month === prevMonth);
  if (!prevEntry || prevEntry.points <= 0) {
    gamification.lastChampionAwardMonth = prevMonth;
    return;
  }

  const target = gamification.seasonTargetPoints || 500;
  const wonTop1 = prevEntry.points >= target;
  const reward = wonTop1 ? 100 : 0;

  gamification.champions.unshift({
    month: prevMonth,
    points: prevEntry.points,
    wonTop1,
    reward,
    rewardedAt: today(),
  });
  gamification.champions = gamification.champions.slice(0, 24);

  if (wonTop1) {
    gamification.totalPoints += reward;
    addRecentEvent(gamification, `Prêmio Top 1 de ${prevMonth}`, reward, 1);
    grantBadgeIfMissing(
      gamification,
      `top1-${prevMonth}`,
      'Top 1 Mensal',
      `Fechou ${prevMonth} com pontuação de campeão e ganhou bônus especial.`,
    );
  }

  gamification.lastChampionAwardMonth = prevMonth;
}

export const store = {
  today,
  get(key) {
    const keyScoped = scopedKey(key);
    const stored = localStorage.getItem(keyScoped);
    if (stored) {
      try { return JSON.parse(stored); } catch { /* fall through */ }
    }

    // Migração de dados antigos sem escopo (versões anteriores)
    const legacy = localStorage.getItem(KEYS[key]);
    if (legacy) {
      try {
        const legacyParsed = JSON.parse(legacy);
        localStorage.setItem(keyScoped, JSON.stringify(legacyParsed));
        return legacyParsed;
      } catch {
        // ignorar legado inválido
      }
    }

    const data = JSON.parse(JSON.stringify(defaults[key]));
    localStorage.setItem(keyScoped, JSON.stringify(data));
    return data;
  },
  set(key, data) {
    localStorage.setItem(scopedKey(key), JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('store:changed', {
      detail: { key },
    }));
  },
  update(key, updater) {
    const current = this.get(key);
    const updated = updater(current);
    this.set(key, updated);

    if (key !== 'gamificacao') {
      const awards = collectAwards(key, current, updated);
      if (awards.length) {
        const gamification = ensureGamificationShape(this.get('gamificacao'));
        const beforePoints = gamification.totalPoints;
        const earnedEntries = awards.map((a) => ({ reason: a.reason, points: a.points }));
        const monthKey = today().slice(0, 7);
        let month = gamification.monthly.find((m) => m.month === monthKey);
        if (!month) {
          month = { month: monthKey, points: 0, actions: 0 };
          gamification.monthly.push(month);
        }

        for (const award of awards) {
          gamification.totalPoints += award.points;
          month.points += award.points;
          month.actions += award.count;
          addRecentEvent(gamification, award.reason, award.points, award.count);
        }

        const hadMissionBonusToday = gamification.missionBonusDates.includes(today());
        applyDailyMissionBonus(this, gamification);
        if (!hadMissionBonusToday && gamification.missionBonusDates.includes(today())) {
          earnedEntries.push({ reason: 'Missões diárias completas', points: 50 });
        }

        const previousChampionCount = gamification.champions.length;
        const previousTop1Count = gamification.champions.filter((c) => c.wonTop1).length;
        applyMonthlyChampionAward(gamification);
        if (gamification.champions.length > previousChampionCount) {
          const top1Count = gamification.champions.filter((c) => c.wonTop1).length;
          if (top1Count > previousTop1Count) {
            earnedEntries.push({ reason: 'Prêmio Top 1 mensal', points: 100 });
          }
        }

        gamification.recent = gamification.recent.slice(0, 40);
        gamification.level = pointsForLevel(gamification.totalPoints);
        applyBadgeRules(gamification);
        gamification.updatedAt = new Date().toISOString();
        this.set('gamificacao', gamification);

        const gainedPoints = Math.max(0, gamification.totalPoints - beforePoints);
        if (gainedPoints > 0) {
          window.dispatchEvent(new CustomEvent('gamification:points-earned', {
            detail: {
              points: gainedPoints,
              entries: earnedEntries,
            },
          }));
        }
      }
    }

    return updated;
  },
  nextId(arr) {
    if (!arr || arr.length === 0) return 1;
    return Math.max(...arr.map(i => i.id || 0)) + 1;
  }
};
