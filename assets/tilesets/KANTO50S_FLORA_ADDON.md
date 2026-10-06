# KANTO50S Flora Add-on

Companion decorative sprites for `KANTO50S_OUT.png`. The supplied atlas remains unchanged.

- Built-in ImageGen botanical source, preserved as `KANTO50S_FLORA_MASTER.png` at its generated 1448×1086 RGBA resolution.
- The add-on atlas is a transparent RGBA image with 4 columns × 3 rows of 64×64 cells (256×192 px total). Each plant was cropped from the source and reduced only enough to fit its 56×56 sprite bounds; source colors and alpha were preserved.
- Each 64×64 cell spans 4×4 base 16 px tiles. Use nearest-neighbor filtering for integer-scale display.
- Preview uses a checkerboard only to make transparency visible.

| Cell | Sprite | Description |
|---|---|---|
| (0, 0) | `grass_tuft_01` | broad grass tuft |
| (1, 0) | `grass_tuft_02` | upright grass tuft |
| (2, 0) | `grass_tuft_03` | dense grass tuft |
| (3, 0) | `grass_tuft_04` | slim grass tuft |
| (0, 1) | `flowers_cream` | cream wildflowers |
| (1, 1) | `flowers_yellow` | pale-yellow wildflowers |
| (2, 1) | `flowers_pink` | soft-pink wildflowers |
| (3, 1) | `flowers_blueviolet` | blue-violet wildflowers |
| (0, 2) | `mixed_cream` | grass and cream flowers |
| (1, 2) | `mixed_yellow` | grass and yellow flowers |
| (2, 2) | `mixed_pink` | grass and pink flowers |
| (3, 2) | `mixed_blueviolet` | grass and blue-violet flowers |
