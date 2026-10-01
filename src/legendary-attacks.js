import { BOSS, PLAYER } from './config.js';

const TAU = Math.PI * 2;
const circle = (x, y, radius) => ({ shape: 'circle', x, y, radius });
const lane = (x, y, length, width, angle) => ({ shape: 'rect', x, y, length, width, angle });
const segment = (x1, y1, x2, y2, width) => lane((x1 + x2) * 0.5, (y1 + y2) * 0.5,
    Math.hypot(x2 - x1, y2 - y1), width, Math.atan2(y2 - y1, x2 - x1));
const polar = (x, y, distance, angle) => ({ x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance });

/** Locked, telegraphed signature attacks for lair and roaming legendary encounters. */
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
        const second = this.attackCount % 2 === 1;
        const areas = [];
        const markers = [];
        let name = '';
        let type = 'signature';

        if (this.family === 'legend-lugia' && !second) {
            // The water lane is intentionally reserved as a wide, stable route through the wave.
            type = 'tsunami'; name = '海啸推线 · 躲进蓝色窄道';
            this.angle = angle;
            this.length = 650; this.width = 300; this.safeWidth = 92;
            this.safeOffset = 108 * (rng.next() < 0.5 ? -1 : 1);
            this.x = sourceX + ux * this.length * 0.5;
            this.y = sourceY + uy * this.length * 0.5;
            areas.push(lane(this.x, this.y, this.length, this.width, angle));
            this.safeAreas = [lane(this.x + nx * this.safeOffset, this.y + ny * this.safeOffset,
                this.length - 18, this.safeWidth, angle)];
        } else {
            this.angle = angle;
            this.safeWidth = this.safeOffset = 0;
            this.x = target.x; this.y = target.y;
            this.safeAreas = [];

            if (this.family === 'legend-mewtwo') {
                if (!second) {
                    name = '念力陨石';
                    const count = phaseTwo ? 6 : 4;
                    for (let i = 0; i < count; i++) {
                        const t = (i - (count - 1) / 2) * 53;
                        areas.push(circle(target.x + nx * t + ux * (i % 2) * 26,
                            target.y + ny * t + uy * (i % 2) * 26, 32));
                    }
                } else {
                    name = '精神冲击';
                    for (const offset of (phaseTwo ? [-88, 0, 88] : [-74, 74])) {
                        areas.push(lane(target.x + nx * offset, target.y + ny * offset,
                            430, 46, angle + Math.PI / 2));
                    }
                }
            } else if (this.family === 'legend-lugia') {
                name = '气旋爆裂';
                for (const offset of (phaseTwo ? [-94, 0, 94] : [-76, 76])) {
                    areas.push(lane(target.x + nx * offset, target.y + ny * offset,
                        500, 42, angle));
                }
            } else if (this.family === 'legend-hooh') {
                if (!second) {
                    name = '凤凰翼焰';
                    for (const offset of (phaseTwo ? [-112, 0, 112] : [-84, 0, 84])) {
                        const laneAngle = angle + offset * 0.0018;
                        areas.push(lane(target.x + nx * offset, target.y + ny * offset,
                            430, 47, laneAngle));
                    }
                } else {
                    name = '圣焰坠羽';
                    const count = phaseTwo ? 7 : 5;
                    for (let i = 0; i < count; i++) {
                        const t = (i - (count - 1) / 2) * 54;
                        const along = (i % 2) * 40;
                        areas.push(circle(target.x + nx * t + ux * along,
                            target.y + ny * t + uy * along, 28));
                    }
                }
            } else if (this.family === 'legend-rayquaza') {
                if (!second) {
                    name = '天空俯冲';
                    areas.push(lane(target.x, target.y, 560, phaseTwo ? 104 : 86, angle));
                } else {
                    name = '龙尾交错扫击';
                    const sweepAngle = angle + (rng.next() < 0.5 ? -0.42 : 0.42);
                    areas.push(lane(target.x, target.y, 480, 52, sweepAngle));
                    areas.push(lane(target.x, target.y, 420, 46, sweepAngle + Math.PI * 0.36));
                }
            } else if (this.family === 'legend-kyogre') {
                if (!second) {
                    name = '根源水柱';
                    const rows = phaseTwo ? [-72, 0, 72] : [-62, 62];
                    for (let row = 0; row < rows.length; row++) {
                        for (let col = -1; col <= 1; col++) {
                            if ((row + col) % 2 === 0) continue;
                            areas.push(circle(target.x + ux * col * 74 + nx * rows[row],
                                target.y + uy * col * 74 + ny * rows[row], 31));
                        }
                    }
                } else {
                    name = '原始海潮';
                    const offsets = phaseTwo ? [-120, -40, 40, 120] : [-84, 0, 84];
                    for (const offset of offsets) {
                        areas.push(lane(target.x + nx * offset, target.y + ny * offset,
                            430, 54, angle));
                    }
                }
            } else if (this.family === 'legend-groudon') {
                if (!second) {
                    name = '分叉地脉';
                    const reach = 255;
                    for (const branch of (phaseTwo ? [-0.48, -0.2, 0.2, 0.48] : [-0.36, 0, 0.36])) {
                        const end = polar(sourceX, sourceY, reach, angle + branch);
                        areas.push(segment(sourceX, sourceY, end.x, end.y, 38));
                    }
                } else {
                    name = '断崖喷发';
                    const count = phaseTwo ? 7 : 5;
                    for (let i = 0; i < count; i++) {
                        const t = (i - (count - 1) / 2) * 64;
                        areas.push(circle(target.x + nx * t, target.y + ny * t, 30));
                    }
                }
            } else if (this.family === 'legend-dialga') {
                name = second ? '时光咆哮 · 回响' : '时间裂束';
                areas.push(lane(target.x - nx * 48, target.y - ny * 48,
                    500, 42, angle));
                areas.push(lane(target.x + nx * 48, target.y + ny * 48,
                    500, 42, angle));
                if (phaseTwo) areas.push(lane(target.x, target.y, 500, 38, angle));
            } else if (this.family === 'legend-palkia') {
                if (!second) {
                    name = '空间裂斩';
                    areas.push(lane(target.x, target.y, 560, 48, angle));
                    const a = polar(target.x, target.y, 250, angle + Math.PI);
                    const b = polar(target.x, target.y, 250, angle);
                    markers.push(circle(a.x, a.y, 21), circle(b.x, b.y, 21));
                } else {
                    name = '亚空交错';
                    const slash = angle + (rng.next() < 0.5 ? -0.55 : 0.55);
                    areas.push(lane(target.x, target.y, 480, 44, slash));
                    areas.push(lane(target.x, target.y, 420, 40, slash + Math.PI * 0.42));
                    for (const a of [slash, slash + Math.PI]) {
                        const portal = polar(target.x, target.y, 215, a);
                        markers.push(circle(portal.x, portal.y, 20));
                    }
                }
            } else if (this.family === 'legend-arceus') {
                name = second ? '制裁光砾 · 四方落阵' : '制裁星芒';
                const count = second ? (phaseTwo ? 5 : 4) : 5;
                const offset = second ? Math.PI / 4 : angle;
                for (let i = 0; i < count; i++) {
                    if (!second && i === 2) continue; // This open spoke is the visible escape route.
                    const a = offset + i * TAU / count;
                    const from = polar(sourceX, sourceY, second ? 58 : 0, a);
                    const to = polar(sourceX, sourceY, second ? 248 : 220, a);
                    areas.push(segment(from.x, from.y, to.x, to.y, phaseTwo ? 42 : 34));
                }
            } else if (this.family === 'wildboss-articuno') {
                name = '暴雪冰羽';
                const count = phaseTwo ? 7 : 5;
                for (let i = 0; i < count; i++) {
                    const t = (i - (count - 1) / 2) / Math.max(1, count - 1);
                    const offset = t * (phaseTwo ? 190 : 148);
                    areas.push(circle(target.x + nx * offset, target.y + ny * offset + (i % 2) * 22, 38));
                }
            } else if (this.family === 'wildboss-zapdos') {
                name = '分叉雷链';
                const fork = polar(target.x, target.y, 106, angle + Math.PI);
                areas.push(segment(sourceX, sourceY, target.x, target.y, 34));
                for (const branch of (phaseTwo ? [-0.58, -0.24, 0.24, 0.58] : [-0.43, 0.43])) {
                    const end = polar(target.x, target.y, 115, angle + branch);
                    areas.push(segment(fork.x, fork.y, end.x, end.y, 30));
                }
            } else if (this.family === 'wildboss-moltres') {
                name = '火焰回旋';
                for (const offset of (phaseTwo ? [-96, 0, 96] : [-72, 72])) {
                    const a = angle + (offset < 0 ? -0.3 : 0.3);
                    areas.push(lane(target.x + nx * offset, target.y + ny * offset,
                        350, 42, a));
                }
            } else if (this.family === 'wildboss-raikou') {
                name = '雷牙突进';
                areas.push(lane(target.x, target.y, 420, phaseTwo ? 86 : 68, angle));
                if (phaseTwo) {
                    areas.push(lane(target.x + nx * 58, target.y + ny * 58, 280, 32, angle + 0.2));
                }
            } else if (this.family === 'wildboss-entei') {
                name = '火山喷涌';
                const count = phaseTwo ? 8 : 6;
                for (let i = 0; i < count; i++) {
                    const a = i * TAU / count + angle * 0.22;
                    const p = polar(target.x, target.y, 44 + (i % 2) * 48, a);
                    areas.push(circle(p.x, p.y, 30));
                }
            } else if (this.family === 'wildboss-suicune') {
                name = '极光水流';
                const count = phaseTwo ? 7 : 5;
                for (let i = 0; i < count; i++) {
                    const a = angle - 0.9 + i * 1.8 / (count - 1);
                    const p = polar(target.x, target.y, 78, a);
                    areas.push(circle(p.x, p.y, 38));
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
            this.timeLeft = 0.32;
            return { hit: this._contains(px, py), type: this.type, name: this.name,
                x: this.x, y: this.y, radius: this.radius, length: this.length, width: this.width,
                angle: this.angle, safeWidth: this.safeWidth, safeOffset: this.safeOffset,
                areas: this.areas, safeAreas: this.safeAreas, markers: this.markers,
                family: this.family, wildBoss: this.wildBoss, phaseTwo: this.phaseTwo };
        }
        if (this.phase === 'impact' && this.timeLeft <= 0) {
            this.phase = 'idle';
            this.cooldown = this.wildBoss ? 2.3 + rng.next() * 0.7 : 1.9 + rng.next() * 1.1;
        }
        return null;
    }

    get label () {
        return this.name || (this.type === 'tsunami' ? '海啸推线 · 躲进蓝色窄道' : '招式预警');
    }
}
