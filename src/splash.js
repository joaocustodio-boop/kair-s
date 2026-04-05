import { fetchDailyVerse } from './bibleApi.js';
import { refreshIcons } from './icons.js';

const SPLASH_KEY = 'fd-splash-date';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export async function initSplash() {
  const lastShown = localStorage.getItem(SPLASH_KEY);
  if (lastShown === todayStr()) return;

  // Mostra loading enquanto busca
  const verse = await fetchDailyVerse();
  showSplash(verse);
}

function showSplash(verse) {
  const isOffline = verse.source === 'offline';

  const overlay = document.createElement('div');
  overlay.id = 'biblical-splash';
  overlay.innerHTML = `
    <div class="splash-backdrop"></div>
    <div class="splash-modal">
      <div class="splash-cross">✝</div>
      <div class="splash-tag">Palavra do Dia</div>
      <blockquote class="splash-verse">"${verse.text}"</blockquote>
      <cite class="splash-ref">— ${verse.ref}</cite>
      ${!isOffline ? `<div class="splash-source">Tradução: ${verse.source}</div>` : ''}
      <div class="splash-divider"></div>
      <p class="splash-greeting">Que a Palavra de Deus guie o seu dia, João.</p>
      <button class="splash-btn" id="splash-close">Entrar com fé</button>
      <label class="splash-skip">
        <input type="checkbox" id="splash-no-today" />
        Não mostrar novamente hoje
      </label>
    </div>
  `;

  document.body.appendChild(overlay);
  refreshIcons();

  requestAnimationFrame(() => overlay.classList.add('splash-visible'));

  function close() {
    localStorage.setItem(SPLASH_KEY, todayStr());
    overlay.classList.remove('splash-visible');
    overlay.classList.add('splash-hiding');
    setTimeout(() => overlay.remove(), 400);
  }

  document.getElementById('splash-close')?.addEventListener('click', close);
  overlay.querySelector('.splash-backdrop')?.addEventListener('click', close);
}
