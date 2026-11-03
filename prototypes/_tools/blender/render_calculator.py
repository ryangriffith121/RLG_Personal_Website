"""Studio renders of the Custom Calculator from its own Calculator.blend.

Run:  blender -b <Custom_Calculator_ESP32>/CAD/Calculator.blend --python render_calculator.py -- <out_dir> <screen_png> [variants]
Variants: hero, exploded, top. Keeps the project's own colours; only the lighting, camera,
screen image and background change.
"""
import bpy, sys, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT, SCREEN = argv[0], argv[1]
VARIANTS = argv[2].split(",") if len(argv) > 2 else ["hero", "exploded", "top"]
RES = int(argv[3]) if len(argv) > 3 else 1600

sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
sc.eevee.taa_render_samples = 96
sc.eevee.use_raytracing = True
sc.render.film_transparent = True
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGBA"
sc.view_settings.view_transform = "AgX"
sc.view_settings.exposure = -0.35
try:
    sc.view_settings.look = "AgX - Medium High Contrast"
except TypeError:
    pass

plane = bpy.data.objects.get("Plane")
if plane:
    plane.hide_render = True

# --- screen: show the firmware's test graphics ---------------------------------
cube = bpy.data.objects["Cube"]
mat = bpy.data.materials.new("RLG_Screen")
nt = mat.node_tree
nt.nodes.clear()
o = nt.nodes.new("ShaderNodeOutputMaterial")
tc = nt.nodes.new("ShaderNodeTexCoord")
mp = nt.nodes.new("ShaderNodeMapping")
img = nt.nodes.new("ShaderNodeTexImage")
img.image = bpy.data.images.load(SCREEN)
img.extension = "CLIP"
em = nt.nodes.new("ShaderNodeEmission")
em.inputs["Strength"].default_value = 1.6
gl = nt.nodes.new("ShaderNodeBsdfGlossy")
gl.inputs["Roughness"].default_value = 0.18
mix = nt.nodes.new("ShaderNodeMixShader")
mix.inputs["Fac"].default_value = 0.035
nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
nt.links.new(mp.outputs["Vector"], img.inputs["Vector"])
nt.links.new(img.outputs["Color"], em.inputs["Color"])
nt.links.new(em.outputs["Emission"], mix.inputs[1])
nt.links.new(gl.outputs["BSDF"], mix.inputs[2])
nt.links.new(mix.outputs["Shader"], o.inputs["Surface"])
# image orientation on the tilted cube (flip as needed after a test render)
FLIP_U = "flipu" in VARIANTS
FLIP_V = "flipv" in VARIANTS
mp.inputs["Scale"].default_value = (-1 if FLIP_U else 1, -1 if FLIP_V else 1, 1)
mp.inputs["Location"].default_value = (1 if FLIP_U else 0, 1 if FLIP_V else 0, 0)
cube.data.materials.clear()
cube.data.materials.append(mat)

# --- lights: soft key + cool rim on top of the file's three points ------------
def add_area(name, loc, size, energy, color=(1, 1, 1)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.size = size
    ld.energy = energy
    ld.color = color
    ob = bpy.data.objects.new(name, ld)
    sc.collection.objects.link(ob)
    ob.location = loc
    d = Vector((-20, -40, 30)) - Vector(loc)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return ob

add_area("RLG_Key", (-260, 220, 330), 260, 3.2e6, (1.0, 0.97, 0.93))
add_area("RLG_Rim", (120, -420, 260), 200, 2.6e6, (0.75, 0.72, 1.0))
for n in ("Point", "Point.001", "Point.002"):
    if n in bpy.data.objects:
        bpy.data.objects[n].data.energy *= 0.45

def meshes():
    return [ob for ob in sc.objects if ob.type == "MESH" and not ob.hide_render]

def world_bbox(objs):
    lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
    for ob in objs:
        for c in ob.bound_box:
            w = ob.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    return lo, hi

cam = sc.camera
base_dir = (cam.location - Vector((0, 0, 0))).normalized()

def frame(direction, margin=1.08, ortho=False, up="Y"):
    bpy.context.view_layer.update()
    lo, hi = world_bbox(meshes())
    center = (lo + hi) / 2
    radius = (hi - lo).length / 2
    cam.data.type = "ORTHO" if ortho else "PERSP"
    if ortho:
        cam.data.ortho_scale = max(hi.x - lo.x, hi.y - lo.y) * margin
        cam.location = center + direction.normalized() * (radius * 4)
    else:
        fov = 2 * math.atan(cam.data.sensor_width / 2 / cam.data.lens)
        dist = radius / math.sin(fov / 2) * margin
        cam.location = center + direction.normalized() * dist
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", up).to_euler()
    cam.data.clip_start = 1
    cam.data.clip_end = 1e5

def render(name, w, h):
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.render.filepath = f"{OUT}/{name}.png"
    bpy.ops.render.render(write_still=True)
    print("RENDERED", name)

if "hero" in VARIANTS:
    frame(Vector(base_dir), margin=0.86)
    render("calc_hero", RES, RES)

if "low" in VARIANTS:
    frame(Vector((0.55, 1.0, 0.42)), margin=0.82)
    render("calc_low", RES, int(RES * 0.75))

if "exploded" in VARIANTS:
    groups = [
        (lambda n: n == "Calculator_Base", 0),
        (lambda n: n == "Calculator_Body_V3", 46),
        (lambda n: n.startswith("Calculator_PCB"), 92),
        (lambda n: n == "Calculator_Plate_V2", 138),
        (lambda n: n.startswith("Stylized_Key_Cap"), 190),
        (lambda n: n in ("Calculator_Alcove_V2", "Calculator_Bezel_V2", "Cube"), 205),
    ]
    for ob in meshes():
        for test, dz in groups:
            if test(ob.name):
                ob.location.z += dz
                break
    frame(Vector((base_dir.x, base_dir.y, base_dir.z * 0.55)), margin=1.0)
    render("calc_exploded", int(RES * 0.8), RES)
    for ob in meshes():
        for test, dz in groups:
            if test(ob.name):
                ob.location.z -= dz
                break

if "top" in VARIANTS:
    frame(Vector((0, 0, 1)), margin=1.12, ortho=True)
    render("calc_top", RES, RES)
