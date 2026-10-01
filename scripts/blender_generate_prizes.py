"""
Blender 5.2 Python Script to Model and Export all Claw Machine 3D Prizes
Outputs:
  - public/models/prizes/<prize_name>.glb
  - public/models/blender/<prize_name>.blend (Individual Blender file for each prize)
  - public/models/blender/all_prizes_studio.blend (Unified 3D Studio Showcase file for Blender)
"""

import bpy
import math
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_GLB_DIR = os.path.join(BASE_DIR, "public", "models", "prizes")
OUT_BLEND_DIR = os.path.join(BASE_DIR, "public", "models", "blender")

os.makedirs(OUT_GLB_DIR, exist_ok=True)
os.makedirs(OUT_BLEND_DIR, exist_ok=True)

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if "Scene Collection" not in bpy.data.collections and len(bpy.data.collections) == 0:
        coll = bpy.data.collections.new("PrizesCollection")
        bpy.context.scene.collection.children.link(coll)

def create_material(name, color=(1, 1, 1, 1), roughness=0.5, metallic=0.0, emission=None, emission_strength=1.0):
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
# 1. CHIIKAWA (吉依卡哇 圓滾滾立體玩偶 1.35x Scale)
# ==============================================================================
def build_chiikawa():
    reset_scene()
    mat_body = create_material("ChiikawaWhite", (0.97, 0.97, 0.95, 1), roughness=0.85)
    mat_black = create_material("ChiikawaBlack", (0.08, 0.08, 0.08, 1), roughness=0.3)
    mat_white = create_material("ChiikawaEyeWhite", (1, 1, 1, 1), roughness=0.2)
    mat_pink = create_material("ChiikawaCheek", (1.0, 0.65, 0.72, 1), roughness=0.9)
    mat_nose = create_material("ChiikawaNose", (0.8, 0.45, 0.52, 1), roughness=0.8)
    mat_tag = create_material("ChiikawaTag", (0.95, 0.35, 0.65, 1), roughness=0.3, metallic=0.2)

    s = 1.35
    # Body
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=18, radius=0.46 * s, location=(0, 0, 0))
    body = bpy.context.active_object
    body.scale = (1.0, 0.96, 0.94)
    body.data.materials.append(mat_body)

    # Head
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=18, radius=0.42 * s, location=(0, 0, 0.56 * s))
    head = bpy.context.active_object
    head.scale = (1.0, 0.96, 0.96)
    head.data.materials.append(mat_body)

    # Ears
    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=0.13 * s, location=(side * 0.32 * s, 0, 0.90 * s))
        ear = bpy.context.active_object
        ear.data.materials.append(mat_body)

    # Eyes (Sclera + Pupil + Sparkle)
    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.085 * s, location=(side * 0.16 * s, -0.37 * s, 0.60 * s))
        ew = bpy.context.active_object
        ew.data.materials.append(mat_white)

        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.07 * s, location=(side * 0.16 * s, -0.40 * s, 0.60 * s))
        eb = bpy.context.active_object
        eb.data.materials.append(mat_black)

        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.024 * s, location=(side * 0.14 * s, -0.44 * s, 0.62 * s))
        eg = bpy.context.active_object
        eg.data.materials.append(mat_white)

    # Cheeks
    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.08 * s, location=(side * 0.26 * s, -0.35 * s, 0.52 * s))
        chk = bpy.context.active_object
        chk.scale = (1.3, 0.5, 0.7)
        chk.data.materials.append(mat_pink)

    # Nose
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=8, radius=0.026 * s, location=(0, -0.41 * s, 0.54 * s))
    nose = bpy.context.active_object
    nose.data.materials.append(mat_nose)

    # Arms
    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.13 * s, location=(side * 0.48 * s, -0.08 * s, 0.10 * s))
        arm = bpy.context.active_object
        arm.scale = (0.75, 1.1, 0.8)
        arm.data.materials.append(mat_body)

    # Feet
    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.13 * s, location=(side * 0.22 * s, -0.16 * s, -0.42 * s))
        ft = bpy.context.active_object
        ft.scale = (1.0, 1.25, 0.6)
        ft.data.materials.append(mat_body)

    # Tail
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=10, radius=0.10 * s, location=(0, 0.44 * s, -0.18 * s))
    tail = bpy.context.active_object
    tail.data.materials.append(mat_body)

    # Hang tag (夾娃娃機吊牌)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.35 * s, 0.05 * s, 0.82 * s))
    tag = bpy.context.active_object
    tag.scale = (0.01 * s, 0.14 * s, 0.20 * s)
    tag.rotation_euler = (0.15, -0.2, 0.3)
    tag.data.materials.append(mat_tag)

    join_all_in_scene("Chiikawa")
    export_model("chiikawa")

# ==============================================================================
# 2. CAPYBARA (水豚君 + 頭頂黃色水豚橘子 1.25x Scale)
# ==============================================================================
def build_capybara():
    reset_scene()
    mat_fur = create_material("CapyFur", (0.58, 0.42, 0.28, 1), roughness=0.88)
    mat_snout = create_material("CapySnout", (0.44, 0.30, 0.18, 1), roughness=0.85)
    mat_dark = create_material("CapyDark", (0.12, 0.09, 0.06, 1), roughness=0.5)
    mat_orange = create_material("YuzuOrange", (1.0, 0.65, 0.05, 1), roughness=0.45)
    mat_leaf = create_material("YuzuLeaf", (0.15, 0.70, 0.20, 1), roughness=0.5)

    s = 1.25
    bpy.ops.mesh.primitive_cylinder_add(radius=0.44 * s, depth=0.88 * s, location=(0, 0.05 * s, 0))
    body = bpy.context.active_object
    body.rotation_euler = (math.pi / 2, 0, 0)
    body.scale = (1.0, 0.9, 1.0)
    body.data.materials.append(mat_fur)

    bpy.ops.mesh.primitive_cube_add(size=0.6 * s, location=(0, -0.52 * s, 0.12 * s))
    snout = bpy.context.active_object
    snout.scale = (0.75, 0.82, 0.70)
    snout.data.materials.append(mat_snout)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.06 * s, location=(0, -0.78 * s, 0.12 * s))
    nose = bpy.context.active_object
    nose.scale = (1.5, 0.6, 0.8)
    nose.data.materials.append(mat_dark)

    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.08 * s, location=(side * 0.28 * s, -0.22 * s, 0.36 * s))
        ear = bpy.context.active_object
        ear.scale = (0.4, 0.8, 1.2)
        ear.rotation_euler = (0.2, side * 0.4, 0)
        ear.data.materials.append(mat_snout)

    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=8, radius=0.035 * s, location=(side * 0.24 * s, -0.52 * s, 0.22 * s))
        eye = bpy.context.active_object
        eye.scale = (0.6, 1.2, 0.4)
        eye.data.materials.append(mat_dark)

    for sx in (-1, 1):
        for sy in (-1, 1):
            bpy.ops.mesh.primitive_cylinder_add(radius=0.11 * s, depth=0.28 * s, location=(sx * 0.28 * s, sy * 0.32 * s, -0.38 * s))
            paw = bpy.context.active_object
            paw.data.materials.append(mat_snout)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=0.16 * s, location=(0, -0.32 * s, 0.52 * s))
    yuzu = bpy.context.active_object
    yuzu.data.materials.append(mat_orange)

    bpy.ops.mesh.primitive_cube_add(size=0.1 * s, location=(0.06 * s, -0.30 * s, 0.68 * s))
    leaf = bpy.context.active_object
    leaf.scale = (1.2, 0.4, 0.1)
    leaf.rotation_euler = (0.2, -0.4, 0.3)
    leaf.data.materials.append(mat_leaf)

    join_all_in_scene("Capybara")
    export_model("capybara")

# ==============================================================================
# 3. SSR GOLDEN CAPYBARA (SSR 閃耀純金水豚君 + 皇冠 1.30x Scale)
# ==============================================================================
def build_golden_capybara():
    reset_scene()
    mat_gold = create_material("CapyGold24K", (1.0, 0.82, 0.22, 1), roughness=0.12, metallic=0.96)
    mat_ruby = create_material("CrownRuby", (0.9, 0.05, 0.12, 1), roughness=0.15, metallic=0.2, emission=(1.0, 0.1, 0.2, 1), emission_strength=2.0)

    s = 1.30
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
# 4. KIRBY (星之卡比 圓形粉紅玩偶 1.30x Scale)
# ==============================================================================
def build_kirby():
    reset_scene()
    mat_pink = create_material("KirbyPink", (1.0, 0.52, 0.70, 1), roughness=0.75)
    mat_red = create_material("KirbyShoeRed", (0.92, 0.12, 0.22, 1), roughness=0.6)
    mat_eye_blue = create_material("KirbyEyeBlue", (0.05, 0.25, 0.65, 1), roughness=0.3)
    mat_eye_black = create_material("KirbyEyeBlack", (0.08, 0.08, 0.10, 1), roughness=0.3)
    mat_white = create_material("KirbyWhite", (1, 1, 1, 1), roughness=0.2)
    mat_blush = create_material("KirbyBlush", (1.0, 0.35, 0.55, 1), roughness=0.9)
    mat_mouth = create_material("KirbyMouth", (0.6, 0.05, 0.15, 1), roughness=0.5)

    s = 1.30
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=24, radius=0.50 * s, location=(0, 0, 0.15 * s))
    body = bpy.context.active_object
    body.data.materials.append(mat_pink)

    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=0.25 * s, location=(side * 0.34 * s, -0.15 * s, -0.25 * s))
        shoe = bpy.context.active_object
        shoe.scale = (0.9, 1.4, 0.65)
        shoe.rotation_euler = (0.2, side * 0.2, 0)
        shoe.data.materials.append(mat_red)

    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.18 * s, location=(side * 0.52 * s, 0, 0.28 * s))
        arm = bpy.context.active_object
        arm.scale = (1.2, 0.85, 0.85)
        arm.rotation_euler = (0, side * -0.4, 0)
        arm.data.materials.append(mat_pink)

    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.08 * s, location=(side * 0.12 * s, -0.46 * s, 0.25 * s))
        eye = bpy.context.active_object
        eye.scale = (0.65, 0.2, 1.3)
        eye.data.materials.append(mat_eye_black)

        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.065 * s, location=(side * 0.12 * s, -0.47 * s, 0.20 * s))
        eyeb = bpy.context.active_object
        eyeb.scale = (0.6, 0.2, 0.8)
        eyeb.data.materials.append(mat_eye_blue)

        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.03 * s, location=(side * 0.12 * s, -0.48 * s, 0.30 * s))
        ew = bpy.context.active_object
        ew.data.materials.append(mat_white)

    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=8, radius=0.075 * s, location=(side * 0.28 * s, -0.40 * s, 0.14 * s))
        chk = bpy.context.active_object
        chk.scale = (1.2, 0.3, 0.6)
        chk.data.materials.append(mat_blush)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.07 * s, location=(0, -0.47 * s, 0.10 * s))
    mouth = bpy.context.active_object
    mouth.scale = (0.8, 0.4, 1.0)
    mouth.data.materials.append(mat_mouth)

    join_all_in_scene("Kirby")
    export_model("kirby")

# ==============================================================================
# 5. CALICO CAT (三花貓 圓潤坐姿貓咪玩偶 1.1x Scale)
# ==============================================================================
def build_calico_cat():
    reset_scene()
    mat_white = create_material("CatWhite", (0.95, 0.95, 0.95, 1), roughness=0.85)
    mat_orange = create_material("CatOrange", (0.88, 0.48, 0.15, 1), roughness=0.85)
    mat_black = create_material("CatBlack", (0.12, 0.12, 0.14, 1), roughness=0.8)
    mat_pink = create_material("CatPink", (1.0, 0.65, 0.70, 1), roughness=0.8)
    mat_eyes = create_material("CatEyes", (0.2, 0.75, 0.3, 1), roughness=0.2)

    s = 1.15
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.46 * s, location=(0, 0.05 * s, 0))
    body = bpy.context.active_object
    body.scale = (1.0, 1.1, 0.95)
    body.data.materials.append(mat_white)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.40 * s, location=(0, -0.15 * s, 0.50 * s))
    head = bpy.context.active_object
    head.data.materials.append(mat_white)

    bpy.ops.mesh.primitive_cone_add(radius1=0.14 * s, depth=0.26 * s, location=(-0.24 * s, -0.12 * s, 0.84 * s))
    le = bpy.context.active_object
    le.rotation_euler = (0.1, -0.2, 0.1)
    le.data.materials.append(mat_orange)

    bpy.ops.mesh.primitive_cone_add(radius1=0.14 * s, depth=0.26 * s, location=(0.24 * s, -0.12 * s, 0.84 * s))
    re = bpy.context.active_object
    re.rotation_euler = (0.1, 0.2, -0.1)
    re.data.materials.append(mat_black)

    for side in (-1, 1):
        bpy.ops.mesh.primitive_cone_add(radius1=0.07 * s, depth=0.18 * s, location=(side * 0.22 * s, -0.16 * s, 0.82 * s))
        ie = bpy.context.active_object
        ie.rotation_euler = (0.2, side * 0.2, 0)
        ie.data.materials.append(mat_pink)

    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.05 * s, location=(side * 0.15 * s, -0.48 * s, 0.52 * s))
        eye = bpy.context.active_object
        eye.scale = (1.0, 0.3, 1.2)
        eye.data.materials.append(mat_eyes)

    bpy.ops.mesh.primitive_cone_add(radius1=0.03 * s, depth=0.04 * s, location=(0, -0.53 * s, 0.46 * s))
    nose = bpy.context.active_object
    nose.rotation_euler = (math.pi / 2, 0, 0)
    nose.data.materials.append(mat_pink)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.24 * s, location=(-0.20 * s, 0.22 * s, 0.18 * s))
    patch1 = bpy.context.active_object
    patch1.scale = (0.9, 1.1, 0.4)
    patch1.data.materials.append(mat_orange)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.20 * s, location=(0.22 * s, 0.24 * s, 0.10 * s))
    patch2 = bpy.context.active_object
    patch2.scale = (0.8, 1.0, 0.4)
    patch2.data.materials.append(mat_black)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.06 * s, depth=0.55 * s, location=(0, 0.46 * s, 0.22 * s))
    tail = bpy.context.active_object
    tail.rotation_euler = (math.pi * 0.25, 0, 0.2)
    tail.data.materials.append(mat_orange)

    join_all_in_scene("CalicoCat")
    export_model("my_cat")

# ==============================================================================
# 6. BLINDBOX (潮玩盲盒 POP MART 風格 W=0.68, D=0.58, H=0.98)
# ==============================================================================
def build_blindbox():
    reset_scene()
    mat_box = create_material("BlindBoxBase", (0.95, 0.25, 0.60, 1), roughness=0.35, metallic=0.1)
    mat_banner = create_material("BlindBoxBanner", (0.15, 0.85, 0.95, 1), roughness=0.25, metallic=0.2)
    mat_tab = create_material("ClearPlasticHangTab", (0.9, 0.95, 1.0, 0.6), roughness=0.1, metallic=0.1)

    W, D, H = 0.68, 0.58, 0.98
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    box = bpy.context.active_object
    box.scale = (W, D, H)
    box.data.materials.append(mat_box)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -D / 2 - 0.005, 0.05))
    panel = bpy.context.active_object
    panel.scale = (W * 0.85, 0.02, H * 0.70)
    panel.data.materials.append(mat_banner)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, H / 2 + 0.11))
    tab = bpy.context.active_object
    tab.scale = (0.24, 0.015, 0.22)
    tab.data.materials.append(mat_tab)

    join_all_in_scene("BlindBox")
    export_model("blindbox")

# ==============================================================================
# 7. SSR GLOWING LABUBU (SSR 賽博霓虹發光盲盒 W=0.72, D=0.62, H=1.02)
# ==============================================================================
def build_ssr_glowing_labubu():
    reset_scene()
    mat_dark = create_material("NeonCyberBlack", (0.05, 0.05, 0.08, 1), roughness=0.15, metallic=0.85)
    mat_neon_cyan = create_material("NeonCyanGlow", (0.0, 1.0, 0.95, 1), roughness=0.1, emission=(0.0, 1.0, 0.95, 1), emission_strength=4.0)
    mat_neon_pink = create_material("NeonPinkGlow", (1.0, 0.0, 0.75, 1), roughness=0.1, emission=(1.0, 0.0, 0.75, 1), emission_strength=4.0)

    W, D, H = 0.72, 0.62, 1.02
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    box = bpy.context.active_object
    box.scale = (W, D, H)
    box.data.materials.append(mat_dark)

    for sx in (-W / 2, W / 2):
        for sy in (-D / 2, D / 2):
            bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=H, location=(sx, sy, 0))
            strip = bpy.context.active_object
            strip.data.materials.append(mat_neon_cyan)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -D / 2 - 0.005, 0.08))
    emblem = bpy.context.active_object
    emblem.scale = (0.24, 0.02, 0.24)
    emblem.rotation_euler = (0, 0, math.pi * 0.25)
    emblem.data.materials.append(mat_neon_pink)

    join_all_in_scene("SSRGlowingLabubu")
    export_model("ssr_glowing_labubu")

# ==============================================================================
# 8. SNACK PACK (零食包 洋芋片充氣澎澎包 W=0.82, D=0.42, H=1.05)
# ==============================================================================
def build_snack_pack():
    reset_scene()
    mat_foil = create_material("SnackFoilRed", (0.88, 0.12, 0.12, 1), roughness=0.25, metallic=0.6)
    mat_gold = create_material("SnackGoldSeal", (1.0, 0.78, 0.15, 1), roughness=0.2, metallic=0.7)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.48, location=(0, 0, 0))
    body = bpy.context.active_object
    body.scale = (0.85, 0.44, 1.05)
    body.data.materials.append(mat_foil)

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
# 9. DRAGON BALL BOX (七龍珠 公仔盒裝 W=0.82, D=0.68, H=1.08)
# ==============================================================================
def build_dragonball():
    reset_scene()
    mat_box = create_material("DBZOrangeBox", (1.0, 0.45, 0.0, 1), roughness=0.35, metallic=0.05)
    mat_black = create_material("DBZBlackBanner", (0.1, 0.1, 0.1, 1), roughness=0.4)
    mat_star = create_material("DBZGoldBall", (1.0, 0.85, 0.1, 1), roughness=0.2, metallic=0.3)
    mat_tab = create_material("ClearHangTab", (0.9, 0.95, 1.0, 0.5), roughness=0.1)

    W, D, H = 0.82, 0.68, 1.08
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    box = bpy.context.active_object
    box.scale = (W, D, H)
    box.data.materials.append(mat_box)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -D / 2 - 0.005, 0.38))
    banner = bpy.context.active_object
    banner.scale = (W * 0.95, 0.015, 0.22)
    banner.data.materials.append(mat_black)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=0.03, location=(0, -D / 2 - 0.005, 0.02))
    ball = bpy.context.active_object
    ball.rotation_euler = (math.pi / 2, 0, 0)
    ball.data.materials.append(mat_star)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, H / 2 + 0.11))
    tab = bpy.context.active_object
    tab.scale = (0.26, 0.015, 0.22)
    tab.data.materials.append(mat_tab)

    join_all_in_scene("DragonBallBox")
    export_model("dragonball")

# ==============================================================================
# 10. ONE PIECE BOX (海賊王 航海王公仔盒 W=0.80, D=0.66, H=1.06)
# ==============================================================================
def build_onepiece():
    reset_scene()
    mat_dark = create_material("OPDarkNavy", (0.04, 0.05, 0.09, 1), roughness=0.35)
    mat_red = create_material("OPCrimson", (0.82, 0.08, 0.10, 1), roughness=0.3)
    mat_hat = create_material("OPStrawHatYellow", (0.95, 0.75, 0.12, 1), roughness=0.5)
    mat_tab = create_material("ClearHangTab", (0.9, 0.95, 1.0, 0.5), roughness=0.1)

    W, D, H = 0.80, 0.66, 1.06
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    box = bpy.context.active_object
    box.scale = (W, D, H)
    box.data.materials.append(mat_dark)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -D / 2 - 0.005, 0.12))
    swoosh = bpy.context.active_object
    swoosh.scale = (W * 0.95, 0.015, 0.40)
    swoosh.data.materials.append(mat_red)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.16, depth=0.03, location=(0, -D / 2 - 0.01, 0.12))
    brim = bpy.context.active_object
    brim.rotation_euler = (math.pi / 2, 0, 0)
    brim.data.materials.append(mat_hat)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=0.10, location=(0, -D / 2 - 0.015, 0.14))
    dome = bpy.context.active_object
    dome.scale = (1.0, 0.6, 0.8)
    dome.data.materials.append(mat_hat)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, H / 2 + 0.11))
    tab = bpy.context.active_object
    tab.scale = (0.26, 0.015, 0.22)
    tab.data.materials.append(mat_tab)

    join_all_in_scene("OnePieceBox")
    export_model("onepiece")

# ==============================================================================
# 11. MUG BOX (三麗鷗馬克杯禮盒 W=1.0, D=0.78, H=0.78)
# ==============================================================================
def build_mug_box():
    reset_scene()
    mat_box = create_material("MugBoxPink", (1.0, 0.88, 0.94, 1), roughness=0.45)
    mat_ribbon = create_material("MugRibbon", (0.95, 0.35, 0.65, 1), roughness=0.3)
    mat_ceramic = create_material("CeramicMug", (0.35, 0.80, 0.95, 1), roughness=0.15)

    W, D, H = 1.0, 0.78, 0.78
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    box = bpy.context.active_object
    box.scale = (W, D, H)
    box.data.materials.append(mat_box)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -D / 2 - 0.005, 0))
    frame = bpy.context.active_object
    frame.scale = (W * 0.70, 0.02, H * 0.68)
    frame.data.materials.append(mat_ribbon)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.18, depth=0.34, location=(0, -D / 2 + 0.05, 0))
    mug = bpy.context.active_object
    mug.data.materials.append(mat_ceramic)

    bpy.ops.mesh.primitive_torus_add(major_radius=0.12, minor_radius=0.035, location=(0.18, -D / 2 + 0.05, 0))
    handle = bpy.context.active_object
    handle.rotation_euler = (0, math.pi / 2, 0)
    handle.data.materials.append(mat_ceramic)

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
    mat_body = create_material("FlaskPastelPink", (1.0, 0.72, 0.82, 1), roughness=0.3, metallic=0.1)
    mat_metal = create_material("FlaskSteelTrim", (0.85, 0.85, 0.88, 1), roughness=0.15, metallic=0.92)
    mat_lid = create_material("FlaskHotPinkLid", (0.95, 0.20, 0.52, 1), roughness=0.4)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.26, depth=0.90, location=(0, 0, -0.06))
    flask = bpy.context.active_object
    flask.data.materials.append(mat_body)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.265, depth=0.06, location=(0, 0, 0.41))
    ring = bpy.context.active_object
    ring.data.materials.append(mat_metal)

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
# 13. COOKIE BOX (丹麥手工曲奇圓鐵盒 R=0.40, H=0.30)
# ==============================================================================
def build_cookie_box():
    reset_scene()
    mat_tin_blue = create_material("CookieTinBlue", (0.12, 0.25, 0.55, 1), roughness=0.25, metallic=0.7)
    mat_tin_gold = create_material("CookieTinGoldTrim", (0.95, 0.78, 0.25, 1), roughness=0.2, metallic=0.85)

    R, H = 0.40, 0.30
    bpy.ops.mesh.primitive_cylinder_add(radius=R, depth=H, location=(0, 0, 0))
    tin = bpy.context.active_object
    tin.data.materials.append(mat_tin_blue)

    bpy.ops.mesh.primitive_torus_add(major_radius=R + 0.005, minor_radius=0.025, location=(0, 0, H / 2))
    rim = bpy.context.active_object
    rim.data.materials.append(mat_tin_gold)

    bpy.ops.mesh.primitive_cylinder_add(radius=R * 0.55, depth=0.02, location=(0, 0, H / 2 + 0.01))
    seal = bpy.context.active_object
    seal.data.materials.append(mat_tin_gold)

    join_all_in_scene("CookieBox")
    export_model("cookie_box")

# ==============================================================================
# 14. PS5 BOX (PlayStation 5 主機巨型盒裝 W=1.7, D=0.85, H=1.9)
# ==============================================================================
def build_ps5():
    reset_scene()
    mat_white = create_material("PS5White", (0.96, 0.96, 0.98, 1), roughness=0.35)
    mat_blue = create_material("PS5Blue", (0.0, 0.35, 0.85, 1), roughness=0.25, emission=(0, 0.2, 0.7, 1), emission_strength=0.8)
    mat_black = create_material("PS5Black", (0.05, 0.05, 0.07, 1), roughness=0.5)

    W, D, H = 1.7, 0.85, 1.9
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    box = bpy.context.active_object
    box.scale = (W, D, H)
    box.data.materials.append(mat_white)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -D / 2 - 0.005, H * 0.40))
    stripe = bpy.context.active_object
    stripe.scale = (W * 0.98, 0.015, H * 0.16)
    stripe.data.materials.append(mat_blue)

    bpy.ops.mesh.primitive_torus_add(major_radius=0.25, minor_radius=0.045, location=(0, 0, H / 2 + 0.08))
    handle = bpy.context.active_object
    handle.scale = (1.0, 0.5, 1.0)
    handle.data.materials.append(mat_black)

    join_all_in_scene("PS5Box")
    export_model("ps5")

# ==============================================================================
# 15. SWITCH BOX (Nintendo Switch 盒裝 W=1.5, D=0.7, H=1.2)
# ==============================================================================
def build_switch():
    reset_scene()
    mat_red = create_material("SwitchRed", (0.92, 0.10, 0.14, 1), roughness=0.35)
    mat_white = create_material("SwitchWhite", (0.98, 0.98, 0.98, 1), roughness=0.35)
    mat_blue = create_material("JoyConBlue", (0.0, 0.65, 0.95, 1), roughness=0.3)

    W, D, H = 1.5, 0.7, 1.2
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    box = bpy.context.active_object
    box.scale = (W, D, H)
    box.data.materials.append(mat_red)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -D / 2 - 0.005, 0))
    frame = bpy.context.active_object
    frame.scale = (W * 0.86, 0.015, H * 0.75)
    frame.data.materials.append(mat_white)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-0.35, -D / 2 - 0.01, 0))
    jcl = bpy.context.active_object
    jcl.scale = (0.18, 0.02, 0.55)
    jcl.data.materials.append(mat_blue)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.35, -D / 2 - 0.01, 0))
    jcr = bpy.context.active_object
    jcr.scale = (0.18, 0.02, 0.55)
    jcr.data.materials.append(mat_red)

    join_all_in_scene("SwitchBox")
    export_model("switch")

# ==============================================================================
# 16. DYSON BOX (Dyson 吸塵器 / 吹風機旗艦盒 W=0.9, D=0.8, H=2.4)
# ==============================================================================
def build_dyson():
    reset_scene()
    mat_graphite = create_material("DysonGraphite", (0.14, 0.14, 0.16, 1), roughness=0.4, metallic=0.3)
    mat_copper = create_material("DysonCopper", (0.85, 0.45, 0.22, 1), roughness=0.25, metallic=0.88)

    W, D, H = 0.9, 0.8, 2.4
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    box = bpy.context.active_object
    box.scale = (W, D, H)
    box.data.materials.append(mat_graphite)

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
    mat_leather = create_material("MarshallVinyl", (0.08, 0.08, 0.08, 1), roughness=0.75)
    mat_grille = create_material("MarshallGrille", (0.75, 0.68, 0.52, 1), roughness=0.8)
    mat_brass = create_material("MarshallBrass", (0.88, 0.72, 0.28, 1), roughness=0.2, metallic=0.92)

    W, D, H = 1.5, 0.95, 1.1
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    cabinet = bpy.context.active_object
    cabinet.scale = (W, D, H)
    cabinet.data.materials.append(mat_leather)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -D / 2 - 0.005, 0))
    grille = bpy.context.active_object
    grille.scale = (W * 0.88, 0.015, H * 0.82)
    grille.data.materials.append(mat_grille)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -D / 2 - 0.015, 0))
    logo = bpy.context.active_object
    logo.scale = (0.50, 0.015, 0.15)
    logo.data.materials.append(mat_brass)

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
# 18. LEGO (樂高積木 經典黃色大型盒裝 W=1.8, D=0.8, H=1.2)
# ==============================================================================
def build_lego():
    reset_scene()
    mat_yellow = create_material("LegoYellow", (1.0, 0.82, 0.05, 1), roughness=0.35)
    mat_red = create_material("LegoRed", (0.90, 0.10, 0.10, 1), roughness=0.3)

    W, D, H = 1.8, 0.8, 1.2
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    box = bpy.context.active_object
    box.scale = (W, D, H)
    box.data.materials.append(mat_yellow)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-W * 0.32, -D / 2 - 0.005, H * 0.28))
    logo = bpy.context.active_object
    logo.scale = (0.35, 0.015, 0.35)
    logo.data.materials.append(mat_red)

    for sx in (-0.12, 0.12):
        for sy in (-0.12, 0.12):
            bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=0.04, location=(0.35 + sx, -D / 2 - 0.005, 0.15 + sy))
            stud = bpy.context.active_object
            stud.rotation_euler = (math.pi / 2, 0, 0)
            stud.data.materials.append(mat_red)

    join_all_in_scene("GiantLegoBox")
    export_model("lego")

# ==============================================================================
# 19. GIANT TEDDY BEAR (巨型泰迪熊玩偶 1.20x Scale)
# ==============================================================================
def build_giant_bear():
    reset_scene()
    mat_fur = create_material("BearFurBrown", (0.55, 0.38, 0.24, 1), roughness=0.88)
    mat_muzzle = create_material("BearMuzzleCream", (0.88, 0.78, 0.65, 1), roughness=0.85)
    mat_black = create_material("BearNoseEyes", (0.1, 0.1, 0.1, 1), roughness=0.3)
    mat_ribbon = create_material("BearRibbonRed", (0.88, 0.12, 0.22, 1), roughness=0.3)

    s = 1.20
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.60 * s, location=(0, 0, 0.15 * s))
    torso = bpy.context.active_object
    torso.scale = (1.05, 1.15, 0.95)
    torso.data.materials.append(mat_fur)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.52 * s, location=(0, 0, 0.82 * s))
    head = bpy.context.active_object
    head.data.materials.append(mat_fur)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.22 * s, location=(0, -0.42 * s, 0.72 * s))
    muzzle = bpy.context.active_object
    muzzle.scale = (1.1, 0.8, 0.8)
    muzzle.data.materials.append(mat_muzzle)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=8, radius=0.08 * s, location=(0, -0.58 * s, 0.82 * s))
    nose = bpy.context.active_object
    nose.data.materials.append(mat_black)

    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=8, radius=0.07 * s, location=(side * 0.20 * s, -0.45 * s, 0.92 * s))
        eye = bpy.context.active_object
        eye.data.materials.append(mat_black)

    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.20 * s, location=(side * 0.45 * s, 0.05 * s, 1.22 * s))
        ear = bpy.context.active_object
        ear.scale = (0.5, 0.9, 0.9)
        ear.data.materials.append(mat_fur)

    for side in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.18 * s, depth=0.65 * s, location=(side * 0.65 * s, -0.05 * s, 0.22 * s))
        arm = bpy.context.active_object
        arm.rotation_euler = (0.3, side * -0.4, 0)
        arm.data.materials.append(mat_fur)

    for side in (-1, 1):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.20 * s, depth=0.68 * s, location=(side * 0.35 * s, -0.38 * s, -0.28 * s))
        leg = bpy.context.active_object
        leg.rotation_euler = (math.pi / 2 - 0.2, side * 0.2, 0)
        leg.data.materials.append(mat_fur)

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.52 * s, 0.35 * s))
    bow = bpy.context.active_object
    bow.scale = (0.40 * s, 0.18 * s, 0.12 * s)
    bow.data.materials.append(mat_ribbon)

    join_all_in_scene("GiantTeddyBear")
    export_model("giant_bear")

# ==============================================================================
# UNIFIED 3D STUDIO BLENDER SCENE (包含所有 19 種物品的總結專案)
# ==============================================================================
def build_all_studio_scene():
    reset_scene()
    print("Building all_prizes_studio.blend showcase...")
    
    # Import all glb files and place them in a beautiful showroom lineup
    prize_keys = [
        "chiikawa", "capybara", "ssr_golden_capybara", "kirby", "my_cat",
        "blindbox", "ssr_glowing_labubu", "snack_pack", "dragonball", "onepiece",
        "mug_box", "sanrio_bottle", "cookie_box", "ps5", "switch",
        "dyson", "marshall", "lego", "giant_bear"
    ]
    
    # Create Studio Floor
    mat_floor = create_material("StudioFloor", (0.05, 0.06, 0.08, 1), roughness=0.2, metallic=0.5)
    bpy.ops.mesh.primitive_plane_add(size=50, location=(0, 0, -1.0))
    floor = bpy.context.active_object
    floor.data.materials.append(mat_floor)
    
    # Create Studio Lighting
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

    print(f"=== Starting Blender generation of {len(generators)} prizes ===")
    for idx, (name, gen_func) in enumerate(generators, 1):
        print(f"[{idx}/{len(generators)}] Modeling and exporting '{name}'...")
        gen_func()

    build_all_studio_scene()
    print("=== All 19 prizes & studio scene successfully generated! ===")

if __name__ == "__main__":
    main()
