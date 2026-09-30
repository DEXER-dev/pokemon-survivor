import { hitRect, lateDamageMultiplier, segDps } from '../../../combat.js';

export const MEGA_FORM = {
    id: 'blastoise', fam: 'turtle', label: '水箭龟进化石', megaName: '超级水箭龟',
    icon: 'BLASTOISE_1', stone: 'BLASTOISINITE', color: '#70c9ff', glyph: 'cannon',
    shots: 5, spread: 0.24, volleyPower: 2.8, cooldown: 3.5,
};

/** Super Blastoise's sustained water corridor. All dimensions are world-pixels. */
export const BLASTOISE_SKILL = Object.freeze({
    name: '潮汐加农',
    shape: 'rect-beam',
    radius: 440,
    width: 142,
    duration: 3,
    tick: 0.25,
    power: 8.0,
    cooldown: 14,
    visual: 'hydrocannon',
    pattern: 3,
    motifs: 6,
});

export const BLASTOISE_SIGNATURE = Object.freeze({ orbit: 2, radius: 25, spin: 1.5, trails: 3, lance: 1.35 });

export function castBlastoise (game, seg, form, skill, targetX, targetY) {
    const origin = game.skillOrigin(seg);
    const angle = Math.atan2(targetY - origin.y, targetX - origin.x);
    seg.megaSkillActive = skill.duration;
    seg.megaSkillClock = 0;
    seg.megaSkillElapsed = 0;
    seg.megaSkillAngle = angle;
    seg.megaSkillHits = 0;
    seg.megaSkillKills = 0;
    seg.megaSkillCd = skill.cooldown;

    game.logEvent('mega.skill-used', {
        form: form.id, species: seg.fam, skill: skill.name,
        x: Math.round(origin.x), y: Math.round(origin.y), angle: Number(angle.toFixed(3)),
        shape: skill.shape, length: skill.radius, width: skill.width, duration: skill.duration,
    });
    game.megaSkillFx(form, origin.x, origin.y, skill.radius,
        { shape: skill.shape, width: skill.width, duration: skill.duration, angle, segment: seg });
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    for (const side of [-1, 1]) {
        game.particleBursts.burst(seg.fam,
            origin.x + nx * side * 15, origin.y + ny * side * 15,
            angle, 'water-channel', form.id);
    }
    game.kick(0.18);
    game.say(`${form.name || form.megaName} 展开「${skill.name}」· 持续水炮 ${skill.duration} 秒`, 2.8);
    return true;
}

export function stepBlastoise (game, seg, dt, form, skill) {
    if (!(seg.megaSkillActive > 0)) return;
    const remaining = seg.megaSkillActive;
    seg.megaSkillActive = Math.max(0, remaining - dt);
    seg.megaSkillClock += dt;
    const tick = skill.tick || 0.25;
    const origin = game.skillOrigin(seg);
    const angle = seg.megaSkillAngle;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    while (seg.megaSkillClock + 1e-8 >= tick && seg.megaSkillElapsed < skill.duration) {
        seg.megaSkillClock -= tick;
        const slice = Math.min(tick, skill.duration - seg.megaSkillElapsed);
        const damage = segDps(seg) * game.build.dmg * lateDamageMultiplier(game.level)
            * skill.power * slice / skill.duration;
        const result = hitRect(game.enemies, origin.x, origin.y,
            skill.radius, skill.width, angle, damage);
        seg.megaSkillHits += result.hits;
        seg.megaSkillKills += result.kills;
        seg.megaSkillElapsed += slice;
        if (result.hits > 0) {
            const tip = 0.84 + 0.04 * (seg.megaSkillHits % 3);
            game.particleBursts.burst(seg.fam, origin.x + ux * skill.radius * tip,
                origin.y + uy * skill.radius * tip, angle, 'water-impact', form.id);
        }
    }
    if (seg.megaSkillActive <= 0) {
        game.logEvent('mega.skill-channel-ended', {
            form: form.id, hits: seg.megaSkillHits,
            kills: seg.megaSkillKills, duration: seg.megaSkillElapsed,
        });
        seg.megaSkillActive = 0;
        game.say(`潮汐加农结束 · 水炮命中 ${seg.megaSkillHits} 次`, 1.8);
    }
}

export function drawBlastoisePreview (game, g, form, skill, ready, pulse) {
    const origin = game.skillOrigin(game.selectedMega);
    const dx = game.aimWorld.x - origin.x;
    const dy = game.aimWorld.y - origin.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const px = -uy * skill.width * 0.5;
    const py = ux * skill.width * 0.5;
    const ex = origin.x + ux * skill.radius;
    const ey = origin.y + uy * skill.radius;
    const guideColor = ready ? '#b9f5ff' : form.color;
    // Show the true hit lane as fine range rails instead of a filled rectangle that reads as a wall.
    g.strokeColor = game.pal.get(guideColor, ready ? 122 : 66);
    g.lineWidth = 1.5;
    for (const side of [-1, 1]) {
        for (let i = 0; i < 8; i++) {
            const t0 = 0.025 + i * 0.125;
            const t1 = Math.min(1, t0 + 0.066);
            g.moveTo(origin.x + ux * skill.radius * t0 + px * side,
                origin.y + uy * skill.radius * t0 + py * side);
            g.lineTo(origin.x + ux * skill.radius * t1 + px * side,
                origin.y + uy * skill.radius * t1 + py * side);
        }
    }
    g.stroke();

    // A narrow axis and two short range ticks make the corridor direction easy to read.
    g.strokeColor = game.pal.get('#dffaff', ready ? 62 : 28);
    g.lineWidth = 1;
    g.moveTo(origin.x + ux * 12, origin.y + uy * 12);
    g.lineTo(ex - ux * 9, ey - uy * 9);
    for (const t of [0.34, 0.68]) {
        const cx = origin.x + ux * skill.radius * t;
        const cy = origin.y + uy * skill.radius * t;
        g.moveTo(cx - px * 0.7, cy - py * 0.7);
        g.lineTo(cx + px * 0.7, cy + py * 0.7);
    }
    g.stroke();

    // Twin muzzle marks echo the two cannons; the end reticle marks the far edge of the hit lane.
    g.fillColor = game.pal.get(ready ? '#d9fbff' : form.color, ready ? 170 : 82);
    for (const side of [-1, 1]) g.circle(origin.x + px * side * 0.38,
        origin.y + py * side * 0.38, 3.5);
    g.fill();
    g.strokeColor = game.pal.get(ready ? '#efffff' : guideColor, ready ? 176 : 94);
    g.lineWidth = 2;
    g.circle(ex, ey, ready ? 10 + pulse * 2 : 8);
    g.stroke();
    g.strokeColor = game.pal.get('#e9fcff', ready ? 118 : 54);
    g.lineWidth = 1;
    g.circle(ex, ey, ready ? 17 + pulse * 2 : 14);
    g.stroke();
    g.fillColor = game.pal.get('#efffff', ready ? 208 : 100);
    g.circle(ex, ey, ready ? 2.8 : 2);
    g.fill();
}

export function drawBlastoiseEffect (game, batch, fx, skill, megaEffectStyle) {
    const duration = fx.duration || skill.duration;
    const fadeIn = Math.min(1, Math.max(0, fx.age / 0.12));
    const fadeOut = Math.min(1, Math.max(0, (duration - fx.age) / 0.18));
    const envelope = fadeIn * fadeOut;
    if (envelope <= 0) return;

    const angle = fx.angle;
    const ux = Math.cos(angle);
    const uy = Math.sin(angle);
    const nx = -uy;
    const ny = ux;
    const length = Math.max(0, fx.radius - 18);
    const end = length + 8;
    const phase = fx.age;
    const pulse = 0.92 + 0.08 * Math.sin(phase * 17);
    const effectStyle = megaEffectStyle(fx.form);
    const tube = (from, to, offset, halfWidth, color, alpha) => {
        const span = Math.max(2, to - from);
        const along = (from + to) * 0.5 + 18;
        batch.draw('pill',
            fx.x + ux * along + nx * offset,
            fx.y + uy * along + ny * offset,
            halfWidth / 12.48, span / 48, angle - Math.PI / 2,
            game.pal.get(color, Math.round(alpha * envelope)), false, effectStyle);
    };

    // A tight water shell, luminous inner current, and two offset cannon streams replace the flat slab.
    tube(0, end, 0, 34, '#087fb8', 62);
    tube(0, end, 0, 23, '#28bdf1', 112);
    for (const side of [-1, 1]) tube(4, end, side * 15, 7, '#82e7ff', 172);
    tube(0, end, 0, 10, '#c7f7ff', 218);
    tube(0, end, 0, 3.2, '#ffffff', 232 * pulse);

    // Four short highlights travel down the current, so the sustained beam visibly flows forward.
    for (let i = 0; i < 4; i++) {
        const t = 0.1 + ((phase * 0.8 + i * 0.22) % 0.76);
        const center = 18 + length * t;
        const streak = 17 + (i % 2) * 9;
        const ripple = Math.sin(phase * 7 + i * 2.1) * 5;
        tube(center - streak * 0.5, center + streak * 0.5, ripple, 2.4,
            i % 2 ? '#85e6ff' : '#efffff', 155);
    }

    // The tip keeps a compact, breathing splash instead of a broad impact disk.
    const tipX = fx.x + ux * fx.radius;
    const tipY = fx.y + uy * fx.radius;
    const impact = 0.86 + 0.14 * Math.sin(phase * 13);
    const tipRadius = 15 + impact * 5;
    batch.draw('aura', tipX, tipY, tipRadius / 24, tipRadius / 24,
        0, game.pal.get('#66dfff', Math.round(172 * envelope)), false, effectStyle);
    batch.draw('ring', tipX, tipY, tipRadius / 24, tipRadius / 24,
        phase * 1.4, game.pal.get('#dffbff', Math.round(205 * envelope)), false, effectStyle);
    for (let i = -1; i <= 1; i++) {
        const spread = i * 0.42;
        const size = i === 0 ? 0.7 : 0.52;
        batch.draw('feather', tipX - ux * 5 + nx * i * 7,
            tipY - uy * 5 + ny * i * 7, size, 0.15,
            angle + Math.PI + spread,
            game.pal.get(i ? '#8deaff' : '#f2feff', Math.round((i ? 150 : 208) * envelope)),
            false, effectStyle);
    }
}
