import { megaEffectStyle } from '../../../mega.js';

/** Draw a quiet hit-radius guide; particle motes now carry the generic Mega area's visual energy. */
export function drawMegaActiveArea (game, batch, fx) {
    // Gigantamax fields and active-area attacks are rendered entirely by native particle streams.
    if (fx.form.gigantamax) return;
    const fade = Math.max(18, Math.round(48 * (1 - Math.min(1, fx.age / fx.duration))));
    const style = megaEffectStyle(fx.form);
    batch.draw('ring', fx.x, fx.y, fx.radius / 24, fx.radius / 24, fx.angle,
        game.pal.get(fx.form.color, fade), false, style);
}
