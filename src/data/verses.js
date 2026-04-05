export const verses = [
  { text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.", ref: "João 3:16" },
  { text: "Tudo posso naquele que me fortalece.", ref: "Filipenses 4:13" },
  { text: "O Senhor é o meu pastor; de nada me faltará.", ref: "Salmos 23:1" },
  { text: "Confie no Senhor de todo o seu coração e não se apoie em seu próprio entendimento.", ref: "Provérbios 3:5" },
  { text: "Sede fortes e corajosos. Não temais, nem vos assusteis diante deles; porque o Senhor teu Deus é quem vai contigo; não te deixará, nem te desamparará.", ref: "Deuteronômio 31:6" },
  { text: "Porque sou eu que conheço os planos que tenho para vocês, diz o Senhor, planos de fazê-los prosperar e não de causar dano, planos de dar a vocês esperança e um futuro.", ref: "Jeremias 29:11" },
  { text: "Busquem, pois, em primeiro lugar o Reino de Deus e a sua justiça, e todas essas coisas lhes serão acrescentadas.", ref: "Mateus 6:33" },
  { text: "Não se preocupem com coisa alguma; em vez disso, orem sobre tudo. Digam a Deus o que vocês precisam e agradeçam-lhe por tudo que ele tem feito.", ref: "Filipenses 4:6" },
  { text: "O Senhor é a minha luz e a minha salvação; a quem temerei? O Senhor é a força da minha vida; a quem me recearei?", ref: "Salmos 27:1" },
  { text: "Mas os que esperam no Senhor renovarão as suas forças; subirão com asas como águias; correrão e não se cansarão; caminharão e não se fatigarão.", ref: "Isaías 40:31" },
  { text: "Eu sou o caminho, a verdade e a vida. Ninguém vem ao Pai, senão por mim.", ref: "João 14:6" },
  { text: "Porque eu sei os planos que tenho para você, planos de paz e não de mal, para lhe dar um futuro e uma esperança.", ref: "Jeremias 29:11" },
  { text: "Alegrai-vos sempre no Senhor. Outra vez digo: alegrai-vos.", ref: "Filipenses 4:4" },
  { text: "A paz de Deus, que excede todo o entendimento, guardará os seus corações e as suas mentes em Cristo Jesus.", ref: "Filipenses 4:7" },
  { text: "Sede misericordiosos, assim como o vosso Pai é misericordioso.", ref: "Lucas 6:36" },
  { text: "O amor é paciente, o amor é bondoso. Não inveja, não se vangloria, não se orgulha.", ref: "1 Coríntios 13:4" },
  { text: "Porque nada é impossível para Deus.", ref: "Lucas 1:37" },
  { text: "O Senhor te abençoe e te guarde; o Senhor faça resplandecer o seu rosto sobre ti e te seja gracioso.", ref: "Números 6:24-25" },
  { text: "Deleita-te no Senhor, e ele atenderá aos desejos do teu coração.", ref: "Salmos 37:4" },
  { text: "Clama a mim, e eu te responderei; e te anunciarei coisas grandes e ocultas, que tu não sabes.", ref: "Jeremias 33:3" },
  { text: "Eu vim para que tenham vida, e a tenham em abundância.", ref: "João 10:10" },
  { text: "Posso fazer tudo por meio daquele que me dá forças.", ref: "Filipenses 4:13 (NVI)" },
  { text: "Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.", ref: "Salmos 37:5" },
  { text: "O Senhor está perto de todos os que o invocam, de todos os que o invocam em verdade.", ref: "Salmos 145:18" },
  { text: "Porque onde estiverem dois ou três reunidos em meu nome, ali estou no meio deles.", ref: "Mateus 18:20" },
  { text: "Ainda que eu ande pelo vale da sombra da morte, não temerei mal nenhum; porque tu estás comigo.", ref: "Salmos 23:4" },
  { text: "Por isso, não se preocupem com o amanhã, pois o amanhã trará as suas próprias preocupações. Suficiente é o mal do dia de hoje.", ref: "Mateus 6:34" },
  { text: "Deus é o nosso refúgio e força, socorro bem-presente na angústia.", ref: "Salmos 46:1" },
  { text: "Tende bom ânimo; eu venci o mundo.", ref: "João 16:33" },
  { text: "Mas buscai primeiro o reino de Deus e a sua justiça, e todas estas coisas vos serão acrescentadas.", ref: "Mateus 6:33" },
];

export function getDailyVerse() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return verses[dayOfYear % verses.length];
}
