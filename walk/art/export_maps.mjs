// Writes walk/art/maps.json from walk/js/maps.js so Blender builds exactly
// the map the game walks on.  Run: node walk/art/export_maps.mjs
import { writeFileSync } from 'node:fs';
import { MAPS } from '../js/maps.js';

const out = {};
for (const [id, m] of Object.entries(MAPS)) {
  out[id] = { id, w: m.w, h: m.h, ground: m.ground.map(r => r.join('')), things: m.things, wires: m.wires };
}
writeFileSync(new URL('./maps.json', import.meta.url), JSON.stringify(out));
console.log('wrote maps.json', Object.keys(out).join(', '));
