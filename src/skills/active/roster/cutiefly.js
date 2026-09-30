import { hitArea, lateDamageMultiplier, segDps } from '../../../combat.js';

export const FORM = Object.freeze({
    id: 'roster-ribombee', fam: 'cutiefly', tier: 2, name: '蝶结萌虻', category: '宝可梦主动技',
    icon: 'RIBOMBEE', color: '#f3c96c', glyph: 'heart', effectStyle: 'nature', rosterActive: true,
});

export default Object.freeze({
    name: '花蜜回旋', shape: 'honey-orbit', radius: 154, power: 5.2,
    healPerHit: 5, healCap: 30, cooldown: 16, effectDuration: 1.12,
});

/** A targeted nectar burst damages enemies and converts its hits into capped trainer healing. */
export function cast (game, seg, form, skill, x, y) {
    const damage = segDps(seg) * game.build.dmg * lateDamageMultiplier(game.level) * skill.power;
    const result = hitArea(game.enemies, x, y, skill.radius, damage);
    const missingHp = Math.max(0, game.player.maxhp - game.player.hp);
    const heal = game.player.dead ? 0 : Math.min(skill.healCap, result.hits * skill.healPerHit, missingHp);
    game.player.hp += heal;
    seg.megaSkillCd = skill.cooldown;
    game.logEvent('roster.skill-used', { form: form.id, species: seg.fam, skill: skill.name,
        x: Math.round(x), y: Math.round(y), radius: skill.radius,
        damage: Math.round(damage), hits: result.hits, kills: result.kills, healed: Math.round(heal) });
    game.megaSkillFx(form, x, y, skill.radius, { shape: skill.shape, duration: skill.effectDuration });
    game.particleBursts.burst(seg.fam, x, y, 0, 'cutiefly-honey-pulse');
    game.particleBursts.burst(seg.fam, x, y, 0, 'cutiefly-flower-burst');
    game.wave(x, y, 9, skill.radius, 0.68, form.color);
    game.kick(0.16);
    game.say(`蝶结萌虻「花蜜回旋」命中 ${result.hits} 只 · 回复 ${Math.round(heal)} HP`, 2.8);
    return true;
}

export function drawPreview (game, g, form, skill, ready, pulse) {
    const { x, y } = game.aimWorld;
    const alpha = ready ? 32 + pulse * 17 : 18;
    g.fillColor = game.pal.get('#ffd986', alpha);
    g.circle(x, y, skill.radius);
    g.fill();
    g.strokeColor = game.pal.get(ready ? '#fff1b7' : form.color, ready ? 232 : 115);
    g.lineWidth = ready ? 3.2 : 2;
    g.circle(x, y, skill.radius);
    g.stroke();
    for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + game.wall * 0.18;
        const r = skill.radius * (0.72 + 0.1 * Math.sin(game.wall * 2 + i));
        g.fillColor = game.pal.get(i % 2 ? '#f8b9dc' : '#fff0aa', ready ? 180 : 92);
        g.circle(x + Math.cos(a) * r, y + Math.sin(a) * r, i % 2 ? 3.2 : 2.4);
        g.fill();
    }
    g.strokeColor = game.pal.get('#fff2bf', ready ? 176 : 84);
    g.lineWidth = 1.5;
    g.circle(x, y, skill.radius * 0.42);
    g.stroke();
}

export function drawEffect (game, batch, fx, skill, style) {
    // Honey/heart particles now carry this heal-zone pulse; retain a low-contrast hit boundary.
    const fade = Math.max(18, Math.round(40 * (1 - Math.min(1, fx.age / fx.duration))));
    batch.draw('ring', fx.x, fx.y, skill.radius / 24, skill.radius / 24, 0,
        game.pal.get(fx.form.color, fade), false, style(fx.form));
}
