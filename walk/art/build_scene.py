"""Build a walk/ map in 3D and render it as game art.

    blender -b --python walk/art/build_scene.py -- <map_id> <out_dir> [preview x0 y0 x1 y1]

Renders three images from one tilted orthographic camera:
  ground.png   floor only, with every object's shadow falling on it
  objects.png  everything that stands up (transparent background)
  index.png    which map row each object pixel belongs to (for depth sorting)
plus meta.json. split_layers.py then cuts objects.png into per-row strips.

Projection (1x), the classic top-down RPG "oblique" view: the camera looks
straight down and every vertex is sheared north by its height (Y += z*K), so
the ground stays square and building fronts stand up on screen.
Map tile (x, y) top-left is at (x*32, (top + y)*32); a point at height z is
drawn K*z*32 px higher. One map tile = one Blender unit; Blender Y = -map y.
"""
import bpy, bmesh, json, math, os, random, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
MAP_ID, OUT = argv[0], argv[1]
PREVIEW = [int(v) for v in argv[3:7]] if len(argv) > 2 and argv[2] == 'preview' else None
HERE = os.path.dirname(os.path.abspath(__file__))
MAP = json.load(open(os.path.join(HERE, 'maps.json')))[MAP_ID]
W, H = MAP['w'], MAP['h']
TOP = 7.0 if MAP_ID == 'town' else 3.0   # units of headroom above row 0 for tall things
SCALE = 2                                # rendered px per game px
K = 0.85                                 # how far height leans up the screen
OVERHEAD = 65000                         # index id for power lines
IDS = {}                                 # sprite id -> map row it stands on
random.seed(7)
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
COL = scene.collection

# ── Materials ───────────────────────────────────────────────────────────────
_mats = {}

def mat(name, color, rough=0.8, metal=0.0, emit=None, emit_strength=1.0, noise=None, brick=None, wave=None, sss=0.0, bump=0.0):
    """Principled material; optional world-space noise tint, brick or wave pattern,
    and bump from whichever pattern it uses."""
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if sss:
        bsdf.inputs['Subsurface Weight'].default_value = sss
    coord = nt.nodes.new('ShaderNodeTexCoord')
    base = (*color, 1)
    if brick:
        b = nt.nodes.new('ShaderNodeTexBrick')
        b.inputs['Color1'].default_value = base
        b.inputs['Color2'].default_value = (*brick['c2'], 1)
        b.inputs['Mortar'].default_value = (*brick['mortar'], 1)
        b.inputs['Scale'].default_value = brick.get('scale', 4)
        b.inputs['Mortar Size'].default_value = brick.get('mortar_size', 0.02)
        b.inputs['Brick Width'].default_value = brick.get('bw', 0.5)
        b.inputs['Row Height'].default_value = brick.get('rh', 0.25)
        nt.links.new(coord.outputs['Object'], b.inputs['Vector'])
        out = b.outputs['Color']
        fac = b.outputs['Fac']
    elif wave:
        wv = nt.nodes.new('ShaderNodeTexWave')
        wv.bands_direction = wave.get('dir', 'X')
        wv.inputs['Scale'].default_value = wave.get('scale', 4)
        wv.inputs['Distortion'].default_value = wave.get('distortion', 2)
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = base
        ramp.color_ramp.elements[1].color = (*wave['c2'], 1)
        nt.links.new(coord.outputs['Object'], wv.inputs['Vector'])
        nt.links.new(wv.outputs['Fac'], ramp.inputs['Fac'])
        out = ramp.outputs['Color']
        fac = wv.outputs['Fac']
    else:
        out = None
        fac = None
    if noise:
        n = nt.nodes.new('ShaderNodeTexNoise')
        n.inputs['Scale'].default_value = noise.get('scale', 3)
        n.inputs['Detail'].default_value = 6
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].position = 0.35
        ramp.color_ramp.elements[1].position = 0.7
        ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
        ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
        nt.links.new(coord.outputs['Object'], n.inputs['Vector'])
        nt.links.new(n.outputs['Fac'], ramp.inputs['Fac'])
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        nt.links.new(ramp.outputs['Color'], mix.inputs['Factor'])
        if out is not None:
            nt.links.new(out, mix.inputs['A'])
        else:
            mix.inputs['A'].default_value = base
        mix.inputs['B'].default_value = (*noise['c2'], 1)
        out = mix.outputs['Result']
        fac = fac or n.outputs['Fac']
    if bump and fac is not None:
        bp = nt.nodes.new('ShaderNodeBump')
        bp.inputs['Strength'].default_value = bump
        bp.inputs['Distance'].default_value = 0.02
        nt.links.new(fac, bp.inputs['Height'])
        nt.links.new(bp.outputs['Normal'], bsdf.inputs['Normal'])
    if out is not None:
        nt.links.new(out, bsdf.inputs['Base Color'])
    else:
        bsdf.inputs['Base Color'].default_value = base
    if emit:
        bsdf.inputs['Emission Color'].default_value = (*emit, 1)
        bsdf.inputs['Emission Strength'].default_value = emit_strength
    _mats[name] = m
    return m

M = {
    'g': mat('grass', (0.22, 0.42, 0.08), 0.95, noise={'c2': (0.38, 0.55, 0.12), 'scale': 3.5}, bump=0.3),
    'p': mat('plaza', (0.55, 0.51, 0.46), 0.85, brick={'c2': (0.50, 0.47, 0.43), 'mortar': (0.36, 0.34, 0.31), 'scale': 1.6, 'bw': 0.5, 'rh': 0.5}),
    'r': mat('asphalt', (0.09, 0.09, 0.10), 0.9, noise={'c2': (0.13, 0.13, 0.14), 'scale': 18}),
    's': mat('sidewalk', (0.52, 0.47, 0.40), 0.85, brick={'c2': (0.45, 0.41, 0.35), 'mortar': (0.32, 0.30, 0.27), 'scale': 3.2, 'bw': 0.5, 'rh': 0.25}),
    'l': mat('lane', (0.15, 0.15, 0.16), 0.9, noise={'c2': (0.19, 0.19, 0.20), 'scale': 14}),
    'd': mat('dirt', (0.45, 0.35, 0.22), 0.95, noise={'c2': (0.52, 0.42, 0.28), 'scale': 6}),
    'h': mat('grass_under_hedge', (0.16, 0.30, 0.08), 0.95),
    'n': mat('grass_fence', (0.20, 0.38, 0.09), 0.95, noise={'c2': (0.33, 0.48, 0.12), 'scale': 2.5}),
    't': mat('tatami', (0.55, 0.52, 0.28), 0.8, wave={'c2': (0.62, 0.58, 0.33), 'scale': 30, 'distortion': 0, 'dir': 'Y'}),
    'f': mat('woodfloor', (0.36, 0.22, 0.12), 0.5, wave={'c2': (0.44, 0.29, 0.16), 'scale': 3, 'distortion': 3, 'dir': 'X'}),
    'k': mat('genkan', (0.32, 0.32, 0.31), 0.9, noise={'c2': (0.38, 0.38, 0.36), 'scale': 10}),
    'w': mat('plaster_floor', (0.4, 0.37, 0.32), 0.9),
}
WHITE = mat('paint_white', (0.82, 0.80, 0.76), 0.6)
LINE = mat('road_paint', (0.85, 0.85, 0.82), 0.5)
GLASS = mat('glass', (0.05, 0.09, 0.14), 0.08, metal=0.3)
GLASS_LIT = mat('glass_lit', (0.25, 0.22, 0.16), 0.15, emit=(1.0, 0.85, 0.6), emit_strength=1.6)
FRAME = mat('alu_frame', (0.7, 0.71, 0.72), 0.35, metal=0.8)
DARK_METAL = mat('dark_metal', (0.06, 0.06, 0.07), 0.45, metal=0.7)
WOOD = mat('wood', (0.33, 0.19, 0.09), 0.6, wave={'c2': (0.42, 0.26, 0.13), 'scale': 6, 'distortion': 4})
WOOD_DARK = mat('wood_dark', (0.12, 0.07, 0.04), 0.6)
TRUNK = mat('bark', (0.17, 0.11, 0.08), 0.95, noise={'c2': (0.10, 0.07, 0.05), 'scale': 12})
BLOSSOM = mat('blossom', (0.97, 0.55, 0.68), 0.6, noise={'c2': (1.0, 0.82, 0.88), 'scale': 9}, sss=0.2, bump=0.6)
LEAF = mat('leaf', (0.12, 0.30, 0.06), 0.8, noise={'c2': (0.26, 0.42, 0.10), 'scale': 4})
HEDGE = mat('hedge', (0.06, 0.20, 0.04), 0.85, noise={'c2': (0.16, 0.32, 0.07), 'scale': 5})
CONCRETE = mat('concrete', (0.48, 0.47, 0.45), 0.9, noise={'c2': (0.55, 0.54, 0.51), 'scale': 8})
RED = mat('post_red', (0.65, 0.04, 0.03), 0.35)
NET = mat('gomi_net', (0.05, 0.30, 0.15), 0.7)
STEEL = mat('steel', (0.6, 0.62, 0.64), 0.3, metal=0.9)

def kawara(name, c, c2):
    return mat(name, c, 0.45, brick={'c2': c2, 'mortar': tuple(v * 0.45 for v in c), 'scale': 7, 'bw': 0.35, 'rh': 0.18, 'mortar_size': 0.03}, bump=0.8)

def siding(name, c, c2):
    return mat(name, c, 0.85, wave={'c2': c2, 'scale': 14, 'distortion': 0, 'dir': 'Z'}, bump=0.15)

WALLS = {
    'house':     (siding('wall_house', (0.82, 0.77, 0.67), (0.76, 0.71, 0.61)), kawara('roof_kawara', (0.13, 0.16, 0.22), (0.17, 0.21, 0.28))),
    'house2':    (siding('wall_house2', (0.74, 0.66, 0.54), (0.68, 0.60, 0.48)), kawara('roof_brown', (0.30, 0.14, 0.08), (0.38, 0.19, 0.11))),
    'shop':      (mat('wall_shop', (0.72, 0.68, 0.60), 0.8), mat('roof_flat', (0.30, 0.31, 0.32), 0.85, noise={'c2': (0.36, 0.37, 0.38), 'scale': 6})),
    'shop2':     (mat('wall_shop2', (0.55, 0.47, 0.38), 0.8, brick={'c2': (0.5, 0.42, 0.33), 'mortar': (0.62, 0.58, 0.52), 'scale': 4, 'bw': 0.5, 'rh': 0.2}, bump=0.3), mat('roof_flat2', (0.26, 0.26, 0.27), 0.85, noise={'c2': (0.32, 0.32, 0.33), 'scale': 6})),
    'bakery':    (mat('wall_bakery', (0.86, 0.76, 0.56), 0.8), kawara('roof_bakery', (0.36, 0.13, 0.06), (0.45, 0.18, 0.09))),
    'konbini':   (mat('wall_konbini', (0.88, 0.88, 0.86), 0.6), mat('roof_konbini', (0.55, 0.56, 0.57), 0.8)),
    'brick':     (mat('brick', (0.42, 0.17, 0.10), 0.85, brick={'c2': (0.36, 0.14, 0.08), 'mortar': (0.55, 0.50, 0.44), 'scale': 6, 'bw': 0.5, 'rh': 0.25}, bump=0.4), kawara('roof_slate', (0.16, 0.13, 0.12), (0.2, 0.17, 0.15))),
    'apartment': (siding('wall_apartment', (0.84, 0.80, 0.70), (0.79, 0.75, 0.65)), mat('roof_apartment', (0.08, 0.15, 0.20), 0.45, wave={'c2': (0.12, 0.21, 0.27), 'scale': 18, 'distortion': 0, 'dir': 'X'}, bump=0.5)),
    'station':   (mat('wall_station', (0.90, 0.87, 0.80), 0.75), kawara('roof_station', (0.62, 0.08, 0.05), (0.74, 0.13, 0.07))),
}
BLOCK = mat('block_wall', (0.55, 0.54, 0.51), 0.9, brick={'c2': (0.5, 0.49, 0.46), 'mortar': (0.4, 0.39, 0.37), 'scale': 5, 'bw': 0.4, 'rh': 0.2, 'mortar_size': 0.015}, bump=0.4)
CLOTHES = [mat('cloth_w', (0.9, 0.9, 0.88), 0.9), mat('cloth_b', (0.2, 0.35, 0.65), 0.9), mat('cloth_p', (0.9, 0.55, 0.6), 0.9), mat('cloth_y', (0.92, 0.8, 0.3), 0.9), mat('cloth_g', (0.35, 0.55, 0.4), 0.9)]
CURTAINS = [mat('curtain_cream', (0.75, 0.68, 0.5), 0.9), mat('curtain_green', (0.3, 0.45, 0.35), 0.9), mat('curtain_rose', (0.7, 0.45, 0.45), 0.9)]
BLOSSOMS = [BLOSSOM, mat('blossom_light', (1.0, 0.80, 0.86), 0.65, sss=0.15), mat('blossom_deep', (0.88, 0.45, 0.58), 0.65, sss=0.15)]
BLOSSOM_CORE = mat('blossom_core', (0.55, 0.28, 0.35), 0.8)
LEAVES = [LEAF, mat('leaf_light', (0.30, 0.48, 0.12), 0.8), mat('leaf_dark', (0.08, 0.22, 0.05), 0.8)]

# ── Geometry helpers ────────────────────────────────────────────────────────
_current = {'id': 0}

def new_sprite(row):
    """Start a new sprite: everything linked until the next call shares its id."""
    _current['id'] = len(IDS) + 1
    IDS[_current['id']] = row

def link(name, me, m, ground=False):
    me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    COL.objects.link(ob)
    ob['ground'] = ground
    ob.pass_index = 0 if ground else _current['id']
    return ob

def mesh(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    return me

def box(name, x0, y0, z0, x1, y1, z1, m, bevel=0.0, **kw):
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
         (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    ob = link(name, mesh(name, v, f), m, **kw)
    if bevel:
        mod = ob.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
    return ob

def cyl(name, x, y, z0, z1, r, m, n=12, **kw):
    v, f = [], []
    for i in range(n):
        a = 2 * math.pi * i / n
        v += [(x + r * math.cos(a), y + r * math.sin(a), z0), (x + r * math.cos(a), y + r * math.sin(a), z1)]
    for i in range(n):
        j = (i + 1) % n
        f.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
    f.append(tuple(2 * i for i in reversed(range(n))))
    f.append(tuple(2 * i + 1 for i in range(n)))
    return link(name, mesh(name, v, f), m, **kw)

def blob(name, center, r, m, subdiv=2, wobble=0.18, **kw):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=r)
    for v in bm.verts:
        v.co *= 1 + random.uniform(-wobble, wobble)
        v.co += Vector(center)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return link(name, me, m, **kw)

def gable(name, x0, x1, ys, yn, z, rise, m, overhang=0.25, ridge='X', **kw):
    """Gable roof. ridge='X' runs east–west (slopes face south and north)."""
    x0, x1, ys, yn = x0 - overhang, x1 + overhang, ys - overhang, yn + overhang
    if ridge == 'X':
        ym = (ys + yn) / 2
        v = [(x0, ys, z), (x1, ys, z), (x1, yn, z), (x0, yn, z), (x0, ym, z + rise), (x1, ym, z + rise)]
    else:
        xm = (x0 + x1) / 2
        v = [(x0, ys, z), (x1, ys, z), (x1, yn, z), (x0, yn, z), (xm, ys, z + rise), (xm, yn, z + rise)]
    f = [(0, 1, 5, 4), (2, 3, 4, 5), (1, 2, 5), (3, 0, 4)] if ridge == 'X' else [(1, 2, 5, 4), (3, 0, 4, 5), (0, 1, 4), (2, 3, 5)]
    ob = link(name, mesh(name, v, f), m, **kw)
    sol = ob.modifiers.new('thick', 'SOLIDIFY')
    sol.thickness = 0.1
    return ob

def gable_wall(name, x0, x1, y, z, rise, m, **kw):
    """Triangle infill under a ridge='Y' gable, on a south face at Y=y."""
    xm = (x0 + x1) / 2
    return link(name, mesh(name, [(x0, y, z), (x1, y, z), (xm, y, z + rise)], [(0, 1, 2)]), m, **kw)

def hip(name, x0, x1, ys, yn, z, rise, m, overhang=0.3, **kw):
    """Hipped roof (寄棟): four slopes, short east–west ridge."""
    x0, x1, ys, yn = x0 - overhang, x1 + overhang, ys - overhang, yn + overhang
    ym, d = (ys + yn) / 2, (yn - ys) / 2
    r0, r1 = (min(x0 + d, (x0 + x1) / 2 - 0.01), ym, z + rise), (max(x1 - d, (x0 + x1) / 2 + 0.01), ym, z + rise)
    v = [(x0, ys, z), (x1, ys, z), (x1, yn, z), (x0, yn, z), r0, r1]
    ob = link(name, mesh(name, v, [(0, 1, 5, 4), (2, 3, 4, 5), (1, 2, 5), (3, 0, 4)]), m, **kw)
    sol = ob.modifiers.new('thick', 'SOLIDIFY')
    sol.thickness = 0.1
    box(name + '_ridge', r0[0] - 0.05, ym - 0.08, z + rise - 0.03, r1[0] + 0.05, ym + 0.08, z + rise + 0.09, m)
    return ob

def limb(name, p0, p1, r0, r1, m, n=7, **kw):
    """Tapered cylinder between two points (branches)."""
    p0, p1 = Vector(p0), Vector(p1)
    axis = (p1 - p0).normalized()
    side = axis.cross(Vector((0, 0, 1)) if abs(axis.z) < 0.95 else Vector((1, 0, 0))).normalized()
    up = axis.cross(side)
    v, f = [], []
    for i in range(n):
        a = 2 * math.pi * i / n
        off = side * math.cos(a) + up * math.sin(a)
        v += [tuple(p0 + off * r0), tuple(p1 + off * r1)]
    for i in range(n):
        j = (i + 1) % n
        f.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
    ob = link(name, mesh(name, v, f), m, **kw)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob

def disc(name, x, y, z, r, m, n=6, squash=1.0, **kw):
    v = [(x + r * math.cos(2 * math.pi * i / n), y + r * squash * math.sin(2 * math.pi * i / n), z) for i in range(n)]
    return link(name, mesh(name, v, [tuple(range(n))]), m, **kw)

def quad(name, x0, y0, x1, y1, z, m, **kw):
    return link(name, mesh(name, [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], [(0, 1, 2, 3)]), m, **kw)

def window(name, x, ys, z0, w, h, lit=False):
    box(name + '_frame', x - 0.04, ys - 0.05, z0 - 0.04, x + w + 0.04, ys + 0.01, z0 + h + 0.04, FRAME)
    box(name + '_glass', x, ys - 0.07, z0, x + w, ys - 0.03, z0 + h, GLASS_LIT if lit else GLASS)

def by(my):
    return -my  # map y → Blender Y

# ── Ground ──────────────────────────────────────────────────────────────────
def build_ground():
    groups = {}
    for my, row in enumerate(MAP['ground']):
        for mx, ch in enumerate(row):
            groups.setdefault(ch, []).append((mx, my))
    for ch, tiles in groups.items():
        z = -0.12 if ch == 'k' else (-0.04 if ch in 'rl' else 0.0)
        v, f = [], []
        for mx, my in tiles:
            i = len(v)
            v += [(mx, by(my + 1), z), (mx + 1, by(my + 1), z), (mx + 1, by(my), z), (mx, by(my), z)]
            f.append((i, i + 1, i + 2, i + 3))
        link('ground_' + ch, mesh('ground_' + ch, v, f), M.get(ch, M['g']), ground=True)
    # curbs: a small step between road and anything not road
    g = MAP['ground']
    for my in range(H):
        for mx in range(W):
            if g[my][mx] not in 'rl':
                continue
            for dx, dy, side in ((0, -1, 'n'), (0, 1, 's'), (-1, 0, 'w'), (1, 0, 'e')):
                nx, ny = mx + dx, my + dy
                if 0 <= nx < W and 0 <= ny < H and g[ny][nx] not in 'rl':
                    if side == 'n': box('curb', mx, by(my) - 0.05, -0.04, mx + 1, by(my), 0.03, CONCRETE, ground=True)
                    if side == 's': box('curb', mx, by(my + 1), -0.04, mx + 1, by(my + 1) + 0.05, 0.03, CONCRETE, ground=True)
                    if side == 'w': box('curb', mx, by(my + 1), -0.04, mx + 0.05, by(my), 0.03, CONCRETE, ground=True)
                    if side == 'e': box('curb', mx + 0.95, by(my + 1), -0.04, mx + 1, by(my), 0.03, CONCRETE, ground=True)
    if MAP_ID == 'town':
        # Daigaku-dōri centre line, Sakura-dōri centre line, edge lines
        for my in range(12, 60):
            if 34 <= my <= 41:
                continue
            box('cline', 19.94, by(my) - 0.7, -0.039, 20.06, by(my) - 0.2, -0.035, LINE, ground=True)
        for mx in range(0, 40):
            if 14 <= mx <= 25:
                continue
            box('sline', mx + 0.2, by(38) - 0.06, -0.039, mx + 0.7, by(38) + 0.06, -0.035, LINE, ground=True)
        # Clover, dandelions and tiny white flowers in the grass
        flower_m = [mat('dandelion', (0.95, 0.78, 0.08), 0.6), mat('clover', (0.95, 0.95, 0.9), 0.7), mat('violet', (0.55, 0.35, 0.8), 0.6)]
        for my in range(H):
            for mx in range(W):
                if g[my][mx] == 'g' and random.random() < 0.3:
                    for _ in range(random.randint(1, 2)):
                        px, py = mx + random.random(), my + random.random()
                        disc('flower', px, by(py), 0.01, random.uniform(0.02, 0.035), random.choice(flower_m), ground=True)
        # Petals on the ground under the cherry trees
        for t in MAP['things']:
            if t['kind'] == 'tree' and not t.get('green'):
                for _ in range(16):
                    px, py = t['x'] + 0.5 + random.gauss(0, 0.9), t['y'] + 0.5 + random.gauss(0, 0.7)
                    if 0 <= px < W and 0 <= py < H:
                        z = 0.005 if g[int(py)][int(px)] not in 'rl' else -0.035
                        disc('petal', px, by(py), z, random.uniform(0.02, 0.035), BLOSSOMS[1], n=5, squash=0.6, ground=True)

def build_tile_objects():
    g = MAP['ground']
    for my in range(H):
        for mx in range(W):
            ch = g[my][mx]
            if ch in 'hn':
                new_sprite(my)
            if ch == 'h':
                box('hedge', mx - 0.02, by(my + 1) + 0.08, 0, mx + 1.02, by(my) - 0.08, 0.8, HEDGE, bevel=0.18)
            elif ch == 'n':
                y = by(my + 0.5)
                cyl('fpost', mx + 0.5, y, 0, 1.3, 0.035, DARK_METAL, n=6)
                box('frail', mx, y - 0.02, 1.2, mx + 1, y + 0.02, 1.25, DARK_METAL)
                box('frail', mx, y - 0.02, 0.2, mx + 1, y + 0.02, 0.24, DARK_METAL)
                for k in range(4):
                    box('fbar', mx + 0.12 + k * 0.25, y - 0.012, 0.2, mx + 0.14 + k * 0.25, y + 0.012, 1.2, DARK_METAL)
    if MAP_ID == 'town':
        lid = mat('gutter_lid', (0.5, 0.49, 0.46), 0.9, brick={'c2': (0.46, 0.45, 0.42), 'mortar': (0.2, 0.2, 0.2), 'scale': 2.2, 'bw': 1.0, 'rh': 0.9, 'mortar_size': 0.03}, bump=0.5)
        for mx in range(28, 40):
            box('gutter', mx, by(47) - 0.3, -0.035, mx + 1, by(47), 0.0, lid, ground=True)
            box('gutter', mx, by(49), -0.035, mx + 1, by(49) + 0.3, 0.0, lid, ground=True)
        cyl('manhole', 36.5, by(48), -0.035, -0.03, 0.32, mat('manhole', (0.2, 0.19, 0.18), 0.5, metal=0.6, noise={'c2': (0.3, 0.28, 0.26), 'scale': 30}), n=24, ground=True)

# ── Things ──────────────────────────────────────────────────────────────────
def rect(t):
    x0, x1 = t['x'] + 0.06, t['x'] + t['w'] - 0.06
    ys, yn = by(t['y'] + t['h']) + 0.06, by(t['y']) - 0.06
    return x0, x1, ys, yn

def build_building(t, n):
    style = t.get('style', 'house')
    wall_m, roof_m = WALLS.get(style, WALLS['house'])
    x0, x1, ys, yn = rect(t)
    w = x1 - x0
    if style == 'station':
        return build_station(t, n, wall_m, roof_m)
    if style in ('house', 'house2'):
        return build_house(t, n, wall_m, roof_m)
    hw = {'house': 3.4, 'house2': 3.4, 'shop': 3.6, 'shop2': 5.0, 'bakery': 3.2, 'konbini': 2.9, 'brick': 5.2, 'apartment': 4.4}.get(style, 3.4)
    box(n + '_wall', x0, ys, 0, x1, yn, hw, wall_m)
    box(n + '_base', x0 - 0.03, ys - 0.03, 0, x1 + 0.03, yn + 0.03, 0.18, CONCRETE)
    if style in ('bakery', 'apartment'):
        gable(n + '_roof', x0, x1, ys, yn, hw, 1.0 if style == 'apartment' else 1.3, roof_m, overhang=0.35)
    elif style == 'brick':
        gable(n + '_roof', x0, x1, ys, yn, hw, 1.6, roof_m, overhang=0.1)
    else:
        box(n + '_roof', x0 - 0.02, ys - 0.02, hw, x1 + 0.02, yn + 0.02, hw + 0.12, roof_m)
        box(n + '_parapet_s', x0 - 0.02, ys - 0.02, hw, x1 + 0.02, ys + 0.1, hw + 0.35, wall_m)
        box(n + '_unit', x0 + w * 0.6, ys + 0.6, hw + 0.12, x0 + w * 0.6 + 0.7, ys + 1.1, hw + 0.6, FRAME)

    if style == 'konbini':
        box(n + '_band1', x0, ys - 0.06, 2.2, x1, ys, 2.55, mat('band_blue', (0.05, 0.25, 0.65), 0.5))
        box(n + '_band2', x0, ys - 0.06, 2.0, x1, ys, 2.2, mat('band_green', (0.05, 0.45, 0.2), 0.5))
        box(n + '_band3', x0, ys - 0.06, 1.85, x1, ys, 2.0, mat('band_orange', (0.85, 0.35, 0.05), 0.5))
        window(n + '_front', x0 + 0.3, ys, 0.25, w - 0.6, 1.5, lit=True)
        return
    if style == 'bakery':
        stripes_a, stripes_b = mat('awning_red', (0.55, 0.05, 0.04), 0.7), mat('awning_cream', (0.85, 0.78, 0.62), 0.7)
        k = int(w / 0.3)
        for i in range(k):
            xa = x0 + i * w / k
            v = [(xa, ys, 2.35), (xa + w / k, ys, 2.35), (xa + w / k, ys - 0.8, 1.9), (xa, ys - 0.8, 1.9)]
            link(n + '_awning', mesh('awn', v, [(0, 1, 2, 3)]), stripes_a if i % 2 else stripes_b)
        window(n + '_display', x0 + 0.4, ys, 0.35, w - 1.6, 1.3, lit=True)
        box(n + '_door', x1 - 1.0, ys - 0.04, 0.18, x1 - 0.35, ys, 1.75, WOOD)
        return
    if style == 'apartment':
        floors = [0.0, 2.2]
        for fz in floors:
            for i in range(int(w // 1.6)):
                xa = x0 + 0.35 + i * 1.6
                box(n + '_door', xa, ys - 0.04, fz + 0.18, xa + 0.6, ys, fz + 1.85, mat('apt_door', (0.36, 0.33, 0.30), 0.6))
                window(n + '_win', xa + 0.8, ys, fz + 0.9, 0.55, 0.6)
        # 2F walkway, railing and the outside stair (east end)
        box(n + '_walk', x0, ys - 0.75, 2.05, x1, ys, 2.2, CONCRETE)
        box(n + '_rail', x0, ys - 0.78, 2.2, x1, ys - 0.72, 3.15, mat('rail', (0.75, 0.74, 0.70), 0.5, metal=0.5))
        stair = [(x1 + 0.05, ys - 0.75, 0.18), (x1 + 0.75, ys - 0.75, 0.18), (x1 + 0.75, yn, 2.2), (x1 + 0.05, yn, 2.2)]
        link(n + '_stair', mesh('stair', stair, [(0, 1, 2, 3)]), CONCRETE)
        box(n + '_stairrail', x1 + 0.72, ys - 0.75, 0.2, x1 + 0.76, yn, 3.1, mat('rail', (0.75, 0.74, 0.70), 0.5, metal=0.5))
        for j in range(6):
            box(n + '_mail', x0 + 0.2 + j * 0.28, ys - 0.05, 0.9, x0 + 0.45 + j * 0.28, ys, 1.15, STEEL)
        # a futon airing over the 2F railing
        v = [(x0 + 1.4, ys - 0.70, 3.18), (x0 + 2.4, ys - 0.70, 3.18), (x0 + 2.4, ys - 0.86, 2.55), (x0 + 1.4, ys - 0.86, 2.55)]
        link(n + '_futon_air', mesh('air', v, [(0, 1, 2, 3)]), mat('futon_air', (0.85, 0.55, 0.45), 0.9, wave={'c2': (0.92, 0.85, 0.75), 'scale': 9, 'distortion': 0, 'dir': 'X'}))
        return
    # shops, brick: a row of windows per floor and a door
    floors = int(hw // 1.7)
    for f in range(floors):
        fz = 0.4 + f * 1.7
        for i in range(max(1, int(w // 1.4))):
            xa = x0 + 0.35 + i * 1.4
            if f == 0 and i == 0 and style != 'brick':
                box(n + '_door', xa, ys - 0.04, 0.18, xa + 0.65, ys, 1.8, WOOD_DARK if style == 'house' else WOOD)
                box(n + '_hood', xa - 0.15, ys - 0.35, 1.95, xa + 0.8, ys, 2.02, wall_m)
                continue
            window(n + f'_w{f}{i}', xa, ys, fz + 0.3, 0.7, 0.85, lit=(style.startswith('shop') and f == 0))
    if style in ('house', 'house2'):
        box(n + '_ac', x1 - 0.95, ys - 0.35, 0.18, x1 - 0.25, ys, 0.75, mat('ac_unit', (0.78, 0.78, 0.75), 0.5))

def build_house(t, n, wall_m, roof_m):
    """A two-storey family house on its lot: block wall, gate, balcony laundry."""
    lx0, lx1, lys, lyn = rect(t)
    rnd = random.Random(t['x'] * 131 + t['y'])
    gate = lx0 + 0.5 + rnd.random() * max(0, (lx1 - lx0) - 2.5)
    for a, b in ((lx0, gate), (gate + 1.0, lx1)):
        if b - a > 0.05:
            box(n + '_bwall', a, lys, 0, b, lys + 0.16, 0.8, BLOCK)
            box(n + '_bcap', a - 0.01, lys - 0.01, 0.8, b + 0.01, lys + 0.17, 0.85, CONCRETE)
    for xa in (lx0, lx1 - 0.16):
        box(n + '_bwall_side', xa, lys, 0, xa + 0.16, lys + 1.1, 0.8, BLOCK)
    box(n + '_path', gate + 0.1, lys, 0, gate + 0.9, lys + 1.0, 0.03, CONCRETE)
    x0, x1, ys = lx0 + 0.25, lx1 - 0.25, lys + 1.0
    yn = min(lyn - 0.15, ys + 2.6)
    w, hw = x1 - x0, 2.7
    box(n + '_wall', x0, ys, 0, x1, yn, hw, wall_m)
    box(n + '_base', x0 - 0.03, ys - 0.03, 0, x1 + 0.03, yn + 0.03, 0.2, CONCRETE)
    box(n + '_band', x0 - 0.04, ys - 0.04, 1.5, x1 + 0.04, ys, 1.6, WHITE)
    if rnd.random() < 0.55:
        hip(n + '_roof', x0, x1, ys, yn, hw, 0.95, roof_m)
    else:
        gable(n + '_roof', x0, x1, ys, yn, hw, 0.95, roof_m, overhang=0.3)
        box(n + '_ridge', x0 - 0.3, (ys + yn) / 2 - 0.08, hw + 0.92, x1 + 0.3, (ys + yn) / 2 + 0.08, hw + 1.04, roof_m)
    # entrance under a little canopy, lined up with the gate
    dx = min(max(gate + 0.15, x0 + 0.2), x1 - 0.9)
    box(n + '_door', dx, ys - 0.04, 0.2, dx + 0.7, ys, 1.4, WOOD_DARK if rnd.random() < 0.5 else WOOD)
    box(n + '_canopy', dx - 0.15, ys - 0.45, 1.45, dx + 0.85, ys, 1.5, FRAME)
    cyl(n + '_lamp', dx + 0.82, ys - 0.06, 1.15, 1.3, 0.05, mat('porch_lamp', (0.9, 0.85, 0.7), 0.3, emit=(1, 0.85, 0.6), emit_strength=0.8))
    # windows: sliding sashes with curtains
    cm = rnd.choice(CURTAINS)
    xs = [xa for xa in [x0 + 0.3 + i * 1.25 for i in range(int(w // 1.25))] if not (dx - 0.8 < xa < dx + 0.8)]
    for xa in xs:
        window(n + '_w1', xa, ys, 0.45, 0.85, 0.8)
        box(n + '_cur1', xa + 0.05, ys - 0.03, 0.5, xa + 0.3, ys - 0.025, 1.2, cm)
    for i in range(int(w // 1.25)):
        xa = x0 + 0.3 + i * 1.25
        window(n + '_w2', xa, ys, 1.8, 0.85, 0.7)
        box(n + '_cur2', xa + 0.55, ys - 0.03, 1.85, xa + 0.8, ys - 0.025, 2.45, cm)
    # 2F balcony with laundry
    bx0, bx1 = x0 + 0.2, min(x1 - 0.2, x0 + 0.2 + rnd.uniform(1.6, 2.6))
    box(n + '_balc', bx0, ys - 0.7, 1.6, bx1, ys, 1.7, CONCRETE)
    box(n + '_brail', bx0, ys - 0.72, 1.7, bx1, ys - 0.66, 2.25, mat('balc_rail', (0.72, 0.72, 0.70), 0.4, metal=0.6))
    box(n + '_pole', bx0 + 0.1, ys - 0.45, 2.42, bx1 - 0.1, ys - 0.42, 2.45, STEEL)
    xa = bx0 + 0.2
    while xa < bx1 - 0.35:
        cw, ch = rnd.uniform(0.18, 0.32), rnd.uniform(0.25, 0.45)
        v = [(xa, ys - 0.44, 2.42), (xa + cw, ys - 0.44, 2.42), (xa + cw, ys - 0.44, 2.42 - ch), (xa, ys - 0.44, 2.42 - ch)]
        link(n + '_cloth', mesh('cloth', v, [(0, 1, 2, 3)]), rnd.choice(CLOTHES))
        xa += cw + rnd.uniform(0.04, 0.12)
    # outdoor AC unit, meter, a plant or two by the door
    ax = x1 - 0.85
    box(n + '_ac', ax, ys - 0.4, 0.2, ax + 0.65, ys - 0.02, 0.72, mat('ac_unit', (0.80, 0.80, 0.77), 0.5), bevel=0.02)
    cyl(n + '_fan', ax + 0.32, ys - 0.41, 0.3, 0.62, 0.0, DARK_METAL)
    box(n + '_meter', x1 - 0.25, ys - 0.06, 0.9, x1 - 0.1, ys, 1.1, FRAME)
    for k in range(rnd.randint(1, 3)):
        px = gate + 1.1 + k * 0.35
        if px < lx1 - 0.3:
            cyl(n + '_pot', px, lys + 0.45, 0, 0.3, 0.13, mat('pot', (0.45, 0.22, 0.12), 0.8), n=10)
            blob(n + '_plant', (px, lys + 0.45, 0.45), 0.17, rnd.choice(LEAVES), subdiv=1)

def build_station(t, n, wall_m, roof_m):
    x0, x1, ys, yn = rect(t)
    cx = (x0 + x1) / 2
    hw = 3.2
    box(n + '_wall', x0, ys, 0, x1, yn, hw, wall_m)
    box(n + '_base', x0 - 0.03, ys - 0.03, 0, x1 + 0.03, yn + 0.03, 0.25, CONCRETE)
    gable(n + '_wings', x0, x1, ys, yn, hw, 1.4, roof_m, overhang=0.3)
    # the steep central gable facing the plaza
    gx0, gx1 = cx - 2.4, cx + 2.4
    box(n + '_front', gx0, ys - 0.5, 0, gx1, ys + 1.0, hw, wall_m)
    gable(n + '_spire', gx0, gx1, ys - 0.5, ys + 2.2, hw, 4.2, roof_m, overhang=0.3, ridge='Y')
    gable_wall(n + '_gablewall', gx0, gx1, ys - 0.52, hw, 4.2, wall_m)
    # half-timbering on the gable + round window
    for k in (-1, 1):
        v = [(cx + k * 0.08, ys - 0.56, hw), (cx + k * 2.2, ys - 0.56, hw + 0.2), (cx + k * 2.2, ys - 0.56, hw + 0.34), (cx + k * 0.08, ys - 0.56, hw + 0.14)]
        link(n + '_beam', mesh('beam', v, [(0, 1, 2, 3)]), WOOD_DARK)
    box(n + '_post', cx - 0.07, ys - 0.57, hw, cx + 0.07, ys - 0.53, hw + 3.5, WOOD_DARK)
    v = [(cx + 0.45 * math.cos(2 * math.pi * i / 20), ys - 0.58, hw + 2.0 + 0.45 * math.sin(2 * math.pi * i / 20)) for i in range(20)]
    link(n + '_rose', mesh('rose', v, [tuple(range(20))]), GLASS_LIT)
    # entrance + arched windows
    box(n + '_entrance', cx - 0.9, ys - 0.56, 0.25, cx + 0.9, ys - 0.5, 2.4, mat('station_door', (0.10, 0.08, 0.06), 0.4))
    for i in range(int((x1 - x0) // 1.1)):
        xa = x0 + 0.45 + i * 1.1
        if gx0 - 0.3 < xa < gx1:
            continue
        window(n + f'_aw{i}', xa, ys, 0.9, 0.55, 1.4)

def build_tree(t, n):
    """Cherry (or campus) tree: forked trunk, canopy of many small blossom clusters."""
    rnd = random.Random(t['x'] * 97 + t['y'] * 13)
    cx, cy = t['x'] + 0.5, by(t['y'] + 0.5)
    green = t.get('green')
    top = Vector((cx + rnd.uniform(-0.1, 0.1), cy + rnd.uniform(-0.05, 0.05), 1.25))
    limb(n + '_trunk', (cx, cy, 0), top, 0.11, 0.08, TRUNK)
    cc = Vector((cx, cy + 0.05, 2.05))
    for k in range(4):
        a = k * math.pi / 2 + rnd.uniform(-0.4, 0.4)
        tip = cc + Vector((math.cos(a) * 0.6, math.sin(a) * 0.45, rnd.uniform(-0.1, 0.35)))
        limb(n + '_branch', top, tip, 0.06, 0.02, TRUNK, n=5)
    mats = LEAVES if green else BLOSSOMS
    blob(n + '_core', tuple(cc), 0.62, LEAVES[2] if green else BLOSSOM_CORE, wobble=0.1)
    for i in range(38):
        u, v = rnd.uniform(0, 2 * math.pi), rnd.uniform(-0.6, 1)
        r = rnd.uniform(0.75, 1.0)
        p = cc + Vector((math.cos(u) * math.sqrt(1 - v * v) * 0.95 * r, math.sin(u) * math.sqrt(1 - v * v) * 0.75 * r, v * 0.55 * r))
        blob(n + f'_c{i}', tuple(p), rnd.uniform(0.17, 0.3), rnd.choice(mats), subdiv=2, wobble=0.12)
    for i in range(0 if green else 110):
        u, v = rnd.uniform(0, 2 * math.pi), rnd.uniform(-0.3, 1)
        p = cc + Vector((math.cos(u) * math.sqrt(1 - v * v) * 1.12, math.sin(u) * math.sqrt(1 - v * v) * 0.9, v * 0.68))
        blob(n + f'_b{i}', tuple(p), rnd.uniform(0.05, 0.09), rnd.choice(mats), subdiv=1, wobble=0.2)

def build_thing(t, i):
    n = f"{t['kind']}{i}"
    new_sprite(t['y'] + t['h'] - 1)
    k = t['kind']
    x0, x1, ys, yn = rect(t)
    if k == 'building':
        build_building(t, n)
    elif k == 'tree':
        build_tree(t, n)
    elif k == 'island':
        me = bpy.data.meshes.new('island'); bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=12, radius=1)
        for v in bm.verts:
            v.co.x *= (x1 - x0) / 2; v.co.y *= (yn - ys) / 2; v.co.z = max(0, v.co.z) * 0.35
            v.co += Vector(((x0 + x1) / 2, (ys + yn) / 2, 0))
        bm.to_mesh(me); bm.free()
        for p in me.polygons: p.use_smooth = True
        link(n, me, HEDGE)
        for j in range(26):
            a = random.uniform(0, 2 * math.pi); r = random.uniform(0, 0.9)
            fx, fy = (x0 + x1) / 2 + math.cos(a) * r * (x1 - x0) / 2, (ys + yn) / 2 + math.sin(a) * r * (yn - ys) / 2
            blob(n + '_flower', (fx, fy, 0.3 * (1 - r * r) + 0.05), 0.07, mat('flower_y', (0.95, 0.75, 0.1), 0.6) if j % 2 else mat('flower_w', (0.95, 0.92, 0.88), 0.6), subdiv=1)
    elif k == 'bench':
        for dz, dy in ((0.42, 0.0), (0.42, 0.14), (0.42, 0.28)):
            box(n + '_slat', x0 + 0.05, ys + 0.3 + dy, dz, x1 - 0.05, ys + 0.4 + dy, dz + 0.05, WOOD)
        box(n + '_back', x0 + 0.05, ys + 0.62, 0.55, x1 - 0.05, ys + 0.68, 0.9, WOOD)
        for xx in (x0 + 0.15, x1 - 0.25):
            box(n + '_leg', xx, ys + 0.3, 0, xx + 0.08, ys + 0.7, 0.45, DARK_METAL)
    elif k == 'vending':
        box(n + '_body', x0 + 0.05, ys + 0.2, 0, x1 - 0.05, yn - 0.05, 1.9, mat('vend_body', (0.85, 0.86, 0.88), 0.4), bevel=0.03)
        box(n + '_panel', x0 + 0.12, ys + 0.17, 0.9, x1 - 0.12, ys + 0.2, 1.75, mat('vend_panel', (0.6, 0.7, 0.75), 0.2, emit=(0.85, 0.95, 1.0), emit_strength=1.2))
        for j in range(5):
            box(n + '_btnr', x0 + 0.15 + j * 0.14, ys + 0.16, 1.0, x0 + 0.24 + j * 0.14, ys + 0.18, 1.06, mat('btn_red', (0.8, 0.05, 0.03), 0.3, emit=(1, 0.1, 0.05), emit_strength=2))
            box(n + '_btnb', x0 + 0.15 + j * 0.14, ys + 0.16, 1.45, x0 + 0.24 + j * 0.14, ys + 0.18, 1.51, mat('btn_blue', (0.05, 0.2, 0.8), 0.3, emit=(0.1, 0.3, 1), emit_strength=2))
        box(n + '_slot', x0 + 0.2, ys + 0.16, 0.2, x1 - 0.2, ys + 0.2, 0.45, DARK_METAL)
    elif k == 'field':
        soil = mat('soil', (0.22, 0.14, 0.08), 0.95, noise={'c2': (0.30, 0.20, 0.12), 'scale': 14}, bump=0.4)
        sprout = [mat('sprout', (0.25, 0.55, 0.12), 0.8), mat('cabbage', (0.45, 0.62, 0.30), 0.7)]
        box(n + '_bed', x0, ys, 0, x1, yn, 0.05, soil)
        rows = int((yn - ys) / 0.45)
        for j in range(rows):
            yy = ys + 0.25 + j * 0.45
            box(n + '_ridge', x0 + 0.1, yy - 0.12, 0.05, x1 - 0.1, yy + 0.12, 0.16, soil, bevel=0.06)
            xx = x0 + 0.25
            m_ = sprout[j % 2]
            while xx < x1 - 0.2:
                blob(n + '_veg', (xx, yy, 0.24), 0.13 if j % 2 else 0.09, m_, subdiv=1)
                xx += 0.32
        for xx in (x0, x1 - 0.05):
            box(n + '_stake', xx, ys, 0, xx + 0.05, ys + 0.05, 0.6, WOOD)
    elif k == 'gomi':
        box(n + '_cage', x0 + 0.05, ys + 0.1, 0, x1 - 0.05, yn - 0.1, 0.55, NET, bevel=0.08)
    elif k == 'decor':
        build_decor(t, n, x0, x1, ys, yn)
    elif k == 'sign':
        if t.get('style') in ('street', 'park', 'gate', 'gomi'):
            cyl(n + '_pole', t['x'] + 0.5, by(t['y'] + 0.5), 0, 1.9, 0.04, STEEL, n=8)
    elif k == 'table':
        cx, cy = (x0 + x1) / 2, (ys + yn) / 2
        cyl(n + '_top', cx, cy, 0.32, 0.38, 0.85, WOOD, n=32)
        for a in range(4):
            box(n + '_leg', cx + 0.5 * math.cos(a * 1.57 + 0.78) - 0.04, cy + 0.5 * math.sin(a * 1.57 + 0.78) - 0.04, 0, cx + 0.5 * math.cos(a * 1.57 + 0.78) + 0.04, cy + 0.5 * math.sin(a * 1.57 + 0.78) + 0.04, 0.32, WOOD_DARK)
    elif k == 'item':
        cx, cy = (x0 + x1) / 2, (ys + yn) / 2
        if t.get('icon') == 'bible':
            box(n, cx - 0.22, cy - 0.15, 0.38, cx + 0.22, cy + 0.15, 0.48, mat('bible', (0.03, 0.03, 0.03), 0.4))
            box(n + '_edge', cx - 0.21, cy - 0.16, 0.39, cx + 0.21, cy - 0.15, 0.47, mat('gilt', (0.8, 0.6, 0.2), 0.3, metal=0.9))
        else:
            box(n, cx - 0.2, cy - 0.14, 0.38, cx + 0.2, cy + 0.14, 0.44, mat('phrasebook', (0.9, 0.42, 0.06), 0.5))
            box(n + '_pages', cx - 0.19, cy - 0.15, 0.385, cx + 0.19, cy - 0.14, 0.435, mat('paper', (0.92, 0.9, 0.84), 0.8))
    elif k == 'counter':
        box(n + '_body', x0, ys + 0.1, 0, x1, yn, 0.9, mat('cabinet', (0.75, 0.70, 0.62), 0.6))
        box(n + '_top', x0 - 0.02, ys + 0.08, 0.9, x1 + 0.02, yn + 0.02, 0.95, STEEL)
        box(n + '_sink', x0 + 0.3, ys + 0.25, 0.9, x0 + 1.1, yn - 0.15, 0.952, DARK_METAL)
        cyl(n + '_burner', x1 - 0.5, (ys + yn) / 2 + 0.05, 0.95, 0.99, 0.18, DARK_METAL, n=16)
        box(n + '_kettle', x1 - 0.65, (ys + yn) / 2 - 0.1, 0.99, x1 - 0.35, (ys + yn) / 2 + 0.2, 1.25, mat('kettle', (0.55, 0.08, 0.06), 0.3), bevel=0.06)
    elif k == 'futon':
        box(n + '_mattress', x0 + 0.1, ys + 0.15, 0, x1 - 0.1, yn - 0.1, 0.16, mat('futon', (0.92, 0.90, 0.86), 0.9), bevel=0.06)
        box(n + '_blanket', x0 + 0.08, ys + 0.13, 0.1, x1 - 0.08, yn - 0.9, 0.24, mat('kakebuton', (0.30, 0.45, 0.65), 0.9, noise={'c2': (0.36, 0.52, 0.72), 'scale': 4}), bevel=0.07)
        box(n + '_pillow', x0 + 0.45, yn - 0.7, 0.14, x1 - 0.45, yn - 0.25, 0.3, mat('pillow', (0.95, 0.94, 0.9), 0.9), bevel=0.08)
    elif k == 'door' and MAP_ID == 'apartment':
        # the south wall is cut away, so the front door reads as a doorway slab in it
        box(n, x0 - 0.04, ys, 0, x1 + 0.04, yn, 0.42, mat('front_door', (0.30, 0.27, 0.24), 0.4))
        box(n + '_knob', x1 - 0.3, ys - 0.02, 0.2, x1 - 0.18, ys, 0.3, STEEL)

def build_decor(t, n, x0, x1, ys, yn):
    cx, cy = t['x'] + 0.5, by(t['y'] + 0.5)
    ty = t['type']
    if ty == 'pole':
        cyl(n + '_pole', cx, cy, 0, 5.6, 0.1, CONCRETE, n=10)
        box(n + '_arm', cx - 0.6, cy - 0.04, 5.1, cx + 0.6, cy + 0.04, 5.18, DARK_METAL)
        cyl(n + '_trans', cx + 0.22, cy - 0.15, 3.9, 4.6, 0.16, mat('transformer', (0.55, 0.57, 0.56), 0.5, metal=0.4), n=12)
        box(n + '_plate', cx - 0.08, cy - 0.11, 1.4, cx + 0.08, cy - 0.1, 2.4, mat('pole_plate', (0.85, 0.75, 0.2), 0.5))
    elif ty == 'lamp':
        cyl(n + '_pole', cx, cy, 0, 3.6, 0.05, DARK_METAL, n=8)
        box(n + '_arm', cx, cy - 0.03, 3.5, cx + 0.5, cy + 0.03, 3.56, DARK_METAL)
        box(n + '_head', cx + 0.3, cy - 0.1, 3.4, cx + 0.65, cy + 0.1, 3.5, mat('lamp_head', (0.9, 0.9, 0.85), 0.3, emit=(1, 0.95, 0.8), emit_strength=0.6))
    elif ty == 'bike':
        frame_m = random.choice([mat('bike_silver', (0.6, 0.6, 0.62), 0.3, metal=0.8), mat('bike_red', (0.5, 0.05, 0.05), 0.4), mat('bike_blue', (0.08, 0.15, 0.4), 0.4)])
        for wy in (cy - 0.35, cy + 0.35):
            v = [(cx, wy + 0.28 * math.cos(2 * math.pi * j / 16), 0.3 + 0.28 * math.sin(2 * math.pi * j / 16)) for j in range(16)]
            me = mesh('wheel', v, [tuple(range(16))])
            ob = link(n + '_wheel', me, DARK_METAL)
            sol = ob.modifiers.new('t', 'SOLIDIFY'); sol.thickness = 0.05
        box(n + '_frame', cx - 0.03, cy - 0.3, 0.45, cx + 0.03, cy + 0.3, 0.55, frame_m)
        box(n + '_seat', cx - 0.06, cy + 0.05, 0.75, cx + 0.06, cy + 0.25, 0.8, DARK_METAL)
        box(n + '_basket', cx - 0.14, cy - 0.55, 0.65, cx + 0.14, cy - 0.3, 0.85, DARK_METAL)
        box(n + '_bar', cx - 0.25, cy - 0.3, 0.88, cx + 0.25, cy - 0.26, 0.92, DARK_METAL)
    elif ty == 'postbox':
        box(n + '_body', cx - 0.25, cy - 0.2, 0, cx + 0.25, cy + 0.2, 1.25, RED, bevel=0.05)
        box(n + '_top', cx - 0.28, cy - 0.23, 1.25, cx + 0.28, cy + 0.23, 1.33, RED, bevel=0.03)
        box(n + '_slot', cx - 0.15, cy - 0.21, 1.0, cx + 0.15, cy - 0.2, 1.06, DARK_METAL)
    elif ty == 'plant':
        cyl(n + '_pot', cx, cy, 0, 0.4, 0.22, mat('pot', (0.45, 0.22, 0.12), 0.8), n=12)
        for j in range(4):
            blob(n + '_leaf', (cx + random.uniform(-0.12, 0.12), cy + random.uniform(-0.1, 0.1), 0.55 + j * 0.08), 0.2, LEAF, subdiv=1)

def build_wires():
    for chain in MAP.get('wires', []):
        for (ax, ay), (bx, by_) in zip(chain, chain[1:]):
            for off in (-0.5, 0.0, 0.5):
                p0 = Vector((ax + 0.5 + off, by(ay + 0.5), 5.14))
                p1 = Vector((bx + 0.5 + off, by(by_ + 0.5), 5.14))
                curve = bpy.data.curves.new('wire', 'CURVE')
                curve.dimensions = '3D'
                curve.bevel_depth = 0.015
                sp = curve.splines.new('POLY')
                pts = 12
                sp.points.add(pts - 1)
                for j in range(pts):
                    u = j / (pts - 1)
                    p = p0.lerp(p1, u)
                    p.z -= 0.45 * 4 * u * (1 - u)
                    sp.points[j].co = (*p, 1)
                ob = bpy.data.objects.new('wire', curve)
                curve.materials.append(DARK_METAL)
                COL.objects.link(ob)
                ob['ground'] = False
                ob.pass_index = OVERHEAD

def build_interior_walls():
    """Apartment: tall north/side walls, a cut-away south wall."""
    wm = mat('plaster', (0.86, 0.83, 0.76), 0.9)
    trim = WOOD_DARK
    g = MAP['ground']
    for my in range(H):
        for mx in range(W):
            if g[my][mx] != 'w':
                continue
            south = my == H - 1
            hz = 0.35 if south else 2.4
            new_sprite(my)
            box('wall', mx, by(my + 1), 0, mx + 1, by(my), hz, wm)
            if not south and my == 0 and 1 <= mx <= W - 2:
                box('trim', mx, by(my + 1) - 0.02, 0, mx + 1, by(my + 1), 0.12, trim)
    # window on the north wall with morning light
    new_sprite(0)
    window('north_window', 3.1, by(1) + 0.0, 0.9, 2.8, 1.1, lit=True)
    box('shoji_rail', 3.0, by(1) - 0.04, 2.05, 6.0, by(1), 2.12, WOOD)

# ── Build ───────────────────────────────────────────────────────────────────
build_ground()
build_tile_objects()
for i, t in enumerate(MAP['things']):
    if t['kind'] in ('zebra',):
        x0, x1, ys, yn = t['x'], t['x'] + t['w'], by(t['y'] + t['h']), by(t['y'])
        for j in range(t['w'] * 2):
            box('zebra', x0 + j * 0.5 + 0.08, ys + 0.12, -0.039, x0 + j * 0.5 + 0.38, yn - 0.12, -0.034, LINE, ground=True)
        continue
    if t['kind'] == 'decal':
        continue
    build_thing(t, i)
if MAP_ID == 'apartment':
    build_interior_walls()
build_wires()

# ── Light, world, camera ────────────────────────────────────────────────────
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
COL.objects.link(sun)
sun.data.energy = 4.2 if MAP_ID == 'town' else 2.2
sun.data.angle = math.radians(2.5)
sun.data.color = (1.0, 0.90, 0.78)
# morning sun low in the south-east, so shadows fall north-west and are visible
sun.rotation_euler = (math.radians(55), 0, math.radians(65))

world = bpy.data.worlds.new('world')
scene.world = world
world.use_nodes = True
wn = world.node_tree
sky = wn.nodes.new('ShaderNodeTexSky')
sky.sky_type = 'NISHITA'
sky.sun_elevation = math.radians(30)
sky.sun_rotation = math.radians(145)
sky.sun_disc = False
wn.links.new(sky.outputs['Color'], wn.nodes['Background'].inputs['Color'])
wn.nodes['Background'].inputs['Strength'].default_value = 0.32 if MAP_ID == 'town' else 0.35

if MAP_ID == 'apartment':
    # soft fill from the window + room bounce
    area = bpy.data.objects.new('fill', bpy.data.lights.new('fill', 'AREA'))
    COL.objects.link(area)
    area.data.energy = 220
    area.data.size = 6
    area.data.color = (1.0, 0.93, 0.82)
    area.location = (4.5, by(4.5), 4.0)

# Shear everything north by its height (see the docstring).
for ob in scene.objects:
    if ob.type == 'MESH':
        for v in ob.data.vertices:
            v.co.y += v.co.z * K
    elif ob.type == 'CURVE':
        for sp in ob.data.splines:
            for pt in sp.points:
                pt.co.y += pt.co.z * K

cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.sensor_fit = 'HORIZONTAL'
cam = bpy.data.objects.new('cam', cam_data)
COL.objects.link(cam)
scene.camera = cam
height_units = TOP + H
cam_data.ortho_scale = W
cam.location = (W / 2, (TOP - H) / 2, 80)
cam_data.clip_end = 200

r = scene.render
r.engine = 'CYCLES'
scene.cycles.device = 'CPU'
r.resolution_x = int(W * 32 * SCALE)
r.resolution_y = int(round(height_units * 32 * SCALE))
r.resolution_percentage = 100
r.image_settings.file_format = 'PNG'
r.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'Medium Contrast'
scene.view_settings.exposure = -0.45
scene.cycles.max_bounces = 6
r.use_freestyle = True
r.line_thickness_mode = 'ABSOLUTE'
r.line_thickness = 1.6
ls = bpy.context.view_layer.freestyle_settings.linesets[0] if bpy.context.view_layer.freestyle_settings.linesets else bpy.context.view_layer.freestyle_settings.linesets.new('lines')
ls.select_by_visibility = True
if ls.linestyle is None:
    ls.linestyle = bpy.data.linestyles.new('ink')
ls.select_silhouette = True
ls.select_border = True
ls.select_crease = True
ls.linestyle.color = (0.10, 0.07, 0.08)
ls.linestyle.alpha = 0.75
ls.linestyle.thickness = 1.6

if PREVIEW:
    px0, py0, px1, py1 = PREVIEW
    r.use_border = True
    r.use_crop_to_border = True
    total_h = r.resolution_y / SCALE
    sy0 = (TOP + py0) * 32 - 150        # include things that rise above the region
    sy1 = (TOP + py1) * 32
    r.border_min_x, r.border_max_x = px0 / W, px1 / W
    r.border_max_y = 1 - max(0, sy0) / total_h
    r.border_min_y = 1 - min(total_h, sy1) / total_h

def set_pass(name):
    for ob in scene.objects:
        if ob.type not in ('MESH', 'CURVE'):
            continue
        g = ob.get('ground', False)
        if name == 'ground':
            ob.visible_camera = g
        else:
            ob.visible_camera = not g

def render(name, samples, transparent):
    scene.cycles.samples = samples
    scene.cycles.use_denoising = samples > 1
    r.film_transparent = transparent
    r.filepath = os.path.join(OUT, name + '.png')
    bpy.ops.render.render(write_still=True)
    print('RENDERED', name)

set_pass('ground')
render('ground', 40, False)
set_pass('objects')
render('objects', 40, True)

# Index pass: each object emits (pass_index * 4) / 255, no filtering.
idx = bpy.data.materials.new('index')
idx.use_nodes = True
nt = idx.node_tree
nt.nodes.remove(nt.nodes['Principled BSDF'])
info = nt.nodes.new('ShaderNodeObjectInfo')
def math_node(op, a, b):
    m_ = nt.nodes.new('ShaderNodeMath'); m_.operation = op
    nt.links.new(a, m_.inputs[0]); m_.inputs[1].default_value = b
    return m_.outputs[0]
lo = math_node('DIVIDE', math_node('MODULO', info.outputs['Object Index'], 256), 255)
hi = math_node('DIVIDE', math_node('FLOOR', math_node('DIVIDE', info.outputs['Object Index'], 256), 0), 255)
comb = nt.nodes.new('ShaderNodeCombineColor')
nt.links.new(lo, comb.inputs['Red']); nt.links.new(hi, comb.inputs['Green'])
em = nt.nodes.new('ShaderNodeEmission')
nt.links.new(comb.outputs[0], em.inputs['Color'])
nt.links.new(em.outputs[0], nt.nodes['Material Output'].inputs['Surface'])
bpy.context.view_layer.material_override = idx
scene.view_settings.view_transform = 'Raw'
scene.view_settings.look = 'None'
scene.cycles.pixel_filter_type = 'BOX'
scene.cycles.filter_width = 0.01
scene.cycles.max_bounces = 0
r.image_settings.color_depth = '8'
r.dither_intensity = 0
r.use_freestyle = False
render('index', 1, True)

json.dump({'map': MAP_ID, 'w': W, 'h': H, 'top': TOP, 'scale': SCALE, 'k': K, 'rows': IDS, 'overhead': OVERHEAD,
           'px_w': r.resolution_x, 'px_h': r.resolution_y, 'preview': PREVIEW},
          open(os.path.join(OUT, 'meta.json'), 'w'))
print('BUILD_SCENE_OK')
