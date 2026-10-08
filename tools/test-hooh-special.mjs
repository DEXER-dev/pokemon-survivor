import assert from 'node:assert/strict';
import { ENEMY, FAMILIES } from '../src/config.js';
import { EnemySystem } from '../src/enemies.js';
import { createHoOhSpecialState, startHoOhSpecial, stepHoOhSpecial } from '../src/hooh-special.js';
import { makeRng } from '../src/rng.js';

const state = createHoOhSpecialState();
const viewport = { width: 1100, height: 700 };
const arena = { x: 80, y: -20, halfWidth: 550, halfHeight: 310 };
let player = { x: -500, y: -280, radius: 14 };
startHoOhSpecial(state);

let events = stepHoOhSpecial(state, 0.72, viewport, arena, player);
assert.equal(state.phase, 'warning');
assert.equal(events[0]?.type, 'warning');
assert.equal(state.strikes.length, 4);
player = { ...state.strikes[0], radius: 14 };
stepHoOhSpecial(state, 0.88, viewport, arena, player);
assert.equal(state.phase, 'fall');
events = stepHoOhSpecial(state, 0.62, viewport, arena, player);
assert.equal(events.find((event) => event.type === 'impact')?.hit, true);
assert.equal(state.phase, 'pause');

let volleyImpacts = 1;
let completed = false;
for (let safety = 0; state.active && safety < 2000; safety++) {
    events = stepHoOhSpecial(state, 0.02, viewport, arena, player);
    volleyImpacts += events.filter((event) => event.type === 'impact').length;
    completed ||= events.some((event) => event.type === 'complete');
}
assert.equal(volleyImpacts, 3);
assert.equal(completed, true);
assert.equal(state.active, false);

const enemies = new EnemySystem(ENEMY, makeRng(17));
const hoohFamily = FAMILIES.findIndex((family) => family.id === 'legend-hooh');
const boss = enemies.spawn(0, 0, hoohFamily, 1, false, 0, 1, -1, 1, 1, true);
const hpBefore = enemies.hp[boss];
enemies.invulnerable[boss] = 1;
assert.equal(enemies.hurt(boss, 1000), false, 'invulnerable Ho-Oh must reject damage');
assert.equal(enemies.hp[boss], hpBefore);
enemies.invulnerable[boss] = 0;
assert.equal(enemies.hurt(boss, 1), false, 'ordinary damage should apply without defeating the boss');
assert.ok(enemies.hp[boss] < hpBefore);

console.log(`Ho-Oh special: ${volleyImpacts} volleys, invulnerability and damage recovery verified.`);
