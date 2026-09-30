const SIGNATURES = Object.freeze({
    'legend-mewtwo': { glyph: 'star', color: '#d49af2', spin: 74, pull: 40, gravityY: 10 },
    'legend-lugia': { glyph: 'wave', color: '#72def2', spin: -54, pull: 32, gravityY: 4 },
    'legend-hooh': { glyph: 'flame', color: '#ff9c4d', spin: 86, pull: 38, gravityY: -22 },
    'legend-rayquaza': { glyph: 'dragon', color: '#78e6a6', spin: 92, pull: 44, gravityY: 14 },
    'legend-kyogre': { glyph: 'wave', color: '#4f9dff', spin: -88, pull: 58, gravityY: 0 },
    'legend-groudon': { glyph: 'boulder', color: '#ff7657', spin: 26, pull: 94, gravityY: -42 },
    'legend-dialga': { glyph: 'hex', color: '#7bdcf4', spin: 48, pull: 58, gravityY: -4 },
    'legend-palkia': { glyph: 'diamond', color: '#f28fda', spin: -70, pull: 46, gravityY: 8 },
    'legend-arceus': { glyph: 'star', color: '#fff0a2', spin: 128, pull: 72, gravityY: 20 },
});

const trail = ({ glyph, color, spin, gravityY }) => Object.freeze({
    particleClass: 'projectile-trail', glyph, color,
    duration: 0.03, emissionRate: 310, totalParticles: 8,
    life: 0.38, lifeVar: 0.1, angleVar: 26,
    speed: 44, speedVar: 22, startSize: 27, startSizeVar: 8, endSize: 2,
    tangentialAccel: spin, radialAccel: -18, gravityY, posVar: 3,
});

const burst = (style, tier) => Object.freeze({
    particleClass: 'legendary', glyph: style.glyph, color: style.color,
    duration: tier === 'entry' ? 0.14 : 0.09,
    emissionRate: tier === 'entry' ? 390 : 320,
    totalParticles: tier === 'entry' ? 34 : tier === 'attack' ? 26 : 22,
    life: tier === 'entry' ? 0.72 : 0.54,
    lifeVar: 0.16, angleVar: 180,
    speed: tier === 'entry' ? 148 : 112,
    speedVar: tier === 'entry' ? 62 : 48,
    startSize: tier === 'entry' ? 26 : 22,
    startSizeVar: 8, endSize: 2,
    tangentialAccel: style.spin,
    radialAccel: tier === 'charge' ? -style.pull : style.pull,
    gravityY: style.gravityY,
    posVar: tier === 'entry' ? 12 : 8,
});

const presets = {};
for (const [famId, style] of Object.entries(SIGNATURES)) {
    presets[`projectile-trail-${famId}`] = trail(style);
    presets[`legendary-lair-entry-${famId}`] = burst(style, 'entry');
    presets[`legendary-attack-charge-${famId}`] = burst(style, 'charge');
    presets[`legendary-attack-impact-${famId}`] = burst(style, 'attack');
    presets[`legendary-companion-impact-${famId}`] = burst(style, 'companion');
    // Normal firing branches emit these generic event names; the particle router resolves them
    // back to a legendary-specific signature while ordinary Pokémon keep their existing effects.
    presets[`legendary-shot-${famId}`] = burst(style, 'companion');
    presets[`legendary-pulse-${famId}`] = burst(style, 'attack');
    presets[`legendary-beam-${famId}`] = burst(style, 'attack');
    presets[`legendary-hit-${famId}`] = burst(style, 'companion');
}

export const LEGENDARY_PARTICLE_PRESETS = Object.freeze(presets);
