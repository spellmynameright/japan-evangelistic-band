// Placeholder art, drawn in code. Everything here is meant to be replaced by
// pre-rendered art later — keep the shapes simple and the sizes honest.
import { TILE } from './state.js';
import { npcPresent } from './maps.js';
import { WORDS, plain, wordsIn } from './words.js';

const C = {
  g: '#8dbb69', g2: '#86b463', p: '#d9d3c7', p2: '#cbc4b6', r: '#6d7075', s: '#c9c0af', s2: '#b8ae9b',
  l: '#7f828a', d: '#c8ad84', h: '#4c8648', h2: '#5f9c57', t: '#cdbf87', t2: '#a99b60',
  f: '#b08a5e', f2: '#9c7850', k: '#9c978e', w: '#e7dcc6', w2: '#b8aa8f',
};

const STYLES = {
  shop:      { wall: '#e8dcc8', roof: '#5d6d7e' },
  shop2:     { wall: '#d9cbb5', roof: '#8e6e53' },
  bakery:    { wall: '#f4e4c4', roof: '#a0522d', awning: ['#c0392b', '#f4e4c4'] },
  konbini:   { wall: '#fafafa', roof: '#dfe6e9', band: true },
  house:     { wall: '#efe6d8', roof: '#4a5d6a' },
  house2:    { wall: '#e3d5c0', roof: '#7b4b3a' },
  brick:     { wall: '#b5654a', roof: '#5b3a2e' },
  apartment: { wall: '#e9dfc9', roof: '#8a8f96' },
  station:   { wall: '#f5efe2', roof: '#c0392b' },
};

const SIGN_STYLES = {
  street:  { bg: '#2f5fa7', fg: '#ffffff' },
  station: { bg: '#ffffff', fg: '#1f2a44' },
  park:    { bg: '#7a5230', fg: '#f6ead2' },
  shop:    { bg: '#f6ead2', fg: '#5b3a1e' },
  konbini: { bg: '#ffffff', fg: '#1e8449' },
  gate:    { bg: '#8d9196', fg: '#ffffff' },
  gomi:    { bg: '#f4d03f', fg: '#222222' },
};

const JP_FONT = '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif';
const GROUND_KINDS = new Set(['zebra', 'decal', 'futon']);

function hash(x, y) {
  return ((x * 73856093) ^ (y * 19349663)) >>> 0;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ── Ground ─────────────────────────────────────────────────────────────────
function drawTile(ctx, map, ch, x, y) {
  const px = x * TILE, py = y * TILE;
  const odd = hash(x, y) % 3 === 0;
  switch (ch) {
    case 'g':
    case 'n':
      ctx.fillStyle = odd ? C.g2 : C.g;
      ctx.fillRect(px, py, TILE, TILE);
      if (hash(x, y) % 7 === 0) {
        ctx.fillStyle = '#9fca7c';
        ctx.fillRect(px + 8, py + 18, 2, 4);
        ctx.fillRect(px + 12, py + 16, 2, 6);
      }
      if (ch === 'n') {
        ctx.fillStyle = '#5b6066';
        ctx.fillRect(px + 14, py + 4, 4, 24);
        ctx.fillRect(px, py + 10, TILE, 3);
        ctx.fillRect(px, py + 20, TILE, 3);
      }
      break;
    case 'p':
      ctx.fillStyle = C.p;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = C.p2;
      ctx.fillRect(px, py + TILE - 1, TILE, 1);
      ctx.fillRect(px + TILE - 1, py, 1, TILE);
      break;
    case 'r':
    case 'l':
      ctx.fillStyle = ch === 'r' ? C.r : C.l;
      ctx.fillRect(px, py, TILE, TILE);
      break;
    case 's':
      ctx.fillStyle = C.s;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = C.s2;
      ctx.fillRect(px, py + 15, TILE, 1);
      ctx.fillRect(px + (y % 2 ? 0 : 16), py, 1, 15);
      ctx.fillRect(px + (y % 2 ? 16 : 0), py + 16, 1, 16);
      break;
    case 'd':
      ctx.fillStyle = C.d;
      ctx.fillRect(px, py, TILE, TILE);
      break;
    case 'h':
      ctx.fillStyle = C.g;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = C.h;
      rr(ctx, px + 1, py + 2, TILE - 2, TILE - 2, 10); ctx.fill();
      ctx.fillStyle = C.h2;
      rr(ctx, px + 4, py + 3, TILE - 10, 10, 6); ctx.fill();
      break;
    case 't':
      ctx.fillStyle = C.t;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.strokeStyle = C.t2; ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
      break;
    case 'f':
      ctx.fillStyle = C.f;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = C.f2;
      ctx.fillRect(px, py + 10, TILE, 1);
      ctx.fillRect(px, py + 21, TILE, 1);
      break;
    case 'k':
      ctx.fillStyle = C.k;
      ctx.fillRect(px, py, TILE, TILE);
      break;
    case 'w':
      ctx.fillStyle = C.w;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = C.w2;
      ctx.fillRect(px, py + TILE - 4, TILE, 4);
      break;
  }
}

function drawRoadMarks(ctx, map, x0, y0, x1, y1) {
  if (map.id !== 'town') return;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  // Daigaku-dōri centre line (between x=19 and 20), Sakura-dōri (between y=37 and 38)
  for (let y = Math.max(12, y0); y <= Math.min(59, y1); y++) {
    if (y >= 34 && y <= 41) continue;
    ctx.fillRect(20 * TILE - 2, y * TILE + 6, 4, 18);
  }
  for (let x = Math.max(0, x0); x <= Math.min(39, x1); x++) {
    if (x >= 14 && x <= 25) continue;
    ctx.fillRect(x * TILE + 6, 38 * TILE - 2, 18, 4);
  }
}

function drawGroundThing(ctx, t, known) {
  const px = t.x * TILE, py = t.y * TILE;
  if (t.kind === 'zebra') {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < t.w * 2; i++) ctx.fillRect(px + i * 16 + 3, py + 4, 10, TILE - 8);
  } else if (t.kind === 'decal') {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `700 18px ${JP_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const s = plain(t.text);
    [...s].forEach((ch, i) => ctx.fillText(ch, px + TILE / 2, py + 12 + i * 20));
    if (wordsIn(t.text).every(id => known.has(id))) gloss(ctx, t, px + TILE + 18, py + 10);
  } else if (t.kind === 'futon') {
    ctx.fillStyle = '#f4f1ea';
    rr(ctx, px + 3, py + 3, t.w * TILE - 6, t.h * TILE - 6, 6); ctx.fill();
    ctx.fillStyle = '#7fa7c9';
    rr(ctx, px + 3, py + 26, t.w * TILE - 6, t.h * TILE - 29, 6); ctx.fill();
    ctx.fillStyle = '#ffffff';
    rr(ctx, px + 12, py + 6, t.w * TILE - 24, 14, 5); ctx.fill();
  }
}

// ── Things ─────────────────────────────────────────────────────────────────
function drawBuilding(ctx, t) {
  const st = STYLES[t.style] || STYLES.house;
  const px = t.x * TILE, py = t.y * TILE, W = t.w * TILE, H = t.h * TILE;
  const wallH = Math.min(2, t.h - 1) * TILE;
  const roofH = H - wallH;

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(px + 4, py + H - 2, W, 6);

  // Wall
  ctx.fillStyle = st.wall;
  ctx.fillRect(px, py + roofH, W, wallH);
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(px, py + H - 4, W, 4);

  if (t.style === 'station') return drawStation(ctx, t, st, px, py, W, H, roofH);

  // Windows
  const floors = t.style === 'apartment' ? 2 : 1;
  for (let f = 0; f < floors; f++) {
    const wy = py + roofH + 6 + f * (wallH / floors);
    for (let i = 0; i < t.w; i++) {
      if (t.style === 'konbini' || (i + f) % 2) continue;
      ctx.fillStyle = '#a9cbe0';
      ctx.fillRect(px + i * TILE + 8, wy, 16, floors === 2 ? 10 : 16);
    }
  }
  if (t.style === 'konbini') {
    ctx.fillStyle = '#bfe3f5';
    ctx.fillRect(px + 6, py + roofH + 22, W - 12, wallH - 28);
  }
  if (t.style === 'apartment') {
    // external stairs + walkway rail
    ctx.strokeStyle = '#7d7f84'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + W - 6, py + H - 2); ctx.lineTo(px + W - 30, py + roofH + 2);
    ctx.moveTo(px, py + roofH + wallH / 2); ctx.lineTo(px + W, py + roofH + wallH / 2);
    ctx.stroke();
  }

  // Roof
  ctx.fillStyle = st.roof;
  ctx.fillRect(px - 2, py, W + 4, roofH);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (let y = py + 6; y < py + roofH - 4; y += 8) ctx.fillRect(px - 2, y, W + 4, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(px - 2, py + roofH - 4, W + 4, 4);

  if (st.band) {
    ctx.fillStyle = '#1e8449'; ctx.fillRect(px, py + roofH, W, 5);
    ctx.fillStyle = '#e67e22'; ctx.fillRect(px, py + roofH + 5, W, 3);
    ctx.fillStyle = '#2e86c1'; ctx.fillRect(px, py + roofH + 8, W, 3);
  }
  if (st.awning) {
    for (let i = 0; i < t.w * 2; i++) {
      ctx.fillStyle = st.awning[i % 2];
      ctx.fillRect(px + i * 16, py + roofH, 16, 10);
    }
  }
}

function drawStation(ctx, t, st, px, py, W, H, roofH) {
  // Arched windows along the front
  for (let i = 1; i < t.w - 1; i++) {
    if (i >= 5 && i <= 6) continue;
    ctx.fillStyle = '#a9cbe0';
    rr(ctx, px + i * TILE + 9, py + roofH + 14, 14, 26, [7, 7, 0, 0]); ctx.fill();
  }
  ctx.fillStyle = '#5a3d2b';
  ctx.fillRect(px + 5 * TILE + 10, py + roofH + 18, 2 * TILE - 20, 2 * TILE - 22);
  // Low wings
  ctx.fillStyle = st.roof;
  ctx.fillRect(px - 4, py + TILE, W + 8, roofH - TILE);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(px - 4, py + roofH - 4, W + 8, 4);
  // The steep red triangle that everyone in Kunitachi knows
  const cx = px + W / 2;
  ctx.fillStyle = '#d0453a';
  ctx.beginPath();
  ctx.moveTo(cx - 2.6 * TILE, py + roofH);
  ctx.lineTo(cx, py - 1.6 * TILE);
  ctx.lineTo(cx + 2.6 * TILE, py + roofH);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f5efe2';
  ctx.beginPath();
  ctx.moveTo(cx - 1.3 * TILE, py + roofH - 2);
  ctx.lineTo(cx, py - 0.2 * TILE);
  ctx.lineTo(cx + 1.3 * TILE, py + roofH - 2);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#a9cbe0';
  ctx.beginPath(); ctx.arc(cx, py + roofH - 20, 8, 0, Math.PI * 2); ctx.fill();
}

function drawTree(ctx, t) {
  const cx = t.x * TILE + TILE / 2, by = t.y * TILE + TILE;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath(); ctx.ellipse(cx, by - 3, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6b4a33';
  ctx.fillRect(cx - 3, by - 16, 6, 14);
  const [base, light, dark] = t.green
    ? ['#6da55a', '#8bc06f', '#558a46']
    : ['#f4bccd', '#fde1ea', '#e7a3b9'];
  ctx.fillStyle = dark;
  ctx.beginPath(); ctx.arc(cx, by - 26, 20, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = base;
  ctx.beginPath(); ctx.arc(cx - 6, by - 30, 15, 0, Math.PI * 2); ctx.arc(cx + 8, by - 27, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath(); ctx.arc(cx - 8, by - 35, 7, 0, Math.PI * 2); ctx.fill();
}

function drawThing(ctx, t) {
  const px = t.x * TILE, py = t.y * TILE;
  switch (t.kind) {
    case 'building': return drawBuilding(ctx, t);
    case 'tree': return drawTree(ctx, t);
    case 'island':
      ctx.fillStyle = '#6d9e55';
      ctx.beginPath(); ctx.ellipse(px + t.w * TILE / 2, py + TILE, t.w * TILE / 2, TILE - 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f7d774';
      for (let i = 0; i < 9; i++) ctx.fillRect(px + 20 + i * 18, py + 14 + (i % 3) * 12, 4, 4);
      return;
    case 'bench':
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(px + 2, py + 24, t.w * TILE - 4, 6);
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(px + 2, py + 8, t.w * TILE - 4, 5);
      ctx.fillRect(px + 2, py + 16, t.w * TILE - 4, 5);
      ctx.fillStyle = '#4a4a4a';
      ctx.fillRect(px + 6, py + 21, 3, 7);
      ctx.fillRect(px + t.w * TILE - 9, py + 21, 3, 7);
      return;
    case 'vending':
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(px + 4, py + 26, 26, 6);
      ctx.fillStyle = '#f2f2f2';
      rr(ctx, px + 4, py - 14, 24, 42, 3); ctx.fill();
      ctx.fillStyle = '#cfe6f2';
      ctx.fillRect(px + 7, py - 10, 18, 18);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = '#d0453a'; ctx.fillRect(px + 8 + i * 6, py + 11, 4, 3);
        ctx.fillStyle = '#2f5fa7'; ctx.fillRect(px + 8 + i * 6, py + 16, 4, 3);
      }
      return;
    case 'gomi':
      ctx.fillStyle = '#3f8f5a';
      rr(ctx, px + 2, py + 8, TILE - 4, TILE - 10, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
      for (let i = 6; i < TILE; i += 6) {
        ctx.beginPath(); ctx.moveTo(px + i, py + 9); ctx.lineTo(px + i - 4, py + TILE - 3); ctx.stroke();
      }
      return;
    case 'table':
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      rr(ctx, px + 4, py + 10, t.w * TILE - 4, t.h * TILE - 8, 10); ctx.fill();
      ctx.fillStyle = '#8a5a3b';
      rr(ctx, px + 2, py + 4, t.w * TILE - 4, t.h * TILE - 10, 10); ctx.fill();
      return;
    case 'item':
      ctx.fillStyle = t.icon === 'bible' ? '#2b2b2b' : '#e67e22';
      rr(ctx, px + 8, py + 8, 16, 12, 2); ctx.fill();
      ctx.fillStyle = t.icon === 'bible' ? '#c9a227' : '#ffffff';
      ctx.fillRect(px + 15, py + 10, 2, 8);
      return;
    case 'counter':
      ctx.fillStyle = '#b9bcc0';
      ctx.fillRect(px, py + 2, t.w * TILE, TILE - 2);
      ctx.fillStyle = '#8e9297';
      rr(ctx, px + 8, py + 8, 22, 14, 4); ctx.fill();
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(px + 2 * TILE + 8, py + 15, 6, 0, Math.PI * 2); ctx.fill();
      return;
    case 'door':
      ctx.fillStyle = '#6b4a33';
      ctx.fillRect(px + 6, py + (t.to === 'town' ? 2 : 4), TILE - 12, TILE - 6);
      ctx.fillStyle = '#d9b26a';
      ctx.fillRect(px + TILE - 11, py + 16, 2, 4);
      return;
  }
}

// ── People ─────────────────────────────────────────────────────────────────
const LOOKS = {
  player: { coat: '#3b6ea5', hair: '#6b4a2b', skin: '#f1c9a5' },
  hiro:   { coat: '#6c6f7d', hair: '#e2e2e2', skin: '#e8c19c', cap: '#4b4f5c' },
  ono:    { coat: '#7a6a8f', hair: '#b8b8b8', skin: '#efc7a3', apron: '#e79aa6', bun: true },
  cyclist:{ coat: '#2e7d5b', hair: '#222', skin: '#efc7a3' },
};

function drawPerson(ctx, px, py, look, dir = 'down', bob = 0, sit = false) {
  const cx = px + TILE / 2, base = py + TILE - (sit ? 6 : 2);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(cx, py + TILE - 3, 9, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  const y = base - bob;
  // body
  ctx.fillStyle = look.coat;
  rr(ctx, cx - 8, y - 16, 16, 15, 5); ctx.fill();
  if (look.apron) { ctx.fillStyle = look.apron; rr(ctx, cx - 5, y - 13, 10, 12, 3); ctx.fill(); }
  // head
  ctx.fillStyle = look.skin;
  ctx.beginPath(); ctx.arc(cx, y - 22, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = look.hair;
  ctx.beginPath();
  if (dir === 'up') ctx.arc(cx, y - 22, 7.2, 0, Math.PI * 2);
  else ctx.arc(cx, y - 24, 7.2, Math.PI, Math.PI * 2);
  ctx.fill();
  if (look.bun) { ctx.beginPath(); ctx.arc(cx, y - 30, 3.5, 0, Math.PI * 2); ctx.fill(); }
  if (look.cap) { ctx.fillStyle = look.cap; ctx.fillRect(cx - 8, y - 29, 16, 4); }
  if (dir !== 'up') {
    ctx.fillStyle = '#2a2a2a';
    const ex = dir === 'left' ? -3 : dir === 'right' ? 3 : 0;
    if (dir !== 'right') ctx.fillRect(cx - 3 + ex, y - 22, 2, 2);
    if (dir !== 'left') ctx.fillRect(cx + 2 + ex, y - 22, 2, 2);
  }
}

function drawCyclist(ctx, c) {
  const px = c.x * TILE, py = c.y * TILE;
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(px + 16, py + 6, 5, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(px + 16, py + 26, 5, 0, Math.PI * 2); ctx.stroke();
  drawPerson(ctx, px, py - 2, LOOKS.cyclist, c.dy > 0 ? 'down' : 'up', 0, true);
}

function bubble(ctx, cx, top, t) {
  const y = top - 10 + Math.sin(t * 3) * 1.5;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  rr(ctx, cx - 11, y - 9, 22, 13, 6); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx - 3, y + 4); ctx.lineTo(cx, y + 8); ctx.lineTo(cx + 3, y + 4); ctx.fill();
  ctx.fillStyle = '#555';
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(cx + i * 5, y - 2.5, 1.6, 0, Math.PI * 2); ctx.fill(); }
}

// ── Signs ──────────────────────────────────────────────────────────────────
function gloss(ctx, t, cx, y) {
  const text = wordsIn(t.text).map(id => WORDS[id].g).join(' ');
  ctx.font = '600 10px "Zen Maru Gothic", sans-serif';
  const w = ctx.measureText(text).width + 10;
  ctx.fillStyle = 'rgba(20,20,35,0.78)';
  rr(ctx, cx - w / 2, y, w, 14, 7); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, y + 7.5);
}

function drawSign(ctx, t, known, time) {
  const st = SIGN_STYLES[t.style] || SIGN_STYLES.street;
  const text = plain(t.text) + (t.extra ? ` ${t.extra}` : '');
  ctx.font = `700 12px ${JP_FONT}`;
  const tw = ctx.measureText(text).width;
  const w = tw + 12, h = 18;
  const cx = t.x * TILE + TILE / 2;
  const onWall = t.style === 'station' || t.style === 'shop' || t.style === 'konbini';
  const y = onWall ? t.y * TILE + 2 : t.y * TILE - 6;
  if (!onWall) {
    ctx.fillStyle = '#5b6066';
    ctx.fillRect(cx - 1.5, y + h, 3, TILE - h + 4);
  }
  ctx.fillStyle = st.bg;
  rr(ctx, cx - w / 2, y, w, h, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = st.fg;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, y + h / 2 + 1);

  const ids = wordsIn(t.text);
  if (ids.every(id => known.has(id))) {
    gloss(ctx, t, cx, y + h + 2);
  } else {
    const r = 3.5 + Math.sin(time * 4) * 1;
    ctx.fillStyle = '#fff6a8';
    ctx.beginPath(); ctx.arc(cx + w / 2, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

// ── Frame ──────────────────────────────────────────────────────────────────
export function drawWorld(ctx, view, map, state, extras) {
  const { camX, camY, vw, vh } = view;
  ctx.fillStyle = map.outdoors ? '#5f8a49' : '#2a2320';
  ctx.fillRect(camX, camY, vw, vh);

  const x0 = Math.max(0, Math.floor(camX / TILE) - 1), y0 = Math.max(0, Math.floor(camY / TILE) - 1);
  const x1 = Math.min(map.w - 1, Math.ceil((camX + vw) / TILE) + 1), y1 = Math.min(map.h - 1, Math.ceil((camY + vh) / TILE) + 2);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) drawTile(ctx, map, map.ground[y][x], x, y);
  drawRoadMarks(ctx, map, x0, y0, x1, y1);

  const inView = t => t.x + t.w >= x0 - 2 && t.x <= x1 + 2 && t.y + t.h >= y0 - 2 && t.y <= y1 + 3;
  for (const t of map.things) if (GROUND_KINDS.has(t.kind) && inView(t)) drawGroundThing(ctx, t, state.known);

  // Depth-sorted: things, people, cyclists
  const list = [];
  for (const t of map.things) {
    if (GROUND_KINDS.has(t.kind) || t.kind === 'sign' || !inView(t)) continue;
    // Items sit on tables, so draw them after the table they rest on.
    list.push({ z: t.y + t.h + (t.kind === 'item' ? 2 : 0), draw: () => drawThing(ctx, t) });
  }
  for (const n of map.npcs) {
    if (!npcPresent(n, state.time)) continue;
    const look = LOOKS[n.id];
    list.push({ z: n.y + 1.01, draw: () => {
      const dir = n.id === 'hiro' ? 'down' : 'left';
      drawPerson(ctx, n.x * TILE, n.y * TILE, look, dir, 0, n.sit);
      if (n.id === 'ono') {
        const sw = Math.sin(extras.t * 2.2) * 6;
        ctx.strokeStyle = '#a07a3c'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(n.x * TILE + 8, n.y * TILE + 12); ctx.lineTo(n.x * TILE + 2 + sw, n.y * TILE + 30); ctx.stroke();
      }
      if (!state.flags[n.id]) bubble(ctx, n.x * TILE + TILE / 2, n.y * TILE - 2, extras.t);
    } });
  }
  for (const c of extras.cyclists || []) list.push({ z: c.y + 1, draw: () => drawCyclist(ctx, c) });
  const p = state.player;
  list.push({ z: p.fy + 1.02, draw: () => drawPerson(ctx, p.fx * TILE, p.fy * TILE, LOOKS.player, p.dir, extras.bob) });
  list.sort((a, b) => a.z - b.z);
  for (const d of list) d.draw();

  for (const t of map.things) if (t.kind === 'sign' && inView(t)) drawSign(ctx, t, state.known, extras.t);

  if (extras.marker) {
    const m = extras.marker, a = 1 - m.age / 0.6;
    if (a > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(m.x * TILE + TILE / 2, m.y * TILE + TILE / 2, 6 + m.age * 18, 0, Math.PI * 2); ctx.stroke();
    }
  }
}

// Screen-space cherry petals for outdoor scenes.
export function drawPetals(ctx, petals) {
  for (const pt of petals) {
    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.rotate(pt.r);
    ctx.fillStyle = pt.c;
    ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
