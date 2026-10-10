import { DEFAULT_WORLD_LAYOUT, inPondClearing } from './world-map-layout.js';

const PATCH_GRID = 260;
const PATCH_JITTER = 30;
const PATCH_VIEW_MARGIN = 140;
const PATCH_COVERAGE = 36;
const SOLO_ACCENT_CHANCE = 5;
const MAX_PLANTS = 300;
const START_CLEARING = 100;
const START_PATCH_COUNT = 6;
const TAU = Math.PI * 2;
const FLORA_FRAME_NAMES = [
    'grass_tuft_01', 'grass_tuft_02', 'grass_tuft_03', 'grass_tuft_04',
    'flowers_cream', 'flowers_yellow', 'flowers_pink', 'flowers_blueviolet',
    'mixed_cream', 'mixed_yellow', 'mixed_pink', 'mixed_blueviolet',
];

// Each silhouette has three loose sub-clumps. Larger patches grow as linked groups
// instead of repeating a single bouquet in a tight pile.
const PATCH_SHAPES = [
    [[-38, 12], [1, -21], [39, 15]],
    [[-36, -14], [31, -20], [-5, 34]],
    [[-42, 1], [7, -31], [38, 18]],
    [[-32, 24], [7, 1], [34, -33]],
];

export function cellHash (x, y, salt = 0) {
    let value = (Math.imul(x | 0, 0x1e35a7bd) + Math.imul(y | 0, 0x94d049bb)
        + Math.imul(salt | 0, 0x85ebca6b)) | 0;
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d);
    value ^= value >>> 15;
    return value >>> 0;
}

function rotateOffset (x, y, turn) {
    if (turn === 1) return { x: y, y: -x };
    if (turn === 2) return { x: -x, y: -y };
    if (turn === 3) return { x: -y, y: x };
    return { x, y };
}

function floraPlacement (x, y, hash, frameIndex, patchScale = 1) {
    // These authored atlas cells are deliberately shown at a larger in-world
    // size so a patch reads as scenery from the normal camera distance.
    const baseSize = frameIndex < 4 ? 68 : frameIndex < 8 ? 60 : 63;
    return {
        x,
        y,
        hash,
        frameIndex,
        size: baseSize + ((hash >>> 12) % 9),
        scale: (0.98 + ((hash >>> 22) % 15) / 100) * patchScale,
    };
}

function patchFrameIndex (kind, palette, hash) {
    const roll = (hash >>> 7) % 100;
    if (kind === 0) {
        // Grassy patches can carry a few flowers, but stay mostly leafy.
        if (roll < 68) return hash % 4;
        if (roll < 82) return 4 + palette;
        return 8 + palette;
    }
    if (kind === 1) {
        // Flowerbeds retain a dominant color, with mixed leafy blossoms for texture.
        if (roll < 58) return 4 + palette;
        if (roll < 91) return 8 + palette;
        return hash % 4;
    }
    // Wildflower patches make all three source families read together.
    if (roll < 34) return hash % 4;
    if (roll < 69) return 4 + palette;
    return 8 + palette;
}

function buildPatchAt (centerX, centerY, hash, layout, forcedKind = null) {
    const kindRoll = (hash >>> 5) % 100;
    const kind = forcedKind === null ? (kindRoll < 30 ? 0 : kindRoll < 73 ? 1 : 2) : forcedKind;
    const palette = (hash >>> 9) % 4;
    // The approved meadow preview uses broad, multi-lobed groups made from the
    // existing 64 px clusters. Keep each group varied while matching that density.
    const count = 14 + ((hash >>> 13) % 3);
    const shape = PATCH_SHAPES[(hash >>> 16) % PATCH_SHAPES.length];
    const turn = (hash >>> 20) & 3;
    const patchScale = 0.94 + ((hash >>> 23) % 15) / 100;

    // Leave room around the initial trainer and companion, rather than cutting holes
    // through patches that happen to straddle the spawn clearing.
    if (Math.hypot(centerX, centerY) < START_CLEARING + 74) return [];
    if (inPondClearing(centerX, centerY, 110, layout)) return [];

    const plants = [];
    for (let index = 0; index < count; index++) {
        const memberHash = cellHash((centerX | 0) * 37 + index * 17,
            (centerY | 0) * 31 - index * 29, hash ^ layout.seed);
        const lobeIndex = (memberHash >>> 19) % shape.length;
        const lobe = rotateOffset(...shape[lobeIndex], turn);
        const jitterX = ((memberHash >>> 4) % 29) - 14;
        const jitterY = ((memberHash >>> 11) % 25) - 12;
        const x = Math.round(centerX + (lobe.x + jitterX) * patchScale);
        const y = Math.round(centerY + (lobe.y + jitterY) * patchScale);
        if (Math.hypot(x, y) < START_CLEARING + 30) continue;
        // A generous edge margin keeps decorative clusters from touching the water art.
        if (inPondClearing(x, y, 36, layout)) continue;
        plants.push(floraPlacement(x, y, memberHash, patchFrameIndex(kind, palette, memberHash), patchScale));
    }
    return plants;
}

function buildPatch (gx, gy, hash, layout) {
    const centerX = gx * PATCH_GRID + ((hash >>> 8) % (PATCH_JITTER * 2 + 1)) - PATCH_JITTER;
    const centerY = gy * PATCH_GRID + ((hash >>> 17) % (PATCH_JITTER * 2 + 1)) - PATCH_JITTER;
    return buildPatchAt(centerX, centerY, hash, layout);
}

function buildStartingPatches (layout) {
    const patches = [];
    const centers = [];
    const angleHash = cellHash(0x5a17, -0x36b1, layout.seed);
    const baseAngle = (angleHash % 6283) / 1000;
    for (let index = 0; index < START_PATCH_COUNT; index++) {
        const hash = cellHash(0x71 + index * 73, -0x319 - index * 37, layout.seed);
        const angleJitter = (((hash >>> 6) % 41) - 20) / 100;
        const radius = 205 + ((hash >>> 14) % 61);
        const angle = baseAngle + index * TAU / START_PATCH_COUNT + angleJitter;
        const centerX = Math.round(Math.cos(angle) * radius);
        const centerY = Math.round(Math.sin(angle) * radius);
        if (inPondClearing(centerX, centerY, 110, layout)) continue;
        if (Math.hypot(centerX - layout.grove.x, centerY - layout.grove.y) < 150) continue;
        const plants = buildPatchAt(centerX, centerY, hash, layout, index % 3);
        if (!plants.length) continue;
        centers.push({ x: centerX, y: centerY });
        patches.push(...plants);
    }
    return { centers, plants: patches };
}

function buildSoloAccent (gx, gy, hash, layout) {
    const x = gx * PATCH_GRID + ((hash >>> 8) % (PATCH_JITTER * 2 + 1)) - PATCH_JITTER;
    const y = gy * PATCH_GRID + ((hash >>> 16) % (PATCH_JITTER * 2 + 1)) - PATCH_JITTER;
    if (Math.hypot(x, y) < START_CLEARING + 30) return null;
    if (inPondClearing(x, y, 36, layout)) return null;
    const roll = (hash >>> 7) % 100;
    const frameIndex = roll < 40 ? hash % 4 : roll < 65 ? 4 + ((hash >>> 12) % 4) : 8 + ((hash >>> 12) % 4);
    return floraPlacement(x, y, hash, frameIndex);
}

/** Seeded, non-blocking flora patches in world space; camera motion never shifts a patch. */
export class WorldFlora {
    constructor (cc, world) {
        this.cc = cc;
        this.root = new cc.Node('FieldFlora');
        this.root.layer = cc.Layers.Enum.UI_2D;
        world.addChild(this.root);
        this.pool = [];
        this.frames = null;
        this.layout = DEFAULT_WORLD_LAYOUT;
        this.planted = [];
        this.visiblePlants = [];
        this._plantSequence = 0;
        this._shooterScratch = [];
    }

    setWorldLayout (layout) {
        this.layout = layout || DEFAULT_WORLD_LAYOUT;
    }

    setFrames (glyphs) {
        const frames = FLORA_FRAME_NAMES.map((name) => glyphs[name] && glyphs[name].frame);
        this.frames = frames.every(Boolean) ? frames : null;
    }

    plant (x, y) {
        if (inPondClearing(x, y, 36, this.layout)) return null;
        const sequence = this._plantSequence++;
        // Reuse the field atlas: alternate meadow grass and its existing mixed flower clumps.
        const frameIndex = sequence % 2 === 0 ? sequence % 4 : 8 + sequence % 4;
        const plant = floraPlacement(Math.round(x), Math.round(y),
            cellHash(x | 0, y | 0, sequence), frameIndex, 0.88);
        if (this.planted.length >= 12) this.planted.shift();
        this.planted.push(plant);
        return plant;
    }

    clearPlanted () {
        this.planted.length = 0;
        this._plantSequence = 0;
    }

    updatePreview (placements) {
        if (!this.frames) {
            this.root.active = false;
            this.visiblePlants.length = 0;
            return;
        }
        this.root.active = true;
        this.visiblePlants = placements;
        this._renderPlacements(placements);
    }

    /** Nearby scenery fires in rotating batches so every plant gets a turn without flooding the projectile pool. */
    firingPlants (x, y, radius, limit = 8, cursor = 0) {
        const result = this._shooterScratch;
        result.length = 0;
        const radius2 = radius * radius;
        let total = 0;
        for (const plant of this.visiblePlants) {
            const dx = plant.x - x;
            const dy = plant.y - y;
            if (dx * dx + dy * dy <= radius2) total++;
        }
        if (!total || limit <= 0) { result.total = total; return result; }
        const start = cursor % total;
        for (let pass = 0; pass < 2 && result.length < Math.min(limit, total); pass++) {
            let eligibleIndex = 0;
            for (const plant of this.visiblePlants) {
                const dx = plant.x - x;
                const dy = plant.y - y;
                if (dx * dx + dy * dy > radius2) continue;
                const index = eligibleIndex++;
                if (pass === 0 ? index < start : index >= start) continue;
                const entry = result[result.length] || (result[result.length] = { x: 0, y: 0 });
                entry.x = plant.x;
                entry.y = plant.y;
                result.length++;
                if (result.length >= Math.min(limit, total)) break;
            }
        }
        result.total = total;
        return result;
    }

    _spawn () {
        const node = new this.cc.Node('FieldPlant');
        node.layer = this.cc.Layers.Enum.UI_2D;
        this.root.addChild(node);
        const sprite = node.addComponent(this.cc.Sprite);
        sprite.sizeMode = this.cc.Sprite.SizeMode.CUSTOM;
        const transform = node.getComponent(this.cc.UITransform);
        transform.anchorX = 0.5;
        transform.anchorY = 0.16;
        this.pool.push({ node, sprite, transform, x: null, y: null, size: null, scale: null, frame: null });
        return this.pool[this.pool.length - 1];
    }

    update (camera, viewWidth, viewHeight, enabled) {
        if (!enabled || !this.frames) {
            if (this.root.active) this.root.active = false;
            this.visiblePlants.length = 0;
            return;
        }
        this.root.active = true;

        const z = Math.max(0.01, camera.z);
        const halfW = Math.max(1280, viewWidth) / (2 * z);
        const halfH = Math.max(720, viewHeight) / (2 * z);
        const x0 = Math.floor((camera.x - halfW - PATCH_VIEW_MARGIN) / PATCH_GRID);
        const x1 = Math.ceil((camera.x + halfW + PATCH_VIEW_MARGIN) / PATCH_GRID);
        const y0 = Math.floor((camera.y - halfH - PATCH_VIEW_MARGIN) / PATCH_GRID);
        const y1 = Math.ceil((camera.y + halfH + PATCH_VIEW_MARGIN) / PATCH_GRID);
        const starting = buildStartingPatches(this.layout);
        const placements = starting.plants.slice(0, MAX_PLANTS);

        for (let gx = x0; gx <= x1 && placements.length < MAX_PLANTS; gx++) {
            for (let gy = y0; gy <= y1 && placements.length < MAX_PLANTS; gy++) {
                const hash = cellHash(gx, gy, this.layout.seed);
                const roll = hash % 100;
                if (roll < PATCH_COVERAGE) {
                    const centerX = gx * PATCH_GRID + ((hash >>> 8) % (PATCH_JITTER * 2 + 1)) - PATCH_JITTER;
                    const centerY = gy * PATCH_GRID + ((hash >>> 17) % (PATCH_JITTER * 2 + 1)) - PATCH_JITTER;
                    if (starting.centers.some((center) => Math.hypot(centerX - center.x, centerY - center.y) < 170)) continue;
                    placements.push(...buildPatch(gx, gy, hash, this.layout));
                } else if (roll < PATCH_COVERAGE + SOLO_ACCENT_CHANCE) {
                    const accent = buildSoloAccent(gx, gy, hash, this.layout);
                    if (accent) placements.push(accent);
                }
            }
        }
        placements.length = Math.min(placements.length, MAX_PLANTS - this.planted.length);
        placements.push(...this.planted);
        this.visiblePlants = placements;

        // Modest camera shifts should not leave partially clipped patch members in the pool.
        const visible = Math.min(placements.length, MAX_PLANTS);
        this._renderPlacements(placements, visible);
    }

    _renderPlacements (placements, count = Math.min(placements.length, MAX_PLANTS)) {
        const visible = count;
        for (let index = 0; index < visible; index++) {
            const placement = placements[index];
            let plant = this.pool[index];
            if (!plant) plant = this._spawn();
            const frame = this.frames[placement.frameIndex];
            if (plant.frame !== frame) {
                plant.sprite.spriteFrame = frame;
                plant.frame = frame;
            }
            if (plant.size !== placement.size) {
                plant.transform.setContentSize(placement.size, placement.size);
                plant.size = placement.size;
            }
            if (plant.scale !== placement.scale) {
                plant.node.setScale(placement.scale, placement.scale, 1);
                plant.scale = placement.scale;
            }
            if (plant.x !== placement.x || plant.y !== placement.y) {
                plant.node.setPosition(placement.x, placement.y, 0);
                plant.x = placement.x;
                plant.y = placement.y;
            }
            if (!plant.node.active) plant.node.active = true;
        }

        for (let index = visible; index < this.pool.length; index++) {
            if (this.pool[index].node.active) this.pool[index].node.active = false;
        }
    }
}
