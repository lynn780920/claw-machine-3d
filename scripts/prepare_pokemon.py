import bpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public/models/pokemon'
OUTPUT.mkdir(parents=True, exist_ok=True)
selected = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
for number, name in [(25, 'pikachu'), (1, 'bulbasaur'), (133, 'eevee'), (7, 'squirtle')]:
    if selected and name not in selected:
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / f'assets/sources/pokemon/{number}.glb'))
    originals = list(bpy.context.scene.objects)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in originals:
        if obj.type == 'MESH' and not obj.hide_render and len(obj.data.materials) > 0:
            evaluated = obj.evaluated_get(depsgraph)
            mesh = bpy.data.meshes.new_from_object(evaluated, depsgraph=depsgraph)
            mesh.transform(obj.matrix_world)
            static = bpy.data.objects.new(f'{name}_{obj.name}', mesh)
            bpy.context.collection.objects.link(static)
    for obj in originals:
        bpy.data.objects.remove(obj, do_unlink=True)
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
