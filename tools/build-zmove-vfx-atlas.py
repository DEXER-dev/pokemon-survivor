"""Build the Z-move projectile and impact atlases from the checked CC0 source art."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
import colorsys
import json

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "vfx" / "zmove" / "source"
OUTPUT = ROOT / "assets" / "vfx" / "zmove"
SPELLS_ZIP = SOURCE / "pixelart_spells.zip"
IMPACT_SOURCE = SOURCE / "explosion-animation.png"
CELL = 48
IMPACT_CELL = 64
FRAMES = 6

TYPE_ASSETS = {
    "fire": ("Fireball.png", "#ff7047"),
    "water": ("Water Blast.png", "#55c9f2"),
    "grass": ("Plant Missle.png", "#78d66b"),
    "electric": ("Light Bolt.png", "#ffe36b"),
    "fighting": ("Arcane Bolt.png", "#ff9a57"),
    "psychic": ("Magic Orb.png", "#e68bff"),
    "normal": ("Pure Bolt 2.png", "#e8d4a1"),
    "bug": ("Water Bolt.png", "#a9c83f"),
    "dark": ("Darkness Bolt.png", "#75618e"),
    "dragon": ("Firebomb.png", "#7468e8"),
    "fairy": ("Bolt Of Purity.png", "#f48fcd"),
    "flying": ("Wind Bolt.png", "#86baf3"),
    "ghost": ("Darkness Orb.png", "#8f72c8"),
    "ground": ("Water Orb.png", "#d2a15f"),
    "ice": ("Ice Lance.png", "#83e8ed"),
    "poison": ("Magic Sparks.png", "#c878dd"),
    "rock": ("Rock Sling.png", "#d59b67"),
    "steel": ("Black And White Ray.png", "#a9c6d9"),
}


def rgb(hex_color: str) -> tuple[int, int, int]:
    value = hex_color.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def colorize(source: Image.Image, color: str) -> Image.Image:
    target = rgb(color)
    out = Image.new("RGBA", source.size, (0, 0, 0, 0))
    pixels = []
    for red, green, blue, alpha in source.convert("RGBA").get_flattened_data():
        if alpha < 8:
            pixels.append((0, 0, 0, 0))
            continue
        value = round(0.2126 * red + 0.7152 * green + 0.0722 * blue)
        if value < 54:
            pixels.append((23, 21, 33, alpha))
            continue
        light = 0.45 + 0.55 * value / 255
        shade = tuple(round(channel * light) for channel in target)
        if value > 218:
            white_mix = min(0.52, (value - 218) / 37 * 0.52)
            shade = tuple(round(channel * (1 - white_mix) + 255 * white_mix) for channel in shade)
        pixels.append((*shade, alpha))
    out.putdata(pixels)
    return out


def crystal_tint(source: Image.Image, color: str) -> Image.Image:
    """Shift source hue while keeping each pixel's value/shading and pale highlights."""
    target = rgb(color)
    target_h, target_s, _ = colorsys.rgb_to_hsv(*(channel / 255 for channel in target))
    out = Image.new("RGBA", source.size, (0, 0, 0, 0))
    pixels = []
    for red, green, blue, alpha in source.convert("RGBA").get_flattened_data():
        if alpha < 8:
            pixels.append((0, 0, 0, 0))
            continue
        _, source_s, source_v = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
        if source_v < 0.17:
            pixels.append((red, green, blue, alpha))
            continue
        if source_s < 0.16 and source_v > 0.7:
            saturation = target_s * 0.3
        else:
            saturation = max(target_s * 0.85, min(0.95, source_s * 0.7))
        hue = target_h
        shade = colorsys.hsv_to_rgb(hue, saturation, source_v)
        pixels.append(tuple(round(channel * 255) for channel in shade) + (alpha,))
    out.putdata(pixels)
    return out


def pixel_outline(source: Image.Image) -> Image.Image:
    """Add a one-output-pixel dark edge to keep enlarged spell silhouettes readable."""
    from PIL import ImageFilter

    source = source.convert("RGBA")
    alpha = source.getchannel("A")
    expanded = alpha.filter(ImageFilter.MaxFilter(3))
    edge = Image.new("RGBA", source.size, (30, 34, 39, 0))
    edge.putalpha(expanded)
    edge.alpha_composite(source)
    return edge


def frame_indices(count: int) -> list[int]:
    if count <= 1:
        return [0] * FRAMES
    if count >= FRAMES:
        return [round(index * (count - 1) / (FRAMES - 1)) for index in range(FRAMES)]
    sequence = list(range(count))
    while len(sequence) < FRAMES:
        sequence.extend(range(count - 2, 0, -1))
    return sequence[:FRAMES]


def load_source_frames(archive: ZipFile, filename: str) -> list[Image.Image]:
    item_path = f"Pixelart Spells/PNG Files/{filename}"
    with archive.open(item_path) as data:
        strip = Image.open(BytesIO(data.read())).convert("RGBA")
    if strip.height % 16 or strip.width % 16:
        raise ValueError(f"Source sprite strip is not 16px aligned: {filename} {strip.size}")
    count = strip.width // 16
    selected = frame_indices(count)
    return [
        strip.crop((index * 16, 0, index * 16 + 16, 16))
        .resize((CELL, CELL), Image.Resampling.NEAREST)
        for index in selected
    ]


def main() -> None:
    types = list(TYPE_ASSETS)
    projectile_atlas = Image.new("RGBA", (FRAMES * CELL, len(types) * CELL), (0, 0, 0, 0))
    impact_atlas = Image.new("RGBA", (FRAMES * IMPACT_CELL, len(types) * IMPACT_CELL), (0, 0, 0, 0))
    manifest = {
        "projectileAtlas": "assets/vfx/zmove/projectile-atlas.png",
        "impactAtlas": "assets/vfx/zmove/impact-atlas.png",
        "frameSize": CELL,
        "impactFrameSize": IMPACT_CELL,
        "framesPerType": FRAMES,
        "width": projectile_atlas.width,
        "height": projectile_atlas.height,
        "impactWidth": impact_atlas.width,
        "impactHeight": impact_atlas.height,
        "types": {},
        "frames": {},
        "source": {
            "spells": "https://opengameart.org/content/pixel-art-spells",
            "impact": "https://opengameart.org/content/explosion-animation-1",
            "license": "CC0",
        },
    }

    impact_strip = Image.open(IMPACT_SOURCE).convert("RGBA")
    if impact_strip.size != (192, 32):
        raise ValueError(f"Expected six 32×32 impact frames, got {impact_strip.size}")

    with ZipFile(SPELLS_ZIP) as archive:
        for row, type_id in enumerate(types):
            filename, tint = TYPE_ASSETS[type_id]
            frames = load_source_frames(archive, filename)
            manifest["types"][type_id] = {"sprite": filename, "tint": tint, "row": row}
            for index, raw in enumerate(frames):
                frame = pixel_outline(crystal_tint(raw, tint))
                x, y = index * CELL, row * CELL
                projectile_atlas.alpha_composite(frame, (x, y))
                name = f"zmove_{type_id}_{index:02}"
                manifest["frames"][name] = {
                    "atlas": "projectile", "x": x, "y": y, "width": CELL, "height": CELL,
                }

            for index in range(FRAMES):
                raw = impact_strip.crop((index * 32, 0, index * 32 + 32, 32))
                raw = raw.resize((IMPACT_CELL, IMPACT_CELL), Image.Resampling.NEAREST)
                frame = colorize(raw, tint)
                x, y = index * IMPACT_CELL, row * IMPACT_CELL
                impact_atlas.alpha_composite(frame, (x, y))
                name = f"zimpact_{type_id}_{index:02}"
                manifest["frames"][name] = {
                    "atlas": "impact", "x": x, "y": y,
                    "width": IMPACT_CELL, "height": IMPACT_CELL,
                }

    OUTPUT.mkdir(parents=True, exist_ok=True)
    projectile_atlas.save(OUTPUT / "projectile-atlas.png", optimize=True)
    impact_atlas.save(OUTPUT / "impact-atlas.png", optimize=True)
    (OUTPUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    # A game-scale proof sheet shows one frame from every type on the arena's pale ground.
    columns, preview_cell, label_h = 6, 112, 18
    rows = (len(types) + columns - 1) // columns
    preview = Image.new("RGBA", (columns * preview_cell, rows * (preview_cell + label_h)), "#e4edd5")
    draw = ImageDraw.Draw(preview)
    for index, type_id in enumerate(types):
        x = (index % columns) * preview_cell
        y = (index // columns) * (preview_cell + label_h)
        row = index * CELL
        frame = projectile_atlas.crop((2 * CELL, row, 3 * CELL, row + CELL))
        frame = frame.resize((56, 56), Image.Resampling.NEAREST)
        preview.alpha_composite(frame, (x + 28, y + 24))
        draw.text((x + 4, y + preview_cell + 1), type_id, fill="#263342", font=ImageFont.load_default())
    preview.save(OUTPUT / "preview-projectiles.png", optimize=True)

    impact_preview = Image.new("RGBA", (columns * preview_cell, rows * (preview_cell + label_h)), "#e4edd5")
    impact_draw = ImageDraw.Draw(impact_preview)
    for index, type_id in enumerate(types):
        x = (index % columns) * preview_cell
        y = (index // columns) * (preview_cell + label_h)
        row = index * IMPACT_CELL
        frame = impact_atlas.crop((2 * IMPACT_CELL, row, 3 * IMPACT_CELL, row + IMPACT_CELL))
        frame = frame.resize((80, 80), Image.Resampling.NEAREST)
        impact_preview.alpha_composite(frame, (x + 16, y + 12))
        impact_draw.text((x + 4, y + preview_cell + 1), type_id, fill="#263342",
                         font=ImageFont.load_default())
    impact_preview.save(OUTPUT / "preview-impacts.png", optimize=True)
    print(f"Wrote 18×6 projectile frames and 18×6 impact frames; previews in {OUTPUT}")


if __name__ == "__main__":
    main()
