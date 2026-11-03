import bpy, sys, time
argv = sys.argv[sys.argv.index("--")+1:]
out = argv[0]
sc = bpy.context.scene
print("camera:", sc.camera.name if sc.camera else None, "res", sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage)
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 960, 720, 100
sc.render.filepath = out
t=time.time()
bpy.ops.render.render(write_still=True)
print("RENDER_SECONDS", round(time.time()-t,1))
