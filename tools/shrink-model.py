# Prepare a Tripo/TRELLIS hero GLB for the game: textures to 1024 px JPEG, no PBR maps.
# Usage: pip install bpy && python3 tools/shrink-model.py -- in.glb src/models/<hero>.glb
import bpy, sys
src, dst = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
for img in bpy.data.images:
    if img.size[0] > 1024: img.scale(1024, 1024)
for mat in bpy.data.materials:
    if not mat.use_nodes: continue
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if not bsdf: continue
    for name in ('Metallic', 'Roughness', 'Normal'):
        for l in list(bsdf.inputs[name].links): mat.node_tree.links.remove(l)
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', export_image_format='JPEG', export_jpeg_quality=85, export_skins=True, export_animations=False)
