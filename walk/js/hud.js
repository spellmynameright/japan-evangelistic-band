// HUD, toasts, notebook sheet, intro + end-of-morning summary.
import { state, clockText } from './state.js';
import { WORDS } from './words.js';
import { MAPS } from './maps.js';

const $ = id => document.getElementById(id);

export function updateHud() {
  const c = clockText();
  $('clock-time').textContent = c.time;
  $('clock-ampm').textContent = c.ampm;
  $('place').textContent = MAPS[state.mapId].name;
  $('word-count').textContent = state.known.size;
}

export function toast(html, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = html;
  $('toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3100);
}

export function toastWord(id) {
  const w = WORDS[id];
  toast(`<span class="toast-eyebrow">New word</span><span class="toast-jp">${w.jp}</span> <span class="toast-en">${w.en}</span>`, 'word');
  bumpNotebook();
}

function bumpNotebook() {
  const b = $('notebook-btn');
  b.classList.remove('bump');
  void b.offsetWidth;
  b.classList.add('bump');
}

export function openNotebook() {
  const list = [...state.known].map(id => WORDS[id]);
  $('notebook-list').innerHTML = list.map(w => `
    <li>
      <div class="nb-jp">${w.jp}<span class="nb-kana">${w.kana !== w.jp ? w.kana : ''}</span></div>
      <div class="nb-en">${w.en}</div>
      ${w.note ? `<div class="nb-note">${w.note}</div>` : ''}
    </li>`).join('');
  $('notebook-sub').textContent = `${list.length} words · ${state.learnedToday.length} learned this morning`;
  $('notebook').classList.remove('hidden');
}

export function closeNotebook() {
  $('notebook').classList.add('hidden');
}

export function overlayOpen() {
  return ['intro', 'summary', 'notebook', 'talk'].some(id => !$(id).classList.contains('hidden'))
    || $('fade').classList.contains('on');
}

export function fadeThrough(fn) {
  const f = $('fade');
  f.classList.add('on');
  setTimeout(() => { fn(); setTimeout(() => f.classList.remove('on'), 60); }, 260);
}

const ONO_LINES = {
  bow:  'You greeted your neighbor properly, with a bow. She noticed.',
  wave: 'You waved at your neighbor. She was kind about it.',
};
const HIRO_LINES = {
  deep:    'You told the old man it must be lonely. After a long silence, he said 「また」 — again.',
  quiet:   'You sat in the quiet with the old man. When you left, he said 「また」 — again.',
  tract:   'You gave the old man a tract. He put it in his coat pocket without reading it.',
  english: 'You spoke English to the old man. He didn\'t understand, and the moment closed.',
  missed:  'By the time you reached the park, the bench was empty.',
};

export function showSummary() {
  const f = state.flags;
  const people = [
    ONO_LINES[f.ono] || 'You didn\'t see your neighbor this morning.',
    HIRO_LINES[f.hiro] || 'You didn\'t make it to the park this morning.',
  ];
  $('summary-people').innerHTML = people.map(p => `<li>${p}</li>`).join('');
  $('summary-words').innerHTML = state.learnedToday.length
    ? state.learnedToday.map(id => `<span class="chip"><b>${WORDS[id].jp}</b> ${WORDS[id].g}</span>`).join('')
    : '<span class="dim">No new words this morning.</span>';
  $('summary').classList.remove('hidden');
}
