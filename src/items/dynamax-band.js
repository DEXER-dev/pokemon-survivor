export const DYNAMAX_BAND = Object.freeze({
    duration: 30,
    cooldown: 60,
    // Dynamax should read as a transformation, not a subtle stat buff.
    pokemonScale: 2.4,
    projectileScale: 1.55,
    // The projectile shader is optimized for monochrome glyphs and discards the sprite's RGB.
    // Party Pokémon use full-color artwork, so their dedicated shader must preserve texel colors.
    shader: 'dynamax-pokemon',
});

export function canDynamax (segment, combatForm) {
    return !!segment && !combatForm;
}

export function dynamaxProjectileScale (segment, activeSegment) {
    return segment === activeSegment ? DYNAMAX_BAND.projectileScale : 1;
}
