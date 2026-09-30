import { PPM } from '../../config.js';

const TAU = Math.PI * 2;

/** Meowscarada's signature flower volley: eight petals bloom outward, then curve back to their owner. */
export const meowscaradaFlower = Object.freeze({
    matchesSegment (seg) {
        return seg?.fam === 'sprigatito' && seg.tier >= 3;
    },

    shots: 8,
    damageShares: 2,
    radius: 11,
    speed: 18 * PPM,
    range: 5.8 * PPM,
    launchEvent: 'flower-launch',
    hitEvent: 'flower-hit',

    launch (system, { x, y, base, fire, carry, dmgMul, radius, family }) {
        for (let k = 0; k < fire; k++) {
            const angle = base + k * TAU / this.shots;
            const n = system.n++;
            system.px[n] = x;
            system.py[n] = y;
            system.pvx[n] = Math.cos(angle) * this.speed;
            system.pvy[n] = Math.sin(angle) * this.speed;
            system.pleft[n] = this.range;
            system.pr[n] = radius;
            system.pdmg[n] = carry * dmgMul;
            system.pfam[n] = family;
            system.pmega[n] = null;
            system.pvariant[n] = k;
            system.pbounce[n] = 0;
            system.pavoid[n] = -1;
            system.pavoid2[n] = -1;
            system.pMode[n] = 1;
            system.pStage[n] = 1;
            system.pLegHit[n] = 0;
            system.pOriginX[n] = x;
            system.pOriginY[n] = y;
        }
    },

    steer (system, i, dt, speed) {
        if (system.pStage[i] !== 2) return false;
        const dx = system.pOriginX[i] - system.px[i];
        const dy = system.pOriginY[i] - system.py[i];
        const distance = Math.hypot(dx, dy);
        const current = Math.atan2(system.pvy[i], system.pvx[i]);
        const curve = (system.pvariant[i] % 2 ? 1 : -1) * Math.min(0.12, distance / 260 * 0.12);
        const want = Math.atan2(dy, dx) + curve;
        const delta = Math.atan2(Math.sin(want - current), Math.cos(want - current));
        const next = current + Math.max(-7.5 * dt, Math.min(7.5 * dt, delta));
        system.pvx[i] = Math.cos(next) * speed;
        system.pvy[i] = Math.sin(next) * speed;
        return true;
    },

    canHit (system, i) {
        return !system.pLegHit[i];
    },

    onHit (system, i) {
        // One hit share on the outbound leg and one on the return leg; it pierces through others.
        system.pLegHit[i] = 1;
    },

    advance (system, i) {
        const returnReach = Math.max(32, system.pr[i] * 2.5);
        const caught = system.pStage[i] === 2
            && Math.hypot(system.px[i] - system.pOriginX[i], system.py[i] - system.pOriginY[i]) <= returnReach;
        if (caught) {
            if (!system.pLegHit[i]) system.m.lost += system.pdmg[i];
            system._burst('flower-catch', system.pfam[i], system.pOriginX[i], system.pOriginY[i]);
            system._drop(i);
            return 'dropped';
        }
        if (system.pleft[i] > 0.001) return 'keep';
        if (!system.pLegHit[i]) system.m.lost += system.pdmg[i];
        if (system.pStage[i] === 1) {
            system.pStage[i] = 2;
            system.pLegHit[i] = 0;
            system.pleft[i] = this.range * 2.5;
            const turnAngle = Math.atan2(system.pvy[i], system.pvx[i]);
            system._burst('flower-bloom', system.pfam[i], system.px[i], system.py[i], turnAngle);
            return 'turned';
        }
        system._drop(i);
        return 'dropped';
    },

    /** Leaf particles sampled from the moving shot are its sole visual body/trail. */
    draw () {},
});
