const TAU = Math.PI * 2;

export const FORM = Object.freeze({
    id: 'roster-alcremie', fam: 'alcremie', tier: 2, name: '霜奶仙', category: '宝可梦主动技',
    icon: 'ALCREMIE', color: '#f3a9d2', glyph: 'heart', effectStyle: 'psychic', rosterActive: true,
});

export default Object.freeze({
    name: '奶油蛋糕', shape: 'cake-drop', heal: 50, dropRadius: 190,
    cakeSize: 26, lifetime: 45, cooldown: 18, effectDuration: 1.1,
});

/** Make one visible cake at a seeded random point near the trainer; it remains until collected or expired. */
export function cast (game, seg, form, skill) {
    const angle = game.rng.next() * TAU;
    const minRadius = 72;
    const distance = Math.sqrt(minRadius * minRadius
        + game.rng.next() * (skill.dropRadius * skill.dropRadius - minRadius * minRadius));
    const x = game.player.x + Math.cos(angle) * distance;
    const y = game.player.y + Math.sin(angle) * distance;
    const cake = {
        x, y, heal: skill.heal, size: skill.cakeSize, lifetime: skill.lifetime, age: 0,
        form: form.id, gigantamax: !!form.gigantamax,
    };
    game.alcremieCakes.push(cake);
    seg.megaSkillCd = skill.cooldown;
    game.logEvent(form.gigantamax ? 'gigantamax.skill-used' : 'roster.skill-used', {
        form: form.id, species: seg.fam, skill: skill.name,
        x: Math.round(x), y: Math.round(y), heal: skill.heal, randomDrop: true,
    });
    game.megaSkillFx(form, x, y, skill.cakeSize * 2.8,
        { shape: 'cake-drop', duration: skill.effectDuration });
    game.particleBursts.burst(seg.fam, x, y, angle, 'mega-skill', form.id);
    game.wave(x, y, 8, skill.cakeSize * 2.8, 0.55, form.color);
    game.say(`${form.gigantamax ? '超极巨霜奶仙' : '霜奶仙'}放下蛋糕 · 靠近拾取回复 ${skill.heal} HP`, 3);
    return true;
}

/** Collect only when injured; cakes expire on simulation time and cannot revive a defeated trainer. */
export function stepCakes (cakes, player, dt) {
    const collected = [];
    for (let i = cakes.length - 1; i >= 0; i--) {
        const cake = cakes[i];
        cake.age += dt;
        if (cake.age >= cake.lifetime) {
            cakes.splice(i, 1);
            continue;
        }
        if (player.dead || player.hp >= player.maxhp) continue;
        const dx = player.x - cake.x;
        const dy = player.y - cake.y;
        const pickupRadius = cake.size * 0.72 + 24;
        if (dx * dx + dy * dy > pickupRadius * pickupRadius) continue;
        const before = player.hp;
        player.hp = Math.min(player.maxhp, player.hp + cake.heal);
        cakes.splice(i, 1);
        collected.push({ ...cake, healed: player.hp - before });
    }
    return collected;
}

/** The dotted outline communicates the random drop zone without implying that aim selects the cake spot. */
export function drawPreview (game, g, form, skill, ready, pulse) {
    const { x, y } = game.player;
    const alpha = ready ? 34 + pulse * 18 : 20;
    g.strokeColor = game.pal.get(form.gigantamax ? '#fff0a8' : '#f7c0df', alpha + 92);
    g.lineWidth = ready ? 2.4 : 1.6;
    g.circle(x, y, skill.dropRadius);
    g.stroke();
    for (let i = 0; i < 12; i++) {
        const angle = i * TAU / 12 + game.wall * 0.08;
        const radius = skill.dropRadius;
        g.fillColor = game.pal.get(i % 3 ? '#fff4de' : form.color, alpha + 74);
        g.circle(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius,
            i % 3 ? 2.2 : 3.2);
        g.fill();
    }
}

/** The borrowed Gmax Alcremie icon is a literal tiered cake; its silhouette stays readable at play scale. */
export function drawCakes (game, batch, cakes) {
    for (let i = 0; i < cakes.length; i++) {
        const cake = cakes[i];
        const fade = Math.min(1, Math.max(0.22, (cake.lifetime - cake.age) / 2));
        const pulse = 1 + Math.sin(game.wall * 4.5 + i) * 0.055;
        // `cake.size` is in world pixels, while SpriteBatch expects a multiplier of its 56px glyph.
        // Converting through the game's 24px half-unit prevents the old 26–48x scale explosion.
        const size = cake.size / 24 * pulse;
        const alpha = Math.round(255 * fade);
        batch.draw('aura', cake.x, cake.y - size * 0.08, size * 1.45, size * 0.82, 0,
            game.pal.get(cake.gigantamax ? '#ffe68c' : '#ffcae9', Math.round(36 * fade)));
        // A flattened halo doubles as a plate, instead of surrounding the pickup with a huge ring.
        batch.draw('ring', cake.x, cake.y + size * 0.22, size * 1.18, size * 0.34, 0,
            game.pal.get(cake.gigantamax ? '#ffe58d' : '#ffd6ef', Math.round(140 * fade)));
        const cakeIcon = game.atlas.glyphs.ALCREMIE_gmax ? 'ALCREMIE_gmax' : 'cake';
        batch.draw(cakeIcon, cake.x, cake.y - size * 0.04, size * 1.72, size * 1.72, 0,
            game.pal.get('#ffffff', alpha));
        if (cake.gigantamax) {
            batch.draw('star', cake.x - size * 0.88, cake.y - size * 0.48,
                size * 0.22, size * 0.22, game.wall, game.pal.get('#fff8c2', alpha));
            batch.draw('star', cake.x + size * 0.86, cake.y + size * 0.22,
                size * 0.18, size * 0.18, -game.wall, game.pal.get('#fff8c2', alpha));
        }
    }
}

export function drawEffect () {
    // The persistent cake pickup itself is the visual reward; avoid drawing a second fake cake here.
}
