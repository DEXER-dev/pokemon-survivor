/*
 * Immediate-mode drawing on top of a pooled sprite tree: begin, then draw calls, then end -
 * nodes are never created after the peak count is reached. This is the mechanism behind
 * §10.2's "抓 300 只的 Node 增量为 0": the pool grows to the busiest frame and then stops.
 */

export function hexToRgb (hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Shared cc.Color instances: SpriteBatch assigns `sprite.color`, which copies, so reuse is safe. */
export class Palette {
    constructor (cc) {
        this.cc = cc;
        this.cache = new Map();
    }

    get (hex, alpha = 255) {
        const key = hex + alpha;
        let c = this.cache.get(key);
        if (c === undefined) {
            const [r, g, b] = hexToRgb(hex);
            c = new this.cc.Color(r, g, b, alpha);
            this.cache.set(key, c);
        }
        return c;
    }
}

const RAD = 180 / Math.PI;

export class SpriteBatch {
    constructor (cc, parent, glyphs) {
        this.cc = cc;
        this.parent = parent;
        this.glyphs = glyphs;
        this.pools = new Map();
        for (const name of Object.keys(glyphs)) this.pools.set(name, { n: 0, items: [] });
        this.drawn = 0;
    }

    _spawn (name) {
        const cc = this.cc;
        const g = this.glyphs[name];
        const node = new cc.Node(name);
        node.layer = cc.Layers.Enum.UI_2D;
        this.parent.addChild(node);
        const spr = node.addComponent(cc.Sprite);
        spr.spriteFrame = g.frame;
        spr.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        const ut = node.getComponent(cc.UITransform);
        ut.setContentSize(g.size, g.size);
        // A foot-anchored glyph (art spec §9.1.1 pivot 0.5/0.12) is then positioned by its ground
        // point, so callers never add a half-height offset themselves.
        ut.anchorX = g.ax === undefined ? 0.5 : g.ax;
        ut.anchorY = g.ay === undefined ? 0.5 : g.ay;
        return { node, spr, ut };
    }

    begin () {
        this.drawn = 0;
        for (const pool of this.pools.values()) pool.n = 0;
    }

    draw (name, x, y, sx, sy, rot, color, flipX, effectStyle) {
        // Glyph pools are made up front for the greybox, but the icon atlas arrives after boot, so
        // a name can legitimately be pool-less on the frame it first appears.
        let pool = this.pools.get(name);
        if (pool === undefined) {
            if (this.glyphs[name] === undefined) throw new Error(`unknown glyph ${name}`);
            pool = { n: 0, items: [] };
            this.pools.set(name, pool);
        }
        const i = pool.n++;
        this.drawn++;
        let e = pool.items[i];
        if (e === undefined) {
            e = this._spawn(name);
            pool.items.push(e);
        } else if (!e.node.active) {
            e.node.active = true;
        }
        e.node.setPosition(x, y, 0);
        e.node.angle = rot * RAD;
        e.node.setScale(flipX ? -sx : sx, sy, 1);
        if (color !== null && color !== undefined) e.spr.color = color;
        const effectKey = effectStyle ? `ui-bullet-${effectStyle}-material` : null;
        if (e.effectKey !== effectKey) {
            e.spr.customMaterial = effectKey ? this.cc.builtinResMgr.get(effectKey) : null;
            e.effectKey = effectKey;
        }
        return e;
    }

    end () {
        for (const pool of this.pools.values()) {
            while (pool.n < pool.items.length) {
                const e = pool.items[pool.n++];
                if (e.node.active) e.node.active = false;
            }
        }
    }

    stats () {
        let total = 0;
        for (const pool of this.pools.values()) total += pool.items.length;
        return { live: this.drawn, total };
    }
}
