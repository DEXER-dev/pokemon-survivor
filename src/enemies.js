/*
 * The mob海, as a struct-of-arrays pool: no per-enemy object is ever allocated, and death is a
 * swap-remove. Neighbour lookups go through the spatial grid (§10.2-2), and steering is
 * seek + separation only - no pathfinding, because a survivors horde is supposed to be wrong.
 */
import { SpatialGrid } from './grid.js';
import { GRID_CELL, FAMILIES, WILD_FAMILY_COUNT, WILD_BOSSES, WILD_BOSS, BOSS } from './config.js';
import { rollShiny } from './shiny.js';

const TAU = Math.PI * 2;
const MAX_TRAINER_PARTY = Math.max(BOSS.party.length, ...BOSS.encounters.map((e) => e.party.length));
const FAMILY_INDEX = new Map(FAMILIES.map((family, index) => [family.id, index]));

export class EnemySystem {
    constructor (cfg, rng) {
        this.cfg = cfg;
        this.rng = rng;
        // `initialCapacity` is only a memory reservation. Large hordes grow geometrically in
        // `_ensureCapacity`; wild mobs, bosses and trainer parties all share the same expandable pool.
        const m = cfg.initialCapacity + Math.max(1, MAX_TRAINER_PARTY);
        this.x = new Float32Array(m);
        this.y = new Float32Array(m);
        this.vx = new Float32Array(m);
        this.vy = new Float32Array(m);
        this.hp = new Float32Array(m);
        this.maxhp = new Float32Array(m);
        this.r = new Float32Array(m);
        this.fam = new Int16Array(m);
        this.protectedFamilies = new Uint8Array(FAMILIES.length);
        this.tier = new Uint8Array(m);
        this.elite = new Uint8Array(m);
        this.shiny = new Uint8Array(m);
        this.boss = new Uint8Array(m);
        this.wildBoss = new Uint8Array(m);
        this.wildBossReady = new Uint8Array(m);
        this.wildBossLife = new Float32Array(m);
        this.legendary = new Uint8Array(m);
        this.legendaryReady = new Uint8Array(m);
        this.intro = new Uint8Array(m);
        this.trainer = new Uint8Array(m);
        this.trainerSlot = new Int8Array(m);
        this.arenaAngle = new Float32Array(m);
        this.arenaLayer = new Uint8Array(m);
        this.arenaAssigned = new Uint8Array(m);
        // Charge state machine: 0 走, 1 蓄力, 2 冲刺, 3 冷却. Only rows with `boss` set ever read these.
        this.bph = new Uint8Array(m);
        this.btm = new Float32Array(m);
        this.weaken = new Float32Array(m);
        this.root = new Float32Array(m);
        this.flash = new Float32Array(m);
        this.dead = new Uint8Array(m);
        this.n = 0;
        // The living wild body currently under the capture reticle is reserved from party damage.
        this.aimedCaptureTarget = -1;
        this.grid = new SpatialGrid(GRID_CELL);
        this._q = [];
        this.kills = 0;
        this.wildKills = 0;
        this.captured = 0;
        // Damage actually applied, kept in a Float64 accumulator: `hp` is a Float32Array, so a probe body
        // parked at 1e9 HP rounds every hit away and "start minus end" reports zero. §5.7's ground test
        // needs the sum of what left the chain, not what a rounded HP counter happened to keep.
        this.dealt = 0;
        // Set by whichever path marks a body dead, so the game can cull exactly once per step and
        // after the balls have finished with the array.
        this.dirty = 0;
        this.threatDps = 0;
        // 闪耀护符的闪光倍率，由 game.js 每帧从 Build 同步（默认 ×1）。
        this.shinyMul = 1;
        // Nothing about a death is buffered any more: it pays EXP and gets culled, because the only way
        // to turn an enemy into a pet is to hit it with a ball while it is still alive.
        this.kn = 0;
        // §5's wave table, now owned here instead of copied into the runtime and the sim separately -
        // a BOSS the headless run never meets is a BOSS nobody balanced.
        this.spawnAcc = 0;
        this.lastElite = 0;
        this.bossI = 0;
        this.bossN = 0;
        this.bossDown = 0;
        this.bossLegendaryDown = 0;
        this.bossX = 0;
        this.bossY = 0;
        this.bossDownFam = 0;
        this.trainerActive = false;
        this.trainerIntro = 0;
        this.onShinySpawn = null;
        // 每次野生击杀的回调（famIdx, trainer, boss）：王者之证的「击败同种 10 送 1」在此记账。
        this.onKill = null;
        this.arenaX = 0;
        this.arenaY = 0;
        this.arenaR = 0;
        this.trainerWatchCount = BOSS.watchCount;
        this.outbreakCd = this._nextOutbreakDelay();
        this.outbreakFamIdx = -1;
        this.outbreakTier = 1;
        this.outbreakCount = 0;
        this.outbreakX = 0;
        this.outbreakY = 0;
        this.outbreaks = 0;
        this.wildBossCd = WILD_BOSS.firstDelayMin
            + this.rng.next() * (WILD_BOSS.firstDelayMax - WILD_BOSS.firstDelayMin);
        this.wildBossSpawns = 0;
        this.lastWildBossFam = -1;
    }

    _nextOutbreakDelay () {
        return 34 + this.rng.next() * 20;
    }

    clear () {
        this.n = 0;
        this.aimedCaptureTarget = -1;
        this.kn = 0;
        this.kills = 0;
        this.wildKills = 0;
        this.captured = 0;
        this.dealt = 0;
        this.dirty = 0;
        this.spawnAcc = 0;
        this.lastElite = 0;
        this.bossI = 0;
        this.bossN = 0;
        this.bossDown = 0;
        this.bossLegendaryDown = 0;
        this.trainerActive = false;
        this.trainerIntro = 0;
        this.trainerWatchCount = BOSS.watchCount;
        this.outbreakCd = this._nextOutbreakDelay();
        this.outbreakFamIdx = -1;
        this.outbreakTier = 1;
        this.outbreakCount = 0;
        this.outbreakX = 0;
        this.outbreakY = 0;
        this.outbreaks = 0;
        this.wildBossCd = WILD_BOSS.firstDelayMin
            + this.rng.next() * (WILD_BOSS.firstDelayMax - WILD_BOSS.firstDelayMin);
        this.wildBossSpawns = 0;
        this.lastWildBossFam = -1;
        this.protectedFamilies.fill(0);
    }

    setProtectedFamilies (segments, enabled) {
        this.protectedFamilies.fill(0);
        if (!enabled || !segments) return;
        for (const segment of segments) {
            const index = FAMILY_INDEX.get(segment.fam);
            if (index !== undefined) this.protectedFamilies[index] = 1;
        }
    }

    /**
     * A spawn-time snapshot, not a live recompute: a horde that grew tougher while you were already
     * inside it would read as random damage spikes. `threatDps` is the chain's own output, so the
     * pressure is set by what the player actually built rather than by a stopwatch.
     */
    threat (minute) {
        const c = this.cfg;
        // 部分自缩放：潮汐 hp 跟着 (玩家DPS/预算)^hpScaleExp 走。线性自缩放会让任何火力升级
        // 在同一帧被更厚的血量吃掉（玩家「火力低」的根因）；3/4 次幂让升级拿到真实的清场收益，
        // 同时压力仍随构筑增长，不至于踏平整个浪潮表。
        const share = Math.pow(Math.max(0, this.threatDps) / c.threatBudget, c.hpScaleExp) * c.clearSec;
        return Math.max(c.hpBase, share) * Math.pow(c.hpGrowth, minute);
    }

    _ensureCapacity (required) {
        if (required <= this.x.length) return;
        let capacity = Math.max(16, this.x.length);
        while (capacity < required) capacity *= 2;
        const fields = [
            'x', 'y', 'vx', 'vy', 'hp', 'maxhp', 'r', 'fam', 'tier', 'elite', 'shiny', 'boss',
            'wildBoss', 'wildBossReady', 'wildBossLife',
            'legendary', 'legendaryReady', 'intro', 'trainer', 'trainerSlot', 'bph', 'btm', 'weaken',
            'root', 'flash', 'dead',
            'arenaAngle', 'arenaLayer', 'arenaAssigned',
        ];
        for (const field of fields) {
            const previous = this[field];
            const expanded = new previous.constructor(capacity);
            expanded.set(previous);
            this[field] = expanded;
        }
    }

    nextBossKillCount () {
        const milestones = BOSS.killThresholds;
        if (this.bossI < milestones.length) return milestones[this.bossI];
        const repeats = this.bossI - milestones.length + 1;
        return milestones[milestones.length - 1]
            + repeats * BOSS.repeatKillStep
            + (repeats * (repeats - 1) / 2) * BOSS.repeatKillGrowth;
    }

    spawn (x, y, famIdx, tier, elite, minute, boss = 0, trainerSlot = -1,
        trainerPartySize = BOSS.party.length, trainerHpMul = BOSS.hpMul, legendary = false, shiny = null,
        wildBoss = false) {
        const trainer = trainerSlot >= 0;
        this._ensureCapacity(this.n + 1);
        const i = this.n++;
        this.x[i] = x;
        this.y[i] = y;
        this.vx[i] = 0;
        this.vy[i] = 0;
        const hp = this.threat(minute) * (1 + (tier - 1) * 1.6);
        this.maxhp[i] = trainer ? this.threat(minute) * trainerHpMul / trainerPartySize
            : wildBoss ? this.threat(minute) * WILD_BOSS.hpMul
                : boss ? hp * BOSS.hpMul : elite ? hp * this.cfg.eliteHpMul : hp;
        this.hp[i] = this.maxhp[i];
        this.r[i] = trainer ? this.cfg.radius * 1.45 : wildBoss ? this.cfg.radius * WILD_BOSS.radiusMul
            : boss ? this.cfg.radius * BOSS.radiusMul
                : elite ? this.cfg.radius * 1.9 : this.cfg.radius * (0.9 + tier * 0.12);
        this.fam[i] = famIdx;
        this.tier[i] = tier;
        this.elite[i] = elite ? 1 : 0;
        this.shiny[i] = shiny === null
            ? (!trainer && !boss && !legendary && rollShiny(this.rng, this.shinyMul) ? 1 : 0)
            : (shiny ? 1 : 0);
        if (this.shiny[i] && this.onShinySpawn) {
            this.onShinySpawn(i, famIdx, tier, x, y);
        }
        this.boss[i] = boss || wildBoss ? 1 : 0;
        this.wildBoss[i] = wildBoss ? 1 : 0;
        this.wildBossReady[i] = 0;
        this.wildBossLife[i] = wildBoss ? WILD_BOSS.lifetime : 0;
        this.legendary[i] = legendary ? 1 : 0;
        this.legendaryReady[i] = 0;
        this.intro[i] = 0;
        this.trainer[i] = trainer ? 1 : 0;
        this.trainerSlot[i] = trainer ? trainerSlot : -1;
        this.arenaAngle[i] = 0;
        this.arenaLayer[i] = 0;
        this.arenaAssigned[i] = 0;
        // A trainer boss walks in before using the shared charge state. Roaming legendaries use the
        // species-specific telegraph system and keep this state idle. `elite` stays 0: 虚弱 is the capture gate.
        this.bph[i] = 0;
        this.btm[i] = (boss || wildBoss) ? BOSS.rest : 0;
        if (boss || wildBoss) this.bossN++;
        this.weaken[i] = 0;
        this.root[i] = 0;
        this.flash[i] = 0;
        this.dead[i] = 0;
        return i;
    }

    /** One audience ring's visual capacity; excess wilds remain in the distant backdrop. */
    trainerAudienceRingCapacity (layer) {
        const bodyR = this.cfg.radius * 1.14;
        const spacing = Math.max(BOSS.watchSpacing, bodyR * 3);
        const target = this.arenaR + bodyR * (layer === 0 ? 3.6 : 6.8);
        return Math.max(1, Math.floor(TAU * target / spacing));
    }

    trainerAudienceCapacity () {
        return this.trainerAudienceRingCapacity(0) + this.trainerAudienceRingCapacity(1);
    }

    trainerAudienceInnerSlots (visible) {
        return Math.min(this.trainerAudienceRingCapacity(0), Math.ceil(visible / 2));
    }

    /** Assign stable audience slots once when the trainer arena opens, minimizing crossed paths. */
    prepareTrainerGather () {
        const rows = [];
        for (let i = 0; i < this.n; i++) {
            if (this.dead[i] || this.trainer[i]) continue;
            const angle = Math.atan2(this.y[i] - this.arenaY, this.x[i] - this.arenaX);
            rows.push({ i, angle });
        }
        rows.sort((a, b) => a.angle - b.angle);
        const visible = Math.min(this.trainerWatchCount, this.trainerAudienceCapacity(), rows.length);
        const perRing = this.trainerAudienceInnerSlots(visible);
        let rank = 0;
        for (let layer = 0; layer < 2 && rank < visible; layer++) {
            const count = Math.min(perRing, visible - rank);
            let bestOffset = rows[rank].angle;
            let bestCost = Infinity;
            // At most the rate-scaled watch count: choose the rotation that asks this crowd to
            // travel the least around the circle, rather than sending opposite sides through it.
            for (let candidate = 0; candidate < count; candidate++) {
                const offset = rows[rank + candidate].angle - Math.PI * 2 * candidate / count;
                let cost = 0;
                for (let slot = 0; slot < count; slot++) {
                    const delta = Math.atan2(Math.sin(rows[rank + slot].angle
                        - (offset + Math.PI * 2 * slot / count)),
                    Math.cos(rows[rank + slot].angle - (offset + Math.PI * 2 * slot / count)));
                    cost += Math.abs(delta);
                }
                if (cost < bestCost) {
                    bestCost = cost;
                    bestOffset = offset;
                }
            }
            for (let slot = 0; slot < count; slot++) {
                const row = rows[rank + slot];
                this.arenaAngle[row.i] = bestOffset + Math.PI * 2 * slot / count;
                this.arenaLayer[row.i] = layer;
                this.arenaAssigned[row.i] = 1;
            }
            rank += count;
        }
        // The distant horde is a soft backdrop rather than part of the visible two-ring formation.
        for (; rank < rows.length; rank++) {
            const row = rows[rank];
            this.arenaAngle[row.i] = row.angle;
            this.arenaLayer[row.i] = 2;
            this.arenaAssigned[row.i] = 1;
        }
    }

    /**
     * §5's 波次表 for everything that walks in on a schedule. This used to exist twice - `Game.spawnWave`
     * and a copy in `sim-test.mjs` - which is how the sim ended up measuring a wave table the shipped
     * build had quietly stopped matching (the copy had no pre-3:00 tier-2 mobs at all). It returns what
     * the caller should announce, so the announcement cannot drift from the spawn either.
     *
     * `fam` is the sim's `FORCED` hook: a probe that wants one family's 主技 to be the only thing it can
     * catch passes a roller, and everything else gets the uniform draw the runtime uses.
     */
    direct (dt, minute, pets, px, py, ring, fam, deferBoss = false, disableElite = false,
        enableWildBoss = false, spawnRateMul = 1) {
        let ev = '';
        const t = minute * 60;
        // Keep the normal world cadence during trainer battles too. `update()` diverts wild mobs into
        // the non-hostile perimeter formation, so the arena stays clear while the ring replenishes.
        const spawnRate = this.cfg.spawnRate(minute, pets) * Math.max(0, spawnRateMul);
        this.trainerWatchCount = Math.min(BOSS.watchMaxCount,
            Math.max(BOSS.watchCount, Math.ceil(BOSS.watchCount + spawnRate * BOSS.watchRateSeconds)));
        const populationCap = Number.isFinite(this.cfg.populationCap)
            ? Math.max(1, Math.floor(this.cfg.populationCap)) : Infinity;
        if (this.n < populationCap) this.spawnAcc += spawnRate * dt;
        else this.spawnAcc = 0;
        while (this.spawnAcc >= 1 && this.n < populationCap) {
            this.spawnAcc -= 1;
            const a = this.rng.next() * TAU;
            const tier = this.rng.chance(minute > 3 ? 0.18 : 0.05) ? 2 : 1;
            this.spawn(px + Math.cos(a) * ring, py + Math.sin(a) * ring,
                fam ? fam() : this.rng.int(0, WILD_FAMILY_COUNT - 1), tier, false, minute);
        }
        // Do not bank missed spawns at the cap; clearing one body should reopen one slot, not release
        // an entire minute's backlog into the field on the next frame.
        if (this.n >= populationCap) this.spawnAcc = 0;
        if (!disableElite && !this.trainerActive && t > this.cfg.eliteAfter && t - this.lastElite > this.cfg.eliteEvery) {
            this.lastElite = t;
            const a = this.rng.next() * TAU;
            this.spawn(px + Math.cos(a) * ring, py + Math.sin(a) * ring,
                fam ? fam() : this.rng.int(0, WILD_FAMILY_COUNT - 1), 2, true, minute);
            ev = 'elite';
        }
        // The live game triggers themed trainers from defeated-wild milestones, never from elapsed time.
        // Headless legacy tests keep the single-body time schedule so their historical baseline stays comparable.
        const bossDue = deferBoss
            ? this.wildKills >= this.nextBossKillCount()
            : this.bossI < BOSS.at.length && t >= BOSS.at[this.bossI];
        if (!this.trainerActive && bossDue && this.bossN === 0) {
            const a = this.rng.next() * TAU;
            if (deferBoss) {
                this.bossI++;
                ev = 'boss';
            } else if (this.spawn(px + Math.cos(a) * ring, py + Math.sin(a) * ring, 0, 1, false, minute, 1) >= 0) {
                this.bossI++;
                ev = 'boss';
            }
        }
        // Wild mass-outbreaks are distinct bursts, not a faster base spawn rate: a seeded interval
        // gathers 10-14 identical wild Pokémon into one nearby patch so the cluster reads as an event.
        if (ev !== 'boss' && !this.trainerActive && this.bossN === 0 && !bossDue) {
            this.outbreakCd -= dt;
            if (this.outbreakCd <= 0) {
                if (this.n >= populationCap) {
                    this.outbreakCd = 1;
                } else {
                    const famIdx = fam ? fam() : this.rng.int(0, WILD_FAMILY_COUNT - 1);
                    const tier = this.rng.chance(minute > 3 ? 0.18 : 0.05) ? 2 : 1;
                    const count = Math.min(this.rng.int(10, 14), populationCap - this.n);
                    const direction = this.rng.next() * TAU;
                    const centerRadius = Math.min(ring * 0.72, Math.max(this.cfg.radius * 14, ring * 0.58));
                    const cx = px + Math.cos(direction) * centerRadius;
                    const cy = py + Math.sin(direction) * centerRadius;
                    const clusterRadius = this.cfg.radius * 7.2;
                    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
                    this.outbreakFamIdx = famIdx;
                    this.outbreakTier = tier;
                    this.outbreakCount = count;
                    this.outbreakX = cx;
                    this.outbreakY = cy;
                    this.outbreaks++;
                    for (let i = 0; i < count; i++) {
                        const a = direction + i * goldenAngle + this.rng.range(-0.12, 0.12);
                        const radius = clusterRadius * Math.sqrt((i + 0.5) / count);
                        this.spawn(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius,
                            famIdx, tier, false, minute);
                    }
                    this.outbreakCd = this._nextOutbreakDelay();
                    ev = 'outbreak';
                }
            }
        }
        if (enableWildBoss && ev !== 'boss' && ev !== 'outbreak' && !this.trainerActive
            && this.bossN === 0 && t >= WILD_BOSS.firstAfter) {
            this.wildBossCd -= dt;
            if (this.wildBossCd <= 0) {
                if (this.rng.next() < WILD_BOSS.spawnChance) {
                    const angle = this.rng.next() * TAU;
                    const family = WILD_BOSSES[this.rng.int(0, WILD_BOSSES.length - 1)];
                    const famIdx = FAMILIES.indexOf(family);
                    this.spawn(px + Math.cos(angle) * ring, py + Math.sin(angle) * ring,
                        famIdx, 1, false, minute, 0, -1, BOSS.party.length, BOSS.hpMul,
                        false, false, true);
                    this.lastWildBossFam = famIdx;
                    this.wildBossSpawns++;
                    this.wildBossCd = WILD_BOSS.delayMin
                        + this.rng.next() * (WILD_BOSS.delayMax - WILD_BOSS.delayMin);
                    ev = 'wildboss';
                } else {
                    // A failed appearance roll gets a shorter, newly seeded retry window.
                    this.wildBossCd = WILD_BOSS.firstDelayMin
                        + this.rng.next() * (WILD_BOSS.firstDelayMax - WILD_BOSS.firstDelayMin);
                }
            }
        }
        return ev;
    }

    /** Compaction only happens here, once per step, after the sweep, the balls and the EXP are done. */
    cull () {
        let n = 0;
        for (let i = 0; i < this.n; i++) {
            if (this.dead[i]) { this.dead[i] = 0; continue; }
            if (n !== i) {
                this.x[n] = this.x[i];
                this.y[n] = this.y[i];
                this.vx[n] = this.vx[i];
                this.vy[n] = this.vy[i];
                this.hp[n] = this.hp[i];
                this.maxhp[n] = this.maxhp[i];
                this.r[n] = this.r[i];
                this.fam[n] = this.fam[i];
                this.tier[n] = this.tier[i];
                this.elite[n] = this.elite[i];
                this.shiny[n] = this.shiny[i];
                this.boss[n] = this.boss[i];
                this.wildBoss[n] = this.wildBoss[i];
                this.wildBossReady[n] = this.wildBossReady[i];
                this.wildBossLife[n] = this.wildBossLife[i];
                this.legendary[n] = this.legendary[i];
                this.legendaryReady[n] = this.legendaryReady[i];
                this.intro[n] = this.intro[i];
                this.trainer[n] = this.trainer[i];
                this.trainerSlot[n] = this.trainerSlot[i];
                this.arenaAngle[n] = this.arenaAngle[i];
                this.arenaLayer[n] = this.arenaLayer[i];
                this.arenaAssigned[n] = this.arenaAssigned[i];
                this.bph[n] = this.bph[i];
                this.btm[n] = this.btm[i];
                this.weaken[n] = this.weaken[i];
                this.root[n] = this.root[i];
                this.flash[n] = this.flash[i];
                this.dead[n] = 0;
            }
            n++;
        }
        this.n = n;
        this.dirty = 0;
        // A dead row may have moved during compaction, so the next simulation step must resolve aim again.
        this.aimedCaptureTarget = -1;
    }

    hurt (i, amount) {
        if (this.dead[i]) return false;
        if (this.intro[i]) return false;
        // A live capture lock lets the player line up a ball without the party finishing that target first.
        if (i === this.aimedCaptureTarget) return false;
        if (this.wildBossReady[i]) return false;
        if (this.legendaryReady[i]) return false;
        // Wild-party attacks can never erase a rare encounter before it can be caught.
        if (this.shiny[i]) return false;
        // Trainer's team is briefly untargetable while the formation intro gives the player time to read it.
        if (this.trainerActive && this.trainerIntro > 0 && this.trainer[i]) return false;
        const familyProtected = !this.boss[i] && !this.trainer[i] && this.protectedFamilies[this.fam[i]];
        const applied = familyProtected ? Math.min(amount, Math.max(0, this.hp[i] - 1)) : amount;
        if (applied <= 0) return false;
        this.dealt += applied;
        this.hp[i] -= applied;
        this.flash[i] = 0.08;
        const e = this.elite[i] === 1;
        if (!familyProtected && e && this.weaken[i] <= 0 && this.hp[i] <= this.maxhp[i] * this.cfg.weakenAt) {
            // §6.3-1 虚弱: stop chasing and stop dealing damage, so the player gets an approach
            // window. The overkill past the 30% line is absorbed, which is what makes §6.4-2's
            // "虚弱窗口一定出现" true even when one sweep tick could have finished it.
            this.weaken[i] = this.cfg.weakenSec;
            this.hp[i] = this.maxhp[i] * this.cfg.weakenAt;
        }
        if (this.hp[i] > 0) return false;
        if (this.wildBoss[i]) {
            this.wildBossReady[i] = 1;
            this.hp[i] = Math.max(1, this.maxhp[i] * 0.08);
            this.vx[i] = this.vy[i] = 0;
            this.bph[i] = 0;
            this.wildBossLife[i] = WILD_BOSS.readyLifetime;
            return true;
        }
        if (this.legendary[i]) {
            this.legendaryReady[i] = 1;
            this.hp[i] = Math.max(1, this.maxhp[i] * 0.08);
            this.vx[i] = this.vy[i] = 0;
            this.bph[i] = 0;
            this.bossDown++;
            this.bossX = this.x[i];
            this.bossY = this.y[i];
            this.bossDownFam = this.fam[i];
            this.bossLegendaryDown = 1;
            return true;
        }
        this.dead[i] = 1;
        this.dirty = 1;
        this.kills++;
        if (!this.trainer[i] && !this.boss[i]) this.wildKills++;
        this.kn++;
        if (this.onKill) this.onKill(this.fam[i], !!this.trainer[i], !!this.boss[i]);
        if (this.boss[i]) {
            // The drop is paid by the caller, but the *where* has to be recorded here: after this frame
            // the row is gone, and the reward banner needs the ground the boss fell on.
            this.boss[i] = 0;
            this.bossN--;
            this.bossDown++;
            this.bossX = this.x[i];
            this.bossY = this.y[i];
            this.bossDownFam = this.fam[i];
        }
        return true;
    }

    entangle (i, seconds) {
        if (i < 0 || i >= this.n || this.dead[i] || this.boss[i]) return;
        this.root[i] = Math.max(this.root[i], seconds);
    }

    /**
     * A ball took this one alive. No corpse and no sweep credit, but it still pays the same 1 EXP a
     * death would: a ball removes a body the tail would otherwise have had to kill, so if a catch paid
     * nothing, catching would be a *tax* on the only healing in the game (升级回血). The 10-min regression
     * proved that tax kills runs at 2:19 - which is §13's "宠物永不失去" pillar inverted, so the verb gets
     * to stay expensive in aim and cooldown, and cheap in EXP like every other way to empty the field.
     */
    capture (i) {
        if (this.dead[i]) return false;
        if (this.boss[i]) this.bossN = Math.max(0, this.bossN - 1);
        this.dead[i] = 1;
        this.dirty = 1;
        this.captured++;
        this.kn++;
        return true;
    }

    /** Keep distant stragglers in the play area so a fast player cannot outrun the growing horde. */
    _recycle (i, px, py, ring) {
        const a = this.rng.next() * TAU;
        this.x[i] = px + Math.cos(a) * ring;
        this.y[i] = py + Math.sin(a) * ring;
        this.vx[i] = 0;
        this.vy[i] = 0;
    }

    /**
     * §5's BOSS 冲刺, as 走 → 蓄力 → 冲 → 冷却. The direction locks when the dash *commits*, not when the
     * wind-up starts, so the telegraph is a promise the player can answer by stepping sideways - and a
     * body crossing the ring at 2.6x the hero's top speed is the first thing in this game that punishes
     * standing still to aim, which is where §5.6-结论2 said the pressure had to come from.
     *
     * No separation term and no leash recycle while charged up: a boss stuck behind its own minions, or
     * teleported to the spawn ring mid-dash, reads as a bug and not as difficulty.
     */
    _boss (i, dt, px, py) {
        const wildBoss = this.wildBoss[i] === 1;
        const dx = px - this.x[i];
        const dy = py - this.y[i];
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (wildBoss) {
            // Roaming legendaries keep a steady, readable approach; their species-specific area attacks
            // carry the dodge pressure instead of stacking a generic dash on top of each signature.
            const speed = this.cfg.speed * BOSS.walk * WILD_BOSS.walkMul;
            this.vx[i] = (dx / d) * speed;
            this.vy[i] = (dy / d) * speed;
            this.x[i] += this.vx[i] * dt;
            this.y[i] += this.vy[i] * dt;
            this.bph[i] = 0;
            this.btm[i] = 0;
            return;
        }
        this.btm[i] -= dt;
        const ph = this.bph[i];
        if (ph === 1) {
            // Held still, but the aim keeps tracking: what the renderer draws from vx/vy is the corridor
            // the player is being told to leave, so it has to point at them right now.
            this.vx[i] = dx / d;
            this.vy[i] = dy / d;
            if (this.btm[i] <= 0) {
                this.bph[i] = 2;
                this.btm[i] = BOSS.dashSec;
                this.vx[i] *= BOSS.dash;
                this.vy[i] *= BOSS.dash;
            }
            return;
        }
        if (ph === 2) {
            this.x[i] += this.vx[i] * dt;
            this.y[i] += this.vy[i] * dt;
            if (this.btm[i] <= 0) {
                this.bph[i] = 3;
                this.btm[i] = wildBoss ? WILD_BOSS.rest : BOSS.rest;
            }
            return;
        }
        if (ph === 3 && this.btm[i] <= 0) this.bph[i] = 0;
        const sp = this.cfg.speed * BOSS.walk * (wildBoss ? WILD_BOSS.walkMul : 1);
        this.vx[i] = (dx / d) * sp;
        this.vy[i] = (dy / d) * sp;
        this.x[i] += this.vx[i] * dt;
        this.y[i] += this.vy[i] * dt;
        if (this.btm[i] <= 0) {
            this.btm[i] = 0;
            if (d < BOSS.range) {
                this.bph[i] = 1;
                this.btm[i] = BOSS.windup;
            }
        }
    }

    update (dt, px, py, ring) {
        const g = this.grid;
        g.clear();
        if (this.trainerActive) {
            let wildCount = 0;
            let innerAudience = 0;
            let outerAudience = 0;
            for (let i = 0; i < this.n; i++) {
                if (this.dead[i] || this.trainer[i]) continue;
                wildCount++;
                if (!this.arenaAssigned[i]) continue;
                if (this.arenaLayer[i] === 0) innerAudience++;
                else if (this.arenaLayer[i] === 1) outerAudience++;
            }
            const visible = Math.min(this.trainerWatchCount, this.trainerAudienceCapacity(), wildCount);
            const innerSlots = this.trainerAudienceInnerSlots(visible);
            const outerSlots = visible - innerSlots;
            const hiddenRadius = this.arenaR + Math.max(ring * 1.25, 700);
            for (let i = 0; i < this.n; i++) {
                if (this.dead[i]) continue;
                if (this.flash[i] > 0) this.flash[i] = Math.max(0, this.flash[i] - dt);
                if (this.root[i] > 0) this.root[i] = Math.max(0, this.root[i] - dt);
                if (this.trainer[i]) {
                    g.insert(i, this.x[i], this.y[i]);
                    continue;
                }
                if (!this.arenaAssigned[i]) {
                    this.arenaAngle[i] = Math.atan2(this.y[i] - this.arenaY, this.x[i] - this.arenaX);
                    if (innerAudience < innerSlots) {
                        this.arenaLayer[i] = 0;
                        innerAudience++;
                    } else if (outerAudience < outerSlots) {
                        this.arenaLayer[i] = 1;
                        outerAudience++;
                    } else this.arenaLayer[i] = 2;
                    this.arenaAssigned[i] = 1;
                } else if (this.arenaLayer[i] === 2
                    && (innerAudience < innerSlots || outerAudience < outerSlots)) {
                    // As the refresh rate rises, promote the nearer share of the accumulated horde
                    // from the far backdrop into the two visible audience rings.
                    if (innerAudience < innerSlots) {
                        this.arenaLayer[i] = 0;
                        innerAudience++;
                    } else if (outerAudience < outerSlots) {
                        this.arenaLayer[i] = 1;
                        outerAudience++;
                    }
                }
                const layer = this.arenaLayer[i];
                const targetRadius = layer === 0
                    ? this.arenaR + this.r[i] * 3.6
                    : layer === 1 ? this.arenaR + this.r[i] * 6.8 : hiddenRadius;
                // A short, shared swirl fades through the trainer's formation intro. Polar steering
                // keeps each wild on its own side of the arena while it spirals into its audience slot.
                const gather = Math.min(1, Math.max(0, this.trainerIntro / BOSS.formationSec));
                const targetAngle = this.arenaAngle[i] + gather * 0.48;
                let dx = this.x[i] - this.arenaX;
                let dy = this.y[i] - this.arenaY;
                let radius = Math.hypot(dx, dy);
                let angle = radius > 1e-4 ? Math.atan2(dy, dx) : this.arenaAngle[i];
                const delta = Math.atan2(Math.sin(targetAngle - angle), Math.cos(targetAngle - angle));
                angle += Math.max(-1.8 * dt, Math.min(1.8 * dt, delta));
                const radialStep = Math.max(-BOSS.watchSpeed * dt,
                    Math.min(BOSS.watchSpeed * dt, targetRadius - radius));
                const minRadius = this.arenaR + this.r[i] + 6;
                const nextRadius = radius + radialStep;
                // Mobs already inside when the encounter starts are harmless while being gathered;
                // let them travel outward visibly instead of teleporting to the boundary.
                radius = radius < minRadius ? nextRadius : Math.max(minRadius, nextRadius);
                this.x[i] = this.arenaX + Math.cos(angle) * radius;
                this.y[i] = this.arenaY + Math.sin(angle) * radius;
                this.vx[i] = this.vy[i] = 0;
                g.insert(i, this.x[i], this.y[i]);
            }
            return;
        }
        for (let i = 0; i < this.n; i++) g.insert(i, this.x[i], this.y[i]);
        const q = this._q;
        const sep = this.cfg.radius * 2.1;
        const leash = ring * this.cfg.leashMul;
        for (let i = 0; i < this.n; i++) {
            if (this.wildBoss[i]) {
                this.wildBossLife[i] -= dt;
                if (this.wildBossLife[i] <= 0) {
                    this.dead[i] = 1;
                    this.dirty = 1;
                    this.bossN = Math.max(0, this.bossN - 1);
                    continue;
                }
            }
            if (this.flash[i] > 0) this.flash[i] -= dt;
            if (this.root[i] > 0) this.root[i] = Math.max(0, this.root[i] - dt);
            if (this.wildBossReady[i]) {
                this.vx[i] = this.vy[i] = 0;
                continue;
            }
            if (this.legendaryReady[i]) {
                this.vx[i] = this.vy[i] = 0;
                continue;
            }
            if (this.weaken[i] > 0) {
                this.weaken[i] -= dt;
                this.vx[i] = 0;
                this.vy[i] = 0;
                if (this.weaken[i] <= 0) {
                    // §6.3-2: the window expiring is a second chance, not a lost target.
                    this.hp[i] = Math.min(this.maxhp[i] * this.cfg.weakenAt, this.hp[i] + this.maxhp[i] * 0.15);
                }
                continue;
            }
            if (this.boss[i]) {
                // Legendary lair damage is delivered only by its announced random attack zones;
                // don't add an untelegraphed chase/body-contact attack on top of those tells.
                if (this.legendary[i]) {
                    this.vx[i] = this.vy[i] = 0;
                    continue;
                }
                this._boss(i, dt, px, py);
                continue;
            }
            if (this.root[i] > 0) {
                this.vx[i] = 0;
                this.vy[i] = 0;
                continue;
            }
            let dx = px - this.x[i];
            let dy = py - this.y[i];
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            if (d > leash) {
                this._recycle(i, px, py, ring);
                continue;
            }
            const sp = this.cfg.speed * (this.elite[i] ? 0.8 : 1);
            let sx = (dx / d) * sp;
            let sy = (dy / d) * sp;
            g.query(this.x[i], this.y[i], sep, q, 24);
            let ox = 0;
            let oy = 0;
            for (let k = 0; k < q.length; k++) {
                const j = q[k];
                if (j === i) continue;
                const ddx = this.x[i] - this.x[j];
                const ddy = this.y[i] - this.y[j];
                const dd = ddx * ddx + ddy * ddy;
                const min = this.r[i] + this.r[j];
                if (dd > min * min || dd < 1e-6) continue;
                const inv = 1 / Math.sqrt(dd);
                ox += ddx * inv;
                oy += ddy * inv;
            }
            const ol = Math.sqrt(ox * ox + oy * oy);
            if (ol > 1e-6) {
                sx += (ox / ol) * sp * 0.9;
                sy += (oy / ol) * sp * 0.9;
            }
            this.vx[i] = sx;
            this.vy[i] = sy;
            this.x[i] += sx * dt;
            this.y[i] += sy * dt;
        }
    }
}
