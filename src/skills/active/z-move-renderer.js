import { Z_CRYSTALS, Z_POWER_BAND } from '../../items/z-power-band.js';

const byId = Object.freeze(Object.fromEntries(Z_CRYSTALS.map((crystal) => [crystal.id, crystal])));

/** Particle-led Z signatures; only keep a small readable crystal core and impact boundary. */
export function drawZMoveEffects (batch, palette, zMoves, wall) {
    const burst = zMoves && zMoves.burst;
    if (!burst) return;
    const crystal = byId[burst.id];
    if (!crystal) return;
    const p = Math.max(0, Math.min(1, burst.age / Z_POWER_BAND.burstDuration));
    const fade = Math.round(64 * (1 - p));
    const radius = Math.max(10, burst.radius);
    // The native impact emitter carries the blossom; this faint edge only communicates the hit radius.
    batch.draw('ring', burst.x, burst.y, radius / 32, radius / 32,
        wall * 0.45, palette.get(crystal.color, fade));
}
