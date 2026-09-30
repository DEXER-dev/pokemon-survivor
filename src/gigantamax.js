/* Gigantamax forms present in the current roster that do not have a Mega form. */
import pikachuSkill, { FORM as pikachuForm } from './skills/active/gigantamax/pikachu.js';
import meowthSkill, { FORM as meowthForm } from './skills/active/gigantamax/meowth.js';
import corviknightSkill, { FORM as corviknightForm } from './skills/active/gigantamax/corviknight.js';
import rillaboomSkill, { FORM as rillaboomForm } from './skills/active/gigantamax/rillaboom.js';
import cinderaceSkill, { FORM as cinderaceForm } from './skills/active/gigantamax/cinderace.js';
import inteleonSkill, { FORM as inteleonForm } from './skills/active/gigantamax/inteleon.js';
import alcremieSkill, { FORM as alcremieForm, cast as castAlcremie,
    drawPreview as drawAlcremiePreview, drawEffect as drawAlcremieEffect } from './skills/active/roster/alcremie.js';

export const GIGANTAMAX_FORMS = [
    pikachuForm, meowthForm, corviknightForm, rillaboomForm, cinderaceForm, inteleonForm,
    { ...alcremieForm, id: 'alcremie', name: '超极巨霜奶仙', label: '超极巨化 · 霜奶仙',
        icon: 'ALCREMIE_gmax', color: '#f0a3cc', size: 1.9, category: '超极巨化', rosterActive: false },
].map((form) => ({ ...form, gigantamax: true }));

export const GIGANTAMAX_BY_ID = Object.fromEntries(GIGANTAMAX_FORMS.map((form) => [form.id, form]));

export const GIGANTAMAX_SKILLS = {
    pikachu: pikachuSkill,
    meowth: meowthSkill,
    corviknight: corviknightSkill,
    rillaboom: rillaboomSkill,
    cinderace: cinderaceSkill,
    inteleon: inteleonSkill,
    alcremie: Object.freeze({ ...alcremieSkill, name: '超极巨奶油蛋糕', heal: 200,
        dropRadius: 260, cakeSize: 48, lifetime: 60, cooldown: 28 }),
};

export const GIGANTAMAX_MODULES = {
    alcremie: Object.freeze({ cast: castAlcremie, drawPreview: drawAlcremiePreview,
        drawEffect: drawAlcremieEffect }),
};

export const gigantamaxSkillForForm = (form) => form && GIGANTAMAX_SKILLS[form.id] || null;

/** Gigantamax belongs to the exact species stage, not every member of its evolution family. */
export function gigantamaxFormForSegment (seg) {
    if (!seg || !seg.gigantamax) return null;
    const form = GIGANTAMAX_BY_ID[seg.gigantamax];
    return form && form.fam === seg.fam && form.tier === seg.tier ? form : null;
}

/** Guaranteed level-up unlock for each currently present, canon-eligible Gmax species. */
export function gigantamaxCardsFor (chain, build) {
    if (!chain || !Array.isArray(chain.segments)) return [];
    const cards = [];
    for (const seg of chain.segments) {
        if (gigantamaxFormForSegment(seg)) continue;
        for (const form of GIGANTAMAX_FORMS) {
            if (form.fam !== seg.fam || form.tier !== seg.tier) continue;
            const id = `gigantamax-${form.id}`;
            if ((build.stacks[id] || 0) > 0) continue;
            cards.push({
                id, max: 1, name: form.label, note: '解锁超极巨形态 · 体型大幅成长 · 专属区域技能',
                delta: () => `变为${form.name} · 按 Q 选择、X 释放`,
                gmaxForm: form.id, gmaxSegment: seg,
                apply: () => {
                    if (seg.fam !== form.fam || seg.tier !== form.tier) return;
                    seg.gigantamax = form.id;
                    seg.megaSkillCd = 0.7;
                    seg.gigaFlash = 1;
                    seg.gigaEntry = { elapsed: 0, impactDone: false };
                },
            });
        }
    }
    return cards;
}
