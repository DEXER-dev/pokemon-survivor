const STYLES = Object.freeze({
    'wildboss-articuno': { glyph: 'shard', color: '#9beaff', spin: -22 },
    'wildboss-zapdos': { glyph: 'spark', color: '#ffe47a', spin: 34 },
    'wildboss-moltres': { glyph: 'flame', color: '#ff9b55', spin: 26 },
    'wildboss-raikou': { glyph: 'spark', color: '#ffd05c', spin: -38 },
    'wildboss-entei': { glyph: 'flame', color: '#ff8755', spin: 18 },
    'wildboss-suicune': { glyph: 'wave', color: '#78d9ed', spin: -28 },
});

const trail = (style) => Object.freeze({
    particleClass: 'projectile-trail', glyph: style.glyph, color: style.color,
    duration: 0.022, emissionRate: 190, totalParticles: 5,
    life: 0.25, lifeVar: 0.06, angleVar: 22,
    speed: 24, speedVar: 12, startSize: 13, startSizeVar: 3, endSize: 1,
    tangentialAccel: style.spin, radialAccel: -10, gravityY: 0, posVar: 1.5,
});

const impact = (style) => Object.freeze({
    particleClass: 'legendary', glyph: style.glyph, color: style.color,
    duration: 0.06, emissionRate: 170, totalParticles: 13,
    life: 0.32, lifeVar: 0.07, angleVar: 180,
    speed: 67, speedVar: 27, startSize: 15, startSizeVar: 4, endSize: 1,
    tangentialAccel: style.spin, radialAccel: 18, gravityY: 0, posVar: 3,
});

const presets = {};
for (const [fam, style] of Object.entries(STYLES)) {
    presets[`projectile-trail-${fam}`] = trail(style);
    presets[`legendary-companion-impact-${fam}`] = impact(style);
}

export const SUB_LEGENDARY_PARTICLE_PRESETS = Object.freeze(presets);
