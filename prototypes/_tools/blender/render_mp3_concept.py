"""Concept renders of the Custom MP3 Player, modelled from the README's spec:
a ~40 mm tube, ~150 mm long, a 76x284 bar display behind a frosted shell, and three
full-width knurled ring knobs. 'xray' adds the planned internals (spine PCB, 18650 cell,
encoders with pinions). It is a visualisation of the plan, not the SolidWorks model.

Run: blender -b --factory-startup --python render_mp3_concept.py -- <out_dir> <screen_png> [hero|xray] [res]
"""
import bpy, bmesh, sys, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT, SCREEN = argv[0], argv[1]
VARIANTS = argv[2].split(",") if len(argv) > 2 else ["hero"]
RES = int(argv[3]) if len(argv) > 3 else 1600
S = 0.01                      # 1 mm = 0.01 blender units
R = 20 * S                    # tube radius

for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
sc.eevee.taa_render_samples = 128
sc.eevee.use_raytracing = True
sc.render.film_transparent = True
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGBA"
sc.view_settings.view_transform = "Standard"   # keep the brand colours exact
sc.view_settings.exposure = -0.6


def hexcol(h, a=1.0):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, a)


def principled(name, color, metallic=0.0, rough=0.4, transmission=0.0, alpha=1.0, coat=0.0):
    m = bpy.data.materials.new(name)
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = hexcol(color)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    b.inputs["Transmission Weight"].default_value = transmission
    b.inputs["Alpha"].default_value = alpha
    b.inputs["Coat Weight"].default_value = coat
    if transmission > 0 or alpha < 1:
        for attr, val in (("use_raytrace_refraction", True), ("surface_render_method", "BLENDED"),
                          ("use_transparency_overlap", True)):
            if hasattr(m, attr):
                try:
                    setattr(m, attr, val)
                except Exception:
                    pass
    return m


INDIGO, LIME, LAV, MAG, DEEP = "#412db5", "#e9ff97", "#d9d4e2", "#e5197f", "#2d2178"
XRAY = "xray" in VARIANTS
m_shell = principled("Shell", "#cfc8e6", rough=0.48, alpha=0.16 if XRAY else 1.0, coat=0.35)
m_window = principled("Window", "#1b1440", rough=0.1, alpha=0.16 if XRAY else 0.55, coat=1.0)
m_liner = principled("Liner", "#0f0e19", rough=0.7)
m_ring = principled("Ring", INDIGO, metallic=0.75, rough=0.32)
m_ring_lime = principled("RingLime", LIME, metallic=0.1, rough=0.35)
m_sleeve = principled("Sleeve", DEEP, metallic=0.4, rough=0.5)
m_cap = principled("Cap", LIME, rough=0.42, coat=0.3)
m_port = principled("Port", "#0f0e19", rough=0.6)
m_pcb = principled("PCB", "#14122b", rough=0.55)
m_gold = principled("Gold", "#d8b04a", metallic=1.0, rough=0.25)
m_cell = principled("Cell", MAG, rough=0.35, coat=0.6)
m_steel = principled("Steel", "#b8b6c4", metallic=1.0, rough=0.3)


def screen_mat():
    m = bpy.data.materials.new("Screen")
    nt = m.node_tree
    nt.nodes.clear()
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    img = nt.nodes.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(SCREEN)
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = 3.2
    nt.links.new(tc.outputs["Generated"], img.inputs["Vector"])
    nt.links.new(img.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs["Emission"], o.inputs["Surface"])
    return m


def link(ob, mat=None):
    sc.collection.objects.link(ob)
    if mat:
        ob.data.materials.append(mat)
    return ob


def cylinder_x(name, x0, x1, r_mm, mat, verts=96, bevel_mm=0.0):
    """Cylinder along +X from x0 to x1 (mm) with radius r_mm."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r_mm * S, radius2=r_mm * S,
                          depth=(x1 - x0) * S)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.rotation_euler = (0, math.pi / 2, 0)
    ob.location = (((x0 + x1) / 2) * S, 0, 0)
    for p in me.polygons:
        p.use_smooth = True
    link(ob, mat)
    if bevel_mm:
        bv = ob.modifiers.new("bevel", "BEVEL")
        bv.width = bevel_mm * S
        bv.segments = 4
        bv.limit_method = "ANGLE"
    return ob


def knurled_ring(name, x0, x1, r_out_mm, depth_mm, teeth, mat):
    """A knurled ring: a star-shaped prism (alternating radii) along +X."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    n = teeth * 2
    loops = []
    for x in (x0, x1):
        loop = []
        for i in range(n):
            a = 2 * math.pi * i / n
            rr = (r_out_mm if i % 2 == 0 else r_out_mm - depth_mm) * S
            loop.append(bm.verts.new((x * S, rr * math.cos(a), rr * math.sin(a))))
        loops.append(loop)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((loops[0][i], loops[0][j], loops[1][j], loops[1][i]))
    bm.faces.new(list(reversed(loops[0])))
    bm.faces.new(loops[1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    link(ob, mat)
    bv = ob.modifiers.new("bevel", "BEVEL")
    bv.width = 0.3 * S
    bv.segments = 2
    bv.limit_method = "ANGLE"
    return ob


def tube_sector(name, x0, x1, r_mm, a0_deg, a1_deg, mat, segs=64):
    """Open cylindrical surface along +X between two angles (0 deg = +Y, 90 deg = +Z)."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rows = []
    for x in (x0, x1):
        row = []
        for i in range(segs + 1):
            a = math.radians(a0_deg + (a1_deg - a0_deg) * i / segs)
            row.append(bm.verts.new((x * S, r_mm * S * math.cos(a), r_mm * S * math.sin(a))))
        rows.append(row)
    for i in range(segs):
        bm.faces.new((rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i]))
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    link(ob, mat)
    return ob


def box(name, center_mm, size_mm, mat, bevel_mm=0.0):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.scale = tuple(s * S for s in size_mm)
    ob.location = tuple(c * S for c in center_mm)
    link(ob, mat)
    if bevel_mm:
        bv = ob.modifiers.new("bevel", "BEVEL")
        bv.width = bevel_mm * S
        bv.segments = 3
    return ob


# ---- layout along X (mm) ----------------------------------------------------------
# cap 0-4.5 | display shell 4-92.5 | sleeve | ring 95-110 | sleeve | ring 113-128 | sleeve | ring 131-146 | cap
cylinder_x("CapL", 0, 4.5, 20, m_cap, bevel_mm=1.2)
WIN = 34  # half-angle of the display window, degrees
tube_sector("Shell", 4, 92.5, 20, 90 + WIN, 90 + 360 - WIN, m_shell, segs=120)
tube_sector("Window", 4, 92.5, 20, 90 - WIN, 90 + WIN, m_window, segs=24)
if not XRAY:
    cylinder_x("Liner", 4.2, 92.3, 14.0, m_liner)
for i, (a, b) in enumerate([(92, 95.5), (109.5, 113.5), (127.5, 131.5)]):
    cylinder_x(f"Sleeve{i}", a, b, 18.2, m_sleeve)
knurled_ring("Ring1", 95, 110, 20.6, 0.55, 64, m_ring)
knurled_ring("Ring2", 113, 128, 20.6, 0.55, 64, m_ring)
knurled_ring("Ring3", 131, 146, 20.6, 0.55, 64, m_ring_lime)
cylinder_x("CapR", 145.5, 150, 20, m_cap, bevel_mm=1.2)
# ports: USB-C on the left cap, 3.5 mm jack on the right cap
box("USBC", (-0.15, 0, 0), (1.2, 9.0, 3.4), m_port, bevel_mm=1.4)
cylinder_x("Jack", 149.6, 150.3, 3.0, m_port, verts=48)
# bar display just under the top of the shell (2.25" 76x284 -> ~57 x 15 mm active area)
box("Display", (48, 0, 15.6), (60, 16.5, 0.8), screen_mat())
box("DisplayFrame", (48, 0, 15.0), (63, 19, 0.8), m_pcb)

if XRAY:
    box("Spine", (75, 0, -1.0), (128, 14, 1.6), m_pcb)
    for k in range(12):
        box(f"Pad{k}", (18 + k * 9.5, 5.2, -0.1), (2.2, 1.6, 0.25), m_gold)
    cell = cylinder_x("Cell18650", 12, 77, 9.0, m_cell, verts=64, bevel_mm=0.8)
    cell.location.z = -10.5 * S
    box("Feather", (42, 0, 3.5), (51, 22.8, 1.6), m_pcb)
    box("ESP32S3", (48, 0, 4.6), (18, 13, 2.4), m_steel, bevel_mm=0.4)
    box("DAC", (82, 0, 3.5), (22, 18, 1.6), m_pcb)
    for i, xc in enumerate((102.5, 120.5, 138.5)):
        box(f"Encoder{i}", (xc, 0, 9.0), (12.4, 13.2, 6.5), m_steel, bevel_mm=0.6)
        pin = knurled_ring(f"Pinion{i}", xc - 2.5, xc + 2.5, 5.2, 0.9, 14, m_gold)
        pin.location.z = 15.0 * S


# ---- lights / world -----------------------------------------------------------------
def area(name, loc, size, energy, color=(1, 1, 1), target=(0.75, 0, 0)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.size = size
    ld.energy = energy
    ld.color = color
    ob = bpy.data.objects.new(name, ld)
    sc.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()


area("Key", (-0.6, -1.6, 2.2), 2.4, 300, (1.0, 0.97, 0.94))
area("Rim", (2.4, 1.8, 1.2), 1.6, 300, (0.72, 0.7, 1.0))
area("Fill", (0.8, -2.4, -0.6), 2.0, 90, (0.9, 1.0, 0.85))
world = bpy.data.worlds.new("W")
sc.world = world
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = hexcol("#1b1830")
bg.inputs[1].default_value = 0.6

cam_data = bpy.data.cameras.new("Cam")
cam_data.lens = 70
cam = bpy.data.objects.new("Cam", cam_data)
sc.collection.objects.link(cam)
sc.camera = cam

# tilt the whole player for a dynamic hero angle
root = bpy.data.objects.new("Root", None)
sc.collection.objects.link(root)
for ob in list(sc.objects):
    if ob.type == "MESH":
        ob.parent = root
root.rotation_euler = (math.radians(-8), math.radians(-14), math.radians(-18))
root.location = (0.1, 0, 0)


from bpy_extras.object_utils import world_to_camera_view


def corner_points():
    bpy.context.view_layer.update()
    pts = []
    for ob in sc.objects:
        if ob.type == "MESH" and not ob.hide_render:
            pts += [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    return pts


def fit_camera(direction, margin=0.05):
    """Aim along `direction` and move in until every mesh fills the frame minus `margin`."""
    pts = corner_points()
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    target = (lo + hi) / 2
    dirn = Vector(direction).normalized()

    def place(d):
        cam.location = target + dirn * d
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
        bpy.context.view_layer.update()
        cs = [world_to_camera_view(sc, cam, p) for p in pts]
        return min(c.x for c in cs), max(c.x for c in cs), min(c.y for c in cs), max(c.y for c in cs)

    d = 3.0
    for _ in range(5):
        a, b = 0.2, 60.0
        for _ in range(32):
            mid = (a + b) / 2
            x0, x1, y0, y1 = place(mid)
            if x0 >= margin and x1 <= 1 - margin and y0 >= margin and y1 <= 1 - margin:
                b = mid
            else:
                a = mid
        d = b
        x0, x1, y0, y1 = place(d)
        aspect = sc.render.resolution_x / sc.render.resolution_y
        fw = 2 * d * math.tan(cam.data.angle_x / 2)
        fh = fw / aspect
        right = cam.matrix_world.to_3x3().col[0].normalized()
        up = cam.matrix_world.to_3x3().col[1].normalized()
        target = target + right * (((x0 + x1) / 2 - 0.5) * fw) + up * (((y0 + y1) / 2 - 0.5) * fh)
    place(d)


def shoot(name, direction, target=None, dist=None, w=RES, h=None):
    sc.render.resolution_x = w
    sc.render.resolution_y = h or int(w * 0.6)
    sc.render.resolution_percentage = 100
    fit_camera(direction)
    sc.render.filepath = f"{OUT}/{name}.png"
    bpy.ops.render.render(write_still=True)
    print("RENDERED", name)


if XRAY:
    shoot("mp3_concept_xray", (-0.35, -1.0, 0.75), dist=2.85, w=RES, h=int(RES * 0.62))
else:
    shoot("mp3_concept_hero", (-0.55, -1.0, 0.62), dist=2.85, w=RES, h=int(RES * 0.62))
