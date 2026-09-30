import { BOSS, PLAYER } from './config.js';

const TAU = Math.PI * 2;

/** Locked, telegraphed arena attacks for a legendary lair; aims are fixed when each warning begins. */
export class LegendaryAttackSystem {
    constructor () {
        this.reset();
    }

    reset () {
        this.active = false;
        this.phase = 'idle';
        this.type = 'circle';
        this.x = 0;
        this.y = 0;
        this.angle = 0;
        this.radius = 0;
        this.length = 0;
        this.width = 0;
        this.safeWidth = 0;
        this.safeOffset = 0;
        this.family = '';
        this.timeLeft = 0;
        this.cooldown = 0;
        this.cx = 0;
        this.cy = 0;
        this.attackCount = 0;
    }

    start (cx, cy, family = '') {
        this.reset();
        this.active = true;
        this.cx = cx;
        this.cy = cy;
        this.family = family;
        this.cooldown = 1.1;
    }

    _choose (rng, px, py, sourceX, sourceY) {
        if (this.family === 'legend-lugia') {
            // Lock the aim at warning time; the fixed cyan lane is the safe route through the wave.
            this.type = 'tsunami';
            this.angle = Math.atan2(py - sourceY, px - sourceX);
            this.length = 650;
            this.width = 300;
            this.safeWidth = 76;
            this.safeOffset = 96 * (rng.next() < 0.5 ? -1 : 1);
            this.x = sourceX + Math.cos(this.angle) * this.length * 0.5;
            this.y = sourceY + Math.sin(this.angle) * this.length * 0.5;
            this.radius = 0;
            this.phase = 'warning';
            this.timeLeft = BOSS.legendaryWindup;
            this.attackCount++;
            return;
        }
        this.type = rng.next() < 0.58 ? 'circle' : 'beam';
        const angle = rng.next() * TAU;
        if (this.type === 'circle') {
            const distance = Math.sqrt(rng.next()) * 215;
            this.x = this.cx + Math.cos(angle) * distance;
            this.y = this.cy + Math.sin(angle) * distance;
            this.radius = rng.range(88, 116);
            this.length = this.width = 0;
        } else {
            const distance = Math.sqrt(rng.next()) * 86;
            this.x = this.cx + Math.cos(angle) * distance;
            this.y = this.cy + Math.sin(angle) * distance;
            this.angle = rng.next() * TAU;
            this.length = 450;
            this.width = 74;
            this.radius = 0;
        }
        this.phase = 'warning';
        this.timeLeft = BOSS.legendaryWindup;
        this.attackCount++;
    }

    _contains (px, py) {
        if (this.type === 'circle') {
            return Math.hypot(px - this.x, py - this.y) <= this.radius + PLAYER.radius;
        }
        const dx = px - this.x;
        const dy = py - this.y;
        const along = dx * Math.cos(this.angle) + dy * Math.sin(this.angle);
        const across = -dx * Math.sin(this.angle) + dy * Math.cos(this.angle);
        const inRectangle = Math.abs(along) <= this.length * 0.5 + PLAYER.radius
            && Math.abs(across) <= this.width * 0.5 + PLAYER.radius;
        if (!inRectangle) return false;
        if (this.type === 'tsunami'
            && Math.abs(across - this.safeOffset) <= Math.max(0, this.safeWidth * 0.5 - PLAYER.radius)) {
            return false;
        }
        return true;
    }

    /** Returns a one-shot attack result exactly when the warning window closes. */
    step (dt, px, py, rng, sourceX = this.cx, sourceY = this.cy) {
        if (!this.active) return null;
        if (this.phase === 'idle') {
            this.cooldown -= dt;
            if (this.cooldown <= 0) this._choose(rng, px, py, sourceX, sourceY);
            return null;
        }
        this.timeLeft -= dt;
        if (this.phase === 'warning' && this.timeLeft <= 0) {
            this.phase = 'impact';
            this.timeLeft = 0.24;
            return { hit: this._contains(px, py), type: this.type, x: this.x, y: this.y,
                radius: this.radius, length: this.length, width: this.width, angle: this.angle,
                safeWidth: this.safeWidth, safeOffset: this.safeOffset };
        }
        if (this.phase === 'impact' && this.timeLeft <= 0) {
            this.phase = 'idle';
            this.cooldown = 0.9 + rng.next() * 0.7;
        }
        return null;
    }

    get label () {
        if (this.type === 'circle') return '范围爆裂';
        if (this.type === 'tsunami') return '洛奇亚海啸 · 躲进蓝色窄道';
        return '直线光束';
    }
}
