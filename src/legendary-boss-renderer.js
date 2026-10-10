import { drawLugiaAttack } from './lugia-attacks.js';
import { BOSS } from './config.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const TAU = Math.PI * 2;
const MATERIAL_FRAMES = Object.freeze({
    arcane: 7, water03: 5, water04: 5, water05: 5,
    earth03: 5, earth04: 5, cosmic02: 5, cosmic05: 5, slash04: 6, pure05: 5,
});
const BOSS_STYLE = Object.freeze({
    'legend-mewtwo': { color: '#d49af2', glyph: 'star', material: 'arcane' },
    'legend-lugia': { color: '#72def2', glyph: 'wave', material: 'water04' },
    'legend-hooh': { color: '#ff9c4d', glyph: 'feather', material: 'hooh' },
    'legend-rayquaza': { color: '#78e6a6', glyph: 'dragon', material: 'native' },
    'legend-kyogre': { color: '#4f9dff', glyph: 'wave', material: 'water05' },
    'legend-groudon': { color: '#ff7657', glyph: 'boulder', material: 'earth03' },
    'legend-dialga': { color: '#7bdcf4', glyph: 'hex', material: 'cosmic02' },
    'legend-palkia': { color: '#f28fda', glyph: 'crescent', material: 'slash04' },
    'legend-arceus': { color: '#e6bc52', glyph: 'star', material: 'pure05' },
});

function materialFor (fam, moveIndex) {
    switch (fam) {
    case 'legend-lugia': return moveIndex === 1 ? 'water03' : 'water04';
    case 'legend-kyogre': return moveIndex === 0 ? 'water03' : 'water05';
    case 'legend-groudon': return moveIndex === 0 ? 'earth04' : 'earth03';
    case 'legend-dialga': return moveIndex === 2 ? 'cosmic05' : 'cosmic02';
    case 'legend-palkia': return moveIndex === 1 ? 'slash04' : 'cosmic05';
    default: return BOSS_STYLE[fam]?.material;
    }
}

function drawMaterial (batch, pal, group, x, y, sx, sy, angle, alpha, wall, progress, slot) {
    if (group === 'native') return false;
    if (group === 'hooh') {
        if (!batch.glyphs?.hoohFire_0 || !batch.glyphs?.hoohFlare_0) return false;
        const fireFrame = Math.floor(wall * 30 + progress * 18 + slot * 7) % 60;
        const flareFrame = (fireFrame + 21) % 60;
        batch.draw(`hoohFire_${fireFrame}`, x, y, sx * 0.72, sy * 1.35,
            angle, pal.get('#ffffff', alpha), false, null, 'primary-boss-hoohFire');
        batch.draw(`hoohFlare_${flareFrame}`, x, y, sx * 0.9, sy * 0.75,
            angle, pal.get('#ffffff', Math.min(255, alpha + 10)), false, null, 'primary-boss-hoohFlare');
        return true;
    }
    const count = MATERIAL_FRAMES[group];
    if (!count) return false;
    const frame = Math.min(count, Math.floor((wall * 2.2 + progress * count + slot * 0.37) % count) + 1);
    const key = `vfx_${group}_${String(frame).padStart(2, '0')}`;
    if (!batch.glyphs?.[key]) return false;
    batch.draw(key, x, y, sx, sy, angle, pal.get('#ffffff', alpha),
        false, null, `primary-boss-${group}-${slot}`);
    return true;
}

function drawRayquazaAttack (batch, pal, attack, wall, progress, impact, draw) {
    const sourceX = Number.isFinite(attack.sourceX) ? attack.sourceX : attack.cx || 0;
    const sourceY = Number.isFinite(attack.sourceY) ? attack.sourceY : attack.cy || 0;
    const dx = attack.x - sourceX;
    const dy = attack.y - sourceY;
    const distance = Math.hypot(dx, dy) || 1;
    const direction = Math.atan2(dy, dx);

    if (!impact) {
        const pulse = 1 + 0.055 * Math.sin(wall * 7);
        draw('aura', sourceX, sourceY, 3.6 * pulse, 3.6 * pulse,
            0, '#36dc9a', Math.round(92 + progress * 96));
        draw('legendSeal', sourceX, sourceY, 2.45, 2.45,
            wall * 0.42, '#78e6a6', Math.round(118 + progress * 86));
        draw('dragon', sourceX, sourceY, 2.0 + progress * 0.38,
            1.45 + progress * 0.2, direction, '#c9ffe2', Math.round(145 + progress * 100));
        // Emerald motes spiral inward as Rayquaza gathers force; their last orbit becomes the release cue.
        for (let i = 0; i < 8; i++) {
            const angle = i * TAU / 8 - wall * (1.1 + progress * 1.25);
            const radius = 78 - progress * 45;
            const x = sourceX + Math.cos(angle) * radius;
            const y = sourceY + Math.sin(angle) * radius;
            const size = 0.28 + progress * 0.12;
            draw(i % 2 ? 'star' : 'diamond', x, y, size, size * 1.35,
                angle + wall, i % 2 ? '#d9ffe8' : '#50f0ab', 210);
        }
        if (attack.sequenceKind === 'meteor-columns') {
            const activeColumn = Math.min(attack.columnCount - 1,
                Math.floor(progress * attack.columnCount));
            for (let col = 0; col < attack.columnCount; col++) {
                const x = attack.columnXs[col];
                const active = col === activeColumn;
                draw('meteor', x, attack.topY - (active ? progress * 100 : 0),
                    active ? 0.88 : 0.58, active ? 0.88 : 0.58, -Math.PI / 2,
                    active ? '#eafff0' : '#65e8a2', active ? 230 : 115);
                draw('legendRay', x, (attack.topY + attack.bottomY) * 0.5,
                    0.3, (attack.topY - attack.bottomY) / 48, -Math.PI / 2,
                    '#53e69b', active ? 82 : 36);
            }
        } else if (attack.sequenceKind === 'ring') {
            for (const [radius, count, direction] of [[attack.ringRadius, attack.ringBlades, attack.ringDirection],
                ...(attack.innerRingRadius ? [[attack.innerRingRadius, 4, -attack.ringDirection]] : [])]) {
                draw('ring', attack.x, attack.y, radius / 48, radius / 48,
                    wall * direction * 0.34, '#60e8a1', Math.round(55 + progress * 70));
                for (let i = 0; i < count; i++) {
                    const a = attack.ringAngle + i * TAU / count + wall * direction * 0.5;
                    const x = attack.x + Math.cos(a) * radius;
                    const y = attack.y + Math.sin(a) * radius;
                    draw('legendRay', x, y, 1.0, 0.42, a, '#bbffda', 220);
                }
            }
        } else if (attack.sequenceKind === 'tornado') {
            draw('aura', attack.x, attack.y, 3.6, 3.6, wall * 0.7, '#45df9c', 160);
            for (let i = 0; i < 4; i++) {
                const a = wall * (1.3 + i * 0.07) + i * TAU / 4;
                const x = attack.x + Math.cos(a) * (42 + i * 18);
                const y = attack.y + Math.sin(a) * (42 + i * 18);
                draw('legendRay', x, y, 2.0, 0.42, a + Math.PI / 2, '#83f5b4', 175);
            }
        } else if (attack.moveIndex === 2) {
            for (const area of attack.areas) {
                const fall = 1 - progress;
                draw('meteor', area.x, area.y + 150 * fall, 0.84, 0.84,
                    -Math.PI / 2, '#baffd0', Math.round(100 + progress * 140));
                draw('legendRay', area.x, area.y + 76 * fall, 0.38, 2.2,
                    -Math.PI / 2, '#77efaa', Math.round(80 + progress * 90));
            }
        }
        return;
    }

    if (attack.sequenceKind === 'meteor-columns') {
        const elapsed = progress * attack.impactDuration;
        for (let col = 0; col < attack.columnCount; col++) {
            for (let shot = 0; shot < attack.shotsPerColumn; shot++) {
                const t = (elapsed - col * attack.columnDelay - shot * attack.shotDelay) / attack.fallTime;
                if (t < 0 || t > 1) continue;
                const x = attack.columnXs[col] + Math.sin(wall * 11 + shot) * 3;
                const y = attack.topY + (attack.bottomY - attack.topY) * t;
                draw('legendRay', x, y - 24, 0.52, 1.8, -Math.PI / 2, '#56e99e', 215);
                draw('meteor', x, y, 0.88, 0.88, -Math.PI / 2, '#edfff1', 255);
                if (t > 0.82) draw('aura', x, y, 0.65 + (t - 0.82) * 3,
                    0.65 + (t - 0.82) * 3, 0, '#69f2a9', Math.round(150 * (1 - t)));
            }
        }
        return;
    }

    if (attack.sequenceKind === 'ring') {
        const elapsed = progress * attack.impactDuration;
        for (const [radius, count, direction] of [[attack.ringRadius, attack.ringBlades, attack.ringDirection],
            ...(attack.innerRingRadius ? [[attack.innerRingRadius, 4, -attack.ringDirection]] : [])]) {
            for (let i = 0; i < count; i++) {
                const a = attack.ringAngle + i * TAU / count + direction * elapsed * 2.8;
                const x = attack.x + Math.cos(a) * radius;
                const y = attack.y + Math.sin(a) * radius;
                draw('legendRay', x, y, 1.6, 0.5, a + Math.PI / 2, '#b9ffd4', 235);
                draw('star', x, y, 0.52, 0.52, a + wall, '#effff5', 235);
            }
        }
        const sprite = batch.glyphs?.RAYQUAZA ? 'RAYQUAZA' : 'dragon';
        const orbit = attack.ringRadius * (0.72 + 0.08 * Math.sin(elapsed * 7));
        batch.draw(sprite, attack.x + Math.cos(wall * 1.4) * orbit,
            attack.y + Math.sin(wall * 1.4) * orbit, 1.65, 1.12, wall * 1.4,
            pal.get('#eafff0', 220));
        return;
    }

    if (attack.sequenceKind === 'tornado') {
        const sprite = batch.glyphs?.RAYQUAZA ? 'RAYQUAZA' : 'dragon';
        const sweep = progress * Math.PI * 2.2;
        const x = attack.x + Math.cos(sweep) * attack.areas[0].length * 0.34;
        const y = attack.y + Math.sin(sweep) * 42;
        for (let i = 0; i < 5; i++) {
            const a = wall * 1.8 + i * TAU / 5;
            const radius = 48 + i * 15;
            draw('legendRay', attack.x + Math.cos(a) * radius,
                attack.y + Math.sin(a) * radius, 1.5, 0.4, a + Math.PI / 2, '#76f2ae', 185);
        }
        batch.draw(sprite, x, y, 2.2, 1.5, sweep + Math.PI,
            pal.get('#ecfff3', 245));
        return;
    }

    const eased = 1 - (1 - progress) * (1 - progress);
    const headX = sourceX + dx * eased;
    const headY = sourceY + dy * eased + Math.sin(progress * Math.PI) * 26;
    // The Rayquaza icon's native heading points left; rotate that heading onto its actual lunge direction.
    const trailAngle = direction - Math.PI;
    const sprite = batch.glyphs?.RAYQUAZA ? 'RAYQUAZA' : 'dragon';
    for (let ghost = 3; ghost >= 0; ghost--) {
        const t = Math.max(0, eased - ghost * 0.13);
        const x = sourceX + dx * t;
        const y = sourceY + dy * t + Math.sin(t * Math.PI) * 26;
        const alpha = ghost === 0 ? 255 : Math.round(138 / ghost);
        const scale = ghost === 0 ? 2.5 : 2.15 - ghost * 0.12;
        batch.draw(sprite, x, y, scale, scale * 0.68, trailAngle,
            pal.get(ghost === 0 ? '#e7fff0' : '#58e7a0', alpha));
    }
    draw('legendRay', sourceX + dx * 0.5, sourceY + dy * 0.5,
        distance / 48, 0.66, direction, '#65f2a5', 196);
    draw('aura', headX, headY, 2.1 + progress * 0.55, 1.65 + progress * 0.4,
        0, '#58ed9e', Math.round(145 + progress * 85));
    if (progress > 0.62) {
        const burst = (progress - 0.62) / 0.38;
        draw('ring', attack.x, attack.y, 1.5 + burst * 2.8, 1.5 + burst * 2.8,
            0, '#e6fff1', Math.round(235 * (1 - burst)));
        draw('aura', attack.x, attack.y, 2.6 + burst * 2.2, 2.6 + burst * 2.2,
            0, '#48dc91', Math.round(176 * (1 - burst)));
    }
}

/** Source-backed hit accents for the nine primary legendary attacks; all remain cosmetic. */
export function drawPrimaryLegendaryBossAttack (batch, pal, attack, wall) {
    const style = BOSS_STYLE[attack?.family];
    if (!attack?.active || attack.wildBoss || !style
        || !['warning', 'impact'].includes(attack.phase) || !attack.areas?.length) return false;

    const impact = attack.phase === 'impact';
    const progress = impact
        ? clamp(1 - attack.timeLeft / (attack.impactDuration || BOSS.legendaryImpact), 0, 1)
        : clamp(1 - attack.timeLeft / (attack.windupDuration || BOSS.legendaryWindup), 0, 1);
    const material = materialFor(attack.family, attack.moveIndex || 0);
    const alpha = Math.round(impact ? 230 - 45 * progress : 76 + progress * 90);
    const draw = (glyph, x, y, sx, sy, angle, tint = style.color, a = alpha) =>
        batch.draw(glyph, x, y, sx, sy, angle, pal.get(tint, a));
    const impactFrame = (slot) => slot + progress * 0.18;

    if (attack.family === 'legend-lugia') {
        drawLugiaAttack(batch, pal, attack, wall, progress, impact);
        return true;
    }

    if (attack.family === 'legend-rayquaza') {
        drawRayquazaAttack(batch, pal, attack, wall, progress, impact, draw);
        return true;
    }

    const coverage = attack.areas.reduce((furthest, area) => {
        const reach = Math.hypot(area.x - attack.x, area.y - attack.y)
            + (area.shape === 'circle' ? area.radius : area.length * 0.5);
        return Math.max(furthest, reach);
    }, 72);
    const sealScale = clamp(coverage / 150, 0.7, 3.4);
    draw('legendSeal', attack.x, attack.y, sealScale, sealScale,
        wall * (impact ? -0.32 : 0.18), style.color, Math.round(alpha * 0.52));
    if (attack.ultimate) {
        draw('legendSeal', attack.x, attack.y, sealScale * 0.68, sealScale * 0.68,
            -wall * 0.26, '#fff8e5', Math.round(alpha * 0.44));
        draw('aura', attack.x, attack.y, sealScale * 1.35, sealScale * 1.35,
            0, style.color, Math.round(alpha * 0.24));
    }

    for (let i = 0; i < attack.areas.length; i++) {
        const area = attack.areas[i];
        const isCircle = area.shape === 'circle';
        const angle = isCircle ? attack.angle || 0 : area.angle;
        const markerScale = isCircle
            ? clamp(area.radius / 66, 0.42, 1.55)
            : clamp(area.width / 62, 0.4, 0.95);

        if (isCircle) {
            const pulse = 1 + 0.06 * Math.sin(wall * 8 + i);
            draw('ring', area.x, area.y, area.radius / 23 * pulse,
                area.radius / 31 * pulse, wall * 0.12 + i * 0.2,
                style.color, Math.round(alpha * 0.66));
            const usedMaterial = drawMaterial(batch, pal, material,
                area.x, area.y, markerScale, markerScale, angle + i * 0.08,
                alpha, wall, progress, i);
            if (!usedMaterial || attack.ultimate) {
                draw(style.glyph, area.x, area.y - 6, markerScale * 0.68,
                    markerScale * 0.68, angle + i * 0.2,
                    attack.family === 'legend-arceus' ? '#fff2ae' : style.color,
                    Math.round(alpha * 0.9));
            }
            if (attack.ultimate && i % 2 === 0) {
                draw('star', area.x, area.y, 0.54, 0.54, -wall * 0.4 - i,
                    '#fff8e5', Math.round(alpha * 0.88));
            }
            continue;
        }

        const ux = Math.cos(angle), uy = Math.sin(angle);
        const nx = -uy, ny = ux;
        const laneTintAlpha = Math.round(alpha * (impact ? 0.62 : 0.35));
        draw('legendRay', area.x, area.y, area.length / 48,
            Math.max(0.28, area.width / 34), angle, style.color, laneTintAlpha);
        const slots = attack.ultimate ? 5 : 3;
        for (let j = 0; j < slots; j++) {
            const along = (j / (slots - 1) - 0.5) * area.length * 0.68;
            const x = area.x + ux * along + nx * Math.sin(wall * 2 + i + j) * 7;
            const y = area.y + uy * along + ny * Math.sin(wall * 2 + i + j) * 7;
            const usedMaterial = drawMaterial(batch, pal, material,
                x, y, markerScale, markerScale, angle, Math.round(alpha * 0.92),
                wall, impactFrame(i + j), i * slots + j);
            if (!usedMaterial && (j === Math.floor(slots / 2) || attack.family === 'legend-rayquaza')) {
                draw(style.glyph, x, y, attack.family === 'legend-rayquaza' ? 1.22 : 0.64,
                    attack.family === 'legend-rayquaza' ? 1.22 : 0.64, angle,
                    style.color, Math.round(alpha * 0.95));
                if (attack.family === 'legend-rayquaza') {
                    draw('diamond', x - ux * 28, y - uy * 28, 0.48, 0.75,
                        angle + nx * 0.3, '#d7ffeb', Math.round(alpha * 0.78));
                }
            }
        }
        if (attack.ultimate) {
            draw('legendRay', area.x, area.y, area.length / 48,
                Math.max(0.16, area.width / 100), angle, '#fff8e5', Math.round(alpha * 0.72));
        }
    }

    for (let i = 0; i < (attack.markers || []).length; i++) {
        const marker = attack.markers[i];
        const scale = clamp(marker.radius / 26, 0.48, 1.2);
        draw('ring', marker.x, marker.y, scale * 1.2, scale * 1.2,
            wall * 0.25 + i, style.color, Math.round(alpha * 0.8));
        drawMaterial(batch, pal, material, marker.x, marker.y, scale, scale,
            wall * 0.2 + i, Math.round(alpha * 0.9), wall, progress, 20 + i);
    }
    if (attack.family === 'legend-rayquaza' && attack.phase === 'impact') {
        // Rayquaza has no matching sourced dragon animation; retain the inspected native dragon glyph.
        draw('dragon', attack.x, attack.y, 2.2, 1.45, attack.angle || 0,
            '#d7ffeb', Math.round(alpha * 0.8));
    }
    return true;
}
