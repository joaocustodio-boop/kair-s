import { store, today } from '../store.js';
import { devotionals } from '../data/devotionals.js';
import { fetchDailyVerse, fetchVerse, getCachedDailyVerse } from '../bibleApi.js';
import { refreshIcons } from '../icons.js';
const DEVO_API_REFS = {
  0: { api: 'lamentations 3:22-23', display: 'Lamentações 3:22-23', song: { title: 'Me Ama', artist: 'Diante do Trono', id: 'lSwiHA8gymg' } },
  1: { api: 'colossians 3:23',      display: 'Colossenses 3:23',   song: { title: 'Ressuscita-me', artist: 'Aline Barros', id: 'dc6oADkbQSw' } },
  2: { api: 'philippians 4:6-7',    display: 'Filipenses 4:6-7',    song: { title: 'Lugar Secreto', artist: 'Gabriela Rocha', id: 'YnrN0o0lubM' } },
  3: { api: 'isaiah 40:31',         display: 'Isaías 40:31',        song: { title: 'Grandes Coisas', artist: 'Fernandinho', id: '5WxNEs9fxG0' } },
  4: { api: 'matthew 7:7-8',        display: 'Mateus 7:7-8',        song: { title: 'Raridade', artist: 'Anderson Freire', id: 'Tqdi6BZUWr4' } },
  5: { api: 'philippians 4:4-5',    display: 'Filipenses 4:4-5',    song: { title: 'Advogado Fiel', artist: 'Bruna Karla', id: '_JAiq1uf0uk' } },
  6: { api: 'psalms 4:8',           display: 'Salmos 4:8',          song: { title: 'Ninguém Explica Deus', artist: 'Preto no Branco', id: 'LYsaKn8FRhc' } },
};

const WEEK_DAYS_FULL  = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const WEEK_DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Retorna a data (YYYY-MM-DD) de um dia da semana para um offset de semanas
// weekOffset: 0 = semana atual, -1 = semana passada, etc.
function weekDates(weekOffset = 0) {
  const now = new Date();
  const dow = now.getDay(); // 0=Dom
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - dow + i + weekOffset * 7);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function dateLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function weekLabel(dates) {
  const first = new Date(dates[0] + 'T12:00:00');
  const last  = new Date(dates[6] + 'T12:00:00');
  const opts  = { day: 'numeric', month: 'short' };
  return `${first.toLocaleDateString('pt-BR', opts)} – ${last.toLocaleDateString('pt-BR', opts)}`;
}

// ─── Week Grid View ──────────────────────────────────────────────────────────
// ─── Week Grid View ──────────────────────────────────────────────────────────
function renderWeekView(state, data, verse) {
  const todayDate   = today();
  const dates       = weekDates(state.weekOffset);
  const isThisWeek  = state.weekOffset === 0;

  // Streak
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    if (data.completedDays.includes(ds)) streak++;
    else if (i > 0) break;
  }

  const weekDone = dates.filter(d => data.completedDays.includes(d)).length;

  return `
    <div class="page-devocional">
      <!-- Versículo do Dia -->
      ${verse ? `
        <div class="devo-daily-verse-card" id="main-daily-verse">
          <div class="devo-verse-label" style="margin-bottom:12px">
            <i data-lucide="sparkles"></i>
            Versículo do Dia
          </div>
          <blockquote class="devo-verse-text" style="font-size:1.125rem;line-height:1.6;margin-bottom:8px">
            "${escapeHtml(verse.text)}"
          </blockquote>
          <cite class="devo-verse-ref" style="font-size:0.875rem">— ${escapeHtml(verse.ref)}</cite>
        </div>
      ` : `
        <div class="devo-daily-verse-card placeholder">
          <p style="opacity:0.6;font-size:0.875rem">Buscando inspiração de hoje...</p>
        </div>
      `}

      <!-- Stats -->
      <div class="devo-stats-row">
        <div class="devo-stat-card">
          <div class="devo-stat-icon" style="background:rgba(245,158,11,0.12);color:#f59e0b">
            <i data-lucide="flame"></i>
          </div>
          <div class="devo-stat-value">${streak}</div>
          <div class="devo-stat-label">Dias seguidos</div>
        </div>
        <div class="devo-stat-card">
          <div class="devo-stat-icon" style="background:rgba(88,80,236,0.1);color:var(--accent-primary)">
            <i data-lucide="calendar"></i>
          </div>
          <div class="devo-stat-value">${weekDone}/7</div>
          <div class="devo-stat-label">Esta semana</div>
        </div>
        <div class="devo-stat-card">
          <div class="devo-stat-icon" style="background:rgba(16,185,129,0.1);color:#10b981">
            <i data-lucide="star"></i>
          </div>
          <div class="devo-stat-value">${data.completedDays.length}</div>
          <div class="devo-stat-label">Total concluídos</div>
        </div>
      </div>

      <!-- Navegação semanal -->
      <div class="devo-section card">
        <div class="devo-week-nav">
          <button class="btn-icon" id="week-prev" title="Semana anterior">
            <i data-lucide="chevron-left"></i>
          </button>
          <div class="devo-week-nav-label">
            ${isThisWeek ? '<span class="devo-week-current-badge">Semana atual</span>' : ''}
            <span class="devo-week-range">${weekLabel(dates)}</span>
          </div>
          <button class="btn-icon" id="week-next" ${isThisWeek ? 'disabled style="opacity:.3;cursor:default"' : ''} title="Próxima semana">
            <i data-lucide="chevron-right"></i>
          </button>
        </div>

        ${weekDone === 7 ? '<div class="devo-week-perfect">🏆 Semana perfeita!</div>' : ''}

        <!-- Grade clicável -->
        <div class="devo-week-grid" style="margin-top:20px">
          ${dates.map((date, i) => {
            const done     = data.completedDays.includes(date);
            const isToday  = date === todayDate;
            const isFuture = date > todayDate;
            const dow      = new Date(date + 'T12:00:00').getDay();
            return `
              <button
                class="devo-week-cell ${done ? 'done' : ''} ${isToday ? 'is-today' : ''} ${isFuture ? 'future' : ''}"
                data-action="open-day"
                data-date="${date}"
                ${isFuture ? 'disabled' : ''}
                title="${WEEK_DAYS_FULL[dow]}, ${dateLabel(date)}"
              >
                <span class="devo-week-label">${WEEK_DAYS_SHORT[i]}</span>
                <div class="devo-week-dot">
                  ${done ? '<i data-lucide="check"></i>' : isToday ? '<i data-lucide="circle"></i>' : ''}
                </div>
                <span class="devo-week-day-num">${parseInt(date.split('-')[2])}</span>
              </button>
            `;
          }).join('')}
        </div>

        <!-- Barra de progresso -->
        <div class="devo-progress-wrap" style="margin-top:20px">
          <div class="devo-progress-bar">
            <div class="devo-progress-fill" style="width:${Math.round((weekDone/7)*100)}%;background:var(--accent-primary)"></div>
          </div>
          <span class="devo-progress-label">${weekDone}/7</span>
        </div>
      </div>

    </div>
  `;
}

// ─── Day Devotional View ──────────────────────────────────────────────────────
function renderDayView(state, data, verse) {
  const { selectedDate } = state;
  const todayDate = today();
  const isToday   = selectedDate === todayDate;
  const isPast    = selectedDate < todayDate;
  const done      = data.completedDays.includes(selectedDate);

  const dow        = new Date(selectedDate + 'T12:00:00').getDay();
  const devotional = devotionals[dow];

  const verseText   = verse ? verse.text : devotional.verse;
  const verseRef    = verse ? verse.ref  : devotional.reference;
  const verseSource = verse?.source;

  const fullDate = dateLabel(selectedDate);

  return `
    <div class="page-devocional">

      <!-- Back + header -->
      <div class="devo-day-header">
        <button class="btn btn-secondary" id="back-to-week" style="gap:6px">
          <i data-lucide="arrow-left"></i>
          Voltar
        </button>
        <div class="devo-day-header-info">
          <div class="devo-day-badge">${devotional.day} · ${fullDate}</div>
          ${done ? `
            <div class="devo-done-badge" style="margin-top:8px">
              <i data-lucide="circle-check"></i>
              Concluído
            </div>
          ` : (isPast ? `
            <div class="devo-missed-badge">
              <i data-lucide="circle"></i>
              Não concluído
            </div>
          ` : '')}
        </div>
      </div>

      <h2 class="page-title" style="margin-bottom:24px">${devotional.title}</h2>

      <!-- Versículo -->
      <div class="devo-verse-card">
        <div class="devo-verse-label">
          <i data-lucide="book-open"></i>
          Versículo Principal
        </div>
        <blockquote class="devo-verse-text">"${escapeHtml(verseText)}"</blockquote>
        <cite class="devo-verse-ref">— ${escapeHtml(verseRef)}</cite>
        ${verseSource && verseSource !== 'offline' ? `<div class="devo-api-badge">📖 ${escapeHtml(verseSource)}</div>` : ''}
      </div>

      <!-- Meditação -->
      <div class="devo-section card">
        <div class="devo-section-header">
          <i data-lucide="sparkles"></i>
          <h3>Meditação do Dia</h3>
        </div>
        <div class="devo-reading">
          ${devotional.reading.split('\n\n').map(p => `<p>${p.trim()}</p>`).join('')}
        </div>
      </div>

      <!-- Reflexão -->
      <div class="devo-section card">
        <div class="devo-section-header">
          <i data-lucide="star"></i>
          <h3>Para Reflexão</h3>
        </div>
        <div class="devo-reflection-question">
          <i data-lucide="info"></i>
          <p>${devotional.reflection}</p>
        </div>
      </div>

      <!-- Oração -->
      <div class="devo-section card">
        <div class="devo-section-header">
          <i data-lucide="heart"></i>
          <h3>Oração Guiada</h3>
        </div>
        <div class="devo-prayer-guide">
          <p>${devotional.prayer}</p>
        </div>
      </div>

      <!-- Desafio do Dia -->
      <div class="devo-section devo-challenge-card">
        <div class="devo-section-header">
          <i data-lucide="flame"></i>
          <h3>Desafio do Dia</h3>
        </div>
        <p class="devo-challenge-text">${devotional.challenge}</p>
        ${!done ? `
          <button class="btn btn-primary" id="mark-complete" style="margin-top:16px">
            <i data-lucide="check"></i>
            ${isToday ? 'Marcar como concluído' : 'Marcar dia como concluído'}
          </button>
        ` : `
          <div class="devo-congrats">🙏 ${isToday ? 'Parabéns! Você completou o devocional de hoje.' : 'Este dia foi concluído!'}</div>
        `}
      </div>

    </div>
  `;
}

// ─── Public API ───────────────────────────────────────────────────────────────
let _state = { weekOffset: 0, selectedDate: null };
let _verse  = null; // versículo da API para o dia selecionado

export function render() {
  _state = { weekOffset: 0, selectedDate: null };
  const data   = store.get('devocional');
  const cached = getCachedDailyVerse();
  return renderWeekView(_state, data, cached || _verse);
}

export async function init(container) {
  // Busca versículo do dia em background
  const [dailyVerse] = await Promise.all([fetchDailyVerse()]);
  _verse = dailyVerse;

  // Se estava na semana atual e hoje ainda não tem versículo renderizado, atualiza
  if (!_state.selectedDate) {
    _redraw(container);
  }

  _attachWeekListeners(container);
}

// ─── Internal ─────────────────────────────────────────────────────────────────
function _redraw(container) {
  const data = store.get('devocional');
  if (_state.selectedDate) {
    container.innerHTML = renderDayView(_state, data, _verse);
  } else {
    container.innerHTML = renderWeekView(_state, data, _verse);
  }
  refreshIcons();
  _state.selectedDate ? _attachDayListeners(container) : _attachWeekListeners(container);
}

function _attachWeekListeners(container) {
  container.querySelector('#week-prev')?.addEventListener('click', () => {
    _state.weekOffset -= 1;
    _redraw(container);
  });

  container.querySelector('#week-next')?.addEventListener('click', () => {
    if (_state.weekOffset < 0) { _state.weekOffset += 1; _redraw(container); }
  });

  container.querySelectorAll('[data-action="open-day"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const date = btn.dataset.date;
      _state.selectedDate = date;

      // Busca versículo do devocional daquele dia (via API se possível)
      const dow     = new Date(date + 'T12:00:00').getDay();
      const devoRef = DEVO_API_REFS[dow];

      // Se for hoje, usa o cache diário; caso contrário busca o específico do dia da semana
      if (date === today() && _verse) {
        // versículo diário já está em _verse
      }
      _verse = await fetchVerse(devoRef.api, devoRef.display);
      _redraw(container);
    });
  });
}

function _attachDayListeners(container) {
  container.querySelector('#back-to-week')?.addEventListener('click', () => {
    _state.selectedDate = null;
    _redraw(container);
  });

  container.querySelector('#mark-complete')?.addEventListener('click', () => {
    const date = _state.selectedDate;
    store.update('devocional', d => {
      if (!d.completedDays.includes(date)) d.completedDays.push(date);
      return d;
    });
    _redraw(container);
  });
}

