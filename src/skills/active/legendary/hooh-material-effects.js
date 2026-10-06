const TAU = Math.PI * 2;
const clamp = (v) => Math.max(0, Math.min(1, v));
export const HOOH_FIRE_FRAMES = 60;

export function drawHoohMaterialField (batch, pal, fx, wall) {
    if (!batch.glyphs?.hoohFire_0) return false;
    for (let i = 0; i < 10; i++) {
        const angle = i * TAU / 10 + wall * 0.2;
        const radius = fx.a * 0.78;
        const frame = Math.floor(wall * 30 + i * 6) % HOOH_FIRE_FRAMES;
        batch.draw(`hoohFire_${frame}`, fx.x + Math.cos(angle) * radius,
            fx.y + Math.sin(angle) * radius, 0.38, 0.62, 0, pal.get('#ffffff', 165),
            false, null, 'hoohFire');
    }
    batch.draw('aura', fx.x, fx.y, fx.a / 28, fx.a / 28, 0, pal.get('#ff8f36', 38));
    return true;
}

/** Automatic Sacred Fire stays on its damage footprints; the phoenix belongs to the active skill. */
export function drawHoohSacredFire (batch, pal, attack, t, impact) {
    if (t >= 1) return;
    const material = batch.glyphs?.hoohFire_0 && batch.glyphs?.hoohFlare_0;
    const fade = impact ? Math.min(1, (1 - t) / 0.3) : 0.35 + t * 0.65;
    for (const [i, area] of (attack.areas || []).entries()) {
        const r = area.radius;
        batch.draw('ring', area.x, area.y, r / 24 * (impact ? 0.8 + t * 0.25 : 1 - t * 0.25),
            r / 24 * 0.55, 0, pal.get('#ffc45b', Math.round(150 * fade)));
        if (!impact) {
            batch.draw('feather', area.x, area.y + 12, 0.45, 0.65, -0.35,
                pal.get('#fff3bb', Math.round(190 * fade)));
            continue;
        }
        const burst = Math.max(0, 1 - t / 0.3);
        batch.draw('aura', area.x, area.y, r / 32, r / 45, 0,
            pal.get('#ff8f36', Math.round((40 + burst * 50) * fade)));
        // One grounded flare and three short flames, with no airborne rain or wing crown.
        const frame = Math.floor(t * 2.2 * 30 + i * 11) % HOOH_FIRE_FRAMES;
        if (material) batch.draw(`hoohFlare_${frame}`, area.x, area.y, 0.8 + burst * 0.5,
            0.5 + burst * 0.35, 0, pal.get('#ffffff', Math.round(200 * fade)), false, null, 'hoohFlare');
        for (let j = -1; j <= 1; j++) {
            const x = area.x + j * r * 0.35;
            if (material) batch.draw(`hoohFire_${(frame + (j + 1) * 9) % HOOH_FIRE_FRAMES}`,
                x, area.y + 8, 0.42, 0.75 + burst * 0.35, j * -0.12,
                pal.get('#ffffff', Math.round(210 * fade)), false, null, 'hoohFire');
            else batch.draw('feather', x, area.y + 8, 0.55, 0.9 + burst * 0.3, j * -0.12,
                pal.get('#ff9c4d', Math.round(210 * fade)));
        }
    }
}

/** Authored flame animation plus deterministic choreography; no new damage or particle emitters. */
export function drawHoohMaterialStorm (batch, pal, { x, y, age, duration = 2.2, radius = 118, charging = false }) {
    if (!batch.glyphs?.hoohFire_0 || !batch.glyphs?.hoohFlare_0) return false;
    if (![x, y, age, duration, radius].every(Number.isFinite) || duration <= 0 || age < 0 || age >= duration) return true;
    const t = clamp(age / duration);
    const envelope = Math.min(1, age / 0.12) * Math.min(1, (duration - age) / 0.32);
    const unit = Math.max(0.7, Math.min(1.45, radius / 118));
    const white = (alpha) => pal.get('#ffffff', Math.round(clamp(alpha / 255 * envelope) * 255));
    const sprite = (name, px, py, sx, sy, rotation = 0, alpha = 255, frameOffset = 0) => {
        const frame = Math.floor(age * 30 + frameOffset) % HOOH_FIRE_FRAMES;
        batch.draw(`${name}_${frame}`, px, py, sx * unit, sy * unit, rotation, white(alpha),
            false, null, name);
    };
    const glow = (px, py, sx, sy, alpha = 80) =>
        batch.draw('aura', px, py, sx * unit, sy * unit, 0,
            pal.get('#ff9a36', Math.round(alpha * envelope)));

    if (charging) {
        for (let i = 0; i < 8; i++) {
            const a = i * TAU / 8 + age * 0.8;
            const r = (1 - t * t) * 105;
            sprite('hoohFlare', x + Math.cos(a) * r, y + Math.sin(a) * r,
                0.55 + t * 0.45, 0.8 + t * 0.55, a - Math.PI / 2, 180 + t * 60, i * 7);
        }
        sprite('hoohFire', x, y, 1 + t, 1.3 + t * 1.7, 0, 230);
        glow(x, y, 4, 4, 85);
        return true;
    }

    // A 420px phoenix-shaped crown: long burning primaries, shorter layered secondaries.
    const unfold = 1 - (1 - Math.min(1, age / 0.4)) ** 3;
    for (const side of [-1, 1]) {
        for (let feather = 0; feather < 9; feather++) {
            const f = feather / 8;
            const reach = (35 + f * 175) * unfold * unit;
            const lift = (35 + Math.sin(f * Math.PI * 0.85) * 70 + Math.sin(age * 5 + f * 2) * 8) * unit;
            const tilt = side * (0.28 + f * 0.95);
            sprite('hoohFire', x + side * reach, y + lift,
                0.9 + f * 0.25, 2.6 - f * 0.65, tilt, 215, feather * 7 + (side < 0 ? 21 : 0));
            if (feather % 2 === 0) sprite('hoohFlare', x + side * reach, y + lift - 25 * unit,
                0.55, 1.1, tilt, 180, feather * 5);
        }
    }
    glow(x, y + 40 * unit, 9, 5.5, 100);
    sprite('hoohFire', x, y + 25 * unit, 2.2, 4.2, 0, 255, 13);
    sprite('hoohFlare', x, y + 50 * unit, 1.3, 2.5, 0, 235, 31);

    // Twelve staggered comets descend into a ring of landing blooms. Their trails use
    // different source frames, so they flicker independently instead of moving as clones.
    for (let i = 0; i < 12; i++) {
        const p = (age * 0.85 + i / 12) % 1;
        const a = i * TAU / 12 + 0.3;
        const landingX = x + Math.cos(a) * radius * 0.95;
        const landingY = y + Math.sin(a) * radius * 0.7;
        if (p < 0.72) {
            const travel = p / 0.72;
            const px = landingX + (1 - travel) * (i % 2 ? 45 : -45) * unit;
            const py = landingY + (1 - travel) * 170 * unit;
            glow(px, py, 1.5, 2.8, 85);
            sprite('hoohFire', px, py + 14 * unit, 0.6, 1.8, (i % 2 ? -1 : 1) * 0.24, 240, i * 5);
            batch.draw('feather', px, py - 7 * unit, 0.6 * unit, 0.6 * unit,
                Math.PI + i * 0.1, pal.get('#fff3bb', Math.round(225 * envelope)));
        } else {
            const burst = (p - 0.72) / 0.28;
            const pop = Math.sin(burst * Math.PI);
            sprite('hoohFlare', landingX, landingY, 1.1 + pop * 1.2, 0.8 + pop * 0.8,
                0, 245 * (1 - burst), i * 5);
            sprite('hoohFire', landingX, landingY + 12 * unit, 0.7 + pop,
                1.2 + pop * 1.2, 0, 210 * (1 - burst), i * 7);
        }
    }
    return true;
}
