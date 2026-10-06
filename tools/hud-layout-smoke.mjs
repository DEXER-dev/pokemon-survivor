import assert from 'node:assert/strict';
import { Hud } from '../src/hud.js';

// Exercise pagination independently of combat or a live save, using the same HUD class.
class UITransform { setContentSize() {} }
class Node {
    constructor(name) { this.name = name; this.children = []; this.position = { x: 0, y: 0 }; this.active = true; this.components = new Map(); }
    setPosition(x, y) { this.position = { x, y }; }
    setScale(x, y) { this.scale = { x, y }; }
    addChild(node) { node.parent = this; this.children.push(node); }
    addComponent(Type) { const component = new Type(); component.node = this; this.components.set(Type, component); return component; }
    getComponent(Type) { return this.components.get(Type) || this.addComponent(Type); }
}
class Graphics {
    clear() {} roundRect() {} rect() {} circle() {} fill() {} stroke() {} moveTo() {} lineTo() {}
}
class Label {
    static HorizontalAlign = { LEFT: 0, RIGHT: 1, CENTER: 2 };
    static VerticalAlign = { CENTER: 0 };
    static Overflow = { NONE: 0, SHRINK: 1 };
}
class Sprite { static SizeMode = { CUSTOM: 0 }; }
class Color { constructor(r, g, b, a) { Object.assign(this, { r, g, b, a }); } }
const cc = { Node, Graphics, Label, Sprite, Color, UITransform, Layers: { Enum: { UI_2D: 1 } } };
const hud = new Hud(cc, new Node('Root'));
const segments = Array.from({ length: 65 }, (_, i) => ({ fam: 'mush', tier: 1, count: i + 1 }));
const update = (team = segments) => hud.setParty(team, 80, team.reduce((n, s) => n + s.count, 0), {});
update();
assert.equal(hud.partyCells.filter(c => c.node.active).length, 8);
assert.equal(hud.partyOverflow.string, '+57 展开 ▾');
const x = hud.partyRoot.position.x, y = hud.partyRoot.position.y;
assert.equal(hud.hitPartyButton(x, y + 20), true);
update();
assert.equal(hud.partyCells.filter(c => c.node.active).length, 16);
assert.equal(hud.partyPageCount, 5);
for (let page = 1; page <= 4; page++) {
    assert.equal(hud.hitPartyButton(x + 100, y - 86), true);
    update();
    assert.equal(hud.partyPage, page);
    assert.equal(hud.partyCells[0].count.string, `×${page * 16 + 1}`);
}
assert.equal(hud.partyCells.filter(c => c.node.active).length, 1);
assert.equal(hud.partyCells[0].count.string, '×65');
hud.hitPartyButton(x + 100, y - 86); update();
assert.equal(hud.partyPage, 4, 'last page must clamp');
update(segments.slice(0, 3));
assert.equal(hud.partyPage, 0, 'team shrink must clamp page');
assert.equal(hud.partyCells.filter(c => c.node.active).length, 3);
update(Array.from({ length: 1001 }, () => segments[0]));
assert.equal(hud.partyPageCount, 63, 'display must not retain the old 39-species limit');
assert.equal(hud.partyCells.length, 16, 'long teams must reuse the sprite pool');
assert.equal(hud.hitPartyButton(0, 0), false, 'world clicks must pass through');
hud.setHealth(0, 120); hud.setAmmo(0); hud.setExperience(12, 4, 10);
assert.equal(hud.healthText.string, '0 / 120');
assert.equal(hud.ammoCount.string, '×0');
assert.equal(hud.expLabel.string, 'Lv 12　EXP 4 / 10');
hud.setViewport(960);
assert.equal(hud.partyRoot.position.x - 166 * hud.hudScale, -460);
assert.equal(hud.hitPartyButton(hud.partyRoot.position.x + 100 * hud.hudScale,
    hud.partyRoot.position.y - 86 * hud.hudScale), true);
console.log('HUD smoke passed: 65-member page traversal, 1001-member pool, shrink, bounds, HP/ammo/EXP.');
