const FAMILY_FIELD_EFFECTS = Object.freeze({
    moth: Object.freeze({ marks: 4, glyph: 'flame', size: 0.24, direction: 0.7, ring: 'field' }),
    drop: Object.freeze({ marks: 5, glyph: 'dot', size: 0.24, direction: -0.3, ring: 'ring' }),
    mayfly: Object.freeze({ marks: 4, glyph: 'shard', size: 0.34, direction: 0.7, ring: 'field' }),
    mush: Object.freeze({ orbitCore: 'blob' }),
    // 火之舞：火神蛾的灼热领域反旋，余烬标记区别于火神蛾本体领域的同向火舌。
    larvesta: Object.freeze({ marks: 5, glyph: 'ember', size: 0.27, direction: -0.62, ring: 'field' }),
});

export function fieldEffectForFamily (family) {
    return FAMILY_FIELD_EFFECTS[family] || null;
}

export function orbitCoreGlyphForFamily (family) {
    return FAMILY_FIELD_EFFECTS[family]?.orbitCore || 'star';
}

/* 龙息光束：origin 端叠加一枚龙首，光束本体仍走通用的双层软鞘+亮芯。 */
const FAMILY_BEAM_EFFECTS = Object.freeze({
    dratini: Object.freeze({ head: 'dragon' }),
});

export function beamEffectForFamily (family) {
    return FAMILY_BEAM_EFFECTS[family] || null;
}

/* 仆刀突袭：突进帧沿冲刺方向画一道横斩楔面，落点再由 pulse 粒子收尾。 */
const FAMILY_SLASH_EFFECTS = Object.freeze({
    pawniard: Object.freeze({ glyph: 'claw', arc: 'crescent' }),
});

export function slashEffectForFamily (family) {
    return FAMILY_SLASH_EFFECTS[family] || null;
}
