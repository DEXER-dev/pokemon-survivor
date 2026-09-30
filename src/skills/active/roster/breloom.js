import { hitArea, lateDamageMultiplier, segDps } from '../../../combat.js';

export const FORM = Object.freeze({
    id: 'roster-breloom', fam: 'shroomish', tier: 2, name: '斗笠菇', category: '宝可梦主动技',
    icon: 'BRELOOM', color: '#9ce65c', glyph: 'leaf', effectStyle: 'nature', rosterActive: true,
});

export default Object.freeze({
    name: '孢子禁区', shape: 'spore-field', radius: 205, power: 5.8,
    rootDuration: 3.2, cooldown: 17, effectDuration: 1.05,
});

/** Burst a target zone, damage its occupants, then pin ordinary enemies in place with spore roots. */
export function cast (game, seg, form, skill, x, y) {
    const damage = segDps(seg) * game.build.dmg * lateDamageMultiplier(game.level) * skill.power;
    const result = hitArea(game.enemies, x, y, skill.radius, damage);
    const candidates = game.enemies.grid.query(x, y, skill.radius, game.enemies._q);
    let rooted = 0;
    for (const i of candidates) {
        const enemy = game.enemies;
        if (enemy.dead[i] || Math.hypot(enemy.x[i] - x, enemy.y[i] - y) > skill.radius + enemy.r[i]) continue;
        if (enemy.boss[i] || enemy.trainer[i]) continue;
        enemy.entangle(i, skill.rootDuration);
        rooted++;
    }
    seg.megaSkillCd = skill.cooldown;
    game.logEvent('roster.skill-used', { form: form.id, species: seg.fam, skill: skill.name,
        x: Math.round(x), y: Math.round(y), radius: skill.radius, rooted,
        damage: Math.round(damage), hits: result.hits, kills: result.kills });
    game.megaSkillFx(form, x, y, skill.radius, { shape: skill.shape, duration: skill.effectDuration });
    game.particleBursts.burst(seg.fam, x, y, 0, 'mega-skill', form.id);
    game.wave(x, y, 10, skill.radius, 0.7, form.color);
    game.kick(0.2);
    game.say(`斗笠菇「孢子禁区」命中 ${result.hits} 只 · 缠根 ${rooted} 只，定身 ${skill.rootDuration} 秒`, 2.8);
    return true;
}

export function drawPreview (game, g, form, skill, ready, pulse) {
    const { x, y } = game.aimWorld;
    g.fillColor = game.pal.get('#91df55', ready ? 31 + pulse * 16 : 18);
    g.circle(x, y, skill.radius);
    g.fill();
    g.strokeColor = game.pal.get(ready ? '#e3ff9b' : form.color, ready ? 230 : 115);
    g.lineWidth = ready ? 3.5 : 2.2;
    g.circle(x, y, skill.radius);
    g.stroke();
    g.strokeColor = game.pal.get('#dcffc2', ready ? 155 : 72);
    g.lineWidth = 1.5;
    g.circle(x, y, skill.radius * 0.72);
    g.stroke();
}

export function drawEffect (game, batch, fx, skill, style) {
    // Native leaf/spore motes carry the field animation; keep only the true damage boundary.
    const fade = Math.max(18, Math.round(42 * (1 - Math.min(1, fx.age / fx.duration))));
    batch.draw('ring', fx.x, fx.y, skill.radius / 24, skill.radius / 24, 0,
        game.pal.get(fx.form.color, fade), false, style(fx.form));
}
