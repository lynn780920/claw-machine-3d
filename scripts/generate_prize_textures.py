"""
Generate High-Resolution, Authentic 2D Packaging Art & Face Textures for Claw Machine 3D Prizes.
Outputs to: public/models/textures/
"""

import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX_DIR = os.path.join(BASE_DIR, "public", "models", "textures")
os.makedirs(TEX_DIR, exist_ok=True)

def get_font(name="arial.ttf", size=24, bold=False):
    font_paths = [
        f"C:/Windows/Fonts/{name}",
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/msjh.ttc",
    ]
    for p in font_paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()

# 1. CHIIKAWA FACE (吉依卡哇 萌萌大眼與腮紅微笑)
def gen_chiikawa_face():
    w, h = 512, 512
    img = Image.new("RGBA", (w, h), (248, 248, 244, 255))
    draw = ImageDraw.Draw(img)

    for r in range(250, 200, -10):
        alpha = int((250 - r) * 0.4)
        draw.ellipse([w//2 - r, h//2 - r, w//2 + r, h//2 + r], outline=(235, 235, 225, alpha), width=3)

    # Eyebrows
    draw.arc([140, 160, 200, 200], start=190, end=350, fill=(40, 40, 40, 255), width=4)
    draw.arc([312, 160, 372, 200], start=190, end=350, fill=(40, 40, 40, 255), width=4)

    # Big glossy eyes
    lex, ley, er = 175, 245, 42
    draw.ellipse([lex - er, ley - er, lex + er, ley + er], fill=(22, 22, 26, 255))
    draw.ellipse([lex - 22, ley - 26, lex - 4, ley - 8], fill=(255, 255, 255, 255))
    draw.ellipse([lex + 8, ley + 8, lex + 20, ley + 20], fill=(255, 255, 255, 255))

    rex, rey = 337, 245
    draw.ellipse([rex - er, rey - er, rex + er, rey + er], fill=(22, 22, 26, 255))
    draw.ellipse([rex - 22, rey - 26, rex - 4, rey - 8], fill=(255, 255, 255, 255))
    draw.ellipse([rex + 8, rey + 8, rex + 20, rey + 20], fill=(255, 255, 255, 255))

    # Blushing pink cheeks
    lcx, lcy, cw, ch = 135, 305, 52, 32
    draw.ellipse([lcx - cw, lcy - ch, lcx + cw, lcy + ch], fill=(255, 175, 190, 220))
    for i in (-18, 0, 18):
        draw.line([lcx + i - 6, lcy + 10, lcx + i + 6, lcy - 10], fill=(245, 120, 150, 255), width=3)

    rcx, rcy = 377, 305
    draw.ellipse([rcx - cw, rcy - ch, rcx + cw, rcy + ch], fill=(255, 175, 190, 220))
    for i in (-18, 0, 18):
        draw.line([rcx + i - 6, rcy + 10, rcx + i + 6, rcy - 10], fill=(245, 120, 150, 255), width=3)

    # Nose & cat mouth
    nx, ny = 256, 280
    draw.polygon([(nx, ny - 6), (nx - 8, ny + 6), (nx + 8, ny + 6)], fill=(180, 100, 115, 255))

    my = 310
    draw.arc([220, my - 15, 256, my + 15], start=0, end=180, fill=(50, 50, 50, 255), width=4)
    draw.arc([256, my - 15, 292, my + 15], start=0, end=180, fill=(50, 50, 50, 255), width=4)

    img.save(os.path.join(TEX_DIR, "chiikawa_face.png"))

# 2. CAPYBARA FACE (水豚君 呆萌瞇瞇眼與鼻孔)
def gen_capybara_face():
    w, h = 512, 512
    img = Image.new("RGBA", (w, h), (145, 98, 62, 255))
    draw = ImageDraw.Draw(img)

    draw.ellipse([100, 180, 412, 450], fill=(120, 78, 48, 255))
    draw.arc([130, 210, 210, 250], start=180, end=360, fill=(35, 25, 20, 255), width=6)
    draw.arc([302, 210, 382, 250], start=180, end=360, fill=(35, 25, 20, 255), width=6)

    draw.ellipse([215, 320, 245, 355], fill=(30, 20, 15, 255))
    draw.ellipse([267, 320, 297, 355], fill=(30, 20, 15, 255))

    draw.line([256, 355, 256, 385], fill=(35, 25, 20, 255), width=4)
    draw.arc([226, 365, 286, 405], start=0, end=180, fill=(35, 25, 20, 255), width=4)

    img.save(os.path.join(TEX_DIR, "capybara_face.png"))

# 3. KIRBY FACE (星之卡比 水汪汪大眼與腮紅微笑)
def gen_kirby_face():
    w, h = 512, 512
    img = Image.new("RGBA", (w, h), (255, 140, 180, 255))
    draw = ImageDraw.Draw(img)

    for ex in (185, 327):
        draw.ellipse([ex - 36, 150, ex + 36, 290], fill=(10, 45, 120, 255))
        draw.chord([ex - 36, 150, ex + 36, 260], start=180, end=360, fill=(15, 15, 20, 255))
        draw.ellipse([ex - 22, 160, ex + 22, 225], fill=(255, 255, 255, 255))
        draw.arc([ex - 26, 240, ex + 26, 285], start=0, end=180, fill=(0, 210, 255, 255), width=6)

    draw.ellipse([90, 280, 175, 330], fill=(245, 65, 110, 230))
    draw.ellipse([337, 280, 422, 330], fill=(245, 65, 110, 230))

    draw.chord([210, 285, 302, 385], start=0, end=180, fill=(135, 15, 35, 255))
    draw.chord([225, 330, 287, 385], start=0, end=180, fill=(255, 115, 145, 255))
    draw.arc([210, 285, 302, 385], start=0, end=180, fill=(80, 10, 25, 255), width=4)

    img.save(os.path.join(TEX_DIR, "kirby_face.png"))

# 4. CALICO CAT FACE (三花貓 羊毛氈萌貓臉)
def gen_cat_face():
    w, h = 512, 512
    img = Image.new("RGBA", (w, h), (250, 248, 245, 255))
    draw = ImageDraw.Draw(img)

    draw.pieslice([220, 30, 500, 350], start=260, end=360, fill=(225, 120, 35, 255))
    draw.pieslice([10, 40, 260, 320], start=180, end=270, fill=(45, 45, 50, 255))

    for ex in (170, 342):
        draw.ellipse([ex - 32, 190, ex + 32, 265], fill=(30, 185, 75, 255))
        draw.ellipse([ex - 8, 195, ex + 8, 260], fill=(15, 15, 15, 255))
        draw.ellipse([ex - 18, 202, ex - 4, 218], fill=(255, 255, 255, 255))

    draw.polygon([(256, 275), (242, 258), (270, 258)], fill=(255, 135, 155, 255))
    draw.arc([226, 272, 256, 298], start=0, end=180, fill=(50, 50, 50, 255), width=4)
    draw.arc([256, 272, 286, 298], start=0, end=180, fill=(50, 50, 50, 255), width=4)

    for dy in (-12, 0, 12):
        draw.line([130, 285 + dy * 1.5, 215, 280 + dy], fill=(255, 255, 255, 220), width=3)
        draw.line([297, 280 + dy, 382, 285 + dy * 1.5], fill=(255, 255, 255, 220), width=3)

    img.save(os.path.join(TEX_DIR, "cat_face.png"))

# 5. DRAGON BALL BOX FRONT (七龍珠 萬代DXF景品彩盒正面)
def gen_dragonball_front():
    w, h = 512, 672
    img = Image.new("RGBA", (w, h), (245, 95, 0, 255))
    draw = ImageDraw.Draw(img)

    for a in range(0, 360, 12):
        rad = math.radians(a)
        cx, cy = w // 2, 330
        x2 = cx + int(math.cos(rad) * 450)
        y2 = cy + int(math.sin(rad) * 450)
        draw.polygon([(cx, cy), (x2, y2), (cx + int(math.cos(rad + 0.1) * 450), cy + int(math.sin(rad + 0.1) * 450))],
                     fill=(255, 145, 10, 140))

    draw.rectangle([0, 0, w, 95], fill=(15, 15, 18, 255))
    draw.text((25, 18), "BANPRESTO", fill=(255, 215, 0, 255), font=get_font("impact.ttf", 26))
    draw.text((25, 52), "BANDAI SPIRITS", fill=(230, 230, 230, 255), font=get_font("arial.ttf", 16, bold=True))

    draw.ellipse([w - 85, 15, w - 25, 75], fill=(255, 215, 40, 255), outline=(200, 150, 0, 255), width=3)
    draw.text((w - 75, 36), "東映", fill=(120, 20, 0, 255), font=get_font("msjh.ttc", 20, bold=True))

    draw.text((w // 2 - 170, 115), "DRAGON BALL", fill=(255, 255, 255, 255), font=get_font("impact.ttf", 52), stroke_width=4, stroke_fill=(180, 30, 0, 255))
    draw.text((w // 2 - 120, 175), "DXF FIGURE", fill=(255, 225, 20, 255), font=get_font("impact.ttf", 36), stroke_width=3, stroke_fill=(0, 0, 0, 255))

    bx, by, br = w // 2, 345, 110
    draw.ellipse([bx - br, by - br, bx + br, by + br], fill=(255, 185, 15, 255), outline=(255, 245, 180, 255), width=5)
    draw.arc([bx - br + 15, by - br + 15, bx + br - 15, by + br - 15], start=200, end=290, fill=(255, 255, 255, 220), width=12)

    star_offsets = [(-35, -35), (35, -35), (-35, 35), (35, 35)]
    for sx, sy in star_offsets:
        draw.ellipse([bx + sx - 16, by + sy - 16, bx + sx + 16, by + sy + 16], fill=(225, 20, 15, 255))
        draw.line([bx + sx - 8, by + sy, bx + sx + 8, by + sy], fill=(255, 255, 255, 255), width=2)
        draw.line([bx + sx, by + sy - 8, bx + sx, by + sy + 8], fill=(255, 255, 255, 255), width=2)

    draw.rectangle([0, h - 145, w, h], fill=(12, 12, 15, 255))
    draw.line([0, h - 145, w, h - 145], fill=(255, 215, 0, 255), width=5)

    draw.text((w // 2 - 160, h - 130), "超サイヤ人 孫悟空", fill=(255, 220, 40, 255), font=get_font("msjh.ttc", 32, bold=True))
    draw.text((w // 2 - 135, h - 85), "SUPER SAIYAN GOKU", fill=(255, 255, 255, 255), font=get_font("arial.ttf", 20, bold=True))
    draw.text((25, h - 45), "©バードスタジオ／集英社・東映アニメーション", fill=(170, 170, 170, 255), font=get_font("msjh.ttc", 13))

    img.save(os.path.join(TEX_DIR, "dragonball_front.png"))

# 6. ONE PIECE BOX FRONT (航海王 景品盒裝正面)
def gen_onepiece_front():
    w, h = 512, 672
    img = Image.new("RGBA", (w, h), (10, 12, 24, 255))
    draw = ImageDraw.Draw(img)

    draw.polygon([(0, 180), (w, 120), (w, 360), (0, 420)], fill=(185, 18, 25, 255))

    draw.rectangle([0, 0, w, 85], fill=(8, 9, 16, 255))
    draw.text((25, 20), "BANPRESTO", fill=(255, 215, 0, 255), font=get_font("impact.ttf", 26))
    draw.text((25, 52), "BANDAI SPIRITS", fill=(220, 220, 220, 255), font=get_font("arial.ttf", 15, bold=True))

    draw.ellipse([w - 85, 12, w - 25, 72], fill=(255, 215, 40, 255), outline=(200, 150, 0, 255), width=3)
    draw.text((w - 75, 32), "東映", fill=(120, 20, 0, 255), font=get_font("msjh.ttc", 20, bold=True))

    draw.text((w // 2 - 170, 140), "ONE PIECE", fill=(255, 225, 20, 255), font=get_font("timesbd.ttf", 56), stroke_width=4, stroke_fill=(180, 0, 0, 255))

    hx, hy = w // 2, 330
    draw.ellipse([hx - 95, hy + 20, hx + 95, hy + 50], fill=(235, 185, 20, 255), outline=(160, 115, 10, 255), width=3)
    draw.chord([hx - 65, hy - 45, hx + 65, hy + 30], start=180, end=360, fill=(245, 195, 25, 255))
    draw.arc([hx - 66, hy + 10, hx + 66, hy + 32], start=180, end=360, fill=(200, 15, 15, 255), width=12)

    draw.rectangle([0, h - 140, w, h], fill=(8, 9, 16, 255))
    draw.line([0, h - 140, w, h - 140], fill=(225, 20, 25, 255), width=5)
    draw.text((w // 2 - 165, h - 125), "モンキー・D・ルフィ", fill=(255, 255, 255, 255), font=get_font("msjh.ttc", 30, bold=True))
    draw.text((w // 2 - 135, h - 80), "Monkey D. Luffy", fill=(255, 215, 20, 255), font=get_font("arial.ttf", 22, bold=True))
    draw.text((25, h - 40), "©尾田栄一郎／集英社・フジテレビ・東映アニメーション", fill=(160, 160, 160, 255), font=get_font("msjh.ttc", 13))

    img.save(os.path.join(TEX_DIR, "onepiece_front.png"))

# 7. POP MART BLIND BOX FRONT (泡泡瑪特 潮玩盲盒正面)
def gen_blindbox_front():
    w, h = 512, 735
    img = Image.new("RGBA", (w, h), (185, 55, 140, 255))
    draw = ImageDraw.Draw(img)

    for y in range(h):
        r = int(185 + 40 * math.sin(y * 0.015))
        g = int(60 + 50 * math.cos(y * 0.018))
        b = int(150 + 60 * math.sin(y * 0.012))
        draw.line([0, y, w, y], fill=(r, g, b, 255))

    draw.rectangle([12, 12, w - 12, h - 12], outline=(255, 255, 255, 230), width=6)
    draw.rectangle([20, 20, w - 20, h - 20], outline=(255, 235, 100, 200), width=2)

    draw.rounded_rectangle([35, 35, 195, 85], radius=10, fill=(225, 20, 60, 255))
    draw.text((50, 42), "POPMART", fill=(255, 255, 255, 255), font=get_font("impact.ttf", 34))

    draw.rounded_rectangle([w - 195, 35, w - 35, 85], radius=10, fill=(255, 220, 0, 255))
    draw.text((w - 180, 46), "BLIND BOX", fill=(30, 30, 30, 255), font=get_font("arial.ttf", 22, bold=True))

    draw.text((w // 2 - 145, 115), "SKULLPANDA", fill=(255, 255, 255, 255), font=get_font("impact.ttf", 46), stroke_width=3, stroke_fill=(80, 10, 60, 255))
    draw.text((w // 2 - 95, 175), "City of Night Series", fill=(255, 235, 140, 255), font=get_font("arial.ttf", 22, bold=True))

    cx, cy, cr = w // 2, 360, 115
    draw.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=(35, 15, 45, 240), outline=(255, 225, 75, 255), width=6)
    draw.text((cx - 45, cy - 85), "?", fill=(255, 220, 40, 255), font=get_font("impact.ttf", 140))

    py = 520
    draw.rectangle([35, py - 18, w - 35, py + 18], fill=(30, 30, 35, 240))
    for x in range(45, w - 45, 20):
        draw.line([x, py, x + 12, py], fill=(255, 255, 255, 255), width=3)
    draw.text((w // 2 - 120, py - 10), "✂ PULL TO OPEN HERE ✂", fill=(255, 230, 100, 255), font=get_font("arial.ttf", 16, bold=True))

    by = 580
    for x in range(50, w - 50, 7):
        bw = 3 if (x % 21 == 0) else 2
        draw.rectangle([x, by, x + bw, by + 45], fill=(255, 255, 255, 255))
    draw.text((w // 2 - 155, by + 58), "1/12 CHANCE FOR SECRET · AGE 15+", fill=(255, 255, 255, 255), font=get_font("arial.ttf", 16, bold=True))
    draw.text((w // 2 - 180, by + 84), "© POP MART ENTERTAINMENT ALL RIGHTS RESERVED", fill=(220, 200, 220, 255), font=get_font("arial.ttf", 12))

    img.save(os.path.join(TEX_DIR, "blindbox_front.png"))

# 8. SSR GLOWING LABUBU FRONT (SSR 賽博霓虹夜光盒)
def gen_ssr_labubu_front():
    w, h = 512, 735
    img = Image.new("RGBA", (w, h), (8, 9, 14, 255))
    draw = ImageDraw.Draw(img)

    draw.rectangle([14, 14, w - 14, h - 14], outline=(0, 245, 255, 255), width=8)
    draw.rectangle([24, 24, w - 24, h - 24], outline=(255, 0, 145, 255), width=3)

    draw.rounded_rectangle([35, 35, 210, 90], radius=12, fill=(255, 0, 125, 255))
    draw.text((50, 44), "★ SSR NIGHT ★", fill=(255, 255, 255, 255), font=get_font("impact.ttf", 26))

    draw.text((w // 2 - 110, 125), "LABUBU", fill=(0, 245, 255, 255), font=get_font("impact.ttf", 60), stroke_width=4, stroke_fill=(255, 0, 140, 255))
    draw.text((w // 2 - 130, 200), "THE MONSTERS CHASE", fill=(255, 255, 255, 255), font=get_font("arial.ttf", 20, bold=True))

    cx, cy = w // 2, 370
    draw.polygon([(cx - 70, cy + 80), (cx, cy - 90), (cx + 70, cy + 80)], fill=(20, 25, 45, 255), outline=(0, 240, 255, 255), width=4)
    draw.ellipse([cx - 45, cy - 10, cx - 15, cy + 20], fill=(255, 240, 0, 255))
    draw.ellipse([cx + 15, cy - 10, cx + 45, cy + 20], fill=(255, 240, 0, 255))
    for fx in (-30, -10, 10, 30):
        draw.polygon([(cx + fx - 6, cy + 45), (cx + fx + 6, cy + 45), (cx + fx, cy + 62)], fill=(255, 255, 255, 255))

    draw.line([35, 540, w - 35, 540], fill=(0, 245, 255, 255), width=4)
    draw.text((w // 2 - 150, 580), "CYBERPUNK LIMITED 1/72", fill=(255, 0, 145, 255), font=get_font("impact.ttf", 26))
    draw.text((w // 2 - 165, 630), "GLOW IN THE DARK · ART TOY", fill=(0, 245, 255, 255), font=get_font("arial.ttf", 18, bold=True))

    img.save(os.path.join(TEX_DIR, "ssr_labubu_front.png"))

# 9. SNACK PACK FRONT (卡樂比 / 樂事洋芋片充氣包)
def gen_snack_pack_front():
    w, h = 512, 656
    img = Image.new("RGBA", (w, h), (220, 25, 25, 255))
    draw = ImageDraw.Draw(img)

    for y in range(h):
        grad = int(35 * math.sin(y * 0.015))
        draw.line([0, y, w, y], fill=(min(255, 220 + grad), max(0, 25 + grad), max(0, 25 + grad), 255))

    for y_crimp in (0, h - 45):
        draw.rectangle([0, y_crimp, w, y_crimp + 45], fill=(245, 195, 25, 255))
        for x in range(0, w, 16):
            draw.polygon([(x, y_crimp), (x + 8, y_crimp + 20), (x + 16, y_crimp)], fill=(180, 130, 10, 255))

    draw.ellipse([w // 2 - 155, 80, w // 2 + 155, 205], fill=(245, 205, 30, 255), outline=(255, 255, 255, 255), width=6)
    draw.text((w // 2 - 110, 105), "Calbee", fill=(225, 15, 20, 255), font=get_font("impact.ttf", 58))
    draw.text((w // 2 - 75, 165), "贅沢ポテト", fill=(30, 30, 30, 255), font=get_font("msjh.ttc", 22, bold=True))

    draw.rounded_rectangle([30, 235, w - 30, 305], radius=14, fill=(255, 145, 0, 255), outline=(255, 255, 255, 255), width=4)
    draw.text((w // 2 - 135, 248), "HOT & SPICY 旨辛", fill=(255, 255, 255, 255), font=get_font("impact.ttf", 38))

    cx, cy = w // 2, 420
    for ox, oy, r in [(-50, 20, 75), (60, 10, 80), (0, -30, 85)]:
        draw.ellipse([cx + ox - r, cy + oy - r // 2, cx + ox + r, cy + oy + r // 2], fill=(245, 195, 55, 255), outline=(210, 140, 20, 255), width=4)
        for ly in range(-r // 3, r // 3, 10):
            draw.arc([cx + ox - r + 15, cy + oy + ly - 10, cx + ox + r - 15, cy + oy + ly + 10], start=0, end=180, fill=(210, 130, 20, 255), width=2)

    draw.text((45, h - 95), "内容量 85g", fill=(255, 255, 255, 255), font=get_font("msjh.ttc", 22, bold=True))
    draw.text((w - 180, h - 95), "国産じゃがいも", fill=(255, 240, 150, 255), font=get_font("msjh.ttc", 18, bold=True))

    img.save(os.path.join(TEX_DIR, "snack_pack_front.png"))

# 10. MARSHALL SPEAKER FRONT (Marshall 復古音箱網面與手寫銘牌)
def gen_marshall_front():
    w, h = 512, 350
    img = Image.new("RGBA", (w, h), (25, 25, 25, 255))
    draw = ImageDraw.Draw(img)

    for y in range(0, h, 6):
        for x in range(0, w, 6):
            if (x + y) % 12 == 0:
                draw.rectangle([x, y, x + 3, y + 3], fill=(185, 170, 140, 255))
            else:
                draw.rectangle([x, y, x + 3, y + 3], fill=(40, 38, 35, 255))

    draw.rectangle([12, 12, w - 12, h - 12], outline=(225, 185, 65, 255), width=10)
    draw.rectangle([20, 20, w - 20, h - 20], outline=(150, 115, 30, 255), width=3)

    font_marshall = get_font("timesbd.ttf", 72)
    draw.text((w // 2 - 138, h // 2 - 42), "Marshall", fill=(10, 10, 10, 220), font=font_marshall)
    draw.text((w // 2 - 142, h // 2 - 46), "Marshall", fill=(245, 215, 95, 255), font=font_marshall, stroke_width=2, stroke_fill=(180, 135, 25, 255))

    img.save(os.path.join(TEX_DIR, "marshall_front.png"))

# 11. COOKIE BOX TOP (丹麥皇家藍罐曲奇餅乾鐵盒蓋)
def gen_cookie_box_top():
    w, h = 512, 512
    img = Image.new("RGBA", (w, h), (20, 45, 115, 255))
    draw = ImageDraw.Draw(img)

    draw.ellipse([15, 15, w - 15, h - 15], outline=(245, 205, 55, 255), width=12)
    draw.ellipse([30, 30, w - 30, h - 30], outline=(255, 235, 140, 255), width=3)

    draw.text((w // 2 - 110, 55), "👑 ROYAL CROWN 👑", fill=(255, 220, 50, 255), font=get_font("arial.ttf", 20, bold=True))
    draw.text((w // 2 - 170, 95), "DANISH BUTTER", fill=(255, 255, 255, 255), font=get_font("timesbd.ttf", 36))
    draw.text((w // 2 - 115, 145), "COOKIES", fill=(255, 215, 40, 255), font=get_font("timesbd.ttf", 44))

    cx, cy = w // 2, 290
    draw.ellipse([cx - 45, cy - 45, cx + 45, cy + 45], fill=(235, 185, 60, 255), outline=(190, 135, 25, 255), width=5)
    draw.arc([cx - 30, cy - 30, cx + 30, cy + 30], start=0, end=300, fill=(185, 125, 20, 255), width=6)

    offsets = [(-100, -35), (100, -35), (-90, 60), (90, 60)]
    for ox, oy in offsets:
        draw.ellipse([cx + ox - 40, cy + oy - 40, cx + ox + 40, cy + oy + 40], fill=(240, 195, 75, 255), outline=(195, 140, 30, 255), width=4)

    draw.text((w // 2 - 150, 420), "ORIGINAL RECIPE COPENHAGEN", fill=(255, 225, 100, 255), font=get_font("arial.ttf", 16, bold=True))
    draw.text((w // 2 - 60, 450), "NET WT 454g", fill=(255, 255, 255, 255), font=get_font("arial.ttf", 18, bold=True))

    img.save(os.path.join(TEX_DIR, "cookie_box_top.png"))

# 12. PS5 BOX FRONT (PlayStation 5 主機彩盒正面)
def gen_ps5_front():
    w, h = 512, 650
    img = Image.new("RGBA", (w, h), (245, 245, 250, 255))
    draw = ImageDraw.Draw(img)

    draw.rectangle([0, 0, w, 110], fill=(0, 60, 165, 255))
    draw.text((35, 25), "PlayStation 5", fill=(255, 255, 255, 255), font=get_font("arial.ttf", 42, bold=True))
    draw.text((w - 150, 35), "△ ◯ ✕ ▢", fill=(100, 175, 255, 255), font=get_font("arial.ttf", 26, bold=True))

    cx, cy = w // 2, 340
    draw.polygon([(cx - 75, cy - 140), (cx + 35, cy - 150), (cx + 35, cy + 120), (cx - 75, cy + 110)], fill=(255, 255, 255, 255), outline=(200, 205, 215, 255), width=4)
    draw.polygon([(cx - 60, cy - 130), (cx + 20, cy - 140), (cx + 20, cy + 115), (cx - 60, cy + 105)], fill=(18, 18, 22, 255))
    draw.line([cx - 55, cy - 125, cx - 55, cy + 100], fill=(0, 140, 255, 255), width=4)

    draw.ellipse([cx - 15, cy + 10, cx + 115, cy + 90], fill=(255, 255, 255, 255), outline=(190, 195, 205, 255), width=3)
    draw.ellipse([cx + 10, cy + 45, cx + 90, cy + 85], fill=(20, 20, 25, 255))

    draw.rectangle([0, h - 90, w, h], fill=(0, 60, 165, 255))
    draw.text((45, h - 65), "8K · 4K 120 · HDR", fill=(255, 255, 255, 255), font=get_font("arial.ttf", 26, bold=True))
    draw.text((w - 140, h - 65), "SONY", fill=(255, 255, 255, 255), font=get_font("impact.ttf", 28))

    img.save(os.path.join(TEX_DIR, "ps5_front.png"))

# 13. SWITCH BOX FRONT (任天堂 Switch OLED 盒裝正面)
def gen_switch_front():
    w, h = 512, 400
    img = Image.new("RGBA", (w, h), (230, 0, 18, 255))
    draw = ImageDraw.Draw(img)

    draw.rounded_rectangle([35, 45, w - 35, h - 35], radius=16, fill=(255, 255, 255, 255))

    draw.rectangle([55, 60, 115, 95], fill=(230, 0, 18, 255))
    draw.text((60, 68), "Nintendo", fill=(255, 255, 255, 255), font=get_font("arial.ttf", 14, bold=True))
    draw.text((130, 65), "NINTENDO SWITCH", fill=(30, 30, 30, 255), font=get_font("impact.ttf", 28))

    cx, cy = w // 2, 215
    draw.rounded_rectangle([cx - 140, cy - 70, cx + 140, cy + 70], radius=8, fill=(15, 15, 20, 255))
    draw.rectangle([cx - 100, cy - 60, cx + 100, cy + 60], fill=(35, 40, 50, 255))

    draw.rounded_rectangle([cx - 175, cy - 70, cx - 145, cy + 70], radius=10, fill=(0, 195, 245, 255))
    draw.rounded_rectangle([cx + 145, cy - 70, cx + 175, cy + 70], radius=10, fill=(255, 45, 85, 255))

    draw.text((w // 2 - 110, h - 75), "OLED MODEL / 有機ELモデル", fill=(80, 80, 80, 255), font=get_font("msjh.ttc", 16, bold=True))

    img.save(os.path.join(TEX_DIR, "switch_front.png"))

# 14. LEGO BOX FRONT (樂高積木大盒裝正面)
def gen_lego_front():
    w, h = 512, 400
    img = Image.new("RGBA", (w, h), (255, 210, 0, 255))
    draw = ImageDraw.Draw(img)

    draw.rectangle([0, 0, w, 20], fill=(225, 0, 0, 255))
    draw.rectangle([0, h - 20, w, h], fill=(225, 0, 0, 255))

    draw.rectangle([35, 40, 145, 150], fill=(225, 0, 0, 255), outline=(0, 0, 0, 255), width=4)
    font_lego = get_font("impact.ttf", 46)
    draw.text((45, 60), "LEGO", fill=(255, 255, 255, 255), font=font_lego, stroke_width=4, stroke_fill=(0, 0, 0, 255))

    draw.text((165, 55), "TECHNIC", fill=(20, 20, 20, 255), font=get_font("impact.ttf", 36))
    draw.text((165, 100), "HYPERCAR RACER 1:8", fill=(225, 0, 0, 255), font=get_font("arial.ttf", 20, bold=True))

    cx, cy = w // 2, 240
    draw.polygon([(cx - 180, cy + 40), (cx - 120, cy - 20), (cx + 60, cy - 25), (cx + 170, cy + 30), (cx + 150, cy + 50), (cx - 170, cy + 50)],
                 fill=(225, 25, 25, 255), outline=(30, 30, 30, 255), width=3)
    draw.ellipse([cx - 130, cy + 25, cx - 70, cy + 75], fill=(30, 30, 35, 255))
    draw.ellipse([cx + 70, cy + 25, cx + 130, cy + 75], fill=(30, 30, 35, 255))

    draw.text((45, h - 60), "18+ · #42143 · 1458 pcs", fill=(40, 40, 40, 255), font=get_font("arial.ttf", 20, bold=True))

    img.save(os.path.join(TEX_DIR, "lego_front.png"))

# 15. SANRIO MUG BOX FRONT (三麗鷗馬克杯禮盒開窗)
def gen_mug_box_front():
    w, h = 512, 400
    img = Image.new("RGBA", (w, h), (255, 235, 245, 255))
    draw = ImageDraw.Draw(img)

    # Scalloped border
    draw.rectangle([15, 15, w - 15, h - 15], outline=(255, 105, 180, 255), width=8)

    draw.text((w // 2 - 130, 30), "Sanrio characters", fill=(235, 80, 150, 255), font=get_font("timesbd.ttf", 32))

    # Mug window
    draw.rounded_rectangle([75, 80, w - 75, h - 70], radius=16, fill=(255, 255, 255, 255), outline=(255, 105, 180, 255), width=4)
    # Mug illustration
    cx, cy = w // 2 - 20, 210
    draw.rounded_rectangle([cx - 65, cy - 65, cx + 65, cy + 65], radius=12, fill=(120, 215, 255, 255))
    draw.arc([cx + 45, cy - 35, cx + 105, cy + 35], start=270, end=90, fill=(120, 215, 255, 255), width=16)

    draw.text((w // 2 - 95, h - 55), "Ceramic Mug 350ml", fill=(120, 120, 120, 255), font=get_font("arial.ttf", 18, bold=True))

    img.save(os.path.join(TEX_DIR, "mug_box_front.png"))

# 16. SANRIO BOTTLE FRONT (三麗鷗不銹鋼保溫瓶圖案)
def gen_sanrio_bottle_front():
    w, h = 512, 600
    img = Image.new("RGBA", (w, h), (255, 185, 205, 255))
    draw = ImageDraw.Draw(img)

    for y in range(h):
        shade = int(25 * math.sin(y * 0.01))
        draw.line([0, y, w, y], fill=(min(255, 255 + shade), max(0, 185 + shade), max(0, 205 + shade), 255))

    # Hello Kitty Kawaii Face in center
    cx, cy = w // 2, 260
    draw.ellipse([cx - 95, cy - 75, cx + 95, cy + 75], fill=(255, 255, 255, 255), outline=(30, 30, 30, 255), width=4)
    draw.polygon([(cx - 85, cy - 50), (cx - 55, cy - 95), (cx - 35, cy - 65)], fill=(255, 255, 255, 255), outline=(30, 30, 30, 255), width=4)
    draw.polygon([(cx + 85, cy - 50), (cx + 55, cy - 95), (cx + 35, cy - 65)], fill=(255, 255, 255, 255), outline=(30, 30, 30, 255), width=4)

    # Eyes & Nose
    draw.ellipse([cx - 45, cy - 12, cx - 25, cy + 18], fill=(30, 30, 30, 255))
    draw.ellipse([cx + 25, cy - 12, cx + 45, cy + 18], fill=(30, 30, 30, 255))
    draw.ellipse([cx - 12, cy + 12, cx + 12, cy + 28], fill=(255, 205, 30, 255))

    # Red Bow
    draw.ellipse([cx + 45, cy - 80, cx + 95, cy - 40], fill=(245, 30, 50, 255))
    draw.ellipse([cx + 65, cy - 70, cx + 85, cy - 50], fill=(200, 10, 30, 255))

    draw.text((w // 2 - 90, 420), "Hello Kitty", fill=(255, 255, 255, 255), font=get_font("timesbd.ttf", 36))
    draw.text((w // 2 - 125, 480), "ステンレス製 保温 500ml", fill=(255, 255, 255, 255), font=get_font("msjh.ttc", 20, bold=True))

    img.save(os.path.join(TEX_DIR, "sanrio_bottle_front.png"))

# 17. DYSON BOX FRONT (Dyson 科技感吸塵器盒)
def gen_dyson_front():
    w, h = 360, 800
    img = Image.new("RGBA", (w, h), (26, 26, 30, 255))
    draw = ImageDraw.Draw(img)

    # Dyson Purple Accent Bar
    draw.rectangle([0, 0, w, 95], fill=(130, 25, 225, 255))
    draw.text((35, 25), "dyson", fill=(255, 255, 255, 255), font=get_font("arial.ttf", 46, bold=True))

    draw.text((35, 125), "v15 detect", fill=(245, 245, 245, 255), font=get_font("arial.ttf", 28, bold=True))
    draw.text((35, 165), "Laser Slim Fluffy™", fill=(175, 175, 185, 255), font=get_font("arial.ttf", 18))

    # Wand line graphic
    draw.rectangle([w // 2 - 12, 230, w // 2 + 12, 620], fill=(130, 25, 225, 255))
    draw.rectangle([w // 2 - 45, 620, w // 2 + 45, 720], fill=(235, 140, 25, 255))

    img.save(os.path.join(TEX_DIR, "dyson_front.png"))

# 18. TEDDY BEAR FACE (泰迪熊 絨毛口鼻與黑曜石眼珠)
def gen_teddy_bear_face():
    w, h = 512, 512
    img = Image.new("RGBA", (w, h), (145, 95, 55, 255))
    draw = ImageDraw.Draw(img)

    # Cream Muzzle Oval
    draw.ellipse([125, 220, 387, 430], fill=(235, 215, 180, 255))

    # Black Button Nose
    draw.polygon([(256, 310), (220, 265), (292, 265)], fill=(30, 30, 30, 255))
    draw.line([256, 310, 256, 350], fill=(30, 30, 30, 255), width=5)
    draw.arc([210, 335, 256, 375], start=0, end=180, fill=(30, 30, 30, 255), width=5)
    draw.arc([256, 335, 302, 375], start=0, end=180, fill=(30, 30, 30, 255), width=5)

    # Glass Bead Eyes with Amber Reflection
    for ex in (165, 347):
        draw.ellipse([ex - 28, 175, ex + 28, 231], fill=(20, 20, 20, 255))
        draw.ellipse([ex - 12, 182, ex + 6, 200], fill=(255, 255, 255, 255))

    img.save(os.path.join(TEX_DIR, "teddy_bear_face.png"))

def main():
    print("Generating all authentic 2D prize textures...")
    gen_chiikawa_face()
    gen_capybara_face()
    gen_kirby_face()
    gen_cat_face()
    gen_dragonball_front()
    gen_onepiece_front()
    gen_blindbox_front()
    gen_ssr_labubu_front()
    gen_snack_pack_front()
    gen_marshall_front()
    gen_cookie_box_top()
    gen_ps5_front()
    gen_switch_front()
    gen_lego_front()
    gen_mug_box_front()
    gen_sanrio_bottle_front()
    gen_dyson_front()
    gen_teddy_bear_face()
    print("All textures created successfully in:", TEX_DIR)

if __name__ == "__main__":
    main()
