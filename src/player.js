/*
 * The hero has no attack of any kind (§5.1) - this file is locomotion, the single HP bar that is
 * the game's only loss surface (§5.5-C), and the squash that makes the body read as weight.
 */
export class Player {
    constructor (cfg, hp) {
        this.cfg = cfg;
        this.baseHp = hp;
        this.maxhp = hp;
        // 移动速度 is a per-run card (§4), so the ceiling is a field, not a config read. Everything
        // that asks "how fast am I going" normalises against this, not against the base stat -
        // otherwise a speed buy would silently inflate the 甩尾 bonus and the 引导 break test.
        this.speedMul = 1;
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.facing = 1;
        this.direction = 0;
        this.speed = 0;
        this.squash = 0;
        this.hit = 0;
        this.reset();
    }

    get maxSpeed () {
        return this.cfg.speed * this.speedMul;
    }

    reset () {
        this.maxhp = this.baseHp;
        this.speedMul = 1;
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.facing = 1;
        this.direction = 0;
        this.speed = 0;
        this.hp = this.maxhp;
        this.hit = 0;
        this.invuln = 0;
        this.dead = false;
    }

    hurt (amount, iFrame = this.cfg.iFrame) {
        if (this.dead || this.invuln > 0 || amount <= 0) return false;
        this.hp -= amount;
        this.invuln = iFrame;
        this.hit = 0.14;
        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
        }
        return true;
    }

    update (dt, axis, movement = null) {
        if (this.hit > 0) this.hit -= dt;
        if (this.invuln > 0) this.invuln -= dt;
        const top = movement && Number.isFinite(movement.speed) ? movement.speed : this.maxSpeed;
        const wantX = axis.x * top;
        const wantY = axis.y * top;
        const accel = movement && Number.isFinite(movement.accel) ? movement.accel : this.cfg.accel;
        const k = 1 - Math.exp(-accel * dt);
        this.vx += (wantX - this.vx) * k;
        this.vy += (wantY - this.vy) * k;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (Math.abs(this.vx) > 8) this.facing = this.vx > 0 ? 1 : -1;
        if (this.speed > 8) {
            if (Math.abs(this.vx) > Math.abs(this.vy)) this.direction = this.vx < 0 ? 1 : 2;
            else this.direction = this.vy < 0 ? 0 : 3;
        }
        this.squash = Math.min(1, this.speed / top);
    }
}
