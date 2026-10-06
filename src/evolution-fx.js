export const EVOLUTION_FX_DURATION = 1.36;
export const EVOLUTION_MORPH_AT = 0.43;
export const EVOLUTION_LANDING_AT = 0.88;

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const easeOut = (value) => 1 - Math.pow(1 - clamp01(value), 3);
const easeInOut = (value) => {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
};

export function createEvolutionFx (oldIcon, fromTier = 1) {
    return {
        elapsed: 0,
        oldIcon: oldIcon || null,
        fromTier,
        morphPlayed: false,
        landingPlayed: false,
    };
}

/** Advance on the renderer clock so boss-reward evolution keeps playing after the choice modal closes. */
export function stepEvolutionFx (fx, dt) {
    if (!fx) return { cues: [], done: true };
    const previous = fx.elapsed;
    fx.elapsed = Math.min(EVOLUTION_FX_DURATION, previous + Math.max(0, dt));
    const cues = [];
    const morphTime = EVOLUTION_FX_DURATION * EVOLUTION_MORPH_AT;
    const landingTime = EVOLUTION_FX_DURATION * EVOLUTION_LANDING_AT;
    if (!fx.morphPlayed && previous < morphTime && fx.elapsed >= morphTime) {
        fx.morphPlayed = true;
        cues.push('morph');
    }
    if (!fx.landingPlayed && previous < landingTime && fx.elapsed >= landingTime) {
        fx.landingPlayed = true;
        cues.push('landing');
    }
    return { cues, done: fx.elapsed >= EVOLUTION_FX_DURATION };
}

/** Sprite-only animation values: no collision seat, hitbox, or chain-node positions are changed. */
export function evolutionVisual (fx) {
    if (!fx) return null;
    const progress = clamp01(fx.elapsed / EVOLUTION_FX_DURATION);
    const flip = clamp01((progress - 0.34) / 0.15);
    const angle = flip * Math.PI * 2;
    const facing = Math.cos(angle);
    const rise = easeInOut((progress - 0.12) / 0.76);
    return {
        progress,
        gather: easeOut(progress / 0.24) * (1 - 0.72 * easeOut((progress - 0.35) / 0.25)),
        whiten: easeOut((progress - 0.12) / 0.2),
        morph: easeOut((progress - 0.34) / 0.19),
        reveal: easeOut((progress - EVOLUTION_LANDING_AT) / (1 - EVOLUTION_LANDING_AT)),
        lift: 46 * Math.sin(Math.PI * rise),
        flipScale: Math.max(0.1, Math.abs(facing)),
        flipSign: facing < 0,
        flipOffset: Math.sin(angle) * 0.18,
        landing: easeOut((progress - EVOLUTION_LANDING_AT) / 0.12),
    };
}
