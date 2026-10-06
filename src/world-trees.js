import { cellHash } from './world-flora.js';
import { DEFAULT_WORLD_LAYOUT, inPondClearing } from './world-map-layout.js';
import { makeRng } from './rng.js';

// Forest cells are deliberately much larger than the individual props. Each accepted cell
// creates an irregular grove; the hash keeps its shape fixed while the camera moves.
const FOREST_GRID = 600;
const FOREST_COVERAGE = 92;
const FOREST_JITTER = 85;
const FOREST_KEEP_OUT = 200;
const SINGLE_GRID = 300;
const SINGLE_COVERAGE = 20;
const MAX_VISIBLE_TREES = 320;
// Coordinates are foot anchored. Block the visible trunk at the tree's ground point,
// instead of shifting its collision circle up into the canopy.
const TRUNK_Y = 0;
const TREE_PATH_CLEARANCE = 36;
const TREE_ROOT_CLEARANCE = 34;
const TAU = Math.PI * 2;
const TREE_SPECIES = ['tree_blossom_light', 'tree_blossom_pink', 'tree_broadleaf', 'tree_evergreen', 'tree_spruce'];
// Groves get a stable dominant species mix, so each wood reads as a place rather than
// a bag of unrelated trees. Individual hashes vary the accents inside each palette.
const TREE_FAMILY_PALETTES = [
    [0, 0, 0, 1, 1, 2],       // flowering woodland
    [2, 2, 2, 2, 3, 4],       // broadleaf woodland
    [3, 3, 3, 4, 4, 2],       // evergreen woodland
    [0, 1, 2, 2, 3, 4],       // mixed woodland
];

// These are woodland silhouettes, not tile rows. Individual tree roots are scattered
// inside an irregular mask; the same seeded layout always produces the same grove.
const FOREST_FAMILIES = [
    { kind: 'edge', count: 16, rx: 340, ry: 112, spacing: 58 },
    { kind: 'island', count: 23, rx: 215, ry: 152, spacing: 58 },
    { kind: 'split', count: 31, rx: 290, ry: 184, spacing: 58 },
    { kind: 'dense', count: 40, rx: 310, ry: 196, spacing: 58 },
];
const START_GROVE_FAMILIES = [
    { kind: 'island', count: 19, rx: 205, ry: 136, spacing: 58 },
    { kind: 'split', count: 23, rx: 220, ry: 146, spacing: 58 },
    { kind: 'dense', count: 27, rx: 230, ry: 154, spacing: 58 },
];
const MAX_SHAPE_EXTENT = 480;

function rotatePoint (x, y, turn) {
    if (turn === 1) return { x: y, y: -x };
    if (turn === 2) return { x: -x, y: -y };
    if (turn === 3) return { x: -y, y: x };
    return { x, y };
}

function shapePoints (shape, turn, seedX, seedY, windingLane = false, laneSeed = 0, mapSeed = 0) {
    const points = [];
    const laneOffset = ((laneSeed >>> 8) % 31) - 15;
    const lanePhase = ((laneSeed >>> 18) % 628) / 100;
    const rng = makeRng(cellHash(seedX, seedY, (mapSeed ^ laneSeed ^ 0x68bc21eb) | 0));
    const phase = rng.range(0, TAU);
    let attempts = 0;
    while (points.length < shape.count && attempts++ < shape.count * 80) {
        let x, y;
        if (shape.kind === 'edge') {
            const t = rng.range(-1, 1);
            x = t * shape.rx;
            y = Math.sin(t * 2.1 + phase) * shape.ry * 0.34
                + Math.sin(t * 4.8 - phase) * shape.ry * 0.11
                + rng.range(-shape.ry * 0.12, shape.ry * 0.12);
        } else {
            const angle = rng.range(0, TAU);
            const boundary = 0.78 + Math.sin(angle * 3 + phase) * 0.12
                + Math.sin(angle * 5 - phase * 1.7) * 0.08;
            const radius = Math.sqrt(rng.range(0, 1)) * boundary;
            const lobe = shape.kind === 'split' ? rng.sign() * shape.rx * 0.27 : 0;
            const spreadX = shape.kind === 'split' ? shape.rx * 0.64 : shape.rx;
            const spreadY = shape.kind === 'split' ? shape.ry * 0.78 : shape.ry;
            x = lobe + Math.cos(angle) * spreadX * radius;
            y = Math.sin(angle) * spreadY * radius;
        }

        const rotated = rotatePoint(x, y, turn);
        // Keep trunks individually readable even where the crowns overlap.
        if (points.some((point) => Math.hypot(point.x - rotated.x, point.y - rotated.y) < shape.spacing)) continue;
        // Keep a winding, walkable line through the landmark grove near spawn.
        const laneY = laneOffset + Math.sin(x / 136 + lanePhase) * 18;
        if (windingLane && Math.abs(y + TRUNK_Y - laneY) < TREE_PATH_CLEARANCE) continue;

        const index = points.length;
        const hash = cellHash(seedX * 31 + index * 17 + attempts,
            seedY * 31 + index * 29 - attempts, mapSeed);
        points.push({ x: rotated.x, y: rotated.y, hash, forest: true, blockRadius: 13 });
    }
    return points;
}

function forestRadius (shape) {
    return Math.hypot(shape.rx, shape.ry) + 30;
}

function startingGroveTrees (layout) {
    const grove = layout.grove;
    const seedX = layout.seed | 0;
    const seedY = (layout.seed ^ 0x9e3779b9) | 0;
    const familyHash = cellHash(seedX, seedY, layout.seed);
    const shape = START_GROVE_FAMILIES[(familyHash >>> 5) % START_GROVE_FAMILIES.length];
    const trees = shapePoints(shape, grove.turn, seedX, seedY, true,
        cellHash(seedX, seedY, layout.seed), layout.seed).map((point) => ({
        ...point,
        x: point.x + grove.x,
        y: point.y + grove.y,
        groveStyle: familyHash % TREE_FAMILY_PALETTES.length,
    }));

    // Seed three smaller companion groves around the opening area. Keeping a broad
    // center clearing lets the trainer move freely while the first screen still
    // reads as a wooded field instead of a bare lawn with one distant clump.
    const rng = makeRng(cellHash(seedX ^ 0x6c8e9cf5, seedY ^ 0x4f1bbcdc, layout.seed));
    const baseAngle = Math.atan2(grove.y, grove.x);
    for (let i = 0; i < 3; i++) {
        const offset = [Math.PI / 2, Math.PI, -Math.PI / 2][i];
        const angle = baseAngle + offset + rng.range(-0.26, 0.26);
        const radius = rng.range(360, 415);
        const center = { x: Math.round(Math.cos(angle) * radius), y: Math.round(Math.sin(angle) * radius) };
        const extraHash = cellHash(seedX + 37 * (i + 1), seedY - 61 * (i + 1), layout.seed);
        const extraShape = START_GROVE_FAMILIES[(extraHash >>> 7) % START_GROVE_FAMILIES.length];
        const extraTurn = (extraHash >>> 19) & 3;
        trees.push(...shapePoints(extraShape, extraTurn,
            seedX + 83 * (i + 1), seedY - 47 * (i + 1), false, extraHash, layout.seed)
            .map((point) => ({
                ...point,
                x: point.x + center.x,
                y: point.y + center.y,
                groveStyle: (extraHash >>> 23) % TREE_FAMILY_PALETTES.length,
            }))
            .filter((point) => Math.hypot(point.x, point.y) >= 205
                && !inPondClearing(point.x, point.y, 62, layout.pond)));
    }
    return trees;
}

function forestCell (gx, gy, mapSeed, grove) {
    const hash = cellHash(gx, gy, mapSeed);
    if (hash % 100 >= FOREST_COVERAGE) return null;

    const shape = FOREST_FAMILIES[(hash >>> 5) % FOREST_FAMILIES.length];
    const turn = (hash >>> 13) & 3;
    const x = gx * FOREST_GRID + ((hash >>> 9) % (FOREST_JITTER * 2 + 1)) - FOREST_JITTER;
    const y = gy * FOREST_GRID + ((hash >>> 18) % (FOREST_JITTER * 2 + 1)) - FOREST_JITTER;
    const radius = forestRadius(shape);

    // Keep a wide, predictable opening around the trainer spawn. The first grove is a
    // visible landmark beyond that opening; nearby procedural groves stay out of its way.
    if (Math.hypot(x, y) < FOREST_KEEP_OUT + radius) return null;
    if (Math.hypot(x - grove.x, y - grove.y) < 180 + radius) return null;

    return {
        x,
        y,
        radius,
        points: shapePoints(shape, turn, gx, gy, false, hash, mapSeed).map((point) => ({
            ...point,
            x: point.x + x,
            y: point.y + y,
            groveStyle: (hash >>> 23) % TREE_FAMILY_PALETTES.length,
        })),
    };
}

function singleTree (gx, gy, mapSeed, grove) {
    const hash = cellHash(gx + 1717, gy - 2521, mapSeed);
    if (hash % 100 >= SINGLE_COVERAGE) return null;
    const x = gx * SINGLE_GRID + ((hash >>> 8) % 151) - 75;
    const y = gy * SINGLE_GRID + ((hash >>> 16) % 151) - 75;
    if (Math.hypot(x, y) < 310) return null;
    if (Math.hypot(x - grove.x, y - grove.y) < 340) return null;
    return { x, y, hash, forest: false, blockRadius: 13 };
}

function treeSpeciesIndex (tree) {
    if (!Number.isInteger(tree.groveStyle)) return (tree.hash >>> 20) % TREE_SPECIES.length;
    const palette = TREE_FAMILY_PALETTES[tree.groveStyle % TREE_FAMILY_PALETTES.length];
    return palette[(tree.hash >>> 16) % palette.length];
}

function treeSize (tree) {
    return tree.forest
        ? 56 + ((tree.hash >>> 12) % 15)
        : 50 + ((tree.hash >>> 12) % 15);
}

function treeHeight (tree) {
    return tree.forest
        ? 78 + ((tree.hash >>> 17) % 21)
        : 72 + ((tree.hash >>> 17) % 19);
}

function treeScale (tree) {
    return tree.forest
        ? 0.9 + ((tree.hash >>> 22) % 25) / 100
        : 0.86 + ((tree.hash >>> 22) % 29) / 100;
}

/** Seeded Kanto woodland: reproducible forest clumps plus lighter solitary accents. */
export class WorldTrees {
    constructor (cc, world) {
        this.cc = cc;
        this.root = new cc.Node('FieldTrees');
        this.root.layer = cc.Layers.Enum.UI_2D;
        world.addChild(this.root);
        this.foregroundRoot = null;
        this.pool = [];
        this.visibleRoots = [];
        this.frames = null;
        this.layout = DEFAULT_WORLD_LAYOUT;
        this.forestCellCache = new Map();
        this.startGroveTrees = startingGroveTrees(this.layout);
    }

    setWorldLayout (layout) {
        this.layout = layout || DEFAULT_WORLD_LAYOUT;
        this.forestCellCache.clear();
        this.startGroveTrees = startingGroveTrees(this.layout);
        this.visibleRoots = [];
    }

    getVisibleRoots () {
        return this.visibleRoots;
    }

    _getForestCell (gx, gy) {
        const key = `${gx},${gy}`;
        if (this.forestCellCache.has(key)) return this.forestCellCache.get(key);
        if (this.forestCellCache.size >= 384) {
            this.forestCellCache.delete(this.forestCellCache.keys().next().value);
        }
        const cell = forestCell(gx, gy, this.layout.seed, this.layout.grove);
        this.forestCellCache.set(key, cell);
        return cell;
    }

    setForegroundParent (world) {
        if (this.foregroundRoot) return;
        this.foregroundRoot = new this.cc.Node('FieldTreesForeground');
        this.foregroundRoot.layer = this.cc.Layers.Enum.UI_2D;
        world.addChild(this.foregroundRoot);
    }

    setFrames (glyphs) {
        const speciesFrames = TREE_SPECIES.map((name) => glyphs[name] && glyphs[name].frame);
        this.frames = speciesFrames.every(Boolean)
            ? speciesFrames
            : (glyphs.tree_full ? [glyphs.tree_full.frame] : []);
    }

    _spawn () {
        const node = new this.cc.Node('FieldTree');
        node.layer = this.cc.Layers.Enum.UI_2D;
        this.root.addChild(node);
        const sprite = node.addComponent(this.cc.Sprite);
        sprite.sizeMode = this.cc.Sprite.SizeMode.CUSTOM;
        const transform = node.getComponent(this.cc.UITransform);
        // Keep the source tree intact, including its trunk and shadow. Small horizontal
        // variation makes the silhouette read rounder without cutting or repainting pixels.
        transform.anchorX = 0.5;
        transform.anchorY = 0.08;
        this.pool.push({ node, sprite, transform, parent: this.root,
            x: null, y: null, size: null, height: null, scale: null, mirror: null, frame: null });
        return this.pool[this.pool.length - 1];
    }

    _collectTreesInBounds (left, right, bottom, top) {
        const trees = [];
        const x0 = Math.floor((left - FOREST_JITTER - MAX_SHAPE_EXTENT) / FOREST_GRID);
        const x1 = Math.ceil((right + FOREST_JITTER + MAX_SHAPE_EXTENT) / FOREST_GRID);
        const y0 = Math.floor((bottom - FOREST_JITTER - MAX_SHAPE_EXTENT) / FOREST_GRID);
        const y1 = Math.ceil((top + FOREST_JITTER + MAX_SHAPE_EXTENT) / FOREST_GRID);

        for (const tree of this.startGroveTrees) {
            if (tree.x >= left && tree.x <= right && tree.y >= bottom && tree.y <= top) trees.push(tree);
        }

        for (let gx = x0; gx <= x1; gx++) {
            for (let gy = y0; gy <= y1; gy++) {
                const forest = this._getForestCell(gx, gy);
                if (!forest) continue;
                for (const tree of forest.points) {
                    if (tree.x >= left && tree.x <= right && tree.y >= bottom && tree.y <= top) trees.push(tree);
                }
            }
        }

        const sx0 = Math.floor((left - 75) / SINGLE_GRID);
        const sx1 = Math.ceil((right + 75) / SINGLE_GRID);
        const sy0 = Math.floor((bottom - 75) / SINGLE_GRID);
        const sy1 = Math.ceil((top + 75) / SINGLE_GRID);
        for (let gx = sx0; gx <= sx1; gx++) {
            for (let gy = sy0; gy <= sy1; gy++) {
                const tree = singleTree(gx, gy, this.layout.seed, this.layout.grove);
                if (tree && tree.x >= left && tree.x <= right && tree.y >= bottom && tree.y <= top) trees.push(tree);
            }
        }

        // In this y-up world, lower trees sit in front and must draw last. Nearby
        // forest cells can merge visually, but their trunk blockers must stay separate.
        const ordered = trees.filter((tree) => !inPondClearing(tree.x, tree.y, 62, this.layout.pond))
            .sort((a, b) => b.y - a.y || a.x - b.x);
        const roots = [];
        const minDistanceSq = TREE_ROOT_CLEARANCE * TREE_ROOT_CLEARANCE;
        for (const tree of ordered) {
            if (roots.some((root) => {
                const dx = root.x - tree.x;
                const dy = root.y - tree.y;
                return dx * dx + dy * dy < minDistanceSq;
            })) continue;
            roots.push(tree);
        }
        return roots;
    }

    update (camera, viewWidth, viewHeight, enabled, playerY = NaN) {
        if (!enabled || !this.frames || !this.frames.length) {
            this.visibleRoots = [];
            if (this.root.active) this.root.active = false;
            if (this.foregroundRoot && this.foregroundRoot.active) this.foregroundRoot.active = false;
            return;
        }
        this.root.active = true;
        if (this.foregroundRoot) this.foregroundRoot.active = true;

        const z = Math.max(0.01, camera.z);
        const halfW = Math.max(1280, viewWidth) / (2 * z);
        const halfH = Math.max(720, viewHeight) / (2 * z);
        const trees = this._collectTreesInBounds(
            camera.x - halfW - 160,
            camera.x + halfW + 160,
            camera.y - halfH - 160,
            camera.y + halfH + 160,
        ).slice(0, MAX_VISIBLE_TREES);
        this.visibleRoots = trees;

        let backgroundIndex = 0;
        let foregroundIndex = 0;
        for (let i = 0; i < trees.length; i++) {
            const source = trees[i];
            let tree = this.pool[i];
            if (!tree) tree = this._spawn();
            // In this y-up world, a tree rooted south of the trainer is in front.
            // Put that sprite layer above entities so its canopy can occlude the
            // trainer instead of making the trainer look pasted over the tree.
            const parent = this.foregroundRoot && source.y <= playerY ? this.foregroundRoot : this.root;
            if (tree.parent !== parent) {
                tree.node.setParent(parent);
                tree.parent = parent;
            }
            const siblingIndex = parent === this.foregroundRoot ? foregroundIndex++ : backgroundIndex++;
            const size = treeSize(source);
            const height = treeHeight(source);
            const scale = treeScale(source);
            const mirror = ((source.hash >>> 20) & 1) === 1;
            const frame = this.frames.length === 1
                ? this.frames[0]
                : this.frames[treeSpeciesIndex(source)];
            if (tree.frame !== frame) {
                tree.sprite.spriteFrame = frame;
                tree.frame = frame;
            }
            if (tree.size !== size || tree.height !== height || tree.scale !== scale || tree.mirror !== mirror) {
                tree.transform.setContentSize(size, height);
                tree.size = size;
                tree.height = height;
                tree.scale = scale;
                tree.mirror = mirror;
                tree.node.setScale(mirror ? -scale : scale, scale, 1);
            }
            if (tree.x !== source.x || tree.y !== source.y) {
                tree.node.setPosition(source.x, source.y, 0);
                tree.x = source.x;
                tree.y = source.y;
            }
            if (!tree.node.active) tree.node.active = true;
            if (tree.node.getSiblingIndex() !== siblingIndex) tree.node.setSiblingIndex(siblingIndex);
        }

        for (let i = trees.length; i < this.pool.length; i++) {
            const tree = this.pool[i];
            if (tree.node.active) tree.node.active = false;
        }
    }

    resolvePlayer (player, playerRadius, enabled, previousPosition = null) {
        if (!enabled) return;
        const targetX = player.x;
        const targetY = player.y;
        const startX = previousPosition && Number.isFinite(previousPosition.x) ? previousPosition.x : targetX;
        const startY = previousPosition && Number.isFinite(previousPosition.y) ? previousPosition.y : targetY;
        // Only nearby blockers are needed. Include the whole movement segment so a
        // long frame cannot skip a trunk between its starting and ending positions.
        const nearby = this._collectTreesInBounds(
            Math.min(startX, targetX) - 150,
            Math.max(startX, targetX) + 150,
            Math.min(startY, targetY) - 150,
            Math.max(startY, targetY) + 150,
        );

        const overlaps = () => nearby.filter((tree) => {
            const dx = player.x - tree.x;
            const dy = player.y - (tree.y + TRUNK_Y);
            const minDistance = playerRadius + tree.blockRadius + 0.05;
            return dx * dx + dy * dy < minDistance * minDistance;
        });

        const resolveAtCurrentPosition = () => {
            // Revisit nearby trunk circles because neighbouring collision zones can
            // overlap slightly in dense groves.
            for (let pass = 0; pass < 8; pass++) {
                let moved = false;
                for (const tree of nearby) {
                    const dx = player.x - tree.x;
                    const dy = player.y - (tree.y + TRUNK_Y);
                    const minDistance = playerRadius + tree.blockRadius;
                    const distanceSq = dx * dx + dy * dy;
                    if (distanceSq >= minDistance * minDistance) continue;

                    const distance = Math.sqrt(distanceSq);
                    let nx, ny;
                    if (distance > 0.001) {
                        nx = dx / distance;
                        ny = dy / distance;
                    } else {
                        const angle = (tree.hash % 360) * Math.PI / 180;
                        nx = Math.cos(angle);
                        ny = Math.sin(angle);
                    }
                    const push = minDistance - distance + 0.05;
                    player.x += nx * push;
                    player.y += ny * push;
                    moved = true;
                }
                if (!moved) break;
            }

            const blocked = overlaps();
            if (blocked.length) {
                // In a narrow gap, projecting away from one tree can push the trainer
                // back into its neighbour. Search circle boundaries, then a small
                // radial grid, for the nearest point that clears every local trunk.
                const originX = player.x;
                const originY = player.y;
                let bestX = null;
                let bestY = null;
                let bestDistanceSq = Infinity;
                const consider = (x, y) => {
                    for (const tree of nearby) {
                        const dx = x - tree.x;
                        const dy = y - (tree.y + TRUNK_Y);
                        const minDistance = playerRadius + tree.blockRadius + 0.05;
                        if (dx * dx + dy * dy < minDistance * minDistance) return;
                    }
                    const dx = x - originX;
                    const dy = y - originY;
                    const distanceSq = dx * dx + dy * dy;
                    if (distanceSq < bestDistanceSq) {
                        bestX = x;
                        bestY = y;
                        bestDistanceSq = distanceSq;
                    }
                };

                for (const tree of nearby) {
                    const radius = playerRadius + tree.blockRadius + 0.1;
                    for (let i = 0; i < 96; i++) {
                        const angle = i * Math.PI * 2 / 96;
                        consider(tree.x + Math.cos(angle) * radius,
                            tree.y + TRUNK_Y + Math.sin(angle) * radius);
                    }
                }
                for (let radius = 2; radius <= 96 && bestX === null; radius += 2) {
                    const count = Math.max(16, Math.ceil(Math.PI * 2 * radius / 3));
                    for (let i = 0; i < count; i++) {
                        const angle = i * Math.PI * 2 / count;
                        consider(originX + Math.cos(angle) * radius,
                            originY + Math.sin(angle) * radius);
                    }
                }
                if (bestX !== null) {
                    player.x = bestX;
                    player.y = bestY;
                }
            }

            // Remove only velocity into a trunk; tangential movement stays smooth.
            for (const tree of nearby) {
                const dx = player.x - tree.x;
                const dy = player.y - (tree.y + TRUNK_Y);
                const distance = Math.hypot(dx, dy);
                if (distance > playerRadius + tree.blockRadius + 0.1 || distance < 0.001) continue;
                const nx = dx / distance;
                const ny = dy / distance;
                const inward = player.vx * nx + player.vy * ny;
                if (inward < 0) {
                    player.vx -= inward * nx;
                    player.vy -= inward * ny;
                }
            }
        };

        const dx = targetX - startX;
        const dy = targetY - startY;
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 10));
        player.x = startX;
        player.y = startY;
        resolveAtCurrentPosition();
        for (let step = 0; step < steps; step++) {
            player.x += dx / steps;
            player.y += dy / steps;
            resolveAtCurrentPosition();
        }
    }
}
