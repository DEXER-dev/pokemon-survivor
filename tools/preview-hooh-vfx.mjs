import { drawHoohMaterialStorm } from '../src/skills/active/legendary/hooh-material-effects.js';

// Export the production renderer's sprite transforms for a standalone art review GIF.
const palette = { get: (color, alpha) => ({ color, alpha }) };
const scenes = [];
for (let i = 0; i < 61; i++) {
    const time = i / 20;
    const sprites = [];
    const batch = { glyphs: { hoohFire_0: {}, hoohFlare_0: {} },
        draw (name, x, y, sx, sy, angle, tint) { sprites.push({ name, x, y, sx, sy, angle, tint }); } };
    if (time < 0.82) {
        drawHoohMaterialStorm(batch, palette, { x: 0, y: 0, age: time, duration: 0.82, charging: true });
    } else {
        drawHoohMaterialStorm(batch, palette, { x: 0, y: 0, age: time - 0.82, duration: 2.2 });
    }
    scenes.push(sprites);
}
process.stdout.write(JSON.stringify(scenes));
