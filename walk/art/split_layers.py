"""Turn build_scene.py's renders into game assets.

    python3 walk/art/split_layers.py <render_dir> <asset_dir>

Reads ground.png / objects.png / index.png / meta.json and writes:
  ground-N.webp  the floor, cut into horizontal bands (easier on iPhone memory)
  sprites-N.webp every standing object cut out on its own, packed into atlases
  art.json       where each band and sprite goes, plus the map row it stands on
                 (the game draws sprites and people sorted by that row)
Colour grading happens here too, so it can be tuned without re-rendering.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageEnhance

SRC, DST = sys.argv[1], sys.argv[2]
os.makedirs(DST, exist_ok=True)
meta = json.load(open(os.path.join(SRC, 'meta.json')))
rows = {int(k): v for k, v in meta['rows'].items()}
OVERHEAD = meta['overhead']
ATLAS_W = 2048
BAND_H = 1024


def grade(rgb):
    """Warm, saturated spring morning."""
    img = ImageEnhance.Color(rgb).enhance(1.08)
    img = ImageEnhance.Contrast(img).enhance(1.05)
    a = np.asarray(img).astype(np.float32)
    lum = a.mean(axis=2, keepdims=True) / 255
    warm = np.array([1.04, 1.0, 0.95])            # highlights lean warm
    cool = np.array([0.96, 0.99, 1.05])           # shadows lean blue
    a = a * (cool + (warm - cool) * lum)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


ground = grade(Image.open(os.path.join(SRC, 'ground.png')).convert('RGB'))
# Above row 0 there is no map, only headroom for tall roofs. Mirror the first
# rows of the map up into it so the camera never shows a black band.
margin = int(meta['top'] * 32 * meta['scale'])
if margin:
    strip = ground.crop((0, margin, ground.width, margin * 2)).transpose(Image.FLIP_TOP_BOTTOM)
    ground.paste(strip, (0, 0))
objects = Image.open(os.path.join(SRC, 'objects.png')).convert('RGBA')
alpha = objects.getchannel('A')
objects = grade(objects.convert('RGB'))
objects.putalpha(alpha)

idx = np.asarray(Image.open(os.path.join(SRC, 'index.png')).convert('RGBA')).astype(np.int32)
ids = idx[:, :, 0] + 256 * idx[:, :, 1]
ids[idx[:, :, 3] == 0] = 0
alpha_np = np.asarray(alpha)

# Anti-aliased edges exist in objects.png but not in the (unfiltered) id map:
# grow ids outward a few pixels into any coloured pixel that has none.
for _ in range(4):
    hole = (ids == 0) & (alpha_np > 0)
    if not hole.any():
        break
    grown = ids.copy()
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        shifted = np.roll(np.roll(ids, dy, axis=0), dx, axis=1)
        grown = np.where((grown == 0) & (shifted > 0), shifted, grown)
    ids = np.where(hole, grown, ids)

obj_np = np.asarray(objects)
sprites = []
for sid in np.unique(ids):
    if sid == 0:
        continue
    mask = ids == sid
    ys, xs = np.nonzero(mask)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    crop = obj_np[y0:y1, x0:x1].copy()
    crop[:, :, 3] = np.where(mask[y0:y1, x0:x1], crop[:, :, 3], 0)
    if crop[:, :, 3].max() == 0:
        continue
    # Any id Blender didn't hand out is the power lines (their large id doesn't
    # survive the 8-bit index pass intact).
    overhead = sid == OVERHEAD or int(sid) not in rows
    sprites.append({'id': OVERHEAD if overhead else int(sid), 'img': Image.fromarray(crop), 'dx': int(x0), 'dy': int(y0),
                    'z': 'overhead' if overhead else rows[int(sid)]})

# Shelf-pack into atlases, tallest first. Anything wider than an atlas (the
# power lines) gets a sheet of its own.
sprites.sort(key=lambda s: -s['img'].height)
atlases = []
for s in [s for s in sprites if s['img'].width > ATLAS_W]:
    s['a'], s['sx'], s['sy'] = len(atlases), 0, 0
    atlases.append([s])
sprites = [s for s in sprites if s['img'].width <= ATLAS_W]
x = y = shelf = 0
cur = []
for s in sprites:
    w, h = s['img'].size
    if x + w > ATLAS_W:
        x, y, shelf = 0, y + shelf + 2, 0
    if y + h > 4096:
        atlases.append(cur); cur = []
        x = y = shelf = 0
    s['a'], s['sx'], s['sy'] = len(atlases), x, y
    cur.append(s)
    x += w + 2
    shelf = max(shelf, h)
atlases.append(cur)

out = {'map': meta['map'], 'scale': meta['scale'], 'top': meta['top'], 'k': meta['k'],
       'px_w': ground.width, 'px_h': ground.height, 'ground': [], 'atlases': [], 'sprites': []}
for i in range(0, ground.height, BAND_H):
    name = f'ground-{i // BAND_H}.webp'
    ground.crop((0, i, ground.width, min(ground.height, i + BAND_H))).save(os.path.join(DST, name), quality=86, method=6)
    out['ground'].append({'src': name, 'y': i})
for ai, group in enumerate(atlases):
    hgt = max(s['sy'] + s['img'].height for s in group)
    atlas = Image.new('RGBA', (max(ATLAS_W, max(s['img'].width for s in group)), hgt), (0, 0, 0, 0))
    for s in group:
        atlas.paste(s['img'], (s['sx'], s['sy']))
        out['sprites'].append({k: s[k] for k in ('id', 'z', 'a', 'sx', 'sy', 'dx', 'dy')} | {'w': s['img'].width, 'h': s['img'].height})
    name = f'sprites-{ai}.webp'
    atlas.save(os.path.join(DST, name), quality=90, method=6)
    out['atlases'].append(name)
json.dump(out, open(os.path.join(DST, 'art.json'), 'w'), separators=(',', ':'))
print(f"SPLIT_OK {len(out['sprites'])} sprites, {len(out['atlases'])} atlas(es), {len(out['ground'])} ground bands")
