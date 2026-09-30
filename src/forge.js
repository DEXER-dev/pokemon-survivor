/*
 * 队伍管理 (§5.5-D): pauses the world while the player reviews the chain, releases a segment for EXP
 * and 融核, or manually evolves a selected segment.
 */

import { VIEW, COL, CHAIN, FURNACE, MUTATIONS } from './config.js';
import { segDps } from './combat.js';
import { evolveGate } from './chain.js';
import { displayName, dexText, typeText } from './species.js';
import { makeLabel } from './hud.js';

const ROW = 20;
const COLS = 2;
const ROWS = 16;
// v0.9: the row is a 图鉴 entry now (名字 · 编号 · 属性 · 阶/只 · dps · 门), and 水晶灯火灵 is five
// characters wide, so the old 292 px clipped it. 360 still clears the button column's left edge (212).
const ROW_W = 360;
const LIST_X = -VIEW.W / 2 + 40;
const BTN_W = 388;
const BTN_H = 54;
const BTN_X = VIEW.W / 2 - BTN_W / 2 - 40;
// Three actions: release, evolve, close. The old tier-4 forge recipe has been removed.
const ACT = ['release', 'evolve', 'close'];

/** A released link returns EXP and a small amount of 融核. */
export function refund (seg) {
    return {
        exp: Math.round(seg.count * FURNACE.expBack),
        cores: Math.floor(seg.count / FURNACE.coreEvery),
    };
}

export class Furnace {
    constructor (cc, parent, pal) {
        this.pal = pal;
        this.root = new cc.Node('Furnace');
        this.root.layer = cc.Layers.Enum.UI_2D;
        this.root.active = false;
        parent.addChild(this.root);
        this.g = this.root.addComponent(cc.Graphics);

        this.title = makeLabel(cc, this.root, 'Title', 326, 24, COL.heroTrim, 'center');
        this.foot = makeLabel(cc, this.root, 'Foot', -VIEW.H / 2 + 34, 16, COL.text, 'center');
        this.rows = [];
        for (let i = 0; i < COLS * ROWS; i++) {
            this.rows.push(makeLabel(cc, this.root, `R${i}`, 0, 16, COL.heroTrim, 'left', 0, ROW_W - 12));
        }
        this.btn = [];
        for (let i = 0; i < ACT.length; i++) {
            this.btn.push({
                name: makeLabel(cc, this.root, `B${i}n`, 0, 19, COL.text, 'center', BTN_X, BTN_W - 24),
                note: makeLabel(cc, this.root, `B${i}d`, 0, 15, COL.ink, 'center', BTN_X, BTN_W - 24),
            });
        }
        this.head = makeLabel(cc, this.root, 'Mh', 0, 17, COL.accent, 'left', BTN_X - BTN_W / 2 + 8, BTN_W);
        this.recipe = [];
        for (let i = 0; i < MUTATIONS.length; i++) {
            this.recipe.push(makeLabel(cc, this.root, `M${i}`, 0, 15, COL.text, 'left',
                BTN_X - BTN_W / 2 + 8, BTN_W - 12));
        }
        this.sel = -1;
        this.nrow = 0;
        this.hot = '';
    }

    get open () {
        return this.root.active;
    }

    show () {
        this.root.active = true;
    }

    hide () {
        this.root.active = false;
        this.sel = -1;
        this.hot = '';
    }

    _rowAt (i) {
        return { x: LIST_X + (i % COLS) * (ROW_W + 14), y: 288 - Math.floor(i / COLS) * ROW };
    }

    _btnAt (i) {
        return { x: BTN_X, y: 252 - i * (BTN_H + 16) };
    }

    /** View-space pointer, the same space `Input` records - so a row is clickable where it is drawn. */
    hit (x, y) {
        for (let i = 0; i < this.nrow; i++) {
            const p = this._rowAt(i);
            if (x >= p.x && x <= p.x + ROW_W && Math.abs(y - p.y) <= ROW / 2) {
                return { kind: 'select', i };
            }
        }
        for (let i = 0; i < ACT.length; i++) {
            const p = this._btnAt(i);
            if (Math.abs(x - p.x) <= BTN_W / 2 && Math.abs(y - p.y) <= BTN_H / 2) {
                return { kind: ACT[i], i };
            }
        }
        // Nothing else on screen is a target. A click outside is swallowed rather than treated as
        // "close", for the §5.6 reason: a mis-click must never spend an action the player did not mean.
        return null;
    }

    render (chain, res, forge) {
        const segs = chain.segments;
        if (this.sel >= segs.length) this.sel = -1;
        this.nrow = Math.min(segs.length, COLS * ROWS);
        const g = this.g;
        g.clear();
        g.fillColor = this.pal.get(COL.ink, 218);
        g.rect(-VIEW.W / 2, -VIEW.H / 2, VIEW.W, VIEW.H);
        g.fill();

        this.title.string = `队伍管理 · 段 ${segs.length}/${chain.cap}`
            + ` · 世界暂停中 · 点一行选中它`;

        for (let i = 0; i < this.nrow; i++) {
            const s = segs[i];
            const p = this._rowAt(i);
            const on = i === this.sel;
            // The selected row is the brightest thing on the panel and its text flips dark, so "which one
            // am I about to release" is a shape difference and not a shade difference (§9.5's rule for the
            // reticle applies just as much to a screen whose whole job is picking one of 32 lines).
            g.fillColor = this.pal.get(on ? COL.heroTrim : '#453f5c', on ? 255 : 220);
            g.rect(p.x, p.y - ROW / 2, ROW_W, ROW - 3);
            g.fill();
            const l = this.rows[i];
            l.node.active = true;
            l.color = this.pal.get(on ? COL.text : COL.heroTrim, 255);
            // Every foldable stack is marked here, not just the one E takes from the field: this is the
            // screen whose whole job is choosing which link pays, so "frontmost" would be a hidden rule.
            // v0.9: `ready` is no longer a pile - it is this line's own 图鉴条件, so a 隆隆岩 row that has
            // 8 只 but 0 融核 reads as not-ready, which is the truth the old flat-3 check could not tell.
            const gate = evolveGate(s, res);
            // A 线顶 段 used to print nothing here, which would make v0.9.8's merge invisible on the one
            // screen whose job is reading the chain. `bulk` is the same number the field draws the body at,
            // so panel and picture cannot drift apart.
            const bulk = chain.bulkOf(s);
            l.string = `${i + 1} ${displayName(s.fam, s.tier)} ${dexText(s.fam, s.tier)}`
                + ` ${typeText(s.fam, s.tier)} ${s.tier}阶×${s.count}`
                + ` ${Math.round(segDps(s))}`
                + (gate.ok ? ' ✓进化' : gate.top ? (bulk > 1 ? ` 合体${bulk}/${CHAIN.topBulk}` : '')
                    : ` ⤒${gate.short}`);
            l.node.setPosition(p.x + 6, p.y, 0);
        }
        for (let i = this.nrow; i < this.rows.length; i++) this.rows[i].node.active = false;

        const back = this.sel >= 0 ? refund(segs[this.sel]) : null;
        const pick = this.sel >= 0 ? segs[this.sel] : null;
        const gate = pick ? evolveGate(pick, res) : null;
        this._button(g, 0, this.sel >= 0 ? `放生第 ${this.sel + 1} 段` : '放生选中段',
            back ? `返还 ${back.exp} EXP + ${back.cores} 融核 · [1]` : '先点一条链位 · [1]', !!back);
        this._button(g, 1, '进化选中段 · 按该族的图鉴条件',
            !pick ? '先点一条链位 · [2] 或 E'
                : gate.ok ? `${displayName(pick.fam, pick.tier)} ${pick.tier}阶×${pick.count}`
                    + ` → ${displayName(pick.fam, pick.tier + 1)} ${pick.tier + 1}阶×${chain.foldAfter(pick.count, gate.q)}`
                    + ` · ${gate.text}${gate.cores ? ` · 实付 ${gate.cores} 核` : ''} · [2] 或 E`
                    : gate.top ? `${displayName(pick.fam, pick.tier)} 图鉴线到顶`
                    + ` · 再抓同族合体变大（${chain.bulkOf(pick)}/${CHAIN.topBulk} 当量） · [2]`
                        : `${gate.text} · ${gate.why} · [2]`, !!gate && gate.ok);
        this._button(g, 2, '关闭队伍管理', '按 C 或 [3] 回战场', true);

        const p2 = this._btnAt(2);
        this.head.node.setPosition(BTN_X - BTN_W / 2 + 8, p2.y - BTN_H / 2 - 42, 0);
        this.head.string = '排列配方（§7.2 · 尚未实装）';
        for (let i = 0; i < MUTATIONS.length; i++) {
            const l = this.recipe[i];
            l.node.setPosition(BTN_X - BTN_W / 2 + 8, p2.y - BTN_H / 2 - 68 - i * 22, 0);
            l.string = `${MUTATIONS[i].name} ← ${MUTATIONS[i].row}`;
        }
        this.foot.string = '进化按图鉴条件；放生释放队伍位置并返还少量经验'
            + ' · 没有任何东西被敌人抢走';
    }

    _button (g, i, name, note, on) {
        const p = this._btnAt(i);
        const hot = on && this.hot === ACT[i];
        g.fillColor = this.pal.get(on ? (hot ? COL.heroTrim : '#6f6889') : '#413b57', 255);
        g.rect(p.x - BTN_W / 2, p.y - BTN_H / 2, BTN_W, BTN_H);
        g.fill();
        g.strokeColor = this.pal.get(on ? COL.gold : COL.dim, on ? 235 : 110);
        g.lineWidth = on ? 5 : 2;
        g.rect(p.x - BTN_W / 2, p.y - BTN_H / 2, BTN_W, BTN_H);
        g.stroke();
        const box = this.btn[i];
        box.name.string = name;
        box.name.node.setPosition(p.x, p.y + 11, 0);
        box.note.string = note;
        box.note.node.setPosition(p.x, p.y - 13, 0);
    }
}
