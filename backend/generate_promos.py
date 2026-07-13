"""
Generate 3 promotional banner images for Saneh Kesa Salon mockup.
Creates attractive gradient banners with Thai text.
"""
from PIL import Image, ImageDraw, ImageFont
import os

OUTPUT_DIR = "static/promos"
WIDTH, HEIGHT = 1024, 576  # 16:9 ratio, good for LINE Flex hero

def get_font(size):
    """Try to load a Thai-compatible font, fallback to default."""
    thai_font_paths = [
        "C:/Windows/Fonts/tahoma.ttf",
        "C:/Windows/Fonts/THSarabunNew.ttf",
        "C:/Windows/Fonts/cordia.ttf",
        "C:/Windows/Fonts/angsana.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    for fp in thai_font_paths:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size)
            except:
                continue
    return ImageFont.load_default()


def draw_gradient(draw, width, height, color_top, color_bottom):
    """Draw a vertical gradient."""
    for y in range(height):
        ratio = y / height
        r = int(color_top[0] + (color_bottom[0] - color_top[0]) * ratio)
        g = int(color_top[1] + (color_bottom[1] - color_top[1]) * ratio)
        b = int(color_top[2] + (color_bottom[2] - color_top[2]) * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))


def draw_centered_text(draw, text, y, font, fill="white", width=WIDTH):
    """Draw centered text."""
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    x = (width - tw) // 2
    # Shadow
    draw.text((x + 2, y + 2), text, font=font, fill=(0, 0, 0, 128))
    draw.text((x, y), text, font=font, fill=fill)


def draw_badge(draw, text, x, y, font, bg_color, text_color="white"):
    """Draw a rounded badge/pill."""
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    pad_x, pad_y = 20, 8
    rx = x - pad_x
    ry = y - pad_y
    draw.rounded_rectangle(
        [rx, ry, rx + tw + pad_x * 2, ry + th + pad_y * 2],
        radius=20, fill=bg_color
    )
    draw.text((x, y), text, font=font, fill=text_color)


def add_decorations(draw, width, height):
    """Add subtle decorative circles."""
    for cx, cy, r, alpha in [(80, 80, 60, 40), (width-100, height-100, 80, 30), (width-60, 60, 40, 35)]:
        draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(255, 255, 255, alpha))


def create_promo_1():
    """Happy Wednesday - Hair Color + Treatment 2,200 THB"""
    img = Image.new("RGBA", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)
    draw_gradient(draw, WIDTH, HEIGHT, (156, 39, 176), (233, 30, 99))  # Purple to Pink
    add_decorations(draw, WIDTH, HEIGHT)

    # Scissor decorations
    for i in range(5):
        x = 100 + i * 200
        draw.ellipse([x, HEIGHT-80, x+40, HEIGHT-40], outline=(255, 255, 255, 60), width=2)

    font_big = get_font(56)
    font_mid = get_font(40)
    font_small = get_font(30)
    font_price = get_font(72)
    font_badge = get_font(24)

    # Badge
    bbox = draw.textbbox((0, 0), "HAPPY WEDNESDAY", font=font_badge)
    bw = bbox[2] - bbox[0]
    draw_badge(draw, "HAPPY WEDNESDAY", (WIDTH - bw) // 2, 50, font_badge, (255, 193, 7))

    draw_centered_text(draw, "ทำสีผม + ทรีตเมนต์", 120, font_big)
    draw_centered_text(draw, "เหลือเพียง", 200, font_mid)
    draw_centered_text(draw, "2,200.-", 260, font_price, fill=(255, 235, 59))
    draw_centered_text(draw, "ปกติ 2,700 บาท", 360, font_small, fill=(255, 200, 200))
    draw_centered_text(draw, "ทุกวันพุธ | จองล่วงหน้า 1 วัน", 420, font_small)

    # Bottom bar
    draw.rectangle([0, HEIGHT-50, WIDTH, HEIGHT], fill=(0, 0, 0, 100))
    draw_centered_text(draw, "SANEH KESA SALON", HEIGHT-42, font_badge, fill=(255, 255, 255, 200))

    img = img.convert("RGB")
    img.save(os.path.join(OUTPUT_DIR, "promo_happy_wednesday.jpg"), "JPEG", quality=90)
    print("Created: promo_happy_wednesday.jpg")


def create_promo_2():
    """Summer Keratin - 1,990 THB"""
    img = Image.new("RGBA", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)
    draw_gradient(draw, WIDTH, HEIGHT, (0, 150, 136), (0, 188, 212))  # Teal to Cyan
    add_decorations(draw, WIDTH, HEIGHT)

    font_big = get_font(56)
    font_mid = get_font(40)
    font_small = get_font(30)
    font_price = get_font(72)
    font_badge = get_font(24)

    # Sun decoration
    draw.ellipse([WIDTH-180, 30, WIDTH-30, 180], fill=(255, 235, 59, 80))
    draw.ellipse([WIDTH-160, 50, WIDTH-50, 160], fill=(255, 245, 157, 100))

    bbox = draw.textbbox((0, 0), "SUMMER SALE", font=font_badge)
    bw = bbox[2] - bbox[0]
    draw_badge(draw, "SUMMER SALE", (WIDTH - bw) // 2, 50, font_badge, (255, 87, 34))

    draw_centered_text(draw, "ยืดผมเคราติน", 120, font_big)
    draw_centered_text(draw, "ราคาพิเศษ", 200, font_mid)
    draw_centered_text(draw, "1,990.-", 260, font_price, fill=(255, 235, 59))
    draw_centered_text(draw, "ปกติ 2,500 บาท  ประหยัด 510 บาท!", 360, font_small, fill=(200, 255, 200))
    draw_centered_text(draw, "จำกัดวันละ 3 คน | ถึง 31 ส.ค. 2026", 420, font_small)

    draw.rectangle([0, HEIGHT-50, WIDTH, HEIGHT], fill=(0, 0, 0, 100))
    draw_centered_text(draw, "SANEH KESA SALON", HEIGHT-42, font_badge, fill=(255, 255, 255, 200))

    img = img.convert("RGB")
    img.save(os.path.join(OUTPUT_DIR, "promo_summer_keratin.jpg"), "JPEG", quality=90)
    print("Created: promo_summer_keratin.jpg")


def create_promo_3():
    """New Member - 15% off"""
    img = Image.new("RGBA", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)
    draw_gradient(draw, WIDTH, HEIGHT, (30, 60, 114), (42, 82, 152))  # Deep Blue
    add_decorations(draw, WIDTH, HEIGHT)

    # Star decorations
    for sx, sy in [(120, 100), (900, 80), (200, 400), (800, 450), (500, 60)]:
        draw.regular_polygon((sx, sy, 4), 4, fill=(255, 255, 255, 50))

    font_big = get_font(56)
    font_mid = get_font(40)
    font_small = get_font(30)
    font_huge = get_font(96)
    font_badge = get_font(24)

    bbox = draw.textbbox((0, 0), "NEW MEMBER", font=font_badge)
    bw = bbox[2] - bbox[0]
    draw_badge(draw, "NEW MEMBER", (WIDTH - bw) // 2, 40, font_badge, (76, 175, 80))

    draw_centered_text(draw, "สมาชิกใหม่", 110, font_big)
    draw_centered_text(draw, "15%", 180, font_huge, fill=(76, 175, 80))
    draw_centered_text(draw, "ส่วนลดทุกบริการ ครั้งแรก", 300, font_mid)
    draw_centered_text(draw, "สมัครง่าย ไม่มีค่าใช้จ่าย", 370, font_small, fill=(200, 220, 255))
    draw_centered_text(draw, "เฉพาะลูกค้าใหม่ที่ยังไม่เคยใช้บริการ", 420, font_small)

    draw.rectangle([0, HEIGHT-50, WIDTH, HEIGHT], fill=(0, 0, 0, 100))
    draw_centered_text(draw, "SANEH KESA SALON", HEIGHT-42, font_badge, fill=(255, 255, 255, 200))

    img = img.convert("RGB")
    img.save(os.path.join(OUTPUT_DIR, "promo_new_member.jpg"), "JPEG", quality=90)
    print("Created: promo_new_member.jpg")


if __name__ == "__main__":
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    create_promo_1()
    create_promo_2()
    create_promo_3()
    print(f"\nAll 3 promo images saved to {OUTPUT_DIR}/")
