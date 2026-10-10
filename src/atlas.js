/*
 * The greybox has no art yet, so the "atlas" is generated at boot: one canvas of plain
 * white glyphs that SpriteBatch tints per entity. Everything is drawn symmetric about the
 * cell centre because a canvas-sourced texture may or may not arrive flipped vertically and
 * a greybox should not care. Real sprites replace this in M1 without touching the batch.
 */

import { TRAINER_SPRITES } from './trainer-sprites.js';

const CELL = 56;
const PAD = 4;

const GLYPHS = ['circle', 'ring', 'square', 'diamond', 'hex', 'star', 'blob', 'pill', 'cross', 'dot', 'aura', 'ball', 'field', 'beam', 'feather', 'flame', 'spark', 'shard', 'leaf', 'claw', 'cannon', 'wave', 'shadow', 'crescent', 'needle', 'bolt', 'ember', 'boulder', 'leafblade', 'dragon', 'fang', 'spear', 'meteor', 'heart', 'coin', 'cake', 'dust', 'legendSeal', 'legendRay', 'legendArc', 'legendRift'];

// Glyphs whose holes are the design: everything else is a solid silhouette.
const EVENODD = new Set(['ring', 'ball', 'field', 'beam', 'coin', 'legendSeal']);

/** Rounded bar with half-extents `hx, hy`; the corner radius is the short side, so it is a capsule. */
function capsulePath (ctx, cx, cy, hx, hy) {
    const w = hy;
    ctx.moveTo(cx - hx, cy - hy + w);
    ctx.arcTo(cx - hx, cy - hy, cx + hx, cy - hy, w);
    ctx.arcTo(cx + hx, cy - hy, cx + hx, cy + hy, w);
    ctx.arcTo(cx + hx, cy + hy, cx - hx, cy + hy, w);
    ctx.arcTo(cx - hx, cy + hy, cx - hx, cy - hy, w);
    ctx.closePath();
}

function glyphPath (ctx, name, cx, cy, r) {
    ctx.beginPath();
    switch (name) {
        case 'legendSeal': {
            // Fine concentric circles and radial runes scale into an ultimate-weapon sigil.
            for (const radius of [0.96, 0.91, 0.72, 0.69]) {
                ctx.moveTo(cx + r * radius, cy);
                ctx.arc(cx, cy, r * radius, 0, Math.PI * 2);
            }
            for (let i = 0; i < 12; i++) {
                const a = i * Math.PI / 6;
                const ux = Math.cos(a), uy = Math.sin(a);
                const px = -uy, py = ux;
                ctx.moveTo(cx + ux * r * 0.85, cy + uy * r * 0.85);
                ctx.lineTo(cx + ux * r * 0.78 + px * r * 0.045, cy + uy * r * 0.78 + py * r * 0.045);
                ctx.lineTo(cx + ux * r * 0.74, cy + uy * r * 0.74);
                ctx.lineTo(cx + ux * r * 0.78 - px * r * 0.045, cy + uy * r * 0.78 - py * r * 0.045);
                ctx.closePath();
            }
            break;
        }
        case 'legendRay':
            ctx.moveTo(cx - r, cy);
            ctx.bezierCurveTo(cx - r * 0.4, cy - r * 0.3, cx + r * 0.3, cy - r * 0.12, cx + r, cy);
            ctx.bezierCurveTo(cx + r * 0.3, cy + r * 0.12, cx - r * 0.4, cy + r * 0.3, cx - r, cy);
            ctx.closePath();
            break;
        case 'legendArc':
            ctx.moveTo(cx - r * 0.95, cy - r * 0.25);
            ctx.bezierCurveTo(cx - r * 0.4, cy + r * 1.1, cx + r * 0.8, cy + r * 0.75, cx + r * 0.95, cy - r * 0.65);
            ctx.bezierCurveTo(cx + r * 0.55, cy + r * 0.4, cx - r * 0.3, cy + r * 0.6, cx - r * 0.95, cy - r * 0.25);
            ctx.closePath();
            break;
        case 'legendRift':
            ctx.moveTo(cx - r, cy);
            ctx.lineTo(cx - r * 0.38, cy - r * 0.16);
            ctx.lineTo(cx - r * 0.2, cy + r * 0.04);
            ctx.lineTo(cx + r * 0.24, cy - r * 0.24);
            ctx.lineTo(cx + r, cy);
            ctx.lineTo(cx + r * 0.3, cy + r * 0.06);
            ctx.lineTo(cx + r * 0.14, cy + r * 0.24);
            ctx.lineTo(cx - r * 0.28, cy + r * 0.1);
            ctx.closePath();
            break;
        case 'circle':
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            break;
        case 'ring':
            ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
            ctx.arc(cx, cy, r * 0.58, 0, Math.PI * 2);
            break;
        case 'square': {
            const s = r * 0.86;
            ctx.rect(cx - s, cy - s, s * 2, s * 2);
            break;
        }
        case 'diamond':
            ctx.moveTo(cx, cy - r);
            ctx.lineTo(cx + r, cy);
            ctx.lineTo(cx, cy + r);
            ctx.lineTo(cx - r, cy);
            ctx.closePath();
            break;
        case 'hex':
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI / 3) * i;
                const px = cx + Math.cos(a) * r;
                const py = cy + Math.sin(a) * r;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            break;
        case 'star': {
            for (let i = 0; i < 8; i++) {
                const a = (Math.PI / 4) * i - Math.PI / 2;
                const k = i % 2 === 0 ? r : r * 0.36;
                const px = cx + Math.cos(a) * k;
                const py = cy + Math.sin(a) * k;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            break;
        }
        case 'heart':
            ctx.moveTo(cx, cy + r * 0.84);
            ctx.bezierCurveTo(cx + r * 0.92, cy + r * 0.16, cx + r * 0.92, cy - r * 0.28,
                cx + r * 0.52, cy - r * 0.62);
            ctx.bezierCurveTo(cx + r * 0.24, cy - r * 0.91, cx, cy - r * 0.68, cx, cy - r * 0.43);
            ctx.bezierCurveTo(cx, cy - r * 0.68, cx - r * 0.24, cy - r * 0.91,
                cx - r * 0.52, cy - r * 0.62);
            ctx.bezierCurveTo(cx - r * 0.92, cy - r * 0.28, cx - r * 0.92, cy + r * 0.16,
                cx, cy + r * 0.84);
            ctx.closePath();
            break;
        case 'coin':
            // A thick, readable coin silhouette with an engraved inner rim and center stud.
            // The three nested shapes alternate under even-odd fill to create the minted relief.
            ctx.ellipse(cx, cy, r * 0.9, r, 0, 0, Math.PI * 2);
            ctx.ellipse(cx, cy, r * 0.69, r * 0.79, 0, 0, Math.PI * 2);
            ctx.ellipse(cx, cy, r * 0.31, r * 0.39, 0, 0, Math.PI * 2);
            break;
        case 'blob':
            ctx.ellipse(cx, cy, r, r * 0.74, 0, 0, Math.PI * 2);
            break;
        case 'pill': {
            const w = r * 0.52;
            const h = r;
            ctx.moveTo(cx - w, cy - h + w);
            ctx.arcTo(cx - w, cy - h, cx + w, cy - h, w);
            ctx.arcTo(cx + w, cy - h, cx + w, cy + h, w);
            ctx.arcTo(cx + w, cy + h, cx - w, cy + h, w);
            ctx.arcTo(cx - w, cy + h, cx - w, cy - h, w);
            ctx.closePath();
            break;
        }
        case 'cross': {
            const t = r * 0.3;
            ctx.rect(cx - t, cy - r, t * 2, r * 2);
            ctx.rect(cx - r, cy - t, r * 2, t * 2);
            break;
        }
        case 'ball': {
            // One tint cannot paint both halves of a 精灵球, so the groove and the hub are holes and the
            // ground shows through them - which is what makes it read as a ball with a band instead of
            // a dot with a line drawn over it. The rect stays inside the circle (0.98² + 0.13² < 1), or
            // even-odd would paint two tabs sticking out of the sides. Each arc is preceded by a moveTo
            // to its own start point, because `arc` otherwise stitches a line out of the last subpath.
            ctx.moveTo(cx + r, cy);
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.rect(cx - r * 0.98, cy - r * 0.13, r * 1.96, r * 0.26);
            ctx.moveTo(cx + r * 0.3, cy);
            ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2);
            break;
        }
        case 'field': {
            // §5.7-E's Area 领域. A hoop plus four ticks: `ring` already means "a bullet in flight" and
            // `aura` already means "the sweep band", so a third circle would add a shape the player
            // cannot tell apart from one already on screen. The ticks are what the slow spin reads on.
            ctx.arc(cx, cy, r * 0.98, 0, Math.PI * 2);
            ctx.arc(cx, cy, r * 0.84, 0, Math.PI * 2);
            for (let i = 0; i < 4; i++) {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(Math.PI / 4 + i * Math.PI / 2);
                ctx.rect(r * 0.5, -r * 0.075, r * 0.26, r * 0.15);
                ctx.restore();
            }
            break;
        }
        case 'beam': {
            // A 光柱 is a stroke like every other 弹体 (§5.7-C): an outer capsule minus an inner one, so a
            // 256 px beam costs its perimeter and not 9000 px² of overdraw on a phone.
            const t = r * 0.17;
            capsulePath(ctx, cx, cy, r, r * 0.5);
            ctx.moveTo(cx - r + t, cy);
            capsulePath(ctx, cx, cy, r - t, r * 0.5 - t);
            break;
        }
        case 'feather':
            // Long, tapered leaf-feather silhouette; its pointing direction follows the shot.
            ctx.moveTo(cx - r, cy);
            ctx.bezierCurveTo(cx - r * 0.35, cy + r * 0.82, cx + r * 0.35, cy + r * 0.54, cx + r, cy);
            ctx.bezierCurveTo(cx + r * 0.35, cy - r * 0.54, cx - r * 0.35, cy - r * 0.82, cx - r, cy);
            ctx.closePath();
            break;
        case 'flame':
            // A forward-driving tongue of fire, deliberately unlike the ring-shaped ordinary shot.
            ctx.moveTo(cx - r, cy);
            ctx.bezierCurveTo(cx - r * 0.5, cy + r * 0.78, cx + r * 0.25, cy + r * 0.48, cx + r, cy);
            ctx.bezierCurveTo(cx + r * 0.25, cy - r * 0.48, cx - r * 0.5, cy - r * 0.78, cx - r, cy);
            ctx.closePath();
            break;
        case 'spark':
            ctx.moveTo(cx - r, cy + r * 0.18);
            ctx.lineTo(cx - r * 0.18, cy + r * 0.18);
            ctx.lineTo(cx - r * 0.42, cy + r);
            ctx.lineTo(cx + r, cy - r * 0.12);
            ctx.lineTo(cx + r * 0.22, cy - r * 0.12);
            ctx.lineTo(cx + r * 0.46, cy - r);
            ctx.closePath();
            break;
        case 'shard':
            ctx.moveTo(cx - r, cy - r * 0.22);
            ctx.lineTo(cx + r * 0.28, cy - r * 0.72);
            ctx.lineTo(cx + r, cy);
            ctx.lineTo(cx + r * 0.28, cy + r * 0.72);
            ctx.closePath();
            break;
        case 'leaf':
            ctx.moveTo(cx - r, cy);
            ctx.bezierCurveTo(cx - r * 0.2, cy - r * 0.2, cx + r * 0.28, cy - r * 0.9, cx + r, cy - r * 0.62);
            ctx.bezierCurveTo(cx + r * 0.68, cy + r * 0.25, cx + r * 0.1, cy + r * 0.72, cx - r, cy);
            ctx.closePath();
            break;
        case 'claw':
            for (let i = -1; i <= 1; i++) {
                const y = cy + i * r * 0.48;
                ctx.moveTo(cx - r, y + r * 0.18);
                ctx.lineTo(cx + r * 0.54, y - r * 0.11);
                ctx.lineTo(cx + r * 0.28, y + r * 0.19);
                ctx.lineTo(cx - r * 0.7, y + r * 0.3);
                ctx.closePath();
            }
            break;
        case 'cannon':
            capsulePath(ctx, cx, cy, r, r * 0.52);
            ctx.rect(cx - r * 0.05, cy - r * 0.52, r * 0.18, r * 1.04);
            break;
        case 'wave':
            ctx.moveTo(cx - r, cy + r * 0.36);
            ctx.bezierCurveTo(cx - r * 0.48, cy - r * 0.58, cx + r * 0.05, cy + r * 0.9, cx + r, cy - r * 0.24);
            ctx.lineTo(cx + r, cy + r * 0.19);
            ctx.bezierCurveTo(cx + r * 0.2, cy + r, cx - r * 0.3, cy - r * 0.25, cx - r, cy + r * 0.8);
            ctx.closePath();
            break;
        case 'shadow':
            ctx.moveTo(cx - r, cy + r * 0.12);
            ctx.bezierCurveTo(cx - r * 0.72, cy - r * 0.95, cx + r * 0.38, cy - r * 0.92, cx + r, cy - r * 0.3);
            ctx.bezierCurveTo(cx + r * 0.53, cy - r * 0.52, cx + r * 0.33, cy + r * 0.5, cx - r, cy + r * 0.12);
            ctx.closePath();
            break;
        case 'crescent':
            ctx.moveTo(cx - r, cy - r * 0.1);
            ctx.quadraticCurveTo(cx - r * 0.35, cy - r, cx + r, cy - r * 0.75);
            ctx.quadraticCurveTo(cx + r * 0.25, cy, cx + r, cy + r * 0.75);
            ctx.quadraticCurveTo(cx - r * 0.35, cy + r, cx - r, cy - r * 0.1);
            ctx.closePath();
            break;
        case 'needle':
            ctx.moveTo(cx - r, cy);
            ctx.lineTo(cx + r * 0.68, cy - r * 0.2);
            ctx.lineTo(cx + r, cy);
            ctx.lineTo(cx + r * 0.68, cy + r * 0.2);
            ctx.closePath();
            break;
        case 'bolt':
            ctx.moveTo(cx - r * 0.92, cy + r * 0.22);
            ctx.lineTo(cx - r * 0.12, cy + r * 0.08);
            ctx.lineTo(cx - r * 0.38, cy + r * 0.82);
            ctx.lineTo(cx + r, cy - r * 0.32);
            ctx.lineTo(cx + r * 0.18, cy - r * 0.12);
            ctx.lineTo(cx + r * 0.4, cy - r * 0.88);
            ctx.closePath();
            break;
        case 'ember':
            ctx.moveTo(cx - r, cy + r * 0.18);
            ctx.lineTo(cx - r * 0.42, cy - r * 0.16);
            ctx.lineTo(cx - r * 0.22, cy - r * 0.72);
            ctx.lineTo(cx + r * 0.14, cy - r * 0.3);
            ctx.lineTo(cx + r * 0.72, cy - r * 0.94);
            ctx.lineTo(cx + r * 0.54, cy - r * 0.12);
            ctx.lineTo(cx + r, cy + r * 0.08);
            ctx.lineTo(cx + r * 0.12, cy + r * 0.56);
            ctx.closePath();
            break;
        case 'boulder':
            for (let i = 0; i < 10; i++) {
                const a = i * Math.PI / 5;
                const k = i % 2 ? r * 0.68 : r;
                const px = cx + Math.cos(a) * k;
                const py = cy + Math.sin(a) * k * 0.82;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            break;
        case 'leafblade':
            ctx.moveTo(cx - r, cy + r * 0.08);
            ctx.bezierCurveTo(cx - r * 0.2, cy - r * 0.3, cx + r * 0.32, cy - r, cx + r, cy - r * 0.78);
            ctx.bezierCurveTo(cx + r * 0.58, cy + r * 0.22, cx + r * 0.06, cy + r * 0.82, cx - r, cy + r * 0.08);
            ctx.closePath();
            ctx.moveTo(cx - r * 0.72, cy + r * 0.18);
            ctx.lineTo(cx + r * 0.64, cy - r * 0.48);
            ctx.lineTo(cx + r * 0.76, cy - r * 0.32);
            ctx.lineTo(cx - r * 0.56, cy + r * 0.35);
            ctx.closePath();
            break;
        case 'dragon':
            ctx.moveTo(cx - r, cy - r * 0.15);
            ctx.lineTo(cx - r * 0.28, cy - r * 0.38);
            ctx.lineTo(cx - r * 0.06, cy - r);
            ctx.lineTo(cx + r * 0.24, cy - r * 0.42);
            ctx.lineTo(cx + r, cy - r * 0.18);
            ctx.lineTo(cx + r * 0.25, cy + r * 0.12);
            ctx.lineTo(cx - r * 0.18, cy + r * 0.72);
            ctx.lineTo(cx - r * 0.43, cy + r * 0.2);
            ctx.closePath();
            break;
        case 'fang':
            ctx.moveTo(cx - r, cy - r * 0.68);
            ctx.quadraticCurveTo(cx + r * 0.15, cy - r, cx + r, cy - r * 0.4);
            ctx.quadraticCurveTo(cx + r * 0.82, cy + r * 0.38, cx + r * 0.18, cy + r);
            ctx.lineTo(cx + r * 0.06, cy + r * 0.38);
            ctx.quadraticCurveTo(cx - r * 0.35, cy + r * 0.05, cx - r, cy - r * 0.68);
            ctx.closePath();
            break;
        case 'spear':
            ctx.moveTo(cx - r, cy - r * 0.18);
            ctx.lineTo(cx + r * 0.24, cy - r * 0.18);
            ctx.lineTo(cx + r * 0.24, cy - r * 0.7);
            ctx.lineTo(cx + r, cy);
            ctx.lineTo(cx + r * 0.24, cy + r * 0.7);
            ctx.lineTo(cx + r * 0.24, cy + r * 0.18);
            ctx.lineTo(cx - r, cy + r * 0.18);
            ctx.closePath();
            break;
        case 'meteor':
            ctx.moveTo(cx - r, cy - r * 0.16);
            ctx.lineTo(cx - r * 0.55, cy - r * 0.9);
            ctx.lineTo(cx - r * 0.08, cy - r * 0.54);
            ctx.lineTo(cx + r * 0.38, cy - r * 0.82);
            ctx.lineTo(cx + r, cy - r * 0.1);
            ctx.lineTo(cx + r * 0.32, cy + r * 0.72);
            ctx.lineTo(cx - r * 0.35, cy + r * 0.55);
            ctx.closePath();
            break;
        case 'cake':
            ctx.moveTo(cx - r * 0.82, cy - r * 0.12);
            ctx.lineTo(cx + r * 0.82, cy - r * 0.12);
            ctx.lineTo(cx + r * 0.66, cy + r * 0.72);
            ctx.lineTo(cx - r * 0.66, cy + r * 0.72);
            ctx.closePath();
            ctx.moveTo(cx - r * 0.88, cy - r * 0.18);
            ctx.quadraticCurveTo(cx - r * 0.78, cy - r * 0.52, cx - r * 0.48, cy - r * 0.3);
            ctx.quadraticCurveTo(cx - r * 0.26, cy - r * 0.72, cx, cy - r * 0.34);
            ctx.quadraticCurveTo(cx + r * 0.3, cy - r * 0.72, cx + r * 0.47, cy - r * 0.31);
            ctx.quadraticCurveTo(cx + r * 0.78, cy - r * 0.52, cx + r * 0.88, cy - r * 0.18);
            ctx.closePath();
            break;
        case 'dust':
            // Soft-edged overlapping puffs read as a kicked-up ground cloud rather than a colored orb.
            ctx.arc(cx - r * 0.42, cy + r * 0.12, r * 0.46, 0, Math.PI * 2);
            ctx.arc(cx - r * 0.12, cy - r * 0.1, r * 0.58, 0, Math.PI * 2);
            ctx.arc(cx + r * 0.28, cy + r * 0.02, r * 0.5, 0, Math.PI * 2);
            ctx.arc(cx + r * 0.52, cy + r * 0.2, r * 0.3, 0, Math.PI * 2);
            ctx.closePath();
            break;
        case 'dot':
        default:
            ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
            break;
    }
}

/** One texture, one draw call: sub-frames all point at the same Texture2D. */
function buildGlyphAtlas (cc, outlined = false) {
    const cols = 5;
    const cv = document.createElement('canvas');
    cv.width = cols * CELL;
    cv.height = Math.ceil(GLYPHS.length / cols) * CELL;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';

    GLYPHS.forEach((name, i) => {
        const cx = (i % cols) * CELL + CELL / 2;
        const cy = Math.floor(i / cols) * CELL + CELL / 2;
        const r = CELL / 2 - PAD;
        if (name === 'aura') {
            // The only non-flat glyph: a soft radial falloff, so the sweep reach can be shown as a
            // volume instead of a hairline circle. Alpha survives the sprite tint multiply.
            const gr = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
            gr.addColorStop(0, 'rgba(255,255,255,0.62)');
            gr.addColorStop(0.55, 'rgba(255,255,255,0.26)');
            gr.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = gr;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            return;
        }
        glyphPath(ctx, name, cx, cy, r);
        // Particle silhouettes otherwise disappear against the busy, warm arena. Keep this
        // dark keyline on a particle-only atlas: SpriteBatch/UI glyphs retain their original look.
        if (outlined) {
            ctx.strokeStyle = '#171321';
            ctx.lineWidth = 5;
            ctx.stroke();
        }
        ctx.fill(EVENODD.has(name) ? 'evenodd' : 'nonzero');
    });

    const base = cc.SpriteFrame.createWithImage(cv);
    const texture = base.texture;
    const glyphs = {};
    GLYPHS.forEach((name, i) => {
        const x = (i % cols) * CELL;
        const y = Math.floor(i / cols) * CELL;
        const sf = new cc.SpriteFrame();
        sf.reset({
            texture,
            rect: new cc.Rect(x, y, CELL, CELL),
            originalSize: new cc.Size(CELL, CELL),
            offset: new cc.Vec2(0, 0),
        });
        glyphs[name] = { frame: sf, size: CELL };
    });
    return { glyphs, texture, canvas: cv, CELL };
}

export function buildGreyboxAtlas (cc) {
    const atlas = buildGlyphAtlas(cc);
    // A second atlas gives native ParticleSystem2D glyphs a dark edge for contrast without
    // changing the silhouettes used by Pokémon, the HUD, or other SpriteBatch callers.
    atlas.particleGlyphs = buildGlyphAtlas(cc, true).glyphs;
    return atlas;
}

/*
 * The borrowed icon set (art spec §9.1 note): one 128×64 PNG per species, whose left half is the
 * normal frame and right half the shiny one. Two things this has to survive that the greybox never
 * met: the silhouettes are wildly different sizes (Pichu vs Golem), and they are not symmetric.
 *
 * So every frame is fitted to `FIT` - the visible diameter of the greybox `circle` at scale 1 -
 * by its own alpha bounding box. That keeps `scale = r / 24` meaning "the sprite is as wide as the
 * hitbox", which is the reference the §9.5 shape language was tuned against; the renderer then
 * raises its own floor over that (`FORM_MIN` in game.js, stepped per 阶), because a fitted-to-the-
 * hitbox icon still reads small next to a hero drawn as a 44×88 pill.
 */
const ICON_DIR = 'assets/icons/';
const ICON_COLS = 11;
const FIT = (CELL / 2 - PAD) * 2;
/*
 * A guard, not a policy. Measured on this set: the bodies inside these 64 px frames are only
 * 15-31 px wide (Litwick 15, Charmander 23, Venusaur 31), so `FIT / box.w` runs up to ~3.2 before
 * any icon is fitted. The old 1.5 sat *under* that for every single one of the 44, so FIT never
 * bound and the whole atlas came in at two thirds of the size it was written to produce - which is
 * what "太小了" actually was. 4 only fires on a degenerate near-empty frame.
 */
const MAX_ZOOM = 4;

const PNG_CACHE = new Map();
const PNG_LOAD_TIMEOUT_MS = 12000;

function loadPng (src) {
    if (PNG_CACHE.has(src)) return PNG_CACHE.get(src);
    const promise = new Promise((resolve, reject) => {
        const im = new Image();
        let settled = false;
        const finish = (settle, value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            settle(value);
        };
        const timeout = setTimeout(() => finish(reject,
            new Error(`icon ${src} timed out after ${PNG_LOAD_TIMEOUT_MS}ms`)), PNG_LOAD_TIMEOUT_MS);
        im.onload = () => finish(resolve, im);
        im.onerror = () => finish(reject, new Error(`icon ${src} failed to load`));
        im.src = src;
    });
    PNG_CACHE.set(src, promise);
    return promise;
}

/** Preload a bounded set of images and report settled files for the boot loading screen. */
export async function preloadImages (paths, onProgress = null) {
    const sources = [...new Set(paths.filter((path) => typeof path === 'string' && path.length))];
    let next = 0;
    let complete = 0;
    let failed = 0;
    const worker = async () => {
        while (next < sources.length) {
            const index = next++;
            try {
                await loadPng(sources[index]);
            } catch (err) {
                failed++;
                console.warn(`[assets] ${sources[index]} unavailable:`, err && err.message);
            } finally {
                complete++;
                if (onProgress) onProgress(complete, sources.length, failed);
            }
        }
    };
    await Promise.all(Array.from({ length: Math.min(12, sources.length) }, worker));
    return { total: sources.length, loaded: sources.length - failed, failed };
}

/** Both authored fire loops share one texture and their original centered 64px cells. */
export async function loadHoohVfxAtlas (cc) {
    const image = await loadPng('assets/vfx/hooh/hooh-fire-atlas.png');
    if (image.width !== 1024 || image.height !== 512) throw new Error('Ho-Oh fire atlas must be 1024×512');
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d').drawImage(image, 0, 0);
    const sheet = cc.SpriteFrame.createWithImage(canvas);
    if (sheet.texture && typeof sheet.texture.setFilters === 'function') sheet.texture.setFilters(1, 1);
    const glyphs = {};
    for (let index = 0; index < 120; index++) {
        const frame = new cc.SpriteFrame();
        frame.reset({ texture: sheet.texture,
            rect: new cc.Rect(index % 16 * 64, Math.floor(index / 16) * 64, 64, 64),
            originalSize: new cc.Size(64, 64), offset: new cc.Vec2(0, 0) });
        const name = index < 60 ? `hoohFire_${index}` : `hoohFlare_${index - 60}`;
        glyphs[name] = { frame, size: 64 };
    }
    return { glyphs, texture: sheet.texture };
}

/** Pixel-art field plants in a compact 4×3 sheet; point filtering keeps the authored edges crisp. */
export async function loadFloraAtlas (cc) {
    const image = await loadPng('assets/tilesets/KANTO50S_FLORA_ADDON.png');
    if (image.width !== 256 || image.height !== 192) {
        throw new Error(`Field flora atlas must be 256×192, got ${image.width}×${image.height}`);
    }
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d').drawImage(image, 0, 0);
    const sheet = cc.SpriteFrame.createWithImage(canvas);
    if (sheet.texture && typeof sheet.texture.setFilters === 'function') sheet.texture.setFilters(1, 1);
    const glyphs = {};
    const names = [
        'grass_tuft_01', 'grass_tuft_02', 'grass_tuft_03', 'grass_tuft_04',
        'flowers_cream', 'flowers_yellow', 'flowers_pink', 'flowers_blueviolet',
        'mixed_cream', 'mixed_yellow', 'mixed_pink', 'mixed_blueviolet',
    ];
    for (let index = 0; index < names.length; index++) {
        const frame = new cc.SpriteFrame();
        frame.reset({ texture: sheet.texture,
            rect: new cc.Rect(index % 4 * 64, Math.floor(index / 4) * 64, 64, 64),
            originalSize: new cc.Size(64, 64), offset: new cc.Vec2(0, 0) });
        glyphs[names[index]] = { frame, size: 64 };
    }
    return { glyphs, texture: sheet.texture };
}

/** Native Lake.png water and keyed bank textures used by the procedurally shaped world lakes. */
export async function loadPondAtlas () {
    const [waterCore, shoreEdge] = await Promise.all([
        loadPng('assets/tilesets/lake-processed/Lake_WATER_CORE_64x64.png'),
        loadPng('assets/tilesets/lake-processed/Lake_EDGE_TOP_64x16_GAME_GROUND.png'),
    ]);
    if (waterCore.width !== 64 || waterCore.height !== 64) {
        throw new Error(`Lake water core must be 64×64, got ${waterCore.width}×${waterCore.height}`);
    }
    if (shoreEdge.width !== 64 || shoreEdge.height !== 16) {
        throw new Error(`Lake bank strip must be 64×16, got ${shoreEdge.width}×${shoreEdge.height}`);
    }
    return { waterCore, shoreEdge };
}

/** Painterly Cerulean Cave arena backdrop used by Mewtwo's dedicated lair battle. */
export async function loadMewtwoArenaBackdrop (cc) {
    const image = await loadPng('assets/maps/cerulean-cave-arena.png');
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d').drawImage(image, 0, 0);
    const frame = cc.SpriteFrame.createWithImage(canvas);
    if (frame.texture && typeof frame.texture.setFilters === 'function') frame.texture.setFilters(1, 1);
    return { frame, width: image.width, height: image.height };
}

/** Original Whirl Islands waterfall chamber artwork for the Lugia arena. */
export async function loadLugiaArenaBackdrop (cc) {
    const image = await loadPng('assets/maps/whirl-islands-lugia-arena.png');
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d').drawImage(image, 0, 0);
    const frame = cc.SpriteFrame.createWithImage(canvas);
    if (frame.texture && typeof frame.texture.setFilters === 'function') frame.texture.setFilters(1, 1);
    return { frame, width: image.width, height: image.height };
}

/** Sky Pillar summit backdrop used by Rayquaza's dedicated legendary battle. */
export async function loadRayquazaArenaBackdrop (cc) {
    const image = await loadPng('assets/maps/sky-pillar-rayquaza-arena.png');
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d').drawImage(image, 0, 0);
    const frame = cc.SpriteFrame.createWithImage(canvas);
    if (frame.texture && typeof frame.texture.setFilters === 'function') frame.texture.setFilters(1, 1);
    return { frame, width: image.width, height: image.height };
}

/** Marine Cave pool and sandy shore backdrop for Kyogre's dedicated encounter. */
export async function loadKyogreArenaBackdrop (cc) {
    const loadBackdrop = async (path) => {
        const image = await loadPng(path);
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext('2d').drawImage(image, 0, 0);
        const frame = cc.SpriteFrame.createWithImage(canvas);
        if (frame.texture && typeof frame.texture.setFilters === 'function') frame.texture.setFilters(1, 1);
        return { frame, width: image.width, height: image.height };
    };
    const [landscape, square] = await Promise.all([
        loadBackdrop('assets/maps/marine-cave-kyogre-arena.png'),
        loadBackdrop('assets/maps/marine-cave-kyogre-arena-square.png'),
    ]);
    return { landscape, square };
}

/** Individually layered Ho-Oh summit clouds plus the transparent Bell Tower foreground. */
export async function loadHoOhArenaAssets (cc) {
    const paths = [
        'assets/maps/hooh-tower-foreground.webp',
        ...Array.from({ length: 12 }, (_, index) => `assets/maps/hooh-cloud-${index + 1}.png`),
    ];
    const images = await Promise.all(paths.map((path) => loadPng(path)));
    const toFrame = (image, path) => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext('2d').drawImage(image, 0, 0);
        const frame = cc.SpriteFrame.createWithImage(canvas);
        if (frame.texture && typeof frame.texture.setFilters === 'function') frame.texture.setFilters(1, 1);
        return { frame, width: image.width, height: image.height, path };
    };
    const foreground = toFrame(images[0], paths[0]);
    const clouds = images.slice(1).map((image, index) => toFrame(image, paths[index + 1]));
    if (foreground.width !== 1672 || foreground.height !== 941) {
        throw new Error(`Ho-Oh tower foreground must be 1672×941, got ${foreground.width}×${foreground.height}`);
    }
    return { foreground, clouds };
}

/** Source-resolution Kanto tree families, with crisp pixel edges. */
export async function loadTreeAtlas (cc) {
    const image = await loadPng('assets/tilesets/KANTO50S_TREE_FAMILIES.png');
    if (image.width !== 160 || image.height !== 64) {
        throw new Error(`Field tree atlas must be 160×64, got ${image.width}×${image.height}`);
    }
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d').drawImage(image, 0, 0);
    const sheet = cc.SpriteFrame.createWithImage(canvas);
    if (sheet.texture && typeof sheet.texture.setFilters === 'function') sheet.texture.setFilters(1, 1);
    const glyphs = {};
    const species = ['tree_blossom_light', 'tree_blossom_pink', 'tree_broadleaf', 'tree_evergreen', 'tree_spruce'];
    species.forEach((name, index) => {
        const frame = new cc.SpriteFrame();
        frame.reset({ texture: sheet.texture,
            rect: new cc.Rect(index * 32, 0, 32, 64),
            originalSize: new cc.Size(32, 64), offset: new cc.Vec2(0, 0) });
        glyphs[name] = { frame, size: 64 };
    });
    // Preserve the old glyph name for any remaining tree preview or consumer.
    glyphs.tree_full = glyphs.tree_broadleaf;
    return { glyphs, texture: sheet.texture };
}

/** Selected source-verified CC0 spell frames share a compact 150px-cell atlas. */
export async function loadLegendaryVfxAtlas (cc) {
    const image = await loadPng('assets/vfx/legendary/legendary-material-atlas.png');
    if (image.width !== 1050 || image.height !== 1500) {
        throw new Error(`Legendary VFX atlas must be 1050×1500, got ${image.width}×${image.height}`);
    }
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d').drawImage(image, 0, 0);
    const sheet = cc.SpriteFrame.createWithImage(canvas);
    if (sheet.texture && typeof sheet.texture.setFilters === 'function') sheet.texture.setFilters(1, 1);
    const glyphs = {};
    const groups = [
        ['arcane', 7], ['water04', 5], ['water03', 5], ['water05', 5],
        ['earth03', 5], ['earth04', 5], ['cosmic02', 5], ['cosmic05', 5],
        ['slash04', 6], ['pure05', 5],
    ];
    let row = 0;
    for (const [group, frames] of groups) {
        for (let index = 1; index <= frames; index++) {
            const frame = new cc.SpriteFrame();
            frame.reset({ texture: sheet.texture,
                rect: new cc.Rect((index - 1) * 150, row * 150, 150, 150),
                originalSize: new cc.Size(150, 150), offset: new cc.Vec2(0, 0) });
            glyphs[`vfx_${group}_${String(index).padStart(2, '0')}`] = { frame, size: 150 };
        }
        row++;
    }
    return { glyphs, texture: sheet.texture };
}

/** Source-backed sub-legendary spell frames share a 512px nearest-filtered 64px-cell atlas. */
export async function loadSubLegendaryVfxAtlas (cc) {
    const [image, response] = await Promise.all([
        loadPng('assets/vfx/sublegendary/sublegendary-atlas.png'),
        fetch('assets/vfx/sublegendary/manifest.json'),
    ]);
    if (!response.ok) throw new Error(`Sub-legendary VFX manifest failed: ${response.status}`);
    const manifest = await response.json();
    if (image.width !== manifest.width || image.height !== manifest.height || manifest.cellSize !== 64) {
        throw new Error(`Sub-legendary VFX atlas dimensions do not match its manifest (${image.width}×${image.height})`);
    }
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d').drawImage(image, 0, 0);
    const sheet = cc.SpriteFrame.createWithImage(canvas);
    if (sheet.texture && typeof sheet.texture.setFilters === 'function') sheet.texture.setFilters(1, 1);
    const glyphs = {};
    for (const [name, frameData] of Object.entries(manifest.frames)) {
        const frame = new cc.SpriteFrame();
        frame.reset({ texture: sheet.texture,
            rect: new cc.Rect(frameData.x, frameData.y, frameData.width, frameData.height),
            originalSize: new cc.Size(frameData.size, frameData.size), offset: new cc.Vec2(0, 0) });
        glyphs[name] = { frame, size: frameData.size };
    }
    return { glyphs, texture: sheet.texture, manifest };
}

/** Source-backed Z move projectiles and six-frame elemental impacts, point-filtered for crisp pixels. */
export async function loadZMoveVfxAtlas (cc) {
    const [projectileImage, impactImage, response] = await Promise.all([
        loadPng('assets/vfx/zmove/projectile-atlas.png'),
        loadPng('assets/vfx/zmove/impact-atlas.png'),
        fetch('assets/vfx/zmove/manifest.json'),
    ]);
    if (!response.ok) throw new Error(`Z-move VFX manifest failed: ${response.status}`);
    const manifest = await response.json();
    if (projectileImage.width !== manifest.width || projectileImage.height !== manifest.height
        || impactImage.width !== manifest.impactWidth || impactImage.height !== manifest.impactHeight
        || manifest.frameSize !== 48 || manifest.impactFrameSize !== 64 || manifest.framesPerType !== 6) {
        throw new Error('Z-move VFX atlas dimensions do not match its manifest');
    }

    const makeSheet = (image) => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext('2d').drawImage(image, 0, 0);
        const sheet = cc.SpriteFrame.createWithImage(canvas);
        if (sheet.texture && typeof sheet.texture.setFilters === 'function') sheet.texture.setFilters(1, 1);
        return sheet.texture;
    };
    const sheets = {
        projectile: makeSheet(projectileImage),
        impact: makeSheet(impactImage),
    };
    const glyphs = {};
    for (const [name, frameData] of Object.entries(manifest.frames)) {
        const frame = new cc.SpriteFrame();
        frame.reset({
            texture: sheets[frameData.atlas],
            rect: new cc.Rect(frameData.x, frameData.y, frameData.width, frameData.height),
            originalSize: new cc.Size(frameData.width, frameData.height),
            offset: new cc.Vec2(0, 0),
        });
        glyphs[name] = { frame, size: frameData.width };
    }
    return { glyphs, textures: sheets, manifest };
}

/** Lucas is a 4×4 overworld sheet: rows face down/left/right/up, columns are walk frames. */
export async function loadLucasAtlas (cc) {
    const image = await loadPng('assets/player/NPC_198_Lucas.png');
    if (image.width !== 256 || image.height !== 256) {
        throw new Error(`Lucas sheet must be 256×256, got ${image.width}×${image.height}`);
    }
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d').drawImage(image, 0, 0);
    const sheet = cc.SpriteFrame.createWithImage(canvas);
    // This is pixel art; nearest-neighbour filtering avoids softened outlines at game zoom levels.
    if (sheet.texture && typeof sheet.texture.setFilters === 'function') sheet.texture.setFilters(1, 1);
    const glyphs = {};
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
            const frame = new cc.SpriteFrame();
            frame.reset({
                texture: sheet.texture,
                rect: new cc.Rect(col * 64, row * 64, 64, 64),
                originalSize: new cc.Size(64, 64),
                offset: new cc.Vec2(0, 0),
            });
            glyphs[`lucas_${row}_${col}`] = { frame, size: 64, ax: 0.5, ay: 0.07 };
        }
    }
    return { glyphs, texture: sheet.texture };
}

/** Load official 4×4 trainer overworld sheets in the encounter order. Rows face down/left/right/up. */
export async function loadTrainerAtlas (cc) {
    // 单文件容错：一张缺图/坏表只让那一位训练家退回 Lucas 帧，绝不连坐整个图集——
    // 否则新形象素材晚于页面加载到达时，所有 trainer_* glyph 集体消失，玩家直接隐身。
    const lucasImage = await loadPng('assets/player/NPC_198_Lucas.png');
    const images = await Promise.all(TRAINER_SPRITES.map(async ({ file }) => {
        try {
            const im = await loadPng(`assets/trainers/${file}`);
            if (im.width !== 256 || im.height !== 256) throw new Error(`bad size ${im.width}×${im.height}`);
            return im;
        } catch (err) {
            console.warn(`[trainers] ${file} unavailable, substituting lucas sheet:`, err && err.message);
            return null;
        }
    }));
    const glyphs = {};
    images.forEach((image, trainer) => {
        const source = image || lucasImage;
        const canvas = document.createElement('canvas');
        canvas.width = source.width;
        canvas.height = source.height;
        canvas.getContext('2d').drawImage(source, 0, 0);
        const sheet = cc.SpriteFrame.createWithImage(canvas);
        if (sheet.texture && typeof sheet.texture.setFilters === 'function') sheet.texture.setFilters(1, 1);
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const frame = new cc.SpriteFrame();
                frame.reset({
                    texture: sheet.texture,
                    rect: new cc.Rect(col * 64, row * 64, 64, 64),
                    originalSize: new cc.Size(64, 64),
                    offset: new cc.Vec2(0, 0),
                });
                glyphs[`trainer_${trainer}_${row}_${col}`] = { frame, size: 64, ax: 0.5, ay: 0.07 };
            }
        }
    });
    return { glyphs };
}

/** Load the real capture-ball art as a standalone texture, preserving its original colours. */
export async function loadPokeball (cc) {
    const image = await loadPng('assets/items/POKEBALL.png');
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d').drawImage(image, 0, 0);
    return {
        frame: cc.SpriteFrame.createWithImage(canvas),
        size: Math.max(image.width, image.height),
    };
}

/** Load the native Mega Stone item icons for the level-up card and the orbiting in-world marker. */
export async function loadMegaStoneAtlas (cc, forms) {
    const images = await Promise.all(forms.map((form) => loadPng(`assets/items/mega/${form.stone}.png`)));
    const glyphs = {};
    const frames = {};
    images.forEach((image, i) => {
        const form = forms[i];
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext('2d').drawImage(image, 0, 0);
        const frame = cc.SpriteFrame.createWithImage(canvas);
        const size = Math.max(image.width, image.height);
        glyphs[`megaStone_${form.id}`] = { frame, size };
        frames[form.stone] = frame;
    });
    return { glyphs, frames };
}

/** Load real Pokémon item icons for the level-up cards, keyed by the upgrade's icon id. */
export async function loadUpgradeItemAtlas (cc, upgrades) {
    const ids = [...new Set(upgrades.map((entry) => entry.icon).filter(Boolean))];
    const images = await Promise.all(ids.map((id) => id === 'ZPOWERBAND'
        ? null : loadPng(id === 'POKEBALL'
        ? 'assets/items/POKEBALL.png' : id === 'AUSTRALIANMOUSE'
            ? 'assets/icons/TANDEMAUS.png' : `assets/items/upgrades/${id}.png`)));
    const frames = {};
    images.forEach((image, i) => {
        const canvas = document.createElement('canvas');
        if (ids[i] === 'AUSTRALIANMOUSE' && image) {
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#30263f';
            ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#eac96f';
            ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(32, 32, 28, 0, Math.PI * 2); ctx.stroke();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(image, 0, 0, Math.min(64, image.width), image.height, 4, 4, 56, 56);
            ctx.fillStyle = '#30213c';
            ctx.fillRect(38, 43, 24, 17);
            ctx.strokeStyle = '#f8dfa0';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(38, 43, 24, 17);
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#30213c';
            ctx.strokeText('×2', 50, 51.5);
            ctx.fillStyle = '#ffe9a8';
            ctx.fillText('×2', 50, 51.5);
        } else if (image) {
            canvas.width = image.width;
            canvas.height = image.height;
            canvas.getContext('2d').drawImage(image, 0, 0);
        } else {
            // Compact in-project icons keep items drawable when no matching image asset is present.
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.save();
            ctx.translate(32, 32);
            ctx.rotate(-Math.PI / 4);
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#3a2136';
            ctx.lineWidth = 17;
            ctx.beginPath(); ctx.ellipse(0, 0, 12, 23, 0, 0, Math.PI * 2); ctx.stroke();
            const rareCandy = ids[i] === 'RARECANDY';
            const zBand = ids[i] === 'ZPOWERBAND';
            if (rareCandy) {
                // Wrapped candy silhouette, readable at the small size used on upgrade cards.
                ctx.rotate(Math.PI / 4);
                ctx.fillStyle = '#6f426f';
                ctx.beginPath();
                ctx.moveTo(-12, -12); ctx.lineTo(12, -12); ctx.lineTo(25, -20);
                ctx.lineTo(23, -5); ctx.lineTo(25, 0); ctx.lineTo(23, 5); ctx.lineTo(25, 20);
                ctx.lineTo(12, 12); ctx.lineTo(-12, 12); ctx.lineTo(-25, 20);
                ctx.lineTo(-23, 5); ctx.lineTo(-25, 0); ctx.lineTo(-23, -5); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#f3a5da';
                ctx.beginPath(); ctx.ellipse(0, 0, 16, 12, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#fff0a8';
                ctx.beginPath(); ctx.ellipse(0, 0, 6, 12, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#fff8ef';
                ctx.beginPath(); ctx.arc(-8, -4, 3, 0, Math.PI * 2); ctx.fill();
            } else {
                ctx.strokeStyle = zBand ? '#a96eff' : '#f04455';
                ctx.lineWidth = 10;
                ctx.beginPath(); ctx.ellipse(0, 0, 12, 23, 0, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = '#25243b';
                ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
            }
            if (zBand) {
                ctx.fillStyle = '#ffe69a';
                ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, -2); ctx.lineTo(5, 9);
                ctx.lineTo(-5, 9); ctx.lineTo(-7, -2); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#743cbd';
                ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('Z', 0, 0);
            } else {
                ctx.fillStyle = '#fff0df';
                ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#ff5063';
                ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        }
        const frame = cc.SpriteFrame.createWithImage(canvas);
        if (frame.texture && typeof frame.texture.setFilters === 'function') frame.texture.setFilters(1, 1);
        frames[ids[i]] = frame;
    });
    return { frames };
}

/**
 * Tightest box of non-transparent pixels in `data`, in the source image's own coordinates.
 * The seeds have to sit *outside* the window on both axes. The first version seeded the x-max with
 * `y1` and the y-min with `y0`, so `x > hi` and `y < up` could never fire and the returned box was
 * pinned to the frame's right and top edges instead of to the art: Charmander's real 42×38 body read
 * as 54×51, the fit then normalised that phantom rect to 48, and every icon landed at ~0.89 of the
 * size this function was written to produce. That is what "太小了" was.
 */
function alphaBox (data, w, x0, y0, x1, y1) {
    let lo = x1, hi = x0 - 1, up = y1, dn = y0 - 1, found = false;
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            if (data[(y * w + x) * 4 + 3] < 10) continue;
            found = true;
            if (x < lo) lo = x;
            if (x > hi) hi = x;
            if (y < up) up = y;
            if (y > dn) dn = y;
        }
    }
    return found ? { x: lo, y: up, w: hi - lo + 1, h: dn - up + 1 } : null;
}

/** Load the sourced Mega Mewtwo Y sprite into the same fitted 56px cell as the species icons. */
export async function loadMegaMewtwoYIcon (cc) {
    const image = await loadPng('assets/icons/MEWTWO-MEGA-Y.gif');
    const source = document.createElement('canvas');
    source.width = image.width;
    source.height = image.height;
    const sourceCtx = source.getContext('2d', { willReadFrequently: true });
    sourceCtx.drawImage(image, 0, 0);
    const box = alphaBox(sourceCtx.getImageData(0, 0, source.width, source.height).data,
        source.width, 0, 0, source.width, source.height);
    if (!box) throw new Error('Mega Mewtwo Y sprite is fully transparent');

    const canvas = document.createElement('canvas');
    canvas.width = CELL;
    canvas.height = CELL;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const scale = Math.min(FIT / box.w, FIT / box.h, MAX_ZOOM);
    const width = box.w * scale;
    const height = box.h * scale;
    ctx.drawImage(source, box.x, box.y, box.w, box.h,
        (CELL - width) / 2, (CELL - height) / 2, width, height);
    const frame = cc.SpriteFrame.createWithImage(canvas);
    if (frame.texture && typeof frame.texture.setFilters === 'function') frame.texture.setFilters(1, 1);
    return { glyphs: { MEWTWO_MEGA_Y: { frame, size: CELL } } };
}

/**
 * @returns Promise<{glyphs, texture, canvas, CELL}> glyphs keyed by species name and by `<name>_s`
 *          for the shiny half - merged into the greybox atlas by the caller, not by this function.
 */
export async function loadIconAtlas (cc, keys, outlineKeys = []) {
    const imgs = await Promise.all(keys.map(async (key) => {
        try {
            return await loadPng(`${ICON_DIR}${key}.png`);
        } catch (err) {
            console.warn(`[icons] ${key} unavailable; keeping its fallback glyph:`, err && err.message);
            return null;
        }
    }));
    const scratch = document.createElement('canvas');
    scratch.width = 128;
    scratch.height = 64;
    const sx = scratch.getContext('2d', { willReadFrequently: true });

    const cv = document.createElement('canvas');
    cv.width = ICON_COLS * CELL;
    cv.height = Math.ceil(keys.length * 2 / ICON_COLS) * CELL;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';

    const placed = [];
    imgs.forEach((img, i) => {
        if (!img) return;
        sx.clearRect(0, 0, 128, 64);
        // Icon sheets are normally 128×64, but a few supplied forms use a larger canvas
        // with the same 2:1 layout. Fit those sheets before splitting normal/shiny halves;
        // drawing at the origin silently clipped the oversized Gmax art.
        sx.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in sx) sx.imageSmoothingQuality = 'high';
        sx.drawImage(img, 0, 0, 128, 64);
        const px = sx.getImageData(0, 0, 128, 64).data;
        for (let half = 0; half < 2; half++) {
            const x0 = half * 64;
            const box = alphaBox(px, 128, x0, 0, x0 + 64, 64);
            if (box === null) continue;
            const s = Math.min(FIT / box.w, FIT / box.h, MAX_ZOOM);
            const dw = box.w * s, dh = box.h * s;
            const cell = i * 2 + half;
            const cx = (cell % ICON_COLS) * CELL + CELL / 2;
            const cy = Math.floor(cell / ICON_COLS) * CELL + CELL / 2;
            ctx.drawImage(img, box.x, box.y, box.w, box.h, cx - dw / 2, cy - dh / 2, dw, dh);
            placed.push({ key: `${keys[i]}${half ? '_s' : ''}`, x: (cell % ICON_COLS) * CELL, y: Math.floor(cell / ICON_COLS) * CELL });
        }
    });

    const base = cc.SpriteFrame.createWithImage(cv);
    const texture = base.texture;
    const glyphs = {};
    placed.forEach((p) => {
        const sf = new cc.SpriteFrame();
        sf.reset({
            texture,
            rect: new cc.Rect(p.x, p.y, CELL, CELL),
            originalSize: new cc.Size(CELL, CELL),
            offset: new cc.Vec2(0, 0),
        });
        glyphs[p.key] = { frame: sf, size: CELL };
    });

    // Mega outlines are actual pixel silhouettes, not circles or blurred sprite duplicates. Build
    // two transparent exterior bands for each Mega icon (and its shiny art), then tint them per form
    // at draw time. Keeping this atlas to the requested icon set avoids tripling all 278 species.
    const outlineNames = new Set();
    for (const key of outlineKeys) {
        outlineNames.add(key);
        outlineNames.add(`${key}_s`);
    }
    const outlineSources = placed.filter((p) => outlineNames.has(p.key));
    if (outlineSources.length) {
        const rows = Math.ceil(outlineSources.length / ICON_COLS);
        const outlineCanvas = document.createElement('canvas');
        outlineCanvas.width = ICON_COLS * CELL;
        outlineCanvas.height = rows * CELL * 2;
        const outlineCtx = outlineCanvas.getContext('2d');
        const sourceCtx = cv.getContext('2d', { willReadFrequently: true });

        const makeRing = (sourceData, outerRadius, innerRadius = 0) => {
            const mask = new Uint8Array(CELL * CELL);
            for (let pixel = 0; pixel < mask.length; pixel++) {
                mask[pixel] = sourceData.data[pixel * 4 + 3] > 12 ? 1 : 0;
            }
            // Only trace transparent pixels connected to the cell exterior. Transparent eye/mouth
            // gaps inside a sprite stay untouched instead of turning into accidental inner strokes.
            const outside = new Uint8Array(mask.length);
            const queue = new Int32Array(mask.length);
            let tail = 0;
            const seed = (index) => {
                if (mask[index] || outside[index]) return;
                outside[index] = 1;
                queue[tail++] = index;
            };
            for (let edge = 0; edge < CELL; edge++) {
                seed(edge); seed((CELL - 1) * CELL + edge);
                seed(edge * CELL); seed(edge * CELL + CELL - 1);
            }
            for (let head = 0; head < tail; head++) {
                const index = queue[head], x = index % CELL, y = Math.floor(index / CELL);
                if (x > 0) seed(index - 1);
                if (x < CELL - 1) seed(index + 1);
                if (y > 0) seed(index - CELL);
                if (y < CELL - 1) seed(index + CELL);
            }
            const ring = outlineCtx.createImageData(CELL, CELL);
            for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
                const index = y * CELL + x;
                if (!outside[index]) continue;
                let nearest = outerRadius + 1;
                for (let oy = -outerRadius; oy <= outerRadius && nearest > innerRadius; oy++) {
                    for (let ox = -outerRadius; ox <= outerRadius; ox++) {
                        const nx = x + ox, ny = y + oy;
                        if (nx < 0 || nx >= CELL || ny < 0 || ny >= CELL) continue;
                        if (!mask[ny * CELL + nx]) continue;
                        nearest = Math.min(nearest, Math.max(Math.abs(ox), Math.abs(oy)));
                    }
                }
                if (nearest <= innerRadius || nearest > outerRadius) continue;
                const p = index * 4;
                ring.data[p] = ring.data[p + 1] = ring.data[p + 2] = ring.data[p + 3] = 255;
            }
            return ring;
        };

        const outlineCells = [];
        outlineSources.forEach((source, index) => {
            const x = (index % ICON_COLS) * CELL;
            const y = Math.floor(index / ICON_COLS) * CELL;
            const sourceData = sourceCtx.getImageData(source.x, source.y, CELL, CELL);
            outlineCtx.putImageData(makeRing(sourceData, 2), x, y);
            outlineCtx.putImageData(makeRing(sourceData, 5, 2), x, y + rows * CELL);
            outlineCells.push({ key: source.key, x, y });
        });
        const outlineSheet = cc.SpriteFrame.createWithImage(outlineCanvas);
        if (outlineSheet.texture && typeof outlineSheet.texture.setFilters === 'function') {
            outlineSheet.texture.setFilters(1, 1);
        }
        for (const cell of outlineCells) {
            for (const [suffix, y] of [['outline', cell.y], ['glow', cell.y + rows * CELL]]) {
                const frame = new cc.SpriteFrame();
                frame.reset({ texture: outlineSheet.texture,
                    rect: new cc.Rect(cell.x, y, CELL, CELL),
                    originalSize: new cc.Size(CELL, CELL), offset: new cc.Vec2(0, 0) });
                glyphs[`${cell.key}__mega_${suffix}`] = { frame, size: CELL };
            }
        }
    }
    return { glyphs, texture, canvas: cv, CELL };
}
