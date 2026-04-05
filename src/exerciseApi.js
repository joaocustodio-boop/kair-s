// API de exercicios com compatibilidade retroativa para a pagina de exercicios.
const CACHE_KEY = 'fd-exercise-db-v306';

// Base para imagens estaticas (quando o JSON traz caminho relativo como "id/0.jpg").
export const IMG_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

export const CAT_PT = {
  strength: 'Musculação',
  cardio: 'Cardio',
  stretching: 'Alongamento',
  flexibility: 'Flexibilidade',
  powerlifting: 'Powerlifting',
  strongman: 'Strongman',
  olympic_weightlifting: 'Levantamento Olímpico',
  plyometrics: 'Pliometria',
  sports: 'Esportes',
  sport: 'Esporte',
};

export const EQUIP_PT = {
  barbell: 'Barra',
  dumbbell: 'Haltere',
  cable: 'Cabo',
  machine: 'Máquina',
  kettlebell: 'Kettlebell',
  kettlebells: 'Kettlebell',
  bands: 'Banda/Elástico',
  smith_machine: 'Máquina Smith',
  body_weight: 'Peso Corporal',
  'body weight': 'Peso Corporal',
  'body only': 'Peso Corporal',
  none: 'Peso Corporal',
  other: 'Outro',
};

export const LEVEL_PT = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  expert: 'Avançado',
};

export const MUSCLE_PT = {
  abdominals: 'Abdominais',
  hamstrings: 'Posteriores',
  calves: 'Panturrilha',
  shoulders: 'Ombros',
  adductors: 'Adutores',
  glutes: 'Glúteos',
  quadriceps: 'Quadríceps',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebraço',
  neck: 'Pescoço',
  lats: 'Costas (Lats)',
  traps: 'Trapézio',
  middleback: 'Costas (Meio)',
  lowerback: 'Lombar',
  chest: 'Peito',
  waist: 'Core/Lombar',
};

export const SPLITS = {
  ppl: {
    label: 'Empurrar / Puxar / Pernas (PPL)',
    desc: 'Divisão clássica para evolução com alto volume semanal.',
    days: [
      { name: 'Empurrar', muscles: ['Peito', 'Ombros', 'Tríceps'] },
      { name: 'Puxar', muscles: ['Costas (Lats)', 'Trapézio', 'Bíceps'] },
      { name: 'Pernas', muscles: ['Quadríceps', 'Posteriores', 'Glúteos', 'Panturrilha'] },
    ],
  },
  ul: {
    label: 'Superior / Inferior',
    desc: 'Simples e eficiente para rotina de 4 dias.',
    days: [
      { name: 'Superior', muscles: ['Peito', 'Costas (Lats)', 'Ombros', 'Bíceps', 'Tríceps'] },
      { name: 'Inferior', muscles: ['Quadríceps', 'Posteriores', 'Glúteos', 'Panturrilha'] },
    ],
  },
  abc: {
    label: 'ABC',
    desc: 'Separação por grupamentos para foco muscular.',
    days: [
      { name: 'A - Peito / Tríceps', muscles: ['Peito', 'Tríceps'] },
      { name: 'B - Costas / Bíceps', muscles: ['Costas (Lats)', 'Trapézio', 'Bíceps'] },
      { name: 'C - Pernas / Ombros', muscles: ['Quadríceps', 'Posteriores', 'Glúteos', 'Ombros'] },
    ],
  },
};

const NAME_PT = {
  abs: 'abdômen',
  situp: 'abdominal',
  crunch: 'abdominal',
  plank: 'prancha',
  row: 'remada',
  raise: 'elevação',
  curl: 'rosca',
  press: 'supino',
  squat: 'agachamento',
  deadlift: 'levantamento terra',
  lunge: 'avanço',
  shoulder: 'ombro',
  chest: 'peito',
  back: 'costas',
  bicep: 'bíceps',
  tricep: 'tríceps',
  hamstring: 'posterior',
  bike: 'bicicleta',
  heel: 'calcanhar',
  pulldown: 'puxada',
  alternate: 'alternado',
  lateral: 'lateral',
  side: 'lateral',
  touchers: 'toques',
  touch: 'toque',
  assisted: 'assistido',
  hanging: 'suspenso',
  knee: 'joelho',
  lying: 'deitado',
  standing: 'em pe',
  seated: 'sentado',
  incline: 'inclinado',
  decline: 'declinado',
  reverse: 'invertido',
  close: 'fechado',
  wide: 'aberto',
  grip: 'pegada',
  calf: 'panturrilha',
  wrist: 'punho',
  twist: 'rotacao',
  russian: 'russo',
};

const NAME_PATTERNS = [
  [/\b3\s*\/\s*4\s+sit\s*up\b/gi, 'abdominal 3/4'],
  [/\b45\s*[°º]?\s*side\s+bend\b/gi, 'flexao lateral 45°'],
  [/\bair\s+bike\b/gi, 'bicicleta no ar'],
  [/\balternate\s+heel\s+touchers\b/gi, 'toque alternado nos calcanhares'],
  [/\balternate\s+lateral\s+pulldown\b/gi, 'puxada lateral alternada'],
  [/\bassisted\s+hanging\s+knee\s+raise\b/gi, 'elevacao de joelhos suspenso assistido'],
  [/\bassisted\s+pull\s*up\b/gi, 'barra fixa assistida'],
  [/\bpush\s*up\b/gi, 'flexao'],
  [/\bpull\s*up\b/gi, 'barra fixa'],
  [/\bchin\s*up\b/gi, 'barra supinada'],
  [/\bbench\s+press\b/gi, 'supino'],
  [/\bfront\s+squat\b/gi, 'agachamento frontal'],
  [/\brear\s+lunge\b/gi, 'avanco para tras'],
  [/\bromanian\s+deadlift\b/gi, 'levantamento terra romeno'],
  [/\bgood\s+morning\b/gi, 'good morning'],
  [/\bskull\s+crusher\b/gi, 'triceps testa'],
  [/\boverhead\s+press\b/gi, 'desenvolvimento acima da cabeca'],
  [/\bfront\s+raise\b/gi, 'elevacao frontal'],
  [/\brear\s+delt\s+raise\b/gi, 'elevacao de deltoide posterior'],
  [/\brear\s+delt\s+row\b/gi, 'remada para deltoide posterior'],
  [/\bside\s+split\s+squat\b/gi, 'agachamento sumo'],
  [/\brack\s+pull\b/gi, 'rack pull'],
  [/\bpreacher\s+curl\b/gi, 'rosca scott'],
  [/\breverse\s+curl\b/gi, 'rosca invertida'],
];

const MOJIBAKE_FIXES = [
  ['Ã£', 'a'], ['Ã¡', 'a'], ['Ã ', 'a'], ['Ã¢', 'a'], ['Ãª', 'e'], ['Ã©', 'e'],
  ['Ã­', 'i'], ['Ã³', 'o'], ['Ãµ', 'o'], ['Ãº', 'u'], ['Ã§', 'c'], ['Âº', 'o'],
  ['Âª', 'a'], ['Â¼', '1/4'], ['Â½', '1/2'], ['Â¾', '3/4'], ['Â', ''],
];

function fixMojibake(text) {
  let out = String(text || '');
  for (const [bad, good] of MOJIBAKE_FIXES) out = out.replaceAll(bad, good);
  return out;
}

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function pt(dict, key) {
  if (!key) return '';
  if (dict[key]) return dict[key];
  const normalizedKey = normalize(key).replace(/\s+/g, '_');
  const byNormalized = Object.entries(dict).find(([k]) => normalize(k).replace(/\s+/g, '_') === normalizedKey);
  return byNormalized ? byNormalized[1] : String(key);
}

export function getExercisePlace(exercise) {
  const equipment = normalize(exercise?.equipment);
  const gymEquipment = [
    'barbell', 'barra',
    'cable', 'cabo',
    'machine', 'maquina', 'máquina',
    'smith_machine', 'maquina_smith', 'máquina_smith',
    'assisted', 'assisted_(towel)',
    'leverage_machine', 'medicine_ball',
  ];

  return gymEquipment.includes(equipment) ? 'academia' : 'casa';
}

function translateName(name) {
  const raw = fixMojibake(String(name || '').trim());
  if (!raw) return raw;

  let out = raw.toLowerCase();
  for (const [pattern, replacement] of NAME_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  out = out.replace(/[\/-]/g, ' ');
  for (const [en, ptVal] of Object.entries(NAME_PT)) {
    out = out.replace(new RegExp(`\\b${en}s?\\b`, 'gi'), ptVal);
  }
  out = out.replace(/\s+/g, ' ').trim();
  out = out.replace(/\bem pe\b/gi, 'em pé');
  out = out.replace(/\brotacao\b/gi, 'rotação');
  out = out.replace(/\btriceps\b/gi, 'tríceps');
  out = out.replace(/\bcabeca\b/gi, 'cabeça');
  return out.toUpperCase();
}

function generateInstructions(ex) {
  const category = normalize(ex?.category);
  const equip = pt(EQUIP_PT, ex?.equipment || 'body weight').toLowerCase();
  const primary = String(ex?.primaryMuscles?.[0] || '').trim() || 'grupo muscular alvo';

  const step1 = `Posição inicial: mantenha postura estável e abdômen contraído; ajuste o ${equip}.`;
  const step2 = category === 'stretching' || category === 'flexibility'
    ? `Execução: avance até sentir alongamento confortável em ${primary.toLowerCase()}, sem dor.`
    : category === 'cardio'
        ? 'Execução: mantenha ritmo contínuo, respiração regular e movimento controlado.'
        : `Execução: realize o movimento principal com foco em ${primary.toLowerCase()} e controle total.`;
      const step3 = 'Retorno: volte devagar à posição inicial, sem perder alinhamento.';
      const step4 = 'Séries: repita conforme sua ficha de treino, priorizando técnica correta.';

  return [step1, step2, step3, step4];
}

function translateExercise(ex) {
  return {
    ...ex,
    name: translateName(ex?.name),
    instructions: generateInstructions(ex),
  };
}

let _cache = null;

async function tryFetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao carregar ${url}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(`Formato inválido em ${url}`);
  return data;
}

async function tryFetchRuntimeExercises(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao carregar ${url}`);
  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  throw new Error(`Formato inválido em ${url}`);
}

export async function fetchExercises() {
  if (_cache) return _cache;

  try {
    const rawCache = sessionStorage.getItem(CACHE_KEY);
    if (rawCache) {
      _cache = JSON.parse(rawCache);
      if (Array.isArray(_cache)) return _cache;
    }
  } catch (err) {
    console.warn('Erro ao ler cache de sessão:', err);
  }

  try {
    const runtimeData = await tryFetchRuntimeExercises('/api/exercises');
    const data = runtimeData.map(translateExercise);

    _cache = data;
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('Limite de SessionStorage atingido, mantendo apenas na RAM.');
    }

    return data;
  } catch (err) {
    console.warn('Falha no endpoint runtime /api/exercises, usando fallback local...', err);
  }

  try {
    const module = await import('./data/exercises_pt.json');
    const rawData = Array.isArray(module.default) ? module.default : [];
    const data = rawData.map(translateExercise);

    _cache = data;
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('Limite de SessionStorage atingido, mantendo apenas na RAM.');
    }

    return data;
  } catch (err) {
    console.warn('Falha no import do JSON local, tentando fallback via fetch...', err);
  }

  try {
    const candidates = [
      new URL('./data/exercises_pt.json', import.meta.url).href,
      '/src/data/exercises_pt.json',
      '/data/exercises_pt.json',
    ];

    for (const url of candidates) {
      try {
        const rawData = await tryFetchJson(url);
        const data = rawData.map(translateExercise);
        _cache = data;
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
        } catch (err) {
          console.warn('Limite de SessionStorage atingido, mantendo apenas na RAM.');
        }
        return data;
      } catch (_) {
        // tenta proximo endpoint
      }
    }
  } catch (err) {
    console.error('Erro critico no fallback da base de exercicios:', err);
  }

  return [];
}

export function filterExercises(exercises, { category, equipment, level, muscle, query, place } = {}) {
  if (!Array.isArray(exercises)) return [];

  const categoryN = normalize(category);
  const equipN = normalize(equipment);
  const levelN = normalize(level);
  const muscleN = normalize(muscle);
  const queryN = normalize(query);
  const placeN = normalize(place);

  return exercises.filter((ex) => {
    if (categoryN && normalize(ex.category) !== categoryN) return false;
    if (equipN && normalize(ex.equipment) !== equipN) return false;
    if (levelN && normalize(ex.level) !== levelN) return false;
    if (placeN && getExercisePlace(ex) !== placeN) return false;

    if (muscleN) {
      const matchPrimary = (ex.primaryMuscles || []).some((pm) => normalize(pm) === muscleN);
      const matchSecondary = (ex.secondaryMuscles || []).some((sm) => normalize(sm) === muscleN);
      if (!matchPrimary && !matchSecondary) return false;
    }

    if (queryN) {
      const haystack = [
        ex.name,
        ex.category,
        ex.equipment,
        ex.level,
        ...(ex.primaryMuscles || []),
        ...(ex.secondaryMuscles || []),
      ].map(normalize).join(' ');
      if (!haystack.includes(queryN)) return false;
    }

    return true;
  });
}
