import { hitArea, lateDamageMultiplier, segDps } from '../../../combat.js';
import { drawHoohMaterialStorm } from './hooh-material-effects.js';

export const FORM = Object.freeze({
    id: 'legend-hooh', fam: 'legend-hooh', kind: 'legendary', category: '传说宝可梦',
    name: '凤王', color: '#ff7047', glyph: 'flame', icon: 'flame',
});

/** Sacred Firestorm: a focused circular barrage, followed by a full heal and lasting vitality. */
export const SKILL = Object.freeze({
    name: '圣焰天陨', shape: 'circle-barrage', radius: 210,
    duration: 2.4, tick: 0.24, power: 8.5, cooldown: 24, motifs: 18,
});

export function cast (game, seg, form, skill, x, y) {
    seg.megaSkillActive = skill.duration;
    seg.megaSkillClock = 0;
    seg.megaSkillElapsed = 0;
    seg.megaSkillX = x;
    seg.megaSkillY = y;
    seg.megaSkillHits = 0;
    seg.megaSkillKills = 0;
    seg.megaSkillCd = skill.cooldown;

    const previousMaxHp = game.player.maxhp;
    game.player.maxhp += 100;
    game.player.hp = game.player.maxhp;

    game.logEvent('legendary.skill-used', {
        form: form.id, species: seg.fam, skill: skill.name,
        x: Math.round(x), y: Math.round(y), shape: skill.shape, radius: skill.radius,
        duration: skill.duration, maxHpBefore: previousMaxHp, maxHpAfter: game.player.maxhp,
        hp: game.player.hp,
    });
    game.megaSkillFx(form, x, y, skill.radius,
        { shape: skill.shape, duration: skill.duration });
    game.particleBursts.burst(seg.fam, x, y, -Math.PI / 2, 'hooh-fire-barrage');
    game.wave(x, y, 16, skill.radius, 0.8, '#ff7047');
    game.kick(0.3);
    game.say(`凤王「${skill.name}」！火焰弹幕覆盖圆形区域 · 生命全满 · 体力上限 +100`, 3.2);
    return true;
}

export function step (game, seg, dt, form, skill) {
    if (!(seg.megaSkillActive > 0)) return;
    const remaining = seg.megaSkillActive - dt;
    seg.megaSkillActive = remaining <= 1e-8 ? 0 : remaining;
    seg.megaSkillClock += dt;

    while (seg.megaSkillClock + 1e-8 >= skill.tick
        && seg.megaSkillElapsed < skill.duration) {
        seg.megaSkillClock -= skill.tick;
        const slice = Math.min(skill.tick, skill.duration - seg.megaSkillElapsed);
        const damage = segDps(seg) * game.build.dmg * lateDamageMultiplier(game.level)
            * skill.power * slice / skill.duration;
        const impact = hitArea(game.enemies, seg.megaSkillX, seg.megaSkillY,
            skill.radius, damage);
        const volley = Math.floor((seg.megaSkillElapsed + 1e-8) / skill.tick);
        const angle = volley * 2.39996322973;
        const radial = skill.radius * Math.sqrt((volley * 0.61803398875) % 1);
        game.particleBursts.burst(seg.fam,
            seg.megaSkillX + Math.cos(angle) * radial,
            seg.megaSkillY + Math.sin(angle) * radial,
            -Math.PI / 2, 'hooh-fire-barrage');
        seg.megaSkillHits += impact.hits;
        seg.megaSkillKills += impact.kills;
        seg.megaSkillElapsed = Math.min(skill.duration, seg.megaSkillElapsed + slice);
    }

    if (seg.megaSkillActive <= 0) {
        seg.megaSkillActive = 0;
        game.logEvent('legendary.skill-channel-ended', {
            form: form.id, hits: seg.megaSkillHits, kills: seg.megaSkillKills,
            duration: seg.megaSkillElapsed,
        });
        game.say(`圣焰天陨结束 · 命中 ${seg.megaSkillHits} 次，击败 ${seg.megaSkillKills} 只`, 2);
    }
}

export function drawPreview (game, g, form, skill, ready, pulse) {
    const x = game.aimWorld.x;
    const y = game.aimWorld.y;
    g.fillColor = game.pal.get(form.color, ready ? 38 + pulse * 16 : 22);
    g.circle(x, y, skill.radius);
    g.fill();
    g.strokeColor = game.pal.get(ready ? '#ffe7a1' : form.color, ready ? 230 : 120);
    g.lineWidth = ready ? 3.5 : 2.5;
    g.circle(x, y, skill.radius);
    g.stroke();
    g.strokeColor = game.pal.get('#ffb15c', ready ? 125 : 65);
    g.lineWidth = 1.5;
    g.circle(x, y, skill.radius * 0.68);
    g.stroke();
    for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4 + game.wall * 0.18;
        const inner = skill.radius * 0.82;
        const outer = skill.radius * 0.94;
        g.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
        g.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
    }
    g.stroke();
}

export function drawEffect (game, batch, fx, skill, effectStyle) {
    drawHoohMaterialStorm(batch, game.pal, {
        x: fx.x, y: fx.y, age: fx.age, duration: fx.duration || skill.duration,
        radius: fx.radius || skill.radius,
    });
}
