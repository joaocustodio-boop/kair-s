import fs from 'fs';
import https from 'https';
import path from 'path';

const GITHUB_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const RAPID_BASE = 'https://exercisedb.p.rapidapi.com/exercises?limit=10&offset=';
const RAPIDAPI_KEY = process.env.EXERCISEDB_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY || '';
const RAPID_HEADERS = {
  'x-rapidapi-host': 'exercisedb.p.rapidapi.com',
  'x-rapidapi-key': RAPIDAPI_KEY,
};

async function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}

async function run() {
  const dir = 'src/data';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  try {
    console.log('Baixando GitHub (Base)...');
    const github = await fetchJSON(GITHUB_URL);
    fs.writeFileSync(path.join(dir, 'exercises_github.json'), JSON.stringify(github));

    if (!RAPIDAPI_KEY) {
      console.log('Chave da RapidAPI ausente. Pulando download da amostra RapidAPI.');
      return;
    }

    console.log('Baixando RapidAPI (Amostra de 100 exercícios para o Mix)...');
    let rapidFull = [];
    for (let i = 0; i < 100; i += 10) {
      console.log(`Buscando offset ${i}...`);
      const chunk = await fetchJSON(`${RAPID_BASE}${i}`, RAPID_HEADERS);
      if (Array.isArray(chunk)) rapidFull = rapidFull.concat(chunk);
      // Pequeno delay para evitar rate limit
      await new Promise(r => setTimeout(r, 500));
    }
    fs.writeFileSync(path.join(dir, 'exercises_rapid.json'), JSON.stringify(rapidFull));

    console.log('Dados baixados com sucesso.');
  } catch (err) {
    console.error('Falha no download:', err.message);
  }
}

run();
