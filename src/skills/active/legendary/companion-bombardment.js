import { VIEW, MAX_BODY_R } from '../../../config.js';
import { segDps } from '../../../combat.js';

export const WARNING_SECONDS = 0.82;
export const IMPACT_SECONDS = 2.2;
const BASE_DAMAGE = 1.35;

/** Signature move layouts are deliberately different in both footprint and damage geometry. */
export const LEGENDARY_COMPANION_SIGNATURES = Object.freeze({
    'legend-mewtwo': { move: '精神击破', pattern: 'psychic-burst', color: '#d49af2' },
    'legend-lugia': { move: '气旋攻击', pattern: 'aeroblast', color: '#72def2' },
    'legend-hooh': { move: '神圣之火', pattern: 'sacred-fire', color: '#ff9c4d' },
    'legend-rayquaza': { move: '画龙点睛', pattern: 'dragon-ascent', color: '#78e6a6' },
    'legend-kyogre': { move: '根源波动', pattern: 'origin-pulse', color: '#4f9dff' },
    'legend-groudon': { move: '断崖之剑', pattern: 'precipice-blades', color: '#ff7657' },
    'legend-dialga': { move: '时光咆哮', pattern: 'roar-of-time', color: '#7bdcf4' },
    'legend-palkia': { move: '亚空裂斩', pattern: 'spacial-rend', color: '#f28fda' },
    'legend-arceus': { move: '制裁光砾', pattern: 'judgment', color: '#fff0a2' },
});

/** Sub-legendaries use compact, source-backed patterns with a lower visual footprint. */
export const SUB_LEGENDARY_COMPANION_SIGNATURES = Object.freeze({
    'wildboss-articuno': { move: '冰翼贯羽', pattern: 'sub-ice-lance', color: '#9beaff' },
    'wildboss-zapdos': { move: '折枝雷击', pattern: 'sub-branching-bolt', color: '#ffe47a' },
    'wildboss-moltres': { move: '三羽坠焰', pattern: 'sub-falling-feathers', color: '#ff9b55' },
    'wildboss-raikou': { move: '雷纹双爪', pattern: 'sub-crossing-claws', color: '#ffd05c' },
    'wildboss-entei': { move: '炎鬃踏震', pattern: 'sub-mane-stomp', color: '#ff8755' },
    'wildboss-suicune': { move: '回澜水幕', pattern: 'sub-rising-tide', color: '#78d9ed' },
});

export function companionSignatureForFamily (fam) {
    return LEGENDARY_COMPANION_SIGNATURES[fam] || SUB_LEGENDARY_COMPANION_SIGNATURES[fam] || null;
}

export function isSubLegendaryCompanion (segment) {
    return !!segment && typeof segment.fam === 'string'
        && !!SUB_LEGENDARY_COMPANION_SIGNATURES[segment.fam];
}

export function hasCompanionSignature (segment) {
    return !!segment && !!companionSignatureForFamily(segment.fam);
}

export function isLegendaryCompanion (segment) {
    return !!segment && typeof segment.fam === 'string' && segment.fam.startsWith('legend-');
}

/** A caught legendary starts unmistakably larger; duplicates add a restrained, capped bonus. */
export function legendaryBodyScale (segment) {
    if (!isLegendaryCompanion(segment)) return 1;
    return 2.2 + Math.min(0.42, Math.log2(Math.max(1, segment.count || 1)) * 0.1);
}

function chooseTarget (segment, enemies, player, camera, trainerBattle, rng) {
    const z = Math.max(0.1, camera && camera.z || 1);
    const halfW = VIEW.W / (2 * z) + 72;
    const halfH = VIEW.H / (2 * z) + 72;
    let priority = 0;
    let seen = 0;
    let target = -1;
    for (let i = 0; i < enemies.n; i++) {
        if (enemies.dead[i] || i === enemies.aimedCaptureTarget
            || (enemies.legendaryReady && enemies.legendaryReady[i])) continue;
        if (Math.abs(enemies.x[i] - player.x) > halfW || Math.abs(enemies.y[i] - player.y) > halfH) continue;
        let rank = 1;
        if (trainerBattle) {
            if (!enemies.trainer[i]) continue;
            rank = 4;
        } else if (enemies.boss[i]) rank = 3;
        else if (enemies.elite[i]) rank = 2;
        if (rank > priority) {
            priority = rank;
            seen = 1;
            target = i;
        } else if (rank === priority && rng.int(1, ++seen) === 1) target = i;
    }
    if (target < 0) return null;
    const sub = isSubLegendaryCompanion(segment);
    const radius = sub
        ? Math.min(94, 70 + Math.log2(Math.max(1, segment.count || 1)) * 6)
        : Math.min(158, 118 + Math.log2(Math.max(1, segment.count || 1)) * 9);
    const scatter = radius * 0.32;
    return {
        x: enemies.x[target] + rng.range(-scatter, scatter),
        y: enemies.y[target] + rng.range(-scatter, scatter),
        radius,
    };
}

const circle = (x, y, radius) => ({ x, y, radius, damageMul: BASE_DAMAGE });
const corridor = (x, y, length, width, angle) => ({ x, y, length, width, angle, damageMul: BASE_DAMAGE });

function layoutFor (fam, player, target) {
    const signature = companionSignatureForFamily(fam);
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const angle = Math.atan2(dy, dx);
    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);
    const towardX = Math.cos(angle);
    const towardY = Math.sin(angle);
    const areas = [];
    const corridors = [];
    const addArea = (x, y, radius) => areas.push(circle(x, y, radius));

    switch (signature.pattern) {
    case 'sub-ice-lance':
        corridors.push(corridor(target.x - towardX * 118, target.y - towardY * 118, 236, 30, angle));
        break;
    case 'sub-branching-bolt':
        // Two short, aimed branches cross at the marked target instead of becoming a screen-spanning chain.
        corridors.push(corridor(target.x - towardX * 58, target.y - towardY * 58, 116, 23, angle));
        corridors.push(corridor(target.x - perpX * 52 - towardX * 40,
            target.y - perpY * 52 - towardY * 40, 104, 23, Math.atan2(perpY + towardY * 0.8, perpX + towardX * 0.8)));
        addArea(target.x, target.y, 25);
        break;
    case 'sub-falling-feathers':
        for (const offset of [-38, 0, 38]) {
            addArea(target.x + perpX * offset, target.y + perpY * offset, 27);
        }
        break;
    case 'sub-crossing-claws':
        for (const offset of [-0.57, 0.57]) {
            const strikeAngle = angle + offset;
            corridors.push(corridor(target.x - Math.cos(strikeAngle) * 86,
                target.y - Math.sin(strikeAngle) * 86, 172, 28, strikeAngle));
        }
        break;
    case 'sub-mane-stomp':
        addArea(target.x, target.y, 54);
        break;
    case 'sub-rising-tide':
        for (const side of [-1, 1]) {
            const startX = target.x + perpX * side * 74 - towardX * 82;
            const startY = target.y + perpY * side * 74 - towardY * 82;
            const endAngle = Math.atan2(target.y - startY, target.x - startX);
            corridors.push(corridor(startX, startY, 110, 26, endAngle));
        }
        addArea(target.x, target.y, 30);
        break;
    case 'psychic-burst':
        // A heavy psychic core with four displaced pressure blooms, rather than a plain circle.
        addArea(target.x, target.y, 104);
        for (let i = 0; i < 4; i++) {
            const a = angle + i * Math.PI / 2 + Math.PI / 4;
            addArea(target.x + Math.cos(a) * 88, target.y + Math.sin(a) * 88, 52);
        }
        break;
    case 'aeroblast':
        // Lugia sends three broad sea-air lanes downrange.
        for (const offset of [-66, 0, 66]) {
            corridors.push(corridor(
                player.x + perpX * offset,
                player.y + perpY * offset,
                Math.hypot(dx, dy) + 106,
                56,
                angle,
            ));
        }
        break;
    case 'sacred-fire':
        // A phoenix-shaped rain of flame lands around the target cluster.
        addArea(target.x, target.y, 60);
        for (let i = 0; i < 4; i++) {
            const a = angle + i * Math.PI / 2;
            addArea(target.x + Math.cos(a) * 92, target.y + Math.sin(a) * 92, 48);
        }
        break;
    case 'dragon-ascent':
        // Rayquaza dives through one narrow lane and detonates at the locked landing point.
        corridors.push(corridor(
            target.x - towardX * 280,
            target.y - towardY * 280,
            384,
            70,
            angle,
        ));
        addArea(target.x, target.y, 98);
        break;
    case 'origin-pulse':
        // Three pressurized origin pulses step across the battlefield.
        for (const offset of [-92, 0, 92]) {
            addArea(target.x + perpX * offset, target.y + perpY * offset, 72);
        }
        break;
    case 'precipice-blades':
        // A row of rising blades cuts across the enemy formation.
        for (const offset of [-118, -59, 0, 59, 118]) {
            addArea(target.x + perpX * offset, target.y + perpY * offset, 43);
        }
        break;
    case 'roar-of-time':
        // A thin, long time beam with two temporal anchors at its far end.
        corridors.push(corridor(player.x, player.y, Math.hypot(dx, dy) + 56, 34, angle));
        addArea(target.x - towardX * 30, target.y - towardY * 30, 48);
        addArea(target.x + towardX * 30, target.y + towardY * 30, 48);
        break;
    case 'spacial-rend':
        // Two orthogonal rifts tear open around the selected enemy group.
        corridors.push(corridor(target.x - 154, target.y, 308, 48, 0.68));
        corridors.push(corridor(target.x - 154, target.y, 308, 48, -0.68));
        break;
    case 'judgment':
        // A central judgment strike surrounded by four descending star points.
        addArea(target.x, target.y, 70);
        for (let i = 0; i < 4; i++) {
            const a = angle + i * Math.PI / 2;
            addArea(target.x + Math.cos(a) * 100, target.y + Math.sin(a) * 100, 43);
        }
        break;
    }
    return { ...signature, angle, areas, corridors };
}

function collectBestDamage (damageByEnemy, overlaps, damageMul) {
    for (const [i, multiplier] of overlaps) {
        const previous = damageByEnemy.get(i) || 0;
        damageByEnemy.set(i, Math.max(previous, multiplier * damageMul));
    }
}

/** Resolve a signature pattern once per enemy; overlapping waves never multiply-dip damage. */
function hitPattern (enemies, attack, damage) {
    const damageByEnemy = new Map();
    const query = enemies._q;
    for (const area of attack.areas) {
        const nearby = enemies.grid.query(area.x, area.y, area.radius + MAX_BODY_R, query);
        const overlaps = [];
        for (const i of nearby) {
            if (enemies.dead[i]) continue;
            if (Math.hypot(enemies.x[i] - area.x, enemies.y[i] - area.y) <= area.radius + enemies.r[i]) {
                overlaps.push([i, area.damageMul]);
            }
        }
        collectBestDamage(damageByEnemy, overlaps, 1);
    }
    for (const beam of attack.corridors) {
        const ux = Math.cos(beam.angle);
        const uy = Math.sin(beam.angle);
        const halfW = beam.width * 0.5;
        const endX = beam.x + ux * beam.length;
        const endY = beam.y + uy * beam.length;
        const midX = (beam.x + endX) * 0.5;
        const midY = (beam.y + endY) * 0.5;
        const nearby = enemies.grid.query(midX, midY,
            Math.hypot(beam.length * 0.5, halfW) + MAX_BODY_R, query);
        const overlaps = [];
        for (const i of nearby) {
            if (enemies.dead[i]) continue;
            const dx = enemies.x[i] - beam.x;
            const dy = enemies.y[i] - beam.y;
            const along = dx * ux + dy * uy;
            const across = -dx * uy + dy * ux;
            const nearAlong = Math.max(0, Math.min(beam.length, along));
            const nearAcross = Math.max(-halfW, Math.min(halfW, across));
            if (Math.hypot(along - nearAlong, across - nearAcross) <= enemies.r[i]) {
                overlaps.push([i, beam.damageMul]);
            }
        }
        collectBestDamage(damageByEnemy, overlaps, 1);
    }

    let hits = 0;
    let kills = 0;
    for (const [i, multiplier] of damageByEnemy) {
        const before = enemies.hp[i];
        const defeated = enemies.hurt(i, damage * multiplier);
        if (enemies.hp[i] < before) hits++;
        if (defeated) kills++;
    }
    return { hits, kills };
}

/** Each caught legendary charges and releases its own signature move with a readable ground telegraph. */
export function stepLegendaryCompanionAttacks ({
    segments, enemies, player, camera, trainerBattle, dt, rng, damageMul = 1, onImpact,
}) {
    let impacts = 0;
    let ordinal = 0;
    for (const segment of segments) {
        if (!hasCompanionSignature(segment)) continue;
        let attack = segment.legendaryBombardment;
        if (!attack) {
            attack = segment.legendaryBombardment = {
                phase: 'cooldown', timer: rng.range(1.1, 2.4) + (ordinal % 3) * 0.32,
                x: 0, y: 0, radius: 0,
            };
        }
        ordinal++;
        attack.timer -= dt;
        if (attack.phase === 'cooldown') {
            if (attack.timer > 0) continue;
            const target = chooseTarget(segment, enemies, player, camera, trainerBattle, rng);
            if (!target) { attack.timer = 0.65; continue; }
            const layout = layoutFor(segment.fam, player, target);
            attack.phase = 'warning';
            attack.timer = WARNING_SECONDS;
            attack.x = target.x;
            attack.y = target.y;
            attack.radius = target.radius;
            attack.move = layout.move;
            attack.pattern = layout.pattern;
            attack.color = layout.color;
            attack.angle = layout.angle;
            attack.areas = layout.areas;
            attack.corridors = layout.corridors;
            continue;
        }
        if (attack.phase === 'warning') {
            if (attack.timer > 0) continue;
            const damage = segDps(segment) * damageMul;
            const result = hitPattern(enemies, attack, damage);
            attack.phase = 'impact';
            attack.timer = IMPACT_SECONDS;
            if (onImpact) onImpact(segment, attack, result, damage * BASE_DAMAGE);
            impacts++;
            continue;
        }
        if (attack.phase === 'impact' && attack.timer <= 0) {
            attack.phase = 'cooldown';
            // The extra visual aftermath occupies cooldown time, preserving the attack cadence.
            attack.timer = rng.range(2.62, 3.82);
            delete attack.areas;
            delete attack.corridors;
        }
    }
    return impacts;
}
