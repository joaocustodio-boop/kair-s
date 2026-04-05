import { store } from '../store.js';
import { refreshIcons } from '../icons.js';
import {
  getUserSongs, addUserSong, removeUserSong
} from '../data/music-db.js';

// ─── Invidious instances (fallback chain para busca sem API key) ──────────────
const INVIDIOUS = [
  'https://inv.nadeko.net',
  'https://invidious.privacyredirect.com',
  'https://iv.melmac.space',
];

// ─── Estado ───────────────────────────────────────────────────────────────────
let _yt          = null;   // YT.Player
let _ytReady     = false;
let _isPlaying   = false;
let _currentSong = null;
let _duration    = 0;
let _failedIds   = new Set();
let _skipCount   = 0;
let _skipTimer   = null;
let _progressInt = null;
let _searchMode  = false;   // mostra resultados ou playlist
let _pendingPlay = false;   // play solicitado antes da API do YouTube ficar pronta

const MAX_SKIPS = 4;

function updateMediaSession(song, isPlaying) {
  if (!('mediaSession' in navigator)) return;

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song?.title || 'FocusDash',
      artist: song?.artist || 'Música Gospel',
      album: 'FocusDash',
    });

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    navigator.mediaSession.setActionHandler('play', () => GlobalPlayer.toggle());
    navigator.mediaSession.setActionHandler('pause', () => GlobalPlayer.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => GlobalPlayer.prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => GlobalPlayer.next());
  } catch {}
}

// ─── Playlist ─────────────────────────────────────────────────────────────────
function fullPlaylist() { return getUserSongs(); }
function available()    { return fullPlaylist().filter(s => !_failedIds.has(s.id)); }
function findSong(id)   { return fullPlaylist().find(s => s.id === id) || null; }

// ─── Tempo ───────────────────────────────────────────────────────────────────
function fmtTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── YouTube API ──────────────────────────────────────────────────────────────
function loadYTAPI() {
  if (window.YT?.Player) { _ytReady = true; return; }
  if (document.querySelector('script[src*="youtube.com/iframe_api"]')) return;
  const tag = document.createElement('script');
  tag.src   = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
  window.onYouTubeIframeAPIReady = () => {
    _ytReady = true;
    if (_pendingPlay && _currentSong && !_isPlaying) _doPlay(_currentSong);
  };
}

function _doPlay(song) {
  if (!song) return;
  _currentSong = song;
  store.update('music', d => { d.currentSongId = song.id; return d; });
  GlobalPlayer._updateBar(false, song);

  if (!_ytReady || !window.YT?.Player) {
    _pendingPlay = true;
    return;
  }
  _pendingPlay = false;
  const YTApi = window.YT;

  if (!_yt) {
    _yt = new YTApi.Player('yt-hidden-player', {
      videoId: song.id,
      playerVars: { autoplay:1, controls:0, disablekb:1, fs:0, rel:0, modestbranding:1, origin: window.location.origin },
      events: {
        onReady(e)       { e.target.setVolume(80); e.target.playVideo(); },
        onStateChange(e) {
          const S = YTApi.PlayerState;
          if (e.data === S.PLAYING) {
            _isPlaying = true; _skipCount = 0; _duration = _yt.getDuration() || 0;
            updateMediaSession(_currentSong, true);
            GlobalPlayer._startProgress(); GlobalPlayer._updateBar(true, _currentSong);
          } else if (e.data === S.ENDED) {
            _isPlaying = false;
            updateMediaSession(_currentSong, false);
            GlobalPlayer._stopProgress(); GlobalPlayer.next();
          } else if (e.data === S.PAUSED) {
            _isPlaying = false;
            updateMediaSession(_currentSong, false);
            GlobalPlayer._stopProgress(); GlobalPlayer._updateBar(false, _currentSong);
          }
        },
        onError(e) {
          console.warn('[Player] YT error', e.data, _currentSong?.id);
          _failedIds.add(_currentSong?.id);
          _isPlaying = false; GlobalPlayer._stopProgress();
          updateMediaSession(_currentSong, false);
          _scheduleSkip();
        },
      },
    });
  } else {
    try { _yt.loadVideoById(song.id); }
    catch { _yt = null; _doPlay(song); }
  }
}

function _scheduleSkip() {
  clearTimeout(_skipTimer);
  if (_skipCount >= MAX_SKIPS) {
    _skipCount = 0;
    GlobalPlayer._showToast('Várias músicas indisponíveis. Escolha outra na lista.');
    return;
  }
  _skipCount++;
  _skipTimer = setTimeout(() => GlobalPlayer.next(), 1200);
}

// ─── Busca via Invidious ──────────────────────────────────────────────────────
async function searchYouTube(query) {
  const q = encodeURIComponent(query);
  for (const base of INVIDIOUS) {
    const ctrl = new AbortController();
    const t    = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch(
        `${base}/api/v1/search?q=${q}&type=video&fields=videoId,title,author,lengthSeconds&pretty=0`,
        { signal: ctrl.signal }
      );
      clearTimeout(t);
      if (!res.ok) continue;
      const data = await res.json();
      return (Array.isArray(data) ? data : []).slice(0, 12).map(v => ({
        id:       v.videoId,
        title:    v.title,
        artist:   v.author,
        duration: v.lengthSeconds || 0,
      }));
    } catch { clearTimeout(t); }
  }
  return null; // todas as instâncias falharam
}

// ─── GlobalPlayer ─────────────────────────────────────────────────────────────
export const GlobalPlayer = {

  init() {
    if (!document.getElementById('header-player-root')) return;
    loadYTAPI();
    const ms = store.get('music');
    _currentSong = findSong(ms.currentSongId) || fullPlaylist()[0] || null;
    this.render();
  },

  // ── Controles públicos ────────────────────────────────────────────────────
  play(song) {
    if (!song) return;
    _skipCount = 0; clearTimeout(_skipTimer);
    _doPlay(song);
  },

  pause() {
    _yt?.pauseVideo();
    _pendingPlay = false;
    updateMediaSession(_currentSong, false);
    _isPlaying = false; this._stopProgress(); this._updateBar(false, _currentSong);
  },

  toggle() {
    if (!_currentSong) { const pl = available(); if (pl.length) this.play(pl[0]); return; }
    if (_isPlaying) this.pause();
    else if (_yt)   _yt.playVideo();
    else            this.play(_currentSong);
  },

  next() {
    const pl = available();
    if (!pl.length) return;
    const idx = pl.findIndex(s => s.id === _currentSong?.id);
    _doPlay(pl[(idx + 1) % pl.length]);
  },

  prev() {
    const pl = available();
    if (!pl.length) return;
    const idx = pl.findIndex(s => s.id === _currentSong?.id);
    _skipCount = 0;
    _doPlay(pl[(idx - 1 + pl.length) % pl.length]);
  },

  seek(pct) {
    if (!_yt || !_duration) return;
    _yt.seekTo(_duration * pct, true);
  },

  toggleFav(id) {
    if (!_currentSong) return;
    const inPlaylist = getUserSongs().some(s => s.id === id);
    if (inPlaylist) {
      removeUserSong(id);
      this._showToast(`"${_currentSong.title}" removida da playlist`);
    } else {
      addUserSong({ ..._currentSong, userAdded: true });
      this._showToast(`"${_currentSong.title}" adicionada à playlist!`);
    }
    this._refreshFavBtn();
    this._refreshList();
  },

  removeSong(id) {
    removeUserSong(id);
    if (_currentSong?.id === id) this.next();
    this._refreshList();
  },

  // ── Progresso ─────────────────────────────────────────────────────────────
  _startProgress() {
    this._stopProgress();
    _progressInt = setInterval(() => {
      if (!_yt || !_isPlaying) return;
      try {
        const cur = _yt.getCurrentTime() || 0;
        const dur = _yt.getDuration()    || _duration || 0;
        _duration = dur;
        const pct  = dur > 0 ? (cur / dur) * 100 : 0;
        const fill = document.getElementById('hp-prog-fill');
        const time = document.getElementById('hp-time');
        if (fill) fill.style.width = `${pct}%`;
        if (time) time.textContent = `${fmtTime(cur)} / ${fmtTime(dur)}`;
      } catch {}
    }, 500);
  },

  _stopProgress() { clearInterval(_progressInt); _progressInt = null; },

  // ── Render principal ──────────────────────────────────────────────────────
  render() {
    const root = document.getElementById('header-player-root');
    if (!root) return;
    const song  = _currentSong || fullPlaylist()[0];
    const isFav = song ? getUserSongs().some(s => s.id === song.id) : false;

    root.innerHTML = `
      <!-- Barra compacta do header -->
      <div class="hp-bar" id="hp-bar">
        <!-- Controles -->
        <button class="hp-btn" id="hp-prev" title="Anterior"><i data-lucide="skip-back"></i></button>
        <button class="hp-btn hp-main" id="hp-toggle" title="${_isPlaying ? 'Pausar' : 'Tocar'}">
          <i data-lucide="${_isPlaying ? 'pause' : 'play'}"></i>
        </button>
        <button class="hp-btn" id="hp-next" title="Próxima"><i data-lucide="skip-forward"></i></button>

        <!-- Info + progresso -->
        <div class="hp-center" id="hp-panel-toggle" title="Abrir playlist">
          <div class="hp-song-info">
            <span class="hp-title">${song?.title ?? '—'}</span>
            <span class="hp-artist">${song?.artist ?? ''}</span>
          </div>
          <!-- Barra de progresso clicável -->
          <div class="hp-progress-track" id="hp-progress-track">
            <div class="hp-prog-fill" id="hp-prog-fill" style="width:0%"></div>
          </div>
          <span class="hp-time" id="hp-time">0:00 / 0:00</span>
        </div>

        <button class="hp-btn ${isFav ? 'hp-active' : ''}" id="hp-fav" title="${isFav ? 'Desfavoritar' : 'Favoritar'}">
          <i data-lucide="heart"></i>
        </button>
        <button class="hp-btn" id="hp-list-btn" title="Playlist">
          <i data-lucide="music-2"></i>
        </button>
      </div>

      <!-- Painel expansível (playlist + busca) -->
      <div class="hp-panel" id="hp-panel">
        <div class="hp-panel-inner">
          <!-- Header do painel -->
          <div class="hp-panel-header">
            <span class="hp-panel-title">🎵 Música Gospel</span>
            <button class="hp-btn" id="hp-panel-close"><i data-lucide="x"></i></button>
          </div>

          <!-- Barra de busca -->
          <div class="hp-search-wrap">
            <div class="hp-search-box">
              <i data-lucide="search"></i>
              <input
                type="text"
                id="hp-search-input"
                class="hp-search-input"
                placeholder="Buscar no YouTube..."
                autocomplete="off"
              />
              <button class="hp-search-clear" id="hp-search-clear" style="display:none">
                <i data-lucide="x"></i>
              </button>
            </div>
            <div class="hp-search-status" id="hp-search-status"></div>
          </div>

          <!-- Lista (playlist ou resultados) -->
          <div class="hp-list-scroll">
            <div id="hp-list-content">
              ${this._renderPlaylist(fullPlaylist(), song?.id)}
            </div>
          </div>
        </div>
      </div>

      <!-- Toast de erro -->
      <div class="hp-toast" id="hp-toast"></div>
    `;

    refreshIcons();
    this._attachListeners();

    if (_isPlaying) this._startProgress();
  },

  // ── Renderiza playlist ────────────────────────────────────────────────────
  _renderPlaylist(list, activeId) {
    if (!list.length) return `<p class="hp-empty">Busque uma música acima e clique em + para adicionar</p>`;
    return `
      <div class="hp-section-label">Playlist (${list.length})</div>
      ${list.map(s => this._renderItem(s, activeId)).join('')}
    `;
  },

  _renderResults(list, activeId) {
    if (!list.length) return `<p class="hp-empty">Nenhum resultado encontrado</p>`;
    return `
      <div class="hp-section-label">Resultados da busca</div>
      ${list.map(s => this._renderItem(s, activeId, true)).join('')}
    `;
  },

  _renderItem(s, activeId, isResult = false) {
    const isActive  = s.id === activeId;
    const isFailed  = _failedIds.has(s.id);
    const isUser    = !isResult; // na playlist, toda música pode ser removida
    const inPlaylist = fullPlaylist().some(p => p.id === s.id);
    const dur = s.duration ? ` · ${fmtTime(s.duration)}` : '';

    return `
      <div class="hp-item ${isActive ? 'hp-item-active' : ''} ${isFailed ? 'hp-item-failed' : ''}"
           data-id="${s.id}" data-title="${s.title}" data-artist="${s.artist}">
        <div class="hp-item-info">
          ${isActive && _isPlaying ? `<div class="hp-item-viz"><div class="b"></div><div class="b"></div><div class="b"></div></div>` : `<i data-lucide="music" class="hp-item-icon"></i>`}
          <div class="hp-item-text">
            <span class="hp-item-title">${s.title}${isFailed ? ' ⚠️' : ''}</span>
            <span class="hp-item-artist">${s.artist}${dur}</span>
          </div>
        </div>
        <div class="hp-item-actions">
          ${isResult && !inPlaylist
            ? `<button class="hp-item-btn hp-add-btn" data-id="${s.id}" title="Adicionar à playlist"><i data-lucide="plus"></i></button>`
            : ''
          }
          ${isUser
            ? `<button class="hp-item-btn hp-remove-btn" data-id="${s.id}" title="Remover"><i data-lucide="trash-2"></i></button>`
            : ''
          }
        </div>
      </div>
    `;
  },

  // ── Atualiza barra sem re-render completo ─────────────────────────────────
  _updateBar(isPlaying, song) {
    _isPlaying   = isPlaying;
    _currentSong = song || _currentSong;
    updateMediaSession(_currentSong, _isPlaying);

    const toggleBtn = document.getElementById('hp-toggle');
    const titleEl   = document.querySelector('.hp-title');
    const artistEl  = document.querySelector('.hp-artist');
    const bar       = document.getElementById('hp-bar');

    if (toggleBtn) toggleBtn.innerHTML = `<i data-lucide="${isPlaying ? 'pause' : 'play'}"></i>`;
    if (titleEl && _currentSong)  titleEl.textContent  = _currentSong.title;
    if (artistEl && _currentSong) artistEl.textContent = _currentSong.artist;
    if (bar) bar.classList.toggle('hp-playing', isPlaying);

    // Atualiza item ativo na lista
    document.querySelectorAll('.hp-item').forEach(el => {
      el.classList.toggle('hp-item-active', el.dataset.id === _currentSong?.id);
    });

    if (!isPlaying) {
      const fill = document.getElementById('hp-prog-fill');
      if (fill && !_isPlaying) { /* mantém posição */ }
    }

    refreshIcons();
  },

  _refreshFavBtn() {
    const inPlaylist = _currentSong && getUserSongs().some(s => s.id === _currentSong.id);
    const btn = document.getElementById('hp-fav');
    if (btn) btn.classList.toggle('hp-active', inPlaylist);
  },

  _refreshList() {
    const content = document.getElementById('hp-list-content');
    if (content && !_searchMode) {
      content.innerHTML = this._renderPlaylist(fullPlaylist(), _currentSong?.id);
      refreshIcons();
      this._attachItemListeners(content);
    }
  },

  _showToast(msg) {
    const el = document.getElementById('hp-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('hp-toast-visible');
    setTimeout(() => el.classList.remove('hp-toast-visible'), 4000);
  },

  // ── Listeners ─────────────────────────────────────────────────────────────
  _attachListeners() {
    const panel       = document.getElementById('hp-panel');
    const listContent = document.getElementById('hp-list-content');

    // Controles
    document.getElementById('hp-toggle')?.addEventListener('click', e => { e.stopPropagation(); this.toggle(); });
    document.getElementById('hp-next')?.addEventListener('click',   e => { e.stopPropagation(); _skipCount = 0; this.next(); });
    document.getElementById('hp-prev')?.addEventListener('click',   e => { e.stopPropagation(); this.prev(); });
    document.getElementById('hp-fav')?.addEventListener('click',    e => { e.stopPropagation(); if (_currentSong) this.toggleFav(_currentSong.id); });

    // Abrir / fechar painel
    document.getElementById('hp-panel-toggle')?.addEventListener('click', e => {
      e.stopPropagation(); panel?.classList.toggle('hp-panel-open');
    });
    document.getElementById('hp-list-btn')?.addEventListener('click', e => {
      e.stopPropagation(); panel?.classList.toggle('hp-panel-open');
    });
    document.getElementById('hp-panel-close')?.addEventListener('click', () => panel?.classList.remove('hp-panel-open'));
    document.addEventListener('click', e => {
      const root = document.getElementById('header-player-root');
      if (root && !root.contains(e.target)) panel?.classList.remove('hp-panel-open');
    });

    // Barra de progresso clicável
    document.getElementById('hp-progress-track')?.addEventListener('click', e => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const pct  = (e.clientX - rect.left) / rect.width;
      this.seek(Math.max(0, Math.min(1, pct)));
    });

    // Busca
    const searchInput = document.getElementById('hp-search-input');
    const clearBtn    = document.getElementById('hp-search-clear');
    const status      = document.getElementById('hp-search-status');
    let   searchTimer = null;

    searchInput?.addEventListener('input', e => {
      const q = e.target.value.trim();
      clearBtn.style.display = q ? 'flex' : 'none';

      clearTimeout(searchTimer);
      if (!q) {
        _searchMode = false;
        status.textContent = '';
        this._refreshList();
        return;
      }

      // Debounce 600ms
      searchTimer = setTimeout(async () => {
        _searchMode  = true;
        status.innerHTML = '<i data-lucide="loader"></i> Buscando...';
        refreshIcons();

        const results = await searchYouTube(q);

        if (results === null) {
          status.textContent = '⚠️ Serviço indisponível. Tente novamente.';
          return;
        }

        status.textContent = `${results.length} resultado${results.length !== 1 ? 's' : ''}`;

        if (listContent) {
          listContent.innerHTML = this._renderResults(results, _currentSong?.id);
          refreshIcons();
          this._attachItemListeners(listContent);
        }
      }, 600);
    });

    clearBtn?.addEventListener('click', e => {
      e.stopPropagation();
      searchInput.value  = '';
      clearBtn.style.display = 'none';
      status.textContent = '';
      _searchMode = false;
      this._refreshList();
      searchInput.focus();
    });

    // Itens da lista
    this._attachItemListeners(listContent);
  },

  _attachItemListeners(container) {
    if (!container) return;

    // Clicar no item → tocar
    container.querySelectorAll('.hp-item').forEach(item => {
      item.addEventListener('click', e => {
        if (e.target.closest('.hp-item-btn')) return;
        const song = {
          id:     item.dataset.id,
          title:  item.dataset.title,
          artist: item.dataset.artist,
        };
        _skipCount = 0;
        this.play(song);
        document.getElementById('hp-panel')?.classList.remove('hp-panel-open');
        const inp = document.getElementById('hp-search-input');
        const clr = document.getElementById('hp-search-clear');
        const sts = document.getElementById('hp-search-status');
        if (inp) inp.value = '';
        if (clr) clr.style.display = 'none';
        if (sts) sts.textContent = '';
        _searchMode = false;
        this._refreshList();
      });
    });

    // Botão Adicionar (resultado de busca)
    container.querySelectorAll('.hp-add-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const item   = btn.closest('.hp-item');
        const song   = { id: item.dataset.id, title: item.dataset.title, artist: item.dataset.artist, userAdded: true };
        addUserSong(song);
        btn.innerHTML = '<i data-lucide="check"></i>';
        btn.disabled  = true;
        refreshIcons();
        this._showToast(`"${song.title}" adicionada à playlist!`);
      });
    });

    // Botão Remover (músicas do usuário)
    container.querySelectorAll('.hp-remove-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this.removeSong(btn.dataset.id);
      });
    });
  },
};
