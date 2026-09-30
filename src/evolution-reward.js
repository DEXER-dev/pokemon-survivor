/*
 * Boss reward: pause the run and let the player choose one living chain link with a real next
 * Pokédex stage. The panel pages rather than hiding choices once the chain grows past one screen.
 */
import { VIEW, COL } from './config.js';
import { makeLabel } from './hud.js';
import { displayName, iconKey, shinyKey } from './species.js';

const PER_PAGE = 8;
const CARD_W = 270;
const CARD_H = 174;
const CARD_X = [-444, -148, 148, 444];
const CARD_Y = [82, -108];

export class EvolutionReward {
    constructor (cc, parent, pal) {
        this.cc = cc;
        this.pal = pal;
        this.root = new cc.Node('BossEvolutionReward');
        this.root.layer = cc.Layers.Enum.UI_2D;
        this.root.active = false;
        parent.addChild(this.root);
        this.g = this.root.addComponent(cc.Graphics);
        this.title = makeLabel(cc, this.root, 'RewardTitle', 264, 30, '#ffe6a6', 'center');
        this.subtitle = makeLabel(cc, this.root, 'RewardSubtitle', 226, 17, '#fff9ec', 'center');
        this.pageLabel = makeLabel(cc, this.root, 'RewardPage', -226, 17, '#ffe6a6', 'center', 0, 250);
        this.hint = makeLabel(cc, this.root, 'RewardHint', -270, 16, '#fff9ec', 'center');
        this.prevLabel = makeLabel(cc, this.root, 'RewardPrev', -226, 20, '#fff9ec', 'center', -188, 100);
        this.nextLabel = makeLabel(cc, this.root, 'RewardNext', -226, 20, '#fff9ec', 'center', 188, 100);
        this.cards = [];
        for (let i = 0; i < PER_PAGE; i++) {
            const x = CARD_X[i % 4];
            const y = CARD_Y[Math.floor(i / 4)];
            const currentNode = new cc.Node(`RewardCurrentIcon${i}`);
            currentNode.layer = cc.Layers.Enum.UI_2D;
            currentNode.setPosition(x - 45, y + 34, 0);
            this.root.addChild(currentNode);
            const currentSprite = currentNode.addComponent(cc.Sprite);
            currentSprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            currentNode.getComponent(cc.UITransform).setContentSize(54, 54);

            const nextNode = new cc.Node(`RewardNextIcon${i}`);
            nextNode.layer = cc.Layers.Enum.UI_2D;
            nextNode.setPosition(x + 45, y + 34, 0);
            this.root.addChild(nextNode);
            const nextSprite = nextNode.addComponent(cc.Sprite);
            nextSprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            nextNode.getComponent(cc.UITransform).setContentSize(54, 54);

            this.cards.push({
                x, y,
                currentSprite, nextSprite,
                name: makeLabel(cc, this.root, `RewardName${i}`, y - 8, 18, '#fff9ec', 'center', x, CARD_W - 18),
                stage: makeLabel(cc, this.root, `RewardStage${i}`, y - 34, 15, '#ffe6a6', 'center', x, CARD_W - 18),
                count: makeLabel(cc, this.root, `RewardCount${i}`, y - 62, 14, '#d8d0e8', 'center', x, CARD_W - 18),
                key: makeLabel(cc, this.root, `RewardKey${i}`, y - 80, 13, '#c6b8ed', 'center', x, CARD_W - 18),
            });
        }
        this.entries = [];
        this.glyphs = null;
        this.page = 0;
        this.hover = -1;
        this.open = false;
    }

    show (entries, glyphs, source = 'boss') {
        this.entries = entries;
        this.glyphs = glyphs || null;
        this.source = source;
        this.page = 0;
        this.hover = -1;
        this.open = entries.length > 0;
        this.root.active = this.open;
        const candy = source === 'rare-candy';
        this.title.string = candy ? '奇异糖果 · 进化' : 'BOSS奖励 · 进化';
        this.subtitle.string = candy
            ? '选择队伍中的一只宝可梦，免费进化一个阶段'
            : '选择队伍中的一只宝可梦，免费进化到下一形态';
        this.hint.string = candy
            ? '点击宝可梦或按 1–8 选择 · 进化不消耗队伍数量'
            : '点击宝可梦或按 1–8 选择 · 战斗已暂停';
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

    refresh () {
        const start = this.page * PER_PAGE;
        for (let i = 0; i < PER_PAGE; i++) {
            const card = this.cards[i];
            const entry = this.entries[start + i];
            const visible = !!entry;
            card.name.node.active = visible;
            card.stage.node.active = visible;
            card.count.node.active = visible;
            card.key.node.active = visible;
            if (!visible) {
                card.currentSprite.node.active = false;
                card.nextSprite.node.active = false;
                continue;
            }
            const seg = entry.seg;
            const fromBase = iconKey(seg.fam, seg.tier);
            const toBase = iconKey(seg.fam, seg.tier + 1);
            const fromKey = seg.shiny && fromBase && this.glyphs && this.glyphs[shinyKey(fromBase)]
                ? shinyKey(fromBase) : fromBase;
            const toKey = seg.shiny && toBase && this.glyphs && this.glyphs[shinyKey(toBase)]
                ? shinyKey(toBase) : toBase;
            const from = this.glyphs && this.glyphs[fromKey];
            const to = this.glyphs && this.glyphs[toKey];
            card.currentSprite.spriteFrame = from ? from.frame : null;
            card.nextSprite.spriteFrame = to ? to.frame : null;
            card.currentSprite.node.active = !!from;
            card.nextSprite.node.active = !!to;
            card.name.string = `${seg.shiny ? '✨ 闪光' : ''}${displayName(seg.fam, seg.tier)} → ${displayName(seg.fam, seg.tier + 1)}`;
            card.stage.string = `${seg.tier}阶进化为 ${seg.tier + 1}阶`;
            card.count.string = `队伍数量 ×${seg.count}`;
            card.key.string = `[${i + 1}]`;
        }
        const pages = this.pageCount;
        this.pageLabel.string = `${this.page + 1} / ${pages}`;
        this.prevLabel.string = this.page > 0 ? '‹ 上一页' : '';
        this.nextLabel.string = this.page + 1 < pages ? '下一页 ›' : '';
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
        g.fillColor = this.pal.get(COL.ink, 194);
        g.rect(-VIEW.W / 2, -VIEW.H / 2, VIEW.W, VIEW.H);
        g.fill();
        const start = this.page * PER_PAGE;
        for (let i = 0; i < PER_PAGE; i++) {
            if (!this.entries[start + i]) continue;
            const c = this.cards[i];
            const on = i === this.hover;
            const pulse = on ? 0.5 + 0.5 * Math.sin(time * 7) : 0;
            g.fillColor = this.pal.get(on ? '#4e376f' : '#29243a', 250);
            g.rect(c.x - CARD_W / 2, c.y - CARD_H / 2, CARD_W, CARD_H);
            g.fill();
            g.strokeColor = this.pal.get(on ? COL.gold : COL.accent, on ? 205 + Math.round(50 * pulse) : 220);
            g.lineWidth = on ? 5 : 2;
            g.rect(c.x - CARD_W / 2, c.y - CARD_H / 2, CARD_W, CARD_H);
            g.stroke();
        }
        if (this.page > 0) {
            g.strokeColor = this.pal.get(COL.gold, 220);
            g.lineWidth = 3;
            g.rect(-248, -245, 120, 38);
            g.stroke();
        }
        if (this.page + 1 < this.pageCount) {
            g.strokeColor = this.pal.get(COL.gold, 220);
            g.lineWidth = 3;
            g.rect(128, -245, 120, 38);
            g.stroke();
        }
    }
}
