import { lateDamageMultiplier, segDps } from '../../../combat.js';

export const MEGA_FORM = {
    id: 'venusaur', fam: 'mush', label: '妙蛙花进化石', megaName: '超级妙蛙花',
    icon: 'VENUSAUR_1', stone: 'VENUSAURITE', color: '#f278c8', glyph: 'leaf',
    shots: 7, spread: 0.58, volleyPower: 2.6, cooldown: 3.6,
};
export const SIGNATURE = Object.freeze({ orbit: 6, radius: 38, spin: -1.8, trails: 2, lance: 0.55 });
export const SKILL = Object.freeze({ name: '巨花猎场', shape: 'venusaur-garden', radius: 205,
    description: '投下花苞扎根，藤蔓聚怪束缚，毒粉持续侵蚀，最后合拢绽放；BOSS 受伤但不被拖动',
    range: 640, power: 7, cooldown: 14, duration: 8.4, landing: 0.85,
    poisonStart: 2.8, poisonInterval: 0.42, poisonTicks: 8, finale: 6.75 });
export default SKILL;

const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
const ease = (n) => 1 - (1 - clamp(n)) ** 3;

function target (origin, x, y, range) {
    const dx = x - origin.x, dy = y - origin.y;
    const scale = Math.min(1, range / (Math.hypot(dx, dy) || 1));
    return { x: origin.x + dx * scale, y: origin.y + dy * scale };
}

export function cast (game, seg, form, skill, x, y) {
    const origin = game.skillOrigin(seg);
    const center = target(origin, x, y, skill.range);
    const state = { ...center, originX: origin.x, originY: origin.y, age: 0,
        landed: false, ticks: 0, finished: false, hits: 0, kills: 0, vines: [],
        damage: segDps(seg) * game.build.dmg * lateDamageMultiplier(game.level) * skill.power };
    const fx = game.megaSkillFx(form, center.x, center.y, skill.radius,
        { shape: skill.shape, duration: skill.duration, segment: seg, layout: state });
    if (!fx) { game.say('当前技能效果繁忙，请稍后释放', 1.5); return false; }
    seg.venusaurGarden = state;
    seg.megaSkillActive = skill.duration;
    seg.megaSkillCd = skill.cooldown;
    game.logEvent('mega.skill-used', { form: form.id, skill: skill.name,
        x: Math.round(center.x), y: Math.round(center.y), radius: skill.radius });
    game.say('巨花猎场 · 花苞投落，藤蔓即将捕猎', 2.6);
    return true;
}

/** Scan the bounded enemy array: pulling changes positions after this step's grid rebuild. */
function damageArea (game, state, radius, fraction) {
    const e = game.enemies;
    for (let i = 0; i < e.n; i++) {
        if (e.dead[i] || Math.hypot(e.x[i] - state.x, e.y[i] - state.y) > radius + e.r[i]) continue;
        const hp = e.hp[i];
        if (e.hurt(i, state.damage * fraction)) state.kills++;
        if (e.hp[i] < hp) state.hits++;
    }
}

export function step (game, seg, dt, form, skill) {
    const state = seg.venusaurGarden;
    if (!state) { seg.megaSkillActive = 0; return; }
    state.age = Math.min(skill.duration, state.age + dt);
    seg.megaSkillActive = Math.max(0, skill.duration - state.age);
    if (!state.landed && state.age >= skill.landing) {
        state.landed = true;
        damageArea(game, state, skill.radius, 0.1);
        game.wave(state.x, state.y, 12, skill.radius, 0.45, '#89b457');
        game.kick(0.09);
    }
    state.vines.length = 0;
    if (state.age >= 1.2 && state.age < 6.2) {
        const e = game.enemies;
        for (let i = 0; i < e.n; i++) {
            if (e.dead[i] || e.boss[i] || e.wildBoss[i] || e.trainer[i] || e.shiny[i]
                || e.weaken[i] > 0 || i === e.aimedCaptureTarget
                || e.protectedFamilies?.[e.fam[i]]) continue;
            const dx = state.x - e.x[i], dy = state.y - e.y[i], distance = Math.hypot(dx, dy);
            if (distance > skill.radius + e.r[i]) continue;
            const inner = 82 + e.r[i];
            const shift = Math.min(Math.max(0, distance - inner), 185 * dt);
            if (distance > 0.01) { e.x[i] += dx / distance * shift; e.y[i] += dy / distance * shift; }
            e.root[i] = Math.max(e.root[i], 0.12);
            // Copy endpoints, never retain array indices across enemy compaction.
            if (state.vines.length < 12) state.vines.push({ x: e.x[i], y: e.y[i] });
        }
    }
    while (state.ticks < skill.poisonTicks
        && state.age + 1e-8 >= skill.poisonStart + state.ticks * skill.poisonInterval) {
        damageArea(game, state, skill.radius, 0.4 / skill.poisonTicks);
        state.ticks++;
    }
    if (!state.finished && state.age >= skill.finale) {
        state.finished = true;
        damageArea(game, state, skill.radius, 0.5);
        game.wave(state.x, state.y, 24, skill.radius, 0.7, '#f395b3');
        game.particleBursts.burst(seg.fam, state.x, state.y, 0, 'mega-skill', form.id);
        game.kick(0.22);
        game.logEvent('mega.skill-impact', { form: form.id, skill: skill.name,
            hits: state.hits, kills: state.kills, x: Math.round(state.x), y: Math.round(state.y) });
        game.say(`巨花绽放 · 击败 ${state.kills} 只`, 2);
    }
    if (!seg.megaSkillActive) seg.venusaurGarden = null;
}

export function drawPreview (game, g, form, skill, ready, pulse) {
    const p = target(game.skillOrigin(game.selectedMega), game.aimWorld.x, game.aimWorld.y, skill.range);
    g.fillColor = game.pal.get('#83b35b', ready ? 20 : 10);
    g.circle(p.x, p.y, skill.radius); g.fill();
    g.strokeColor = game.pal.get(form.color, ready ? 150 + Math.round(pulse * 60) : 75);
    g.lineWidth = 2; g.circle(p.x, p.y, skill.radius); g.stroke();
    for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        g.fillColor = game.pal.get('#f5a4bb', ready ? 180 : 80);
        g.circle(p.x + Math.cos(a) * 12, p.y + Math.sin(a) * 12, 6); g.fill();
    }
}

// The top Graphics pass owns the flower; skip the generic Mega area and its particles.
export function drawEffect () {}

export function drawScreenEffect (game, g, fx, skill) {
    if (fx.shape !== skill.shape || !fx.layout) return;
    const s = fx.layout, t = s.age, x = s.x, y = s.y;
    const fade = 1 - clamp((t - 7.6) / 0.8);
    const color = (hex, alpha = 255) => game.pal.get(hex, Math.round(alpha * fade));
    const dot = (px, py, r, hex, alpha = 255) => {
        g.fillColor = color(hex, alpha); g.circle(px, py, Math.max(0.01, r)); g.fill();
    };
    const stroke = (points, hex, width, alpha = 255) => {
        g.strokeColor = color(hex, alpha); g.lineWidth = width;
        g.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) g.lineTo(points[i][0], points[i][1]);
        g.stroke();
    };
    if (t < skill.landing) {
        const p = clamp(t / skill.landing);
        const px = s.originX + (x - s.originX) * p;
        const py = s.originY + (y - s.originY) * p + Math.sin(p * Math.PI) * 140;
        dot(px, py, 19, '#47733b'); dot(px, py + 4, 13, '#ef92ae');
        return;
    }
    const grow = ease((t - skill.landing) / 0.6);
    g.fillColor = color('#789c51', 24); g.circle(x, y, skill.radius * grow); g.fill();
    for (const vine of s.vines) {
        const points = [];
        for (let k = 0; k <= 12; k++) {
            const q = k / 12;
            points.push([x + (vine.x - x) * q + Math.sin(q * Math.PI) * 15,
                y + (vine.y - y) * q + Math.sin(q * Math.PI) * 20]);
        }
        stroke(points, '#335d35', 12, 230); stroke(points, '#83ac4c', 5, 245);
        g.strokeColor = color('#517c3d'); g.lineWidth = 4;
        g.circle(vine.x, vine.y, 16); g.stroke();
    }
    const open = t < 6.2 ? 1 : t < skill.finale ? 1 - ease((t - 6.2) / .55) : ease((t - skill.finale) / .16);
    const size = grow * (1 + .12 * Math.sin(clamp((t - skill.finale) / .55) * Math.PI));
    // Low leaf rosette and raised stem support the giant seven-petal blossom.
    for (let i = 0; i < 7; i++) {
        const a = i * Math.PI * 2 / 7;
        stroke([[x, y], [x + Math.cos(a) * 56 * size, y + Math.sin(a) * 35 * size]],
            i % 2 ? '#487b3d' : '#6c9845', 27 * Math.max(.01, size));
    }
    stroke([[x, y - 8], [x, y + 34 * size]], '#3d743d', 21 * Math.max(.01, size));
    const cy = y + 34 * size;
    const petals = (count, length, width, hex, offset) => {
        for (let i = 0; i < count; i++) {
            const a = i * Math.PI * 2 / count + offset, ux = Math.cos(a), uy = Math.sin(a);
            const points = [];
            for (let k = 0; k <= 20; k++) {
                const theta = k / 20 * Math.PI * 2;
                const along = length * (1 - Math.cos(theta)) / 2;
                const across = width * Math.sin(theta);
                points.push([x + (ux * along - uy * across) * size,
                    cy + (uy * along + ux * across) * size * .78]);
            }
            g.fillColor = color(hex); g.strokeColor = color('#ac4c71'); g.lineWidth = 2;
            g.moveTo(...points[0]); for (let j = 1; j < points.length; j++) g.lineTo(...points[j]);
            g.close(); g.fill(); g.stroke();
            stroke([[x, cy], [x + ux * length * .75 * size, cy + uy * length * .75 * size * .78]], '#ffbecd', 2);
        }
    };
    petals(7, 40 + open * 60, 16 + open * 24, '#ee839f', 0);
    petals(5, 28 + open * 34, 13 + open * 12, '#ffc0ca', .4);
    dot(x, cy, 24 * size, '#853c57'); dot(x, cy + 2, 18 * size, '#e9c26c');
    for (let i = 0; i < 9; i++) dot(x + Math.cos(i * 2.4) * 12 * size,
        cy + 2 + Math.sin(i * 2.4) * 10 * size, 3 * size, '#fff1b5');
    if (t >= skill.poisonStart && t < 6.5) {
        for (let i = 0; i < 32; i++) {
            const p = ((t - skill.poisonStart) * .65 + i * .073) % 1, a = i * 2.399 + t * .16;
            dot(x + Math.cos(a) * p * skill.radius, cy + Math.sin(a) * p * skill.radius * .72 + p * 20,
                6 + p * 9, i % 2 ? '#ad73c5' : '#d8a9de', 85 * Math.sin(p * Math.PI));
        }
    }
    if (t >= skill.finale) {
        const p = clamp((t - skill.finale) / 1.4), radius = ease(p) * skill.radius;
        g.strokeColor = color('#ed9cbb', 235 * (1 - p)); g.lineWidth = 4 + 10 * (1 - p);
        g.circle(x, y, Math.max(.01, radius)); g.stroke();
        for (let i = 0; i < 24; i++) {
            const a = i * Math.PI / 12;
            dot(x + Math.cos(a) * radius, y + Math.sin(a) * radius, 4 + 6 * (1 - p),
                i % 2 ? '#f497b4' : '#ffe0ba', 230 * (1 - p));
        }
    }
}
