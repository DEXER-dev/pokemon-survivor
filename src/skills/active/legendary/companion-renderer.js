import {
    LEGENDARY_COMPANION_SIGNATURES, SUB_LEGENDARY_COMPANION_SIGNATURES,
    companionSignatureForFamily, WARNING_SECONDS, IMPACT_SECONDS,
} from './companion-bombardment.js';
import { drawHoohSacredFire, drawHoohMaterialField } from './hooh-material-effects.js';
import { BOSS } from '../../../config.js';

const TAU = Math.PI * 2;
const CORE = '#fff8df';
const GLYPHS = {
    'psychic-burst': 'star', aeroblast: 'wave', 'sacred-fire': 'feather',
    'dragon-ascent': 'dragon', 'origin-pulse': 'wave', 'precipice-blades': 'spear',
    'roar-of-time': 'hex', 'spacial-rend': 'crescent', judgment: 'star',
};

const clamp = (v) => Math.max(0, Math.min(1, v));

const SUB_PROJECTILES = Object.freeze({
    'wildboss-articuno': ['subArticunoOrb', 6],
    'wildboss-zapdos': ['subZapdosBolt', 6],
    'wildboss-moltres': ['subMoltresFire', 6],
    'wildboss-raikou': ['subRaikouCore', 6],
    'wildboss-entei': ['subMoltresBomb', 6],
    'wildboss-suicune': ['subSuicuneBolt', 6],
});

const drawSubFrame = (batch, pal, prefix, frame, x, y, sx, sy, angle, alpha, animationPool, color = '#ffffff') => {
    const key = `${prefix}_${frame}`;
    if (!batch.glyphs?.[key]) return false;
    batch.draw(key, x, y, sx, sy, angle, pal.get(color, alpha), false, null, animationPool);
    return true;
};

function drawSubLegendaryProjectile (batch, pal, fam, x, y, radius, angle, wall, index) {
    const [prefix, count] = SUB_PROJECTILES[fam] || [];
    if (!prefix) return false;
    const frame = Math.floor(wall * 16 + index * 0.7) % count;
    const scale = Math.max(0.8, Math.min(1.45, radius / 8));
    if (drawSubFrame(batch, pal, prefix, frame, x, y, scale, scale, angle, 245,
        `subProjectile-${fam}`)) return true;
    const style = SUB_LEGENDARY_COMPANION_SIGNATURES[fam];
    const glyph = fam === 'wildboss-articuno' || fam === 'wildboss-suicune' ? 'wave'
        : fam === 'wildboss-moltres' || fam === 'wildboss-entei' ? 'flame' : 'spark';
    batch.draw(glyph, x, y, scale * 0.72, scale * 0.72, angle, pal.get(style.color, 240));
    return true;
}

/** Lower-tier active moves use the inspected pixel materials with just a few readable layers. */
function drawSubLegendaryCompanionEffect (batch, pal, segment, attack, wall) {
    const { fam } = segment;
    const style = SUB_LEGENDARY_COMPANION_SIGNATURES[fam];
    const impact = attack.phase === 'impact';
    const progress = impact
        ? Math.max(0, IMPACT_SECONDS - attack.timer)
        : Math.max(0, Math.min(1, 1 - attack.timer / WARNING_SECONDS));
    const fade = impact ? clamp(1 - progress / 0.62) : 0.42 + progress * 0.5;
    const alpha = Math.round(245 * fade);
    const x = attack.x, y = attack.y, angle = attack.angle || 0;
    const draw = (glyph, px, py, sx, sy, rot = 0, a = alpha, color = style.color) =>
        batch.draw(glyph, px, py, sx, sy, rot, pal.get(color, Math.max(0, Math.min(255, a))));
    const sprite = (prefix, count, px, py, sx, sy, rot = 0, fps = 18, pool = prefix) => {
        const frame = Math.min(count - 1, Math.floor(progress * fps));
        return drawSubFrame(batch, pal, prefix, frame, px, py, sx, sy, rot, alpha,
            `sub-${pool}`, style.color);
    };
    const fadeGlyphs = () => {
        if (fam === 'wildboss-articuno') {
            draw('shard', x - Math.cos(angle) * 28, y - Math.sin(angle) * 28, 0.38, 0.72, angle, alpha);
            draw('shard', x + Math.cos(angle) * 28, y + Math.sin(angle) * 28, 0.3, 0.62, -angle, alpha);
        } else if (fam === 'wildboss-zapdos') {
            sprite('subZapdosArc', 4, x - 18, y - 5, 1.1, 1.1, angle, 11, 'zapdos-arc-a');
            sprite('subZapdosArc', 4, x + 16, y + 7, 1.1, 1.1, angle + Math.PI / 2, 13, 'zapdos-arc-b');
            draw('spark', x, y, 0.52, 0.52, wall, alpha, '#fff8d7');
        } else if (fam === 'wildboss-moltres') {
            for (let i = 0; i < 3; i++) {
                const side = i - 1;
                if (!sprite('subMoltresBomb', 6, x + side * 35, y - 40 + progress * 40,
                    1.55, 1.55, Math.PI / 2, 15, `moltres-bomb-${i}`)) {
                    draw('flame', x + side * 35, y - 40 + progress * 40, 0.58, 0.94, 0, alpha);
                }
            }
        } else if (fam === 'wildboss-raikou') {
            const a = sprite('subRaikouSlash', 3, x, y, 1.18, 0.88, angle + 0.48, 10, 'raikou-slash-a');
            const b = sprite('subRaikouSlash', 3, x, y, 1.18, 0.88, angle - 0.48, 10, 'raikou-slash-b');
            if (!a && !b) draw('crescent', x, y, 0.75, 0.26, angle + 0.55, alpha);
        } else if (fam === 'wildboss-entei') {
            draw('ring', x, y, 1.8 + progress * 0.45, 1.05, 0, alpha * 0.65);
        } else if (fam === 'wildboss-suicune') {
            draw('crescent', x - 25, y, 0.62, 0.34, angle + 0.5, alpha);
            draw('crescent', x + 25, y, 0.62, 0.34, angle - 0.5, alpha);
        }
    };

    if (!impact) {
        fadeGlyphs();
        return true;
    }

    switch (fam) {
    case 'wildboss-articuno':
        if (!sprite('subArticunoLance', 4, x, y, 13.5, 1.25, angle, 18, 'articuno-lance')) {
            draw('legendRay', x, y, 3.7, 0.42, angle, alpha);
            draw('shard', x, y, 0.48, 0.48, angle, alpha, '#ffffff');
        }
        break;
    case 'wildboss-zapdos':
        sprite('subZapdosArc', 4, x - 16, y - 8, 1.28, 1.28, angle, 18, 'zapdos-impact-a');
        sprite('subZapdosArc', 4, x + 15, y + 8, 1.28, 1.28,
            angle + Math.PI / 2, 18, 'zapdos-impact-b');
        draw('spark', x, y, 0.78, 0.78, wall * 2, alpha, '#fff8d7');
        break;
    case 'wildboss-moltres':
        for (let i = 0; i < 3; i++) {
            const side = i - 1;
            if (!sprite('subMoltresBomb', 6, x + side * 34, y + side * 8,
                1.7, 1.7, Math.PI / 2, 19, `moltres-impact-${i}`)) {
                draw('flame', x + side * 34, y + side * 8, 0.8, 1.1, Math.PI / 2, alpha);
            }
        }
        break;
    case 'wildboss-raikou':
        {
            const a = sprite('subRaikouSlash', 3, x, y, 1.42, 0.92, angle + 0.55, 12, 'raikou-impact-a');
            const b = sprite('subRaikouSlash', 3, x, y, 1.42, 0.92, angle - 0.55, 12, 'raikou-impact-b');
            if (!a && !b) draw('crescent', x, y, 0.85, 0.32, angle + 0.55, alpha);
        }
        draw('spark', x, y, 0.43, 0.43, -wall, alpha, '#fff8d7');
        break;
    case 'wildboss-entei':
        if (!sprite('subEnteiBlast', 6, x, y, 1.9, 1.9, 0, 18, 'entei-impact')) {
            draw('flame', x, y, 1.2, 1.2, 0, alpha);
        }
        draw('ring', x, y, 1.95, 0.58, wall * 0.1, alpha * 0.7);
        break;
    case 'wildboss-suicune':
        if (!sprite('subSuicuneSplash', 6, x, y, 1.55, 1.55, angle, 18, 'suicune-splash')) {
            draw('wave', x, y, 1.15, 0.72, angle, alpha);
        }
        draw('crescent', x - 24, y + 4, 0.66, 0.32, angle + 0.55, alpha * 0.85);
        draw('crescent', x + 24, y + 4, 0.66, 0.32, angle - 0.55, alpha * 0.85);
        break;
    }
    return true;
}

/** Main skills retain an evolved-weapon silhouette between signature casts. */
export function drawLegendaryMainEffect (batch, pal, fx, wall) {
    const style = LEGENDARY_COMPANION_SIGNATURES[fx.fam];
    if (!style) return false;
    if (fx.fam === 'legend-hooh' && fx.kind === 'field' && drawHoohMaterialField(batch, pal, fx, wall)) return true;
    const draw = (glyph, x, y, sx, sy, angle, alpha, color = style.color) =>
        batch.draw(glyph, x, y, sx, sy, angle, pal.get(color, alpha));
    if (fx.kind === 'beam') {
        const length = fx.a * 2, width = Math.max(12, fx.b * 2);
        const ux = Math.cos(fx.rot), uy = Math.sin(fx.rot);
        draw('aura', fx.x, fx.y, length / 38, width / 9, fx.rot, 86);
        draw('legendRay', fx.x, fx.y, length / 48, width / 7, fx.rot, 235);
        draw('legendRay', fx.x, fx.y, length / 48, width / 16, fx.rot, 250, CORE);
        for (let i = 0; i < 8; i++) {
            const d = (((wall * 0.95 + i / 8) % 1) - 0.5) * length;
            const a = wall * 5 + i * 1.3;
            const side = Math.sin(a) * width * 0.8;
            const x = fx.x + ux * d - uy * side, y = fx.y + uy * d + ux * side;
            draw(GLYPHS[style.pattern], x, y, 0.8, 0.55, fx.rot, 235);
            draw('legendRay', x - ux * 25, y - uy * 25, 1.5, 0.28, fx.rot, 165, CORE);
        }
        return true;
    }
    if (fx.kind === 'field' || fx.kind === 'orbit') {
        const r = Math.max(30, fx.a);
        draw('legendSeal', fx.x, fx.y, r / 24, r / 24, wall * 0.24, 155);
        draw('legendSeal', fx.x, fx.y, r / 32, r / 32, -wall * 0.4, 125, CORE);
        for (let i = 0; i < 12; i++) {
            const a = wall * 0.7 + i * TAU / 12;
            draw(GLYPHS[style.pattern], fx.x + Math.cos(a) * r * 0.82,
                fx.y + Math.sin(a) * r * 0.82, 0.65, 0.65, a, 215);
        }
        return true;
    }
    if (fx.kind === 'slash') {
        draw('legendArc', fx.x, fx.y, fx.a / 22, fx.a / 28, fx.rot, 225);
        draw('legendArc', fx.x, fx.y, fx.a / 25, fx.a / 34, fx.rot, 240, CORE);
        return true;
    }
    return false;
}

function drawUltimateStorm (draw, attack, wall, t) {
    const x = attack.x, y = attack.y, angle = attack.angle || 0;
    const size = attack.radius || 118;
    const turn = wall * 0.5;
    const orbit = (g, count, r, rotation, sx, sy, alpha = 230, hue) => {
        for (let i = 0; i < count; i++) {
            const a = rotation + i * TAU / count;
            draw(g, x + Math.cos(a) * r, y + Math.sin(a) * r, sx, sy, a, alpha, hue);
        }
    };
    const comet = (g, px, py, a, scale, hue) => {
        draw('legendRay', px - Math.cos(a) * scale * 35, py - Math.sin(a) * scale * 35,
            scale * 3.6, scale * 0.7, a, 130, hue);
        draw(g, px, py, scale, scale, a, 240, hue);
        draw('star', px, py, scale * 0.3, scale * 0.3, -a, 255, CORE);
    };
    // A thin seal, counter-rotation and twelve herald stars provide a shared mythic grammar.
    draw('legendSeal', x, y, size / 18, size / 18, turn, 150);
    draw('legendSeal', x, y, size / 24, size / 24, -turn * 1.6, 125, CORE);
    orbit('star', 12, size * 1.35, -turn, 0.35, 0.35, 215, CORE);

    switch (attack.pattern) {
    case 'psychic-burst':
        // Three counter-rotating streams, with bright orbiting psychic blades.
        for (let stream = 0; stream < 3; stream++) for (let i = 0; i < 10; i++) {
            const a = stream * TAU / 3 + i * 0.27 + t * 5;
            const r = 25 + i * 15;
            comet('star', x + Math.cos(a) * r, y + Math.sin(a) * r,
                a + Math.PI / 2, 0.42 + i * 0.04);
        }
        for (let i = 0; i < 3; i++) draw('legendArc', x, y, 6.5, 5.2, t * 4 + i * TAU / 3, 190);
        break;
    case 'sacred-fire':
        // A giant phoenix crest unfurls, then two curtains of feather-comets stream outward.
        for (const side of [-1, 1]) for (let i = 0; i < 12; i++) {
            const p = (t * 1.8 + i / 12) % 1;
            const reach = 35 + p * 195;
            const py = y + Math.sin(p * Math.PI) * 88 + Math.sin(i * 2) * 18;
            comet('feather', x + side * reach, py, side > 0 ? 0.35 : Math.PI - 0.35,
                0.7 + (1 - p) * 0.65, i % 3 === 0 ? '#fff0a2' : undefined);
        }
        draw('flame', x, y + 35, 3, 4, 0, 230);
        draw('flame', x, y + 35, 1.1, 2.5, 0, 240, CORE);
        break;
    case 'aeroblast':
    case 'origin-pulse':
        // Interleaved tidal crescents and fast water pearls replace a single flat blue circle.
        for (let i = 0; i < 12; i++) {
            const p = (t * 1.6 + i / 12) % 1;
            const a = angle + i * TAU / 12;
            const r = 30 + p * 165;
            comet('wave', x + Math.cos(a) * r, y + Math.sin(a) * r, a, 0.65 + p * 0.4);
        }
        for (let i = 0; i < 6; i++) {
            const p = (t * 1.4 + i / 6) % 1;
            const s = 2.5 + p * 5;
            draw('legendArc', x, y, s, s * 0.8, angle + i * TAU / 6 - t, 160);
        }
        break;
    case 'dragon-ascent':
        // Two dragon wakes intertwine along the dive axis, followed by a broad claw ring.
        for (const side of [-1, 1]) for (let i = 0; i < 12; i++) {
            const p = (t * 1.3 + i / 12) % 1;
            const d = -210 + p * 410;
            const bend = Math.sin(p * TAU * 1.5 + t * 4) * 46 * side;
            comet(i === 0 ? 'dragon' : 'diamond', x + Math.cos(angle) * d - Math.sin(angle) * bend,
                y + Math.sin(angle) * d + Math.cos(angle) * bend, angle, i === 0 ? 1.7 : 0.6);
        }
        orbit('legendArc', 6, 110, t * 2, 1.6, 1.2);
        break;
    case 'precipice-blades':
        // Branching molten fault lines flicker beneath successive obelisk eruptions.
        for (let i = 0; i < 10; i++) {
            const a = i * TAU / 10 + angle;
            draw('legendRift', x + Math.cos(a) * 65, y + Math.sin(a) * 65,
                3.8, 0.6, a, 200);
            draw('legendRift', x + Math.cos(a) * 65, y + Math.sin(a) * 65,
                3.6, 0.18, a, 245, '#fff0a2');
        }
        for (let i = 0; i < 16; i++) {
            const a = i * TAU / 16;
            const p = (t * 1.8 + i * 0.137) % 1;
            comet('boulder', x + Math.cos(a) * (45 + p * 110),
                y + Math.sin(a) * (45 + p * 110) + Math.sin(p * Math.PI) * 55, a, 0.35 + p * 0.35);
        }
        break;
    case 'roar-of-time':
        // Two moving clock faces rotate in opposite directions around the time cannon.
        for (const sign of [-1, 1]) {
            const cx = x + Math.cos(angle) * sign * 68, cy = y + Math.sin(angle) * sign * 68;
            draw('legendSeal', cx, cy, 4.8, 4.8, sign * t * 2, 215);
            for (let i = 0; i < 12; i++) {
                const a = i * TAU / 12 + sign * t;
                draw('legendRay', cx + Math.cos(a) * 95, cy + Math.sin(a) * 95,
                    i % 3 === 0 ? 0.7 : 0.4, 0.24, a, 240, CORE);
            }
        }
        orbit('hex', 16, 160, -t, 0.55, 0.55, 215);
        break;
    case 'spacial-rend':
        // Orbiting rift blades surround the crossed fault, with pearl shards escaping the tears.
        for (let i = 0; i < 8; i++) {
            const a = i * TAU / 8 + t * 1.8;
            const r = 70 + (i % 2) * 55;
            draw('legendRift', x + Math.cos(a) * r, y + Math.sin(a) * r,
                4, 0.85, a + Math.PI / 2, 200);
            draw('legendRift', x + Math.cos(a) * r, y + Math.sin(a) * r,
                3.8, 0.25, a + Math.PI / 2, 245, CORE);
        }
        orbit('diamond', 24, 170, -t * 1.2, 0.5, 0.7, 230, CORE);
        break;
    case 'judgment':
        // A celestial wheel rains twelve moving lances around the real judgment footprints.
        for (let i = 0; i < 12; i++) {
            const p = (t * 2 + i / 12) % 1;
            const a = i * TAU / 12 + angle;
            const px = x + Math.cos(a) * 120, py = y + Math.sin(a) * 100;
            const height = 35 + (1 - p) * 175;
            draw('legendRay', px, py + height * 0.5, height / 36, 0.95, Math.PI / 2, 190);
            draw('legendRay', px, py + height * 0.5, height / 36, 0.3, Math.PI / 2, 255, CORE);
            draw('star', px, py, 0.8 + Math.sin(p * Math.PI), 0.8 + Math.sin(p * Math.PI), -turn, 245, CORE);
        }
        orbit('star', 8, 165, turn * 1.4, 0.9, 0.9, 240);
        break;
    }
}

/** Solid signature nuclei complement the native trails without allocating gameplay bullets. */
export function drawLegendaryProjectile (batch, pal, fam, x, y, radius, angle, wall, index) {
    if (drawSubLegendaryProjectile(batch, pal, fam, x, y, radius, angle, wall, index)) return;
    const style = LEGENDARY_COMPANION_SIGNATURES[fam];
    if (!style) return;
    if (fam === 'legend-hooh' && batch.glyphs?.hoohFire_0) {
        const frame = Math.floor(wall * 30 + index * 7) % 60;
        const size = Math.max(0.9, radius / 20);
        const ux = Math.cos(angle), uy = Math.sin(angle);
        batch.draw('aura', x, y, size * 3.8, size * 1.8, angle, pal.get('#ff9a36', 100));
        batch.draw(`hoohFire_${frame}`, x - ux * radius * 1.5, y - uy * radius * 1.5,
            size * 0.75, size * 2.6, angle - Math.PI / 2, pal.get('#ffffff', 235), false, null, 'hoohFire');
        batch.draw(`hoohFlare_${frame}`, x, y, size * 1.2, size * 1.5,
            angle - Math.PI / 2, pal.get('#ffffff', 255), false, null, 'hoohFlare');
        batch.draw('feather', x, y, size * 0.7, size * 0.7, angle, pal.get('#fff3bb', 245));
        return;
    }
    const size = Math.max(0.85, radius / 20);
    const pulse = 1 + 0.08 * Math.sin(wall * 10 + index);
    const glyph = GLYPHS[style.pattern];
    const ux = Math.cos(angle), uy = Math.sin(angle);
    // Long tapered wake, broad coloured silhouette, then a small ivory core.
    batch.draw('legendRay', x - ux * radius * 2.2, y - uy * radius * 2.2,
        size * 5.5, size * 1.4, angle, pal.get(style.color, 150));
    batch.draw(glyph, x - ux * radius * 0.9, y - uy * radius * 0.9,
        size * 1.45, size * 0.85, angle, pal.get(style.color, 112));
    batch.draw(glyph, x, y, size * 1.18 * pulse, size * pulse, angle, pal.get(style.color, 242));
    batch.draw(glyph, x, y, size * 0.48, size * 0.38, angle, pal.get(CORE, 245));
}

/** A bounded sprite composition: charging satellites, family-specific eruption, fading echoes. */
export function drawLegendaryCompanionEffects (batch, pal, segments, wall) {
    for (const segment of segments) {
        const attack = segment.legendaryBombardment;
        const style = companionSignatureForFamily(segment.fam);
        if (!style || !attack || !['warning', 'impact'].includes(attack.phase)) continue;
        if (SUB_LEGENDARY_COMPANION_SIGNATURES[segment.fam]) {
            drawSubLegendaryCompanionEffect(batch, pal, segment, attack, wall);
            continue;
        }
        const impact = attack.phase === 'impact';
        const t = Math.max(0, Math.min(1, 1 - attack.timer / (impact ? IMPACT_SECONDS : WARNING_SECONDS)));
        if (segment.fam === 'legend-hooh') {
            drawHoohSacredFire(batch, pal, attack, t, impact);
            continue;
        }
        // Hold the bright body of the storm, then fade only its last third.
        const fade = impact ? 1 - clamp((t - 0.65) / 0.35) ** 2 : 0.3 + t * 0.7;
        const color = style.color;
        const draw = (glyph, x, y, sx, sy, angle = 0, alpha = 220, hue = color) =>
            batch.draw(glyph, x, y, sx, sy, angle, pal.get(hue, Math.round(alpha * fade)));
        const ring = (x, y, r, alpha = 180, squash = 1) =>
            draw('ring', x, y, r / 24, r / 24 * squash, wall * 0.2, alpha);
        const line = (x, y, length, width, angle, alpha = 190, hue = color) =>
            draw('legendRay', x, y, length / 48, width / 14, angle, alpha, hue);
        const x = attack.x, y = attack.y;
        const angle = attack.angle || 0;
        const glyph = GLYPHS[style.pattern];

        if (!impact) {
            // Inward motion accelerates toward release; no particles need a persistent emitter.
            const orbit = 138 * (1 - t * t) + 16;
            ring(x, y, 36 + (1 - t) * 68, 110, 0.55);
            for (let i = 0; i < 6; i++) {
                const a = i * TAU / 6 + wall * 0.9;
                draw(glyph, x + Math.cos(a) * orbit, y + Math.sin(a) * orbit,
                    0.26 + t * 0.24, 0.26 + t * 0.24, a, 200);
            }
            draw('aura', x, y, 1 + t * 1.6, 1 + t * 1.6, 0, 75);
            draw(glyph, x, y, 0.35 + t * 0.75, 0.35 + t * 0.75, -wall, 230, CORE);
            draw('legendSeal', x, y, 4.5 - t * 1.8, 4.5 - t * 1.8, -wall * 0.8, 170);
            draw('legendSeal', x, y, 3 + t, 3 + t, wall * 0.5, 110, CORE);
            continue;
        }

        drawUltimateStorm(draw, attack, wall, t);

        // Two expanding, low-opacity pressure fronts leave the battlefield visible.
        ring(x, y, 42 + 145 * (1 - (1 - t) ** 3), 190, 0.65);
        ring(x, y, 25 + 110 * t, 115);
        for (const beam of attack.corridors || []) {
            const ux = Math.cos(beam.angle), uy = Math.sin(beam.angle);
            const cx = beam.x + ux * beam.length * 0.5;
            const cy = beam.y + uy * beam.length * 0.5;
            line(cx, cy, beam.length, beam.width * 1.35, beam.angle, 56);
            line(cx, cy, beam.length, beam.width * 0.65, beam.angle, 220);
            line(cx, cy, beam.length, Math.max(3, beam.width * 0.16), beam.angle, 245, CORE);
            for (let i = 0; i < 4; i++) {
                const d = ((i / 4 + t * 0.65) % 1) * beam.length;
                const bx = beam.x + ux * d, by = beam.y + uy * d;
                draw(glyph, bx, by, 0.85, 0.6, beam.angle, 205, CORE);
            }
        }

        for (let i = 0; i < (attack.areas || []).length; i++) {
            const area = attack.areas[i];
            const r = area.radius;
            const echo = (t * 3 + i * 0.19) % 1;
            const bloom = 1 + Math.sin(echo * Math.PI) * 0.6;
            draw('aura', area.x, area.y, r / 22 * bloom, r / 22 * bloom, 0, 60);
            ring(area.x, area.y, r * (0.65 + 0.45 * t), 175, 0.65);
            if (style.pattern === 'precipice-blades') {
                // Jagged obelisks rise from the actual five fissure footprints.
                const height = 72 + r * 1.2;
                draw('spear', area.x, area.y + height * 0.3, height / 36, r / 32,
                    Math.PI / 2, 245);
                draw('spear', area.x, area.y + height * 0.3, height / 42, r / 95,
                    Math.PI / 2, 230, CORE);
            } else if (style.pattern === 'judgment') {
                const height = 200 * (1 - t * 0.4);
                line(area.x, area.y + height * 0.5, height, 16, Math.PI / 2, 85);
                line(area.x, area.y + height * 0.5, height, 4, Math.PI / 2, 235, CORE);
                draw('star', area.x, area.y, 1.6, 1.6, wall * 0.35, 245, CORE);
            } else {
                draw(glyph, area.x, area.y, r / 34 * bloom, r / 34 * bloom,
                    style.pattern === 'psychic-burst' ? wall : angle, 205);
                draw(glyph, area.x, area.y, r / 80, r / 80, -wall, 240, CORE);
            }
        }

        // These large silhouettes communicate the creature's identity at combat zoom.
        if (style.pattern === 'sacred-fire') {
            for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
                const reach = (48 + i * 26) * (1 + t * 0.45);
                draw('feather', x + side * reach, y + 35 + Math.sin(i * 0.5) * 65,
                    0.8, 1.9 - i * 0.16, side * (0.5 + i * 0.19), 220);
            }
        } else if (style.pattern === 'dragon-ascent') {
            for (let i = 0; i < 7; i++) {
                const d = 170 - i * 34 - t * 220;
                const bend = Math.sin(i * 0.7 + t * 5) * 22;
                draw(i === 0 ? 'dragon' : 'diamond', x - Math.cos(angle) * d - Math.sin(angle) * bend,
                    y - Math.sin(angle) * d + Math.cos(angle) * bend,
                    i === 0 ? 2.1 : 0.85, i === 0 ? 1.65 : 0.65, angle, 225);
            }
        } else if (style.pattern === 'roar-of-time' || style.pattern === 'spacial-rend') {
            for (let i = 0; i < 12; i++) {
                const a = i * TAU / 12 - wall * 0.25;
                const r = 88 + t * 28;
                draw(style.pattern === 'roar-of-time' ? 'shard' : 'diamond',
                    x + Math.cos(a) * r, y + Math.sin(a) * r, 0.35, 0.65, a, 200, CORE);
            }
        } else if (style.pattern === 'psychic-burst') {
            ring(x, y, 65 + t * 72, 230, 0.35);
            draw('ring', x, y, 3 + t * 2, 0.8 + t * 0.4, -wall * 0.7, 190, CORE);
        }
    }
}

/**
 * Reuse the inspected companion materials at BOSS scale, aligned to the locked damage footprints.
 * The red/orange telegraph remains the hitbox authority; this pass adds a species-specific charge
 * motif and a short, readable material burst when those exact areas resolve.
 */
export function drawSubLegendaryBossAttack (batch, pal, attack, wall) {
    const fam = attack?.family;
    const style = SUB_LEGENDARY_COMPANION_SIGNATURES[fam];
    if (!attack?.active || !attack.wildBoss || !style
        || !['warning', 'impact'].includes(attack.phase) || !attack.areas?.length) return false;

    const impact = attack.phase === 'impact';
    const progress = impact
        ? clamp(1 - attack.timeLeft / BOSS.legendaryImpact)
        : clamp(1 - attack.timeLeft / BOSS.legendaryWindup);
    const alpha = Math.round(impact ? 235 - progress * 48 : 92 + progress * 80);
    const frame = (count) => impact
        ? Math.min(count - 1, Math.floor(progress * count))
        : Math.floor((wall * 0.12 + progress * 0.25) * count) % count;
    const material = (prefix, count, area, index, sx, sy, angle, pool = prefix, a = alpha) =>
        drawSubFrame(batch, pal, prefix, frame(count), area.x, area.y, sx, sy, angle, a,
            `sub-boss-${pool}-${index}`, style.color);
    const glyph = (name, x, y, sx, sy, angle, a = alpha, color = style.color) =>
        batch.draw(name, x, y, sx, sy, angle, pal.get(color, a));

    for (let i = 0; i < attack.areas.length; i++) {
        const area = attack.areas[i];
        const angle = area.shape === 'rect' ? area.angle : (attack.angle || 0);
        const lengthScale = area.shape === 'rect' ? Math.max(1, Math.min(5.2, area.length / 82)) : 1;
        const radiusScale = area.shape === 'circle' ? area.radius / 32 : 1;

        if (area.shape === 'circle') {
            glyph('ring', area.x, area.y, radiusScale * 1.55, radiusScale * 1.55,
                wall * (impact ? 0.32 : 0.12) + i * 0.3, Math.round(alpha * 0.44));
        }

        switch (fam) {
        case 'wildboss-articuno':
            if (area.shape === 'circle') {
                const prefix = impact ? 'subArticunoLance' : 'subArticunoOrb';
                material(prefix, impact ? 4 : 6, area, i,
                    impact ? 1.34 * radiusScale : 1.16 * radiusScale,
                    impact ? 0.72 * radiusScale : 1.16 * radiusScale,
                    angle + (i % 2 ? 0.4 : -0.4), `articuno-${prefix}`, alpha);
            } else {
                material('subArticunoLance', 4, area, i, lengthScale, 0.62, angle,
                    'articuno-beam', alpha);
                if (impact) glyph('shard', area.x, area.y, 0.8, 0.8, angle, 235, '#ffffff');
            }
            break;
        case 'wildboss-zapdos':
            if (area.shape === 'rect') {
                material('subZapdosArc', 4, area, i, lengthScale, 0.76, angle,
                    'zapdos-branch', alpha);
                glyph('spark', area.x, area.y, 0.72, 0.72, wall + i, Math.round(alpha * 0.9), '#fff8d7');
            } else {
                material('subZapdosBolt', 6, area, i, 1.22 * radiusScale, 1.22 * radiusScale,
                    angle, 'zapdos-strike', alpha);
            }
            break;
        case 'wildboss-moltres':
            {
                const count = area.shape === 'circle' || !impact ? 1 : 2;
                for (let j = 0; j < count; j++) {
                    const spread = count === 1 ? 0 : (j - 0.5) * Math.min(90, area.length * 0.22);
                    const px = area.x + Math.cos(angle) * spread;
                    const py = area.y + Math.sin(angle) * spread;
                    const bombArea = { x: px, y: py };
                    material('subMoltresBomb', 6, bombArea, i * 2 + j,
                        impact ? 1.45 : 1.12, impact ? 1.45 : 1.12,
                        Math.PI / 2, 'moltres-falling-feather', alpha);
                    if (impact) glyph('flame', px, py + 12, 0.55, 0.88, angle, 165);
                }
            }
            break;
        case 'wildboss-raikou':
            if (area.shape === 'rect') {
                const cross = attack.name === '雷纹双爪';
                material('subRaikouSlash', 3, area, i * 2, lengthScale, 0.58,
                    angle + (cross ? 0.46 : Math.PI / 2), 'raikou-claw-a', alpha);
                if (cross) material('subRaikouSlash', 3, area, i * 2 + 1,
                    lengthScale, 0.58, angle - 0.46, 'raikou-claw-b', alpha);
                glyph('spark', area.x, area.y, 0.64, 0.64, -wall - i, Math.round(alpha * 0.82), '#fff8d7');
            }
            break;
        case 'wildboss-entei':
            if (area.shape === 'circle') {
                material('subEnteiBlast', 6, area, i,
                    (impact ? 1.36 : 1.08) * radiusScale,
                    (impact ? 1.36 : 1.08) * radiusScale,
                    0, 'entei-eruption', alpha);
                if (impact) glyph('ring', area.x, area.y, radiusScale * 2,
                    radiusScale * 1.3, wall * 0.25, Math.round(alpha * 0.54), '#ffe8a2');
            }
            break;
        case 'wildboss-suicune':
            if (area.shape === 'circle') {
                const prefix = impact ? 'subSuicuneSplash' : 'subSuicuneBolt';
                material(prefix, 6, area, i,
                    impact ? 1.35 * radiusScale : 1.08 * radiusScale,
                    impact ? 1.35 * radiusScale : 1.08 * radiusScale,
                    angle, `suicune-${prefix}`, alpha);
            } else {
                glyph('wave', area.x, area.y, lengthScale, 0.8, angle, Math.round(alpha * 0.68));
                for (let j = 0; j < 3; j++) {
                    const d = (j - 1) * Math.min(82, area.length * 0.22);
                    const water = { x: area.x + Math.cos(angle) * d,
                        y: area.y + Math.sin(angle) * d };
                    material(impact ? 'subSuicuneSplash' : 'subSuicuneBolt', 6,
                        water, i * 3 + j, impact ? 1.14 : 0.9, impact ? 1.14 : 0.9,
                        angle, 'suicune-tide', alpha);
                }
            }
            break;
        }
    }
    return true;
}
