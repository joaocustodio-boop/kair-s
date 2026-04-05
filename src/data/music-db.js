// Banco de músicas gospel brasileiras
// Formato: { id: 'YouTube Video ID (11 chars)', title, artist }
// IDs verificados de canais oficiais no YouTube

export const GOSPEL_DATABASE = [
  // ── Gabriela Rocha ──────────────────────────────────────
  { id: 'YnrN0o0lubM', title: 'Lugar Secreto',                artist: 'Gabriela Rocha' },
  { id: 'Z6cONvRUFZQ', title: 'Me Atraiu',                    artist: 'Gabriela Rocha' },
  { id: 'Sn3SONbAl28', title: 'Tu És Santo',                  artist: 'Gabriela Rocha' },

  // ── Fernandinho ──────────────────────────────────────────
  { id: '5WxNEs9fxG0', title: 'Grandes Coisas',               artist: 'Fernandinho' },
  { id: 'f3CNzNsEBHs', title: 'Para Sempre',                  artist: 'Fernandinho' },
  { id: 'tpFzUr72gHI', title: 'Faz Chover',                   artist: 'Fernandinho' },

  // ── Aline Barros ────────────────────────────────────────
  { id: 'dc6oADkbQSw', title: 'Ressuscita-me',                artist: 'Aline Barros' },
  { id: 'Pq8SoOcpBSs', title: 'Eu Navegarei',                 artist: 'Aline Barros' },

  // ── Bruna Karla ──────────────────────────────────────────
  { id: '_JAiq1uf0uk', title: 'Advogado Fiel',                artist: 'Bruna Karla' },
  { id: 'hiNmiVFMJGo', title: 'Creio',                        artist: 'Bruna Karla' },

  // ── Anderson Freire ──────────────────────────────────────
  { id: 'Tqdi6BZUWr4', title: 'Raridade',                     artist: 'Anderson Freire' },
  { id: 'XjBYKK6mxOo', title: 'Envolto em Graça',             artist: 'Anderson Freire' },

  // ── Maria Marçal ─────────────────────────────────────────
  { id: 'bVUWlf1Xr9U', title: 'Deserto',                      artist: 'Maria Marçal' },
  { id: 'kGUhXtEhkew', title: 'Gratidão',                     artist: 'Maria Marçal' },

  // ── Isadora Pompeo ───────────────────────────────────────
  { id: 'UIohu4dOqsA', title: 'Bênçãos Que Não Têm Fim',      artist: 'Isadora Pompeo' },
  { id: 'wNbGnDaecME', title: 'Com Você',                     artist: 'Isadora Pompeo' },

  // ── Isaías Saad ──────────────────────────────────────────
  { id: 'Xv5S2F8W6Bw', title: 'Bondade de Deus',              artist: 'Isaías Saad' },
  { id: '1DkO6vM96M0', title: 'Me Ajoelho',                   artist: 'Isaías Saad' },

  // ── Preto no Branco ──────────────────────────────────────
  { id: 'LYsaKn8FRhc', title: 'Ninguém Explica Deus',         artist: 'Preto no Branco' },
  { id: 'CtGAtqGQ9sY', title: 'Pra Nunca Mais Parar',         artist: 'Preto no Branco' },

  // ── Diante do Trono ──────────────────────────────────────
  { id: 'lSwiHA8gymg', title: 'Me Ama',                       artist: 'Diante do Trono' },
  { id: 'oXi_w-2K4s0', title: 'Digno É o Senhor',            artist: 'Diante do Trono' },

  // ── Morada ───────────────────────────────────────────────
  { id: 'VT5aeChqPQs', title: 'Do Pó',                        artist: 'Morada' },
  { id: 'XL_QY0dsFxM', title: 'Faz em Mim',                  artist: 'Morada' },

  // ── Casa Worship ─────────────────────────────────────────
  { id: 'Y_GvI6p-oIs', title: 'A Casa É Sua',                 artist: 'Casa Worship' },

  // ── Voz da Verdade ───────────────────────────────────────
  { id: '4vV3E_iZ0-o', title: 'O Escudo',                     artist: 'Voz da Verdade' },

  // ── Gerson Rufino ────────────────────────────────────────
  { id: 'SAti-x9I-W0', title: 'Escrito nas Estrelas',         artist: 'Gerson Rufino' },

  // ── Samuel Messias ───────────────────────────────────────
  { id: 'uH3-LIO-eNo', title: 'Todavia Me Alegrarei',         artist: 'Samuel Messias' },

  // ── Midian Lima ──────────────────────────────────────────
  { id: 'S_E9U6mC5yE', title: 'Não Pare',                     artist: 'Midian Lima' },
];

// Músicas adicionadas pelo usuário (lidas do localStorage via store)
export const USER_SONGS_KEY = 'fd-user-songs';

export function getUserSongs() {
  try {
    const raw = localStorage.getItem(USER_SONGS_KEY);
    if (!raw) {
      const seed = [...GOSPEL_DATABASE];
      localStorage.setItem(USER_SONGS_KEY, JSON.stringify(seed));
      return seed;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Formato inválido de playlist');
    return parsed;
  } catch {
    const seed = [...GOSPEL_DATABASE];
    localStorage.setItem(USER_SONGS_KEY, JSON.stringify(seed));
    return seed;
  }
}

export function addUserSong(song) {
  const songs = getUserSongs();
  if (!songs.find(s => s.id === song.id)) {
    songs.unshift(song);
    localStorage.setItem(USER_SONGS_KEY, JSON.stringify(songs));
  }
}

export function removeUserSong(id) {
  const songs = getUserSongs().filter(s => s.id !== id);
  localStorage.setItem(USER_SONGS_KEY, JSON.stringify(songs));
}

/** Extrai o ID de um URL do YouTube (vários formatos) */
export function extractYouTubeId(input) {
  input = input.trim();
  // ID puro (11 chars)
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
  // youtu.be/ID
  const short = input.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (short) return short[1];
  // youtube.com/watch?v=ID
  const long = input.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (long) return long[1];
  // youtube.com/embed/ID
  const embed = input.match(/embed\/([A-Za-z0-9_-]{11})/);
  if (embed) return embed[1];
  return null;
}
