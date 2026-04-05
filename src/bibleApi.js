// Integração com bible-api.com — gratuita, sem auth, tradução Almeida (PT-BR)
// Docs: https://bible-api.com/

const CACHE_VERSE_KEY = 'fd-api-verse-v3';
const CACHE_DATE_KEY  = 'fd-api-verse-date-v3';

// Lista de referências para rotação diária
// Formato: { api: 'english reference', display: 'Referência PT' }
const VERSE_REFS = [
  { api: 'john 3:16',            display: 'João 3:16', song: { title: 'Ressuscita-me', artist: 'Aline Barros', id: 'dc6oADkbQSw' } },
  { api: 'philippians 4:13',     display: 'Filipenses 4:13', song: { title: 'Lugar Secreto', artist: 'Gabriela Rocha', id: 'YnrN0o0lubM' } },
  { api: 'psalms 23:1',          display: 'Salmos 23:1', song: { title: 'Grandes Coisas', artist: 'Fernandinho', id: '5WxNEs9fxG0' } },
  { api: 'proverbs 3:5',         display: 'Provérbios 3:5', song: { title: 'Advogado Fiel', artist: 'Bruna Karla', id: '_JAiq1uf0uk' } },
  { api: 'jeremiah 29:11',       display: 'Jeremias 29:11', song: { title: 'Me Ama', artist: 'Diante do Trono', id: 'lSwiHA8gymg' } },
  { api: 'matthew 6:33',         display: 'Mateus 6:33', song: { title: 'Raridade', artist: 'Anderson Freire', id: 'Tqdi6BZUWr4' } },
  { api: 'philippians 4:6',      display: 'Filipenses 4:6', song: { title: 'Ninguém Explica Deus', artist: 'Preto no Branco', id: 'LYsaKn8FRhc' } },
  { api: 'psalms 27:1',          display: 'Salmos 27:1', song: { title: 'Faz Chover', artist: 'Fernandinho', id: 'L5K8v7qWjL4' } },
  { api: 'isaiah 40:31',         display: 'Isaías 40:31', song: { title: 'Cicatrizes', artist: 'Bruna Karla', id: 'i9YyD5X1v-U' } },
  { api: 'john 14:6',            display: 'João 14:6', song: { title: 'Há um Lugar', artist: 'Heloisa Rosa', id: '1F2y-4d-H2k' } },
  // Gravadoras oficiais
  { api: 'philippians 4:4',      display: 'Filipenses 4:4', song: { title: 'Alegria do Senhor', artist: 'Fernandinho', id: '5WxNEs9fxG0' } },
  { api: 'philippians 4:7',      display: 'Filipenses 4:7', song: { title: 'Advogado Fiel', artist: 'Bruna Karla', id: '_JAiq1uf0uk' } },
  { api: '1 corinthians 13:4',   display: '1 Coríntios 13:4', song: { title: 'Ressuscita-me', artist: 'Aline Barros', id: 'dc6oADkbQSw' } },
  { api: 'luke 1:37',            display: 'Lucas 1:37', song: { title: 'Lugar Secreto', artist: 'Gabriela Rocha', id: 'YnrN0o0lubM' } },
  { api: 'psalms 37:4',          display: 'Salmos 37:4', song: { title: 'Bondade de Deus', artist: 'Isaías Saad', id: '1DkO6vM96M0' } },
];

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function getDayRef() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  );
  return VERSE_REFS[dayOfYear % VERSE_REFS.length];
}

/**
 * Retorna o versículo do dia.
 * - Se já foi buscado hoje, retorna do cache (localStorage).
 * - Caso contrário, busca na API e cacheia.
 * - Em caso de falha de rede, usa o texto de fallback.
 */
export async function fetchDailyVerse() {
  const today = todayStr();
  const cachedDate  = localStorage.getItem(CACHE_DATE_KEY);
  const cachedVerse = localStorage.getItem(CACHE_VERSE_KEY);

  if (cachedDate === today && cachedVerse) {
    try { 
      const v = JSON.parse(cachedVerse);
      if (v.song && v.song.id) return v; // Somente usa cache se tiver a música no novo formato (ID)
    } catch { /* re-fetch */ }
  }

  const ref = getDayRef();

  try {
    const url = `https://bible-api.com/${encodeURIComponent(ref.api)}?translation=almeida`;
    const res  = await fetch(url);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const verse = {
      text: data.text.trim().replace(/\n/g, ' '),
      ref:  ref.display,
      source: 'João Ferreira de Almeida',
      song: ref.song,
    };

    localStorage.setItem(CACHE_VERSE_KEY, JSON.stringify(verse));
    localStorage.setItem(CACHE_DATE_KEY,  today);
    return verse;

  } catch (err) {
    console.warn('[BibleAPI] Falha ao buscar versículo, usando fallback.', err);
    // Fallback: texto pré-definido para não quebrar a UI
    return {
      text: 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.',
      ref:  'João 3:16',
      source: 'offline',
      song: { title: 'Porque Ele Vive', artist: 'Harpã Cristã', url: 'https://www.youtube.com/watch?v=F07X64fW46s' },
    };
  }
}

/**
 * Busca um versículo específico pela referência (inglês).
 * Exemplo: fetchVerse('john 3:16')
 */
export async function fetchVerse(apiRef, displayRef) {
  const cacheKey = `fd-verse-${apiRef}`;
  const cached   = sessionStorage.getItem(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch { /* re-fetch */ }
  }

  try {
    const url  = `https://bible-api.com/${encodeURIComponent(apiRef)}?translation=almeida`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const verse = {
      text: data.text.trim().replace(/\n/g, ' '),
      ref:  displayRef || data.reference,
      source: 'João Ferreira de Almeida',
    };
    sessionStorage.setItem(cacheKey, JSON.stringify(verse));
    return verse;
  } catch {
    return null; // o chamador exibirá o texto pré-definido
  }
}

/** Retorna o versículo cacheado do dia (sincronamente) — ou null se ainda não buscado */
export function getCachedDailyVerse() {
  const today = todayStr();
  if (localStorage.getItem(CACHE_DATE_KEY) !== today) return null;
  try { return JSON.parse(localStorage.getItem(CACHE_VERSE_KEY)); } catch { return null; }
}
