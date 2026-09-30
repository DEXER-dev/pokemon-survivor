import { COL, MAX_BODY_R } from '../../../config.js';
import { lateDamageMultiplier, segDps } from '../../../combat.js';

export const MEGA_FORM = {
    id: 'blaziken', fam: 'striker', label: '火焰鸡进化石', megaName: '超级火焰鸡',
    icon: 'BLAZIKEN_1', stone: 'BLAZIKENITE', color: '#ff705d', glyph: 'ember',
    shots: 7, spread: 0.42, volleyPower: 3.1, cooldown: 3.5,
};
export const SIGNATURE = Object.freeze({ orbit: 3, radius: 30, spin: 4.0, trails: 3, lance: 0.58 });
export const SKILL = Object.freeze({
    name: '闪焰冲锋', shape: 'charge-channel', duration: 10, range: 560, radius: 52,
    power: 1.15, hitInterval: 0.34, cooldown: 18,
    playerSpeed: 560, playerAccel: 72, trailInterval: 0.075,
    visual: 'blaze-charge', pattern: 1, motifs: 7,
});
export default SKILL;

/** While charging, continuously steer the actual player toward the live mouse reticle. */
export function playerDrive (game, seg, _dt, _form, skill) {
    if (!(seg.megaSkillActive > 0)) return null;
    const dx = game.aimWorld.x - game.player.x;
    const dy = game.aimWorld.y - game.player.y;
    if (dx * dx + dy * dy > 18 * 18) seg.megaSkillAngle = Math.atan2(dy, dx);
    return {
        x: Math.cos(seg.megaSkillAngle),
        y: Math.sin(seg.megaSkillAngle),
        speed: skill.playerSpeed,
        accel: skill.playerAccel,
    };
}

/** Begin a ten-second fiery dash; both the player and damage corridor follow the live reticle. */
export function cast (game, seg, form, skill, targetX, targetY) {
    const origin = game.skillOrigin(seg);
    const dx = targetX - origin.x;
    const dy = targetY - origin.y;
    seg.megaSkillAngle = Math.hypot(dx, dy) > 1e-5 ? Math.atan2(dy, dx) : 0;
    seg.megaSkillActive = skill.duration;
    seg.megaSkillCd = skill.cooldown;
    seg.megaSkillElapsed = 0;
    seg.megaSkillHits = 0;
    seg.megaSkillKills = 0;
    seg.blazikenPrevX = game.player.x;
    seg.blazikenPrevY = game.player.y;
    seg.blazikenHitTimes = new Map();
    seg.blazikenTrailClock = 0;
    seg.blazikenFx = game.megaSkillFx(form, game.player.x, game.player.y, skill.radius,
        { shape: 'blaziken-charge', angle: seg.megaSkillAngle, duration: skill.duration });
    game.particleBursts.burst(seg.fam, game.player.x, game.player.y, seg.megaSkillAngle,
        'mega-skill', form.id);

    game.logEvent('mega.skill-used', {
        form: form.id, species: seg.fam, skill: skill.name,
        x: Math.round(origin.x), y: Math.round(origin.y), angle: Number(seg.megaSkillAngle.toFixed(3)),
        range: skill.range, width: skill.radius * 2, duration: skill.duration,
    });
    game.kick(0.25);
    game.say(`超级火焰鸡发动「${skill.name}」· 火焰包覆冲锋，沿途灼伤精灵 · 鼠标实时转向 ${skill.duration} 秒`, 2.8);
    return true;
}

/** Sweep the player's actual movement segment with a capsule hitbox and leave a live flame trail. */
export function step (game, seg, dt, form, skill) {
    if (!(seg.megaSkillActive > 0)) return;
    const activeDt = Math.min(dt, seg.megaSkillActive);
    seg.megaSkillActive = Math.max(0, seg.megaSkillActive - dt);
    if (seg.megaSkillActive < 1e-8) seg.megaSkillActive = 0;
    seg.megaSkillElapsed += activeDt;
    const previousX = seg.blazikenPrevX;
    const previousY = seg.blazikenPrevY;
    const nextX = game.player.x;
    const nextY = game.player.y;
    const vx = nextX - previousX;
    const vy = nextY - previousY;
    const lengthSq = vx * vx + vy * vy;
    const enemies = game.enemies;
    const midX = (previousX + nextX) * 0.5;
    const midY = (previousY + nextY) * 0.5;
    const candidates = seg.blazikenQuery || (seg.blazikenQuery = []);
    enemies.grid.query(midX, midY, Math.sqrt(lengthSq) * 0.5 + skill.radius + MAX_BODY_R, candidates);
    const damage = segDps(seg) * game.build.dmg * lateDamageMultiplier(game.level)
        * skill.power * skill.hitInterval;
    for (let i = 0; i < candidates.length; i++) {
        const index = candidates[i];
        if (enemies.dead[index]) continue;
        const ox = enemies.x[index] - previousX;
        const oy = enemies.y[index] - previousY;
        const t = lengthSq > 1e-8 ? Math.max(0, Math.min(1, (ox * vx + oy * vy) / lengthSq)) : 0;
        const dx = enemies.x[index] - (previousX + vx * t);
        const dy = enemies.y[index] - (previousY + vy * t);
        const hitRadius = skill.radius + enemies.r[index];
        if (dx * dx + dy * dy > hitRadius * hitRadius) continue;
        const lastHit = seg.blazikenHitTimes.get(index);
        if (lastHit !== undefined && seg.megaSkillElapsed - lastHit < skill.hitInterval) continue;

        seg.blazikenHitTimes.set(index, seg.megaSkillElapsed);
        seg.megaSkillHits++;
        const wasDead = !!enemies.dead[index];
        enemies.hurt(index, damage);
        if (!wasDead && enemies.dead[index]) {
            seg.megaSkillKills++;
            game.particleBursts.burst(seg.fam, enemies.x[index], enemies.y[index], seg.megaSkillAngle,
                'mega-hit', form.id);
        }
    }
    seg.blazikenPrevX = nextX;
    seg.blazikenPrevY = nextY;

    if (seg.blazikenFx) {
        seg.blazikenFx.x = nextX;
        seg.blazikenFx.y = nextY;
        seg.blazikenFx.angle = seg.megaSkillAngle;
    }
    seg.blazikenTrailClock += activeDt;
    while (seg.blazikenTrailClock >= skill.trailInterval) {
        seg.blazikenTrailClock -= skill.trailInterval;
        const speed = Math.hypot(game.player.vx, game.player.vy);
        const angle = speed > 1 ? Math.atan2(game.player.vy, game.player.vx) : seg.megaSkillAngle;
        game.particleBursts.burst(seg.fam,
            nextX - Math.cos(angle) * skill.radius * 0.42,
            nextY - Math.sin(angle) * skill.radius * 0.42,
            angle, 'blaziken-charge-trail', form.id);
    }

    if (seg.megaSkillActive <= 0) {
        seg.megaSkillActive = 0;
        game.logEvent('mega.skill-channel-ended', {
            form: form.id, skill: skill.name, hits: seg.megaSkillHits,
            kills: seg.megaSkillKills, duration: skill.duration,
        });
        game.say(`闪焰冲锋结束 · 灼伤 ${seg.megaSkillHits} 次，击败 ${seg.megaSkillKills} 只`, 1.8);
        seg.blazikenFx = null;
    }
}

export function drawPreview (game, g, form, skill, ready) {
    const origin = game.skillOrigin(game.selectedMega);
    const dx = game.aimWorld.x - origin.x;
    const dy = game.aimWorld.y - origin.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const px = -uy * skill.radius;
    const py = ux * skill.radius;
    const ex = origin.x + ux * skill.range;
    const ey = origin.y + uy * skill.range;

    g.fillColor = game.pal.get(form.color, ready ? 43 : 23);
    g.moveTo(origin.x + px, origin.y + py);
    g.lineTo(ex + px, ey + py);
    g.lineTo(ex - px, ey - py);
    g.lineTo(origin.x - px, origin.y - py);
    g.lineTo(origin.x + px, origin.y + py);
    g.fill();
    g.strokeColor = game.pal.get(ready ? '#fff1b7' : form.color, ready ? 225 : 112);
    g.lineWidth = ready ? 3 : 2;
    g.moveTo(origin.x, origin.y);
    g.lineTo(ex, ey);
    g.stroke();
    g.fillColor = game.pal.get(form.color, ready ? 105 : 48);
    g.circle(ex, ey, skill.radius);
    g.fill();
    g.strokeColor = game.pal.get('#fff1b7', ready ? 235 : 120);
    g.lineWidth = ready ? 3 : 2;
    g.circle(ex, ey, skill.radius);
    g.stroke();
}

export function drawEffect (game, batch, fx, skill, megaEffectStyle) {
    // The firewake follows the live player position through bounded native particles.
}
