"""Build the compact runtime atlas from the checked CC0 source archives."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
import json

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "vfx" / "legendary" / "source"
OUTPUT = ROOT / "assets" / "vfx" / "legendary" / "legendary-material-atlas.png"
MANIFEST = ROOT / "assets" / "vfx" / "legendary" / "manifest.json"
CELL = 150
COLS = 7
ROWS = 10


def frame_paths():
    groups = []
    groups.append(("arcane", "cethiel-arcane-effect.zip", [
        f"01/Arcane_Effect_{i}.png" for i in range(1, 8)
    ]))
    for group, folder in [
        ("water04", "04"),
        ("water03", "03"),
        ("water05", "05"),
    ]:
        groups.append((group, "cethiel-water-effect.zip", [
            f"{folder}/Water__{i:02}.png" for i in range(1, 6)
        ]))
    groups.append(("earth03", "cethiel-earth-impact.zip", [
        f"3/Earth-Impact_{i:02}.png" for i in range(11, 16)
    ]))
    groups.append(("earth04", "cethiel-earth-impact.zip", [
        f"4/Earth-Impact_{i:02}.png" for i in range(16, 21)
    ]))
    groups.append(("cosmic02", "cethiel-cosmic-time.zip", [
        f"2/Cosmic_{i:02}.png" for i in range(6, 11)
    ]))
    groups.append(("cosmic05", "cethiel-cosmic-time.zip", [
        f"5/Cosmic_{i:02}.png" for i in range(21, 26)
    ]))
    groups.append(("slash04", "cethiel-purple-weapon-slash.zip", [
        f"Alternative 1/4/Alternative_1_{i:02}.png" for i in range(19, 25)
    ]))
    groups.append(("pure05", "cethiel-pure-projectile.zip", [
        f"Files/Pure_{i:02}.png" for i in range(21, 26)
    ]))
    return groups


def main():
    atlas = Image.new("RGBA", (COLS * CELL, ROWS * CELL), (0, 0, 0, 0))
    manifest = {
        "atlas": "assets/vfx/legendary/legendary-material-atlas.png",
        "cellSize": CELL,
        "width": COLS * CELL,
        "height": ROWS * CELL,
        "frames": {},
    }

    row = 0
    for group, archive_name, paths in frame_paths():
        archive_path = SOURCE / archive_name
        if not archive_path.is_file():
            raise FileNotFoundError(f"Missing source archive: {archive_path}")
        with ZipFile(archive_path) as archive:
            for index, item_path in enumerate(paths, start=1):
                with archive.open(item_path) as data:
                    frame = Image.open(BytesIO(data.read())).convert("RGBA")
                if frame.size != (CELL, CELL):
                    frame = frame.resize((CELL, CELL), Image.Resampling.LANCZOS)
                x, y = (index - 1) * CELL, row * CELL
                atlas.alpha_composite(frame, (x, y))
                key = f"{group}_{index:02}"
                manifest["frames"][key] = {"x": x, "y": y, "size": CELL}
        row += 1

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(OUTPUT, optimize=True)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8")
    print(f"Wrote {OUTPUT} ({atlas.width}x{atlas.height}) with {len(manifest['frames'])} frames")


if __name__ == "__main__":
    main()
