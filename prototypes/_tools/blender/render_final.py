"""Transparent studio cut-outs for the final site, rendered from the projects' own 3D files.

Run from prototypes/_tools/blender (make_final_media.py runs every job):
  blender -b [file.blend] --python render_final.py -- <job> <out_dir> [extra] [views]

Jobs
  calc      Calculator.blend, recoloured in the site palette (indigo shell, lime plate, lavender
            and pink keys); extra = firmware screen PNG; views: hero, exploded
  board     a GLB from kicad-cli (the BL4S SiPM board); extra = the .glb path
  launcher  dlanucher.blend: the five SolidWorks parts in the file's own colour
  jpl       the nine printed parts of the 2025 build, laid flat; extra = the STL folder
  skull     skull3.blend's skull, glossy razzmatazz
Every view is a PNG with a transparent background; make_final_media.py trims and converts it.
"""
import bpy, sys, os, math
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
JOB, OUT = argv[0], argv[1]
EXTRA = argv[2] if len(argv) > 2 else ""
VIEWS = argv[3].split(",") if len(argv) > 3 and argv[3] else ["hero"]
RES = 1600
sc = bpy.context.scene

INDIGO, DEEP, LIME, PINK, LAV, GREY, INK = "#412db5", "#2d2178", "#e9ff97", "#e5197f", "#aba2d4", "#d9d4e2", "#0f0e19"


def lin(hexcol):
    h = hexcol.lstrip("#")
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4)) + (1,)


def principled(name, hexcol, rough=0.45, metal=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = lin(hexcol)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if coat:
        b.inputs["Coat Weight"].default_value = coat
        b.inputs["Coat Roughness"].default_value = 0.12
    return m


def set_material(o, mat):
    o.data.materials.clear()
    o.data.materials.append(mat)


def base_color(mat):
    if not mat or not mat.use_nodes:
        return None
    for n in mat.node_tree.nodes:
        if n.type == "BSDF_PRINCIPLED":
            return tuple(n.inputs["Base Color"].default_value[:3])
    return None


def meshes():
    return [o for o in sc.objects if o.type == "MESH" and not o.hide_render]


def bbox(objs):
    bpy.context.view_layer.update()
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo, hi = Vector(map(min, lo, w)), Vector(map(max, hi, w))
    return lo, hi


def studio():
    """Render settings, a neutral world and a camera; lights are added per frame()."""
    sc.render.engine = "BLENDER_EEVEE"
    sc.eevee.taa_render_samples = 96
    sc.eevee.use_raytracing = True
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "AgX"
    try:
        sc.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    sc.view_settings.exposure = -0.2
    world = bpy.data.worlds.new("RLG_World")
    sc.world = world
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = lin("#cfc9e0")
    bg.inputs[1].default_value = 0.35
    for o in list(sc.objects):
        if o.type in ("LIGHT", "CAMERA"):
            bpy.data.objects.remove(o, do_unlink=True)
    cd = bpy.data.cameras.new("RLG_Cam")
    cd.lens = 70
    cam = bpy.data.objects.new("RLG_Cam", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    return cam


def light_rig(center, radius):
    for o in [o for o in sc.objects if o.name.startswith("RLG_L_")]:
        bpy.data.objects.remove(o, do_unlink=True)
    rigs = [("RLG_L_Key", (-1.1, -1.4, 1.6), 1.0, (1.0, 0.97, 0.93)),
            ("RLG_L_Rim", (1.5, 1.2, 1.1), 0.75, (0.78, 0.74, 1.0)),
            ("RLG_L_Fill", (1.4, -1.5, -0.2), 0.32, (0.93, 1.0, 0.86))]
    for name, d, k, col in rigs:
        dist = radius * 5.0
        ld = bpy.data.lights.new(name, "AREA")
        ld.size = radius * 2.2
        ld.energy = 400 * radius * radius * k
        ld.color = col
        ob = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(ob)
        ob.location = center + Vector(d).normalized() * dist
        ob.rotation_euler = (center - ob.location).to_track_quat("-Z", "Y").to_euler()


def frame(cam, objs, direction, margin=1.06):
    lo, hi = bbox(objs)
    center, radius = (lo + hi) / 2, (hi - lo).length / 2
    light_rig(center, radius)
    fov = 2 * math.atan(cam.data.sensor_width / 2 / cam.data.lens)
    dist = radius / math.sin(fov / 2) * margin
    cam.location = center + Vector(direction).normalized() * dist
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.clip_start = dist / 100
    cam.data.clip_end = dist * 10


def probe(cam, objs, elev=0.55, margin=1.05):
    """Eight small renders around the object (azimuth 0 = from -Y), to choose a view."""
    for az in range(0, 360, 45):
        r = math.radians(az)
        d = (math.sin(r), -math.cos(r), elev)
        frame(cam, objs, d, margin)
        render(f"{JOB}_az{az:03d}", 420, 420)


def render(name, w=RES, h=RES):
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.render.filepath = os.path.join(OUT, f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", name)


os.makedirs(OUT, exist_ok=True)

# ------------------------------------------------------------------ jobs
if JOB == "calc":
    cam = studio()
    if "Plane" in bpy.data.objects:
        bpy.data.objects["Plane"].hide_render = True
    m = {
        "shell": principled("RLG_Shell", INDIGO, rough=0.32, coat=0.4),
        "deep": principled("RLG_Deep", DEEP, rough=0.38, coat=0.3),
        "plate": principled("RLG_Plate", LIME, rough=0.42),
        "key": principled("RLG_Key", GREY, rough=0.3, coat=0.5),
        "op": principled("RLG_KeyOp", PINK, rough=0.3, coat=0.5),
        "fn": principled("RLG_KeyFn", LIME, rough=0.3, coat=0.5),
        "pcb": principled("RLG_PCB", "#1b1438", rough=0.5),
    }
    for o in meshes():
        n = o.name
        if n in ("Calculator_Body_V3", "Calculator_Base"):
            set_material(o, m["shell"])
        elif n in ("Calculator_Alcove_V2", "Calculator_Bezel_V2"):
            set_material(o, m["deep"])
        elif n == "Calculator_Plate_V2":
            set_material(o, m["plate"])
        elif n.startswith("Stylized_Key_Cap"):
            # keep the file's own key layout: light keys -> lavender, dark keys -> pink, the odd one -> lime
            c = base_color(o.active_material) if o.active_material else None
            if c and max(c) - min(c) > 0.08 and c[2] > c[1]:
                set_material(o, m["fn"])
            elif c and sum(c) / 3 < 0.35:
                set_material(o, m["op"])
            else:
                set_material(o, m["key"])
        elif n.startswith("Calculator_PCB") and o.active_material and base_color(o.active_material) and sum(base_color(o.active_material)) / 3 < 0.2:
            set_material(o, m["pcb"])
    # the screen: the firmware's test graphics, glowing
    cube = bpy.data.objects["Cube"]
    sm = bpy.data.materials.new("RLG_Screen")
    nt = sm.node_tree
    nt.nodes.clear()
    o_ = nt.nodes.new("ShaderNodeOutputMaterial")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    img = nt.nodes.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(EXTRA)
    img.extension = "CLIP"
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = 1.5
    nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], img.inputs["Vector"])
    nt.links.new(img.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs["Emission"], o_.inputs["Surface"])
    flip = "flip" in VIEWS
    mp.inputs["Scale"].default_value = (-1 if flip else 1, -1 if flip else 1, 1)
    mp.inputs["Location"].default_value = (1 if flip else 0, 1 if flip else 0, 0)
    set_material(cube, sm)
    FRONT = (0.707, 0.707, 0.55)        # three-quarter view from the front, screen readable (pass 'flip')
    if "probe" in VIEWS:
        probe(cam, meshes())
    if "hero" in VIEWS:
        frame(cam, meshes(), FRONT, margin=0.92)
        render("calc_final_hero")
    if "exploded" in VIEWS:
        groups = [("Calculator_Alcove_V2", 205), ("Calculator_Bezel_V2", 205), ("Cube", 205), ("Stylized_Key_Cap", 168),
                  ("Calculator_Plate_V2", 124), ("Calculator_PCB", 82), ("Calculator_Body_V3", 40)]
        for o in meshes():
            for prefix, dz in groups:
                if o.name.startswith(prefix):
                    o.location.z += dz
                    break
        frame(cam, meshes(), (FRONT[0], FRONT[1], FRONT[2] * 0.55), margin=0.98)
        render("calc_final_exploded", int(RES * 0.82), RES)

elif JOB == "board":
    for o in list(sc.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=EXTRA)
    cam = studio()
    objs = meshes()
    # kicad-cli writes the soldermask and silkscreen semi-transparent; make them read like the real board
    for m in {m for o in objs for m in o.data.materials if m}:
        bsdf = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None) if m.use_nodes else None
        if not bsdf:
            continue
        c = bsdf.inputs["Base Color"].default_value
        bsdf.inputs["Alpha"].default_value = 1.0
        m.surface_render_method = "DITHERED"
        if c[1] > c[0] * 1.8 and c[1] > c[2] and max(c[:3]) < 0.3:           # soldermask
            bsdf.inputs["Base Color"].default_value = lin("#0f5132")
            bsdf.inputs["Roughness"].default_value = 0.3
            bsdf.inputs["Metallic"].default_value = 0.0
            bsdf.inputs["Coat Weight"].default_value = 0.6
        elif c[2] > c[0] and c[2] > 0.7 and bsdf.inputs["Metallic"].default_value > 0.5:   # SiPM packages
            bsdf.inputs["Base Color"].default_value = lin("#1c1a2e")
            bsdf.inputs["Roughness"].default_value = 0.22
            bsdf.inputs["Metallic"].default_value = 0.1
            bsdf.inputs["Coat Weight"].default_value = 0.8
        elif bsdf.inputs["Metallic"].default_value > 0.5 and bsdf.inputs["Roughness"].default_value > 0.9:
            bsdf.inputs["Roughness"].default_value = 0.35           # pads and bodies: less chalky
    if "probe" in VIEWS:
        probe(cam, objs, elev=1.2)
    else:
        frame(cam, objs, (0.707, -0.707, 1.15), margin=0.88)
        render("bl4s_board", RES, int(RES * 0.75))

elif JOB == "launcher":
    cam = studio()
    keep = [o for o in meshes() if o.name.lower().startswith("launcher")]
    for o in meshes():
        if o not in keep:
            o.hide_render = True
    frame(cam, keep, (1.0, -0.75, 0.55), margin=0.95)
    render("launcher", RES, int(RES * 0.8))

elif JOB == "jpl":
    for o in list(sc.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    cam = studio()
    PARTS = ["bigGear2good", "doublepulley", "Puley", "scoop", "smallgeargood", "BearingOuterRevised",
             "InsideBearingRevised", "AxleConnectorRevised", "AxleClampRevised"]
    COLORS = [INDIGO, LIME, GREY, PINK, LAV, DEEP]
    objs = []
    for i, name in enumerate(PARTS):
        path = next((os.path.join(EXTRA, f) for f in os.listdir(EXTRA)
                     if os.path.splitext(f)[0] == name and f.lower().endswith(".stl")), None)
        if not path:
            continue
        bpy.ops.wm.stl_import(filepath=path)
        o = bpy.context.selected_objects[0]
        me = o.data
        lo = Vector([min(v.co[k] for v in me.vertices) for k in range(3)])
        hi = Vector([max(v.co[k] for v in me.vertices) for k in range(3)])
        size = hi - lo
        thin = min(range(3), key=lambda k: size[k])
        rot = {0: Matrix.Rotation(math.pi / 2, 4, "Y"), 1: Matrix.Rotation(math.pi / 2, 4, "X"), 2: Matrix.Identity(4)}[thin]
        me.transform(Matrix.Translation(-(lo + hi) / 2))
        me.transform(rot)
        lo = Vector([min(v.co[k] for v in me.vertices) for k in range(3)])
        me.transform(Matrix.Translation((0, 0, -lo.z)))
        o.location = (0, 0, 0)
        o.rotation_euler = (0, 0, 0)
        set_material(o, principled(f"PLA_{i}", COLORS[i % len(COLORS)], rough=0.5))
        objs.append(o)
    dims = [(o, Vector([max(v.co[k] for v in o.data.vertices) - min(v.co[k] for v in o.data.vertices) for k in range(3)])) for o in objs]
    row_w = math.sqrt(sum(d.x * d.y for _, d in dims)) * 1.7
    gap = max(d.x for _, d in dims) * 0.12
    x = y = row_h = 0.0
    for o, d in dims:
        if x > 0 and x + d.x > row_w:
            x, y, row_h = 0.0, y - row_h - gap, 0.0
        o.location = (x + d.x / 2, y - d.y / 2, 0)
        x += d.x + gap
        row_h = max(row_h, d.y)
    frame(cam, objs, (0.2, -0.75, 1.3), margin=0.92)
    render("jpl_parts", RES, int(RES * 0.8))

elif JOB == "skull":
    cam = studio()
    skull = bpy.data.objects["skull"]
    for o in meshes():
        if o is not skull:
            o.hide_render = True
    set_material(skull, principled("RLG_Skull", PINK, rough=0.28, metal=0.15, coat=0.6))
    if "probe" in VIEWS:
        probe(cam, [skull], elev=0.15)
    else:
        frame(cam, [skull], (0.985, -0.174, 0.16), margin=0.95)
        render("skull", RES, RES)

else:
    raise SystemExit(f"unknown job {JOB}")
