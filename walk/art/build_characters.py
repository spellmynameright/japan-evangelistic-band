"""Render the walk/ characters as sprite frames, matching build_scene.py's
camera (straight down, height sheared north by K), lighting and outlines.

    blender -b --python walk/art/build_characters.py -- <out_dir> [quick]

Writes one PNG per frame plus frames.json; pack_characters.py turns them into
a sheet. Every frame shares one cell size and one anchor (the feet).
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1:]
OUT = ARGS[0]
QUICK = 'quick' in ARGS       # low samples, for checking poses
os.makedirs(OUT, exist_ok=True)
K = 0.85
PX = 64                      # rendered px per unit (2x the game's 32)
CELL_X = (-1.25, 1.25)       # units around the feet
CELL_Y = (-1.0, 1.8)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
COL = scene.collection

# ── Helpers (same idiom as build_scene.py) ──────────────────────────────────
_mats = {}

def mat(name, color, rough=0.7, emit=None):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = 1
    _mats[name] = m
    return m

PARTS = []

def link(name, me, m):
    me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    COL.objects.link(ob)
    PARTS.append(ob)
    return ob

def mesh(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    return me

def blob(name, c, r, m, scale=(1, 1, 1), subdiv=3):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1)
    for v in bm.verts:
        v.co = Vector((v.co.x * r * scale[0], v.co.y * r * scale[1], v.co.z * r * scale[2])) + Vector(c)
    bm.to_mesh(me)
    bm.free()
    return link(name, me, m)

def limb(name, p0, p1, r0, r1, m, n=10):
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
    f.append(tuple(2 * i for i in reversed(range(n))))
    f.append(tuple(2 * i + 1 for i in range(n)))
    ob = link(name, mesh(name, v, f), m)
    blob(name + '_j0', tuple(p0), r0, m, subdiv=2)
    blob(name + '_j1', tuple(p1), r1, m, subdiv=2)
    return ob

def disc_wheel(name, c, r, m, axis='X'):
    n = 24
    if axis == 'X':
        v = [(c[0], c[1] + r * math.cos(2 * math.pi * i / n), c[2] + r * math.sin(2 * math.pi * i / n)) for i in range(n)]
    else:
        v = [(c[0] + r * math.cos(2 * math.pi * i / n), c[1], c[2] + r * math.sin(2 * math.pi * i / n)) for i in range(n)]
    ob = link(name, mesh(name, v, [tuple(range(n))]), m)
    sol = ob.modifiers.new('t', 'SOLIDIFY')
    sol.thickness = 0.04
    return ob

SKIN = mat('skin', (0.86, 0.62, 0.48), 0.6)
SKIN_OLD = mat('skin_old', (0.80, 0.58, 0.45), 0.65)
EYE = mat('eye', (0.03, 0.02, 0.02), 0.3)
CHEEK = mat('cheek', (0.95, 0.55, 0.52), 0.8)
SHOE = mat('shoe', (0.18, 0.11, 0.07), 0.5)
METAL = mat('metal', (0.08, 0.08, 0.09), 0.4)
SILVER = mat('silver', (0.75, 0.76, 0.78), 0.3)

LOOKS = {
    'player': {'skin': SKIN, 'hair': mat('hair_brown', (0.25, 0.14, 0.07), 0.55), 'top': mat('cardigan_navy', (0.10, 0.16, 0.32), 0.85),
               'shirt': mat('shirt_blue', (0.62, 0.75, 0.88), 0.8), 'legs': mat('khaki', (0.62, 0.52, 0.36), 0.85), 'bag': mat('bag', (0.35, 0.22, 0.12), 0.6)},
    'hiro':   {'skin': SKIN_OLD, 'hair': mat('hair_white', (0.85, 0.85, 0.83), 0.7), 'top': mat('jacket_beige', (0.55, 0.50, 0.40), 0.85),
               'shirt': mat('shirt_grey', (0.7, 0.7, 0.68), 0.8), 'legs': mat('slacks_grey', (0.25, 0.26, 0.28), 0.85), 'cap': mat('cap_tweed', (0.30, 0.27, 0.22), 0.9)},
    'ono':    {'skin': SKIN_OLD, 'hair': mat('hair_grey', (0.60, 0.59, 0.58), 0.7), 'top': mat('cardigan_plum', (0.40, 0.22, 0.38), 0.85),
               'shirt': mat('blouse', (0.85, 0.82, 0.78), 0.8), 'legs': mat('skirt_brown', (0.30, 0.22, 0.18), 0.85), 'apron': mat('apron_pink', (0.92, 0.62, 0.66), 0.85)},
    'student':{'skin': SKIN, 'hair': mat('hair_black', (0.04, 0.03, 0.03), 0.5), 'top': mat('gakuran', (0.06, 0.07, 0.12), 0.7),
               'shirt': mat('white', (0.9, 0.9, 0.88), 0.8), 'legs': mat('gakuran_pants', (0.06, 0.07, 0.12), 0.7)},
}

def person(look, phase=0.0, walking=False, sit=False, arms=None, cap=False, bun=False, apron=False, bag=False):
    """A chibi person facing south (towards the camera), feet at the origin."""
    L = LOOKS[look]
    s = math.sin(phase) if walking else 0.0
    lift = 0.03 * abs(math.cos(phase)) if walking else 0.0
    hip_z = 0.5 + lift
    if sit:
        hip_z = 0.5
        for side in (-1, 1):
            knee = (side * 0.1, -0.28, 0.5)
            limb('thigh', (side * 0.09, 0.0, hip_z), knee, 0.075, 0.07, L['legs'])
            limb('shin', knee, (side * 0.1, -0.32, 0.08), 0.065, 0.06, L['legs'])
            blob('shoe', (side * 0.1, -0.38, 0.05), 0.07, SHOE, scale=(1, 1.5, 0.7))
    else:
        for side, sw in ((-1, s), (1, -s)):
            foot = (side * 0.09, -0.16 * sw, 0.07 + max(0, sw) * 0.05)
            limb('leg', (side * 0.09, 0.0, hip_z), foot, 0.07, 0.06, L['legs'])
            blob('shoe', (foot[0], foot[1] - 0.04, foot[2] - 0.02), 0.07, SHOE, scale=(1, 1.5, 0.7))
    bz = hip_z + 0.02
    blob('body', (0, 0, bz + 0.2), 0.2, L['top'], scale=(0.95, 0.72, 1.15))
    blob('collar', (0, -0.1, bz + 0.38), 0.08, L['shirt'], scale=(1.2, 0.6, 0.6))
    if apron:
        blob('apron', (0, -0.08, bz + 0.12), 0.18, L['apron'], scale=(0.95, 0.5, 1.2))
    if bag:
        limb('strap', (-0.15, -0.12, bz + 0.38), (0.17, -0.13, bz + 0.05), 0.015, 0.015, L['bag'], n=6)
        blob('bag', (0.2, -0.02, bz + 0.05), 0.1, L['bag'], scale=(0.6, 1.0, 0.9))
    sh_z = bz + 0.34
    arms = arms or {}
    for side in (-1, 1):
        hand = arms.get(side) or (side * 0.24, 0.12 * (s if side < 0 else -s), bz + 0.05)
        limb('arm', (side * 0.19, 0, sh_z), hand, 0.055, 0.05, L['top'])
        blob('hand', hand, 0.05, L['skin'], subdiv=2)
    hz = bz + 0.62
    # The camera looks down from above, so faces sit high and forward on the head.
    blob('head', (0, 0, hz), 0.25, L['skin'])
    blob('hair', (0, 0.1, hz + 0.05), 0.255, L['hair'], scale=(1.02, 0.95, 0.9))
    blob('fringe', (0, -0.08, hz + 0.19), 0.15, L['hair'], scale=(1.4, 0.7, 0.45))
    if bun:
        blob('bun', (0, 0.12, hz + 0.24), 0.1, L['hair'])
    if cap:
        blob('cap', (0, 0.0, hz + 0.14), 0.25, L['cap'], scale=(1.05, 1.05, 0.45))
        blob('brim', (0, -0.18, hz + 0.1), 0.14, L['cap'], scale=(1.3, 0.8, 0.25))
    for side in (-1, 1):
        blob('eye', (side * 0.09, -0.19, hz + 0.08), 0.04, EYE, scale=(0.8, 0.6, 1.25), subdiv=2)
        blob('cheek', (side * 0.15, -0.19, hz + 0.0), 0.04, CHEEK, scale=(1, 0.5, 0.6), subdiv=2)

def broom(angle):
    top = (0.1 + 0.25 * math.sin(angle), -0.25, 0.95)
    base = (-0.25 + 0.35 * math.sin(angle), -0.45, 0.04)
    limb('broom_handle', top, base, 0.02, 0.02, mat('bamboo', (0.70, 0.60, 0.35), 0.6), n=6)
    blob('broom_head', base, 0.14, mat('bristles', (0.55, 0.45, 0.25), 0.9), scale=(1.4, 0.5, 0.6))
    return top

def bicycle():
    frame = mat('bike_frame', (0.70, 0.08, 0.10), 0.4)
    for y in (-0.45, 0.45):
        disc_wheel('wheel', (0, y, 0.28), 0.27, METAL)
    limb('down_tube', (0, -0.38, 0.4), (0, 0.15, 0.3), 0.025, 0.025, frame, n=6)
    limb('seat_tube', (0, 0.15, 0.3), (0, 0.22, 0.62), 0.025, 0.025, frame, n=6)
    limb('fork', (0, -0.38, 0.4), (0, -0.45, 0.28), 0.02, 0.02, SILVER, n=6)
    limb('bars', (-0.2, -0.36, 0.78), (0.2, -0.36, 0.78), 0.02, 0.02, SILVER, n=6)
    limb('stem', (0, -0.38, 0.4), (0, -0.36, 0.78), 0.02, 0.02, SILVER, n=6)
    blob('basket', (0, -0.55, 0.62), 0.14, METAL, scale=(1.2, 0.9, 0.7))
    blob('saddle', (0, 0.22, 0.64), 0.07, METAL, scale=(1, 1.6, 0.4))
    return {-1: (-0.2, -0.36, 0.8), 1: (0.2, -0.36, 0.8)}

def pigeon(c, peck):
    grey = mat('pigeon', (0.45, 0.47, 0.52), 0.6)
    neck = mat('pigeon_neck', (0.25, 0.42, 0.40), 0.4)
    blob('pbody', (c[0], c[1], 0.1), 0.09, grey, scale=(0.8, 1.3, 0.8), subdiv=2)
    hy, hz = (c[1] - 0.13, 0.06) if peck else (c[1] - 0.1, 0.18)
    blob('pneck', (c[0], c[1] - 0.07, (0.1 + hz) / 2 + 0.02), 0.05, neck, subdiv=2)
    blob('phead', (c[0], hy, hz), 0.045, grey, subdiv=2)
    blob('pbeak', (c[0], hy - 0.045, hz - 0.01), 0.015, mat('beak', (0.8, 0.6, 0.4), 0.5), subdiv=1)

# ── Scene: same light, camera, outlines as the town ─────────────────────────
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
COL.objects.link(sun)
sun.data.energy = 4.2
sun.data.angle = math.radians(2.5)
sun.data.color = (1.0, 0.90, 0.78)
sun.rotation_euler = (math.radians(55), 0, math.radians(65))
world = bpy.data.worlds.new('world'); scene.world = world; world.use_nodes = True
sky = world.node_tree.nodes.new('ShaderNodeTexSky')
sky.sky_type = 'NISHITA'; sky.sun_elevation = math.radians(30); sky.sun_rotation = math.radians(145); sky.sun_disc = False
world.node_tree.links.new(sky.outputs['Color'], world.node_tree.nodes['Background'].inputs['Color'])
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.32

catcher = bpy.data.objects.new('catcher', mesh('catcher', [(-3, -3, 0), (3, -3, 0), (3, 3, 0), (-3, 3, 0)], [(0, 1, 2, 3)]))
COL.objects.link(catcher)
catcher.is_shadow_catcher = True

cam_data = bpy.data.cameras.new('cam'); cam_data.type = 'ORTHO'; cam_data.sensor_fit = 'HORIZONTAL'
cam = bpy.data.objects.new('cam', cam_data); COL.objects.link(cam); scene.camera = cam
cam_data.ortho_scale = CELL_X[1] - CELL_X[0]
cam.location = ((CELL_X[0] + CELL_X[1]) / 2, (CELL_Y[0] + CELL_Y[1]) / 2, 20)

r = scene.render
r.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 4 if QUICK else 48; scene.cycles.use_denoising = not QUICK
r.resolution_x = int((CELL_X[1] - CELL_X[0]) * PX); r.resolution_y = int((CELL_Y[1] - CELL_Y[0]) * PX)
r.film_transparent = True
r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'Standard'; scene.view_settings.look = 'Medium Contrast'; scene.view_settings.exposure = -0.45
r.use_freestyle = True; r.line_thickness_mode = 'ABSOLUTE'; r.line_thickness = 1.6
fs = bpy.context.view_layer.freestyle_settings
ls = fs.linesets[0] if fs.linesets else fs.linesets.new('lines')
if ls.linestyle is None:
    ls.linestyle = bpy.data.linestyles.new('ink')
ls.select_silhouette = True; ls.select_border = True; ls.select_crease = False
ls.linestyle.color = (0.10, 0.07, 0.08); ls.linestyle.alpha = 0.75; ls.linestyle.thickness = 1.6

FACING = {'down': 0, 'right': 90, 'up': 180, 'left': -90}

def finish(name, facing):
    """Turn the built parts to face a direction, shear them, render, clear."""
    a = math.radians(FACING[facing])
    ca, sa = math.cos(a), math.sin(a)
    for ob in PARTS:
        for v in ob.data.vertices:
            x, y = v.co.x, v.co.y
            v.co.x = x * ca - y * sa
            v.co.y = x * sa + y * ca
            v.co.y += v.co.z * K
    r.filepath = os.path.join(OUT, name + '.png')
    bpy.ops.render.render(write_still=True)
    for ob in PARTS:
        bpy.data.objects.remove(ob)
    PARTS.clear()
    FRAMES.append(name)
    print('FRAME', name)

FRAMES = []
WALK = [0, math.pi / 2, math.pi, 3 * math.pi / 2]
for facing in ('down', 'left', 'right', 'up'):
    for i, ph in enumerate(WALK):
        person('player', ph, walking=i > 0, bag=True)
        finish(f'player_{facing}_{i}', facing)

# The old man on the bench, tossing crumbs; pigeons pecking in front of him.
for i in range(2):
    toss = {1: (0.26, -0.28, 0.62 + 0.08 * i), -1: (-0.16, -0.2, 0.6)}
    person('hiro', sit=True, arms=toss, cap=True)
    for j, (px, py) in enumerate(((0.45, -0.75), (-0.2, -0.9), (0.85, -0.55))):
        pigeon((px, py), peck=(i + j) % 2 == 0)
    finish(f'hiro_sit_{i}', 'down')

# The neighbor sweeping the lane, facing west.
for i in range(2):
    ang = -0.5 if i == 0 else 0.5
    top = broom(ang)
    person('ono', arms={1: (top[0] + 0.02, top[1] + 0.05, top[2] - 0.05), -1: (top[0] - 0.08, top[1] + 0.02, top[2] - 0.32)}, bun=True, apron=True)
    finish(f'ono_sweep_{i}', 'left')

# A student on a mamachari, both directions along Daigaku-dōri.
for facing in ('down', 'up'):
    for i in range(2):
        hands = bicycle()
        person('student', sit=True, arms=hands)
        for ob in PARTS:
            for v in ob.data.vertices:
                if ob.name.startswith(('thigh', 'shin', 'shoe', 'body', 'collar', 'arm', 'hand', 'head', 'hair', 'fringe', 'eye', 'cheek')):
                    v.co.y += 0.2
                    v.co.z += 0.22
        finish(f'cyclist_{facing}_{i}', facing)

json.dump({'frames': FRAMES, 'px': PX, 'cell': [r.resolution_x, r.resolution_y],
           'anchor': [-CELL_X[0] * PX, CELL_Y[1] * PX]}, open(os.path.join(OUT, 'frames.json'), 'w'))
print('BUILD_CHARACTERS_OK')
