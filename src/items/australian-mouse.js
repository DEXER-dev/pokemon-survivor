export const AUSTRALIAN_MOUSE_INTERVAL = 60;

export function australianMouseCount (chain) {
    if (!chain || !Array.isArray(chain.segments)) return 0;
    return chain.segments.reduce((total, segment) =>
        total + (segment.fam === 'tandemaus' ? Math.max(0, segment.count || 0) : 0), 0);
}

export function grantAustralianMouse (chain) {
    if (!chain || !Array.isArray(chain.segments) || typeof chain.add !== 'function') return 'overflow';
    if (Array.isArray(chain.lastAbsorbPromotions)) chain.lastAbsorbPromotions.length = 0;
    const owned = chain.segments.find((segment) => segment.fam === 'tandemaus' && !segment.shiny);
    if (owned) {
        const count = Math.max(0, owned.count || 0);
        owned.count = count + 1;
        owned.companions = Math.max(0, owned.companions ?? count) + 1;
        return 'stack';
    }
    return chain.add('tandemaus', 1, 1, false) ? 'new' : 'overflow';
}

/** The run clock pauses with level-up cards; advancing this from Game.step keeps the item clock in sync. */
export function stepAustralianMouse (dt, build, chain) {
    if (!build || !build.stacks || !build.stacks.australianMouse) return null;
    build.australianMouseTimer = Math.max(0, Number(build.australianMouseTimer) || 0)
        + Math.max(0, Number(dt) || 0);
    const intervals = Math.floor((build.australianMouseTimer + 1e-9) / AUSTRALIAN_MOUSE_INTERVAL);
    if (intervals < 1) return null;
    build.australianMouseTimer -= intervals * AUSTRALIAN_MOUSE_INTERVAL;
    if (build.australianMouseTimer < 1e-9) build.australianMouseTimer = 0;

    const before = australianMouseCount(chain);
    if (!before) return null;
    const multiplier = 2 ** intervals;
    for (const segment of chain.segments) {
        if (segment.fam !== 'tandemaus') continue;
        const count = Math.max(0, segment.count || 0);
        segment.count = count * multiplier;
        segment.companions = Math.max(0, segment.companions || count) * multiplier;
    }
    return { before, after: australianMouseCount(chain), intervals, multiplier };
}
