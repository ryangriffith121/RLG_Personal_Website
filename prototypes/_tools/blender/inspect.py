import bpy
print("=== SCENE", bpy.context.scene.name, "engine", bpy.context.scene.render.engine)
for o in bpy.data.objects:
    dims = tuple(round(d,4) for d in o.dimensions)
    mats = [s.material.name if s.material else None for s in o.material_slots]
    print("OBJ", o.type, repr(o.name), "dims", dims, "loc", tuple(round(v,3) for v in o.location), "rot", tuple(round(v,3) for v in o.rotation_euler), "mats", mats[:3], "hide", o.hide_render, "parent", o.parent.name if o.parent else None)
print("=== CAMERAS", [c.name for c in bpy.data.cameras])
print("=== MATERIALS", [m.name for m in bpy.data.materials][:40])
prefs = bpy.context.preferences.addons['cycles'].preferences
for t in ('OPTIX','CUDA','HIP','ONEAPI'):
    try:
        prefs.compute_device_type = t
        prefs.refresh_devices()
        print("DEVTYPE", t, [(d.name, d.type) for d in prefs.devices])
    except Exception as e:
        print("DEVTYPE", t, "ERR", e)
