from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets' / 'tilesets' / 'KANTO50S_OUT.png'
OUTPUT = ROOT / 'assets' / 'tilesets' / 'KANTO50S_TREE_FAMILIES.png'

# Whole 32×64 source cells. Do not resize, recolor, or trim: the source alpha and
# the tree's root/shadow pixels are part of the original sprite.
SPECIES = [
    ('blossom-light', (0, 2048)),
    ('blossom-pink', (32, 2048)),
    ('broadleaf', (64, 2048)),
    ('evergreen', (192, 1856)),
    ('spruce', (224, 1856)),
]


def main():
    source = Image.open(SOURCE).convert('RGBA')
    atlas = Image.new('RGBA', (len(SPECIES) * 32, 64), (0, 0, 0, 0))
    for index, (name, (x, y)) in enumerate(SPECIES):
        crop = source.crop((x, y, x + 32, y + 64))
        if crop.size != (32, 64):
            raise ValueError(f'{name} is not a 32×64 source crop')
        atlas.alpha_composite(crop, (index * 32, 0))
    atlas.save(OUTPUT, optimize=True)
    print(f'Wrote {OUTPUT} ({atlas.width}×{atlas.height}, {len(SPECIES)} original crops)')


if __name__ == '__main__':
    main()
