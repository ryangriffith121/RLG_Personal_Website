import bpy
for name in ["Cube","Plane","Camera"]:
    o = bpy.data.objects.get(name)
    if not o: continue
    print("OBJ", name, "scale", tuple(round(s,3) for s in o.scale), "data", o.data.name if o.data else None)
    if o.type == 'MESH':
        me = o.data
        print("  verts", len(me.vertices), "uv layers", [u.name for u in me.uv_layers])
        xs=[v.co.x for v in me.vertices]; ys=[v.co.y for v in me.vertices]; zs=[v.co.z for v in me.vertices]
        print("  local bbox", (min(xs),max(xs)), (min(ys),max(ys)), (min(zs),max(zs)))
    if o.type == 'CAMERA':
        print("  lens", o.data.lens, "type", o.data.type, "sensor", o.data.sensor_width, "clip", o.data.clip_start, o.data.clip_end)
for m in bpy.data.materials:
    if not m.use_nodes: print("MAT", m.name, "no nodes", tuple(m.diffuse_color)); continue
    bsdf = next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'), None)
    if bsdf:
        print("MAT", m.name, "base", tuple(round(c,3) for c in bsdf.inputs['Base Color'].default_value), "rough", round(bsdf.inputs['Roughness'].default_value,3), "users", m.users)
    else:
        print("MAT", m.name, [n.type for n in m.node_tree.nodes])
w = bpy.context.scene.world
print("WORLD", w.name if w else None, [n.type for n in w.node_tree.nodes] if w and w.use_nodes else None)
if w and w.use_nodes:
    bg = next((n for n in w.node_tree.nodes if n.type=='BACKGROUND'), None)
    if bg: print("  bg color", tuple(bg.inputs[0].default_value), "strength", bg.inputs[1].default_value)
for o in bpy.data.objects:
    if o.type=='LIGHT': print("LIGHT", o.name, o.data.type, "energy", o.data.energy, "color", tuple(o.data.color))
sc=bpy.context.scene
print("UNITS", sc.unit_settings.system, sc.unit_settings.scale_length)
print("EEVEE attrs", [a for a in dir(sc.eevee) if 'ray' in a or 'shadow' in a or 'sample' in a][:30])
