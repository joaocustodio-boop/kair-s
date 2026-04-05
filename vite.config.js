import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const ROOT_DIR = fileURLToPath(new URL('.', import.meta.url));
const LOCAL_DATA_FILE = path.resolve(ROOT_DIR, 'src/data/exercises_pt.json');
const RAPIDAPI_HOST = 'exercisedb.p.rapidapi.com';
const WGER_URL = 'https://wger.de/api/v2/exerciseinfo/?limit=120&language=2';
const RAPID_URL = 'https://exercisedb.p.rapidapi.com/exercises?limit=120&offset=0';
const CACHE_TTL_MS = 10 * 60 * 1000;

const CATEGORY_MAP = {
  cardio: 'cardio',
  stretching: 'stretching',
  flexibility: 'flexibility',
  mobility: 'flexibility',
  yoga: 'flexibility',
  pliometria: 'plyometrics',
  plyometrics: 'plyometrics',
  sport: 'sport',
  sports: 'sport',
  warmup: 'cardio',
  warm_up: 'cardio',
  strongman: 'strongman',
  powerlifting: 'powerlifting',
  olympic_weightlifting: 'olympic_weightlifting',
};

const EQUIPMENT_MAP = {
  'body weight': 'body weight',
  'body only': 'body weight',
  'peso corporal': 'body weight',
  bodyweight: 'body weight',
  barbell: 'barbell',
  barra: 'barbell',
  dumbbell: 'dumbbell',
  haltere: 'dumbbell',
  cable: 'cable',
  cabo: 'cable',
  machine: 'machine',
  maquina: 'machine',
  'máquina': 'machine',
  'leverage machine': 'machine',
  'smith machine': 'smith_machine',
  kettlebell: 'kettlebell',
  bands: 'bands',
  band: 'bands',
  'medicine ball': 'other',
  assisted: 'other',
  'assisted (towel)': 'other',
  other: 'other',
  none: 'body weight',
};

const MUSCLE_MAP = {
  abs: 'Abdominais',
  abdominals: 'Abdominais',
  obliques: 'Abdominais',
  waist: 'Abdominais',
  core: 'Abdominais',
  hip_flexors: 'Core/Lombar',
  'hip flexors': 'Core/Lombar',
  lower_back: 'Lombar',
  'lower back': 'Lombar',
  erector_spinae: 'Lombar',
  chest: 'Peito',
  pectorals: 'Peito',
  serratus_anterior: 'Peito',
  'serratus anterior': 'Peito',
  back: 'Costas (Lats)',
  lats: 'Costas (Lats)',
  latissimus_dorsi: 'Costas (Lats)',
  upper_back: 'Costas (Meio)',
  'upper back': 'Costas (Meio)',
  middle_back: 'Costas (Meio)',
  rhomboids: 'Costas (Meio)',
  traps: 'Trapézio',
  trapezius: 'Trapézio',
  shoulders: 'Ombros',
  delts: 'Ombros',
  deltoids: 'Ombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebraço',
  forearm: 'Antebraço',
  glutes: 'Glúteos',
  gluteus_maximus: 'Glúteos',
  gluteus_medius: 'Glúteos',
  quadriceps: 'Quadríceps',
  quads: 'Quadríceps',
  upper_legs: 'Quadríceps',
  'upper legs': 'Quadríceps',
  hamstrings: 'Posteriores',
  calves: 'Panturrilha',
  calf: 'Panturrilha',
  lower_legs: 'Panturrilha',
  'lower legs': 'Panturrilha',
  neck: 'Pescoço',
  adductors: 'Adutores',
};

let runtimeCache = {
  expiresAt: 0,
  items: null,
};

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function uniqueStrings(values) {
  return [...new Set((values || []).filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function mapEquipment(value) {
  const normalized = normalizeText(value).replace(/\s+/g, ' ');
  return EQUIPMENT_MAP[normalized] || normalized || 'other';
}

function mapLevel(value) {
  const normalized = normalizeText(value);
  if (normalized === 'advanced') return 'expert';
  return normalized || 'beginner';
}

function mapCategory(value) {
  const normalized = normalizeText(value).replace(/\s+/g, '_');
  if (!normalized) return 'strength';
  return CATEGORY_MAP[normalized] || 'strength';
}

function mapMuscle(value) {
  const normalized = normalizeText(value).replace(/\s+/g, '_');
  return MUSCLE_MAP[normalized] || String(value || '').trim();
}

function normalizeImages(values) {
  return uniqueStrings(
    toArray(values).map((value) => {
      if (!value) return '';
      if (typeof value === 'string') return value;
      return value.image || value.url || value.src || '';
    }),
  );
}

function normalizeInstructions(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item).trim()).filter(Boolean);
  if (!value) return [];
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .split(/\r?\n|•|\-|\d+\./)
    .map((item) => item.replace(/&nbsp;/g, ' ').trim())
    .filter((item) => item.length > 20)
    .slice(0, 6);
}

function buildKey(exercise) {
  const name = normalizeText(exercise?.name);
  const equipment = normalizeText(exercise?.equipment);
  if (name) return `${name}::${equipment}`;
  return String(exercise?.id || crypto.randomUUID());
}

function mergeExercise(current, incoming, source) {
  const currentSources = toArray(current?.sources);
  const nextSources = uniqueStrings([...currentSources, source]);
  const instructions = toArray(current?.instructions).length ? current.instructions : incoming.instructions;
  const images = uniqueStrings([...toArray(current?.images), ...toArray(incoming?.images)]);
  const primaryMuscles = uniqueStrings([...toArray(current?.primaryMuscles), ...toArray(incoming?.primaryMuscles)]);
  const secondaryMuscles = uniqueStrings([...toArray(current?.secondaryMuscles), ...toArray(incoming?.secondaryMuscles)]);

  return {
    ...current,
    ...incoming,
    id: current?.id || incoming?.id,
    name: current?.name || incoming?.name,
    equipment: current?.equipment || incoming?.equipment || 'body weight',
    category: current?.category || incoming?.category || 'strength',
    level: current?.level || incoming?.level || 'beginner',
    primaryMuscles,
    secondaryMuscles,
    instructions,
    images,
    sources: nextSources,
  };
}

async function readLocalExercises() {
  const raw = await readFile(LOCAL_DATA_FILE, 'utf8');
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : [];
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim());
  }

  return response.json();
}

function normalizeRapidExercise(item) {
  if (!item?.name) return null;

  return {
    id: item.id || `rapid-${normalizeText(item.name).replace(/\s+/g, '-')}`,
    name: item.name,
    equipment: mapEquipment(item.equipment),
    category: mapCategory(item.category),
    level: mapLevel(item.difficulty),
    primaryMuscles: uniqueStrings([mapMuscle(item.target || item.bodyPart)]),
    secondaryMuscles: uniqueStrings(toArray(item.secondaryMuscles).map(mapMuscle)),
    instructions: normalizeInstructions(item.instructions),
    images: normalizeImages(item.images),
    description: item.description || '',
    type: normalizeImages(item.images).some((image) => /\.gif(\?|$)/i.test(image)) ? 'animated' : 'static',
  };
}

function pickWgerTranslation(item) {
  const translations = toArray(item?.translations);
  return translations.find((translation) => translation.language === 2)
    || translations.find((translation) => translation.language === 8)
    || translations[0]
    || null;
}

function normalizeWgerExercise(item) {
  const translation = pickWgerTranslation(item);
  const name = translation?.name || item?.name;
  if (!name) return null;

  const equipment = toArray(item?.equipment).map((entry) => mapEquipment(entry?.name)).find(Boolean) || 'body weight';
  const primaryMuscles = toArray(item?.muscles).map((muscle) => mapMuscle(muscle?.name));
  const secondaryMuscles = toArray(item?.muscles_secondary).map((muscle) => mapMuscle(muscle?.name));
  const images = normalizeImages(item?.images);

  return {
    id: `wger-${item.id}`,
    name,
    equipment,
    category: mapCategory(item?.category?.name),
    level: 'beginner',
    primaryMuscles: uniqueStrings(primaryMuscles),
    secondaryMuscles: uniqueStrings(secondaryMuscles),
    instructions: normalizeInstructions(translation?.description),
    images,
    description: translation?.description || '',
    videos: uniqueStrings(toArray(item?.videos).map((video) => video?.video || '')),
    type: images.some((image) => /\.gif(\?|$)/i.test(image)) ? 'animated' : 'static',
  };
}

async function fetchRapidExercises(env) {
  const apiKey = env.EXERCISEDB_RAPIDAPI_KEY || env.RAPIDAPI_KEY || '';
  if (!apiKey) return [];

  const payload = await fetchJson(RAPID_URL, {
    headers: {
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key': apiKey,
    },
  });

  return toArray(payload).map(normalizeRapidExercise).filter(Boolean);
}

async function fetchWgerExercises() {
  const payload = await fetchJson(WGER_URL);
  return toArray(payload?.results).map(normalizeWgerExercise).filter(Boolean);
}

async function getRuntimeExercises(env) {
  if (runtimeCache.items && runtimeCache.expiresAt > Date.now()) {
    return runtimeCache.items;
  }

  const local = await readLocalExercises();
  const [rapidResult, wgerResult] = await Promise.allSettled([
    fetchRapidExercises(env),
    fetchWgerExercises(),
  ]);

  const merged = new Map();
  const insertAll = (items, source) => {
    for (const item of items) {
      if (!item) continue;
      const key = buildKey(item);
      const current = merged.get(key);
      merged.set(key, mergeExercise(current, item, source));
    }
  };

  insertAll(local, 'local');
  if (rapidResult.status === 'fulfilled') insertAll(rapidResult.value, 'rapidapi');
  if (wgerResult.status === 'fulfilled') insertAll(wgerResult.value, 'wger');

  const items = [...merged.values()];
  runtimeCache = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    items,
  };

  return items;
}

function exerciseRuntimePlugin(env) {
  const handleRequest = async (req, res, next) => {
    const requestUrl = new URL(req.url || '/', 'http://localhost');
    if (requestUrl.pathname !== '/api/exercises') {
      next();
      return;
    }

    try {
      const items = await getRuntimeExercises(env);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(items));
    } catch (error) {
      console.error('Falha no endpoint /api/exercises:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        message: 'Nao foi possivel montar a base runtime de exercicios.',
      }));
    }
  };

  return {
    name: 'exercise-runtime-api',
    configureServer(server) {
      server.middlewares.use(handleRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleRequest);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ROOT_DIR, '');

  return {
    plugins: [exerciseRuntimePlugin(env)],
  };
});