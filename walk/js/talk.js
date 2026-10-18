// Conversations, objects and signs all share one bottom card.
//
// Node fields:
//   who     speaker id (SPEAKERS) or omitted for narration
//   line    spoken/written Japanese markup — known words get an English gloss
//   en      the gist you understand, shown only once every word in `line` is known
//   note    narration (body language, what you see) — always readable
//   learn   word ids picked up from context on entering the node
//   give    item id handed to the player · time  minutes spent on entering
//   set     flags to set on entering
//   next    continue to this node · choices  [choice]
// Choice fields:
//   say (markup) + en  — something you say in Japanese
//   act                — something you do
//   needs [wordIds]    — locked (but visible) until you know these words
//   locked             — what you WANT to say, shown greyed while locked
//   needsItem          — hidden unless you carry the item
//   next, set, time (default 5)
import { state, learn, advance } from './state.js';
import { WORDS, parse, wordsIn } from './words.js';
import { toastWord, updateHud } from './hud.js';

const SPEAKERS = {
  hiro: { name: 'Old man on the bench', kanji: '翁', color: '#7d8597' },
  ono:  { name: 'Your neighbor',        kanji: '隣', color: '#c9867a' },
};

const SCRIPTS = {
  ono: {
    start: s => s.flags.ono ? 'again' : 'start',
    nodes: {
      start: {
        who: 'ono', line: '{ohayou}！', en: 'Good morning!', learn: ['ohayou'],
        note: '(She stops sweeping and bows, broom in hand, smiling at the new foreigner from upstairs.)',
        choices: [
          { say: '{ohayou}', en: 'Good morning — with a bow', needs: ['ohayou'], next: 'bow', set: { ono: 'bow' } },
          { act: '[Wave and say "Hi!"]', next: 'wave', set: { ono: 'wave' } },
        ],
      },
      bow: {
        who: 'ono', line: 'あら、じょうずね！',
        note: '(She laughs, delighted, and bows again — a little deeper this time.)',
        next: 'gomi',
      },
      wave: {
        who: 'ono', line: 'あら…',
        note: '(She blinks, then gives you a small polite wave back, the way you\'d wave at a child.)',
        next: 'gomi',
      },
      gomi: {
        who: 'ono', line: '{moeru}{gomi}は、げつようびと もくようびよ。',
        en: 'Burnable garbage is… (something about days).',
        note: '(She points her broom at the netted garbage corner and says something kindly, but firmly. You get the feeling this will matter.)',
        choices: [
          { say: '{arigatou}ございます', en: 'Thank you very much', next: null },
          { act: '[Nod like you understood]', next: null },
        ],
      },
      again: {
        who: 'ono', note: '(She\'s still sweeping. She nods at you with a little smile.)',
      },
    },
  },

  hiro: {
    start: s => !s.flags.hiro ? 'start'
      : (s.flags.hiro === 'deep' || s.flags.hiro === 'quiet') ? 'again_warm' : 'again_cool',
    nodes: {
      start: {
        note: '(An old man sits alone on the bench, tossing crumbs to the pigeons. He doesn\'t look up.)',
        choices: [
          { say: '{ohayou}', en: 'Good morning — with a bow', needs: ['ohayou'],
            locked: 'Say good morning (you\'re not sure of the polite way)', next: 'greet' },
          { act: '[Offer him a hot can of coffee]', needsItem: 'coffee', next: 'coffee' },
          { act: '[Sit quietly at the other end of the bench]', next: 'sit' },
          { act: '[Hand him a tract]', next: 'tract', set: { hiro: 'tract' } },
        ],
      },
      greet: {
        who: 'hiro', line: '…{ohayo}。', learn: ['ohayo'],
        note: '(He glances up, surprised to hear Japanese. He moves his bag so there\'s room to sit.)',
        next: 'sakura',
      },
      coffee: {
        who: 'hiro', line: '…{doumo}。', learn: ['doumo'],
        note: '(He looks at the can, then at you, for a long moment. He takes it with both hands and moves his bag so there\'s room to sit.)',
        next: 'sakura',
      },
      sit: {
        time: 15,
        note: '(You sit. Neither of you speaks. A pigeon lands by your shoe. A long time passes — long enough that it stops feeling strange. Then he speaks.)',
        next: 'sakura',
      },
      tract: {
        note: '(He takes it with both hands and bows slightly, the way you\'d accept a business card. He slips it into his coat without reading it and turns back to the pigeons. The moment has closed.)',
      },
      sakura: {
        who: 'hiro', line: '{tsuma}は、{sakura}が{suki}でした。',
        en: 'My wife loved the cherry blossoms.',
        note: '(He\'s looking up at the trees. He says it quietly — not really to you.)',
        choices: [
          { say: '{sabishii}ですね', en: 'That must be lonely', needs: ['sabishii'],
            locked: 'Tell him it must be lonely', next: 'deep', set: { hiro: 'deep' } },
          { act: '[Stay with him in the quiet]', next: 'quiet', set: { hiro: 'quiet' } },
          { act: '[In English: "God loves you, you know."]', next: 'english', set: { hiro: 'english' } },
        ],
      },
      deep: {
        who: 'hiro', line: '……{hai}。', time: 10,
        note: '(He doesn\'t answer for a long time. Then he nods, slowly, still looking at the trees.)',
        choices: [{ act: '[Sit with him a while longer]', next: 'parting', time: 15 }],
      },
      quiet: {
        time: 15,
        note: '(You watch the petals come down together. Nothing needs to be said, and nothing is.)',
        choices: [{ act: '[Stand to go]', next: 'parting' }],
      },
      english: {
        who: 'hiro', line: '…{sumimasen}。',
        note: '(He gives you the polite smile people give a foreigner they can\'t understand, and turns back to the pigeons.)',
      },
      parting: {
        who: 'hiro', line: '{mata}。', learn: ['mata'],
        note: '(As you stand, he says one word, and lifts his hand a little.)',
      },
      again_warm: { who: 'hiro', note: '(He\'s watching the pigeons. He nods once when he sees you.)' },
      again_cool: { who: 'hiro', note: '(He doesn\'t look up.)' },
    },
  },

  bench_empty: {
    start: () => 'start',
    nodes: { start: { note: '(The bench is empty. A few petals on the seat.)' } },
  },

  vending: {
    start: s => s.items.coffee ? 'have' : 'buy',
    nodes: {
      buy: {
        line: '{attakai}', learn: ['attakai'], give: 'coffee', time: 2,
        note: '(Rows of cans glow behind the glass — some labels blue, some red. You try a red one. Two cans of hot coffee, ¥130 each, almost too hot to hold.)',
      },
      have: { note: '(Two hot cans are already warming your coat pockets.)' },
    },
  },

  phrasebook: {
    start: s => s.flags.phrasebook ? 'again' : 'study',
    nodes: {
      study: {
        time: 30, learn: ['suki', 'sabishii'], set: { phrasebook: true },
        note: '(You sit at the low table and work through the "Feelings" page of your phrasebook, mouthing each word until it stops feeling strange.)',
      },
      again: { time: 5, note: '(You review the page again. The words are still there.)' },
    },
  },

  bible: {
    start: s => s.flags.bible ? 'again' : 'read',
    nodes: {
      read: {
        time: 15, set: { bible: true }, line: '主は私の羊飼い。',
        note: '(You read Psalm 23 by the window in your Japanese–English Bible. You can\'t read the Japanese side yet. The English side you know by heart: "The Lord is my shepherd." Somewhere outside, a bicycle bell.)',
      },
      again: { time: 5, note: '(You sit with the verse a little longer.)' },
    },
  },

  futon: {
    start: () => 'start',
    nodes: { start: { note: '(Not yet. The morning is waiting.)' } },
  },
};

const $ = id => document.getElementById(id);
let current = null; // { script, nodeId }

function esc(s) {
  return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

export function renderMarkup(markup) {
  return parse(markup).map(p => {
    if (p.text) return `<span class="plain">${esc(p.text)}</span>`;
    const w = WORDS[p.word];
    return state.known.has(p.word)
      ? `<ruby class="w known">${w.jp}<rt>${w.g}</rt></ruby>`
      : `<span class="w unknown">${w.jp}</span>`;
  }).join('');
}

function allKnown(markup) {
  const ids = wordsIn(markup);
  return ids.length > 0 && ids.every(id => state.known.has(id));
}

function teach(ids) {
  for (const id of ids || []) if (learn(id)) toastWord(id);
}

export function openScript(id) {
  const script = SCRIPTS[id];
  current = { script };
  goto(script.start(state));
}

function goto(nodeId) {
  const node = current.script.nodes[nodeId];
  if (!node) return close();
  teach(node.learn);
  if (node.give) state.items[node.give] = true;
  if (node.time) advance(node.time);
  Object.assign(state.flags, node.set || {});
  updateHud();

  const sp = node.who ? SPEAKERS[node.who] : null;
  const head = $('talk-head');
  head.classList.toggle('hidden', !sp);
  if (sp) {
    $('talk-portrait').textContent = sp.kanji;
    $('talk-portrait').style.background = sp.color;
    $('talk-name').textContent = sp.name;
  }

  let body = '';
  if (node.line) body += `<div class="talk-line">${renderMarkup(node.line)}</div>`;
  if (node.line && node.en && allKnown(node.line)) body += `<div class="talk-gist">“${node.en}”</div>`;
  if (node.note) body += `<div class="talk-note">${esc(node.note)}</div>`;
  $('talk-body').innerHTML = body;

  const box = $('talk-choices');
  box.innerHTML = '';
  const choices = (node.choices || []).filter(c => !c.needsItem || state.items[c.needsItem]);
  if (!choices.length) {
    addButton(box, node.next ? 'Continue' : 'Close', false, () => node.next ? goto(node.next) : close(), 'plain-btn');
  }
  for (const c of choices) {
    const locked = (c.needs || []).some(id => !state.known.has(id));
    let html;
    if (locked) html = `<span class="act">${esc(c.locked || c.en)}</span><span class="lock">🔒 You don't know the words yet</span>`;
    else if (c.say) html = `<span class="say">「${renderMarkup(c.say)}」</span><span class="say-en">${esc(c.en)}</span>`;
    else html = `<span class="act">${esc(c.act)}</span>`;
    addButton(box, html, locked, () => {
      advance(c.time ?? 5);
      Object.assign(state.flags, c.set || {});
      c.next ? goto(c.next) : close();
    });
  }
  $('talk').classList.remove('hidden');
}

function addButton(box, html, disabled, onClick, cls = '') {
  const b = document.createElement('button');
  b.className = `choice ${cls} ${disabled ? 'locked' : ''}`;
  b.innerHTML = html;
  b.disabled = disabled;
  b.addEventListener('click', onClick);
  box.appendChild(b);
}

// A sign: big text, then a little dictionary entry for every word on it.
export function openSign(thing) {
  const ids = wordsIn(thing.text);
  const fresh = ids.filter(id => !state.known.has(id));
  teach(ids);
  advance(1);
  updateHud();
  current = null;
  $('talk-head').classList.add('hidden');
  const extra = thing.extra ? `<span class="plain"> ${esc(thing.extra)}</span>` : '';
  $('talk-body').innerHTML = `
    <div class="sign-big sign-${thing.style || 'road'}">${renderMarkup(thing.text)}${extra}</div>
    ${fresh.length ? '<div class="talk-note">(You look it up on your phone, sounding it out under your breath.)</div>' : ''}
    <ul class="sign-words">${ids.map(id => {
      const w = WORDS[id];
      return `<li><b>${w.jp}</b> <span class="kana">${w.kana !== w.jp ? w.kana : ''}</span> — ${w.en}${w.note ? `<div class="nb-note">${w.note}</div>` : ''}</li>`;
    }).join('')}</ul>`;
  const box = $('talk-choices');
  box.innerHTML = '';
  addButton(box, 'Close', false, close, 'plain-btn');
  $('talk').classList.remove('hidden');
}

export function close() {
  current = null;
  $('talk').classList.add('hidden');
  updateHud();
}
