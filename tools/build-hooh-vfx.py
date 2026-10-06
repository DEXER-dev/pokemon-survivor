"""Pack unchanged CC0 animation cells; retain their original transparent 64px anchors."""
from pathlib import Path
from PIL import Image
import hashlib
import json

root = Path(__file__).resolve().parents[1] / 'assets' / 'vfx' / 'hooh'
atlas = Image.new('RGBA', (1024, 512))
animations = []
for row, (name, filename) in enumerate([('hoohFire', 'fire1_64.png'), ('hoohFlare', 'fire3_64.png')]):
    source_path = root / 'source' / filename
    source = Image.open(source_path).convert('RGBA')
    assert source.size == (640, 384), source.size
    assert source.getchannel('A').getextrema() == (0, 255)
    for frame in range(60):
        cell = source.crop((frame % 10 * 64, frame // 10 * 64, frame % 10 * 64 + 64, frame // 10 * 64 + 64))
        assert cell.getchannel('A').getbbox(), (name, frame)
        index = row * 60 + frame
        atlas.paste(cell, (index % 16 * 64, index // 16 * 64))
    animations.append({'name': name, 'firstCell': row * 60, 'frames': 60, 'fps': 30,
                       'sourceFile': 'source/' + filename,
                       'sha256': hashlib.sha256(source_path.read_bytes()).hexdigest()})
atlas.save(root / 'hooh-fire-atlas.png', optimize=True)
manifest = {'atlas': 'hooh-fire-atlas.png', 'width': 1024, 'height': 512,
            'cellSize': 64, 'columns': 16, 'filter': 'nearest', 'pivot': [0.5, 0.5],
            'animations': animations, 'author': 'BenHickling', 'license': 'CC0-1.0',
            'source': 'https://opengameart.org/content/animated-fire',
            'role': 'Ho-Oh wing fire, burning feather tails and impact blooms',
            'modifications': 'Unchanged cells repacked into one shared texture; no recoloring baked in.'}
(root / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'frames': 120, 'atlas': atlas.size, 'bytes': (root / 'hooh-fire-atlas.png').stat().st_size}))
