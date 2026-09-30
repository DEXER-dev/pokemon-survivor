/* A compact, GBA-era-inspired encounter sting for trainer-team boss starts. */
import { VIEW } from './config.js';
import { makeLabel } from './hud.js';

const DURATION = 1.48;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (v) => 1 - Math.pow(1 - clamp01(v), 3);

export class TrainerTransition {
    constructor (cc, parent, pal) {
        this.cc = cc;
        this.pal = pal;
        this.root = new cc.Node('TrainerEncounterTransition');
        this.root.layer = cc.Layers.Enum.UI_2D;
        this.root.active = false;
        parent.addChild(this.root);
        this.g = this.root.addComponent(cc.Graphics);
        this.banner = new cc.Node('EncounterBanner');
        this.banner.layer = cc.Layers.Enum.UI_2D;
        this.root.addChild(this.banner);
        this.bannerG = this.banner.addComponent(cc.Graphics);
        this.title = makeLabel(cc, this.banner, 'EncounterTitle', 17, 25, '#fff0c3', 'center', 0, 600);
        this.subtitle = makeLabel(cc, this.banner, 'EncounterSubtitle', -17, 16, '#e5daf8', 'center', 0, 600);
        this.elapsed = 0;
        this.active = false;
        this.name = '';
        this.party = '';
        this.banner.active = false;
    }

    play (name, party) {
        this.name = name || '训练家';
        this.party = party || '';
        this.elapsed = 0;
        this.active = true;
        this.root.active = true;
        this.title.string = `训练家 ${this.name} 向你发起挑战！`;
        this.subtitle.string = this.party ? `对方派出：${this.party}` : '宝可梦对战开始';
    }

    reset () {
        this.active = false;
        this.elapsed = 0;
        this.root.active = false;
        this.banner.active = false;
        this.g.clear();
        this.bannerG.clear();
    }

    step (dt) {
        if (!this.active) return;
        this.elapsed += Math.max(0, dt);
        if (this.elapsed >= DURATION) {
            this.active = false;
            this.root.active = false;
        }
    }

    _flashAlpha (t) {
        if (t >= 0 && t < 0.065) return 0.86 * (1 - t / 0.065);
        if (t >= 0.145 && t < 0.205) return 0.62 * (1 - (t - 0.145) / 0.06);
        if (t >= 0.285 && t < 0.36) return 0.8 * (1 - (t - 0.285) / 0.075);
        if (t >= 0.79 && t < 0.91) return 0.92 * Math.sin(Math.PI * (t - 0.79) / 0.12);
        return 0;
    }

    render () {
        if (!this.active) return;
        const t = this.elapsed;
        const g = this.g;
        const halfW = VIEW.W / 2;
        const halfH = VIEW.H / 2;
        g.clear();

        const shutter = easeOut((t - 0.34) / 0.48);
        if (shutter > 0 && t < 0.96) {
            const topH = halfH * 1.03 * shutter;
            g.fillColor = this.pal.get('#191329', Math.round(238 * Math.min(1, shutter * 1.3)));
            g.rect(-halfW, halfH - topH, VIEW.W, topH + 2);
            g.rect(-halfW, -halfH - 2, VIEW.W, topH + 2);
            g.fill();

            // Fast violet/gold scan bands give the shutter a pixel-era battle-wipe rhythm.
            const reveal = clamp01((t - 0.39) / 0.42);
            if (reveal > 0) {
                for (let i = 0; i < 7; i++) {
                    const y = (i - 3) * (22 + (1 - reveal) * 46);
                    const w = VIEW.W * Math.max(0.12, 1 - reveal * 0.68);
                    g.fillColor = this.pal.get(i % 2 ? '#a987ea' : '#ffd36e', 125 - Math.round(reveal * 52));
                    g.rect(-w / 2, y - 2, w, 4);
                    g.fill();
                }
                // A pair of opposing diagonal cuts cross the screen as the shutters meet.
                const sweep = reveal * (halfW + halfH);
                g.strokeColor = this.pal.get('#fff0c3', Math.round(175 * (1 - reveal * 0.5)));
                g.lineWidth = 3;
                g.moveTo(-halfW + sweep, -halfH);
                g.lineTo(-halfW + sweep + halfH * 0.45, halfH);
                g.moveTo(halfW - sweep, halfH);
                g.lineTo(halfW - sweep - halfH * 0.45, -halfH);
                g.stroke();
            }
        }

        const flash = this._flashAlpha(t);
        if (flash > 0.01) {
            g.fillColor = this.pal.get('#fffdf1', Math.round(255 * flash));
            g.rect(-halfW, -halfH, VIEW.W, VIEW.H);
            g.fill();
        }

        const bannerIn = clamp01((t - 0.9) / 0.16);
        const bannerOut = 1 - clamp01((t - 1.31) / 0.17);
        const bannerAlpha = Math.round(255 * easeOut(bannerIn) * bannerOut);
        this.banner.active = bannerAlpha > 0;
        if (this.banner.active) {
            this.bannerG.clear();
            this.bannerG.fillColor = this.pal.get('#241b36', Math.round(238 * bannerAlpha / 255));
            this.bannerG.rect(-326, -42, 652, 84);
            this.bannerG.fill();
            this.bannerG.strokeColor = this.pal.get('#ffd36e', bannerAlpha);
            this.bannerG.lineWidth = 3;
            this.bannerG.rect(-326, -42, 652, 84);
            this.bannerG.stroke();
            this.title.color = this.pal.get('#fff0c3', bannerAlpha);
            this.subtitle.color = this.pal.get('#e5daf8', bannerAlpha);
        }
    }
}
