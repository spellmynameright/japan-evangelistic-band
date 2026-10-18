// Maps for the walking prototype. Ground is a grid of single-char tiles;
// "things" (buildings, trees, signs, doors…) sit on top and may block.
// North is up. The town is a loose sketch of Kunitachi: the old red-roofed
// station at the top, Daigaku-dōri running south, Sakura-dōri crossing it.
//
// Ground chars: g grass · p plaza · r road · s sidewalk · l lane · d dirt path
//               h hedge · n fence · t tatami · f wood floor · k genkan · w wall

const BLOCKING_GROUND = new Set(['h', 'n', 'w']);

function grid(w, h, ch) {
  return Array.from({ length: h }, () => Array(w).fill(ch));
}

function fill(g, x, y, w, h, ch) {
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++)
      if (g[j] && i >= 0 && i < g[j].length) g[j][i] = ch;
}

function buildTown() {
  const W = 40, H = 60;
  const g = grid(W, H, 'g');
  const things = [];
  const add = t => things.push({ w: 1, h: 1, block: true, ...t });

  // Station plaza + the old station building
  fill(g, 8, 0, 24, 12, 'p');
  add({ kind: 'building', style: 'station', x: 14, y: 1, w: 12, h: 5 });
  add({ kind: 'sign', style: 'station', x: 18, y: 5, text: '{kunitachi}{eki}' });
  add({ kind: 'island', x: 17, y: 8, w: 6, h: 2 });
  add({ kind: 'building', style: 'shop', x: 1, y: 1, w: 6, h: 4 });
  add({ kind: 'building', style: 'shop2', x: 1, y: 6, w: 6, h: 5 });
  add({ kind: 'building', style: 'shop2', x: 33, y: 1, w: 6, h: 4 });
  add({ kind: 'building', style: 'shop', x: 33, y: 6, w: 6, h: 5 });

  // Daigaku-dōri: sidewalks, green belts with cherry trees, wide road
  fill(g, 12, 12, 2, 48, 's');
  fill(g, 26, 12, 2, 48, 's');
  fill(g, 16, 12, 8, 48, 'r');
  // Sakura-dōri crossing east–west
  fill(g, 0, 36, 40, 4, 'r');
  for (let x = 0; x < W; x++) {
    if (x >= 16 && x <= 23) continue;
    g[35][x] = 's';
    g[40][x] = 's';
  }
  for (let y = 13; y < H - 1; y += 2) {
    if (y >= 33 && y <= 41) continue;
    add({ kind: 'tree', x: 15, y });
    add({ kind: 'tree', x: 24, y });
  }
  for (let x = 1; x < W; x += 3) {
    if (x >= 10 && x <= 29) continue;
    add({ kind: 'tree', x, y: 34 });
    add({ kind: 'tree', x, y: 41 });
  }
  add({ kind: 'zebra', block: false, x: 16, y: 34, w: 8, h: 1 });
  add({ kind: 'zebra', block: false, x: 16, y: 41, w: 8, h: 1 });
  add({ kind: 'sign', style: 'street', x: 11, y: 12, text: '{daigaku}{douri}' });
  add({ kind: 'sign', style: 'street', x: 11, y: 33, text: '{sakura}{douri}' });

  // West side, north of Sakura-dōri: a house, the bakery, the park
  add({ kind: 'building', style: 'house', x: 1, y: 13, w: 4, h: 5 });
  add({ kind: 'building', style: 'bakery', x: 6, y: 13, w: 6, h: 5 });
  add({ kind: 'sign', style: 'shop', x: 11, y: 15, text: '{pan}' });

  fill(g, 0, 21, 12, 1, 'h');
  fill(g, 0, 32, 12, 1, 'h');
  fill(g, 0, 21, 1, 12, 'h');
  fill(g, 11, 21, 1, 12, 'h');
  fill(g, 11, 27, 1, 2, 'g');            // entrance from the sidewalk
  fill(g, 5, 27, 6, 2, 'd');             // path to the bench
  add({ kind: 'sign', style: 'park', x: 11, y: 25, text: '{kouen}' });
  add({ kind: 'bench', x: 5, y: 26, w: 2, h: 1, use: 'bench' });
  add({ kind: 'vending', x: 9, y: 24, use: 'talk', script: 'vending' });
  for (const [x, y] of [[3, 23], [7, 23], [2, 30], [9, 30], [5, 30]]) add({ kind: 'tree', x, y });

  // East side: the university behind its fence, gate onto Daigaku-dōri
  fill(g, 28, 12, 12, 1, 'n');
  fill(g, 28, 33, 12, 1, 'n');
  fill(g, 28, 12, 1, 22, 'n');
  fill(g, 28, 22, 1, 2, 'p');
  fill(g, 29, 22, 6, 2, 'p');
  add({ kind: 'sign', style: 'gate', x: 28, y: 21, text: '{daigaku}' });
  add({ kind: 'building', style: 'brick', x: 31, y: 15, w: 7, h: 5 });
  for (const [x, y] of [[30, 26], [33, 28], [36, 25], [38, 30], [31, 31]]) add({ kind: 'tree', green: true, x, y });

  // South-west: konbini and houses
  add({ kind: 'building', style: 'house', x: 1, y: 42, w: 4, h: 5 });
  add({ kind: 'building', style: 'konbini', x: 6, y: 42, w: 6, h: 5 });
  add({ kind: 'sign', style: 'konbini', x: 11, y: 44, text: '{konbini}' });
  add({ kind: 'building', style: 'house2', x: 1, y: 49, w: 4, h: 5 });
  add({ kind: 'building', style: 'house', x: 6, y: 49, w: 6, h: 5 });
  add({ kind: 'building', style: 'house2', x: 1, y: 55, w: 10, h: 4 });

  // South-east: your apartment on a quiet lane
  fill(g, 28, 47, 12, 2, 'l');
  add({ kind: 'building', style: 'apartment', x: 30, y: 43, w: 7, h: 4 });
  add({ kind: 'door', x: 31, y: 46, to: 'apartment', tx: 2, ty: 7, dir: 'up' });
  add({ kind: 'sign', style: 'shop', x: 34, y: 46, text: '{haitsu}{kunitachi}' });
  add({ kind: 'gomi', x: 37, y: 46 });
  add({ kind: 'sign', style: 'gomi', x: 38, y: 46, text: '{moeru}{gomi}', extra: '月・木' });
  add({ kind: 'decal', block: false, x: 29, y: 47, w: 1, h: 2, text: '{tomare}' });
  add({ kind: 'building', style: 'house2', x: 28, y: 49, w: 4, h: 5 });
  add({ kind: 'building', style: 'house', x: 33, y: 49, w: 5, h: 5 });
  add({ kind: 'building', style: 'house2', x: 28, y: 55, w: 11, h: 4 });

  const npcs = [
    // The old man feeds pigeons on the bench every morning until 10:30.
    { id: 'hiro', x: 5, y: 26, from: 7 * 60, to: 10 * 60 + 30, sit: true, script: 'hiro' },
    // Your neighbor sweeps the lane until 8:30.
    { id: 'ono', x: 35, y: 47, from: 7 * 60, to: 8 * 60 + 30, script: 'ono' },
  ];

  return { id: 'town', name: 'Kunitachi', w: W, h: H, ground: g, things, npcs, outdoors: true };
}

function buildApartment() {
  const W = 9, H = 9;
  const g = grid(W, H, 'w');
  fill(g, 1, 1, 7, 6, 't');
  fill(g, 1, 7, 7, 1, 'f');
  fill(g, 1, 7, 2, 1, 'k');
  const things = [];
  const add = t => things.push({ w: 1, h: 1, block: true, ...t });
  add({ kind: 'futon', block: false, x: 1, y: 1, w: 2, h: 3, use: 'talk', script: 'futon' });
  add({ kind: 'table', x: 4, y: 3, w: 2, h: 2 });
  add({ kind: 'item', icon: 'phrasebook', x: 4, y: 3, use: 'talk', script: 'phrasebook' });
  add({ kind: 'item', icon: 'bible', x: 5, y: 4, use: 'talk', script: 'bible' });
  add({ kind: 'counter', x: 5, y: 7, w: 3, h: 1 });
  add({ kind: 'door', x: 2, y: 8, to: 'town', tx: 31, ty: 47, dir: 'down' });
  return { id: 'apartment', name: 'Your apartment', w: W, h: H, ground: g, things, npcs: [], outdoors: false };
}

export const MAPS = { town: buildTown(), apartment: buildApartment() };

export function npcPresent(npc, time) {
  return time >= npc.from && time < npc.to;
}

export function thingAt(map, x, y) {
  // Topmost interactive thing first (signs/items sit on buildings/tables).
  for (let i = map.things.length - 1; i >= 0; i--) {
    const t = map.things[i];
    if (x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h && isInteractive(t)) return t;
  }
  return null;
}

export function isInteractive(t) {
  return t.kind === 'sign' || t.kind === 'decal' || t.kind === 'door' || !!t.use;
}

export function blocked(map, x, y, time) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return true;
  if (BLOCKING_GROUND.has(map.ground[y][x])) return true;
  for (const t of map.things) {
    if (t.block && x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h) return true;
  }
  for (const n of map.npcs) {
    if (!n.sit && npcPresent(n, time) && n.x === x && n.y === y) return true;
  }
  return false;
}

// Breadth-first search from (sx,sy) to any tile where isGoal(x,y) is true.
// Returns the steps to take (start excluded), or null if unreachable.
export function findPath(map, sx, sy, isGoal, time) {
  if (isGoal(sx, sy)) return [];
  const key = (x, y) => y * map.w + x;
  const prev = new Map([[key(sx, sy), null]]);
  const queue = [[sx, sy]];
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of dirs) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (prev.has(k) || blocked(map, nx, ny, time)) continue;
      prev.set(k, key(x, y));
      if (isGoal(nx, ny)) {
        const path = [];
        let c = k;
        while (c !== key(sx, sy)) {
          path.unshift({ x: c % map.w, y: Math.floor(c / map.w) });
          c = prev.get(c);
        }
        return path;
      }
      queue.push([nx, ny]);
    }
  }
  return null;
}
