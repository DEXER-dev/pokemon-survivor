import { makeRng } from './rng.js';

// Landmark clearings are generated once per run and shared by every world pass.
// World coordinates keep props stable while the camera moves.
const TAU = Math.PI * 2;
export const POND_ART_SCALE = 0.60;
const WATER_TILE = 64;
const BANK_WIDTH = 16;
const SHAPE_POINTS = 24;
const POND_SIZES = [
    { columns: 7, rows: 5, weight: 20 },
    { columns: 8, rows: 6, weight: 55 },
    { columns: 9, rows: 7, weight: 25 },
];

function roundedPoint (angle, radius) {
    return {
        x: Math.round(Math.cos(angle) * radius),
        y: Math.round(Math.sin(angle) * radius),
    };
}

function pickPondSize (rng) {
    let roll = rng.int(1, POND_SIZES.reduce((sum, size) => sum + size.weight, 0));
    for (const size of POND_SIZES) {
        roll -= size.weight;
        if (roll <= 0) return size;
    }
    return POND_SIZES[1];
}

function maxPondRadius (pond, axis) {
    const halfWater = (pond[axis === 'x' ? 'columns' : 'rows'] || 4) * WATER_TILE / 2;
    // Include the real 16px bank and a little headroom for the seeded coves.
    return (halfWater + BANK_WIDTH) * 1.16 * POND_ART_SCALE * (pond.scale || 1);
}

/** Seeded irregular basin and water outlines in the supplied sheet's native pixel coordinates. */
export function createPondContours (pond) {
    const rng = makeRng((pond.shapeSeed || 0) >>> 0);
    const columns = pond.columns || 4;
    const rows = pond.rows || 3;
    const waterRx = columns * WATER_TILE / 2;
    const waterRy = rows * WATER_TILE / 2;
    const phase = rng.range(-0.16, 0.16);
    const phase2 = rng.range(-0.42, 0.42);
    const profile = Array.from({ length: SHAPE_POINTS }, () => rng.range(-0.022, 0.022));
    const build = (rx, ry) => Array.from({ length: SHAPE_POINTS }, (_, i) => {
        const angle = phase + i * TAU / SHAPE_POINTS;
        const irregular = 1 + 0.065 * Math.sin(2 * angle + phase2)
            + 0.032 * Math.sin(3 * angle - phase) + profile[i];
        return [Math.cos(angle) * rx * irregular, Math.sin(angle) * ry * irregular];
    });
    const bank = BANK_WIDTH;
    return {
        water: build(waterRx, waterRy),
        outer: build(waterRx + bank, waterRy + bank),
        waterRx,
        waterRy,
        outerRx: waterRx + bank,
        outerRy: waterRy + bank,
    };
}

/** Create reproducible landmarks for one run without consuming the combat RNG stream. */
export function createWorldLayout (seed) {
    const worldSeed = seed >>> 0;
    const rng = makeRng((worldSeed ^ 0xa511e9b3) >>> 0);

    const groveAngle = rng.range(0, TAU);
    const grove = {
        ...roundedPoint(groveAngle, rng.range(500, 580)),
        turn: rng.int(0, 3),
    };

    return Object.freeze({
        seed: worldSeed,
        waterCellSize: 1200,
        grove: Object.freeze(grove),
    });
}

export const DEFAULT_WORLD_LAYOUT = createWorldLayout(0);
const POND_CACHE = new WeakMap();

/** Each region rolls independently of exploration order; remember only a bounded working set. */
export function pondForCell (layout, gx, gy) {
    let cache = POND_CACHE.get(layout);
    if (!cache) { cache = new Map(); POND_CACHE.set(layout, cache); }
    const id = `${gx},${gy}`;
    if (cache.has(id)) return cache.get(id);
    const seed = (layout.seed ^ Math.imul(gx, 0x1e35a7bd)
        ^ Math.imul(gy, 0x94d049bb) ^ 0x65d8a931) >>> 0;
    const rng = makeRng(seed);
    let pond = null;
    if (rng.chance(0.42)) {
        const size = pickPondSize(rng);
        const position = gx === 0 && gy === 0
            ? roundedPoint(rng.range(0, TAU), rng.range(420, 470))
            : { x: gx * layout.waterCellSize + rng.int(-160, 160),
                y: gy * layout.waterCellSize + rng.int(-160, 160) };
        const draft = { id, ...position, ...size, scale: rng.range(0.88, 1.10),
            shapeSeed: rng.int(1, 0x7fffffff) };
        const spawnClearance = 180 + Math.max(maxPondRadius(draft, 'x'), maxPondRadius(draft, 'y'));
        if (Math.hypot(draft.x, draft.y) >= spawnClearance
            && Math.hypot(draft.x - layout.grove.x, draft.y - layout.grove.y) >= 540) {
            pond = Object.freeze(draft);
        }
    }
    if (cache.size >= 256) cache.delete(cache.keys().next().value);
    cache.set(id, pond);
    return pond;
}

/** Include shores whose center lies outside the requested rectangle. No visited-world list needed. */
export function pondsInBounds (layout, bounds, margin = 0) {
    const cell = layout.waterCellSize;
    const padding = 320 + margin;
    const gx0 = Math.floor((bounds.left - padding + cell / 2) / cell);
    const gx1 = Math.floor((bounds.right + padding + cell / 2) / cell);
    const gy0 = Math.floor((bounds.bottom - padding + cell / 2) / cell);
    const gy1 = Math.floor((bounds.top + padding + cell / 2) / cell);
    const ponds = [];
    for (let gx = gx0; gx <= gx1; gx++) {
        for (let gy = gy0; gy <= gy1; gy++) {
            const pond = pondForCell(layout, gx, gy);
            if (!pond) continue;
            const rx = maxPondRadius(pond, 'x') + margin + 60;
            const ry = maxPondRadius(pond, 'y') + margin + 60;
            if (pond.x + rx >= bounds.left && pond.x - rx <= bounds.right
                && pond.y + ry >= bounds.bottom && pond.y - ry <= bounds.top) ponds.push(pond);
        }
    }
    return ponds;
}

export function inPondClearing (x, y, margin = 0, pond = DEFAULT_WORLD_LAYOUT) {
    if (!pond) return false;
    if (pond.waterCellSize) {
        return pondsInBounds(pond, { left: x, right: x, bottom: y, top: y }, margin)
            .some((entry) => inPondClearing(x, y, margin, entry));
    }
    const rx = maxPondRadius(pond, 'x') + margin;
    const ry = maxPondRadius(pond, 'y') + margin;
    const nx = (x - pond.x) / rx;
    const ny = (y - pond.y) / ry;
    return nx * nx + ny * ny < 1;
}
