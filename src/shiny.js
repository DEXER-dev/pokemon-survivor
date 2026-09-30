/** Seeded wild encounter rarity and presentation constants for shiny Pokémon. */
export const SHINY_ODDS = 2048;
export const SHINY_GOLD = '#ffe58f';

/** 闪耀护符按倍率放大基础 1/2048：×4 每级，读作 1/512 → 1/128 → 1/32。 */
export function rollShiny (rng, multiplier = 1) {
    return !!rng && typeof rng.chance === 'function' && rng.chance((1 / SHINY_ODDS) * multiplier);
}
