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

    const size = pickPondSize(rng);
    const pondScale = rng.range(0.88, 1.10);
    const pondShapeSeed = rng.int(1, 0x7fffffff);
    const pondDraft = { ...size, scale: pondScale, shapeSeed: pondShapeSeed };
    const pondMinRadius = 132 + maxPondRadius(pondDraft, 'x') + 24;
    let pond = null;
    for (let attempt = 0; attempt < 64; attempt++) {
        // Put the lake in a seeded diagonal sector near the opening area so the whole landmark
        // can be discovered on the first screen without covering the safe spawn patch.
        const diagonal = rng.int(0, 3) * Math.PI / 2 + Math.PI / 4;
        const angle = diagonal + rng.range(-0.12, 0.12);
        const candidate = roundedPoint(angle, rng.range(pondMinRadius, Math.min(470, pondMinRadius + 28)));
        // Keep the bank outside the safe starting patch and away from the landmark grove.
        if (Math.hypot(candidate.x, candidate.y) < pondMinRadius) continue;
        if (Math.hypot(candidate.x - grove.x, candidate.y - grove.y) < 540) continue;
        pond = candidate;
        break;
    }
    if (!pond) {
        // Opposite the grove is always a safe, reachable fallback within the opening viewport.
        pond = roundedPoint(groveAngle + Math.PI, Math.max(320, pondMinRadius + 32));
    }

    return Object.freeze({
        seed: worldSeed,
        pond: Object.freeze({ ...pond, ...size, scale: pondScale, shapeSeed: pondShapeSeed }),
        grove: Object.freeze(grove),
    });
}

export const DEFAULT_WORLD_LAYOUT = createWorldLayout(0);
export const POND = DEFAULT_WORLD_LAYOUT.pond;

export function inPondClearing (x, y, margin = 0, pond = POND) {
    const rx = maxPondRadius(pond, 'x') + margin;
    const ry = maxPondRadius(pond, 'y') + margin;
    const nx = (x - pond.x) / rx;
    const ny = (y - pond.y) / ry;
    return nx * nx + ny * ny < 1;
}
