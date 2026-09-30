import { MAX_BODY_R } from '../../../config.js';
import { hitHeart, lateDamageMultiplier, segDps } from '../../../combat.js';
import { traceHeart } from '../../../heart-shape.js';

export const MEGA_FORM = {
    id: 'gardevoir', fam: 'mystic', label: '沙奈朵进化石', megaName: '超级沙奈朵',
    icon: 'GARDEVOIR_1', stone: 'GARDEVOIRITE', color: '#ff91c8', glyph: 'crescent',
    shots: 6, spread: 0.36, volleyPower: 3.0, cooldown: 3.4,
};
export const SIGNATURE = Object.freeze({ orbit: 3, radius: 46, spin: -1.4, trails: 2, lance: 0.48 });
export default Object.freeze({ name: '爱心风暴', shape: 'heart', radius: 205, power: 7.5, cooldown: 14, visual: 'heartburst', pattern: 9, motifs: 8 });

/** Heart particles in the Mega trail preset provide this projectile's complete visual body. */
export function drawGardevoirProjectile () {}

export function castGardevoir (game, seg, form, skill, x, y) {
    const damage = segDps(seg) * game.build.dmg * lateDamageMultiplier(game.level) * skill.power;
    const { hits, kills } = hitHeart(game.enemies, x, y, skill.radius, damage);
    seg.megaSkillCd = skill.cooldown;
    const angle = Math.atan2(y - game.player.y, x - game.player.x);
    game.logEvent('mega.skill-used', { form: form.id, species: seg.fam, skill: skill.name,
        x: Math.round(x), y: Math.round(y), shape: 'heart', radius: skill.radius,
        damage: Math.round(damage), hits, kills });
    game.megaSkillFx(form, x, y, skill.radius,
        { shape: 'heart', duration: 0.96, angle });
    game.particleBursts.burst(seg.fam, x, y, angle, 'mega-skill', form.id);
    game.wave(x, y, 12, skill.radius, 0.72, form.color);
    game.kick(0.28);
    game.say(`${form.name || form.megaName} 使出「${skill.name}」· 心形范围命中 ${hits} 只`, 2.8);
    return true;
}

export function drawGardevoirPreview (game, g, form, skill, ready, pulse) {
    const alpha = ready ? Math.round(44 + pulse * 25) : 24;
    g.fillColor = game.pal.get(form.color, alpha);
    traceHeart(g, game.aimWorld.x, game.aimWorld.y, skill.radius, skill.radius);
    g.fill();
    g.strokeColor = game.pal.get(ready ? '#fff0f8' : form.color, ready ? 235 : 118);
    g.lineWidth = ready ? 4 : 2.5;
    traceHeart(g, game.aimWorld.x, game.aimWorld.y, skill.radius, skill.radius);
    g.stroke();
    g.strokeColor = game.pal.get('#ff9bd1', ready ? 150 : 80);
    g.lineWidth = 1.5;
    traceHeart(g, game.aimWorld.x, game.aimWorld.y, skill.radius * 0.9, skill.radius * 0.9);
    g.stroke();
    g.fillColor = game.pal.get('#fff0f8', ready ? 245 : 130);
    g.circle(game.aimWorld.x, game.aimWorld.y, ready ? 5 + pulse * 2 : 4);
    g.fill();
}

export function drawGardevoirEffect (game, batch, fx, skill, megaEffectStyle) {
    // Native heart-glyph particles trace the same heart-shaped footprint used by hitHeart().
}

export function hitGardevoirHeart (enemies, x, y, radius, damage) {
    return hitHeart(enemies, x, y, radius, damage);
}
