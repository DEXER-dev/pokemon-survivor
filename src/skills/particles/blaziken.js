/** A bright, backward-flying ember wake for Mega Blaziken's sustained charge. */
export const BLAZIKEN_PARTICLE_PRESETS = Object.freeze({
    'blaziken-charge-trail': Object.freeze({
        particleClass: 'signature-area', glyph: 'ember', color: '#ff7047',
        duration: 0.018, emissionRate: 420, totalParticles: 8,
        life: 0.48, lifeVar: 0.08, angleVar: 22,
        speed: 42, speedVar: 18, startSize: 30, startSizeVar: 8, endSize: 1,
        spinStartVar: 190, spinEnd: 240, spinEndVar: 120,
        tangentialAccel: 24, radialAccel: -10, gravityY: 18, posVar: 3,
    }),
});
