# Lake tile processing

The supplied `Lake.png` is preserved unchanged at `assets/tilesets/Lake.png` (1728×128). Its 18 horizontal 96×128 cells are pixel-identical, so the processed set keeps one unique source unit instead of treating repeats as variants.

All coordinates below are half-open `(x1, y1, x2, y2)` bounds in that unique unit:

- `Lake_UNIT_96x128.png`: `(0, 0, 96, 128)`
- `Lake_BASIN_96x96.png`: `(0, 32, 96, 128)`
- `Lake_WATER_CORE_64x64.png`: `(16, 48, 80, 112)`
- Edge strips: top `(16, 32, 80, 48)`, bottom `(16, 112, 80, 128)`, left `(0, 48, 16, 112)`, right `(80, 48, 96, 112)`
- Four 16×16 corners are cropped from the corresponding outer corners of the basin.

`Lake_MEDIUM_3x2.png` is composed from a 3×2 grid of exact 64×64 water-core crops, plus the source border strips and corners. It is 224×160 pixels. A 1×1 rebuild compares pixel-for-pixel equal to `Lake_BASIN_96x96.png`; no redraw, color correction, or resampling is used.

## Game-ground blend

The original fringe is saturated turquoise, while the game's field is a pale green. The following RGBA previews key only the grass-colored pixels transparent so the in-game floor can show through; the water, dirt bank, and dark outline remain source pixels:

- `Lake_BASIN_96x96_GAME_GROUND.png`
- `Lake_MEDIUM_3x2_GAME_GROUND.png`
- The same keyed variant is provided for each of the four edge strips and four 16×16 corners (suffix `_GAME_GROUND.png`).

The palette mask is `G >= 1.12R` and `G >= 1.05B`. The concept preview composites these over the real game ground color (`COL.ground`, `#e4edcf`) and its sparse ground marks (`COL.grid`, `#b5cc9a`). `Lake.png` and the unkeyed processed crops remain unchanged. If the game's ground palette changes, regenerate or retune the keyed variants against the new palette.

`artifacts/river-concept/index.html` previews three river forms. The headwater example starts in `Lake_MEDIUM_3x2_GAME_GROUND.png`, with the lake tile masking the stream bank beneath it and a water-only pass opening a broad outlet that narrows into the stream. The other forms demonstrate a winding route and a tributary junction. Each course uses a seeded spline, repeats the original 64×64 water texture without scaling, and takes only the opaque soil pixels (source rows/columns 10–11) from the original top/left edge strips for the bank stroke. Transparent grass and water pixels are excluded from that stroke so they cannot repeat through the full bank width. The outer grass remains transparent over game ground. This is a visual prototype; map placement and collision are not connected yet.

For other rectangular pond sizes, change the water-core grid to `N×M`; the output size is `(64N+32)×(64M+32)`. Curved shorelines use the separate ribbon-style river preview rather than stretching those rectangular corners.
