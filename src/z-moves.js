import { hitArea } from './combat.js';
import { Z_CRYSTALS, Z_POWER_BAND, zMoveMetrics } from './items/z-power-band.js';

const crystalById = Object.freeze(Object.fromEntries(Z_CRYSTALS.map((crystal) => [crystal.id, crystal])));

/** One aimed, traveling Z projectile and its one-shot impact; cooldown advances on the fixed-step clock. */
export class ZMoveSystem {
    constructor () {
        this.reset();
    }

    reset () {
        this.selected = null;
        this.cooldown = 0;
        this.projectile = null;
        this.burst = null;
    }

    select (id) {
        if (!crystalById[id]) return false;
        this.selected = id;
        return true;
    }

    launch (id, count, origin, target, damage) {
        const crystal = crystalById[id];
        const metrics = zMoveMetrics(count);
        if (!crystal || !metrics.count || this.cooldown > 0 || this.projectile) return null;
        let dx = target.x - origin.x;
        let dy = target.y - origin.y;
        let length = Math.hypot(dx, dy);
        if (length < 0.001) { dx = 1; dy = 0; length = 1; }
        dx /= length;
        dy /= length;
        const travel = Math.max(Z_POWER_BAND.minRange,
            Math.min(Z_POWER_BAND.maxRange, length));
        const startX = origin.x + dx * 28;
        const startY = origin.y + dy * 28;
        const endX = origin.x + dx * travel;
        const endY = origin.y + dy * travel;
        this.selected = id;
        this.cooldown = Z_POWER_BAND.cooldown;
        this.projectile = {
            id, x: startX, y: startY, startX, startY, endX, endY,
            dx, dy, left: Math.max(1, travel - 28), speed: Z_POWER_BAND.speed,
            damage: Math.max(1, Number(damage) || 1), ...metrics,
        };
        this.burst = null;
        return { id, x: startX, y: startY, angle: Math.atan2(dy, dx), count: metrics.count };
    }

    step (dt, enemies) {
        this.cooldown = Math.max(0, this.cooldown - dt);
        if (this.burst) {
            this.burst.age += dt;
            if (this.burst.age >= Z_POWER_BAND.burstDuration) this.burst = null;
        }
        const shot = this.projectile;
        if (!shot) return null;
        const distance = Math.min(shot.left, shot.speed * dt);
        shot.x += shot.dx * distance;
        shot.y += shot.dy * distance;
        shot.left -= distance;
        if (shot.left > 0) return null;
        shot.x = shot.endX;
        shot.y = shot.endY;
        const result = hitArea(enemies, shot.x, shot.y, shot.radius, shot.damage);
        this.burst = { id: shot.id, x: shot.x, y: shot.y, radius: shot.radius,
            projectileScale: shot.projectileScale, age: 0 };
        this.projectile = null;
        return { id: shot.id, x: shot.x, y: shot.y, radius: shot.radius,
            count: shot.count, damage: shot.damage, ...result };
    }
}

export { Z_CRYSTALS, Z_POWER_BAND, zMoveMetrics };
