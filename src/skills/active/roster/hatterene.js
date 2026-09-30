import { hitHeart, lateDamageMultiplier, segDps } from '../../../combat.js';
import { traceHeart } from '../../../heart-shape.js';

export const FORM = Object.freeze({
    id: 'roster-hatterene', fam: 'hatenna', tier: 3, name: '布莉姆温', category: '宝可梦主动技',
    icon: 'HATTERENE', color: '#dc8bea', glyph: 'heart', effectStyle: 'psychic', rosterActive: true,
});

export default Object.freeze({
    name: '治愈心域', shape: 'heart-heal', radius: 192, power: 7.2,
    healPerHit: 0.02, healCap: 0.18, cooldown: 19, effectDuration: 1.12,
});

/** A heart-shaped psychic blast heals the trainer for each enemy it reaches, up to a safe cap. */
export function cast (game, seg, form, skill, x, y) {
    const damage = segDps(seg) * game.build.dmg * lateDamageMultiplier(game.level) * skill.power;
    const result = hitHeart(game.enemies, x, y, skill.radius, damage);
    const heal = Math.min(game.player.maxhp * skill.healCap,
        game.player.maxhp * result.hits * skill.healPerHit,
        game.player.maxhp - game.player.hp);
    game.player.hp += Math.max(0, heal);
    seg.megaSkillCd = skill.cooldown;
    game.logEvent('roster.skill-used', { form: form.id, species: seg.fam, skill: skill.name,
        x: Math.round(x), y: Math.round(y), radius: skill.radius,
        damage: Math.round(damage), hits: result.hits, kills: result.kills, healed: Math.round(heal) });
    game.megaSkillFx(form, x, y, skill.radius, { shape: skill.shape, duration: skill.effectDuration });
    game.particleBursts.burst(seg.fam, x, y, 0, 'mega-skill', form.id);
    game.wave(x, y, 10, skill.radius, 0.73, form.color);
    game.kick(0.18);
    game.say(`布莉姆温「治愈心域」命中 ${result.hits} 只 · 回复 ${Math.round(heal)} HP`, 2.8);
    return true;
}

export function drawPreview (game, g, form, skill, ready, pulse) {
    const { x, y } = game.aimWorld;
    const alpha = ready ? 34 + pulse * 18 : 19;
    g.fillColor = game.pal.get('#e792f5', alpha);
    traceHeart(g, x, y, skill.radius, skill.radius);
    g.fill();
    g.strokeColor = game.pal.get(ready ? '#fff1ff' : form.color, ready ? 235 : 120);
    g.lineWidth = ready ? 3.5 : 2.2;
    traceHeart(g, x, y, skill.radius, skill.radius);
    g.stroke();
    g.strokeColor = game.pal.get('#ffc9ff', ready ? 150 : 74);
    g.lineWidth = 1.4;
    traceHeart(g, x, y, skill.radius * 0.82, skill.radius * 0.82);
    g.stroke();
}

export function drawEffect (game, batch, fx, skill, style) {
    // Heart-shaped particle motes follow the hitHeart boundary; this faint silhouette only anchors it.
    const fade = Math.max(20, Math.round(38 * (1 - Math.min(1, fx.age / fx.duration))));
    const effectStyle = style(fx.form);
    batch.draw('heart', fx.x, fx.y, skill.radius / 24, skill.radius / 24, 0,
        game.pal.get(fx.form.color, fade), false, effectStyle);
}
