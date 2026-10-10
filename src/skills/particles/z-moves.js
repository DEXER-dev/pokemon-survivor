const PRESETS = {
    fire: { color: '#ff7047', glyph: 'ember', spin: 28, pull: 0, gravityY: -12 },
    water: { color: '#55c9f2', glyph: 'wave', spin: -22, pull: 18, gravityY: 0 },
    grass: { color: '#78d66b', glyph: 'leafblade', spin: 86, pull: -12, gravityY: 0 },
    electric: { color: '#ffe36b', glyph: 'bolt', spin: 14, pull: 32, gravityY: 0 },
    fighting: { color: '#ff9a57', glyph: 'claw', spin: 0, pull: 58, gravityY: -6 },
    psychic: { color: '#e68bff', glyph: 'star', spin: -72, pull: 10, gravityY: 0 },
    normal: { color: '#e8d4a1', glyph: 'star', spin: 0, pull: 0, gravityY: -10 },
    bug: { color: '#a9c83f', glyph: 'needle', spin: 64, pull: -18, gravityY: -8 },
    dark: { color: '#75618e', glyph: 'shadow', spin: -46, pull: 30, gravityY: 8 },
    dragon: { color: '#7468e8', glyph: 'dragon', spin: 20, pull: 52, gravityY: -18 },
    fairy: { color: '#f48fcd', glyph: 'heart', spin: 88, pull: -20, gravityY: 10 },
    flying: { color: '#86baf3', glyph: 'feather', spin: -26, pull: -12, gravityY: 22 },
    ghost: { color: '#8f72c8', glyph: 'crescent', spin: -84, pull: -28, gravityY: 12 },
    ground: { color: '#d2a15f', glyph: 'boulder', spin: 8, pull: 74, gravityY: -38 },
    ice: { color: '#83e8ed', glyph: 'shard', spin: -38, pull: 34, gravityY: -4 },
    poison: { color: '#c878dd', glyph: 'fang', spin: 55, pull: -32, gravityY: 6 },
    rock: { color: '#d59b67', glyph: 'boulder', spin: 4, pull: 86, gravityY: -48 },
    steel: { color: '#a9c6d9', glyph: 'cannon', spin: 12, pull: 66, gravityY: -2 },
};

const makePreset = (theme, impact) => Object.freeze({
    color: theme.color,
    glyph: theme.glyph,
    duration: impact ? 0.08 : 0.04,
    emissionRate: impact ? 300 : 200,
    totalParticles: impact ? 24 : 10,
    life: impact ? 0.5 : 0.26,
    lifeVar: impact ? 0.07 : 0.035,
    angleVar: impact ? 180 : 30,
    speed: impact ? 160 : 55,
    speedVar: impact ? 28 : 8,
    startSize: impact ? 22 : 15,
    startSizeVar: impact ? 4 : 2,
    tangentialAccel: theme.spin,
    radialAccel: impact ? theme.pull : -8,
    gravityY: theme.gravityY,
    posVar: impact ? 11 : 4,
});

const makeTrail = (theme) => Object.freeze({
    particleClass: 'z-trail', glyph: theme.glyph, color: theme.color,
    duration: 0.025, emissionRate: 120, totalParticles: 3,
    life: 0.28, lifeVar: 0.045, angleVar: 24,
    speed: 30, speedVar: 10, startSize: 14, startSizeVar: 4, endSize: 2,
    tangentialAccel: theme.spin * 0.45, radialAccel: -8, gravityY: theme.gravityY * 0.35, posVar: 2,
});

export const Z_MOVE_PARTICLE_PRESETS = Object.freeze(Object.fromEntries(
    Object.entries(PRESETS).flatMap(([id, theme]) => [
        [`z-${id}-launch`, makePreset(theme, false)],
        [`z-${id}-trail`, makeTrail(theme)],
        [`z-${id}-impact`, makePreset(theme, true)],
    ]),
));
