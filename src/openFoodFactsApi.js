const OFF_BASE_URL = 'https://world.openfoodfacts.org';
const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const USDA_DEMO_KEY = 'DEMO_KEY';
const WGER_BASE_URL = 'https://wger.de/api/v2/ingredient/';

// ── Base de dados local de alimentos brasileiros comuns ────────────
// Dados nutricionais por 100 g baseados na Tabela TACO (UNICAMP).
const LOCAL_FOODS_BR = [
  { emoji: '🍚', aliases: ['arroz branco', 'arroz cozido', 'arroz'], name: 'Arroz branco cozido', kcal100g: 128, protein100g: 2.5, carbs100g: 28.0, fat100g: 0.2 },
  { emoji: '🍚', aliases: ['arroz integral', 'arroz integral cozido'], name: 'Arroz integral cozido', kcal100g: 124, protein100g: 2.6, carbs100g: 25.8, fat100g: 1.0 },
  { emoji: '🫘', aliases: ['feijao preto', 'feijao cozido'], name: 'Feijão preto cozido', kcal100g: 77, protein100g: 4.5, carbs100g: 14.0, fat100g: 0.5 },
  { emoji: '🫘', aliases: ['feijao carioca', 'feijao mulatinho', 'feijao'], name: 'Feijão carioca cozido', kcal100g: 76, protein100g: 4.8, carbs100g: 13.6, fat100g: 0.5 },
  { emoji: '🫘', aliases: ['feijao verde', 'feijao vagem'], name: 'Feijão verde cozido', kcal100g: 31, protein100g: 1.8, carbs100g: 5.7, fat100g: 0.2 },
  { emoji: '🥚', aliases: ['ovo cozido', 'ovo mexido', 'ovo', 'ovo de galinha', 'ovo inteiro'], name: 'Ovo inteiro cozido', kcal100g: 143, protein100g: 13.0, carbs100g: 0.7, fat100g: 9.5 },
  { emoji: '🥚', aliases: ['clara de ovo', 'clara'], name: 'Clara de ovo', kcal100g: 52, protein100g: 10.9, carbs100g: 0.7, fat100g: 0.2 },
  { emoji: '🥚', aliases: ['gema de ovo', 'gema'], name: 'Gema de ovo', kcal100g: 319, protein100g: 15.9, carbs100g: 0.6, fat100g: 27.7 },
  { emoji: '🍗', aliases: ['peito de frango', 'peito frango', 'frango grelhado', 'frango'], name: 'Peito de frango grelhado', kcal100g: 159, protein100g: 32.0, carbs100g: 0.0, fat100g: 3.5 },
  { emoji: '🍗', aliases: ['frango cozido', 'frango assado', 'frango ao forno'], name: 'Frango cozido', kcal100g: 187, protein100g: 28.5, carbs100g: 0.0, fat100g: 7.5 },
  { emoji: '🥩', aliases: ['carne moida', 'carne bovina', 'carne'], name: 'Carne bovina moída refogada', kcal100g: 219, protein100g: 20.0, carbs100g: 0.0, fat100g: 15.0 },
  { emoji: '🥩', aliases: ['picanha', 'contrafile', 'alcatra'], name: 'Picanha grelhada', kcal100g: 259, protein100g: 24.0, carbs100g: 0.0, fat100g: 17.5 },
  { emoji: '🐟', aliases: ['peixe grelhado', 'file de peixe', 'peixe'], name: 'Peixe grelhado', kcal100g: 120, protein100g: 22.0, carbs100g: 0.0, fat100g: 3.5 },
  { emoji: '🐟', aliases: ['salmao', 'salmao grelhado', 'salmão'], name: 'Salmão grelhado', kcal100g: 206, protein100g: 28.0, carbs100g: 0.0, fat100g: 10.0 },
  { emoji: '🐟', aliases: ['atum', 'atum em lata', 'atum natural'], name: 'Atum em lata (ao natural)', kcal100g: 132, protein100g: 28.0, carbs100g: 0.0, fat100g: 1.0 },
  { emoji: '🐟', aliases: ['tilapia', 'tilápia'], name: 'Tilápia grelhada', kcal100g: 96, protein100g: 20.1, carbs100g: 0.0, fat100g: 1.7 },
  { emoji: '🍞', aliases: ['pao frances', 'paezinho', 'pao'], name: 'Pão francês', kcal100g: 300, protein100g: 8.5, carbs100g: 58.0, fat100g: 3.0 },
  { emoji: '🍞', aliases: ['pao integral', 'pao de forma integral'], name: 'Pão integral', kcal100g: 243, protein100g: 8.0, carbs100g: 45.0, fat100g: 3.5 },
  { emoji: '🧀', aliases: ['pao de queijo'], name: 'Pão de queijo', kcal100g: 331, protein100g: 5.5, carbs100g: 40.0, fat100g: 17.0 },
  { emoji: '🫓', aliases: ['tapioca'], name: 'Tapioca pronta', kcal100g: 133, protein100g: 0.5, carbs100g: 32.0, fat100g: 0.1 },
  { emoji: '🌽', aliases: ['cuscuz nordestino', 'cuscuz'], name: 'Cuscuz cozido', kcal100g: 108, protein100g: 2.5, carbs100g: 23.0, fat100g: 0.5 },
  { emoji: '🍝', aliases: ['macarrao cozido', 'macarrao', 'massa', 'espaguete'], name: 'Macarrão cozido', kcal100g: 131, protein100g: 4.5, carbs100g: 27.0, fat100g: 0.5 },
  { emoji: '🍠', aliases: ['batata doce cozida', 'batata doce'], name: 'Batata doce cozida', kcal100g: 77, protein100g: 1.4, carbs100g: 18.4, fat100g: 0.1 },
  { emoji: '🥔', aliases: ['batata inglesa', 'batata cozida', 'batata'], name: 'Batata inglesa cozida', kcal100g: 56, protein100g: 1.2, carbs100g: 13.0, fat100g: 0.1 },
  { emoji: '🍟', aliases: ['batata frita', 'fritas', 'chips'], name: 'Batata frita', kcal100g: 312, protein100g: 3.5, carbs100g: 38.0, fat100g: 17.0 },
  { emoji: '🌿', aliases: ['mandioca', 'aipim', 'macaxeira'], name: 'Mandioca cozida', kcal100g: 125, protein100g: 0.6, carbs100g: 30.0, fat100g: 0.3 },
  { emoji: '🥛', aliases: ['leite integral', 'leite'], name: 'Leite integral', kcal100g: 61, protein100g: 3.2, carbs100g: 4.8, fat100g: 3.5 },
  { emoji: '🥛', aliases: ['leite desnatado'], name: 'Leite desnatado', kcal100g: 35, protein100g: 3.4, carbs100g: 5.0, fat100g: 0.1 },
  { emoji: '🥛', aliases: ['leite semidesnatado'], name: 'Leite semidesnatado', kcal100g: 46, protein100g: 3.3, carbs100g: 5.0, fat100g: 1.5 },
  { emoji: '🥣', aliases: ['iogurte natural', 'iogurte'], name: 'Iogurte natural', kcal100g: 61, protein100g: 3.5, carbs100g: 4.7, fat100g: 3.3 },
  { emoji: '🥣', aliases: ['iogurte grego'], name: 'Iogurte grego', kcal100g: 97, protein100g: 9.0, carbs100g: 4.0, fat100g: 5.0 },
  { emoji: '🧀', aliases: ['queijo mussarela', 'mussarela', 'mozzarella'], name: 'Queijo mussarela', kcal100g: 280, protein100g: 22.0, carbs100g: 2.0, fat100g: 22.0 },
  { emoji: '🧀', aliases: ['queijo prato', 'queijo coalho', 'queijo'], name: 'Queijo prato', kcal100g: 358, protein100g: 22.0, carbs100g: 2.0, fat100g: 29.0 },
  { emoji: '🧀', aliases: ['requeijao'], name: 'Requeijão cremoso', kcal100g: 218, protein100g: 8.5, carbs100g: 3.3, fat100g: 19.5 },
  { emoji: '🥓', aliases: ['presunto', 'presunto cozido'], name: 'Presunto cozido', kcal100g: 145, protein100g: 15.0, carbs100g: 2.0, fat100g: 8.0 },
  { emoji: '🦃', aliases: ['peito de peru', 'peru'], name: 'Peito de peru', kcal100g: 109, protein100g: 16.0, carbs100g: 2.0, fat100g: 4.0 },
  { emoji: '🌭', aliases: ['linguica', 'salsicha'], name: 'Linguiça de porco', kcal100g: 248, protein100g: 15.0, carbs100g: 1.0, fat100g: 21.0 },
  { emoji: '🍌', aliases: ['banana', 'banana nanica'], name: 'Banana nanica', kcal100g: 89, protein100g: 1.1, carbs100g: 23.0, fat100g: 0.3 },
  { emoji: '🍌', aliases: ['banana prata'], name: 'Banana prata', kcal100g: 98, protein100g: 1.3, carbs100g: 26.0, fat100g: 0.1 },
  { emoji: '🍎', aliases: ['maca', 'maçã'], name: 'Maçã', kcal100g: 52, protein100g: 0.3, carbs100g: 14.0, fat100g: 0.2 },
  { emoji: '🍊', aliases: ['laranja', 'laranja lima', 'laranja pera'], name: 'Laranja', kcal100g: 47, protein100g: 0.9, carbs100g: 12.0, fat100g: 0.1 },
  { emoji: '🍊', aliases: ['suco de laranja', 'suco laranja', 'suco de laranja natural'], name: 'Suco de laranja natural', kcal100g: 45, protein100g: 0.7, carbs100g: 10.4, fat100g: 0.2 },
  { emoji: '🍈', aliases: ['mamao', 'mamão', 'mamao papaia', 'papaia'], name: 'Mamão papaia', kcal100g: 40, protein100g: 0.6, carbs100g: 10.8, fat100g: 0.2 },
  { emoji: '🥭', aliases: ['manga'], name: 'Manga tommy', kcal100g: 65, protein100g: 0.5, carbs100g: 17.0, fat100g: 0.3 },
  { emoji: '🍍', aliases: ['abacaxi'], name: 'Abacaxi', kcal100g: 48, protein100g: 0.5, carbs100g: 12.5, fat100g: 0.1 },
  { emoji: '🍇', aliases: ['uva', 'uva italia'], name: 'Uva', kcal100g: 69, protein100g: 0.7, carbs100g: 18.0, fat100g: 0.2 },
  { emoji: '🍓', aliases: ['morango'], name: 'Morango', kcal100g: 32, protein100g: 0.7, carbs100g: 7.7, fat100g: 0.3 },
  { emoji: '🍈', aliases: ['melao', 'melancia'], name: 'Melão', kcal100g: 29, protein100g: 0.7, carbs100g: 7.5, fat100g: 0.1 },
  { emoji: '🥑', aliases: ['abacate'], name: 'Abacate', kcal100g: 96, protein100g: 1.2, carbs100g: 6.0, fat100g: 8.4 },
  { emoji: '🥥', aliases: ['coco', 'coco seco', 'coco ralado'], name: 'Coco seco ralado', kcal100g: 354, protein100g: 3.4, carbs100g: 15.0, fat100g: 33.5 },
  { emoji: '🌾', aliases: ['aveia', 'aveia em flocos', 'farinha de aveia'], name: 'Aveia em flocos', kcal100g: 389, protein100g: 17.0, carbs100g: 66.0, fat100g: 7.0 },
  { emoji: '🥣', aliases: ['granola'], name: 'Granola', kcal100g: 471, protein100g: 11.0, carbs100g: 64.0, fat100g: 20.0 },
  { emoji: '🥜', aliases: ['amendoim', 'pasta de amendoim', 'manteiga de amendoim'], name: 'Amendoim torrado', kcal100g: 567, protein100g: 26.0, carbs100g: 17.0, fat100g: 49.0 },
  { emoji: '🌰', aliases: ['castanha do para', 'castanha do pará', 'castanha'], name: 'Castanha do Pará', kcal100g: 656, protein100g: 14.3, carbs100g: 12.3, fat100g: 66.4 },
  { emoji: '🌰', aliases: ['castanha de caju', 'caju'], name: 'Castanha de caju torrada', kcal100g: 570, protein100g: 15.3, carbs100g: 32.7, fat100g: 46.4 },
  { emoji: '🌰', aliases: ['nozes'], name: 'Nozes', kcal100g: 654, protein100g: 15.0, carbs100g: 14.0, fat100g: 65.0 },
  { emoji: '🌰', aliases: ['amendoas', 'amêndoas'], name: 'Amêndoas', kcal100g: 579, protein100g: 21.2, carbs100g: 21.6, fat100g: 49.9 },
  { emoji: '🫒', aliases: ['azeite', 'azeite de oliva', 'azeite extra virgem'], name: 'Azeite de oliva', kcal100g: 884, protein100g: 0.0, carbs100g: 0.0, fat100g: 100.0 },
  { emoji: '🫙', aliases: ['oleo de coco', 'oleo de girassol', 'oleo vegetal', 'oleo'], name: 'Óleo vegetal', kcal100g: 884, protein100g: 0.0, carbs100g: 0.0, fat100g: 100.0 },
  { emoji: '🧈', aliases: ['manteiga', 'manteiga sem sal'], name: 'Manteiga', kcal100g: 717, protein100g: 0.5, carbs100g: 0.1, fat100g: 81.0 },
  { emoji: '🧈', aliases: ['margarina'], name: 'Margarina', kcal100g: 533, protein100g: 0.1, carbs100g: 0.2, fat100g: 59.0 },
  { emoji: '🍬', aliases: ['acucar', 'acúcar', 'acucar refinado', 'acucar cristal'], name: 'Açúcar refinado', kcal100g: 387, protein100g: 0.0, carbs100g: 99.9, fat100g: 0.0 },
  { emoji: '🍯', aliases: ['mel puro', 'mel'], name: 'Mel puro', kcal100g: 304, protein100g: 0.3, carbs100g: 82.4, fat100g: 0.0 },
  { emoji: '☕', aliases: ['cafe preto', 'cafe', 'café'], name: 'Café preto s/ açúcar', kcal100g: 2, protein100g: 0.3, carbs100g: 0.0, fat100g: 0.1 },
  { emoji: '🍵', aliases: ['cha verde', 'cha preto', 'cha sem acucar', 'cha'], name: 'Chá sem açúcar', kcal100g: 1, protein100g: 0.0, carbs100g: 0.2, fat100g: 0.0 },
  { emoji: '🍫', aliases: ['chocolate amargo', 'chocolate 70%', 'chocolate meio amargo'], name: 'Chocolate amargo 70%', kcal100g: 598, protein100g: 7.8, carbs100g: 46.0, fat100g: 43.0 },
  { emoji: '🍫', aliases: ['chocolate ao leite', 'chocolate'], name: 'Chocolate ao leite', kcal100g: 535, protein100g: 7.7, carbs100g: 59.0, fat100g: 30.0 },
  { emoji: '🥤', aliases: ['refrigerante', 'coca', 'coca cola', 'guarana', 'pepsi'], name: 'Refrigerante', kcal100g: 41, protein100g: 0.0, carbs100g: 10.6, fat100g: 0.0 },
  { emoji: '🍺', aliases: ['cerveja', 'cerveja gelada'], name: 'Cerveja (long neck)', kcal100g: 43, protein100g: 0.5, carbs100g: 3.5, fat100g: 0.0 },
  { emoji: '💪', aliases: ['whey protein', 'whey'], name: 'Whey Protein', kcal100g: 373, protein100g: 80.0, carbs100g: 8.0, fat100g: 4.0 },
  { emoji: '🥕', aliases: ['cenoura crua', 'cenoura'], name: 'Cenoura crua', kcal100g: 41, protein100g: 0.9, carbs100g: 10.0, fat100g: 0.2 },
  { emoji: '🥦', aliases: ['brocolis', 'brócolis', 'brocoles'], name: 'Brócolis cozido', kcal100g: 34, protein100g: 2.8, carbs100g: 7.0, fat100g: 0.4 },
  { emoji: '🥬', aliases: ['espinafre', 'espinafre cozido'], name: 'Espinafre cozido', kcal100g: 23, protein100g: 2.9, carbs100g: 3.6, fat100g: 0.4 },
  { emoji: '🥬', aliases: ['alface', 'alface americana', 'alface crespa'], name: 'Alface', kcal100g: 14, protein100g: 1.3, carbs100g: 2.6, fat100g: 0.2 },
  { emoji: '🍅', aliases: ['tomate', 'tomate salada', 'tomate cereja'], name: 'Tomate', kcal100g: 18, protein100g: 0.9, carbs100g: 3.9, fat100g: 0.2 },
  { emoji: '🥒', aliases: ['pepino', 'pepino japones'], name: 'Pepino', kcal100g: 16, protein100g: 0.7, carbs100g: 3.6, fat100g: 0.1 },
  { emoji: '🧅', aliases: ['cebola', 'cebola branca', 'cebola roxa'], name: 'Cebola', kcal100g: 40, protein100g: 1.1, carbs100g: 9.3, fat100g: 0.1 },
  { emoji: '🧄', aliases: ['alho', 'alho inteiro'], name: 'Alho', kcal100g: 149, protein100g: 6.4, carbs100g: 33.1, fat100g: 0.5 },
  { emoji: '🌽', aliases: ['milho verde', 'milho cozido', 'milho'], name: 'Milho verde cozido', kcal100g: 86, protein100g: 3.3, carbs100g: 19.0, fat100g: 1.2 },
  { emoji: '🫛', aliases: ['ervilha', 'ervilha cozida'], name: 'Ervilha cozida', kcal100g: 84, protein100g: 5.4, carbs100g: 15.6, fat100g: 0.4 },
  { emoji: '🫘', aliases: ['lentilha', 'lentilha cozida'], name: 'Lentilha cozida', kcal100g: 116, protein100g: 9.0, carbs100g: 20.1, fat100g: 0.4 },
  { emoji: '🫘', aliases: ['grao de bico', 'grao-de-bico', 'grão de bico'], name: 'Grão-de-bico cozido', kcal100g: 164, protein100g: 8.9, carbs100g: 27.0, fat100g: 2.6 },
  { emoji: '🫙', aliases: ['tofu'], name: 'Tofu', kcal100g: 76, protein100g: 8.1, carbs100g: 1.9, fat100g: 4.2 },
  { emoji: '🧃', aliases: ['suco de caixinha', 'necto', 'del valle', 'suco de uva'], name: 'Suco de caixinha (néctar)', kcal100g: 54, protein100g: 0.0, carbs100g: 13.5, fat100g: 0.0 },
  { emoji: '🥤', aliases: ['vitamina de banana', 'vitamina de fruta', 'vitamina'], name: 'Vitamina de banana com leite', kcal100g: 72, protein100g: 2.8, carbs100g: 14.0, fat100g: 0.9 },
  { emoji: '🍇', aliases: ['acai', 'açaí na tigela', 'acai com granola'], name: 'Açaí com granola', kcal100g: 160, protein100g: 2.5, carbs100g: 26.0, fat100g: 5.5 },
  { emoji: '🍕', aliases: ['pizza', 'fatia de pizza'], name: 'Pizza (fatia média)', kcal100g: 270, protein100g: 11.0, carbs100g: 33.0, fat100g: 10.0 },
  { emoji: '🍔', aliases: ['hamburguer', 'hamburger', 'lanche'], name: 'Hambúrguer simples', kcal100g: 295, protein100g: 17.0, carbs100g: 24.0, fat100g: 14.0 },
  { emoji: '🍳', aliases: ['omelete', 'omelette'], name: 'Omelete simples', kcal100g: 154, protein100g: 10.5, carbs100g: 0.5, fat100g: 12.0 },
  { emoji: '🍲', aliases: ['sopa de legumes', 'sopa', 'caldo'], name: 'Sopa de legumes', kcal100g: 35, protein100g: 1.5, carbs100g: 6.5, fat100g: 0.5 },
  { emoji: '🍑', aliases: ['fruta', 'frutas'], name: 'Frutas (média geral)', kcal100g: 55, protein100g: 0.7, carbs100g: 14.0, fat100g: 0.2 },
];

// ── Mapa de emoji por palavras-chave (para itens de APIs externas) ──
const EMOJI_RULES = [
  [/pizza/i, '🍕'],
  [/hambur|lanche|burger/i, '🍔'],
  [/hot.?dog|cachorro|salsicha|linguica/i, '🌭'],
  [/frango|chicken|poultry/i, '🍗'],
  [/peixe|fish|salmao|salmon|atum|tuna|tilapia/i, '🐟'],
  [/camarao|shrimp|marisco|seafood/i, '🦐'],
  [/carne|beef|steak|alcatra|picanha|contrafile/i, '🥩'],
  [/bacon|presunto|ham|peito de peru/i, '🥓'],
  [/ovo|egg/i, '🥚'],
  [/leite|milk/i, '🥛'],
  [/iogurte|yogurt/i, '🥣'],
  [/queijo|cheese|requeijao/i, '🧀'],
  [/manteiga|butter/i, '🧈'],
  [/pao|bread|torrada|toast|tapioca/i, '🍞'],
  [/bolo|cake|cupcake/i, '🎂'],
  [/biscoito|cookie|bolacha/i, '🍪'],
  [/chocolate/i, '🍫'],
  [/sorvete|ice.?cream/i, '🍦'],
  [/doce|candy|goma/i, '🍬'],
  [/mel\b|honey/i, '🍯'],
  [/macarrao|pasta|espaguete|lasanha|noodle/i, '🍝'],
  [/arroz|rice/i, '🍚'],
  [/feijao|bean|lentilha|grao.de.bico|ervilha/i, '🫘'],
  [/sopa|soup|caldo/i, '🍲'],
  [/salada|salad/i, '🥗'],
  [/batata frita|french fry|chips/i, '🍟'],
  [/batata doce|sweet potato/i, '🍠'],
  [/batata|potato/i, '🥔'],
  [/mandioca|aipim|macaxeira|cassava/i, '🌿'],
  [/aveia|oat|granola|cereal/i, '🌾'],
  [/banana/i, '🍌'],
  [/maca|apple/i, '🍎'],
  [/pera|pear/i, '🍐'],
  [/laranja|orange/i, '🍊'],
  [/limao|lemon|lime/i, '🍋'],
  [/morango|strawberry/i, '🍓'],
  [/uva|grape|acai/i, '🍇'],
  [/melancia|watermelon/i, '🍉'],
  [/melao|melon/i, '🍈'],
  [/manga|mango/i, '🥭'],
  [/abacaxi|pineapple/i, '🍍'],
  [/coco|coconut/i, '🥥'],
  [/abacate|avocado/i, '🥑'],
  [/mamao|papaya/i, '🍈'],
  [/amendoim|peanut|castanha|nozes|amendoa|nut/i, '🥜'],
  [/azeite|olive.?oil/i, '🫒'],
  [/oleo|oil/i, '🫙'],
  [/acucar|sugar/i, '🍬'],
  [/cafe|coffee|espresso/i, '☕'],
  [/cha\b|tea/i, '🍵'],
  [/suco|juice|vitamina/i, '🧃'],
  [/refrigerante|soda|coca|guarana|pepsi/i, '🥤'],
  [/cerveja|beer/i, '🍺'],
  [/vinho|wine/i, '🍷'],
  [/agua|water/i, '💧'],
  [/whey|protein|suplemento/i, '💪'],
  [/cenoura|carrot/i, '🥕'],
  [/brocolis|broccoli/i, '🥦'],
  [/espinafre|spinach|alface|lettuce/i, '🥬'],
  [/tomate|tomato/i, '🍅'],
  [/pepino|cucumber/i, '🥒'],
  [/cebola|onion/i, '🧅'],
  [/alho|garlic/i, '🧄'],
  [/milho|corn/i, '🌽'],
  [/cogumelo|mushroom/i, '🍄'],
  [/tofu|soja|soy/i, '🫙'],
];

export function resolveEmojiForFood(name) {
  const s = String(name || '');
  for (const [pattern, emoji] of EMOJI_RULES) {
    if (pattern.test(s)) return emoji;
  }
  return '🍽️';
}

const PRODUCT_FIELDS = [
  'code',
  'product_name',
  'generic_name',
  'brands',
  'quantity',
  'image_front_thumb_url',
  'image_front_small_url',
  'image_front_url',
  'image_small_url',
  'image_url',
  'countries_tags',
  'nutriscore_grade',
  'nova_group',
  'ecoscore_grade',
  'nutriments',
];

function toSafeString(value) {
  return String(value || '').trim();
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeNutriScore(value) {
  const grade = toSafeString(value).toUpperCase();
  return /^[A-E]$/.test(grade) ? grade : null;
}

function resolveImage(product) {
  return product?.image_front_small_url
    || product?.image_front_thumb_url
    || product?.image_front_url
    || product?.image_small_url
    || product?.image_url
    || '';
}

function resolveName(product) {
  return toSafeString(product?.product_name)
    || toSafeString(product?.generic_name)
    || 'Produto sem nome';
}

function mapProduct(product) {
  const nutriments = product?.nutriments || {};

  return {
    code: toSafeString(product?.code),
    name: resolveName(product),
    brand: toSafeString(product?.brands),
    quantity: toSafeString(product?.quantity),
    imageUrl: resolveImage(product),
    emoji: resolveEmojiForFood(resolveName(product)),
    countries: Array.isArray(product?.countries_tags) ? product.countries_tags : [],
    nutriScore: normalizeNutriScore(product?.nutriscore_grade),
    novaGroup: toNumber(product?.nova_group),
    ecoScore: toSafeString(product?.ecoscore_grade).toUpperCase() || null,
    source: 'Open Food Facts',
    nutriments: {
      kcal100g: toNumber(nutriments['energy-kcal_100g']),
      protein100g: toNumber(nutriments.proteins_100g),
      carbs100g: toNumber(nutriments.carbohydrates_100g),
      fat100g: toNumber(nutriments.fat_100g),
      sugar100g: toNumber(nutriments.sugars_100g),
      fiber100g: toNumber(nutriments.fiber_100g),
      sodium100g: toNumber(nutriments.sodium_100g),
    },
  };
}

function normalizePtQuery(query) {
  return String(query || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function translateQueryPtToEn(rawQuery) {
  const normalized = normalizePtQuery(rawQuery);
  const dictionary = {
    integral: 'whole',
    desnatado: 'skim',
    desnatada: 'skim',
    semidesnatado: 'semi skimmed',
    semidesnatada: 'semi skimmed',
    natural: 'natural',
    zero: 'zero',
    sem: 'without',
    com: 'with',
    de: '',
    da: '',
    do: '',
    para: '',
    arroz: 'rice',
    feijao: 'beans',
    lentilha: 'lentil',
    grao: 'grain',
    bico: 'chickpea',
    frango: 'chicken',
    carne: 'beef',
    porco: 'pork',
    peixe: 'fish',
    salmao: 'salmon',
    atum: 'tuna',
    leite: 'milk',
    pao: 'bread',
    torrada: 'toast',
    biscoito: 'cookie',
    bolacha: 'cookie',
    iogurte: 'yogurt',
    banana: 'banana',
    maca: 'apple',
    pera: 'pear',
    morango: 'strawberry',
    uva: 'grape',
    laranja: 'orange',
    aveia: 'oats',
    ovo: 'egg',
    queijo: 'cheese',
    presunto: 'ham',
    peito: 'breast',
    peru: 'turkey',
    batata: 'potato',
    batata_doce: 'sweet potato',
    mandioca: 'cassava',
    aipim: 'cassava',
    macarrao: 'pasta',
    tomate: 'tomato',
    alface: 'lettuce',
    cenoura: 'carrot',
    brocolis: 'broccoli',
    espinafre: 'spinach',
    acucar: 'sugar',
    mel: 'honey',
    cafe: 'coffee',
    cha: 'tea',
    chocolate: 'chocolate',
    amendoim: 'peanut',
    castanha: 'nut',
    nozes: 'walnut',
    azeite: 'olive oil',
    oleo: 'oil',
    manteiga: 'butter',
    margarina: 'margarine',
    refrigerante: 'soda',
    suco: 'juice',
    agua: 'water',
    coco: 'coconut',
  };

  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => dictionary[word] ?? word)
    .filter(Boolean)
    .join(' ')
    .trim();
}

function buildUsdaQueries(rawQuery) {
  const original = toSafeString(rawQuery);
  const normalized = normalizePtQuery(original).replace(/\s+/g, ' ').trim();
  const translated = translateQueryPtToEn(original);

  const candidates = [original, normalized, translated]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return [...new Set(candidates)];
}

function getUsdaNutrient(nutrients, names) {
  if (!Array.isArray(nutrients)) return null;
  const found = nutrients.find((nut) => names.includes(String(nut?.nutrientName || '').toLowerCase()));
  const value = Number(found?.value);
  return Number.isFinite(value) ? value : null;
}

function mapUsdaProduct(food) {
  const nutrients = Array.isArray(food?.foodNutrients) ? food.foodNutrients : [];
  const servingSize = Number(food?.servingSize);
  const servingUnit = String(food?.servingSizeUnit || '').trim();

  return {
    code: String(food?.gtinUpc || food?.fdcId || '').trim(),
    name: String(food?.description || '').trim() || 'Produto sem nome',
    brand: String(food?.brandOwner || food?.brandName || '').trim(),
    quantity: Number.isFinite(servingSize) ? `${servingSize}${servingUnit ? ` ${servingUnit}` : ''}` : '',
    imageUrl: '',
    emoji: resolveEmojiForFood(String(food?.description || '')),
    countries: [],
    nutriScore: null,
    novaGroup: null,
    ecoScore: null,
    source: 'USDA',
    nutriments: {
      kcal100g: getUsdaNutrient(nutrients, ['energy']),
      protein100g: getUsdaNutrient(nutrients, ['protein']),
      carbs100g: getUsdaNutrient(nutrients, ['carbohydrate, by difference']),
      fat100g: getUsdaNutrient(nutrients, ['total lipid (fat)']),
      sugar100g: getUsdaNutrient(nutrients, ['sugars, total including nlea']),
      fiber100g: getUsdaNutrient(nutrients, ['fiber, total dietary']),
      sodium100g: getUsdaNutrient(nutrients, ['sodium, na']),
    },
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Food API HTTP ${response.status}`);
  }

  return response.json();
}

async function searchByBarcode(code) {
  const url = `${OFF_BASE_URL}/api/v2/product/${encodeURIComponent(code)}.json?fields=${PRODUCT_FIELDS.join(',')}`;
  const data = await fetchJson(url);
  if (data?.status !== 1 || !data?.product) return null;
  return mapProduct(data.product);
}

async function enrichMissingImagesWithOff(products) {
  const list = Array.isArray(products) ? products : [];
  const needsImage = list.filter((item) => !item?.imageUrl && /^\d{8,14}$/.test(String(item?.code || '')));

  if (!needsImage.length) return list;

  const imageByCode = new Map();

  await Promise.all(needsImage.map(async (item) => {
    try {
      const offProduct = await searchByBarcode(item.code);
      if (offProduct?.imageUrl) {
        imageByCode.set(item.code, offProduct.imageUrl);
      }
    } catch {
      // Silent fail: keeps result without image when OFF barcode lookup fails.
    }
  }));

  return list.map((item) => {
    const code = String(item?.code || '');
    const imageUrl = item?.imageUrl || imageByCode.get(code) || '';
    return imageUrl ? { ...item, imageUrl } : item;
  });
}

async function searchUsdaProducts(query, { page = 1, pageSize = 12 } = {}) {
  const trimmed = toSafeString(query);
  if (trimmed.length < 2) {
    return {
      products: [],
      count: 0,
      page,
      pageSize,
    };
  }

  const pageNumber = Math.max(1, Number(page) || 1);
  const size = Math.max(1, Math.min(50, Number(pageSize) || 12));

  const queries = buildUsdaQueries(trimmed);
  let data = null;
  let foods = [];

  for (const q of queries) {
    const params = new URLSearchParams({
      api_key: USDA_DEMO_KEY,
      query: q,
      pageNumber: String(pageNumber),
      pageSize: String(size),
      dataType: 'Branded,Foundation,Survey (FNDDS),SR Legacy',
    });
    data = await fetchJson(`${USDA_BASE_URL}?${params.toString()}`);
    foods = Array.isArray(data?.foods) ? data.foods : [];
    if (foods.length) break;
  }

  const mapped = foods.map(mapUsdaProduct);
  const enriched = await enrichMissingImagesWithOff(mapped);
  return {
    products: enriched,
    count: Number(data?.totalHits) || enriched.length,
    page,
    pageSize,
  };
}

// ── Busca na base de dados local (TACO / dados brasileiros) ────────
function searchLocalFoods(query, { page = 1, pageSize = 12 } = {}) {
  const norm = normalizePtQuery(String(query || ''));
  if (norm.length < 2) return { products: [], count: 0, page, pageSize };

  const matches = LOCAL_FOODS_BR.filter((entry) =>
    entry.aliases.some((alias) => {
      const aliasNorm = normalizePtQuery(alias);
      return aliasNorm.includes(norm) || norm.includes(aliasNorm);
    }),
  );

  const offset = (Math.max(1, page) - 1) * pageSize;
  const slice = matches.slice(offset, offset + pageSize);

  const products = slice.map((entry) => ({
    code: '',
    name: entry.name,
    brand: 'Base local (TACO)',
    quantity: '100g',
    imageUrl: '',
    emoji: entry.emoji || '🍽️',
    countries: ['br'],
    nutriScore: null,
    novaGroup: null,
    ecoScore: null,
    source: 'Local (TACO)',
    nutriments: {
      kcal100g: entry.kcal100g,
      protein100g: entry.protein100g ?? null,
      carbs100g: entry.carbs100g ?? null,
      fat100g: entry.fat100g ?? null,
      sugar100g: null,
      fiber100g: null,
      sodium100g: null,
    },
  }));

  return { products, count: matches.length, page, pageSize };
}

// ── Wger – plataforma open-source de treino/nutrição ───────────────
function mapWgerProduct(item) {
  const kcal = Number(item?.energy);
  return {
    code: String(item?.id || ''),
    name: String(item?.name || 'Alimento sem nome').trim(),
    brand: 'Wger',
    quantity: '100g',
    imageUrl: '',
    emoji: resolveEmojiForFood(String(item?.name || '')),
    countries: [],
    nutriScore: null,
    novaGroup: null,
    ecoScore: null,
    source: 'Wger',
    nutriments: {
      kcal100g: Number.isFinite(kcal) ? kcal : null,
      protein100g: toNumber(item?.protein),
      carbs100g: toNumber(item?.carbohydrates),
      fat100g: toNumber(item?.fat),
      sugar100g: toNumber(item?.sugar),
      fiber100g: toNumber(item?.fiber),
      sodium100g: toNumber(item?.sodium),
    },
  };
}

async function searchWgerProducts(query, { page = 1, pageSize = 12 } = {}) {
  const trimmed = toSafeString(query);
  if (trimmed.length < 2) return { products: [], count: 0, page, pageSize };

  // Wger usa idioma inglês — tentamos termo original e traduzido
  const queries = buildUsdaQueries(trimmed);
  let data = null;
  let results = [];

  for (const q of queries) {
    const params = new URLSearchParams({
      format: 'json',
      language: '2',
      name: q,
      limit: String(pageSize),
      offset: String((Math.max(1, page) - 1) * pageSize),
    });
    try {
      data = await fetchJson(`${WGER_BASE_URL}?${params.toString()}`);
      results = Array.isArray(data?.results) ? data.results : [];
      if (results.length) break;
    } catch {
      // Tenta próxima query se houver erro de rede.
    }
  }

  const products = results.map(mapWgerProduct);
  return { products, count: Number(data?.count) || products.length, page, pageSize };
}

export async function searchFoodProducts(query, { page = 1, pageSize = 12 } = {}) {
  const trimmed = toSafeString(query);
  if (trimmed.length < 2) {
    return {
      products: [],
      count: 0,
      page,
      pageSize,
    };
  }

  if (/^\d{8,14}$/.test(trimmed)) {
    try {
      const barcodeProduct = await searchByBarcode(trimmed);
      if (barcodeProduct) {
        return {
          products: [barcodeProduct],
          count: 1,
          page: 1,
          pageSize,
        };
      }
    } catch {
      // Falls back to general text search when barcode lookup is unavailable.
    }
  }

  const params = new URLSearchParams({
    search_terms: trimmed,
    search_simple: '1',
    action: 'process',
    json: '1',
    page: String(page),
    page_size: String(pageSize),
    fields: PRODUCT_FIELDS.join(','),
    lc: 'pt',
    cc: 'br',
    tagtype_0: 'countries',
    tag_contains_0: 'contains',
    tag_0: 'brazil',
  });

  const url = `${OFF_BASE_URL}/cgi/search.pl?${params.toString()}`;
  const data = await fetchJson(url);
  const mapped = Array.isArray(data?.products) ? data.products.map(mapProduct) : [];

  return {
    products: mapped,
    count: Number(data?.count) || mapped.length,
    page,
    pageSize,
  };
}

export async function searchFoodProductsWithFallback(
  query,
  { page = 1, pageSize = 12, provider = 'auto' } = {},
) {
  const selected = String(provider || 'auto').toLowerCase();

  if (selected === 'local') {
    return searchLocalFoods(query, { page, pageSize });
  }

  if (selected === 'off') {
    return searchFoodProducts(query, { page, pageSize });
  }

  if (selected === 'usda') {
    return searchUsdaProducts(query, { page, pageSize });
  }

  if (selected === 'wger') {
    return searchWgerProducts(query, { page, pageSize });
  }

  // 'auto' — cascata: Local → Open Food Facts → USDA → Wger
  // 1. Base local (TACO) — instantânea, sem requisição de rede
  const localResult = searchLocalFoods(query, { page, pageSize });
  if (localResult.products.length) return localResult;

  // 2. Open Food Facts (Brasil)
  try {
    const offResult = await searchFoodProducts(query, { page, pageSize });
    if (Array.isArray(offResult.products) && offResult.products.length) return offResult;
  } catch {
    // Continua para próxima fonte se OFF falhar.
  }

  // 3. USDA FoodData Central
  try {
    const usdaResult = await searchUsdaProducts(query, { page, pageSize });
    if (Array.isArray(usdaResult.products) && usdaResult.products.length) return usdaResult;
  } catch {
    // Continua para próxima fonte se USDA falhar.
  }

  // 4. Wger (open source)
  return searchWgerProducts(query, { page, pageSize });
}

export { LOCAL_FOODS_BR };