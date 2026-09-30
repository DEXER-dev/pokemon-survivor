const waterShuriken = (values) => Object.freeze({
    particleClass: 'shuriken', glyph: 'shard', color: '#65e8f2',
    ...values,
});

/** Native Cocos ParticleSystem2D presets for Greninja's blade wake and water impact. */
export const GRENINJA_PARTICLE_PRESETS = Object.freeze({
    'shuriken-launch': waterShuriken({
        duration: 0.045, emissionRate: 300, totalParticles: 18, life: 0.28, lifeVar: 0.08,
        angleVar: 34, speed: 58, speedVar: 24, startSize: 10, startSizeVar: 4,
        tangentialAccel: 18, radialAccel: -8, gravityY: 0, posVar: 3,
    }),
    'shuriken-hit': waterShuriken({
        duration: 0.07, emissionRate: 420, totalParticles: 26, life: 0.34, lifeVar: 0.1,
        angleVar: 155, speed: 94, speedVar: 38, startSize: 13, startSizeVar: 5,
        tangentialAccel: 22, radialAccel: 18, gravityY: 0, posVar: 5,
    }),
    'shuriken-splash': waterShuriken({
        duration: 0.12, emissionRate: 540, totalParticles: 48, life: 0.42, lifeVar: 0.14,
        angleVar: 180, speed: 112, speedVar: 48, startSize: 15, startSizeVar: 6,
        tangentialAccel: -34, radialAccel: 28, gravityY: -4, posVar: 7,
    }),
});
