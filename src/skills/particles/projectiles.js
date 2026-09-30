const trail = (glyph, values) => Object.freeze({
    particleClass: 'projectile-trail',
    glyph,
    duration: 0.024,
    emissionRate: 290,
    totalParticles: 8,
    life: 0.36,
    lifeVar: 0.09,
    angleVar: 22,
    speed: 34,
    speedVar: 20,
    startSize: 25,
    startSizeVar: 8,
    endSize: 3,
    tangentialAccel: 0,
    radialAccel: -10,
    gravityY: 0,
    posVar: 2,
    ...values,
});

/** Small, tapered native-particle profiles keep routine shots lively without adding broad opaque blobs. */
export const PROJECTILE_PARTICLE_PRESETS = Object.freeze({
    'projectile-trail-grass': trail('leafblade', {
        color: '#caff9b', speed: 28, speedVar: 15, startSize: 29, startSizeVar: 9,
        tangentialAccel: -12, gravityY: 14,
    }),
    'projectile-trail-fire': trail('ember', {
        color: '#ffe09a', speed: 39, speedVar: 22, startSize: 26, startSizeVar: 9,
        tangentialAccel: 18, gravityY: 24,
    }),
    'projectile-trail-water': trail('wave', {
        color: '#c5f5ff', speed: 34, speedVar: 18, startSize: 30, startSizeVar: 9,
        tangentialAccel: -8,
    }),
    'projectile-trail-bolt': trail('spark', {
        color: '#fff7bb', speed: 48, speedVar: 26, startSize: 27, startSizeVar: 9,
        tangentialAccel: 12,
    }),
    'projectile-trail-crystal': trail('shard', {
        color: '#eddcff', speed: 35, speedVar: 19, startSize: 28, startSizeVar: 9,
        spinStartVar: 180, spinEnd: 240, spinEndVar: 120,
    }),
    'projectile-trail-support': trail('star', {
        color: '#fff7d5', speed: 29, speedVar: 16, startSize: 25, startSizeVar: 8,
        spinStartVar: 180, spinEnd: 220, spinEndVar: 100,
    }),

    // Signature attacks get their own particle silhouette, palette, and motion; these are
    // sampled by family ID so even a dedicated sprite renderer keeps a matching moving trail.
    'projectile-trail-mush': trail('leafblade', {
        color: '#d7ff89', speed: 31, tangentialAccel: -28, gravityY: 12,
        spinStartVar: 80, spinEnd: 180,
    }),
    'projectile-trail-sprigatito': trail('heart', {
        color: '#ffb4eb', speed: 40, speedVar: 22, startSize: 23,
        tangentialAccel: 72, radialAccel: -18, spinStartVar: 180, spinEnd: 300,
    }),
    'projectile-trail-froakie': trail('shard', {
        color: '#b8f5ff', speed: 46, speedVar: 24, startSize: 25,
        angleVar: 10, tangentialAccel: 58, spinStartVar: 180, spinEnd: 540,
    }),
    'projectile-trail-tandemaus': trail('star', {
        color: '#fff0d3', speed: 22, startSize: 20, gravityY: -24,
        angleVar: 34, tangentialAccel: 14, spinEnd: 280,
    }),
    'projectile-trail-lucario': trail('spark', {
        color: '#85dfff', speed: 42, startSize: 25, angleVar: 14,
        tangentialAccel: 44, radialAccel: -24,
    }),
    'projectile-trail-honedge': trail('crescent', {
        color: '#c1a5ff', speed: 34, startSize: 26, angleVar: 8,
        tangentialAccel: 65, radialAccel: -16, spinStartVar: 180, spinEnd: 420,
    }),
    'projectile-trail-machop': trail('claw', {
        color: '#ffb06d', speed: 52, speedVar: 26, startSize: 27,
        angleVar: 12, gravityY: -10, radialAccel: 18,
    }),
    'projectile-trail-togepi': trail('star', {
        color: '#fff6ad', speed: 30, startSize: 25, angleVar: 52,
        tangentialAccel: 38, spinStartVar: 180, spinEnd: 360,
    }),
    'projectile-trail-buizel': trail('wave', {
        color: '#86e6ff', speed: 38, startSize: 28, angleVar: 12,
        tangentialAccel: -24, radialAccel: -22,
    }),
    'projectile-trail-munchlax': trail('crescent', {
        color: '#c5b8ff', speed: 21, startSize: 28, angleVar: 66,
        tangentialAccel: 26, radialAccel: -12, spinEnd: 260,
    }),
    'projectile-trail-shinx': trail('bolt', {
        color: '#fff17b', speed: 58, speedVar: 30, startSize: 25,
        angleVar: 8, tangentialAccel: 0, radialAccel: 28,
    }),
    'projectile-trail-zorua': trail('shadow', {
        glyph: 'crescent', color: '#f0a7ff', duration: 0.05, emissionRate: 360,
        totalParticles: 8, life: 0.42, lifeVar: 0.07, speed: 46, speedVar: 24,
        startSize: 35, startSizeVar: 9, endSize: 2, angleVar: 82,
        tangentialAccel: -82, radialAccel: -12, gravityY: 5, posVar: 4,
        spinStartVar: 180, spinEnd: 430, spinEndVar: 100,
    }),
    'projectile-trail-toxtricity': trail('bolt', {
        color: '#aaffed', speed: 47, startSize: 25, angleVar: 20,
        tangentialAccel: 82, radialAccel: -16, spinStartVar: 180, spinEnd: 500,
    }),
    'projectile-trail-shroomish': trail('spark', {
        color: '#f6a7e5', speed: 26, startSize: 27, angleVar: 74,
        tangentialAccel: 34, radialAccel: -10, gravityY: 8,
    }),
    'projectile-trail-hatenna': trail('crescent', {
        color: '#ffb2d7', speed: 35, startSize: 26, angleVar: 28,
        tangentialAccel: -54, radialAccel: -22, spinStartVar: 180, spinEnd: 380,
    }),
    'projectile-trail-impidimp': trail('claw', {
        color: '#e58aff', speed: 44, startSize: 27, angleVar: 18,
        tangentialAccel: 62, radialAccel: 12, spinStartVar: 180, spinEnd: -300,
    }),
    'projectile-trail-archen': trail('feather', {
        color: '#ffc879', speed: 36, startSize: 29, angleVar: 26,
        tangentialAccel: -18, gravityY: 18, spinStartVar: 140, spinEnd: 160,
    }),
    'projectile-trail-smoliv': trail('leaf', {
        color: '#caff87', speed: 24, startSize: 27, angleVar: 36,
        tangentialAccel: -38, gravityY: 22, spinStartVar: 180, spinEnd: 260,
    }),
    'projectile-trail-tadbulb': trail('ring', {
        color: '#fff197', speed: 32, startSize: 26, angleVar: 24,
        tangentialAccel: 28, radialAccel: -22, spinStartVar: 180, spinEnd: 360,
    }),
    'projectile-trail-wattrel': trail('feather', {
        color: '#9ceeff', speed: 50, startSize: 25, angleVar: 10,
        tangentialAccel: 8, gravityY: 18, spinStartVar: 160, spinEnd: 300,
    }),
    'projectile-trail-porygon': trail('hex', {
        color: '#ff8ed5', speed: 33, startSize: 27, angleVar: 20,
        tangentialAccel: 56, radialAccel: -26, spinStartVar: 180, spinEnd: 420,
    }),
});

/** Compact hostile-shot trails stay readable but leave room in the shared pool for allied attacks. */
const trainerTrail = (glyph, color) => trail(glyph, {
    particleClass: 'hostile-projectile-trail', color, duration: 0.018, emissionRate: 280,
    totalParticles: 5, life: 0.2, lifeVar: 0.04, speed: 43, speedVar: 20,
    startSize: 19, startSizeVar: 5, endSize: 1, angleVar: 20, posVar: 2,
});

export const TRAINER_PROJECTILE_PARTICLE_PRESETS = Object.freeze({
    'trainer-projectile-trail-grass': trainerTrail('leafblade', '#bdff8d'),
    'trainer-projectile-trail-fire': trainerTrail('ember', '#ff9871'),
    'trainer-projectile-trail-water': trainerTrail('wave', '#8de9ff'),
    'trainer-projectile-trail-bolt': trainerTrail('spark', '#fff28c'),
    'trainer-projectile-trail-crystal': trainerTrail('shard', '#d8c4ff'),
    'trainer-projectile-trail-support': trainerTrail('star', '#ffe5c6'),
});

/** Fine glyph streams ride inside the shared beam core drawn from the live collision corridor. */
const beamTrail = (glyph, color) => trail(glyph, {
    particleClass: 'beam-trail', color, duration: 0.024, emissionRate: 320,
    totalParticles: 6, life: 0.25, lifeVar: 0.05, speed: 27, speedVar: 14,
    startSize: 24, startSizeVar: 6, endSize: 3, angleVar: 18, posVar: 4,
    tangentialAccel: 10,
});

export const BEAM_PARTICLE_PRESETS = Object.freeze({
    'beam-trail-grass': beamTrail('leafblade', '#d3ff9b'),
    'beam-trail-fire': beamTrail('ember', '#ffd092'),
    'beam-trail-water': beamTrail('wave', '#a9f0ff'),
    'beam-trail-bolt': beamTrail('spark', '#fff4a8'),
    'beam-trail-crystal': beamTrail('shard', '#e1caff'),
    'beam-trail-support': beamTrail('star', '#fff0d1'),
});

const orbitTrail = (glyph, color) => Object.freeze({
    ...beamTrail(glyph, color), particleClass: 'orbit-trail', tangentialAccel: 36,
});
export const ORBIT_PARTICLE_PRESETS = Object.freeze({
    'orbit-trail-grass': orbitTrail('leaf', '#caff9b'),
    'orbit-trail-fire': orbitTrail('ember', '#ffd092'),
    'orbit-trail-water': orbitTrail('wave', '#a9f0ff'),
    'orbit-trail-bolt': orbitTrail('spark', '#fff4a8'),
    'orbit-trail-crystal': orbitTrail('shard', '#e1caff'),
    'orbit-trail-support': orbitTrail('star', '#fff0d1'),
});

/** Ambient flecks make persistent ground fields feel alive without obscuring their boundary. */
const fieldTrail = (glyph, color) => Object.freeze({
    ...beamTrail(glyph, color), particleClass: 'field-trail', duration: 0.018,
    emissionRate: 190, totalParticles: 5, life: 0.32, lifeVar: 0.06,
    speed: 20, speedVar: 12, startSize: 19, startSizeVar: 6, endSize: 2,
    angleVar: 74, tangentialAccel: 26, radialAccel: -18, posVar: 3,
});
export const FIELD_PARTICLE_PRESETS = Object.freeze({
    'field-trail-grass': fieldTrail('leaf', '#caff9b'),
    'field-trail-fire': fieldTrail('ember', '#ffd092'),
    'field-trail-water': fieldTrail('wave', '#a9f0ff'),
    'field-trail-bolt': fieldTrail('spark', '#fff4a8'),
    'field-trail-crystal': fieldTrail('shard', '#e1caff'),
    'field-trail-support': fieldTrail('star', '#fff0d1'),
});
