const GUIDE_STYLES = Object.freeze({
    'legend-mewtwo': { name: '超梦', color: [191, 139, 255], glyph: 'psychic' },
    'legend-lugia': { name: '洛奇亚', color: [116, 224, 255], glyph: 'wings' },
    'legend-hooh': { name: '凤王', color: [255, 132, 77], glyph: 'feather' },
    'legend-rayquaza': { name: '烈空坐', color: [130, 229, 113], glyph: 'coil' },
    'legend-kyogre': { name: '盖欧卡', color: [82, 172, 255], glyph: 'whale' },
    'legend-groudon': { name: '固拉多', color: [255, 105, 85], glyph: 'claw' },
    'legend-dialga': { name: '帝牙卢卡', color: [112, 202, 255], glyph: 'time' },
    'legend-palkia': { name: '帕路奇亚', color: [216, 145, 255], glyph: 'space' },
    'legend-arceus': { name: '阿尔宙斯', color: [255, 225, 142], glyph: 'halo' },
});

const PALE = [255, 247, 222];
const DARK = [29, 23, 43];

export function legendaryGuideStyle (species) {
    return GUIDE_STYLES[species] || null;
}

function color (cc, rgb, alpha = 255) {
    return new cc.Color(rgb[0], rgb[1], rgb[2], alpha);
}

function polygon (g, cc, points, fill, outline, width = 1.2) {
    g.fillColor = color(cc, fill);
    g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
    g.close();
    g.fill();
    if (!outline) return;
    g.strokeColor = color(cc, outline);
    g.lineWidth = width;
    g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
    g.close();
    g.stroke();
}

function line (g, cc, points, tint, width = 1.5) {
    g.strokeColor = color(cc, tint);
    g.lineWidth = width;
    g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
    g.stroke();
}

function circle (g, cc, x, y, radius, fill, outline = null, width = 1) {
    if (fill) {
        g.fillColor = color(cc, fill);
        g.circle(x, y, radius);
        g.fill();
    }
    if (outline) {
        g.strokeColor = color(cc, outline);
        g.lineWidth = width;
        g.circle(x, y, radius);
        g.stroke();
    }
}

function drawPsychic (g, cc, accent) {
    polygon(g, cc, [[0, 9], [7, 0], [0, -9], [-7, 0]], accent, PALE, 1.1);
    circle(g, cc, 0, 0, 2.5, PALE);
    line(g, cc, [[-11, 5], [-8, 7], [-6, 5]], PALE, 1.4);
    line(g, cc, [[11, 5], [8, 7], [6, 5]], PALE, 1.4);
    circle(g, cc, -9, -6, 1.3, accent);
    circle(g, cc, 9, -6, 1.3, accent);
}

function drawWings (g, cc, accent) {
    polygon(g, cc, [[-2, 5], [-7, 9], [-13, 5], [-8, 4], [-12, 1], [-5, 2], [0, -1]], accent, PALE, 1.1);
    polygon(g, cc, [[2, 5], [7, 9], [13, 5], [8, 4], [12, 1], [5, 2], [0, -1]], accent, PALE, 1.1);
    polygon(g, cc, [[0, 8], [3, 1], [2, -5], [0, -9], [-2, -5], [-3, 1]], PALE, accent, 1.1);
    line(g, cc, [[-8, 4], [-3, 2], [-1, 1]], [30, 91, 126], 1);
    line(g, cc, [[8, 4], [3, 2], [1, 1]], [30, 91, 126], 1);
}

function drawFeathers (g, cc, accent) {
    polygon(g, cc, [[0, 10], [4, 4], [2, 0], [0, -9], [-2, 0], [-4, 4]], accent, PALE, 1.1);
    polygon(g, cc, [[-3, 3], [-9, 8], [-12, 6], [-10, 2], [-5, -2]], [255, 183, 73], PALE, 1);
    polygon(g, cc, [[3, 3], [9, 8], [12, 6], [10, 2], [5, -2]], [255, 183, 73], PALE, 1);
    line(g, cc, [[-5, -3], [-8, -8], [-2, -6]], [255, 105, 81], 1.5);
    line(g, cc, [[5, -3], [8, -8], [2, -6]], [255, 105, 81], 1.5);
}

function drawCoil (g, cc, accent) {
    circle(g, cc, -1, 0, 8.5, null, accent, 4);
    circle(g, cc, -1, 0, 4, DARK);
    polygon(g, cc, [[3, 6], [8, 10], [12, 9], [9, 5], [6, 3]], accent, PALE, 1);
    circle(g, cc, 8, 7, 1.15, PALE);
    line(g, cc, [[-7, -6], [-4, -8], [-2, -7]], [197, 255, 137], 1.2);
    line(g, cc, [[-1, -8], [2, -10], [4, -8]], [197, 255, 137], 1.2);
}

function drawWhale (g, cc, accent) {
    polygon(g, cc, [[-12, 3], [-7, 7], [-1, 8], [7, 5], [12, 2], [8, -5], [2, -8], [-5, -7], [-10, -3]], accent, PALE, 1.1);
    polygon(g, cc, [[-9, 0], [-13, -4], [-7, -4], [-4, -2]], [38, 114, 219], PALE, 0.9);
    polygon(g, cc, [[8, 1], [13, -2], [10, 4]], [38, 114, 219], PALE, 0.9);
    line(g, cc, [[-5, -4], [0, -1], [6, -2]], [176, 237, 255], 1.4);
    circle(g, cc, 7, 3, 1, PALE);
    circle(g, cc, -8, 10, 1.25, [176, 237, 255]);
    circle(g, cc, -4, 12, 1, PALE);
}

function drawClaw (g, cc, accent) {
    polygon(g, cc, [[-9, 5], [-5, 9], [1, 7], [5, 9], [10, 5], [8, -2], [4, -6], [0, -9], [-4, -5], [-8, -2]], accent, PALE, 1.1);
    polygon(g, cc, [[-6, 3], [-4, -5], [-1, -1], [-1, 5]], PALE, [136, 55, 47], 0.8);
    polygon(g, cc, [[-1, 5], [1, -6], [4, -2], [3, 6]], PALE, [136, 55, 47], 0.8);
    polygon(g, cc, [[4, 4], [7, -3], [9, 1], [7, 7]], PALE, [136, 55, 47], 0.8);
    line(g, cc, [[-5, 9], [-2, 7], [0, 8], [3, 6]], [255, 196, 128], 1);
}

function drawTime (g, cc, accent) {
    polygon(g, cc, [[0, 11], [8, 3], [7, -5], [0, -10], [-7, -5], [-8, 3]], accent, PALE, 1.1);
    polygon(g, cc, [[0, 7], [4, 2], [3, -4], [0, -7], [-3, -4], [-4, 2]], [37, 92, 166], [188, 239, 255], 1);
    line(g, cc, [[0, 8], [0, 1], [4, -2]], [255, 239, 184], 1.5);
    line(g, cc, [[-10, 2], [-7, 2]], PALE, 1);
    line(g, cc, [[10, 2], [7, 2]], PALE, 1);
}

function drawSpace (g, cc, accent) {
    polygon(g, cc, [[0, 11], [3, 3], [11, 0], [3, -3], [0, -11], [-3, -3], [-11, 0], [-3, 3]], accent, PALE, 1.1);
    circle(g, cc, 0, 0, 3.1, PALE, [94, 54, 140], 0.8);
    circle(g, cc, -9, 8, 1.2, [255, 225, 142]);
    circle(g, cc, 9, -8, 1.2, [255, 225, 142]);
    line(g, cc, [[-8, -7], [-5, -10], [-2, -9]], [242, 209, 255], 1);
}

function drawHalo (g, cc, accent) {
    circle(g, cc, 0, 0, 8.5, null, accent, 2.1);
    for (const [x, y] of [[0, 12], [12, 0], [0, -12], [-12, 0]]) {
        line(g, cc, [[x * 0.68, y * 0.68], [x, y]], PALE, 1.6);
    }
    polygon(g, cc, [[0, 6], [5, 0], [0, -6], [-5, 0]], PALE, accent, 1);
    circle(g, cc, 0, 0, 1.6, [121, 195, 166]);
}

const GLYPH_DRAWERS = {
    psychic: drawPsychic,
    wings: drawWings,
    feather: drawFeathers,
    coil: drawCoil,
    whale: drawWhale,
    claw: drawClaw,
    time: drawTime,
    space: drawSpace,
    halo: drawHalo,
};

/** Draw a consistent navigation medallion with an upright species mark and a live direction needle. */
export function drawLegendaryGuideIcon (g, cc, site, x, y, angle, time, inside) {
    const style = legendaryGuideStyle(site.species);
    const fallback = [255, 209, 109];
    const accent = style ? style.color : fallback;
    const pulse = 0.5 + 0.5 * Math.sin(time * 4 + site.number * 1.7);
    const setPosition = (points) => points.map(([px, py]) => [x + px, y + py]);

    g.strokeColor = color(cc, accent, Math.round(92 + pulse * 110));
    g.lineWidth = 1.8;
    g.circle(x, y, (inside ? 21.5 : 20.5) + pulse * 1.7);
    g.stroke();

    circle(g, cc, x, y, 17, DARK, [255, 218, 140], 2);
    circle(g, cc, x, y, 14, [48, 39, 65], accent, 1.1);

    const drawGlyph = GLYPH_DRAWERS[style && style.glyph];
    if (drawGlyph) {
        // Glyph drawers use local coordinates so every emblem stays upright while the needle turns.
        const proxy = {
            get fillColor () { return g.fillColor; },
            set fillColor (v) { g.fillColor = v; },
            get strokeColor () { return g.strokeColor; },
            set strokeColor (v) { g.strokeColor = v; },
            get lineWidth () { return g.lineWidth; },
            set lineWidth (v) { g.lineWidth = v; },
            moveTo (px, py) { g.moveTo(x + px, y + py); },
            lineTo (px, py) { g.lineTo(x + px, y + py); },
            close () { g.close(); },
            fill () { g.fill(); },
            stroke () { g.stroke(); },
            circle (cx, cy, r) { g.circle(x + cx, y + cy, r); },
        };
        drawGlyph(proxy, cc, accent);
    }

    // The needle is outside the portrait window, so its rotation never distorts the Pokémon mark.
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const px = -uy;
    const py = ux;
    const tip = 23;
    const base = 16.2;
    const wing = 4.2;
    polygon(g, cc, setPosition([
        [ux * tip, uy * tip],
        [ux * base + px * wing, uy * base + py * wing],
        [ux * base - px * wing, uy * base - py * wing],
    ]), PALE, [38, 28, 48], 1.2);
}
