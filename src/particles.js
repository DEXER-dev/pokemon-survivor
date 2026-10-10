/* Native Cocos Creator 2D particle bursts for skill events. Gameplay stays in SkillSystem. */
import { ELEMENT, family } from './config.js';
import { MEGA_BY_ID } from './mega.js';
import { GIGANTAMAX_BY_ID } from './gigantamax.js';
import {
    activeSkillModuleForForm, legendaryParticlePresetForEvent, projectileImpactPresetForFamily,
    skillParticlePresetForEvent,
} from './skills/registry.js';
import { SHINY_GOLD } from './shiny.js';
import { BLASTOISE_SKILL } from './skills/active/mega/blastoise.js';

const POOL_SIZE = 64;
const SIGNATURE_SKILL_FORMS = new Set(['blastoise', 'blaziken', 'gardevoir', 'legend-hooh']);
const BLASTOISE_STREAM_SAMPLE = Object.freeze({
    particleClass: 'mega-channel', glyph: 'wave', color: '#c7f5ff',
    duration: 0.016, emissionRate: 190, totalParticles: 3,
    life: 0.19, lifeVar: 0.035, angleVar: 7,
    speed: 72, speedVar: 16, startSize: 5.5, startSizeVar: 1.5,
    endSize: 0.8, tangentialAccel: 0, radialAccel: 0,
    gravityY: 0, posVar: 2.5,
});

function colorOf (cc, hex, alpha = 255) {
    const value = hex.slice(1);
    return new cc.Color(
        parseInt(value.slice(0, 2), 16),
        parseInt(value.slice(2, 4), 16),
        parseInt(value.slice(4, 6), 16),
        alpha,
    );
}

/** A small reusable pool; every emitter is an actual Cocos ParticleSystem2D component. */
export class NativeParticleBursts {
    constructor (cc, parent, spriteFrame, starFrame = spriteFrame, glyphFrames = null, particleGlyphFrames = null) {
        this.cc = cc;
        this.parent = parent;
        this.spriteFrame = spriteFrame;
        this.starFrame = starFrame;
        this.glyphFrames = glyphFrames || {};
        this.particleGlyphFrames = particleGlyphFrames || {};
        this.material = cc.builtinResMgr.get('ui-particle-material');
        this.tints = new Map();
        this.fades = new Map();
        this.megaTints = new Map();
        this.megaFades = new Map();
        this.megaTint = colorOf(cc, '#ffe27a');
        this.megaFade = colorOf(cc, '#ffe27a', 0);
        for (const hex of Object.values(ELEMENT)) {
            this.tints.set(hex, colorOf(cc, hex));
            this.fades.set(hex, colorOf(cc, hex, 0));
        }
        this.tints.set('#ef82cf', colorOf(cc, '#ef82cf'));
        this.fades.set('#ef82cf', colorOf(cc, '#ef82cf', 0));
        this.tints.set(SHINY_GOLD, colorOf(cc, SHINY_GOLD));
        this.fades.set(SHINY_GOLD, colorOf(cc, SHINY_GOLD, 0));
        for (const [id, form] of Object.entries({ ...MEGA_BY_ID, ...GIGANTAMAX_BY_ID })) {
            this.megaTints.set(id, colorOf(cc, form.color));
            this.megaFades.set(id, colorOf(cc, form.color, 0));
        }
        this.slots = [];
        this.trailTimer = 0;
        this.trailCursor = 0;
        this.trainerTrailTimer = 0;
        this.trainerTrailCursor = 0;
        this.skillFxTimer = 0;
        this.skillFxCursor = 0;
        this.skillFxPhase = 0;
        this.skillFxScratch = [];
        this.fieldFxTimer = 0;
        this.fieldFxCursor = 0;
        this.fieldFxPhase = 0;
        this.fieldFxScratch = [];
        this.zTrailTimer = 0;
        this.megaAreaTimer = 0;
        this.megaAreaCursor = 0;
        this.megaAreaPhase = 0;
        this.megaAreaScratch = [];
        this.rosterAreaTimer = 0;
        this.rosterAreaCursor = 0;
        this.rosterAreaPhase = 0;
        this.rosterAreaScratch = [];
        this.signatureSkillTimer = 0;
        this.signatureSkillCursor = 0;
        this.signatureSkillPhase = 0;
        this.signatureSkillScratch = [];
        this.shinyTrailTimer = 0;
        this.shinyTrailCursor = 0;
        this.groveTimer = 0;
        this.groveCursor = 0;
        this.grovePhase = 0;
        this.meowthTimer = 0;
        this.meowthCursor = 0;
        this.meowthPhase = 0;
        this.gmaxAuraTimer = 0;
        this.gmaxAuraCursor = 0;
        this.gmaxAuraPhase = 0;
        this.gmaxSkillTimer = 0;
        this.gmaxSkillCursor = 0;
        this.gmaxSkillPhase = 0;
    }

    _makeSlot (frameKey = 'circle') {
        const cc = this.cc;
        const shinyWalk = frameKey === 'star';
        const node = new cc.Node(shinyWalk ? 'NativeShinyFootstep' : `NativeParticleBurst:${frameKey}`);
        node.layer = cc.Layers.Enum.UI_2D;
        this.parent.addChild(node);
        const ps = node.addComponent(cc.ParticleSystem2D);
        ps.custom = true;
        ps.spriteFrame = this.particleGlyphFrames[frameKey]?.frame
            || this.glyphFrames[frameKey]?.frame
            || (shinyWalk ? this.starFrame : this.spriteFrame);
        ps.customMaterial = this.material;
        // Grouped keeps particles in this game world's local coordinates, so the camera transform
        // is applied once by the parent and the burst doesn't drift in screen space.
        ps.positionType = cc.ParticleSystem2D.PositionType.GROUPED;
        ps.duration = 0.08;
        ps.emissionRate = 180;
        ps.life = 0.38;
        ps.lifeVar = 0.1;
        ps.totalParticles = 24;
        ps.startSize = 16;
        ps.startSizeVar = 6;
        ps.endSize = 2;
        ps.endSizeVar = 1;
        ps.speed = 78;
        ps.speedVar = 48;
        const gravity = new cc.Vec2(0, -7);
        const posVar = new cc.Vec2(4, 4);
        ps.gravity = gravity;
        ps.posVar = posVar;
        ps.tangentialAccel = 0;
        ps.radialAccel = 0;
        ps.startColorVar = new cc.Color(14, 14, 14, 0);
        ps.endColorVar = new cc.Color(0, 0, 0, 0);
        node.active = false;
        const slot = { node, ps, gravity, posVar, time: 0, stopAt: 0, busy: false, shinyWalk, frameKey };
        this.slots.push(slot);
        return slot;
    }

    /**
     * Fire one pooled emitter. `overrides` lets call sites retune a preset per shot - the dynamax
     * aura spreads with the巨人化 body's radius, which no static preset can know.
     */
    burst (famId, x, y, angle = 0, kind = 'hit', megaId = null, overrides = null) {
        const shinyWalk = kind === 'shiny-walk';
        const species = family(famId);
        const gmaxForm = megaId ? GIGANTAMAX_BY_ID[megaId] : null;
        const megaForm = megaId ? MEGA_BY_ID[megaId] : null;
        const gmaxSkill = !!gmaxForm && kind === 'mega-skill';
        const megaBurstPreset = megaForm && (kind === 'mega' || kind === 'mega-hit') ? {
            particleClass: 'mega-burst', glyph: megaForm.glyph || 'star', color: megaForm.color,
            duration: kind === 'mega-hit' ? 0.07 : 0.12,
            emissionRate: kind === 'mega-hit' ? 520 : 330,
            totalParticles: kind === 'mega-hit' ? 20 : 14,
            life: kind === 'mega-hit' ? 0.34 : 0.42,
            lifeVar: 0.08, angleVar: kind === 'mega-hit' ? 180 : 36,
            speed: kind === 'mega-hit' ? 118 : 76, speedVar: kind === 'mega-hit' ? 50 : 32,
            startSize: kind === 'mega-hit' ? 19 : 17, startSizeVar: 5, endSize: 1,
            tangentialAccel: kind === 'mega-hit' ? 0 : 24,
            radialAccel: kind === 'mega-hit' ? 38 : -8,
            gravityY: 0, posVar: 2,
        } : null;
        const megaAreaPreset = megaForm && kind === 'mega-area' ? {
            particleClass: 'mega-area', glyph: megaForm.glyph || 'star', color: megaForm.color,
            duration: 0.016, emissionRate: 170, totalParticles: 5,
            life: 0.32, lifeVar: 0.06, angleVar: 52,
            speed: 23, speedVar: 13, startSize: 17, startSizeVar: 5, endSize: 1,
            tangentialAccel: 34, radialAccel: -12, gravityY: 0, posVar: 3,
        } : null;
        const rosterForm = kind === 'roster-area'
            ? activeSkillModuleForForm({ id: megaId })?.FORM : null;
        const rosterAreaPreset = rosterForm ? {
            particleClass: 'roster-area', glyph: rosterForm.glyph || 'star', color: rosterForm.color,
            duration: 0.016, emissionRate: 175, totalParticles: 5,
            life: 0.34, lifeVar: 0.06, angleVar: 58,
            speed: 21, speedVar: 12, startSize: 17, startSizeVar: 5, endSize: 1,
            tangentialAccel: 28, radialAccel: -10, gravityY: 0, posVar: 3,
        } : null;
        const signatureForm = kind === 'signature-area'
            ? (megaForm || activeSkillModuleForForm({ id: megaId })?.FORM) : null;
        const signatureAreaPreset = signatureForm ? {
            particleClass: 'signature-area', glyph: signatureForm.glyph || 'star', color: signatureForm.color,
            duration: 0.016, emissionRate: 190, totalParticles: 5,
            life: 0.4, lifeVar: 0.08, angleVar: 62,
            speed: 27, speedVar: 17, startSize: 18, startSizeVar: 6, endSize: 1,
            tangentialAccel: 32, radialAccel: -11, gravityY: -3, posVar: 4,
        } : null;
        const megaTrailPreset = megaForm && kind === 'trail' ? {
            particleClass: 'projectile-trail', glyph: megaForm.glyph || 'star', color: megaForm.color,
            duration: 0.024, emissionRate: 300, totalParticles: 8,
            life: 0.36, lifeVar: 0.08, angleVar: 18,
            speed: 38, speedVar: 18, startSize: 29, startSizeVar: 8, endSize: 2,
            spinStartVar: 180, spinEnd: 320, spinEndVar: 120,
            tangentialAccel: 46, radialAccel: -16, gravityY: 0, posVar: 2,
        } : null;
        const legendaryKind = kind.startsWith('legendary-') ? kind : `legendary-${kind}`;
        const eventPreset = overrides?.particlePreset
            || skillParticlePresetForEvent(gmaxSkill ? 'gigantamax-core' : kind)
            || megaBurstPreset
            || megaAreaPreset
            || rosterAreaPreset
            || signatureAreaPreset
            || megaTrailPreset
            || (famId.startsWith('legend-') || famId.startsWith('wildboss-')
                ? legendaryParticlePresetForEvent(legendaryKind, famId) : null);
        // A normal impact inherits the species' own moving-particle silhouette. Families without
        // a signature trail still get a type-specific elemental burst, so no ordinary hit falls
        // back to the old generic circle puff.
        const preset = eventPreset || (kind === 'hit'
            ? projectileImpactPresetForFamily(famId, species?.element || 'support')
            : null);
        const frameKey = overrides?.glyphFrame || preset?.glyph || (shinyWalk ? 'star' : 'circle');
        let slot;
        for (let i = 0; i < this.slots.length; i++) {
            if (!this.slots[i].busy && this.slots[i].frameKey === frameKey) { slot = this.slots[i]; break; }
        }
        if (!slot) {
            if (this.slots.length >= POOL_SIZE) return;
            slot = this._makeSlot(frameKey);
        }

        const cc = this.cc;
        const ps = slot.ps;
        // Species sprites arrive asynchronously after the greybox atlas is built. A pooled emitter
        // may have been created with the circle fallback before that load finished, so refresh its
        // frame on every reuse instead of permanently caching the fallback for signature shots.
        ps.spriteFrame = this.particleGlyphFrames[frameKey]?.frame
            || this.glyphFrames[frameKey]?.frame || this.spriteFrame;
        const flower = preset && preset.particleClass === 'flower';
        const waterChannel = preset && preset.particleClass === 'mega-channel';
        const hex = shinyWalk ? SHINY_GOLD : (preset && preset.color) || (megaForm && megaForm.color)
            || (gmaxForm && gmaxForm.color)
            || (species && ELEMENT[species.element]) || '#ffffff';
        let tint = this.tints.get(hex);
        if (!tint) { tint = colorOf(cc, hex); this.tints.set(hex, tint); }
        let fade = this.fades.get(hex);
        if (!fade) { fade = colorOf(cc, hex, 0); this.fades.set(hex, fade); }
        const trail = kind === 'trail' || kind.startsWith('projectile-trail-')
            || kind.startsWith('trainer-projectile-trail-') || kind.startsWith('beam-trail-')
            || kind.startsWith('orbit-trail-') || kind.startsWith('field-trail-')
            || preset?.particleClass === 'z-trail' || preset?.particleClass === 'mega-area'
            || preset?.particleClass === 'roster-area';
        const particleTrail = trail || preset?.particleClass === 'signature-area'
            || preset?.particleClass === 'projectile-icon';
        const megaSkill = kind === 'mega-skill';
        const gmaxParticles = preset && preset.particleClass === 'gigantamax';
        const mega = kind === 'mega' || kind === 'mega-hit' || megaSkill || gmaxSkill || gmaxParticles
            || waterChannel || (trail && !!megaForm);
        const megaHit = kind === 'mega-hit';
        ps.duration = shinyWalk ? 0.018 : preset ? preset.duration : trail ? 0.025 : (megaSkill ? 0.24 : megaHit ? 0.09 : (mega ? 0.18 : 0.08));
        ps.emissionRate = shinyWalk ? 170 : preset ? preset.emissionRate : trail ? 320 : (megaSkill ? 820 : megaHit ? 460 : (mega ? 520 : 180));
        ps.totalParticles = shinyWalk ? 4 : preset ? preset.totalParticles : trail ? (mega ? 12 : 7) : (megaSkill ? 180 : megaHit ? 44 : (mega ? 96 : 24));
        ps.life = shinyWalk ? 0.48 : preset ? preset.life : trail ? (mega ? 0.34 : 0.22) : (megaSkill ? 0.95 : megaHit ? 0.46 : (mega ? 0.86 : 0.38));
        ps.lifeVar = shinyWalk ? 0.12 : preset ? preset.lifeVar : trail ? 0.06 : (megaSkill ? 0.28 : megaHit ? 0.12 : (mega ? 0.26 : 0.1));
        ps.angle = (angle + (particleTrail ? Math.PI : 0)) * 180 / Math.PI;
        ps.angleVar = preset ? preset.angleVar : trail ? 42 : (kind === 'shot' ? 34 : 180);
        ps.speed = shinyWalk ? 18 : preset ? preset.speed : trail ? (mega ? 58 : 38) : (megaSkill ? 255 : megaHit ? 172 : (mega ? 220 : (kind === 'shot' ? 50 : 84)));
        ps.speedVar = shinyWalk ? 10 : preset ? preset.speedVar : trail ? (mega ? 28 : 20) : (megaSkill ? 135 : megaHit ? 72 : (mega ? 110 : (kind === 'shot' ? 22 : 48)));
        const iconProjectile = preset?.particleClass === 'projectile-icon';
        // A modest global boost keeps glyphs legible after camera scaling. Keep actual creature
        // icons and tiny shiny footsteps at their carefully tuned sizes to avoid oversized sprites.
        const readabilityScale = shinyWalk || iconProjectile ? 1 : 1.2;
        ps.startSize = (shinyWalk ? 8 : preset ? preset.startSize : trail ? (mega ? 12 : 9) : (megaSkill ? 34 : megaHit ? 21 : (mega ? 29 : (kind === 'shot' ? 7 : (kind === 'beam' ? 12 : 16))))) * readabilityScale;
        ps.startSizeVar = (shinyWalk ? 3 : preset ? preset.startSizeVar : trail ? (mega ? 5 : 4) : (megaSkill ? 17 : megaHit ? 8 : (mega ? 14 : (kind === 'shot' ? 3 : 6)))) * readabilityScale;
        ps.startSpin = preset && preset.spinStart || 0;
        ps.startSpinVar = preset && preset.spinStartVar || 0;
        ps.endSpin = preset && preset.spinEnd || 0;
        ps.endSpinVar = preset && preset.spinEndVar || 0;
        // Mega launches curl into a short comet spiral; hits burst radially. Reset every ordinary
        // emitter to zero so a reused pooled slot never inherits a legendary attack's motion.
        ps.tangentialAccel = shinyWalk ? 0 : preset ? preset.tangentialAccel : megaHit ? 0 : (mega ? 48 : 0);
        ps.radialAccel = shinyWalk ? 0 : preset ? preset.radialAccel : megaHit ? 42 : (mega ? 14 : 0);
        const endSize = preset?.endSize ?? 2;
        ps.endSize = iconProjectile || shinyWalk ? endSize : Math.max(3, endSize * readabilityScale);
        ps.startColor = preset?.color ? tint : mega ? (this.megaTints.get(megaId) || this.megaTint) : tint;
        ps.endColor = preset?.color ? fade : mega ? (this.megaFades.get(megaId) || this.megaFade) : fade;
        slot.gravity.x = 0;
        slot.gravity.y = shinyWalk ? 0 : preset ? preset.gravityY : trail ? 0 : -7;
        slot.posVar.x = shinyWalk ? 4 : preset ? preset.posVar : trail ? 2 : 4;
        slot.posVar.y = shinyWalk ? 4 : preset ? preset.posVar : trail ? 2 : 4;
        if (overrides) {
            if (overrides.posVar !== undefined) {
                slot.posVar.x = overrides.posVar;
                slot.posVar.y = overrides.posVar;
            }
            if (overrides.startSize !== undefined) ps.startSize = overrides.startSize;
            if (overrides.startSizeVar !== undefined) ps.startSizeVar = overrides.startSizeVar;
        }
        slot.node.setPosition(x, y, 0);
        slot.node.active = true;
        ps.resetSystem();
        slot.time = ps.duration + ps.life + ps.lifeVar;
        slot.stopAt = ps.duration;
        slot.busy = true;

        // Gmax skills use a three-layer native particle burst: flame core, rotating shards, then
        // sparse sparks. Shared form tints keep each species palette distinct across all layers.
        if (gmaxSkill) {
            this.burst(famId, x, y, angle, 'gigantamax-shards', megaId);
            this.burst(famId, x, y, angle, 'gigantamax-sparks', megaId);
        }
    }

    _emitTandemausProjectile (sample) {
        const shiny = !!sample.shiny;
        const glyphFrame = `MAUSHOLD_COMPANION_${(sample.variant || 0) % 4 + 1}${shiny ? '_s' : ''}`;
        const iconSize = Math.max(40, Math.min(76, sample.radius * 3.6));
        this.burst('tandemaus', sample.x, sample.y, sample.angle, 'projectile-icon', null, {
            glyphFrame,
            startSize: iconSize,
            startSizeVar: 0,
            posVar: 0.5,
            particlePreset: {
                particleClass: 'projectile-icon', glyph: glyphFrame,
                // Preserve the source sprite palette: normal mice are white, shiny mice are gold.
                color: '#ffffff',
                duration: 0.018, emissionRate: 60, totalParticles: 1,
                life: 0.115, lifeVar: 0.012, angleVar: 0,
                speed: 0, speedVar: 0, startSize: iconSize, startSizeVar: 0,
                endSize: iconSize * 0.86, endSizeVar: 0,
                spinStartVar: 0, spinEnd: 0, spinEndVar: 0,
                tangentialAccel: 0, radialAccel: 0, gravityY: 0, posVar: 0.5,
            },
        });
    }

    /** Sample live shots at a bounded rate so native particles leave moving trails without per-frame emitters. */
    updateProjectileTrails (dt, skills) {
        if (!skills) {
            this.trailTimer = 0;
            return;
        }
        // Tandemaus moves quickly and often hits before a timed poll can see it. These samples are
        // captured from each real SkillSystem flight step, so the mouse icon follows the exact shot
        // path and is still emitted on the impact frame when that shot leaves the live array.
        const projectileSampleCount = skills.nProjectileSamples || 0;
        for (let i = 0; i < projectileSampleCount; i++) {
            this._emitTandemausProjectile(skills.projectileSamples[i]);
        }
        skills.nProjectileSamples = 0;
        if (skills.n <= 0) {
            this.trailTimer = 0;
            return;
        }
        this.trailTimer -= dt;
        if (this.trailTimer > 0) return;
        this.trailTimer = 0.055;
        // Six short native bursts per tick cycle through the live-shot pool quickly enough that
        // ordinary volleys read as particle attacks, not a handful of decorative sampled shots.
        const samples = Math.min(6, skills.n);
        const selected = [];
        // Strict round-robin: do not reserve a species-specific slot, which would repeatedly
        // displace shots at the cursor and leave part of a crowded volley without particle trails.
        for (let count = 0; count < samples; count++) {
            selected.push(this.trailCursor % skills.n);
            this.trailCursor = (this.trailCursor + 1) % skills.n;
        }
        for (const i of selected) {
            const angle = Math.atan2(skills.pvy[i], skills.pvx[i]);
            const megaId = skills.pmega[i];
            const famId = skills.pfam[i];
            const species = family(famId);
            const shiny = skills.pShiny?.[i] === 1;
            if (famId === 'tandemaus') continue;
            const dreepyIcon = famId === 'dreepy' && skills.pStage?.[i] >= 3;
            if (dreepyIcon) {
                const glyphFrame = `DREEPY${shiny ? '_s' : ''}`;
                const iconSize = Math.max(20, Math.min(44, skills.pr[i] * 1.8));
                this.burst(famId, skills.px[i], skills.py[i], angle, 'projectile-icon', null, {
                    glyphFrame,
                    startSize: iconSize,
                    startSizeVar: 0,
                    posVar: 0.5,
                    particlePreset: {
                        particleClass: 'projectile-icon', glyph: glyphFrame, color: '#ffffff',
                        duration: 0.018, emissionRate: 60, totalParticles: 1,
                        life: 0.17, lifeVar: 0.015, angleVar: 0,
                        speed: 0, speedVar: 0, startSize: iconSize, startSizeVar: 0,
                        endSize: iconSize * 0.86, endSizeVar: 0,
                        spinStartVar: 12, spinEnd: 0, spinEndVar: 0,
                        tangentialAccel: 0, radialAccel: 0, gravityY: 0, posVar: 0.5,
                    },
                });
                continue;
            }
            const signatureTrail = skillParticlePresetForEvent(`projectile-trail-${famId}`);
            const trailKind = megaId ? 'trail' : signatureTrail
                ? `projectile-trail-${famId}` : `projectile-trail-${species?.element || 'support'}`;
            this.burst(famId, skills.px[i], skills.py[i], angle, trailKind, megaId);
        }
    }

    /** Lower-cost elemental trails make hostile trainer shots read as particles without crowding ally trails. */
    updateTrainerProjectileTrails (dt, trainer) {
        if (!trainer?.active || trainer.n <= 0) {
            this.trainerTrailTimer = 0;
            this.trainerTrailCursor = 0;
            return;
        }
        this.trainerTrailTimer -= dt;
        if (this.trainerTrailTimer > 0) return;
        this.trainerTrailTimer = 0.055;
        const samples = Math.min(2, trainer.n);
        for (let sample = 0; sample < samples; sample++) {
            const i = this.trainerTrailCursor % trainer.n;
            this.trainerTrailCursor = (this.trainerTrailCursor + 1) % trainer.n;
            const slot = trainer.slot[i];
            const famId = trainer.party[slot]?.fam || 'mush';
            const species = family(famId);
            const form = trainer.isMegaSlot(slot) ? trainer.megaForm : null;
            const kind = form ? 'trail' : `trainer-projectile-trail-${species?.element || 'support'}`;
            this.burst(famId, trainer.x[i], trainer.y[i], Math.atan2(trainer.vy[i], trainer.vx[i]),
                kind, form?.id || null);
        }
    }

    /** Bounded particle passes for beam, slash and orbit effects; damage remains in SkillSystem. */
    updateSkillEffectParticles (dt, skills) {
        if (!skills || skills.nfx <= 0) {
            this.skillFxTimer = 0;
            this.skillFxCursor = 0;
            this.skillFxPhase = 0;
            return;
        }
        const effects = this.skillFxScratch;
        effects.length = 0;
        for (let i = 0; i < skills.nfx; i++) {
            const fx = skills.fx[i];
            if (fx && (fx.kind === 'beam' || fx.kind === 'slash' || fx.kind === 'orbit')) effects.push(fx);
        }
        if (!effects.length) {
            this.skillFxTimer = 0;
            this.skillFxCursor = 0;
            this.skillFxPhase = 0;
            return;
        }
        this.skillFxTimer -= dt;
        if (this.skillFxTimer > 0) return;
        this.skillFxTimer = 0.055;
        for (let sample = 0; sample < Math.min(2, effects.length); sample++) {
            const fx = effects[this.skillFxCursor % effects.length];
            this.skillFxCursor = (this.skillFxCursor + 1) % effects.length;
            const species = family(fx.fam);
            let x = fx.x;
            let y = fx.y;
            let angle = fx.rot;
            let kind;
            if (fx.kind === 'beam') {
                const signature = `beam-trail-${fx.fam}`;
                kind = skillParticlePresetForEvent(signature)
                    ? signature : `beam-trail-${species?.element || 'support'}`;
                const along = ((this.skillFxPhase++ % 5) / 4) * 2 - 1;
                x += Math.cos(angle) * fx.a * along;
                y += Math.sin(angle) * fx.a * along;
            } else if (fx.kind === 'slash') {
                const signature = `projectile-trail-${fx.fam}`;
                kind = skillParticlePresetForEvent(signature)
                    ? signature : `projectile-trail-${species?.element || 'support'}`;
                x -= Math.cos(angle) * fx.a * 0.28;
                y -= Math.sin(angle) * fx.a * 0.28;
            } else {
                kind = `orbit-trail-${species?.element || 'support'}`;
                const outer = Math.max(0, fx.b | 0);
                const inner = Math.max(0, fx.c | 0);
                const total = outer + inner;
                const mote = total ? this.skillFxPhase++ % total : 0;
                const isInner = mote >= outer && inner > 0;
                const count = isInner ? inner : Math.max(1, outer);
                angle = fx.rot + (isInner ? -1 : 1) * (mote % count) * Math.PI * 2 / count;
                const radius = fx.a * (isInner ? 0.64 : 1);
                x += Math.cos(angle) * radius;
                y += Math.sin(angle) * radius;
            }
            this.burst(fx.fam, x, y, angle + Math.PI, kind);
        }
    }

    /** Slowly orbit motes through persistent healing/attack fields; gameplay radius stays untouched. */
    updateFieldParticles (dt, skills) {
        const effects = this.fieldFxScratch;
        effects.length = 0;
        if (skills) {
            for (let i = 0; i < skills.nfx; i++) {
                const fx = skills.fx[i];
                if (fx?.kind === 'field') effects.push(fx);
            }
        }
        if (!effects.length) {
            this.fieldFxTimer = 0;
            this.fieldFxCursor = 0;
            this.fieldFxPhase = 0;
            return;
        }
        this.fieldFxTimer -= dt;
        if (this.fieldFxTimer > 0) return;
        this.fieldFxTimer = 0.12;
        for (let sample = 0; sample < Math.min(2, effects.length); sample++) {
            const fx = effects[this.fieldFxCursor % effects.length];
            this.fieldFxCursor = (this.fieldFxCursor + 1) % effects.length;
            const species = family(fx.fam);
            const angle = this.fieldFxPhase++ * 2.399963229728653 + fx.p * Math.PI * 2;
            const radius = fx.a * (0.24 + 0.62 * ((this.fieldFxPhase % 5) / 5));
            const x = fx.x + Math.cos(angle) * radius;
            const y = fx.y + Math.sin(angle) * radius;
            this.burst(fx.fam, x, y, angle + Math.PI / 2,
                `field-trail-${species?.element || 'support'}`);
        }
    }

    /** Particle trail for the single, aimed Z projectile; the crystal identity selects its glyph. */
    updateZMoveParticles (dt, zMoves) {
        const shot = zMoves?.projectile;
        if (!shot) {
            this.zTrailTimer = 0;
            return;
        }
        this.zTrailTimer -= dt;
        if (this.zTrailTimer > 0) return;
        this.zTrailTimer = 0.035;
        this.burst('mush', shot.x, shot.y, Math.atan2(shot.dy, shot.dx), `z-${shot.id}-trail`);
    }

    /** Bounded particles for generic Mega active areas; specialized/shape skills keep their own cues. */
    updateMegaAreaParticles (dt, megaFx) {
        const effects = this.megaAreaScratch;
        effects.length = 0;
        for (const fx of megaFx || []) {
            if (!fx?.active || !fx.area || !fx.form || fx.form.gigantamax) continue;
            const module = activeSkillModuleForForm(fx.form);
            if (module?.drawEffect && fx.shape) continue;
            effects.push(fx);
        }
        if (!effects.length) {
            this.megaAreaTimer = 0;
            this.megaAreaCursor = 0;
            this.megaAreaPhase = 0;
            return;
        }
        this.megaAreaTimer -= dt;
        if (this.megaAreaTimer > 0) return;
        this.megaAreaTimer = 0.075;
        for (let sample = 0; sample < Math.min(2, effects.length); sample++) {
            const fx = effects[this.megaAreaCursor % effects.length];
            this.megaAreaCursor = (this.megaAreaCursor + 1) % effects.length;
            const phase = this.megaAreaPhase++;
            const angle = fx.angle + phase * 2.399963229728653;
            const radius = fx.radius * (0.28 + 0.56 * ((phase % 5) / 5));
            const x = fx.x + Math.cos(angle) * radius;
            const y = fx.y + Math.sin(angle) * radius;
            this.burst(fx.form.fam, x, y, angle + Math.PI / 2, 'mega-area', fx.form.id);
        }
    }

    /** Sample signature attacks into small native glyph streams; shape and damage stay in their skill modules. */
    updateSignatureSkillParticles (dt, megaFx) {
        const effects = this.signatureSkillScratch;
        effects.length = 0;
        for (const fx of megaFx || []) {
            if (!fx?.active || !fx.area || !fx.form) continue;
            if (!SIGNATURE_SKILL_FORMS.has(fx.form.id)) continue;
            effects.push(fx);
        }
        if (!effects.length) {
            this.signatureSkillTimer = 0;
            this.signatureSkillCursor = 0;
            this.signatureSkillPhase = 0;
            return;
        }
        this.signatureSkillTimer -= dt;
        if (this.signatureSkillTimer > 0) return;
        this.signatureSkillTimer = 0.055;
        for (let sample = 0; sample < Math.min(2, effects.length); sample++) {
            const fx = effects[this.signatureSkillCursor++ % effects.length];
            const phase = this.signatureSkillPhase++;
            const angle = phase * 2.399963229728653 + fx.angle;
            let x = fx.x;
            let y = fx.y;
            let particleAngle = angle;
            let burstOptions = null;
            if (fx.form.id === 'blastoise') {
                if (fx.age < BLASTOISE_SKILL.charge) continue;
                // Distribute small forward-moving droplets through the lane; the continuous beam
                // silhouette is drawn by the skill module instead of relying on random cannon icons.
                const alongSlot = (phase * 5) % 12;
                const acrossSlot = (phase * 7) % 3 - 1;
                const along = (0.12 + alongSlot / 11 * 0.76) * fx.radius;
                const across = acrossSlot * fx.width * 0.2;
                x += Math.cos(fx.angle) * along - Math.sin(fx.angle) * across;
                y += Math.sin(fx.angle) * along + Math.cos(fx.angle) * across;
                // signature-area reverses particle angles for trails, so invert once here to
                // make the water flecks travel in the same direction as the cannon stream.
                particleAngle = fx.angle + Math.PI;
                burstOptions = { posVar: 2.5, particlePreset: BLASTOISE_STREAM_SAMPLE };
            } else if (fx.form.id === 'blaziken') {
                const tail = fx.radius * (0.3 + 0.48 * ((phase % 5) / 5));
                const spread = ((phase % 3) - 1) * Math.min(10, fx.radius * 0.18);
                x -= Math.cos(fx.angle) * tail + Math.sin(fx.angle) * spread;
                y -= Math.sin(fx.angle) * tail - Math.cos(fx.angle) * spread;
                // burst() already reverses signature-area particles to trail behind the charge.
                // Passing the heading here keeps the ember stream moving backward instead of
                // sending it into the player sprite, where the previous double-reversal hid it.
                particleAngle = fx.angle;
            } else if (fx.form.id === 'gardevoir') {
                const t = angle;
                const nx = (16 * Math.sin(t) ** 3) / 17;
                const ny = -(13 * Math.cos(t) - 5 * Math.cos(2 * t)
                    - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17;
                x += nx * fx.radius;
                y += ny * fx.radius;
                particleAngle = angle + Math.PI / 2;
            } else {
                const radius = fx.radius * (0.18 + 0.74 * ((phase % 7) / 7));
                x += Math.cos(angle) * radius;
                y += Math.sin(angle) * radius;
                particleAngle = angle - Math.PI / 2;
            }
            const particleKind = fx.form.id === 'blaziken' ? 'blaziken-charge-trail' : 'signature-area';
            this.burst(fx.form.fam, x, y, particleAngle, particleKind, fx.form.id, burstOptions);
        }
    }

    /** Particle-led, short pulses for circular/heart roster areas; direction-specific dives stay custom. */
    updateRosterAreaParticles (dt, megaFx) {
        const effects = this.rosterAreaScratch;
        effects.length = 0;
        for (const fx of megaFx || []) {
            if (!fx?.active || !fx.area || !fx.form?.rosterActive || fx.form.id === 'roster-archeops') continue;
            effects.push(fx);
        }
        if (!effects.length) {
            this.rosterAreaTimer = 0;
            this.rosterAreaCursor = 0;
            this.rosterAreaPhase = 0;
            return;
        }
        this.rosterAreaTimer -= dt;
        if (this.rosterAreaTimer > 0) return;
        this.rosterAreaTimer = 0.075;
        for (let sample = 0; sample < Math.min(2, effects.length); sample++) {
            const fx = effects[this.rosterAreaCursor % effects.length];
            this.rosterAreaCursor = (this.rosterAreaCursor + 1) % effects.length;
            const phase = this.rosterAreaPhase++;
            const angle = phase * 2.399963229728653 + fx.angle;
            let nx = Math.cos(angle) * 0.72;
            let ny = Math.sin(angle) * 0.72;
            if (fx.form.id === 'roster-hatterene') {
                // Normalized parametric heart boundary, so its sparkles follow the same silhouette as hitHeart().
                const t = angle;
                nx = (16 * Math.sin(t) ** 3) / 17;
                ny = -(13 * Math.cos(t) - 5 * Math.cos(2 * t)
                    - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17;
            } else if (fx.form.id === 'roster-vivillon') {
                nx = Math.cos(angle) * 0.88;
                ny = Math.sin(angle) * 0.56;
            } else if (fx.form.id === 'roster-ribombee') {
                const ring = 0.62 + 0.1 * Math.sin(phase * 1.7);
                nx = Math.cos(angle) * ring;
                ny = Math.sin(angle) * ring;
            } else {
                const inner = 0.25 + 0.5 * ((phase % 5) / 5);
                nx *= inner / 0.72;
                ny *= inner / 0.72;
            }
            this.burst(fx.form.fam, fx.x + nx * fx.radius, fx.y + ny * fx.radius,
                angle + Math.PI / 2, 'roster-area', fx.form.id);
        }
    }

    /** Emit sparse star steps only for moving shiny segment heads, using pooled Cocos emitters. */
    updateShinyWalkTrails (dt, chain) {
        this.shinyTrailTimer -= dt;
        if (this.shinyTrailTimer > 0 || !chain || chain.nCount <= 0) return;
        this.shinyTrailTimer = 0.12;
        let scanned = 0;
        let emitted = 0;
        while (scanned++ < chain.nCount && emitted < 2) {
            const i = this.shinyTrailCursor++ % chain.nCount;
            const seg = chain.segments[chain.segIndex[i]];
            if (!seg || !seg.shiny || chain.nodeOfSeg[i] !== 0 || chain.nspd[i] < 18) continue;
            this.burst(seg.fam, chain.nx[i], chain.ny[i], chain.na[i], 'shiny-walk');
            emitted++;
        }
    }

    /** A low, globally-capped stream of native leaf/spore particles for persistent healing groves. */
    updateRillaboomGroves (dt, fields) {
        if (!fields || fields.length === 0) {
            this.groveTimer = 0;
            this.groveCursor = 0;
            this.grovePhase = 0;
            return;
        }
        this.groveTimer -= dt;
        if (this.groveTimer > 0) return;
        this.groveTimer = 0.14;

        // At most one emitter per tick, even if several groves overlap.
        const grove = fields[this.groveCursor++ % fields.length];
        const phase = this.grovePhase++ % 4;
        const leaf = phase === 0 || phase === 2;
        const preset = leaf ? 'rillaboom-grove-leaf' : 'rillaboom-grove-spore';
        const fraction = (this.groveCursor * 0.61803398875) % 1;
        const radius = grove.radius * (leaf ? 0.82 + fraction * 0.13 : 0.24 + fraction * 0.42);
        const angle = this.groveCursor * 2.399963229728653;
        const x = grove.x + Math.cos(angle) * radius;
        const y = grove.y + Math.sin(angle) * radius;
        this.burst(grove.segment?.fam || 'grookey', x, y, angle + Math.PI / 2, preset, 'rillaboom');
    }

    /** A low, round-robin coin-and-glint stream around Gigantamax Meowth heads. */
    updateGigantamaxMeowth (dt, chain) {
        if (!chain || chain.nCount <= 0 || !chain.segments?.length) {
            this.meowthTimer = 0;
            this.meowthCursor = 0;
            this.meowthPhase = 0;
            return;
        }
        const meowths = [];
        for (let i = 0; i < chain.segments.length; i++) {
            if (chain.segments[i]?.gigantamax === 'meowth') meowths.push(i);
        }
        if (!meowths.length) {
            this.meowthTimer = 0;
            this.meowthCursor = 0;
            this.meowthPhase = 0;
            return;
        }
        this.meowthTimer -= dt;
        if (this.meowthTimer > 0) return;
        this.meowthTimer = 0.17;

        // One small emitter at a time, even with a full party of giant cats.
        const segmentIndex = meowths[this.meowthCursor++ % meowths.length];
        const node = chain.headOf(segmentIndex);
        if (node < 0 || node >= chain.nCount) return;
        const phase = this.meowthPhase++ * 2.399963229728653;
        const orbit = 34 + (this.meowthPhase % 3) * 10;
        const x = chain.nx[node] + Math.cos(phase) * orbit;
        const y = chain.ny[node] + Math.sin(phase) * orbit * 0.68;
        const tangent = phase + Math.PI / 2;
        this.burst(chain.segments[segmentIndex].fam || 'cat', x, y, tangent,
            'gmax-meowth-coins', 'meowth');
        if (this.meowthPhase % 3 === 0) {
            this.burst(chain.segments[segmentIndex].fam || 'cat', x, y, phase,
                'gmax-meowth-glints', 'meowth');
        }
    }

    /** One round-robin, species-shaped particle puff replaces the filled aura around every Gmax body. */
    updateGigantamaxAuras (dt, chain) {
        if (!chain || chain.nCount <= 0 || !chain.segments?.length) {
            this.gmaxAuraTimer = 0;
            this.gmaxAuraCursor = 0;
            this.gmaxAuraPhase = 0;
            return;
        }
        const giants = [];
        for (let i = 0; i < chain.segments.length; i++) {
            const segment = chain.segments[i];
            const form = segment?.gigantamax ? GIGANTAMAX_BY_ID[segment.gigantamax] : null;
            if (form && form.fam === segment.fam && form.tier === segment.tier && !segment.gigaEntry) {
                giants.push({ i, segment, form });
            }
        }
        if (!giants.length) {
            this.gmaxAuraTimer = 0;
            this.gmaxAuraCursor = 0;
            this.gmaxAuraPhase = 0;
            return;
        }
        this.gmaxAuraTimer -= dt;
        if (this.gmaxAuraTimer > 0) return;
        this.gmaxAuraTimer = 0.105;
        const entry = giants[this.gmaxAuraCursor++ % giants.length];
        const node = chain.headOf(entry.i);
        if (node < 0 || node >= chain.nCount) return;
        const phase = this.gmaxAuraPhase++ * 2.399963229728653 + entry.i * 0.73;
        const bodyRadius = typeof chain.radiusOf === 'function'
            ? chain.radiusOf(entry.segment, entry.segment.tier) : 30 + entry.segment.tier * 6;
        const orbit = Math.max(28, Math.min(76, bodyRadius * 0.9));
        const x = chain.nx[node] + Math.cos(phase) * orbit;
        const y = chain.ny[node] + Math.sin(phase) * orbit * 0.72;
        this.burst(entry.segment.fam, x, y, phase + Math.PI / 2,
            `gmax-aura-${entry.form.id}`, entry.form.id, { posVar: 4 });
    }

    /** Sample moving Gmax attack areas with short, family-specific particle streams instead of drawn rings. */
    updateGigantamaxSkillParticles (dt, effects) {
        if (!Array.isArray(effects) || effects.length === 0) {
            this.gmaxSkillTimer = 0;
            this.gmaxSkillCursor = 0;
            this.gmaxSkillPhase = 0;
            return;
        }
        const active = effects.filter((fx) => fx.active && fx.form?.gigantamax);
        if (!active.length) {
            this.gmaxSkillTimer = 0;
            this.gmaxSkillCursor = 0;
            this.gmaxSkillPhase = 0;
            return;
        }
        this.gmaxSkillTimer -= dt;
        if (this.gmaxSkillTimer > 0) return;
        this.gmaxSkillTimer = 0.065;
        const fx = active[this.gmaxSkillCursor++ % active.length];
        const form = fx.form;
        const phase = this.gmaxSkillPhase++ * 2.399963229728653 + fx.age * 2;
        let x = fx.x;
        let y = fx.y;
        let angle = phase;
        if (fx.shape === 'directional-fireball') {
            angle = fx.angle;
            x -= Math.cos(angle) * fx.radius * 0.52;
            y -= Math.sin(angle) * fx.radius * 0.52;
        } else {
            const distance = fx.radius * (0.34 + 0.58 * ((this.gmaxSkillPhase % 5) / 5));
            x += Math.cos(phase) * distance;
            y += Math.sin(phase) * distance;
            angle = phase + Math.PI / 2;
        }
        this.burst(form.fam, x, y, angle, `gmax-skill-${form.id}`, form.id, { posVar: 7 });
    }

    update (dt) {
        for (const slot of this.slots) {
            if (!slot.busy) continue;
            slot.time -= dt;
            slot.stopAt -= dt;
            if (slot.stopAt <= 0) {
                slot.ps.stopSystem();
                slot.stopAt = Infinity;
            }
            if (slot.time <= 0 && slot.ps.particleCount === 0) {
                slot.node.active = false;
                slot.busy = false;
            }
        }
    }

    clear () {
        this.trailTimer = 0;
        this.trailCursor = 0;
        this.trainerTrailTimer = 0;
        this.trainerTrailCursor = 0;
        this.skillFxTimer = 0;
        this.skillFxCursor = 0;
        this.skillFxPhase = 0;
        this.skillFxScratch.length = 0;
        this.fieldFxTimer = 0;
        this.fieldFxCursor = 0;
        this.fieldFxPhase = 0;
        this.fieldFxScratch.length = 0;
        this.zTrailTimer = 0;
        this.megaAreaTimer = 0;
        this.megaAreaCursor = 0;
        this.megaAreaPhase = 0;
        this.megaAreaScratch.length = 0;
        this.rosterAreaTimer = 0;
        this.rosterAreaCursor = 0;
        this.rosterAreaPhase = 0;
        this.rosterAreaScratch.length = 0;
        this.signatureSkillTimer = 0;
        this.signatureSkillCursor = 0;
        this.signatureSkillPhase = 0;
        this.signatureSkillScratch.length = 0;
        this.shinyTrailTimer = 0;
        this.shinyTrailCursor = 0;
        this.groveTimer = 0;
        this.groveCursor = 0;
        this.grovePhase = 0;
        this.meowthTimer = 0;
        this.meowthCursor = 0;
        this.meowthPhase = 0;
        this.gmaxAuraTimer = 0;
        this.gmaxAuraCursor = 0;
        this.gmaxAuraPhase = 0;
        this.gmaxSkillTimer = 0;
        this.gmaxSkillCursor = 0;
        this.gmaxSkillPhase = 0;
        for (const slot of this.slots) {
            slot.ps.stopSystem();
            slot.ps.resetSystem();
            slot.node.active = false;
            slot.busy = false;
        }
    }
}
