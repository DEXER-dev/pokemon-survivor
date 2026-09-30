import breloom, { FORM as breloomForm, cast as castBreloom,
    drawPreview as drawBreloomPreview, drawEffect as drawBreloomEffect } from './breloom.js';
import hatterene, { FORM as hattereneForm, cast as castHatterene,
    drawPreview as drawHatterenePreview, drawEffect as drawHattereneEffect } from './hatterene.js';
import archeops, { FORM as archeopsForm, cast as castArcheops,
    drawPreview as drawArcheopsPreview, drawEffect as drawArcheopsEffect } from './archeops.js';
import alcremie, { FORM as alcremieForm, cast as castAlcremie,
    drawPreview as drawAlcremiePreview, drawEffect as drawAlcremieEffect } from './alcremie.js';
import vivillon, { FORM as vivillonForm, cast as castVivillon,
    drawPreview as drawVivillonPreview, drawEffect as drawVivillonEffect } from './vivillon.js';
import cutiefly, { FORM as cutieflyForm, cast as castCutiefly,
    drawPreview as drawCutieflyPreview, drawEffect as drawCutieflyEffect } from './cutiefly.js';

const modules = Object.freeze({
    [breloomForm.id]: Object.freeze({ ...breloom, FORM: breloomForm, cast: castBreloom,
        drawPreview: drawBreloomPreview, drawEffect: drawBreloomEffect }),
    [hattereneForm.id]: Object.freeze({ ...hatterene, FORM: hattereneForm, cast: castHatterene,
        drawPreview: drawHatterenePreview, drawEffect: drawHattereneEffect }),
    [archeopsForm.id]: Object.freeze({ ...archeops, FORM: archeopsForm, cast: castArcheops,
        drawPreview: drawArcheopsPreview, drawEffect: drawArcheopsEffect }),
    [alcremieForm.id]: Object.freeze({ ...alcremie, FORM: alcremieForm, cast: castAlcremie,
        drawPreview: drawAlcremiePreview, drawEffect: drawAlcremieEffect }),
    [vivillonForm.id]: Object.freeze({ ...vivillon, FORM: vivillonForm, cast: castVivillon,
        drawPreview: drawVivillonPreview, drawEffect: drawVivillonEffect }),
    [cutieflyForm.id]: Object.freeze({ ...cutiefly, FORM: cutieflyForm, cast: castCutiefly,
        drawPreview: drawCutieflyPreview, drawEffect: drawCutieflyEffect }),
});
const formsByFamily = Object.freeze({
    [breloomForm.fam]: breloomForm,
    [hattereneForm.fam]: hattereneForm,
    [archeopsForm.fam]: archeopsForm,
    [alcremieForm.fam]: alcremieForm,
    [vivillonForm.fam]: vivillonForm,
    [cutieflyForm.fam]: cutieflyForm,
});

/** These ordinary species unlock their signature active skill at the final Pokédex stage. */
export const ROSTER_ACTIVE_FORMS = Object.freeze([breloomForm, hattereneForm, archeopsForm, alcremieForm, vivillonForm, cutieflyForm]);

export function rosterActiveFormForSegment (seg) {
    if (!seg || seg.mega || seg.gigantamax) return null;
    const form = formsByFamily[seg.fam];
    return form && seg.tier === form.tier ? form : null;
}

export const rosterActiveSkillForForm = (form) => form && modules[form.id] || null;
export const rosterActiveModuleForForm = (form) => form && modules[form.id] || null;
