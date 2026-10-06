# KANTO50S Tree Families

Five complete pixel-art tree variants are copied directly from the supplied `KANTO50S_OUT.png` tileset: two flowering trees, the familiar broadleaf tree, and two evergreen silhouettes.

- `KANTO50S_TREE_FAMILIES.png` is a 160×64 RGBA atlas. Its five consecutive 32×64 frames are cropped from `(0,2048)`, `(32,2048)`, `(64,2048)`, `(192,1856)`, and `(224,1856)` in source pixels.
- The exact original pixels, transparent margins, trunks, and ground shadows are retained. `python tools/build-kanto-tree-family-atlas.py` rebuilds the atlas from the supplied sheet.
- The game uses nearest-neighbor filtering and root anchors. Seeded groves choose a stable dominant family (flowering, broadleaf, evergreen, or mixed) with a few complementary species as accents; solitary trees can be any of the five. All variants keep the same trunk collision rule, winding walking openings, and camera culling.
- Woodland cells sit on a 600-unit grid with 92% acceptance; solitary trees use a 300-unit grid with 20% acceptance. Three seeded companion groves join the walkable landmark grove around spawn, while a 200-unit spawn clearing and the pond clearing stay open. Cross-grove roots are separated by at least 34 world units, and the visible-tree pool allows up to 320 trees.
- A 96-seed opening render-range sample produced a median of 58 trees (range 38–83); each screen quadrant averaged 13–16 trees, root checks found no overlapping trunk blockers, and no generated tree root entered the pond clearing.
