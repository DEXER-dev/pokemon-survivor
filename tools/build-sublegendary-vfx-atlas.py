"""Pack source-verified CC0 sub-legendary companion effects into a runtime atlas."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
import json

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "assets" / "vfx" / "sublegendary"
SOURCE = BASE / "source"
OUTPUT = BASE / "sublegendary-atlas.png"
MANIFEST = BASE / "manifest.json"
CELL = 64
COLS = 8


def read_spells():
    groups = [
        ("subArticunoOrb", "Water Orb.png", 6),
        ("subArticunoLance", "Ice Lance.png", 4),
        ("subZapdosBolt", "Light Bolt.png", 6),
        ("subMoltresFire", "Fireball.png", 6),
        ("subMoltresBomb", "Firebomb.png", 6),
        ("subRaikouCore", "Bolt Of Purity.png", 6),
        ("subSuicuneBolt", "Water Bolt.png", 6),
        ("subSuicuneSplash", "Splash.png", 6),
    ]
    archive_path = SOURCE / "pixel-art-spells-devwizard.zip"
    with ZipFile(archive_path) as archive:
        files = archive.namelist()
        for prefix, basename, frames in groups:
            path = next((item for item in files if item.endswith("/" + basename)), None)
            if path is None:
                raise FileNotFoundError(f"{basename} is missing from {archive_path}")
            sheet = Image.open(BytesIO(archive.read(path))).convert("RGBA")
            frame_w = sheet.width // frames
            if sheet.width % frames or sheet.height not in (16, 32):
                raise ValueError(f"Unexpected spell sheet dimensions: {basename} {sheet.size}")
            for index in range(frames):
                yield f"{prefix}_{index}", sheet.crop((index * frame_w, 0,
                                                       (index + 1) * frame_w, sheet.height)), basename


def read_m484():
    sheet = Image.open(SOURCE / "m484-lightning-master484.png").convert("RGBA")
    # The source uses 30px tiles separated by red guides on opaque black. Keep two turns and
    # two short links; threshold only the guides/backdrop, preserving the authored blue/white art.
    for index, (x, y) in enumerate(((20, 97), (53, 97), (86, 34), (119, 34))):
        tile = sheet.crop((x, y, x + 30, y + 30))
        pixels = []
        for red, green, blue, alpha in tile.get_flattened_data():
            guide = red > 155 and green < 105 and blue < 105
            backdrop = max(red, green, blue) < 38
            pixels.append((red, green, blue, 0 if guide or backdrop else alpha))
        tile.putdata(pixels)
        yield f"subZapdosArc_{index}", tile, "m484-lightning-master484.png"


def read_slashes():
    sheet = Image.open(SOURCE / "pixel-slash-tbbk.png").convert("RGBA")
    if sheet.size != (192, 141):
        raise ValueError(f"Unexpected slash sheet dimensions: {sheet.size}")
    # These are three alternate authored crescents from the 3×3 sheet, not animation frames.
    for index, (col, row) in enumerate(((0, 0), (1, 1), (2, 2))):
        yield f"subRaikouSlash_{index}", sheet.crop((col * 64, row * 47,
                                                     (col + 1) * 64, (row + 1) * 47)), "pixel-slash-tbbk.png"


def read_explosions():
    sheet = Image.open(SOURCE / "explosion-den_yes.png").convert("RGBA")
    if sheet.size != (192, 32):
        raise ValueError(f"Unexpected explosion sheet dimensions: {sheet.size}")
    for index in range(6):
        yield f"subEnteiBlast_{index}", sheet.crop((index * 32, 0, (index + 1) * 32, 32)), "explosion-den_yes.png"


def main():
    frames = [*read_spells(), *read_m484(), *read_slashes(), *read_explosions()]
    rows = (len(frames) + COLS - 1) // COLS
    atlas = Image.new("RGBA", (COLS * CELL, rows * CELL), (0, 0, 0, 0))
    manifest = {"atlas": "assets/vfx/sublegendary/sublegendary-atlas.png",
                "width": atlas.width, "height": atlas.height, "cellSize": CELL, "frames": {}}
    for slot, (key, image, source_name) in enumerate(frames):
        col, row = slot % COLS, slot // COLS
        x, y = col * CELL, row * CELL
        # Keep every source pixel at native scale and center it on the common 64px pivot.
        atlas.alpha_composite(image, (x + (CELL - image.width) // 2,
                                      y + (CELL - image.height) // 2))
        manifest["frames"][key] = {"x": x, "y": y, "width": CELL, "height": CELL,
                                    "size": CELL, "source": source_name}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(OUTPUT, optimize=True)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT} ({atlas.width}×{atlas.height}) with {len(frames)} frames")


if __name__ == "__main__":
    main()
