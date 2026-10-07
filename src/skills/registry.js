import { megaSkillForForm } from '../mega.js';
import { gigantamaxSkillForForm } from '../gigantamax.js';
import { GIGANTAMAX_MODULES } from '../gigantamax.js';
import {
    castBlastoise, stepBlastoise, drawBlastoisePreview, drawBlastoiseEffect,
} from './active/mega/blastoise.js';
import charizardXSkill, {
    cast as castCharizardX, step as stepCharizardX, drawPreview as drawCharizardXPreview,
    drawScreenEffect as drawCharizardXScreenEffect,
} from './active/mega/charizard-x.js';
import { drawMegaProjectile } from './active/mega/projectile-renderer.js';
import { drawMegaActiveArea } from './active/mega/area-renderer.js';
import { drawMegaEffects } from './active/mega/effect-renderer.js';
import { meowscaradaFlower } from './projectiles/meowscarada.js';
import { greninjaWaterShuriken } from './projectiles/greninja.js';
import cinderaceGigantamax, {
    cast as castCinderaceGigantamax, step as stepCinderaceGigantamax,
    drawPreview as drawCinderaceGigantamaxPreview, drawEffect as drawCinderaceGigantamaxEffect,
} from './active/gigantamax/cinderace.js';
import {
    cast as castRillaboomGigantamax, drawPreview as drawRillaboomGigantamaxPreview,
    drawEffect as drawRillaboomGigantamaxEffect, drawField as drawRillaboomGrove,
} from './active/gigantamax/rillaboom.js';
import blazikenMega, {
    cast as castBlazikenMega, step as stepBlazikenMega,
    playerDrive as driveBlazikenMega, drawPreview as drawBlazikenMegaPreview,
    drawEffect as drawBlazikenMegaEffect,
} from './active/mega/blaziken.js';
import { drawBulbasaurSeedProjectile } from './projectiles/bulbasaur.js';
import {
    castGardevoir, drawGardevoirEffect, drawGardevoirPreview,
} from './active/mega/gardevoir.js';
import { drawTandemausProjectile, tandemausProjectile } from './projectiles/tandemaus.js';
import { drawLucarioAuraSphere } from './projectiles/lucario.js';
import { drawHonedgeSpiritBlade } from './projectiles/honedge.js';
import { drawMachopCrossPunch } from './projectiles/machop.js';
import { drawTogepiWishStar } from './projectiles/togepi.js';
import { drawBuizelAquaJet } from './projectiles/buizel.js';
import { drawMunchlaxSnoreWave } from './projectiles/munchlax.js';
import { drawShinxThunderClaw } from './projectiles/shinx.js';
import { drawZoruaIllusion } from './projectiles/zorua.js';
import { drawToxtricityOverdrive } from './projectiles/toxtricity.js';
import { drawShroomishSporePod } from './projectiles/shroomish.js';
import { drawHatennaMoonwave } from './projectiles/hatenna.js';
import { drawImpidimpShadowClaw } from './projectiles/impidimp.js';
import { drawArchenFossilFeather } from './projectiles/archen.js';
import { drawSmolivOlive } from './projectiles/smoliv.js';
import { drawTadbulbElectricBubble } from './projectiles/tadbulb.js';
import { drawWattrelLightningFeather } from './projectiles/wattrel.js';
import { drawPorygonDataPrism } from './projectiles/porygon.js';
import { drawVivillonPowder } from './projectiles/vivillon.js';
import { drawCutieflyPollenPuff } from './projectiles/cutiefly.js';
import { drawDreepyDragonDart } from './projectiles/dreepy.js';
import { BLASTOISE_PARTICLE_PRESETS } from './particles/blastoise.js';
import { BLAZIKEN_PARTICLE_PRESETS } from './particles/blaziken.js';
import { MEOWSCARADA_PARTICLE_PRESETS } from './particles/meowscarada.js';
import { GRENINJA_PARTICLE_PRESETS } from './particles/greninja.js';
import { HO_OH_PARTICLE_PRESETS } from './particles/ho-oh.js';
import { DYNAMAX_BAND_PARTICLE_PRESETS } from './particles/dynamax-band.js';
import { GIGANTAMAX_PARTICLE_PRESETS } from './particles/gigantamax.js';
import { Z_MOVE_PARTICLE_PRESETS } from './particles/z-moves.js';
import {
    BEAM_PARTICLE_PRESETS, FIELD_PARTICLE_PRESETS, ORBIT_PARTICLE_PRESETS,
    PROJECTILE_PARTICLE_PRESETS, TRAINER_PROJECTILE_PARTICLE_PRESETS,
} from './particles/projectiles.js';
import { VIVILLON_PARTICLE_PRESETS } from './particles/vivillon.js';
import { CUTIEFLY_PARTICLE_PRESETS } from './particles/cutiefly.js';
import { LEGENDARY_PARTICLE_PRESETS } from './particles/legendary.js';
import { SUB_LEGENDARY_PARTICLE_PRESETS } from './particles/sublegendary.js';

// Turn each moving projectile's native trail profile into a matching hit burst. Keeping the glyph
// and tint makes the impact read as the same attack, while the radial motion makes it visibly
// particulate instead of leaving a flat shape at the collision point.
const projectileTrailPresets = Object.freeze({
    ...PROJECTILE_PARTICLE_PRESETS,
    ...TRAINER_PROJECTILE_PARTICLE_PRESETS,
    ...VIVILLON_PARTICLE_PRESETS,
    ...CUTIEFLY_PARTICLE_PRESETS,
    ...LEGENDARY_PARTICLE_PRESETS,
    ...SUB_LEGENDARY_PARTICLE_PRESETS,
});
const projectileImpactPresets = Object.freeze(Object.fromEntries(
    Object.entries(projectileTrailPresets)
        .filter(([kind]) => kind.startsWith('projectile-trail-'))
        .map(([kind, trail]) => [
            kind.replace('projectile-trail-', 'projectile-impact-'),
            Object.freeze({
                ...trail,
                particleClass: 'projectile-impact',
                duration: 0.055,
                emissionRate: 260,
                totalParticles: 12,
                life: 0.29,
                lifeVar: 0.07,
                angleVar: 180,
                speed: 66,
                speedVar: 34,
                startSize: 18,
                startSizeVar: 5,
                endSize: 1,
                tangentialAccel: 0,
                radialAccel: 24,
                gravityY: 0,
                posVar: 2,
            }),
        ]),
));
import {
    beamEffectForFamily, fieldEffectForFamily, orbitCoreGlyphForFamily, slashEffectForFamily,
} from './fields/family-effects.js';
import * as hoOh from './active/legendary/ho-oh.js';
import {
    legendaryActiveSkillForForm, legendaryActiveModuleForForm,
} from './active/legendary/other-legendaries.js';
import { rosterActiveFormForSegment, rosterActiveSkillForForm,
    rosterActiveModuleForForm } from './active/roster/index.js';
import { drawCakes } from './active/roster/alcremie.js';

const blastoise = Object.freeze({
    cast: castBlastoise,
    step: stepBlastoise,
    drawPreview: drawBlastoisePreview,
    drawEffect: drawBlastoiseEffect,
});
const charizardX = Object.freeze({
    skill: charizardXSkill,
    cast: castCharizardX,
    step: stepCharizardX,
    // Keep the normal circular Mega renderer/particle fallback off; the Graphics layer owns this X.
    drawEffect () {},
    drawPreview: drawCharizardXPreview,
    drawScreenEffect: drawCharizardXScreenEffect,
});
const gardevoir = Object.freeze({ cast: castGardevoir, drawPreview: drawGardevoirPreview,
    drawEffect: drawGardevoirEffect });
const cinderace = Object.freeze({
    cast: castCinderaceGigantamax,
    step: stepCinderaceGigantamax,
    drawPreview: drawCinderaceGigantamaxPreview,
    drawEffect: drawCinderaceGigantamaxEffect,
});
const rillaboom = Object.freeze({
    cast: castRillaboomGigantamax,
    drawPreview: drawRillaboomGigantamaxPreview,
    drawEffect: drawRillaboomGigantamaxEffect,
    drawField: drawRillaboomGrove,
});
const blaziken = Object.freeze({
    cast: castBlazikenMega,
    step: stepBlazikenMega,
    playerDrive: driveBlazikenMega,
    drawPreview: drawBlazikenMegaPreview,
    drawEffect: drawBlazikenMegaEffect,
});

const projectileModules = Object.freeze({
    sprigatito: meowscaradaFlower,
    froakie: greninjaWaterShuriken,
});
const projectileFamilyModules = Object.freeze({ tandemaus: tandemausProjectile });
const projectileRenderers = Object.freeze({
    mush: drawBulbasaurSeedProjectile,
    tandemaus: drawTandemausProjectile,
    lucario: drawLucarioAuraSphere,
    honedge: drawHonedgeSpiritBlade,
    machop: drawMachopCrossPunch,
    togepi: drawTogepiWishStar,
    buizel: drawBuizelAquaJet,
    munchlax: drawMunchlaxSnoreWave,
    shinx: drawShinxThunderClaw,
    zorua: drawZoruaIllusion,
    toxtricity: drawToxtricityOverdrive,
    shroomish: drawShroomishSporePod,
    hatenna: drawHatennaMoonwave,
    impidimp: drawImpidimpShadowClaw,
    archen: drawArchenFossilFeather,
    smoliv: drawSmolivOlive,
    tadbulb: drawTadbulbElectricBubble,
    wattrel: drawWattrelLightningFeather,
    porygon: drawPorygonDataPrism,
    vivillon: drawVivillonPowder,
    cutiefly: drawCutieflyPollenPuff,
    dreepy: drawDreepyDragonDart,
});
const skillParticlePresets = Object.freeze({
    ...BLASTOISE_PARTICLE_PRESETS,
    ...BLAZIKEN_PARTICLE_PRESETS,
    ...MEOWSCARADA_PARTICLE_PRESETS,
    ...GRENINJA_PARTICLE_PRESETS,
    ...HO_OH_PARTICLE_PRESETS,
    ...DYNAMAX_BAND_PARTICLE_PRESETS,
    ...GIGANTAMAX_PARTICLE_PRESETS,
    ...Z_MOVE_PARTICLE_PRESETS,
    ...PROJECTILE_PARTICLE_PRESETS,
    ...TRAINER_PROJECTILE_PARTICLE_PRESETS,
    ...BEAM_PARTICLE_PRESETS,
    ...FIELD_PARTICLE_PRESETS,
    ...ORBIT_PARTICLE_PRESETS,
    ...VIVILLON_PARTICLE_PRESETS,
    ...CUTIEFLY_PARTICLE_PRESETS,
    ...LEGENDARY_PARTICLE_PRESETS,
    ...SUB_LEGENDARY_PARTICLE_PRESETS,
    ...projectileImpactPresets,
});

/** One lookup for skill data and optional per-form behavior modules. */
export function activeSkillForForm (form) {
    return megaSkillForForm(form) || gigantamaxSkillForForm(form)
        || (form && form.id === hoOh.FORM.id ? hoOh.SKILL : null)
        || legendaryActiveSkillForForm(form)
        || rosterActiveSkillForForm(form);
}

export function activeSkillModuleForForm (form) {
    if (!form) return null;
    if (form.id === 'charizard-x') return charizardX;
    if (form.id === 'blastoise') return blastoise;
    if (form.id === 'gardevoir') return gardevoir;
    if (form.id === 'cinderace') return cinderace;
    if (form.id === 'rillaboom') return rillaboom;
    if (GIGANTAMAX_MODULES[form.id]) return GIGANTAMAX_MODULES[form.id];
    if (form.id === 'blaziken') return blaziken;
    if (form.id === hoOh.FORM.id) return hoOh;
    const legendaryModule = legendaryActiveModuleForForm(form);
    if (legendaryModule) return legendaryModule;
    return rosterActiveModuleForForm(form);
}

/** Full-screen attacks render in the top Graphics pass so their silhouette stays visible above sprites. */
export function drawMegaScreenEffects (game, graphics) {
    for (const fx of game.megaFx || []) {
        if (!fx.active || !fx.form) continue;
        const module = activeSkillModuleForForm(fx.form);
        if (!module?.drawScreenEffect) continue;
        const skill = module.skill || activeSkillForForm(fx.form);
        module.drawScreenEffect(game, graphics, fx, skill);
    }
}

/** Render long-lived ground fields before enemies and the party, so sprites remain readable above them. */
export function drawPersistentSkillFields (game, batch) {
    for (const field of game.rillaboomFields || []) {
        const module = activeSkillModuleForForm(field.form);
        if (module?.drawField) module.drawField(game, batch, field);
    }
}

/** Draw collectible cakes above the wild crowd so healing drops remain easy to spot. */
export function drawCakePickups (game, batch) {
    drawCakes(game, batch, game.alcremieCakes || []);
}

/** Find a signature projectile module for a party segment or an already spawned shot. */
export function projectileModuleForSegment (seg) {
    const module = seg ? projectileModules[seg.fam] : null;
    return module?.matchesSegment(seg) ? module : null;
}

export function projectileModuleForShot (mode, family) {
    return mode === 1 ? projectileModules[family] || null : null;
}

export function projectileRendererForFamily (family, stage = Infinity) {
    // Only Dragapult launches Dreepy as Dragon Darts; its earlier stages retain their own shots.
    if (family === 'dreepy' && stage < 3) return null;
    return projectileRenderers[family] || null;
}

export function projectileFamilyModuleForSegment (seg) {
    return seg ? projectileFamilyModules[seg.fam] || null : null;
}

export function skillParticlePresetForEvent (kind) {
    return skillParticlePresets[kind] || null;
}

/** Resolve the species' signature impact particles, falling back to its elemental impact profile. */
export function projectileImpactPresetForFamily (famId, element = 'support') {
    return projectileImpactPresets[`projectile-impact-${famId}`]
        || projectileImpactPresets[`projectile-impact-${element}`]
        || null;
}

/** Resolve a legendary-only emitter such as its lair entrance or companion bombardment. */
export function legendaryParticlePresetForEvent (kind, famId) {
    return skillParticlePresets[`${kind}-${famId}`] || null;
}

export { fieldEffectForFamily, orbitCoreGlyphForFamily, beamEffectForFamily, slashEffectForFamily };
export { rosterActiveFormForSegment };
export { drawMegaProjectile };
export { drawMegaActiveArea };
export { drawMegaEffects };
