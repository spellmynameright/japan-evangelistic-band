"""Pack build_characters.py's frames into one sheet for the game.

    python3 walk/art/pack_characters.py <frames_dir> <asset_dir>

Writes characters.webp (uniform grid) and characters.json:
  { cell: [w, h], anchor: [x, y], scale, frames: { name: [col, row] } }
cell and anchor are in sheet pixels (2x); anchor is where the feet are.
"""
import json, os, sys
from PIL import Image, ImageEnhance

SRC, DST = sys.argv[1], sys.argv[2]
os.makedirs(DST, exist_ok=True)
meta = json.load(open(os.path.join(SRC, 'frames.json')))
cw, ch = meta['cell']
cols = 8
names = meta['frames']
sheet = Image.new('RGBA', (cols * cw, ((len(names) + cols - 1) // cols) * ch), (0, 0, 0, 0))
frames = {}
for i, name in enumerate(names):
    im = Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')
    a = im.getchannel('A')
    im = ImageEnhance.Color(im.convert('RGB')).enhance(1.08)  # same grade as the town
    im.putalpha(a)
    col, row = i % cols, i // cols
    sheet.paste(im, (col * cw, row * ch))
    frames[name] = [col, row]
sheet.save(os.path.join(DST, 'characters.webp'), quality=92, method=6)
json.dump({'cell': [cw, ch], 'anchor': meta['anchor'], 'scale': meta['px'] // 32, 'frames': frames},
          open(os.path.join(DST, 'characters.json'), 'w'), separators=(',', ':'))
print('PACK_OK', len(frames), 'frames')
