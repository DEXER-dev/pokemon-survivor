export const FORM = {
    id: 'cinderace', fam: 'scorbunny', tier: 3, name: '超极巨闪焰王牌', label: '超极巨化 · 闪焰王牌',
    icon: 'CINDERACE_gmax', color: '#ff7959', glyph: 'ember', size: 1.78,
};
export default Object.freeze({
    name: '超极巨烈焰球', shape: 'directional-fireball', range: 620, radius: 54,
    speed: 520, power: 12.5, cooldown: 18, visual: 'pyroball', pattern: 2, motifs: 14,
});

import { MAX_BODY_R } from '../../../config.js';
import { lateDamageMultiplier, segDps } from '../../../combat.js';

/** Launch a single large Pyro Ball along the player's current aim direction. */
export function cast (game, seg, form, skill, targetX, targetY) {
    const origin = game.skillOrigin(seg);
    const dx = targetX - origin.x;
    const dy = targetY - origin.y;
    const angle = Math.hypot(dx, dy) > 1e-5 ? Math.atan2(dy, dx) : 0;
    const duration = skill.range / skill.speed;

    seg.megaSkillCd = skill.cooldown;
    seg.megaSkillActive = duration;
    seg.megaSkillElapsed = 0;
    seg.megaSkillX = origin.x;
    seg.megaSkillY = origin.y;
    seg.megaSkillAngle = angle;
    seg.megaSkillTravelled = 0;
    seg.megaSkillHits = 0;
    seg.megaSkillKills = 0;
    seg.megaSkillHitSet = new Set();
    seg.megaSkillQuery = [];
    seg.megaSkillFx = game.megaSkillFx(form, origin.x, origin.y, skill.radius,
        { shape: 'directional-fireball', angle, duration });

    game.logEvent('gigantamax.skill-used', {
        form: form.id, species: seg.fam, skill: skill.name,
        x: Math.round(origin.x), y: Math.round(origin.y), angle: Number(angle.toFixed(3)),
        range: skill.range, radius: skill.radius, damage: Math.round(
            segDps(seg) * game.build.dmg * lateDamageMultiplier(game.level) * skill.power),
    });
    game.particleBursts.burst(seg.fam, origin.x, origin.y, angle, 'mega-skill', form.id);
    game.kick(0.22);
    game.say(`超极巨闪焰王牌放出「${skill.name}」· 朝准星方向飞行`, 2.6);
    return true;
}

/** Sweep the fireball's circular footprint between its previous and next positions. */
export function step (game, seg, dt, form, skill) {
    if (!(seg.megaSkillActive > 0)) return;
    const previousX = seg.megaSkillX;
    const previousY = seg.megaSkillY;
    const stepDistance = Math.min(skill.speed * dt, skill.range - seg.megaSkillTravelled);
    const ux = Math.cos(seg.megaSkillAngle);
    const uy = Math.sin(seg.megaSkillAngle);
    const nextX = previousX + ux * stepDistance;
    const nextY = previousY + uy * stepDistance;
    const midX = (previousX + nextX) * 0.5;
    const midY = (previousY + nextY) * 0.5;
    const candidates = seg.megaSkillQuery;
    game.enemies.grid.query(midX, midY, stepDistance * 0.5 + skill.radius + MAX_BODY_R, candidates);
    const vx = nextX - previousX;
    const vy = nextY - previousY;
    const lengthSq = vx * vx + vy * vy;
    const damage = segDps(seg) * game.build.dmg * lateDamageMultiplier(game.level) * skill.power;

    for (let k = 0; k < candidates.length; k++) {
        const index = candidates[k];
        if (seg.megaSkillHitSet.has(index) || game.enemies.dead[index]) continue;
        const ox = game.enemies.x[index] - previousX;
        const oy = game.enemies.y[index] - previousY;
        const t = lengthSq > 1e-8 ? Math.max(0, Math.min(1, (ox * vx + oy * vy) / lengthSq)) : 0;
        const px = previousX + vx * t;
        const py = previousY + vy * t;
        const dx = game.enemies.x[index] - px;
        const dy = game.enemies.y[index] - py;
        const hitRadius = skill.radius + game.enemies.r[index];
        if (dx * dx + dy * dy > hitRadius * hitRadius) continue;

        seg.megaSkillHitSet.add(index);
        seg.megaSkillHits++;
        const wasDead = !!game.enemies.dead[index];
        game.enemies.hurt(index, damage);
        if (!wasDead && game.enemies.dead[index]) seg.megaSkillKills++;
    }

    seg.megaSkillX = nextX;
    seg.megaSkillY = nextY;
    seg.megaSkillTravelled += stepDistance;
    seg.megaSkillElapsed += dt;
    if (seg.megaSkillFx) {
        seg.megaSkillFx.x = nextX;
        seg.megaSkillFx.y = nextY;
        seg.megaSkillFx.angle = seg.megaSkillAngle;
    }
    seg.megaSkillActive = Math.max(0, seg.megaSkillActive - dt);

    if (seg.megaSkillActive <= 0 || seg.megaSkillTravelled >= skill.range) {
        seg.megaSkillActive = 0;
        game.logEvent('gigantamax.skill-ended', {
            form: form.id, hits: seg.megaSkillHits, kills: seg.megaSkillKills,
            distance: Math.round(seg.megaSkillTravelled),
        });
        game.say(`超极巨烈焰球消散 · 命中 ${seg.megaSkillHits} 只`, 1.8);
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
    const alpha = ready ? 46 : 24;

    g.fillColor = game.pal.get(form.color, alpha);
    g.moveTo(origin.x + px, origin.y + py);
    g.lineTo(ex + px, ey + py);
    g.lineTo(ex - px, ey - py);
    g.lineTo(origin.x - px, origin.y - py);
    g.lineTo(origin.x + px, origin.y + py);
    g.fill();
    g.strokeColor = game.pal.get(ready ? '#fff1b7' : form.color, ready ? 225 : 115);
    g.lineWidth = ready ? 3 : 2;
    g.moveTo(origin.x, origin.y);
    g.lineTo(ex, ey);
    g.stroke();
    g.fillColor = game.pal.get(form.color, ready ? 90 : 46);
    g.circle(ex, ey, skill.radius);
    g.fill();
    g.strokeColor = game.pal.get('#fff1b7', ready ? 230 : 115);
    g.lineWidth = ready ? 3 : 2;
    g.circle(ex, ey, skill.radius);
    g.stroke();
    g.fillColor = game.pal.get('#fff8df', ready ? 245 : 130);
    g.circle(ex, ey, ready ? 7 : 5);
    g.fill();
}

export function drawEffect (game, batch, fx, skill, megaEffectStyle) {
    // The moving fireball and its wake are emitted by NativeParticleBursts each frame.
}
