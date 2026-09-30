const pollen = (glyph, values) => Object.freeze({
    particleClass: 'projectile-trail',
    glyph,
    ...values,
});

/** Warm nectar motes and fairy pollen give Cutiefly a soft, visible trail. */
export const CUTIEFLY_PARTICLE_PRESETS = Object.freeze({
    'projectile-trail-cutiefly': pollen('heart', {
        color: '#ffd68a', duration: 0.028, emissionRate: 280, totalParticles: 8,
        life: 0.38, lifeVar: 0.11, angleVar: 38,
        speed: 31, speedVar: 18, startSize: 22, startSizeVar: 8, endSize: 2,
        spinStartVar: 160, spinEnd: 280, spinEndVar: 120,
        tangentialAccel: 32, radialAccel: -18, gravityY: 4, posVar: 3,
    }),
    'cutiefly-honey-pulse': pollen('star', {
        color: '#fff0a8', duration: 0.1, emissionRate: 230, totalParticles: 28,
        life: 0.7, lifeVar: 0.2, angleVar: 180,
        speed: 78, speedVar: 34, startSize: 18, startSizeVar: 7, endSize: 3,
        spinStartVar: 180, spinEnd: 360, spinEndVar: 120,
        tangentialAccel: 38, radialAccel: -22, gravityY: -7, posVar: 12,
    }),
    'cutiefly-flower-burst': pollen('heart', {
        color: '#f4b7dc', duration: 0.07, emissionRate: 250, totalParticles: 22,
        life: 0.56, lifeVar: 0.18, angleVar: 180,
        speed: 112, speedVar: 46, startSize: 17, startSizeVar: 6, endSize: 2,
        spinStartVar: 240, spinEnd: 420, spinEndVar: 160,
        tangentialAccel: -28, radialAccel: 20, gravityY: -9, posVar: 8,
    }),
});
