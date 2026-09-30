import { VIEW } from '../../../config.js';
import { hitArea, segDps } from '../../../combat.js';

const WARNING_SECONDS = 0.82;
const IMPACT_SECONDS = 0.22;

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
    const radius = Math.min(158, 118 + Math.log2(Math.max(1, segment.count || 1)) * 9);
    const scatter = radius * 0.32;
    return {
        x: enemies.x[target] + rng.range(-scatter, scatter),
        y: enemies.y[target] + rng.range(-scatter, scatter),
        radius,
    };
}

/** Each caught legendary locks a random enemy cluster, warns, then detonates once. */
export function stepLegendaryCompanionAttacks ({
    segments, enemies, player, camera, trainerBattle, dt, rng, damageMul = 1, onImpact,
}) {
    let impacts = 0;
    let ordinal = 0;
    for (const segment of segments) {
        if (!isLegendaryCompanion(segment)) continue;
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
            attack.phase = 'warning';
            attack.timer = WARNING_SECONDS;
            attack.x = target.x;
            attack.y = target.y;
            attack.radius = target.radius;
            continue;
        }
        if (attack.phase === 'warning') {
            if (attack.timer > 0) continue;
            const damage = segDps(segment) * damageMul * 1.35;
            const result = hitArea(enemies, attack.x, attack.y, attack.radius, damage);
            attack.phase = 'impact';
            attack.timer = IMPACT_SECONDS;
            if (onImpact) onImpact(segment, attack, result, damage);
            impacts++;
            continue;
        }
        if (attack.phase === 'impact' && attack.timer <= 0) {
            attack.phase = 'cooldown';
            attack.timer = rng.range(4.6, 5.8);
        }
    }
    return impacts;
}
