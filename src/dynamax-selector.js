/* Pauses play while the player chooses one eligible team link for the Dynamax Band. */
import { VIEW, COL } from './config.js';
import { makeLabel } from './hud.js';
import { displayName, iconKey } from './species.js';

const PER_PAGE = 8;
const CARD_W = 270;
const CARD_H = 174;
const CARD_X = [-444, -148, 148, 444];
const CARD_Y = [82, -108];

export class DynamaxSelector {
    constructor (cc, parent, pal) {
        this.cc = cc;
        this.pal = pal;
        this.root = new cc.Node('DynamaxBandSelector');
        this.root.layer = cc.Layers.Enum.UI_2D;
        this.root.active = false;
        parent.addChild(this.root);
        this.g = this.root.addComponent(cc.Graphics);
        this.title = makeLabel(cc, this.root, 'DynamaxTitle', 268, 29, '#ff7a82', 'center');
        this.subtitle = makeLabel(cc, this.root, 'DynamaxSubtitle', 233, 17, '#fff3e8', 'center');
        this.pageLabel = makeLabel(cc, this.root, 'DynamaxPage', -226, 16, '#ffd5d8', 'center', 0, 250);
        this.hint = makeLabel(cc, this.root, 'DynamaxHint', -270, 16, '#fff3e8', 'center');
        this.prevLabel = makeLabel(cc, this.root, 'DynamaxPrev', -226, 20, '#fff3e8', 'center', -188, 100);
        this.nextLabel = makeLabel(cc, this.root, 'DynamaxNext', -226, 20, '#fff3e8', 'center', 188, 100);
        this.cards = [];
        for (let i = 0; i < PER_PAGE; i++) {
            const x = CARD_X[i % 4];
            const y = CARD_Y[Math.floor(i / 4)];
            const iconNode = new cc.Node(`DynamaxPokemonIcon${i}`);
            iconNode.layer = cc.Layers.Enum.UI_2D;
            iconNode.setPosition(x, y + 34, 0);
            this.root.addChild(iconNode);
            const sprite = iconNode.addComponent(cc.Sprite);
            sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            iconNode.getComponent(cc.UITransform).setContentSize(54, 54);
            this.cards.push({
                x, y, sprite,
                name: makeLabel(cc, this.root, `DynamaxPokemonName${i}`, y - 8, 18,
                    '#fff9ec', 'center', x, CARD_W - 18),
                detail: makeLabel(cc, this.root, `DynamaxPokemonDetail${i}`, y - 38, 15,
                    '#ffc6c9', 'center', x, CARD_W - 18),
                key: makeLabel(cc, this.root, `DynamaxPokemonKey${i}`, y - 66, 14,
                    '#d9cbed', 'center', x, CARD_W - 18),
            });
        }
        this.entries = [];
        this.glyphs = null;
        this.page = 0;
        this.hover = -1;
        this.open = false;
    }

    show (entries, glyphs) {
        this.entries = entries;
        this.glyphs = glyphs || null;
        this.page = 0;
        this.hover = -1;
        this.open = entries.length > 0;
        this.root.active = this.open;
        this.title.string = '极巨手环 · 选择宝可梦';
        this.subtitle.string = '强化 30 秒 · 体型与弹幕增大 · MEGA / 超极巨化不可选';
        this.hint.string = '点击或按 1–8 选择 · [ ] 翻页 · G 取消 · 战斗已暂停';
        this.refresh();
        return this.open;
    }

    hide () {
        this.open = false;
        this.entries = [];
        this.hover = -1;
        this.root.active = false;
    }

    get pageCount () {
        return Math.max(1, Math.ceil(this.entries.length / PER_PAGE));
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
        const start = this.page * PER_PAGE;
        for (let i = 0; i < PER_PAGE; i++) {
            const card = this.cards[i];
            const entry = this.entries[start + i];
            card.name.node.active = !!entry;
            card.detail.node.active = !!entry;
            card.key.node.active = !!entry;
            card.sprite.node.active = !!entry;
            if (!entry) continue;
            const seg = entry.seg;
            const icon = this.glyphs && this.glyphs[iconKey(seg.fam, seg.tier)];
            card.sprite.spriteFrame = icon ? icon.frame : null;
            card.sprite.node.active = !!icon;
            card.name.string = displayName(seg.fam, seg.tier);
            card.detail.string = `${seg.tier} 阶 · 队伍 ×${seg.count}`;
            card.key.string = `[${i + 1}]`;
        }
        this.pageLabel.string = `${this.page + 1} / ${this.pageCount}`;
        this.prevLabel.string = this.page > 0 ? '‹ 上一页' : '';
        this.nextLabel.string = this.page + 1 < this.pageCount ? '下一页 ›' : '';
    }

    hit (x, y) {
        if (!this.open) return -1;
        if (this.page > 0 && Math.abs(x + 188) <= 58 && Math.abs(y + 226) <= 18) return -2;
        if (this.page + 1 < this.pageCount && Math.abs(x - 188) <= 58 && Math.abs(y + 226) <= 18) return -3;
        for (let i = 0; i < PER_PAGE; i++) {
            const entry = this.entries[this.page * PER_PAGE + i];
            const card = this.cards[i];
            if (entry && Math.abs(x - card.x) <= CARD_W / 2 && Math.abs(y - card.y) <= CARD_H / 2) return i;
        }
        return -1;
    }

    render (time) {
        const g = this.g;
        g.clear();
        g.fillColor = this.pal.get(COL.ink, 198);
        g.rect(-VIEW.W / 2, -VIEW.H / 2, VIEW.W, VIEW.H);
        g.fill();
        const start = this.page * PER_PAGE;
        for (let i = 0; i < PER_PAGE; i++) {
            if (!this.entries[start + i]) continue;
            const card = this.cards[i];
            const selected = i === this.hover;
            const pulse = selected ? 0.5 + 0.5 * Math.sin(time * 7) : 0;
            g.fillColor = this.pal.get(selected ? '#50313f' : '#29243a', 252);
            g.rect(card.x - CARD_W / 2, card.y - CARD_H / 2, CARD_W, CARD_H);
            g.fill();
            g.strokeColor = this.pal.get(selected ? '#fff2d7' : '#f06470',
                selected ? 210 + Math.round(45 * pulse) : 225);
            g.lineWidth = selected ? 5 : 2;
            g.rect(card.x - CARD_W / 2, card.y - CARD_H / 2, CARD_W, CARD_H);
            g.stroke();
        }
        if (this.page > 0 || this.page + 1 < this.pageCount) {
            g.strokeColor = this.pal.get('#ff8c91', 225);
            g.lineWidth = 2;
            if (this.page > 0) { g.rect(-248, -245, 120, 38); g.stroke(); }
            if (this.page + 1 < this.pageCount) { g.rect(128, -245, 120, 38); g.stroke(); }
        }
    }
}
