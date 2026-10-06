/*
 * 【掷】 - 精灵球 (v0.4). The verb used to be a vacuum: a kill stood up a 兽魂 and the crosshair sucked
 * it in, which is precisely what nobody could read ("没看到自己是否在捕捉"). A ball carries its own aim,
 * its own animation and its own verdict, so everything here serves one promise: the line drawn out of
 * the hero *is* the path, and the first animal that path touches is the animal you get.
 *
 * Two invariants hold this together. §6.5-3 - the player chooses, so nothing joins the chain that the
 * crosshair did not point down. And the reticle's preview runs the identical swept test the ball runs,
 * because a targeting aid that promises a hit and then misses is worse than no aid at all.
 */

export const EV_HIT = 1;
export const EV_MISS = 3;
export const EV_POP = 4;
/** A ball off a BOSS. Its own kind, because the elite's "未虚弱" explanation would be a lie here. */
export const EV_BOSS = 5;

const TAU = Math.PI * 2;

/**
 * Earliest contact between a corridor and a circle: walk along the unit ray `dir` from `x,y` for at
 * most `max` px and report how far out the circle at `cx,cy` first fits inside half-width `rr`.
 * Clamping `t` at 0 means "already overlapping" counts as a hit, so a ball can never pass through a
 * body it started the step inside. Shared with 主技 (§5.7): a pet's shot and the player's ball must
 * disagree about nothing, or two different rules are deciding what is reachable.
 */
export function graze (x, y, dx, dy, max, cx, cy, rr) {
    const ox = cx - x;
    const oy = cy - y;
    let t = ox * dx + oy * dy;
    if (t > max) return -1;
    if (t < 0) t = 0;
    const px = ox - dx * t;
    const py = oy - dy * t;
    return px * px + py * py > rr * rr ? -1 : t;
}

export class CaptureSystem {
    constructor (ball, catc) {
        this.ball = ball;
        this.c = catc;
        const bcap = ball.cap;
        // Balls in flight. `bleft` is the remaining 投程 in px, so a 投程 card taken mid-flight cannot
        // retro-extend a ball that was already thrown.
        this.bx = new Float32Array(bcap);
        this.by = new Float32Array(bcap);
        this.bvx = new Float32Array(bcap);
        this.bvy = new Float32Array(bcap);
        this.bleft = new Float32Array(bcap);
        this.br = new Float32Array(bcap);
        this.bt = new Float32Array(bcap);
        // A ball has two lives: in the air (stage 0), then sitting on the animal it took and wobbling
        // (stage 1). It keeps its slot through the wobble, which is why `cap` has to be sized against
        // cooldown + flight + wobTime and not against flight alone.
        this.bstage = new Uint8Array(bcap);
        this.bwob = new Float32Array(bcap);
        // Whose animal this ball is holding, so the release does not have to remember a side effect.
        this.bfam = new Int16Array(bcap);
        this.btier = new Uint8Array(bcap);
        this.bgold = new Uint8Array(bcap);
        this.bshiny = new Uint8Array(bcap);
        this.bn = 0;
        // The animal a ball took, on its way to the tail. Same fixed-time streak the 兽魂 had, because
        // that part already read: the ball sells the hit, this sells the arrival.
        const pcap = 16;
        this.x = new Float32Array(pcap);
        this.y = new Float32Array(pcap);
        this.sx = new Float32Array(pcap);
        this.sy = new Float32Array(pcap);
        this.life = new Float32Array(pcap);
        this.fam = new Int16Array(pcap);
        this.tier = new Uint8Array(pcap);
        this.gold = new Uint8Array(pcap);
        this.shiny = new Uint8Array(pcap);
        this.n = 0;
        // Packed as fam | tier<<8 | gold<<16 so a busy frame allocates nothing.
        this.landed = [];
        this.thrown = 0;
        this.taken = 0;
        this.bounced = 0;
        this.whiffed = 0;
        // (kind, x, y, gold, shiny) once per outcome, so the visual layer can put a ring exactly where it
        // happened without the simulation knowing anything about rings.
        this.onEvent = null;
    }

    reset () {
        this.clearInFlight();
        this.thrown = 0;
        this.taken = 0;
        this.bounced = 0;
        this.whiffed = 0;
    }

    /** Cancel transient balls when changing maps without erasing this run's capture statistics. */
    clearInFlight () {
        this.bn = 0;
        this.n = 0;
        this.landed.length = 0;
    }

    _ev (kind, x, y, gold, shiny = false, fam = -1, tier = 1) {
        if (this.onEvent) this.onEvent(kind, x, y, gold, shiny, fam, tier);
    }

    _removeBall (i) {
        const last = --this.bn;
        if (i !== last) {
            this.bx[i] = this.bx[last];
            this.by[i] = this.by[last];
            this.bvx[i] = this.bvx[last];
            this.bvy[i] = this.bvy[last];
            this.bleft[i] = this.bleft[last];
            this.br[i] = this.br[last];
            this.bt[i] = this.bt[last];
            this.bstage[i] = this.bstage[last];
            this.bwob[i] = this.bwob[last];
            this.bfam[i] = this.bfam[last];
            this.btier[i] = this.btier[last];
            this.bgold[i] = this.bgold[last];
            this.bshiny[i] = this.bshiny[last];
        }
    }

    /**
     * Launch one ball down the unit vector `dx,dy`. `false` means the ball pool is full, which is the
     * only way a press can be void - a throw that hits nothing is still a throw, and it costs the
     * cooldown like anything else.
     */
    throw (x, y, dx, dy, o) {
        if (this.bn >= this.ball.cap) return false;
        const i = this.bn++;
        this.bx[i] = x;
        this.by[i] = y;
        this.bvx[i] = dx * o.speed;
        this.bvy[i] = dy * o.speed;
        this.bleft[i] = o.range;
        this.br[i] = o.r;
        this.bt[i] = 0;
        this.bstage[i] = 0;
        this.bwob[i] = 0;
        this.thrown++;
        return true;
    }

    /**
     * The first animal a throw along this ray would take, or -1. `predict` and the ball's own step test
     * below share `graze` on purpose: what the reticle lights up is what the ball gets.
     */
    predict (x, y, dx, dy, o, enemies) {
        if (enemies.trainerActive) return -1;
        let best = -1;
        let bt = Infinity;
        for (let i = 0; i < enemies.n; i++) {
            if (enemies.dead[i]) continue;
            const t = graze(x, y, dx, dy, o.range, enemies.x[i], enemies.y[i], o.r + enemies.r[i]);
            if (t < 0 || t >= bt) continue;
            bt = t;
            best = i;
        }
        return best;
    }

    /**
     * Resolve one contact. `false` = the ball was shrugged off and is spent (BOSS / 训练家 only);
     * `true` = the animal is taken and the ball is now sitting on the spot where it hit, wobbling.
     *
     * 命中即收服 (design call): every non-BOSS body the ball touches joins the party, elite or not -
     * the aim is the whole skill, and no weaken gate stands between a good throw and its catch.
     *
     * `taken` and `capture()` fire on the contact frame, never on the pop. The wobble is the
     * performance of a verdict that has already been paid out; §6.2 deleted the catch-probability
     * system, so a shake that could still end in "no" would put that dice back on the table.
     */
    _take (i, j, hx, hy, enemies) {
        const elite = enemies.elite[j] === 1;
        const shiny = !!(enemies.shiny && enemies.shiny[j]);
        // §5 line 105: **BOSS 不可捕捉**, and unlike an elite there is no state it can be knocked into
        // that changes that. The clang is the only answer this verb can give, which is also why the
        // reticle says 不可捕捉 before the throw rather than after.
        const legendaryReady = enemies.legendaryReady && enemies.legendaryReady[j] === 1;
        const wildBossReady = enemies.wildBossReady && enemies.wildBossReady[j] === 1;
        if ((enemies.boss[j] === 1 && !legendaryReady && !wildBossReady) || enemies.trainer[j] === 1) {
            enemies.flash[j] = 0.08;
            this.bounced++;
            this._ev(EV_BOSS, hx, hy);
            return false;
        }
        // Read before capture() marks the body dead, so the record cannot be poisoned by the removal.
        const fam = enemies.fam[j];
        const tier = legendaryReady ? 1 : (elite && !shiny) ? 2 : enemies.tier[j];
        const gold = legendaryReady || (elite && !shiny) ? 1 : 0;
        enemies.capture(j);
        this.taken++;
        this._ev(EV_HIT, hx, hy, gold, shiny);
        this.bx[i] = hx;
        this.by[i] = hy;
        this.bstage[i] = 1;
        this.bwob[i] = 0;
        this.bfam[i] = fam;
        this.btier[i] = tier;
        this.bgold[i] = gold;
        this.bshiny[i] = shiny ? 1 : 0;
        return true;
    }

    /**
     * Open a settled ball and hand its animal to the tail. A full inbound pool skips the flight and
     * lands the record directly - the overflow path was already instant, and making the player wait
     * through a pop for something that has nowhere to fly would only add latency to a loss.
     */
    _release (i) {
        const fam = this.bfam[i];
        const tier = this.btier[i];
        const gold = this.bgold[i];
        const shiny = this.bshiny[i];
        const hx = this.bx[i];
        const hy = this.by[i];
        this._ev(EV_POP, hx, hy, gold, shiny, fam, tier);
        if (this.n >= this.x.length) {
            this.landed.push((fam & 0xff) | (tier << 8) | (gold << 16) | (shiny << 17));
            return;
        }
        const k = this.n++;
        this.x[k] = this.sx[k] = hx;
        this.y[k] = this.sy[k] = hy;
        this.life[k] = 0;
        this.fam[k] = fam;
        this.tier[k] = tier;
        this.gold[k] = gold;
        this.shiny[k] = shiny;
    }

    /** Is this ball resting where it hit rather than flying? The renderer drops its trail when it is. */
    holding (i) {
        return this.bstage[i] === 1;
    }

    /**
     * Tilt this frame in radians, 0 while in flight. A damped swing that is upright at both ends, so
     * the ball settles into the pop instead of freezing mid-fall. The renderer reads the angle from
     * here rather than recomputing it, so the wobble you see *is* the timer that gates the release -
     * a decorative curve that could drift out of sync with the real delay is worse than none.
     */
    tilt (i) {
        if (this.bstage[i] !== 1) return 0;
        const k = Math.min(1, this.bwob[i] / this.ball.wobTime);
        // (1 - k) on top of the sine is what makes the last two swings visibly weaker than the first.
        return this.ball.wobAmp * Math.sin(k * this.ball.wobSwings * TAU) * (1 - k);
    }

    update (dt, enemies, tx, ty) {
        const W = this.ball.wobTime;
        for (let i = 0; i < this.bn; i++) {
            if (this.bstage[i] === 1) {
                this.bwob[i] += dt;
                if (this.bwob[i] >= W) {
                    this._release(i);
                    this._removeBall(i);
                    i--;
                }
                continue;
            }
            const sp = Math.sqrt(this.bvx[i] * this.bvx[i] + this.bvy[i] * this.bvy[i]) || 1;
            const ux = this.bvx[i] / sp;
            const uy = this.bvy[i] / sp;
            const step = Math.min(this.bleft[i], sp * dt);
            let hit = -1;
            let ht = Infinity;
            for (let j = 0; j < enemies.n; j++) {
                if (enemies.trainerActive) break;
                if (enemies.dead[j]) continue;
                const t = graze(this.bx[i], this.by[i], ux, uy, step,
                    enemies.x[j], enemies.y[j], this.br[i] + enemies.r[j]);
                if (t < 0 || t >= ht) continue;
                ht = t;
                hit = j;
            }
            this.bt[i] += dt;
            this.bleft[i] -= step;
            if (hit >= 0) {
                if (!this._take(i, hit, this.bx[i] + ux * ht, this.by[i] + uy * ht, enemies)) {
                    this._removeBall(i);
                    i--;
                }
                continue;
            }
            this.bx[i] += ux * step;
            this.by[i] += uy * step;
            if (this.bleft[i] <= 0.001) {
                this.whiffed++;
                this._ev(EV_MISS, this.bx[i], this.by[i]);
                this._removeBall(i);
                i--;
            }
        }

        const T = this.ball.flyTime;
        for (let i = 0; i < this.n; i++) {
            // Fixed 0.34 s from the hit to the tail however far that is, easing into the arrival, so a
            // catch always takes exactly one beat to become a link.
            const k = Math.min(1, this.life[i] + dt / T);
            const e = k * k * (1.6 - 0.6 * k);
            this.x[i] = this.sx[i] + (tx - this.sx[i]) * e;
            this.y[i] = this.sy[i] + (ty - this.sy[i]) * e;
            this.life[i] = k;
            if (k >= 1) {
            this.landed.push((this.fam[i] & 0xff) | (this.tier[i] << 8)
                | (this.gold[i] << 16) | (this.shiny[i] << 17));
                const last = --this.n;
                if (i !== last) {
                    this.x[i] = this.x[last];
                    this.y[i] = this.y[last];
                    this.sx[i] = this.sx[last];
                    this.sy[i] = this.sy[last];
                    this.life[i] = this.life[last];
                    this.fam[i] = this.fam[last];
                    this.tier[i] = this.tier[last];
                    this.gold[i] = this.gold[last];
                    this.shiny[i] = this.shiny[last];
                }
                i--;
            }
        }
    }
}
