import { cellHash } from './world-flora.js';
import { POND_ART_SCALE, inPondClearing } from './world-map-layout.js';

const PATCH_GRID = 340;
const PATCH_MARGIN = 180;
const TAU = Math.PI * 2;
const PATCH_COLORS = [
    { color: '#c6d79d', alpha: 142 },
    { color: '#f1e8c5', alpha: 154 },
    { color: '#d0dfae', alpha: 126 },
    { color: '#e9edcf', alpha: 170 },
];

function unit (x, y, seed, salt) {
    return cellHash(x, y, seed ^ salt) / 0x100000000;
}

function makePatch (gx, gy, layout) {
    const hash = cellHash(gx, gy, (layout.seed ^ 0x6d2b79f5) | 0);
    if (hash % 100 >= 47) return null;

    const centerX = gx * PATCH_GRID + ((hash >>> 7) % 181) - 90;
    const centerY = gy * PATCH_GRID + ((hash >>> 16) % 151) - 75;
    const rx = 88 + ((hash >>> 11) % 60);
    const ry = 56 + ((hash >>> 21) % 42);

    // Keep the immediate spawn area calm, and never paint over the lake's bank.
    if (Math.hypot(centerX, centerY) < 155) return null;
    if (inPondClearing(centerX, centerY, Math.max(rx, ry) * 0.8 + 24, layout)) return null;

    const count = 12 + ((hash >>> 25) % 5);
    const phase = unit(gx, gy, layout.seed, 0x49a42c1d) * TAU;
    const points = [];
    for (let i = 0; i < count; i++) {
        const angle = phase + i * TAU / count;
        const variation = 0.83 + unit(gx + i * 17, gy - i * 29, layout.seed, hash) * 0.29
            + Math.sin(angle * 3 + (hash % 9)) * 0.05;
        points.push({
            x: centerX + Math.cos(angle) * rx * variation,
            y: centerY + Math.sin(angle) * ry * variation,
        });
    }
    return { gx, gy, hash, centerX, centerY, rx, ry, points, color: PATCH_COLORS[(hash >>> 3) % PATCH_COLORS.length] };
}

function screenPoint (point, camera, zoom) {
    return { x: (point.x - camera.x) * zoom, y: (point.y - camera.y) * zoom };
}

function fillPatch (g, patch, camera, zoom, palette) {
    const points = patch.points.map((point) => screenPoint(point, camera, zoom));
    const first = points[0], last = points[points.length - 1];
    g.moveTo((first.x + last.x) / 2, (first.y + last.y) / 2);
    for (let i = 0; i < points.length; i++) {
        const point = points[i], next = points[(i + 1) % points.length];
        g.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
    }
    g.close();
    g.fillColor = palette.get(patch.color.color, patch.color.alpha);
    g.fill();

    // A few small grouped pixels give the ground a game-art texture without filling
    // the whole view with grass scratches or noisy single-pixel specks.
    const pale = [], deep = [];
    const accents = 5 + ((patch.hash >>> 10) % 3);
    for (let i = 0; i < accents; i++) {
        const px = patch.centerX + (unit(patch.gx + i * 31, patch.gy, patch.hash, 0x6a09e667) * 2 - 1) * patch.rx * 0.63;
        const py = patch.centerY + (unit(patch.gx, patch.gy + i * 23, patch.hash, 0xbb67ae85) * 2 - 1) * patch.ry * 0.63;
        const x = (px - camera.x) * zoom, y = (py - camera.y) * zoom;
        const w = (8 + ((patch.hash >>> (i % 16)) % 8)) * zoom;
        const h = (4 + ((patch.hash >>> ((i + 7) % 16)) % 4)) * zoom;
        const group = i % 3 === 0 ? pale : deep;
        group.push([x, y, w, h], [x + w * 0.36, y + h, w * 0.48, h * 0.72]);
        if (i % 2 === 0) group.push([x + w * 0.72, y - h * 0.55, w * 0.25, h * 0.55]);
    }
    for (const [rects, color, alpha] of [
        [pale, '#fff5d3', 54],
        [deep, '#849b62', 42],
    ]) {
        if (!rects.length) continue;
        g.fillColor = palette.get(color, alpha);
        for (const [x, y, w, h] of rects) g.rect(x, y, w, h);
        g.fill();
    }
}

function fillPondMoisture (g, camera, zoom, layout, geometry, palette) {
    if (!geometry || !geometry.outer || !layout.pond) return;
    const pond = layout.pond;
    const artScale = POND_ART_SCALE * (Number.isFinite(pond.scale) ? pond.scale : 1);
    const drawExpandedBank = (margin, color, alpha) => {
        const points = geometry.outer.map(([x, y]) => {
            const length = Math.hypot(x, y) || 1;
            const wx = pond.x + (x + x / length * margin / artScale) * artScale;
            const wy = pond.y + (y + y / length * margin / artScale) * artScale;
            return screenPoint({ x: wx, y: wy }, camera, zoom);
        });
        const first = points[0], last = points[points.length - 1];
        g.moveTo((first.x + last.x) / 2, (first.y + last.y) / 2);
        for (let i = 0; i < points.length; i++) {
            const point = points[i], next = points[(i + 1) % points.length];
            g.quadraticCurveTo(point.x, point.y, (point.x + next.x) / 2, (point.y + next.y) / 2);
        }
        g.close();
        g.fillColor = palette.get(color, alpha);
        g.fill();
    };
    // The lake sprite covers the center; the two soft outer bands remain as a
    // moisture transition that follows the actual seeded shoreline contour.
    drawExpandedBank(44, '#a9cbb0', 28);
    drawExpandedBank(22, '#9fc4a7', 22);
}

/** Draw deterministic, non-blocking ground color and texture in screen space. */
export function drawWorldGround (g, camera, zoom, bounds, layout, palette, treeRoots, pondGeometry, pondEnabled = true) {
    const gx0 = Math.floor((bounds.left - PATCH_MARGIN) / PATCH_GRID);
    const gx1 = Math.ceil((bounds.right + PATCH_MARGIN) / PATCH_GRID);
    const gy0 = Math.floor((bounds.bottom - PATCH_MARGIN) / PATCH_GRID);
    const gy1 = Math.ceil((bounds.top + PATCH_MARGIN) / PATCH_GRID);
    for (let gx = gx0; gx <= gx1; gx++) {
        for (let gy = gy0; gy <= gy1; gy++) {
            const patch = makePatch(gx, gy, layout);
            if (patch) fillPatch(g, patch, camera, zoom, palette);
        }
    }

    // Existing tree positions are the source of shade marks, so they move with the
    // same world seed and camera as the actual trees. The marks are broad and faint.
    g.fillColor = palette.get('#718458', 24);
    for (const tree of treeRoots || []) {
        if ((tree.hash >>> 3) % 3 !== 0) continue;
        const shade = screenPoint({ x: tree.x + 16, y: tree.y - 13 }, camera, zoom);
        const scale = tree.forest ? 1.08 : 0.9;
        g.ellipse(shade.x, shade.y, 38 * scale * zoom, 15 * scale * zoom);
    }
    if (treeRoots && treeRoots.length) g.fill();

    if (pondEnabled) {
        for (const basin of pondGeometry || []) {
            fillPondMoisture(g, camera, zoom, { pond: basin.pond }, basin.geometry, palette);
        }
    }
}
