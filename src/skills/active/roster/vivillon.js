import { hitArea, lateDamageMultiplier, segDps } from '../../../combat.js';

export const FORM = Object.freeze({
    id: 'roster-vivillon', fam: 'vivillon', tier: 3, name: '彩粉蝶', category: '宝可梦主动技',
    icon: 'VIVILLON', color: '#e9a8da', glyph: 'feather', effectStyle: 'nature', rosterActive: true,
});

export default Object.freeze({
    name: '幻彩蝶舞', shape: 'pollen-garden', radius: 172, power: 5.6,
    rootDuration: 1.65, cooldown: 17, effectDuration: 1.2,
});

/** A butterfly-shaped powder burst hits the marked zone and briefly pins ordinary wilds. */
export function cast (game, seg, form, skill, x, y) {
    const damage = segDps(seg) * game.build.dmg * lateDamageMultiplier(game.level) * skill.power;
    const result = hitArea(game.enemies, x, y, skill.radius, damage);
    const candidates = game.enemies.grid.query(x, y, skill.radius, game.enemies._q);
    let drowsed = 0;
    for (const i of candidates) {
        const enemy = game.enemies;
        if (enemy.dead[i] || enemy.boss[i] || enemy.trainer[i]
            || Math.hypot(enemy.x[i] - x, enemy.y[i] - y) > skill.radius + enemy.r[i]) continue;
        enemy.entangle(i, skill.rootDuration);
        drowsed++;
    }
    seg.megaSkillCd = skill.cooldown;
    game.logEvent('roster.skill-used', { form: form.id, species: seg.fam, skill: skill.name,
        x: Math.round(x), y: Math.round(y), radius: skill.radius, drowsed,
        damage: Math.round(damage), hits: result.hits, kills: result.kills });
    game.megaSkillFx(form, x, y, skill.radius, { shape: skill.shape, duration: skill.effectDuration });
    game.particleBursts.burst(seg.fam, x, y, 0, 'vivillon-powder-cloud');
    game.particleBursts.burst(seg.fam, x, y, 0, 'vivillon-wing-burst');
    game.wave(x, y, 9, skill.radius, 0.72, form.color);
    game.kick(0.18);
    game.say(`彩粉蝶「幻彩蝶舞」命中 ${result.hits} 只 · 鳞粉缠住 ${drowsed} 只`, 2.8);
    return true;
}

export function drawPreview (game, g, form, skill, ready, pulse) {
    const { x, y } = game.aimWorld;
    const alpha = ready ? 34 + pulse * 17 : 18;
    g.fillColor = game.pal.get('#eab2df', alpha);
    g.circle(x, y, skill.radius);
    g.fill();
    g.strokeColor = game.pal.get(ready ? '#fff3c9' : form.color, ready ? 232 : 115);
    g.lineWidth = ready ? 3.2 : 2;
    g.circle(x, y, skill.radius);
    g.stroke();
    // Four scallops preview the butterfly silhouette rather than a generic targeting circle.
    for (let i = 0; i < 4; i++) {
        const angle = i * Math.PI / 2 + Math.PI / 4;
        const px = x + Math.cos(angle) * skill.radius * 0.7;
        const py = y + Math.sin(angle) * skill.radius * 0.7;
        g.strokeColor = game.pal.get(i % 2 ? '#b7eaff' : '#ffe6a8', ready ? 188 : 94);
        g.lineWidth = 2;
        g.circle(px, py, skill.radius * 0.22);
        g.stroke();
    }
    g.strokeColor = game.pal.get('#fff6d6', ready ? 210 : 100);
    g.lineWidth = 1.4;
    g.circle(x, y, skill.radius * 0.38);
    g.stroke();
}

export function drawEffect (game, batch, fx, skill, style) {
    // The sampled feather/pollen particles form the fluttering wing silhouette; show only its hit radius.
    const fade = Math.max(18, Math.round(38 * (1 - Math.min(1, fx.age / fx.duration))));
    batch.draw('ring', fx.x, fx.y, skill.radius / 24, skill.radius / 24, 0,
        game.pal.get(fx.form.color, fade), false, style(fx.form));
}
