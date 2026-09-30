import { megaEffectStyle } from '../../../mega.js';

/** Render active areas; Mega launch and hit flashes are handled by their native particle emitters. */
export function drawMegaEffects (game, batch, { activeSkillForForm, activeSkillModuleForForm, drawMegaActiveArea }) {
    for (const fx of game.megaFx) {
        if (!fx.active || !fx.form) continue;
        // Every Gigantamax body, skill, and field effect is represented by Cocos particles.
        if (fx.form.gigantamax) continue;
        if (!fx.area) continue;
        const skill = activeSkillForForm(fx.form);
        const module = activeSkillModuleForForm(fx.form);
        if (module?.drawEffect && fx.shape) {
            module.drawEffect(game, batch, fx, skill, megaEffectStyle);
            continue;
        }
        drawMegaActiveArea(game, batch, fx, skill);
    }
}
