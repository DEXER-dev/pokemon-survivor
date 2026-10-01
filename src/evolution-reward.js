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
const ENTER_TIME = 0.32;
const ENTER_STAGGER = 0.045;
const SELECT_TIME = 0.38;
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const outCubic = (t) => 1 - Math.pow(1 - clamp01(t), 3);
const outBack = (t) => {
    const x = clamp01(t) - 1;
    return 1 + 2.15 * x * x * x + 1.15 * x * x;
};

export class EvolutionReward {
    constructor (cc, parent, pal) {
        this.cc = cc;
        this.pal = pal;
        this.root = new cc.Node('BossEvolutionReward');
        this.root.layer = cc.Layers.Enum.UI_2D;
        this.root.active = false;
        parent.addChild(this.root);
        this.g = this.root.addComponent(cc.Graphics);
        this.header = new cc.Node('RewardHeader');
        this.header.layer = cc.Layers.Enum.UI_2D;
        this.root.addChild(this.header);
        this.headerOpacity = this.header.addComponent(cc.UIOpacity);
        this.title = makeLabel(cc, this.header, 'RewardTitle', 264, 30, '#ffe6a6', 'center');
        this.subtitle = makeLabel(cc, this.header, 'RewardSubtitle', 226, 17, '#fff9ec', 'center');
        this.pageLabel = makeLabel(cc, this.header, 'RewardPage', -226, 17, '#ffe6a6', 'center', 0, 250);
        this.hint = makeLabel(cc, this.header, 'RewardHint', -270, 16, '#fff9ec', 'center');
        this.prevLabel = makeLabel(cc, this.header, 'RewardPrev', -226, 20, '#fff9ec', 'center', -188, 100);
        this.nextLabel = makeLabel(cc, this.header, 'RewardNext', -226, 20, '#fff9ec', 'center', 188, 100);
        this.cards = [];
        for (let i = 0; i < PER_PAGE; i++) {
            const x = CARD_X[i % 4];
            const y = CARD_Y[Math.floor(i / 4)];
            const node = new cc.Node(`RewardCard${i}`);
            node.layer = cc.Layers.Enum.UI_2D;
            node.setPosition(x, y, 0);
            this.root.addChild(node);
            const opacity = node.addComponent(cc.UIOpacity);
            const cardGraphics = node.addComponent(cc.Graphics);
            const currentNode = new cc.Node(`RewardCurrentIcon${i}`);
            currentNode.layer = cc.Layers.Enum.UI_2D;
            currentNode.setPosition(-45, 34, 0);
            node.addChild(currentNode);
            const currentSprite = currentNode.addComponent(cc.Sprite);
            currentSprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            currentNode.getComponent(cc.UITransform).setContentSize(54, 54);

            const nextNode = new cc.Node(`RewardNextIcon${i}`);
            nextNode.layer = cc.Layers.Enum.UI_2D;
            nextNode.setPosition(45, 34, 0);
            node.addChild(nextNode);
            const nextSprite = nextNode.addComponent(cc.Sprite);
            nextSprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            nextNode.getComponent(cc.UITransform).setContentSize(54, 54);

            this.cards.push({
                x, y, node, opacity, g: cardGraphics, focus: 0,
                currentSprite, nextSprite,
                name: makeLabel(cc, node, `RewardName${i}`, -8, 18, '#fff9ec', 'center', 0, CARD_W - 18),
                stage: makeLabel(cc, node, `RewardStage${i}`, -34, 15, '#ffe6a6', 'center', 0, CARD_W - 18),
                count: makeLabel(cc, node, `RewardCount${i}`, -62, 14, '#d8d0e8', 'center', 0, CARD_W - 18),
                key: makeLabel(cc, node, `RewardKey${i}`, -80, 13, '#c6b8ed', 'center', 0, CARD_W - 18),
            });
        }
        this.entries = [];
        this.glyphs = null;
        this.page = 0;
        this.hover = 0;
        this.pageHover = -1;
        this.selected = -1;
        this.open = false;
        this.phase = 'closed';
        this.elapsed = 0;
        this.backgroundAlpha = 0;
        this.pageDirection = 1;
        this.onSfx = null;
        this.reduceMotion = typeof window !== 'undefined'
            && typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.enterTime = this.reduceMotion ? 0.16 : ENTER_TIME;
        this.enterStagger = this.reduceMotion ? 0.015 : ENTER_STAGGER;
        this.selectTime = this.reduceMotion ? 0.16 : SELECT_TIME;
    }

    setSfx (callback) {
        this.onSfx = typeof callback === 'function' ? callback : null;
    }

    _playSfx (event) {
        if (this.onSfx) this.onSfx(event);
    }

    _syncFocusPalette () {
        for (let i = 0; i < PER_PAGE; i++) {
            const card = this.cards[i];
            const focused = i === this.hover;
            card.name.color = this.pal.get(focused ? '#3d304b' : '#fff9ec');
            card.stage.color = this.pal.get(focused ? '#70531c' : '#ffe6a6');
            card.count.color = this.pal.get(focused ? '#5d536d' : '#d8d0e8');
            card.key.color = this.pal.get(focused ? '#655873' : '#c6b8ed');
        }
    }

    show (entries, glyphs, source = 'boss') {
        this.entries = entries;
        this.glyphs = glyphs || null;
        this.source = source;
        this.page = 0;
        this.hover = entries.length ? 0 : -1;
        this.pageHover = -1;
        this.selected = -1;
        this.open = entries.length > 0;
        this.phase = this.open ? 'entering' : 'closed';
        this.elapsed = 0;
        this.backgroundAlpha = 0;
        this.headerOpacity.opacity = 0;
        this.header.setPosition(0, -12, 0);
        this.root.active = this.open;
        const candy = source === 'rare-candy';
        this.title.string = candy ? '奇异糖果 · 进化' : 'BOSS奖励 · 进化';
        this.subtitle.string = candy
            ? '选择队伍中的一只宝可梦，免费进化一个阶段'
            : '选择队伍中的一只宝可梦，免费进化到下一形态';
        this.hint.string = candy
            ? '点击或按 1–8 选择 · ← / → 移动焦点 · 空格确认 · 进化不消耗队伍数量'
            : '点击或按 1–8 选择 · ← / → 移动焦点 · 空格确认 · 战斗已暂停';
        this.refresh();
        this._syncFocusPalette();
        for (let i = 0; i < this.cards.length; i++) {
            const card = this.cards[i];
            card.focus = i === this.hover ? 1 : 0;
            card.node.setPosition(card.x, card.y - (this.reduceMotion ? 8 : 48), 0);
            const scale = this.reduceMotion ? 0.96 : 0.86;
            card.node.setScale(scale, scale, 1);
            card.opacity.opacity = 0;
        }
        if (this.open) this._playSfx('appear');
        return this.open;
    }

    hide () {
        this.open = false;
        this.entries = [];
        this.hover = -1;
        this.pageHover = -1;
        this.selected = -1;
        this.phase = 'closed';
        this.elapsed = 0;
        this.backgroundAlpha = 0;
        this.root.active = false;
    }

    get pageCount () {
        return Math.max(1, Math.ceil(this.entries.length / PER_PAGE));
    }

    update (dt) {
        if (!this.root.active || this.phase === 'closed') return -1;
        dt = Math.max(0, Math.min(0.2, Number(dt) || 0));
        this.elapsed += dt;

        if (this.phase === 'entering' || this.phase === 'paging') {
            const entering = this.phase === 'entering';
            const headerT = outCubic(this.elapsed / (entering ? 0.3 : 0.18));
            if (entering) this.backgroundAlpha = Math.round(194 * outCubic(this.elapsed / 0.28));
            this.headerOpacity.opacity = Math.round(255 * headerT);
            this.header.setPosition(0, entering ? -12 * (1 - headerT) : 0, 0);
            for (let i = 0; i < PER_PAGE; i++) {
                const card = this.cards[i];
                const visible = !!this.entries[this.page * PER_PAGE + i];
                if (!visible) continue;
                const t = clamp01((this.elapsed - (entering ? i * this.enterStagger : i * 0.018))
                    / (entering ? this.enterTime : 0.22));
                const fade = outCubic(t);
                const pop = this.reduceMotion ? fade : Math.max(0, outBack(t));
                const focus = i === this.hover ? 1 : 0;
                card.focus += (focus - card.focus) * (1 - Math.exp(-dt * 14));
                if (entering) {
                    card.node.setPosition(card.x,
                        card.y - (this.reduceMotion ? 8 : 48) * (1 - fade) + 5 * card.focus * fade, 0);
                } else {
                    const startX = card.x + this.pageDirection * 22;
                    card.node.setPosition(startX + (card.x - startX) * fade,
                        card.y + 5 * card.focus * fade, 0);
                }
                const startScale = this.reduceMotion ? 0.96 : 0.86;
                const scale = (startScale + (1 - startScale) * Math.min(1.06, pop))
                    * (1 + 0.035 * card.focus * fade);
                card.node.setScale(scale, scale, 1);
                card.opacity.opacity = Math.round(255 * fade);
            }
            const stagger = entering ? this.enterStagger : 0.018;
            const duration = entering ? this.enterTime : 0.22;
            if (this.elapsed >= duration + stagger * (Math.min(PER_PAGE, this.entries.length - this.page * PER_PAGE) - 1)) {
                this.phase = 'open';
                this.elapsed = 0;
            }
        } else if (this.phase === 'open') {
            this.backgroundAlpha = 194;
            this.headerOpacity.opacity = 255;
            this.header.setPosition(0, 0, 0);
            for (let i = 0; i < PER_PAGE; i++) {
                const card = this.cards[i];
                if (!this.entries[this.page * PER_PAGE + i]) continue;
                const target = i === this.hover ? 1 : 0;
                card.focus += (target - card.focus) * (1 - Math.exp(-dt * 14));
                const scale = 1 + card.focus * (this.reduceMotion ? 0.015 : 0.035);
                card.node.setPosition(card.x, card.y + card.focus * (this.reduceMotion ? 0 : 5), 0);
                card.node.setScale(scale, scale, 1);
                card.opacity.opacity = 255;
            }
        } else if (this.phase === 'selecting') {
            const t = clamp01(this.elapsed / this.selectTime);
            const ease = outCubic(t);
            this.backgroundAlpha = Math.round(194 * (1 - ease));
            this.headerOpacity.opacity = Math.round(255 * (1 - ease));
            this.header.setPosition(0, 10 * ease, 0);
            for (let i = 0; i < PER_PAGE; i++) {
                const card = this.cards[i];
                if (!this.entries[this.page * PER_PAGE + i]) continue;
                if (i === this.selected) {
                    const dissolve = outCubic((t - 0.5) / 0.5);
                    const scale = 1.035 + (this.reduceMotion ? 0.035 : 0.11) * ease;
                    card.node.setPosition(card.x, card.y + 5 + (this.reduceMotion ? 4 : 36) * ease, 0);
                    card.node.setScale(scale, scale, 1);
                    card.opacity.opacity = Math.round(255 * (1 - dissolve));
                } else {
                    card.node.setPosition(card.x, card.y - (this.reduceMotion ? 2 : 18) * ease, 0);
                    card.node.setScale(1 - 0.1 * ease, 1 - 0.1 * ease, 1);
                    card.opacity.opacity = Math.round(255 * (1 - outCubic(t / 0.7)));
                }
            }
            if (t >= 1) {
                const chosen = this.selected;
                this.open = false;
                this.phase = 'closed';
                this.hover = -1;
                this.selected = -1;
                this.root.active = false;
                this._playSfx('dismiss');
                return chosen;
            }
        }
        return -1;
    }

    refresh () {
        const start = this.page * PER_PAGE;
        for (let i = 0; i < PER_PAGE; i++) {
            const card = this.cards[i];
            const entry = this.entries[start + i];
            const visible = !!entry;
            card.node.active = visible;
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

    turnPage (direction) {
        if (this.phase !== 'open') return false;
        const next = Math.max(0, Math.min(this.pageCount - 1, this.page + direction));
        if (next === this.page) return false;
        this.pageDirection = Math.sign(direction) || 1;
        this.page = next;
        this.hover = 0;
        this.pageHover = -1;
        this.elapsed = 0;
        this.phase = 'paging';
        for (const card of this.cards) {
            card.focus = 0;
            card.node.setPosition(card.x + this.pageDirection * 22, card.y, 0);
            card.node.setScale(0.94, 0.94, 1);
            card.opacity.opacity = 0;
        }
        this.refresh();
        this._syncFocusPalette();
        this._playSfx('focus');
        return true;
    }

    hit (x, y) {
        if (!this.open || (this.phase !== 'entering' && this.phase !== 'open')) return -1;
        if (this.page > 0 && Math.abs(x + 188) <= 58 && Math.abs(y + 226) <= 18) return -2;
        if (this.page + 1 < this.pageCount && Math.abs(x - 188) <= 58 && Math.abs(y + 226) <= 18) return -3;
        for (let i = 0; i < PER_PAGE; i++) {
            const entry = this.entries[this.page * PER_PAGE + i];
            const card = this.cards[i];
            if (!entry) continue;
            const scale = Math.max(0.01, card.node.scale.x);
            if (Math.abs(x - card.node.position.x) <= CARD_W * scale / 2
                && Math.abs(y - card.node.position.y) <= CARD_H * scale / 2) return i;
        }
        return -1;
    }

    setHover (index) {
        if (this.phase !== 'entering' && this.phase !== 'open') return false;
        this.pageHover = -1;
        const next = Number.isInteger(index) && index >= 0
            && index < PER_PAGE && nextEntry(this.entries, this.page, index) ? index : -1;
        if (next !== this.hover) {
            this.hover = next;
            this._syncFocusPalette();
            if (next >= 0) this._playSfx('focus');
        }
        return true;
    }

    setPageHover (index) {
        const next = index === -2 || index === -3 ? index : -1;
        if (next !== this.pageHover) {
            this.pageHover = next;
            if (next !== -1) this._playSfx('focus');
        }
    }

    moveFocus (direction) {
        if ((this.phase !== 'entering' && this.phase !== 'open') || !this.entries.length) return false;
        this.pageHover = -1;
        const count = Math.min(PER_PAGE, this.entries.length - this.page * PER_PAGE);
        if ((direction > 0 && this.hover === count - 1 && this.page + 1 < this.pageCount)
            || (direction < 0 && this.hover === 0 && this.page > 0)) {
            return this.turnPage(direction);
        }
        const start = this.hover < 0 ? (direction > 0 ? -1 : 0) : this.hover;
        const next = (start + (direction > 0 ? 1 : -1) + count) % count;
        this.setHover(next);
        return true;
    }

    select (index) {
        if ((this.phase !== 'entering' && this.phase !== 'open')
            || !Number.isInteger(index) || index < 0 || index >= PER_PAGE
            || !nextEntry(this.entries, this.page, index)) return false;
        this.selected = index;
        this.hover = index;
        this.pageHover = -1;
        this._syncFocusPalette();
        this.phase = 'selecting';
        this.elapsed = 0;
        this.hint.string = `已选择：${this.cards[index].name.string} · 正在完成进化`;
        this._playSfx('confirm');
        return true;
    }

    render (time) {
        const g = this.g;
        g.clear();
        const alpha = Math.round(this.backgroundAlpha);
        g.fillColor = this.pal.get(COL.ink, alpha);
        g.rect(-VIEW.W / 2, -VIEW.H / 2, VIEW.W, VIEW.H);
        g.fill();
        const opacity = clamp01(alpha / 194);
        g.fillColor = this.pal.get('#211c32', Math.round(232 * opacity));
        g.roundRect(-542, -258, 1084, 518, 26);
        g.fill();
        g.strokeColor = this.pal.get('#a78bd6', Math.round(130 * opacity));
        g.lineWidth = 2;
        g.roundRect(-542, -258, 1084, 518, 26);
        g.stroke();
        g.strokeColor = this.pal.get(COL.gold, Math.round(130 * opacity));
        g.lineWidth = 2;
        g.moveTo(-420, 194);
        g.lineTo(420, 194);
        g.stroke();
        const start = this.page * PER_PAGE;
        for (let i = 0; i < PER_PAGE; i++) {
            if (!this.entries[start + i]) continue;
            const c = this.cards[i];
            const on = i === this.hover;
            const selected = this.phase === 'selecting' && i === this.selected;
            const pulse = on && !this.reduceMotion ? 0.5 + 0.5 * Math.sin(time * 6.4) : 0.5;
            const x = c.node.position.x;
            const y = c.node.position.y;
            const scale = c.node.scale.x;
            const w = CARD_W * scale;
            const h = CARD_H * scale;
            const cardG = c.g;
            cardG.clear();
            cardG.fillColor = this.pal.get('#100d1b', on ? 115 : 88);
            cardG.roundRect(-w / 2 + 2, -h / 2 - 5, w - 4, h, 16);
            cardG.fill();
            cardG.fillColor = this.pal.get(on || selected ? '#f7f1e3' : '#332d47', 255);
            cardG.roundRect(-w / 2, -h / 2, w, h, 16);
            cardG.fill();
            cardG.strokeColor = this.pal.get(selected || on ? COL.gold : COL.accent,
                on || selected ? 215 + Math.round(40 * pulse) : 205);
            cardG.lineWidth = selected ? 5 : on ? 4 : 2;
            cardG.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 15);
            cardG.stroke();
            cardG.fillColor = this.pal.get(on || selected ? COL.gold : '#756b8c', on ? 250 : 190);
            cardG.roundRect(-42, h / 2 - 6, 84, 4, 2);
            cardG.fill();
            cardG.fillColor = this.pal.get(on || selected ? '#4b3d65' : '#4d465f', 235);
            cardG.roundRect(w / 2 - 36, h / 2 - 34, 30, 22, 6);
            cardG.fill();
            cardG.strokeColor = this.pal.get('#b9add1', 220);
            cardG.lineWidth = 1.5;
            cardG.roundRect(w / 2 - 36, h / 2 - 34, 30, 22, 6);
            cardG.stroke();
        }
        if (this.pageCount > 1 && this.page > 0) {
            g.strokeColor = this.pal.get(COL.gold, 220);
            g.lineWidth = 3;
            g.rect(-248, -245, 120, 38);
            g.stroke();
        }
        if (this.pageCount > 1 && this.page + 1 < this.pageCount) {
            g.strokeColor = this.pal.get(COL.gold, 220);
            g.lineWidth = 3;
            g.rect(128, -245, 120, 38);
            g.stroke();
        }
    }
}

function nextEntry (entries, page, index) {
    return !!entries[page * PER_PAGE + index];
}
