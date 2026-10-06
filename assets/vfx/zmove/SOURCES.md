# Z-move VFX source and art direction

The Z projectile family uses one distinct source sprite for each of the 18 crystal types from the CC0 pack below. Six-frame trajectories are nearest-neighbour scaled from 16×16 to 48×48, given a one-pixel dark edge for contrast against the pale field, and hue-shifted toward the crystal palette while retaining each source's shading and highlights. The in-game core stays close to 50×50 screen pixels; larger party affinity only grows it slightly.

The short impact uses the six-frame pixel explosion by den_yes, palette-shifted per crystal and nearest-neighbour scaled from 32×32 to 64×64. The static radius ring was removed; the game's existing expanding damage wave continues to communicate area, while the sourced sprite carries the impact silhouette. The old launch/trail particle count was cut so these two sourced animations remain the visual focus.

| Asset | Creator | License | Use |
|---|---|---|---|
| [Pixel Art Spells](https://opengameart.org/content/pixel-art-spells) | DevWizard | CC0 | Type-specific projectile frame strips |
| [Explosion Animation](https://opengameart.org/content/explosion-animation-1) | den_yes | CC0 | Six-frame impact burst |
| [Gothicvania Magic Pack 9](https://opengameart.org/content/gothicvania-magic-pack-9) | Luis Zuno (Ansimuz) | CC0 | Reviewed as a size/style alternative; not included in the final atlas because its four spell motifs do not cover all 18 crystal identities consistently |
| [The Juice Box](https://lpc.opengameart.org/content/the-juice-box) | Nick Case | CC0 | Reviewed; not included because its anti-aliased effect style differs from the game's crisp pixel sprites |

Original downloaded files are kept unchanged in `source/`. `tools/build-zmove-vfx-atlas.py` deterministically writes the runtime atlases and frame manifest. The authors do not require attribution under CC0; source pages record their terms and any optional-credit notes.
