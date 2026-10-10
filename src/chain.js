/*
 * 宠列 - the pet chain. Segments are pure data (§10.2), and every visible node is placed by
 * walking back an arc-length position history, which is what makes the cost O(段数) instead of
 * O(抓到多少只). History is sampled by distance travelled, never by frame count, so the tail
 * bunches up on an hard stop and straightens at speed - those two deformations are the feel.
 */

import { family, DPS, VIEW, FAMILIES } from './config.js';
import { segDps } from './combat.js';
import { evoCeil, stepOf, condText } from './species.js';
import { gigantamaxLocksEvolution } from './gigantamax.js';

export const isSlotExemptFamily = (famId) => typeof famId === 'string'
    && (famId.startsWith('legend-') || famId.startsWith('wildboss-'));

/**
 * 「这一族的图鉴线还有没有下一步」 - `evolveGate`'s `top`, lifted out because v0.9.8 gives it a second
 * reader: the 节圆 ceiling a link may grow to. Memoised on (fam, 阶) because `visualOf` runs once per link
 * per frame and `stepOf` parses a PBS edge string. Cached on the *pair*, not on the segment: `evolve` and
 * `evolve` and `evolveReward` mutate `tier` in place, so a flag written at those sites is wrong the day a third appears
 * - v0.9.7's `fed` is the same lesson.
 */
const TOP_AT = new Map();
export function lineTop (famId, tier) {
    const k = famId + '|' + tier;
    let top = TOP_AT.get(k);
    if (top === undefined) {
        top = tier >= evoCeil(famId) || !stepOf(famId, tier);
        TOP_AT.set(k, top);
    }
    return top;
}

/**
 * §7.1-4 + the species' own `Evolutions` edge: everything a link needs before its next 阶, in one
 * object, read by the field's E key, by the 熔炉's button [2], and by the headless bots. Three
 * consumers, one gate - the panel cannot advertise a price the sim did not pay.
 *
 * `have` is the player-side ledger the link itself does not hold: `{ cores }`. A link with no step
 * (a two-stage dex line at its top, or 3 阶 anywhere) is `top`, which is the 铸造 side's business.
 */
export function evolveGate (seg, have) {
    if (!seg) return { ok: false, top: false, short: '', miss: [], why: '', text: '' };
    if (gigantamaxLocksEvolution(seg)) {
        const why = '超极巨化期间不能进化';
        return { ok: false, top: false, blocked: true, st: null, q: 0, cores: 0, sec: 0,
            miss: [why], short: why, text: why, why };
    }
    // Read the 节圆 ceiling's own predicate rather than re-deriving it: the two disagreeing is how a link
    // can be told to be finished and still be priced for its next 阶.
    const st = lineTop(seg.fam, seg.tier) ? null : stepOf(seg.fam, seg.tier);
    if (!st) return { ok: false, top: true, st: null, q: 0, cores: 0, sec: 0, text: condText(null) };
    const required = have && have.evolveNeed === 2 ? Math.min(st.q, 2) : st.q;
    const gateStep = required === st.q ? st : { ...st, q: required };
    const cores = have && typeof have.cores === 'number' ? have.cores : 0;
    const age = seg.age || 0;
    const miss = [];
    const short = [];
    if (seg.count < required) {
        miss.push(`还差 ${required - seg.count} 只同族`);
        short.push(`${seg.count}/${required}只`);
    }
    if (st.cores > cores) {
        miss.push(`还差 ${st.cores - cores} 融核`);
        short.push(`差${st.cores - cores}核`);
    }
    if (st.sec > age) {
        miss.push(`还要带 ${Math.ceil(st.sec - age)}s`);
        short.push(`带${Math.ceil(st.sec - age)}s`);
    }
    return {
        ok: miss.length === 0, top: false, st: gateStep, q: required, cores: st.cores, sec: st.sec,
        miss, short: short.join(' '),
        text: `${condText(gateStep)}${required < st.q ? ' · 学习装置' : ''}`,
        why: miss.join(' · ') || `${condText(gateStep)}${required < st.q ? ' · 学习装置' : ''}`,
    };
}

export class ChainSystem {
    constructor (cc, cfg) {
        this.cc = cc;
        this.cfg = cfg;
        this.N = cfg.history;
        this.hx = new Float64Array(this.N);
        this.hy = new Float64Array(this.N);
        this.hd = new Float64Array(this.N);
        this.head = 0;
        this.hCount = this.N;
        this.traveled = 0;

        // v0.9.8's merged 满线 body does *not* raise this: a top link owns one seat however fat it gets, so
        // `nodesMax` is still the per-link ceiling on seats. The node budget is the one thing in here that
        // must never grow mid-run (§10.2-7's zero-allocation claim).
        // Shinies use parallel family links outside the ordinary slot budget: reserve one extra
        // link per Pokédex family so a full normal roster can still collect every shiny family.
        this.maxNodes = (cfg.hardCap + FAMILIES.length) * cfg.nodesMax;
        this.segIndex = new Int16Array(this.maxNodes);
        this.nodeOfSeg = new Int16Array(this.maxNodes);
        this.nx = new Float64Array(this.maxNodes);
        this.ny = new Float64Array(this.maxNodes);
        // §5.7-A-4: `bx/by` are the node's history-follow position and `ox/oy` is whatever a 主技 has
        // thrown it off that seat for this frame. Only `nx/ny` get consumed, so the picture and the
        // hitbox cannot drift apart - but `nspd` is measured off `bx`, which is what stops a pounce
        // from farming the +80% tail bonus that belongs to the player's own whip.
        this.bx = new Float64Array(this.maxNodes);
        this.by = new Float64Array(this.maxNodes);
        this.ox = new Float32Array(this.maxNodes);
        this.oy = new Float32Array(this.maxNodes);
        this.na = new Float64Array(this.maxNodes);
        this.warm = new Uint8Array(this.maxNodes);
        this.nspd = new Float32Array(this.maxNodes);
        this.nCount = 0;

        this.segments = [];
        this.lastAbsorbPromotions = [];
        this.spacing = cfg.spacingMin;
        // The link budget is per run: a level-up spends it, so it cannot live on the shared config.
        // The arrays stay sized at the ceiling, which is what keeps Node growth at zero (§10.2-7).
        this.cap = cfg.softCap;
        this.tail = { x: 0, y: 0, vx: 0, vy: 0, speed: 0 };
        this._s = { x: 0, y: 0, a: 0 };
    }

    /** §4 链位上限. Returns the new cap so a caller can tell a purchase from a ceiling. */
    growCap (n) {
        this.cap = Math.min(this.cfg.hardCap, this.cap + n);
        return this.cap;
    }

    /** `x, y` is the head. The ring is pre-filled with a straight tail so nodes have real history
     *  on frame 1 instead of collapsing onto the player. */
    reset (x, y) {
        this.segments.length = 0;
        this.cap = this.cfg.softCap;
        this.traveled = 0;
        this.hCount = this.N;
        this.head = this.N - 1;
        const step = this.cfg.spacingMin;
        for (let age = 0; age < this.N; age++) {
            const i = this._idx(age);
            this.hx[i] = x;
            this.hy[i] = y - age * step;
            this.hd[i] = -age * step;
        }
        this.warm.fill(0);
        this.ox.fill(0);
        this.oy.fill(0);
        this.tail.x = x;
        this.tail.y = y;
    }

    /**
     * §5.5-B: how many 节圆 a stack of `count` 只 stands on. The one place that number is computed.
     * `cap` is the *reason* this takes a second argument instead of reading the config directly: the merged
     * 满线 body (§9.19) is sized in this same currency, and the fold laws must keep counting in the ordinary
     * one or 排场 stops meaning anything.
     */
    nodesAt (count, cap = this.cfg.nodesMax) {
        return Math.min(cap, 1 + Math.floor(count / this.cfg.nodeEvery));
    }

    /**
     * The *same law at the gate's own density* (`CHAIN.autoEvery`), and deliberately a second function
     * rather than an argument on `nodesAt`: `nodesAt` is the picture and the damage radius, and the day
     * the gate borrows one of its callers the two stop being separable. Nothing here feeds a pixel.
     */
    autoNodesAt (count) {
        return Math.min(this.cfg.nodesMax, 1 + Math.floor(count / this.cfg.autoEvery));
    }

    /**
     * How many seats a link puts on the tail - the thing that walks behind the hero, and the divisor
     * `combat.sweep` splits the 段's dps across. A link at the top of its 图鉴线 owns **one**: 「同一类型的
     * 如果不能进化也要合在一起」, so its extra 只数 no longer buys more bodies walking in a row.
     */
    visualOf (seg) {
        if (this.hasCatchCompanions(seg)) return 1;
        return lineTop(seg.fam, seg.tier) ? 1 : this.nodesAt(seg.count);
    }

    /** Every caught member of the Tandemaus family is rendered as one fixed-size sprite plus companions. */
    hasCatchCompanions (seg) {
        return seg.fam === 'tandemaus';
    }

    companionCountOf (seg) {
        return this.hasCatchCompanions(seg) ? Math.max(0, seg.companions || 0) : 0;
    }

    /**
     * How big that body is, in 节圆当量 - 「改变的是体型」, and the reason the two functions above are not the
     * same number. Below the top of the line the body is one 节圆 per `nodeEvery` 只 exactly as it is seated;
     * at the top, the same 只数 keeps buying size instead of buying another copy, up to `topBulk`. Every
     * radius in the game reads this (`headRadius` → the 甩尾 hitbox and the aura the field draws, 主技's
     * 子蛋/光束/领域), which is why "体系变大、弹幕变大" is one expression here rather than four dials.
     */
    bulkOf (seg) {
        if (this.hasCatchCompanions(seg)) return 1;
        return this.nodesAt(seg.count, lineTop(seg.fam, seg.tier) ? this.cfg.topBulk : this.cfg.nodesMax);
    }

    /** Smooth sprite growth for a final form, while combat/space accounting keeps its discrete bulk steps. */
    visualBulkOf (seg) {
        if (this.hasCatchCompanions(seg)) return 1;
        if (!lineTop(seg.fam, seg.tier)) return this.bulkOf(seg);
        return Math.min(this.cfg.topBulk, 1 + Math.max(0, seg.count - 1) / this.cfg.nodeEvery);
    }

    /**
     * The one radius a link's body owns - what the aura draws and what the 甩尾 hits with, from the same call.
     * Below the top of the line this is `headRadius(bulk)` exactly as it was, because there the crowd really
     * does walk that many discs. A merged body is a **compensation**, not a redraw: 「合在一起」 must not buy
     * less ground than the crowd it replaced, and one disc standing in for k of them needs k times the area, so
     * its radius grows by √k with k the 节圆 the crowd would have walked. Un-compensated, the merge cost the
     * *manual* control arm 3 of its 8 survivors at 24 球/min (§9.19-⑤) - the picture was right and the sweep
     * covered a third of what it used to. Past `nodesMax` the factor stops growing while `bulk` keeps going,
     * so 「再抓到同族 = 体型变大」 stays true after coverage is even.
     *
     * `CHAIN.sweepArea` replaces that whole paragraph with its own law, because §9.22 measured the case the
     * √k was never written for: a **fold** also takes discs away (3 只 @1阶 → 1 只 @2阶 走 1 个节圆 instead of
     * 2), and √k only ever compensated the 合体. What the wave is priced against is `segDps`, which is
     * nominal - so an arm whose discs carry more nominal damage than they can land is being charged for a
     * strength it does not deliver, and every 进化 made that gap bigger (measured: 实付 8-21% of nominal, and
     * 怪血 climbing 5× faster than the tail that has to kill it). With the switch on, the disc's **area is the
     * 段's per-seat damage**, normalised so one 节圆 is still exactly one 节圆 at 1 阶: `r = headRadius(1,1)
     * × √(dps / seats / DPS[0])`. Then a fold can only ever buy ground (dps never falls), §9.19-④'s inequality
     * stops being a special case bolted onto 满线, and 「进化后的精灵更强力 · 弹幕也变大」 is the same expression as
     * 「怪血按你真实打得出的伤害定价」 instead of two numbers fighting each other.
     */
    radiusOf (seg, tier = 1) {
        if (this.hasCatchCompanions(seg)) return this.cfg.headRadius(1, tier);
        const b = this.bulkOf(seg);
        if (this.cfg.sweepArea) {
            const per = segDps(seg) / Math.max(1, this.visualOf(seg));
            return Math.min(this.cfg.headRadius(1, 1) * Math.pow(per / DPS[0], this.cfg.sweepArea), VIEW.fieldMaxR);
        }
        const crowd = lineTop(seg.fam, seg.tier) ? Math.sqrt(Math.min(b, this.cfg.nodesMax)) : 1;
        return this.cfg.headRadius(b, tier) * crowd;
    }

    get petTotal () {
        let n = 0;
        for (const s of this.segments) n += s.count;
        return n;
    }

    get normalSegmentCount () {
        let n = 0;
        for (const s of this.segments) if (!s.shiny && !isSlotExemptFamily(s.fam)) n++;
        return n;
    }

    get shinySegmentCount () {
        let n = 0;
        for (const s of this.segments) if (s.shiny) n++;
        return n;
    }

    add (famId, tier = 1, count = 1, shiny = false) {
        if (!shiny && !isSlotExemptFamily(famId) && this.normalSegmentCount >= this.cap) return false;
        if (shiny && this.segments.some((s) => s.fam === famId && s.shiny)) return false;
        this.segments.push({ fam: famId, tier, count, shiny: !!shiny, kind: family(famId).kind, affixes: [], age: 0,
            ...(famId === 'tandemaus' ? { companions: count } : {}) });
        return true;
    }

    _feedFamily (famId, tier, shiny) {
        let familyTarget = null;
        let finalTarget = null;
        for (const s of this.segments) {
            if (s.fam !== famId || !!s.shiny !== !!shiny) continue;
            if (s.fam === famId && s.tier === tier) {
                s.count++;
                if (this.hasCatchCompanions(s)) s.companions = (s.companions || 0) + 1;
                return lineTop(famId, s.tier) ? 'top-stack' : 'stack';
            }
            const locked = gigantamaxLocksEvolution(s);
            if ((lineTop(famId, s.tier) || locked)
                && (!finalTarget || s.tier > finalTarget.tier)) finalTarget = s;
            const canEvolve = !lineTop(famId, s.tier) && !locked;
            const targetCanEvolve = familyTarget && !lineTop(famId, familyTarget.tier)
                && !gigantamaxLocksEvolution(familyTarget);
            if (!familyTarget || (canEvolve && !targetCanEvolve)
                || (canEvolve === targetCanEvolve && s.tier > familyTarget.tier)) familyTarget = s;
        }
        if (finalTarget) {
            finalTarget.count++;
            if (this.hasCatchCompanions(finalTarget)) finalTarget.companions = (finalTarget.companions || 0) + 1;
            return 'top-stack';
        }
        // One rarity branch per family: catching a different evolution stage feeds the already-owned
        // family member instead of creating a second sprite/party slot beside it.
        if (familyTarget) {
            const fromTier = familyTarget.tier;
            familyTarget.count++;
            if (this.hasCatchCompanions(familyTarget)) familyTarget.companions = (familyTarget.companions || 0) + 1;
            if (tier > fromTier) {
                familyTarget.tier = tier;
                familyTarget.age = 0;
                this.lastAbsorbPromotions.push({ seg: familyTarget, fromTier, toTier: tier });
                return 'family-evolve';
            }
            return 'family-stack';
        }
        return null;
    }

    /** Capture grows each already-owned rarity branch once; new branches start with the caught copy. */
    absorb (famId, tier = 1, shiny = false) {
        this.lastAbsorbPromotions.length = 0;
        const counterpart = this.segments.some((s) => s.fam === famId && !!s.shiny !== !!shiny);
        let result = this._feedFamily(famId, tier, !!shiny);
        if (!result) {
            if (shiny) result = this.add(famId, tier, 1, true) ? 'new' : 'overflow';
            else if (isSlotExemptFamily(famId) || this.normalSegmentCount < this.cap) {
                result = this.add(famId, tier) ? 'new' : 'overflow';
            }
            else result = 'overflow';
        }
        const mirrored = counterpart ? this._feedFamily(famId, tier, !shiny) : null;
        // A full ordinary roster still keeps the catch when it advanced an owned shiny branch.
        if (result === 'overflow' && mirrored) return mirrored === 'family-evolve' ? 'family-evolve' : 'family-stack';
        return result;
    }

    remove (i) {
        if (i < 0 || i >= this.segments.length) return null;
        return this.segments.splice(i, 1)[0];
    }

    /**
     * §7.1-4 段内进化 - the same-species half of merging, and the payoff §6.1's aim verb never had.
     * `absorb` folds every duplicate catch into one stack, which is exactly why the doc's original
     * "3 段同族同阶" is unreachable: a same-family same-tier link can never exist
     * twice. So the copies live inside a link as `count`, and this is the rule that reads them. As of
     * v0.9 the *price* is the species' own: `evolveGate` asks `count → floor(count / q)` where `q` comes
     * off this line's `Evolutions` edge, plus 融核 for a 石头 step and seconds on the chain for a
     * 亲密度 one - which is the 图鉴价 world; `CHAIN.evolveFlat` (v0.9.9) pins every `q` to one number and
     * zeroes both extra currencies at their source in `species.priceOf`, so this gate reads 只数 only.
     * It costs no 链位 - the link stays where it is.
     */
    findEvolve (have) {
        return this.scanEvolve(have).ready;
    }

    /**
     * One pass for both halves of the field readout: the frontmost link E can pay *now*, and the frontmost
     * one it cannot yet pay. The second half is what a refusal is made of - `evolveGate().short` already
     * spells the gap in the 熔炉's words (只数 / 融核 / 携带秒), so the field and the panel cannot describe
     * the same price differently, which is the whole §9.13 claim about one gate having three consumers.
     */
    scanEvolve (have) {
        const segs = this.segments;
        let ready = -1;
        let near = null;
        for (let i = 0; i < segs.length; i++) {
            const g = evolveGate(segs[i], have);
            if (g.ok) { if (ready < 0) ready = i; continue; }
            if (!near && !g.top) near = { i, seg: segs[i], g };
        }
        return { ready, near };
    }

    /**
     * Historical tuning notes for the previous auto-evolution gates; the current rule is stated at the end.
     * §7.1-4 v0.9.2 自动进化 ("改成自动进化吧"): the fold the game performs *for* the player. Three
     * conditions on top of `evolveGate`, and all three are his own locked laws, not tuning:
     * - **不花融核** (`g.cores === 0`): 融核 is the 熔炉's money and 铸造 the only 4 阶 path, so an automatic
     *   fold must never be able to empty the purse that buys it. 石头 steps stay manual and priced ——
     *   in the 图鉴价 world. Since v0.9.9 (`CHAIN.evolveFlat`) no step costs 融核 at all, so this clause has
     *   no reachable case in the shipped game; it stays written because the price is one reversible constant
     *   away, and sim §9.20 runs its two rows with `evolveFlat = 0` so a ban nobody can trip is still tested.
     * - **只折长满 3 个「门节圆」的一摞** (`autoNodesAt(count) === nodesMax`): a fold spends 1 − 1/q of the
     *   pile, and the pile *is* the 排场 - §5.4's `count^0.65` tail, the length of the 甩尾, the HUD 宠物数
     *   all grow on it.
     * - **折完门节数不变** (same `autoNodesAt` before and after): the predicate is verbatim what v0.9.2
     *   shipped. What changed is only the currency it counts in, and that changes what it costs: at
     *   `autoEvery 4` a pile needs 24 只 (3合1) and comes out at 8, i.e. **3 屏上节圆 → 2**, whereas at
     *   `autoEvery 6` - every rung until v0.9.6, because the two densities were one constant - the same two
     *   lines read 36 → 12 and the crowd is pixel-identical across the fold. §9.17-① swept five rungs of
     *   that trade and 6 is not the top of the curve; 4 is.
     *   What did *not* move: the 融核 ban, the 石头 steps, and the top 阶.
     *
     * The second condition is not caution, it is the measured alternative dying: folding inside the
     * one-节圆 window (a pile's `q+1`-th to `2·density - 1`-th 只, i.e. "evolve whenever you can") keeps
     * every pile clipped forever, and 5 seed × 10 min of that policy **die at 162-189 s** - all five, at the
     * 3:00 BOSS - with 节圆 26-33 and a third of `merge`'s DPS. The dial is not monotone in the other
     * direction either: five rungs of it, same eight seeds, are §9.17-①, and the shape is 6 → 6/8 活满,
     * **4 → 8/8**, 3 → 2/5 (five seeds only), 2 → 7/8, 1 → 6/8. What separates 4 from 6 is that last column:
     * paired on the seeds where both arms reach 10 min their DPS is the same order (+43% vs +53% median
     * over 手动), but rung 6 loses `20260922 @188s` - a seed the 手动 control wins. `merge`/`evo` are
     * byte-identical in every row of that table (§9.17-②), so none of it is the control moving.
     * The older three-variant table (eager / loose / stall 20s / stall 60s) is §9.15-③, measured at
     * `nodeEvery 12`.
     *
     * So: a pile that has grown into its 排场 folds on the spot, and a pile he has *stopped feeding* folds
     * as soon as it can pay its own 图鉴价 — which is the same 3 只 that lights E, so the key becomes a way to
     * fold *now* rather than the only way to fold at all. One link per call, frontmost first.
     *
     * ④ exists because ①② were measured against a bot's economy. A bot catches ~1.6 只/s, so its piles clear
     * 24 只 inside the first two minutes and the 排场 road is a road it actually walks; a player aiming balls by
     * hand lands a few dozen 只 in a run, spread over twelve families, so his piles sit at 3-8 只 where ①②
     * require 16-32 - and 「还是捕捉3只按E才能进化啊」 is what that gap looks like from the seat. ④ is bounded by
     * the same law ② is: `coldFoldable` refuses any fold that would remove a 节圆 the screen is drawing, so ④
     * can only ever spend copies that were never visible. What it cannot do is grow the pile for him - a pile
     * still under its own 图鉴价 waits for catches, exactly as E does.
     * Current rule: return the first stack that passes `evolveGate` and does not spend cores, with no size or
     * inactivity delay.
     */
    findAuto (have) {
        const segs = this.segments;
        for (let i = 0; i < segs.length; i++) {
            const s = segs[i];
            const g = evolveGate(s, have);
            if (g.ok && g.cores === 0) return i;
        }
        return -1;
    }

    /**
     * What a fold leaves behind — one writer for the five readers that must not disagree (`findAuto`'s 排场
     * clause, `coldFoldable`, `autoThresholdAt`, `evolve` itself, the 熔炉's preview line, and sim's mirror of
     * that predicate). `priceOf`'s `q` is the **trigger** price, the answer to 「有没有 3 只」; this is the
     * separate question 「折一次花掉几只」, and `CHAIN.evolveKeeps` decides it:
     *   0 → `floor(count / q)`  the whole stack divides; a fold spends 1 − 1/q of the pile (§5.4's law)
     *   1 → `count − q + 1`     the pile pays `q − 1` and keeps one more than the trigger asked for
     *   2 → `count − 1`         one member transforms and no other 只 is eaten — what 原作 literally does
     *   3 → `count`             进化 changes 阶 and eats **nothing** — 「只需要 3 只就能进化」read as a law
     * `0` and `1` agree at `count = q` (a 3-只 pile on a 3合1 line leaves 1 只 either way), which is the whole
     * reason rung 1 was measured before it was argued over: at the player's hand speed the median fold *is*
     * `count = q` (④ fires at 3–5 只, 中位 3), so the two shapes are one number on his road and differ only on
     * the fat piles the 排场 gate sees. What a fatter remainder does change is the *count* of folds — `1` and
     * `2` can pay `q` again on the next frame, so a pile walks up the 阶 ladder step by step instead of cashing
     * itself in once — bounded by the line's depth (`lineTop`, then 合体), not by 只数.
     *
     * Rung 3 is where that road ends: spend 0 只 and the 阶 ladder becomes the *only* thing 进化 does, so the
     * pile keeps every 只 it ever caught and 排场 stops being money that 进化 can spend. Both bans then read as
     * tautologies (`coldFoldable` compares a number with itself, ①②'s 排场 clause clears at `autoEvery×(nodesMax−1)`
     * 只), and the whole cost moves to the other side of the ledger — `DPS[tier]` is applied to a `count` that
     * no longer shrinks, so §5.4's 怪血曲线 is the number that has to absorb it. It is also the only rung where
     * 「只要 3 只」 and 「进化满之后再抓到同族就变大」 are both literally true at once.
     */
    foldAfter (count, q) {
        const k = this.cfg.evolveKeeps;
        // `2` is the reading 原作 actually implements: 进化 transforms one member, so the pile keeps every 只
        // but the one that changed. It is the only shape that lets a flat 3-只 trigger keep its 排场, because
        // at `count = q` shapes `0` and `1` are already the same number (1 只 left) — which is where his piles
        // live (measured 折时只数 3–5, 中位 3).
        if (k === 2) return Math.max(1, count - 1);
        if (k === 3) return count;
        return k ? Math.max(1, count - q + 1) : Math.floor(count / q);
    }

    /**
     * ④'s own half of the 排场 law, counted in `nodesAt` (the screen's density) rather than `autoNodesAt`:
     * the thing being protected here is a drawn circle, so the display is the honest currency. A 3-只 pile on
     * a 3合1 line folds to 1 只 and both stand on 1 节圆, so nothing the player could count disappears; a
     * 11-只 pile on that line would go 2 节圆 → 1 under the divisor shape, and ④ will not take it (that fold
     * is ①②'s business, at 排场 prices). The predicate reads `foldAfter`, so the *shape* is the one place
     * `evolveKeeps` reaches in here: with the remainder law on, an 11-只 pile keeps 9 只 = 2 circles and ④
     * does take it — the circles are what it guards, never the 只数.
     */
    coldFoldable (seg, q) {
        return this.nodesAt(seg.count) === this.nodesAt(this.foldAfter(seg.count, q));
    }

    /**
     * The smallest pile the **①② road** can accept for a step of price `q`, i.e. where both are true at
     * once. (Since v0.9.7 it is not `findAuto`'s floor any more — ④ takes a pile at its 图鉴价, `q` 只, once
     * it has gone cold — so read this as "how big before auto folds it *without waiting*".) It is a *derived*
     * number (`autoEvery × (nodesMax − 1) × q`: 24 at q=3 today, 36 while the
     * gate still borrowed `nodeEvery`, 72 back when that was 12) and the HUD has to read it off the same law
     * rather than repeat it — §9.13-⑥'s "one writer, three readers" is what let v0.9.3 halve it by editing
     * one config line, and §9.17 is what had to split the line in two before it could be tuned at all.
     * The shape is part of the key, because it moves this number without touching a density: turning
     * `evolveKeeps` on lets the second clause clear sooner, so the same q=3 gate would read 10 只 instead of
     * the 24 above — the 排场 road opens onto far smaller piles the moment a fold stops eating them.
     */
    autoThresholdAt (q) {
        const c = this.cfg;
        const cache = (this.constructor.AUTO_T = this.constructor.AUTO_T || {});
        const key = `${c.autoEvery}|${c.nodesMax}|${q}|${c.evolveKeeps}`;
        if (cache[key]) return cache[key];
        for (let n = 1; n < 4000; n++) {
            if (this.autoNodesAt(n) === c.nodesMax && this.autoNodesAt(this.foldAfter(n, q)) === c.nodesMax) {
                cache[key] = n;
                return n;
            }
        }
        return Infinity;
    }

    /**
     * The pile the automatic fold is *actually working toward*: how many more 只 it still needs, how many
     * seconds it then has to stand unfed, and the 排场 price it would have to reach instead — or null when no
     * pile in the chain is on a road auto is allowed to walk (every step either costs 融核 or is the top 阶).
     * Feedback only, like §9.14's three lamps: he reads "它怎么还不自动" as "它没有", so the wait has to be a
     * number and not a mode tag.
     *
     * All three fields describe **one** pile, and `sec` is null when that pile's only road is the 排场 gate
     * (`autoCold` off prints null too, which is why the HUD tests the number and not the switch). v0.9.6
     * learned the first half by shipping a sentence about the wrong 摞: the threshold was read off
     * `scanEvolve().ready` — the 手动 pile — so the line said 32 只 one frame after a 24-只 pile folded on
     * screen (§9.17-⑤). Ranking by 只数 first is what makes ④ show up in the readout at all: a cold pile
     * needs no further catches, so it always outruns a pile still climbing toward its 排场.
     */
    autoShort (have) {
        const cold = this.cfg.autoCold;
        let best = null;
        for (const s of this.segments) {
            const g = evolveGate(s, have);
            if (g.cores > 0 || g.top || g.blocked) continue;
            const thr = this.autoThresholdAt(g.q);
            const road = this.coldFoldable(s, g.q);
            const cand = road
                ? { need: Math.max(0, g.q - s.count), sec: Number.isFinite(cold) ? Math.max(0, cold - (s.fed || 0)) : null, thr }
                : { need: Math.max(0, thr - s.count), sec: null, thr };
            if (best === null || cand.need < best.need
                || (cand.need === best.need && cand.sec !== null && (best.sec === null || cand.sec < best.sec))) best = cand;
        }
        return best;
    }

    /**
     * A 9-只 1 阶 pile becomes 3 只 2 阶, then 1 只 3 阶. `CHAIN.evolveKeeps` rewrites the remainder.
     */
    evolve (i, have) {
        const seg = this.segments[i];
        const g = evolveGate(seg, have);
        if (!g.ok) return null;
        seg.count = this.foldAfter(seg.count, g.q);
        seg.tier += 1;
        seg.age = 0;
        return { ...this.mergeStageAt(i), spent: g.cores };
    }

    /** A boss reward grants one real Pokédex step without charging its normal pile/currency cost. */
    evolveReward (i) {
        const seg = this.segments[i];
        if (!seg || lineTop(seg.fam, seg.tier) || gigantamaxLocksEvolution(seg)) return null;
        seg.tier += 1;
        seg.age = 0;
        return { ...this.mergeStageAt(i), spent: 0 };
    }

    /** Evolution can create a duplicate stage that absorb() could never create; fold it immediately. */
    mergeStageAt (i) {
        const seg = this.segments[i];
        if (!seg) return { seg: null, index: -1, merged: 0 };
        let index = i;
        let merged = 0;
        for (let j = this.segments.length - 1; j >= 0; j--) {
            if (j === index) continue;
            const other = this.segments[j];
            if (other.fam !== seg.fam || other.tier !== seg.tier
                || !!other.shiny !== !!seg.shiny) continue;
            seg.count += other.count;
            if (this.hasCatchCompanions(seg)) seg.companions = (seg.companions || 0) + (other.companions || 0);
            this.segments.splice(j, 1);
            if (j < index) index--;
            merged++;
        }
        return { seg, index, merged };
    }

    /** The node that draws a segment's head, so UI can point at a segment rather than a node. */
    headOf (segIndex) {
        for (let i = 0; i < this.nCount; i++) if (this.segIndex[i] === segIndex) return i;
        return -1;
    }

    _idx (age) {
        return (this.head - age + this.N * 2) % this.N;
    }

    _back (age) {
        return this.traveled - this.hd[this._idx(age)];
    }

    _push (x, y) {
        const h = this._idx(0);
        const dx = x - this.hx[h];
        const dy = y - this.hy[h];
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1) return;
        this.traveled += d;
        this.head = (this.head + 1) % this.N;
        const i = this.head;
        this.hx[i] = x;
        this.hy[i] = y;
        this.hd[i] = this.traveled;
    }

    /** Point `dist` pixels behind the head, plus the direction facing back along the tail. */
    sample (dist) {
        const s = this._s;
        const newest = this._idx(0);
        if (dist <= 0) {
            s.x = this.hx[newest];
            s.y = this.hy[newest];
            s.a = Math.PI / 2;
            return s;
        }
        const lastAge = this.hCount - 1;
        const maxBack = this._back(lastAge);
        const oldest = this._idx(lastAge);
        if (dist >= maxBack) {
            let dx = 0;
            let dy = -1;
            if (this.hCount > 1) {
                const prev = this._idx(lastAge - 1);
                dx = this.hx[oldest] - this.hx[prev];
                dy = this.hy[oldest] - this.hy[prev];
                const l = Math.sqrt(dx * dx + dy * dy);
                if (l > 1e-6) { dx /= l; dy /= l; } else { dx = 0; dy = -1; }
            }
            const over = dist - maxBack;
            s.x = this.hx[oldest] + dx * over;
            s.y = this.hy[oldest] + dy * over;
            s.a = Math.atan2(-dy, -dx);
            return s;
        }
        let lo = 0;
        let hi = lastAge;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (this._back(mid) >= dist) hi = mid; else lo = mid + 1;
        }
        const a = this._idx(lo);
        const b = this._idx(Math.max(0, lo - 1));
        const ba = this._back(lo);
        const bb = this._back(Math.max(0, lo - 1));
        const span = ba - bb;
        const t = span > 1e-6 ? (dist - bb) / span : 0;
        s.x = this.hx[b] + (this.hx[a] - this.hx[b]) * t;
        s.y = this.hy[b] + (this.hy[a] - this.hy[b]) * t;
        s.a = Math.atan2(this.hy[b] - this.hy[a], this.hx[b] - this.hx[a]);
        return s;
    }

    update (dt, headX, headY, speedFrac) {
        this._push(headX, headY);
        const spacing = this.cfg.spacingMin + (this.cfg.spacingMax - this.cfg.spacingMin) * speedFrac;
        this.spacing = spacing;

        let dist = this.cfg.headGap;
        let n = 0;
        const stiff = 1 - Math.exp(-this.cfg.stiffness * dt);
        for (let i = 0; i < this.segments.length; i++) {
            const s = this.segments[i];
            // 亲密度 is field time only: the panel stops the world, so a 皮丘 cannot become friendly by
            // being left on the 熔炉 screen. Reset by `evolve`/`evolveReward`, because the new body starts over.
            s.age += dt;
            // 「这一摞多久没长个」 (`fed`), derived from `count` rather than cleared by hand at the sites
            // that change it: five of them exist (`absorb`, `add`, `evolve`, `evolveReward`, and the 熔炉's two
            // buttons), and a clock that needs five manual resets is the shape of §9.15-⑥-1's NaN.
            if (s.count !== s.fedN) { s.fedN = s.count; s.fed = 0; } else s.fed += dt;
            const visual = this.visualOf(s);
            for (let j = 0; j < visual; j++) {
                dist += spacing;
                const p = this.sample(dist);
                if (!this.warm[n]) {
                    this.bx[n] = p.x;
                    this.by[n] = p.y;
                    this.nspd[n] = 0;
                    this.warm[n] = 1;
                } else {
                    const ox0 = this.bx[n];
                    const oy0 = this.by[n];
                    this.bx[n] = ox0 + (p.x - ox0) * stiff;
                    this.by[n] = oy0 + (p.y - oy0) * stiff;
                    const dx = this.bx[n] - ox0;
                    const dy = this.by[n] - oy0;
                    this.nspd[n] = dt > 0 ? Math.sqrt(dx * dx + dy * dy) / dt : 0;
                }
                this.nx[n] = this.bx[n] + this.ox[n];
                this.ny[n] = this.by[n] + this.oy[n];
                this.na[n] = p.a;
                this.segIndex[n] = i;
                this.nodeOfSeg[n] = j;
                n++;
            }
        }
        this.nCount = n;

        // Sweep bonus (§5.5-B) is driven by tail-tip linear speed, which exceeds the head's on a
        // turn because the outside of the curve travels a longer arc.
        const tx = n > 0 ? this.nx[n - 1] : headX;
        const ty = n > 0 ? this.ny[n - 1] : headY;
        const ddx = tx - this.tail.x;
        const ddy = ty - this.tail.y;
        const inv = dt > 0 ? 1 / dt : 0;
        this.tail.vx = ddx * inv;
        this.tail.vy = ddy * inv;
        this.tail.speed = Math.sqrt(ddx * ddx + ddy * ddy) * inv;
        this.tail.x = tx;
        this.tail.y = ty;
    }
}
