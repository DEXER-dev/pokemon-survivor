import { VIEW, COL } from './config.js';
import { makeLabel } from './hud.js';
import { hexToRgb } from './batch.js';
import { Z_CRYSTALS, zMoveMetrics } from './items/z-power-band.js';

const CARD_W = 340;
const CARD_H = 168;
const PER_PAGE = 6;
const CARD_X = [-352, 0, 352];
const CARD_Y = [92, -104];

/** Pauses play while the player selects one Z-Crystal; inactive types remain visible but cannot be picked. */
export class ZCrystalSelector {
    constructor (cc, parent, pal) {
        this.cc = cc;
        this.pal = pal;
        this.root = new cc.Node('ZCrystalSelector');
        this.root.layer = cc.Layers.Enum.UI_2D;
        this.root.active = false;
        parent.addChild(this.root);
        this.g = this.root.addComponent(cc.Graphics);
        this.title = makeLabel(cc, this.root, 'ZCrystalTitle', 300, 30, '#ffe69a', 'center');
        this.subtitle = makeLabel(cc, this.root, 'ZCrystalSubtitle', 264, 17, '#fff7e8', 'center');
        this.pageLabel = makeLabel(cc, this.root, 'ZCrystalPage', -226, 16, '#ffe69a', 'center', 0, 180);
        this.hint = makeLabel(cc, this.root, 'ZCrystalHint', -270, 16, '#fff7e8', 'center');
        this.prevLabel = makeLabel(cc, this.root, 'ZCrystalPrev', -226, 20, '#fff7e8', 'center', -188, 110);
        this.nextLabel = makeLabel(cc, this.root, 'ZCrystalNext', -226, 20, '#fff7e8', 'center', 188, 110);
        this.cards = Array.from({ length: PER_PAGE }, (_, index) => {
            const x = CARD_X[index % 3];
            const y = CARD_Y[Math.floor(index / 3)];
            const iconNode = new cc.Node(`ZCrystalIcon${index}`);
            iconNode.layer = cc.Layers.Enum.UI_2D;
            iconNode.setPosition(x - 119, y + 20, 0);
            this.root.addChild(iconNode);
            const sprite = iconNode.addComponent(cc.Sprite);
            sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            iconNode.getComponent(cc.UITransform).setContentSize(58, 58);
            return {
                x, y, sprite,
                name: makeLabel(cc, this.root, `ZCrystalName${index}`, y + 46, 19,
                    '#fff7e8', 'left', x - 78, CARD_W - 100),
                count: makeLabel(cc, this.root, `ZCrystalCount${index}`, y + 15, 17,
                    '#fff7e8', 'left', x - 78, CARD_W - 100),
                range: makeLabel(cc, this.root, `ZCrystalRange${index}`, y - 18, 14,
                    '#ded5ee', 'left', x - 78, CARD_W - 100),
            };
        });
        this.entries = [];
        this.glyphs = {};
        this.page = 0;
        this.hover = -1;
        this.open = false;
    }

    show (segments, glyphs) {
        this.entries = Z_CRYSTALS.map((crystal) => {
            const count = segments[crystal.id] || 0;
            return { crystal, count, ...zMoveMetrics(count) };
        });
        this.glyphs = glyphs || {};
        this.page = 0;
        this.hover = -1;
        this.open = true;
        this.root.active = true;
        this.title.string = 'Z力量手环 · 选择Z纯晶';
        this.subtitle.string = '18 种属性各有专属弹幕 · 同属性宝可梦越多，弹体和爆发范围越大';
        this.hint.string = '点击或按 1–6 选择当前页 · [ ] 翻页 · Z 关闭 · 战斗已暂停';
        this.refresh();
        return true;
    }

    get pageCount () {
        return Math.max(1, Math.ceil(this.entries.length / PER_PAGE));
    }

    entryAt (slot) {
        if (!Number.isInteger(slot) || slot < 0 || slot >= PER_PAGE) return null;
        return this.entries[this.page * PER_PAGE + slot] || null;
    }

    turnPage (direction) {
        const next = Math.max(0, Math.min(this.pageCount - 1, this.page + direction));
        if (next === this.page) return false;
        this.page = next;
        this.hover = -1;
        this.refresh();
        return true;
    }

    refresh () {
        for (let i = 0; i < this.cards.length; i++) {
            const card = this.cards[i];
            const entry = this.entryAt(i);
            card.name.node.active = !!entry;
            card.count.node.active = !!entry;
            card.range.node.active = !!entry;
            card.sprite.node.active = !!entry;
            if (!entry) continue;
            const glyph = this.glyphs[entry.crystal.glyph];
            card.sprite.spriteFrame = glyph ? glyph.frame : null;
            card.sprite.color = this.pal.get(entry.crystal.color, entry.count ? 255 : 90);
            card.name.string = `[${i + 1}] ${entry.crystal.short} · ${entry.crystal.move}`;
            card.name.color = this.pal.get(entry.crystal.color, entry.count ? 255 : 145);
            card.count.string = entry.count ? `队伍属性宝可梦 ×${entry.count}` : '队伍暂无该属性';
            card.count.color = this.pal.get(entry.count ? '#fff7e8' : '#9992a8', 255);
            card.range.string = entry.count
                ? `爆发半径 ${Math.round(entry.radius)} px · 弹体 ×${entry.projectileScale.toFixed(1)}`
                : '捕捉该属性宝可梦后解锁';
        }
        this.pageLabel.string = `${this.page + 1} / ${this.pageCount} · ${this.entries.length} 种属性`;
        this.prevLabel.string = this.page > 0 ? '‹ 上一页' : '';
        this.nextLabel.string = this.page + 1 < this.pageCount ? '下一页 ›' : '';
    }

    hide () {
        this.open = false;
        this.hover = -1;
        this.root.active = false;
    }

    hit (x, y) {
        if (!this.open) return -1;
        if (this.page > 0 && Math.abs(x + 188) <= 58 && Math.abs(y + 226) <= 18) return -2;
        if (this.page + 1 < this.pageCount && Math.abs(x - 188) <= 58 && Math.abs(y + 226) <= 18) return -3;
        for (let i = 0; i < this.cards.length; i++) {
            const card = this.cards[i];
            if (this.entryAt(i) && Math.abs(x - card.x) <= CARD_W / 2
                && Math.abs(y - card.y) <= CARD_H / 2) return i;
        }
        return -1;
    }

    render (time) {
        const g = this.g;
        g.clear();
        g.fillColor = this.pal.get(COL.ink, 202);
        g.rect(-VIEW.W / 2, -VIEW.H / 2, VIEW.W, VIEW.H);
        g.fill();
        for (let i = 0; i < this.cards.length; i++) {
            const card = this.cards[i];
            const entry = this.entryAt(i);
            if (!entry) continue;
            const selected = i === this.hover;
            const enabled = entry.count > 0;
            const pulse = selected ? 0.5 + 0.5 * Math.sin(time * 7) : 0;
            const crystal = entry.crystal;
            if (!crystal) continue;
            const [r, green, b] = hexToRgb(crystal.color || '#ffe69a');
            g.fillColor = this.pal.get(selected ? '#42324f' : '#29243a', 250);
            g.rect(card.x - CARD_W / 2, card.y - CARD_H / 2, CARD_W, CARD_H);
            g.fill();
            g.strokeColor = enabled
                ? new this.cc.Color(r, green, b, selected ? 205 + Math.round(50 * pulse) : 210)
                : this.pal.get('#716b7b', 130);
            g.lineWidth = selected ? 5 : 2;
            g.rect(card.x - CARD_W / 2, card.y - CARD_H / 2, CARD_W, CARD_H);
            g.stroke();
        }
        if (this.page > 0 || this.page + 1 < this.pageCount) {
            g.strokeColor = this.pal.get('#ffe69a', 210);
            g.lineWidth = 2;
            if (this.page > 0) { g.rect(-248, -245, 120, 38); g.stroke(); }
            if (this.page + 1 < this.pageCount) { g.rect(128, -245, 120, 38); g.stroke(); }
        }
    }
}
