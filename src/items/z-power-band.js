import { SPECIES } from '../species.js';

/** All 18 elemental Z-Crystals. Party affinity reads the Pokémon's actual stage type. */
export const Z_CRYSTALS = Object.freeze([
    { id: 'fire', type: 'FIRE', short: '火Z', move: '大爆炸烈焰', glyph: 'flame', color: '#ff7047', effect: 'fire' },
    { id: 'water', type: 'WATER', short: '水Z', move: '超强极限水流击', glyph: 'wave', color: '#55c9f2', effect: 'water' },
    { id: 'grass', type: 'GRASS', short: '草Z', move: '绚烂缤纷花怒放', glyph: 'leafblade', color: '#78d66b', effect: 'nature' },
    { id: 'electric', type: 'ELECTRIC', short: '电Z', move: '终极伏特狂雷闪', glyph: 'bolt', color: '#ffe36b', effect: 'electric' },
    { id: 'fighting', type: 'FIGHTING', short: '斗Z', move: '全力无双激烈拳', glyph: 'claw', color: '#ff9a57', effect: 'mega' },
    { id: 'psychic', type: 'PSYCHIC', short: '超能Z', move: '至高精神破坏波', glyph: 'star', color: '#e68bff', effect: 'psychic' },
    { id: 'normal', type: 'NORMAL', short: '普Z', move: '究极无敌大冲撞', glyph: 'star', color: '#e8d4a1', effect: 'normal' },
    { id: 'bug', type: 'BUG', short: '虫Z', move: '绝对捕食回旋斩', glyph: 'needle', color: '#a9c83f', effect: 'bug' },
    { id: 'dark', type: 'DARK', short: '恶Z', move: '黑洞吞噬万物灭', glyph: 'shadow', color: '#75618e', effect: 'dark' },
    { id: 'dragon', type: 'DRAGON', short: '龙Z', move: '究极巨龙震天地', glyph: 'dragon', color: '#7468e8', effect: 'dragon' },
    { id: 'fairy', type: 'FAIRY', short: '妖精Z', move: '可爱星星飞天撞', glyph: 'heart', color: '#f48fcd', effect: 'fairy' },
    { id: 'flying', type: 'FLYING', short: '飞行Z', move: '极速俯冲轰烈撞', glyph: 'feather', color: '#86baf3', effect: 'wind' },
    { id: 'ghost', type: 'GHOST', short: '幽灵Z', move: '无尽暗夜之诱惑', glyph: 'crescent', color: '#8f72c8', effect: 'shadow' },
    { id: 'ground', type: 'GROUND', short: '地面Z', move: '地隆啸天大终结', glyph: 'boulder', color: '#d2a15f', effect: 'ground' },
    { id: 'ice', type: 'ICE', short: '冰Z', move: '激狂大地万里冰', glyph: 'shard', color: '#83e8ed', effect: 'ice' },
    { id: 'poison', type: 'POISON', short: '毒Z', move: '强酸剧毒灭绝雨', glyph: 'fang', color: '#c878dd', effect: 'poison' },
    { id: 'rock', type: 'ROCK', short: '岩石Z', move: '毁天灭地巨岩坠', glyph: 'boulder', color: '#d59b67', effect: 'rock' },
    { id: 'steel', type: 'STEEL', short: '钢Z', move: '超绝螺旋连击', glyph: 'cannon', color: '#a9c6d9', effect: 'steel' },
]);

export const Z_POWER_BAND = Object.freeze({
    id: 'zPowerBand',
    cooldown: 24,
    speed: 760,
    minRange: 84,
    maxRange: 640,
    radiusBase: 56,
    radiusPerSqrt: 17,
    radiusMax: 240,
    projectileBase: 16,
    projectilePerSqrt: 2.6,
    projectileScaleMax: 3.4,
    damageSeconds: 1.5,
    burstDuration: 0.85,
});

/** Count individuals, including stacks; a dual-type Pokémon contributes once to each matching Z type. */
export function zAffinityCount (segments, type) {
    let count = 0;
    for (const seg of segments || []) {
        const species = SPECIES[seg.fam];
        if (!species || !Number.isFinite(seg.count) || seg.count <= 0) continue;
        const types = species.ty[Math.min(Math.max(0, (seg.tier | 0) - 1), species.ty.length - 1)] || [];
        if (types.includes(type)) count += Math.floor(seg.count);
    }
    return count;
}

/** Diminishing-return size curve: readable growth without letting a huge stack cover the whole screen. */
export function zMoveMetrics (count) {
    const affinity = Math.max(0, Math.floor(Number(count) || 0));
    if (!affinity) return { count: 0, radius: 0, projectileRadius: 0, projectileScale: 1 };
    const root = Math.sqrt(affinity);
    return {
        count: affinity,
        radius: Math.min(Z_POWER_BAND.radiusMax, Z_POWER_BAND.radiusBase + Z_POWER_BAND.radiusPerSqrt * root),
        projectileRadius: Math.min(58, Z_POWER_BAND.projectileBase + Z_POWER_BAND.projectilePerSqrt * root),
        projectileScale: Math.min(Z_POWER_BAND.projectileScaleMax, 1 + 0.22 * root),
    };
}
