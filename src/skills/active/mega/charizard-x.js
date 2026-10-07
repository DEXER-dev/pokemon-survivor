import { MAX_BODY_R } from '../../../config.js';
import { lateDamageMultiplier, segDps } from '../../../combat.js';

export const MEGA_FORM = {
    id: 'charizard-x', fam: 'lizard', label: '喷火龙X进化石', megaName: '超级喷火龙X',
    icon: 'CHARIZARD_1', stone: 'CHARIZARDITEX', color: '#55d9f5', glyph: 'claw',
    shots: 5, spread: 0.32, volleyPower: 2.5, cooldown: 3.2,
};
export const SIGNATURE = Object.freeze({ orbit: 4, radius: 29, spin: 2.7, trails: 4, lance: 0.72 });

/**
 * The aim point is the center of two screen-spanning flame cuts. Width is the half-width of each
 * tapered ribbon in world pixels; the same width and layout drive both collision and rendering.
 */
export const CHARIZARD_X_SKILL = Object.freeze({
    name: '苍焰十字', shape: 'charizard-x-cross', range: 760, halfWidth: 22,
    radius: 22, power: 9.0, cooldown: 14, impactDelay: 0.42, effectDuration: 1.38,
});

export default CHARIZARD_X_SKILL;

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

/** Calculate the two diagonal cuts against the current camera viewport (all values are world-space). */
export function charizardXCrossLayout (game, x, y, halfWidth = CHARIZARD_X_SKILL.halfWidth) {
    let visible = game.visibleSize || game.viewSize || null;
    if (!visible && typeof cc !== 'undefined' && cc.view) visible = cc.view.getVisibleSize();
    const zoom = Math.max(0.01, game.cam?.z || 1);
    const halfViewW = (visible?.width || 1280) / (2 * zoom);
    const halfViewH = (visible?.height || 720) / (2 * zoom);
    const camX = game.cam?.x ?? game.player?.x ?? x;
    const camY = game.cam?.y ?? game.player?.y ?? y;
    const bounds = {
        left: camX - halfViewW, right: camX + halfViewW,
        bottom: camY - halfViewH, top: camY + halfViewH,
    };
    const diagonal = Math.atan2(halfViewH, halfViewW);
    const rayLength = (angle, sign) => {
        const dx = Math.cos(angle) * sign;
        const dy = Math.sin(angle) * sign;
        const hits = [];
        if (dx > 1e-8) hits.push((bounds.right - x) / dx);
        else if (dx < -1e-8) hits.push((bounds.left - x) / dx);
        if (dy > 1e-8) hits.push((bounds.top - y) / dy);
        else if (dy < -1e-8) hits.push((bounds.bottom - y) / dy);
        const forward = hits.filter((distance) => distance >= 0);
        return Math.max(0, Math.min(...(forward.length ? forward : [0])) + 7);
    };
    const axes = [diagonal, -diagonal].map((angle) => ({
        angle,
        ux: Math.cos(angle), uy: Math.sin(angle),
        negative: rayLength(angle, -1), positive: rayLength(angle, 1),
    }));
    return { x, y, halfWidth, bounds, axes };
}

/** Hit each enemy at most once against the two tapered ribbons visible to the player. */
export function hitCharizardXCross (enemies, layout, damage) {
    const maxReach = Math.max(...layout.axes.flatMap((axis) => [axis.negative, axis.positive]));
    const candidates = enemies.grid.query(layout.x, layout.y, maxReach + MAX_BODY_R, enemies._q);
    let hits = 0;
    let kills = 0;
    for (const i of candidates) {
        if (enemies.dead[i]) continue;
        const dx = enemies.x[i] - layout.x;
        const dy = enemies.y[i] - layout.y;
        let inside = false;
        for (const axis of layout.axes) {
            const along = dx * axis.ux + dy * axis.uy;
            const across = Math.abs(-dx * axis.uy + dy * axis.ux);
            const low = -axis.negative;
            const high = axis.positive;
            const nearest = clamp(along, low, high);
            const reach = nearest < 0 ? axis.negative : axis.positive;
            const q = reach > 0 ? Math.abs(nearest) / reach : 1;
            // The tip tapers to a fine point just like the visual ribbon.
            const stripHalf = layout.halfWidth * Math.pow(Math.max(0.002, 1 - q * q), 0.42);
            const outsideAcross = Math.max(0, across - stripHalf);
            const outsideAlong = along - nearest;
            if (outsideAcross * outsideAcross + outsideAlong * outsideAlong
                <= enemies.r[i] * enemies.r[i]) {
                inside = true;
                break;
            }
        }
        if (!inside) continue;
        const before = enemies.hp[i];
        const defeated = enemies.hurt(i, damage);
        if (enemies.hp[i] < before) hits++;
        if (defeated) kills++;
    }
    return { hits, kills };
}

/** Resolve the aimed X once; the long-lived visual is only a renderer effect, never a second hit. */
export function cast (game, seg, form, skill, targetX, targetY) {
    const layout = charizardXCrossLayout(game, targetX, targetY, skill.halfWidth);
    seg.megaSkillCd = skill.cooldown;
    game.megaSkillFx(form, targetX, targetY, skill.halfWidth,
        { shape: skill.shape, duration: skill.effectDuration, width: skill.halfWidth, layout,
            sourceSegment: seg });
    seg.megaSkillActive = skill.effectDuration;
    seg.megaSkillElapsed = 0;
    seg.charizardXCrossLayout = layout;
    seg.charizardXCrossResolved = false;
    game.logEvent('mega.skill-used', {
        form: form.id, species: seg.fam, skill: skill.name,
        x: Math.round(targetX), y: Math.round(targetY),
        shape: skill.shape, width: skill.halfWidth, axes: layout.axes.length,
        impactDelay: skill.impactDelay,
    });
    game.say(`喷火龙 X 升空蓄势 · 拖动可选「${skill.name}」落点`, 2.8);
    return true;
}

/** Keep the Mega sprite grounded for input/collision while its drawn pose lifts, grows, and lands. */
export function charizardXFlightPose (fx) {
    if (!fx || fx.shape !== 'charizard-x-cross' || !(fx.duration > 0)) {
        return { amount: 0, lift: 0, scale: 1 };
    }
    const progress = clamp(fx.age / fx.duration, 0, 1);
    const rise = 1 - Math.pow(1 - clamp(progress / 0.30, 0, 1), 3);
    const settle = 1 - Math.pow(1 - clamp((progress - 0.62) / 0.30, 0, 1), 3);
    const amount = rise * (1 - settle);
    return { amount, lift: 158 * amount, scale: 1 + 1.55 * amount };
}

/** The fire crosses on the peak of the leap, with damage resolved once on that impact beat. */
export function step (game, seg, dt, form, skill) {
    if (!(seg.megaSkillActive > 0)) return;
    const elapsed = (seg.megaSkillElapsed || 0) + dt;
    seg.megaSkillElapsed = elapsed;
    seg.megaSkillActive = Math.max(0, skill.effectDuration - elapsed);
    if (!seg.charizardXCrossResolved && elapsed + 1e-8 >= skill.impactDelay) {
        const layout = seg.charizardXCrossLayout;
        const damage = segDps(seg) * game.build.dmg * lateDamageMultiplier(game.level) * skill.power;
        const result = hitCharizardXCross(game.enemies, layout, damage);
        seg.charizardXCrossResolved = true;
        game.kick(0.24);
        game.logEvent('mega.skill-impact', {
            form: form.id, species: seg.fam, skill: skill.name,
            x: Math.round(layout.x), y: Math.round(layout.y),
            shape: skill.shape, width: skill.halfWidth, hits: result.hits, kills: result.kills,
        });
        game.say(result.hits
            ? `苍焰十字命中 ${result.hits} 只 · 蓝焰横贯战场`
            : '苍焰十字斩过战场', 2.1);
    }
    if (!(seg.megaSkillActive > 0)) {
        seg.charizardXCrossLayout = null;
        seg.charizardXCrossResolved = false;
        seg.megaSkillElapsed = 0;
    }
}

function ribbonPolygon (axis, layout, scale, phase, wall, pad = 0) {
    const points = [];
    const steps = 48;
    const edge = (q, side) => {
        const reach = q < 0 ? axis.negative : axis.positive;
        const along = q * reach;
        const envelope = Math.pow(Math.max(0.002, 1 - q * q), 0.42);
        const pulse = 1 + 0.085 * Math.sin(q * 16 - wall * 5.2 + phase)
            + 0.04 * Math.sin(q * 31 + wall * 4.7 + phase * 1.8);
        const width = Math.max(0.5, layout.halfWidth * scale * envelope * pulse + pad * envelope);
        const flow = Math.sin(q * 12 + wall * 4.2 + phase) * layout.halfWidth * 0.045
            * Math.sin(Math.PI * (1 - Math.abs(q)));
        const x = layout.x + axis.ux * along - axis.uy * (flow + side * width);
        const y = layout.y + axis.uy * along + axis.ux * (flow + side * width);
        return [x, y];
    };
    for (let i = 0; i <= steps; i++) points.push(edge(-1 + 2 * i / steps, 1));
    for (let i = steps; i >= 0; i--) points.push(edge(-1 + 2 * i / steps, -1));
    return points;
}

function fillRibbon (game, g, axis, layout, scale, phase, color, alpha, pad = 0) {
    const points = ribbonPolygon(axis, layout, scale, phase, game.wall || 0, pad);
    g.fillColor = game.pal.get(color, Math.round(alpha));
    g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
    g.close();
    g.fill();
}

function fillFlamePolygon (game, g, points, color, alpha) {
    if (alpha <= 0.5) return;
    g.fillColor = game.pal.get(color, Math.round(alpha));
    g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
    g.close();
    g.fill();
}

/** Thin layered ribbons retain the preview's deep-blue edges, cyan flame and white-hot center. */
function drawFlameAxis (game, g, axis, layout, alpha, phase) {
    fillRibbon(game, g, axis, layout, 1.0, phase, '#064f73', alpha * 0.68, 3.2);
    fillRibbon(game, g, axis, layout, 0.88, phase + 0.8, '#087fae', alpha * 0.93, 1.4);
    fillRibbon(game, g, axis, layout, 0.66, phase + 1.7, '#20c9ed', alpha * 0.94);
    fillRibbon(game, g, axis, layout, 0.40, phase + 2.6, '#70edff', alpha * 0.88);
    fillRibbon(game, g, axis, layout, 0.15, phase + 3.4, '#e5ffff', alpha * 0.90);
}

/** Small wings and a rising flame wake make the actual Mega sprite visibly take off before the X. */
function drawCharizardFlight (game, g, fx) {
    if (!fx.sourceSegment) return;
    const pose = charizardXFlightPose(fx);
    if (pose.amount < 0.025) return;
    const origin = typeof game.skillOrigin === 'function'
        ? game.skillOrigin(fx.sourceSegment) : { x: fx.x, y: fx.y };
    const x = origin.x;
    const ground = origin.y + 12;
    const y = origin.y + pose.lift;
    const strength = pose.amount;
    const body = 27 * pose.scale;
    const flicker = 0.94 + 0.06 * Math.sin((game.wall || 0) * 19);

    fillFlamePolygon(game, g, [
        [x - 10, ground], [x - 17, ground + 25 * strength],
        [x - 6, y + 8], [x + 5, y + 18],
        [x + 17, ground + 29 * strength], [x + 9, ground],
    ], '#087fae', 132 * strength);
    fillFlamePolygon(game, g, [
        [x - 5, ground + 2], [x - 9, ground + 24 * strength],
        [x + 1, y + 11], [x + 8, ground + 24 * strength], [x + 5, ground + 2],
    ], '#70edff', 166 * strength);

    for (const side of [-1, 1]) {
        fillFlamePolygon(game, g, [
            [x + side * body * 0.08, y + body * 0.04],
            [x + side * body * 0.62, y + body * 0.56],
            [x + side * body * 1.12, y + body * 0.92 * flicker],
            [x + side * body * 0.87, y + body * 0.21],
            [x + side * body * 0.53, y - body * 0.05],
            [x + side * body * 0.15, y - body * 0.18],
        ], '#087fae', 126 * strength);
        fillFlamePolygon(game, g, [
            [x + side * body * 0.17, y + body * 0.02],
            [x + side * body * 0.69, y + body * 0.53],
            [x + side * body * 0.99, y + body * 0.72 * flicker],
            [x + side * body * 0.69, y + body * 0.12],
            [x + side * body * 0.34, y - body * 0.03],
        ], '#29d8f3', 148 * strength);
    }
}

/** Draw the selected target footprint and active X above the world sprites. */
export function drawPreview (game, g, form, skill, ready, pulse) {
    const layout = charizardXCrossLayout(game, game.aimWorld.x, game.aimWorld.y, skill.halfWidth);
    g.strokeColor = game.pal.get('#32d9f1', ready ? Math.round(30 + pulse * 18) : 16);
    g.lineWidth = 1.8;
    for (const axis of layout.axes) {
        g.moveTo(layout.x - axis.ux * axis.negative, layout.y - axis.uy * axis.negative);
        g.lineTo(layout.x + axis.ux * axis.positive, layout.y + axis.uy * axis.positive);
    }
    g.stroke();
    g.strokeColor = game.pal.get(form.color, ready ? 126 : 66);
    g.lineWidth = 2;
    g.moveTo(layout.x - 11, layout.y - 11);
    g.lineTo(layout.x + 11, layout.y + 11);
    g.moveTo(layout.x - 11, layout.y + 11);
    g.lineTo(layout.x + 11, layout.y - 11);
    g.stroke();
}

/** Called from drawFx after sprites, so the huge crossing ribbons remain legible over the crowd. */
export function drawScreenEffect (game, g, fx, skill) {
    if (fx.shape !== 'charizard-x-cross' || !fx.layout) return;
    drawCharizardFlight(game, g, fx);
    const progress = clamp(fx.age / Math.max(0.01, fx.duration), 0, 1);
    const slashAge = fx.age - (skill.impactDelay || 0);
    const rise = clamp(slashAge / 0.10, 0, 1);
    const fall = clamp((1 - progress) / 0.20, 0, 1);
    const envelope = rise * fall;
    if (envelope <= 0.005) return;
    for (let i = 0; i < fx.layout.axes.length; i++) {
        drawFlameAxis(game, g, fx.layout.axes[i], fx.layout, 255 * envelope * (i ? 0.97 : 1), i * 2.1 + 1);
    }

    // A short white ignition at the crossing point and directional pixel sparks sell the release
    // without leaving a large circle or blocking the player's aim reticle.
    const flash = (1 - clamp(fx.age / 0.13, 0, 1)) * 0.62;
    if (flash > 0.01) {
        g.strokeColor = game.pal.get('#eaffff', Math.round(210 * flash));
        g.lineWidth = 3 + flash * 3;
        g.moveTo(fx.x - 7, fx.y); g.lineTo(fx.x + 7, fx.y);
        g.moveTo(fx.x, fx.y - 7); g.lineTo(fx.x, fx.y + 7);
        g.stroke();
    }
    const sparkLife = clamp((1 - progress) / 0.34, 0, 1);
    if (sparkLife <= 0.01) return;
    for (let i = 0; i < 28; i++) {
        const axis = fx.layout.axes[i & 1];
        const seed = Math.sin(i * 91.7 + 18.3) * 43758.5;
        const q = (seed - Math.floor(seed)) * 1.86 - 0.93;
        const arm = i & 2 ? axis.negative : axis.positive;
        const along = (i & 2 ? -1 : 1) * arm * q;
        const side = Math.sin(i * 17.1 + game.wall * 2.7) * (skill.halfWidth * 0.65);
        const x = fx.x + axis.ux * along - axis.uy * side;
        const y = fx.y + axis.uy * along + axis.ux * side;
        const size = 1.4 + (i % 3) * 0.7;
        const life = sparkLife * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(game.wall * 18 + i)));
        g.fillColor = game.pal.get(i % 5 === 0 ? '#f3ffff' : '#8bf4ff', Math.round(210 * life));
        g.circle(x, y, size);
        g.fill();
    }
}
