/*
 * Level-up choice: freeze the run, explain each payoff, then let the player choose with a pointer
 * or keyboard. The panel owns its presentation timeline; the game applies a card only after its
 * confirmation animation has finished.
 */

import { VIEW, COL } from './config.js';
import { makeLabel } from './hud.js';
import { CARDS } from './upgrades.js';

const CARD_W = 300;
const CARD_H = 310;
const GAP = 40;
const CARD_Y = -8;
const ENTER_TIME = 0.32;
const ENTER_STAGGER = 0.065;
const SELECT_TIME = 0.34;

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const outCubic = (t) => 1 - Math.pow(1 - clamp01(t), 3);
const outBack = (t) => {
    const x = clamp01(t) - 1;
    return 1 + 2.15 * x * x * x + 1.15 * x * x;
};

export class Panel {
    constructor (cc, parent, pal) {
        this.cc = cc;
        this.pal = pal;
        this.root = new cc.Node('Panel');
        this.root.layer = cc.Layers.Enum.UI_2D;
        this.root.active = false;
        parent.addChild(this.root);
        this.g = this.root.addComponent(cc.Graphics);

        this.header = new cc.Node('UpgradeHeader');
        this.header.layer = cc.Layers.Enum.UI_2D;
        this.root.addChild(this.header);
        this.headerOpacity = this.header.addComponent(cc.UIOpacity);
        this.kicker = makeLabel(cc, this.header, 'UpgradeKicker', 248, 12, '#c9b6f5', 'center');
        this.title = makeLabel(cc, this.header, 'Title', 210, 30, COL.heroTrim, 'center');
        this.subtitle = makeLabel(cc, this.header, 'UpgradeSubtitle', 174, 16, '#d9d0e8', 'center');
        this.hint = makeLabel(cc, this.header, 'UpgradeHint', -210, 14, '#d9d0e8', 'center');

        this.cards = [];
        for (let i = 0; i < CARDS; i++) {
            const x = (i - (CARDS - 1) / 2) * (CARD_W + GAP);
            const node = new cc.Node(`Card${i}Upgrade`);
            node.layer = cc.Layers.Enum.UI_2D;
            node.setPosition(x, CARD_Y - 48, 0);
            node.setScale(0.86, 0.86, 1);
            this.root.addChild(node);
            const card = {
                x,
                y: CARD_Y,
                key: `[${i + 1}]`,
                node,
                g: node.addComponent(cc.Graphics),
                opacity: node.addComponent(cc.UIOpacity),
                focus: 0,
                name: makeLabel(cc, node, `Card${i}Name`, 68, 25, COL.heroTrim, 'center', 0, CARD_W - 34),
                delta: makeLabel(cc, node, `Card${i}Delta`, 27, 22, COL.gold, 'center', 0, CARD_W - 34),
                note: makeLabel(cc, node, `Card${i}Note`, -28, 17, '#ded8e9', 'center', 0, CARD_W - 40),
                foot: makeLabel(cc, node, `Card${i}Foot`, -121, 15, '#c9c0d9', 'center', 0, CARD_W - 34),
                keyLabel: makeLabel(cc, node, `Card${i}Shortcut`, CARD_H / 2 - 24, 13, '#fff9ec', 'center',
                    CARD_W / 2 - 36, 32),
                stone: (() => {
                    const iconNode = new cc.Node(`Card${i}UpgradeIcon`);
                    iconNode.layer = cc.Layers.Enum.UI_2D;
                    iconNode.setPosition(0, 118, 0);
                    node.addChild(iconNode);
                    const sprite = iconNode.addComponent(cc.Sprite);
                    sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
                    iconNode.getComponent(cc.UITransform).setContentSize(46, 46);
                    iconNode.active = false;
                    return { node: iconNode, sprite };
                })(),
            };
            card.name.overflow = cc.Label.Overflow.SHRINK;
            card.delta.overflow = cc.Label.Overflow.SHRINK;
            card.note.overflow = cc.Label.Overflow.SHRINK;
            card.foot.overflow = cc.Label.Overflow.SHRINK;
            card.note.enableWrapText = true;
            card.note.lineHeight = 19;
            card.note.node.getComponent(cc.UITransform).setContentSize(CARD_W - 38, 52);
            card.keyLabel.node.setPosition(CARD_W / 2 - 36, CARD_H / 2 - 24, 0);
            card.keyLabel.overflow = cc.Label.Overflow.SHRINK;
            this.cards.push(card);
        }

        this.opts = [];
        this.build = null;
        this.onSfx = null;
        this.hover = -1;
        this.selected = -1;
        this.phase = 'closed';
        this.elapsed = 0;
        this.backgroundAlpha = 0;
        this.megaStoneFrames = {};
        this.upgradeItemFrames = {};
        this.reduceMotion = typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.enterTime = this.reduceMotion ? 0.12 : ENTER_TIME;
        this.enterStagger = this.reduceMotion ? 0.015 : ENTER_STAGGER;
        this.selectTime = this.reduceMotion ? 0.12 : SELECT_TIME;
    }

    setMegaStoneFrames (frames) {
        this.megaStoneFrames = frames || {};
        for (let i = 0; i < this.opts.length; i++) this._setCardIcon(i, this.opts[i]);
    }

    setSfx (callback) {
        this.onSfx = typeof callback === 'function' ? callback : null;
    }

    _playSfx (event) {
        if (this.onSfx) this.onSfx(event);
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
        this.kicker.string = 'LEVEL UP  ·  等级提升';
        this.subtitle.string = '选择一项强化 · 确认后立即生效';
        this.hint.string = '点击卡片或按 1 / 2 / 3 选择  ·  ← / → 移动焦点  ·  空格确认';
        this.opts = opts;
        this.build = build;
        this.hover = opts.length ? 0 : -1;
        this.selected = -1;
        this.phase = opts.length ? 'entering' : 'closed';
        this.elapsed = 0;
        this.backgroundAlpha = 0;
        this.headerOpacity.opacity = 0;
        this.header.setPosition(0, -12, 0);

        for (let i = 0; i < this.cards.length; i++) {
            const c = this.cards[i];
            const e = opts[i];
            const on = e !== undefined;
            c.name.node.active = on;
            c.delta.node.active = on;
            c.note.node.active = on;
            c.foot.node.active = on;
            c.keyLabel.node.active = on;
            c.node.active = on;
            c.focus = 0;
            c.opacity.opacity = 0;
            c.node.setPosition(c.x, c.y - (this.reduceMotion ? 8 : 48), 0);
            const startScale = this.reduceMotion ? 0.96 : 0.86;
            c.node.setScale(startScale, startScale, 1);
            this._setCardIcon(i, e);
            if (!on) continue;
            const n = build.stacks[e.id] || 0;
            c.name.string = e.name;
            c.delta.string = e.delta(build, ctx);
            c.note.string = e.note;
            c.foot.string = e.rarity === 'legendary'
                ? '✦ 传说道具 · 一次性' : `已取 ${n}/${e.max}`;
        }
        this.root.active = this.phase !== 'closed';
        if (this.root.active) this._playSfx('appear');
    }

    hide () {
        this.opts = [];
        this.hover = -1;
        this.selected = -1;
        this.phase = 'closed';
        this.elapsed = 0;
        this.backgroundAlpha = 0;
        this.root.active = false;
    }

    /** Advance presentation on real frame time; return the confirmed card only after it exits. */
    update (dt) {
        if (!this.root.active || this.phase === 'closed') return -1;
        this.elapsed += Math.max(0, Math.min(0.2, Number(dt) || 0));

        if (this.phase === 'entering') {
            const headerT = outCubic(this.elapsed / 0.28);
            this.backgroundAlpha = Math.round(184 * outCubic(this.elapsed / 0.26));
            this.headerOpacity.opacity = Math.round(255 * headerT);
            this.header.setPosition(0, -12 + 12 * headerT, 0);
            for (let i = 0; i < this.cards.length; i++) {
                const c = this.cards[i];
                if (!c.node.active) continue;
                const t = clamp01((this.elapsed - i * this.enterStagger) / this.enterTime);
                const pop = this.reduceMotion ? outCubic(t) : Math.max(0, outBack(t));
                const fade = outCubic(t);
                const focus = i === this.hover ? 1 : 0;
                c.focus += (focus - c.focus) * (1 - Math.exp(-Math.max(0, dt) * 14));
                const startOffset = this.reduceMotion ? 8 : 48;
                const startScale = this.reduceMotion ? 0.96 : 0.86;
                c.node.setPosition(c.x, c.y - startOffset * (1 - fade) + 5 * c.focus * fade, 0);
                const scale = (startScale + (1 - startScale) * Math.min(1.06, pop))
                    * (1 + 0.035 * c.focus * fade);
                c.node.setScale(scale, scale, 1);
                c.opacity.opacity = Math.round(255 * fade);
            }
            if (this.elapsed >= this.enterTime + this.enterStagger * (Math.max(0, this.opts.length - 1))) {
                this.phase = 'open';
                this.elapsed = 0;
            }
        } else if (this.phase === 'open') {
            this.backgroundAlpha = 184;
            this.headerOpacity.opacity = 255;
            this.header.setPosition(0, 0, 0);
            for (let i = 0; i < this.cards.length; i++) {
                const c = this.cards[i];
                if (!c.node.active) continue;
                const target = i === this.hover ? 1 : 0;
                c.focus += (target - c.focus) * (1 - Math.exp(-Math.max(0, dt) * 14));
                const scale = 1 + c.focus * (this.reduceMotion ? 0.015 : 0.035);
                c.node.setPosition(c.x, c.y + c.focus * (this.reduceMotion ? 0 : 5), 0);
                c.node.setScale(scale, scale, 1);
                c.opacity.opacity = 255;
            }
        } else if (this.phase === 'selecting') {
            const t = clamp01(this.elapsed / this.selectTime);
            const ease = outCubic(t);
            this.backgroundAlpha = Math.round(184 * (1 - ease));
            this.headerOpacity.opacity = Math.round(255 * (1 - ease));
            this.header.setPosition(0, 10 * ease, 0);
            for (let i = 0; i < this.cards.length; i++) {
                const c = this.cards[i];
                if (!c.node.active) continue;
                if (i === this.selected) {
                    const dissolve = outCubic((t - 0.52) / 0.48);
                    const scale = 1.035 + (this.reduceMotion ? 0.035 : 0.12) * ease;
                    c.node.setPosition(c.x, c.y + 5 + (this.reduceMotion ? 4 : 38) * ease, 0);
                    c.node.setScale(scale, scale, 1);
                    c.opacity.opacity = Math.round(255 * (1 - dissolve));
                } else {
                    const fade = outCubic(t / 0.7);
                    const scale = 1 - 0.1 * ease;
                    c.node.setPosition(c.x, c.y - (this.reduceMotion ? 2 : 18) * ease, 0);
                    c.node.setScale(scale, scale, 1);
                    c.opacity.opacity = Math.round(255 * (1 - fade));
                }
            }
            if (t >= 1) {
                const chosen = this.selected;
                this.opts = [];
                this.selected = -1;
                this.hover = -1;
                this.phase = 'closed';
                this.root.active = false;
                this._playSfx('dismiss');
                return chosen;
            }
        }

        return -1;
    }

    /** Keyboard and pointer focus share the same highlighted card. */
    setHover (index) {
        if (this.phase !== 'entering' && this.phase !== 'open') return false;
        const next = Number.isInteger(index) && index >= 0 && index < this.opts.length ? index : -1;
        if (next !== this.hover) {
            this.hover = next;
            if (next >= 0) this._playSfx('focus');
        }
        return true;
    }

    moveFocus (direction) {
        if ((this.phase !== 'entering' && this.phase !== 'open') || !this.opts.length) return false;
        const start = this.hover < 0 ? (direction > 0 ? -1 : 0) : this.hover;
        const next = (start + (direction > 0 ? 1 : -1) + this.opts.length) % this.opts.length;
        if (next !== this.hover) {
            this.hover = next;
            this._playSfx('focus');
        }
        return true;
    }

    /** Start the chosen-card confirmation, keeping the run paused until update() returns its index. */
    select (i) {
        if ((this.phase !== 'entering' && this.phase !== 'open')
            || !Number.isInteger(i) || i < 0 || i >= this.opts.length) return false;
        this.selected = i;
        this.hover = i;
        this.phase = 'selecting';
        this.elapsed = 0;
        this.hint.string = `已选择：${this.opts[i].name}  ·  强化生效中`;
        this._playSfx('confirm');
        return true;
    }

    /** View-space pointer, same space the Input records - so a card is clickable where it is drawn. */
    hit (x, y) {
        if (!this.open || (this.phase !== 'entering' && this.phase !== 'open')) return -1;
        for (let i = 0; i < this.opts.length; i++) {
            const c = this.cards[i];
            const pos = c.node.position;
            const scale = Math.max(0.01, c.node.scale.x);
            if (Math.abs(x - pos.x) <= CARD_W * scale / 2
                && Math.abs(y - pos.y) <= CARD_H * scale / 2) return i;
        }
        return -1;
    }

    _drawCard (card, index, time) {
        const g = card.g;
        const entry = this.opts[index];
        if (!entry) return;
        g.clear();
        const focused = index === this.hover;
        const chosen = this.phase === 'selecting' && index === this.selected;
        const pulse = focused && !this.reduceMotion ? 0.5 + 0.5 * Math.sin(time * 3.2) : 0.5;

        // Soft drop shadow, then a raised parchment face for the current keyboard/pointer focus.
        g.fillColor = this.pal.get('#100d1b', focused ? 118 : 90);
        g.roundRect(-CARD_W / 2 + 2, -CARD_H / 2 - 6, CARD_W - 4, CARD_H, 18);
        g.fill();
        g.fillColor = this.pal.get(chosen || focused ? '#f7f1e3' : '#332d47', 255);
        g.roundRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 18);
        g.fill();

        const border = chosen || focused ? COL.gold
            : entry.rarity === 'legendary' ? '#c7a4ed' : '#625b78';
        g.strokeColor = this.pal.get(border, focused || chosen
            ? 225 + Math.round(30 * pulse) : 180);
        g.lineWidth = chosen ? 6 : focused ? 5 : entry.rarity === 'legendary' ? 3 : 2;
        g.roundRect(-CARD_W / 2 + 1.5, -CARD_H / 2 + 1.5, CARD_W - 3, CARD_H - 3, 17);
        g.stroke();

        // A small top rail carries rarity without taking space from the actual upgrade description.
        g.fillColor = this.pal.get(entry.rarity === 'legendary' ? COL.gold
            : focused || chosen ? '#c5a8fa' : '#756b8c', focused || chosen ? 255 : 200);
        g.roundRect(-44, CARD_H / 2 - 7, 88, 4, 2);
        g.fill();

        // The numbered chip makes the direct 1/2/3 shortcuts visible on the card itself.
        const chipX = CARD_W / 2 - 36;
        g.fillColor = this.pal.get(focused || chosen ? '#4b3d65' : '#4d465f', 235);
        g.roundRect(chipX - 16, CARD_H / 2 - 36, 32, 24, 7);
        g.fill();
        g.strokeColor = this.pal.get(entry.rarity === 'legendary' ? COL.gold : '#b9add1', 220);
        g.lineWidth = 1.5;
        g.roundRect(chipX - 16, CARD_H / 2 - 36, 32, 24, 7);
        g.stroke();

        const label = (component, color) => { component.color = this.pal.get(color, 255); };
        label(card.name, focused || chosen ? COL.text : COL.heroTrim);
        label(card.delta, focused || chosen ? '#74561c' : '#ffe08b');
        label(card.note, focused || chosen ? '#514865' : '#ded8e9');
        label(card.foot, focused || chosen ? '#655873' : entry.rarity === 'legendary' ? '#f3d785' : '#c9c0d9');
        card.keyLabel.string = card.key;
    }

    render (time) {
        const g = this.g;
        g.clear();
        g.fillColor = this.pal.get(COL.ink, Math.round(this.backgroundAlpha));
        g.rect(-VIEW.W / 2, -VIEW.H / 2, VIEW.W, VIEW.H);
        g.fill();

        const alpha = Math.max(0, Math.min(255, this.backgroundAlpha / 184 * 255));
        g.fillColor = this.pal.get('#211c32', Math.round(232 * alpha / 255));
        g.roundRect(-542, -258, 1084, 518, 26);
        g.fill();
        g.strokeColor = this.pal.get('#a78bd6', Math.round(120 * alpha / 255));
        g.lineWidth = 2;
        g.roundRect(-542, -258, 1084, 518, 26);
        g.stroke();
        g.strokeColor = this.pal.get('#6d5b92', Math.round(130 * alpha / 255));
        g.lineWidth = 1;
        g.moveTo(-420, 151);
        g.lineTo(420, 151);
        g.stroke();

        for (let i = 0; i < this.opts.length; i++) this._drawCard(this.cards[i], i, time);
    }
}
