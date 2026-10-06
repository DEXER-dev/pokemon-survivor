import { Z_CRYSTALS } from '../../items/z-power-band.js';

const byId = Object.freeze(Object.fromEntries(Z_CRYSTALS.map((crystal) => [crystal.id, crystal])));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const frameKey = (prefix, id, index) => `${prefix}_${id}_${String(index).padStart(2, '0')}`;

/** Draw source pixel-art projectiles and their animated impact; no procedural orbit or blast rings. */
export function drawZMoveEffects (batch, palette, zMoves, wall) {
    const shot = zMoves && zMoves.projectile;
    if (shot) {
        const crystal = byId[shot.id];
        if (crystal) {
            const angle = Math.atan2(shot.dy, shot.dx);
            const frame = ((Math.floor(Math.max(0, wall) * 11) % 6) + 6) % 6;
            const name = frameKey('zmove', shot.id, frame);
            // The source silhouettes are 48px after nearest-neighbour scaling; keep the
            // core roughly trainer-head sized and let its own animation carry the motion.
            const size = clamp(0.94 + (shot.projectileScale || 1) * 0.08, 1, 1.16);
            if (batch.glyphs[name]) {
                batch.draw(name, shot.x, shot.y, size, size, angle, null, false, null,
                    `zmove-projectile-${shot.id}`);
            } else {
                // The atlas loads with the other visual assets; retain a clear type mark during boot.
                batch.draw(crystal.glyph, shot.x, shot.y, 0.72, 0.72, angle,
                    palette.get(crystal.color, 255));
            }
        }
    }

    const burst = zMoves && zMoves.burst;
    if (!burst || burst.age >= 0.46) return;
    const crystal = byId[burst.id];
    if (!crystal) return;

    const progress = clamp(burst.age / 0.46, 0, 1);
    const frame = Math.min(5, Math.floor(progress * 6));
    const name = frameKey('zimpact', burst.id, frame);
    const scale = clamp(1.16 + (burst.projectileScale || 1) * 0.1, 1.24, 1.55);
    const alpha = progress < 0.68 ? 255 : Math.round(255 * (1 - progress) / 0.32);
    if (batch.glyphs[name]) {
        batch.draw(name, burst.x, burst.y, scale, scale, 0, palette.get('#ffffff', alpha), false, null,
            `zmove-impact-${burst.id}`);
    }
}
