import { MEGA_FORMS } from './src/mega.js';

/*
 * Creator ships its 2D materials as compiled assets inside the `internal` bundle, which a
 * source-only build does not produce. These are hand-written equivalents of the two effects a
 * code-driven game needs, registered straight into programLib / builtinResMgr.
 */

/*
 * GLSL ES 3.00 rejects `binding` on uniform blocks and samplers; Cocos assigns those slots
 * itself from the shader info below, so the sources declare the blocks unqualified.
 */
const CC_CAMERA_BLOCK = `
layout(std140) uniform CCCamera {
    highp mat4 cc_matView;
    highp mat4 cc_matViewInv;
    highp mat4 cc_matProj;
    highp mat4 cc_matProjInv;
    highp mat4 cc_matViewProj;
    highp mat4 cc_matViewProjInv;
    highp vec4 cc_cameraPos;
    mediump vec4 cc_surfaceTransform;
    mediump vec4 cc_screenScale;
    mediump vec4 cc_exposure;
    mediump vec4 cc_mainLitDir;
    mediump vec4 cc_mainLitColor;
    mediump vec4 cc_ambientSky;
    mediump vec4 cc_ambientGround;
    mediump vec4 cc_fogColor;
    mediump vec4 cc_fogBase;
    mediump vec4 cc_fogAdd;
    mediump vec4 cc_nearFar;
    mediump vec4 cc_viewPort;
};
`;

// Cocos 3.8's built-in global clock. Keeping the standard block layout lets the bullet Effect
// animate from the engine clock without a per-sprite uniform or CPU-side material updates.
const CC_GLOBAL_BLOCK = `
layout(std140) uniform CCGlobal {
    mediump vec4 cc_time;
    mediump vec4 cc_screenSize;
    mediump vec4 cc_nativeSize;
    mediump vec4 cc_probeInfo;
    mediump vec4 cc_debug_view_mode;
};
`;

const CC_LOCAL_BLOCK = `
layout(std140) uniform CCLocal {
    highp mat4 cc_matWorld;
    highp mat4 cc_matWorldIT;
    highp vec4 cc_lightingMapUVParam;
    highp vec4 cc_localShadowBias;
    highp vec4 cc_reflectionProbeData1;
    highp vec4 cc_reflectionProbeData2;
    highp vec4 cc_reflectionProbeBlendData1;
    highp vec4 cc_reflectionProbeBlendData2;
};
`;

const GRAPHICS_VERT = `${CC_CAMERA_BLOCK}${CC_LOCAL_BLOCK}
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec4 a_color;
layout(location = 2) in float a_dist;
out vec4 v_color;
out float v_dist;
void main () {
    gl_Position = cc_matViewProj * cc_matWorld * vec4(a_position, 1.0);
    v_color = a_color;
    v_dist = a_dist;
}
`;

const GRAPHICS_FRAG = `
precision highp float;
in vec4 v_color;
in float v_dist;
layout(location = 0) out vec4 cc_FragColor;
void main () {
    float aa = fwidth(v_dist);
    float alpha = 1.0 - smoothstep(-aa, 0.0, abs(v_dist) - 1.0);
    vec4 o = v_color;
    o.rgb *= o.a;
    cc_FragColor = o * alpha;
}
`;

const SPRITE_VERT = `${CC_CAMERA_BLOCK}
#if USE_LOCAL
${CC_LOCAL_BLOCK}
#endif
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec2 a_texCoord;
layout(location = 2) in vec4 a_color;
out vec4 color;
out vec2 uv0;
void main () {
    vec4 pos = vec4(a_position, 1.0);
    #if USE_LOCAL
        pos = cc_matWorld * pos;
    #endif
    gl_Position = cc_matViewProj * pos;
    uv0 = a_texCoord;
    color = a_color;
}
`;

const SPRITE_FRAG = `
precision highp float;
in vec4 color;
in vec2 uv0;
layout(location = 0) out vec4 cc_FragColor;
uniform highp sampler2D cc_spriteTexture;
void main () {
    vec4 o = texture(cc_spriteTexture, uv0);
    #if IS_GRAY
        float gray = 0.2126 * o.r + 0.7152 * o.g + 0.0722 * o.b;
        o = vec4(gray, gray, gray, o.a);
    #endif
    cc_FragColor = o * color;
}
`;

// Per-style pattern code, spliced into the shared bullet fragment's main() at one scope - so a
// style that declares one of the frame's own names (p/edge/core/ink/texel) is an illegal GLSL
// redeclaration and the whole program fails to compile, rendering its sprite as a blank quad.
const BULLET_STYLE_BODIES = {
    nature: `
            float vein = smoothstep(0.88, 0.98, abs(sin((p.x + p.y * 0.52) * 15.0)));
            float pollen = pow(max(0.0, sin((p.x * 9.0 + p.y * 13.0) + cc_time.x * 2.2)), 18.0);
            ink = mix(ink, vec3(0.76, 1.0, 0.58), vein * 0.52);
            ink += vec3(0.7, 0.9, 0.32) * pollen * 0.48;
        `,
        wind: `
            float bands = smoothstep(0.77, 0.98, abs(sin((p.y * 2.7 + p.x * 0.62) * 12.0 - cc_time.x * 3.0)));
            float glint = pow(max(0.0, sin(p.x * 18.0 - cc_time.x * 4.0)), 12.0);
            ink = mix(ink, vec3(0.82, 0.96, 1.0), bands * 0.48);
            ink += vec3(0.42, 0.76, 1.0) * glint * 0.4;
        `,
        fire: `
            float tongues = smoothstep(0.58, 0.98, sin((p.x * 3.4 + p.y * 0.9) * 12.0 - cc_time.x * 5.0));
            float hotCore = 1.0 - smoothstep(0.04, 0.62, length(p - vec2(-0.12, 0.0)));
            ink = mix(ink, vec3(1.0, 0.91, 0.48), tongues * 0.62);
            ink = mix(ink, vec3(1.0, 0.98, 0.78), hotCore * 0.68);
        `,
        water: `
            float ripple = smoothstep(0.78, 0.99, abs(sin(length(p) * 24.0 - cc_time.x * 4.0)));
            float shine = pow(max(0.0, dot(normalize(p + vec2(0.001)), normalize(vec2(-0.65, 0.85)))), 12.0);
            ink = mix(ink, vec3(0.72, 0.96, 1.0), ripple * 0.48);
            ink += vec3(0.62, 0.9, 1.0) * shine * 0.48;
        `,
        electric: `
            float zig = smoothstep(0.87, 0.99, abs(sin((p.x * 2.4 + sin(p.y * 7.0 + cc_time.x * 4.0) * 0.22) * 19.0)));
            float pulse = 0.5 + 0.5 * sin(cc_time.x * 8.0 + p.x * 5.0);
            ink = mix(ink, vec3(1.0, 1.0, 0.68), zig * (0.52 + pulse * 0.25));
        `,
        crystal: `
            float facet = smoothstep(0.86, 0.99, abs(sin((p.x + p.y) * 11.0)));
            float facet2 = smoothstep(0.91, 0.995, abs(sin((p.x - p.y) * 8.0)));
            float glint = pow(max(0.0, 1.0 - length(p - vec2(-0.3, 0.32)) * 2.7), 8.0);
            ink = mix(ink, vec3(0.88, 0.97, 1.0), max(facet, facet2) * 0.48);
            ink += vec3(0.78, 0.94, 1.0) * glint * (0.55 + 0.45 * sin(cc_time.x * 5.0));
        `,
        psychic: `
            float spiral = smoothstep(0.84, 0.99, abs(sin(atan(p.y, p.x) * 4.0 + length(p) * 17.0 - cc_time.x * 3.2)));
            float coreGlow = 1.0 - smoothstep(0.0, 0.72, length(p));
            ink = mix(ink, vec3(1.0, 0.82, 1.0), spiral * 0.55);
            ink += vec3(0.5, 0.24, 1.0) * coreGlow * 0.22;
        `,
        shadow: `
            float wisps = smoothstep(0.82, 0.99, abs(sin((p.y + sin(p.x * 4.0 + cc_time.x * 2.0) * 0.24) * 15.0)));
            float eye = pow(max(0.0, 1.0 - length(p - vec2(0.22, 0.08)) * 7.0), 10.0);
            ink = mix(ink, vec3(0.42, 0.34, 0.72), wisps * 0.62);
            ink += vec3(0.86, 0.7, 1.0) * eye * 0.75;
        `,
        normal: `
            float rings = smoothstep(0.88, 0.99, abs(sin(length(p) * 23.0 - cc_time.x * 5.0)));
            float pulse = 0.5 + 0.5 * sin(cc_time.x * 7.0);
            ink = mix(ink, vec3(1.0, 0.96, 0.77), rings * 0.56);
            ink += vec3(1.0, 0.78, 0.38) * core * pulse * 0.32;
        `,
        bug: `
            float shell = smoothstep(0.84, 0.98, abs(sin((p.x * 2.0 + p.y) * 18.0)));
            float eye = pow(max(0.0, 1.0 - length(p - vec2(0.18, 0.12)) * 8.0), 12.0);
            ink = mix(ink, vec3(0.91, 1.0, 0.45), shell * 0.62);
            ink += vec3(1.0, 0.48, 0.18) * eye * 0.52;
        `,
        dark: `
            float eclipse = 1.0 - smoothstep(0.02, 0.22, abs(length(p) - (0.48 + 0.08 * sin(cc_time.x * 3.0))));
            float voidLine = smoothstep(0.92, 0.995, abs(sin(atan(p.y, p.x) * 7.0 + cc_time.x * 2.2)));
            ink = mix(ink, vec3(0.12, 0.07, 0.2), eclipse * 0.72);
            ink += vec3(0.8, 0.34, 0.96) * voidLine * 0.45;
        `,
        dragon: `
            float scale = smoothstep(0.87, 0.99, abs(sin((p.x + p.y * 0.42) * 25.0 + cc_time.x * 2.0)));
            float breath = pow(max(0.0, 1.0 - length(p - vec2(-0.2, 0.0)) * 2.2), 4.0);
            ink = mix(ink, vec3(0.72, 0.9, 1.0), scale * 0.5);
            ink += vec3(0.4, 0.3, 1.0) * breath * 0.5;
        `,
        fairy: `
            float twinkle = pow(max(0.0, sin(p.x * 16.0 + cc_time.x * 4.0) * sin(p.y * 17.0 - cc_time.x * 3.0)), 10.0);
            float halo = smoothstep(0.96, 0.995, abs(sin(length(p) * 18.0 - cc_time.x * 3.5)));
            ink = mix(ink, vec3(1.0, 0.92, 1.0), halo * 0.42);
            ink += vec3(1.0, 0.48, 0.84) * twinkle * 0.9;
        `,
        ground: `
            float strata = smoothstep(0.86, 0.99, abs(sin((p.y + p.x * 0.3) * 24.0 + cc_time.x * 2.0)));
            float quake = smoothstep(0.78, 0.99, abs(sin((p.x - p.y) * 12.0 - cc_time.x * 4.0)));
            ink = mix(ink, vec3(1.0, 0.76, 0.38), strata * 0.5);
            ink += vec3(0.78, 0.46, 0.22) * quake * 0.34;
        `,
        ice: `
            float facet = smoothstep(0.84, 0.99, abs(sin((p.x + p.y) * 17.0)));
            float glint = pow(max(0.0, 1.0 - length(p - vec2(-0.28, 0.3)) * 3.0), 9.0);
            ink = mix(ink, vec3(0.82, 1.0, 1.0), facet * 0.72);
            ink += vec3(0.35, 0.78, 1.0) * glint * (0.4 + 0.6 * sin(cc_time.x * 6.0));
        `,
        poison: `
            float bubbles = smoothstep(0.91, 0.995, abs(sin(length(p * vec2(1.0, 1.3)) * 29.0 - cc_time.x * 4.0)));
            float acid = 1.0 - smoothstep(0.0, 0.25, length(p - vec2(0.14, -0.18)));
            ink = mix(ink, vec3(0.9, 1.0, 0.35), bubbles * 0.55);
            ink += vec3(0.7, 0.18, 1.0) * acid * 0.52;
        `,
        rock: `
            float cracks = smoothstep(0.92, 0.995, abs(sin(p.x * 18.0 + sin(p.y * 11.0) * 1.4)));
            float grit = smoothstep(0.9, 0.99, abs(sin((p.x * 2.0 - p.y) * 26.0)));
            ink = mix(ink, vec3(1.0, 0.78, 0.48), cracks * 0.6);
            ink += vec3(0.9, 0.38, 0.14) * grit * 0.3;
        `,
        steel: `
            float polish = smoothstep(0.72, 0.98, abs(sin((p.x - p.y * 0.18) * 29.0 - cc_time.x * 5.0)));
            float glint = pow(max(0.0, 1.0 - length(p - vec2(-0.25, 0.28)) * 2.8), 9.0);
            ink = mix(ink, vec3(0.92, 1.0, 1.0), polish * 0.56);
            ink += vec3(0.5, 0.84, 1.0) * glint * 0.54;
        `,
        mega: `
            float spiralA = smoothstep(0.74, 0.99, abs(sin(a * 7.0 + r * 34.0 - cc_time.x * 8.0)));
            float spiralB = smoothstep(0.82, 0.995, abs(sin(a * 5.0 - r * 27.0 + cc_time.x * 6.0)));
            float orbit = max(spiralA, spiralB * 0.82);
            float rays = pow(max(0.0, cos(a * 8.0 + cc_time.x * 5.0)), 18.0) * (1.0 - smoothstep(0.38, 1.0, r));
            float megaCore = pow(max(0.0, 1.0 - r * 1.42), 2.2);
            float heartbeat = 0.72 + 0.28 * sin(cc_time.x * 9.0);
            float hue = cc_time.x * 0.34 + a * 0.11 + r * 0.16;
            vec3 prism = 0.52 + 0.48 * cos(6.28318 * (hue + vec3(0.0, 0.33, 0.67)));
            ink = mix(ink * 0.58, prism, clamp(orbit * 0.96 + rays * 0.62, 0.0, 1.0));
            ink += vec3(0.42, 0.84, 1.0) * spiralA * 0.38;
            ink += vec3(1.0, 0.98, 0.82) * megaCore * heartbeat;
            ink += vec3(1.0, 0.72, 0.94) * spiralB * 0.24;
        `,
        dynamax: `
            float pulse = 0.5 + 0.5 * sin(cc_time.x * 12.0);
            float bands = smoothstep(0.78, 0.99, abs(sin((p.y * 2.8 + p.x * 0.7) * 17.0 - cc_time.x * 7.0)));
            float dxCore = 1.0 - smoothstep(0.12, 0.92, length(p));
            ink = mix(ink * 0.34, vec3(1.0, 0.12, 0.2), 0.72 + pulse * 0.2);
            ink = mix(ink, vec3(1.0, 0.83, 0.76), bands * 0.44);
            ink += vec3(1.0, 0.2, 0.12) * dxCore * pulse * 0.48;
        `,
        'dynamax-pokemon': `
            // This material is for full-color Pokémon art, unlike the monochrome projectile shader.
            // The art stays the star: a faint red ambient rides the whole sprite, a slightly
            // stronger shimmer rides the rim, and travelling veins + the aura particles outside
            // carry the dynamax energy instead of one flat wash.
            float pulse = 0.5 + 0.5 * sin(cc_time.x * 12.0);
            float rim = smoothstep(0.55, 1.05, length(p));
            float veins = smoothstep(0.8, 0.98, abs(sin((p.x * 1.8 - p.y * 1.1) * 9.0 - cc_time.x * 5.0)));
            vec3 source = texel.rgb * color.rgb;
            ink = mix(source, vec3(1.0, 0.12, 0.2), 0.06 + rim * (0.16 + pulse * 0.12));
            ink = mix(ink, vec3(1.0, 0.55, 0.45), veins * (0.16 + 0.18 * pulse));
            ink += vec3(1.0, 0.3, 0.2) * rim * pulse * 0.22;
        `,
        'mega-venusaur': `
            float petals = smoothstep(0.58, 0.98, sin(a * 6.0 + sin(r * 17.0) - cc_time.x * 3.0));
            float veins = smoothstep(0.91, 0.995, abs(sin((p.x + p.y * 0.42) * 22.0)));
            ink = mix(ink, vec3(0.38, 1.0, 0.52), petals * 0.9);
            ink = mix(ink, vec3(1.0, 0.74, 0.92), veins * 0.78);
        `,
        'mega-charizard-x': `
            float crossSlash = max(smoothstep(0.9, 0.995, abs(sin((p.x + p.y) * 17.0 - cc_time.x * 3.0))), smoothstep(0.9, 0.995, abs(sin((p.x - p.y) * 17.0 + cc_time.x * 3.0))));
            ink = mix(ink, vec3(0.25, 0.95, 1.0), crossSlash * 0.95);
            ink += vec3(0.95, 1.0, 1.0) * pow(max(0.0, 1.0 - r * 2.4), 4.0);
        `,
        'mega-charizard-y': `
            float sunRay = pow(max(0.0, cos(a * 9.0 + cc_time.x * 1.8)), 12.0) * (1.0 - smoothstep(0.3, 1.0, r));
            float solarBand = smoothstep(0.76, 0.99, abs(sin(r * 31.0 - cc_time.x * 8.0)));
            ink = mix(ink, vec3(1.0, 0.28, 0.045), solarBand * 0.8);
            ink += vec3(1.0, 0.94, 0.42) * sunRay * 1.1;
        `,
        'mega-blastoise': `
            float barrelL = 1.0 - smoothstep(0.07, 0.16, length(p - vec2(-0.42, 0.0)));
            float barrelR = 1.0 - smoothstep(0.07, 0.16, length(p - vec2(0.42, 0.0)));
            float waterline = smoothstep(0.9, 0.995, abs(sin((p.y + sin(p.x * 7.0 + cc_time.x * 5.0) * 0.11) * 22.0)));
            ink = mix(ink, vec3(0.35, 0.88, 1.0), waterline * 0.72);
            ink += vec3(1.0, 1.0, 0.92) * max(barrelL, barrelR) * 0.95;
        `,
        'mega-swampert': `
            float tide = smoothstep(0.78, 0.99, abs(sin(r * 24.0 - sin(a * 3.0 + cc_time.x * 2.0) * 3.0 - cc_time.x * 6.0)));
            float crest = smoothstep(0.82, 0.995, abs(sin((p.y + p.x * 0.3) * 17.0 + cc_time.x * 4.0)));
            ink = mix(ink, vec3(0.32, 1.0, 0.83), tide * 0.8);
            ink = mix(ink, vec3(0.8, 1.0, 1.0), crest * 0.72);
        `,
        'mega-gengar': `
            float portal = smoothstep(0.82, 0.995, abs(sin(a * 4.0 + r * 34.0 + cc_time.x * 5.0)));
            float eyePair = max(1.0 - smoothstep(0.03, 0.11, length(p - vec2(-0.22, 0.08))), 1.0 - smoothstep(0.03, 0.11, length(p - vec2(0.22, 0.08))));
            ink = mix(ink, vec3(0.35, 0.05, 0.75), portal * 0.9);
            ink += vec3(1.0, 0.2, 0.55) * eyePair * (0.7 + 0.3 * sin(cc_time.x * 12.0));
        `,
        'mega-gardevoir': `
            float crescentArc = smoothstep(0.87, 0.995, abs(sin(a * 1.5 + r * 18.0 - cc_time.x * 4.0)));
            float moonCore = 1.0 - smoothstep(0.0, 0.32, length(p - vec2(0.32, 0.0)));
            ink = mix(ink, vec3(1.0, 0.46, 0.82), crescentArc * 0.9);
            ink += vec3(0.72, 0.92, 1.0) * moonCore * 0.9;
        `,
        'mega-beedrill': `
            float drill = smoothstep(0.86, 0.995, abs(sin(a * 3.0 - r * 43.0 + cc_time.x * 12.0)));
            float sting = smoothstep(0.94, 0.998, abs(sin((p.y - p.x * 0.16) * 38.0)));
            ink = mix(ink, vec3(1.0, 0.98, 0.42), drill * 0.95);
            ink += vec3(1.0, 0.34, 0.04) * sting * 0.75;
        `,
        'mega-ampharos': `
            float boltA = smoothstep(0.91, 0.997, abs(sin((p.x * 2.0 + sin(p.y * 9.0 + cc_time.x * 8.0) * 0.18) * 26.0)));
            float boltB = smoothstep(0.94, 0.999, abs(sin((p.y * 2.0 + sin(p.x * 8.0 - cc_time.x * 7.0) * 0.2) * 21.0)));
            ink = mix(ink, vec3(1.0, 1.0, 0.38), max(boltA, boltB) * 0.98);
        `,
        'mega-pidgeot': `
            float featherBars = smoothstep(0.84, 0.995, abs(sin((p.y - p.x * 0.52) * 24.0 - cc_time.x * 4.0)));
            float wingFlash = pow(max(0.0, 1.0 - abs(p.y + p.x * 0.3) * 2.2), 5.0);
            ink = mix(ink, vec3(1.0, 0.88, 0.56), featherBars * 0.82);
            ink += vec3(1.0, 0.98, 0.82) * wingFlash * 0.8;
        `,
        'mega-blaziken': `
            float flameClaw = smoothstep(0.65, 0.99, sin(a * 3.0 + r * 23.0 - cc_time.x * 7.0));
            float coal = smoothstep(0.86, 0.995, abs(sin((p.x * 1.7 + p.y) * 24.0 + cc_time.x * 5.0)));
            ink = mix(ink, vec3(1.0, 0.15, 0.025), flameClaw * 0.94);
            ink += vec3(1.0, 0.9, 0.34) * coal * 0.78;
        `,
        'mega-alakazam': `
            float runeRing = smoothstep(0.88, 0.995, abs(sin(r * 37.0 - cc_time.x * 5.0)));
            float runeTri = smoothstep(0.91, 0.997, abs(sin(a * 3.0 + r * 9.0 + cc_time.x * 1.8)));
            ink = mix(ink, vec3(1.0, 0.78, 0.3), runeRing * 0.88);
            ink = mix(ink, vec3(0.84, 0.55, 1.0), runeTri * 0.72);
        `,
        'mega-aggron': `
            float plate = smoothstep(0.82, 0.995, abs(sin(a * 6.0 + floor(r * 5.0) * 0.4)));
            float fracture = smoothstep(0.94, 0.999, abs(sin((p.x + p.y * 0.24) * 31.0 + sin(p.y * 8.0) * 2.0)));
            ink = mix(ink, vec3(0.8, 0.91, 1.0), plate * 0.8);
            ink += vec3(1.0) * fracture * 0.68;
        `,
        'mega-sceptile': `
            float bladeV = smoothstep(0.92, 0.998, abs(sin((p.y - p.x * 0.75) * 27.0 + cc_time.x * 3.0)));
            float sap = pow(max(0.0, sin(a * 5.0 + r * 13.0 - cc_time.x * 3.0)), 8.0);
            ink = mix(ink, vec3(0.42, 1.0, 0.3), bladeV * 0.9);
            ink += vec3(1.0, 0.9, 0.28) * sap * 0.72;
        `,
        'mega-salamence': `
            float wingMembrane = smoothstep(0.84, 0.995, abs(sin(a * 2.0 + r * 24.0 - cc_time.x * 3.5)));
            float dragonFlare = pow(max(0.0, cos(a * 3.0 - cc_time.x * 4.0)), 14.0) * (1.0 - smoothstep(0.3, 1.0, r));
            ink = mix(ink, vec3(0.28, 0.68, 1.0), wingMembrane * 0.9);
            ink += vec3(1.0, 0.75, 0.4) * dragonFlare * 0.9;
        `,
        'mega-garchomp': `
            float sawFin = smoothstep(0.68, 0.995, sin(a * 9.0 + r * 18.0 - cc_time.x * 5.0));
            float jawLine = smoothstep(0.93, 0.998, abs(sin((p.y + abs(p.x) * 0.25) * 26.0)));
            ink = mix(ink, vec3(1.0, 0.3, 0.24), sawFin * 0.86);
            ink += vec3(1.0, 0.92, 0.72) * jawLine * 0.7;
        `,
        'mega-metagross': `
            float crosshair = max(smoothstep(0.94, 0.999, abs(p.x)), smoothstep(0.94, 0.999, abs(p.y)));
            float targetRing = smoothstep(0.9, 0.998, abs(sin(r * 31.0 + cc_time.x * 5.0)));
            float lock = smoothstep(0.92, 0.999, abs(sin(a * 4.0)));
            ink = mix(ink, vec3(0.55, 1.0, 1.0), max(crosshair, targetRing) * 0.9);
            ink += vec3(1.0, 0.24, 0.3) * lock * 0.68;
        `,
        'mega-tyranitar': `
            float meteorCrack = smoothstep(0.87, 0.997, abs(sin(a * 5.0 + r * 19.0)));
            float lava = smoothstep(0.88, 0.998, abs(sin((p.x - p.y * 0.46) * 28.0 + cc_time.x * 2.0)));
            ink = mix(ink, vec3(0.25, 0.95, 0.55), meteorCrack * 0.85);
            ink += vec3(1.0, 0.38, 0.06) * lava * 0.86;
        `,
        'mega-lucario': `
            float auraPulse = smoothstep(0.82, 0.995, abs(sin(a * 5.0 + r * 25.0 - cc_time.x * 8.0)));
            float focusRing = smoothstep(0.9, 0.997, abs(sin(r * 36.0 - cc_time.x * 6.0)));
            float auraCore = pow(max(0.0, 1.0 - r * 1.55), 2.6);
            float redFist = smoothstep(0.94, 0.999, abs(sin((p.x + p.y * 0.35) * 31.0 + cc_time.x * 7.0)));
            ink = mix(ink, vec3(0.18, 0.78, 1.0), auraPulse * 0.92);
            ink = mix(ink, vec3(0.72, 0.96, 1.0), focusRing * 0.68);
            ink += vec3(0.95, 0.12, 0.28) * redFist * 0.82;
            ink += vec3(0.76, 0.96, 1.0) * auraCore * (0.62 + 0.38 * sin(cc_time.x * 10.0));
        `,
};

function makeBulletFragment (style) {
    // UVs address the entire glyph atlas, so the vertex shader supplies the sprite-local position.
    // Every effect clips to the original monochrome atlas glyph; these patterns cannot bleed into
    // neighbouring atlas cells and preserve the distinct projectile silhouettes.
    // The one art style rides on full-colour Pokémon icons instead of glyphs, so it opts out of the
    // glyph-cell coordinate space and the edge white-out that assumes it.
    const artStyle = style === 'dynamax-pokemon';
    const styleBody = BULLET_STYLE_BODIES[style] || '';
    const polarCoords = /^mega(?:-|$)/.test(style)
        ? 'float r = length(p);\n    float a = atan(p.y, p.x);'
        : '';

    return `
precision highp float;
${CC_GLOBAL_BLOCK}
in vec4 color;
in vec2 uv0;
in vec2 localPos;
layout(location = 0) out vec4 cc_FragColor;
uniform highp sampler2D cc_spriteTexture;
void main () {
    vec4 texel = texture(cc_spriteTexture, uv0);
    if (texel.a <= 0.01) discard;
    // Projectile patterns address the ±28 px glyph cell (vertex localPos). The full-colour
    // Pokémon art style addresses the sprite itself through uv0, so its bands stay put at any
    // icon size, and the glyph-edge white-out must never eat the art it sits on.
    vec2 p = ${artStyle ? 'uv0 * 2.0 - 1.0' : 'localPos'};
    float edge = smoothstep(0.53, 0.98, length(p));
    float core = 1.0 - smoothstep(0.08, 0.8, length(p));
    vec3 ink = color.rgb * mix(0.72, 1.0, core);
    ${polarCoords}
    ${styleBody}
    ${artStyle ? '' : 'ink = mix(ink, min(vec3(1.0), color.rgb * 1.65 + vec3(0.12)), edge * 0.82);'}
    cc_FragColor = vec4(clamp(ink, 0.0, 1.0), texel.a * color.a);
}
`;
}

/** Exposed for regression probes: the style body alone, as spliced into the shared main(). */
export function bulletStyleBodySource (style) {
    return BULLET_STYLE_BODIES[style] || '';
}

/** Exposed for regression probes: every style must compile against the shared fragment frame. */
export function bulletFragmentSource (style) {
    return makeBulletFragment(style);
}

/** Every bullet material the installer registers, in registration order. */
export function bulletStyleNames () {
    return [
        'nature', 'wind', 'fire', 'water', 'electric', 'crystal', 'psychic', 'shadow',
        'normal', 'bug', 'dark', 'dragon', 'fairy', 'ground', 'ice', 'poison', 'rock', 'steel',
        'mega', 'dynamax', 'dynamax-pokemon',
        ...MEGA_FORMS.map((form) => `mega-${form.id}`),
    ];
}

function makeShader (cc, opts) {
    const { Format } = cc.gfx;
    return {
        name: opts.name,
        hash: opts.hash,
        glsl4: { vert: '', frag: '' },
        glsl3: { vert: opts.vert, frag: opts.frag },
        glsl1: { vert: '', frag: '' },
        builtins: {
            globals: { buffers: [], blocks: [
                { name: 'CCCamera', defines: [] },
                ...(opts.useTime ? [{ name: 'CCGlobal', defines: [] }] : []),
            ], samplerTextures: [], images: [] },
            locals: {
                buffers: [],
                blocks: [{ name: 'CCLocal', defines: ['USE_LOCAL'] }],
                samplerTextures: opts.samplerTextures.map((s) => ({ name: s.name, defines: s.defines })),
                images: [],
            },
            statistics: {},
        },
        defines: [
            { name: 'USE_LOCAL', type: 'boolean', range: [], options: [], default: 'false' },
            { name: 'IS_GRAY', type: 'boolean', range: [], options: [], default: 'false' },
        ],
        attributes: opts.attributes.map(([name, format, location]) => ({
            name,
            format,
            isNormalized: false,
            stream: 0,
            isInstanced: false,
            location,
            defines: [],
        })),
        blocks: [],
        // Builtin samplers must stay out of this array: program-lib injects the manifest's own
        // UniformSamplerTexture (set = LOCAL) for anything listed under builtins.locals. Listing
        // it here as well adds a second entry for the same uniform name, and the later
        // gl.uniform1iv overwrites the texture unit the 2D batcher actually binds to.
        samplerTextures: [],
        samplers: [],
        textures: [],
        buffers: [],
        images: [],
        subpassInputs: [],
        descriptors: [],
    };
}

function makeEffect (cc, shader, passOverrides) {
    const asset = new cc.EffectAsset(shader.name);
    asset._uuid = shader.name;
    asset.shaders = [shader];
    asset.combinations = [{ USE_LOCAL: [false, true], IS_GRAY: [false, true] }];
    asset.techniques = [{
        name: 'technique',
        passes: [Object.assign({ program: shader.name, properties: {} }, passOverrides)],
    }];
    asset.onLoaded();
    return asset;
}

export function installBuiltin2DMaterials (cc) {
    const { BlendFactor, BlendOp, CullMode, ComparisonFunc, Format } = cc.gfx;
    const missing = ['BlendFactor', 'BlendOp', 'CullMode', 'ComparisonFunc', 'Format', 'Type', 'ShaderStageFlagBit']
        .filter((k) => !cc.gfx || cc.gfx[k] === undefined);
    if (missing.length) {
        throw new Error(`cc.gfx is missing ${missing.join(', ')} - cannot build builtin materials`);
    }

    const sharedState = {
        depthStencilState: { depthTest: false, depthWrite: false, stencilState: { enabled: false } },
        rasterizerState: { cullMode: CullMode.NONE },
    };
    const blend = (src, dst) => ({
        targets: [{
            blend: true,
            blendSrc: src,
            blendDst: dst,
            blendSrcAlpha: BlendFactor.ONE,
            blendDstAlpha: BlendFactor.ONE_MINUS_SRC_ALPHA,
            blendOp: BlendOp.ADD,
            blendOpAlpha: BlendOp.ADD,
        }],
    });

    makeEffect(cc, makeShader(cc, {
        name: 'cc-2d-graphics',
        hash: 0x1a2b3c01,
        vert: GRAPHICS_VERT,
        frag: GRAPHICS_FRAG,
        attributes: [['a_position', Format.RGB32F, 0], ['a_color', Format.RGBA32F, 1], ['a_dist', Format.R32F, 2]],
        samplerTextures: [],
    }), Object.assign({ blendState: blend(BlendFactor.ONE, BlendFactor.ONE_MINUS_SRC_ALPHA) }, sharedState));

    makeEffect(cc, makeShader(cc, {
        name: 'cc-2d-sprite',
        hash: 0x1a2b3c02,
        vert: SPRITE_VERT,
        frag: SPRITE_FRAG,
        attributes: [['a_position', Format.RGB32F, 0], ['a_texCoord', Format.RG32F, 1], ['a_color', Format.RGBA32F, 2]],
        samplerTextures: [{ name: 'cc_spriteTexture', defines: [] }],
    }), Object.assign({ blendState: blend(BlendFactor.SRC_ALPHA, BlendFactor.ONE_MINUS_SRC_ALPHA) }, sharedState));

    const mkMat = (effectName, defines) => {
        const mat = new cc.Material();
        mat.initialize({ effectName });
        if (defines) { mat.recompileShaders(defines); }
        return mat;
    };
    const add = (key, mat) => { cc.builtinResMgr.addAsset(key, mat); };
    const sprite = () => mkMat('cc-2d-sprite');

    const styles = bulletStyleNames();
    styles.forEach((style, i) => {
        const name = `cc-2d-bullet-${style}`;
        makeEffect(cc, makeShader(cc, {
            name,
            hash: 0x1a2b3d00 + i,
            vert: `${CC_CAMERA_BLOCK}\n#if USE_LOCAL\n${CC_LOCAL_BLOCK}\n#endif\nlayout(location=0) in vec3 a_position;\nlayout(location=1) in vec2 a_texCoord;\nlayout(location=2) in vec4 a_color;\nout vec4 color;\nout vec2 uv0;\nout vec2 localPos;\nvoid main(){vec4 pos=vec4(a_position,1.0);\n#if USE_LOCAL\npos=cc_matWorld*pos;\n#endif\ngl_Position=cc_matViewProj*pos;uv0=a_texCoord;color=a_color;localPos=a_position.xy/28.0;}`,
            frag: makeBulletFragment(style),
            attributes: [['a_position', Format.RGB32F, 0], ['a_texCoord', Format.RG32F, 1], ['a_color', Format.RGBA32F, 2]],
            samplerTextures: [{ name: 'cc_spriteTexture', defines: [] }],
            useTime: true,
        }), Object.assign({ blendState: style === 'mega'
            ? blend(BlendFactor.SRC_ALPHA, BlendFactor.ONE)
            : blend(BlendFactor.SRC_ALPHA, BlendFactor.ONE_MINUS_SRC_ALPHA) }, sharedState));
        const mat = mkMat(name);
        add(`ui-bullet-${style}-material`, mat);
    });

    add('ui-graphics-material', mkMat('cc-2d-graphics'));
    add('ui-base-material', sprite());
    add('ui-sprite-material', sprite());
    add('ui-sprite-alpha-sep-material', sprite());
    add('ui-sprite-gray-material', sprite());
    add('ui-sprite-gray-alpha-sep-material', sprite());
    // ParticleSystem2D uses the same position/UV/color vertex stream as sprites. The source-only
    // engine build has no Creator internal bundle, so give the native particle renderer the same
    // compatible shader as the rest of this game's 2D visuals.
    add('ui-particle-material', sprite());
}
