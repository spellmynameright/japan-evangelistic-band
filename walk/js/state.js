// Single state object for the walking prototype.
import { START_WORDS } from './words.js';

export const MORNING_START = 7 * 60;   // 7:00
export const NOON = 12 * 60;
export const MIN_PER_TILE = 1;         // time only moves when you do
export const TILE = 32;                // world pixels per tile

export const state = {
  time: MORNING_START,
  mapId: 'apartment',
  player: { x: 2, y: 2, fx: 2, fy: 2, dir: 'down' },
  known: new Set(START_WORDS),
  learnedToday: [],          // word ids in the order learned
  items: { coffee: false },
  flags: {},                 // ono, hiro outcomes; shoesToast; etc.
  ended: false,
};

export function learn(id) {
  if (state.known.has(id)) return false;
  state.known.add(id);
  state.learnedToday.push(id);
  return true;
}

export function advance(minutes) {
  state.time += minutes;
}

export function clockText(t = state.time) {
  const h = Math.floor(t / 60), m = t % 60;
  const h12 = ((h + 11) % 12) + 1;
  return { time: `${h12}:${String(m).padStart(2, '0')}`, ampm: h < 12 ? 'AM' : 'PM' };
}
