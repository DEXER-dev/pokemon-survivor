const flower = (values) => Object.freeze({ particleClass: 'flower', glyph: 'leaf', color: '#ef82cf', ...values });

export const MEOWSCARADA_PARTICLE_PRESETS = Object.freeze({
    'flower-launch': flower({
        duration: 0.1, emissionRate: 220, totalParticles: 30, life: 0.48, lifeVar: 0.18,
        angleVar: 76, speed: 78, speedVar: 38, startSize: 11, startSizeVar: 7,
        tangentialAccel: 20, radialAccel: -12, gravityY: 0, posVar: 6,
    }),
    'flower-hit': flower({
        duration: 0.1, emissionRate: 180, totalParticles: 22, life: 0.48, lifeVar: 0.18,
        angleVar: 76, speed: 78, speedVar: 38, startSize: 11, startSizeVar: 7,
        tangentialAccel: 20, radialAccel: -12, gravityY: 0, posVar: 6,
    }),
    'flower-bloom': flower({
        duration: 0.16, emissionRate: 460, totalParticles: 74, life: 0.68, lifeVar: 0.18,
        angleVar: 180, speed: 118, speedVar: 62, startSize: 17, startSizeVar: 7,
        tangentialAccel: 96, radialAccel: 36, gravityY: 0, posVar: 10,
    }),
    'flower-catch': flower({
        duration: 0.1, emissionRate: 280, totalParticles: 34, life: 0.48, lifeVar: 0.18,
        angleVar: 76, speed: 62, speedVar: 38, startSize: 11, startSizeVar: 7,
        tangentialAccel: -72, radialAccel: -12, gravityY: 0, posVar: 6,
    }),
});
