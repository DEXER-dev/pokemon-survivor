"""Layout review GIF, using the production choreography and the delivered source cells."""
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw
import subprocess
import json
import math

root = Path(__file__).resolve().parents[1]
scenes = json.loads(subprocess.check_output(['node', str(root / 'tools' / 'preview-hooh-vfx.mjs')], text=True))
atlas = Image.open(root / 'assets/vfx/hooh/hooh-fire-atlas.png').convert('RGBA')
cells = {}
for index in range(120):
    name = f'hoohFire_{index}' if index < 60 else f'hoohFlare_{index - 60}'
    x, y = index % 16 * 64, index // 16 * 64
    cells[name] = atlas.crop((x, y, x + 64, y + 64))
aura = Image.new('RGBA', (56, 56))
for y in range(56):
    for x in range(56):
        r = math.hypot(x - 27.5, y - 27.5) / 24
        alpha = max(0, 0.62 * (1 - r))
        aura.putpixel((x, y), (255, 255, 255, round(255 * alpha)))
cells['aura'] = aura
feather = Image.new('RGBA', (56, 56))
ImageDraw.Draw(feather).polygon([(8, 44), (15, 13), (30, 5), (44, 13), (37, 30)], fill='white')
cells['feather'] = feather
frames = []
for scene in scenes:
    image = Image.new('RGBA', (640, 400), (24, 27, 45, 255))
    painter = ImageDraw.Draw(image)
    for x in range(0, 640, 40): painter.line((x, 0, x, 400), fill=(32, 35, 53))
    for y in range(0, 400, 40): painter.line((0, y, 640, y), fill=(32, 35, 53))
    painter.text((20, 16), 'HO-OH / SACRED FIRE - MATERIAL ANIMATION SAMPLE', fill=(255, 222, 152))
    for sprite in scene:
        cell = cells[sprite['name']]
        color = tuple(bytes.fromhex(sprite['tint']['color'][1:]))
        tinted = ImageChops.multiply(cell, Image.new('RGBA', cell.size, (*color, 255)))
        tinted.putalpha(tinted.getchannel('A').point(lambda a: round(a * sprite['tint']['alpha'] / 255)))
        width = max(1, round(cell.width * sprite['sx']))
        height = max(1, round(cell.height * sprite['sy']))
        tinted = tinted.resize((width, height), Image.Resampling.NEAREST)
        tinted = tinted.rotate(math.degrees(sprite['angle']), resample=Image.Resampling.NEAREST, expand=True)
        px = round(320 + sprite['x'] - tinted.width / 2)
        py = round(255 - sprite['y'] - tinted.height / 2)
        image.alpha_composite(tinted, (px, py))
    frames.append(image.convert('RGB').quantize(colors=128))
out = root / 'artifacts' / 'hooh-vfx'
out.mkdir(parents=True, exist_ok=True)
frames[32].convert('RGB').save(out / 'hooh-material-preview.png')
frames[0].save(out / 'hooh-material-preview.gif', save_all=True, append_images=frames[1:], duration=50, loop=0)
print(out / 'hooh-material-preview.gif')
