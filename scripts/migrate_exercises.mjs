import fs from 'fs';
import path from 'path';

// Configurações (Caminhos relativos ao diretório do projeto)
const GITHUB_PATH = 'src/data/exercises_github.json';
const RAPID_PATH  = 'src/data/exercises_rapid.json';
const OUTPUT_PATH = 'src/data/exercises_pt.json';

// Dicionário de Tradução (v105 Robusto)
const TERMS_PT = {
  'bench press': 'supino', 'squat': 'agachamento', 'deadlift': 'levantamento terra',
  'bicep curl': 'rosca bíceps', 'pushup': 'flexão', 'pullup': 'barra fixa',
  'shoulder press': 'desenvolvimento', 'abs': 'abdômen', 'ab machine': 'máquina de abdominal',
  'triceps': 'tríceps', 'biceps': 'bíceps', 'glutes': 'glúteos', 'legs': 'pernas',
  'arms': 'braços', 'back': 'costas', 'chest': 'peito', 'shoulders': 'ombros',
  'feet': 'pés', 'hands': 'mãos', 'weight': 'peso', 'resistance': 'resistência'
};

const RULES_PT = [
  [/\bSelect a light resistance and sit down\b/gi, 'Selecione uma resistência leve e sente-se'],
  [/\bLie down on the floor\b/gi, 'Deite-se no chão'],
  [/\bThis will be your starting position\b/gi, 'Esta será sua posição inicial'],
  [/\bPlace your hands\b/gi, 'Coloque suas mãos'],
  [/\bGrabbing the top handles\b/gi, 'Segurando as alças superiores'],
  [/\bPlacing your feet under the pads\b/gi, 'Posicionando seus pés sob as almofadas'],
  [/\bRest the triceps on the pads\b/gi, 'Apoie os tríceps nas almofadas'],
  [/\bBegin to lift the legs up\b/gi, 'Comece a elevar as pernas'],
  [/\bCrunch your upper torso\b/gi, 'Flexione o tronco superior'],
  [/\bSlowly lower the weight\b/gi, 'Baixe o peso lentamente'],
  [/\bReturn to the starting position\b/gi, 'Retorne para a posição inicial'],
  [/\bBreathe out as you perform this movement\b/gi, 'Expire ao realizar este movimento'],
  [/\bRepeat for the recommended amount of repetitions\b/gi, 'Repita o número recomendado de repetições'],
  [/\bRepeat for the prescribed amount of repetitions\b/gi, 'Repita o número prescrito de repetições'],
  [/\bbent at a 90 degree angle\b/gi, 'dobrados em um ângulo de 90 graus'],
  [/\bon the\b/gi, 'no/na'], [/\bwith the\b/gi, 'com o/a'], [/\bunder the\b/gi, 'sob o/a'],
  [/\bYour\b/gi, 'Seus/Suas']
];

const MUSCLE_PT = {
  abdominals: 'Abdominais', hamstrings: 'Posteriores', calves: 'Panturrilha',
  shoulders: 'Ombros', adductors: 'Adutores', glutes: 'Glúteos',
  quadriceps: 'Quadríceps', biceps: 'Bíceps', triceps: 'Tríceps',
  forearms: 'Antebraço', neck: 'Pescoço', lats: 'Costas (Lats)',
  traps: 'Trapézio', middleback: 'Costas (Meio)', lowerback: 'Lombar',
  chest: 'Peito', abs: 'Abdominais', waist: 'Core/Lombar'
};

const EQUIP_PT = {
  barbell: 'Barra', dumbbell: 'Haltere', cable: 'Cabo',
  machine: 'Máquina', 'body weight': 'Peso Corporal', 'body only': 'Peso Corporal',
  kettlebells: 'Kettlebell', bands: 'Banda/Elástico', none: 'Peso Corporal'
};

function translateName(name) {
  if (!name) return '';
  let res = name.trim().toLowerCase();
  for (const [en, pt] of Object.entries(TERMS_PT)) {
    res = res.replace(new RegExp(`\\b${en}\\b`, 'gi'), pt);
  }
  return res.charAt(0).toUpperCase() + res.slice(1);
}

function translateInstructions(instructions) {
  if (!instructions) return [];
  return instructions.map(step => {
    let s = step;
    RULES_PT.forEach(([re, ptVal]) => s = s.replace(re, ptVal));
    for (const [en, ptVal] of Object.entries(TERMS_PT)) {
      s = s.replace(new RegExp(`\\b${en}s?\\b`, 'gi'), ptVal);
    }
    return s;
  });
}

function run() {
  const root = process.cwd();
  console.log(`Iniciando unificação em: ${root}`);

  const githubPath = path.join(root, GITHUB_PATH);
  const rapidPath  = path.join(root, RAPID_PATH);
  const outputPath = path.join(root, OUTPUT_PATH);

  if (!fs.existsSync(githubPath)) throw new Error(`Faltando: ${githubPath}`);
  if (!fs.existsSync(rapidPath))  throw new Error(`Faltando: ${rapidPath}`);

  const githubRaw = JSON.parse(fs.readFileSync(githubPath, 'utf8'));
  const rapidRaw  = JSON.parse(fs.readFileSync(rapidPath, 'utf8'));

  const merged = new Map();

  // 1. Processa GitHub (Base Estável)
  githubRaw.forEach(ex => {
    const namePT = translateName(ex.name);
    merged.set(namePT.toLowerCase(), {
      id: ex.id,
      name: namePT,
      equipment: EQUIP_PT[ex.equipment] || ex.equipment,
      category: ex.category,
      level: ex.level,
      primaryMuscles: (ex.primaryMuscles || []).map(m => MUSCLE_PT[m] || m),
      secondaryMuscles: (ex.secondaryMuscles || []).map(m => MUSCLE_PT[m] || m),
      instructions: translateInstructions(ex.instructions),
      images: [`${ex.id}/0.jpg`, `${ex.id}/1.jpg`],
      type: 'static'
    });
  });

  // 2. Processa RapidAPI (Animações GIFs)
  rapidRaw.forEach(ex => {
    const namePT = translateName(ex.name);
    const key = namePT.toLowerCase();
    const gifUrl = `https://raw.githubusercontent.com/exercisedb/exercisedb.github.io/main/exercises/${ex.id}.gif`;

    if (merged.has(key)) {
      const existing = merged.get(key);
      existing.images = [gifUrl].concat(existing.images);
      existing.type   = 'animated';
    } else {
      merged.set(key, {
        id: ex.id,
        name: namePT,
        equipment: EQUIP_PT[ex.equipment] || ex.equipment,
        category: ex.bodyPart,
        level: 'intermediate',
        primaryMuscles: [MUSCLE_PT[ex.target] || ex.target].concat((ex.secondaryMuscles || []).map(m => MUSCLE_PT[m] || m)),
        secondaryMuscles: (ex.secondaryMuscles || []).map(m => MUSCLE_PT[m] || m),
        instructions: translateInstructions(ex.instructions),
        images: [gifUrl],
        type: 'animated'
      });
    }
  });

  const finalList = Array.from(merged.values());
  console.log(`Sucesso: ${finalList.length} exercícios unidos.`);

  fs.writeFileSync(outputPath, JSON.stringify(finalList, null, 2));
  console.log(`Mix gerado em: ${outputPath}`);
}

run();
