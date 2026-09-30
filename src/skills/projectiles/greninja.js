import { PPM } from '../../config.js';

const MAX_HITS = 3;

/** Greninja's signature Water Shuriken: one spinning, three-target piercing water blade. */
export const greninjaWaterShuriken = Object.freeze({
    matchesSegment (seg) {
        return seg?.fam === 'froakie' && seg.tier >= 3;
    },

    shots: 1,
    damageShares: MAX_HITS,
    radius: 14,
    speed: 22 * PPM,
    range: 10 * PPM,
    launchEvent: 'shuriken-launch',
    hitEvent: 'shuriken-hit',

    launch (system, { x, y, base, carry, dmgMul, radius, family }) {
        const n = system.n++;
        system.px[n] = x;
        system.py[n] = y;
        system.pvx[n] = Math.cos(base) * this.speed;
        system.pvy[n] = Math.sin(base) * this.speed;
        system.pleft[n] = this.range;
        system.pr[n] = radius;
        system.pdmg[n] = carry * dmgMul;
        system.pfam[n] = family;
        system.pmega[n] = null;
        system.pvariant[n] = 0;
        system.pbounce[n] = 0;
        system.pavoid[n] = -1;
        system.pavoid2[n] = -1;
        system.pMode[n] = 1;
        system.pStage[n] = 1;
        system.pLegHit[n] = 0;
        system.pOriginX[n] = x;
        system.pOriginY[n] = y;
    },

    canHit (system, i) {
        return system.pLegHit[i] < MAX_HITS;
    },

    onHit (system, i, target) {
        system.pavoid2[i] = system.pavoid[i];
        system.pavoid[i] = target;
        system.pLegHit[i]++;
        if (system.pLegHit[i] < MAX_HITS) return 'keep';
        system._burst('shuriken-splash', system.pfam[i], system.px[i], system.py[i]);
        return 'dropped';
    },

    advance (system, i) {
        if (system.pleft[i] > 0.001) return 'keep';
        const remainingShares = MAX_HITS - system.pLegHit[i];
        if (remainingShares > 0) system.m.lost += system.pdmg[i] * remainingShares;
        system._burst('shuriken-splash', system.pfam[i], system.px[i], system.py[i]);
        system._drop(i);
        return 'dropped';
    },

    /** Shard particles sampled from the moving shot are its sole visual body/trail. */
    draw () {},
});
