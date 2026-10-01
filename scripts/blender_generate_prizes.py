"""
Blender 5.2 Python Script to Generate High-Fidelity, Professionally Textured Claw Machine Prizes
Outputs:
  - public/models/prizes/<prize_name>.glb (with embedded high-res textures)
  - public/models/blender/<prize_name>.blend (Individual Blender scene)
  - public/models/blender/all_prizes_studio.blend (Unified 3D Studio Showcase)
"""

import bpy
import math
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_GLB_DIR = os.path.join(BASE_DIR, "public", "models", "prizes")
OUT_BLEND_DIR = os.path.join(BASE_DIR, "public", "models", "blender")
TEX_DIR = os.path.join(BASE_DIR, "public", "models", "textures")

os.makedirs(OUT_GLB_DIR, exist_ok=True)
os.makedirs(OUT_BLEND_DIR, exist_ok=True)

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if "Scene Collection" not in bpy.data.collections and len(bpy.data.collections) == 0:
        coll = bpy.data.collections.new("PrizesCollection")
        bpy.context.scene.collection.children.link(coll)

def create_color_material(name, color=(1, 1, 1, 1), roughness=0.5, metallic=0.0, emission=None, emission_strength=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = color
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
        if emission:
            if "Emission Color" in bsdf.inputs:
                bsdf.inputs["Emission Color"].default_value = emission
            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat

def create_textured_material(name, img_filename, roughness=0.35, metallic=0.0, emission=False, emission_strength=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    
    img_path = os.path.join(TEX_DIR, img_filename)
    if os.path.exists(img_path):
        img = bpy.data.images.load(os.path.abspath(img_path))
        tex_node = nodes.new("ShaderNodeTexImage")
        tex_node.image = img
        links.new(tex_node.outputs["Color"], bsdf.inputs["Base Color"])
        if emission:
            links.new(tex_node.outputs["Color"], bsdf.inputs["Emission Color"])
            if "Emission Strength" in bsdf.inputs:
                bsdf.inputs["Emission Strength"].default_value = emission_strength
                
    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = roughness
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = metallic
    return mat

def map_front_face_uv(mesh_obj, poly_idx=3):
    uv_layer = mesh_obj.data.uv_layers.active.data
    loops = mesh_obj.data.polygons[poly_idx].loop_indices
    # Loop 0: (1, 0), Loop 1: (1, 1), Loop 2: (0, 1), Loop 3: (0, 0)
    uv_coords = [(1.0, 0.0), (1.0, 1.0), (0.0, 1.0), (0.0, 0.0)]
    for l, c in zip(loops, uv_coords):
        uv_layer[l].uv = c

def map_top_face_uv(mesh_obj, poly_idx=5):
    uv_layer = mesh_obj.data.uv_layers.active.data
    loops = mesh_obj.data.polygons[poly_idx].loop_indices
    uv_coords = [(1.0, 1.0), (0.0, 1.0), (0.0, 0.0), (1.0, 0.0)]
    for l, c in zip(loops, uv_coords):
        uv_layer[l].uv = c

def add_clear_hang_tab(w, h):
    mat_tab = create_color_material("ClearHangTab", (0.9, 0.95, 1.0, 0.5), roughness=0.1, metallic=0.1)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, h / 2 + 0.11))
    tab = bpy.context.active_object
    tab.scale = (0.26, 0.015, 0.22)
    tab.data.materials.append(mat_tab)
    return tab

def join_all_in_scene(name="PrizeRoot"):
    bpy.ops.object.select_all(action='SELECT')
    objs = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    if not objs:
        return None
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    active_obj = bpy.context.active_object
    active_obj.name = name
    bpy.ops.object.shade_smooth()
    return active_obj

def export_model(prize_name):
    glb_path = os.path.join(OUT_GLB_DIR, f"{prize_name}.glb")
    blend_path = os.path.join(OUT_BLEND_DIR, f"{prize_name}.blend")
    
    try:
        bpy.ops.wm.save_as_mainfile(filepath=blend_path, copy=True)
    except Exception as e:
        print(f"Warning saving blend: {e}")
        
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=True,
        export_apply=True
    )
    print(f"Exported: {glb_path} ({os.path.getsize(glb_path)} bytes)")

# ==============================================================================
# 1. CHIIKAWA (吉依卡哇 萌系立體玩偶 + 2D 高解析動漫五官)
# ==============================================================================
def build_chiikawa():
    reset_scene()
    s = 1.35
    mat_body = create_color_material("ChiikawaFeltWhite", (0.97, 0.97, 0.95, 1), roughness=0.88)
    mat_face = create_textured_material("ChiikawaFaceTex", "chiikawa_face.png", roughness=0.85)
    mat_tag = create_color_material("ArcadeTagHolo", (0.95, 0.35, 0.65, 1), roughness=0.3, metallic=0.4)

    # Body (Plump round)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=18, radius=0.46 * s, location=(0, 0, 0))
    body = bpy.context.active_object
    body.scale = (1.0, 0.95, 0.94)
    body.data.materials.append(mat_body)

    # Head
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=18, radius=0.42 * s, location=(0, 0, 0.56 * s))
    head = bpy.context.active_object
    head.scale = (1.0, 0.96, 0.96)
    head.data.materials.append(mat_body)

    # Face Decal Quad (Front of head)
    bpy.ops.mesh.primitive_plane_add(size=0.62 * s, location=(0, -0.415 * s, 0.58 * s))
    face_quad = bpy.context.active_object
    face_quad.rotation_euler = (math.pi / 2, 0, 0)
    face_quad.data.materials.append(mat_face)

    # Round Ears
    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=0.13 * s, location=(side * 0.30 * s, 0, 0.92 * s))
        ear = bpy.context.active_object
        ear.data.materials.append(mat_body)

    # Arms
    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.13 * s, location=(side * 0.48 * s, -0.06 * s, 0.10 * s))
        arm = bpy.context.active_object
        arm.scale = (0.75, 1.1, 0.8)
        arm.data.materials.append(mat_body)

    # Feet
    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.13 * s, location=(side * 0.22 * s, -0.16 * s, -0.42 * s))
        ft = bpy.context.active_object
        ft.scale = (1.0, 1.25, 0.6)
        ft.data.materials.append(mat_body)

    # Round Tail
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=10, radius=0.10 * s, location=(0, 0.44 * s, -0.18 * s))
    tail = bpy.context.active_object
    tail.data.materials.append(mat_body)

    # Arcade Laser Hang Tag
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.35 * s, 0.05 * s, 0.82 * s))
    tag = bpy.context.active_object
    tag.scale = (0.01 * s, 0.14 * s, 0.20 * s)
    tag.rotation_euler = (0.15, -0.2, 0.3)
    tag.data.materials.append(mat_tag)

    join_all_in_scene("Chiikawa")
    export_model("chiikawa")

# ==============================================================================
# 2. CAPYBARA (水豚君 頂橘子娃娃)
# ==============================================================================
def build_capybara():
    reset_scene()
    s = 1.25
    mat_fur = create_color_material("CapyFurBrown", (0.58, 0.42, 0.28, 1), roughness=0.88)
    mat_snout = create_color_material("CapySnoutDark", (0.44, 0.30, 0.18, 1), roughness=0.85)
    mat_face = create_textured_material("CapyFaceTex", "capybara_face.png", roughness=0.85)
    mat_orange = create_color_material("YuzuCitron", (1.0, 0.68, 0.05, 1), roughness=0.45)
    mat_leaf = create_color_material("YuzuLeafGreen", (0.15, 0.70, 0.20, 1), roughness=0.5)

    # Loaf Body
    bpy.ops.mesh.primitive_cylinder_add(radius=0.44 * s, depth=0.88 * s, location=(0, 0.05 * s, 0))
    body = bpy.context.active_object
    body.rotation_euler = (math.pi / 2, 0, 0)
    body.scale = (1.0, 0.9, 1.0)
    body.data.materials.append(mat_fur)

    # Snout
    bpy.ops.mesh.primitive_cube_add(size=0.6 * s, location=(0, -0.52 * s, 0.12 * s))
    snout = bpy.context.active_object
    snout.scale = (0.75, 0.82, 0.70)
    snout.data.materials.append(mat_snout)

    # Front Snout Face Plane
    bpy.ops.mesh.primitive_plane_add(size=0.50 * s, location=(0, -0.77 * s, 0.12 * s))
    f_plane = bpy.context.active_object
    f_plane.rotation_euler = (math.pi / 2, 0, 0)
    f_plane.data.materials.append(mat_face)

    # Ears
    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.08 * s, location=(side * 0.28 * s, -0.22 * s, 0.36 * s))
        ear = bpy.context.active_object
        ear.scale = (0.4, 0.8, 1.2)
        ear.rotation_euler = (0.2, side * 0.4, 0)
        ear.data.materials.append(mat_snout)

    # Paws
    for sx in (-1, 1):
        for sy in (-1, 1):
            bpy.ops.mesh.primitive_cylinder_add(radius=0.11 * s, depth=0.28 * s, location=(sx * 0.28 * s, sy * 0.32 * s, -0.38 * s))
            paw = bpy.context.active_object
            paw.data.materials.append(mat_snout)

    # Yuzu Orange on Head
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=0.16 * s, location=(0, -0.32 * s, 0.52 * s))
    yuzu = bpy.context.active_object
    yuzu.data.materials.append(mat_orange)

    # Leaf
    bpy.ops.mesh.primitive_cube_add(size=0.1 * s, location=(0.06 * s, -0.30 * s, 0.68 * s))
    leaf = bpy.context.active_object
    leaf.scale = (1.2, 0.4, 0.1)
    leaf.rotation_euler = (0.2, -0.4, 0.3)
    leaf.data.materials.append(mat_leaf)

    join_all_in_scene("Capybara")
    export_model("capybara")

# ==============================================================================
# 3. SSR GOLDEN CAPYBARA (SSR 純金水豚君 + 皇冠)
# ==============================================================================
def build_golden_capybara():
    reset_scene()
    s = 1.30
    mat_gold = create_color_material("CapyGold24K", (1.0, 0.82, 0.22, 1), roughness=0.12, metallic=0.96)
    mat_ruby = create_color_material("CrownRuby", (0.9, 0.05, 0.12, 1), roughness=0.15, metallic=0.2, emission=(1.0, 0.1, 0.2, 1), emission_strength=3.0)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.45 * s, depth=0.90 * s, location=(0, 0.05 * s, 0))
    body = bpy.context.active_object
    body.rotation_euler = (math.pi / 2, 0, 0)
    body.data.materials.append(mat_gold)

    bpy.ops.mesh.primitive_cube_add(size=0.6 * s, location=(0, -0.52 * s, 0.12 * s))
    snout = bpy.context.active_object
    snout.scale = (0.75, 0.82, 0.70)
    snout.data.materials.append(mat_gold)

    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.08 * s, location=(side * 0.28 * s, -0.22 * s, 0.36 * s))
        ear = bpy.context.active_object
        ear.scale = (0.4, 0.8, 1.2)
        ear.data.materials.append(mat_gold)

    for sx in (-1, 1):
        for sy in (-1, 1):
            bpy.ops.mesh.primitive_cylinder_add(radius=0.11 * s, depth=0.28 * s, location=(sx * 0.28 * s, sy * 0.32 * s, -0.38 * s))
            paw = bpy.context.active_object
            paw.data.materials.append(mat_gold)

    # Crown Ring
    bpy.ops.mesh.primitive_cylinder_add(radius=0.18 * s, depth=0.08 * s, location=(0, -0.30 * s, 0.44 * s))
    crown = bpy.context.active_object
    crown.data.materials.append(mat_gold)

    for i in range(5):
        angle = i * (2 * math.pi / 5)
        cx = math.cos(angle) * 0.16 * s
        cy = -0.30 * s + math.sin(angle) * 0.16 * s
        bpy.ops.mesh.primitive_cone_add(radius1=0.04 * s, depth=0.14 * s, location=(cx, cy, 0.54 * s))
        spike = bpy.context.active_object
        spike.data.materials.append(mat_gold)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.045 * s, location=(0, -0.46 * s, 0.55 * s))
    ruby = bpy.context.active_object
    ruby.data.materials.append(mat_ruby)

    join_all_in_scene("GoldenCapybara")
    export_model("ssr_golden_capybara")

# ==============================================================================
# 4. KIRBY (星之卡比 圓形粉紅玩偶 + 高解析臉龐)
# ==============================================================================
def build_kirby():
    reset_scene()
    s = 1.30
    mat_pink = create_color_material("KirbyPink", (1.0, 0.52, 0.70, 1), roughness=0.75)
    mat_red = create_color_material("KirbyShoeRed", (0.92, 0.12, 0.22, 1), roughness=0.6)
    mat_face = create_textured_material("KirbyFaceTex", "kirby_face.png", roughness=0.75)

    # Body
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24, radius=0.50 * s, location=(0, 0, 0.15 * s))
    body = bpy.context.active_object
    body.data.materials.append(mat_pink)

    # Face Decal Quad
    bpy.ops.mesh.primitive_plane_add(size=0.64 * s, location=(0, -0.495 * s, 0.15 * s))
    face_quad = bpy.context.active_object
    face_quad.rotation_euler = (math.pi / 2, 0, 0)
    face_quad.data.materials.append(mat_face)

    # Big Red Shoes
    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=0.25 * s, location=(side * 0.34 * s, -0.15 * s, -0.25 * s))
        shoe = bpy.context.active_object
        shoe.scale = (0.9, 1.4, 0.65)
        shoe.rotation_euler = (0.2, side * 0.2, 0)
        shoe.data.materials.append(mat_red)

    # Stubby Arms
    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.18 * s, location=(side * 0.52 * s, 0, 0.28 * s))
        arm = bpy.context.active_object
        arm.scale = (1.2, 0.85, 0.85)
        arm.rotation_euler = (0, side * -0.4, 0)
        arm.data.materials.append(mat_pink)

    join_all_in_scene("Kirby")
    export_model("kirby")

# ==============================================================================
# 5. CALICO CAT (三花貓 羊毛氈萌貓 + 藍白條紋圍巾)
# ==============================================================================
def build_calico_cat():
    reset_scene()
    s = 1.15
    mat_white = create_color_material("CatWhite", (0.96, 0.96, 0.95, 1), roughness=0.85)
    mat_orange = create_color_material("CatOrange", (0.88, 0.48, 0.15, 1), roughness=0.85)
    mat_black = create_color_material("CatBlack", (0.12, 0.12, 0.14, 1), roughness=0.8)
    mat_face = create_textured_material("CatFaceTex", "cat_face.png", roughness=0.85)
    mat_scarf = create_color_material("ScarfBlue", (0.10, 0.55, 0.90, 1), roughness=0.8)

    # Body
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.46 * s, location=(0, 0.05 * s, 0))
    body = bpy.context.active_object
    body.scale = (1.0, 1.1, 0.95)
    body.data.materials.append(mat_white)

    # Head
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.40 * s, location=(0, -0.15 * s, 0.50 * s))
    head = bpy.context.active_object
    head.data.materials.append(mat_white)

    # Face Decal
    bpy.ops.mesh.primitive_plane_add(size=0.55 * s, location=(0, -0.545 * s, 0.50 * s))
    face_quad = bpy.context.active_object
    face_quad.rotation_euler = (math.pi / 2, 0, 0)
    face_quad.data.materials.append(mat_face)

    # Ears
    bpy.ops.mesh.primitive_cone_add(radius1=0.14 * s, depth=0.26 * s, location=(-0.24 * s, -0.12 * s, 0.84 * s))
    le = bpy.context.active_object
    le.rotation_euler = (0.1, -0.2, 0.1)
    le.data.materials.append(mat_orange)

    bpy.ops.mesh.primitive_cone_add(radius1=0.14 * s, depth=0.26 * s, location=(0.24 * s, -0.12 * s, 0.84 * s))
    re = bpy.context.active_object
    re.rotation_euler = (0.1, 0.2, -0.1)
    re.data.materials.append(mat_black)

    # Scarf Ring
    bpy.ops.mesh.primitive_torus_add(major_radius=0.32 * s, minor_radius=0.08 * s, location=(0, -0.10 * s, 0.22 * s))
    scarf = bpy.context.active_object
    scarf.data.materials.append(mat_scarf)

    # Tail
    bpy.ops.mesh.primitive_cylinder_add(radius=0.06 * s, depth=0.55 * s, location=(0, 0.46 * s, 0.22 * s))
    tail = bpy.context.active_object
    tail.rotation_euler = (math.pi * 0.25, 0, 0.2)
    tail.data.materials.append(mat_orange)

    join_all_in_scene("CalicoCat")
    export_model("my_cat")

# ==============================================================================
# 6. BLINDBOX (泡泡瑪特 潮玩盲盒 W=0.68, D=0.58, H=0.98)
# ==============================================================================
def build_blindbox():
    reset_scene()
    W, D, H = 0.68, 0.58, 0.98
    mat_side = create_color_material("BlindBoxLilac", (0.75, 0.25, 0.60, 1), roughness=0.3)
    mat_front = create_textured_material("BlindBoxFrontTex", "blindbox_front.png", roughness=0.25)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    box = bpy.context.active_object
    box.scale = (W, D, H)
    box.data.materials.append(mat_side)
    box.data.materials.append(mat_front)

    # Assign Front polygon (index 3) to mat_front and map UV
    box.data.polygons[3].material_index = 1
    map_front_face_uv(box, 3)

    add_clear_hang_tab(W, H)
    join_all_in_scene("BlindBox")
    export_model("blindbox")

# ==============================================================================
# 7. SSR GLOWING LABUBU (SSR 賽博霓虹發光盲盒 W=0.72, D=0.62, H=1.02)
# ==============================================================================
def build_ssr_glowing_labubu():
    reset_scene()
    W, D, H = 0.72, 0.62, 1.02
    mat_dark = create_color_material("CyberObsidian", (0.04, 0.05, 0.08, 1), roughness=0.15, metallic=0.85)
    mat_front = create_textured_material("SSRLabubuFrontTex", "ssr_labubu_front.png", roughness=0.15, emission=True, emission_strength=2.5)
    mat_neon = create_color_material("NeonCyanGlow", (0.0, 1.0, 0.95, 1), roughness=0.1, emission=(0.0, 1.0, 0.95, 1), emission_strength=4.5)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    box = bpy.context.active_object
    box.scale = (W, D, H)
    box.data.materials.append(mat_dark)
    box.data.materials.append(mat_front)

    box.data.polygons[3].material_index = 1
    map_front_face_uv(box, 3)

    # 4 Glowing Neon Edge Rods
    for sx in (-W / 2, W / 2):
        for sy in (-D / 2, D / 2):
            bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=H, location=(sx, sy, 0))
            strip = bpy.context.active_object
            strip.data.materials.append(mat_neon)

    add_clear_hang_tab(W, H)
    join_all_in_scene("SSRGlowingLabubu")
    export_model("ssr_glowing_labubu")

# ==============================================================================
# 8. SNACK PACK (卡樂比/樂事洋芋片充氣包 W=0.82, D=0.42, H=1.05)
# ==============================================================================
def build_snack_pack():
    reset_scene()
    mat_body = create_color_material("SnackBodyRed", (0.85, 0.10, 0.10, 1), roughness=0.25, metallic=0.4)
    mat_front = create_textured_material("SnackPackFrontTex", "snack_pack_front.png", roughness=0.25, metallic=0.3)
    mat_gold = create_color_material("FoilCrimpGold", (1.0, 0.80, 0.15, 1), roughness=0.2, metallic=0.85)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.48, location=(0, 0, 0))
    body = bpy.context.active_object
    body.scale = (0.85, 0.44, 1.05)
    body.data.materials.append(mat_body)

    # Front Decal Quad
    bpy.ops.mesh.primitive_plane_add(size=0.80, location=(0, -0.22, 0))
    front_quad = bpy.context.active_object
    front_quad.rotation_euler = (math.pi / 2, 0, 0)
    front_quad.scale = (1.0, 1.05, 1.0)
    front_quad.data.materials.append(mat_front)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.53))
    top_crimp = bpy.context.active_object
    top_crimp.scale = (0.78, 0.04, 0.10)
    top_crimp.data.materials.append(mat_gold)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, -0.53))
    bot_crimp = bpy.context.active_object
    bot_crimp.scale = (0.78, 0.04, 0.10)
    bot_crimp.data.materials.append(mat_gold)

    join_all_in_scene("SnackPack")
    export_model("snack_pack")

# ==============================================================================
# 9. DRAGON BALL BOX (七龍珠 DXF 公仔彩盒 W=0.82, D=0.68, H=1.08)
# ==============================================================================
def build_dragonball():
    reset_scene()
    W, D, H = 0.82, 0.68, 1.08
    mat_side = create_color_material("DBZOrangeBox", (0.95, 0.40, 0.0, 1), roughness=0.35)
    mat_front = create_textured_material("DBZFrontTex", "dragonball_front.png", roughness=0.3)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    box = bpy.context.active_object
    box.scale = (W, D, H)
    box.data.materials.append(mat_side)
    box.data.materials.append(mat_front)

    box.data.polygons[3].material_index = 1
    map_front_face_uv(box, 3)

    add_clear_hang_tab(W, H)
    join_all_in_scene("DragonBallBox")
    export_model("dragonball")

# ==============================================================================
# 10. ONE PIECE BOX (航海王 景品公仔彩盒 W=0.80, D=0.66, H=1.06)
# ==============================================================================
def build_onepiece():
    reset_scene()
    W, D, H = 0.80, 0.66, 1.06
    mat_side = create_color_material("OPNavyBox", (0.05, 0.06, 0.12, 1), roughness=0.35)
    mat_front = create_textured_material("OPFrontTex", "onepiece_front.png", roughness=0.3)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    box = bpy.context.active_object
    box.scale = (W, D, H)
    box.data.materials.append(mat_side)
    box.data.materials.append(mat_front)

    box.data.polygons[3].material_index = 1
    map_front_face_uv(box, 3)

    add_clear_hang_tab(W, H)
    join_all_in_scene("OnePieceBox")
    export_model("onepiece")

# ==============================================================================
# 11. MUG BOX (三麗鷗馬克杯禮盒 W=1.0, D=0.78, H=0.78)
# ==============================================================================
def build_mug_box():
    reset_scene()
    W, D, H = 1.0, 0.78, 0.78
    mat_side = create_color_material("MugPinkBox", (1.0, 0.88, 0.94, 1), roughness=0.45)
    mat_front = create_textured_material("MugFrontTex", "mug_box_front.png", roughness=0.35)
    mat_ribbon = create_color_material("MugBowRed", (0.95, 0.25, 0.55, 1), roughness=0.3)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    box = bpy.context.active_object
    box.scale = (W, D, H)
    box.data.materials.append(mat_side)
    box.data.materials.append(mat_front)

    box.data.polygons[3].material_index = 1
    map_front_face_uv(box, 3)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, H / 2 + 0.04))
    bow = bpy.context.active_object
    bow.scale = (0.24, 0.24, 0.06)
    bow.rotation_euler = (0, 0, math.pi * 0.25)
    bow.data.materials.append(mat_ribbon)

    join_all_in_scene("MugBox")
    export_model("mug_box")

# ==============================================================================
# 12. SANRIO BOTTLE (三麗鷗 保溫水壺 R=0.26, H=1.1)
# ==============================================================================
def build_sanrio_bottle():
    reset_scene()
    mat_body = create_textured_material("SanrioBottleTex", "sanrio_bottle_front.png", roughness=0.25, metallic=0.2)
    mat_steel = create_color_material("FlaskSteelRing", (0.88, 0.88, 0.90, 1), roughness=0.15, metallic=0.92)
    mat_lid = create_color_material("FlaskPopLid", (0.95, 0.20, 0.52, 1), roughness=0.4)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.26, depth=0.90, location=(0, 0, -0.06))
    flask = bpy.context.active_object
    flask.data.materials.append(mat_body)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.265, depth=0.06, location=(0, 0, 0.41))
    ring = bpy.context.active_object
    ring.data.materials.append(mat_steel)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=0.22, location=(0, 0, 0.55))
    lid = bpy.context.active_object
    lid.data.materials.append(mat_lid)

    bpy.ops.mesh.primitive_torus_add(major_radius=0.12, minor_radius=0.025, location=(0, 0, 0.70))
    strap = bpy.context.active_object
    strap.rotation_euler = (math.pi / 2, 0, 0)
    strap.data.materials.append(mat_lid)

    join_all_in_scene("SanrioBottle")
    export_model("sanrio_bottle")

# ==============================================================================
# 13. COOKIE BOX (丹麥皇家曲奇餅乾鐵盒 R=0.40, H=0.30)
# ==============================================================================
def build_cookie_box():
    reset_scene()
    R, H = 0.40, 0.30
    mat_body = create_color_material("CookieTinBlue", (0.08, 0.18, 0.45, 1), roughness=0.25, metallic=0.7)
    mat_top = create_textured_material("CookieTinTopTex", "cookie_box_top.png", roughness=0.2, metallic=0.3)
    mat_gold = create_color_material("CookieTinGoldTrim", (0.95, 0.78, 0.25, 1), roughness=0.2, metallic=0.85)

    bpy.ops.mesh.primitive_cylinder_add(radius=R, depth=H, location=(0, 0, 0))
    tin = bpy.context.active_object
    tin.data.materials.append(mat_body)

    # Top Cap Plane with Cookie Tin Art
    bpy.ops.mesh.primitive_plane_add(size=R * 2, location=(0, 0, H / 2 + 0.002))
    cap = bpy.context.active_object
    cap.data.materials.append(mat_top)

    bpy.ops.mesh.primitive_torus_add(major_radius=R + 0.005, minor_radius=0.025, location=(0, 0, H / 2))
    rim = bpy.context.active_object
    rim.data.materials.append(mat_gold)

    join_all_in_scene("CookieBox")
    export_model("cookie_box")

# ==============================================================================
# 14. PS5 BOX (PlayStation 5 主機彩盒 W=1.7, D=0.85, H=1.9)
# ==============================================================================
def build_ps5():
    reset_scene()
    W, D, H = 1.7, 0.85, 1.9
    mat_side = create_color_material("PS5WhiteBox", (0.96, 0.96, 0.98, 1), roughness=0.35)
    mat_front = create_textured_material("PS5FrontTex", "ps5_front.png", roughness=0.3)
    mat_black = create_color_material("PS5HandleBlack", (0.05, 0.05, 0.07, 1), roughness=0.5)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    box = bpy.context.active_object
    box.scale = (W, D, H)
    box.data.materials.append(mat_side)
    box.data.materials.append(mat_front)

    box.data.polygons[3].material_index = 1
    map_front_face_uv(box, 3)

    bpy.ops.mesh.primitive_torus_add(major_radius=0.25, minor_radius=0.045, location=(0, 0, H / 2 + 0.08))
    handle = bpy.context.active_object
    handle.scale = (1.0, 0.5, 1.0)
    handle.data.materials.append(mat_black)

    join_all_in_scene("PS5Box")
    export_model("ps5")

# ==============================================================================
# 15. SWITCH BOX (任天堂 Switch OLED 盒裝 W=1.5, D=0.7, H=1.2)
# ==============================================================================
def build_switch():
    reset_scene()
    W, D, H = 1.5, 0.7, 1.2
    mat_side = create_color_material("SwitchRedBox", (0.90, 0.0, 0.08, 1), roughness=0.35)
    mat_front = create_textured_material("SwitchFrontTex", "switch_front.png", roughness=0.3)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    box = bpy.context.active_object
    box.scale = (W, D, H)
    box.data.materials.append(mat_side)
    box.data.materials.append(mat_front)

    box.data.polygons[3].material_index = 1
    map_front_face_uv(box, 3)

    join_all_in_scene("SwitchBox")
    export_model("switch")

# ==============================================================================
# 16. DYSON BOX (Dyson 吸塵器盒 W=0.9, D=0.8, H=2.4)
# ==============================================================================
def build_dyson():
    reset_scene()
    W, D, H = 0.9, 0.8, 2.4
    mat_side = create_color_material("DysonGraphite", (0.12, 0.12, 0.14, 1), roughness=0.4, metallic=0.3)
    mat_front = create_textured_material("DysonFrontTex", "dyson_front.png", roughness=0.3)
    mat_copper = create_color_material("DysonCopperTrim", (0.85, 0.45, 0.22, 1), roughness=0.25, metallic=0.88)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    box = bpy.context.active_object
    box.scale = (W, D, H)
    box.data.materials.append(mat_side)
    box.data.materials.append(mat_front)

    box.data.polygons[3].material_index = 1
    map_front_face_uv(box, 3)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.20))
    accent = bpy.context.active_object
    accent.scale = (W * 1.01, D * 1.01, 0.15)
    accent.data.materials.append(mat_copper)

    join_all_in_scene("DysonBox")
    export_model("dyson")

# ==============================================================================
# 17. MARSHALL (Marshall 復古英倫藍牙音箱 W=1.5, D=0.95, H=1.1)
# ==============================================================================
def build_marshall():
    reset_scene()
    W, D, H = 1.5, 0.95, 1.1
    mat_leather = create_color_material("MarshallVinyl", (0.08, 0.08, 0.08, 1), roughness=0.75)
    mat_front = create_textured_material("MarshallFrontTex", "marshall_front.png", roughness=0.45, metallic=0.2)
    mat_brass = create_color_material("MarshallBrassKnobs", (0.88, 0.72, 0.28, 1), roughness=0.2, metallic=0.92)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    cabinet = bpy.context.active_object
    cabinet.scale = (W, D, H)
    cabinet.data.materials.append(mat_leather)
    cabinet.data.materials.append(mat_front)

    cabinet.data.polygons[3].material_index = 1
    map_front_face_uv(cabinet, 3)

    # Brass Top Plate & Knobs
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, H / 2 + 0.005))
    ctrl = bpy.context.active_object
    ctrl.scale = (0.75, 0.35, 0.01)
    ctrl.data.materials.append(mat_brass)

    for i in (-1, 0, 1):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=0.06, location=(i * 0.22, 0, H / 2 + 0.04))
        knob = bpy.context.active_object
        knob.data.materials.append(mat_brass)

    join_all_in_scene("MarshallSpeaker")
    export_model("marshall")

# ==============================================================================
# 18. LEGO (樂高積木盒 W=1.8, D=0.8, H=1.2)
# ==============================================================================
def build_lego():
    reset_scene()
    W, D, H = 1.8, 0.8, 1.2
    mat_side = create_color_material("LegoYellowBox", (1.0, 0.82, 0.05, 1), roughness=0.35)
    mat_front = create_textured_material("LegoFrontTex", "lego_front.png", roughness=0.3)
    mat_red = create_color_material("LegoStudRed", (0.90, 0.10, 0.10, 1), roughness=0.3)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    box = bpy.context.active_object
    box.scale = (W, D, H)
    box.data.materials.append(mat_side)
    box.data.materials.append(mat_front)

    box.data.polygons[3].material_index = 1
    map_front_face_uv(box, 3)

    # 3D Lego Studs on Top
    for sx in (-0.5, 0, 0.5):
        for sy in (-0.2, 0.2):
            bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=0.05, location=(sx, sy, H / 2 + 0.025))
            stud = bpy.context.active_object
            stud.data.materials.append(mat_red)

    join_all_in_scene("GiantLegoBox")
    export_model("lego")

# ==============================================================================
# 19. GIANT TEDDY BEAR (巨型泰迪熊玩偶 1.20x Scale)
# ==============================================================================
def build_giant_bear():
    reset_scene()
    s = 1.20
    mat_fur = create_color_material("BearFurCaramel", (0.55, 0.38, 0.24, 1), roughness=0.88)
    mat_face = create_textured_material("BearFaceTex", "teddy_bear_face.png", roughness=0.85)
    mat_ribbon = create_color_material("BearRibbonSatin", (0.88, 0.12, 0.22, 1), roughness=0.3)

    # Torso
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.60 * s, location=(0, 0, 0.15 * s))
    torso = bpy.context.active_object
    torso.scale = (1.05, 1.15, 0.95)
    torso.data.materials.append(mat_fur)

    # Head
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.52 * s, location=(0, 0, 0.82 * s))
    head = bpy.context.active_object
    head.data.materials.append(mat_fur)

    # Face Decal
    bpy.ops.mesh.primitive_plane_add(size=0.68 * s, location=(0, -0.48 * s, 0.82 * s))
    face_quad = bpy.context.active_object
    face_quad.rotation_euler = (math.pi / 2, 0, 0)
    face_quad.data.materials.append(mat_face)

    # Ears
    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.20 * s, location=(side * 0.45 * s, 0.05 * s, 1.22 * s))
        ear = bpy.context.active_object
        ear.scale = (0.5, 0.9, 0.9)
        ear.data.materials.append(mat_fur)

    # Arms
    for side in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.18 * s, depth=0.65 * s, location=(side * 0.65 * s, -0.05 * s, 0.22 * s))
        arm = bpy.context.active_object
        arm.rotation_euler = (0.3, side * -0.4, 0)
        arm.data.materials.append(mat_fur)

    # Legs
    for side in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.20 * s, depth=0.68 * s, location=(side * 0.35 * s, -0.38 * s, -0.28 * s))
        leg = bpy.context.active_object
        leg.rotation_euler = (math.pi / 2 - 0.2, side * 0.2, 0)
        leg.data.materials.append(mat_fur)

    # Bow Tie
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.52 * s, 0.35 * s))
    bow = bpy.context.active_object
    bow.scale = (0.40 * s, 0.18 * s, 0.12 * s)
    bow.data.materials.append(mat_ribbon)

    join_all_in_scene("GiantTeddyBear")
    export_model("giant_bear")

# ==============================================================================
# UNIFIED 3D STUDIO BLENDER SCENE (包含所有 19 種精緻物品的展廳專案)
# ==============================================================================
def build_all_studio_scene():
    reset_scene()
    print("Building all_prizes_studio.blend showcase...")
    
    prize_keys = [
        "chiikawa", "capybara", "ssr_golden_capybara", "kirby", "my_cat",
        "blindbox", "ssr_glowing_labubu", "snack_pack", "dragonball", "onepiece",
        "mug_box", "sanrio_bottle", "cookie_box", "ps5", "switch",
        "dyson", "marshall", "lego", "giant_bear"
    ]
    
    mat_floor = create_color_material("StudioFloor", (0.05, 0.06, 0.08, 1), roughness=0.2, metallic=0.5)
    bpy.ops.mesh.primitive_plane_add(size=50, location=(0, 0, -1.0))
    floor = bpy.context.active_object
    floor.data.materials.append(mat_floor)
    
    bpy.ops.object.light_add(type='SUN', location=(5, -10, 15))
    sun = bpy.context.active_object
    sun.data.energy = 5.0
    
    for idx, key in enumerate(prize_keys):
        glb_file = os.path.join(OUT_GLB_DIR, f"{key}.glb")
        if os.path.exists(glb_file):
            col = idx % 7
            row = idx // 7
            pos_x = (col - 3) * 2.4
            pos_y = (row - 1) * 3.0
            bpy.ops.import_scene.gltf(filepath=glb_file)
            imported_objs = bpy.context.selected_objects
            for obj in imported_objs:
                obj.location.x += pos_x
                obj.location.y += pos_y
                
    studio_path = os.path.join(OUT_BLEND_DIR, "all_prizes_studio.blend")
    bpy.ops.wm.save_as_mainfile(filepath=studio_path)
    print(f"Showcase scene saved: {studio_path}")

def main():
    generators = [
        ("chiikawa", build_chiikawa),
        ("capybara", build_capybara),
        ("ssr_golden_capybara", build_golden_capybara),
        ("kirby", build_kirby),
        ("my_cat", build_calico_cat),
        ("blindbox", build_blindbox),
        ("ssr_glowing_labubu", build_ssr_glowing_labubu),
        ("snack_pack", build_snack_pack),
        ("dragonball", build_dragonball),
        ("onepiece", build_onepiece),
        ("mug_box", build_mug_box),
        ("sanrio_bottle", build_sanrio_bottle),
        ("cookie_box", build_cookie_box),
        ("ps5", build_ps5),
        ("switch", build_switch),
        ("dyson", build_dyson),
        ("marshall", build_marshall),
        ("lego", build_lego),
        ("giant_bear", build_giant_bear),
    ]

    print(f"=== Starting Blender generation of {len(generators)} textured prizes ===")
    for idx, (name, gen_func) in enumerate(generators, 1):
        print(f"[{idx}/{len(generators)}] Modeling and texturing '{name}'...")
        gen_func()

    build_all_studio_scene()
    print("=== All 19 textured prizes & studio scene successfully generated! ===")

if __name__ == "__main__":
    main()
