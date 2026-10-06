import { BOSS, PLAYER } from './config.js';

const TAU = Math.PI * 2;
const circle = (x, y, radius) => ({ shape: 'circle', x, y, radius });
const lane = (x, y, length, width, angle) => ({ shape: 'rect', x, y, length, width, angle });
const segment = (x1, y1, x2, y2, width) => lane((x1 + x2) * 0.5, (y1 + y2) * 0.5,
    Math.hypot(x2 - x1, y2 - y1), width, Math.atan2(y2 - y1, x2 - x1));
const polar = (x, y, distance, angle) => ({ x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance });

/** Locked, telegraphed three-move lair rotations and two-move roaming legendary signatures. */
export class LegendaryAttackSystem {
    constructor () {
        this.reset();
    }

    reset () {
        this.active = false;
        this.phase = 'idle';
        this.type = 'idle';
        this.name = '';
        this.x = 0;
        this.y = 0;
        this.angle = 0;
        this.radius = 0;
        this.length = 0;
        this.width = 0;
        this.safeWidth = 0;
        this.safeOffset = 0;
        this.areas = [];
        this.safeAreas = [];
        this.markers = [];
        this.family = '';
        this.wildBoss = false;
        this.phaseTwo = false;
        this.moveIndex = 0;
        this.ultimate = false;
        this.phaseTwoAnnounced = false;
        this.timeLeft = 0;
        this.cooldown = 0;
        this.cx = 0;
        this.cy = 0;
        this.attackCount = 0;
    }

    start (cx, cy, family = '', { wildBoss = false } = {}) {
        this.reset();
        this.active = true;
        this.cx = cx;
        this.cy = cy;
        this.family = family;
        this.wildBoss = wildBoss;
        this.phaseTwoAnnounced = false;
        this.cooldown = wildBoss ? 1.45 : 1.1;
    }

    _buildPattern (rng, px, py, sourceX, sourceY, phaseTwo) {
        const dx = px - sourceX;
        const dy = py - sourceY;
        const distance = Math.hypot(dx, dy) || 1;
        const angle = Math.atan2(dy, dx);
        const ux = Math.cos(angle);
        const uy = Math.sin(angle);
        const nx = -uy;
        const ny = ux;
        const advance = Math.min(550, Math.max(112, distance - 25));
        const target = { x: sourceX + ux * advance, y: sourceY + uy * advance };
        const moveIndex = this.wildBoss ? this.attackCount % 2 : this.attackCount % 3;
        const second = moveIndex === 1;
        const ultimate = moveIndex === 2;
        const areas = [];
        const markers = [];
        let name = '';
        let type = 'signature';

        if (this.family === 'legend-lugia' && moveIndex === 0) {
            // The water lane is intentionally reserved as a wide, stable route through the wave.
            type = 'tsunami'; name = '海啸推线 · 躲进蓝色窄道';
            this.angle = angle;
            this.length = phaseTwo ? 700 : 650;
            this.width = phaseTwo ? 352 : 300;
            this.safeWidth = phaseTwo ? 80 : 92;
            this.safeOffset = (phaseTwo ? 132 : 108) * (rng.next() < 0.5 ? -1 : 1);
            this.x = sourceX + ux * this.length * 0.5;
            this.y = sourceY + uy * this.length * 0.5;
            areas.push(lane(this.x, this.y, this.length, this.width, angle));
            this.safeAreas = [lane(this.x + nx * this.safeOffset, this.y + ny * this.safeOffset,
                this.length - 18, this.safeWidth, angle)];
            this.moveIndex = moveIndex;
        } else {
            this.angle = angle;
            this.safeWidth = this.safeOffset = 0;
            this.x = target.x; this.y = target.y;
            this.safeAreas = [];

            if (this.family === 'legend-mewtwo') {
                if (moveIndex === 0) {
                    name = '念力陨石';
                    const count = phaseTwo ? 6 : 4;
                    for (let i = 0; i < count; i++) {
                        const t = (i - (count - 1) / 2) * 53;
                        areas.push(circle(target.x + nx * t + ux * (i % 2) * 26,
                            target.y + ny * t + uy * (i % 2) * 26, 32));
                    }
                } else if (second) {
                    name = '精神冲击';
                    for (const offset of (phaseTwo ? [-88, 0, 88] : [-74, 74])) {
                        areas.push(lane(target.x + nx * offset, target.y + ny * offset,
                            430, 46, angle + Math.PI / 2));
                    }
                } else {
                    name = '心灵封域';
                    areas.push(circle(target.x, target.y, phaseTwo ? 46 : 38));
                    const count = phaseTwo ? 8 : 6;
                    const radius = phaseTwo ? 154 : 138;
                    for (let i = 0; i < count; i++) {
                        const a = angle + i * TAU / count;
                        if (!phaseTwo && i === 3) continue;
                        const p = polar(target.x, target.y, radius, a);
                        areas.push(circle(p.x, p.y, phaseTwo ? 30 : 26));
                    }
                }
            } else if (this.family === 'legend-lugia') {
                if (second) {
                    name = '气旋爆裂';
                    for (const offset of (phaseTwo ? [-94, 0, 94] : [-76, 76])) {
                        areas.push(lane(target.x + nx * offset, target.y + ny * offset,
                            phaseTwo ? 560 : 500, phaseTwo ? 50 : 42, angle));
                    }
                } else {
                    name = '苍穹风眼';
                    const count = phaseTwo ? 10 : 8;
                    areas.push(circle(target.x, target.y, phaseTwo ? 55 : 46));
                    const ringRadius = phaseTwo ? 166 : 150;
                    for (let i = 0; i < count; i++) {
                        const a = angle + i * TAU / count;
                        if (!phaseTwo && i === 2) continue;
                        const p = polar(target.x, target.y, ringRadius, a);
                        areas.push(circle(p.x, p.y, phaseTwo ? 34 : 30));
                    }
                }
            } else if (this.family === 'legend-hooh') {
                if (moveIndex === 0) {
                    name = '凤凰翼焰';
                    for (const offset of (phaseTwo ? [-112, 0, 112] : [-84, 0, 84])) {
                        const laneAngle = angle + offset * 0.0018;
                        areas.push(lane(target.x + nx * offset, target.y + ny * offset,
                            phaseTwo ? 480 : 430, phaseTwo ? 56 : 47, laneAngle));
                    }
                } else if (second) {
                    name = '圣焰坠羽';
                    const count = phaseTwo ? 7 : 5;
                    for (let i = 0; i < count; i++) {
                        const t = (i - (count - 1) / 2) * 54;
                        const along = (i % 2) * 40;
                        areas.push(circle(target.x + nx * t + ux * along,
                            target.y + ny * t + uy * along, 28));
                    }
                } else {
                    name = '日轮焚天';
                    areas.push(circle(target.x, target.y, phaseTwo ? 72 : 60));
                    const count = phaseTwo ? 7 : 5;
                    for (let i = 0; i < count; i++) {
                        const a = angle + (i - (count - 1) / 2) * (phaseTwo ? 0.32 : 0.4);
                        const from = polar(target.x, target.y, 38, a);
                        const to = polar(target.x, target.y, phaseTwo ? 250 : 218, a);
                        areas.push(segment(from.x, from.y, to.x, to.y, phaseTwo ? 40 : 34));
                    }
                }
            } else if (this.family === 'legend-rayquaza') {
                if (moveIndex === 0) {
                    name = '天空俯冲';
                    areas.push(lane(target.x, target.y, phaseTwo ? 620 : 560,
                        phaseTwo ? 112 : 86, angle));
                } else if (second) {
                    name = '龙尾交错扫击';
                    const sweepAngle = angle + (rng.next() < 0.5 ? -0.42 : 0.42);
                    areas.push(lane(target.x, target.y, 480, 52, sweepAngle));
                    areas.push(lane(target.x, target.y, 420, 46, sweepAngle + Math.PI * 0.36));
                } else {
                    name = '苍天裂界';
                    const spreads = phaseTwo ? [-0.56, -0.28, 0, 0.28, 0.56] : [-0.48, -0.16, 0.16, 0.48];
                    for (let i = 0; i < spreads.length; i++) {
                        if (!phaseTwo && i === 2) continue;
                        areas.push(lane(target.x, target.y, 520,
                            phaseTwo ? 44 : 40, angle + spreads[i]));
                    }
                }
            } else if (this.family === 'legend-kyogre') {
                if (moveIndex === 0) {
                    name = '根源水柱';
                    const rows = phaseTwo ? [-72, 0, 72] : [-62, 62];
                    for (let row = 0; row < rows.length; row++) {
                        for (let col = -1; col <= 1; col++) {
                            if ((row + col) % 2 === 0) continue;
                            areas.push(circle(target.x + ux * col * 74 + nx * rows[row],
                                target.y + uy * col * 74 + ny * rows[row], 31));
                        }
                    }
                } else if (second) {
                    name = '原始海潮';
                    const offsets = phaseTwo ? [-120, -40, 40, 120] : [-84, 0, 84];
                    for (const offset of offsets) {
                        areas.push(lane(target.x + nx * offset, target.y + ny * offset,
                            430, 54, angle));
                    }
                } else {
                    name = '深渊漩潮';
                    areas.push(circle(target.x, target.y, phaseTwo ? 54 : 42));
                    const count = phaseTwo ? 9 : 7;
                    const ringRadius = phaseTwo ? 162 : 142;
                    for (let i = 0; i < count; i++) {
                        const a = angle + i * TAU / count;
                        if (!phaseTwo && (i === 2 || i === 5)) continue;
                        const p = polar(target.x, target.y, ringRadius, a);
                        areas.push(circle(p.x, p.y, phaseTwo ? 34 : 29));
                    }
                }
            } else if (this.family === 'legend-groudon') {
                if (moveIndex === 0) {
                    name = '分叉地脉';
                    const reach = 255;
                    for (const branch of (phaseTwo ? [-0.48, -0.2, 0.2, 0.48] : [-0.36, 0, 0.36])) {
                        const end = polar(sourceX, sourceY, reach, angle + branch);
                        areas.push(segment(sourceX, sourceY, end.x, end.y, phaseTwo ? 48 : 38));
                    }
                } else if (second) {
                    name = '断崖喷发';
                    const count = phaseTwo ? 7 : 5;
                    for (let i = 0; i < count; i++) {
                        const t = (i - (count - 1) / 2) * 64;
                        areas.push(circle(target.x + nx * t, target.y + ny * t, 30));
                    }
                } else {
                    name = '大陆震落';
                    areas.push(circle(target.x, target.y, phaseTwo ? 50 : 40));
                    const spokes = phaseTwo ? 8 : 6;
                    for (let i = 0; i < spokes; i++) {
                        const a = angle + i * TAU / spokes;
                        if (!phaseTwo && i === 2) continue;
                        const from = polar(target.x, target.y, 28, a);
                        const to = polar(target.x, target.y, phaseTwo ? 224 : 190, a);
                        areas.push(segment(from.x, from.y, to.x, to.y, phaseTwo ? 42 : 36));
                    }
                }
            } else if (this.family === 'legend-dialga') {
                if (moveIndex === 0) {
                    name = '时间裂束';
                    areas.push(lane(target.x - nx * 48, target.y - ny * 48,
                        phaseTwo ? 560 : 500, phaseTwo ? 50 : 42, angle));
                    areas.push(lane(target.x + nx * 48, target.y + ny * 48,
                        phaseTwo ? 560 : 500, phaseTwo ? 50 : 42, angle));
                    if (phaseTwo) areas.push(lane(target.x, target.y, 560, 42, angle));
                } else if (second) {
                    name = '时光咆哮 · 回响';
                    for (const spread of (phaseTwo ? [-0.54, -0.27, 0, 0.27, 0.54] : [-0.42, 0, 0.42])) {
                        areas.push(lane(target.x, target.y, 480, phaseTwo ? 42 : 36,
                            angle + spread));
                    }
                } else {
                    name = '时序停摆';
                    areas.push(circle(target.x, target.y, phaseTwo ? 46 : 38));
                    const count = phaseTwo ? 8 : 6;
                    for (let i = 0; i < count; i++) {
                        const a = angle + i * TAU / count;
                        if (!phaseTwo && i === 3) continue;
                        const p = polar(target.x, target.y, phaseTwo ? 148 : 132, a);
                        areas.push(circle(p.x, p.y, phaseTwo ? 28 : 24));
                    }
                }
            } else if (this.family === 'legend-palkia') {
                if (moveIndex === 0) {
                    name = '空间裂斩';
                    areas.push(lane(target.x, target.y, phaseTwo ? 620 : 560,
                        phaseTwo ? 58 : 48, angle));
                    const a = polar(target.x, target.y, 250, angle + Math.PI);
                    const b = polar(target.x, target.y, phaseTwo ? 285 : 250, angle);
                    markers.push(circle(a.x, a.y, phaseTwo ? 25 : 21),
                        circle(b.x, b.y, phaseTwo ? 25 : 21));
                } else if (second) {
                    name = '亚空交错';
                    const slash = angle + (rng.next() < 0.5 ? -0.55 : 0.55);
                    areas.push(lane(target.x, target.y, 480, 44, slash));
                    areas.push(lane(target.x, target.y, 420, 40, slash + Math.PI * 0.42));
                    for (const a of [slash, slash + Math.PI]) {
                        const portal = polar(target.x, target.y, 215, a);
                        markers.push(circle(portal.x, portal.y, 20));
                    }
                    if (phaseTwo) areas.push(lane(target.x, target.y, 470, 38, angle));
                } else {
                    name = '次元坍缩';
                    areas.push(circle(target.x, target.y, phaseTwo ? 56 : 46));
                    const count = phaseTwo ? 7 : 5;
                    for (let i = 0; i < count; i++) {
                        const a = angle + TAU * i / count;
                        const portal = polar(target.x, target.y, phaseTwo ? 154 : 136, a);
                        areas.push(circle(portal.x, portal.y, phaseTwo ? 32 : 27));
                        markers.push(circle(portal.x, portal.y, phaseTwo ? 22 : 19));
                    }
                    for (const spread of (phaseTwo ? [-0.48, 0.48] : [-0.44, 0.44])) {
                        areas.push(lane(target.x, target.y, 410, 34, angle + spread));
                    }
                }
            } else if (this.family === 'legend-arceus') {
                if (!ultimate) {
                    name = second ? '制裁光砾 · 四方落阵' : '制裁星芒';
                    const count = second ? (phaseTwo ? 5 : 4) : (phaseTwo ? 6 : 5);
                    const offset = second ? Math.PI / 4 : angle;
                    for (let i = 0; i < count; i++) {
                        if (!second && i === 2) continue; // This open spoke is the visible escape route.
                        const a = offset + i * TAU / count;
                        const from = polar(sourceX, sourceY, second ? 58 : 0, a);
                        const to = polar(sourceX, sourceY,
                            second ? 248 : (phaseTwo ? 260 : 220), a);
                        areas.push(segment(from.x, from.y, to.x, to.y, phaseTwo ? 48 : 34));
                    }
                } else {
                    name = '创世审判';
                    areas.push(circle(target.x, target.y, phaseTwo ? 58 : 48));
                    const count = phaseTwo ? 8 : 6;
                    const ringRadius = phaseTwo ? 166 : 146;
                    for (let i = 0; i < count; i++) {
                        const a = angle + i * TAU / count;
                        if (!phaseTwo && i === 2) continue;
                        const p = polar(target.x, target.y, ringRadius, a);
                        areas.push(circle(p.x, p.y, phaseTwo ? 32 : 27));
                    }
                }
            } else if (this.family === 'wildboss-articuno') {
                if (!second) {
                    name = '暴雪冰羽';
                    const count = phaseTwo ? 7 : 5;
                    for (let i = 0; i < count; i++) {
                        const t = (i - (count - 1) / 2) / Math.max(1, count - 1);
                        const offset = t * (phaseTwo ? 190 : 148);
                        areas.push(circle(target.x + nx * offset,
                            target.y + ny * offset + (i % 2) * 22, 38));
                    }
                } else {
                    name = '冰翼贯羽';
                    for (const spread of (phaseTwo ? [-0.34, 0, 0.34] : [-0.27, 0.27])) {
                        areas.push(lane(target.x, target.y, 430, phaseTwo ? 44 : 38,
                            angle + spread));
                    }
                }
            } else if (this.family === 'wildboss-zapdos') {
                if (!second) {
                    name = '分叉雷链';
                    const fork = polar(target.x, target.y, 106, angle + Math.PI);
                    areas.push(segment(sourceX, sourceY, target.x, target.y, 34));
                    for (const branch of (phaseTwo ? [-0.58, -0.24, 0.24, 0.58] : [-0.43, 0.43])) {
                        const end = polar(target.x, target.y, 115, angle + branch);
                        areas.push(segment(fork.x, fork.y, end.x, end.y, 30));
                    }
                } else {
                    name = '雷枝交错';
                    const fork = polar(target.x, target.y, 148, angle + Math.PI);
                    for (const slash of (phaseTwo ? [-0.64, -0.22, 0.22, 0.64] : [-0.5, 0.5])) {
                        const from = polar(fork.x, fork.y, 188, angle + slash + Math.PI);
                        const to = polar(target.x, target.y, 168, angle + slash);
                        areas.push(segment(from.x, from.y, to.x, to.y, phaseTwo ? 30 : 26));
                    }
                    const crossStart = polar(target.x, target.y, 92, angle + Math.PI);
                    const crossEnd = polar(target.x, target.y, 92, angle);
                    areas.push(segment(crossStart.x, crossStart.y, crossEnd.x, crossEnd.y, 28));
                }
            } else if (this.family === 'wildboss-moltres') {
                if (!second) {
                    name = '火焰回旋';
                    for (const offset of (phaseTwo ? [-96, 0, 96] : [-72, 72])) {
                        const a = angle + (offset < 0 ? -0.3 : 0.3);
                        areas.push(lane(target.x + nx * offset, target.y + ny * offset,
                            350, 42, a));
                    }
                } else {
                    name = '三羽坠焰';
                    const count = phaseTwo ? 7 : 5;
                    for (let i = 0; i < count; i++) {
                        const column = (i - (count - 1) / 2) * (phaseTwo ? 63 : 70);
                        const row = (i % 2) * 54 - 27;
                        areas.push(circle(target.x + nx * column + ux * row,
                            target.y + ny * column + uy * row, phaseTwo ? 31 : 28));
                    }
                }
            } else if (this.family === 'wildboss-raikou') {
                if (!second) {
                    name = '雷牙突进';
                    areas.push(lane(target.x, target.y, 420, phaseTwo ? 86 : 68, angle));
                    if (phaseTwo) {
                        areas.push(lane(target.x + nx * 58, target.y + ny * 58, 280, 32, angle + 0.2));
                    }
                } else {
                    name = '雷纹双爪';
                    const cut = phaseTwo ? 0.43 : 0.36;
                    areas.push(lane(target.x, target.y, 440, phaseTwo ? 46 : 40, angle - cut));
                    areas.push(lane(target.x, target.y, 440, phaseTwo ? 46 : 40, angle + cut));
                    if (phaseTwo) areas.push(lane(target.x, target.y, 340, 34, angle));
                }
            } else if (this.family === 'wildboss-entei') {
                if (!second) {
                    name = '火山喷涌';
                    const count = phaseTwo ? 8 : 6;
                    for (let i = 0; i < count; i++) {
                        const a = i * TAU / count + angle * 0.22;
                        const p = polar(target.x, target.y, 44 + (i % 2) * 48, a);
                        areas.push(circle(p.x, p.y, 30));
                    }
                } else {
                    name = '炎鬃踏震';
                    const count = phaseTwo ? 10 : 8;
                    areas.push(circle(target.x, target.y, phaseTwo ? 47 : 42));
                    for (let i = 0; i < count; i++) {
                        const a = i * TAU / count + angle * 0.16;
                        const p = polar(target.x, target.y, phaseTwo ? 122 : 108, a);
                        areas.push(circle(p.x, p.y, phaseTwo ? 27 : 25));
                    }
                }
            } else if (this.family === 'wildboss-suicune') {
                if (!second) {
                    name = '极光水流';
                    const count = phaseTwo ? 7 : 5;
                    for (let i = 0; i < count; i++) {
                        const a = angle - 0.9 + i * 1.8 / (count - 1);
                        const p = polar(target.x, target.y, 78, a);
                        areas.push(circle(p.x, p.y, 38));
                    }
                } else {
                    name = '回澜水幕';
                    const offsets = phaseTwo ? [-92, 0, 92] : [-72, 72];
                    for (const offset of offsets) {
                        areas.push(lane(target.x + nx * offset, target.y + ny * offset,
                            360, phaseTwo ? 42 : 36, angle + Math.sign(offset || 1) * 0.13));
                    }
                }
            } else {
                name = '神兽冲击';
                areas.push(circle(target.x, target.y, 96));
            }
        }

        this.type = type;
        this.name = name;
        this.areas = areas;
        this.markers = markers;
        this.phaseTwo = phaseTwo;
        this.moveIndex = moveIndex;
        this.ultimate = ultimate;
    }

    _inside (shape, px, py, safe = false) {
        if (shape.shape === 'circle') {
            const radius = safe ? Math.max(0, shape.radius - PLAYER.radius) : shape.radius + PLAYER.radius;
            return Math.hypot(px - shape.x, py - shape.y) <= radius;
        }
        const dx = px - shape.x;
        const dy = py - shape.y;
        const along = dx * Math.cos(shape.angle) + dy * Math.sin(shape.angle);
        const across = -dx * Math.sin(shape.angle) + dy * Math.cos(shape.angle);
        const halfLength = shape.length * 0.5;
        const halfWidth = shape.width * 0.5;
        if (safe) {
            return Math.abs(along) <= Math.max(0, halfLength - PLAYER.radius)
                && Math.abs(across) <= Math.max(0, halfWidth - PLAYER.radius);
        }
        const outsideLength = Math.max(0, Math.abs(along) - halfLength);
        const outsideWidth = Math.max(0, Math.abs(across) - halfWidth);
        return outsideLength * outsideLength + outsideWidth * outsideWidth <= PLAYER.radius * PLAYER.radius;
    }

    _contains (px, py) {
        if (!this.areas.some((area) => this._inside(area, px, py))) return false;
        return !this.safeAreas.some((area) => this._inside(area, px, py, true));
    }

    /** Returns a one-shot attack result exactly when the warning window closes. */
    step (dt, px, py, rng, sourceX = this.cx, sourceY = this.cy, hpRatio = 1) {
        if (!this.active) return null;
        if (this.phase === 'idle') {
            this.cooldown -= dt;
            if (this.cooldown <= 0) {
                this._buildPattern(rng, px, py, sourceX, sourceY, hpRatio <= 0.5);
                this.phase = 'warning';
                this.timeLeft = BOSS.legendaryWindup;
                this.attackCount++;
            }
            return null;
        }
        this.timeLeft -= dt;
        if (this.phase === 'warning' && this.timeLeft <= 0) {
            this.phase = 'impact';
            this.timeLeft = BOSS.legendaryImpact;
            return { hit: this._contains(px, py), type: this.type, name: this.name,
                x: this.x, y: this.y, radius: this.radius, length: this.length, width: this.width,
                angle: this.angle, safeWidth: this.safeWidth, safeOffset: this.safeOffset,
                areas: this.areas, safeAreas: this.safeAreas, markers: this.markers,
                family: this.family, wildBoss: this.wildBoss, phaseTwo: this.phaseTwo,
                moveIndex: this.moveIndex, ultimate: this.ultimate };
        }
        if (this.phase === 'impact' && this.timeLeft <= 0) {
            this.phase = 'idle';
            if (this.wildBoss) {
                this.cooldown = this.phaseTwo ? 1.55 + rng.next() * 0.35 : 2.15 + rng.next() * 0.55;
            } else {
                const mainBossRecovery = this.phaseTwo ? 1.35 + rng.next() * 0.45 : 1.85 + rng.next() * 0.5;
                this.cooldown = mainBossRecovery + (this.moveIndex === 2 ? 0.65 : 0);
            }
        }
        return null;
    }

    get label () {
        return this.name || (this.type === 'tsunami' ? '海啸推线 · 躲进蓝色窄道' : '招式预警');
    }
}
