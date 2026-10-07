/* Mega Evolution roster: a form is offered only at its own final evolution stage, with real art. */
import { BLASTOISE_SKILL, BLASTOISE_SIGNATURE, MEGA_FORM as blastoiseForm } from './skills/active/mega/blastoise.js';
import venusaurSkill, { MEGA_FORM as venusaurForm, SIGNATURE as venusaurSignature } from './skills/active/mega/venusaur.js';
import charizardXSkill, { MEGA_FORM as charizardXForm, SIGNATURE as charizardXSignature } from './skills/active/mega/charizard-x.js';
import charizardYSkill, { MEGA_FORM as charizardYForm, SIGNATURE as charizardYSignature } from './skills/active/mega/charizard-y.js';
import swampertSkill, { MEGA_FORM as swampertForm, SIGNATURE as swampertSignature } from './skills/active/mega/swampert.js';
import gengarSkill, { MEGA_FORM as gengarForm, SIGNATURE as gengarSignature } from './skills/active/mega/gengar.js';
import gardevoirSkill, { MEGA_FORM as gardevoirForm, SIGNATURE as gardevoirSignature } from './skills/active/mega/gardevoir.js';
import beedrillSkill, { MEGA_FORM as beedrillForm, SIGNATURE as beedrillSignature } from './skills/active/mega/beedrill.js';
import ampharosSkill, { MEGA_FORM as ampharosForm, SIGNATURE as ampharosSignature } from './skills/active/mega/ampharos.js';
import pidgeotSkill, { MEGA_FORM as pidgeotForm, SIGNATURE as pidgeotSignature } from './skills/active/mega/pidgeot.js';
import blazikenSkill, { MEGA_FORM as blazikenForm, SIGNATURE as blazikenSignature } from './skills/active/mega/blaziken.js';
import alakazamSkill, { MEGA_FORM as alakazamForm, SIGNATURE as alakazamSignature } from './skills/active/mega/alakazam.js';
import aggronSkill, { MEGA_FORM as aggronForm, SIGNATURE as aggronSignature } from './skills/active/mega/aggron.js';
import sceptileSkill, { MEGA_FORM as sceptileForm, SIGNATURE as sceptileSignature } from './skills/active/mega/sceptile.js';
import salamenceSkill, { MEGA_FORM as salamenceForm, SIGNATURE as salamenceSignature } from './skills/active/mega/salamence.js';
import garchompSkill, { MEGA_FORM as garchompForm, SIGNATURE as garchompSignature } from './skills/active/mega/garchomp.js';
import metagrossSkill, { MEGA_FORM as metagrossForm, SIGNATURE as metagrossSignature } from './skills/active/mega/metagross.js';
import tyranitarSkill, { MEGA_FORM as tyranitarForm, SIGNATURE as tyranitarSignature } from './skills/active/mega/tyranitar.js';
import lucarioSkill, { MEGA_FORM as lucarioForm, SIGNATURE as lucarioSignature } from './skills/active/mega/lucario.js';

const MEGA_OUTLINE_PALETTES = Object.freeze({
    venusaur: Object.freeze({ color: '#5cc453', highlight: '#ccff8f', deep: '#2a7038' }),
    'charizard-x': Object.freeze({ color: '#3acff2', highlight: '#c7ffff', deep: '#1e68b0' }),
    'charizard-y': Object.freeze({ color: '#ff852d', highlight: '#ffed7b', deep: '#b34524' }),
    blastoise: Object.freeze({ color: '#4298ff', highlight: '#bee9ff', deep: '#254ba4' }),
    swampert: Object.freeze({ color: '#23bece', highlight: '#b3ffec', deep: '#166584' }),
    gengar: Object.freeze({ color: '#b55df2', highlight: '#f5c1ff', deep: '#5b2fa3' }),
    gardevoir: Object.freeze({ color: '#f56fad', highlight: '#ffdbef', deep: '#9c3875' }),
    beedrill: Object.freeze({ color: '#e8b72f', highlight: '#fff69d', deep: '#8f651e' }),
    ampharos: Object.freeze({ color: '#ffd52d', highlight: '#fffab2', deep: '#b77918' }),
    pidgeot: Object.freeze({ color: '#d28f37', highlight: '#ffdf8e', deep: '#824c2b' }),
    blaziken: Object.freeze({ color: '#f65b3a', highlight: '#ffcb7a', deep: '#a52b31' }),
    alakazam: Object.freeze({ color: '#a67bff', highlight: '#e6d0ff', deep: '#573fac' }),
    lucario: Object.freeze({ color: '#2d7cff', highlight: '#b7deff', deep: '#213b97' }),
    aggron: Object.freeze({ color: '#85aec3', highlight: '#e5f8ff', deep: '#425b70' }),
    sceptile: Object.freeze({ color: '#49d477', highlight: '#c0ff9a', deep: '#22754e' }),
    salamence: Object.freeze({ color: '#f44b55', highlight: '#ffb8a4', deep: '#8f2848' }),
    garchomp: Object.freeze({ color: '#c252b0', highlight: '#ffbce9', deep: '#632a79' }),
    metagross: Object.freeze({ color: '#6ca4ff', highlight: '#d7f3ff', deep: '#305397' }),
    tyranitar: Object.freeze({ color: '#adc643', highlight: '#eeff8e', deep: '#5b702c' }),
});

export const MEGA_FORMS = [
    venusaurForm, charizardXForm, charizardYForm, blastoiseForm, swampertForm, gengarForm,
    gardevoirForm, beedrillForm, ampharosForm, pidgeotForm, blazikenForm, alakazamForm, lucarioForm,
    aggronForm, sceptileForm, salamenceForm, garchompForm, metagrossForm, tyranitarForm,
].map((form) => ({ ...form, outline: MEGA_OUTLINE_PALETTES[form.id] || null }));

/** Active, aimed area attacks unlocked by Mega Evolution. Dimensions are world-pixels. */
export const MEGA_ACTIVE_SKILLS = {
    venusaur: venusaurSkill,
    'charizard-x': charizardXSkill,
    'charizard-y': charizardYSkill,
    blastoise:      BLASTOISE_SKILL,
    swampert: swampertSkill,
    gengar: gengarSkill,
    gardevoir: gardevoirSkill,
    beedrill: beedrillSkill,
    ampharos: ampharosSkill,
    pidgeot: pidgeotSkill,
    blaziken: blazikenSkill,
    alakazam: alakazamSkill,
    aggron: aggronSkill,
    sceptile: sceptileSkill,
    salamence: salamenceSkill,
    garchomp: garchompSkill,
    metagross: metagrossSkill,
    tyranitar: tyranitarSkill,
    lucario: lucarioSkill,
};

export const megaSkillForForm = (form) => form && MEGA_ACTIVE_SKILLS[form.id] || null;

// Each form gets its own shape rhythm in addition to its species-shaped projectile glyph and
// dedicated Effect Shader. Fields control beam silhouette, echo count and the orbiting motif.
export const MEGA_SIGNATURES = {
    venusaur: venusaurSignature,
    'charizard-x': charizardXSignature,
    'charizard-y': charizardYSignature,
    blastoise: BLASTOISE_SIGNATURE,
    swampert: swampertSignature,
    gengar: gengarSignature,
    gardevoir: gardevoirSignature,
    beedrill: beedrillSignature,
    ampharos: ampharosSignature,
    pidgeot: pidgeotSignature,
    blaziken: blazikenSignature,
    alakazam: alakazamSignature,
    aggron: aggronSignature,
    sceptile: sceptileSignature,
    salamence: salamenceSignature,
    garchomp: garchompSignature,
    metagross: metagrossSignature,
    tyranitar: tyranitarSignature,
    lucario: lucarioSignature,
};

export const megaEffectStyle = (form) => form && form.rosterActive ? form.effectStyle || 'nature'
    : form && !form.gigantamax ? `mega-${form.id}` : 'mega';
export const megaSignature = (form) => MEGA_SIGNATURES[form && form.id] || MEGA_SIGNATURES.venusaur;

export const MEGA_BY_ID = Object.fromEntries(MEGA_FORMS.map((form) => [form.id, form]));

const finalMegaTier = (form) => form.finalTier || 3;

/** A stored Mega mark is active only while it belongs to that form's actual final evolution stage. */
export function megaFormForSegment (seg) {
    if (!seg || !seg.mega) return null;
    const form = MEGA_BY_ID[seg.mega];
    return form && form.fam === seg.fam && seg.tier === finalMegaTier(form) ? form : null;
}

/** One guaranteed level-up option per eligible, un-Mega evolved segment (one card per stone). */
export function megaCardsFor (chain, build) {
    if (!chain || !Array.isArray(chain.segments)) return [];
    const cards = [];
    for (const seg of chain.segments) {
        if (megaFormForSegment(seg)) continue;
        for (const form of MEGA_FORMS) {
            if (form.fam !== seg.fam || seg.tier !== finalMegaTier(form)) continue;
            const id = `mega-${form.id}`;
            if ((build.stacks[id] || 0) > 0) continue;
            cards.push({
                id, max: 1, name: form.label, note: '立即进化 · 解锁专属强力弹幕',
                delta: () => `变为${form.megaName}`,
                megaForm: form.id, megaSegment: seg, stone: form.stone,
                apply: () => {
                    if (seg.tier !== finalMegaTier(form) || seg.fam !== form.fam) return;
                    seg.mega = form.id;
                    seg.megaCd = 0.45;
                    seg.megaFlash = 1;
                },
            });
        }
    }
    return cards;
}
