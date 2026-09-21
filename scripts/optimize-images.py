"""Crop transparent margins from images/*.png and export web-sized WebP into client/public/assets."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "images", ROOT / "client/public/assets"
MAX_SIDE = {"card": 720, "default": 520}

OUT.mkdir(parents=True, exist_ok=True)
for png in sorted(SRC.glob("*.png")):
    im = Image.open(png).convert("RGBA")
    im = im.crop(im.getchannel("A").getbbox())
    is_card = "gorilla" in png.stem or "card_back" in png.stem
    limit = MAX_SIDE["card" if is_card else "default"]
    im.thumbnail((limit, limit), Image.LANCZOS)
    name = png.stem.removeprefix("durian_") + ".webp"
    im.save(OUT / name, "WEBP", quality=86, method=6)
    print(f"{name:40} {im.width}x{im.height} {(OUT / name).stat().st_size // 1024}KB")
