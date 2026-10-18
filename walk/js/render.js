// Draws the pre-rendered art (walk/art/ → walk/assets/): ground bands, then
// object sprites and people sorted by the map row they stand on, then the
// power lines, then the game's own overlays (sign text, bubbles, tap marker).
//
// World coordinates: tile (x, y) covers (x*32, y*32)…(x*32+32, y*32+32), as in
// maps.js. The art is drawn `top` tiles higher so tall things above row 0 fit.
import { TILE } from './state.js';
import { npcPresent } from './maps.js';
import { WORDS, plain, wordsIn } from './words.js';

const JP_FONT = '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif';
const GROUND_KINDS = new Set(['decal']);
const FADE_ALPHA = 0.42;  // buildings/trees you're standing behind

const SIGN_STYLES = {
  street:  { bg: '#2f5fa7', fg: '#ffffff' },
  station: { bg: '#ffffff', fg: '#1f2a44' },
  park:    { bg: '#7a5230', fg: '#f6ead2' },
  shop:    { bg: '#f6ead2', fg: '#5b3a1e' },
  konbini: { bg: '#ffffff', fg: '#1e8449' },
  gate:    { bg: '#8d9196', fg: '#ffffff' },
  gomi:    { bg: '#f4d03f', fg: '#222222' },
};
// Height (tiles) of each sign's plaque, and whether it hangs on a wall.
const SIGN_MOUNT = {
  station: { z: 2.55, wall: true, front: 0.45 }, shop: { z: 1.9, wall: true }, konbini: { z: 2.2, wall: true },
  street: { z: 1.75 }, park: { z: 1.45 }, gate: { z: 1.55 }, gomi: { z: 1.05 },
};

export const art = { maps: {}, chars: null };

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

export async function loadArt(mapIds) {
  const base = new URL('../assets/', import.meta.url);
  const load = async path => loadImage(new URL(path, base).href);
  await Promise.all(mapIds.map(async id => {
    const meta = await (await fetch(new URL(`${id}/art.json`, base))).json();
    const [ground, atlases] = await Promise.all([
      Promise.all(meta.ground.map(async g => ({ y: g.y, img: await load(`${id}/${g.src}`) }))),
      Promise.all(meta.atlases.map(a => load(`${id}/${a}`))),
    ]);
    art.maps[id] = { meta, ground, atlases, fade: new Map() };
  }));
  const chars = await (await fetch(new URL('characters/characters.json', base))).json();
  art.chars = { ...chars, img: await load('characters/characters.webp') };
}

export function artTop(mapId) {
  return art.maps[mapId]?.meta.top ?? 0;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ── Characters ─────────────────────────────────────────────────────────────
function drawFrame(ctx, name, feetX, feetY) {
  const c = art.chars;
  const f = c.frames[name];
  if (!f) return;
  const [cw, ch] = c.cell, [ax, ay] = c.anchor, s = c.scale;
  ctx.drawImage(c.img, f[0] * cw, f[1] * ch, cw, ch, feetX - ax / s, feetY - ay / s, cw / s, ch / s);
}

const PLAYER_WALK = [1, 2, 3, 0];

function people(map, state, extras) {
  const list = [];
  const p = state.player;
  const pf = extras.walking ? PLAYER_WALK[Math.floor(extras.walkPhase / 1.7) % 4] : 0;
  const px = (p.fx + 0.5) * TILE, py = (p.fy + 0.5) * TILE + 6;
  list.push({ z: p.fy + 0.5, player: true, box: [px - 12, py - 40, 24, 40],
              draw: () => drawFrame(extras.ctx, `player_${p.dir}_${pf}`, px, py) });
  for (const n of map.npcs) {
    if (!npcPresent(n, state.time)) continue;
    if (n.id === 'hiro') {
      const hx = (n.x + 1) * TILE, hy = (n.y + 0.92) * TILE;
      list.push({ z: n.y + 0.55, npc: n, head: [hx - 6, hy - 44],
                  draw: () => drawFrame(extras.ctx, `hiro_sit_${Math.floor(extras.t * 1.1) % 2}`, hx, hy) });
    } else if (n.id === 'ono') {
      const ox = (n.x + 0.5) * TILE, oy = (n.y + 0.5) * TILE + 6;
      list.push({ z: n.y + 0.5, npc: n, head: [ox, oy - 42],
                  draw: () => drawFrame(extras.ctx, `ono_sweep_${Math.floor(extras.t * 2.4) % 2}`, ox, oy) });
    }
  }
  for (const c of extras.cyclists || []) {
    const cx = (c.x + 0.5) * TILE, cy = (c.y + 0.5) * TILE + 6;
    const dir = c.dy > 0 ? 'down' : 'up';
    list.push({ z: c.y + 0.5, draw: () => drawFrame(extras.ctx, `cyclist_${dir}_${Math.floor(c.y * 2) % 2}`, cx, cy) });
  }
  return list;
}

function bubble(ctx, cx, top, t) {
  const y = top - 6 + Math.sin(t * 3) * 1.5;
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  rr(ctx, cx - 11, y - 9, 22, 13, 6); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx - 3, y + 4); ctx.lineTo(cx, y + 8); ctx.lineTo(cx + 3, y + 4); ctx.fill();
  ctx.fillStyle = '#555';
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(cx + i * 5, y - 2.5, 1.6, 0, Math.PI * 2); ctx.fill(); }
}

// ── Signs (text is always drawn by the game — it changes as you learn) ─────
function gloss(ctx, text, cx, y) {
  ctx.font = '600 10px "Zen Maru Gothic", sans-serif';
  const w = ctx.measureText(text).width + 10;
  ctx.fillStyle = 'rgba(20,20,35,0.8)';
  rr(ctx, cx - w / 2, y, w, 14, 7); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, y + 7.5);
}

function signAnchor(t, k) {
  const m = SIGN_MOUNT[t.style] || SIGN_MOUNT.street;
  const baseY = m.wall ? (t.y + 1 + (m.front || 0)) * TILE - 2 : (t.y + 0.5) * TILE;
  return { cx: (t.x + 0.5) * TILE, y: baseY - m.z * k * TILE };
}

// The sign whose plaque covers world point (wx, wy), if any — plaques float
// above their tile, so they get their own hit test.
export function signAt(map, wx, wy) {
  const k = art.maps[map.id]?.meta.k ?? 0;
  for (const t of map.things) {
    if (t.kind !== 'sign') continue;
    const { cx, y } = signAnchor(t, k);
    const w = plain(t.text).length * 12 + 24;
    if (Math.abs(wx - cx) < w / 2 + 6 && wy > y - 8 && wy < y + 34) return t;
  }
  return null;
}

function drawSign(ctx, t, known, time, k) {
  const st = SIGN_STYLES[t.style] || SIGN_STYLES.street;
  const text = plain(t.text) + (t.extra ? ` ${t.extra}` : '');
  ctx.font = `700 12px ${JP_FONT}`;
  const w = ctx.measureText(text).width + 12, h = 18;
  const { cx, y } = signAnchor(t, k);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  rr(ctx, cx - w / 2 + 1, y + 2, w, h, 3); ctx.fill();
  ctx.fillStyle = st.bg;
  rr(ctx, cx - w / 2, y, w, h, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = st.fg;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, y + h / 2 + 1);
  const ids = wordsIn(t.text);
  if (ids.every(id => known.has(id))) {
    gloss(ctx, ids.map(id => WORDS[id].g).join(' '), cx, y + h + 2);
  } else {
    const r = 3.5 + Math.sin(time * 4);
    ctx.fillStyle = '#fff6a8';
    ctx.beginPath(); ctx.arc(cx + w / 2, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

function drawDecal(ctx, t, known) {
  const px = t.x * TILE, py = t.y * TILE;
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = `700 18px ${JP_FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  [...plain(t.text)].forEach((ch, i) => ctx.fillText(ch, px + TILE / 2, py + 12 + i * 20));
  const ids = wordsIn(t.text);
  if (ids.every(id => known.has(id))) gloss(ctx, ids.map(id => WORDS[id].g).join(' '), px + TILE + 18, py + 10);
}

// ── Frame ──────────────────────────────────────────────────────────────────
function overlaps(a, b) {
  return a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
}

export function drawWorld(ctx, view, map, state, extras) {
  const A = art.maps[map.id];
  const { camX, camY, vw, vh } = view;
  ctx.fillStyle = map.outdoors ? '#4d7a3a' : '#2a2320';
  ctx.fillRect(camX, camY, vw, vh);
  if (!A) return;
  const { meta } = A, s = meta.scale, off = -meta.top * TILE, k = meta.k;

  for (const g of A.ground) {
    const y = off + g.y / s, h = g.img.height / s;
    if (y > camY + vh || y + h < camY) continue;
    ctx.drawImage(g.img, 0, y, g.img.width / s, h);
  }
  for (const t of map.things) if (GROUND_KINDS.has(t.kind)) drawDecal(ctx, t, state.known);

  const list = people(map, state, { ...extras, ctx });
  const player = list.find(d => d.player);
  let overhead = null;
  for (const sp of meta.sprites) {
    const x = sp.dx / s, y = off + sp.dy / s, w = sp.w / s, h = sp.h / s;
    if (x > camX + vw || x + w < camX || y > camY + vh || y + h < camY) continue;
    const draw = alpha => {
      ctx.globalAlpha = alpha;
      ctx.drawImage(A.atlases[sp.a], sp.sx, sp.sy, sp.w, sp.h, x, y, w, h);
      ctx.globalAlpha = 1;
    };
    if (sp.z === 'overhead') { overhead = draw; continue; }
    // Fade what stands between you and the camera, like a cutaway.
    const behind = sp.z > player.z && overlaps([x, y, w, h], player.box);
    const cur = A.fade.get(sp.id) ?? 1, target = behind ? FADE_ALPHA : 1;
    const alpha = cur + (target - cur) * Math.min(1, extras.dt * 10);
    if (alpha < 0.999) A.fade.set(sp.id, alpha); else A.fade.delete(sp.id);
    list.push({ z: sp.z, draw: () => draw(alpha) });
  }
  list.sort((a, b) => a.z - b.z);
  for (const d of list) d.draw();
  overhead?.(1);

  for (const d of list) if (d.npc && !state.flags[d.npc.id]) bubble(ctx, d.head[0], d.head[1], extras.t);
  for (const t of map.things) if (t.kind === 'sign') drawSign(ctx, t, state.known, extras.t, k);

  if (extras.marker) {
    const m = extras.marker, a = 1 - m.age / 0.6;
    if (a > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(m.x * TILE + TILE / 2, m.y * TILE + TILE / 2, 6 + m.age * 18, (6 + m.age * 18) * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
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
