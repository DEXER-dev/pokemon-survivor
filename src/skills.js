/*
 * Main attacks: each segment's full damage budget is expressed through its species skill - bullets,
 * beams, fields, or lunges. The party tail only follows and carries its visuals; it no longer damages.
 *
 * The bank holds damage while a segment has no valid target, capped at one volley so it cannot save a
 * nuke indefinitely. A volley is additionally priced
 * against the target it is aimed at (`_price`), because conserved-then-overkilled money is still gone
 * from the field - and mob HP is `chainDps/300 × 2.5 s`, which is far below one charged shot.
 *
 * What this deliberately does not do:
 * - No queue. A volley that cannot fit the live cap stays armed and fires the moment a slot frees,
 *   because a delayed shot lands somewhere the player has stopped looking at.
 * - No area damage from a pounce. It pays one body, because the inflated 节圆 it drags along already
 *   spends the coverage half of the deal; an AoE on top would be buying the same DPS twice.
 * - No tail bonus from 位移 (§5.7-A-4). A pounce writes `chain.ox`, never a seat, and `nspd` is measured
 *   off `chain.bx` - so the +80% stays the player's own reward for whipping the snake.
 *
 * The field and beam forms (§5.7-G step 3) are where the same rule gets its second shape: they cost no
 * projectile at all, so the WeChat bill they run is one quad, and their price is solved against *the
 * crowd they actually cover* rather than one aimed body. That is the 走廊级定价 §9.8-② asked for, arriving
 * as a property of the form instead of a patch to the bullet.
 */
import { CHAIN, ENEMY, PROJ, SKILLS, VIEW, MAX_BODY_R, PPM } from './config.js';
import { graze } from './capture.js';
import { segDps, skillShare, nodeBonus } from './combat.js';
import { MEGA_BY_ID, megaFormForSegment } from './mega.js';
import {
    projectileFamilyModuleForSegment, projectileModuleForSegment, projectileModuleForShot,
} from './skills/registry.js';

// Mob-sized on purpose: this is the 环's inner tolerance, not a query slop. See `MAX_BODY_R`.
const MAX_ENEMY_R = ENEMY.radius * 2;

/**
 * §5.7-E's per-tier tables stop at 3 阶, and a forged 4 阶 (§7.1) still has to shoot. Clamping the index
 * rather than handing every family a 4th row is the honest reading of "形态改变而非纯数值" *at that step*:
 * 4 阶 buys its jump from `DPS[3]` = 240 and a bigger, diamond-marked node, and keeps 3 阶's silhouette
 * until the art pass gives it one of its own. It also means a new tier never has to touch this file.
 */
const tAt = (arr, i) => arr[Math.min(i, arr.length - 1)];
const priorityTarget = (enemies, j) => !!(!(enemies.wildBossReady && enemies.wildBossReady[j])
    && ((enemies.boss && enemies.boss[j])
        || (enemies.legendary && enemies.legendary[j]
            && !(enemies.legendaryReady && enemies.legendaryReady[j]))
        || (enemies.trainerActive && enemies.trainer && enemies.trainer[j])));

/** Per-segment state rides on the segment: links splice, so no array index can own it. */
const gearOf = (seg) => seg.sk || (seg.sk = {
    cd: 0, bank: 0, ph: 0, t: 0, dur: 0, dist: 0, dx: 1, dy: 0, hop: 0, hops: 1, owe: 0,
    // A beam's own steering angle, seeded backwards so 2 阶's second柱 starts 180° off and the pair
    // reads as one sweep before either one has hunted anything.
    a0: 0, a1: Math.PI, seeded: 0,
});

export class SkillSystem {
    constructor (cfg = PROJ) {
        this.cfg = cfg;
        // The sim's A/B switch. Off is not "frozen numbers" - it is literally the pre-v0.5 code path,
        // because `seg.keep` stays undefined and `sweep` then costs exactly what it used to.
        this.on = true;
        this.px = new Float32Array(cfg.cap);
        this.py = new Float32Array(cfg.cap);
        this.pvx = new Float32Array(cfg.cap);
        this.pvy = new Float32Array(cfg.cap);
        this.pleft = new Float32Array(cfg.cap);
        this.pr = new Float32Array(cfg.cap);
        this.pdmg = new Float32Array(cfg.cap);
        this.pbounce = new Uint8Array(cfg.cap);
        this.pavoid = new Int32Array(cfg.cap);
        this.pavoid2 = new Int32Array(cfg.cap);
        this.pMode = new Uint8Array(cfg.cap);
        this.pStage = new Uint8Array(cfg.cap);
        this.pShiny = new Uint8Array(cfg.cap);
        this.pLegHit = new Uint8Array(cfg.cap);
        this.pOriginX = new Float32Array(cfg.cap);
        this.pOriginY = new Float32Array(cfg.cap);
        this.pmega = new Array(cfg.cap).fill(null);
        this.pvariant = new Uint8Array(cfg.cap);
        // Tandemaus' visible mouse projectile is sampled from the real simulation path, including
        // the last segment before impact. A 55 ms renderer poll can miss these fast, short flights.
        this.projectileSamples = [];
        this.nProjectileSamples = 0;
        // Family ids are constant strings, so a plain array costs nothing and keeps the tint local.
        this.pfam = new Array(cfg.cap).fill(null);
        this.n = 0;
        this._head = new Int16Array(CHAIN.hardCap);
        this._tail = new Int16Array(CHAIN.hardCap);
        this._q = [];
        // Candidate list for a crowd form's tick. Sized to the horde cap because a field can legally
        // hold dozens of bodies, and `max` (per 段) is what stops the pay loop, not this array.
        // Candidate ids may refer to mobs beyond the initial pool; Int32 keeps those indices intact.
        this._t = new Int32Array(ENEMY.initialCapacity);
        // §5.7-E's non-projectile forms still have to be *seen*, so the sim publishes what it covered
        // this frame and the renderer draws it. Reused slots: a frame with 32 段 must allocate nothing.
        this.fx = [];
        this.nfx = 0;
        // Bounded visual-event queue; rendering consumes it once per rendered frame, even if the
        // fixed-step simulation ran several times. These events never affect damage or targeting.
        this.bursts = [];
        this.nBursts = 0;
        // 闪耀/溅射类 Build 挂点：溅射半径 = 弹体半径 × splashMul（game.js 每帧同步）。
        this.splashMul = 1;
        // 击杀飞轮：每次野生击杀给伤害银行充能速率 +8%，无击杀时按 0.8/s 指数回落到 ×1，
        // 封顶 ×2.5。怪潮越密轮子转得越快——火力与压力成正比的反怪海飞轮。
        this.killBoost = 1;
        // §5.7-F-3's `hitEff` is `landed / spent`. `wasted` is the overkill hiding inside `landed`: a
        // channel can connect every single shot and still throw half its money on a corpse. `dry` is
        // the other failure, and the one `hitEff` cannot see: a crowd tick that came ready, came funded,
        // and found nothing standing in it. It spends zero, so it moves neither 中 nor 空 - which is
        // exactly how a 领域 whose ring sits inside the 甩尾's kill radius hides in a table of rates.
        this.m = { spent: 0, landed: 0, wasted: 0, lost: 0, fired: 0, volleys: 0, dry: 0 };
    }

    reset () {
        this.n = 0;
        this.nBursts = 0;
        this.nProjectileSamples = 0;
        for (const k of Object.keys(this.m)) this.m[k] = 0;
    }

    _sampleTandemausProjectile (i, x, y) {
        if (this.pfam[i] !== 'tandemaus' || this.nProjectileSamples >= 64) return;
        let sample = this.projectileSamples[this.nProjectileSamples];
        if (!sample) sample = this.projectileSamples[this.nProjectileSamples] = {};
        sample.x = x;
        sample.y = y;
        sample.angle = Math.atan2(this.pvy[i], this.pvx[i]);
        sample.variant = this.pvariant[i];
        sample.shiny = this.pShiny[i] === 1;
        sample.radius = this.pr[i];
        this.nProjectileSamples++;
    }

    _burst (kind, fam, x, y, angle = 0, megaId = null) {
        if (this.nBursts >= 64) return;
        let event = this.bursts[this.nBursts];
        if (event === undefined) event = this.bursts[this.nBursts] = { kind, fam, x, y, angle, megaId };
        else {
            event.kind = kind;
            event.fam = fam;
            event.x = x;
            event.y = y;
            event.angle = angle;
            event.megaId = megaId;
        }
        this.nBursts++;
    }

    consumeBursts (callback) {
        for (let i = 0; i < this.nBursts; i++) callback(this.bursts[i]);
        this.nBursts = 0;
    }

    get live () { return this.n; }

    _drop (i) {
        const last = --this.n;
        if (i !== last) {
            this.px[i] = this.px[last];
            this.py[i] = this.py[last];
            this.pvx[i] = this.pvx[last];
            this.pvy[i] = this.pvy[last];
            this.pleft[i] = this.pleft[last];
            this.pr[i] = this.pr[last];
            this.pdmg[i] = this.pdmg[last];
            this.pbounce[i] = this.pbounce[last];
            this.pavoid[i] = this.pavoid[last];
            this.pavoid2[i] = this.pavoid2[last];
            this.pMode[i] = this.pMode[last];
            this.pStage[i] = this.pStage[last];
            this.pShiny[i] = this.pShiny[last];
            this.pLegHit[i] = this.pLegHit[last];
            this.pOriginX[i] = this.pOriginX[last];
            this.pOriginY[i] = this.pOriginY[last];
            this.pfam[i] = this.pfam[last];
            this.pmega[i] = this.pmega[last];
            this.pvariant[i] = this.pvariant[last];
        }
    }

    /**
     * Put a 段's whole pack off its seat and re-bake `nx/ny` in the same breath, so nothing that reads a
     * node position has to remember an offset exists. `bx/by` stay the history-follow truth.
     */
    _seat (chain, lo, hi, x, y) {
        for (let j = lo; j <= hi; j++) {
            chain.ox[j] = x;
            chain.oy[j] = y;
            chain.nx[j] = chain.bx[j] + x;
            chain.ny[j] = chain.by[j] + y;
        }
    }

    /**
     * Nearest live body whose circle touches a disc of radius `r` at `x,y`, or -1. The grid answers with
     * whole cells, so the circle test afterwards is not redundant.
     */
    _nearest (enemies, x, y, r) {
        const q = this._q;
        enemies.grid.query(x, y, r + MAX_BODY_R, q);
        let best = -1;
        let bd = Infinity;
        let bestPriority = false;
        for (let k = 0; k < q.length; k++) {
            const j = q[k];
            if (enemies.dead[j] || j === enemies.aimedCaptureTarget
                || (enemies.wildBossReady && enemies.wildBossReady[j])
                || (enemies.legendaryReady && enemies.legendaryReady[j])) continue;
            const dx = enemies.x[j] - x;
            const dy = enemies.y[j] - y;
            const rr = r + enemies.r[j];
            const d2 = dx * dx + dy * dy;
            if (d2 > rr * rr) continue;
            // During boss encounters, retain wild Pokémon as valid targets but make every
            // aimed attack choose a boss/legendary/trainer party member before the wild crowd.
            const priority = priorityTarget(enemies, j);
            if (best >= 0 && (priority < bestPriority || (priority === bestPriority && d2 >= bd))) continue;
            bd = d2;
            best = j;
            bestPriority = priority;
        }
        return best;
    }

    /** Move encounter targets to the front before capped area attacks spend their damage budget. */
    _prioritize (enemies, list, n) {
        const protectedTarget = enemies.aimedCaptureTarget;
        if (protectedTarget >= 0) {
            let kept = 0;
            for (let i = 0; i < n; i++) {
                if (list[i] !== protectedTarget) list[kept++] = list[i];
            }
            n = kept;
        }
        if (n <= 0) return 0;
        if (!enemies.trainerActive && enemies.bossN <= 0) {
            let hasLegendary = false;
            for (let i = 0; i < n; i++) {
                const j = list[i];
                if (enemies.legendary && enemies.legendary[j]
                    && !(enemies.legendaryReady && enemies.legendaryReady[j])) {
                    hasLegendary = true;
                    break;
                }
            }
            if (!hasLegendary) return n;
        }
        let front = 0;
        for (let i = 0; i < n; i++) {
            const j = list[i];
            if (!priorityTarget(enemies, j)) continue;
            const swap = list[front];
            list[front++] = j;
            list[i] = swap;
        }
        return n;
    }

    /** §5.5-A publishes no per-segment node list, so rebuild both ends of every 段 from the node pass. */
    _seats (chain) {
        const segs = chain.segments;
        for (let i = 0; i < segs.length; i++) this._head[i] = -1;
        for (let j = 0; j < chain.nCount; j++) {
            const si = chain.segIndex[j];
            if (this._head[si] < 0) this._head[si] = j;
            this._tail[si] = j;
        }
    }

    /**
     * `ref` normalizes the movement bonus that enriches the skill budget. A hard turn still rewards
     * positioning, but collision with the party tail itself no longer hurts enemies.
     */
    /** 击杀飞轮的一格：+8% 银行充能，封顶 ×2.5。 */
    killFeedback () {
        this.killBoost = Math.min(2.5, this.killBoost + 0.08);
    }

    step (dt, chain, enemies, dmgMul, ref, sizeMul = 1, sizeMulForSegment = null, cdMul = 1) {
        // 飞轮回落：没有击杀喂它，充能速率指数滑回基础值。
        this.killBoost += (1 - this.killBoost) * Math.min(1, dt * 0.8);
        const segs = chain.segments;
        // A missing `ref` degrades to "no bonus", which is the pre-v0.5 arithmetic, never to NaN.
        const r = ref > 0 ? Math.max(1, ref) : Infinity;
        this._seats(chain);
        this.nfx = 0;
        for (let j = 0; j < chain.nCount; j++) {
            chain.ox[j] = 0;
            chain.oy[j] = 0;
        }
        for (let i = 0; i < segs.length; i++) {
            const seg = segs[i];
            const segmentSizeMul = sizeMul * (sizeMulForSegment ? sizeMulForSegment(seg) : 1);
            const cfg = SKILLS[seg.fam];
            seg.orb = 1;
            // 讲究围巾：冷却倍率随 Build 每帧带到 gear 上，四系主技共用同一把尺。
            gearOf(seg).cdMul = cdMul;
            const lo = this._head[i];
            const hi = this._tail[i];
            if (!cfg || !this.on || lo < 0) {
                seg.keep = cfg && this.on ? 1 : undefined;
                continue;
            }
            if (seg.mega && !megaFormForSegment(seg)) {
                seg.mega = null;
                seg.megaCd = 0;
            }
            if (megaFormForSegment(seg)) this._megaVolley(dt, chain, enemies, seg, hi, dmgMul, segmentSizeMul);
            if (cfg.fire === 'orbit') {
                seg.keep = 1;
                this._orbit(dt, chain, enemies, seg, cfg, hi, gearOf(seg));
                continue;
            }
            const s = skillShare(seg);
            let bn = 0;
            for (let j = lo; j <= hi; j++) bn += nodeBonus(chain, j, r);
            const budget = segDps(seg) * (bn / (hi - lo + 1)) * dt * this.killBoost;
            const sk = gearOf(seg);
            sk.cd -= dt;
            // Bank at most one volley; if no target or projectile slot is available, keep it armed.
            const take = Math.max(0, Math.min(budget * s, budget * s * cfg.cd * (sk.cdMul || 1) / dt - sk.bank));
            sk.bank += take;
            seg.keep = budget > 0 ? 1 - take / budget : 1;
            if (cfg.fire === 'lunge') this._lunge(dt, chain, enemies, seg, cfg, lo, hi, sk, dmgMul, segmentSizeMul);
            else if (cfg.fire === 'field') this._field(chain, enemies, seg, cfg, lo, hi, sk, dmgMul, segmentSizeMul);
            else if (cfg.fire === 'beam') this._beam(dt, chain, enemies, seg, cfg, hi, sk, dmgMul, segmentSizeMul);
            else this._aim(chain, enemies, seg, cfg, hi, sk, dmgMul, segmentSizeMul);
        }
        this._fly(dt, enemies);
    }

    /** Bullet: one volley down the line to the nearest body, `shots` splitting the same banked money. */
    _aim (chain, enemies, seg, cfg, muzzle, sk, dmgMul, sizeMul) {
        if (sk.cd > 0 || sk.bank <= 0) return;
        const tier = seg.tier - 1;
        const x = chain.bx[muzzle];
        const y = chain.by[muzzle];
        const j = this._nearest(enemies, x, y, tAt(cfg.reach, tier));
        if (j < 0) return;
        const projectileModule = projectileModuleForSegment(seg);
        const familyModule = projectileFamilyModuleForSegment(seg);
        const baseShots = projectileModule?.shots || tAt(cfg.shots, tier);
        const shots = familyModule ? familyModule.shotCount(chain, seg, baseShots) : baseShots;
        const fire = Math.min(shots, this.cfg.live - this.n);
        if (fire <= 0) return;
        const damageShares = projectileModule?.damageShares || 1;
        const usable = this._price(sk, enemies, j, fire * damageShares, dmgMul);
        const dx = enemies.x[j] - x;
        const dy = enemies.y[j] - y;
        const base = dx * dx + dy * dy > 1e-6 ? Math.atan2(dy, dx) : chain.na[muzzle];
        // `bulkOf` and not `visualOf`: a 满线 段 is one fat body rather than several copies in a row, and the
        // 弹幕 is exactly as wide as the body is - the same currency the 甩尾 circle and the drawn aura use.
        const r = (projectileModule?.radius || tAt(cfg.r, tier)) * sizeMul
            * (1 + 0.25 * (chain.bulkOf(seg) - 1));
        const carry = usable / (fire * damageShares);
        const projectileStart = this.n;
        const spread = familyModule ? familyModule.spread(cfg.spread, baseShots, shots) : cfg.spread;
        if (projectileModule) {
            projectileModule.launch(this, { x, y, base, fire, carry, dmgMul, radius: r, family: seg.fam });
        } else {
            for (let k = 0; k < fire; k++) {
                const a = base + (k - (shots - 1) / 2) * spread;
                const n = this.n++;
                this.px[n] = x;
                this.py[n] = y;
                this.pvx[n] = Math.cos(a) * tAt(cfg.speed, tier);
                this.pvy[n] = Math.sin(a) * tAt(cfg.speed, tier);
                this.pleft[n] = tAt(cfg.reach, tier);
                this.pr[n] = r;
                const bounces = cfg.bounces ? tAt(cfg.bounces, tier) : 0;
                this.pdmg[n] = carry * dmgMul / (bounces + 1);
                this.pfam[n] = seg.fam;
                this.pmega[n] = null;
                this.pvariant[n] = familyModule ? familyModule.variant(k) : 0;
                this.pbounce[n] = cfg.bounces ? tAt(cfg.bounces, tier) : 0;
                this.pavoid[n] = -1;
                this.pavoid2[n] = -1;
                this.pMode[n] = 0;
                this.pStage[n] = seg.tier;
                this.pShiny[n] = seg.shiny ? 1 : 0;
                this.pLegHit[n] = 0;
                this.pOriginX[n] = x;
                this.pOriginY[n] = y;
            }
        }
        // Preserve the firing segment's appearance on every projectile, including family modules
        // that allocate their own shot slots. Renderers can then select the matching shiny atlas frame.
        for (let n = projectileStart; n < this.n; n++) this.pShiny[n] = seg.shiny ? 1 : 0;
        this.m.volleys++;
        this.m.fired += fire;
        this.m.spent += usable * dmgMul;
        if (!projectileModule && fire < shots) this.m.lost += (carry * (shots - fire)) * dmgMul;
        this._burst(projectileModule?.launchEvent || familyModule?.launchEvent || 'shot', seg.fam, x, y, base);
        sk.cd = cfg.cd * (sk.cdMul || 1);
    }

    /** A Mega's signature fan is a deliberately separate bonus channel: huge, readable projectiles. */
    _megaVolley (dt, chain, enemies, seg, muzzle, dmgMul, sizeMul) {
        const form = MEGA_BY_ID[seg.mega];
        if (!form) return;
        seg.megaCd = Math.max(0, (seg.megaCd || 0) - dt);
        if (seg.megaCd > 0 || this.n >= this.cfg.live) return;
        const x = chain.bx[muzzle];
        const y = chain.by[muzzle];
        const range = 10 * PPM;
        const target = this._nearest(enemies, x, y, range);
        if (target < 0) return;
        const count = Math.min(form.shots, this.cfg.live - this.n);
        if (count <= 0) return;
        const dx = enemies.x[target] - x;
        const dy = enemies.y[target] - y;
        const base = dx * dx + dy * dy > 1e-6 ? Math.atan2(dy, dx) : chain.na[muzzle];
        const speed = 17 * PPM;
        const shotDamage = segDps(seg) * form.volleyPower * dmgMul / form.shots;
        for (let k = 0; k < count; k++) {
            const a = base + (k - (count - 1) / 2) * (form.spread / Math.max(1, count - 1));
            const n = this.n++;
            this.px[n] = x;
            this.py[n] = y;
            this.pvx[n] = Math.cos(a) * speed;
            this.pvy[n] = Math.sin(a) * speed;
            this.pleft[n] = range;
            this.pr[n] = 19 * sizeMul;
            this.pdmg[n] = shotDamage;
            this.pfam[n] = seg.fam;
            this.pmega[n] = form.id;
            this.pvariant[n] = 0;
            this.pbounce[n] = 0;
            this.pavoid[n] = -1;
            this.pavoid2[n] = -1;
            this.pMode[n] = 0;
            this.pStage[n] = 0;
            this.pLegHit[n] = 0;
        }
        this.m.volleys++;
        this.m.fired += count;
        this.m.spent += shotDamage * count;
        this._burst('mega', seg.fam, x, y, base, form.id);
        seg.megaCd = form.cooldown;
    }

    /**
     * Price a volley against the target's remaining HP. Unused money stays in the bank for the next target,
     * rather than being spent on a corpse or redirected into tail collision damage.
     *
     * The divide by `dmgMul` is the units question: the bank is kept in *nominal* money (it is withheld
     * from `segDps`, before the 增伤 card), while HP is absolute. Pricing nominal money against absolute
     * HP lets a build with `dmg ×1.97` pay almost twice what it is charging for.
     */
    _price (sk, enemies, j, n, dmgMul) {
        const need = enemies.hp[j] * this.cfg.overkill * n / Math.max(0.01, dmgMul);
        const usable = Math.min(sk.bank, need);
        sk.bank -= usable;
        return usable;
    }

    /**
     * Area 领域 (§5.7-E 烛火蛾 / 泡滴 / 石晶蜉): a ring standing on the 段, draining one tick's money off
     * the same bank a bullet would have spent. Zero projectiles, so the §5.7-C pool never sees it and the
     * WeChat bill is one quad; what it buys instead is *a ring the tail cannot reach*, which is why `ring`
     * is a multiple of the segment's own 节圆 (fattening with `count` the way §5.7-A-3 demands) and why the
     * multiple is large - see the measured 空转 rates in §9.9.
     */
    _field (chain, enemies, seg, cfg, lo, hi, sk, dmgMul, sizeMul) {
        // §5.7-A-3 says a 段 fires from its 尾节 and the bullet/beam forms obey that; the field used to
        // centre itself on the mean of the 段's nodes instead, which parks the ring on top of the hero.
        const cx = chain.nx[hi];
        const cy = chain.ny[hi];
        const R = Math.min(CHAIN.headRadius(chain.bulkOf(seg)) * tAt(cfg.ring, seg.tier - 1) * sizeMul, VIEW.fieldMaxR);
        const p = 1 - Math.max(0, sk.cd) / cfg.cd;
        // Drawn whether or not anything is standing in it: a field the player cannot see is a field he
        // cannot walk an enemy into, and 【走】 is one of the two verbs this game has.
        this._fx('field', seg.fam, cx, cy, R, 0, 0, p, seg.tier);
        if (sk.cd > 0 || sk.bank <= 0) return;
        sk.cd = cfg.cd * (sk.cdMul || 1);
        const q = this._q;
        enemies.grid.query(cx, cy, R + MAX_BODY_R, q);
        const t = this._t;
        const lim = Math.min(tAt(cfg.max, seg.tier - 1), t.length);
        // An annulus, because the spec's word is 环 and the glyph's word is a hoop: the inked band is
        // 0.84–0.98 of R, so that is what gets hit (plus the body's own radius). A filled disc here would
        // mean the damage reaches ground the picture never promised - and §9.9 measured that a filled disc
        // around a pet is empty anyway, because the 甩尾 grinds everything that close.
        const in2 = (R * 0.84 - MAX_ENEMY_R) * (R * 0.84 - MAX_ENEMY_R);
        let m = 0;
        for (let k = 0; k < q.length && m < t.length; k++) {
            const j = q[k];
            if (enemies.dead[j]) continue;
            const dx = enemies.x[j] - cx;
            const dy = enemies.y[j] - cy;
            const rr = R + enemies.r[j];
            const d2 = dx * dx + dy * dy;
            if (d2 > rr * rr || d2 < in2) continue;
            t[m++] = j;
        }
        m = this._prioritize(enemies, t, m);
        m = Math.min(m, lim);
        this._pay(sk, enemies, t, m, dmgMul);
        // Water bubbles briefly freeze; crystal growth pins longer. Both effects are control only,
        // so the existing damage budget and crowd-price accounting remain unchanged.
        const root = cfg.root ? tAt(cfg.root, seg.tier - 1) : 0;
        if (root > 0) for (let i = 0; i < m; i++) enemies.entangle(t[i], root);
        if (m > 0) this._burst('pulse', seg.fam, cx, cy);
    }

    /**
     * Beam 光柱 (§5.7-E 刺鳍龟): a penetrating bar that chases the horde at a capped turn rate, because a
     * beam that snaps onto its target is just a slow homing missile and 跟随转向 has to cost the player
     * something in positioning. 2 阶 opens a second bar turning the other way, and the pair splits one
     * bank - 形态改变而非纯数值 (§7.1) held literally.
     */
    _beam (dt, chain, enemies, seg, cfg, hi, sk, dmgMul, sizeMul) {
        const tier = seg.tier - 1;
        const nb = tAt(cfg.beams, tier);
        const len = tAt(cfg.len, tier);
        const B = tAt(cfg.wide, tier) * sizeMul * (1 + 0.25 * (chain.bulkOf(seg) - 1));
        const x = chain.nx[hi];
        const y = chain.ny[hi];
        if (!sk.seeded) {
            sk.seeded = 1;
            sk.a0 = chain.na[hi];
            sk.a1 = chain.na[hi] + Math.PI;
        }
        const p = 1 - Math.max(0, sk.cd) / cfg.cd;
        const j0 = this._nearest(enemies, x, y, len);
        const ready = sk.cd <= 0 && sk.bank > 0;
        if (ready) sk.cd = cfg.cd * (sk.cdMul || 1);
        const q = this._q;
        const t = this._t;
        const lim = Math.min(cfg.max ? tAt(cfg.max, tier) : 10, t.length);
        for (let b = 0; b < nb; b++) {
            const dir = b === 0 ? 1 : -1;
            let a = b === 0 ? sk.a0 : sk.a1;
            const want = j0 >= 0
                ? Math.atan2(enemies.y[j0] - y, enemies.x[j0] - x)
                : a + dir * 0.9;
            const turn = cfg.turn * dt;
            a += Math.max(-turn, Math.min(turn, Math.atan2(Math.sin(want - a), Math.cos(want - a))));
            if (b === 0) sk.a0 = a; else sk.a1 = a;
            const ca = Math.cos(a);
            const sa = Math.sin(a);
            const mx = x + ca * len * 0.5;
            const my = y + sa * len * 0.5;
            this._fx('beam', seg.fam, mx, my, len * 0.5, B, a, p);
            if (!ready) continue;
            enemies.grid.query(mx, my, len * 0.5 + B + MAX_BODY_R, q);
            let m = 0;
            for (let k = 0; k < q.length && m < t.length; k++) {
                const j = q[k];
                if (enemies.dead[j]) continue;
                const px = enemies.x[j] - x;
                const py = enemies.y[j] - y;
                const along = px * ca + py * sa;
                if (along < -enemies.r[j] || along > len + enemies.r[j]) continue;
                if (Math.abs(px * sa - py * ca) > B + enemies.r[j]) continue;
                t[m++] = j;
            }
            m = this._prioritize(enemies, t, m);
            m = Math.min(m, lim);
            // Each bar gets an equal share of what is left, so the 双柱 really is one volley split in
            // two rather than a 2× budget the tier table quietly handed out.
            this._pay(sk, enemies, t, m, dmgMul, sk.bank / (nb - b));
            if (m > 0) this._burst('beam', seg.fam, x, y, a);
        }
    }

    /**
     * Crowd pricing: every body may cost at most its own HP × overkill, and the money stops when the bank
     * does. A field does not need `_price`'s aimed-body rule because what it buys is coverage - the
     * ceiling is the covered bodies' total HP, which is the 走廊级定价 §9.8-② asks the bullet to grow into.
     */
    _pay (sk, enemies, list, n, dmgMul, money) {
        if (n <= 0) {
            this.m.dry++;
            return;
        }
        const budget = Math.min(sk.bank, money === undefined ? Infinity : money);
        if (!(budget > 0)) return;
        const k = this.cfg.overkill / Math.max(0.01, dmgMul);
        let left = budget;
        let spent = 0;
        this.m.volleys++;
        for (let i = 0; i < n; i++) {
            if (left <= 1e-4) break;
            const j = list[i];
            const pay = Math.min(left, enemies.hp[j] * k);
            if (pay <= 0) continue;
            const dmg = pay * dmgMul;
            left -= pay;
            spent += pay;
            this.m.landed += dmg;
            this.m.wasted += Math.max(0, dmg - enemies.hp[j]);
            enemies.hurt(j, dmg);
        }
        sk.bank -= spent;
        this.m.spent += spent * dmgMul;
    }

    /** One reused slot per covered form; the renderer reads `fx[0..nfx)` and never allocates either. */
    _fx (kind, fam, x, y, a, b, rot, p, c = 0) {
        // Invalid live chain coordinates can otherwise reach Node.setPosition from the render pass
        // every frame, throwing before the rest of the game can update. Skip only the visual record;
        // damage and skill timing remain owned by the simulation path.
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        let f = this.fx[this.nfx];
        if (f === undefined) f = this.fx[this.nfx] = { kind, fam, x, y, a, b, rot, p, c };
        else {
            f.kind = kind;
            f.fam = fam;
            f.x = x;
            f.y = y;
            f.a = a;
            f.b = b;
            f.rot = rot;
            f.p = p;
            f.c = c;
        }
        this.nfx++;
    }

    /** Homing 位移段: leave the seat, pay what it lands on, get yanked back by the chain. */
    _lunge (dt, chain, enemies, seg, cfg, lo, hi, sk, dmgMul, sizeMul) {
        const R = CHAIN.headRadius(chain.bulkOf(seg));
        const x = chain.bx[hi];
        const y = chain.by[hi];
        let e = 0;
        if (sk.ph === 0) {
            if (sk.cd > 0 || sk.bank <= 0) return;
            sk.hops = tAt(cfg.hops, seg.tier - 1);
            const j = this._hop(enemies, cfg, sk, x, y, R);
            if (j < 0) return;
            // Take-off only escrows the volley. Nothing is spent until the landing names its targets.
            const usable = this._price(sk, enemies, j, sk.hops, dmgMul);
            sk.hop = 1;
            sk.owe = usable / sk.hops;
            this.m.spent += usable * dmgMul;
            sk.cd = cfg.cd * (sk.cdMul || 1);
            e = 0;
        } else if (sk.ph === 1) {
            sk.t += dt;
            const k = Math.min(1, sk.t / sk.dur);
            e = 1 - (1 - k) * (1 - k);
            if (k >= 1) {
                sk.control = cfg.control ? tAt(cfg.control, seg.tier - 1) : 0;
                const lx = x + sk.dx * sk.dist;
                const ly = y + sk.dy * sk.dist;
                if (this._settle(sk, enemies, lx, ly, R * cfg.impact * sizeMul, dmgMul) > 0) {
                    this._burst('pulse', seg.fam, lx, ly);
                }
                sk.ph = 2;
                sk.t = 0;
                sk.dur = sk.dist / cfg.back;
            }
            // Render-only: the swipe rides the outbound hop so the lunge reads as a blade draw,
            // not a silent teleport; the landing itself keeps its pulse burst.
            this._fx('slash', seg.fam, x + sk.dx * sk.dist * e, y + sk.dy * sk.dist * e,
                R * cfg.impact * sizeMul, sk.hop, Math.atan2(sk.dy, sk.dx), e);
        } else {
            sk.t += dt;
            const k = Math.min(1, sk.t / sk.dur);
            e = 1 - k * k;
            if (k >= 1) {
                if (sk.hop >= sk.hops || this._hop(enemies, cfg, sk, x, y, R) < 0) {
                    sk.ph = 0;
                    return;
                }
                sk.hop++;
                e = 0;
            }
        }
        seg.orb = tAt(cfg.orb, seg.tier - 1);
        this._seat(chain, lo, hi, sk.dx * sk.dist * e, sk.dy * sk.dist * e);
    }

    /**
     * One hop's aim. `seek` is the *eyes* and `R * 2` is the *legs*: §5.7-A-4 clamps how far a pet may
     * leave its seat, not how far it may look, and conflating them put the beetle's search radius inside
     * its own kill radius (measured: 齐 5–16 while the living shell stands ~250 px out - §9.9-⑧). A target
     * beyond the clamp is still worth pouncing at, because the landing settles against whatever body is
     * actually under it and the rest of the escrow returns to the skill bank.
     */
    _hop (enemies, cfg, sk, x, y, R) {
        const j = this._nearest(enemies, x, y, R * (cfg.seek || 2));
        if (j < 0) return -1;
        const dx = enemies.x[j] - x;
        const dy = enemies.y[j] - y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        sk.dist = Math.min(R * 2, d);
        sk.dx = dx / d;
        sk.dy = dy / d;
        sk.t = 0;
        sk.dur = sk.dist / cfg.out;
        sk.ph = 1;
        return j;
    }

    /**
     * Landing: the hop's escrow re-enters the bank and `_pay` buys whatever is standing under the pet, so
     * an unoccupied landing refunds instead of burning. A pounce is a point, not a 领域, so the settlement
     * is capped at a few bodies; spreading the same money over them is what keeps 过量% down (§9.8-②).
     * `_pay` is also what counts 齐 / 干 here - `干` now means "landed on empty ground", which is the
     * honest version of the number this family used to report as 空 100%.
     */
    _settle (sk, enemies, x, y, r, dmgMul) {
        const money = sk.owe;
        sk.bank += money;
        const q = this._q;
        enemies.grid.query(x, y, r + MAX_BODY_R, q);
        const t = this._t;
        let m = 0;
        for (let k = 0; k < q.length && m < this._t.length; k++) {
            const j = q[k];
            if (enemies.dead[j]) continue;
            const dx = enemies.x[j] - x;
            const dy = enemies.y[j] - y;
            const rr = r + enemies.r[j];
            if (dx * dx + dy * dy > rr * rr) continue;
            t[m++] = j;
        }
        m = this._prioritize(enemies, t, m);
        m = Math.min(m, 4);
        this._pay(sk, enemies, t, m, dmgMul, money);
        if (sk.control > 0) for (let i = 0; i < m; i++) enemies.entangle(t[i], sk.control);
        return m;
    }

    /** Orbiting spores root on contact without spending damage or projectile budget. */
    _orbit (dt, chain, enemies, seg, cfg, tail, sk) {
        sk.t += dt;
        const tier = seg.tier - 1;
        const count = tAt(cfg.spores, tier);
        const inner = tAt(cfg.inner, tier);
        const outer = count - inner;
        const radius = CHAIN.headRadius(chain.bulkOf(seg)) * tAt(cfg.orbit, tier);
        const x = chain.nx[tail];
        const y = chain.ny[tail];
        this._fx('orbit', seg.fam, x, y, radius, outer, sk.t * cfg.spin, 1, inner);
        const q = this._q;
        enemies.grid.query(x, y, radius + MAX_BODY_R + 7, q);
        const contact = 7 + ENEMY.radius * 0.7;
        const contact2 = contact * contact;
        for (let k = 0; k < q.length; k++) {
            const j = q[k];
            if (enemies.dead[j] || enemies.boss[j]) continue;
            for (let s = 0; s < count; s++) {
                const isInner = s >= outer;
                const index = isInner ? s - outer : s;
                const ringCount = isInner ? inner : outer;
                const a = (isInner ? -1 : 1) * sk.t * cfg.spin + index * Math.PI * 2 / ringCount;
                const ring = radius * (isInner ? cfg.innerScale : 1);
                const dx = enemies.x[j] - (x + Math.cos(a) * ring);
                const dy = enemies.y[j] - (y + Math.sin(a) * ring);
                if (dx * dx + dy * dy <= contact2) {
                    if (enemies.root[j] <= dt) this._burst('hit', seg.fam, enemies.x[j], enemies.y[j]);
                    enemies.entangle(j, tAt(cfg.root, tier));
                    break;
                }
            }
        }
    }

    /** Flight and contact, sharing `graze` with 捕兽球 so a pet's shot cannot disagree with the ball. */
    _fly (dt, enemies) {
        const q = this._q;
        for (let i = 0; i < this.n; i++) {
            let sp = Math.sqrt(this.pvx[i] * this.pvx[i] + this.pvy[i] * this.pvy[i]) || 1;
            const cfg = SKILLS[this.pfam[i]];
            const projectileModule = projectileModuleForShot(this.pMode[i], this.pfam[i]);
            if (!(projectileModule?.steer?.(this, i, dt, sp)) && !projectileModule && cfg && cfg.homingTurn > 0) {
                const target = this._nearest(enemies, this.px[i], this.py[i], cfg.seek);
                if (target >= 0) {
                    const current = Math.atan2(this.pvy[i], this.pvx[i]);
                    const want = Math.atan2(enemies.y[target] - this.py[i], enemies.x[target] - this.px[i]);
                    const delta = Math.atan2(Math.sin(want - current), Math.cos(want - current));
                    const next = current + Math.max(-cfg.homingTurn * dt, Math.min(cfg.homingTurn * dt, delta));
                    this.pvx[i] = Math.cos(next) * sp;
                    this.pvy[i] = Math.sin(next) * sp;
                }
            }
            sp = Math.sqrt(this.pvx[i] * this.pvx[i] + this.pvy[i] * this.pvy[i]) || 1;
            const ux = this.pvx[i] / sp;
            const uy = this.pvy[i] / sp;
            const step = Math.min(this.pleft[i], sp * dt);
            enemies.grid.query(this.px[i] + ux * step * 0.5, this.py[i] + uy * step * 0.5,
                step * 0.5 + this.pr[i] + MAX_BODY_R, q);
            let hit = -1;
            let ht = Infinity;
            let priorityHit = -1;
            let priorityT = Infinity;
            for (let k = 0; k < q.length && (!projectileModule || projectileModule.canHit(this, i)); k++) {
                const j = q[k];
                if (enemies.dead[j] || j === enemies.aimedCaptureTarget
                    || (enemies.wildBossReady && enemies.wildBossReady[j])
                    || j === this.pavoid[i] || j === this.pavoid2[i]) continue;
                const t = graze(this.px[i], this.py[i], ux, uy, step,
                    enemies.x[j], enemies.y[j], this.pr[i] + enemies.r[j]);
                if (t < 0 || t >= ht) continue;
                ht = t;
                hit = j;
                if (priorityTarget(enemies, j) && t < priorityT) {
                    priorityT = t;
                    priorityHit = j;
                }
            }
            // If a wild body and the encounter target share a projectile's path, let the shot
            // reach its intended boss target; otherwise normal collision remains unchanged.
            if (priorityHit >= 0) hit = priorityHit;
            if (hit >= 0) {
                // Keep the actual contact point in the native-particle queue before this shot is
                // removed. Otherwise a close target can make a real mouse projectile disappear
                // before the renderer's next trail sample.
                this._sampleTandemausProjectile(i,
                    this.px[i] + ux * ht, this.py[i] + uy * ht);
                const dmg = this.pdmg[i];
                const megaId = this.pmega[i];
                const ix = enemies.x[hit];
                const iy = enemies.y[hit];
                this.m.landed += dmg;
                this.m.wasted += Math.max(0, dmg - enemies.hp[hit]);
                enemies.hurt(hit, dmg);
                // 弹幕溅射：弹体砸多大，炸多大——命中点半径内全体吃同额伤害。
                // 这就是「尺寸够大也可以打一片」：大根、堆叠体积、进阶阶位都在喂同一个半径。
                const splashR = this.pr[i] * (this.splashMul || 1);
                if (splashR > 4) {
                    enemies.grid.query(ix, iy, splashR + MAX_BODY_R, q);
                    for (let k = 0; k < q.length; k++) {
                        const j = q[k];
                        if (j === hit || j === enemies.aimedCaptureTarget || enemies.dead[j]
                            || j === this.pavoid[i] || j === this.pavoid2[i]) continue;
                        const dx = enemies.x[j] - ix;
                        const dy = enemies.y[j] - iy;
                        if (dx * dx + dy * dy > splashR * splashR) continue;
                        this.m.landed += dmg;
                        this.m.wasted += Math.max(0, dmg - enemies.hp[j]);
                        enemies.hurt(j, dmg);
                    }
                }
                this._burst(projectileModule?.hitEvent || (megaId ? 'mega-hit' : 'hit'), this.pfam[i],
                    ix, iy, Math.atan2(uy, ux), megaId);
                if (projectileModule) {
                    const result = projectileModule.onHit(this, i, hit);
                    if (result === 'dropped') {
                        this._drop(i);
                        i--;
                        continue;
                    }
                } else {
                const cfg = SKILLS[this.pfam[i]];
                if (cfg && cfg.bounces && this.pbounce[i] > 0) {
                    const ox = enemies.x[hit];
                    const oy = enemies.y[hit];
                    const range = cfg.bounceRange;
                    enemies.grid.query(ox, oy, range + MAX_BODY_R, q);
                    let next = -1;
                    let best = range * range;
                    for (let k = 0; k < q.length; k++) {
                        const j = q[k];
                        if (j === hit || j === enemies.aimedCaptureTarget || j === this.pavoid[i]
                            || j === this.pavoid2[i] || enemies.dead[j]
                            || (enemies.wildBossReady && enemies.wildBossReady[j])
                            || (enemies.legendaryReady && enemies.legendaryReady[j])) continue;
                        const dx = enemies.x[j] - ox;
                        const dy = enemies.y[j] - oy;
                        const d2 = dx * dx + dy * dy;
                        const priority = priorityTarget(enemies, j);
                        const currentPriority = next >= 0 && priorityTarget(enemies, next);
                        if (d2 >= best && !(priority && !currentPriority)) continue;
                        best = d2;
                        next = j;
                    }
                    if (next >= 0) {
                        const dx = enemies.x[next] - ox;
                        const dy = enemies.y[next] - oy;
                        const d = Math.sqrt(dx * dx + dy * dy) || 1;
                        this.px[i] = ox;
                        this.py[i] = oy;
                        this.pvx[i] = dx / d * sp;
                        this.pvy[i] = dy / d * sp;
                        this.pleft[i] = Math.min(this.pleft[i], Math.sqrt(best) + enemies.r[next]);
                        this.pavoid2[i] = this.pavoid[i];
                        this.pavoid[i] = hit;
                        this.pbounce[i]--;
                        continue;
                    }
                    this.m.lost += this.pdmg[i] * this.pbounce[i];
                }
                this._drop(i);
                i--;
                continue;
                }
            }
            this.px[i] += ux * step;
            this.py[i] += uy * step;
            this.pleft[i] -= step;
            this._sampleTandemausProjectile(i, this.px[i], this.py[i]);
            if (projectileModule) {
                const result = projectileModule.advance(this, i);
                if (result === 'dropped') i--;
                continue;
            }
            if (this.pleft[i] <= 0.001) {
                this.m.lost += this.pdmg[i];
                this._drop(i);
                i--;
            }
        }
    }
}
