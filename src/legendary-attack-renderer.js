import { lugiaImpactAreas } from './lugia-attacks.js';

const corners = (shape) => {
    const ux = Math.cos(shape.angle);
    const uy = Math.sin(shape.angle);
    const nx = -uy;
    const ny = ux;
    const hx = shape.length * 0.5;
    const hy = shape.width * 0.5;
    return [
        [shape.x - ux * hx - nx * hy, shape.y - uy * hx - ny * hy],
        [shape.x + ux * hx - nx * hy, shape.y + uy * hx - ny * hy],
        [shape.x + ux * hx + nx * hy, shape.y + uy * hx + ny * hy],
        [shape.x - ux * hx + nx * hy, shape.y - uy * hx + ny * hy],
    ];
};

function drawCircle (g, shape, fillColor, edgeColor, lineWidth) {
    g.fillColor = fillColor;
    g.circle(shape.x, shape.y, shape.radius);
    g.fill();
    g.strokeColor = edgeColor;
    g.lineWidth = lineWidth;
    g.circle(shape.x, shape.y, shape.radius);
    g.stroke();
}

function drawRect (g, shape, fillColor, edgeColor, lineWidth) {
    const points = corners(shape);
    g.fillColor = fillColor;
    g.moveTo(...points[0]);
    for (let i = 1; i < points.length; i++) g.lineTo(...points[i]);
    g.close();
    g.fill();
    g.strokeColor = edgeColor;
    g.lineWidth = lineWidth;
    g.moveTo(...points[0]);
    for (let i = 1; i < points.length; i++) g.lineTo(...points[i]);
    g.close();
    g.stroke();

    // A few broad directional cuts make each lane read as an incoming sweep, not a targeting grid.
    g.strokeColor = edgeColor;
    g.lineWidth = Math.max(2, lineWidth * 0.6);
    for (const t of [-0.28, 0, 0.28]) {
        const cx = shape.x + Math.cos(shape.angle) * shape.length * t;
        const cy = shape.y + Math.sin(shape.angle) * shape.length * t;
        const nx = -Math.sin(shape.angle);
        const ny = Math.cos(shape.angle);
        g.moveTo(cx - Math.cos(shape.angle) * 9 - nx * 8, cy - Math.sin(shape.angle) * 9 - ny * 8);
        g.lineTo(cx, cy);
        g.lineTo(cx - Math.cos(shape.angle) * 9 + nx * 8, cy - Math.sin(shape.angle) * 9 + ny * 8);
    }
    g.stroke();
}

/** Draws the exact union of collision areas and the safe corridor for one boss attack. */
export function drawLegendaryAttackPattern (g, attack, pal, pulse, impact) {
    const familyColor = attack.color || '#ef5362';
    const fill = pal.get(familyColor, impact ? 118 : Math.round(42 + 25 * pulse));
    const edge = pal.get(impact ? '#fff0c2' : familyColor, impact ? 255 : Math.round(185 + 55 * pulse));
    const lineWidth = impact ? 6 : 4;
    const areas = impact && attack.family === 'legend-lugia'
        ? lugiaImpactAreas(attack, attack.impactDuration - Math.max(0, attack.timeLeft)) : attack.areas || [];
    for (const shape of areas) {
        // Lugia's moving bolts have their own wind sprites. Collision rectangles are
        // invisible during flight; outlining them turns each bolt into a boxed arrow.
        if (impact && attack.family === 'legend-lugia' && shape.shape === 'rect') continue;
        if (shape.telegraph === 'meteor-column') {
            drawRect(g, shape, pal.get('#39c985', impact ? 74 : 25),
                pal.get(impact ? '#eafff0' : '#6bf0a8', impact ? 245 : 185), lineWidth);
        } else if (shape.shape === 'ring') {
            g.strokeColor = fill;
            g.lineWidth = shape.radius - shape.innerRadius;
            g.circle(shape.x, shape.y, (shape.radius + shape.innerRadius) / 2);
            g.stroke();
            g.strokeColor = edge;
            g.lineWidth = lineWidth;
            g.circle(shape.x, shape.y, shape.radius);
            g.stroke();
            g.circle(shape.x, shape.y, shape.innerRadius);
            g.stroke();
        } else if (shape.shape === 'circle') drawCircle(g, shape, fill, edge, lineWidth);
        else if (attack.family === 'legend-lugia') {
            const progress = Math.max(0, Math.min(1, 1 - attack.timeLeft / attack.windupDuration));
            // Later volleys stay visible but quieter, making the attack order readable.
            const later = (shape.delay || 0) > 0;
            drawRect(g, shape, pal.get('#72def2', (later ? 14 : 22) + progress * 22),
                pal.get(later ? '#6da5bc' : '#b5f4ff', (later ? 85 : 140) + progress * 65), 2);
        } else drawRect(g, shape, fill, edge, lineWidth);
    }
    for (const shape of attack.safeAreas || []) {
        if (shape.shape === 'circle') drawCircle(g, shape, pal.get('#42f2e7', impact ? 74 : 30),
            pal.get('#eaffff', impact ? 230 : 150), impact ? 5 : 3);
        else drawRect(g, shape, pal.get('#42f2e7', impact ? 196 : 225),
            pal.get('#eaffff', 255), impact ? 5 : 4);
    }
    for (const marker of attack.markers || []) {
        g.strokeColor = pal.get('#fff0c2', impact ? 250 : 225);
        g.lineWidth = impact ? 5 : 4;
        g.circle(marker.x, marker.y, marker.radius);
        g.stroke();
        g.fillColor = pal.get(familyColor, impact ? 210 : 165);
        g.circle(marker.x, marker.y, marker.radius * 0.42);
        g.fill();
    }
}
