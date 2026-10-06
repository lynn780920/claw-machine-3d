import bpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public/models/pokemon'
OUTPUT.mkdir(parents=True, exist_ok=True)
for number, name in [(25, 'pikachu'), (133, 'eevee'), (94, 'gengar'), (143, 'snorlax'), (54, 'psyduck')]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / f'assets/sources/pokemon/{number}.glb'))
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        for poly in obj.data.polygons:
            poly.use_smooth = True
        for material in obj.data.materials:
            if not material or not material.use_nodes:
                continue
            nodes = material.node_tree.nodes
            for node in nodes:
                if node.type == 'BSDF_PRINCIPLED':
                    node.inputs['Roughness'].default_value = 0.88
                    node.inputs['Metallic'].default_value = 0
                    node.inputs['Sheen Weight'].default_value = 0.3
                    noise = nodes.new('ShaderNodeTexNoise')
                    noise.inputs['Scale'].default_value = 180
                    bump = nodes.new('ShaderNodeBump')
                    bump.inputs['Strength'].default_value = 0.12
                    bump.inputs['Distance'].default_value = 0.001
                    material.node_tree.links.new(noise.outputs['Fac'], bump.inputs['Height'])
                    material.node_tree.links.new(bump.outputs['Normal'], node.inputs['Normal'])
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT / f'{name}.blend'))
    # Procedural microfibres stay in the editable Blender source; GLB carries PBR sheen/roughness.
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT / f'{name}.glb'), export_format='GLB', export_animations=False)
