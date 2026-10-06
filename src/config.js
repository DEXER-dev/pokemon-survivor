/*
 * Every number from 游戏设计方案.md that the runtime reads. Distances are pixels;
 * PPM converts the doc's metres so a tuning pass never needs a unit rewrite.
 */

export const VIEW = {
    W: 1280, H: 720, zoom0: 1.2,
    // A 领域 has to be *seen* to be walked into (§5.7-E, and 【走】 is one of the two verbs), so a field's
    // ring is clamped to the visible half-height: 720/2/1.2 = 300 world px, minus a margin. Past this the
    // ring stops being a shape on screen and becomes an off-screen arc the player cannot read.
    // Guard, not constraint, at `nodesMax: 3`: 3 节圆 caps the reach at 66 px (74 px at 3 阶), so the fattest
    // shipped 领域 ring is 74 x 3.4 = 251 px and never reaches 260. v0.9.8's merged 满线 body (`topBulk: 6`)
    // does bind it — its ring stops growing past ~3.2 节圆当量 — which is the intended failure: past this the
    // ring is no longer a shape on screen but an off-screen arc, and 【走】 is one of the two verbs.
    fieldMaxR: 260,
};
export const PPM = 40;

export const PLAYER = {
    radius: 15,
    speed: 4.2 * PPM,
    accel: 30,
    // One bite per window no matter how many bodies are inside it. Per-second-per-enemy contact
    // turned a 40-strong pile-up into a 0.3 s death, which is not pressure, it is a wall.
    iFrame: 0.6,
    bite: 12,
    // The only healing in the game, and it never takes anything back: a level pays some HP back so
    // the kill-rate-to-damage-rate race is winnable, which is the whole VS survival contract.
    levelHeal: 0.15,
};

export const CHAIN = {
    history: 1024,
    // 0.6-1.05 m, not the doc's 0.9-1.6: at the wider spacing the first node sits 90 px behind the
    // hero while contact starts at 28 px, so the tail could never reach what was killing you.
    // A tighter pack also reads as "一堆宠物跟着主角" instead of a sparse queue.
    spacingMin: 0.6 * PPM,
    spacingMax: 1.05 * PPM,
    headGap: 14,
    stiffness: 18,
    // v0.9.3: 12 → 6, signed as 「降节圆密度」 (§9.15-⑨) so 自动进化 can fire before the 3:00 BOSS. Until
    // v0.9.6 this one number *was* the auto gate's threshold too, which is why it had to be halved to
    // make auto fire at all.
    // It is *not* a display knob: `visualOf` feeds `headRadius`, the ring radii and the 甩尾 width, so the
    // arm that never auto-folds moved as well - the sweep that proved that is §9.15-⑨. The gate has its own
    // density now (`autoEvery` below); this one is only the picture and the damage.
    nodeEvery: 6,
    nodesMax: 3,
    // v0.9.8 「进化满之后，下次捕捉到相同的时候，就是体系变大，发出的弹幕也变大」 + 玩家纠正
    // 「为什么同一类型的挤在一起…不能进化也要合在一起，改变的是体型」 (2026-09-22). A link whose 图鉴线 has no
    // step left therefore stops adding 节圆 — it collapses into **one body** — and its remaining 只数 buys
    // 体型 instead: `chain.bulkOf` is that body's size in 节圆当量, and it is what every radius downstream
    // reads (`headRadius` → the 甩尾 hitbox and the drawn aura, 主技's 子蛋 `r`, 光束 `wide`, 领域 `ring`).
    // So 6 here means "as fat as a 6-节圆 pack", drawn as one animal, and the whole 段's dps stops being
    // split across seats (`combat.sweep` still divides by `visualOf`, which is now 1).
    // Not applied to `autoNodesAt`: the 排场 the fold laws protect is counted in the ordinary currency, and
    // a link that can still evolve keeps paying for 阶 rather than for girth.
    topBulk: 6,
    // §7.1-4 段内进化, v0.9 re-priced off the species' own `Evolutions` edge (species.js). The fold still
    // divides the *whole* stack - `count → floor(count / q)` - because a flat price scales with nothing:
    // measured in v0.8, a fixed 3 只 would hand out ×2.65 of DPS at 12 只 and ×3.15 at 120 只. What is new
    // is that `q` is no longer one number for the whole roster. It comes off the canonical level:
    //   q = evolveBase + 1 past `evolveLv[0]`   →  3 只 @16-23 级, 4 只 @25 级以上
    // so 妙蛙种子 (16/32 级) costs 3 then 4 and 大颚蚁 (25/50) costs 4 then 4. The list is deliberately one
    // entry long: `DPS` grows ×3.0-×3.2 per 阶 against `count^0.65`, so a 5-只 step returns only ×1.05 -
    // a fold that spends five pets for five percent is a dead button, and sim §7.1-4 now prints the
    // worst step in the roster to keep that a measurement instead of a claim. The rest of the ladder
    // (ratios, 只数 to the top of each line) is in `DPS`/`DMG_EXPONENT`'s hands, not this comment's.
    evolveBase: 3,
    evolveLv: [24],
    // A 石头 / 亲密度 step is canonically the *no-grind* step: you do not level, you produce an item or
    // you walk with it. So it is priced at `evolveSkip` 只 - cheaper in pile - and the difference is
    // charged in the thing its condition is made of: 融核 for a stone (see `evolveCoin`), seconds on the
    // chain for 亲密度 (`happySec`). Two 合 1 is the floor because a fold of one pet would be free DPS.
    evolveSkip: 2,
    // Stone price is derived, not chosen: PBS/items.txt sells every ordinary evolution stone for 2100 and
    // this game mints 1 融核 per `FURNACE.coreEvery` 只, so `price / evolveCoin` puts 雷之石 at 10 核,
    // 联结之绳 (5000, the trade item) at 24 and 王者之证 (6000) at 29 - i.e. the *relative* rarity of the
    // stones is the file's, and the only number here is the exchange rate. 10 核 is a quarter of a 铸造,
    // which makes it a real early-game squeeze and pocket change late; whether that gap matters is the
    // 三 seed question in §9.13, and this constant is inside the pending 融核 定价 signature.
    evolveCoin: 210,
    // 皮丘's first step: the link has to have been carried this long *at its current 阶* (age resets on
    // every fold and on 晋升), because friendship is time with you and not a pile of 皮丘.
    happySec: 30,
    // v0.9.9: his own sentence, said six times, taken literally — **3 只同族就进化，不分族、不分跳、不花别的钱**.
    // `0` = 退回图鉴价，即下面这五个常数自己说话（`evolveBase`/`evolveLv` 给 3 或 4 只，`evolveSkip`+`evolveCoin`
    // 给石头步 2 只与融核，`happySec` 给亲密步 30 秒）。钉成 3 抹掉的是 v0.9 那张 23 步的价格阶梯（12 步 4 只、
    // 5 步 2 只 + 10~24 核、1 步 2 只 + 携带 30 秒），也就是 §13-J 里"进化条件按图鉴来"的**价**那一半 ——
    // 名字/编号/属性/进化链仍然整条按图鉴，`stepOf().kind` 没动，所以面板照旧印得出「雷之石 · 同族 3 合 1」。
    // 一条后果要盯：融核从此**只剩熔炉铸造一个出口**（40 核 + 1 基因），而 `findAuto` 的禁令③（不花融核）
    // 在没有核价的世界里**没有适用步** —— 所以回归把③的那两行挪到 `evolveFlat = 0` 的世界里验（§9.20）。
    evolveFlat: 3,
    // v0.9.9-b: 「3 只」 is the *trigger* price, and this rung decides whether it is also the *divisor*.
    // `chain.foldAfter` is the single writer; the four rungs are what one fold leaves behind:
    //   0 `floor(count / q)`  the stack divides — v0.9's law, still the shipped one
    //   1 `count − q + 1`     the pile pays `q − 1` and keeps the rest — the signed 「(b) 触发价不吃排场」
    //   2 `count − 1`         one member transforms and nothing else is eaten — what 原作 literally does
    //   3 `count`             进化 buys 阶 and eats nothing — 「只需要 3 只就能进化」 read as a law
    // Rungs 0 and 1 are the *same number* at `count = q`, and at the player's hand speed the median fold is
    // exactly that pile (④ fires at 3–5 只, 中位 3, and the 排场 gate fires 0–1 times a run), so rung 1 buys
    // back 排场 only on the fat piles the instrument's economy makes. Measured 8 seeds × both rates in §9.21:
    // at 24 球/min `evo` 0/8 → 2/8 and `auto` 2/8 → 4/8 against a control of 7/8 — **not shipped**. Rung 2 is
    // closer (4/8 · 5/8) and still short; rung 3 is worse (2/8 · 3/8) even though it spends no 只数 and carries
    // the highest DPS in the roster. **None of the four shapes reaches the control**, which is the finding that
    // moved the question off the price: what a fold spends is not 只数, it is the ground the 段's discs cover,
    // and `ENEMY.threat` prices the wave off the nominal DPS the fold inflates (§9.22).
    // Not free either way: `segDps` grows on `count^0.65`, so a fold that leaves the pile whole stops being
    // ratio-neutral, which the 堆叠不变性 probe prints per rung instead of asserting.
    evolveKeeps: 0,
    // The evolution ceiling is 3 阶. A line
    // shorter than three stages is capped by its own dex depth instead - 喵喵→猫老大 is the whole line,
    // so 猫老大 cannot be 段内进化'd past 2 阶. `evoCeil(fam)` in species.js.
    evolveCeil: 3,
    // Automatically fold a stack as soon as it satisfies its evolution gate (currently 3 same-species copies).
    // E remains an optional manual shortcut. This switch can disable automatic evolution for debugging.
    autoEvolve: true,
    // Legacy simulation dial (not used by live auto evolution): how many 只 the *gate* counts as one 节圆, separate from the 6 the screen draws with. Until
    // now the two were the same constant, and that is the whole reason 「还是不能自动进化啊」 was true three
    // times: the gate's threshold is `2 × density × q`, so while the two shared the value 6 a 3合1 line
    // auto-folded at 36 只 while E has been folding it at 3 只 since v0.9 — a 12× gap on the verb he asked
    // to automate. Lowering `nodeEvery` again was not the lever: it is a damage knob (`visualOf` feeds
    // `headRadius` and the 主技 ring radii), so it moves the 手动 control arm too, which is v0.9.3's bill.
    // This one has exactly one reader (`chain.autoNodesAt`), so a rung here changes *only* when auto folds
    // — measured: `merge` and `evo` are byte-identical at all five rungs (§9.17-②).
    // 4 = 「允许自动折掉一个节圆」: in display terms a fold now needs 3 节圆 on screen and may leave 2 behind,
    // which is 24/16/32 只 on the 3/2/4-合-1 lines instead of 36/24/48. Five rungs were swept (§9.17-①) and
    // this is the only one that never died - 8/8 seeds 活满, against 7/8 at 2, 6/8 at 6 and at 1, and 2/5 at
    // 3 (that rung was only reached on five seeds). **That ladder is the bot's own 197 球/min**; at his 24 球/min
    // the same gate reads 7/8 (§9.19-⑥ 的 auto@off 行), which is still the control's own survival pattern.
    // **Survival is what sells it, not damage**: paired on the seeds
    // where both arms last the full 10 min it is +43% dps over 手动 (median of 6), and rung 6 is the same
    // order at +53%. The "+66%" this comment carried for an hour was the two arms' whole-table averages
    // divided, which rung 4 wins only because 手动 happened to die on two of the seeds inside its own
    // average - §9.17-③ is that correction, and it is why the ladder is quoted per seed. Set back to 6 for
    // the gate that spends no drawn sprite: pixel-neutral, and it loses `20260922 @188s` where manual play
    // survives. 1 is as close as this rule gets to "fold whatever E could pay" (a 6-只 pile), and it is the
    // weakest rung on the dial (+19% median) without being the eager one that died 5/5 in §9.15-②.
    autoEvery: 4,
    // Legacy simulation dial (not used by live auto evolution): how many seconds a pile has to stand without a new 只 before auto folds it *at its
    // own 图鉴价*, instead of at the 排场 price above. `Infinity` = off = v0.9.6's behaviour.
    // Why a second road at all: ①② were measured on a bot's economy. A bot lands ~1.6 只/s, so its piles pass
    // 24 只 in the first two minutes; a player aiming by hand lands a few dozen across twelve families, so his
    // piles live at 3-8 只 — under a gate of 16-32. That is the fourth 「还是要自己按E键进化」: not a threshold
    // that was too high to tune, a threshold that is unreachable in the economy he actually plays in.
    // What keeps ④ from being the eager rule that died 5/5 (§9.15-②) is `chain.coldFoldable`: it may only
    // spend a pile whose fold removes **no 节圆 the screen is drawing**, so a 3-只 pile on a 3合1 line (1 circle)
    // folds, while an 11-只 pile (2 circles → 1) waits for the 排场 road. Coverage can still form; ④ just
    // harvests the piles he walked away from.
    // 3 = 「放手 3 秒就按图鉴价折」, decided on the hand-speed grid (24 球/min, six rungs × 8 seeds, §9.19-⑥)
    // after v0.9.7 shipped 20 off a five-rung ladder taken at the bot's 197 球/min that turned out to print no
    // signal at all (§9.18 自首). It is the most eager rung whose deaths are *exactly* the control's: 7/8 活满
    // with only `31415` down (186 s), the same seed the 手动 arms lose, while 20 and 12 read 6/8 and 6 reads 5/8. What
    // it buys for that: paired over the 7 seeds both arms keep alive, dps ×1.44 (median; 6 of 7 cells ≥ ×1.24,
    // `20260922` ×0.89), 进化 ×18, and 12–36 图鉴价 folds per run at 2–5 只 — that is 「只要3只就进化」 as close
    // as this rule gets: `q` prices a 3合1 line at exactly 3 只, and the only thing standing between a pile of
    // 3 and a fold used to be the 排场 gate of 16. `0` is not "more of the same", it is a worse trade: it buys
    // 5 more folds a run (median 进化 32 vs 27, same 2-5 只 piles) and kills `20260921`@159 s and `7777`@186 s,
    // which every other rung including `3` keeps to 600. What `3` does cost is 清场 6.92 s against the control's
    // 5.49 (+26%), just past the 5.5-6.8 s readout band of §9.18-⑥ - and that column is a valley, not a slope
    // (20 → 6.79, 12 → 6.44, 6 → 7.84, 0 → 7.47), so it is not a dial that rewards going eager.
    // Set to 20 for v0.9.7's rung, Infinity for v0.9.6.
    autoCold: 3,
    // §5.2: a run *starts* with 12 links and buys more with its level-ups; 32 is the array budget and
    // the ceiling, not the opening state. It was 8 until the v0.4 regression measured 37% of greedy's
    // catches overflowing - 12 families x tiers cannot fit in 8 slots, so that is a geometric collision,
    // not a skill problem, and overflow is progression the player cannot see. 链位上限's card count is
    // tuned against this so 12 + 10*2 lands exactly on hardCap.
    softCap: 12,
    hardCap: 32,
    alpha: 0.85,
    // A long chain is ~90 m of pets, so the camera has to back off - but backing off is what made the
    // hero read as a speck, so the taper now starts from an intentional 1.2x framing and bottoms out
    // at 0.85x of *that*, which is still 15% larger than the old flat baseline.
    zoom: (nodes) => VIEW.zoom0 * Math.max(0.85, 1 / (1 + Math.max(0, nodes - 14) * 0.004)),
    // The node is a whole stack of pets, so its footprint is a pack, not one animal.
    // `tierR` closes a gap between the picture and the hitbox that §9.18 measured: the sprite has grown
    // +6% per 阶 since v0.9.4 (`base` in game.js, plus the `formMin` icon floor), but until now the circle
    // it sweeps had no 阶 term at all, so 「3 只换 1 只」 traded away coverage and got a bigger drawing of
    // the same circle back. This number is not a new dial - it is the same 0.06 the renderer already uses,
    // applied to the thing the player is actually buying with the fold.
    // Since `sweepArea` below, this term reaches the *drawing* (the sprite's own 阶 scale) and the `sweepArea: 0`
    // regression arm only: the shipped 甩尾 disc no longer goes through `headRadius`'s 阶 factor at all, because
    // 阶 now arrives in its damage term.
    tierR: 0.06,
    // v0.9.9-c (2026-09-23): the 甩尾 disc's **area is the 段's per-seat DPS** — `chain.radiusOf` sizes it as
    // `一节圆 × (每节圆 dps)^0.5`, so the ground a link sweeps can never shrink when it evolves, and the wave —
    // whose HP §5.4 prices off that same nominal DPS — is finally priced against damage the tail can land.
    // Why this is the number and not a nudge: `ENEMY.threat = threatDps/cap × clearSec`, and `threatDps` is
    // `chainDps`, the paper number. The old law grew the disc as 体型 (`bulk`, capped 3 节圆) × `tierR` 6%/阶,
    // so a 段 that tripled its damage kept roughly its radius: measured 实付 (damage actually paid ÷ nominal)
    // was 8–21% on the folding arms against 40%+ on the 晋升-only arm, and 怪血 at the *same* 只数 was 4-5× the
    // control's — i.e. every 进化 bought a harder wave and a weaker delivery, which is the whole reason all four
    // `evolveKeeps` shapes died at 24 球/min (§9.21) while nothing about the price was wrong. With 0.5 on, 清场
    // lands on §5.4's own promise (median 2.2–3.9 s at 24 球/min, 1.9–2.9 at the bot's own rate, against
    // `clearSec: 2.5`; the off rung measures 5.4–7.4 s on the arms that survive at all) and
    // 8 seeds × both hand speeds put every catching arm at 8/8 活满 with the not-catching arms still dead.
    // Cost of the law, stated plainly: a fold no longer buys *relative* power (the wave re-prices to match), it
    // buys 体型/弹幕/主技/图鉴进度 — and the disc is clamped at `VIEW.fieldMaxR`, so past ~8 只 on a 满线 3 阶
    // body the paper number outruns the geometry again; `GEO=1` in the sim prints how many discs sit on it.
    // The constant is the **exponent**, so `0` restores v0.9.8's law (体型 × 阶, √k only at 满线) and a rung
    // below 0.5 under-compensates. Swept on 8 seeds at 24 球/min (§9.22-④): `0` → merge 7/8 · evo 0/8 · auto
    // 2/8, `0.15` → 5/8 · 1/8 · 1/8 (worse than off: a partial exponent also shrinks the big 1阶 piles the
    // control lives on), `0.25` → 8/8 · 8/8 · 7/8, `0.35` and `0.5` → 8/8 all three. So parity is reached
    // before the lawful point, and the rung that ships is the one where §5.4's own `clearSec` stops being a
    // promise and becomes a measurement — the arms that never catch anything still die on every seed.
    sweepArea: 0.5,
    headRadius: (visual, tier = 1) => (0.75 + visual * 0.3) * (1 + CHAIN.tierR * ((tier | 0) - 1)) * PPM,
};

export const SIM = { step: 1 / 60, maxSteps: 5, debugKeys: false };
export const GRID_CELL = 64;

export const ENEMY = {
    // Keep the live wild horde finite so a late-run spawn ramp cannot bury the playfield or stall kills.
    initialCapacity: 300,
    populationCap: 300,
    // Keep per-mob HP scaling independent of the live-population ceiling.
    threatBudget: 300,
    radius: 13,
    speed: 2.1 * PPM,
    // Difficulty tracks the player, not the clock. A chain that accumulates one pet per kill grows
    // faster than any fixed time curve can follow - the sim measured 6,000 DPS by minute 1.5 against
    // a horde still worth 14 HP, which is an empty screen and no game. So the潮 refills off the pet
    // count and each body carries a share of everything already killed. Still entirely enemy-side:
    // nothing the player collected is ever taken back.
    spawnBase: 1.2,
    spawnPerMin: 8,
    spawnPerPet: 0.02,
    // Add a second, late-run ramp so the field continues to feel replenished after the player has
    // built a strong team. Early rates are unchanged; the field can now keep accumulating mobs.
    spawnLatePerMin: 3,
    hpBase: 6,
    hpGrowth: 1.07,
    // The horde's HP is derived from the chain's own DPS: `clearSec` is the promise that a full field
    // always takes this long to erase, whatever the player has grown into. Kill count cannot be the
    // signal because 晋升 multiplies DPS without adding a single kill - the sim's merge bot hit 0.3 s
    // clears for two whole minutes on exactly that mistake. Time still ramps it, which is what ends runs.
    clearSec: 2.5,
    eliteHpMul: 12,
    eliteEvery: 45,
    eliteAfter: 90,
    spawnRingPad: 90,
    // Stragglers are recycled to the ring once they fall this many rings behind, so the 300 budget
    // is always spent around the player instead of trailing off-screen.
    leashMul: 2.2,
    weakenAt: 0.3,
    weakenSec: 12,
    // 潮汐自缩放的次幂：hp 跟着 (玩家DPS/预算)^0.75 走而非线性，输出升级因此有真实的
    // 清场收益（×4 火力 → 怪血 ×2.83 → 清场时间 ×0.71），但压力仍随构筑增长不至踏平。
    hpScaleExp: 0.7,

    /** One source of truth for the wave density, so the headless sim and the runtime cannot drift. */
    spawnRate (minute, pets) {
        return this.spawnBase + this.spawnPerMin * minute + this.spawnPerPet * pets
            + this.spawnLatePerMin * Math.max(0, minute - 2);
    },
};

/**
 * §5 波次表 3:00 班基拉斯 - the milestone boss that pays 融核 and unlocks the evolution reward.
 * Nothing here is invented except the two numbers the spec leaves to feel: the charge (this is the
 * pressure §5.6-结论2 says the game has never applied, because 回血 was the only survival lever) and the
 * in-game size (`§8`'s 256 px is a sprite sheet, not a hitbox).
 *
 * Mob HP is derived from the chain's own DPS. The first trainer-team build used the old ×200 budget and
 * could be erased before its patterns read; ×1000 gives the encounter a real boss-length health pool.
 */
export const BOSS = {
    // Legacy single-body/simulator schedule. The live game uses wild-kill milestones below.
    at: [180],
    killThresholds: [180, 550, 1250, 2300, 3700, 5400, 7500, 9900, 12600, 15600],
    repeatKillStep: 3600,
    repeatKillGrowth: 480,
    // v0.9: this body has drawn a 班基拉斯 since v0.7, so §5's greybox name 铁颚猪王 retired with the
    // rest of the placeholder roster. The charge pattern below is unchanged - it is still the same
    // signed 3:00 encounter, now called what it looks like.
    name: '班基拉斯',
    trainerName: '王牌训练家',
    // Three evolved partners attack together; their combined HP keeps the old BOSS HP budget.
    party: [
        { fam: 'lizard', tier: 3, pattern: 'fan', period: 2.8, shots: 5, spread: 0.82, speed: 4.8 * PPM },
        { fam: 'turtle', tier: 3, pattern: 'focus', period: 3.4, shots: 3, spread: 0.16, speed: 4.2 * PPM },
        { fam: 'bean', tier: 3, pattern: 'ring-gap', period: 3.0, shots: 8, spread: 0, speed: 5.4 * PPM },
    ],
    // Ten one-minute chapters. The two added patterns are readable silhouettes: a four-way cross
    // and a slowly rotating radial burst; every partner keeps its own wind-up and cooldown.
    encounters: [
        { name: '菜种', hpMul: 400, party: [
            { fam: 'badger', tier: 2, pattern: 'fan', period: 3.2, shots: 3, spread: 0.72, speed: 4.2 * PPM },
            { fam: 'shell', tier: 2, pattern: 'cross', period: 3.8, shots: 4, spread: 0, speed: 3.8 * PPM },
            { fam: 'toad', tier: 2, pattern: 'ring-gap', period: 3.5, shots: 6, spread: 0, speed: 4.4 * PPM },
        ] },
        { name: '电次', hpMul: 700, party: [
            { fam: 'bean', tier: 3, pattern: 'ring-gap', period: 3.0, shots: 8, spread: 0, speed: 5.2 * PPM },
            { fam: 'beetle', tier: 2, pattern: 'focus', period: 3.4, shots: 3, spread: 0.12, speed: 4.8 * PPM },
            { fam: 'turtle', tier: 2, pattern: 'cross', period: 4.0, shots: 4, spread: 0, speed: 3.9 * PPM },
        ] },
        { name: '王牌训练家', mega: { slot: 0, form: 'charizard-y', pattern: 'fan', shots: 9, spread: 0.92 }, party: [
            { fam: 'lizard', tier: 3, pattern: 'fan', period: 2.8, shots: 5, spread: 0.82, speed: 4.8 * PPM },
            { fam: 'turtle', tier: 3, pattern: 'focus', period: 3.4, shots: 3, spread: 0.16, speed: 4.2 * PPM },
            { fam: 'bean', tier: 3, pattern: 'ring-gap', period: 3.0, shots: 8, spread: 0, speed: 5.4 * PPM },
        ] },
        { name: '吉宪', mega: { slot: 1, form: 'swampert', pattern: 'spiral', shots: 8 }, party: [
            { fam: 'turtle', tier: 3, pattern: 'focus', period: 3.1, shots: 3, spread: 0.12, speed: 4.5 * PPM },
            { fam: 'drop', tier: 3, pattern: 'spiral', period: 3.6, shots: 7, spread: 0, speed: 4.2 * PPM },
            { fam: 'toad', tier: 3, pattern: 'fan', period: 3.3, shots: 5, spread: 0.9, speed: 4.0 * PPM },
        ] },
        { name: '梅丽莎', mega: { slot: 1, form: 'gengar', pattern: 'ring-gap', shots: 9 }, party: [
            { fam: 'moth', tier: 3, pattern: 'spiral', period: 3.0, shots: 8, spread: 0, speed: 4.5 * PPM },
            { fam: 'specter', tier: 3, pattern: 'fan', period: 3.5, shots: 5, spread: 0.78, speed: 4.1 * PPM },
            { fam: 'beetle', tier: 3, pattern: 'cross', period: 3.8, shots: 4, spread: 0, speed: 4.4 * PPM },
        ] },
        { name: '东瓜', mega: { slot: 1, form: 'blastoise', pattern: 'cross', shots: 8 }, party: [
            { fam: 'shell', tier: 3, pattern: 'cross', period: 3.4, shots: 4, spread: 0, speed: 4.2 * PPM },
            { fam: 'beetle', tier: 3, pattern: 'focus', period: 3.0, shots: 3, spread: 0.1, speed: 5.0 * PPM },
            { fam: 'turtle', tier: 3, pattern: 'fan', period: 3.6, shots: 5, spread: 0.68, speed: 4.0 * PPM },
        ] },
        { name: '大叶', mega: { slot: 0, form: 'charizard-x', pattern: 'cross', shots: 7 }, party: [
            { fam: 'lizard', tier: 3, pattern: 'fan', period: 2.8, shots: 5, spread: 0.9, speed: 5.0 * PPM },
            { fam: 'moth', tier: 3, pattern: 'spiral', period: 3.4, shots: 8, spread: 0, speed: 4.8 * PPM },
            { fam: 'drop', tier: 3, pattern: 'cross', period: 3.8, shots: 4, spread: 0, speed: 4.4 * PPM },
        ] },
        { name: '小椿', mega: { slot: 2, form: 'salamence', pattern: 'spiral', shots: 9 }, party: [
            { fam: 'mayfly', tier: 3, pattern: 'ring-gap', period: 3.1, shots: 7, spread: 0, speed: 5.0 * PPM },
            { fam: 'lizard', tier: 3, pattern: 'focus', period: 3.3, shots: 3, spread: 0.12, speed: 5.2 * PPM },
            { fam: 'drake', tier: 3, pattern: 'spiral', period: 3.7, shots: 8, spread: 0, speed: 4.2 * PPM },
        ] },
        { name: '悟松', mega: { slot: 1, form: 'blastoise', pattern: 'cross', shots: 8 }, party: [
            { fam: 'bean', tier: 3, pattern: 'cross', period: 3.1, shots: 4, spread: 0, speed: 5.0 * PPM },
            { fam: 'turtle', tier: 3, pattern: 'fan', period: 3.4, shots: 5, spread: 0.8, speed: 4.5 * PPM },
            { fam: 'shell', tier: 3, pattern: 'ring-gap', period: 3.8, shots: 8, spread: 0, speed: 4.2 * PPM },
        ] },
        { name: '竹兰', mega: { slot: 0, form: 'charizard-x', pattern: 'cross', shots: 8 }, party: [
            { fam: 'lizard', tier: 3, pattern: 'fan', period: 2.5, shots: 7, spread: 0.92, speed: 5.2 * PPM },
            { fam: 'drop', tier: 3, pattern: 'spiral', period: 3.0, shots: 9, spread: 0, speed: 4.8 * PPM },
            { fam: 'mayfly', tier: 3, pattern: 'ring-gap', period: 3.2, shots: 9, spread: 0, speed: 5.2 * PPM },
        ] },
    ],
    arenaRatio: 0.42,
    formationSec: 2.8,
    projectileDamage: 14,
    projectileRadius: 10,
    projectileWarning: 0.72,
    // The three partners orbit the arena and periodically answer the trainer's command together.
    formationOrbitSpeed: 0.14,
    phaseTwoOrbitSpeed: 0.28,
    commandPeriod: 10,
    phaseTwoCommandPeriod: 7,
    commandWarning: 1.05,
    phaseTwoAt: 0.5,
    phaseTwoPeriodMul: 0.82,
    phaseTwoSpeedMul: 1.16,
    phaseTwoDamageMul: 1.15,
    // Two close perimeter bands; enough wilds to make the trainer arena feel encircled without
    // placing them inside the clear fighting floor. Keep about one sprite-width of breathing room:
    // the rest of a large horde stays in the distant backdrop instead of stacking over the audience.
    watchCount: 60,
    watchRateSeconds: 2.5,
    watchMaxCount: 300,
    watchSpacing: 44,
    watchSpeed: 360,
    // Default for later encounters: the old 200× budget folded in seconds against a strong chain.
    // Early encounters override this with smaller values so their fights fit their one-minute cadence.
    hpMul: 1000,
    // ~125 px diameter at the starter-wave radius: visibly larger than the hero and regular horde.
    radiusMul: 4.8,
    // Slower than an elite while it walks: the charge is the threat, and a boss that also out-jogs you
    // permanently is not dodgeable, just unfair.
    walk: 0.7,
    dash: 11 * PPM,
    // A charge is only committed from this far out: the tell has to be readable, so a boss that dashed
    // from beyond the frame would be a coin flip and not a decision.
    range: 380,
    windup: 0.55,
    // Random legendary arena attacks need a readable dodge window even behind a full party.
    legendaryWindup: 1.35,
    legendaryImpact: 0.32,
    dashSec: 0.45,
    rest: 1.7,
    // The BOSS gives a large reserve of 融核 for evolution gates.
    cores: 60,
    bite: 4,
};

/**
 * The largest body the horde can hold, used as a *query* slop. Every acceptance test in this codebase
 * adds the body's own radius (`r + enemies.r[j]`), so a grid lookup sized to a mob can fail to return a
 * boss standing exactly where its ring visibly is - and a 甩尾 that passes through a boss reads as the
 * skill breaking, not as a hitbox being honest. This is deliberately separate from the mob-sized
 * tolerance the 环 forms use for their inner band, so that band keeps the width it was measured with.
 */
export const MAX_BODY_R = Math.max(ENEMY.radius * 2, ENEMY.radius * BOSS.radiusMul * 1.5);

/**
 * §6.0 精灵球 (v0.4). The verb stopped being a vacuum and became a thrown object, so every number
 * here is a flight number. `r` is the corridor half-width: a ball catches whatever its swept path
 * touches, which is why the old 准星宽度 tolerance died with the 兽魂 - an exact hit test needs no
 * slop on top of it, and slop on top of a projectile is a promise the game cannot keep.
 */
export const BALL = {
    cap: 6,
    startingAmmo: 5,
    levelAmmo: 5,
    rangeBase: 9 * PPM,
    // Fixed flight tuning: 24 m/s over 9 m is 0.375 s, long enough to read as a throw but short
    // enough that a stationary target cannot dodge it.
    speedBase: 24 * PPM,
    rBase: 15,
    // The captured animal's streak from the hit to the tail. The ball carries the aim and the hit;
    // this is only the "it really joined the line" beat, so it stays short.
    flyTime: 0.34,
    // After a catch the ball sits where it hit and wobbles before it opens. This is theatre, not a
    // verdict - the animal is already taken when the first tilt starts, so no wobble can end badly.
    // 0.36 s is just over two swings at 2.5, which is the beat a thrown ball needs to look settled.
    wobTime: 0.36,
    wobSwings: 2.5,
    // Peak tilt in radians (~31 deg). Enough to read against the ball's own spin, small enough that a
    // ball never looks like it is falling over.
    wobAmp: 0.55,
    // An elite that has not been knocked 虚弱 shrugs the ball off. This is how long that clang is.
    bounce: 0.2,
};

/** §6.1 【掷】- the game's second and last verb. */
export const CATCH = {
    // The cooldown is the only rate limiter on 抓不完, so it has to start where aiming still matters:
    // 2.4 throws/s is roughly one ball per crossing, which keeps the crosshair the scarce resource.
    repeat: 0.42,
    tapMaxMs: 200,
    tapMaxMove: 12,
    // Where the crosshair sits for a player who never touched the mouse: 1.2 m past the hero, i.e.
    // down the barrel, so a keyboard-only run still throws somewhere.
    aimAhead: 1.2 * PPM,
};

/**
 * §5.4 单只DPS by tier, and the exponent that keeps "抓不完" from breaking the game.
 * 每阶 ×3.8：一次进化（3合1 折叠后）净收益约 ×1.9，让「进化变强」摸得着。
 */
export const DPS = [10, 38, 145, 550];
export const DMG_EXPONENT = 0.65;
export const EXP = (n) => Math.round(5 * Math.pow(n, 1.35));

/** Team-management panel refunds a small amount of EXP when releasing a link. */
export const FURNACE = {
    // §5.5-D 兜底爽感: 放生返还 60% EXP + 1 融核/10 只. A catch is worth exactly 1 EXP on the same
    // counter as a kill (`drainKills`), so 0.6 EXP per pet in the link is the doc's arithmetic.
    expBack: 0.6,
    coreEvery: 10,
};

export const PLAYER_HP = 120;

/** Every family routes its full segment damage budget through its signature move. */
export const SKILL_SHARE = { Bullet: 1, Area: 1, Beam: 1, Homing: 1, Support: 1 };

/** §5.7-C. `cap` is the object pool, `live` is the fill-rate ceiling the WeChat build actually pays for. */
export const PROJ = { cap: 96, live: 48, overkill: 1.15 };

/**
 * §5.7-E. Each entry is keyed by the roster's internal family id; player-facing names come from species.js.
 * Skills own the whole damage budget; every roster family must have an entry so no party link silently
 * becomes harmless. Shapes change with 阶, numbers do not:
 * `shots` splits one volley's banked damage, so 三连 is three thirds of the same money (§7.1's
 * "形态改变而非纯数值" is a hard constraint on this table, not a flavour line).
 */
export const SKILLS = {
    chikorita: {
        fire: 'field', cd: 0.9, ring: [2.0, 2.45, 2.9], max: [4, 6, 8],
        root: [0.10, 0.18, 0.28],
    },
    cyndaquil: {
        fire: 'bullet', cd: 1.22, shots: [1, 2, 4], spread: 0.24,
        r: [9, 10, 12], speed: [17 * PPM, 18 * PPM, 19 * PPM],
        reach: [8 * PPM, 8.5 * PPM, 9.5 * PPM],
    },
    totodile: {
        fire: 'lunge', cd: 2.25, hops: [1, 1, 2], out: 9 * PPM, back: 10 * PPM,
        orb: [1.25, 1.45, 1.7], impact: 1.55, seek: 3.6,
    },
    turtwig: {
        fire: 'field', cd: 0.88, ring: [2.05, 2.5, 2.95], max: [4, 6, 8],
        root: [0.12, 0.22, 0.32],
    },
    chimchar: {
        fire: 'lunge', cd: 2.0, hops: [1, 1, 2], out: 10 * PPM, back: 11 * PPM,
        orb: [1.2, 1.4, 1.65], impact: 1.5, seek: 3.7,
    },
    piplup: {
        fire: 'beam', cd: 0.92, beams: [1, 2, 3],
        len: [5.8 * PPM, 6.5 * PPM, 7.2 * PPM], wide: [12, 14, 17], turn: 1.7,
    },
    litten: {
        fire: 'bullet', cd: 0.98, shots: [1, 3, 5], spread: 0.38,
        r: [7, 8, 10], speed: [19 * PPM, 20 * PPM, 21 * PPM],
        reach: [7.5 * PPM, 8.5 * PPM, 9.5 * PPM],
    },
    popplio: {
        fire: 'beam', cd: 0.92, beams: [1, 2, 3],
        len: [5.7 * PPM, 6.4 * PPM, 7.1 * PPM], wide: [13, 16, 19], turn: 1.6,
    },
    grookey: {
        fire: 'field', cd: 0.9, ring: [2.05, 2.5, 3.0], max: [4, 6, 8],
        root: [0.1, 0.18, 0.28],
    },
    scorbunny: {
        fire: 'lunge', cd: 1.95, hops: [1, 1, 2], out: 11 * PPM, back: 12 * PPM,
        orb: [1.15, 1.35, 1.6], impact: 1.45, seek: 3.8,
    },
    sobble: {
        fire: 'bullet', cd: 1.0, shots: [1, 2, 4], spread: 0.12,
        r: [8, 9, 11], speed: [18 * PPM, 19 * PPM, 21 * PPM],
        reach: [9 * PPM, 10 * PPM, 11 * PPM], homingTurn: 3.2, seek: 8 * PPM,
    },
    // 妙蛙种子 → 妙蛙草 → 妙蛙花: orbiting seed volleys, growing into a broad leaf fan.
    mush: {
        fire: 'bullet', cd: 1.05, shots: [1, 3, 5], spread: 0.34,
        r: [8, 9, 11], speed: [16 * PPM, 17 * PPM, 18 * PPM],
        reach: [7, 8, 9].map((v) => v * PPM),
    },
    // 木木枭 → 投羽枭 → 狙射树枭: guided feather arrows, recalling Decidueye's archer identity.
    badger: {
        fire: 'bullet', cd: 1.25, shots: [1, 2, 3], spread: 0.1,
        r: [8, 9, 10], speed: [15 * PPM, 16 * PPM, 17 * PPM],
        reach: [8 * PPM, 8.5 * PPM, 9 * PPM], homingTurn: 3.8, seek: 8 * PPM,
    },
    lizard: {
        fire: 'bullet',
        cd: 1.6,
        shots: [1, 3, 1],
        // 3 阶 is the 宽幅火浪: one slow, fat shell instead of three, so the top tier reads as a wall.
        spread: 0.30,
        r: [10, 9, 26],
        speed: [14 * PPM, 14 * PPM, 10 * PPM],
        reach: [7.5 * PPM, 8 * PPM, 5.5 * PPM],
    },
    beetle: {
        fire: 'lunge',
        cd: 2.4,
        hops: [1, 1, 2],
        out: 9 * PPM,
        back: 10 * PPM,
        // 位移段买的是覆盖，不是 DPS: the pounce inflates its own 节圆 while it is airborne.
        orb: [1.25, 1.4, 1.55],
        impact: 1.35,
        // Eyes, in multiples of 节圆, deliberately wider than §5.7-A-4's 2× leg clamp: at 2× the search
        // circle sat entirely inside the tail's own kill radius, so the beetle rarely found a hop to make
        // (§9.9-⑧). 3.35 = 2 (how far the legs may go) + 1.35 (`impact`, how far the landing reaches),
        // i.e. the furthest target a hop can actually touch; 5 and 8 measured worse (齐 8.3 / 10.5 vs 12.5).
        seek: 3.35,
    },
    // ---- §5.7-G step 3: the two forms that cost zero projectiles -------------------------------
    // For these `cd` is not a cooldown but a **tick**: the bank ceiling is one tick of the segment's
    // share, so a field with nothing standing in it stops taking money the moment it fills up and
    // `seg.keep` walks back to 1. That is what makes "必中但覆盖面小" free instead of a tax.
    // `ring` is a multiple of the segment's own 节圆, so `count` fattens the field exactly the way
    // §5.7-A-3 says it should - volume, never extra units.
    //
    // The multiples are measured, not picked (§9.9). The law they encode:
    // a 领域 is a *periodic* ring and the 甩尾 is a *continuous* grinder, so nothing alive is left inside
    // the chain's own reach - the horde stands off at ~250 px. As a filled disc at 1.15-1.5x the 节圆 the
    // three families came ready-and-funded 194-341 times per 3 min and found a body 0-12 times (94-100%
    // 空转). Simply widening the disc did not fix it (12x the area moved 齐 from 1-12 to 7-19); making it
    // an annulus on the 尾节 did, out to ~2.6-3.4x. The clamp then costs throughput on purpose: moth's
    // duty cycle goes 55% -> 41%, because an off-screen arc is not a telegraphed hazard.
    moth: {
        fire: 'field',
        cd: 0.5,
        ring: [2.6, 3.0, 3.4],
        max: [6, 8, 10],
    },
    drop: {
        fire: 'field',
        cd: 0.62,
        ring: [2.35, 2.7, 3.05],
        max: [5, 7, 9],
        // The annulus briefly freezes what it catches; this is control, not extra damage.
        root: [0.12, 0.24, 0.36],
    },
    mayfly: {
        fire: 'field',
        cd: 0.9,
        ring: [2.05, 2.4, 2.7],
        max: [4, 6, 8],
        // Crystal growth pins enemies longer as the field evolves.
        root: [0.16, 0.28, 0.4],
    },
    turtle: {
        fire: 'beam',
        cd: 0.5,
        // 2 阶 柱变双 (一顺一逆). The split is of the *same* money, so 晋升 buys shape, not DPS (§7.1).
        beams: [1, 2, 2],
        len: [5.0 * PPM, 5.6 * PPM, 6.4 * PPM],
        wide: [12, 14, 17],
        turn: 1.5,
    },
    // 皮丘 → 皮卡丘 → 雷丘: fast, increasingly dense electric volleys.
    bean: {
        fire: 'bullet', cd: 1.05, shots: [1, 2, 3], spread: 0.18,
        r: [7, 8, 9], speed: [18 * PPM, 19 * PPM, 20 * PPM],
        reach: [7 * PPM, 7.5 * PPM, 8 * PPM],
        // The same volley budget is divided over the chain; evolution adds links, not free damage.
        bounces: [0, 1, 2], bounceRange: 3.2 * PPM,
    },
    // 小拳石 → 隆隆石 → 隆隆岩: heavy rock shots ricochet between nearby targets.
    shell: {
        fire: 'bullet', cd: 1.35, shots: [1, 1, 1], spread: 0,
        r: [12, 13, 15], speed: [12 * PPM, 13 * PPM, 14 * PPM],
        reach: [7 * PPM, 7.5 * PPM, 8 * PPM],
        bounces: [0, 1, 2], bounceRange: 2.2 * PPM,
    },
    // Gastly line: spectral homing orbs that bend toward distant targets.
    specter: {
        fire: 'bullet', cd: 1.45, shots: [1, 2, 3], spread: 0.08,
        r: [9, 10, 12], speed: [13 * PPM, 14 * PPM, 15 * PPM],
        reach: [9 * PPM, 9.5 * PPM, 10 * PPM], homingTurn: 4.2, seek: 9 * PPM,
    },
    // Ralts line: paired psychic beams sweep a narrow lane and become a focused ray.
    mystic: {
        fire: 'beam', cd: 0.72, beams: [1, 2, 3],
        len: [5.8 * PPM, 6.5 * PPM, 7.2 * PPM], wide: [10, 12, 14], turn: 1.8,
    },
    // Machop line: heavy cross-punch shockwaves, with evolved stages widening into a four-fist fan.
    machop: {
        fire: 'bullet', cd: 1.18, shots: [1, 2, 4], spread: 0.42,
        r: [10, 12, 15], speed: [16, 17, 18].map((v) => v * PPM),
        reach: [8, 9, 10].map((v) => v * PPM),
    },
    // Togepi line: bright wish-stars split into a graceful, four-star fairy volley.
    togepi: {
        fire: 'bullet', cd: 1.28, shots: [1, 2, 4], spread: 0.36,
        r: [9, 11, 13], speed: [15, 16, 17].map((v) => v * PPM),
        reach: [8.5, 9, 10].map((v) => v * PPM),
    },
    // Buizel line: a fast Aqua Jet streak that grows into a split, foaming water volley.
    buizel: {
        fire: 'bullet', cd: 1.02, shots: [1, 2, 3], spread: 0.28,
        r: [9, 11, 13], speed: [18, 20, 22].map((v) => v * PPM),
        reach: [7.5, 8.5, 9.5].map((v) => v * PPM),
        bounces: [0, 0, 1], bounceRange: 2.6 * PPM,
    },
    // Munchlax line: a sleepy, heavy shockwave grows into Snorlax's rolling snore burst.
    munchlax: {
        fire: 'bullet', cd: 1.5, shots: [1, 1, 2], spread: 0.18,
        r: [15, 20, 25], speed: [11, 12, 13].map((v) => v * PPM),
        reach: [7, 8, 9].map((v) => v * PPM), bounces: [0, 1, 2], bounceRange: 3.2 * PPM,
    },
    // 小猫怪家族：高速电爪弹，最终形态会在命中后连续跳跃传导。
    shinx: {
        fire: 'bullet', cd: 1.12, shots: [1, 2, 3], spread: 0.3,
        r: [8, 10, 12], speed: [19, 21, 23].map((v) => v * PPM),
        reach: [7, 8, 9].map((v) => v * PPM), bounces: [0, 1, 3], bounceRange: 3.1 * PPM,
    },
    // Zorua line: seeking illusion shots leave two false images, then ricochet between targets.
    zorua: {
        fire: 'bullet', cd: 1.18, shots: [1, 3], spread: 0.24,
        r: [10, 13], speed: [16, 18].map((v) => v * PPM),
        reach: [8.5, 10].map((v) => v * PPM), homingTurn: 3.6, seek: 9 * PPM,
        bounces: [0, 2], bounceRange: 3.4 * PPM,
    },
    // 毒电婴家族：用带脉冲音波环的电声弹攻击，颤弦蝾螈进化后打出三重折射和弦。
    toxtricity: {
        fire: 'bullet', cd: 1.28, shots: [1, 2], spread: 0.22,
        r: [11, 15], speed: [15, 17].map((v) => v * PPM),
        reach: [8, 9.5].map((v) => v * PPM), bounces: [0, 2], bounceRange: 3.6 * PPM,
    },
    // 蘑蘑菇家族：旋转的孢子囊逐阶变成快速多发，并在敌群中弹射扩散。
    shroomish: {
        fire: 'bullet', cd: 1.34, shots: [1, 2], spread: 0.2,
        r: [12, 16], speed: [14, 17].map((v) => v * PPM),
        reach: [7.5, 9].map((v) => v * PPM), bounces: [0, 2], bounceRange: 3.3 * PPM,
    },
    // 迷布莉姆家族：月牙念波绕着核心旋转，布莉姆温进化后以三发弹射覆盖敌群。
    hatenna: {
        fire: 'bullet', cd: 1.22, shots: [1, 2, 3], spread: 0.24,
        r: [9, 11, 14], speed: [15, 16, 17].map((v) => v * PPM),
        reach: [8, 8.8, 9.8].map((v) => v * PPM), bounces: [0, 1, 2], bounceRange: 3.2 * PPM,
    },
    // 捣蛋小妖家族：暗影长爪穿梭敌阵，逐阶增加爪影数量与折返次数。
    impidimp: {
        fire: 'bullet', cd: 1.16, shots: [1, 2, 3], spread: 0.3,
        r: [10, 12, 15], speed: [16, 18, 20].map((v) => v * PPM),
        reach: [7.5, 8.5, 9.5].map((v) => v * PPM), bounces: [0, 1, 2], bounceRange: 3.5 * PPM,
    },
    // 始祖小鸟家族：化石羽刃沿直线高速飞旋，始祖大鸟的多枚翼刃可弹射穿过敌群。
    archen: {
        fire: 'bullet', cd: 1.24, shots: [1, 2], spread: 0.26,
        r: [12, 16], speed: [16, 19].map((v) => v * PPM),
        reach: [8, 9.5].map((v) => v * PPM), bounces: [0, 2], bounceRange: 3.8 * PPM,
    },
    // Smoliv line: olive-seed bursts grow into a leafy three-shot volley with controlled ricochets.
    smoliv: {
        fire: 'bullet', cd: 1.28, shots: [1, 2, 3], spread: 0.18,
        r: [12, 14, 17], speed: [13, 14, 16].map((v) => v * PPM),
        reach: [7.5, 8.5, 9.5].map((v) => v * PPM), bounces: [0, 1, 2], bounceRange: 3.2 * PPM,
    },
    // Tadbulb: slower, swelling electric bubbles; Bellibolt's heavy bubbles arc once after impact.
    tadbulb: {
        fire: 'bullet', cd: 1.42, shots: [1, 2], spread: 0.2,
        r: [15, 21], speed: [12, 14].map((v) => v * PPM),
        reach: [7, 8.5].map((v) => v * PPM), bounces: [0, 1], bounceRange: 3.4 * PPM,
    },
    // Wattrel line: fast, narrow lightning feathers that gain a gentle homing curve after evolution.
    wattrel: {
        fire: 'bullet', cd: 1.02, shots: [1, 3], spread: 0.14,
        r: [9, 12], speed: [21, 24].map((v) => v * PPM),
        reach: [8.5, 10].map((v) => v * PPM), homingTurn: 2.6, seek: 9.5 * PPM,
    },
    // Porygon line: rotating data prisms split into extra ricochets as the line evolves.
    porygon: {
        fire: 'bullet', cd: 1.18, shots: [1, 2, 3], spread: 0.18,
        r: [10, 13, 16], speed: [17, 18, 19].map((v) => v * PPM),
        reach: [8, 9, 10].map((v) => v * PPM), bounces: [0, 1, 2], bounceRange: 3.1 * PPM,
    },
    // 小仙奶/霜奶仙：蓬松奶油泡泡朝敌群飘去，最终阶段分成更密的妖精糖珠。
    alcremie: {
        fire: 'bullet', cd: 1.12, shots: [1, 2], spread: 0.28,
        r: [9, 12], speed: [15, 17].map((v) => v * PPM),
        reach: [8, 10].map((v) => v * PPM), homingTurn: 2.1, seek: 5.5 * PPM,
    },
    // 粉蝶虫家族：逐阶增加彩粉鳞片的扇射数量与追踪弧度，最终弹射穿过敌阵。
    vivillon: {
        fire: 'bullet', cd: 1.16, shots: [1, 2, 3], spread: 0.3,
        r: [9, 11, 14], speed: [15, 16, 17].map((v) => v * PPM),
        reach: [7.5, 8.8, 10].map((v) => v * PPM), homingTurn: 2.8, seek: 8.5 * PPM,
        bounces: [0, 1, 2], bounceRange: 3.25 * PPM,
    },
    // 萌虻家族：轻盈的蜜粉团追逐目标，蝶结萌虻进化后散成双发并在敌阵间折射。
    cutiefly: {
        fire: 'bullet', cd: 1.08, shots: [1, 2], spread: 0.22,
        r: [10, 13], speed: [17, 19].map((v) => v * PPM),
        reach: [8, 9.5].map((v) => v * PPM), homingTurn: 3.1, seek: 8.5 * PPM,
        bounces: [0, 2], bounceRange: 3.4 * PPM,
    },
    // Weedle line: rapid needle fan, emphasizing Beedrill's high-speed multi-hit identity.
    wasp: {
        fire: 'bullet', cd: 0.82, shots: [2, 4, 6], spread: 0.48,
        r: [6, 7, 8], speed: [20 * PPM, 21 * PPM, 22 * PPM],
        reach: [6.5 * PPM, 7 * PPM, 7.5 * PPM],
    },
    // 咩利羊家族：前两阶练习电球，电龙最终形态以双发雷球在敌群间跳跃传导。
    lamp: {
        fire: 'bullet', cd: 1.14, shots: [1, 1, 2], spread: 0.16,
        r: [10, 12, 14], speed: [15, 16, 18].map((v) => v * PPM),
        reach: [8, 9, 10].map((v) => v * PPM), bounces: [0, 1, 3], bounceRange: 3.2 * PPM,
    },
    // Pidgey line: long-range feather volleys with an increasingly wide spread.
    bird: {
        fire: 'bullet', cd: 1.2, shots: [1, 3, 5], spread: 0.32,
        r: [8, 9, 10], speed: [17 * PPM, 18 * PPM, 19 * PPM],
        reach: [9 * PPM, 10 * PPM, 11 * PPM],
    },
    // Torchic line: an advancing flame charge that strikes through a short row of foes.
    striker: {
        fire: 'lunge', cd: 2.15, hops: [1, 1, 2], out: 10 * PPM, back: 11 * PPM,
        orb: [1.2, 1.35, 1.5], impact: 1.45, seek: 3.5,
    },
    // Abra line: precise psychic beams that reach well beyond the front of the pack.
    sage: {
        fire: 'beam', cd: 0.9, beams: [1, 2, 3],
        len: [6.5 * PPM, 7.2 * PPM, 8 * PPM], wide: [9, 11, 13], turn: 2.1,
    },
    // Aron line: heavy steel rounds ricochet through tightly packed enemies.
    iron: {
        fire: 'bullet', cd: 1.4, shots: [1, 1, 2], spread: 0.12,
        r: [13, 15, 18], speed: [12 * PPM, 13 * PPM, 14 * PPM],
        reach: [7.5 * PPM, 8 * PPM, 8.5 * PPM], bounces: [1, 2, 3], bounceRange: 2.8 * PPM,
    },
    // Treecko line: quick leaf volleys widen into a dense cutting fan.
    grove: {
        fire: 'bullet', cd: 0.95, shots: [2, 3, 5], spread: 0.42,
        r: [7, 8, 10], speed: [19 * PPM, 20 * PPM, 21 * PPM],
        reach: [7.5 * PPM, 8.5 * PPM, 9.5 * PPM],
    },
    // 新叶喵一系：前两阶段为追踪叶刃；魔幻假面喵改用八瓣旋出、绽放、折返的花弹幕。
    sprigatito: {
        fire: 'bullet', cd: 1.15, shots: [1, 2, 4], spread: 0.42,
        r: [8, 9, 10], speed: [18 * PPM, 19 * PPM, 20 * PPM],
        reach: [8 * PPM, 9 * PPM, 10 * PPM],
        homingTurn: 3.4, seek: 9.5 * PPM, bounces: [0, 0, 1], bounceRange: 2.7 * PPM,
    },
    // 呆火鳄一系：以歌声引爆火花环，骨纹巨声鳄进化后形成更宽的周期灼烧领域。
    fuecoco: {
        fire: 'field', cd: 0.86, ring: [2.2, 2.65, 3.1], max: [5, 7, 9],
    },
    // 润水鸭一系：涌跃鸭以水花踢击突进，狂欢浪舞鸭可以连续跳入敌阵。
    quaxly: {
        fire: 'lunge', cd: 2.05, hops: [1, 1, 2], out: 10 * PPM, back: 11 * PPM,
        orb: [1.2, 1.4, 1.65], impact: 1.5, seek: 3.7,
    },
    // 小锻匠一系：蓄力投出沉重锤弹，巨锻匠进化后能打出双锤弹幕。
    tinkatink: {
        fire: 'bullet', cd: 1.55, shots: [1, 1, 2], spread: 0.16,
        r: [15, 18, 22], speed: [11 * PPM, 12 * PPM, 13 * PPM],
        reach: [7.5 * PPM, 8.5 * PPM, 9.5 * PPM],
    },
    // 盐石宝一系：周期生长的盐晶环会束缚敌人，最终形成覆盖更大的盐岩领域。
    nacli: {
        fire: 'field', cd: 0.82, ring: [2.1, 2.55, 3.0], max: [5, 7, 9],
        root: [0.16, 0.28, 0.4],
    },
    // 冰宝一系：朝敌群扫出寒冰龙息，进化后逐步展开多道冰息光柱。
    frigibax: {
        fire: 'beam', cd: 0.88, beams: [1, 2, 3],
        len: [6 * PPM, 6.8 * PPM, 7.6 * PPM], wide: [13, 16, 19], turn: 1.45,
    },
    // 哈力栗一系：将种子与荆棘化作周身环带，布里卡隆展开更大的束缚刺阵。
    chespin: {
        fire: 'field', cd: 0.84, ring: [2.15, 2.6, 3.05], max: [5, 7, 9],
        root: [0.14, 0.24, 0.34],
    },
    // 火狐狸一系：以火焰与念力合成转向光柱，妖火红狐可展开三路火焰扫射。
    fennekin: {
        fire: 'beam', cd: 0.86, beams: [1, 2, 3],
        len: [6.2 * PPM, 6.9 * PPM, 7.6 * PPM], wide: [12, 15, 18], turn: 1.75,
    },
    // 呱呱泡蛙与呱头蛙使用追踪水刃；甲贺忍蛙改为单枚三段穿透的水流手里剑。
    froakie: {
        fire: 'bullet', cd: 1.12, shots: [1, 2, 4], spread: 0.3,
        r: [8, 9, 10], speed: [18 * PPM, 19 * PPM, 20 * PPM],
        reach: [8 * PPM, 9 * PPM, 10 * PPM], homingTurn: 3.5, seek: 9 * PPM,
        bounces: [0, 0, 1], bounceRange: 2.6 * PPM,
    },
    // 藤藤蛇一系：藤鞭化作优雅的扫射光束，君主蛇进化后可同时压制多条战线。
    snivy: {
        fire: 'beam', cd: 0.88, beams: [1, 2, 3],
        len: [6.1 * PPM, 6.8 * PPM, 7.5 * PPM], wide: [11, 14, 17], turn: 1.65,
    },
    // 暖暖猪一系：以火焰冲锋撞入敌阵，炎武王能连续发动两段突进。
    tepig: {
        fire: 'lunge', cd: 2.2, hops: [1, 1, 2], out: 10 * PPM, back: 12 * PPM,
        orb: [1.25, 1.45, 1.7], impact: 1.6, seek: 3.8,
    },
    // 水水獭一系：贝壳刀刃命中后折向邻近目标，进化后弹射次数增加。
    oshawott: {
        fire: 'bullet', cd: 1.18, shots: [1, 2, 3], spread: 0.22,
        r: [9, 10, 12], speed: [17 * PPM, 18 * PPM, 19 * PPM],
        reach: [8 * PPM, 9 * PPM, 10 * PPM], bounces: [0, 1, 2], bounceRange: 2.8 * PPM,
    },
    // 一家鼠全阶段抛出旋转小鼠弹幕；每增加一只同族鼠，每轮多发射一枚，弹体尺寸固定。
    tandemaus: {
        fire: 'bullet', cd: 1.35, shots: [2, 6, 10], spread: 0.38,
        r: [6, 7, 8], speed: [20 * PPM, 21 * PPM, 22 * PPM],
        reach: [7 * PPM, 8 * PPM, 9 * PPM],
    },
    // Bagon line: aerial fireballs track forward and burst into a short, broad volley.
    drake: {
        fire: 'bullet', cd: 1.5, shots: [1, 2, 3], spread: 0.24,
        r: [12, 14, 17], speed: [15 * PPM, 16 * PPM, 17 * PPM],
        reach: [8 * PPM, 9 * PPM, 10 * PPM],
    },
    // Gible line: a burrowing charge that reaches farther and hits harder at the top tier.
    shark: {
        fire: 'lunge', cd: 2.3, hops: [1, 2, 2], out: 11 * PPM, back: 12 * PPM,
        orb: [1.25, 1.45, 1.7], impact: 1.55, seek: 3.8,
    },
    // Beldum line: magnetic slugs start singular, then split into a crossing salvo.
    metal: {
        fire: 'bullet', cd: 1.25, shots: [1, 2, 4], spread: 0.3,
        r: [11, 12, 14], speed: [14 * PPM, 15 * PPM, 16 * PPM],
        reach: [8 * PPM, 8.5 * PPM, 9 * PPM], bounces: [0, 1, 2], bounceRange: 2.6 * PPM,
    },
    tyran: {
        fire: 'bullet', cd: 1.55, shots: [1, 2, 3], spread: 0.22,
        r: [15, 17, 20], speed: [11 * PPM, 12 * PPM, 13 * PPM],
        reach: [8 * PPM, 8.5 * PPM, 9 * PPM], bounces: [1, 2, 3], bounceRange: 3.1 * PPM,
    },
    starling: {
        fire: 'bullet', cd: 1.05, shots: [1, 2, 4], spread: 0.36,
        r: [8, 9, 11], speed: [18 * PPM, 19 * PPM, 20 * PPM],
        reach: [8.5 * PPM, 9.5 * PPM, 10.5 * PPM],
    },
    penguin: {
        fire: 'beam', cd: 0.78, beams: [1, 2, 3],
        len: [5.8 * PPM, 6.5 * PPM, 7.2 * PPM], wide: [13, 16, 19], turn: 1.55,
    },
    simian: {
        fire: 'lunge', cd: 2.05, hops: [1, 1, 2], out: 10 * PPM, back: 12 * PPM,
        orb: [1.2, 1.4, 1.65], impact: 1.5, seek: 3.7,
    },
    lynx: {
        fire: 'bullet', cd: 1.0, shots: [1, 3, 5], spread: 0.38,
        r: [8, 9, 11], speed: [19 * PPM, 20 * PPM, 21 * PPM],
        reach: [7.5 * PPM, 8.5 * PPM, 9.5 * PPM], bounces: [0, 1, 2], bounceRange: 2.5 * PPM,
    },
    bat: {
        fire: 'bullet', cd: 1.15, shots: [1, 2, 3], spread: 0.16,
        r: [8, 9, 10], speed: [17 * PPM, 18 * PPM, 19 * PPM],
        reach: [8 * PPM, 9 * PPM, 10 * PPM], homingTurn: 3.2, seek: 9 * PPM,
    },
    rose: {
        fire: 'field', cd: 0.72, ring: [2.1, 2.55, 3.0], max: [5, 7, 9],
        root: [0.12, 0.2, 0.28],
    },
    rider: {
        fire: 'lunge', cd: 2.35, hops: [1, 1, 2], out: 10 * PPM, back: 12 * PPM,
        orb: [1.25, 1.45, 1.7], impact: 1.6, seek: 3.6,
    },
    spark: {
        fire: 'beam', cd: 0.88, beams: [1, 2, 3],
        len: [5.8 * PPM, 6.5 * PPM, 7.2 * PPM], wide: [11, 14, 17], turn: 1.7,
    },
    magma: {
        fire: 'bullet', cd: 1.35, shots: [1, 2, 3], spread: 0.28,
        r: [11, 13, 16], speed: [13 * PPM, 14 * PPM, 15 * PPM],
        reach: [7 * PPM, 8 * PPM, 9 * PPM],
    },
    mammoth: {
        fire: 'bullet', cd: 1.5, shots: [1, 2, 3], spread: 0.34,
        r: [13, 15, 18], speed: [12 * PPM, 13 * PPM, 14 * PPM],
        reach: [7.5 * PPM, 8.5 * PPM, 9.5 * PPM], bounces: [0, 1, 2], bounceRange: 2.4 * PPM,
    },
    // 单首龙一系：暗色能量弹逐阶扩散，最终形成覆盖面更宽的三向齐射。
    hydra: {
        fire: 'bullet', cd: 1.45, shots: [1, 2, 3], spread: 0.26,
        r: [12, 14, 17], speed: [14 * PPM, 15 * PPM, 16 * PPM],
        reach: [8 * PPM, 9 * PPM, 10 * PPM],
    },
    // 牙牙一系：以近距离重斩冲锋为核心，最终一次突进贯穿更长的敌群。
    axe: {
        fire: 'lunge', cd: 2.2, hops: [1, 1, 2], out: 10 * PPM, back: 12 * PPM,
        orb: [1.25, 1.45, 1.7], impact: 1.6, seek: 3.8,
    },
    // 黏黏宝一系：黏液环从减速控场逐渐扩展成宽阔的黏滞领域。
    goo: {
        fire: 'field', cd: 0.72, ring: [2.25, 2.7, 3.15], max: [5, 7, 9],
        root: [0.18, 0.28, 0.4],
    },
    // 稚山雀一系：精准羽弹自动追踪目标，进化后增加齐射数量与追踪距离。
    rook: {
        fire: 'bullet', cd: 1.0, shots: [1, 2, 4], spread: 0.2,
        r: [7, 8, 10], speed: [19 * PPM, 20 * PPM, 21 * PPM],
        reach: [8 * PPM, 9 * PPM, 10 * PPM], homingTurn: 4.2, seek: 10 * PPM,
    },
    // 多龙梅西亚一系：幽灵弹会追踪并在敌群间弹射，顶阶可连续命中多个目标。
    dreepy: {
        fire: 'bullet', cd: 1.35, shots: [1, 2, 3], spread: 0.12,
        r: [9, 10, 12], speed: [16 * PPM, 17 * PPM, 18 * PPM],
        reach: [9 * PPM, 10 * PPM, 11 * PPM], homingTurn: 4.0, seek: 10 * PPM,
        bounces: [0, 1, 2], bounceRange: 2.8 * PPM,
    },
    // 黑眼鳄一系：贴近目标后发动沙地突袭，进化后冲击范围与连续突袭次数提升。
    croc: {
        fire: 'lunge', cd: 2.35, hops: [1, 1, 2], out: 11 * PPM, back: 12 * PPM,
        orb: [1.2, 1.4, 1.65], impact: 1.55, seek: 3.7,
    },
    // 利欧路一系：Aura Sphere 自动追踪；路卡利欧把灵气球分裂成多枚追击弹。
    lucario: {
        fire: 'bullet', cd: 1.12, shots: [1, 2, 4], spread: 0.18,
        r: [10, 12, 14], speed: [14, 15, 16].map((v) => v * PPM),
        reach: [8, 9, 10].map((v) => v * PPM), homingTurn: 3.4, seek: 9 * PPM,
    },
    // 迷你龙一系：龙息束逐阶加宽，快龙最终交织出三道追踪龙焰。
    dratini: {
        fire: 'beam', cd: 0.96, beams: [1, 2, 3],
        len: [6.2, 7.1, 8.2].map((v) => v * PPM), wide: [13, 17, 22], turn: 1.65,
    },
    // 独剑鞘一系：飞剑由单发变为多刃齐射，坚盾剑怪的剑刃可连续折射。
    honedge: {
        fire: 'bullet', cd: 1.18, shots: [1, 2, 4], spread: 0.2,
        r: [10, 12, 15], speed: [15, 16, 17].map((v) => v * PPM),
        reach: [8, 9, 10].map((v) => v * PPM), bounces: [0, 1, 2], bounceRange: 2.6 * PPM,
    },
    // 燃烧虫一系：火神蛾的火之舞成为不断扩张的灼热领域。
    larvesta: {
        fire: 'field', cd: 0.86, ring: [2.15, 2.7, 3.3], max: [4, 6, 9],
        root: [0.08, 0.14, 0.22],
    },
    // 驹刀小兵一系：拔刀突袭后回到队列；仆刀将军最后追加一次重斩。
    pawniard: {
        fire: 'lunge', cd: 2.2, hops: [1, 1, 2], out: 10 * PPM, back: 11 * PPM,
        orb: [1.2, 1.42, 1.72], impact: 1.62, seek: 3.8,
    },
    // Support Pokémon keep their team buffs and also contribute a light signature attack.
    toad: {
        fire: 'bullet', cd: 1.35, shots: [1, 2, 3], spread: 0.22,
        r: [10, 11, 13], speed: [13, 14, 15].map((v) => v * PPM), reach: [7, 8, 9].map((v) => v * PPM),
        homingTurn: 2.0, seek: 5 * PPM,
    },
    cat: {
        fire: 'bullet', cd: 1.0, shots: [1, 2, 4], spread: 0.4,
        r: [7, 8, 9], speed: [18, 19, 20].map((v) => v * PPM), reach: [7, 8, 9].map((v) => v * PPM),
        homingTurn: 2.8, seek: 6 * PPM,
    },
    // Legendary captures retain a species-specific attack despite having a single evolution stage.
    'legend-mewtwo': { fire: 'beam', cd: 0.9, beams: [1, 1, 1], len: [10, 11, 12].map((v) => v * PPM), wide: [18, 21, 24], turn: 2.5 },
    'legend-lugia': { fire: 'beam', cd: 1.0, beams: [1, 2, 2], len: [9, 10, 11].map((v) => v * PPM), wide: [20, 23, 26], turn: 1.5 },
    'legend-hooh': { fire: 'field', cd: 0.9, ring: [3.2, 3.5, 3.8], max: [8, 10, 12] },
    'legend-rayquaza': { fire: 'bullet', cd: 0.95, shots: [3, 4, 5], spread: 0.36, r: [13, 15, 17], speed: [19, 20, 21].map((v) => v * PPM), reach: [10, 11, 12].map((v) => v * PPM) },
    'legend-kyogre': { fire: 'field', cd: 0.78, ring: [3.4, 3.7, 4], max: [8, 10, 12], root: [0.16, 0.2, 0.24] },
    'legend-groudon': { fire: 'bullet', cd: 1.2, shots: [1, 2, 3], spread: 0.18, r: [18, 20, 22], speed: [13, 14, 15].map((v) => v * PPM), reach: [9, 10, 11].map((v) => v * PPM), bounces: [0, 1, 2], bounceRange: 3 * PPM },
    'legend-dialga': { fire: 'beam', cd: 0.82, beams: [1, 2, 3], len: [8, 9, 10].map((v) => v * PPM), wide: [16, 19, 22], turn: 1.9 },
    'legend-palkia': { fire: 'bullet', cd: 1.0, shots: [2, 3, 4], spread: 0.52, r: [12, 14, 16], speed: [16, 17, 18].map((v) => v * PPM), reach: [9, 10, 11].map((v) => v * PPM), homingTurn: 2.4, seek: 8 * PPM },
    'legend-arceus': { fire: 'field', cd: 0.72, ring: [3.4, 3.8, 4.2], max: [10, 12, 14] },
    // Sub-legendary partners gain distinct, intentionally lighter basic shots when captured.
    'wildboss-articuno': { fire: 'bullet', cd: 1.14, shots: [1], spread: 0.08, r: [9], speed: [17 * PPM], reach: [8 * PPM] },
    'wildboss-zapdos': { fire: 'bullet', cd: 0.94, shots: [1], spread: 0.04, r: [8], speed: [20 * PPM], reach: [8 * PPM] },
    'wildboss-moltres': { fire: 'bullet', cd: 1.1, shots: [1], spread: 0.06, r: [10], speed: [16 * PPM], reach: [8 * PPM] },
    'wildboss-raikou': { fire: 'bullet', cd: 1.02, shots: [1], spread: 0.05, r: [9], speed: [18 * PPM], reach: [8 * PPM] },
    'wildboss-entei': { fire: 'bullet', cd: 1.28, shots: [1], spread: 0.05, r: [11], speed: [14 * PPM], reach: [8 * PPM] },
    'wildboss-suicune': { fire: 'bullet', cd: 1.08, shots: [1], spread: 0.06, r: [9], speed: [17 * PPM], reach: [8 * PPM] },
};

export const ELEMENT = {
    grass: '#7ec86f',
    fire: '#ff9c4a',
    water: '#5cb8f0',
    bolt: '#ffe066',
    crystal: '#b98cff',
    support: '#f5d76e',
};

/** Non-damaging roster support effects, indexed by evolution tier. */
export const SUPPORT_SKILLS = {
    toad: {
        exp: [1.15, 1.25, 1.35],
        ammoEvery: [0, 45, 30],
    },
    cat: {
        invuln: [0.9, 0.9, 0.9],
        shieldEvery: [0, 15, 15],
        levelHeal: [0.15, 0.15, 0.30],
    },
};

/** §8 roster - mobs share this table at tier 1, which is what makes "every enemy is catchable" cheap. */
export const FAMILIES = [
    { id: 'mush', name: '菇蓬蓬', element: 'grass', kind: 'Area', tiers: ['菇蓬蓬', '藤菇兽', '森林菇王'] },
    { id: 'chikorita', name: '菊草叶', element: 'grass', kind: 'Area', tiers: ['菊草叶', '月桂叶', '大竺葵'] },
    { id: 'cyndaquil', name: '火球鼠', element: 'fire', kind: 'Bullet', tiers: ['火球鼠', '火岩鼠', '火暴兽'] },
    { id: 'totodile', name: '小锯鳄', element: 'water', kind: 'Homing', tiers: ['小锯鳄', '蓝鳄', '大力鳄'] },
    { id: 'badger', name: '叶小獾', element: 'grass', kind: 'Homing', tiers: ['叶小獾', '蔓甲獾', '林怒獾王'] },
    { id: 'sprigatito', name: '魔幻假面喵', element: 'grass', kind: 'Homing', tiers: ['新叶喵', '蒂蕾喵', '魔幻假面喵'] },
    { id: 'lizard', name: '炭尾蜥', element: 'fire', kind: 'Bullet', tiers: ['炭尾蜥', '熔尾蜥', '岩火蜥龙'] },
    { id: 'fuecoco', name: '呆火鳄', element: 'fire', kind: 'Area', tiers: ['呆火鳄', '炙烫鳄', '骨纹巨声鳄'] },
    { id: 'moth', name: '烛火蛾', element: 'fire', kind: 'Area', tiers: ['烛火蛾', '焰羽蛾', '灾厄蛾后'] },
    { id: 'drop', name: '泡滴', element: 'water', kind: 'Area', tiers: ['泡滴', '泡泡兽', '潮汐泡鲸'] },
    { id: 'quaxly', name: '润水鸭', element: 'water', kind: 'Homing', tiers: ['润水鸭', '涌跃鸭', '狂欢浪舞鸭'] },
    { id: 'tinkatink', name: '小锻匠', element: 'crystal', kind: 'Bullet', tiers: ['小锻匠', '巧锻匠', '巨锻匠'] },
    { id: 'nacli', name: '盐石宝', element: 'crystal', kind: 'Area', tiers: ['盐石宝', '盐石垒', '盐石巨灵'] },
    { id: 'frigibax', name: '冰宝', element: 'crystal', kind: 'Beam', tiers: ['冰宝', '冻脊龙', '戟脊龙'] },
    { id: 'chespin', name: '哈力栗', element: 'grass', kind: 'Area', tiers: ['哈力栗', '胖胖哈力', '布里卡隆'] },
    { id: 'fennekin', name: '火狐狸', element: 'fire', kind: 'Beam', tiers: ['火狐狸', '长尾火狐', '妖火红狐'] },
    { id: 'froakie', name: '呱呱泡蛙', element: 'water', kind: 'Homing', tiers: ['呱呱泡蛙', '呱头蛙', '甲贺忍蛙'] },
    { id: 'snivy', name: '藤藤蛇', element: 'grass', kind: 'Beam', tiers: ['藤藤蛇', '青藤蛇', '君主蛇'] },
    { id: 'tepig', name: '暖暖猪', element: 'fire', kind: 'Homing', tiers: ['暖暖猪', '炒炒猪', '炎武王'] },
    { id: 'oshawott', name: '水水獭', element: 'water', kind: 'Bullet', tiers: ['水水獭', '双刃丸', '大剑鬼'] },
    { id: 'turtwig', name: '草苗龟', element: 'grass', kind: 'Area', tiers: ['草苗龟', '树林龟', '土台龟'] },
    { id: 'chimchar', name: '小火焰猴', element: 'fire', kind: 'Homing', tiers: ['小火焰猴', '猛火猴', '烈焰猴'] },
    { id: 'piplup', name: '波加曼', element: 'water', kind: 'Beam', tiers: ['波加曼', '波皇子', '帝王拿波'] },
    { id: 'litten', name: '火斑喵', element: 'fire', kind: 'Bullet', tiers: ['火斑喵', '炎热喵', '炽焰咆哮虎'] },
    { id: 'popplio', name: '球球海狮', element: 'water', kind: 'Beam', tiers: ['球球海狮', '花漾海狮', '西狮海壬'] },
    { id: 'grookey', name: '敲音猴', element: 'grass', kind: 'Area', tiers: ['敲音猴', '啪咚猴', '轰擂金刚猩'] },
    { id: 'scorbunny', name: '炎兔儿', element: 'fire', kind: 'Bullet', tiers: ['炎兔儿', '腾蹴小将', '闪焰王牌'] },
    { id: 'sobble', name: '泪眼蜥', element: 'water', kind: 'Homing', tiers: ['泪眼蜥', '变涩蜥', '千面避役'] },
    { id: 'tandemaus', name: '一家鼠', element: 'support', kind: 'Bullet', tiers: ['一家鼠', '家主鼠'] },
    { id: 'turtle', name: '刺鳍龟', element: 'water', kind: 'Beam', tiers: ['刺鳍龟', '锯鳍龟', '深渊龟皇'] },
    { id: 'bean', name: '电豆', element: 'bolt', kind: 'Bullet', tiers: ['电豆', '蹦跳电豆', '雷云豆兽'] },
    { id: 'beetle', name: '磁甲虫', element: 'bolt', kind: 'Homing', tiers: ['磁甲虫', '磁暴甲虫', '天罚甲王'] },
    { id: 'shell', name: '棱镜螺', element: 'crystal', kind: 'Bullet', tiers: ['棱镜螺', '折射螺', '棱光圣螺'] },
    { id: 'mayfly', name: '石晶蜉', element: 'crystal', kind: 'Area', tiers: ['石晶蜉', '晶簇蜉', '晶界巨蜉'] },
    { id: 'toad', name: '吞金蟾', element: 'support', kind: 'Support', tiers: ['吞金蟾', '招财金蟾', '吞星金蟾'] },
    { id: 'cat', name: '绷带喵', element: 'support', kind: 'Support', tiers: ['绷带喵', '护理喵', '圣光喵'] },
    { id: 'specter', name: '幽灵团', element: 'support', kind: 'Homing', tiers: ['幽灵团', '夜影怪', '暗夜魔灵'] },
    { id: 'mystic', name: '念力芽', element: 'support', kind: 'Beam', tiers: ['念力芽', '幻念花', '心灵仙子'] },
    { id: 'machop', name: '腕力', element: 'support', kind: 'Bullet', tiers: ['腕力', '豪力', '怪力'] },
    { id: 'wasp', name: '刺针蜂', element: 'crystal', kind: 'Bullet', tiers: ['刺针蜂', '蛹甲蜂', '毒针蜂王'] },
    { id: 'lamp', name: '咩利羊', element: 'bolt', kind: 'Bullet', tiers: ['咩利羊', '茸茸羊', '电龙'] },
    { id: 'bird', name: '疾风鸟', element: 'grass', kind: 'Homing', tiers: ['疾风鸟', '旋风鸟', '烈羽鸟王'] },
    { id: 'striker', name: '火苗鸡', element: 'fire', kind: 'Bullet', tiers: ['火苗鸡', '烈焰斗鸡', '爆炎斗士'] },
    { id: 'sage', name: '念力晶', element: 'support', kind: 'Beam', tiers: ['念力晶', '灵思晶', '超能贤者'] },
    { id: 'iron', name: '铁甲矿', element: 'crystal', kind: 'Bullet', tiers: ['铁甲矿', '钢甲矿', '钢铁巨甲'] },
    { id: 'grove', name: '叶刃蜥', element: 'grass', kind: 'Bullet', tiers: ['叶刃蜥', '丛林蜥', '森林剑王'] },
    { id: 'drake', name: '飞翼龙', element: 'fire', kind: 'Bullet', tiers: ['飞翼龙', '苍翼龙', '天穹龙王'] },
    { id: 'shark', name: '沙鲨', element: 'crystal', kind: 'Bullet', tiers: ['沙鲨', '裂地鲨', '地脉鲨皇'] },
    { id: 'metal', name: '磁核兽', element: 'bolt', kind: 'Bullet', tiers: ['磁核兽', '磁暴钢兽', '天坠铁王'] },
    { id: 'tyran', name: '岩甲暴君', element: 'crystal', kind: 'Bullet', tiers: ['岩甲暴君', '沙甲暴君', '暗岩霸王'] },
    { id: 'starling', name: '星羽鸟', element: 'grass', kind: 'Bullet', tiers: ['星羽鸟', '疾风鸟', '天空领主'] },
    { id: 'penguin', name: '寒潮企鹅', element: 'water', kind: 'Beam', tiers: ['寒潮企鹅', '冰鳍企鹅', '帝王冰企鹅'] },
    { id: 'simian', name: '炎拳猴', element: 'fire', kind: 'Bullet', tiers: ['炎拳猴', '烈拳猴', '斗炎猿王'] },
    { id: 'lynx', name: '电光猫', element: 'bolt', kind: 'Bullet', tiers: ['电光猫', '雷影猫', '轰雷狮王'] },
    { id: 'bat', name: '夜翼蝠', element: 'support', kind: 'Homing', tiers: ['夜翼蝠', '毒牙蝠', '月影蝠王'] },
    { id: 'rose', name: '花苞灵', element: 'grass', kind: 'Area', tiers: ['花苞灵', '荆棘花', '芳香花后'] },
    { id: 'rider', name: '岩角骑兽', element: 'crystal', kind: 'Bullet', tiers: ['岩角骑兽', '重甲骑兽', '地脉骑王'] },
    { id: 'spark', name: '电能拳兽', element: 'bolt', kind: 'Beam', tiers: ['电能拳兽', '雷拳斗士', '电磁拳王'] },
    { id: 'magma', name: '熔岩拳兽', element: 'fire', kind: 'Bullet', tiers: ['熔岩拳兽', '火山拳兽', '爆焰炮兽'] },
    { id: 'mammoth', name: '冰原猛犸', element: 'crystal', kind: 'Bullet', tiers: ['冰原猛犸', '冻土猛犸', '极寒巨象'] },
    { id: 'hydra', name: '单首龙', element: 'support', kind: 'Bullet', tiers: ['单首龙', '双首暴龙', '三首恶龙'] },
    { id: 'axe', name: '牙牙', element: 'crystal', kind: 'Homing', tiers: ['牙牙', '斧牙龙', '双斧战龙'] },
    { id: 'goo', name: '黏黏宝', element: 'water', kind: 'Area', tiers: ['黏黏宝', '黏美儿', '黏美龙'] },
    { id: 'rook', name: '稚山雀', element: 'grass', kind: 'Homing', tiers: ['稚山雀', '蓝鸦', '钢铠鸦'] },
    { id: 'dreepy', name: '多龙梅西亚', element: 'support', kind: 'Homing', tiers: ['多龙梅西亚', '多龙奇', '多龙巴鲁托'] },
    { id: 'croc', name: '黑眼鳄', element: 'crystal', kind: 'Bullet', tiers: ['黑眼鳄', '混混鳄', '流氓鳄'] },
    { id: 'lucario', name: '利欧路', element: 'support', kind: 'Homing', tiers: ['利欧路', '路卡利欧'] },
    { id: 'dratini', name: '迷你龙', element: 'crystal', kind: 'Beam', tiers: ['迷你龙', '哈克龙', '快龙'] },
    { id: 'honedge', name: '独剑鞘', element: 'crystal', kind: 'Bullet', tiers: ['独剑鞘', '双剑鞘', '坚盾剑怪'] },
    { id: 'larvesta', name: '燃烧虫', element: 'fire', kind: 'Area', tiers: ['燃烧虫', '火神蛾'] },
    { id: 'pawniard', name: '驹刀小兵', element: 'crystal', kind: 'Homing', tiers: ['驹刀小兵', '劈斩司令', '仆刀将军'] },
    // Append new wild families after the established roster so saved seeds keep their opening species.
    { id: 'togepi', name: '波克比', element: 'support', kind: 'Bullet', tiers: ['波克比', '波克基古', '波克基斯'] },
    { id: 'buizel', name: '泳圈鼬', element: 'water', kind: 'Bullet', tiers: ['泳圈鼬', '浮潜鼬'] },
    { id: 'munchlax', name: '小卡比兽', element: 'support', kind: 'Bullet', tiers: ['小卡比兽', '卡比兽'] },
    { id: 'shinx', name: '小猫怪', element: 'bolt', kind: 'Bullet', tiers: ['小猫怪', '勒克猫', '伦琴猫'] },
    { id: 'zorua', name: '索罗亚', element: 'support', kind: 'Homing', tiers: ['索罗亚', '索罗亚克'] },
    { id: 'toxtricity', name: '毒电婴', element: 'bolt', kind: 'Bullet', tiers: ['毒电婴', '颤弦蝾螈'] },
    { id: 'shroomish', name: '蘑蘑菇', element: 'grass', kind: 'Bullet', tiers: ['蘑蘑菇', '斗笠菇'] },
    { id: 'hatenna', name: '迷布莉姆', element: 'support', kind: 'Bullet', tiers: ['迷布莉姆', '提布莉姆', '布莉姆温'] },
    { id: 'impidimp', name: '捣蛋小妖', element: 'support', kind: 'Bullet', tiers: ['捣蛋小妖', '诈唬魔', '长毛巨魔'] },
    { id: 'archen', name: '始祖小鸟', element: 'crystal', kind: 'Bullet', tiers: ['始祖小鸟', '始祖大鸟'] },
    { id: 'smoliv', name: '迷你芙', element: 'grass', kind: 'Bullet', tiers: ['迷你芙', '奥利纽', '奥利瓦'] },
    { id: 'tadbulb', name: '光蚪仔', element: 'bolt', kind: 'Bullet', tiers: ['光蚪仔', '电肚蛙'] },
    { id: 'wattrel', name: '电海燕', element: 'bolt', kind: 'Bullet', tiers: ['电海燕', '大电海燕'] },
    { id: 'porygon', name: '多边兽', element: 'support', kind: 'Bullet', tiers: ['多边兽', '多边兽Ⅱ', '多边兽Ｚ'] },
    { id: 'alcremie', name: '小仙奶', element: 'support', kind: 'Homing', tiers: ['小仙奶', '霜奶仙'] },
    { id: 'vivillon', name: '粉蝶虫', element: 'support', kind: 'Homing', tiers: ['粉蝶虫', '粉蝶蛹', '彩粉蝶'] },
    { id: 'cutiefly', name: '萌虻', element: 'support', kind: 'Homing', tiers: ['萌虻', '蝶结萌虻'] },
    { id: 'vivillon', name: '粉蝶虫', element: 'support', kind: 'Homing', tiers: ['粉蝶虫', '粉蝶蛹', '彩粉蝶'] },
    // Random roaming wild bosses: the Kanto bird trio, then the Johto beasts.
    { id: 'wildboss-articuno', name: '急冻鸟', element: 'water', kind: 'Area', tiers: ['急冻鸟'] },
    { id: 'wildboss-zapdos', name: '闪电鸟', element: 'bolt', kind: 'Beam', tiers: ['闪电鸟'] },
    { id: 'wildboss-moltres', name: '火焰鸟', element: 'fire', kind: 'Area', tiers: ['火焰鸟'] },
    { id: 'wildboss-raikou', name: '雷公', element: 'bolt', kind: 'Beam', tiers: ['雷公'] },
    { id: 'wildboss-entei', name: '炎帝', element: 'fire', kind: 'Area', tiers: ['炎帝'] },
    { id: 'wildboss-suicune', name: '水君', element: 'water', kind: 'Beam', tiers: ['水君'] },
    // Remaining mythic captures are single-species roster lines and use the boss silhouette when art is absent.
    { id: 'legend-mewtwo', name: '超梦', element: 'support', kind: 'Beam', tiers: ['超梦'] },
    { id: 'legend-lugia', name: '洛奇亚', element: 'water', kind: 'Beam', tiers: ['洛奇亚'] },
    { id: 'legend-hooh', name: '凤王', element: 'fire', kind: 'Area', tiers: ['凤王'] },
    { id: 'legend-rayquaza', name: '烈空坐', element: 'grass', kind: 'Bullet', tiers: ['烈空坐'] },
    { id: 'legend-kyogre', name: '盖欧卡', element: 'water', kind: 'Area', tiers: ['盖欧卡'] },
    { id: 'legend-groudon', name: '固拉多', element: 'fire', kind: 'Bullet', tiers: ['固拉多'] },
    { id: 'legend-dialga', name: '帝牙卢卡', element: 'bolt', kind: 'Beam', tiers: ['帝牙卢卡'] },
    { id: 'legend-palkia', name: '帕路奇亚', element: 'water', kind: 'Beam', tiers: ['帕路奇亚'] },
    { id: 'legend-arceus', name: '阿尔宙斯', element: 'crystal', kind: 'Area', tiers: ['阿尔宙斯'] },
];

export const LEGENDARY_BOSSES = FAMILIES.filter((f) => f.id.startsWith('legend-'));
export const WILD_BOSSES = FAMILIES.filter((f) => f.id.startsWith('wildboss-'));
export const WILD_FAMILY_COUNT = FAMILIES.length - LEGENDARY_BOSSES.length - WILD_BOSSES.length;

/** Roaming sub-legendary encounters: stochastic arrival, readable window, then they leave. */
export const WILD_BOSS = {
    firstAfter: 60,
    firstDelayMin: 34,
    firstDelayMax: 58,
    delayMin: 68,
    delayMax: 112,
    spawnChance: 0.72,
    lifetime: 38,
    readyLifetime: 18,
    // Roaming sub-legendaries must take long enough to register as a fight even after a late-game
    // party has assembled. They remain optional and catchable, but should not melt in one volley.
    hpMul: 400,
    radiusMul: 5.6,
    // Roaming legendaries approach steadily and use species-specific telegraphed moves for pressure.
    walkMul: 1.12,
    rest: 1.25,
};

export const STARTERS = FAMILIES.filter((f) => ['mush', 'lizard', 'turtle', 'chikorita', 'cyndaquil', 'totodile',
    'grove', 'striker', 'drop', 'turtwig', 'chimchar', 'piplup', 'snivy', 'tepig', 'oshawott', 'chespin',
    'fennekin', 'froakie', 'badger', 'litten', 'popplio', 'grookey', 'scorbunny', 'sobble', 'sprigatito',
    'fuecoco', 'quaxly'].includes(f.id));

export const COL = {
    ground: '#e4edcf',
    grid: '#b5cc9a',
    wall: '#4a445c',
    hero: '#4a3f6b',
    heroTrim: '#f7f1e3',
    text: '#3d3652',
    accent: '#7a5cc4',
    enemy: '#6b6fa8',
    enemyElite: '#443f74',
    dim: '#a8adcb',
    gold: '#ffd76e',
    ink: '#2b2540',
};

export const family = (id) => FAMILIES.find((f) => f.id === id);

/** §8 only names three 阶 per family, so a forged 4 阶 wears its 3 阶 name plus the number. */
export const tierName = (id, tier) => {
    const t = family(id).tiers;
    return t[Math.min(tier, t.length) - 1];
};

/**
 * §7.2 首发 6 个变异. None of them are implemented, and only 史莱姆王 spends 融核 - the furnace lists them
 * because §5.5-D's third action is "查看排列配方", and a chain-management screen that hides what the
 * arrangement is *for* is the one place 摆放尾巴 would stop being a decision.
 */
export const MUTATIONS = [
    { name: '熔岩龟', row: '火 Bullet + 水 Beam 相邻', note: '水柱落地变熔池，燃烧+碎甲双状态' },
    { name: '霜雷鹰', row: '水 + 雷 相邻', note: '命中减速 → 雷必感电（冻结连携）' },
    { name: '棱光圣环', row: '晶 + 火 相邻', note: '光束经晶体反射成 3 条' },
    { name: '苔雷菇', row: '草 + 雷 相邻', note: '孢子环被点燃变爆炸环' },
    { name: '吞星蟾', row: '支援 ×3 相邻', note: '全屏吸附 + 每 30 s 送 1 段 1 阶' },
    { name: '史莱姆王', row: '任意 3 段相邻 + 2 融核', note: '分裂召唤物（子体上限 8，计入段数）' },
];
