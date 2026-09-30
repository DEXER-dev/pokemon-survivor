import { hitArea, hitRect, lateDamageMultiplier, segDps } from '../../../combat.js';

export const FORM = Object.freeze({
    id: 'roster-archeops', fam: 'archen', tier: 2, name: '始祖大鸟', category: '宝可梦主动技',
    icon: 'ARCHEOPS', color: '#f0a253', glyph: 'feather', effectStyle: 'crystal', rosterActive: true,
});

export default Object.freeze({
    name: '化石俯冲', shape: 'dive-line', range: 460, width: 118,
    radius: 76, power: 5.1, impactPower: 3.4, rootDuration: 1.1,
    cooldown: 15, effectDuration: 0.95,
});

/** Strike a wide aimed flight lane, then detonate a second impact burst and briefly stagger survivors. */
export function cast (game, seg, form, skill, targetX, targetY) {
    const origin = game.skillOrigin(seg);
    const dx = targetX - origin.x;
    const dy = targetY - origin.y;
    const angle = Math.atan2(dy, dx);
    const length = Math.min(skill.range, Math.max(150, Math.hypot(dx, dy)));
    const endX = origin.x + Math.cos(angle) * length;
    const endY = origin.y + Math.sin(angle) * length;
    const baseDamage = segDps(seg) * game.build.dmg * lateDamageMultiplier(game.level);
    const lane = hitRect(game.enemies, origin.x, origin.y, length, skill.width, angle,
        baseDamage * skill.power);
    const impact = hitArea(game.enemies, endX, endY, skill.radius,
        baseDamage * skill.impactPower);
    const candidates = game.enemies.grid.query(endX, endY, skill.radius, game.enemies._q);
    let staggered = 0;
    for (const i of candidates) {
        const enemy = game.enemies;
        if (enemy.dead[i] || enemy.boss[i] || enemy.trainer[i]
            || Math.hypot(enemy.x[i] - endX, enemy.y[i] - endY) > skill.radius + enemy.r[i]) continue;
        enemy.entangle(i, skill.rootDuration);
        staggered++;
    }
    seg.megaSkillCd = skill.cooldown;
    game.logEvent('roster.skill-used', { form: form.id, species: seg.fam, skill: skill.name,
        x: Math.round(origin.x), y: Math.round(origin.y), endX: Math.round(endX), endY: Math.round(endY),
        angle: Number(angle.toFixed(3)), length, width: skill.width,
        laneHits: lane.hits, impactHits: impact.hits, kills: lane.kills + impact.kills, staggered });
    game.megaSkillFx(form, origin.x, origin.y, length,
        { shape: skill.shape, duration: skill.effectDuration, angle, width: skill.width, endX, endY });
    game.particleBursts.burst(seg.fam, endX, endY, angle, 'mega-skill', form.id);
    game.wave(endX, endY, 12, skill.radius, 0.62, form.color);
    game.kick(0.28);
    game.say(`始祖大鸟「化石俯冲」扫过 ${lane.hits} 只 · 落点爆击 ${impact.hits} 只`, 2.8);
    return true;
}

export function drawPreview (game, g, form, skill, ready, pulse) {
    const origin = game.skillOrigin(game.selectedMega);
    const dx = game.aimWorld.x - origin.x;
    const dy = game.aimWorld.y - origin.y;
    const angle = Math.atan2(dy, dx);
    const distance = Math.min(skill.range, Math.max(150, Math.hypot(dx, dy)));
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const nx = -uy;
    const ny = ux;
    const endX = origin.x + ux * distance;
    const endY = origin.y + uy * distance;
    const half = skill.width * 0.5;
    g.fillColor = game.pal.get('#efa04f', ready ? 24 + pulse * 15 : 15);
    g.moveTo(origin.x + nx * half, origin.y + ny * half);
    g.lineTo(endX + nx * half, endY + ny * half);
    g.lineTo(endX - nx * half, endY - ny * half);
    g.lineTo(origin.x - nx * half, origin.y - ny * half);
    g.close();
    g.fill();
    g.strokeColor = game.pal.get(ready ? '#fff0bd' : form.color, ready ? 225 : 108);
    g.lineWidth = ready ? 3 : 2;
    g.moveTo(origin.x + nx * half, origin.y + ny * half);
    g.lineTo(endX + nx * half, endY + ny * half);
    g.lineTo(endX - nx * half, endY - ny * half);
    g.lineTo(origin.x - nx * half, origin.y - ny * half);
    g.close();
    g.stroke();
    g.strokeColor = game.pal.get('#fff2c4', ready ? 225 : 100);
    g.lineWidth = 2;
    g.circle(endX, endY, skill.radius);
    g.stroke();
}

export function drawEffect (game, batch, fx, skill, style) {
    const t = Math.min(1, fx.age / fx.duration);
    const fade = Math.round(240 * (1 - t));
    const ux = Math.cos(fx.angle);
    const uy = Math.sin(fx.angle);
    const nx = -uy;
    const ny = ux;
    const effectStyle = style(fx.form);
    const endX = fx.endX ?? fx.x + ux * fx.radius;
    const endY = fx.endY ?? fx.y + uy * fx.radius;
    batch.draw('beam', fx.x + ux * fx.radius * 0.5, fx.y + uy * fx.radius * 0.5,
        fx.radius / 24, skill.width / 24, fx.angle,
        game.pal.get('#f2a04d', Math.round(92 * (1 - t))), false, effectStyle);
    for (let i = -1; i <= 1; i++) {
        const offset = i * skill.width * 0.23;
        batch.draw('feather', endX + nx * offset, endY + ny * offset,
            2.3 * (1 - t * 0.3), 1.25, fx.angle + i * 0.16,
            game.pal.get(i ? '#f8ca72' : '#fff1b0', fade), false, effectStyle);
    }
    const radius = skill.radius * (0.48 + t * 0.52);
    batch.draw('ring', endX, endY, radius / 24, radius / 24, fx.angle + t * 2,
        game.pal.get('#fff0b4', fade), false, effectStyle);
    batch.draw('aura', endX, endY, radius / 24, radius / 24, 0,
        game.pal.get('#ed9951', Math.round(90 * (1 - t))), false, effectStyle);
}
