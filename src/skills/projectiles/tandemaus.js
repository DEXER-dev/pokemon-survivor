/** Family-specific projectile behavior for Tandemaus and Maushold. */
export const tandemausProjectile = Object.freeze({
    launchEvent: 'tandemaus-throw',

    shotCount (chain, segment, baseShots) {
        return baseShots + Math.max(0, chain.companionCountOf(segment) - 1);
    },

    spread (baseSpread, baseShots, shots) {
        // More mice fill the same directional fan instead of widening it into a full circle.
        return shots > 1 ? baseSpread * Math.max(1, baseShots - 1) / (shots - 1) : 0;
    },

    variant (shotIndex) {
        return shotIndex % 4;
    },
});

/** Draw the live shot as a mouse sprite; its motion and contact still come from SkillSystem. */
export function drawTandemausProjectile (batch, palette, shot) {
    const shiny = !!shot.shiny;
    const glyph = `MAUSHOLD_COMPANION_${(shot.variant || 0) % 4 + 1}${shiny ? '_s' : ''}`;
    const size = Math.max(0.42, Math.min(0.76, shot.size * 0.035));
    batch.draw(glyph, shot.x, shot.y, size, size, shot.shotAngle || 0,
        palette.get('#ffffff', 255));
}
