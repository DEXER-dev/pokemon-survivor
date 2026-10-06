export const MEGA_EVOLUTION_DURATION = 1.32;
export const MEGA_ORB_BURST_AT = 0.72;
export const MEGA_REVEAL_AT = 0.91;

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const easeOut = (value) => 1 - Math.pow(1 - clamp01(value), 3);

export function createMegaEvolutionFx (oldIcon) {
    return {
        elapsed: 0,
        oldIcon: oldIcon || null,
        burstPlayed: false,
        revealPlayed: false,
    };
}

/** Advance on the renderer clock and return one-shot cues even when a frame crosses a cue point. */
export function stepMegaEvolutionFx (fx, dt) {
    if (!fx) return { cues: [], done: true };
    const previous = fx.elapsed;
    fx.elapsed = Math.min(MEGA_EVOLUTION_DURATION, previous + Math.max(0, dt));
    const cues = [];
    if (!fx.burstPlayed && previous < MEGA_ORB_BURST_AT && fx.elapsed >= MEGA_ORB_BURST_AT) {
        fx.burstPlayed = true;
        cues.push('burst');
    }
    if (!fx.revealPlayed && previous < MEGA_REVEAL_AT && fx.elapsed >= MEGA_REVEAL_AT) {
        fx.revealPlayed = true;
        cues.push('reveal');
    }
    return { cues, done: fx.elapsed >= MEGA_EVOLUTION_DURATION };
}

/** Values shared by the body and shell render passes; all movement is visual-only. */
export function megaEvolutionVisual (fx) {
    if (!fx) return null;
    const progress = clamp01(fx.elapsed / MEGA_EVOLUTION_DURATION);
    const close = easeOut((progress - 0.1) / 0.22);
    const open = 1 - easeOut((progress - 0.59) / 0.18);
    const shell = close * open;
    let bodyAlpha;
    if (progress < 0.2) bodyAlpha = 1;
    else if (progress < 0.42) bodyAlpha = 1 - easeOut((progress - 0.2) / 0.22);
    else if (progress < 0.66) bodyAlpha = 0;
    else bodyAlpha = easeOut((progress - 0.66) / 0.2);
    const lift = 10 * Math.sin(Math.PI * easeOut((progress - 0.04) / 0.86));
    const burst = easeOut((progress - MEGA_ORB_BURST_AT / MEGA_EVOLUTION_DURATION) / 0.25);
    return {
        progress,
        shell,
        bodyAlpha,
        lift,
        burst,
        reveal: easeOut((progress - MEGA_REVEAL_AT / MEGA_EVOLUTION_DURATION) / 0.16),
        charge: easeOut(progress / 0.22) * (1 - easeOut((progress - 0.23) / 0.18)),
    };
}
