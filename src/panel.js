/*
 * The level-up 三选一 (§4). This is a card fan, not a menu: three choices, one click, no submenus,
 * and the sim never resumes until one is taken. It is the second and last place the game stops -
 * the other being the 熔炉 - so the panel deliberately fits on screen without scrolling and reads
 * without a sentence of prose.
 */

import { VIEW, COL } from './config.js';
import { makeLabel } from './hud.js';
import { CARDS } from './upgrades.js';

const CARD_W = 300;
const CARD_H = 300;
const GAP = 40;

export class Panel {
    constructor (cc, parent, pal) {
        this.cc = cc;
        this.pal = pal;
        this.root = new cc.Node('Panel');
        this.root.layer = cc.Layers.Enum.UI_2D;
        this.root.active = false;
        parent.addChild(this.root);
        this.g = this.root.addComponent(cc.Graphics);
        this.title = makeLabel(cc, this.root, 'Title', 196, 30, COL.heroTrim, 'center');

        this.cards = [];
        for (let i = 0; i < CARDS; i++) {
            const x = (i - (CARDS - 1) / 2) * (CARD_W + GAP);
            this.cards.push({
                x,
                key: `[${i + 1}]`,
                name: makeLabel(cc, this.root, `Card${i}Name`, 92, 25, COL.text, 'center', x, CARD_W - 34),
                delta: makeLabel(cc, this.root, `Card${i}Delta`, 42, 22, COL.accent, 'center', x, CARD_W - 34),
                note: makeLabel(cc, this.root, `Card${i}Note`, -22, 17, COL.text, 'center', x, CARD_W - 40),
                foot: makeLabel(cc, this.root, `Card${i}Foot`, -124, 16, COL.ink, 'center', x, CARD_W - 34),
                stone: (() => {
                    const node = new cc.Node(`Card${i}UpgradeIcon`);
                    node.layer = cc.Layers.Enum.UI_2D;
                    node.setPosition(x, 137, 0);
                    this.root.addChild(node);
                    const sprite = node.addComponent(cc.Sprite);
                    sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
                    node.getComponent(cc.UITransform).setContentSize(44, 44);
                    node.active = false;
                    return { node, sprite };
                })(),
            });
        }
        // Item effects use short, concrete descriptions; allow a second line so none of the
        // survival/EXP benefits gets silently clipped inside the fixed three-card layout.
        // Overflow.NONE never wraps no matter what enableWrapText says - the panel needs SHRINK,
        // which wraps into the two-line box and then scales the font down if even that is too long.
        for (const card of this.cards) {
            card.name.overflow = cc.Label.Overflow.SHRINK;
            card.delta.overflow = cc.Label.Overflow.SHRINK;
            card.note.overflow = cc.Label.Overflow.SHRINK;
            card.foot.overflow = cc.Label.Overflow.SHRINK;
            card.note.enableWrapText = true;
            card.note.lineHeight = 19;
            card.note.node.setPosition(card.x, -30, 0);
            card.note.node.getComponent(cc.UITransform).setContentSize(CARD_W - 38, 52);
        }
        this.opts = [];
        this.build = null;
        this.hover = -1;
        this.megaStoneFrames = {};
        this.upgradeItemFrames = {};
    }

    setMegaStoneFrames (frames) {
        this.megaStoneFrames = frames || {};
        for (let i = 0; i < this.opts.length; i++) this._setCardIcon(i, this.opts[i]);
    }

    setUpgradeItemFrames (frames) {
        this.upgradeItemFrames = frames || {};
        for (let i = 0; i < this.opts.length; i++) this._setCardIcon(i, this.opts[i]);
    }

    _setCardIcon (i, entry) {
        const stone = this.cards[i].stone;
        const frame = entry && entry.stone ? this.megaStoneFrames[entry.stone]
            : entry && entry.icon ? this.upgradeItemFrames[entry.icon] : null;
        stone.node.active = !!frame;
        stone.sprite.spriteFrame = frame || null;
    }

    get open () {
        return this.opts.length > 0;
    }

    show (title, opts, build, ctx) {
        this.title.string = title;
        this.opts = opts;
        this.build = build;
        for (let i = 0; i < this.cards.length; i++) {
            const c = this.cards[i];
            const e = opts[i];
            const on = e !== undefined;
            c.name.node.active = on;
            c.delta.node.active = on;
            c.note.node.active = on;
            c.foot.node.active = on;
            this._setCardIcon(i, e);
            if (!on) continue;
            const n = build.stacks[e.id] || 0;
            c.name.string = e.name;
            c.name.color = this.pal.get(e.rarity === 'legendary' ? COL.gold : COL.text, 255);
            c.delta.string = e.delta(build, ctx);
            c.note.string = e.note;
            c.foot.string = e.rarity === 'legendary'
                ? `✦ 传说道具 · ${c.key} 一次性` : `${c.key} 已取 ${n}/${e.max}`;
        }
        this.root.active = true;
    }

    hide () {
        this.opts = [];
        this.root.active = false;
    }

    /** View-space pointer, same space the Input records - so a card is clickable where it is drawn. */
    hit (x, y) {
        if (!this.open) return -1;
        for (let i = 0; i < this.opts.length; i++) {
            const c = this.cards[i];
            if (Math.abs(x - c.x) <= CARD_W / 2 && Math.abs(y) <= CARD_H / 2) return i;
        }
        return -1;
    }

    render (time) {
        const g = this.g;
        const b = this.build;
        g.clear();
        g.fillColor = this.pal.get(COL.ink, 176);
        g.rect(-VIEW.W / 2, -VIEW.H / 2, VIEW.W, VIEW.H);
        g.fill();
        for (let i = 0; i < this.opts.length; i++) {
            const c = this.cards[i];
            const e = this.opts[i];
            const on = i === this.hover;
            const pulse = on ? 0.5 + 0.5 * Math.sin(time * 7) : 0;
            g.fillColor = this.pal.get(on ? COL.heroTrim : '#6f6889', 255);
            g.rect(c.x - CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H);
            g.fill();
            g.strokeColor = this.pal.get(e.rarity === 'legendary' || on ? COL.gold : COL.accent,
                200 + Math.round(55 * pulse));
            g.lineWidth = on ? 6 : 3;
            g.rect(c.x - CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H);
            g.stroke();
        }
    }
}
