/**
 * Seedable RNG so a stress run reproduces itself - M0-6 compares frame costs between
 * builds, which is pointless if the wave layout differs.
 */
export function makeRng (seed) {
    let s = seed >>> 0;
    const next = () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
        next,
        range: (a, b) => a + next() * (b - a),
        int: (a, b) => Math.floor(a + next() * (b - a + 1)),
        chance: (p) => next() < p,
        sign: () => (next() < 0.5 ? -1 : 1),
        pick: (arr) => arr[Math.floor(next() * arr.length) % arr.length],
    };
}

/** A fresh run seed. The resulting run still uses makeRng(seed), so that seed reproduces it exactly. */
export function randomSeed () {
    try {
        if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
            return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
        }
    } catch (_) {
        // Older or restricted browser contexts can fall back to a mixed time/random seed.
    }
    return (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
}
