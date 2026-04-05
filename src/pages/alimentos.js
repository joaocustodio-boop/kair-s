import { refreshIcons } from '../icons.js';
import { searchFoodProductsWithFallback, resolveEmojiForFood, LOCAL_FOODS_BR } from '../openFoodFactsApi.js';
import { store, today } from '../store.js';

const PAGE_SIZE = 12;

let _state = {
  query: '',
  loading: false,
  error: '',
  products: [],
  count: 0,
  page: 1,
  provider: 'local',
  didSearch: false,
  autoLoading: false,
  autoFeedback: '',
};

let _selectedDate = today();

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function roundKcal(value) {
  return Math.round(Number(value) || 0);
}

function calcKcalByGrams(kcal100g, grams) {
  const base = toNumber(kcal100g);
  const g = Math.max(1, Number(grams) || 100);
  if (!Number.isFinite(base)) return null;
  return roundKcal((base * g) / 100);
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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

const PORTION_RULES = [
  { rx: /\bovo(s)?\b/, grams: 50 },
  { rx: /\bpao\b|\bpao frances\b|\bpao integral\b/, grams: 50 },
  { rx: /\bsuco\b/, grams: 240 },
  { rx: /\bleite\b/, grams: 200 },
  { rx: /\bcafe\b/, grams: 120 },
  { rx: /\barroz\b/, grams: 120 },
  { rx: /\bfeijao\b/, grams: 100 },
  { rx: /\bfrango\b|\bcarne\b|\bpeixe\b/, grams: 120 },
  { rx: /\bbanana\b|\bmaca\b|\bpera\b|\blaranja\b/, grams: 80 },
  { rx: /\biogurte\b/, grams: 170 },
];

function estimatePortionGrams(itemName) {
  const normalized = normalizeText(itemName);
  for (const rule of PORTION_RULES) {
    if (rule.rx.test(normalized)) return rule.grams;
  }
  return 100;
}

function parseMealText(rawText) {
  const text = normalizeText(rawText)
    .replace(/^comi\s+/, '')
    .replace(/^eu\s+comi\s+/, '')
    .replace(/\be\b/g, ',')
    .replace(/;/g, ',');

  return text
    .split(',')
    .map((part) => part.trim())
    .map((part) => part.replace(/^(um|uma|uns|umas)\s+/, '1 '))
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(\d+)\s+(.+)$/);
      if (!match) return { quantity: 1, item: part };
      return {
        quantity: Math.max(1, Number(match[1]) || 1),
        item: String(match[2] || '').trim(),
      };
    })
    .filter((entry) => entry.item.length >= 2);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function resolveCaloriesForItem(itemText, provider) {
  const result = await searchFoodProductsWithFallback(itemText, {
    provider,
    page: 1,
    pageSize: 6,
  });

  const products = Array.isArray(result?.products) ? result.products : [];
  const best = products.find((product) => Number.isFinite(toNumber(product?.nutriments?.kcal100g)));
  if (!best) return null;

  const kcal100g = toNumber(best.nutriments.kcal100g);
  return {
    name: best.name || itemText,
    brand: best.brand || '',
    source: best.source || '',
    code: best.code || '',
    kcal100g,
  };
}

function getEntriesByDate(dateStr = _selectedDate) {
  const data = store.get('alimentos');
  const all = Array.isArray(data?.entries) ? data.entries : [];
  return all
    .filter((entry) => entry.date === dateStr)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function getTodaySummary() {
  const entries = getEntriesByDate();
  const totalKcal = entries.reduce((sum, entry) => sum + (Number(entry.kcal) || 0), 0);
  return {
    entries,
    totalKcal: roundKcal(totalKcal),
  };
}

const MEALS = [
  { id: 'breakfast', name: '🌅 Café da Manhã', emoji: '🌅' },
  { id: 'snack1', name: '🥐 1º Lanche', emoji: '🥐' },
  { id: 'lunch', name: '🍽️ Almoço', emoji: '🍽️' },
  { id: 'snack2', name: '🍎 2º Lanche', emoji: '🍎' },
  { id: 'dinner', name: '🌙 Jantar', emoji: '🌙' },
];
const DAILY_GOAL_KCAL = 2000; // Meta padrão: 2000 kcal/dia

// Distribuição nutricional coerente (% da meta diária)
const MEAL_PERCENTAGES = {
  breakfast: 0.20,  // 20% = 400 kcal
  snack1: 0.10,     // 10% = 200 kcal
  lunch: 0.40,      // 40% = 800 kcal
  snack2: 0.10,     // 10% = 200 kcal
  dinner: 0.20,     // 20% = 400 kcal
};

function getMealGoal(mealId, totalGoal) {
  const percentage = MEAL_PERCENTAGES[mealId] || 0.2;
  return roundKcal((totalGoal * percentage));
}

function getDailyGoal() {
  const data = store.get('alimentos');
  return Number(data?.dailyGoal) || DAILY_GOAL_KCAL;
}

function setDailyGoal(goal) {
  store.update('alimentos', (data) => {
    const payload = data || { entries: [] };
    payload.dailyGoal = Math.max(500, Number(goal) || DAILY_GOAL_KCAL);
    return payload;
  });
}
function getTodaySummaryByMeal() {
  const entries = getEntriesByDate();
  const goal = getDailyGoal();
  const byMeal = {};
  
  MEALS.forEach((meal) => {
    const mealGoal = getMealGoal(meal.id, goal);
    byMeal[meal.id] = {
      ...meal,
      entries: entries.filter((e) => e.meal === meal.id),
      kcal: 0,
      goal: mealGoal,
      remaining: mealGoal,
      percentUsed: 0,
    };
  });
  
  entries.forEach((entry) => {
    const meal = byMeal[entry.meal] || byMeal['breakfast'];
    meal.kcal += Number(entry.kcal) || 0;
    meal.kcal = roundKcal(meal.kcal);
  });

  // Recalcula remaining e percent para cada refeição
  MEALS.forEach((meal) => {
    const m = byMeal[meal.id];
    m.remaining = roundKcal(Math.max(0, m.goal - m.kcal));
    m.percentUsed = Math.min(100, Math.round((m.kcal / m.goal) * 100));
  });
  
  const totalKcal = entries.reduce((sum, entry) => sum + (Number(entry.kcal) || 0), 0);
  const remaining = Math.max(0, goal - totalKcal);
  const percentUsed = Math.min(100, Math.round((totalKcal / goal) * 100));
  
  return {
    byMeal,
    meals: MEALS.map((m) => byMeal[m.id]),
    totalKcal: roundKcal(totalKcal),
    goal,
    remaining: roundKcal(remaining),
    percentUsed,
    entries,
  };
}

function addFoodEntry(entry) {
  store.update('alimentos', (data) => {
    const payload = data || { entries: [] };
    payload.entries = Array.isArray(payload.entries) ? payload.entries : [];
    payload.entries.unshift({
      id: store.nextId(payload.entries),
      date: _selectedDate,
      createdAt: new Date().toISOString(),
      ...entry,
    });
    return payload;
  });
}

function removeFoodEntry(id) {
  store.update('alimentos', (data) => {
    const payload = data || { entries: [] };
    payload.entries = (Array.isArray(payload.entries) ? payload.entries : []).filter((entry) => entry.id !== id);
    return payload;
  });
}

function clearDailyEntries() {
  const selectedDate = _selectedDate;
  store.update('alimentos', (data) => {
    const payload = data || { entries: [] };
    payload.entries = (Array.isArray(payload.entries) ? payload.entries : []).filter((entry) => entry.date !== selectedDate);
    return payload;
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatValue(value, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${value}${suffix}`;
}

function renderNutriBadge(score) {
  if (!score) return '<span class="off-badge off-badge-muted">Nutri-Score: N/D</span>';
  return `<span class="off-badge off-badge-${score.toLowerCase()}">Nutri-Score ${score}</span>`;
}

function renderNovaBadge(group) {
  if (!group) return '<span class="off-badge off-badge-muted">NOVA: N/D</span>';
  return `<span class="off-badge off-badge-nova">NOVA ${group}</span>`;
}

function renderProductCard(product) {
  const emoji = product.emoji || '🍽️';
  const image = product.imageUrl
    ? `
      <img
        src="${escapeHtml(product.imageUrl)}"
        alt="${escapeHtml(product.name)}"
        loading="lazy"
        referrerpolicy="no-referrer"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
      />
      <div class="off-no-image" style="display:none"><span class="off-food-emoji">${emoji}</span></div>
    `
    : `<div class="off-no-image"><span class="off-food-emoji">${emoji}</span></div>`;

  const countryTag = Array.isArray(product.countries) && product.countries.length
    ? product.countries[0].replace('en:', '').replace(/-/g, ' ')
    : '—';

  const kcal100g = toNumber(product?.nutriments?.kcal100g);
  const kcalAvailable = Number.isFinite(kcal100g);

  return `
    <article class="off-card">
      <div class="off-card-image">${image}</div>
      <div class="off-card-body">
        <h3 class="off-card-title">${escapeHtml(product.name)}</h3>
        <p class="off-card-subtitle">${escapeHtml(product.brand || 'Marca não informada')}</p>
        <div class="off-card-badges">
          ${renderNutriBadge(product.nutriScore)}
          ${renderNovaBadge(product.novaGroup)}
          <span class="off-badge off-badge-source">${escapeHtml(product.source || 'Fonte desconhecida')}</span>
        </div>

        <div class="off-macros-grid">
          <div class="off-macro"><span>Kcal</span><strong>${formatValue(product.nutriments.kcal100g, ' /100g')}</strong></div>
          <div class="off-macro"><span>Prot</span><strong>${formatValue(product.nutriments.protein100g, 'g')}</strong></div>
          <div class="off-macro"><span>Carb</span><strong>${formatValue(product.nutriments.carbs100g, 'g')}</strong></div>
          <div class="off-macro"><span>Gord</span><strong>${formatValue(product.nutriments.fat100g, 'g')}</strong></div>
        </div>

        <p class="off-card-meta">
          <span><i data-lucide="barcode"></i> ${escapeHtml(product.code || 'sem código')}</span>
          <span><i data-lucide="package"></i> ${escapeHtml(product.quantity || 'porção não informada')}</span>
          <span><i data-lucide="map-pin"></i> ${escapeHtml(countryTag)}</span>
        </p>

        <div class="off-add-box">
          <select class="form-select off-meal-select" data-code="${escapeHtml(product.code || '')}">
            ${MEALS.map((m) => `<option value="${m.id}">${m.emoji} ${m.name}</option>`).join('')}
          </select>
          <input
            type="number"
            min="1"
            step="1"
            value="100"
            class="form-input off-grams-input"
            data-role="grams"
            data-code="${escapeHtml(product.code || '')}"
            placeholder="gramas"
            ${kcalAvailable ? '' : 'disabled'}
          />
          <button
            class="btn btn-primary off-add-btn"
            data-action="add-food"
            data-code="${escapeHtml(product.code || '')}"
            data-name="${escapeHtml(product.name)}"
            data-brand="${escapeHtml(product.brand || '')}"
            data-source="${escapeHtml(product.source || '')}"
            data-kcal100g="${kcalAvailable ? kcal100g : ''}"
            ${kcalAvailable ? '' : 'disabled'}
          >
            <i data-lucide="plus"></i> Adicionar
          </button>
        </div>
        ${kcalAvailable ? '' : '<p class="off-card-note">Este item não tem calorias por 100g na base.</p>'}
      </div>
    </article>
  `;
}

function renderEntryRow(entry) {
  return `
    <div class="off-entry-row" data-id="${entry.id}">
      <div class="off-entry-main">
        <strong>${escapeHtml(entry.name)}</strong>
        <span>${escapeHtml(entry.brand || 'Sem marca')} • ${entry.grams}g • ${entry.kcal100g} kcal/100g</span>
      </div>
      <div class="off-entry-side">
        <strong>${entry.kcal} kcal</strong>
        <button class="btn-icon danger" data-action="remove-entry" data-id="${entry.id}">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    </div>
  `;
}

function renderDiary() {
  const summary = getTodaySummaryByMeal();
  const selectedDateLabel = formatDateLabel(_selectedDate);
  const isTodayView = isTodayDate(_selectedDate);
  const disableNext = _selectedDate >= today();

  const mealSections = summary.meals
    .map((meal) => {
      // Determina status da refeição
      const diff = meal.kcal - meal.goal;
      const diffPercent = (diff / meal.goal) * 100;
      
      let status = 'below'; // padrão: abaixo
      let statusIcon = '⚠️';
      
      if (diffPercent >= -10 && diffPercent <= 10) {
        // Meta atingida (90-110% da meta)
        status = 'achieved';
        statusIcon = '⭐';
      } else if (diffPercent > 10) {
        // Acima da meta
        status = 'over';
        statusIcon = '⚠️';
      }
      // Se abaixo, mantém status 'below' e ⚠️
      
      return `
      <div class="off-meal-section off-meal-${status}" data-meal="${meal.id}">
        <div class="off-meal-status-badge">${statusIcon}</div>
        <h4 class="off-meal-title">${meal.name}</h4>
        <div class="off-meal-entries">
          ${meal.entries.length ? meal.entries.map(renderEntryRow).join('') : '<p class="empty-state-small">Nenhum item nesta refeição.</p>'}
        </div>
        <div class="off-meal-summary">
          <strong>${meal.kcal} kcal</strong>
          <span>meta: ${meal.goal}</span>
        </div>
        <div class="off-meal-progress">
          <div class="off-meal-progress-bar" style="width:${meal.percentUsed}%"></div>
          <span class="off-meal-progress-percent">${meal.percentUsed}%</span>
        </div>
        <form class="off-meal-add-form" data-meal="${meal.id}">
          <input
            type="text"
            class="form-input off-meal-input"
            placeholder="Ex: pão, ovo"
            required
          />
          <input
            type="number"
            class="form-input off-meal-grams"
            placeholder="g"
            min="50"
            step="50"
            value="100"
          />
          <button class="btn btn-primary" type="submit" ${_state.autoLoading ? 'disabled' : ''}>
            <i data-lucide="plus"></i>
          </button>
        </form>
      </div>
    `;
    })
    .join('');

  // Determina status da meta diária
  const diffPercent = ((summary.totalKcal - summary.goal) / summary.goal) * 100;
  let dailyStatus = 'below'; // padrão
  let dailyStatusIcon = '⚠️';
  
  if (diffPercent >= -10 && diffPercent <= 10) {
    // Meta atingida (90-110%)
    dailyStatus = 'achieved';
    dailyStatusIcon = '⭐';
  } else if (diffPercent > 10) {
    // Acima da meta
    dailyStatus = 'over';
    dailyStatusIcon = '⚠️';
  }
  // Se abaixo, mantém 'below' e ⚠️

  return `
    <section class="content-section off-diary-section">
      <div class="off-history-nav">
        <button class="btn btn-secondary" id="off-date-prev" type="button" title="Dia anterior">
          <i data-lucide="chevron-left"></i>
        </button>
        <div class="off-history-label">
          <strong>${selectedDateLabel}</strong>
          <span>${isTodayView ? 'Hoje' : 'Histórico'}</span>
        </div>
        <button class="btn btn-secondary" id="off-date-next" type="button" title="Próximo dia" ${disableNext ? 'disabled' : ''}>
          <i data-lucide="chevron-right"></i>
        </button>
        <button class="btn btn-secondary" id="off-date-today" type="button" ${isTodayView ? 'disabled' : ''}>
          Hoje
        </button>
      </div>

      <div class="off-status-card off-status-${dailyStatus}">
        <div class="off-status-badge">${dailyStatusIcon}</div>
        <div class="off-status-header">
          <div style="display:flex; justify-content:space-between; align-items:center">
            <h3 style="margin:0">Meta Diária</h3>
            <div style="display:flex; gap:6px">
              <input
                type="number"
                id="off-goal-input"
                class="form-input off-goal-field"
                value="${summary.goal}"
                min="500"
                step="50"
              />
              <button id="off-goal-btn" class="btn btn-secondary" type="button" style="padding:4px 10px; font-size:0.75rem; height:28px">
                <i data-lucide="save"></i>
              </button>
              <button id="off-clear-btn" class="btn btn-secondary" type="button" style="padding:4px 10px; font-size:0.75rem; height:28px; background:#dc2626">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>
        </div>
        <div class="off-status-values">
          <div class="off-status-item">
            <span class="off-status-label">Consumido</span>
            <strong class="off-status-amount">${summary.totalKcal}</strong>
            <span class="off-status-unit">kcal</span>
          </div>
          <div class="off-status-divider"></div>
          <div class="off-status-item">
            <span class="off-status-label">Meta</span>
            <strong class="off-status-amount">${summary.goal}</strong>
            <span class="off-status-unit">kcal</span>
          </div>
          <div class="off-status-divider"></div>
          <div class="off-status-item">
            <span class="off-status-label">Restante</span>
            <strong class="off-status-amount" style="color:${summary.totalKcal > summary.goal ? '#ef4444' : '#22c55e'}">${summary.remaining}</strong>
            <span class="off-status-unit">kcal</span>
          </div>
        </div>
        <div class="off-status-bar">
          <div class="off-status-progress" style="width:${summary.percentUsed}%"></div>
          <span class="off-status-percent">${summary.percentUsed}%</span>
        </div>
      </div>

      <div class="off-meals-grid">
        ${mealSections}
      </div>

      <div class="off-diary-head">
        <div>
          <p class="page-subtitle">Meta dividida: Café 20% | 1º Lanche 10% | Almoço 40% | 2º Lanche 10% | Jantar 20%</p>
        </div>
      </div>
    </section>
  `;
}

function renderPagination() {
  const totalPages = Math.max(1, Math.ceil((_state.count || 0) / PAGE_SIZE));
  if (!_state.didSearch || totalPages <= 1) return '';

  return `
    <div class="off-pagination">
      <button class="btn btn-secondary" id="off-prev-page" ${_state.page <= 1 ? 'disabled' : ''}>
        <i data-lucide="chevron-left"></i> Anterior
      </button>
      <span class="off-page-indicator">Página ${_state.page} de ${totalPages}</span>
      <button class="btn btn-secondary" id="off-next-page" ${_state.page >= totalPages ? 'disabled' : ''}>
        Próxima <i data-lucide="chevron-right"></i>
      </button>
    </div>
  `;
}

function renderResults() {
  if (_state.loading) {
    return `
      <div class="off-state-box">
        <i data-lucide="loader" class="spin"></i>
        <p>Buscando alimentos nas fontes de dados...</p>
      </div>
    `;
  }

  if (_state.error) {
    return `
      <div class="off-state-box off-state-error">
        <i data-lucide="alert-triangle"></i>
        <p>${escapeHtml(_state.error)}</p>
      </div>
    `;
  }

  if (_state.didSearch && !_state.products.length) {
    return `
      <div class="off-state-box">
        <i data-lucide="search-x"></i>
        <p>Nenhum item encontrado para "${escapeHtml(_state.query)}".</p>
      </div>
    `;
  }

  if (!_state.didSearch) {
    return `
      <div class="off-state-box">
        <i data-lucide="search"></i>
        <p>Pesquise por nome do alimento, marca ou código de barras.</p>
      </div>
    `;
  }

  return `
    <div class="off-results-header">
      <p>${_state.count} resultado(s) para <strong>${escapeHtml(_state.query)}</strong></p>
    </div>
    <div class="off-grid">
      ${_state.products.map(renderProductCard).join('')}
    </div>
    ${renderPagination()}
  `;
}

function categorizeFoods(foods) {
  const categories = {
    'Proteínas': [],
    'Carboidratos': [],
    'Frutas': [],
    'Vegetais': [],
    'Laticínios': [],
    'Bebidas': [],
  };

  foods.forEach((food) => {
    const keywords = `${food.name} ${food.aliases?.join(' ') || ''}`.toLowerCase();
    if (keywords.match(/frango|carne|peixe|atum|ovos?|presunto|linguica|australia|salsicha|peito|ovo/)) {
      categories['Proteínas'].push(food);
    } else if (keywords.match(/arroz|feijao|batata|macarrao|pao|cuscuz|tapioca|massa|mandioca|aipim|macaxeira/)) {
      categories['Carboidratos'].push(food);
    } else if (keywords.match(/banana|maca|laranja|alcool|suco|fruta|morango|melao/)) {
      categories['Frutas'].push(food);
    } else if (keywords.match(/salada|brocolis|cenoura|espinafre|tomate|alface/)) {
      categories['Vegetais'].push(food);
    } else if (keywords.match(/leite|queijo|iogurte|requeijao/)) {
      categories['Laticínios'].push(food);
    } else if (keywords.match(/cafe|agua|suco|bebida|leite/)) {
      categories['Bebidas'].push(food);
    }
  });

  return categories;
}

function getCustomFoods() {
  const data = store.get('alimentos');
  return Array.isArray(data?.customFoods) ? data.customFoods : [];
}

function addCustomFood(food) {
  store.update('alimentos', (data) => {
    const payload = data || { entries: [] };
    if (!Array.isArray(payload.customFoods)) payload.customFoods = [];
    payload.customFoods.push({
      id: Date.now(),
      ...food,
    });
    return payload;
  });
}

function buildFoodKey(food, isCustom = false) {
  if (isCustom) return `custom:${food.id}`;
  return `local:${normalizeText(food.name)}`;
}

function resolveFoodFromKey(foodKey) {
  if (!foodKey) return null;

  if (foodKey.startsWith('custom:')) {
    const id = Number(foodKey.slice('custom:'.length));
    if (!Number.isFinite(id)) return null;
    const customFood = getCustomFoods().find((f) => f.id === id);
    return customFood ? { ...customFood, _isCustom: true, _foodKey: foodKey } : null;
  }

  if (foodKey.startsWith('local:')) {
    const normalizedName = foodKey.slice('local:'.length);
    const localFood = LOCAL_FOODS_BR.find((f) => normalizeText(f.name) === normalizedName);
    return localFood ? { ...localFood, _isCustom: false, _foodKey: foodKey } : null;
  }

  return null;
}

function updateFoodPhoto(foodKey, newPhoto, isCustom) {
  if (isCustom) {
    const id = Number(String(foodKey || '').slice('custom:'.length));
    if (!Number.isFinite(id)) return;

    store.update('alimentos', (data) => {
      const payload = data || { entries: [] };
      if (!Array.isArray(payload.customFoods)) payload.customFoods = [];
      const food = payload.customFoods.find((f) => f.id === id);
      if (food) {
        food.photo = newPhoto || undefined;
      }
      return payload;
    });
  }
  // Para TACO, salvar em lista separada
  else {
    store.update('alimentos', (data) => {
      const payload = data || { entries: [] };
      if (!Array.isArray(payload.tacoPhotos)) payload.tacoPhotos = [];
      const photoEntry = payload.tacoPhotos.find((p) => p.foodKey === foodKey);
      if (photoEntry) {
        photoEntry.photo = newPhoto || undefined;
      } else {
        payload.tacoPhotos.push({ foodKey, photo: newPhoto });
      }
      return payload;
    });
  }
}

function getTacoPhotoOverride(foodKey) {
  const data = store.get('alimentos');
  const photos = Array.isArray(data?.tacoPhotos) ? data.tacoPhotos : [];
  const photoEntry = photos.find((p) => p.foodKey === foodKey);
  return photoEntry?.photo || null;
}

function updateCustomFood(foodId, updates) {
  store.update('alimentos', (data) => {
    const payload = data || { entries: [] };
    if (!Array.isArray(payload.customFoods)) payload.customFoods = [];
    const food = payload.customFoods.find((f) => f.id === foodId);
    if (food) {
      Object.assign(food, updates);
    }
    return payload;
  });
}

function deleteCustomFood(foodId) {
  store.update('alimentos', (data) => {
    const payload = data || { entries: [] };
    if (!Array.isArray(payload.customFoods)) payload.customFoods = [];
    payload.customFoods = payload.customFoods.filter((f) => f.id !== foodId);
    return payload;
  });
}

function renderFoodCategories() {
  const localFoods = LOCAL_FOODS_BR.map((food) => ({
    ...food,
    _isCustom: false,
    _foodKey: buildFoodKey(food, false),
  }));
  const customFoods = getCustomFoods().map((food) => ({
    ...food,
    _isCustom: true,
    _foodKey: buildFoodKey(food, true),
  }));

  const allFoods = [...localFoods, ...customFoods];
  const categories = categorizeFoods(allFoods);

  const categoryHtml = Object.entries(categories)
    .filter(([_, foods]) => foods.length > 0)
    .map(([category, foods]) => `
      <div class="off-category-section">
        <h4 class="off-category-title">${category} (${foods.length})</h4>
        <div class="off-category-items">
          ${foods.map((food) => {
            const tacoPhoto = getTacoPhotoOverride(food._foodKey);
            const hasPhoto = food.photo && food.photo.startsWith('data:image');
            const hasTacoPhoto = tacoPhoto && tacoPhoto.startsWith('data:image');
            const displayPhoto = hasPhoto || hasTacoPhoto;
            return `
            <div class="off-food-item off-food-clickable" data-food-key="${food._foodKey}" title="${food.name}">
              <div class="off-food-photo-wrap">
                ${displayPhoto ? `<img src="${tacoPhoto || food.photo}" class="off-food-photo" alt="${food.name}" />` : `<span class="off-food-emoji">${food.emoji || '🍽️'}</span>`}
                ${displayPhoto ? `<button type="button" class="off-edit-photo-btn" data-food-key="${food._foodKey}" data-is-custom="${food._isCustom ? 1 : 0}" title="Editar foto"><i data-lucide="edit-2"></i></button>` : ''}
              </div>
              <span class="off-food-name">${escapeHtml(food.name)}</span>
            </div>
          `;
          }).join('')}
        </div>
      </div>
    `)
    .join('');

  return `
    <section class="content-section">
      <h3 class="form-title">📚 Categorias de Alimentos</h3>
      ${categoryHtml}
    </section>
    <!-- Modal de detalhes do alimento -->
    <div id="off-food-details-modal" class="modal-overlay" style="display:none">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title" id="off-details-title">Alimento</h3>
          <button type="button" class="close-btn" id="off-details-close" aria-label="Fechar">×</button>
        </div>
        <div class="modal-body">
          <div class="off-food-details-content">
            <div class="off-food-details-photo">
              <img id="off-details-photo" src="" alt="foto" style="width: 100%; height: auto; border-radius: 8px; object-fit: cover; max-height: 200px;" />
              <button type="button" class="btn btn-secondary" id="off-details-edit-photo" style="margin-top: 8px; width: 100%;"><i data-lucide="camera"></i> Editar Foto</button>
            </div>
            <div class="off-food-details-info">
              <div class="off-detail-row">
                <span class="off-detail-label">kcal/100g:</span>
                <span class="off-detail-value" id="off-detail-kcal">0</span>
              </div>
              <div class="off-detail-row">
                <span class="off-detail-label">Proteína:</span>
                <span class="off-detail-value" id="off-detail-protein">0g</span>
              </div>
              <div class="off-detail-row">
                <span class="off-detail-label">Carbs:</span>
                <span class="off-detail-value" id="off-detail-carbs">0g</span>
              </div>
              <div class="off-detail-row">
                <span class="off-detail-label">Gordura:</span>
                <span class="off-detail-value" id="off-detail-fat">0g</span>
              </div>
              <div class="off-detail-row">
                <span class="off-detail-label">Fonte:</span>
                <span class="off-detail-value" id="off-detail-source">-</span>
              </div>
            </div>
          </div>
          <!-- Subseção de edição para customizados -->
          <div id="off-details-edit-section" style="display:none; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-color);">
            <h4 style="margin: 0 0 12px 0; font-size: 0.95rem;">Editar Alimento</h4>
            <input type="text" id="off-edit-food-name" class="form-input" placeholder="Nome" />
            <input type="number" id="off-edit-food-kcal" class="form-input" placeholder="kcal/100g" min="0" step="0.1" />
            <input type="number" id="off-edit-food-protein" class="form-input" placeholder="Proteína (g)" min="0" step="0.1" />
            <input type="number" id="off-edit-food-carbs" class="form-input" placeholder="Carbs (g)" min="0" step="0.1" />
            <input type="number" id="off-edit-food-fat" class="form-input" placeholder="Gordura (g)" min="0" step="0.1" />
          </div>
          <!-- Submodal de foto -->
          <div id="off-details-photo-edit" style="display:none; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-color);">
            <label for="off-details-photo-input" style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 8px;">Selecione Nova Foto</label>
            <input type="file" id="off-details-photo-input" class="form-input" accept="image/*" />
            <div id="off-details-photo-preview" class="off-photo-preview" style="display:none; margin-top: 12px;">
              <img id="off-details-preview-img" src="" alt="preview" />
              <button type="button" id="off-details-clear-photo" class="btn btn-secondary">Limpar</button>
            </div>
            <button type="button" id="off-details-save-photo" class="btn btn-primary" style="margin-top: 12px; width: 100%;">Salvar Foto</button>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-danger" id="off-details-delete" style="display:none; margin-right: auto;"><i data-lucide="trash"></i></button>
          <button type="button" class="btn btn-secondary" id="off-details-cancel">Fechar</button>
          <button type="button" class="btn btn-primary" id="off-details-save" style="display:none;">Salvar</button>
        </div>
      </div>
    </div>
    <!-- Modal de edição de foto -->
    <div id="off-edit-photo-modal" class="modal-overlay" style="display:none">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">Editar Foto do Alimento</h3>
          <button type="button" class="close-btn" id="off-edit-photo-close" aria-label="Fechar">×</button>
        </div>
        <div class="modal-body">
          <div class="off-form-group">
            <label for="off-edit-food-photo">Selecione a nova foto</label>
            <input
              type="file"
              id="off-edit-food-photo"
              class="form-input"
              accept="image/*"
            />
            <div id="off-edit-photo-preview" class="off-photo-preview" style="display:none">
              <img id="off-edit-preview-img" src="" alt="preview" />
              <button type="button" id="off-edit-clear-photo" class="btn btn-secondary">Limpar</button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="off-edit-photo-cancel">Cancelar</button>
          <button type="button" class="btn btn-primary" id="off-edit-photo-save">Salvar</button>
        </div>
      </div>
    </div>
  `;
}

function renderAddFoodForm() {
  return `
    <section class="content-section">
      <h3 class="form-title">➕ Adicionar Novo Alimento</h3>
      <form id="off-add-food-form" class="off-add-food-form">
        <div class="off-form-group">
          <label for="off-new-food-photo">Foto (opcional)</label>
          <input
            type="file"
            id="off-new-food-photo"
            class="form-input"
            accept="image/*"
          />
          <div id="off-photo-preview" class="off-photo-preview" style="display:none">
            <img id="off-preview-img" src="" alt="preview" />
            <button type="button" id="off-clear-photo" class="btn btn-secondary">Limpar</button>
          </div>
        </div>
        <input
          type="text"
          id="off-new-food-emoji"
          class="form-input"
          placeholder="Emoji (ex: 🍕) - fallback se sem foto"
          maxlength="2"
        />
        <input
          type="text"
          id="off-new-food-name"
          class="form-input"
          placeholder="Nome do alimento"
          required
        />
        <input
          type="number"
          id="off-new-food-kcal"
          class="form-input"
          placeholder="kcal por 100g"
          min="0"
          step="0.1"
          required
        />
        <input
          type="number"
          id="off-new-food-protein"
          class="form-input"
          placeholder="Proteína (g)"
          min="0"
          step="0.1"
        />
        <button class="btn btn-primary" type="submit">
          <i data-lucide="plus"></i> Adicionar Alimento
        </button>
      </form>
    </section>
  `;
}

export function render() {
  return `
    <div class="page-alimentos">
      <div class="page-header">
        <div>
          <h2 class="page-title">Alimentação</h2>
        </div>
      </div>

      ${renderDiary()}

      <section class="content-section off-search-panel">
        <form id="off-search-form" class="off-search-form">
          <div class="off-search-input-wrap">
            <i data-lucide="search"></i>
            <input
              id="off-query"
              class="form-input"
              type="search"
              placeholder="Ex: pão integral, iogurte natural, 7891000100103"
              value="${escapeHtml(_state.query)}"
              minlength="2"
            />
          </div>
          <button class="btn btn-primary" type="submit" id="off-submit">
            <i data-lucide="search"></i> Buscar
          </button>
        </form>

        <p class="off-tip">
          Dica: no campo automático, escreva frases como "comi pão, ovo e suco de laranja".
        </p>
      </section>

      <section class="content-section">
        ${renderResults()}
      </section>

      ${renderFoodCategories()}
      ${renderAddFoodForm()}
    </div>
  `;
}

export function init(container) {
  async function executeSearch({ keepPage = false } = {}) {
    const queryInput = container.querySelector('#off-query');
    const query = String(queryInput?.value || '').trim();
    const provider = 'local';

    // Atualizar meta se houver input
    const goalInput = container.querySelector('#off-goal-input');
    if (goalInput && goalInput.value) {
      const newGoal = Number(goalInput.value);
      if (newGoal > 0) setDailyGoal(newGoal);
    }

    if (query.length < 2) {
      _state = {
        ..._state,
        query,
        provider,
        didSearch: false,
        products: [],
        count: 0,
        error: '',
      };
      rerender();
      return;
    }

    _state = {
      ..._state,
      query,
      provider,
      page: keepPage ? _state.page : 1,
      loading: true,
      error: '',
      didSearch: true,
    };
    rerender();

    try {
      const result = await searchFoodProductsWithFallback(query, {
        page: _state.page,
        pageSize: PAGE_SIZE,
        provider,
      });

      _state = {
        ..._state,
        products: result.products,
        count: result.count,
        loading: false,
        error: '',
      };
    } catch {
      _state = {
        ..._state,
        loading: false,
        error: 'Não foi possível consultar as fontes de calorias agora. Tente trocar a fonte para USDA ou Open Food Facts.',
      };
    }

    rerender();
  }

  function goToPage(nextPage) {
    const totalPages = Math.max(1, Math.ceil((_state.count || 0) / PAGE_SIZE));
    _state.page = Math.min(totalPages, Math.max(1, nextPage));
    executeSearch({ keepPage: true });
  }

  async function addMealBySentence(rawText, meal = 'breakfast') {
    const entries = parseMealText(rawText);
    if (!entries.length) {
      _state.autoFeedback = 'Não consegui identificar itens na frase. Tente separar por vírgula.';
      rerender();
      return;
    }

    _state.autoLoading = true;
    _state.autoFeedback = '';
    rerender();

    let added = 0;
    const failed = [];

    for (const entry of entries) {
      try {
        const resolved = await resolveCaloriesForItem(entry.item, 'local');
        if (!resolved || !Number.isFinite(resolved.kcal100g)) {
          failed.push(entry.item);
          continue;
        }

        const grams = Math.max(1, estimatePortionGrams(entry.item) * entry.quantity);
        const kcal = calcKcalByGrams(resolved.kcal100g, grams);
        if (!Number.isFinite(kcal)) {
          failed.push(entry.item);
          continue;
        }

        addFoodEntry({
          name: resolved.name,
          brand: resolved.brand,
          source: `${resolved.source || 'API'} (auto)`,
          code: resolved.code,
          grams: Math.round(grams),
          kcal100g: roundKcal(resolved.kcal100g),
          kcal,
          meal,
        });
        added += 1;
      } catch {
        failed.push(entry.item);
      }
    }

    _state.autoLoading = false;
    if (added && !failed.length) {
      _state.autoFeedback = `${added} item(ns) adicionados automaticamente.`;
    } else if (added && failed.length) {
      _state.autoFeedback = `${added} item(ns) adicionados. Não encontrei calorias para: ${failed.join(', ')}.`;
    } else {
      _state.autoFeedback = 'Não consegui estimar calorias automaticamente para os itens informados.';
    }

    rerender();
  }

  async function addMealWithCustomGrams(rawText, customGrams, meal = 'breakfast') {
    const entries = parseMealText(rawText);
    if (!entries.length) {
      _state.autoFeedback = 'Não consegui identificar o item. Tente novamente.';
      rerender();
      return;
    }

    _state.autoLoading = true;
    _state.autoFeedback = '';
    rerender();

    let added = 0;
    const failed = [];
    const numGrams = Math.max(50, Number(customGrams) || 100);

    for (const entry of entries) {
      try {
        const resolved = await resolveCaloriesForItem(entry.item, 'local');
        if (!resolved || !Number.isFinite(resolved.kcal100g)) {
          failed.push(entry.item);
          continue;
        }

        const grams = numGrams;
        const kcal = calcKcalByGrams(resolved.kcal100g, grams);
        if (!Number.isFinite(kcal)) {
          failed.push(entry.item);
          continue;
        }

        addFoodEntry({
          name: resolved.name,
          brand: resolved.brand,
          source: `${resolved.source || 'API'}`,
          code: resolved.code,
          grams: Math.round(grams),
          kcal100g: roundKcal(resolved.kcal100g),
          kcal,
          meal,
        });
        added += 1;
      } catch {
        failed.push(entry.item);
      }
    }

    _state.autoLoading = false;
    if (added && !failed.length) {
      _state.autoFeedback = `${added} item(ns) adicionado(s) (${numGrams}g).`;
    } else if (added && failed.length) {
      _state.autoFeedback = `${added} item(ns) adicionado(s). Não encontrei calorias para: ${failed.join(', ')}.`;
    } else {
      _state.autoFeedback = 'Não consegui estimar calorias para o item informado.';
    }

    rerender();
  }

  function bindEvents() {
    let currentPhotoBase64 = '';

    // Preview da foto
    container.querySelector('#off-new-food-photo')?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        currentPhotoBase64 = '';
        container.querySelector('#off-photo-preview').style.display = 'none';
        return;
      }

      try {
        currentPhotoBase64 = await fileToBase64(file);
        const preview = container.querySelector('#off-preview-img');
        preview.src = currentPhotoBase64;
        container.querySelector('#off-photo-preview').style.display = 'flex';
      } catch (err) {
        alert('Erro ao carregar imagem: ' + err.message);
      }
    });

    // Limpar foto
    container.querySelector('#off-clear-photo')?.addEventListener('click', () => {
      currentPhotoBase64 = '';
      container.querySelector('#off-new-food-photo').value = '';
      container.querySelector('#off-photo-preview').style.display = 'none';
    });

    container.querySelector('#off-search-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      executeSearch();
    });

    container.querySelector('#off-prev-page')?.addEventListener('click', () => {
      goToPage(_state.page - 1);
    });

    container.querySelector('#off-next-page')?.addEventListener('click', () => {
      goToPage(_state.page + 1);
    });

    container.querySelectorAll('.off-meal-add-form').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (_state.autoLoading) return;
        const input = form.querySelector('.off-meal-input');
        const gramsInput = form.querySelector('.off-meal-grams');
        const text = String(input?.value || '').trim();
        const grams = Math.max(50, Number(gramsInput?.value || 100));
        if (!text) return;
        const meal = form.getAttribute('data-meal') || 'breakfast';
        await addMealWithCustomGrams(text, grams, meal);
        input.value = '';
        gramsInput.value = '100';
      });
    });

    container.querySelector('#off-goal-btn')?.addEventListener('click', () => {
      const goalInput = container.querySelector('#off-goal-input');
      const newGoal = Math.max(500, Number(goalInput?.value || 2000));
      setDailyGoal(newGoal);
      rerender();
    });

    container.querySelector('#off-clear-btn')?.addEventListener('click', () => {
      if (confirm('Tem certeza que deseja limpar todos os itens desta data?')) {
        clearDailyEntries();
        rerender();
      }
    });

    container.querySelector('#off-date-prev')?.addEventListener('click', () => {
      _selectedDate = shiftDate(_selectedDate, -1);
      rerender();
    });

    container.querySelector('#off-date-next')?.addEventListener('click', () => {
      const nextDate = shiftDate(_selectedDate, 1);
      if (nextDate > today()) return;
      _selectedDate = nextDate;
      rerender();
    });

    container.querySelector('#off-date-today')?.addEventListener('click', () => {
      _selectedDate = today();
      rerender();
    });

    container.querySelector('#off-add-food-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const emoji = String(container.querySelector('#off-new-food-emoji')?.value || '🍽️').trim();
      const name = String(container.querySelector('#off-new-food-name')?.value || '').trim();
      const kcal100g = Math.max(0, Number(container.querySelector('#off-new-food-kcal')?.value || 0));
      const protein100g = Math.max(0, Number(container.querySelector('#off-new-food-protein')?.value || 0));

      if (!name || !Number.isFinite(kcal100g)) {
        alert('Preencha nome e kcal por 100g');
        return;
      }

      addCustomFood({
        emoji,
        photo: currentPhotoBase64 || undefined,
        name,
        kcal100g,
        protein100g,
        carbs100g: 0,
        fat100g: 0,
        source: 'Customizado',
        aliases: [],
      });

      alert(`"${name}" adicionado aos alimentos customizados!`);
      container.querySelector('#off-new-food-emoji').value = '🍽️';
      container.querySelector('#off-new-food-name').value = '';
      container.querySelector('#off-new-food-kcal').value = '';
      container.querySelector('#off-new-food-protein').value = '';
      container.querySelector('#off-new-food-photo').value = '';
      container.querySelector('#off-photo-preview').style.display = 'none';
      currentPhotoBase64 = '';
      rerender();
    });

    container.querySelectorAll('[data-action="add-food"]').forEach((button) => {
      button.addEventListener('click', () => {
        const kcal100g = toNumber(button.getAttribute('data-kcal100g'));
        if (!Number.isFinite(kcal100g)) return;

        const code = button.getAttribute('data-code') || '';
        const mealSelect = Array.from(container.querySelectorAll('.off-meal-select'))
          .find((select) => select.getAttribute('data-code') === code);
        const gramsInput = Array.from(container.querySelectorAll('.off-grams-input'))
          .find((input) => input.getAttribute('data-code') === code);
        const grams = Math.max(1, Number(gramsInput?.value || 100));
        const meal = String(mealSelect?.value || 'breakfast');
        const kcal = calcKcalByGrams(kcal100g, grams);
        if (!Number.isFinite(kcal)) return;

        addFoodEntry({
          name: button.getAttribute('data-name') || 'Alimento',
          brand: button.getAttribute('data-brand') || '',
          source: button.getAttribute('data-source') || '',
          code,
          grams: Math.round(grams),
          kcal100g: roundKcal(kcal100g),
          kcal,
          meal,
        });

        rerender();
      });
    });

    container.querySelectorAll('[data-action="remove-entry"]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = Number(button.getAttribute('data-id'));
        if (!Number.isFinite(id)) return;
        removeFoodEntry(id);
        rerender();
      });
    });

    // Modal de edição de foto
    let editingFoodKey = '';
    let editingIsCustom = false;
    let editPhotoBase64 = '';

    // Abrir modal
    container.querySelectorAll('.off-edit-photo-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        editingFoodKey = String(btn.getAttribute('data-food-key') || '');
        editingIsCustom = Number(btn.getAttribute('data-is-custom') || 0) === 1;
        editPhotoBase64 = '';
        container.querySelector('#off-edit-food-photo').value = '';
        container.querySelector('#off-edit-photo-preview').style.display = 'none';
        container.querySelector('#off-edit-photo-modal').style.display = 'flex';
      });
    });

    // Preview da foto no modal
    container.querySelector('#off-edit-food-photo')?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        editPhotoBase64 = '';
        container.querySelector('#off-edit-photo-preview').style.display = 'none';
        return;
      }

      try {
        editPhotoBase64 = await fileToBase64(file);
        const preview = container.querySelector('#off-edit-preview-img');
        preview.src = editPhotoBase64;
        container.querySelector('#off-edit-photo-preview').style.display = 'flex';
      } catch (err) {
        alert('Erro ao carregar imagem: ' + err.message);
      }
    });

    // Limpar foto no modal
    container.querySelector('#off-edit-clear-photo')?.addEventListener('click', () => {
      editPhotoBase64 = '';
      container.querySelector('#off-edit-food-photo').value = '';
      container.querySelector('#off-edit-photo-preview').style.display = 'none';
    });

    // Salvar nova foto
    container.querySelector('#off-edit-photo-save')?.addEventListener('click', () => {
      if (!editingFoodKey) return;
      if (!editPhotoBase64) {
        alert('Selecione uma imagem');
        return;
      }
      updateFoodPhoto(editingFoodKey, editPhotoBase64, editingIsCustom);
      container.querySelector('#off-edit-photo-modal').style.display = 'none';
      editingFoodKey = '';
      editingIsCustom = false;
      editPhotoBase64 = '';
      rerender();
    });

    // Fechar modal
    const closeModal = () => {
      container.querySelector('#off-edit-photo-modal').style.display = 'none';
      editingFoodKey = '';
      editingIsCustom = false;
      editPhotoBase64 = '';
    };
    container.querySelector('#off-edit-photo-close')?.addEventListener('click', closeModal);
    container.querySelector('#off-edit-photo-cancel')?.addEventListener('click', closeModal);
    container.querySelector('#off-edit-photo-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'off-edit-photo-modal') closeModal();
    });

      // ===== MODAL DE DETALHES DO ALIMENTO =====
      let currentViewingFoodKey = '';
      let isViewingCustomFood = false;
      let detailsPhotoBase64 = '';

      function openFoodDetails(foodKey) {
        currentViewingFoodKey = foodKey;
        const food = resolveFoodFromKey(foodKey);
        if (!food) return;

        isViewingCustomFood = Boolean(food._isCustom);

        // Preencher dados
        container.querySelector('#off-details-title').textContent = food.name;
        container.querySelector('#off-detail-kcal').textContent = Math.round(food.kcal100g || 0);
        container.querySelector('#off-detail-protein').textContent = (food.protein100g || 0).toFixed(1) + 'g';
        container.querySelector('#off-detail-carbs').textContent = (food.carbs100g || 0).toFixed(1) + 'g';
        container.querySelector('#off-detail-fat').textContent = (food.fat100g || 0).toFixed(1) + 'g';
        container.querySelector('#off-detail-source').textContent = food.source || '-';

        // Foto
        const tacoPhoto = getTacoPhotoOverride(foodKey);
        const photoSrc = tacoPhoto || food.photo;
        const photoImg = container.querySelector('#off-details-photo');
        if (photoSrc && photoSrc.startsWith('data:image')) {
          photoImg.src = photoSrc;
        } else {
          photoImg.src = '';
        }

        // Mostrar/esconder seção de edição
        const editSection = container.querySelector('#off-details-edit-section');
        const deleteBtn = container.querySelector('#off-details-delete');
        const saveBtn = container.querySelector('#off-details-save');

        if (isViewingCustomFood) {
          editSection.style.display = 'block';
          deleteBtn.style.display = 'block';
          saveBtn.style.display = 'block';
        
          container.querySelector('#off-edit-food-name').value = food.name;
          container.querySelector('#off-edit-food-kcal').value = food.kcal100g || 0;
          container.querySelector('#off-edit-food-protein').value = food.protein100g || 0;
          container.querySelector('#off-edit-food-carbs').value = food.carbs100g || 0;
          container.querySelector('#off-edit-food-fat').value = food.fat100g || 0;
        } else {
          editSection.style.display = 'none';
          deleteBtn.style.display = 'none';
          saveBtn.style.display = 'none';
        }

        detailsPhotoBase64 = '';
        container.querySelector('#off-details-photo-edit').style.display = 'none';
        container.querySelector('#off-details-photo-input').value = '';
        container.querySelector('#off-details-photo-preview').style.display = 'none';

        container.querySelector('#off-food-details-modal').style.display = 'flex';
      }

      // Clicar em alimento para abrir detalhes
      container.querySelectorAll('.off-food-clickable').forEach((item) => {
        item.addEventListener('click', (e) => {
          const foodKey = String(item.getAttribute('data-food-key') || '');
          if (foodKey) {
            openFoodDetails(foodKey);
          }
        });
      });

      // Editar foto no modal de detalhes
      container.querySelector('#off-details-edit-photo')?.addEventListener('click', () => {
        container.querySelector('#off-details-photo-edit').style.display = 'block';
      });

      // Upload de foto no modal de detalhes
      container.querySelector('#off-details-photo-input')?.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
          detailsPhotoBase64 = '';
          container.querySelector('#off-details-photo-preview').style.display = 'none';
          return;
        }

        try {
          detailsPhotoBase64 = await fileToBase64(file);
          const preview = container.querySelector('#off-details-preview-img');
          preview.src = detailsPhotoBase64;
          container.querySelector('#off-details-photo-preview').style.display = 'flex';
        } catch (err) {
          alert('Erro ao carregar imagem: ' + err.message);
        }
      });

      // Limpar foto no modal de detalhes
      container.querySelector('#off-details-clear-photo')?.addEventListener('click', () => {
        detailsPhotoBase64 = '';
        container.querySelector('#off-details-photo-input').value = '';
        container.querySelector('#off-details-photo-preview').style.display = 'none';
      });

      // Salvar foto (todos os alimentos)
      container.querySelector('#off-details-save-photo')?.addEventListener('click', () => {
        if (!currentViewingFoodKey) return;
        if (!detailsPhotoBase64) {
          alert('Selecione uma imagem');
          return;
        }

        updateFoodPhoto(currentViewingFoodKey, detailsPhotoBase64, isViewingCustomFood);
        container.querySelector('#off-food-details-modal').style.display = 'none';
        rerender();
      });

      // Salvar edições de customizado
      container.querySelector('#off-details-save')?.addEventListener('click', () => {
        if (!currentViewingFoodKey || !isViewingCustomFood) return;

        const customId = Number(currentViewingFoodKey.slice('custom:'.length));
        if (!Number.isFinite(customId)) return;

        const name = String(container.querySelector('#off-edit-food-name')?.value || '').trim();
        const kcal100g = Math.max(0, toNumber(container.querySelector('#off-edit-food-kcal')?.value) || 0);
        const protein100g = Math.max(0, toNumber(container.querySelector('#off-edit-food-protein')?.value) || 0);
        const carbs100g = Math.max(0, toNumber(container.querySelector('#off-edit-food-carbs')?.value) || 0);
        const fat100g = Math.max(0, toNumber(container.querySelector('#off-edit-food-fat')?.value) || 0);

        if (!name) {
          alert('Nome não pode ser vazio');
          return;
        }

        updateCustomFood(customId, {
          name,
          kcal100g,
          protein100g,
          carbs100g,
          fat100g,
        });

        if (detailsPhotoBase64) {
          updateFoodPhoto(currentViewingFoodKey, detailsPhotoBase64, true);
        }

        container.querySelector('#off-food-details-modal').style.display = 'none';
        rerender();
      });

      // Deletar alimento customizado
      container.querySelector('#off-details-delete')?.addEventListener('click', () => {
        if (!currentViewingFoodKey || !isViewingCustomFood) return;
        const customId = Number(currentViewingFoodKey.slice('custom:'.length));
        if (!Number.isFinite(customId)) return;
        const foodName = container.querySelector('#off-details-title').textContent;
        if (confirm(`Tem certeza que deseja deletar "${foodName}"?`)) {
          deleteCustomFood(customId);
          container.querySelector('#off-food-details-modal').style.display = 'none';
          rerender();
        }
      });

      // Fechar modal de detalhes
      const closeDetailsModal = () => {
        container.querySelector('#off-food-details-modal').style.display = 'none';
        currentViewingFoodKey = '';
        isViewingCustomFood = false;
        detailsPhotoBase64 = '';
      };
      container.querySelector('#off-details-close')?.addEventListener('click', closeDetailsModal);
      container.querySelector('#off-details-cancel')?.addEventListener('click', closeDetailsModal);
      container.querySelector('#off-food-details-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'off-food-details-modal') closeDetailsModal();
      });
  }

  function rerender() {
    container.innerHTML = render();
    refreshIcons();
    bindEvents();
  }

  bindEvents();
}