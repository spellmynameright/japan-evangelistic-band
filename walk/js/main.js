// Walking prototype — "One Morning" in Kunitachi.
// Tap to walk, tap people/signs/objects to interact. The clock only moves
// when you do: one minute per tile walked, plus time spent in conversations.
import { state, advance, NOON, MIN_PER_TILE, TILE } from './state.js';
import { MAPS, thingAt, findPath, npcPresent } from './maps.js';
import { drawWorld, drawPetals } from './render.js';
import { openScript, openSign } from './talk.js';
import { updateHud, toast, overlayOpen, openNotebook, closeNotebook, fadeThrough, showSummary } from './hud.js';

const SPEED = 5.5; // tiles per second

const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');
let dpr = 1, scale = 1, vw = 0, vh = 0;
let camX = 0, camY = 0;
let path = [];
let useTarget = null;
let pending = null;     // a tap made mid-step; planned when the step lands
let marker = null;
let walkPhase = 0;
let t = 0;
const wasPresent = {};

const cyclists = [
  { x: 13, y: 20, dy: 2.6 }, { x: 13, y: 48, dy: 2.2 },
  { x: 26, y: 30, dy: -2.4 }, { x: 26, y: 56, dy: -2.8 },
];
const petals = Array.from({ length: 26 }, () => newPetal(true));

function newPetal(anywhere) {
  return {
    x: Math.random() * window.innerWidth,
    y: anywhere ? Math.random() * window.innerHeight : -10,
    vx: 14 + Math.random() * 18, vy: 22 + Math.random() * 20,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 3,
    c: Math.random() < 0.5 ? '#fbd3df' : '#f6b9cb',
  };
}

const map = () => MAPS[state.mapId];

// ── Layout ────────────────────────────────────────────────────────────────
function resize() {
  dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  scale = Math.min(2, Math.max(1, w / (11 * TILE)));
  vw = w / scale;
  vh = h / scale;
  updateCamera(true);
}

function updateCamera(snap) {
  const m = map(), p = state.player;
  const talking = !document.getElementById('talk').classList.contains('hidden');
  const fit = (center, view, size) => size <= view ? (size - view) / 2
    : Math.max(0, Math.min(size - view, center - view / 2));
  // While the talk card covers the bottom of the screen, keep the player in the top part.
  const tx = fit(p.fx * TILE + TILE / 2, vw, m.w * TILE);
  const ty = fit(p.fy * TILE + TILE / 2 + (talking ? vh * 0.22 : 0), vh, m.h * TILE);
  if (snap) { camX = tx; camY = ty; return; }
  camX += (tx - camX) * 0.15;
  camY += (ty - camY) * 0.15;
}

// ── Targets + pathing ─────────────────────────────────────────────────────
function npcAt(x, y) {
  return map().npcs.find(n => !n.sit && npcPresent(n, state.time) && n.x === x && (n.y === y || n.y === y + 1));
}

function findTarget(x, y) {
  const n = npcAt(x, y);
  if (n) return { npc: n, x: n.x, y: n.y, w: 1, h: 1, block: true };
  const thing = thingAt(map(), x, y);
  if (thing) return thing;
  const below = thingAt(map(), x, y + 1); // tall sprites and sign plaques poke up a tile
  if (below && (below.kind === 'sign' || below.kind === 'vending' || below.kind === 'bench')) return below;
  return null;
}

function goalFor(target) {
  const inside = (x, y) => x >= target.x && x < target.x + target.w && y >= target.y && y < target.y + target.h;
  if (!target.block) return inside;
  return (x, y) => !inside(x, y) && (
    inside(x + 1, y) || inside(x - 1, y) || inside(x, y + 1) || inside(x, y - 1));
}

function plan(isGoal, target) {
  if (path.length) { pending = { isGoal, target }; return; }
  const p = state.player;
  const route = findPath(map(), p.x, p.y, isGoal, state.time);
  if (!route) return;
  path = route;
  useTarget = target;
  if (!path.length && target) arrive();
}

function onTap(e) {
  if (overlayOpen() || state.ended) return;
  const wx = e.clientX / scale + camX, wy = e.clientY / scale + camY;
  const x = Math.floor(wx / TILE), y = Math.floor(wy / TILE);
  if (x < 0 || y < 0 || x >= map().w || y >= map().h) return;
  marker = { x, y, age: 0 };
  const target = findTarget(x, y);
  if (target) plan(goalFor(target), target);
  else plan((gx, gy) => gx === x && gy === y, null);
}

// ── Interactions ──────────────────────────────────────────────────────────
function face(target) {
  const p = state.player;
  const cx = target.x + target.w / 2 - 0.5, cy = target.y + target.h / 2 - 0.5;
  const dx = cx - p.x, dy = cy - p.y;
  if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 'right' : 'left';
  else if (dy !== 0) p.dir = dy > 0 ? 'down' : 'up';
}

function arrive() {
  const target = useTarget;
  useTarget = null;
  if (!target) return;
  face(target);
  if (target.npc) {
    if (npcPresent(target.npc, state.time)) openScript(target.npc.script);
    return;
  }
  switch (target.kind) {
    case 'sign':
    case 'decal':
      return openSign(target);
    case 'door':
      return goThrough(target);
  }
  if (target.use === 'bench') {
    const hiro = map().npcs.find(n => n.id === 'hiro');
    if (npcPresent(hiro, state.time)) return openScript('hiro');
    if (!state.flags.hiro) state.flags.hiro = 'missed';
    return openScript('bench_empty');
  }
  if (target.use === 'talk') openScript(target.script);
}

function goThrough(door) {
  fadeThrough(() => {
    const p = state.player;
    state.mapId = door.to;
    p.x = p.fx = door.tx;
    p.y = p.fy = door.ty;
    p.dir = door.dir;
    path = [];
    updateCamera(true);
    updateHud();
    const key = door.to === 'town' ? 'shoesOn' : 'shoesOff';
    if (!state.flags[key]) {
      state.flags[key] = true;
      toast(door.to === 'town'
        ? 'You step into your shoes at the genkan.'
        : 'Shoes off at the genkan. Tatami underfoot.');
    }
  });
}

// ── Update ────────────────────────────────────────────────────────────────
function step(dt) {
  const p = state.player;
  if (!path.length) return;
  const next = path[0];
  const dx = next.x - p.fx, dy = next.y - p.fy;
  if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 'right' : 'left';
  else p.dir = dy > 0 ? 'down' : 'up';
  const dist = Math.hypot(dx, dy), move = SPEED * dt;
  walkPhase += dt * 14;
  if (dist > move) {
    p.fx += (dx / dist) * move;
    p.fy += (dy / dist) * move;
    return;
  }
  p.fx = p.x = next.x;
  p.fy = p.y = next.y;
  path.shift();
  advance(MIN_PER_TILE);
  updateHud();
  if (state.time >= NOON) { path = []; useTarget = null; pending = null; return; }
  if (pending) {
    const { isGoal, target } = pending;
    pending = null;
    path = [];
    plan(isGoal, target);
    return;
  }
  if (!path.length) arrive();
}

function watchSchedules() {
  const m = map(), p = state.player;
  for (const n of MAPS.town.npcs) {
    const now = npcPresent(n, state.time);
    if (wasPresent[n.id] && !now && m.id === 'town' && !overlayOpen()) {
      const near = Math.abs(p.x - n.x) < 9 && Math.abs(p.y - n.y) < 12;
      if (near && n.id === 'hiro') toast('The old man gets up slowly and walks out of the park.');
      if (near && n.id === 'ono') toast('Your neighbor finishes sweeping and goes inside.');
    }
    wasPresent[n.id] = now;
  }
}

function update(dt) {
  t += dt;
  step(dt);
  watchSchedules();
  if (marker) { marker.age += dt; if (marker.age > 0.6) marker = null; }
  for (const c of cyclists) {
    c.y += c.dy * dt;
    if (c.y > 59) c.y = 12;
    if (c.y < 12) c.y = 59;
  }
  for (const pt of petals) {
    pt.x += pt.vx * dt + Math.sin(t * 1.3 + pt.r) * 0.3;
    pt.y += pt.vy * dt;
    pt.r += pt.vr * dt;
    if (pt.y > window.innerHeight + 10 || pt.x > window.innerWidth + 10) Object.assign(pt, newPetal(false), { x: Math.random() * window.innerWidth - 60 });
  }
  updateCamera(false);
  if (state.time >= NOON && !state.ended && !overlayOpen()) {
    state.ended = true;
    showSummary();
  }
}

function render() {
  const m = map();
  const k = dpr * scale;
  ctx.setTransform(k, 0, 0, k, -camX * k, -camY * k);
  ctx.imageSmoothingEnabled = true;
  const bob = path.length ? Math.abs(Math.sin(walkPhase)) * 2 : 0;
  drawWorld(ctx, { camX, camY, vw, vh }, m, state, {
    t, bob, marker, cyclists: m.id === 'town' ? cyclists : [],
  });
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (m.outdoors) drawPetals(ctx, petals);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

// ── Boot ──────────────────────────────────────────────────────────────────
window.addEventListener('resize', resize);
canvas.addEventListener('pointerdown', onTap);
document.getElementById('notebook-btn').addEventListener('click', openNotebook);
document.getElementById('notebook-close').addEventListener('click', closeNotebook);
document.getElementById('start').addEventListener('click', () => document.getElementById('intro').classList.add('hidden'));
document.getElementById('again').addEventListener('click', () => location.reload());

resize();
updateHud();
const fontsReady = document.fonts ? document.fonts.load('700 12px "Noto Sans JP"') : Promise.resolve();
Promise.race([fontsReady, new Promise(r => setTimeout(r, 1500))]).finally(() => requestAnimationFrame(frame));
