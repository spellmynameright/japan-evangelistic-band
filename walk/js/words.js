// Vocabulary for the walking prototype. Words are what you collect: signs,
// people and the phrasebook teach them; conversations check for them.
//
// Markup used in signs and dialogue: "{id}" is a word, anything else is plain text.
//   "{tsuma}は、{sakura}が{suki}でした。"

export const WORDS = {
  arigatou:  { jp: 'ありがとう',       kana: 'ありがとう',       g: 'thanks',          en: 'thank you' },
  hai:       { jp: 'はい',             kana: 'はい',             g: 'yes',             en: 'yes' },
  sumimasen: { jp: 'すみません',       kana: 'すみません',       g: 'sorry',           en: 'excuse me / sorry' },

  ohayou:    { jp: 'おはようございます', kana: 'おはようございます', g: 'good morning',  en: 'good morning (polite)',
               note: 'Said with a bow. The polite version — right for a neighbor.' },
  ohayo:     { jp: 'おはよう',         kana: 'おはよう',         g: 'morning',         en: 'morning (casual)' },
  eki:       { jp: '駅',               kana: 'えき',             g: 'station',         en: 'train station' },
  kunitachi: { jp: '国立',             kana: 'くにたち',         g: 'Kunitachi',       en: 'Kunitachi (the town)',
               note: 'Named for the two towns it sits between: Kokubunji (国) and Tachikawa (立).' },
  daigaku:   { jp: '大学',             kana: 'だいがく',         g: 'university',      en: 'university' },
  douri:     { jp: '通り',             kana: 'どおり',           g: 'avenue',          en: 'street / avenue' },
  sakura:    { jp: 'さくら',           kana: 'さくら',           g: 'cherry blossoms', en: 'cherry blossoms' },
  kouen:     { jp: '公園',             kana: 'こうえん',         g: 'park',            en: 'park' },
  pan:       { jp: 'パン',             kana: 'ぱん',             g: 'bread',           en: 'bread / bakery',
               note: 'From Portuguese "pão" — one of the oldest loanwords in Japanese.' },
  konbini:   { jp: 'コンビニ',         kana: 'こんびに',         g: 'konbini',         en: 'convenience store',
               note: '"Convenience store," squeezed down the Japanese way.' },
  tomare:    { jp: '止まれ',           kana: 'とまれ',           g: 'STOP',            en: 'stop',
               note: 'Painted on side streets where they meet bigger roads.' },
  moeru:     { jp: '燃える',           kana: 'もえる',           g: 'burnable',        en: 'burnable' },
  gomi:      { jp: 'ゴミ',             kana: 'ごみ',             g: 'garbage',         en: 'garbage',
               note: 'Burnable, non-burnable, plastic, cans, bottles — each has its own day.' },
  haitsu:    { jp: 'ハイツ',           kana: 'はいつ',           g: 'Heights',         en: '"Heights" (apartment name)',
               note: 'A very common apartment name. Yours is two stories.' },
  attakai:   { jp: 'あったか〜い',     kana: 'あったかい',       g: 'hot',             en: 'hot (drinks)',
               note: 'Red labels on vending machines are hot drinks. Blue つめた〜い means cold.' },
  doumo:     { jp: 'どうも',           kana: 'どうも',           g: 'thanks',          en: 'thanks (casual)' },
  suki:      { jp: '好き',             kana: 'すき',             g: 'loved',           en: 'to like / to love' },
  sabishii:  { jp: 'さびしい',         kana: 'さびしい',         g: 'lonely',          en: 'lonely',
               note: '「さびしいですね」 — "That must be lonely."' },
  mata:      { jp: 'また',             kana: 'また',             g: 'again',           en: 'again / see you' },
  tsuma:     { jp: '妻',               kana: 'つま',             g: 'my wife',         en: 'my wife' },
};

// Every new missionary arrives knowing a handful of words.
export const START_WORDS = ['arigatou', 'hai', 'sumimasen'];

export function parse(markup) {
  const out = [];
  const re = /\{(\w+)\}/g;
  let last = 0, m;
  while ((m = re.exec(markup))) {
    if (m.index > last) out.push({ text: markup.slice(last, m.index) });
    out.push({ word: m[1] });
    last = re.lastIndex;
  }
  if (last < markup.length) out.push({ text: markup.slice(last) });
  return out;
}

export function wordsIn(markup) {
  return parse(markup).filter(p => p.word).map(p => p.word);
}

// Plain-text version (all Japanese) — used on canvas signs.
export function plain(markup) {
  return parse(markup).map(p => p.word ? WORDS[p.word].jp : p.text).join('');
}
