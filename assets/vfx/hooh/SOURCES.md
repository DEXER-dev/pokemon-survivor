# Ho-Oh fire animation sample

- Author: BenHickling
- Source: https://opengameart.org/content/animated-fire
- License: CC0 1.0, https://creativecommons.org/publicdomain/zero/1.0/
- Original files: `source/fire1_64.png` and `source/fire3_64.png` (the latter downloaded as `fire3_64_0.png`).
- Downloaded: 2026-10-02.
- Each source contains sixty transparent 64×64 animation cells. The cells are unchanged and packed into `hooh-fire-atlas.png`; `manifest.json` records original SHA-256 checksums.
- Runtime: 30 fps, nearest filtering, fixed centered pivots, native artwork colors. Sprite transforms arrange the fire into wings, trails and landing blooms. The visual sample adds no gameplay damage.
- Rebuild: `python tools/build-hooh-vfx.py` from the game directory (Pillow required).
