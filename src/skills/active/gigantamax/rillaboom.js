import { hitArea, lateDamageMultiplier, segDps } from '../../../combat.js';

export const FORM = {
    id: 'rillaboom', fam: 'grookey', tier: 3, name: '超极巨轰擂金刚猩', label: '超极巨化 · 轰擂金刚猩',
    icon: 'RILLABOOM_gmax', color: '#80df69', glyph: 'leafblade', size: 1.9,
};
export default Object.freeze({
    name: '超极巨森之鼓域', shape: 'healing-grove', radius: 200, power: 11,
    cooldown: 60, duration: 60, healRate: 0.012, visual: 'drumquake', pattern: 0, motifs: 18,
});

/** Clear the selected circle, then plant a fixed-position healing grove there. */
export function cast (game, seg, form, skill, x, y) {
    const damage = segDps(seg) * game.build.dmg * lateDamageMultiplier(game.level) * skill.power;
    const { hits, kills } = hitArea(game.enemies, x, y, skill.radius, damage);
    seg.megaSkillCd = skill.cooldown;
    const field = {
        segment: seg, form, x, y, radius: skill.radius,
        duration: skill.duration, remaining: skill.duration, age: 0, healRate: skill.healRate,
    };
    const previous = game.rillaboomFields.findIndex((grove) => grove.segment === seg);
    if (previous >= 0) game.rillaboomFields[previous] = field;
    else game.rillaboomFields.push(field);

    game.logEvent('gigantamax.skill-used', {
        form: form.id, species: seg.fam, skill: skill.name,
        x: Math.round(x), y: Math.round(y), radius: skill.radius, damage: Math.round(damage), hits, kills,
        groveDuration: skill.duration, healRate: skill.healRate,
    });
    game.megaSkillFx(form, x, y, skill.radius, { shape: 'healing-grove', duration: 1.15 });
    game.particleBursts.burst(seg.fam, x, y, 0, 'mega-skill', form.id);
    game.wave(x, y, 12, skill.radius, 0.74, '#80df69');
    game.kick(0.25);
    game.say(`轰擂金刚猩清扫范围内 ${hits} 只 · 草场已生长：范围内每秒回复 1.2% 最大生命，持续 60 秒`, 4);
    return true;
}

/** Advance on simulation time; healing stops outside the circle and never revives a defeated player. */
export function stepFields (fields, player, dt) {
    let expired = 0;
    for (let i = fields.length - 1; i >= 0; i--) {
        const grove = fields[i];
        grove.remaining = Math.max(0, grove.remaining - dt);
        grove.age = Math.min(grove.duration, grove.age + dt);
        if (grove.remaining <= 0) {
            fields.splice(i, 1);
            expired++;
            continue;
        }
        const dx = player.x - grove.x;
        const dy = player.y - grove.y;
        if (!player.dead && dx * dx + dy * dy <= grove.radius * grove.radius) {
            player.hp = Math.min(player.maxhp, player.hp + player.maxhp * grove.healRate * dt);
        }
    }
    return expired;
}

export function drawPreview (game, g, form, skill, ready, pulse) {
    const x = game.aimWorld.x;
    const y = game.aimWorld.y;
    const radius = skill.radius;
    g.fillColor = game.pal.get('#62d96b', ready ? Math.round(24 + pulse * 16) : 18);
    g.circle(x, y, radius);
    g.fill();
    g.strokeColor = game.pal.get(ready ? '#d8ffb0' : form.color, ready ? 235 : 115);
    g.lineWidth = ready ? 4 : 2.5;
    g.circle(x, y, radius);
    g.stroke();
    g.strokeColor = game.pal.get('#80df69', ready ? 155 : 76);
    g.lineWidth = 2;
    g.circle(x, y, radius * 0.84);
    g.stroke();
    for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4 + game.wall * 0.12;
        const inner = radius * 0.88;
        const outer = radius * 0.97;
        g.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
        g.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
    }
    g.stroke();
}

/** Short planting burst; the persistent patch itself is drawn separately beneath the horde. */
export function drawEffect (game, batch, fx, skill, megaEffectStyle) {
    // The cast burst and live grove emitter below provide the full particulate effect.
}

/** The in-world turf persists under the fight and keeps a stable, honest healing boundary. */
export function drawField (game, batch, grove) {
    // The healing boundary is communicated by the recurring leaf/spore particle perimeter,
    // not by a filled disc or static rings that obscure the battle.
}
