const pollen = (glyph, values) => Object.freeze({
    particleClass: 'projectile-trail',
    glyph,
    ...values,
});

/** Vivillon's signature trail is readable butterfly dust, not a flat pastel ring. */
export const VIVILLON_PARTICLE_PRESETS = Object.freeze({
    'projectile-trail-vivillon': pollen('leafblade', {
        color: '#f3b6df', duration: 0.03, emissionRate: 300, totalParticles: 9,
        life: 0.42, lifeVar: 0.12, angleVar: 52,
        speed: 34, speedVar: 21, startSize: 23, startSizeVar: 9, endSize: 2,
        spinStartVar: 180, spinEnd: 360, spinEndVar: 160,
        tangentialAccel: 54, radialAccel: -20, gravityY: 7, posVar: 3,
    }),
    'vivillon-powder-cloud': pollen('dust', {
        color: '#f2b8df', duration: 0.12, emissionRate: 280, totalParticles: 34,
        life: 0.82, lifeVar: 0.22, angleVar: 180,
        speed: 55, speedVar: 28, startSize: 24, startSizeVar: 10, endSize: 5,
        tangentialAccel: 46, radialAccel: -20, gravityY: -4, posVar: 18,
    }),
    'vivillon-wing-burst': pollen('feather', {
        color: '#d5c0ff', duration: 0.07, emissionRate: 220, totalParticles: 20,
        life: 0.58, lifeVar: 0.18, angleVar: 180,
        speed: 124, speedVar: 48, startSize: 20, startSizeVar: 7, endSize: 3,
        spinStartVar: 240, spinEnd: 420, spinEndVar: 180,
        tangentialAccel: -22, radialAccel: 16, gravityY: -12, posVar: 8,
    }),
});
