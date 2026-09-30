const giantPulse = (glyph, values) => Object.freeze({
    particleClass: 'gigantamax',
    glyph,
    ...values,
});

const aura = (glyph, color, values = {}) => giantPulse(glyph, {
    color, duration: 0.035, emissionRate: 180, totalParticles: 7,
    life: 0.46, lifeVar: 0.12, angleVar: 54,
    speed: 36, speedVar: 20, startSize: 20, startSizeVar: 7, endSize: 2,
    tangentialAccel: 20, radialAccel: -8, gravityY: 12, posVar: 4,
    ...values,
});

const signature = (glyph, color, values = {}) => giantPulse(glyph, {
    duration: 0.07, emissionRate: 260, totalParticles: 18,
    life: 0.56, lifeVar: 0.14, angleVar: 76,
    speed: 86, speedVar: 38, startSize: 29, startSizeVar: 10, endSize: 3,
    tangentialAccel: 30, radialAccel: 8, gravityY: 4, posVar: 8,
    ...values,
});

/** Layered native ParticleSystem2D profiles for the signature Gigantamax skill burst. */
export const GIGANTAMAX_PARTICLE_PRESETS = Object.freeze({
    // Broad, low dust sheet on the ground impact, with a few heavier chunks for depth.
    'gmax-entry-dust': giantPulse('dust', {
        color: '#ad8962', duration: 0.07, emissionRate: 280, totalParticles: 24,
        life: 0.62, lifeVar: 0.16, angleVar: 112,
        speed: 96, speedVar: 48, startSize: 26, startSizeVar: 10, endSize: 5,
        tangentialAccel: 14, radialAccel: 5, gravityY: -24, posVar: 12,
    }),
    'gmax-entry-clods': giantPulse('boulder', {
        color: '#73543b', duration: 0.045, emissionRate: 220, totalParticles: 10,
        life: 0.72, lifeVar: 0.18, angleVar: 156,
        speed: 168, speedVar: 72, startSize: 15, startSizeVar: 6, endSize: 3,
        spinStartVar: 180, spinEnd: 300, spinEndVar: 180,
        tangentialAccel: 8, radialAccel: 4, gravityY: -92, posVar: 9,
    }),
    // A broad flame-shaped core, not another cloud of round dots.
    'gigantamax-core': giantPulse('flame', {
        duration: 0.12, emissionRate: 220, totalParticles: 28,
        life: 0.58, lifeVar: 0.16, angleVar: 180,
        speed: 112, speedVar: 46, startSize: 34, startSizeVar: 12,
        tangentialAccel: 32, radialAccel: 18, gravityY: 12, posVar: 8,
    }),
    // Long, rotating crystal fragments give the attack a sharp, readable silhouette.
    'gigantamax-shards': giantPulse('shard', {
        duration: 0.1, emissionRate: 180, totalParticles: 24,
        life: 0.72, lifeVar: 0.18, angleVar: 180,
        speed: 158, speedVar: 64, startSize: 23, startSizeVar: 9,
        spinStart: 0, spinStartVar: 180, spinEnd: 540, spinEndVar: 240,
        tangentialAccel: 24, radialAccel: 8, gravityY: -26, posVar: 5,
    }),
    // Tiny bright sparks punctuate the silhouette; deliberately sparse for mobile readability.
    'gigantamax-sparks': giantPulse('spark', {
        duration: 0.08, emissionRate: 150, totalParticles: 18,
        life: 0.38, lifeVar: 0.1, angleVar: 180,
        speed: 210, speedVar: 75, startSize: 16, startSizeVar: 6,
        tangentialAccel: 0, radialAccel: 0, gravityY: 8, posVar: 10,
    }),
    // Persistent Rillaboom turf: larger rotating leaves plus a separate warm spore layer.
    'rillaboom-grove-leaf': giantPulse('leafblade', {
        color: '#baff78', duration: 0.08, emissionRate: 50, totalParticles: 4,
        life: 0.88, lifeVar: 0.18, angleVar: 68,
        speed: 25, speedVar: 12, startSize: 27, startSizeVar: 8, endSize: 9,
        spinStart: 0, spinStartVar: 180, spinEnd: 420, spinEndVar: 180,
        tangentialAccel: 24, radialAccel: -4, gravityY: 12, posVar: 8,
    }),
    'rillaboom-grove-spore': giantPulse('spark', {
        color: '#f5ffc1', duration: 0.07, emissionRate: 44, totalParticles: 3,
        life: 0.74, lifeVar: 0.16, angleVar: 42,
        speed: 17, speedVar: 9, startSize: 13, startSizeVar: 5, endSize: 2,
        spinStart: 0, spinStartVar: 180, spinEnd: 180, spinEndVar: 120,
        tangentialAccel: 10, radialAccel: 0, gravityY: 6, posVar: 5,
    }),
    // Meowth's gilded coins tumble around the giant before drifting outward like a jackpot shower.
    'gmax-meowth-coins': giantPulse('coin', {
        color: '#ffd85a', duration: 0.1, emissionRate: 38, totalParticles: 5,
        life: 1.02, lifeVar: 0.22, angleVar: 74,
        speed: 27, speedVar: 12, startSize: 25, startSizeVar: 7, endSize: 8,
        spinStart: 0, spinStartVar: 180, spinEnd: 720, spinEndVar: 240,
        tangentialAccel: 66, radialAccel: -16, gravityY: 5, posVar: 4,
    }),
    'gmax-meowth-glints': giantPulse('star', {
        color: '#fff4b0', duration: 0.07, emissionRate: 32, totalParticles: 3,
        life: 0.54, lifeVar: 0.12, angleVar: 180,
        speed: 58, speedVar: 22, startSize: 12, startSizeVar: 4, endSize: 2,
        spinStart: 0, spinStartVar: 180, spinEnd: 240, spinEndVar: 120,
        tangentialAccel: 18, radialAccel: 0, gravityY: 4, posVar: 6,
    }),
    // Continuous form auras: moving, shaped motes replace the static filled rings around each giant.
    'gmax-aura-pikachu': aura('bolt', '#fff08a', {
        speed: 48, speedVar: 28, angleVar: 34, tangentialAccel: 44, gravityY: 18,
    }),
    'gmax-aura-meowth': aura('coin', '#ffe08a', {
        speed: 24, angleVar: 82, tangentialAccel: 62, gravityY: 12,
        spinStartVar: 180, spinEnd: 420, spinEndVar: 180,
    }),
    'gmax-aura-corviknight': aura('feather', '#b7d8ff', {
        speed: 30, speedVar: 17, angleVar: 42, tangentialAccel: -18, gravityY: 26,
        spinStartVar: 150, spinEnd: 220,
    }),
    'gmax-aura-rillaboom': aura('leafblade', '#caff98', {
        speed: 28, speedVar: 15, angleVar: 62, tangentialAccel: 32, gravityY: 22,
        spinStartVar: 180, spinEnd: 300,
    }),
    'gmax-aura-cinderace': aura('ember', '#ffd080', {
        speed: 46, speedVar: 25, angleVar: 50, tangentialAccel: 18, gravityY: 30,
    }),
    'gmax-aura-inteleon': aura('wave', '#a9f0ff', {
        speed: 36, speedVar: 19, angleVar: 36, tangentialAccel: -24, gravityY: -3,
    }),
    'gmax-aura-alcremie': aura('heart', '#ffd8ed', {
        speed: 24, speedVar: 15, angleVar: 54, tangentialAccel: 24, gravityY: 12,
    }),
    // Active skill streams retain each form's signature silhouette after the initial impact burst.
    'gmax-skill-pikachu': signature('bolt', '#fff3a1', {
        speed: 118, speedVar: 52, angleVar: 100, tangentialAccel: 26, radialAccel: 24,
    }),
    'gmax-skill-meowth': signature('coin', '#ffe17a', {
        speed: 60, speedVar: 28, angleVar: 120, tangentialAccel: 74,
        spinStartVar: 180, spinEnd: 560, spinEndVar: 180,
    }),
    'gmax-skill-corviknight': signature('feather', '#c5dcff', {
        speed: 94, speedVar: 44, angleVar: 130, tangentialAccel: -34, gravityY: 32,
        spinStartVar: 180, spinEnd: 260,
    }),
    'gmax-skill-rillaboom': signature('leafblade', '#d5ff9c', {
        speed: 72, speedVar: 36, angleVar: 160, tangentialAccel: 64, gravityY: 18,
        spinStartVar: 180, spinEnd: 480,
    }),
    'gmax-skill-cinderace': signature('flame', '#ffe0a0', {
        speed: 125, speedVar: 54, angleVar: 48, tangentialAccel: 22, gravityY: 36,
    }),
    'gmax-skill-inteleon': signature('shard', '#b2f5ff', {
        speed: 128, speedVar: 58, angleVar: 40, tangentialAccel: -38,
        spinStartVar: 180, spinEnd: 540,
    }),
    'gmax-skill-alcremie': signature('heart', '#ffe5f4', {
        speed: 55, speedVar: 26, angleVar: 180, tangentialAccel: 22, gravityY: 18,
        spinStartVar: 160, spinEnd: 320,
    }),
});
