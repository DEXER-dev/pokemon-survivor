import { Z_CRYSTALS, Z_POWER_BAND } from '../../items/z-power-band.js';

const byId = Object.freeze(Object.fromEntries(Z_CRYSTALS.map((crystal) => [crystal.id, crystal])));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const frameKey = (prefix, id, index) => `${prefix}_${id}_${String(index).padStart(2, '0')}`;

/** A large elemental core, tapered wake and a blast that reaches the actual damage radius. */
export function drawZMoveEffects (batch, palette, zMoves, wall) {
    const shot = zMoves && zMoves.projectile;
    if (shot) {
        const crystal = byId[shot.id];
        if (crystal) {
            const angle = Math.atan2(shot.dy, shot.dx);
            const frame = ((Math.floor(Math.max(0, wall) * 11) % 6) + 6) % 6;
            const name = frameKey('zmove', shot.id, frame);
            const size = clamp(1.5 + (shot.projectileScale || 1) * 0.48, 2, 3.14);
            const traveled = Math.hypot(shot.x - shot.startX, shot.y - shot.startY);
            // Sample along the traveled path, so a short-range cast never draws behind its origin.
            const wake = Math.min(traveled, 190 + size * 20);
            for (let i = 7; i >= 1; i--) {
                const t = i / 8;
                const x = shot.x - shot.dx * wake * t;
                const y = shot.y - shot.dy * wake * t;
                const width = size * (1 - t * 0.78);
                batch.draw('pill', x, y, width * 1.6, width * 0.38, angle,
                    palette.get(crystal.color, Math.round(180 * (1 - t))));
                batch.draw(crystal.glyph, x, y, width * 0.52, width * 0.52, angle,
                    palette.get('#fff4df', Math.round(160 * (1 - t))));
            }
            batch.draw('aura', shot.x, shot.y, size * 1.45, size * 1.45, 0,
                palette.get(crystal.color, 135));
            batch.draw('ring', shot.x, shot.y, size * 0.92, size * 0.92, wall * 2,
                palette.get('#fff4df', 230));
            if (batch.glyphs[name]) {
                batch.draw(name, shot.x, shot.y, size, size, angle, null, false, null,
                    `zmove-projectile-${shot.id}`);
            } else {
                // The atlas loads with the other visual assets; retain a clear type mark during boot.
                batch.draw(crystal.glyph, shot.x, shot.y, size, size, angle,
                    palette.get(crystal.color, 255));
            }
            batch.draw('spark', shot.x + shot.dx * size * 15, shot.y + shot.dy * size * 15,
                size * 0.45, size * 0.45, wall * 3, palette.get('#fffbea', 245));
        }
    }

    const burst = zMoves && zMoves.burst;
    if (!burst || burst.age >= Z_POWER_BAND.burstDuration) return;
    const crystal = byId[burst.id];
    if (!crystal) return;

    const progress = clamp(burst.age / Z_POWER_BAND.burstDuration, 0, 1);
    const frame = Math.min(5, Math.floor(progress * 6));
    const name = frameKey('zimpact', burst.id, frame);
    const expansion = 1 - Math.pow(1 - progress, 3);
    const radius = burst.radius;
    const scale = radius * 2 / 64 * (0.55 + expansion * 0.45);
    const alpha = progress < 0.68 ? 255 : Math.round(255 * (1 - progress) / 0.32);
    // Separate the bright central hit from the expanding edge and elemental fragments.
    batch.draw('aura', burst.x, burst.y, radius * 2 / 56, radius * 2 / 56, 0,
        palette.get(crystal.color, Math.round(110 * (1 - progress))));
    const ringScale = radius * 2 / 48 * (0.22 + expansion * 0.78);
    batch.draw('ring', burst.x, burst.y, ringScale, ringScale, 0,
        palette.get(crystal.color, Math.round(245 * (1 - progress))));
    batch.draw('ring', burst.x, burst.y, ringScale * 0.86, ringScale * 0.86, 0,
        palette.get('#fff4df', Math.round(220 * (1 - progress))));
    if (batch.glyphs[name]) {
        batch.draw(name, burst.x, burst.y, scale, scale, 0, palette.get('#ffffff', alpha), false, null,
            `zmove-impact-${burst.id}`);
    }
    if (progress < 0.28) {
        const flash = (1 - progress / 0.28) * radius / 48;
        batch.draw('star', burst.x, burst.y, flash, flash, Math.PI / 4,
            palette.get('#fffbea', Math.round(240 * (1 - progress / 0.28))));
    }
    for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6 + (i % 2) * 0.12;
        const distance = radius * expansion * (i % 2 ? 0.75 : 1);
        const fragment = (0.45 + radius / 210) * (1 - progress * 0.65);
        batch.draw(crystal.glyph, burst.x + Math.cos(angle) * distance,
            burst.y + Math.sin(angle) * distance, fragment, fragment,
            angle + progress * 1.6, palette.get(crystal.color, alpha));
    }
}
