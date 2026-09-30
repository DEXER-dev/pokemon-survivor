/*
 * Contact and damage accounting. Runtime party damage is handled by SkillSystem; `sweep` below remains
 * only as a reference arm for the headless budget-conservation probe and is not called by the game.
 */
import { CHAIN, DPS, DMG_EXPONENT, SKILLS, SKILL_SHARE, BOSS, MAX_BODY_R } from './config.js';
import { pointInHeart } from './heart-shape.js';

/** §5.4: 段DPS = 单只DPS(阶) × count^0.65. The exponent is the only thing keeping "抓不完" legal. */
export const segDps = (seg) => DPS[Math.min(DPS.length - 1, seg.tier - 1)] * Math.pow(seg.count, DMG_EXPONENT);

/**
 * Late-run momentum: enemy HP is priced from nominal party DPS, so this level-based multiplier is
 * deliberately applied only to delivered attacks. It gives long runs a real way to cut through the
 * growing horde without the spawn-time HP formula cancelling the buff back out.
 */
export const lateDamageMultiplier = (level) => 1 + Math.min(2.5, Math.max(0, level - 30) * 0.025);

/** Resolve one aimed area burst through the same enemy damage path used by ordinary attacks. */
export function hitArea (enemies, x, y, radius, damage) {
    let hits = 0;
    let kills = 0;
    const candidates = enemies.grid.query(x, y, radius + MAX_BODY_R, enemies._q);
    for (let k = 0; k < candidates.length; k++) {
        const i = candidates[k];
        if (enemies.dead[i] || Math.hypot(enemies.x[i] - x, enemies.y[i] - y) > radius + enemies.r[i]) continue;
        const before = enemies.hp[i];
        const defeated = enemies.hurt(i, damage);
        if (enemies.hp[i] < before) hits++;
        if (defeated) kills++;
    }
    return { hits, kills };
}

/** Apply an aimed heart-shaped area burst, including the enemy body's collision radius. */
export function hitHeart (enemies, x, y, radius, damage) {
    let hits = 0;
    let kills = 0;
    const candidates = enemies.grid.query(x, y, radius * 1.42 + MAX_BODY_R, enemies._q);
    for (let k = 0; k < candidates.length; k++) {
        const i = candidates[k];
        if (enemies.dead[i]
            || !pointInHeart(enemies.x[i] - x, enemies.y[i] - y,
                radius + enemies.r[i], radius + enemies.r[i])) continue;
        const before = enemies.hp[i];
        const defeated = enemies.hurt(i, damage);
        if (enemies.hp[i] < before) hits++;
        if (defeated) kills++;
    }
    return { hits, kills };
}

/** Hit bodies overlapping a forward-facing rectangle, including their circular collision radius. */
export function hitRect (enemies, x, y, length, width, angle, damage) {
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const halfW = width * 0.5;
    const mx = x + ux * length * 0.5;
    const my = y + uy * length * 0.5;
    const candidates = enemies.grid.query(mx, my,
        Math.hypot(length * 0.5, halfW) + MAX_BODY_R, enemies._q);
    let hits = 0;
    let kills = 0;
    for (let k = 0; k < candidates.length; k++) {
        const i = candidates[k];
        if (enemies.dead[i]) continue;
        const dx = enemies.x[i] - x;
        const dy = enemies.y[i] - y;
        const along = dx * ux + dy * uy;
        const across = -dx * uy + dy * ux;
        const nearAlong = Math.max(0, Math.min(length, along));
        const nearAcross = Math.max(-halfW, Math.min(halfW, across));
        const da = along - nearAlong;
        const dc = across - nearAcross;
        if (da * da + dc * dc > enemies.r[i] * enemies.r[i]) continue;
        const before = enemies.hp[i];
        const defeated = enemies.hurt(i, damage);
        if (enemies.hp[i] < before) hits++;
        if (defeated) kills++;
    }
    return { hits, kills };
}

/** §5.7-E: a family with no entry here has no 主技, so it must keep 100% of its budget in the tail. */
export const hasSkill = (seg) => !!SKILLS[seg.fam];

/** The share of this segment's DPS assigned to its signature move (currently the full budget). */
export const skillShare = (seg) => (hasSkill(seg) ? SKILL_SHARE[seg.kind] || 0 : 0);

/** Nominal output, without the 甩尾 bonus — the number the horde tunes itself against. */
export const chainDps = (chain) => chain.segments.reduce((a, s) => a + segDps(s), 0);

/**
 * §5.5-B's per-node whip multiplier. Shared with 主技 (§5.7-A-2): the bank withholds a fraction of what
 * the tail *actually* deals, so the two sides must read the same bonus off the same `nspd`.
 */
export const nodeBonus = (chain, i, ref) => 1 + 0.8 * Math.max(0, Math.min(1, chain.nspd[i] / ref - 1));

export class CombatSystem {
    constructor (enemyCfg, playerCfg) {
        this.enemy = enemyCfg;
        this.player = playerCfg;
        this._q = [];
    }

    /** §5.4: mob contact damage climbs +8%/min, so late game punishes a standstill without new verbs. */
    /** 咬伤按体型算：小怪咬得轻（×0.7），3 阶咬得重（×1.3）——杂兵海不再是绞肉机。 */
    bite (minute, elite, boss = 0, tier = 1) {
        const tierMul = 0.55 + 0.25 * (tier - 1);
        return this.player.bite * (1 + 0.08 * minute) * tierMul
            * (boss ? BOSS.bite : elite ? 2 : 1);
    }

    /**
     * §5.5-C: enemies only ever hit the hero body. This reports that something touched - the size of
     * the hit is the hero's call, because the i-frame window is what makes a pile-up survivable.
     * Weakened elites are inert, so the capture window really is safe.
     */
    contact (enemies, px, py) {
        const q = this._q;
        const reach = this.player.radius + this.enemy.radius;
        let hits = 0;
        let elite = 0;
        let boss = 0;
        let tier = 1;
        q.length = 0;
        enemies.grid.query(px, py, reach + MAX_BODY_R, q);
        for (let k = 0; k < q.length; k++) {
            const j = q[k];
            if (enemies.dead[j] || enemies.weaken[j] > 0 || enemies.trainer[j]
                || (enemies.trainerActive && !enemies.trainer[j])
                || (enemies.wildBossReady && enemies.wildBossReady[j])
                || (enemies.legendary && enemies.legendary[j])
                || (enemies.legendaryReady && enemies.legendaryReady[j])) continue;
            const dx = enemies.x[j] - px;
            const dy = enemies.y[j] - py;
            const rr = reach + enemies.r[j];
            if (dx * dx + dy * dy > rr * rr) continue;
            hits++;
            if (enemies.elite[j]) elite = 1;
            if (enemies.boss[j]) boss = 1;
            // 咬伤由在场最大体型决定：一只大怪混进杂兵海，疼的是它而不是小怪们。
            if (enemies.tier[j] > tier) tier = enemies.tier[j];
        }
        return { hits, elite, boss, tier };
    }
}
