/*
 * 升级三选一 (§4). Cards improve the team, capture, movement, survival, or skills; none hands the hero
 * a direct attack (§5.1 零输出). Familiar Pokémon items make each choice's payoff explicit, while
 * the pool stays engine-free so the headless sim and runtime share one balance table.
 */

import { BALL, CATCH, CHAIN, PPM } from './config.js';
import { megaCardsFor } from './mega.js';
import { gigantamaxCardsFor, gigantamaxLocksEvolution } from './gigantamax.js';
import { lineTop } from './chain.js';
import { AUSTRALIAN_MOUSE_INTERVAL, australianMouseCount, grantAustralianMouse } from './items/australian-mouse.js';

export const CARDS = 3;

export class Build {
    constructor () {
        this.reset();
    }

    reset () {
        this.balls = BALL.startingAmmo;
        this.range = BALL.rangeBase;
        this.ballR = BALL.rBase;
        this.ballSpeed = BALL.speedBase;
        this.repeat = CATCH.repeat;
        this.dmg = 1;
        this.fireRate = 1;
        this.skillSize = 1;
        this.splashR = 1;
        this.speedMul = 1;
        this.expMul = 1;
        this.spawnRateMul = 1;
        this.regen = 0;
        this.sashReady = false;
        this.expShare = false;
        this.australianMouseTimer = 0;
        this.stacks = Object.create(null);
    }
}

/**
 * `delta` is what the card shows and what the toast repeats back, so a number can never be
 * displayed as something other than what `apply` will do to it.
 */
export const LEVELS = [
    {
        id: 'cap',
        name: '队伍扩容',
        icon: 'POKEBALL',
        // 10, not 12: the chain now opens at softCap 12, so 10 picks of +2 land exactly on hardCap 32.
        // A 11th and 12th card would sit in the fan promising segments the clamp refuses to give.
        max: 10,
        delta: (b, x) => `${x.chain.cap} → ${Math.min(CHAIN.hardCap, x.chain.cap + 2)} 段`,
        note: '队伍上限 +2，可以多收宝可梦',
        done: (b, x) => x.chain.cap >= CHAIN.hardCap,
        apply: (b, x) => { x.chain.growCap(2); },
    },
    {
        id: 'machoBrace',
        name: '强制锻炼器',
        icon: 'MACHOBRACE',
        max: 5,
        delta: (b) => `×${b.spawnRateMul.toFixed(2)} → ×${(b.spawnRateMul + 0.1).toFixed(2)} 野生刷新速度`,
        note: '野生宝可梦刷新速度 +10%，最多叠加 5 次',
        apply: (b) => { b.spawnRateMul += 0.1; },
    },
    {
        id: 'skillSize',
        name: '大根',
        icon: 'BIGROOT',
        max: 5,
        delta: (b) => `×${b.skillSize.toFixed(2)} → ×${(b.skillSize * 1.14).toFixed(2)}`,
        note: '弹幕、光束和领域范围 +14%',
        apply: (b) => { b.skillSize *= 1.14; },
    },
    {
        id: 'choiceScarf',
        name: '讲究围巾',
        icon: 'CHOICESCARF',
        max: 5,
        delta: (b) => `发射间隔 ×${b.fireRate.toFixed(2)} → ×${(b.fireRate * 0.85).toFixed(2)}`,
        note: '全队弹幕发射速度提高 18%（冷却缩短，伤害不变）',
        apply: (b) => { b.fireRate *= 0.85; },
    },
    {
        id: 'dmg',
        name: '讲究头带',
        icon: 'CHOICEBAND',
        max: 5,
        delta: (b) => `×${b.dmg.toFixed(2)} → ×${(b.dmg * 1.2).toFixed(2)}`,
        note: '全队招式伤害提高 20%',
        apply: (b) => { b.dmg *= 1.2; },
    },
    {
        id: 'expertBelt',
        name: '达人带',
        icon: 'EXPERTBELT',
        max: 4,
        delta: (b) => `×${b.dmg.toFixed(2)} → ×${(b.dmg * 1.15).toFixed(2)}`,
        note: '全队招式伤害提高 15%',
        apply: (b) => { b.dmg *= 1.15; },
    },
    {
        id: 'flameOrb',
        name: '火焰宝珠',
        icon: 'FLAMEORB',
        max: 3,
        delta: (b, x) => `×${b.dmg.toFixed(2)} → ×${(b.dmg * 1.3).toFixed(2)}（生命 −15）`,
        note: '代价：全队招式伤害 +30%，最大生命 −15',
        apply: (b, x) => {
            b.dmg *= 1.3;
            if (x && x.player) {
                x.player.maxhp = Math.max(60, x.player.maxhp - 15);
                x.player.hp = Math.min(x.player.hp, x.player.maxhp);
            }
        },
    },
    {
        id: 'blackBelt',
        name: '黑带',
        icon: 'BLACKBELT',
        max: 4,
        delta: (b) => `溅射半径 ×${b.splashR.toFixed(2)} → ×${(b.splashR * 1.15).toFixed(2)}`,
        note: '弹幕命中溅射范围 +15%，一片怪一起带走',
        apply: (b) => { b.splashR *= 1.15; },
    },
    {
        id: 'speed',
        name: '逃脱按键',
        icon: 'EJECTBUTTON',
        max: 5,
        delta: (b) => `×${b.speedMul.toFixed(2)} → ×${(b.speedMul * 1.1).toFixed(2)}`,
        note: '移动速度 +10%，更容易脱围',
        apply: (b) => { b.speedMul *= 1.1; },
    },
    {
        id: 'hp',
        name: '文柚果',
        icon: 'SITRUSBERRY',
        max: 6,
        delta: (b, x) => `${Math.round(x.player.maxhp)} → ${Math.round(x.player.maxhp + 35)} HP`,
        note: '最大生命 +35，并立即恢复 35 HP',
        apply: (b, x) => {
            x.player.maxhp += 35;
            x.player.hp = Math.min(x.player.maxhp, x.player.hp + 35);
        },
    },
    {
        id: 'luckyEgg',
        name: '幸运蛋',
        icon: 'LUCKYEGG',
        max: 3,
        delta: (b) => `×${b.expMul.toFixed(2)} → ×${(b.expMul * 1.25).toFixed(2)} EXP`,
        note: '击败、捕获经验 +25%，更快升级得球',
        apply: (b) => { b.expMul *= 1.25; },
    },
    {
        id: 'leftovers',
        name: '吃剩的东西',
        icon: 'LEFTOVERS',
        max: 3,
        delta: (b) => `每秒回复 ${(b.regen * 100).toFixed(1)}% → ${((b.regen + 0.015) * 100).toFixed(1)}% 最大生命`,
        note: '每秒回复 1.5% 生命，最多叠加 3 次',
        apply: (b) => { b.regen += 0.015; },
    },
    {
        id: 'alcremieSweet',
        name: '草莓糖饰',
        icon: 'ALCREMIESWEET',
        max: 1,
        delta: (b, x) => b.stacks.alcremieSweet
            ? '已装备 → 完成一整圈方向旋转，小仙奶入队'
            : `未装备 → 完成一整圈方向旋转，小仙奶入队${x && x.chain && x.chain.normalSegmentCount >= x.chain.cap ? '（队伍满时奖励暂存）' : ''}`,
        note: '普通道具：用键盘、鼠标或摇杆连续转动移动方向一整圈，获得 1 只小仙奶；队伍满时保留待领奖励',
        apply: () => {},
    },
    {
        id: 'focusSash',
        name: '气势披带',
        icon: 'FOCUSSASH',
        max: 1,
        delta: (b) => b.sashReady ? '已拥有 → 已拥有' : '未拥有 → 1 次濒死保命',
        note: '濒死保留 1 HP，回复 35% 生命并无敌 2 秒',
        apply: (b) => { b.sashReady = true; },
    },
    {
        id: 'expShare',
        name: '学习装置',
        icon: 'EXPSHARE',
        rarity: 'legendary',
        max: 1,
        delta: (b) => b.expShare ? '同族 3 只 → 2 只' : '未装备 → 同族 2 只即可进化',
        note: '传说道具：全队进化门槛降至 2 只同种宝可梦',
        apply: (b) => { b.expShare = true; },
    },
    {
        id: 'kingsRock',
        name: '王者之证',
        icon: 'KINGSROCK',
        rarity: 'legendary',
        max: 1,
        delta: (b) => (b.stacks.kingsRock ? '已拥有 → 已拥有' : '未拥有 → 击败同种 10 送 1'),
        note: '传说道具：击败野外与队伍同种的宝可梦 10 次，自动获得一只该精灵入队（怪海里也能进化）',
        apply: () => {},
    },
    {
        id: 'australianMouse',
        name: '澳大利亚老鼠',
        icon: 'AUSTRALIANMOUSE',
        rarity: 'legendary',
        max: 1,
        delta: (b, x) => {
            const count = australianMouseCount(x && x.chain);
            return `${count} → ${count + 1} 只一家鼠 · 每 ${AUSTRALIAN_MOUSE_INTERVAL} 秒翻倍`;
        },
        note: '传说道具：立即加入 1 只一家鼠，此后每 60 秒队伍里一家鼠数量翻倍；只增加数量，不增大体型',
        done: (_b, x) => {
            const chain = x && x.chain;
            if (!chain) return true;
            const alreadyOwned = chain.segments.some((segment) =>
                segment.fam === 'tandemaus' && !segment.shiny);
            return !alreadyOwned && chain.normalSegmentCount >= chain.cap;
        },
        apply: (b, x) => {
            const result = grantAustralianMouse(x && x.chain);
            if (result === 'overflow') {
                b.stacks.australianMouse = 0;
                return;
            }
            b.australianMouseTimer = 0;
        },
    },
    {
        id: 'shinyCharm',
        name: '闪耀护符',
        icon: 'SHINYCHARM',
        rarity: 'legendary',
        max: 3,
        delta: (b) => {
            const cur = [1, 4, 16, 64][Math.min(3, b.stacks.shinyCharm || 0)];
            return `闪光概率 ×${cur} → ×${cur * 4}（1/${Math.round(2048 / (cur * 4))}）`;
        },
        note: '传说道具：闪光精灵出现率 ×4（它们免疫队伍攻击，只能用球收服）',
        apply: () => {},
    },
    {
        id: 'familyWard',
        name: '同族护符',
        icon: 'LINKINGCORD',
        rarity: 'legendary',
        max: 1,
        delta: (b) => (b.stacks.familyWard ? '已装备 → 同族野生宝可梦保留 1 HP'
            : '未装备 → 同族野生宝可梦保留 1 HP'),
        note: '传说道具：队伍不会击败同进化家族的野生宝可梦，但仍可投球捕捉',
        apply: () => {},
    },
    {
        id: 'rareCandy',
        name: '奇异糖果',
        icon: 'RARECANDY',
        max: 1,
        delta: () => '选择一只可进化的队伍精灵，免费进化一阶段',
        note: '不消耗同族数量，进化后保留原有队伍数量',
        done: (b, x) => !x || !x.chain || !x.chain.segments.some((seg) =>
            !lineTop(seg.fam, seg.tier) && !gigantamaxLocksEvolution(seg)),
        apply: () => {},
    },
    {
        id: 'dynamaxBand',
        name: '极巨手环',
        icon: 'DYNAMAXBAND',
        rarity: 'legendary',
        max: 1,
        delta: (b) => (b.stacks.dynamaxBand ? '已装备 → G 选择宝可梦' : '未装备 → 解锁极巨化'),
        note: '传说道具：按 G 选择一只非 MEGA / 超极巨宝可梦，强化 30 秒，冷却 60 秒',
        apply: () => {},
    },
    {
        id: 'zPowerBand',
        name: 'Z力量手环',
        icon: 'ZPOWERBAND',
        rarity: 'legendary',
        max: 1,
        delta: (b) => (b.stacks.zPowerBand ? '已装备 → Z 选择纯晶并释放' : '未装备 → 解锁 Z 技能'),
        note: '传说道具：按 Z 释放属性Z弹幕；C 选择纯晶。同属性宝可梦越多，弹体与爆发范围越大',
        apply: () => {},
    },
];

export const available = (e, b, x) => (b.stacks[e.id] || 0) < e.max && !(e.done && e.done(b, x));

/** `n` distinct picks from what is still legal, drawn from the run's own RNG so a replay matches. */
export function roll (b, x, rng, n = CARDS) {
    const pool = LEVELS.filter((e) => available(e, b, x));
    const out = [];
    const legendaries = pool.filter((e) => e.rarity === 'legendary');
    for (const entry of legendaries) pool.splice(pool.indexOf(entry), 1);
    // Legendary items stay genuinely rare, but can still show up in any level-up choice.
    const showLegendary = legendaries.length > 0 && (pool.length < n || rng.int(0, 99) < 18);
    const legendary = showLegendary ? legendaries[rng.int(0, legendaries.length - 1)] : null;
    const ordinaryPicks = Math.max(0, n - (showLegendary ? 1 : 0));
    while (out.length < ordinaryPicks && pool.length > 0) {
        const i = rng.int(0, pool.length - 1);
        out.push(pool[i]);
        pool.splice(i, 1);
    }
    if (showLegendary) out.splice(rng.int(0, out.length), 0, legendary);
    // An eligible final-stage line always gets a visible Mega Stone choice; otherwise the ordinary
    // upgrade pool can silently crowd out the very evolution the player has unlocked.
    const formCards = x && x.chain
        ? [...megaCardsFor(x.chain, b), ...gigantamaxCardsFor(x.chain, b)] : [];
    if (formCards.length > 0 && n > 0) {
        const card = formCards[rng.int(0, formCards.length - 1)];
        if (out.length >= n) out[rng.int(0, out.length - 1)] = card;
        else out.push(card);
    }
    return out;
}

/** Apply one choice and hand back the line the toast prints. */
export function take (e, b, x) {
    const text = `${e.name} ${e.delta(b, x)}`;
    b.stacks[e.id] = (b.stacks[e.id] || 0) + 1;
    e.apply(b, x);
    return text;
}
