const TAU = Math.PI * 2;
const CORE = '#fff8e5';
const META = Object.freeze({
    'legend-mewtwo': {
        name: '超梦', color: '#d49af2', skill: '超能次元', glyph: 'star',
        shape: 'psychic-dominion',
    },
    'legend-lugia': {
        name: '洛奇亚', color: '#72def2', skill: '海神气旋', glyph: 'wave',
        shape: 'aeroblast-cyclone',
    },
    'legend-rayquaza': {
        name: '烈空坐', color: '#78e6a6', skill: '天空断界', glyph: 'dragon',
        shape: 'sky-cleaver',
    },
    'legend-kyogre': {
        name: '盖欧卡', color: '#4f9dff', skill: '深渊潮汐', glyph: 'wave',
        shape: 'abyssal-tide',
    },
    'legend-groudon': {
        name: '固拉多', color: '#ff7657', skill: '大陆隆起', glyph: 'boulder',
        shape: 'continental-rise',
    },
    'legend-dialga': {
        name: '帝牙卢卡', color: '#7bdcf4', skill: '永恒刻印', glyph: 'hex',
        shape: 'eternal-imprint',
    },
    'legend-palkia': {
        name: '帕路奇亚', color: '#f28fda', skill: '次元折叠', glyph: 'crescent',
        shape: 'spatial-fold',
    },
    'legend-arceus': {
        name: '阿尔宙斯', color: '#e6bc52', skill: '天幕裁决', glyph: 'star',
        shape: 'firmament-judgment',
    },
});

const forms = Object.freeze(Object.entries(META).map(([id, data]) => Object.freeze({
    id,
    fam: id,
    kind: 'legendary',
    category: '传说宝可梦',
    name: data.name,
    color: data.color,
    glyph: data.glyph,
    activeShape: data.shape,
})));

const formById = Object.freeze(Object.fromEntries(forms.map((form) => [form.id, form])));
const skills = Object.freeze(Object.fromEntries(forms.map((form) => [form.id, Object.freeze({
    name: META[form.id].skill,
    shape: form.activeShape,
    radius: 232,
    duration: 2.4,
    power: 4,
    cooldown: 24,
})])));
const modules = Object.freeze(Object.fromEntries(forms.map((form) => [form.id, Object.freeze({
    FORM: form,
    drawPreview,
    drawEffect,
})])));

export const LEGENDARY_ACTIVE_FORMS = forms;

export function legendaryActiveFormForSegment (seg) {
    return seg && formById[seg.fam] || null;
}

export function legendaryActiveSkillForForm (form) {
    return form && skills[form.id] || null;
}

export function legendaryActiveModuleForForm (form) {
    return form && modules[form.id] || null;
}

function drawPreview (game, g, form, skill, ready, pulse) {
    const { x, y } = game.aimWorld;
    const meta = META[form.id];
    const color = game.pal.get(meta.color, ready ? 145 + pulse * 46 : 76);
    const angle = Math.atan2(y - game.player.y, x - game.player.x);
    g.strokeColor = color;
    g.lineWidth = ready ? 2.5 : 1.5;
    g.circle(x, y, skill.radius);
    g.stroke();

    // The reticle identifies the active attack's motif while keeping the real damage area clear.
    if (meta.shape === 'sky-cleaver' || meta.shape === 'spatial-fold') {
        const length = skill.radius * 0.78;
        const angles = meta.shape === 'sky-cleaver'
            ? [angle]
            : [angle - Math.PI / 4, angle + Math.PI / 4];
        for (const a of angles) {
            const ux = Math.cos(a), uy = Math.sin(a);
            g.moveTo(x - ux * length, y - uy * length);
            g.lineTo(x + ux * length, y + uy * length);
        }
        g.stroke();
    } else if (meta.shape === 'continental-rise' || meta.shape === 'firmament-judgment') {
        for (let i = 0; i < 8; i++) {
            const a = angle + i * TAU / 8;
            const r = skill.radius * (meta.shape === 'continental-rise' ? 0.62 : 0.76);
            g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
            g.lineTo(x + Math.cos(a) * skill.radius * 0.94, y + Math.sin(a) * skill.radius * 0.94);
        }
        g.stroke();
    } else {
        const rings = meta.shape === 'eternal-imprint' ? [0.38, 0.7] : [0.52];
        for (const scale of rings) {
            g.circle(x, y, skill.radius * scale);
            g.stroke();
        }
    }
    g.fillColor = game.pal.get(CORE, ready ? 220 : 115);
    g.circle(x, y, ready ? 3.2 + pulse * 1.2 : 2.4);
    g.fill();
}

function drawEffect (game, batch, fx, skill) {
    const meta = META[fx.form.id];
    const duration = fx.duration || skill.duration;
    if (!Number.isFinite(fx.age) || duration <= 0 || fx.age < 0 || fx.age >= duration) return;

    const t = Math.max(0, Math.min(1, fx.age / duration));
    const open = Math.min(1, fx.age / 0.2);
    const fade = Math.min(1, (duration - fx.age) / 0.35);
    const env = Math.max(0, Math.min(1, open * fade));
    const radius = Math.max(60, fx.radius || skill.radius);
    const x = fx.x, y = fx.y;
    const angle = fx.angle || 0;
    const turn = fx.age * 1.7;
    const col = meta.color;
    const draw = (glyph, px, py, sx, sy, rot = 0, alpha = 220, hue = col) =>
        batch.draw(glyph, px, py, sx, sy, rot, game.pal.get(hue, Math.round(alpha * env)));
    const ray = (px, py, length, width, rot, alpha = 210, hue = col) =>
        draw('legendRay', px, py, length / 48, width / 14, rot, alpha, hue);
    const ring = (px, py, r, alpha = 180, squash = 1, rot = 0) =>
        draw('ring', px, py, r / 24, r / 24 * squash, rot, alpha);
    const comet = (glyph, px, py, rot, scale = 0.8, hue = col) => {
        ray(px - Math.cos(rot) * scale * 26, py - Math.sin(rot) * scale * 26,
            scale * 66, scale * 13, rot, 155, hue);
        draw(glyph, px, py, scale, scale, rot, 235, hue);
        draw('spark', px, py, scale * 0.24, scale * 0.24, -rot, 250, CORE);
    };
    const materialFrames = {
        arcane: 7, water03: 5, water04: 5, water05: 5,
        earth03: 5, earth04: 5, cosmic02: 5, cosmic05: 5, slash04: 6, pure05: 5,
    };
    const material = (group, px, py, scale, rot = 0, alpha = 235, phase = 0,
        tint = '#ffffff') => {
        const count = materialFrames[group];
        if (!count) return false;
        const cycle = 0.62;
        const progress = ((fx.age / cycle + phase) % 1 + 1) % 1;
        const index = Math.min(count, Math.floor(progress * count) + 1);
        const key = `vfx_${group}_${String(index).padStart(2, '0')}`;
        if (!batch.glyphs?.[key]) return false;
        batch.draw(key, px, py, scale, scale, rot,
            game.pal.get(tint, Math.round(alpha * env)), false, null, `legendary-material:${group}`);
        return true;
    };

    // Shared detonation grammar: a large pressure halo, a counter-rotating seal, and a hot core.
    const pressure = radius * (0.7 + 0.62 * Math.min(1, fx.age / 0.8));
    ring(x, y, pressure, 165, 0.72, turn);
    ring(x, y, pressure * 0.72, 92, 0.94, -turn * 1.35);
    draw('legendSeal', x, y, radius / 22, radius / 22, turn, 152);
    draw('legendSeal', x, y, radius / 34, radius / 34, -turn * 1.6, 160, CORE);
    draw('aura', x, y, radius / 25, radius / 25, 0, 88, col);

    switch (meta.shape) {
    case 'psychic-dominion': {
        // Five focused psychic impacts collapse inward, then rebound as a violet crown.
        for (let i = 0; i < 5; i++) {
            const a = angle + i * TAU / 5 - Math.PI / 2 + turn * 0.22;
            const orbit = radius * (0.82 - 0.34 * Math.sin(Math.min(1, t * 1.25) * Math.PI / 2));
            const px = x + Math.cos(a) * orbit;
            const py = y + Math.sin(a) * orbit;
            draw('legendArc', px, py, 2.5 + t * 1.6, 1.8 + t, a + turn, 235);
            draw('star', px, py, 0.68 + t * 0.3, 0.68 + t * 0.3, -a, 235, CORE);
            ray(px, py, radius * 0.6, 5, a + Math.PI, 82);
        }
        for (let i = 0; i < 3; i++) {
            ring(x, y, radius * (0.26 + i * 0.13 + 0.05 * Math.sin(turn * 2 + i)),
                150, 0.42, turn * (i % 2 ? -1 : 1));
        }
        for (let i = 0; i < 12; i++) {
            const a = turn * 0.7 + i * TAU / 12;
            comet('shard', x + Math.cos(a) * radius * 0.54,
                y + Math.sin(a) * radius * 0.54, a + Math.PI / 2, 0.54);
        }
        material('arcane', x, y, 2.05, turn * 0.35, 235, 0.1);
        for (let i = 0; i < 5; i++) {
            const a = turn + i * TAU / 5;
            material('arcane', x + Math.cos(a) * radius * 0.48,
                y + Math.sin(a) * radius * 0.48, 0.88, a, 205, i / 5);
        }
        break;
    }
    case 'aeroblast-cyclone': {
        // Three converging aeroblast lanes wrap a deep pressure eye in spiral currents.
        for (let lane = -1; lane <= 1; lane++) {
            const laneAngle = angle + lane * 0.17;
            const ux = Math.cos(laneAngle), uy = Math.sin(laneAngle);
            ray(x + ux * radius * 0.22, y + uy * radius * 0.22,
                radius * 1.75, 24 - Math.abs(lane) * 5, laneAngle, 116);
            ray(x + ux * radius * 0.22, y + uy * radius * 0.22,
                radius * 1.7, 5, laneAngle, 242, CORE);
        }
        for (let i = 0; i < 18; i++) {
            const a = i * TAU / 18 - turn * 1.5;
            const r = radius * (0.24 + (i % 3) * 0.095);
            comet('wave', x + Math.cos(a) * r, y + Math.sin(a) * r,
                a + Math.PI / 2, 0.6 + (i % 3) * 0.12, i % 4 ? col : CORE);
        }
        for (let i = 0; i < 3; i++) ring(x, y, radius * (0.3 + i * 0.23), 184 - i * 22, 0.55, -turn + i);
        material('water04', x, y, 2.25, -turn * 0.45, 245, 0.05);
        for (let i = 0; i < 6; i++) {
            const a = turn * -0.7 + i * TAU / 6;
            material('water03', x + Math.cos(a) * radius * 0.63,
                y + Math.sin(a) * radius * 0.42, 1.02, a, 220, i / 6);
        }
        draw('wave', x, y, 2.8, 2.8, angle, 230, CORE);
        break;
    }
    case 'sky-cleaver': {
        // A long emerald dragon wake carves one heavy sky lane through the entire target area.
        const dragonP = (t * 0.72 + 0.14) % 1;
        const dragonD = (dragonP - 0.5) * radius * 1.55;
        const dragonBend = Math.sin(dragonP * TAU * 1.4 + turn) * radius * 0.12;
        const dragonX = x + Math.cos(angle) * dragonD - Math.sin(angle) * dragonBend;
        const dragonY = y + Math.sin(angle) * dragonD + Math.cos(angle) * dragonBend;
        comet('dragon', dragonX, dragonY, angle, 1.55);
        for (let side of [-1, 1]) {
            for (let i = 0; i < 4; i++) {
                const p = (t * 0.8 + i / 4 + (side > 0 ? 0.08 : 0.42)) % 1;
                const d = (p - 0.5) * radius * 1.65;
                const bend = Math.sin(p * TAU * 1.35 + turn) * radius * 0.17 * side;
                const px = x + Math.cos(angle) * d - Math.sin(angle) * bend;
                const py = y + Math.sin(angle) * d + Math.cos(angle) * bend;
                comet('diamond', px, py, angle + side * (0.12 + p * 0.14), 0.5 + p * 0.16);
            }
        }
        ray(x, y, radius * 1.8, 11, angle, 170);
        ray(x, y, radius * 1.65, 3, angle, 250, CORE);
        for (let i = 0; i < 7; i++) {
            const a = turn + i * TAU / 7;
            draw('legendArc', x + Math.cos(a) * radius * 0.63,
                y + Math.sin(a) * radius * 0.63, 2.2, 1.35, a, 225);
        }
        break;
    }
    case 'abyssal-tide': {
        // A deep-sea eye pulls in a triple tide ring and sends a broad crest across the floor.
        for (let i = 0; i < 3; i++) {
            const expand = Math.min(1, t * 1.1 + i * 0.22);
            const r = radius * (0.22 + expand * (0.44 + i * 0.16));
            ring(x, y, r, 212 - i * 24, 0.48 + i * 0.17, turn * (i % 2 ? -1 : 1));
        }
        for (let i = 0; i < 16; i++) {
            const a = i * TAU / 16 + angle - turn * 0.4;
            const p = (t * 1.15 + i / 16) % 1;
            const r = radius * (0.28 + p * 0.62);
            comet(i % 3 ? 'wave' : 'crescent', x + Math.cos(a) * r,
                y + Math.sin(a) * r * 0.72, a + Math.PI / 2, 0.52 + p * 0.38);
        }
        for (let i = 0; i < 6; i++) {
            const a = i * TAU / 6 + turn;
            draw('aura', x + Math.cos(a) * radius * 0.62,
                y + Math.sin(a) * radius * 0.42, 1.25, 1.9, a, 88, '#83d8ff');
        }
        material('water05', x, y, 2.5, turn * 0.3, 235, 0.12);
        for (let i = 0; i < 8; i++) {
            const a = angle + i * TAU / 8 - turn * 0.2;
            const r = radius * (0.56 + (i % 2) * 0.12);
            material('water03', x + Math.cos(a) * r,
                y + Math.sin(a) * r * 0.7, 0.93, a, 215, i / 8);
        }
        draw('wave', x, y, 2.3 + Math.sin(turn * 2) * 0.2, 2.3, turn, 235, CORE);
        break;
    }
    case 'continental-rise': {
        // Eight fissures split outward before heavy red stone lances punch up through the cracks.
        for (let i = 0; i < 12; i++) {
            const a = angle + i * TAU / 12;
            const r = radius * (0.18 + (i % 3) * 0.08);
            ray(x + Math.cos(a) * r, y + Math.sin(a) * r,
                radius * (0.72 + (i % 2) * 0.25), 10, a, 190);
            ray(x + Math.cos(a) * r, y + Math.sin(a) * r,
                radius * 0.62, 2.5, a, 245, '#ffd4a5');
        }
        for (let i = 0; i < 8; i++) {
            const a = angle + i * TAU / 8;
            const r = radius * (0.27 + (i % 2) * 0.29);
            const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.7;
            const rise = 0.72 + 0.28 * Math.sin(t * Math.PI + i * 0.9);
            draw('spear', px, py + 28 * rise, 2.9 * rise, 0.82, Math.PI / 2, 230);
            draw('spear', px, py + 24 * rise, 2.5 * rise, 0.22, Math.PI / 2, 242, '#ffe0bb');
            comet('boulder', px, py - 6, a + Math.PI / 2, 0.55 + (i % 3) * 0.12);
        }
        material('earth03', x, y, 2.55, turn * 0.18, 225, 0.1);
        for (let i = 0; i < 8; i++) {
            const a = angle + i * TAU / 8;
            const r = radius * (0.37 + (i % 2) * 0.2);
            material('earth04', x + Math.cos(a) * r,
                y + Math.sin(a) * r * 0.7, 0.9 + (i % 3) * 0.12,
                a, 195, i / 8, '#ffe0c0');
        }
        ring(x, y, radius * (0.4 + t * 0.6), 160, 0.68, turn * 0.3);
        break;
    }
    case 'eternal-imprint': {
        // Opposing time sigils lock the battlefield, then a cyan hourglass pulse tears free.
        for (const sign of [-1, 1]) {
            const a = angle + sign * (0.64 + 0.12 * Math.sin(turn));
            const cx = x + Math.cos(a) * radius * 0.55;
            const cy = y + Math.sin(a) * radius * 0.55;
            draw('legendSeal', cx, cy, radius / 33, radius / 33,
                sign * turn, 230);
            ring(cx, cy, radius * 0.28, 172, 1, sign * turn);
            for (let i = 0; i < 12; i++) {
                const tick = i * TAU / 12 + sign * turn;
                const r = radius * (0.2 + (i % 3 === 0 ? 0.085 : 0.04));
                ray(cx + Math.cos(tick) * r, cy + Math.sin(tick) * r,
                    i % 3 === 0 ? 22 : 11, 2.5, tick, 230, CORE);
            }
        }
        for (let i = 0; i < 14; i++) {
            const p = (t * 1.2 + i / 14) % 1;
            const a = angle + i * TAU / 14;
            const r = radius * (0.18 + p * 0.82);
            comet(i % 2 ? 'hex' : 'shard', x + Math.cos(a) * r,
                y + Math.sin(a) * r, a + turn * 0.4, 0.45 + p * 0.18,
                i % 4 ? col : CORE);
        }
        material('cosmic02', x - Math.cos(angle) * radius * 0.55,
            y - Math.sin(angle) * radius * 0.55, 1.28, turn * 0.4, 235, 0.08);
        material('cosmic02', x + Math.cos(angle) * radius * 0.55,
            y + Math.sin(angle) * radius * 0.55, 1.28, -turn * 0.4, 225, 0.58);
        material('cosmic05', x, y, 1.35, -turn, 190, 0.28);
        ray(x, y, radius * 1.5, 8, angle, 175, CORE);
        break;
    }
    case 'spatial-fold': {
        // Two full-length tears cross, pinch the center, and fling bright space shards outward.
        for (const a of [angle - Math.PI / 4, angle + Math.PI / 4]) {
            ray(x, y, radius * 1.75, 28, a, 110);
            ray(x, y, radius * 1.72, 12, a, 225);
            ray(x, y, radius * 1.58, 3, a, 255, CORE);
            for (let i = 0; i < 7; i++) {
                const p = ((t * 0.85 + i / 7) % 1 - 0.5) * radius * 1.5;
                const px = x + Math.cos(a) * p;
                const py = y + Math.sin(a) * p;
                draw('legendRift', px, py, 1.9, 0.5, a, 235);
                draw('diamond', px, py, 0.55, 0.82, a + Math.PI / 2, 235, CORE);
            }
        }
        for (let i = 0; i < 16; i++) {
            const a = turn * -0.6 + i * TAU / 16;
            const r = radius * (0.6 + 0.18 * Math.sin(t * TAU + i));
            comet('shard', x + Math.cos(a) * r, y + Math.sin(a) * r,
                a + Math.PI / 2, 0.5 + (i % 3) * 0.12, i % 4 ? col : CORE);
        }
        material('cosmic05', x, y, 1.72, -turn * 0.8, 205, 0.05);
        material('slash04', x, y, 2.25, angle - Math.PI / 4, 245, 0.12);
        material('slash04', x, y, 1.9, angle + Math.PI / 4, 238, 0.62);
        draw('legendRift', x, y, 4.2, 1.4, angle, 252, CORE);
        break;
    }
    case 'firmament-judgment': {
        // A celestial wheel gathers twelve lances above five anchored judgment impacts.
        for (let i = 0; i < 12; i++) {
            const a = angle + i * TAU / 12 - turn * 0.25;
            const p = (t * 1.15 + i / 12) % 1;
            const r = radius * (0.48 + p * 0.42);
            const px = x + Math.cos(a) * r;
            const py = y + Math.sin(a) * r * 0.72;
            ray(px, py - 40, 84 + p * 32, 7, Math.PI / 2, 94);
            ray(px, py - 37, 78 + p * 26, 2.3, Math.PI / 2, 148, '#ffe29a');
            draw('star', px, py, 0.72 + Math.sin(p * Math.PI) * 0.38,
                0.72 + Math.sin(p * Math.PI) * 0.38, turn, 156, CORE);
        }
        for (let i = 0; i < 5; i++) {
            const a = angle + i * TAU / 5 - Math.PI / 2;
            const px = x + Math.cos(a) * radius * (i === 0 ? 0 : 0.46);
            const py = y + Math.sin(a) * radius * (i === 0 ? 0 : 0.38);
            draw('legendSeal', px, py, radius / 44, radius / 44, -turn, 205);
            draw('star', px, py, 1.05 + 0.16 * Math.sin(turn * 2 + i),
                1.05 + 0.16 * Math.sin(turn * 2 + i), turn, 184, '#ffe29a');
        }
        material('pure05', x, y, 1.35, turn * 0.16, 112, 0.04, '#e4b444');
        for (let i = 0; i < 4; i++) {
            const a = angle + i * TAU / 4 + turn * 0.12;
            material('pure05', x + Math.cos(a) * radius * 0.64,
                y + Math.sin(a) * radius * 0.5, 0.68, a, 94, 0.25 + i / 4, '#edc958');
        }
        ring(x, y, radius * (0.55 + 0.28 * t), 188, 0.72, turn);
        break;
    }
    }
}
