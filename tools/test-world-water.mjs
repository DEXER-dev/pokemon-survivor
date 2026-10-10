import assert from 'node:assert/strict';
import { createWorldLayout, pondForCell, pondsInBounds, inPondClearing,
    createPondContours, POND_ART_SCALE } from '../src/world-map-layout.js';
import { WorldPond } from '../src/world-pond.js';

let openingLakes = 0;
let distantLakes = 0;
for (let seed = 0; seed < 100; seed++) {
    const layout = createWorldLayout(seed);
    const ponds = pondsInBounds(layout, { left: -6000, right: 6000, bottom: -6000, top: 6000 });
    assert(ponds.length > 15, `seed ${seed}: distant regions need water`);
    const fresh = createWorldLayout(seed);
    assert.deepEqual(pondsInBounds(fresh, { left: -6000, right: 6000, bottom: -6000, top: 6000 }), ponds);
    openingLakes += pondForCell(layout, 0, 0) ? 1 : 0;
    distantLakes += ponds.filter((pond) => Math.hypot(pond.x, pond.y) > 2000).length;
    for (const pond of ponds) {
        assert(inPondClearing(pond.x, pond.y, 0, layout));
        assert(!inPondClearing(0, 0, 180, pond), `seed ${seed}: keep the spawn safe`);
        assert(Math.hypot(pond.x - layout.grove.x, pond.y - layout.grove.y) >= 540);
        assert(pondsInBounds(layout, { left: pond.x, right: pond.x,
            bottom: pond.y, top: pond.y }).some((candidate) => candidate.id === pond.id));
    }
    for (let i = 0; i < ponds.length; i++) {
        for (let j = i + 1; j < ponds.length; j++) {
            const a = ponds[i], b = ponds[j];
            const radius = (pond) => (pond.columns * 32 + 16) * 1.16 * POND_ART_SCALE * pond.scale;
            assert(Math.hypot(a.x - b.x, a.y - b.y) > radius(a) + radius(b) + 40);
        }
    }
}
assert(openingLakes > 0 && openingLakes < 70, 'an opening lake must be optional');

// Eviction and exploration order must not change an already visited region.
const layout = createWorldLayout(42);
const original = pondsInBounds(layout, { left: -1800, right: 1800, bottom: -1800, top: 1800 });
for (let x = -50; x <= 50; x++) pondForCell(layout, x, x * 3);
for (let x = 100; x < 400; x++) pondForCell(layout, x, -x);
assert.deepEqual(pondsInBounds(layout, { left: -1800, right: 1800, bottom: -1800, top: 1800 }), original);

// Exercise the actual streaming/collision/encounter manager with a minimal native-node adapter.
class Sprite {}
class UITransform {}
class Node {
    constructor (name) { this.name = name; this.active = true; this.children = []; this.components = new Map(); }
    addChild (node) { this.children.push(node); }
    addComponent (kind) { const component = {}; this.components.set(kind, component); return component; }
    getComponent (kind) {
        if (!this.components.has(kind)) this.components.set(kind, { setContentSize () {} });
        return this.components.get(kind);
    }
    setPosition () {}
    setScale () {}
}
Sprite.SizeMode = { CUSTOM: 0 };
const cc = { Node, Sprite, UITransform, Layers: { Enum: { UI_2D: 1 } } };
const water = new WorldPond(cc, new Node('World'));
water.setWorldLayout(layout);
water.setFamilyIndex(0);
for (let x = -18000; x <= 18000; x += 300) {
    water.updateView({ x, y: 2600, z: 1 }, 1280, 720, true);
    assert(water.pool.length <= 8, `streaming should reuse nodes: ${water.pool.length}`);
    assert.equal(water.active.size, water.visibleBasins.length);
    const visible = new Set(water.active.values());
    assert(water.pool.every((entry) => entry.enabled === visible.has(entry)));
}
const pond = pondsInBounds(layout, { left: -4000, right: 4000, bottom: -4000, top: 4000 })[0];
const player = { x: pond.x, y: pond.y, vx: 0, vy: 0 };
water.resolvePlayer(player, 16);
assert(Math.hypot(player.x - pond.x, player.y - pond.y) > 60, 'expel a player inside water');
const geometry = createPondContours(pond);
const artScale = POND_ART_SCALE * pond.scale;
const across = geometry.outerRx * artScale + 80;
const start = { x: pond.x - across, y: pond.y };
const crossing = { x: pond.x + across, y: pond.y, vx: 2000, vy: 0 };
water.resolvePlayer(crossing, 16, true, start);
assert(crossing.x < pond.x, 'a long movement step must not tunnel across the lake');
const spawns = [];
const enemies = { n: 0, dead: [], trainer: [], boss: [], fam: [], x: [], y: [],
    cfg: { populationCap: 300 }, spawn (...args) { spawns.push(args); } };
water.reset();
water.updateEncounters(3.1, pond.x, pond.y, enemies, 0, true);
assert(spawns.length > 0, 'distant lakes must create water encounters');
assert(spawns.some(([x, y]) => inPondClearing(x, y, 0, pond)));
water.updateEncounters(1, pond.x, pond.y, enemies, 0, true);
assert.equal(spawns.length, 1, 'water encounters must respect their cooldown');
water.updateView({ x: pond.x, y: pond.y, z: 1 }, 1280, 720, false);
assert.equal(water.root.active, false);
assert.equal(water.visibleBasins.length, 0);
water.setWorldLayout(createWorldLayout(99));
assert.equal(water.active.size, 0);
console.log(`Water checks passed: 100 seeds, ${openingLakes} optional opening lakes, ${distantLakes} distant lakes; pool peak ${water.pool.length}.`);
