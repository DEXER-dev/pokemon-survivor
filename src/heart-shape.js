/** Normalized heart outline shared by targeting, hit tests, and the compact skill HUD diagram. */
export const HEART_POINTS = Object.freeze(Array.from({ length: 64 }, (_, i) => {
    const t = Math.PI * 2 * i / 64;
    const s = Math.sin(t);
    const y = (13 * Math.cos(t) - 5 * Math.cos(2 * t)
        - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17;
    return Object.freeze([s * s * s, y]);
}));

export function traceHeart (graphics, cx, cy, rx, ry) {
    for (let i = 0; i < HEART_POINTS.length; i++) {
        const [x, y] = HEART_POINTS[i];
        if (i === 0) graphics.moveTo(cx + x * rx, cy + y * ry);
        else graphics.lineTo(cx + x * rx, cy + y * ry);
    }
    graphics.lineTo(cx + HEART_POINTS[0][0] * rx, cy + HEART_POINTS[0][1] * ry);
}

export function pointInHeart (x, y, rx, ry) {
    if (!(rx > 0 && ry > 0)) return false;
    const nx = x / rx;
    const ny = y / ry;
    let inside = false;
    for (let i = 0, j = HEART_POINTS.length - 1; i < HEART_POINTS.length; j = i++) {
        const [xi, yi] = HEART_POINTS[i];
        const [xj, yj] = HEART_POINTS[j];
        if ((yi > ny) !== (yj > ny)
            && nx < (xj - xi) * (ny - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}
