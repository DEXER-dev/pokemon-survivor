/*
 * The greybox root: the world transform, the fixed-step simulation and one immediate-mode render
 * pass. The order of the steps is the game's whole verb set - walk, the tail grinds, kills pay EXP,
 * and a thrown ball is the only thing that turns a living enemy into a pet.
 */
import {
    VIEW, PPM, PLAYER, CHAIN, COL, ELEMENT, FAMILIES, SIM, ENEMY, BALL, CATCH, EXP, MAX_BODY_R,
    PLAYER_HP, BOSS, SUPPORT_SKILLS, LEGENDARY_BOSSES, WILD_BOSSES, family,
} from './config.js';
import { SpriteBatch, Palette } from './batch.js';
import { buildGreyboxAtlas, loadIconAtlas, loadMegaMewtwoYIcon, loadMewtwoArenaBackdrop, loadLugiaArenaBackdrop, loadRayquazaArenaBackdrop, loadKyogreArenaBackdrop, loadHoOhArenaAssets, loadLucasAtlas, loadTrainerAtlas, loadPokeball, loadMegaStoneAtlas, loadUpgradeItemAtlas, loadHoohVfxAtlas, loadFloraAtlas, loadPondAtlas, loadTreeAtlas, loadLegendaryVfxAtlas, loadSubLegendaryVfxAtlas, loadZMoveVfxAtlas } from './atlas.js';
import { WorldFlora } from './world-flora.js';
import { WorldTrees } from './world-trees.js';
import { WorldPond } from './world-pond.js';
import { WorldMewtwoArena, WorldLugiaArena, WorldRayquazaArena, MEWTWO_ARENA_BOUNDS, MEWTWO_ARENA_SIZE,
    LUGIA_ARENA_BOUNDS, LUGIA_ARENA_SIZE, RAYQUAZA_ARENA_BOUNDS, RAYQUAZA_ARENA_SIZE,
    WorldKyogreArena, KYOGRE_ARENA_BOUNDS, KYOGRE_ARENA_SIZE,
    KYOGRE_ARENA_SQUARE_BOUNDS, KYOGRE_ARENA_SQUARE_SIZE } from './world-mewtwo-arena.js';
import { WorldHoOhArena } from './world-mewtwo-arena.js';
import { createHoOhSpecialState, startHoOhSpecial, stepHoOhSpecial } from './hooh-special.js';
import { drawWorldGround } from './world-ground.js';
import { createWorldLayout, inPondClearing } from './world-map-layout.js';
import { MEGA_FORMS, MEGA_BY_ID, megaFormForSegment } from './mega.js';
import { GIGANTAMAX_BY_ID, gigantamaxFormForSegment, gigantamaxLocksEvolution } from './gigantamax.js';
import { FORM as HO_OH_SKILL_FORM } from './skills/active/legendary/ho-oh.js';
import { charizardXFlightPose } from './skills/active/mega/charizard-x.js';
import { legendaryActiveFormForSegment } from './skills/active/legendary/other-legendaries.js';
import { iconKey, iconKeys, shinyKey, BOSS_SPECIES, displayName, dexText, typeText } from './species.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { ChainSystem, evolveGate, lineTop } from './chain.js';
import { EnemySystem } from './enemies.js';
import { TrainerBossSystem } from './trainer-boss.js';
import { CaptureSystem, EV_HIT, EV_MISS, EV_POP, EV_BOSS } from './capture.js';
import { CaptureSfx } from './capture-sfx.js';
import { CombatSfx } from './combat-sfx.js';
import { EvolutionSfx } from './evolution-sfx.js';
import { UpgradeSfx } from './upgrade-sfx.js';
import { createMegaEvolutionFx, megaEvolutionVisual, stepMegaEvolutionFx } from './mega-evolution-fx.js';
import { createEvolutionFx, evolutionVisual, stepEvolutionFx } from './evolution-fx.js';
import { MusicManager } from './music-manager.js';
import { CombatSystem, chainDps, segDps, lateDamageMultiplier, hitArea } from './combat.js';
import {
    activeSkillForForm as resolveActiveSkillForForm, activeSkillModuleForForm,
    drawPersistentSkillFields, drawCakePickups, rosterActiveFormForSegment,
    fieldEffectForFamily, projectileRendererForFamily,
    drawMegaActiveArea, drawMegaEffects, drawMegaScreenEffects,
} from './skills/registry.js';
import { stepFields as stepRillaboomFields } from './skills/active/gigantamax/rillaboom.js';
import { stepCakes as stepAlcremieCakes } from './skills/active/roster/alcremie.js';
import { SkillSystem } from './skills.js';
import { NativeParticleBursts } from './particles.js';
import { LegendaryLairs } from './legendary-lairs.js';
import { LegendaryAttackSystem } from './legendary-attacks.js';
import { drawLegendaryAttackPattern } from './legendary-attack-renderer.js';
import { drawPrimaryLegendaryBossAttack } from './legendary-boss-renderer.js';
import { isLegendaryCompanion, isSubLegendaryCompanion, hasCompanionSignature,
    SUB_LEGENDARY_COMPANION_SIGNATURES, legendaryBodyScale,
    stepLegendaryCompanionAttacks, WARNING_SECONDS, IMPACT_SECONDS }
    from './skills/active/legendary/companion-bombardment.js';
import { drawLegendaryProjectile, drawLegendaryCompanionEffects, drawLegendaryMainEffect,
    drawSubLegendaryBossAttack }
    from './skills/active/legendary/companion-renderer.js';
import { Build, LEVELS, roll, take, available } from './upgrades.js';
import { Furnace, refund } from './forge.js';
import { Hud } from './hud.js';
import { Panel } from './panel.js';
import { EvolutionReward } from './evolution-reward.js';
import { DynamaxSelector } from './dynamax-selector.js';
import { DYNAMAX_BAND, canDynamax, dynamaxProjectileScale } from './items/dynamax-band.js';
import { Z_CRYSTALS, Z_POWER_BAND, zAffinityCount, zMoveMetrics } from './items/z-power-band.js';
import { createRotationTracker, resetRotationTracker, rotationProgress, stepRotationTracker } from './items/rotation-sweet.js';
import { ZMoveSystem } from './z-moves.js';
import { ZCrystalSelector } from './z-crystal-selector.js';
import { drawZMoveEffects } from './skills/active/z-move-renderer.js';
import { TrainerTransition } from './trainer-transition.js';
import { PlayLog } from './play-log.js';
import { makeRng, randomSeed } from './rng.js';
import { TRAINER_SPRITES, PLAYER_APPEARANCES } from './trainer-sprites.js';
import { STARTER_BY_FAMILY, STARTER_POKEMON } from './starter-pokemon.js';
import { tandemausFollowerMotion, tandemausFollowerOffset, tandemausFollowerScale,
    tandemausVisibleCompanionCount, tandemausVisibleCompanionIndex } from './companion-formation.js';
import { SHINY_GOLD } from './shiny.js';
import { AUSTRALIAN_MOUSE_INTERVAL, australianMouseCount, stepAustralianMouse } from './items/australian-mouse.js';

const TAU = Math.PI * 2;
const TIER_GLYPH = ['circle', 'hex', 'star', 'diamond'];
const MOB_GLYPH = ['blob', 'square', 'hex', 'star'];
const UPGRADE_REVEAL_DELAY = 0.32;
const HOOH_ARENA_BOUNDS = Object.freeze({ halfWidth: 550, halfHeight: 310 });
const HOOH_ARENA_SIZE = Object.freeze({ width: 1200, height: 1200 * 941 / 1672 });
let dexPreviewSimulation = null;
let pauseAfterDexRestore = false;

export function setDexPreviewSimulation (preview, pauseAfterRestore = false) {
    dexPreviewSimulation = preview;
    if (preview) pauseAfterDexRestore = false;
    if (!preview && pauseAfterRestore) pauseAfterDexRestore = true;
}
/**
 * Sprite tint for the horde once the borrowed icon art is in. A full-colour species on the warm
 * cream ground would read as "pet", which is the one distinction §9.5's shape language was built
 * to carry, so the horde is multiplied cold: enough to keep the art legible, enough that the field
 * still says friend/foe at a glance. Pets draw pure white, i.e. their real colours.
 */
const HORDE_TINT = '#b7b1d9';
const HORDE_TINT_ELITE = '#918ac6';
const HORDE_TINT_BOSS = '#8f88c2';
const ICON_TINT = '#ffffff';
/**
 * 阶 → the smallest body species art may draw, in design px (a fitted icon is 48 px at scale 1, so
 * `48·scale` is the sprite's longest side). v0.9.4 made this a ladder; before that it was one number
 * for the whole roster, and that number silently deleted the 阶 signal it was written to sit under:
 * measured on the live nodes, a mob's honest `2r` is 26.5/29.6 px at 1/2 阶 and a lone pet's base
 * spans 26.4-35.0 px across all four 阶, so *every* one of those shapes drew at exactly 34 px - an
 * evolved animal and its pre-evolution were the same pixels.
 * The ladder the steps have to fit into is measured, not guessed: mob 34 → 2阶 mob 38 → hero pill 23×43
 * → 3阶 pet 42 → 4阶 pet 45 → 精英 49.5 → BOSS 124.8. Two rules that came out of §9 stay load-bearing
 * here: regular mobs never outrank the hero (they spawn at 阶 1-2, so 38 is their ceiling), while the
 * boss and a 熔炉-cast body intentionally stand taller as encounter silhouettes.
 * The hitbox does not move: the capture band a throw actually sweeps is `2*(ballR + e.r)` = 57 px, so
 * even the widest mob sits inside what the ball really takes, and the corridor stays honest.
 */
const FORM_MIN = [34, 38, 42, 45];
const formMin = (tier) => FORM_MIN[Math.max(0, Math.min(FORM_MIN.length - 1, (tier | 0) - 1))];
// Keep evolution readable even when a stack's 4-pack crowd divisor would flatten the tier floor.
// Applied after pack compression: final forms should read as a new, larger stage at a glance.
const FORM_SCALE = [1, 1.25, 1.6, 1.95];
const formScale = (tier) => FORM_SCALE[Math.max(0, Math.min(FORM_SCALE.length - 1, (tier | 0) - 1))];
const PET_SCALE = 0.55;
/** 满线合体的胖度：每多一个 节圆当量（`CHAIN.topBulk` 封顶）给身体加这么多 scale。 */
const PET_BULK = 0.12;
const HERO_SCALE = 0.9;
export const DEX_PREVIEW_ZOOM = 1.8;

/** Keep sustained attack geometry shared so the live game and Pokédex match. */
function drawSkillEffects (game, batch) {
    const skills = game.skills;
    for (let i = 0; i < skills.nfx; i++) {
        const fx = skills.fx[i];
        if (drawLegendaryMainEffect(batch, game.pal, fx, game.wall)) continue;
        const element = family(fx.fam)?.element;
        const color = ELEMENT[element] || '#fff0d1';
        if (fx.kind === 'field') {
            const fieldColor = game.pal.get(color, Math.round(24 + 58 * fx.p));
            const effect = fieldEffectForFamily(fx.fam);
            batch.draw(effect?.ring || 'field', fx.x, fx.y, fx.a / 24, fx.a / 24,
                game.time * 0.55, fieldColor);
        } else if (fx.kind === 'beam') {
            // Native particles add the moving spray; this core keeps the true hit lane readable
            // after the Pokédex capture is downscaled.
            const width = Math.max(4, fx.b * 2);
            const length = fx.a * 2;
            const pulse = 0.88 + 0.12 * Math.sin(game.time * 18 + fx.rot * 2);
            const lay = (w, hex, alpha) => batch.draw('pill', fx.x, fx.y,
                w / 29, length / 56, fx.rot - Math.PI / 2,
                game.pal.get(hex, Math.round(alpha * pulse)));
            lay(width * 1.45, color, 58);
            lay(width, color, 136);
            lay(width * 0.46, '#d7f7ff', 176);
            lay(width * 0.16, '#ffffff', 218);
        } else if (fx.kind === 'slash') {
            const alpha = Math.round(48 + 42 * (1 - fx.p * 0.7));
            batch.draw('pill', fx.x - Math.cos(fx.rot) * fx.a * 0.3,
                fx.y - Math.sin(fx.rot) * fx.a * 0.3, 2.8 / 29,
                (fx.a * 0.9) / 56, fx.rot - Math.PI / 2,
                game.pal.get(color, alpha));
        } else if (fx.kind === 'orbit') {
            const orbitColor = game.pal.get(color, 48);
            batch.draw('field', fx.x, fx.y, fx.a * 2 / 24, fx.a * 2 / 24,
                fx.rot * 0.08, orbitColor);
            if (fx.c > 0) batch.draw('field', fx.x, fx.y, fx.a * 1.28 / 24,
                fx.a * 1.28 / 24, -fx.rot * 0.08, orbitColor);
        }
    }
    // Tandemaus is itself the projectile: keep one real icon locked to each live SkillSystem shot.
    // The native ParticleSystem2D samples below it leave the trail, while this nucleus makes the
    // flying attack unmistakable even when a close target is hit before the next particle sample.
    for (let i = 0; i < skills.n; i++) {
        const famId = skills.pfam[i];
        if (famId?.startsWith('legend-') || SUB_LEGENDARY_COMPANION_SIGNATURES[famId]) {
            drawLegendaryProjectile(batch, game.pal, famId, skills.px[i], skills.py[i], skills.pr[i],
                Math.atan2(skills.pvy[i], skills.pvx[i]), game.wall, i);
            continue;
        }
        if (famId !== 'tandemaus') continue;
        const variant = skills.pvariant[i] || 0;
        const baseGlyph = `MAUSHOLD_COMPANION_${variant % 4 + 1}`;
        if (!batch.glyphs[baseGlyph]) continue;
        const shiny = skills.pShiny?.[i] === 1 && !!batch.glyphs[`${baseGlyph}_s`];
        const renderer = projectileRendererForFamily(famId, skills.pStage[i]);
        renderer?.(batch, game.pal, {
            x: skills.px[i], y: skills.py[i], size: skills.pr[i],
            shotAngle: Math.atan2(skills.pvy[i], skills.pvx[i]), index: i, variant, shiny,
        });
    }
    drawLegendaryCompanionEffects(batch, game.pal, game.chain.segments, game.wall);
}
/** How long a fold's pop lasts, in seconds-of-`fx` per second. ~0.37 s back to rest. */
const FOLD_DECAY = 2.7;
/** Trauma per second, off the same frame clock as `FOLD_DECAY` - see `stepFrameFx`. */
const SHAKE_DECAY = 2.2;
/**
 * The three folds' one-shot presets, and the only place their relative loudness is written. Amplitude
 * is per *event* because the automatic 进化 lands ~20 times a run (§9.15-⑨), so `auto` is deliberately
 * a nod rather than a large burst. Colours are not new - violet marks 进化 and gold marks BOSS events,
 * so the burst cannot teach a third meaning, and `kick` rides along so the shake is scaled by the same
 * table instead of being typed per call site.
 */
const FORM_FX = {
    auto: { amp: 0.08, col: COL.accent, spark: false, bloom: 0, kick: 0.05 },
    evo: { amp: 0.18, col: COL.accent, spark: true, bloom: 0, kick: 0.16 },
};
/** Where a ball appears and where the corridor is drawn from: down the aim line, out of the arm. */
const MUZZLE = 26;
/** Where the animals sharing one 宠列 node stand, in radii of that node's sprite. */
const PACK = [[0, 0], [-1.7, 0.45], [1.6, -0.35], [0.35, 1.6]];
/** Ring waves are decoration, so the pool is fixed and the oldest slot simply gets overwritten. */
const FX_MAX = 40;
const WAVE_ACCENT = 0;
const WAVE_GOLD = 1;
const WAVE_DIM = 2;
const MEGA_FX_MAX = 36;
/** A refusal and a first-time nudge are sentences the player acts on with his next throw, so they get
 *  a longer window than a flash like "入队 +1 融核". */
const SAY_READ = 2.8;
const GREY = '#9a94ab';

/** Draw a pulsing, per-form pixel contour and a few small motes without adding a ring-shaped halo. */
function drawMegaFormOutline (batch, palette, glyphs, form, icon, x, y, sx, sy, time, seed = 0,
    opacity = 255, flipX = false) {
    if (!form?.outline || !icon) return false;
    const outlineKey = `${icon}__mega_outline`;
    if (!glyphs[outlineKey]) return false;
    const colors = form.outline;
    const pulse = 0.5 + 0.5 * Math.sin(time * 4.1 + seed * 0.73);
    const visibility = Math.max(0, Math.min(1, opacity / 255));
    const glowKey = `${icon}__mega_glow`;
    if (glyphs[glowKey]) {
        batch.draw(glowKey, x, y, sx, sy, 0,
            palette.get(colors.color, Math.round((28 + pulse * 42) * visibility)), flipX);
    }
    batch.draw(outlineKey, x, y, sx, sy, 0,
        palette.get(colors.color, Math.round((178 + pulse * 68) * visibility)), flipX);

    for (let mote = 0; mote < 3; mote++) {
        const phase = (time * 0.62 + seed * 0.19 + mote / 3) % 1;
        const angle = time * 0.32 + seed * 1.17 + mote * TAU / 3;
        const radius = Math.max(Math.abs(sx), Math.abs(sy)) * (31 + phase * 13);
        const mx = x + Math.cos(angle) * radius;
        const my = y + Math.sin(angle) * radius + phase * 9;
        const alpha = Math.round((1 - phase) * (72 + pulse * 94) * visibility);
        const moteColor = mote === 1 ? colors.highlight : colors.color;
        const size = 0.12 + 0.07 * (1 - phase);
        batch.draw(mote === 1 ? 'shard' : 'star', mx, my, size, size, angle,
            palette.get(moteColor, alpha));
    }
    return true;
}

export function createGame (cc) {
    class Game extends cc.Component {
        onLoad () {
            this.playLog = new PlayLog();
            this.playLog.install(window);
            this.pal = new Palette(cc);
            this.atlas = buildGreyboxAtlas(cc);
            // The borrowed species art is a second texture that lands a few hundred ms after boot.
            // Until it does - and if it never does - every draw site below keeps the greybox glyph it
            // used before, so a missing asset degrades to the old look instead of to a blank field.
            this.icons = false;
            this.iconAtlas = null;
            this.lucasReady = false;
            this.playerAppearance = 0;
            try {
                const savedAppearance = window.localStorage.getItem('pokemon-survivor-trainer');
                // Accept stable trainer IDs and old numeric appearance indices; unknown boss portraits reset to Lucas.
                const savedTrainer = Object.entries(PLAYER_APPEARANCES).find(([id, appearance]) => id !== 'lucas'
                    && (savedAppearance === id || savedAppearance === String(appearance)));
                if (savedTrainer) this.playerAppearance = savedTrainer[1];
            } catch (_) { /* A blocked storage API must not prevent a fresh run. */ }
            this.startingPokemon = STARTER_POKEMON[0].family;
            try {
                const savedStarter = window.localStorage.getItem('pokemon-survivor-starter');
                if (STARTER_BY_FAMILY.has(savedStarter)) this.startingPokemon = savedStarter;
            } catch (_) { /* Storage is optional; use Bulbasaur as the default. */ }
            this.lucasSpritesPromise = loadLucasAtlas(cc).then((a) => {
                Object.assign(this.atlas.glyphs, a.glyphs);
                this.lucasReady = true;
            }).catch((err) => console.warn('[player] staying greybox:', err && err.message));
            this.trainerSpritesPromise = loadTrainerAtlas(cc).then((a) => {
                Object.assign(this.atlas.glyphs, a.glyphs);
                this.trainerSpritesReady = true;
                return true;
            }).catch((err) => {
                console.warn('[trainers] using fallback trainer sprite:', err && err.message);
                return false;
            });
            this.pokeball = null;
            this.pokeballPromise = loadPokeball(cc).then((ball) => {
                this.atlas.glyphs.pokeball = ball;
                this.pokeball = ball;
                if (this.hud) this.hud.setBallFrame(ball.frame);
            }).catch((err) => console.warn('[pokeball] staying greybox:', err && err.message));
            this.megaAssets = null;
            this.megaAssetsPromise = loadMegaStoneAtlas(cc, MEGA_FORMS).then((assets) => {
                Object.assign(this.atlas.glyphs, assets.glyphs);
                this.megaAssets = assets;
                if (this.panel) this.panel.setMegaStoneFrames(assets.frames);
            }).catch((err) => console.warn('[mega] stone art unavailable:', err && err.message));
            this.upgradeItemAssets = null;
            this.upgradeItemAssetsPromise = loadUpgradeItemAtlas(cc, LEVELS).then((assets) => {
                this.upgradeItemAssets = assets;
                if (this.panel) this.panel.setUpgradeItemFrames(assets.frames);
            }).catch((err) => console.warn('[upgrade-icons] item icons unavailable:', err && err.message));
            void loadHoohVfxAtlas(cc).then((assets) => {
                Object.assign(this.atlas.glyphs, assets.glyphs);
                this.hoohVfxAtlas = assets;
            }).catch((err) => console.warn('[hooh-vfx] using fallback:', err && err.message));
            void loadLegendaryVfxAtlas(cc).then((assets) => {
                Object.assign(this.atlas.glyphs, assets.glyphs);
                this.legendaryVfxAtlas = assets;
            }).catch((err) => console.warn('[legendary-vfx] using glyph fallback:', err && err.message));
            void loadSubLegendaryVfxAtlas(cc).then((assets) => {
                Object.assign(this.atlas.glyphs, assets.glyphs);
                this.subLegendaryVfxAtlas = assets;
            }).catch((err) => console.warn('[sub-legendary-vfx] using procedural fallback:', err && err.message));
            void loadZMoveVfxAtlas(cc).then((assets) => {
                Object.assign(this.atlas.glyphs, assets.glyphs);
                this.zMoveVfxAtlas = assets;
            }).catch((err) => console.warn('[z-move-vfx] using readable glyph fallback:', err && err.message));

            const backdrop = new cc.Node('Backdrop');
            backdrop.layer = cc.Layers.Enum.UI_2D;
            this.node.addChild(backdrop);
            this.ground = backdrop.addComponent(cc.Graphics);
            this.backdrop = backdrop;

            this.world = new cc.Node('World');
            this.world.layer = cc.Layers.Enum.UI_2D;
            this.node.addChild(this.world);

            this.mewtwoArena = new WorldMewtwoArena(cc, this.node);
            this.mewtwoArenaPromise = loadMewtwoArenaBackdrop(cc).then((assets) => {
                this.mewtwoArena.setBackdrop(assets);
            }).catch((err) => console.warn('[mewtwo-map] using fallback cave ground:', err && err.message));
            this.lugiaArena = new WorldLugiaArena(cc, this.node);
            this.lugiaArenaPromise = loadLugiaArenaBackdrop(cc).then((assets) => {
                this.lugiaArena.setBackdrop(assets);
            }).catch((err) => console.warn('[lugia-map] using fallback cave ground:', err && err.message));
            this.rayquazaArena = new WorldRayquazaArena(cc, this.node);
            this.rayquazaArenaPromise = loadRayquazaArenaBackdrop(cc).then((assets) => {
                this.rayquazaArena.setBackdrop(assets);
            }).catch((err) => console.warn('[rayquaza-map] using fallback arena ground:', err && err.message));
            this.kyogreArena = new WorldKyogreArena(cc, this.node);
            this.kyogreArenaPromise = loadKyogreArenaBackdrop(cc).then((assets) => {
                this.kyogreArena.setBackdrops(assets);
            }).catch((err) => console.warn('[kyogre-map] using fallback cave ground:', err && err.message));
            this.hoohArena = new WorldHoOhArena(cc, this.node);
            this.hoohArenaPromise = loadHoOhArenaAssets(cc).then((assets) => {
                this.hoohArena.setAssets(assets);
            }).catch((err) => console.warn('[hooh-map] using fallback sky ground:', err && err.message));

            // The landmark lake uses the supplied, processed Lake.png tile textures.
            this.pond = new WorldPond(cc, this.world);
            this.pondArtPromise = loadPondAtlas().then((assets) => {
                this.pond.setLakeAssets(assets);
            }).catch((err) => console.warn('[pond] Lake.png textures unavailable:', err && err.message));

            // Field plants sit between the ground and entities, stable within this run's map seed.
            this.flora = new WorldFlora(cc, this.world);
            this.floraPromise = loadFloraAtlas(cc).then((assets) => {
                this.flora.setFrames(assets.glyphs);
                this.pond.setPlantFrames(assets.glyphs);
            }).catch((err) => console.warn('[flora] field plants unavailable:', err && err.message));
            this.trees = new WorldTrees(cc, this.world);
            this.treeAtlasPromise = loadTreeAtlas(cc).then((assets) => {
                this.trees.setFrames(assets.glyphs);
            }).catch((err) => console.warn('[trees] field trees unavailable:', err && err.message));
            // Start the 278-species atlas only after tree/field art has claimed its image requests.
            // It can keep loading while the title screen and game are already usable.
            this.iconAtlasPromise = Promise.all([
                loadIconAtlas(cc, iconKeys(), MEGA_FORMS.map((form) => form.icon)),
                loadMegaMewtwoYIcon(cc).catch((err) => {
                    console.warn('[icons] Mega Mewtwo Y sprite unavailable; keeping its normal form:', err && err.message);
                    return { glyphs: {} };
                }),
            ]).then(([a, mewtwo]) => {
                Object.assign(this.atlas.glyphs, a.glyphs);
                Object.assign(this.atlas.glyphs, mewtwo.glyphs);
                this.iconAtlas = a;
                this.icons = true;
            }).catch((err) => console.warn('[icons] staying greybox:', err && err.message));
            this.visualAssetsReadyPromise = Promise.all([
                this.pondArtPromise,
                this.floraPromise,
                this.treeAtlasPromise,
            ]).then(() => true);

            const entities = new cc.Node('Entities');
            entities.layer = cc.Layers.Enum.UI_2D;
            this.world.addChild(entities);
            this.batch = new SpriteBatch(cc, entities, this.atlas.glyphs);
            // Foreground trees share the world transform but sit above entities for
            // Pokémon-style depth: their crowns cover the trainer when the trainer
            // walks behind them, while trunk collision stays independent.
            this.trees.setForegroundParent(this.world);

            const fxNode = new cc.Node('Fx');
            fxNode.layer = cc.Layers.Enum.UI_2D;
            this.world.addChild(fxNode);
            this.fx = fxNode.addComponent(cc.Graphics);
            this.particleBursts = new NativeParticleBursts(cc, this.world,
                this.atlas.glyphs.circle.frame, this.atlas.glyphs.star.frame,
                this.atlas.glyphs, this.atlas.particleGlyphs);
            this.dexPreview = null;
            this.dexPreviewScene = null;
            this.dexPreviewVisibility = null;

            this.hud = new Hud(cc, this.node);
            if (this.pokeball) this.hud.setBallFrame(this.pokeball.frame);
            this.upgradeSfx = new UpgradeSfx(cc, this.node);
            this.panel = new Panel(cc, this.node, this.pal);
            this.panel.setSfx((event) => this.upgradeSfx.play(event));
            if (this.megaAssets) this.panel.setMegaStoneFrames(this.megaAssets.frames);
            if (this.upgradeItemAssets) this.panel.setUpgradeItemFrames(this.upgradeItemAssets.frames);
            this.furnace = new Furnace(cc, this.node, this.pal);
            this.evolutionReward = new EvolutionReward(cc, this.node, this.pal);
            this.evolutionReward.setSfx((event) => this.upgradeSfx.play(event));
            this.dynamaxSelector = new DynamaxSelector(cc, this.node, this.pal);
            this.zCrystalSelector = new ZCrystalSelector(cc, this.node, this.pal);
            this.zMoves = new ZMoveSystem();
            this.trainerTransition = new TrainerTransition(cc, this.node, this.pal);

            // 全局错误陷阱：冻结/异常连同堆栈写进对局日志，F9 导出即可带回现场。
            window.addEventListener('error', (e) => {
                this.logEvent('client.error', { message: String(e.message),
                    line: e.lineno, col: e.colno,
                    stack: e.error && e.error.stack ? String(e.error.stack).slice(0, 600) : null });
            });
            this.runSeed = 0;
            this.rng = makeRng(1);
            this.player = new Player(PLAYER, PLAYER_HP);
            this.chain = new ChainSystem(cc, CHAIN);
            this.enemies = new EnemySystem(ENEMY, this.rng);
            this.pond.setFamilyIndex(FAMILIES.findIndex((entry) => entry.id === 'drop'));
            this.enemies.onShinySpawn = (index, famIdx, tier, x, y) => {
                const species = FAMILIES[famIdx] && FAMILIES[famIdx].id;
                this.logEvent('pokemon.shiny-appeared', { species, name: displayName(species, tier),
                    tier, enemyIndex: index, x: Math.round(x), y: Math.round(y) });
            };
            // 王者之证：击败野外与队伍同种的宝可梦 10 次，缓冲一只该精灵（训练家/BOSS 不计）。
            this.kingCounters = Object.create(null);
            this.kingGrants = [];
            this.enemies.onKill = (famIdx, trainer, boss) => {
                if (!trainer && !boss) this.skills.killFeedback();
                if (!this.build.stacks.kingsRock || trainer || boss) return;
                const fam = FAMILIES[famIdx] && FAMILIES[famIdx].id;
                if (!fam || !this.chain.segments.some((s) => s.fam === fam)) return;
                const n = (this.kingCounters[fam] = (this.kingCounters[fam] || 0) + 1);
                if (n >= 10) {
                    this.kingCounters[fam] = 0;
                    this.kingGrants.push(fam);
                }
            };
            this.trainerBoss = new TrainerBossSystem();
            this.legendaryLairs = new LegendaryLairs(LEGENDARY_BOSSES);
            this.legendaryAttacks = new LegendaryAttackSystem();
            this.legendaryMap = { active: false, x: 0, y: 0, famIdx: -1, species: null,
                mewtwoIntro: 0, mewtwoIntroDuration: 0, mewtwoRevert: 0,
                lugiaIntro: 0, lugiaIntroDuration: 0,
                hoohIntro: 0, hoohIntroDuration: 0, hoohSpecial: createHoOhSpecialState() };
            this._trainerMegaAnnounced = false;
            this.blockTrainerShot = this.blockTrainerShot.bind(this);
            this.capture = new CaptureSystem(BALL, CATCH);
            this.captureSfx = new CaptureSfx(cc, this.node);
            this.combatSfx = new CombatSfx(cc, this.node);
            this.evolutionSfx = new EvolutionSfx(cc, this.node);
            this.music = new MusicManager(cc, this.node);
            // The ball system knows nothing about rings and toasts: it reports outcomes, this file
            // decides what each one looks like.
            this.capture.onEvent = (kind, x, y, gold, shiny, famIdx, tier) => {
                const species = famIdx >= 0 && FAMILIES[famIdx] ? FAMILIES[famIdx].id : null;
                this.logEvent('capture.ball-result', { kind, x: Math.round(x), y: Math.round(y), gold: !!gold, shiny: !!shiny, species });
                if (kind === EV_HIT) this.captureSfx.play('shake', 0.72, 220);
                else if (kind === EV_BOSS) this.captureSfx.play('hit', 0.42, 180);
                else if (kind === EV_POP && species) this.captureSfx.playCry(iconKey(species, tier));
                this.catchFx(kind, x, y, gold, shiny);
            };
            this.combat = new CombatSystem(ENEMY, PLAYER);
            this.skills = new SkillSystem();
            this.input = new Input(cc, VIEW, CATCH);
            this.input.bindAction('mega-skill', cc.KeyCode.KEY_X);
            this.input.bindAction('z-power', cc.KeyCode.KEY_Z);
            this.input.bindAction('z-crystal-select', cc.KeyCode.KEY_C);
            this.input.onAction = (action) => this.pressAction(action);
            this.input.onKey = (code, down, event) => {
                if (!down) return;
                if (event && event.repeat && (code === cc.KeyCode.KEY_Q
                    || code === cc.KeyCode.KEY_X || code === cc.KeyCode.KEY_G)) return;
                if (event && (event.key === 'F9' || event.keyCode === 120)) {
                    if (this.playLog.download()) this.say('游玩日志已导出 · 请在浏览器下载中查看', 3);
                    return;
                }
                this.press(code);
            };
            this.input.bind();

            this.build = new Build();
            // What a card is allowed to touch: the two systems whose state lives off the Build.
            this.ctx = { chain: this.chain, player: this.player };
            this.combat.mods = this.build;

            this.acc = 0;
            this.time = 0;
            // Visual-only clock: keeps breathing while the run clock is stopped by a panel.
            this.wall = 0;
            this.shake = 0;
            this.cam = { x: 0, y: 0, z: 1 };
            this._axis = { x: 0, y: 0 };
            this.alcremieRotation = createRotationTracker();
            this.perf = { cpu: 0, fps: 60, steps: 0, live: 0, sprites: 0 };
            this.toast = { text: '', t: 0 };
            this._tail = { x: 0, y: 0 };
            this.ripples = {
                x: new Float32Array(FX_MAX),
                y: new Float32Array(FX_MAX),
                r0: new Float32Array(FX_MAX),
                r1: new Float32Array(FX_MAX),
                t: new Float32Array(FX_MAX),
                life: new Float32Array(FX_MAX),
                hue: new Uint8Array(FX_MAX),
                n: 0,
                slot: 0,
            };
            this.megaFx = Array.from({ length: MEGA_FX_MAX }, () => ({
                active: false, x: 0, y: 0, angle: 0, age: 0, duration: 0, form: null,
                hit: false, area: false, radius: 0, shape: '', width: 0, segment: null, sustain: false,
            }));
            this.megaFxSlot = 0;
            this.rillaboomFields = [];
            this.alcremieCakes = [];
            this.tailPop = 0;
            this.reset();

            // The browser harness drives ticks directly, so it needs a handle on the live game.
            window.__game = this;
            window.dispatchEvent(new Event('pokemon-survivor-game-ready'));
        }

        onDestroy () {
            this.input.unbind();
            this.playLog.destroy();
            if (this.captureSfx) this.captureSfx.destroy();
            if (this.combatSfx) this.combatSfx.destroy();
            if (this.evolutionSfx) this.evolutionSfx.destroy();
            if (this.upgradeSfx) this.upgradeSfx.destroy();
            if (this.music) this.music.destroy();
        }

        setMusicMode (mode) {
            if (this.music) this.music.setMode(mode);
        }

        logEvent (type, data = {}) {
            if (this.playLog) this.playLog.record(this.time, type, data);
        }

        setPlayerAppearance (index) {
            const count = TRAINER_SPRITES.length + 1;
            this.playerAppearance = Number.isInteger(index) && index >= 0 && index < count ? index : 0;
            const trainer = this.playerAppearance === 0 ? { file: 'lucas', name: 'Lucas' }
                : TRAINER_SPRITES[this.playerAppearance - 1];
            this.logEvent('trainer.appearance-selected', { id: trainer.file, name: trainer.name });
        }

        setStartingPokemon (familyId) {
            const starter = STARTER_BY_FAMILY.get(familyId);
            if (!starter || familyId === this.startingPokemon) return !!starter;
            this.startingPokemon = familyId;
            // The title screen runs over a paused, freshly reset game. Keep the live opening party
            // in sync with the choice so the first gameplay frame cannot flash the default Pokémon.
            if (this.time === 0 && this.stats_ && this.stats_.caught === 0 && this.chain) {
                this.chain.reset(this.player.x, this.player.y);
                this.chain.add(familyId, 1, 1);
            }
            this.logEvent('starter.selected', { family: familyId, name: starter.name });
            return true;
        }

        reset (seed = randomSeed()) {
            // A new run gets a fresh seed; passing one explicitly keeps a run exactly reproducible.
            this.runSeed = seed >>> 0;
            this.rng = makeRng(this.runSeed);
            this.worldLayout = createWorldLayout(this.runSeed);
            if (this.flora) this.flora.setWorldLayout(this.worldLayout);
            if (this.trees) this.trees.setWorldLayout(this.worldLayout);
            if (this.pond) this.pond.setWorldLayout(this.worldLayout);
            this.enemies.rng = this.rng;
            this.build.reset();
            resetRotationTracker(this.alcremieRotation);
            this.player.reset();
            this.chain.reset(0, 0);
            this.enemies.clear();
            if (this.pond) this.pond.reset();
            this.trainerBoss.reset(this.enemies);
            this.legendaryLairs.reset();
            this.legendaryAttacks.reset();
            this.legendaryMap.active = false;
            this.legendaryMap.famIdx = -1;
            this.legendaryMap.species = null;
            this.legendaryMap.mewtwoIntro = 0;
            this.legendaryMap.mewtwoIntroDuration = 0;
            this.legendaryMap.mewtwoRevert = 0;
            this.legendaryMap.lugiaIntro = 0;
            this.legendaryMap.lugiaIntroDuration = 0;
            this.legendaryMap.hoohIntro = 0;
            this.legendaryMap.hoohIntroDuration = 0;
            this.legendaryMap.hoohSpecial = createHoOhSpecialState();
            this.kingCounters = Object.create(null);
            this.kingGrants.length = 0;
            this._trainerMegaAnnounced = false;
            this.capture.reset();
            this.skills.reset();
            if (this.particleBursts) this.particleBursts.clear();
            this.acc = 0;
            this.time = 0;
            this.exp = 0;
            this.level = 1;
            this.cores = 0;
            // §7.1: the gene is the other half of a 4 阶's price, and the 3:00 BOSS is its only source.
            this.pending = 0;
            this.upgradeRevealDelay = 0;
            this.levelUp = null;
            this.panel.hide();
            this.furnace.hide();
            this.evolutionReward.hide();
            this.dynamaxSelector.hide();
            this.zCrystalSelector.hide();
            this.zMoves.reset();
            this.trainerTransition.reset();
            this.repeat = 0;
            this.want = { tap: false, hold: false, num: 0 };
            this.aimWorld = { x: 0, y: 0 };
            this.selectedMega = null;
            this.touchSkillAutoCycle = false;
            this.touchSkillAiming = false;
            this.touchSkillAimClamped = false;
            this.pendingZCast = false;
            this.dynamax = { segment: null, remaining: 0, cooldown: 0, auraTimer: 0 };
            // Which animal the current crosshair line would take if 【掷】 fired this instant. -1 is
            // "nothing", and it is drawn as loudly as a lock, because the empty answer is the one a
            // player cannot otherwise distinguish from "the button is broken".
            this.lock = -1;
            this.stats_ = { missed: 0, caught: 0, caughtShiny: 0, evolved: 0, released: 0, boss: 0, picks: [] };
            this.emptyAmmoNotified = false;
            this.bossThrowWarned = false;
            this.support = { toadTimer: 0, catShieldCooldown: 0 };
            this.evo = -1;
            // The two shortfalls behind the ready lamps, kept so the HUD can price the next fold instead
            // of going quiet until it is affordable, and so each lamp says its own name once.
            this.evoNear = null;
            this.nudged = { evo: false };
            this.ripples.n = 0;
            this.ripples.slot = 0;
            for (const fx of this.megaFx) fx.active = false;
            for (const fx of this.megaFx) fx.area = false;
            this.megaFxSlot = 0;
            this.rillaboomFields.length = 0;
            this.alcremieCakes.length = 0;
            this.tailPop = 0;
            this.cam.x = 0;
            this.cam.y = 0;
            this.cam.z = CHAIN.zoom(0);
            this.applyBuild();
            // §5.1: minute zero hands out one 1 阶幼体, because the hero can never damage anything.
            this.chain.add(this.startingPokemon, 1, 1);
            this.logEvent('run.reset', { level: this.level, party: 1, starter: this.startingPokemon, seed: this.runSeed });
        }

        /** Push the Build's numbers into the systems that cannot read the Build themselves. */
        applyBuild () {
            this.player.speedMul = this.build.speedMul;
        }

        supportTier (fam) {
            let tier = 0;
            for (const seg of this.chain.segments) if (seg.fam === fam) tier = Math.max(tier, seg.tier);
            return tier;
        }

        stepSupport (dt) {
            const toadTier = this.supportTier('toad');
            if (toadTier >= 2) {
                const interval = SUPPORT_SKILLS.toad.ammoEvery[toadTier - 1];
                this.support.toadTimer += dt;
                if (this.support.toadTimer >= interval) {
                    this.support.toadTimer -= interval;
                    this.build.balls++;
                    this.emptyAmmoNotified = false;
                    this.say(`${displayName('toad', toadTier)} · 补充 1 个精灵球`, 2.4);
                }
            } else this.support.toadTimer = 0;

            if (this.support.catShieldCooldown > 0) {
                this.support.catShieldCooldown = Math.max(0, this.support.catShieldCooldown - dt);
            }
        }

        blockTrainerShot () {
            const tier = this.supportTier('cat');
            if (tier < 2 || this.player.invuln > 0 || this.support.catShieldCooldown > 0) return false;
            this.support.catShieldCooldown = SUPPORT_SKILLS.cat.shieldEvery[tier - 1];
            this.player.invuln = SUPPORT_SKILLS.cat.invuln[tier - 1];
            this.player.hit = 0.14;
            this.say(`${displayName('cat', tier)} 替你挡下一发弹幕 · 护盾充能中`, 2.2);
            return true;
        }

        /**
         * The keys that are gameplay, not scaffolding (§7.1): 进化 folds
         * one stack into a higher 阶, and 熔炉 is where 融核 gets spent. Everything else falls through to
         * the dev handles below.
         */
        press (code) {
            const K = cc.KeyCode;
            if (this.dynamaxSelector && this.dynamaxSelector.open) {
                if (code === K.KEY_X) this.say('请先完成或关闭极巨化选择，再释放技能', 2.2);
                if (code === K.KEY_G) this.dynamaxSelector.hide();
                else if (code === K.BRACKET_LEFT) this.dynamaxSelector.turnPage(-1);
                else if (code === K.BRACKET_RIGHT) this.dynamaxSelector.turnPage(1);
                return;
            }
            if (this.zCrystalSelector && this.zCrystalSelector.open) {
                if (code === K.KEY_X) this.say('请先关闭 Z 招式选择，再释放技能', 2.2);
                if (code === K.BRACKET_LEFT) this.zCrystalSelector.turnPage(-1);
                else if (code === K.BRACKET_RIGHT) this.zCrystalSelector.turnPage(1);
                return;
            }
            // Modal number picks are consumed by update(); raw gameplay shortcuts must not leak into
            // a frozen level-up or boss reward screen.
            if (this.levelUp || this.furnace.open || (this.evolutionReward && this.evolutionReward.open)) {
                if (code === K.KEY_X) this.say('请先完成当前选择，再释放主动技能', 2.2);
                return;
            }
            if (code === K.KEY_Q) { if (!this.player.dead) this.cycleMegaSkill(); return; }
            // Resolve the cast directly from the physical key event. Deferring this through a
            // one-frame flag could be silently lost when the simulation accumulator was paused or
            // reset, leaving the HUD's always-visible X hint with no effect or feedback.
            if (code === K.KEY_X) { if (!this.player.dead) this.castMegaSkill(); return; }
            if (code === K.KEY_G) { if (!this.player.dead) this.openDynamaxSelector(); return; }
            // The kick belongs to the fold, not to the key: shaking the screen for a press that bought
            // nothing teaches the player that the two merges are luck rather than arithmetic.
            if (code === K.KEY_E) { this.interactOrEvolve(); return; }
            this.debugKey(code);
        }

        pressAction (action) {
            // Route X through the same physical-shortcut handler instead of maintaining a second
            // modal gate that could swallow the action while the HUD still reports "就绪".
            if (action === 'mega-skill') {
                this.press(cc.KeyCode.KEY_X);
                return;
            }
            if (this.zCrystalSelector && this.zCrystalSelector.open) {
                if (action === 'z-power') this.zCrystalSelector.hide();
                return;
            }
            if (this.levelUp || this.furnace.open || this.evolutionReward.open
                || this.dynamaxSelector.open || this.player.dead) return;
            if (action === 'mega-skill') {
                this.castMegaSkill();
                return;
            }
            if (action === 'z-crystal-select') {
                this.openZCrystalSelector();
                return;
            }
            if (action !== 'z-power') return;
            if (!(this.build.stacks.zPowerBand > 0)) {
                this.say('尚未获得 Z力量手环 · 升级时选择传说道具', 2.8);
                return;
            }
            if (!this.zMoves.selected) {
                this.openZCrystalSelector();
                return;
            }
            this.pendingZCast = true;
        }

        zAffinityCounts () {
            return Object.fromEntries(Z_CRYSTALS.map((crystal) => [crystal.id,
                zAffinityCount(this.chain.segments, crystal.type)]));
        }

        openZCrystalSelector () {
            if (!(this.build.stacks.zPowerBand > 0)) {
                this.say('尚未获得 Z力量手环 · 升级时选择传说道具', 2.8);
                return false;
            }
            this.zCrystalSelector.show(this.zAffinityCounts(), this.atlas.glyphs);
            this.input.blockFireUntilRelease();
            return true;
        }

        selectZCrystal (index) {
            const entry = this.zCrystalSelector.entryAt(index);
            if (!entry) return false;
            if (!entry.count) {
                this.say(`队伍里没有${entry.crystal.short}属性宝可梦 · 捕捉对应属性后才能使用`, 2.8);
                return false;
            }
            this.zMoves.select(entry.crystal.id);
            this.zCrystalSelector.hide();
            this.logEvent('z-move.crystal-selected', {
                crystal: entry.crystal.id, type: entry.crystal.type, partyCount: entry.count,
            });
            this.say(`${entry.crystal.short}纯晶已装备 · 队伍 ${entry.count} 只 · 按 Z 释放，按 C 更换`, 3);
            return true;
        }

        castZMove () {
            if (!(this.build.stacks.zPowerBand > 0)) return false;
            const crystal = Z_CRYSTALS.find((entry) => entry.id === this.zMoves.selected);
            if (!crystal) {
                this.openZCrystalSelector();
                return false;
            }
            const count = zAffinityCount(this.chain.segments, crystal.type);
            if (!count) {
                this.say(`${crystal.short}纯晶失去共鸣 · 按 C 选择队伍已有属性`, 2.8);
                this.zMoves.selected = null;
                return false;
            }
            if (this.zMoves.cooldown > 0) {
                this.say(`${crystal.move}蓄力中 · 还需 ${this.zMoves.cooldown.toFixed(1)} 秒`, 1.8);
                return false;
            }
            const launch = this.zMoves.launch(crystal.id, count, this.player, this.aimWorld,
                chainDps(this.chain) * this.build.dmg * lateDamageMultiplier(this.level)
                    * Z_POWER_BAND.damageSeconds);
            if (!launch) return false;
            const metrics = zMoveMetrics(count);
            this.particleBursts.burst('mush', launch.x, launch.y, launch.angle, `z-${crystal.id}-launch`);
            this.combatSfx.enqueue({ kind: `z-${crystal.id}-launch` });
            this.combatSfx.flush();
            this.logEvent('z-move.used', { crystal: crystal.id, type: crystal.type, partyCount: count,
                radius: Math.round(metrics.radius), damage: Math.round(this.zMoves.projectile.damage),
                x: Math.round(this.zMoves.projectile.endX), y: Math.round(this.zMoves.projectile.endY) });
            this.say(`${crystal.short}「${crystal.move}」！属性共鸣 ×${count} · 范围半径 ${Math.round(metrics.radius)} px`, 2.8);
            this.kick(0.16);
            return true;
        }

        stepZMove (dt) {
            const impact = this.zMoves.step(dt, this.enemies);
            if (!impact) return;
            const crystal = Z_CRYSTALS.find((entry) => entry.id === impact.id);
            this.particleBursts.burst('mush', impact.x, impact.y, 0, `z-${impact.id}-impact`);
            this.combatSfx.enqueue({ kind: `z-${impact.id}-impact` });
            this.combatSfx.flush();
            this.wave(impact.x, impact.y, 14, impact.radius, 0.58, crystal ? crystal.color : WAVE_GOLD);
            this.logEvent('z-move.impact', { crystal: impact.id, radius: Math.round(impact.radius),
                partyCount: impact.count, hits: impact.hits, kills: impact.kills });
            this.say(`${crystal ? crystal.short : 'Z'}技能命中 ${impact.hits} 只 · 击败 ${impact.kills} 只`, 2.1);
            this.kick(0.2);
        }

        openDynamaxSelector () {
            if (!(this.build.stacks.dynamaxBand > 0)) {
                this.say('尚未获得极巨手环 · 升级时选择传说道具', 2.8);
                return false;
            }
            if (this.dynamax.remaining > 0) {
                this.say(`极巨化强化中 · ${Math.ceil(this.dynamax.remaining)} 秒后结束`, 2);
                return false;
            }
            if (this.dynamax.cooldown > 0) {
                this.say(`极巨手环冷却中 · 还需 ${Math.ceil(this.dynamax.cooldown)} 秒`, 2);
                return false;
            }
            const entries = this.chain.segments
                .filter((seg) => canDynamax(seg, this.combatFormForSegment(seg)))
                .map((seg) => ({ seg }));
            if (!entries.length) {
                this.say('队伍里没有可极巨化的宝可梦 · MEGA / 超极巨形态不可选', 3);
                return false;
            }
            this.dynamaxSelector.show(entries, this.atlas.glyphs);
            this.input.blockFireUntilRelease();
            this.logEvent('item.dynamax-band.opened', { choices: entries.length });
            return true;
        }

        activateDynamax (index) {
            const entry = this.dynamaxSelector.entries[this.dynamaxSelector.page * 8 + index];
            const seg = entry && entry.seg;
            if (!seg || !this.chain.segments.includes(seg) || !canDynamax(seg, this.combatFormForSegment(seg))) {
                this.dynamaxSelector.hide();
                this.say('这只宝可梦当前不能极巨化', 2);
                return false;
            }
            this.dynamax.segment = seg;
            this.dynamax.remaining = DYNAMAX_BAND.duration;
            this.dynamax.cooldown = DYNAMAX_BAND.cooldown;
            this.dynamaxSelector.hide();
            const node = this.chain.headOf(this.chain.segments.indexOf(seg));
            const x = node >= 0 ? this.chain.nx[node] : this.player.x;
            const y = node >= 0 ? this.chain.ny[node] : this.player.y;
            this.particleBursts.burst(seg.fam, x, y, 0, 'dynamax-start');
            this.particleBursts.burst(seg.fam, x, y, Math.PI / 2, 'dynamax-start-pillar');
            this.wave(x, y, 14, 118, 0.62, '#ff5267');
            this.logEvent('item.dynamax-band.used', {
                species: seg.fam, tier: seg.tier, duration: DYNAMAX_BAND.duration,
                cooldown: DYNAMAX_BAND.cooldown,
            });
            this.say(`${displayName(seg.fam, seg.tier)} 极巨化！30 秒内体型与弹幕强化`, 3.4);
            this.kick(0.24);
            return true;
        }

        stepDynamaxBand (dt) {
            this.dynamax.cooldown = Math.max(0, this.dynamax.cooldown - dt);
            if (!this.dynamax.segment) return;
            const seg = this.dynamax.segment;
            if (!this.chain.segments.includes(seg) || !canDynamax(seg, this.combatFormForSegment(seg))) {
                this.dynamax.segment = null;
                this.dynamax.remaining = 0;
                return;
            }
            this.dynamax.remaining = Math.max(0, this.dynamax.remaining - dt);
            // 持续能量粒：每隔一小会在巨人化本体周围冒几粒上升的红色尘，替代平铺红色罩的观感。
            // 扩散半径跟着巨人化的体型走，小只和小人用的不是同一片尘。
            this.dynamax.auraTimer -= dt;
            if (this.dynamax.auraTimer <= 0) {
                this.dynamax.auraTimer = 0.15;
                const node = this.chain.headOf(this.chain.segments.indexOf(seg));
                const x = node >= 0 ? this.chain.nx[node] : this.player.x;
                const y = node >= 0 ? this.chain.ny[node] : this.player.y;
                const headR = CHAIN.headRadius(this.chain.bulkOf(seg));
                const spread = Math.min(72, 14 + headR * DYNAMAX_BAND.pokemonScale * 0.95);
                this.particleBursts.burst(seg.fam, x, y, 0, 'dynamax-aura', null, { posVar: spread });
            }
            if (this.dynamax.remaining === 0) {
                this.dynamax.segment = null;
                const node = this.chain.headOf(this.chain.segments.indexOf(seg));
                const x = node >= 0 ? this.chain.nx[node] : this.player.x;
                const y = node >= 0 ? this.chain.ny[node] : this.player.y;
                this.particleBursts.burst(seg.fam, x, y, 0, 'dynamax-end');
                this.say('极巨化效果结束 · 极巨手环进入冷却', 2.4);
                this.logEvent('item.dynamax-band.ended', { species: seg.fam });
            }
        }

        interactOrEvolve () {
            const p = this.player;
            if (this.legendaryMap.active) {
                this.say('神兽战斗地图 · 先击败并捕捉神兽才能离开', 2.5);
                return;
            }
            if (this.legendaryLairs.canEnter(p.x, p.y, 112)) {
                this.enterLegendaryLair();
                return;
            }
            this.evolveOne();
        }

        clearEnemiesPreservingFieldProgress () {
            const e = this.enemies;
            const saved = { wildKills: e.wildKills, bossI: e.bossI, kills: e.kills,
                captured: e.captured, dealt: e.dealt, lastElite: e.lastElite };
            e.clear();
            Object.assign(e, saved);
        }

        enterLegendaryLair () {
            if (this.trainerBoss.active || this.legendaryMap.active) return false;
            const site = this.legendaryLairs.enter(this.player.x, this.player.y, 112);
            if (!site) return false;
            const famIdx = FAMILIES.findIndex((family) => family.id === site.species);
            if (famIdx < 0) {
                this.legendaryLairs.leaveActive();
                return false;
            }
            this.clearEnemiesPreservingFieldProgress();
            const mewtwoEncounter = site.species === 'legend-mewtwo';
            const lugiaEncounter = site.species === 'legend-lugia';
            const rayquazaEncounter = site.species === 'legend-rayquaza';
            const kyogreEncounter = site.species === 'legend-kyogre';
            const hoohEncounter = site.species === 'legend-hooh';
            this.legendaryMap.active = true;
            this.legendaryMap.x = this.player.x + (mewtwoEncounter ? 170 : hoohEncounter ? 150 : 0);
            this.legendaryMap.y = this.player.y + (mewtwoEncounter ? 75 : lugiaEncounter ? 130 : kyogreEncounter ? 160
                : rayquazaEncounter ? 100 : hoohEncounter ? 55 : 0);
            this.legendaryMap.famIdx = famIdx;
            this.legendaryMap.species = site.species;
            this.legendaryMap.mewtwoIntro = mewtwoEncounter ? 3.6 : 0;
            this.legendaryMap.mewtwoIntroDuration = this.legendaryMap.mewtwoIntro;
            this.legendaryMap.mewtwoRevert = 0;
            this.legendaryMap.lugiaIntro = lugiaEncounter ? 3.7 : 0;
            this.legendaryMap.lugiaIntroDuration = this.legendaryMap.lugiaIntro;
            this.legendaryMap.hoohIntro = hoohEncounter ? 2.4 : 0;
            this.legendaryMap.hoohIntroDuration = this.legendaryMap.hoohIntro;
            this.legendaryMap.hoohSpecial = createHoOhSpecialState();
            this.capture.clearInFlight();
            this.skills.reset();
            this.build.balls += 5;
            const bossX = mewtwoEncounter ? this.legendaryMap.x + 260
                : lugiaEncounter || hoohEncounter ? this.legendaryMap.x : rayquazaEncounter ? this.legendaryMap.x + 64
                    : kyogreEncounter ? this.legendaryMap.x : this.player.x + 250;
            const bossY = mewtwoEncounter ? this.legendaryMap.y + 100
                    : lugiaEncounter ? this.legendaryMap.y + 150
                    : rayquazaEncounter ? this.legendaryMap.y + 110
                        : hoohEncounter ? this.legendaryMap.y + 40
                    : kyogreEncounter ? this.legendaryMap.y + 140
                    : this.player.y + 24;
            const boss = this.enemies.spawn(bossX, bossY,
                famIdx, 1, false, this.time / 60, 1, -1, BOSS.party.length, BOSS.hpMul, true);
            const hpScale = 12 + Math.min(12, site.number * 1.4);
            this.enemies.maxhp[boss] *= hpScale;
            this.enemies.hp[boss] = this.enemies.maxhp[boss];
            this.enemies.r[boss] *= 1.65;
            if (mewtwoEncounter) {
                this.enemies.intro[boss] = 1;
                if (this.evolutionSfx) this.evolutionSfx.play('charge');
            }
            if (lugiaEncounter) this.enemies.intro[boss] = 1;
            if (hoohEncounter) this.enemies.intro[boss] = 1;
            this.legendaryAttacks.start(rayquazaEncounter ? this.legendaryMap.x : this.enemies.x[boss],
                rayquazaEncounter ? this.legendaryMap.y : this.enemies.y[boss], site.species);
            if (!mewtwoEncounter && !lugiaEncounter && !hoohEncounter) {
                this.particleBursts.burst(site.species, this.enemies.x[boss], this.enemies.y[boss],
                    -Math.PI / 2, 'legendary-lair-entry');
            }
            if (site.species === 'legend-rayquaza') {
                this.combatSfx.enqueue({ kind: 'legendary-lair-entry', fam: site.species });
                this.combatSfx.flush();
            } else if (lugiaEncounter) {
                this.combatSfx.enqueue({ kind: 'lugia-lair-opening' });
                this.combatSfx.flush();
            }
            this.aimWorld.x = this.enemies.x[boss];
            this.aimWorld.y = this.enemies.y[boss];
            this.input.blockFireUntilRelease();
            this.logEvent('legendary-lair.entered', { site: site.number, species: site.species,
                x: Math.round(site.x), y: Math.round(site.y), hp: Math.round(this.enemies.maxhp[boss]) });
            this.wave(this.player.x, this.player.y, 18, 260, 0.85, WAVE_GOLD);
            this.kick(0.35);
            this.say(mewtwoEncounter
                ? '超梦从四面八方汇聚能量 · MEGA进化即将开始'
                : lugiaEncounter ? '海水翻涌 · 洛奇亚正在从瀑布中现身'
                    : hoohEncounter ? '云海翻涌 · 凤王自高空飞降'
                        : `进入${site.name}的神兽出没地！击败神兽后投球收服 · 已补充 5 球`, 5);
            return true;
        }

        stepMewtwoLairFx (dt) {
            const map = this.legendaryMap;
            if (map.lugiaIntro > 0) {
                map.lugiaIntro = Math.max(0, map.lugiaIntro - dt);
                if (map.lugiaIntro === 0 && map.active && map.species === 'legend-lugia') {
                    for (let i = 0; i < this.enemies.n; i++) {
                        if (this.enemies.legendary[i] && this.enemies.fam[i] === map.famIdx) {
                            this.enemies.intro[i] = 0;
                            this.particleBursts.burst('legend-lugia', this.enemies.x[i], this.enemies.y[i],
                                -Math.PI / 2, 'legendary-attack-impact');
                            this.wave(this.enemies.x[i], this.enemies.y[i], 26, 186, 0.72, '#9df7ff');
                            break;
                        }
                    }
                    this.kick(0.2);
                    this.say('洛奇亚从海瀑中现身！战斗开始', 3.4);
                }
            }
            if (map.mewtwoIntro > 0) {
                map.mewtwoIntro = Math.max(0, map.mewtwoIntro - dt);
                if (map.mewtwoIntro === 0) {
                    for (let i = 0; i < this.enemies.n; i++) {
                        if (this.enemies.legendary[i] && this.enemies.fam[i] === map.famIdx) {
                            this.enemies.intro[i] = 0;
                            this.particleBursts.burst('legend-mewtwo', this.enemies.x[i], this.enemies.y[i],
                                0, 'legendary-attack-impact');
                            this.wave(this.enemies.x[i], this.enemies.y[i], 24, 142, 0.62, '#d7a8ff');
                            break;
                        }
                    }
                    if (this.evolutionSfx) {
                        this.evolutionSfx.play('burst');
                        this.evolutionSfx.play('reveal');
                    }
                    this.kick(0.32);
                    this.say('MEGA超梦Y现身！战斗开始', 3.4);
                }
            }
            if (map.hoohIntro > 0) {
                map.hoohIntro = Math.max(0, map.hoohIntro - dt);
                if (map.hoohIntro === 0 && map.active && map.species === 'legend-hooh') {
                    for (let i = 0; i < this.enemies.n; i++) {
                        if (this.enemies.legendary[i] && this.enemies.fam[i] === map.famIdx) {
                            this.enemies.intro[i] = 0;
                            this.particleBursts.burst('legend-hooh', this.enemies.x[i], this.enemies.y[i],
                                -Math.PI / 2, 'legendary-attack-impact');
                            this.wave(this.enemies.x[i], this.enemies.y[i], 24, 164, 0.68, '#ffd36a');
                            break;
                        }
                    }
                    this.kick(0.24);
                    this.say('凤王穿过云海降临！战斗开始', 3.4);
                }
            }
            if (map.mewtwoRevert > 0) map.mewtwoRevert = Math.max(0, map.mewtwoRevert - dt);
        }

        finishLegendaryLair (site) {
            this.legendaryLairs.completeActive();
            this.legendaryMap.active = false;
            this.legendaryMap.famIdx = -1;
            this.legendaryMap.species = null;
            this.legendaryMap.mewtwoIntro = 0;
            this.legendaryMap.mewtwoIntroDuration = 0;
            this.legendaryMap.mewtwoRevert = 0;
            this.legendaryMap.lugiaIntro = 0;
            this.legendaryMap.lugiaIntroDuration = 0;
            this.legendaryMap.hoohIntro = 0;
            this.legendaryMap.hoohIntroDuration = 0;
            this.legendaryMap.hoohSpecial = createHoOhSpecialState();
            this.legendaryAttacks.reset();
            this.clearEnemiesPreservingFieldProgress();
            this.capture.clearInFlight();
            this.skills.reset();
            this.input.blockFireUntilRelease();
            this.logEvent('legendary-lair.completed', { site: site && site.number,
                species: site && site.species });
            this.wave(this.player.x, this.player.y, 16, 240, 0.8, WAVE_GOLD);
            this.say(`${site ? site.name : '神兽地点'}探索完成 · 野外指引已更新`, 4);
            this.kick(0.34);
        }

        unlockLegendaryLair () {
            const added = this.legendaryLairs.unlockForBossCount(this.stats_.boss,
                this.player.x, this.player.y, this.rng);
            for (const site of added) {
                this.logEvent('legendary-lair.unlocked', { site: site.number, species: site.species,
                    x: Math.round(site.x), y: Math.round(site.y) });
                this.say(`第 ${site.number} 个神兽出没地已发现 · 跟随野外金色箭头前往${site.name}`, 5);
            }
            return added;
        }

        megaSkillUsers () {
            return this.chain.segments.filter((seg) => this.combatFormForSegment(seg));
        }

        combatFormForSegment (seg) {
            return megaFormForSegment(seg) || gigantamaxFormForSegment(seg)
                || (seg && seg.fam === HO_OH_SKILL_FORM.fam ? HO_OH_SKILL_FORM : null)
                || legendaryActiveFormForSegment(seg)
                || rosterActiveFormForSegment(seg);
        }

        activeSkillForForm (form) {
            return resolveActiveSkillForForm(form);
        }

        skillOrigin (seg) {
            const index = this.chain.segments.indexOf(seg);
            const node = index >= 0 ? this.chain.headOf(index) : -1;
            return node >= 0 ? { x: this.chain.nx[node], y: this.chain.ny[node] }
                : { x: this.player.x, y: this.player.y };
        }

        cycleMegaSkill () {
            const users = this.megaSkillUsers();
            if (!users.length) {
                this.selectedMega = null;
                this.say('队伍里还没有可切换主动技能的宝可梦 · 凤王、MEGA、超极巨或部分最终进化形态可使用', 2.8);
                return;
            }
            const index = users.indexOf(this.selectedMega);
            this.selectMegaSkill(users[(index + 1) % users.length]);
        }

        nextReadyMegaSkill (after, users = this.megaSkillUsers()) {
            if (!users.length) return null;
            const start = users.indexOf(after);
            for (let offset = 1; offset <= users.length; offset++) {
                const candidate = users[(start + offset + users.length) % users.length];
                if (candidate !== after && (candidate.megaSkillCd || 0) <= 0) return candidate;
            }
            return null;
        }

        selectMegaSkill (segment, announce = true) {
            if (!segment) return false;
            this.selectedMega = segment;
            const form = this.combatFormForSegment(segment);
            if (!form) return false;
            const skill = this.activeSkillForForm(form);
            const kind = form.rosterActive ? 'roster'
                : form.kind === 'legendary' ? 'legendary' : form.gigantamax ? 'gigantamax' : 'mega';
            this.logEvent(`${kind}.skill-selected`, { form: form.id, species: segment.fam });
            const detail = skill.shape === 'charizard-x-cross'
                ? '玩家选点 · 全屏 X 形苍焰'
                : skill.shape === 'rect-beam'
                ? `矩形水炮 ${skill.radius}×${skill.width}px · 持续 ${skill.duration}s`
                : skill.shape === 'cake-drop'
                    ? `随机生成蛋糕 · 回复 ${skill.heal} HP · ${skill.dropRadius}px 内`
                : skill.shape === 'circle-barrage'
                    ? `圆形火焰弹幕 · 半径 ${skill.radius}px · 持续 ${skill.duration}s`
                : skill.shape === 'directional-fireball'
                    ? `沿准星方向飞行 ${skill.range}px · 火球半径 ${skill.radius}px`
                : skill.shape === 'charge-channel'
                    ? `沿准星方向冲锋 · 持续 ${skill.duration}s · 自动连发`
                : skill.shape === 'healing-grove'
                    ? `草场半径 ${skill.radius}px · 持续 ${skill.duration}s · 范围内缓慢回血`
                : skill.shape === 'spore-field'
                    ? `孢子禁区半径 ${skill.radius}px · 普通野生宝可梦定身 ${skill.rootDuration}s`
                : skill.shape === 'heart-heal'
                    ? `爱心净化范围 · 命中回复 ${Math.round(skill.healPerHit * 100)}% 生命，最多 ${Math.round(skill.healCap * 100)}%`
                : skill.shape === 'dive-line'
                    ? `俯冲航道 ${skill.range}×${skill.width}px · 落点爆破半径 ${skill.radius}px`
                : skill.shape === 'charge-channel'
                    ? `自动高速冲锋 ${skill.duration}s · 鼠标实时转向 · 沿途扫掠`
                : `范围 ${skill.radius}px`;
            if (announce) this.say(`${form.name || form.megaName} · ${skill.name} · ${detail} · 按 X 释放（冷却 ${skill.cooldown}s）`, 3.2);
            return true;
        }

        cycleTouchMegaSkill () {
            if (this.touchSkillAiming || this.player.dead || this.levelUp || this.furnace.open || this.evolutionReward.open
                || this.dynamaxSelector.open || this.zCrystalSelector.open) return false;
            this.touchSkillAutoCycle = true;
            const next = this.nextReadyMegaSkill(this.selectedMega);
            if (!next) {
                const ready = this.megaSkillUsers().filter((seg) => (seg.megaSkillCd || 0) <= 0);
                this.say(ready.length ? '当前只有一个主动技能就绪' : '所有主动技能都在冷却中', 1.6);
                return false;
            }
            return this.selectMegaSkill(next);
        }

        useTouchMegaSkill () {
            if (!this.beginTouchMegaSkillAim()) return false;
            return this.endTouchMegaSkillAim(false);
        }

        beginTouchMegaSkillAim () {
            if (this.player.dead || this.levelUp || this.furnace.open || this.evolutionReward.open
                || this.dynamaxSelector.open || this.zCrystalSelector.open) return false;
            this.touchSkillAutoCycle = true;
            this.refreshTouchMegaSkill();
            if (!this.selectedMega || (this.selectedMega.megaSkillCd || 0) > 0) {
                this.say(this.megaSkillUsers().length ? '所有主动技能都在冷却中' : '队伍里还没有可用主动技能的宝可梦', 1.8);
                return false;
            }
            this.touchSkillAimClamped = false;
            this.touchSkillAiming = true;
            return true;
        }

        updateTouchMegaSkillAim (x, y) {
            if (!this.touchSkillAiming || !Number.isFinite(x) || !Number.isFinite(y)) return false;
            const form = this.combatFormForSegment(this.selectedMega);
            const skill = form && this.activeSkillForForm(form);
            const baseRange = skill && (Number(skill.range) || Number(skill.radius) * 2.5) || 420;
            const maxRange = Math.max(420, Math.min(760, baseRange));
            const dx = x - this.player.x;
            const dy = y - this.player.y;
            const distance = Math.hypot(dx, dy);
            const clamped = distance > maxRange;
            const scale = clamped ? maxRange / distance : 1;
            this.aimWorld.x = this.player.x + dx * scale;
            this.aimWorld.y = this.player.y + dy * scale;
            this.touchSkillAimClamped = clamped;
            return !clamped;
        }

        endTouchMegaSkillAim (canceled = false) {
            if (!this.touchSkillAiming) return false;
            this.touchSkillAiming = false;
            this.touchSkillAimClamped = false;
            if (canceled || this.player.dead || this.levelUp || this.furnace.open || this.evolutionReward.open
                || this.dynamaxSelector.open || this.zCrystalSelector.open) return false;
            const used = this.selectedMega;
            const cast = this.castMegaSkill();
            if (cast) {
                const next = this.nextReadyMegaSkill(used);
                if (next) this.selectMegaSkill(next, false);
            }
            return cast;
        }

        refreshTouchMegaSkill () {
            if (!this.touchSkillAutoCycle) return;
            const users = this.megaSkillUsers();
            if (!users.length) {
                this.selectedMega = null;
                return;
            }
            if (users.includes(this.selectedMega) && (this.selectedMega.megaSkillCd || 0) <= 0) return;
            const next = this.nextReadyMegaSkill(this.selectedMega, users);
            if (next) this.selectMegaSkill(next, false);
        }

        castMegaSkill () {
            const users = this.megaSkillUsers();
            if (!users.includes(this.selectedMega)) {
                this.selectedMega = null;
                if (users.length) this.say('按 Q 选择有主动技能的宝可梦，再按 X 释放技能', 2.8);
                else this.say('队伍里还没有可用主动技能的宝可梦 · 捕捉凤王或取得专属形态', 2.8);
                return false;
            }
            const seg = this.selectedMega;
            const form = this.combatFormForSegment(seg);
            const skill = this.activeSkillForForm(form);
            const remaining = Math.max(0, seg.megaSkillCd || 0);
            if (remaining > 0) {
                this.say(`${skill.name} 充能中 · 还需 ${remaining.toFixed(1)} 秒`, 1.8);
                return false;
            }

            const x = this.aimWorld.x;
            const y = this.aimWorld.y;
            const module = activeSkillModuleForForm(form);
            if (module && module.cast) {
                const cast = module.cast(this, seg, form, skill, x, y);
                if (cast) this.playCombatSkillSound(seg, form);
                return cast;
            }
            const damage = segDps(seg) * this.build.dmg * lateDamageMultiplier(this.level) * skill.power;
            const { hits, kills } = hitArea(this.enemies, x, y, skill.radius, damage);
            seg.megaSkillCd = skill.cooldown;
            const kind = form.kind === 'legendary' ? 'legendary'
                : form.gigantamax ? 'gigantamax' : 'mega';
            this.logEvent(`${kind}.skill-used`, { form: form.id, species: seg.fam, skill: skill.name,
                x: Math.round(x), y: Math.round(y), radius: skill.radius, damage: Math.round(damage), hits, kills });
            this.megaSkillFx(form, x, y, skill.radius, module?.drawEffect
                ? { shape: skill.shape, duration: skill.duration }
                : {});
            this.particleBursts.burst(seg.fam, x, y, Math.atan2(y - this.player.y, x - this.player.x),
                'mega-skill', form.id);
            this.playCombatSkillSound(seg, form);
            this.wave(x, y, 12, skill.radius, 0.68, WAVE_GOLD);
            this.kick(0.24);
            this.say(`${form.name || form.megaName} 使出「${skill.name}」· 范围 ${skill.radius}px · 命中 ${hits} 只`, 2.6);
            return true;
        }

        playCombatSkillSound (seg, form) {
            if (!this.combatSfx) return;
            const kind = form && form.id === 'blaziken' ? 'blaziken-charge'
                : form && form.id === 'charizard-x' ? 'charizard-x-skill' : 'mega-skill';
            this.combatSfx.enqueue({ kind, fam: seg && seg.fam, megaId: form && form.id });
            this.combatSfx.flush();
        }

        startMegaEvolution (seg, oldIcon) {
            if (!seg || !megaFormForSegment(seg)) return;
            seg.megaEvolutionFx = createMegaEvolutionFx(oldIcon);
            if (this.evolutionSfx) this.evolutionSfx.play('charge');
            const index = this.chain.segments.indexOf(seg);
            const node = index >= 0 ? this.chain.headOf(index) : -1;
            const x = node >= 0 && node < this.chain.nCount ? this.chain.nx[node] : this.player.x;
            const y = node >= 0 && node < this.chain.nCount ? this.chain.ny[node] : this.player.y;
            this.wave(x, y, 8, 48, 0.36, WAVE_DIM);
            this.kick(0.055);
        }

        drawMegaEvolutionFx (b, fx, x, y, scale, pack, seed) {
            const visual = megaEvolutionVisual(fx);
            if (!visual) return;
            const { progress, shell, charge, burst } = visual;
            const orb = scale * (2.2 + 0.11 * Math.max(0, pack - 1));
            const pulse = 1 + Math.sin(this.wall * 10 + seed) * 0.025;

            if (charge > 0.01) {
                const gather = 0.72 + (1 - charge) * 0.42;
                b.draw('aura', x, y, scale * 2.5 * gather, scale * 2.5 * gather,
                    0, this.pal.get('#a66be3', Math.round(90 * charge)));
                b.draw('ring', x, y, scale * (1.25 + gather * 0.42),
                    scale * (1.25 + gather * 0.42), -this.wall * 1.9,
                    this.pal.get('#e6c5ff', Math.round(190 * charge)));
                for (let spark = 0; spark < 5; spark++) {
                    const angle = this.wall * 1.8 + spark * TAU / 5 + seed;
                    const radius = scale * (1.05 + 0.3 * Math.sin(this.wall * 5 + spark));
                    b.draw('star', x + Math.cos(angle) * radius, y + Math.sin(angle) * radius,
                        0.2 + charge * 0.12, 0.2 + charge * 0.12, angle,
                        this.pal.get('#f6eaff', Math.round(225 * charge)));
                }
            }

            if (shell > 0.015) {
                b.draw('aura', x, y, orb * 1.7 * pulse, orb * 1.7 * pulse, 0,
                    this.pal.get('#ae62f3', Math.round(104 * shell)));
                // Opaque nested discs make the shell read as a closed orb and fully hide the sprite.
                b.draw('circle', x, y, orb * 1.08 * pulse, orb * 1.08 * pulse, 0,
                    this.pal.get('#35194f', Math.round(250 * shell)));
                b.draw('circle', x, y, orb * 0.94 * pulse, orb * 0.94 * pulse, 0,
                    this.pal.get('#8551b2', Math.round(248 * shell)));
                b.draw('circle', x - orb * 0.12, y + orb * 0.08, orb * 0.65 * pulse,
                    orb * 0.73 * pulse, -0.4, this.pal.get('#b584db', Math.round(74 * shell)));
                b.draw('ring', x, y, orb * 1.04 * pulse, orb * 1.04 * pulse,
                    this.wall * 0.42, this.pal.get('#f4e3ff', Math.round(235 * shell)));
                b.draw('ring', x, y, orb * 1.24 * pulse, orb * 0.78 * pulse,
                    -this.wall * 0.78, this.pal.get('#d9aeff', Math.round(135 * shell)));
                b.draw('circle', x - orb * 0.26, y + orb * 0.27, orb * 0.16, orb * 0.12,
                    -0.55, this.pal.get('#fff8ff', Math.round(165 * shell)));

                const crack = Math.max(0, Math.min(1, (progress - 0.47) / 0.18)) * (1 - burst);
                for (let shard = 0; shard < 7; shard++) {
                    const angle = shard * TAU / 7 + seed * 0.3;
                    const radius = orb * (0.24 + crack * 0.2);
                    b.draw('shard', x + Math.cos(angle) * radius, y + Math.sin(angle) * radius,
                        0.13 + crack * 0.08, 0.28 + crack * 0.08, angle,
                        this.pal.get('#f7eaff', Math.round(190 * crack * shell)));
                }
            }

            if (burst > 0.01) {
                const scatter = Math.min(1, burst);
                const fade = 1 - scatter;
                b.draw('aura', x, y, orb * (1.45 + scatter * 1.45), orb * (1.45 + scatter * 1.45), 0,
                    this.pal.get('#c181ff', Math.round(145 * fade)));
                b.draw('ring', x, y, orb * (1.05 + scatter * 1.6), orb * (1.05 + scatter * 1.6),
                    this.wall * 0.28, this.pal.get('#f5e7ff', Math.round(220 * fade)));
                for (let shard = 0; shard < 10; shard++) {
                    const angle = shard * TAU / 10 + seed * 0.71;
                    const radius = orb * (0.5 + scatter * (0.7 + (shard % 3) * 0.15));
                    b.draw('shard', x + Math.cos(angle) * radius, y + Math.sin(angle) * radius,
                        0.2 + (shard % 3) * 0.035, 0.34 + (shard % 2) * 0.06,
                        angle + this.wall * scatter * 1.4,
                        this.pal.get(shard % 3 === 0 ? '#fff5ff' : '#c98cf4', Math.round(245 * fade)));
                }
            }

            if (visual.reveal > 0.01) {
                const landing = 1 + (1 - visual.reveal) * 0.65;
                b.draw('ring', x, y, scale * 1.8 * landing, scale * 1.15 * landing,
                    0, this.pal.get('#f4ddff', Math.round(205 * (1 - visual.reveal) * 0.8)));
                b.draw('star', x, y + scale * 0.2, scale * 0.48, scale * 0.48,
                    this.wall * 0.4, this.pal.get('#fff9ff', Math.round(190 * visual.reveal)));
            }
        }

        stepMegaChannels (dt) {
            for (const seg of this.chain.segments) {
                if (!(seg.megaSkillActive > 0)) continue;
                const form = this.combatFormForSegment(seg);
                const skill = form && this.activeSkillForForm(form);
                const module = activeSkillModuleForForm(form);
                if (!skill || !module || !module.step) {
                    seg.megaSkillActive = 0;
                    continue;
                }
                module.step(this, seg, dt, form, skill);
            }
        }

        debugKey (code) {
            const K = cc.KeyCode;
            const ch = this.chain;
            // U/R are the two shortcuts the hint line advertises; everything else here is a dev
            // cheat (M once devolved a whole party on an accidental press) and needs ?debug.
            if (code === K.KEY_U) { this.gainExp(EXP(this.level)); this.kick(0.12); return; }
            if (code === K.KEY_R) { this.reset(); this.kick(0.12); return; }
            if (!SIM.debugKeys) return;
            const push = () => ch.add(FAMILIES[ch.segments.length % FAMILIES.length].id, 1, 1);
            if (code === K.BRACKET_RIGHT) push();
            else if (code === K.BRACKET_LEFT) ch.remove(ch.segments.length - 1);
            else if (code === K.KEY_T) { while (push()); }
            else if (code === K.KEY_Y) { for (const s of ch.segments) s.count = 36; }
            else if (code === K.KEY_N) { for (const s of ch.segments) s.count = 1; }
            else if (code === K.KEY_M) {
                for (const s of ch.segments) {
                    s.tier = (s.tier % 3) + 1;
                    if (!megaFormForSegment(s)) s.mega = null;
                }
            }
            else if (code === K.KEY_F) this.debugField();
            else if (code === K.KEY_B) this.debugElite();
            else if (code === K.KEY_H) { this.player.hp = this.player.maxhp; this.player.dead = false; }
            else if (code === K.KEY_L) {
                const item = LEVELS.find((entry) => entry.id === 'australianMouse');
                if (!item || !available(item, this.build, this.ctx)) {
                    this.say(this.build.stacks.australianMouse
                        ? 'DEBUG · 已拥有澳大利亚老鼠'
                        : 'DEBUG · 队伍已满，请先腾出一个位置', 2.6);
                    return;
                }
                const text = take(item, this.build, this.ctx);
                this.logEvent('debug.upgrade-granted', { id: item.id, name: item.name });
                this.refreshLinks();
                this.wave(this.player.x, this.player.y, 8, 72, 0.5);
                this.say(`DEBUG · ${text}`, 3.2);
            }
            else return;
            this.kick(0.12);
        }

        /** Start a selected boss directly from the title debug panel; normal runs never expose this path. */
        debugStartBoss (id) {
            if (!SIM.debugKeys) return false;
            const trainerMatch = /^trainer:(\d+)$/.exec(id || '');
            const selectedFamily = FAMILIES.find((entry) => entry.id === id);
            if (trainerMatch) {
                if (!BOSS.encounters[Number(trainerMatch[1])]) return false;
            } else if (!selectedFamily || (!LEGENDARY_BOSSES.includes(selectedFamily)
                && !WILD_BOSSES.includes(selectedFamily))) return false;
            const p = this.player;
            this.clearEnemiesPreservingFieldProgress();
            this.trainerBoss.reset(this.enemies);
            this.legendaryLairs.reset();
            this.legendaryAttacks.reset();
            this.legendaryMap.active = false;
            this.legendaryMap.famIdx = -1;
            this.legendaryMap.species = null;
            this.legendaryMap.mewtwoIntro = 0;
            this.legendaryMap.mewtwoIntroDuration = 0;
            this.legendaryMap.mewtwoRevert = 0;
            this.legendaryMap.lugiaIntro = 0;
            this.legendaryMap.lugiaIntroDuration = 0;
            this.legendaryMap.hoohIntro = 0;
            this.legendaryMap.hoohIntroDuration = 0;
            this.legendaryMap.hoohSpecial = createHoOhSpecialState();
            this.player.hp = this.player.maxhp;
            this.player.dead = false;

            if (trainerMatch) {
                const encounterIndex = Number(trainerMatch[1]);
                this.trainerBoss.start(this.enemies, p.x, p.y, this.time / 60, this.cam.z, encounterIndex);
                this.setMusicMode('trainer');
                this._trainerMegaAnnounced = false;
                const trainerName = this.trainerBoss.encounter.name;
                const team = this.trainerBoss.party.map((member) => displayName(member.fam, member.tier));
                this.trainerTransition.play(trainerName, team.join('、'));
                this.say(`DEBUG · ${trainerName} BOSS 战`, 4);
                this.kick(0.18);
            } else {
                const familyIndex = FAMILIES.indexOf(selectedFamily);
                const bossFamily = selectedFamily;
                if (LEGENDARY_BOSSES.includes(bossFamily)) {
                    const site = { id: 'debug-legendary-lair', number: 1, species: bossFamily.id,
                        name: bossFamily.name, x: p.x, y: p.y, complete: false };
                    this.legendaryLairs.sites.push(site);
                    if (!this.enterLegendaryLair()) return false;
                    this.setMusicMode('legendary');
                    this.say(`DEBUG · ${bossFamily.name} 神兽战`, 4);
                } else {
                    const index = this.enemies.spawn(p.x + 250, p.y + 24, familyIndex, 1,
                        false, this.time / 60, 0, -1, 1, 1, false, 0, true);
                    this.legendaryAttacks.start(this.enemies.x[index], this.enemies.y[index], bossFamily.id,
                        { wildBoss: true });
                    this.setMusicMode('legendary');
                    this.say(`DEBUG · 野外强敌「${bossFamily.name}」`, 4);
                }
                this.kick(0.16);
            }
            this.input.blockFireUntilRelease();
            this.logEvent('debug.boss-started', { id });
            return true;
        }

        /**
         * A ring of live mobs at graded distances: the 【掷】 test. One glance answers "这一发够得着吗、
         * 走廊压住谁了", which is the question the whole v0.3 兽魂 layer never managed to make visible.
         */
        debugField () {
            const p = this.player;
            const minute = this.time / 60;
            for (let i = 0; i < FAMILIES.length; i++) {
                const a = (i / FAMILIES.length) * TAU - 0.5;
                const r = 90 + i * 46;
                this.enemies.spawn(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, i, 1 + (i % 2), 0, minute);
            }
            this.say('靶子已摆开 · 准星压住的那只就是下一只');
        }

        debugElite () {
            this.enemies.spawn(this.player.x + 120, this.player.y, 4, 2, true, this.time / 60);
        }

        /** §9.3: trauma lives in the visual layer only, never in simulated coordinates. */
        kick (amount) {
            this.shake = Math.min(0.6, this.shake + amount);
        }

        /** Keep the bounded transient pool from recycling an active channel's persistent FX slot. */
        nextMegaFx () {
            for (let i = 0; i < MEGA_FX_MAX; i++) {
                const fx = this.megaFx[this.megaFxSlot];
                this.megaFxSlot = (this.megaFxSlot + 1) % MEGA_FX_MAX;
                if (!fx.active || !fx.sustain) return fx;
            }
            return null;
        }

        /** Bounded renderer-only accents for Mega launch and impact; no projectile or damage state. */
        megaBurstFx (event) {
            if (event.kind !== 'mega' && event.kind !== 'mega-hit') return;
            const fx = this.nextMegaFx();
            if (!fx) return;
            fx.active = true;
            fx.x = event.x;
            fx.y = event.y;
            fx.angle = event.angle || 0;
            fx.age = 0;
            fx.duration = event.kind === 'mega' ? 0.52 : 0.34;
            fx.form = MEGA_BY_ID[event.megaId] || null;
            fx.hit = event.kind === 'mega-hit';
            fx.area = false;
            fx.radius = 0;
            fx.shape = '';
            fx.width = 0;
            fx.layout = null;
            fx.segment = null;
            fx.sourceSegment = null;
            fx.sustain = false;
            if (!fx.hit) this.kick(0.045);
        }

        megaSkillFx (form, x, y, radius, options = {}) {
            const fx = this.nextMegaFx();
            if (!fx) return null;
            fx.active = true;
            fx.x = x;
            fx.y = y;
            fx.angle = options.angle ?? Math.atan2(y - this.player.y, x - this.player.x);
            fx.age = 0;
            fx.duration = options.duration || 0.82;
            fx.form = form;
            fx.hit = false;
            fx.area = true;
            fx.radius = radius;
            fx.shape = options.shape || '';
            fx.width = options.width || 0;
            fx.layout = options.layout || null;
            fx.segment = options.segment || null;
            fx.sourceSegment = options.sourceSegment || null;
            fx.sustain = !!options.segment;
            return fx;
        }

        drawMegaSkillPreview (g) {
            if (!this.megaSkillUsers().includes(this.selectedMega)) return;
            const form = this.combatFormForSegment(this.selectedMega);
            const skill = this.activeSkillForForm(form);
            if (!skill || this.player.dead) return;
            const ready = (this.selectedMega.megaSkillCd || 0) <= 0;
            const pulse = 0.5 + 0.5 * Math.sin(this.wall * 3.5);
            const alpha = ready ? Math.round(108 + pulse * 48) : 58;
            const module = activeSkillModuleForForm(form);
            this.drawTouchSkillAim(g, pulse, true);
            if (module && module.drawPreview) {
                module.drawPreview(this, g, form, skill, ready, pulse);
                this.drawTouchSkillAim(g, pulse, false);
                return;
            }
            g.fillColor = this.pal.get(form.color, Math.round(alpha * 0.16));
            g.circle(this.aimWorld.x, this.aimWorld.y, skill.radius);
            g.fill();
            g.strokeColor = this.pal.get(form.color, alpha);
            g.lineWidth = ready ? 3.5 : 2.5;
            g.circle(this.aimWorld.x, this.aimWorld.y, skill.radius);
            g.stroke();
            // A short radius spoke and four edge ticks turn the translucent circle into a clear
            // targeting footprint, rather than an easily missed decorative outline.
            if (!this.touchSkillAiming) {
                const dx = this.aimWorld.x - this.player.x;
                const dy = this.aimWorld.y - this.player.y;
                const length = Math.hypot(dx, dy) || 1;
                const ux = dx / length;
                const uy = dy / length;
                g.strokeColor = this.pal.get(form.color, ready ? 205 : 115);
                g.lineWidth = 2;
                g.moveTo(this.aimWorld.x, this.aimWorld.y);
                g.lineTo(this.aimWorld.x - ux * skill.radius, this.aimWorld.y - uy * skill.radius);
                g.stroke();
            }
            for (let i = 0; i < 4; i++) {
                const a = i * Math.PI / 2;
                const tx = Math.cos(a);
                const ty = Math.sin(a);
                g.moveTo(this.aimWorld.x + tx * (skill.radius - 8),
                    this.aimWorld.y + ty * (skill.radius - 8));
                g.lineTo(this.aimWorld.x + tx * (skill.radius + 2),
                    this.aimWorld.y + ty * (skill.radius + 2));
            }
            g.stroke();
            g.fillColor = this.pal.get(form.color, ready ? 240 : 150);
            g.circle(this.aimWorld.x, this.aimWorld.y, 5 + pulse * 2);
            g.fill();
            this.drawTouchSkillAim(g, pulse, false);
        }

        drawTouchSkillAim (g, pulse, guide) {
            if (!this.touchSkillAiming) return;
            const color = this.touchSkillAimClamped ? '#ff776f' : '#fff1b8';
            const x = this.aimWorld.x;
            const y = this.aimWorld.y;
            if (guide) {
                g.strokeColor = this.pal.get(color, 180);
                g.lineWidth = 4;
                g.moveTo(this.player.x, this.player.y);
                g.lineTo(x, y);
                g.stroke();
            }
            const radius = 13 + pulse * 3;
            g.strokeColor = this.pal.get('#382b43', 235);
            g.lineWidth = 7;
            g.circle(x, y, radius + 2);
            g.stroke();
            g.strokeColor = this.pal.get(color, 255);
            g.lineWidth = 3.5;
            g.circle(x, y, radius);
            g.stroke();
            g.fillColor = this.pal.get(color, 245);
            g.circle(x, y, 3.5);
            g.fill();
        }

        /**
         * One expanding ring, fired off the simulated frame so it freezes with the world. Every catch,
         * every whiff and every landing is the same three numbers - where, how far, how long - because
         * 【掷】 has no sound and no art yet, so the ripple *is* the feedback.
         */
        wave (x, y, r0, r1, life, hue = WAVE_ACCENT) {
            const w = this.ripples;
            const i = w.slot;
            w.slot = (w.slot + 1) % FX_MAX;
            if (w.n < FX_MAX) w.n++;
            w.x[i] = x;
            w.y[i] = y;
            w.r0[i] = r0;
            w.r1[i] = r1;
            w.t[i] = 0;
            w.life[i] = life;
            w.hue[i] = hue;
        }

        stepWaves (dt) {
            const w = this.ripples;
            for (let i = 0; i < w.n; i++) {
                if (w.life[i] <= 0) continue;
                w.t[i] += dt;
                if (w.t[i] >= w.life[i]) w.life[i] = 0;
            }
            this.tailPop = Math.max(0, this.tailPop - dt * 4.5);
        }

        /**
         * The missing punctuation on §7.1's three folds. Until now a 段内进化 / 晋升 / 铸造 changed a body
         * the player paid for and the *act* was invisible: the node simply redrew at its new size on the
         * next frame, so the only evidence was one line of toast. This sets a renderer-owned timer on the
         * segment that `drawEntities` turns into a stretch-overshoot-settle on the pack plus an expanding
         * ring on each 节圆 it owns.
         *
         * No seats move: `ox/oy` stay untouched and the hitbox keeps reading `headRadius`, so §9.4's law
         * (动画只做原地踏步，位移由节点坐标负责) still holds - which is also why this cannot perturb a verdict,
         * and the five-seed table in §9.16 is byte-identical for that reason.
         */
        foldFx (seg, kind) {
            if (!seg) return;
            const v = FORM_FX[kind];
            seg.fx = 1;
            seg.fxv = v;
            this.kick(v.kick);
        }

        /**
         * The two feedback clocks that must keep running when the world does not, decayed in one place.
         * Deliberately on the *frame* clock rather than inside `step`: a 熔炉 fold happens while the world
         * is stopped, and a squash that only decayed with the simulation would sit frozen on the new body
         * for as long as the player keeps the panel open - exaggeration that never returns to rest stops
         * being feedback and becomes the look. `shake` is the same failure in a louder form: the offset is
         * re-rolled from `Math.random` every rendered frame (see `update`), so a `kick` that lands on a
         * paused frame used to leave the panel buzzing at a constant amplitude until it was closed - which
         * is reachable from the field by any kick near a level-up, and became reachable from the 熔炉 the
         * day a fold there got its own `kick`. Decaying it by real `dt` also fixes a smaller lie: at 30 fps
         * a step-clock decay is half speed, and juice is timed in seconds, not in steps.
         */
        stepFrameFx (dt) {
            for (const s of this.chain.segments) {
                if (s.fx > 0) s.fx = Math.max(0, s.fx - dt * FOLD_DECAY);
                if (s.legendaryCatchFx > 0) s.legendaryCatchFx = Math.max(0, s.legendaryCatchFx - dt * 2.5);
                if (s.megaEvolutionFx) {
                    const transition = s.megaEvolutionFx;
                    const { cues, done } = stepMegaEvolutionFx(transition, dt);
                    const form = megaFormForSegment(s);
                    const index = this.chain.segments.indexOf(s);
                    const node = index >= 0 ? this.chain.headOf(index) : -1;
                    const x = node >= 0 && node < this.chain.nCount ? this.chain.nx[node] : this.player.x;
                    const y = node >= 0 && node < this.chain.nCount ? this.chain.ny[node] : this.player.y;
                    for (const cue of cues) {
                        if (cue === 'burst') {
                            if (this.evolutionSfx) this.evolutionSfx.play('burst');
                            if (form) this.particleBursts.burst(s.fam, x, y, 0, 'mega', form.id);
                            this.wave(x, y, 24, 154, 0.46, WAVE_DIM);
                            this.kick(0.22);
                        } else if (cue === 'reveal') {
                            if (this.evolutionSfx) this.evolutionSfx.play('reveal');
                            this.wave(x, y, 10, 76, 0.38, WAVE_GOLD);
                        }
                    }
                    if (done) s.megaEvolutionFx = null;
                }
                if (s.evolutionFx) {
                    const transition = s.evolutionFx;
                    const { cues, done } = stepEvolutionFx(transition, dt);
                    const index = this.chain.segments.indexOf(s);
                    const node = index >= 0 ? this.chain.headOf(index) : -1;
                    const x = node >= 0 && node < this.chain.nCount ? this.chain.nx[node] : this.player.x;
                    const y = node >= 0 && node < this.chain.nCount ? this.chain.ny[node] : this.player.y;
                    for (const cue of cues) {
                        if (cue === 'morph') {
                            this.particleBursts.burst(s.fam, x, y, Math.PI / 2, 'evolve');
                            this.wave(x, y, 10, 88, 0.42, WAVE_ACCENT);
                            this.kick(0.13);
                        } else if (cue === 'landing') {
                            this.wave(x, y, 12, 76, 0.36, WAVE_GOLD);
                            this.kick(0.1);
                        }
                    }
                    if (done) s.evolutionFx = null;
                }
                const entry = s.gigaEntry;
                if (!entry) continue;
                const previous = entry.elapsed;
                entry.elapsed = Math.min(1.16, previous + dt);
                if (!entry.impactDone && previous < 0.82 && entry.elapsed >= 0.82) {
                    entry.impactDone = true;
                    const index = this.chain.segments.indexOf(s);
                    const node = index >= 0 ? this.chain.headOf(index) : -1;
                    const x = node >= 0 && node < this.chain.nCount ? this.chain.nx[node] : this.player.x;
                    const y = node >= 0 && node < this.chain.nCount ? this.chain.ny[node] : this.player.y;
                    this.particleBursts.burst(s.fam, x, y, Math.PI / 2, 'gmax-entry-dust', s.gigantamax);
                    this.particleBursts.burst(s.fam, x, y, Math.PI / 2, 'gmax-entry-clods', s.gigantamax);
                    this.wave(x, y, 18, 142, 0.56, WAVE_DIM);
                    this.kick(0.32);
                }
                if (entry.elapsed >= 1.16) s.gigaEntry = null;
            }
            for (const fx of this.megaFx) {
                if (!fx.active) continue;
                if (fx.sustain) {
                    const active = fx.segment && fx.segment.megaSkillActive;
                    if (!(active > 0)) { fx.active = false; continue; }
                    const origin = this.skillOrigin(fx.segment);
                    fx.x = origin.x;
                    fx.y = origin.y;
                    fx.angle = fx.segment.megaSkillAngle;
                    fx.age = Math.max(0, fx.duration - active);
                    continue;
                }
                fx.age += dt;
                if (fx.age >= fx.duration) fx.active = false;
            }
            if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * SHAKE_DECAY);
        }

        /**
         * What the reticle is currently pointed at, in words. The corridor already says it in shapes,
         * but a player watching the horde rather than the cursor needs the same answer somewhere else.
         */
        lockText () {
            const i = this.lock;
            if (i < 0) return '准星无目标';
            const e = this.enemies;
            // Before the name lookup: a boss's `fam` is just whatever glyph it borrows, so reading a
            // pet's name off it would tell the player this thing can join the chain.
            if (e.wildBoss[i]) {
                const name = FAMILIES[e.fam[i]].name;
                return e.wildBossReady[i] ? `野生强敌 ${name}已被击败 · 投球即可收服`
                    : `野生强敌 ${name} · 专属招式预警后发动，可主动躲避`;
            }
            if (e.boss[i] === 1) return `${BOSS.name} 不可捕捉 · 击败后可选进化奖励`;
            const fam = FAMILIES[e.fam[i]].id;
            const name = `${displayName(fam, e.tier[i])} ${dexText(fam, e.tier[i])} ${typeText(fam, e.tier[i])}`;
            if (e.shiny[i]) return `✨ 闪光${name} · 队伍攻击无效 · 捕捉球命中即可收服`;
            const kind = this.classify(e.fam[i], e.tier[i], false);
            return `${name} · ${kind === 'stack' ? '会叠加同族数量'
                : kind === 'top-stack' ? '最终形态吸收后会变大'
                : kind === 'family-stack' ? '满队时会计入同家族进化线'
                    : kind === 'new' ? '会加入队伍' : '队伍已满'}`;
        }

        /** `secs` is for the messages that are sentences rather than flashes - a shortfall a player has
         *  to act on with his next throw cannot be readable in one second and a half. */
        say (text, secs) {
            this.toast.text = text;
            this.toast.t = secs || 1.6;
        }

        /** §6.2 readability: gold folds into a live stack, white opens a segment, grey means no room. */
        classify (famIdx, tier, shiny = false) {
            const fam = FAMILIES[famIdx].id;
            let familyMatch = false;
            let finalMatch = false;
            for (const s of this.chain.segments) {
                if (s.fam !== fam || !!s.shiny !== !!shiny) continue;
                if (s.tier === tier) return lineTop(fam, s.tier) ? 'top-stack' : 'stack';
                familyMatch = true;
                if (lineTop(fam, s.tier)) finalMatch = true;
            }
            if (finalMatch) return 'top-stack';
            if (!shiny && this.chain.normalSegmentCount >= this.chain.cap) {
                const shinyFamilyMatch = this.chain.segments.some(s => s.fam === fam && s.shiny);
                return familyMatch || shinyFamilyMatch ? 'family-stack' : 'full';
            }
            return 'new';
        }

        gainExp (amount) {
            this.exp += amount * this.build.expMul;
            let guard = 0;
            while (this.exp >= EXP(this.level) && guard++ < 20) {
                this.exp -= EXP(this.level);
                this.level++;
                this.build.balls += BALL.levelAmmo;
                this.emptyAmmoNotified = false;
                // Every level grants a fixed supply of balls; this automatic refill is separate from
                // throw-stat upgrade cards. The heal remains the other free level-up reward.
                if (this.pending === 0) this.upgradeRevealDelay = UPGRADE_REVEAL_DELAY;
                this.pending++;
                // EXP still pays out on the fatal frame (the last kill batch drains before the bite
                // lands), but a level must not top a corpse back up: the death readout would show HP
                // it does not have.
                if (!this.player.dead) {
                    this.player.hp = Math.min(this.player.maxhp, this.player.hp + this.player.maxhp * PLAYER.levelHeal);
                }
                this.kick(0.1);
            }
        }

        /**
         * §4: the level-up is a decision, so the world stops for it - the run clock, the in-flight
         * balls and the horde all freeze on the same frame. Two queued levels fan out twice rather than
         * collapsing into one pick, which is what makes an early EXP burst a good moment.
         */
        openChoice () {
            this.upgradeRevealDelay = 0;
            const opts = roll(this.build, this.ctx, this.rng);
            if (opts.length === 0) {
                this.pending = 0;
                return;
            }
            this.logEvent('upgrade.offered', {
                level: this.level,
                options: opts.map((choice) => ({ id: choice.id, name: choice.name,
                    mega: choice.megaForm || null, gigantamax: choice.gmaxForm || null,
                    species: choice.megaSegment ? choice.megaSegment.fam
                        : (choice.gmaxSegment && choice.gmaxSegment.fam),
                    tier: choice.megaSegment ? choice.megaSegment.tier
                        : (choice.gmaxSegment && choice.gmaxSegment.tier) })),
                party: this.chain.segments.map((seg) => ({ species: seg.fam, tier: seg.tier,
                    shiny: !!seg.shiny, mega: seg.mega || null, gigantamax: seg.gigantamax || null })),
            });
            this.levelUp = opts;
            this.panel.show(`Lv ${this.level} · 精灵球 +${BALL.levelAmmo} · 选一条成长（还剩 ${this.pending} 次）`, opts, this.build, this.ctx);
        }

        chooseLevel (i) {
            if (!this.levelUp || i < 0 || i >= this.levelUp.length) return false;
            return this.panel.select(i);
        }

        applyLevelChoice (i) {
            if (!this.levelUp || i < 0 || i >= this.levelUp.length) return false;
            const choice = this.levelUp[i];
            const megaTransition = choice.megaForm && choice.megaSegment
                ? {
                    segment: choice.megaSegment,
                    oldIcon: choice.megaSegment.shiny
                        ? shinyKey(iconKey(choice.megaSegment.fam, choice.megaSegment.tier))
                        : iconKey(choice.megaSegment.fam, choice.megaSegment.tier),
                } : null;
            const text = take(choice, this.build, this.ctx);
            if (megaTransition) this.startMegaEvolution(megaTransition.segment, megaTransition.oldIcon);
            this.stats_.picks.push(choice.id);
            this.logEvent('upgrade.choice', {
                id: choice.id, name: choice.name, mega: choice.megaForm || null,
                species: choice.megaSegment ? choice.megaSegment.fam
                    : (choice.gmaxSegment ? choice.gmaxSegment.fam : null),
                gigantamax: choice.gmaxForm || null,
                tier: choice.megaSegment ? choice.megaSegment.tier
                    : (choice.gmaxSegment ? choice.gmaxSegment.tier : null),
            });
            this.levelUp = null;
            this.pending--;
            this.applyBuild();
            this.say(`Lv ${this.level} ${text}`);
            this.kick(0.14);
            if (choice.id === 'rareCandy') {
                this.panel.hide();
                if (!this.openRareCandyEvolutionReward() && this.pending > 0) this.openChoice();
                return true;
            }
            if (this.pending > 0) this.openChoice();
            else this.panel.hide();
            return true;
        }

        /**
         * §5's 波次表 lives in `EnemySystem.direct`, because until now it lived in two places: here and a
         * copy in `sim-test.mjs`. Two copies is how a headless run ends up balancing a wave table the
         * shipped build stopped matching - and a BOSS the sim never meets is a BOSS nobody priced.
         */
        spawnWave (dt, minute, ring) {
            const ev = this.enemies.direct(dt, minute, this.chain.petTotal,
                this.cam.x, this.cam.y, ring, null, true, true, true, this.build.spawnRateMul);
            if (ev === 'outbreak') {
                const family = FAMILIES[this.enemies.outbreakFamIdx];
                this.logEvent('wild.mass-outbreak', {
                    family: family.id, count: this.enemies.outbreakCount, tier: this.enemies.outbreakTier,
                });
                this.say(`大量出现！${family.name} ×${this.enemies.outbreakCount} 出现在附近！`, 4.5);
                this.wave(this.enemies.outbreakX, this.enemies.outbreakY, 6, 138, 0.62, WAVE_ACCENT);
                return;
            }
            if (ev === 'wildboss') {
                const family = FAMILIES[this.enemies.lastWildBossFam];
                if (family) {
                    const index = this.enemies.n - 1;
                    this.legendaryAttacks.start(this.enemies.x[index], this.enemies.y[index], family.id,
                        { wildBoss: true });
                    this.logEvent('wild-boss.spawn', { species: family.id, name: family.name,
                        x: this.enemies.x[index], y: this.enemies.y[index] });
                    this.say(`野生强敌「${family.name}」出现！它将释放专属招式，可以躲避攻击或将其击败后收服。`, 5);
                    this.kick(0.12);
                }
                return;
            }
            if (ev !== 'boss') return;
            const encounterIndex = this.enemies.bossI - 1;
            this.trainerBoss.start(this.enemies, this.player.x, this.player.y, minute, this.cam.z, encounterIndex);
            this.setMusicMode('trainer');
            this._trainerMegaAnnounced = false;
            const trainerName = this.trainerBoss.encounter.name;
            const team = this.trainerBoss.party.map((p) => displayName(p.fam, p.tier));
            this.logEvent('boss.spawn', { kind: 'trainer', number: encounterIndex + 1,
                name: trainerName, party: team });
            this.trainerTransition.play(trainerName, team.join('、'));
            this.input.blockFireUntilRelease();
            this.bossThrowWarned = false;
            this.say(`${trainerName} · ${team.join('、')}列阵中，${BOSS.formationSec}秒后开战！`, 4);
            this.kick(0.18);
        }

        /**
         * One 【掷】. The ball leaves down the line to the crosshair and takes the first thing its
         * corridor touches, so the only thing the press has to decide is whether a ball came out. A
         * throw that hits nothing still costs the cooldown - that is what aiming at something is.
         */
        throwBall () {
            if (this.trainerBoss.active) {
                if (!this.bossThrowWarned) {
                    this.say('训练家对战中不能捕捉 · 移动躲避弹幕，我方精灵会自动反击', 3);
                    this.bossThrowWarned = true;
                }
                return false;
            }
            const b = this.build;
            if (b.balls <= 0) {
                if (!this.emptyAmmoNotified) {
                    this.say(`精灵球用完了 · 下次升级自动补充 +${BALL.levelAmmo}`);
                    this.emptyAmmoNotified = true;
                }
                return false;
            }
            const o = this.aim();
            if (!this.capture.throw(o.x, o.y, o.dx, o.dy,
                { range: b.range, speed: b.ballSpeed, r: b.ballR })) return false;
            this.logEvent('capture.ball-thrown', { x: Math.round(o.x), y: Math.round(o.y),
                range: Math.round(b.range), ammo: b.balls - 1, target: this.lock });
            b.balls--;
            this.captureSfx.play('throw', 0.56, 100);
            this.wave(o.x + o.dx * 6, o.y + o.dy * 6, 5, 26, 0.14, WAVE_ACCENT);
            this.kick(0.03);
            return true;
        }

        /**
         * Where a ball starts and where it goes. Shared with the reticle because the line drawn out of
         * the hero *is* the path: two origins, two truths, and the preview would start lying.
         */
        aim () {
            const a = this.player;
            let dx = this.aimWorld.x - a.x;
            let dy = this.aimWorld.y - a.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            dx /= d;
            dy /= d;
            // Out of the arm, not out of the hero's own centre, so a point-blank throw still reads as
            // having been thrown.
            return { x: a.x + dx * MUZZLE, y: a.y + dy * MUZZLE, dx, dy };
        }

        /** Protect only a live, catchable wild target; trainer and undefeated boss targets stay attackable. */
        captureGuardTarget () {
            if (this.trainerBoss.active) return -1;
            const b = this.build;
            if (b.balls <= 0 && this.capture.bn <= 0) return -1;
            const e = this.enemies;
            const o = this.aim();
            const i = this.capture.predict(o.x, o.y, o.dx, o.dy,
                { range: b.range, r: b.ballR }, e);
            if (i < 0 || e.trainer[i]) return -1;
            if (e.boss[i] && !e.wildBossReady[i] && !e.legendaryReady[i]) return -1;
            if (e.wildBoss[i] && !e.wildBossReady[i]) return -1;
            if (e.legendary[i] && !e.legendaryReady[i]) return -1;
            return i;
        }

        /**
         * What each outcome of a throw looks like. The simulation only reports which one happened.
         *
         * A catch is two beats now: the contact, then the ball opening 0.36 s later. They are deliberately
         * different shapes - a tight snap in the ball's own purple at the contact, the wider gold wave only
         * when the animal comes out - because one flourish stretched over both would read as the ball
         * hesitating rather than as a sequence. The screen kick rides the open, not the hit: the open is
         * the frame that says "yours".
         */
        catchFx (kind, x, y, gold, shiny = false) {
            if (kind === EV_HIT) {
                this.wave(x, y, shiny ? 9 : 5, shiny ? 55 : 24, shiny ? 0.42 : 0.16,
                    shiny ? SHINY_GOLD : WAVE_ACCENT);
                return;
            }
            if (kind === EV_POP) {
                this.wave(x, y, shiny ? 16 : 8, shiny ? 118 : 46, shiny ? 0.54 : 0.24,
                    shiny ? SHINY_GOLD : gold ? WAVE_GOLD : WAVE_ACCENT);
                this.kick(0.06);
                return;
            }
            if (kind === EV_BOSS) {
                // Same metal, wider ring: this one is never going to eat a ball, so the read has to be
                // "you hit iron" rather than "you were too early".
                this.wave(x, y, 6, 46, BALL.bounce, WAVE_DIM);
                this.kick(0.07);
                this.say('神兽还在战斗中 · 先击败它，虚弱后就能收服');
                return;
            }
            this.wave(x, y, 4, 18, 0.18, WAVE_DIM);
        }

        drainKills () {
            const e = this.enemies;
            // EXP is the whole payout for a kill, and a catch pays the same 1 - `enemies.capture` puts it
            // on the same counter, because a ball removes a body the tail would otherwise have killed.
            // What a catch really spends is the throw and the aim, not the level curve.
            if (e.kn > 0) this.gainExp(e.kn);
            e.kn = 0;
            // 王者之证发放：击败记账满 10 次的同种，作为 1 阶入队喂给进化线；队伍满则折算 2 EXP。
            while (this.kingGrants.length > 0) {
                const fam = this.kingGrants.shift();
                const res = this.chain.absorb(fam, 1);
                if (res === 'overflow') {
                    this.gainExp(2);
                    continue;
                }
                this.tailPop = 1;
                this.wave(this._tail.x, this._tail.y, 6, 40, 0.26, WAVE_GOLD);
                this.say(`王者之证 · 击败同种 10 次，${displayName(fam, 1)} 入队`);
                this.logEvent('pokemon.kings-rock-grant', { species: fam });
            }
        }

        /** Pay the boss reward on the death frame before the corpse is culled. */
        drainBoss () {
            const e = this.enemies;
            if (!e.bossDown) return;
            e.bossDown = 0;
            this.cores += BOSS.cores;
            this.stats_.boss++;
            this.wave(e.bossX, e.bossY, 16, 190, 0.72, WAVE_GOLD);
            this.kick(0.4);
            this.unlockLegendaryLair();
            if (e.bossLegendaryDown) {
                e.bossLegendaryDown = 0;
                const legend = FAMILIES[e.bossDownFam];
                this.logEvent('boss.defeated', { kind: 'legendary', species: legend && legend.id,
                    catchable: true, hpLeft: 0.08 });
                if (legend && legend.id === 'legend-mewtwo') {
                    this.legendaryMap.mewtwoRevert = 0.9;
                    if (this.evolutionSfx) this.evolutionSfx.play('revert');
                    this.particleBursts.burst(legend.id, e.bossX, e.bossY, Math.PI / 2,
                        'legendary-attack-impact');
                    this.wave(e.bossX, e.bossY, 24, 148, 0.6, '#dfb9ff');
                    this.kick(0.28);
                    this.say('MEGA能量消散 · 超梦恢复原形！投出精灵球即可收服', 5);
                } else {
                    this.say(`${legend ? legend.name : '神兽'}已被击败并陷入虚弱！投出精灵球即可收服`, 5);
                }
            } else {
                this.logEvent('boss.defeated', { kind: 'boss', name: BOSS.name });
                this.say(`${BOSS.name} 倒下 · 选择一只队伍宝可梦进化`);
                this.openBossEvolutionReward();
            }
        }

        drainTrainerBoss () {
            const e = this.enemies;
            if (!this.trainerBoss.finishIfDefeated(e)) return;
            this.setMusicMode(this.player.dead ? null : 'field');
            this.stats_.boss++;
            this.unlockLegendaryLair();
            this.wave(this.trainerBoss.cx, this.trainerBoss.cy, 18, 210, 0.75, WAVE_GOLD);
            this.kick(0.45);
            this.input.blockFireUntilRelease();
            this.bossThrowWarned = false;
            this.logEvent('boss.defeated', { kind: 'trainer', name: this.trainerBoss.encounter.name });
            this.say(`${this.trainerBoss.encounter.name}战败 · 选择一只队伍宝可梦进化`);
            this.openBossEvolutionReward();
        }

        /** Both boss types pay the same one-time, free next-stage evolution choice. */
        openBossEvolutionReward () {
            return this.openEvolutionReward('boss');
        }

        openRareCandyEvolutionReward () {
            return this.openEvolutionReward('rare-candy');
        }

        openEvolutionReward (source) {
            const choices = [];
            for (let i = 0; i < this.chain.segments.length; i++) {
                const seg = this.chain.segments[i];
                if (!lineTop(seg.fam, seg.tier) && !gigantamaxLocksEvolution(seg)) choices.push({ index: i, seg });
            }
            if (!choices.length) {
                // A final-stage-only roster cannot use a stage-evolution reward; do not invent a new form.
                this.say(source === 'rare-candy'
                    ? '队伍里没有可进化的精灵 · 奇异糖果已退回'
                    : '队伍里没有可进化的精灵 · 本次没有可选的进化奖励', 4);
                if (source === 'rare-candy') this.build.stacks.rareCandy = 0;
                return false;
            }
            this.evolutionReward.show(choices, this.atlas.glyphs, source);
            this.want = { tap: false, hold: false, num: 0 };
            this.input.blockFireUntilRelease();
            return true;
        }

        chooseEvolutionReward (choice) {
            const entry = this.evolutionReward.entries[this.evolutionReward.page * 8 + choice];
            if (!entry || this.chain.segments[entry.index] !== entry.seg) return false;
            const source = this.evolutionReward.source;
            const fromTier = entry.seg.tier;
            const oldIconBase = iconKey(entry.seg.fam, fromTier);
            const shinyOldIcon = entry.seg.shiny && oldIconBase ? shinyKey(oldIconBase) : null;
            const oldIcon = shinyOldIcon && this.atlas.glyphs[shinyOldIcon] ? shinyOldIcon : oldIconBase;
            const node = this.chain.headOf(entry.index);
            const x = node >= 0 ? this.chain.nx[node] : this.player.x;
            const y = node >= 0 ? this.chain.ny[node] : this.player.y;
            const result = this.chain.evolveReward(entry.index);
            if (!result) return false;
            const seg = result.seg;
            this.logEvent('pokemon.evolved', { species: seg.fam, fromTier, toTier: seg.tier,
                auto: false, source: source === 'rare-candy' ? 'rare-candy' : 'boss-reward',
                count: seg.count, mergedSegments: result.merged, shiny: !!seg.shiny });
            this.stats_.evolved++;
            if (source === 'boss') {
                seg.evolutionFx = createEvolutionFx(oldIcon, fromTier);
                this.kick(0.14);
            } else {
                this.foldFx(seg, 'evo');
                this.wave(x, y, 14, 108, 0.5, WAVE_ACCENT);
                this.particleBursts.burst(seg.fam, x, y, 0, 'evolve');
            }
            this.evolutionReward.hide();
            this.refreshLinks();
            this.say(`${source === 'rare-candy' ? '奇异糖果进化' : 'BOSS奖励进化'} · ${seg.shiny ? '✨闪光' : ''}${displayName(seg.fam, fromTier)} → ${displayName(seg.fam, seg.tier)} · 队伍数量不变`
                + (result.merged ? ` · 同阶段合并 ${result.merged} 摞` : ''), 4);
            this.kick(0.3);
            if (source === 'rare-candy') {
                if (this.pending > 0 && !this.player.dead) this.openChoice();
                else this.panel.hide();
            }
            return true;
        }

        bossEvolutionPress (w, ptr) {
            const reward = this.evolutionReward;
            if (w.pointerMoved) {
                const hit = reward.hit(ptr.x, ptr.y);
                if (hit === -2 || hit === -3) {
                    reward.setHover(-1);
                    reward.setPageHover(hit);
                } else {
                    reward.setPageHover(-1);
                    reward.setHover(hit);
                }
            }
            if (w.nav) reward.moveFocus(w.nav);
            if (w.num >= 1 && w.num <= 8) {
                reward.select(w.num - 1);
                return;
            }
            if (!w.tap) return;
            if (reward.pageHover === -2) reward.turnPage(-1);
            else if (reward.pageHover === -3) reward.turnPage(1);
            else reward.select(reward.hover);
        }

        /** Absorb what landed this step. Overflow is the doc's one trade surface, and it pays out. */
        drainLanded () {
            const list = this.capture.landed;
            let lairCatch = false;
            for (let k = 0; k < list.length; k++) {
                const rec = list[k];
                const famIdx = rec & 0xff;
                const tier = (rec >> 8) & 0xff;
                const gold = (rec >> 16) & 1;
                const shiny = (rec >> 17) & 1;
                if (this.legendaryMap.active && famIdx === this.legendaryMap.famIdx) lairCatch = true;
                this.logEvent('pokemon.caught', { species: FAMILIES[famIdx].id,
                    name: displayName(FAMILIES[famIdx].id, tier), tier, legendary: !!gold, shiny: !!shiny });
                let res = this.chain.absorb(FAMILIES[famIdx].id, tier, !!shiny);
                this.stats_.caught++;
                if (shiny) this.stats_.caughtShiny++;
                const promotions = this.chain.lastAbsorbPromotions;
                for (const promotion of promotions) {
                    const promoted = promotion.seg;
                    const index = this.chain.segments.indexOf(promoted);
                    const node = index >= 0 ? this.chain.headOf(index) : -1;
                    const px = node >= 0 ? this.chain.nx[node] : this.player.x;
                    const py = node >= 0 ? this.chain.ny[node] : this.player.y;
                    this.logEvent('pokemon.family-stage-replaced', {
                        species: promoted.fam, fromTier: promotion.fromTier, toTier: promotion.toTier,
                        count: promoted.count, shiny: !!promoted.shiny,
                    });
                    this.stats_.evolved++;
                    this.foldFx(promoted, 'evo');
                    this.wave(px, py, 12, 94, 0.46, WAVE_ACCENT);
                    this.particleBursts.burst(promoted.fam, px, py, 0, 'evolve');
                }
                if (res === 'top-stack') {
                    const top = this.chain.segments.find((s) => s.fam === FAMILIES[famIdx].id
                        && !!s.shiny === !!shiny && lineTop(s.fam, s.tier));
                    if (top) this.logEvent('pokemon.final-form-growth', { species: top.fam,
                        capturedTier: tier, finalTier: top.tier, count: top.count,
                        bulk: this.chain.bulkOf(top), visualBulk: this.chain.visualBulkOf(top), shiny: !!shiny });
                }
                if (res === 'overflow') {
                    this.stats_.missed++;
                    this.gainExp(2);
                    this.wave(this._tail.x, this._tail.y, 10, 58, 0.34, WAVE_GOLD);
                    this.say('队伍已满 · 获得 2 EXP');
                } else {
                    // The ball caught the animal somewhere out in the field and it then flew to the
                    // tail, so the tail is where it has to land: one ring out of the node plus a squash
                    // on that node itself. Without this the pet simply appears in the line and the whole
                    // verb reads as nothing happening.
                    this.tailPop = 1;
                    this.wave(this._tail.x, this._tail.y, 6, res === 'stack' ? 26 : 40, 0.26,
                        res === 'stack' ? WAVE_ACCENT : WAVE_GOLD);
                    const famId = FAMILIES[famIdx].id;
                    if (isLegendaryCompanion({ fam: famId })) {
                        const partner = this.chain.segments.find((s) => s.fam === famId);
                        if (partner) partner.legendaryCatchFx = 1;
                        this.logEvent('legendary.companion-joined', { species: famId,
                            count: partner ? partner.count : 1,
                            size: partner ? legendaryBodyScale(partner) : legendaryBodyScale({ fam: famId, count: 1 }) });
                        this.wave(this._tail.x, this._tail.y, 18, 188, 0.62, WAVE_GOLD);
                        this.particleBursts.burst(famId, this._tail.x, this._tail.y, 0, 'mega-hit');
                        this.kick(0.28);
                        this.say(`传说伙伴 ${displayName(famId, tier)} 加入队伍 · 体型与范围轰炸增强`, 4);
                    } else if (res === 'family-evolve' || promotions.length) {
                        const changed = promotions.map((promotion) =>
                            `${promotion.seg.shiny ? '✨闪光' : ''}${displayName(famId, promotion.fromTier)} → ${displayName(famId, promotion.toTier)}`
                        ).join(' · ');
                        this.say(`捕获进化形态 · ${changed || displayName(famId, tier)} · 替换原队伍形态 · 队伍位置不变`, 4);
                    }
                    else if (res === 'new') this.say(`${shiny ? '✨ 闪光' : ''}${displayName(famId, tier)} 入队`);
                    else if (res === 'top-stack') {
                        const top = this.chain.segments.find((s) => s.fam === FAMILIES[famIdx].id
                            && !!s.shiny === !!shiny && lineTop(s.fam, s.tier));
                        this.say(`${shiny ? '✨ 闪光' : ''}${displayName(FAMILIES[famIdx].id, tier)} 被最终形态吸收 · 体型变大`
                            + (top ? ` ${this.chain.bulkOf(top)}/${CHAIN.topBulk}` : ''), SAY_READ);
                    }
                    else if (res === 'family-stack') {
                        this.say(`${shiny ? '✨ 闪光' : ''}${displayName(FAMILIES[famIdx].id, tier)} 计入同家族进化线`, SAY_READ);
                    }
                }
            }
            list.length = 0;
            if (lairCatch) this.finishLegendaryLair(this.legendaryLairs.active);
            // A ball that ran out of road is the only way to lose a catch now, and it costs nothing but
            // the cooldown - §6.5-4 still holds, it just spends time instead of a decaying 兽魂.
            const gone = this.capture.whiffed;
            if (gone) {
                this.capture.whiffed = 0;
                this.stats_.missed += gone;
            }
        }

        /**
         * Current rule: automatic evolution uses the same `evolveGate` and folds as soon as a stack can pay.
         * The following comments record the older restricted policy; E remains an optional manual shortcut.
         * §7.1-4 段内进化: this line's own `Evolutions` condition, read through `evolveGate`, spends part
         * of the stack the copies already live in. Since v0.9.2 the *wasteless* half of it is automatic
         * (`CHAIN.autoEvolve` → `chain.findAuto`, called from `step`), and this function is the single path
         * both halves use, so an auto fold pays the same price, prints the same line and gets the same
         * violet ring as the one the player asked for. What stays manual is exactly what the auto path is
         * forbidden to touch: a fold that spends 融核 (the 铸造's money), a pile that has not filled its 3
         * 节圆 yet, or a division that would take a circle away (§9.15-② measured the version without those
         * limits: 5/5 seeds die at the BOSS). `sel` is the furnace's selected row, so a player with three
         * fat stacks picks which one pays; out in the field it takes the frontmost ready link, and pressing
         * again walks down the chain or 重铸s the same one, which is the 1→2→3 连锁.
         */
        evolveOne (sel, auto) {
            const ch = this.chain;
            const field = sel === undefined;
            const have = this.evolveHave();
            const at = field ? ch.findEvolve(have) : sel;
            const s = ch.segments[at];
            if (!s) {
                if (!field) {
                    this.say('先点一条链位 · 进化花的是这一段的同族', SAY_READ);
                    return false;
                }
                // Nothing on the chain is affordable right now. `near` is the frontmost link that still
                // has a step ahead of it, so the refusal names the pile and the gap in the same words the
                // 熔炉 row uses - this is the branch a player hits by pressing E too early, and until v0.9
                // it returned false without a sound, which is what "没有进化" looks like from the seat.
                const n = this.evoNear;
                this.say(n
                    ? `${displayName(n.seg.fam, n.seg.tier)} ${n.seg.tier}阶×${n.seg.count} → ${displayName(n.seg.fam, n.seg.tier + 1)} · ${n.g.why}`
                    : '队伍里没有可继续进化的宝可梦了', SAY_READ);
                return false;
            }
            const g = evolveGate(s, have);
            if (!g.ok) {
                // A locked action has to name the missing half, the same rule `forgeWhy` follows - and
                // since v0.9 the missing half can be 只数, 融核 or 携带秒数, so the gate says which. Under
                // v0.9.9's flat 3-只 price only the first of the three can ever be missing; the sentence
                // stays general because `g.why` is written by `evolveGate`, not by this call site.
                this.say(g.top
                    ? `${displayName(s.fam, s.tier)} 的图鉴线只到 ${s.tier} 阶 · 再往上只能铸`
                    : `${displayName(s.fam, s.tier)} ${s.tier}阶×${s.count} · ${g.why}`);
                return false;
            }
            const beforeCount = s.count;
            const fromTier = s.tier;
            const from = `${displayName(s.fam, s.tier)} ${s.tier}阶×${s.count}`;
            const n = ch.headOf(at);
            const qx = n >= 0 ? ch.nx[n] : this.player.x;
            const qy = n >= 0 ? ch.ny[n] : this.player.y;
            const r = ch.evolve(at, have);
            if (!r) return false;
            const evolved = r.seg;
            this.logEvent('pokemon.evolved', { species: evolved.fam, fromTier,
                toTier: evolved.tier, auto: !!auto, count: evolved.count, countBefore: beforeCount,
                mergedSegments: r.merged, shiny: !!evolved.shiny });
            this.stats_.evolved++;
            this.foldFx(evolved, auto ? 'auto' : 'evo');
            this.wave(qx, qy, 12, 88, 0.4, WAVE_ACCENT);
            this.say(`${auto ? '自动进化 · ' : ''}${evolved.shiny ? '✨闪光' : ''}${from} → ${displayName(evolved.fam, evolved.tier)} ${evolved.tier}阶×${evolved.count}`
                + ` · ${g.text}` + (r.merged ? ` · 同阶段合并 ${r.merged} 摞` : ''), 3.6);
            this.refreshLinks();
            return true;
        }

        /** The three arrangement reads, recomputed after anything splices the chain. */
        refreshLinks () {
            const ch = this.chain;
            // The 可进化 light has to be the price, not the pile: a 石头 step that cannot be paid is not
            // an available action, and a HUD lamp that lies about one trains the player to ignore it.
            const scan = ch.scanEvolve(this.evolveHave());
            this.evo = scan.ready;
            this.evoNear = scan.near;
            if (this.evo >= 0 && !this.nudged.evo) {
                this.nudged.evo = true;
                // Describe the active automatic trigger; E is optional.
                this.say(CHAIN.autoEvolve ? this.autoWaitText(true)
                    : '可进化 · 按 E · 这一摞同族够付它图鉴线的价了', SAY_READ);
            }
        }

        /**
         * Shared wording for the one-time automatic-evolution prompt and the HUD status.
         */
        autoWaitText (long) {
            const count = this.build && this.build.expShare ? 2 : 3;
            return long
                ? `自动进化已开启 · 同族满 ${count} 只立即进化`
                : ` · 同族满 ${count} 只自动进化`;
        }

        evolveHave (cores = 0) {
            return { cores, evolveNeed: this.build && this.build.expShare ? 2 : 0 };
        }

        mergeText () {
            const e = this.evo >= 0 ? '进化 E ✓'
                : (this.evoNear ? `进化 E ${this.evoNear.g.short}` : '进化 E 到图鉴头');
            // E remains an optional manual shortcut; normal evolution happens automatically.
            return ` · ${e}${CHAIN.autoEvolve ? this.autoWaitText(false) : ''}`;
        }

        /** §5.5-D: opening the 熔炉 is always the player's call, never the game's. */
        toggleFurnace () {
            if (this.levelUp || this.player.dead) return;
            if (this.furnace.open) this.furnace.hide();
            else {
                // Swallow the input that got us here: a click on the frame the panel appears must not
                // also land on a row, which is the same rule §5.6 applies to the card fan.
                this.want.tap = false;
                this.refreshLinks();
                this.furnace.show();
            }
        }

        /** Pointer and the number-key gate, both funnelling into team management's three actions. */
        furnacePress (w) {
            const f = this.furnace;
            const at = f.hit(this.input.pointer.x, this.input.pointer.y);
            f.hot = at ? at.kind : '';
            if (w.num) {
                if (w.num === 1) this.releaseSel(f.sel);
                else if (w.num === 2) this.evolveOne(f.sel);
                else f.hide();
                return;
            }
            if (!w.tap || !at) return;
            if (at.kind === 'select') f.sel = at.i;
            else if (at.kind === 'release') this.releaseSel(f.sel);
            else if (at.kind === 'evolve') this.evolveOne(f.sel);
            else f.hide();
        }

        /**
         * §5.5-D: 放生 is the game's only chosen loss, and it is the other half of the 融核 economy - which
         * is why the refund comes from `forge.js` rather than a number typed here, so the sim and the
         * panel cannot disagree about what a link is worth.
         */
        releaseSel (i) {
            // Read the seat first: `segIndex` is only rebuilt by `chain.update`, so while the furnace has
            // the world stopped this is still where the doomed link was standing.
            const at = this.chain.headOf(i);
            const ax = at >= 0 ? this.chain.nx[at] : this.player.x;
            const ay = at >= 0 ? this.chain.ny[at] : this.player.y;
            const seg = this.chain.remove(i);
            if (!seg) return;
            const back = refund(seg);
            this.gainExp(back.exp);
            this.cores += back.cores;
            this.stats_.released++;
            this.wave(ax, ay, 10, 62, 0.34, WAVE_DIM);
            this.say(`放生 ${displayName(seg.fam, seg.tier)} ${seg.tier}阶×${seg.count}`
                + ` → ${back.exp} EXP + ${back.cores} 融核`);
            this.kick(0.1);
            this.refreshLinks();
        }

        /** A Strawberry Sweet pays out exactly one Milcery after a deliberate full steering turn. */
        grantAlcremieFromRotation (announce = false) {
            const tracker = this.alcremieRotation;
            if (!tracker.pending || !this.build.stacks.alcremieSweet) return false;
            const hasNormalLine = this.chain.segments.some((seg) => seg.fam === 'alcremie' && !seg.shiny);
            if (!hasNormalLine && this.chain.normalSegmentCount >= this.chain.cap) {
                if (announce) {
                    this.logEvent('item.alcremie-sweet.pending', { reason: 'party-full' });
                    this.say('转圈完成！队伍已满 · 小仙奶奖励已暂存，腾出位置后领取', 4);
                }
                return false;
            }

            const result = this.chain.absorb('alcremie', 1, false);
            if (result === 'overflow') return false;
            tracker.pending = false;
            tracker.granted++;
            const promotion = this.chain.lastAbsorbPromotions[0];
            if (promotion) {
                this.stats_.evolved++;
                this.foldFx(promotion.seg, 'evo');
            }
            const index = this.chain.segments.findIndex((seg) => seg.fam === 'alcremie' && !seg.shiny);
            const node = index >= 0 ? this.chain.headOf(index) : -1;
            const x = node >= 0 ? this.chain.nx[node] : this.player.x;
            const y = node >= 0 ? this.chain.ny[node] : this.player.y;
            this.wave(x, y, 13, 100, 0.48, WAVE_ACCENT);
            this.particleBursts.burst('alcremie', x, y, 0, promotion ? 'evolve' : 'hit');
            this.logEvent('item.alcremie-sweet.granted', { result, tier: 1,
                count: index >= 0 ? this.chain.segments[index].count : 1,
                turns: tracker.granted, promoted: !!promotion });
            this.say(`${promotion ? '小仙奶进化' : '转圈成功'} · 小仙奶加入队伍`, 3.5);
            this.refreshLinks();
            return true;
        }

        step (dt) {
            const p = this.player;
            if (p.dead) return;
            this.stepMewtwoLairFx(dt);
            this.stepDynamaxBand(dt);
            const b = this.build;
            for (const seg of this.chain.segments) {
                if (seg.megaSkillCd > 0) seg.megaSkillCd = Math.max(0, seg.megaSkillCd - dt);
            }
            this.refreshTouchMegaSkill();
            this.input.axis(this._axis, (p.x - this.cam.x) * this.cam.z, (p.y - this.cam.y) * this.cam.z);
            const spinX = this._axis.x;
            const spinY = this._axis.y;
            let playerDrive = null;
            for (const seg of this.chain.segments) {
                if (!(seg.megaSkillActive > 0)) continue;
                const form = this.combatFormForSegment(seg);
                const skill = form && this.activeSkillForForm(form);
                const module = form && activeSkillModuleForForm(form);
                if (!skill || !module || !module.playerDrive) continue;
                playerDrive = module.playerDrive(this, seg, dt, form, skill);
                if (playerDrive) break;
            }
            if (playerDrive) {
                this._axis.x = playerDrive.x;
                this._axis.y = playerDrive.y;
            }
            const previousPosition = { x: p.x, y: p.y };
            p.update(dt, this._axis, playerDrive);
            this.trees.resolvePlayer(p, PLAYER.radius,
                !this.legendaryMap.active && !this.trainerBoss.active, previousPosition);
            this.pond.resolvePlayer(p, PLAYER.radius,
                !this.legendaryMap.active && !this.trainerBoss.active, previousPosition);
            if (b.stacks.alcremieSweet) {
                if (this.alcremieRotation.pending) this.grantAlcremieFromRotation();
                else if (!playerDrive && stepRotationTracker(this.alcremieRotation, spinX, spinY, dt)) {
                    this.alcremieRotation.pending = true;
                    this.grantAlcremieFromRotation(true);
                }
            }
            this.trainerBoss.constrainPlayer(p);
            if (this.legendaryMap.active) {
                const dx = p.x - this.legendaryMap.x;
                const dy = p.y - this.legendaryMap.y;
                const arenaView = cc.view.getVisibleSize();
                const kyogreSquareView = arenaView.width / Math.max(1, arenaView.height) < 1.35;
                const arenaBounds = this.legendaryMap.species === 'legend-mewtwo'
                    ? MEWTWO_ARENA_BOUNDS
                    : this.legendaryMap.species === 'legend-lugia' ? LUGIA_ARENA_BOUNDS
                        : this.legendaryMap.species === 'legend-rayquaza' ? RAYQUAZA_ARENA_BOUNDS
                            : this.legendaryMap.species === 'legend-hooh' ? HOOH_ARENA_BOUNDS
                                : this.legendaryMap.species === 'legend-kyogre'
                                    ? (kyogreSquareView ? KYOGRE_ARENA_SQUARE_BOUNDS : KYOGRE_ARENA_BOUNDS) : null;
                if (arenaBounds) {
                    const boundedX = Math.max(-arenaBounds.halfWidth, Math.min(arenaBounds.halfWidth, dx));
                    const boundedY = Math.max(-arenaBounds.halfHeight, Math.min(arenaBounds.halfHeight, dy));
                    if (boundedX !== dx || boundedY !== dy) {
                        p.x = this.legendaryMap.x + boundedX;
                        p.y = this.legendaryMap.y + boundedY;
                        p.vx = p.vy = 0;
                    }
                } else {
                    const d = Math.hypot(dx, dy);
                    const limit = 410;
                    if (d > limit) {
                        p.x = this.legendaryMap.x + dx / d * limit;
                        p.y = this.legendaryMap.y + dy / d * limit;
                        p.vx = p.vy = 0;
                    }
                }
            }
            this.chain.update(dt, p.x, p.y, Math.min(1, p.speed / p.maxSpeed));

            const mouseGrowth = stepAustralianMouse(dt, b, this.chain);
            if (mouseGrowth) {
                this.wave(p.x, p.y, 12, 112, 0.62, WAVE_GOLD);
                this.kick(0.12);
                this.say(`澳大利亚老鼠 · 一家鼠数量翻倍 ${mouseGrowth.before.toLocaleString('zh-CN')} → ${mouseGrowth.after.toLocaleString('zh-CN')}`, 3.4);
                this.logEvent('item.australian-mouse.doubled', {
                    before: mouseGrowth.before, after: mouseGrowth.after,
                    intervals: mouseGrowth.intervals, intervalSeconds: AUSTRALIAN_MOUSE_INTERVAL,
                });
            }

            const minute = this.time / 60;
            // Set before the spawn: `spawn` snapshots threat, so the order is the contract.
            this.enemies.threatDps = this.dpsTotal();
            // 闪耀护符：×4 每级，Spawn 掷闪时读取。
            this.enemies.shinyMul = [1, 4, 16, 64][Math.min(3, this.build.stacks.shinyCharm || 0)];
            const ring = Math.max(VIEW.W, VIEW.H) / 2 / this.cam.z + ENEMY.spawnRingPad;
            if (!this.legendaryMap.active) this.spawnWave(dt, minute, ring);
            this.pond.updateEncounters(dt, p.x, p.y, this.enemies, minute,
                !this.legendaryMap.active && !this.trainerBoss.active);
            const trainerPhaseTwoBefore = this.trainerBoss.phaseTwo;
            const projectileHits = this.legendaryMap.active ? 0
                : this.trainerBoss.step(dt, this.enemies, p, PLAYER.iFrame);
            if (!trainerPhaseTwoBefore && this.trainerBoss.phaseTwo) {
                this.say(`${this.trainerBoss.encounter.name}的队伍全力进攻！联合招式频率提升`, 3.8);
                this.wave(this.trainerBoss.cx, this.trainerBoss.cy, 15, 205, 0.52, WAVE_ACCENT);
                this.kick(0.32);
                this.logEvent('boss.trainer-phase-two', {
                    name: this.trainerBoss.encounter.name,
                    hpRatio: this.trainerBoss.vitals(this.enemies).hp / this.trainerBoss.maxHp,
                });
            }
            if (this.trainerBoss.megaActive && !this._trainerMegaAnnounced) {
                this._trainerMegaAnnounced = true;
                const form = this.trainerBoss.megaForm;
                this.say(`对方使出进化石！${form.megaName} MEGA进化！`, 4.2);
                this.wave(this.trainerBoss.megaX, this.trainerBoss.megaY, 18, 150, 0.58, WAVE_GOLD);
                this.particleBursts.burst(this.trainerBoss.party[this.trainerBoss.megaSlot].fam,
                    this.trainerBoss.megaX, this.trainerBoss.megaY, 0, 'mega', form.id);
                this.kick(0.42);
            }
            if (projectileHits > 0) {
                this.wave(p.x, p.y, 9, 46, 0.26, WAVE_GOLD);
                this.kick(0.2);
            }
            this.enemies.setProtectedFamilies(this.chain.segments, !!this.build.stacks.familyWard);
            this.enemies.update(dt, p.x, p.y, ring);
            let legendaryReady = false;
            let lairBossIndex = -1;
            let wildBossIndex = -1;
            let legendaryX = this.legendaryMap.x;
            let legendaryY = this.legendaryMap.y;
            if (this.legendaryMap.active) {
                for (let i = 0; i < this.enemies.n; i++) {
                    if (this.enemies.legendary[i]) {
                        lairBossIndex = i;
                        legendaryX = this.enemies.x[i];
                        legendaryY = this.enemies.y[i];
                        if (this.enemies.legendaryReady[i]) {
                            legendaryReady = true;
                            break;
                        }
                    }
                }
            } else if (this.legendaryAttacks.active && this.legendaryAttacks.wildBoss) {
                for (let i = 0; i < this.enemies.n; i++) {
                    if (this.enemies.wildBoss[i] && !this.enemies.dead[i]) {
                        wildBossIndex = i;
                        legendaryX = this.enemies.x[i];
                        legendaryY = this.enemies.y[i];
                        legendaryReady = !!this.enemies.wildBossReady[i];
                        break;
                    }
                }
            }
            if (legendaryReady || (this.legendaryMap.active && lairBossIndex < 0)
                || (this.legendaryAttacks.wildBoss && wildBossIndex < 0)) {
                this.legendaryAttacks.active = false;
            }
            let bossAttackActive = this.legendaryMap.active
                ? lairBossIndex >= 0 && !legendaryReady && this.legendaryMap.mewtwoIntro <= 0
                    && this.legendaryMap.lugiaIntro <= 0 && this.legendaryMap.hoohIntro <= 0
                    && !this.legendaryMap.hoohSpecial.active
                : this.legendaryAttacks.wildBoss && wildBossIndex >= 0 && !legendaryReady;
            const bossHpRatio = this.legendaryMap.active
                ? (lairBossIndex >= 0 && this.enemies.maxhp[lairBossIndex] > 0
                    ? this.enemies.hp[lairBossIndex] / this.enemies.maxhp[lairBossIndex] : 1)
                : wildBossIndex >= 0 ? this.enemies.hp[wildBossIndex] / this.enemies.maxhp[wildBossIndex] : 1;
            const hoohPhaseTrigger = this.legendaryMap.active && this.legendaryMap.species === 'legend-hooh'
                && lairBossIndex >= 0 && !legendaryReady && this.legendaryMap.hoohIntro <= 0
                && bossHpRatio <= 0.5 && !this.legendaryAttacks.phaseTwoAnnounced;
            if ((bossAttackActive || hoohPhaseTrigger) && bossHpRatio <= 0.5
                && !this.legendaryAttacks.phaseTwoAnnounced) {
                this.legendaryAttacks.phaseTwoAnnounced = true;
                const bossFamily = family(this.legendaryAttacks.family);
                if (hoohPhaseTrigger) {
                    startHoOhSpecial(this.legendaryMap.hoohSpecial);
                    this.enemies.invulnerable[lairBossIndex] = 1;
                    this.legendaryAttacks.active = false;
                    bossAttackActive = false;
                    this.say('凤王腾空 · 神圣羽暴！躲开金色羽弹', 4.2);
                } else this.say(`${bossFamily ? bossFamily.name : '神兽'}进入第二阶段 · 下轮招式强化！`, 3.2);
                this.wave(legendaryX, legendaryY, 12, 126, 0.58,
                    ELEMENT[bossFamily && bossFamily.element] || WAVE_GOLD);
                this.kick(hoohPhaseTrigger ? 0.3 : 0.16);
            }
            const hoohSpecial = this.legendaryMap.hoohSpecial;
            if (this.legendaryMap.active && this.legendaryMap.species === 'legend-hooh'
                && hoohSpecial.active) {
                this.enemies.invulnerable[lairBossIndex] = 1;
                const view = cc.view.getVisibleSize();
                const arena = { x: this.legendaryMap.x, y: this.legendaryMap.y,
                    halfWidth: HOOH_ARENA_BOUNDS.halfWidth, halfHeight: HOOH_ARENA_BOUNDS.halfHeight };
                const viewport = { width: view.width / Math.max(0.01, this.cam.z),
                    height: view.height / Math.max(0.01, this.cam.z) };
                const phaseEvents = stepHoOhSpecial(hoohSpecial, dt, viewport, arena,
                    { x: p.x, y: p.y, radius: PLAYER.radius });
                for (const event of phaseEvents) {
                    if (event.type === 'impact') {
                        for (const strike of event.strikes) {
                            this.particleBursts.burst('legend-hooh', strike.x, strike.y,
                                -Math.PI / 2, 'legendary-attack-impact');
                            this.wave(strike.x, strike.y, 8, 64, 0.38, '#ffb949');
                        }
                        if (event.hit) {
                            const hpBefore = p.hp;
                            const damage = Math.max(1, Math.round(this.combat.bite(minute, 0, 1, 1) * 1.2));
                            if (p.hurt(damage, PLAYER.iFrame)) {
                                this.logEvent('player.hit', { hpBefore: Math.round(hpBefore),
                                    hpAfter: Math.round(p.hp), boss: true, legendary: true,
                                    attack: '凤王·神圣羽暴' });
                                this.wave(p.x, p.y, 10, 78, 0.34, '#ffcf64');
                                this.kick(0.26);
                                if (p.dead) this.logEvent('player.defeated', {
                                    time: Math.round(this.time), legendary: true,
                                    attack: '凤王·神圣羽暴',
                                });
                            }
                        } else {
                            this.logEvent('legendary.attack-dodged', {
                                attack: '凤王·神圣羽暴', volley: event.volley + 1,
                                x: Math.round(p.x), y: Math.round(p.y),
                            });
                        }
                    } else if (event.type === 'complete') {
                        if (lairBossIndex >= 0) this.enemies.invulnerable[lairBossIndex] = 0;
                        this.wave(legendaryX, legendaryY, 22, 174, 0.64, '#ffd36a');
                        this.kick(0.28);
                        this.say('羽暴散去 · 凤王回到平台，可以攻击了', 3.4);
                    }
                }
            }
            const previousLegendaryPhase = this.legendaryAttacks.phase;
            const legendaryAttack = bossAttackActive
                ? this.legendaryAttacks.step(dt, p.x, p.y, this.rng, legendaryX, legendaryY, bossHpRatio) : null;
            if (bossAttackActive
                && previousLegendaryPhase !== 'warning' && this.legendaryAttacks.phase === 'warning') {
                this.particleBursts.burst(this.legendaryAttacks.family, legendaryX, legendaryY,
                    this.legendaryAttacks.angle, 'legendary-attack-charge');
            }
            if (legendaryAttack) {
                const fam = this.legendaryAttacks.family;
                if (!legendaryAttack.impactTick && !legendaryAttack.sequenceEnd) {
                    this.combatSfx.enqueue({ kind: 'legendary-attack', fam });
                    this.combatSfx.flush();
                }
                if (!legendaryAttack.impactTick && !legendaryAttack.sequenceEnd) {
                    for (const area of legendaryAttack.areas.slice(0, 8)) {
                        this.particleBursts.burst(fam, area.x, area.y,
                            area.angle || legendaryAttack.angle, 'legendary-attack-impact');
                    }
                }
                if (legendaryAttack.hit) {
                    const hpBefore = p.hp;
                    const damageScale = legendaryAttack.wildBoss ? 1 : 1.5;
                    const damage = Math.max(1, Math.round(this.combat.bite(minute, 0, 1, 1) * damageScale));
                    const hit = p.hurt(damage, PLAYER.iFrame);
                    if (hit) {
                        this.logEvent('player.hit', { hpBefore: Math.round(hpBefore), hpAfter: Math.round(p.hp),
                            boss: true, legendary: !legendaryAttack.wildBoss,
                            wildBoss: legendaryAttack.wildBoss, attack: legendaryAttack.name });
                        this.wave(p.x, p.y, 10, 70, 0.32, WAVE_GOLD);
                        this.kick(0.28);
                        if (p.dead) this.logEvent('player.defeated', { time: Math.round(this.time),
                            legendary: !legendaryAttack.wildBoss, wildBoss: legendaryAttack.wildBoss });
                    }
                } else if (legendaryAttack.dodgeCheck) {
                    this.logEvent('legendary.attack-dodged', { attack: legendaryAttack.name,
                        wildBoss: legendaryAttack.wildBoss,
                        x: Math.round(legendaryAttack.x), y: Math.round(legendaryAttack.y) });
                }
            }
            // Signature attacks are the only party damage source; the tail remains visual/follow-only.
            this.enemies.aimedCaptureTarget = this.captureGuardTarget();
            this.skills.splashMul = b.splashR || 1;
            this.skills.step(dt, this.chain, this.enemies,
                b.dmg * lateDamageMultiplier(this.level), p.maxSpeed, b.skillSize,
                (seg) => dynamaxProjectileScale(seg, this.dynamax.segment), b.fireRate);
            stepLegendaryCompanionAttacks({
                segments: this.chain.segments,
                enemies: this.enemies,
                player: p,
                camera: this.cam,
                trainerBattle: this.trainerBoss.active,
                dt,
                rng: this.rng,
                damageMul: lateDamageMultiplier(this.level),
                onImpact: (seg, attack, result, damage) => {
                    this.logEvent('legendary.companion-signature', { species: seg.fam,
                        move: attack.move, pattern: attack.pattern,
                        x: Math.round(attack.x), y: Math.round(attack.y), radius: Math.round(attack.radius),
                        damage: Math.round(damage), hits: result.hits, kills: result.kills });
                    const subLegendary = isSubLegendaryCompanion(seg);
                    this.wave(attack.x, attack.y, subLegendary ? 10 : 18,
                        attack.radius * (subLegendary ? 1.08 : 1.65), subLegendary ? 0.24 : 0.56,
                        attack.color || WAVE_GOLD);
                    const maxEffectPoints = subLegendary ? 1 : 3;
                    const effectPoints = [{ x: attack.x, y: attack.y }];
                    const addEffectPoint = (point) => {
                        if (effectPoints.length >= maxEffectPoints || effectPoints.some((existing) =>
                            Math.hypot(existing.x - point.x, existing.y - point.y) < 26)) return;
                        effectPoints.push(point);
                    };
                    for (const area of attack.areas || []) {
                        if (effectPoints.length >= maxEffectPoints) break;
                        addEffectPoint({ x: area.x, y: area.y });
                    }
                    for (const beam of attack.corridors || []) {
                        if (effectPoints.length >= maxEffectPoints) break;
                        addEffectPoint({
                            x: beam.x + Math.cos(beam.angle) * beam.length,
                            y: beam.y + Math.sin(beam.angle) * beam.length,
                        });
                    }
                    for (const point of effectPoints) {
                        this.particleBursts.burst(seg.fam, point.x, point.y, attack.angle,
                            'legendary-companion-impact');
                    }
                    this.kick(subLegendary ? 0.065 : 0.16);
                },
            });
            this.stepMegaChannels(dt);
            if (this.pendingZCast) {
                this.pendingZCast = false;
                this.castZMove();
            }
            this.stepZMove(dt);
            this.drainKills();
            this.drainBoss();

            const touch = this.combat.contact(this.enemies, p.x, p.y);
            let bitten = false;
            if (touch.hits > 0) {
                const hpBefore = p.hp;
                bitten = p.hurt(this.combat.bite(minute, touch.elite, touch.boss, touch.tier), PLAYER.iFrame);
                if (bitten) {
                    this.logEvent('player.hit', { hpBefore: Math.round(hpBefore), hpAfter: Math.round(p.hp),
                        boss: !!touch.boss, elite: !!touch.elite });
                    if (p.dead && b.sashReady) {
                        b.sashReady = false;
                        p.dead = false;
                        p.hp = Math.max(1, Math.ceil(p.maxhp * 0.35));
                        p.invuln = 2;
                        p.hit = 0;
                        this.logEvent('item.focus-sash', { hp: p.hp, maxHp: p.maxhp });
                        this.say('气势披带发动！保留生命并短暂无敌（本局已消耗）', 4);
                    }
                    if (p.dead) this.logEvent('player.defeated', { time: Math.round(this.time) });
                }
            }
            if (bitten) this.kick(0.18);
            if (!p.dead && b.regen > 0) p.hp = Math.min(p.maxhp, p.hp + p.maxhp * b.regen * dt);
            const expiredGroves = stepRillaboomFields(this.rillaboomFields, p, dt);
            if (expiredGroves > 0) this.say('青草场地的生命能量渐渐散去', 1.6);
            for (const cake of stepAlcremieCakes(this.alcremieCakes, p, dt)) {
                const kind = cake.gigantamax ? 'gigantamax' : 'roster';
                this.logEvent(`${kind}.cake-picked-up`, { form: cake.form, heal: Math.round(cake.healed),
                    hp: Math.round(p.hp), maxHp: Math.round(p.maxhp), x: Math.round(cake.x), y: Math.round(cake.y) });
                this.particleBursts.burst('alcremie', cake.x, cake.y, 0, 'hit', cake.gigantamax ? 'alcremie' : null);
                this.wave(cake.x, cake.y, 7, cake.size * 1.8, 0.42,
                    cake.gigantamax ? '#ffe18a' : '#f3a9d2');
                this.say(`蛋糕拾取成功 · 回复 ${Math.round(cake.healed)} HP`, 2.2);
            }

            const tail = this._tail;
            const last = this.chain.nCount - 1;
            tail.x = last >= 0 ? this.chain.nx[last] : p.x;
            tail.y = last >= 0 ? this.chain.ny[last] : p.y;
            // The balls run after skill attacks and contact, so a body that died earlier in this step
            // is already marked and cannot also be caught; one cull then covers both paths at once.
            this.capture.update(dt, this.enemies, tail.x, tail.y);
            if (this.enemies.dirty) this.enemies.cull();
            this.drainTrainerBoss();
            this.drainLanded();
            // One automatic fold per frame as soon as a stack satisfies its evolution gate. Multi-step chains
            // therefore announce each evolution separately and remain easy to read.
            if (CHAIN.autoEvolve) {
                const ai = this.chain.findAuto(this.evolveHave());
                if (ai >= 0) this.evolveOne(ai, true);
            }

            this.repeat -= dt;
            const w = this.want;
            const wants = w.tap || w.hold;
            w.tap = false;
            // One cooldown, one source of truth. A press that arrives early is dropped rather than
            // buffered, because a buffered throw would land somewhere the crosshair no longer points.
            if (wants && this.repeat <= 0 && this.throwBall()) this.repeat = b.repeat;

            // In normal play the hero stays centered. Mewtwo's finite chamber instead locks the
            // camera to the room so the player can move within its visible walls.
            const arenaView = cc.view.getVisibleSize();
            const kyogreSquareView = arenaView.width / Math.max(1, arenaView.height) < 1.35;
            const fixedArenaSize = this.legendaryMap.species === 'legend-mewtwo'
                ? MEWTWO_ARENA_SIZE
                : this.legendaryMap.species === 'legend-lugia' ? LUGIA_ARENA_SIZE
                    : this.legendaryMap.species === 'legend-rayquaza' ? RAYQUAZA_ARENA_SIZE
                        : this.legendaryMap.species === 'legend-hooh' ? HOOH_ARENA_SIZE
                            : this.legendaryMap.species === 'legend-kyogre'
                                ? (kyogreSquareView ? KYOGRE_ARENA_SQUARE_SIZE : KYOGRE_ARENA_SIZE) : null;
            const fixedArenaCamera = this.legendaryMap.active && fixedArenaSize;
            this.cam.x = fixedArenaCamera ? this.legendaryMap.x : p.x;
            this.cam.y = fixedArenaCamera ? this.legendaryMap.y : p.y;
            if (fixedArenaCamera) {
                const visible = cc.view.getVisibleSize();
                const arenaFit = this.legendaryMap.species === 'legend-kyogre' && kyogreSquareView
                    ? 1.02 : 0.92;
                this.cam.z = Math.min(visible.width / fixedArenaSize.width,
                    visible.height / fixedArenaSize.height) * arenaFit;
            } else {
                const kz = 1 - Math.exp(-3 * dt);
                this.cam.z += (CHAIN.zoom(this.chain.nCount) - this.cam.z) * kz;
            }
            this.stepWaves(dt);
            if (this.toast.t > 0) this.toast.t -= dt;
            this.time += dt;
        }

        drawGround () {
            const g = this.ground;
            const z = this.cam.z;
            // FIXED_HEIGHT exposes extra world width on ultrawide browser windows. Cover the
            // actual visible area so the camera's COL.wall clear color cannot show as side bars.
            const visible = cc.view.getVisibleSize();
            const halfW = Math.max(VIEW.W, visible.width) / 2;
            const halfH = Math.max(VIEW.H, visible.height) / 2;
            g.clear();
            if (this.legendaryMap.active) {
                if (this.legendaryMap.species === 'legend-mewtwo'
                    || this.legendaryMap.species === 'legend-lugia'
                    || this.legendaryMap.species === 'legend-rayquaza'
                    || this.legendaryMap.species === 'legend-hooh') {
                    const arenaGround = this.legendaryMap.species === 'legend-lugia' ? '#101f32'
                        : this.legendaryMap.species === 'legend-rayquaza' ? '#182943'
                            : this.legendaryMap.species === 'legend-hooh' ? '#68aaf1' : '#19233a';
                    g.fillColor = this.pal.get(arenaGround);
                    g.rect(-halfW, -halfH, halfW * 2, halfH * 2);
                    g.fill();
                    return;
                }
                g.fillColor = this.pal.get('#17192b');
                g.rect(-halfW, -halfH, halfW * 2, halfH * 2);
                g.fill();
                g.strokeColor = this.pal.get('#384263', 220);
                g.lineWidth = 5;
                for (let i = 0; i < 5; i++) {
                    const r = 90 + i * 76 + Math.sin(this.wall * 1.2 + i) * 3;
                    g.circle(0, 0, r);
                }
                g.stroke();
                g.strokeColor = this.pal.get('#65749c', 105);
                g.lineWidth = 3;
                for (let i = 0; i < 16; i++) {
                    const a = i * Math.PI / 8 + this.wall * 0.025;
                    const r0 = 94;
                    const r1 = Math.min(halfW, halfH) * 0.84;
                    g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
                    g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
                }
                g.stroke();
                g.fillColor = this.pal.get('#222943', 175);
                g.circle(0, 0, 72);
                g.fill();
                g.strokeColor = this.pal.get('#a9cfff', 230);
                g.lineWidth = 4;
                g.circle(0, 0, 74);
                g.stroke();
                return;
            }
            g.fillColor = this.pal.get(COL.ground);
            g.rect(-halfW, -halfH, halfW * 2, halfH * 2);
            g.fill();
            // The pond shares the exact screen-space ground pass, so it stays beneath flora,
            // trees, and Pokémon as the camera follows the trainer.
            this.pond.drawGround(g, this.cam);

            const T = 80;
            const x0 = this.cam.x - halfW / z;
            const x1 = this.cam.x + halfW / z;
            const y0 = this.cam.y - halfH / z;
            const y1 = this.cam.y + halfH / z;
            if (!this.trainerBoss.active) {
                drawWorldGround(g, this.cam, z,
                    { left: x0, right: x1, bottom: y0, top: y1 },
                    this.worldLayout, this.pal, this.trees.getVisibleRoots(),
                    this.pond.geometry, this.pond.enabled);
            }
            // World-anchored sparse grass: scrolling never makes the decoration swim or flicker.
            g.strokeColor = this.pal.get(COL.grid, 150);
            g.lineWidth = 2;
            for (let wx = Math.floor(x0 / T) * T; wx <= x1; wx += T) {
                for (let wy = Math.floor(y0 / T) * T; wy <= y1; wy += T) {
                    if (inPondClearing(wx, wy, 0, this.worldLayout.pond)) continue;
                    const seed = Math.abs(Math.imul(Math.floor(wx / T), 73856093)
                        ^ Math.imul(Math.floor(wy / T), 19349663)
                        ^ Math.imul(this.worldLayout.seed | 0, 0x27d4eb2d));
                    if (seed % 4 !== 0) continue;
                    const vx = (wx + seed % 31 - this.cam.x) * z;
                    const vy = (wy + seed % 23 - this.cam.y) * z;
                    g.moveTo(vx - 5 * z, vy); g.lineTo(vx - 7 * z, vy + 5 * z);
                    g.moveTo(vx, vy); g.lineTo(vx, vy + 7 * z);
                    g.moveTo(vx + 4 * z, vy); g.lineTo(vx + 7 * z, vy + 4 * z);
                }
            }
            g.stroke();
        }

        _ensureDexPreviewScene () {
            if (this.dexPreviewScene) return;
            const scene = new cc.Node('PokédexNativeParticlePreview');
            scene.layer = cc.Layers.Enum.UI_2D;
            this.node.addChild(scene);

            const groundNode = new cc.Node('PokédexPreviewGround');
            groundNode.layer = cc.Layers.Enum.UI_2D;
            scene.addChild(groundNode);
            this.dexPreviewGround = groundNode.addComponent(cc.Graphics);

            // The simulator uses the same 1280×720 world coordinates as combat. The captured game
            // canvas is downscaled into the 640×360 Pokédex viewport after Cocos renders it.
            const simRoot = new cc.Node('PokédexSimulationSpace');
            simRoot.layer = cc.Layers.Enum.UI_2D;
            simRoot.setPosition(-VIEW.W / 2, -VIEW.H / 2, 0);
            simRoot.setScale(1, 1, 1);
            scene.addChild(simRoot);
            this.dexPreviewSimRoot = simRoot;
            simRoot.setScale(DEX_PREVIEW_ZOOM, DEX_PREVIEW_ZOOM, 1);
            this.dexPreviewFlora = new WorldFlora(cc, simRoot);
            this.dexPreviewFlora.frames = this.flora?.frames || null;
            this.floraPromise?.then(() => {
                if (this.dexPreviewFlora && this.flora) this.dexPreviewFlora.frames = this.flora.frames;
            });
            this.dexPreviewBatch = new SpriteBatch(cc, simRoot, this.atlas.glyphs);
            this.dexPreviewBursts = new NativeParticleBursts(cc, simRoot,
                this.atlas.glyphs.circle.frame, this.atlas.glyphs.star.frame,
                this.atlas.glyphs, this.atlas.particleGlyphs);
            const fxNode = new cc.Node('PokédexPreviewCombatTelegraph');
            fxNode.layer = cc.Layers.Enum.UI_2D;
            scene.addChild(fxNode);
            this.dexPreviewFxNode = fxNode;
            this.dexPreviewFx = fxNode.addComponent(cc.Graphics);
            this.dexPreviewScene = scene;
        }

        setDexPreview (preview) {
            if (preview) {
                this._ensureDexPreviewScene();
                if (!this.dexPreviewVisibility) {
                    this.dexPreviewVisibility = this.node.children
                        .filter((child) => child !== this.dexPreviewScene)
                        .map((child) => [child, child.active]);
                }
                for (const [child] of this.dexPreviewVisibility) child.active = false;
                this.dexPreviewScene.active = true;
                this.dexPreview = preview;
                return;
            }
            this.dexPreview = null;
            if (this.dexPreviewBursts) {
                for (const slot of this.dexPreviewBursts.slots) {
                    slot.ps.stopSystem();
                    slot.node.active = false;
                    slot.busy = false;
                    slot.time = 0;
                }
            }
            if (this.dexPreviewScene) this.dexPreviewScene.active = false;
            for (const [child, wasActive] of this.dexPreviewVisibility || []) child.active = wasActive;
            this.dexPreviewVisibility = null;
        }

        _withDexPreviewArena (arena, drawOrStep) {
            const values = {
                chain: arena.chain, enemies: arena.enemies, skills: arena.skills,
                player: arena.player, build: arena.build, level: arena.level, time: arena.time,
                cam: arena.camera, visibleSize: arena.visibleSize,
                wall: arena.wall, aimWorld: arena.target, selectedMega: arena.seg,
                megaFx: arena.megaFx, megaFxSlot: arena.megaFxSlot,
                particleBursts: this.dexPreviewBursts, ripples: arena.ripples,
                rillaboomFields: arena.rillaboomFields, alcremieCakes: arena.alcremieCakes,
                rng: arena.rng, shake: arena.shake || 0,
                tailPop: arena.tailPop || 0,
                logEvent: () => {}, say: () => {},
            };
            const keys = Object.keys(values);
            const previous = new Map(keys.map((key) => [key, {
                own: Object.prototype.hasOwnProperty.call(this, key), value: this[key],
            }]));
            Object.assign(this, values);
            try {
                return drawOrStep();
            } finally {
                arena.time = this.time;
                arena.wall = this.wall;
                arena.megaFxSlot = this.megaFxSlot;
                arena.shake = this.shake;
                arena.tailPop = this.tailPop;
                for (const [key, saved] of previous) {
                    if (saved.own) this[key] = saved.value;
                    else delete this[key];
                }
            }
        }

        _stepDexPreview (preview, arena, dt) {
            this._withDexPreviewArena(arena, () => {
                const seg = arena.seg;
                const aimOffset = preview.aimOffset?.();
                if (aimOffset) {
                    arena.target.x = this.player.x + aimOffset.x;
                    arena.target.y = this.player.y + aimOffset.y;
                }
                let drive = null;
                if (seg.megaSkillActive > 0) {
                    const form = this.combatFormForSegment(seg);
                    const skill = form && this.activeSkillForForm(form);
                    const module = form && activeSkillModuleForForm(form);
                    if (skill && module?.playerDrive) drive = module.playerDrive(this, seg, dt, form, skill);
                }
                const axis = drive || { x: 0, y: 0 };
                this.player.update(dt, axis, drive);
                if (this.player.speed > 8) arena.heading = Math.atan2(this.player.vy, this.player.vx);
                const heading = arena.heading || 0;
                arena.camera.x = this.player.x;
                arena.camera.y = this.player.y;
                arena.chain.nx[0] = this.player.x - Math.cos(heading) * 34;
                arena.chain.ny[0] = this.player.y - Math.sin(heading) * 34;
                arena.chain.bx[0] = arena.chain.nx[0];
                arena.chain.by[0] = arena.chain.ny[0];
                arena.chain.na[0] = heading;
                arena.chain.nspd[0] = this.player.speed;

                preview.step(dt);
                stepLegendaryCompanionAttacks({
                    segments: arena.chain.segments, enemies: arena.enemies, player: arena.player,
                    camera: { z: DEX_PREVIEW_ZOOM }, trainerBattle: false, dt, rng: arena.rng,
                    onImpact: (segment, attack) => {
                        this.particleBursts.burst(segment.fam, attack.x, attack.y, attack.angle,
                            'legendary-companion-impact');
                        this.kick(isSubLegendaryCompanion(segment) ? 0.055 : 0.12);
                    },
                });
                this.time = arena.time;
                this.stepMegaChannels(dt);
                this.stepWaves(dt);
                stepRillaboomFields(this.rillaboomFields, this.player, dt);
                stepAlcremieCakes(this.alcremieCakes, this.player, dt);
                this.stepFrameFx(dt);
            });
        }

        _drawDexPreview (preview, arena) {
            const sx = arena.shake > 0 ? (Math.random() - 0.5) * 26 * arena.shake : 0;
            const sy = arena.shake > 0 ? (Math.random() - 0.5) * 26 * arena.shake : 0;
            this.dexPreviewSimRoot.setPosition(-arena.player.x * DEX_PREVIEW_ZOOM + sx,
                -arena.player.y * DEX_PREVIEW_ZOOM + sy, 0);
            const g = this.dexPreviewGround;
            g.clear();
            g.fillColor = new cc.Color(24, 27, 45, 255);
            g.rect(-VIEW.W / 2, -VIEW.H / 2, VIEW.W, VIEW.H);
            g.fill();
            g.strokeColor = new cc.Color(255, 255, 255, 16);
            g.lineWidth = 1;
            for (let x = -VIEW.W / 2; x <= VIEW.W / 2; x += 80) {
                g.moveTo(x, -VIEW.H / 2); g.lineTo(x, VIEW.H / 2);
            }
            for (let y = -VIEW.H / 2; y <= VIEW.H / 2; y += 80) {
                g.moveTo(-VIEW.W / 2, y); g.lineTo(VIEW.W / 2, y);
            }
            const batch = this.dexPreviewBatch;
            this._withDexPreviewArena(arena, () => {
                this.dexPreviewFlora?.updatePreview(arena.flora?.plants || []);
                batch.begin();
                drawPersistentSkillFields(this, batch);
                for (let i = 0; i < arena.enemies.n; i++) {
                    if (arena.enemies.dead[i]) continue;
                    const targetFamily = FAMILIES[arena.enemies.fam[i]]?.id;
                    const targetIcon = iconKey(targetFamily, arena.enemies.tier[i]);
                    const icon = this.atlas.glyphs[targetIcon] ? targetIcon : 'blob';
                    const scale = Math.max(arena.enemies.r[i] / 24, formMin(arena.enemies.tier[i]) / 48);
                    const bob = Math.sin(this.time * 7 + i * 1.3) * 2;
                    batch.draw(icon, arena.enemies.x[i], arena.enemies.y[i] + bob, scale, scale, 0,
                        this.pal.get(arena.enemies.flash[i] > 0 ? COL.heroTrim : HORDE_TINT));
                    batch.draw('ring', arena.enemies.x[i], arena.enemies.y[i], scale * 1.12,
                        scale * 1.12, 0, this.pal.get('#c7b4df', 175));
                }

                drawSkillEffects(this, batch);

                const player = arena.player;
                const trainer = this.atlas.glyphs[`lucas_${player.direction}_0`]
                    ? `lucas_${player.direction}_${player.speed > 8 ? Math.floor(arena.time * 9) % 4 : 0}` : null;
                if (trainer && this.atlas.glyphs[trainer]) {
                    batch.draw(trainer, player.x, player.y, HERO_SCALE, HERO_SCALE, 0,
                        this.pal.get('#ffffff'));
                } else {
                    batch.draw('pill', player.x, player.y,
                        HERO_SCALE * (1 - 0.05 * player.squash), HERO_SCALE * (1 + 0.05 * player.squash), 0,
                        this.pal.get(COL.hero));
                    batch.draw('dot', player.x + player.facing * 13, player.y + 7, 0.62, 0.62, 0,
                        this.pal.get(COL.heroTrim));
                }

                const seg = arena.seg;
                const mega = megaFormForSegment(seg);
                const gigantamax = gigantamaxFormForSegment(seg);
                const iconBase = mega?.icon || gigantamax?.icon || preview.iconKey();
                const icon = this.atlas.glyphs[iconBase] ? iconBase : 'circle';
                const bulk = arena.chain.bulkOf(seg);
                const visual = seg.fam === 'tandemaus' ? 1
                    : Math.min(CHAIN.nodesMax, 1 + Math.floor(seg.count / CHAIN.nodeEvery));
                const merged = bulk > visual;
                const base = PET_SCALE + 0.05 * (visual - 1) + 0.06 * (seg.tier - 1);
                const scale = ((Math.max(base, formMin(seg.tier) / 48)
                    + (merged ? PET_BULK * (bulk - 1) : 0)) * formScale(seg.tier)
                    * (mega ? 1.22 : (gigantamax ? gigantamax.size : 1)));
                const petX = arena.chain.nx[0];
                const flightFx = mega?.id === 'charizard-x'
                    ? arena.megaFx.find((fx) => fx.active && fx.shape === 'charizard-x-cross'
                        && fx.sourceSegment === seg) : null;
                const flight = flightFx ? charizardXFlightPose(flightFx)
                    : { amount: 0, lift: 0, scale: 1 };
                const petY = arena.chain.ny[0] + flight.lift;
                const petBob = Math.sin(arena.time * 8) * 2.6;
                const petScaleX = scale * flight.scale * (1 - 0.08 * Math.sin(arena.time * 8));
                const petScaleY = scale * flight.scale;
                if (mega) {
                    drawMegaFormOutline(batch, this.pal, this.atlas.glyphs, mega, icon,
                        petX, petY + petBob, petScaleX, petScaleY, this.wall, 0);
                } else {
                    batch.draw('ring', petX, petY, scale * 1.35, scale * 1.35, 0,
                        this.pal.get(ELEMENT[arena.fam.element] || '#d8afff', 150));
                }
                batch.draw(icon, petX, petY + petBob, petScaleX, petScaleY, 0, this.pal.get(ICON_TINT));
                if (seg.fam === 'tandemaus') {
                    const companions = arena.chain.companionCountOf(seg);
                    const partySize = arena.chain.segments.length;
                    const visibleCompanions = tandemausVisibleCompanionCount(companions);
                    const companionScale = tandemausFollowerScale(scale, companions, partySize);
                    for (let i = 0; i < visibleCompanions; i++) {
                        const mouseIndex = tandemausVisibleCompanionIndex(i, companions, visibleCompanions);
                        const offset = tandemausFollowerOffset(
                            arena.chain.na[0], scale, mouseIndex, companions, partySize);
                        const motion = tandemausFollowerMotion(
                            arena.chain.na[0], scale, i, arena.time, companions, partySize);
                        const key = `MAUSHOLD_COMPANION_${(mouseIndex % 4) + 1}`;
                        batch.draw(this.atlas.glyphs[key] ? key : icon,
                            petX + offset.x + motion.x, petY + offset.y + motion.y,
                            companionScale * (1 + motion.stride * 0.07),
                            companionScale * (1 - motion.stride * 0.045),
                            0, this.pal.get(ICON_TINT));
                    }
                }

                const w = arena.ripples;
                for (let i = 0; i < w.n; i++) {
                    if (w.life[i] <= 0) continue;
                    const t = Math.min(1, w.t[i] / w.life[i]);
                    const radius = w.r0[i] + (w.r1[i] - w.r0[i]) * (1 - (1 - t) * (1 - t));
                    const colorKey = w.hue[i] === WAVE_GOLD ? COL.gold
                        : w.hue[i] === WAVE_DIM ? COL.dim : COL.accent;
                    batch.draw('ring', w.x[i], w.y[i], radius / 24, radius / 24, 0,
                        this.pal.get(colorKey, Math.round(215 * (1 - t))));
                }
                drawMegaEffects(this, batch, {
                    activeSkillForForm: resolveActiveSkillForForm,
                    activeSkillModuleForForm,
                    drawMegaActiveArea,
                });
                drawCakePickups(this, batch);
                batch.end();
            });
            this.dexPreviewFx.clear();
            this.dexPreviewFxNode.setPosition(-arena.player.x * DEX_PREVIEW_ZOOM + sx,
                -arena.player.y * DEX_PREVIEW_ZOOM + sy, 0);
            this.dexPreviewFxNode.setScale(DEX_PREVIEW_ZOOM, DEX_PREVIEW_ZOOM, 1);
            this._withDexPreviewArena(arena, () => {
                this.drawMegaSkillPreview(this.dexPreviewFx);
                drawMegaScreenEffects(this, this.dexPreviewFx);
            });
        }

        _updateDexPreview (dt) {
            const preview = this.dexPreview;
            const frameDt = Math.min(0.05, Math.max(0, dt));
            preview.accumulator += frameDt;
            const arena = preview.getArena();
            const castRequest = preview.consumeCastRequest?.();
            if (castRequest) {
                this._withDexPreviewArena(arena, () => {
                    arena.seg.mega = !castRequest.gigantamax && MEGA_BY_ID[castRequest.id]
                        ? castRequest.id : null;
                    arena.seg.gigantamax = castRequest.gigantamax ? castRequest.id : null;
                    this.selectedMega = arena.seg;
                    this.aimWorld = arena.target;
                    this.castMegaSkill();
                });
            }
            let steps = 0;
            while (preview.accumulator >= 1 / 60 && steps++ < 4) {
                this._stepDexPreview(preview, arena, 1 / 60);
                preview.accumulator -= 1 / 60;
            }
            this._withDexPreviewArena(arena, () => {
                const particles = this.particleBursts;
                particles.update(frameDt);
                particles.updateRillaboomGroves(frameDt, this.rillaboomFields);
                particles.updateGigantamaxMeowth(frameDt, this.chain);
                particles.updateGigantamaxAuras(frameDt, this.chain);
                particles.updateGigantamaxSkillParticles(frameDt, this.megaFx);
                this.skills.consumeBursts((event) => {
                    particles.burst(event.fam, event.x, event.y, event.angle, event.kind, event.megaId);
                    this.megaBurstFx(event);
                    if (this.combatSfx) this.combatSfx.enqueue(event);
                });
                if (this.combatSfx) this.combatSfx.flush();
                particles.updateProjectileTrails(frameDt, this.skills);
                particles.updateTrainerProjectileTrails(frameDt, null);
                particles.updateSkillEffectParticles(frameDt, this.skills);
                particles.updateFieldParticles(frameDt, this.skills);
                particles.updateZMoveParticles(frameDt, null);
                particles.updateMegaAreaParticles(frameDt, this.megaFx);
                particles.updateSignatureSkillParticles(frameDt, this.megaFx);
                particles.updateRosterAreaParticles(frameDt, this.megaFx);
                particles.updateShinyWalkTrails(frameDt, this.chain);
            });
            this._drawDexPreview(preview, arena);
        }

        /** One Graphics buffer for everything the throw has to say: corridor, reticle, lock, 晋升. */
        drawFx () {
            const g = this.fx;
            const p = this.player;
            const c = this.capture;
            const b = this.build;
            const e = this.enemies;
            g.clear();
            this.lock = -1;
            if (p.dead) return;

            if (this.trainerBoss.active) {
                this.trainerBoss.drawArenaAndWarnings(g, this.pal, e);
                this.drawLegendaryCompanionWarnings(g);
                this.drawMegaSkillPreview(g);
                drawMegaScreenEffects(this, g);
                return;
            }

            // Telegraphs occupy randomly selected, locked arena regions; they never follow the player.
            // The one-shot impact tests the same circle/rectangle shown here, and this overlay sits above
            // the party so even a long formation cannot hide where the strike will land.
            const attack = this.legendaryAttacks;
            if ((this.legendaryMap.active || attack.wildBoss) && attack.active
                && (attack.phase === 'warning' || attack.phase === 'impact')) {
                const impact = attack.phase === 'impact';
                const pulse = 0.72 + 0.28 * Math.sin(this.wall * 15);
                const fillAlpha = impact ? 120 : Math.round(58 + 32 * pulse);
                const edgeAlpha = impact ? 255 : Math.round(205 + 45 * pulse);
                if (attack.areas && attack.areas.length) {
                    const color = ELEMENT[family(attack.family)?.element] || '#ef5362';
                    drawLegendaryAttackPattern(g, { ...attack, color }, this.pal, pulse, impact);
                } else if (attack.type === 'circle') {
                    g.fillColor = this.pal.get('#ff334f', fillAlpha);
                    g.circle(attack.x, attack.y, attack.radius);
                    g.fill();
                    g.strokeColor = this.pal.get('#ff334f', edgeAlpha);
                    g.lineWidth = 5;
                    g.circle(attack.x, attack.y, attack.radius);
                    g.stroke();
                    g.strokeColor = this.pal.get('#fff0c2', 235);
                    g.lineWidth = 3;
                    g.circle(attack.x, attack.y, attack.radius * (0.64 + 0.08 * pulse));
                    g.stroke();
                    g.circle(attack.x, attack.y, 8 + 4 * pulse);
                    g.stroke();
                } else if (attack.type === 'tsunami') {
                    const ux = Math.cos(attack.angle);
                    const uy = Math.sin(attack.angle);
                    const nx = -uy;
                    const ny = ux;
                    const hx = ux * attack.length * 0.5;
                    const hy = uy * attack.length * 0.5;
                    const wx = nx * attack.width * 0.5;
                    const wy = ny * attack.width * 0.5;
                    g.moveTo(attack.x - hx - wx, attack.y - hy - wy);
                    g.lineTo(attack.x + hx - wx, attack.y + hy - wy);
                    g.lineTo(attack.x + hx + wx, attack.y + hy + wy);
                    g.lineTo(attack.x - hx + wx, attack.y - hy + wy);
                    g.close();
                    g.fill();
                    g.strokeColor = this.pal.get('#ff334f', edgeAlpha);
                    g.lineWidth = impact ? 7 : 5;
                    g.moveTo(attack.x - hx - wx, attack.y - hy - wy);
                    g.lineTo(attack.x + hx - wx, attack.y + hy - wy);
                    g.lineTo(attack.x + hx + wx, attack.y + hy + wy);
                    g.lineTo(attack.x - hx + wx, attack.y - hy + wy);
                    g.close();
                    g.stroke();

                    // Cyan lane = explicit safe space. Keep its rendered width identical to collision data.
                    const sx = attack.x + nx * attack.safeOffset;
                    const sy = attack.y + ny * attack.safeOffset;
                    const shx = ux * (attack.length * 0.5 - 8);
                    const shy = uy * (attack.length * 0.5 - 8);
                    const swx = nx * attack.safeWidth * 0.5;
                    const swy = ny * attack.safeWidth * 0.5;
                    g.fillColor = this.pal.get('#42f2e7', impact ? 210 : 230);
                    g.moveTo(sx - shx - swx, sy - shy - swy);
                    g.lineTo(sx + shx - swx, sy + shy - swy);
                    g.lineTo(sx + shx + swx, sy + shy + swy);
                    g.lineTo(sx - shx + swx, sy - shy + swy);
                    g.close();
                    g.fill();
                    g.strokeColor = this.pal.get('#eaffff', 255);
                    g.lineWidth = 4;
                    g.moveTo(sx - shx - swx, sy - shy - swy);
                    g.lineTo(sx + shx - swx, sy + shy - swy);
                    g.lineTo(sx + shx + swx, sy + shy + swy);
                    g.lineTo(sx - shx + swx, sy - shy + swy);
                    g.close();
                    g.stroke();

                    // Directional white chevrons make the incoming sweep readable at a glance.
                    g.strokeColor = this.pal.get('#fff8db', impact ? 245 : 225);
                    g.lineWidth = 5;
                    for (const s of [-0.25, 0, 0.25]) {
                        const cx = attack.x + ux * attack.length * s;
                        const cy = attack.y + uy * attack.length * s;
                        for (const side of [-1, 1]) {
                            g.moveTo(cx - ux * 14 + nx * side * 16, cy - uy * 14 + ny * side * 16);
                            g.lineTo(cx, cy);
                        }
                    }
                    g.stroke();
                } else {
                    const ux = Math.cos(attack.angle);
                    const uy = Math.sin(attack.angle);
                    const nx = -uy * attack.width * 0.5;
                    const ny = ux * attack.width * 0.5;
                    const hx = ux * attack.length * 0.5;
                    const hy = uy * attack.length * 0.5;
                    g.moveTo(attack.x - hx + nx, attack.y - hy + ny);
                    g.lineTo(attack.x + hx + nx, attack.y + hy + ny);
                    g.lineTo(attack.x + hx - nx, attack.y + hy - ny);
                    g.lineTo(attack.x - hx - nx, attack.y - hy - ny);
                    g.close();
                    g.fill();
                    g.strokeColor = this.pal.get('#ff334f', edgeAlpha);
                    g.lineWidth = 5;
                    g.moveTo(attack.x - hx + nx, attack.y - hy + ny);
                    g.lineTo(attack.x + hx + nx, attack.y + hy + ny);
                    g.lineTo(attack.x + hx - nx, attack.y + hy - ny);
                    g.lineTo(attack.x - hx - nx, attack.y - hy - ny);
                    g.close();
                    g.stroke();
                    g.strokeColor = this.pal.get('#fff0c2', 245);
                    g.lineWidth = 4;
                    for (const s of [-0.32, 0, 0.32]) {
                        const cx = attack.x + ux * attack.length * s;
                        const cy = attack.y + uy * attack.length * s;
                        g.moveTo(cx - ux * 10 + nx * 0.45, cy - uy * 10 + ny * 0.45);
                        g.lineTo(cx, cy);
                        g.lineTo(cx - ux * 10 - nx * 0.45, cy - uy * 10 - ny * 0.45);
                    }
                    g.stroke();
                }
            }

            const hoohSpecial = this.legendaryMap.hoohSpecial;
            if (this.legendaryMap.active && this.legendaryMap.species === 'legend-hooh'
                && hoohSpecial.active && (hoohSpecial.phase === 'warning' || hoohSpecial.phase === 'fall')) {
                const falling = hoohSpecial.phase === 'fall';
                const pulse = 0.78 + 0.22 * Math.sin(this.wall * 15);
                const fallProgress = falling
                    ? 1 - hoohSpecial.timer / Math.max(0.01, hoohSpecial.phaseDuration) : 0;
                const view = cc.view.getVisibleSize();
                const topY = this.cam.y + view.height / Math.max(0.01, this.cam.z) * 0.5 + 48;
                for (let index = 0; index < hoohSpecial.strikes.length; index++) {
                    const strike = hoohSpecial.strikes[index];
                    const radius = 35 + pulse * 7;
                    g.fillColor = this.pal.get('#f5a93e', falling ? 66 : Math.round(38 + pulse * 36));
                    g.circle(strike.x, strike.y, radius);
                    g.fill();
                    g.strokeColor = this.pal.get('#fff0b0', Math.round(205 + pulse * 50));
                    g.lineWidth = 4;
                    g.circle(strike.x, strike.y, radius * 0.73);
                    g.stroke();
                    g.strokeColor = this.pal.get('#ffcf5b', Math.round(190 + pulse * 60));
                    g.lineWidth = 4;
                    for (let ray = 0; ray < 8; ray++) {
                        const angle = ray * TAU / 8 + this.wall * 0.18;
                        const inner = radius * 0.94;
                        const outer = radius * (1.18 + 0.12 * pulse);
                        g.moveTo(strike.x + Math.cos(angle) * inner,
                            strike.y + Math.sin(angle) * inner);
                        g.lineTo(strike.x + Math.cos(angle) * outer,
                            strike.y + Math.sin(angle) * outer);
                    }
                    g.stroke();
                    g.fillColor = this.pal.get('#fff9df', 255);
                    g.circle(strike.x, strike.y, 5 + pulse * 2);
                    g.fill();

                    if (falling) {
                        const x = strike.x + Math.sin(this.wall * 12 + index) * 9 * (1 - fallProgress);
                        const y = topY + (strike.y - topY) * fallProgress;
                        const angle = -Math.PI / 2 + Math.sin(this.wall * 8 + index) * 0.09;
                        const dx = Math.cos(angle), dy = Math.sin(angle);
                        const nx = -dy, ny = dx;
                        g.fillColor = this.pal.get('#f6a23d', 250);
                        g.moveTo(x - dx * 14 - nx * 5, y - dy * 14 - ny * 5);
                        g.lineTo(x - dx * 4 - nx * 10, y - dy * 4 - ny * 10);
                        g.lineTo(x + dx * 16, y + dy * 16);
                        g.lineTo(x - dx * 2 + nx * 9, y - dy * 2 + ny * 9);
                        g.lineTo(x - dx * 14 + nx * 5, y - dy * 14 + ny * 5);
                        g.close();
                        g.fill();
                        g.strokeColor = this.pal.get('#fff6c4', 255);
                        g.lineWidth = 3;
                        g.moveTo(x - dx * 11, y - dy * 11);
                        g.lineTo(x + dx * 11, y + dy * 11);
                        g.stroke();
                        g.fillColor = this.pal.get('#fff4b2', 125);
                        g.circle(x - dx * 19, y - dy * 19, 9);
                        g.fill();
                    }
                }
            }

            this.drawLegendaryCompanionWarnings(g);

            // Every width below is multiplied by cam.z (1.2) and then by the canvas downscale (measured
            // 716/1280 = 0.56), so the old 2.5 px crosshair arrived as a single row at L175 on an L222
            // ground. That measurement is the whole reason "看不出在不在捕捉" was true, so nothing here
            // is thinner than 4 px and the aim is never a mark you have to look *for*.
            const o = this.aim();
            const ax = this.aimWorld.x;
            const ay = this.aimWorld.y;
            const ex = o.x + o.dx * b.range;
            const ey = o.y + o.dy * b.range;
            const victim = this.lock = c.predict(o.x, o.y, o.dx, o.dy, { range: b.range, r: b.ballR }, e);

            // 固定投程 × 球径 as a corridor you can see yourself aiming down: the band is what the swept
            // test actually swallows, so the promise and the physics are the same shape.
            g.strokeColor = this.pal.get(COL.accent, 26);
            g.lineWidth = b.ballR * 2;
            g.moveTo(o.x, o.y);
            g.lineTo(ex, ey);
            g.stroke();

            // The bright line stops where the ball would stop, i.e. on the locked animal.
            const past = Math.hypot(ax - o.x, ay - o.y) > b.range;
            const lx = victim >= 0 ? e.x[victim] : (past ? ex : ax);
            const ly = victim >= 0 ? e.y[victim] : (past ? ey : ay);
            g.strokeColor = this.pal.get(COL.accent, 165);
            g.lineWidth = 4;
            g.moveTo(o.x, o.y);
            g.lineTo(lx, ly);
            g.stroke();
            // Mark where the fixed throw distance ends, whether or not the cursor is already past it.
            g.strokeColor = this.pal.get(COL.accent, 120);
            g.lineWidth = 5;
            g.moveTo(ex - o.dy * 16, ey + o.dx * 16);
            g.lineTo(ex + o.dy * 16, ey - o.dx * 16);
            g.stroke();

            // The reticle snaps shut and changes colour on a lock, so the answer to "在不在捕捉" is a
            // shape difference rather than a shade difference. Cooldown dims it, which is the only way
            // a 0.42 s gate can be learned without reading a number.
            const on = victim >= 0;
            const ready = this.repeat <= 0;
            const R = on ? 19 : 27;
            g.strokeColor = this.pal.get(on ? COL.accent : GREY, ready ? (on ? 240 : 165) : 85);
            g.lineWidth = 4;
            const arm = R * 0.48;
            for (let q = 0; q < 4; q++) {
                const ux = q & 1 ? 1 : -1;
                const uy = q & 2 ? 1 : -1;
                const qxx = ax + ux * R;
                const qyy = ay + uy * R;
                g.moveTo(qxx - ux * arm, qyy);
                g.lineTo(qxx, qyy);
                g.lineTo(qxx, qyy - uy * arm);
            }
            g.stroke();
            g.fillColor = this.pal.get(on ? COL.accent : GREY, ready ? 250 : 90);
            g.circle(ax, ay, 4);
            g.fill();

            if (on) {
                // The lock ring is colour-coded by what the chain would do with this one, which is the
                // §6.2 read the 兽魂 used to carry: gold folds into a live stack, white opens a segment,
                // grey means the chain is full and it will only be worth 融核. An elite that has not been
                // A boss is the one ink-coloured refusal, permanently: everything else the ball
                // touches joins the party, so the ring only has to say which kind of catch it is.
                const noGo = e.boss[victim] === 1 && !e.wildBossReady[victim];
                const kind = this.classify(e.fam[victim], e.tier[victim], !!e.shiny[victim]);
                g.strokeColor = this.pal.get(noGo ? COL.ink
                    : kind === 'stack' ? COL.gold : kind === 'new' ? COL.heroTrim : GREY, 235);
                g.lineWidth = 6;
                g.circle(e.x[victim], e.y[victim], e.r[victim] + 15);
                g.stroke();
            }

            this.drawMegaSkillPreview(g);
            drawMegaScreenEffects(this, g);

            // §7.1-4: a foldable stack lights in the 进化 colour on the one link E would spend.
            if (this.evo >= 0) {
                const cn = this.chain;
                const n = cn.headOf(this.evo);
                if (n >= 0) {
                    const pulse = 110 + Math.round(100 * (0.5 + 0.5 * Math.sin(this.time * 6)));
                    g.strokeColor = this.pal.get(COL.accent, pulse);
                    g.lineWidth = 4;
                    g.circle(cn.nx[n], cn.ny[n], 20);
                    g.stroke();
                }
            }
        }

        /** Friendly signature move telegraphs use the same shapes as their hit geometry. */
        drawLegendaryCompanionWarnings (g) {
            for (const segment of this.chain.segments) {
                const attack = segment.legendaryBombardment;
                if (!hasCompanionSignature(segment) || !attack
                    || (attack.phase !== 'warning' && attack.phase !== 'impact')) continue;
                const impact = attack.phase === 'impact';
                const progress = impact ? 1 : Math.max(0, Math.min(1, 1 - attack.timer / WARNING_SECONDS));
                const fade = impact ? Math.max(0, Math.min(1, attack.timer / IMPACT_SECONDS)) : 1;
                const seed = ((attack.x * 0.0017 + attack.y * 0.0009) % TAU + TAU) % TAU;
                const pulse = 0.78 + 0.22 * Math.sin(this.wall * 4.6 + seed);
                const subLegendary = isSubLegendaryCompanion(segment);
                const tierAlpha = subLegendary ? 0.78 : 1;
                const color = attack.color || ELEMENT[family(segment.fam)?.element] || COL.gold;
                const fillAlpha = Math.round((impact ? 65 * fade : 22 + progress * 24 + pulse * 4) * tierAlpha);
                const edgeAlpha = Math.round((impact ? 210 * fade : 124 + progress * 92 + pulse * 12) * tierAlpha);

                // Corridors are broad filled lanes, so beams read as attacks with direction rather
                // than a generic locked circle. The boundary is computed from the actual hit shape.
                for (const beam of attack.corridors || []) {
                    const ux = Math.cos(beam.angle);
                    const uy = Math.sin(beam.angle);
                    const px = -uy * beam.width * 0.5;
                    const py = ux * beam.width * 0.5;
                    const endX = beam.x + ux * beam.length;
                    const endY = beam.y + uy * beam.length;
                    g.moveTo(beam.x + px, beam.y + py);
                    g.lineTo(endX + px, endY + py);
                    g.lineTo(endX - px, endY - py);
                    g.lineTo(beam.x - px, beam.y - py);
                    g.lineTo(beam.x + px, beam.y + py);
                    g.fillColor = this.pal.get(color, fillAlpha);
                    g.fill();
                    g.strokeColor = this.pal.get(impact ? '#fff0c2' : color, edgeAlpha);
                    g.lineWidth = impact ? (isSubLegendaryCompanion(segment) ? 2.8 : 4)
                        : (isSubLegendaryCompanion(segment) ? 1.5 : 2.2);
                    g.stroke();

                    // A travelling highlight makes long signature lanes feel charged before impact.
                    const travel = Math.max(0.06, progress) * beam.length;
                    const hx = beam.x + ux * travel;
                    const hy = beam.y + uy * travel;
                    g.strokeColor = this.pal.get('#fff8d7', impact ? 230 : Math.round(76 + progress * 100));
                    g.lineWidth = impact ? (subLegendary ? 2.4 : 3.2) : (subLegendary ? 1.3 : 1.8);
                    g.moveTo(hx - px * 0.58, hy - py * 0.58);
                    g.lineTo(hx + px * 0.58, hy + py * 0.58);
                    g.stroke();
                }

                // Multi-point moves retain their real, separate hit zones on the floor.
                for (let i = 0; i < (attack.areas || []).length; i++) {
                    const area = attack.areas[i];
                    const breathe = impact ? 1.06 : 0.94 + 0.06 * Math.sin(this.wall * 7 + i + seed);
                    g.fillColor = this.pal.get(color, fillAlpha);
                    g.circle(area.x, area.y, area.radius * breathe);
                    g.fill();
                    g.strokeColor = this.pal.get(impact ? '#fff0c2' : color, edgeAlpha);
                    g.lineWidth = impact ? (isSubLegendaryCompanion(segment) ? 2.5 : 3.6)
                        : (isSubLegendaryCompanion(segment) ? 1.35 : 1.8);
                    g.circle(area.x, area.y, area.radius * breathe);
                    g.stroke();
                }

                // Each move gets a small signature stroke: phoenix flare, dragon dive, earth fissure,
                // temporal ticks, or the spatial cross. These never replace the readable hit shape.
                const motif = attack.pattern;
                if (motif === 'sacred-fire' || motif === 'dragon-ascent' || motif === 'precipice-blades') {
                    const angle = attack.angle || 0;
                    const length = motif === 'dragon-ascent' ? 110 : 76;
                    const count = motif === 'precipice-blades' ? 5 : 3;
                    g.strokeColor = this.pal.get(impact ? '#fff0c2' : color,
                        impact ? 238 : Math.round(78 + progress * 100));
                    g.lineWidth = impact ? 3 : 1.8;
                    for (let i = 0; i < count; i++) {
                        const offset = (i - (count - 1) / 2) * 19;
                        const cx = attack.x + Math.cos(angle + Math.PI / 2) * offset;
                        const cy = attack.y + Math.sin(angle + Math.PI / 2) * offset;
                        const lift = motif === 'dragon-ascent' ? -length : length * 0.5;
                        g.moveTo(cx - Math.cos(angle) * length * 0.5, cy - Math.sin(angle) * length * 0.5);
                        g.lineTo(cx + Math.cos(angle) * lift, cy + Math.sin(angle) * lift);
                    }
                    g.stroke();
                } else if (motif === 'origin-pulse' || motif === 'psychic-burst' || motif === 'judgment') {
                    g.fillColor = this.pal.get('#fff8d7', impact ? 238 : Math.round(72 + progress * 104));
                    const count = motif === 'origin-pulse' ? 3 : 5;
                    for (let i = 0; i < count; i++) {
                        const a = seed + i * TAU / count + this.wall * (motif === 'psychic-burst' ? 0.34 : 0.08);
                        const distance = motif === 'psychic-burst' ? 37 : 28;
                        g.circle(attack.x + Math.cos(a) * distance, attack.y + Math.sin(a) * distance,
                            motif === 'judgment' ? 4 : 3.2);
                    }
                    g.fill();
                } else if (motif === 'roar-of-time') {
                    const a = attack.angle || 0;
                    g.strokeColor = this.pal.get('#fff8d7', impact ? 238 : Math.round(94 + progress * 100));
                    g.lineWidth = 2;
                    for (let i = 0; i < 7; i++) {
                        const t = i / 6;
                        const x = attack.x - Math.cos(a) * (attack.radius * (0.22 + t * 0.76));
                        const y = attack.y - Math.sin(a) * (attack.radius * (0.22 + t * 0.76));
                        const side = (i % 2 ? 1 : -1) * (8 + t * 10);
                        g.moveTo(x - Math.sin(a) * side, y + Math.cos(a) * side);
                        g.lineTo(x + Math.sin(a) * side, y - Math.cos(a) * side);
                    }
                    g.stroke();
                }
            }
        }

        drawEntities () {
            const b = this.batch;
            const ch = this.chain;
            const e = this.enemies;
            const c = this.capture;
            const p = this.player;
            const body = Math.round(255 * CHAIN.alpha);

            // Back-to-front: the horde, then what it left standing, then the tail that owns them.
            b.begin();
            drawPersistentSkillFields(this, b);
            if (!this.legendaryMap.active) {
                for (const site of this.legendaryLairs.sites) {
                    if (site.complete || Math.hypot(site.x - p.x, site.y - p.y) >= 760 / this.cam.z) continue;
                    const pulse = 1 + 0.08 * Math.sin(this.wall * 4);
                    b.draw('aura', site.x, site.y, 2.8 * pulse, 2.8 * pulse, 0,
                        this.pal.get(COL.gold, 75));
                    b.draw('field', site.x, site.y, 2.1, 2.1, this.wall * 0.18,
                        this.pal.get(COL.gold, 150));
                    b.draw('ring', site.x, site.y, 1.55 * pulse, 1.55 * pulse,
                        -this.wall * 0.4, this.pal.get(COL.heroTrim, 240));
                    b.draw('star', site.x, site.y, 0.8, 0.8, this.wall * 0.5,
                        this.pal.get(COL.gold, 255));
                }
            }
            for (let i = 0; i < e.n; i++) {
                const el = e.elite[i] === 1;
                const bo = e.boss[i] === 1;
                const trainer = e.trainer[i] === 1;
                const trainerMega = trainer && this.trainerBoss.isMegaSlot(e.trainerSlot[i]);
                // Glyphs are 48 px wide at scale 1, so this keeps the sprite and the collision circle
                // the same size - the sweep reads honestly only if the picture matches the hitbox.
                // Species art raises a floor under that instead (FORM_MIN); every other path is left
                // exactly where the §9 measurements found it.
                const lit = e.flash[i] > 0 ? 1 : 0;
                // With real species art the silhouette carries "which 族, which 阶", so the tint goes
                // back to being one thing only: cold, i.e. not yours.
                const trainerForm = trainerMega ? this.trainerBoss.megaForm : null;
                const enemyFamily = FAMILIES[e.fam[i]];
                const mewtwoEncounter = bo && e.legendary[i] && enemyFamily && enemyFamily.id === 'legend-mewtwo';
                const lugiaEncounter = bo && e.legendary[i] && enemyFamily && enemyFamily.id === 'legend-lugia';
                const kyogreEncounter = bo && e.legendary[i] && enemyFamily && enemyFamily.id === 'legend-kyogre';
                const mewtwoMegaY = mewtwoEncounter && !e.intro[i]
                    && (!e.legendaryReady[i] || this.legendaryMap.mewtwoRevert > 0.52)
                    && this.atlas.glyphs.MEWTWO_MEGA_Y;
                const iconBase = mewtwoMegaY ? 'MEWTWO_MEGA_Y' : bo ? (e.legendary[i] || e.wildBoss[i] ? iconKey(enemyFamily && enemyFamily.id, 1)
                        : BOSS_SPECIES.key) : trainerForm ? trainerForm.icon
                        : iconKey(FAMILIES[e.fam[i]] && FAMILIES[e.fam[i]].id, e.tier[i]);
                const wildShinyIcon = !bo && !trainer && e.shiny[i] && iconBase ? shinyKey(iconBase) : null;
                const iconCandidate = wildShinyIcon && this.atlas.glyphs[wildShinyIcon] ? wildShinyIcon : iconBase;
                const icon = this.icons && iconCandidate && this.atlas.glyphs[iconCandidate] ? iconCandidate : null;
                const scale = (icon ? Math.max(e.r[i] / 24, formMin(e.tier[i]) / 48) : e.r[i] / 24)
                    * (e.wildBoss[i] ? 1.14 : 1)
                    * (trainerMega ? 1.16 : 1);
                const body = icon ? (e.shiny[i] ? ICON_TINT
                    : bo && enemyFamily && enemyFamily.id === 'legend-hooh' ? '#fff4d6'
                        : bo ? HORDE_TINT_BOSS : trainer ? '#e7a1a1' : el ? HORDE_TINT_ELITE : HORDE_TINT)
                    : (trainer ? '#bd4c5a' : el || bo ? COL.enemyElite : COL.enemy);
                const bob = Math.sin(this.time * 7 + i * 1.3) * (bo ? 0.6 : el ? 1.2 : 2);
                let drawY = e.y[i] + bob;
                const trainerMegaOutline = trainerMega && drawMegaFormOutline(b, this.pal,
                    this.atlas.glyphs, trainerForm, icon, e.x[i], e.y[i] + bob, scale,
                    scale * (1 - 0.06 * Math.sin(this.time * 7 + i)), this.wall, i);
                const hoohEncounter = bo && e.legendary[i] && enemyFamily && enemyFamily.id === 'legend-hooh';
                const hoohSpecial = this.legendaryMap.hoohSpecial;
                if (hoohEncounter && e.intro[i] && this.legendaryMap.hoohIntro > 0) {
                    const duration = this.legendaryMap.hoohIntroDuration || 2.4;
                    const progress = Math.max(0, Math.min(1, 1 - this.legendaryMap.hoohIntro / duration));
                    const eased = progress * progress * (3 - 2 * progress);
                    drawY += 218 * (1 - eased);
                    b.draw('aura', e.x[i], drawY, scale * 3.0, scale * 2.1, 0,
                        this.pal.get('#ffd579', Math.round(38 + progress * 66)));
                    for (let mote = 0; mote < 5; mote++) {
                        const t = (progress * 1.3 + mote / 5) % 1;
                        const angle = mote * TAU / 5 + progress * 1.8;
                        const reach = scale * (1.45 - t * 0.35);
                        b.draw(mote % 2 ? 'feather' : 'star',
                            e.x[i] + Math.cos(angle) * reach,
                            drawY + Math.sin(angle) * reach,
                            mote % 2 ? scale * 0.43 : 0.3 + progress * 0.12,
                            mote % 2 ? scale * 0.19 : 0.3 + progress * 0.12,
                            angle, this.pal.get(mote % 2 ? '#ffe5a0' : '#fff8cf', Math.round(165 * (1 - t))));
                    }
                } else if (hoohEncounter && hoohSpecial.active) {
                    const lift = 164;
                    if (hoohSpecial.phase === 'lift') {
                        const progress = 1 - hoohSpecial.timer / hoohSpecial.phaseDuration;
                        drawY += lift * Math.max(0, Math.min(1, progress));
                    } else if (hoohSpecial.phase === 'return') {
                        const progress = 1 - hoohSpecial.timer / hoohSpecial.phaseDuration;
                        drawY += lift * (1 - Math.max(0, Math.min(1, progress)));
                    } else {
                        drawY += lift + Math.sin(this.wall * 7) * 7;
                    }
                    if (hoohSpecial.phase === 'warning' || hoohSpecial.phase === 'fall'
                        || hoohSpecial.phase === 'pause') {
                        const breath = 1 + 0.06 * Math.sin(this.wall * 8);
                        b.draw('aura', e.x[i], drawY, scale * 3.65 * breath,
                            scale * 2.5 * breath, 0, this.pal.get('#ffca5d', 92));
                        const wingRootY = drawY + scale * 0.11;
                        for (const side of [-1, 1]) {
                            const rootX = e.x[i] + side * scale * 0.28;
                            for (let feather = 0; feather < 7; feather++) {
                                const t = feather / 6;
                                const rightAngle = -0.24 + t * 0.91;
                                const angle = side > 0 ? rightAngle : Math.PI - rightAngle;
                                const length = scale * (1.08 + t * 0.46);
                                const centerX = rootX + Math.cos(angle) * length * 0.48;
                                const centerY = wingRootY + Math.sin(angle) * length * 0.48;
                                const tint = feather % 3 === 0 ? '#fff2bf'
                                    : feather % 2 ? '#ffd36b' : '#f39b43';
                                b.draw('feather', centerX, centerY,
                                    scale * (1.22 + t * 0.2), scale * 0.29, angle,
                                    this.pal.get(tint, 222));
                            }
                        }
                        for (let spark = 0; spark < 9; spark++) {
                            const angle = this.wall * 0.72 + spark * TAU / 9;
                            const reach = scale * (2.05 + 0.15 * Math.sin(this.wall * 5 + spark));
                            b.draw('star', e.x[i] + Math.cos(angle) * reach,
                                drawY + Math.sin(angle) * reach, 0.26, 0.26, angle,
                                this.pal.get('#fff1b8', 212));
                        }
                    }
                }
                if (mewtwoEncounter && icon) {
                    const introDuration = this.legendaryMap.mewtwoIntroDuration || 3.6;
                    const charge = e.intro[i]
                        ? Math.max(0, Math.min(1, (introDuration - this.legendaryMap.mewtwoIntro) / introDuration))
                        : mewtwoMegaY ? 0.68 + 0.16 * Math.sin(this.wall * 4) : 0.24;
                    const pulse = 1 + charge * 0.16 + 0.025 * Math.sin(this.wall * 8);
                    b.draw('aura', e.x[i], e.y[i] + bob, scale * (1.85 + charge * 0.5),
                        scale * (1.85 + charge * 0.5), 0, this.pal.get('#bd8be9', Math.round(45 + charge * 76)));
                    b.draw(icon, e.x[i], e.y[i] + bob, scale * pulse, scale * pulse, 0,
                        this.pal.get('#d8b1ff', Math.round(48 + charge * 92)));
                    if (e.intro[i]) {
                        const elapsed = introDuration - this.legendaryMap.mewtwoIntro;
                        const halfW = VIEW.W * 0.5 / this.cam.z;
                        const halfH = VIEW.H * 0.5 / this.cam.z;
                        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
                        for (let particle = 0; particle < 56; particle++) {
                            const launch = particle / 56 * introDuration * 0.72;
                            const travel = Math.max(0, Math.min(1,
                                (elapsed - launch) / (introDuration * 0.28)));
                            if (elapsed < launch || travel >= 1) continue;
                            const angle = particle * goldenAngle + 0.37;
                            const dx = Math.cos(angle), dy = Math.sin(angle);
                            const edge = Math.min(halfW / Math.max(0.001, Math.abs(dx)),
                                halfH / Math.max(0.001, Math.abs(dy)));
                            const curve = Math.sin(travel * Math.PI) * 22 / this.cam.z;
                            const x = this.cam.x + dx * edge + -dy * curve
                                + (e.x[i] - this.cam.x - dx * edge) * travel;
                            const y = this.cam.y + dy * edge + dx * curve
                                + (e.y[i] - this.cam.y - dy * edge) * travel;
                            const size = 0.14 + Math.sin(travel * Math.PI) * 0.17;
                            const alpha = Math.round(70 + Math.sin(travel * Math.PI) * 185);
                            b.draw('star', x, y, size, size, angle + this.wall * 0.8,
                                this.pal.get(particle % 4 === 0 ? '#d8fbff' : '#e4c7ff', alpha));
                        }
                    }
                }
                if (lugiaEncounter && icon && e.intro[i]) {
                    const introDuration = this.legendaryMap.lugiaIntroDuration || 3.7;
                    const elapsed = introDuration - this.legendaryMap.lugiaIntro;
                    const charge = Math.max(0, Math.min(1, elapsed / introDuration));
                    const ripple = 1.45 + charge * 0.48 + 0.04 * Math.sin(this.wall * 5);
                    b.draw('aura', e.x[i], e.y[i] - 5, scale * (2.8 + charge * 0.8),
                        scale * (1.45 + charge * 0.34), 0,
                        this.pal.get('#63dcf2', Math.round(30 + charge * 58)));
                    b.draw('ring', e.x[i], e.y[i] - 5, scale * ripple * 1.4,
                        scale * ripple * 0.76, 0, this.pal.get('#a7f7ff', Math.round(80 + charge * 120)));
                    drawY -= (1 - charge) * scale * 0.85;
                    const halfW = VIEW.W * 0.5 / this.cam.z;
                    const halfH = VIEW.H * 0.5 / this.cam.z;
                    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
                    for (let particle = 0; particle < 56; particle++) {
                        const launch = particle / 56 * introDuration * 0.70;
                        const travel = Math.max(0, Math.min(1,
                            (elapsed - launch) / (introDuration * 0.30)));
                        if (elapsed < launch || travel >= 1) continue;
                        const angle = particle * goldenAngle + 0.37;
                        const dx = Math.cos(angle), dy = Math.sin(angle);
                        const edge = Math.min(halfW / Math.max(0.001, Math.abs(dx)),
                            halfH / Math.max(0.001, Math.abs(dy)));
                        const startX = this.cam.x + dx * edge;
                        const startY = this.cam.y + dy * edge;
                        const curve = Math.sin(travel * Math.PI) * 25 / this.cam.z;
                        const x = startX + (e.x[i] - startX) * travel - dy * curve;
                        const y = startY + (e.y[i] - startY) * travel + dx * curve;
                        const size = 0.13 + Math.sin(travel * Math.PI) * 0.13;
                        const alpha = Math.round(75 + Math.sin(travel * Math.PI) * 170);
                        b.draw(particle % 3 === 0 ? 'star' : 'diamond', x, y, size, size,
                            angle + this.wall * 0.65,
                            this.pal.get(particle % 4 === 0 ? '#e2ffff' : '#74dcff', alpha));
                    }
                }
                if (kyogreEncounter && !e.legendaryReady[i]) {
                    // Animated ellipses sit below Kyogre like widening surface ripples instead of
                    // the generic opaque legendary aura, which reads as a bubble on the water art.
                    for (let ripple = 0; ripple < 2; ripple++) {
                        const phase = (this.wall * 0.36 + ripple * 0.5) % 1;
                        b.draw('ring', e.x[i], drawY - scale * 0.12,
                            scale * (1.0 + phase * 1.25), scale * (0.46 + phase * 0.36), 0,
                            this.pal.get(ripple ? '#8be9ff' : '#d0fbff', Math.round(92 * (1 - phase))));
                    }
                }
                b.draw(icon || (bo ? 'blob' : el ? 'diamond' : MOB_GLYPH[Math.min(3, e.tier[i] - 1)]),
                    e.x[i], drawY, scale, scale * (1 - 0.06 * Math.sin(this.time * 7 + i)), 0,
                    this.pal.get(lit ? COL.heroTrim : body));
                if (el && !bo) {
                    // The 精英 used to be the only diamond on the field. Now that its 2 阶 silhouette is
                    // the same art language as everything else, the ball's target needs its own mark.
                    b.draw('ring', e.x[i], e.y[i], scale * 1.12, scale * 1.12, 0, this.pal.get(COL.ink, 105));
                }
                if (trainer) {
                    if (trainerMega && !trainerMegaOutline) {
                        const pulse = 1 + 0.12 * Math.sin(this.wall * 7);
                        b.draw('aura', e.x[i], e.y[i], scale * 2.25 * pulse, scale * 2.25 * pulse,
                            0, this.pal.get(trainerForm.color, 80));
                        b.draw('ring', e.x[i], e.y[i], scale * 1.17, scale * 1.17, 0,
                            this.pal.get(trainerForm.color, 245));
                    } else if (!trainerMega) {
                        b.draw('ring', e.x[i], e.y[i], scale * 1.17, scale * 1.17, 0,
                            this.pal.get('#d84a55', 230));
                    }
                }
                if (bo) {
                    // Grey-box 3:00 BOSS. `cross` is the one glyph in the atlas that no pet, no mob 阶 and
                    // no elite wears, so the silhouette alone carries "this one is not for catching" -
                    // which is the read the ball's clang has to agree with (§9.5's shape rule).
                    // With the icon atlas in, the BOSS is 班基拉斯: a species nothing else in the horde
                    // wears, so the mark is redundant and the ring/bar carry the claim instead.
                    const bossVisualY = hoohEncounter ? drawY : e.y[i];
                    if (!icon) b.draw('cross', e.x[i], bossVisualY, scale * 0.78, scale * 0.78, 0,
                        this.pal.get(lit ? COL.ink : COL.gold, 235));
                    if (!hoohEncounter && !kyogreEncounter) {
                        b.draw('ring', e.x[i], bossVisualY, scale * 1.16, scale * 1.16, 0,
                            this.pal.get(COL.ink, 210));
                    }
                    if ((e.legendary[i] || e.wildBoss[i]) && !hoohEncounter && !kyogreEncounter) {
                        const pulse = 1 + 0.08 * Math.sin(this.wall * 5);
                        const color = ELEMENT[FAMILIES[e.fam[i]].element];
                        const ready = e.legendaryReady[i] || e.wildBossReady[i];
                        b.draw('aura', e.x[i], bossVisualY, scale * (e.wildBoss[i] ? 2.8 + pulse : 2.0 + pulse),
                            scale * (e.wildBoss[i] ? 2.8 + pulse : 2.0 + pulse), 0,
                            this.pal.get(color, ready ? 175 : (e.wildBoss[i] ? 125 : 75)));
                        if (e.wildBoss[i]) {
                            // Double element-colored beacon lets a roaming sub-legendary stand out
                            // from the horde before its dash warning starts.
                            b.draw('ring', e.x[i], bossVisualY, scale * (1.72 + pulse * 0.08),
                                scale * (1.72 + pulse * 0.08), -this.wall * 0.45,
                                this.pal.get(color, ready ? 245 : 225));
                            b.draw('ring', e.x[i], bossVisualY, scale * (2.05 + pulse * 0.12),
                                scale * (2.05 + pulse * 0.12), this.wall * 0.3,
                                this.pal.get(COL.gold, ready ? 230 : 175));
                        }
                    }
                    if (e.bph[i] === 1 && !e.legendaryReady[i] && !e.wildBossReady[i]) {
                        // 蓄力: one ring collapsing onto the body over exactly `BOSS.windup`, i.e. the
                        // dodge window drawn as an object. It is gold so it reads with the 晋升 glow family
                        // and against the ink of the boss's own ring.
                        const k = Math.max(0, e.btm[i]) / BOSS.windup;
                        b.draw('ring', e.x[i], bossVisualY, scale * (1.3 + 3.4 * k), scale * (1.3 + 3.4 * k), 0,
                            this.pal.get(COL.gold, 90 + Math.round(150 * (1 - k))));
                    }
                } else if (el) {
                    b.draw('ring', e.x[i], e.y[i], scale * 1.25, scale * 1.25, 0,
                        this.pal.get(e.weaken[i] > 0 ? COL.gold : COL.ink, e.weaken[i] > 0 ? 230 : 90));
                }
                if (e.shiny[i]) {
                    const pulse = 1 + 0.09 * Math.sin(this.wall * 7 + i);
                    b.draw('aura', e.x[i], e.y[i], scale * 2.15 * pulse, scale * 2.15 * pulse,
                        0, this.pal.get(SHINY_GOLD, 96));
                    b.draw('ring', e.x[i], e.y[i], scale * 1.34 * pulse, scale * 1.34 * pulse,
                        -this.wall * 0.8, this.pal.get(SHINY_GOLD, 250));
                    for (let spark = 0; spark < 3; spark++) {
                        const a = this.wall * 1.2 + spark * TAU / 3 + i;
                        b.draw('star', e.x[i] + Math.cos(a) * scale * 1.65,
                            e.y[i] + Math.sin(a) * scale * 1.65, 0.32, 0.32, a,
                            this.pal.get('#fff9d6', 245));
                    }
                }
            }

            // A flying ball reads as a ball: a hard body, a spin, and two ghosts of the road it has
            // already covered behind it. The trail is along its own velocity, not toward the tail,
            // because the whole point of v0.4 is that the ball goes where it was thrown and not where
            // you were.
            for (let i = 0; i < c.bn; i++) {
                const s = (c.br[i] * 2) / 48;
                if (c.holding(i)) {
                    // Settled on the animal it took. No ghosts - a stopped ball dragging a comet behind
                    // it contradicts the one thing the trail was there to say.
                    //
                    // It rocks on its own rim, not about its own centre, because that is the difference
                    // between an animation and a screenshot: the band is `0.26r` thick, which at the
                    // opening ball radius is ~2.6 device px, so a pure rotation moves almost no pixels.
                    // Pivoting the disc sends the whole body 0.47r sideways - five times that.
                    const t = c.tilt(i);
                    const h = c.br[i];
                    b.draw(this.pokeball ? 'pokeball' : 'ball', c.bx[i] - h * Math.sin(t),
                        c.by[i] - h * (1 - Math.cos(t)), s, s, t,
                        this.pokeball ? null : this.pal.get(COL.accent, 255));
                    continue;
                }
                const sp = Math.sqrt(c.bvx[i] * c.bvx[i] + c.bvy[i] * c.bvy[i]) || 1;
                const ux = c.bvx[i] / sp;
                const uy = c.bvy[i] / sp;
                const rot = c.bt[i] * 11;
                for (let k = 2; k >= 0; k--) {
                    if (k > 0) {
                        b.draw('ring', c.bx[i] - ux * k * 13, c.by[i] - uy * k * 13,
                            s * 0.7, s * 0.7, rot, this.pal.get(COL.dim, Math.round(70 / k)));
                    } else {
                        b.draw(this.pokeball ? 'pokeball' : 'ball', c.bx[i], c.by[i], s, s, rot,
                            this.pokeball ? null : this.pal.get(COL.accent, 255));
                    }
                }
            }

            const tail = this._tail;
            // Keep Z projectile silhouettes in the shared draw batch; their outlined core stays
            // identifiable above the shortened, reduced-density particle trail.
            const sk = this.skills;
            drawZMoveEffects(b, this.pal, this.zMoves, this.wall);
            drawMegaEffects(this, b, {
                activeSkillForForm: resolveActiveSkillForForm,
                activeSkillModuleForForm,
                drawMegaActiveArea,
            });
            this.trainerBoss.drawProjectiles(b, this.pal);
            this.trainerBoss.drawTrainer(b, this.pal, this.atlas.glyphs, this.time);
            drawCakePickups(this, b);
            for (let i = 0; i < c.n; i++) {
                // The animal a ball just took, on its way into the line. This one *does* home, and it
                // stretches along that heading with two ghosts, because "it really joined the chain"
                // has to be visible from wherever the player is looking.
                const dx = tail.x - c.x[i];
                const dy = tail.y - c.y[i];
                const d = Math.sqrt(dx * dx + dy * dy) || 1;
                const rot = Math.atan2(dy, dx);
                const base = c.gold[i] ? COL.gold : ELEMENT[FAMILIES[c.fam[i]].element];
                const sl = 0.4 + 0.1 * c.tier[i];
                for (let k = 2; k >= 0; k--) {
                    b.draw('blob', c.x[i] - (dx / d) * k * 14, c.y[i] - (dy / d) * k * 14,
                        sl * 1.6, sl / 1.6, rot,
                        this.pal.get(base, k === 0 ? 255 : Math.round(255 * 0.28 / k)));
                }
            }

            // Use the same native geometry in combat and the Pokédex preview.
            drawSkillEffects(this, b);
            // Boss-only source accents stay in the live world pass: they decorate the locked
            // telegraph without leaking into the Pokédex preview or becoming a second hitbox.
            drawPrimaryLegendaryBossAttack(b, this.pal, this.legendaryAttacks, this.wall);
            drawSubLegendaryBossAttack(b, this.pal, this.legendaryAttacks, this.wall);

            const lastNode = ch.nCount - 1;
            // 遮挡淡出：有野生怪压在队伍节点上时，该节点的精灵画成半透明，
            // 让底下的怪透出来——「我的精灵挡住了，看不到身边有没有小怪」的解法。
            const occlQ = this._occlQ || (this._occlQ = []);
            const nodeOccluded = (ni) => {
                occlQ.length = 0;
                this.enemies.grid.query(ch.nx[ni], ch.ny[ni], 56 + MAX_BODY_R, occlQ);
                for (let k = 0; k < occlQ.length; k++) {
                    const j = occlQ[k];
                    if (this.enemies.dead[j] || this.enemies.trainer[j]) continue;
                    const dx = this.enemies.x[j] - ch.nx[ni];
                    const dy = this.enemies.y[j] - ch.ny[ni];
                    if (dx * dx + dy * dy < 46 * 46) return true;
                }
                return false;
            };
            for (let i = 0; i < ch.nCount; i++) {
                const si = ch.segIndex[i];
                const s = ch.segments[si];
                const head = si === 0;
                const visual = ch.visualOf(s);
                // A 段 is a stack of dozens of pets but used to draw exactly one sprite for it, so
                // most catches changed no pixel at all - "抓到有没有用" was unanswerable by looking.
                // The node is now a pack that gains an animal every 3 只, and the animals shrink as
                // they crowd so a lone starter keeps the old size.
                // A 满线 段 is the exception the player named (「同一类型的如果不能进化也要合在一起，改变的是
                // 体型」): one animal, no crowd divisor, and its 只数 buys size. The size term is *added after*
                // the 阶 floor below rather than folded into `base`, because that floor (34-45 px) is what the
                // first two rungs of growth would otherwise disappear under - the same "read the pixel, not
                // the formula" trap as §9.11-⑨'s icon floor. `bulk` is what the 主技 radii read; the aura and
                // the 甩尾 hitbox read `chain.radiusOf`, which is that same bulk plus the √(节圆 it swallowed),
                // so a merged body's *reach* is allowed to outgrow its drawing - it is paying for the discs
                // that stopped walking, not for a second set of them.
                const bulk = ch.visualBulkOf(s);
                const merged = bulk > visual;
                const legendary = isLegendaryCompanion(s);
                const companionCount = ch.companionCountOf(s);
                const pack = legendary ? 1 : merged || companionCount > 0 || ch.hasCatchCompanions(s)
                    ? 1 : Math.min(4, 1 + Math.floor(s.count / 3));
                const base = PET_SCALE + 0.05 * (visual - 1) + 0.06 * (s.tier - 1);
                const mega = megaFormForSegment(s);
                const gigantamax = gigantamaxFormForSegment(s);
                const charizardXFlightFx = mega?.id === 'charizard-x'
                    ? this.megaFx.find((fx) => fx.active && fx.shape === 'charizard-x-cross'
                        && fx.sourceSegment === s) : null;
                const charizardXFlight = charizardXFlightFx
                    ? charizardXFlightPose(charizardXFlightFx) : { amount: 0, lift: 0, scale: 1 };
                const legendaryArrival = legendary ? Math.max(0, s.legendaryCatchFx || 0) : 0;
                const combatForm = mega || gigantamax;
                const gigaEntry = gigantamax && s.gigaEntry ? s.gigaEntry : null;
                const entryProgress = gigaEntry ? Math.min(1, gigaEntry.elapsed / 0.52) : 1;
                const entryEase = 1 - Math.pow(1 - entryProgress, 3);
                const entryScale = gigaEntry ? 0.035 + entryEase * 0.965 : 1;
                const entryLift = gigaEntry && gigaEntry.elapsed >= 0.52 && gigaEntry.elapsed < 0.82
                    ? 58 * (gigaEntry.elapsed < 0.7
                        ? Math.sin(((gigaEntry.elapsed - 0.52) / 0.18) * Math.PI / 2)
                        : 1 - ((gigaEntry.elapsed - 0.7) / 0.12) ** 2)
                    : 0;
                const impactAge = gigaEntry ? gigaEntry.elapsed - 0.82 : 1;
                const impactPulse = gigaEntry && impactAge >= 0
                    ? Math.exp(-impactAge * 13) * Math.cos(impactAge * 24) : 0;
                const impactFlash = gigaEntry && impactAge >= 0 ? Math.exp(-impactAge * 9) : 0;
                const entrySqueezeX = gigaEntry && gigaEntry.impactDone ? 1 + impactPulse * 0.32 : 1;
                const entrySqueezeY = gigaEntry && gigaEntry.impactDone ? 1 - impactPulse * 0.26 : 1;
                const dynamax = this.dynamax.segment === s && this.dynamax.remaining > 0;
                const selectedMegaHead = this.selectedMega === s && ch.headOf(si) === i;
                const iconBase = mega ? mega.icon : gigantamax && gigantamax.icon || iconKey(s.fam, s.tier);
                const partyShinyIcon = s.shiny && iconBase ? shinyKey(iconBase) : null;
                const icon = this.icons
                    ? (partyShinyIcon && this.atlas.glyphs[partyShinyIcon] ? partyShinyIcon : iconBase) : null;
                const megaEvolutionFx = s.megaEvolutionFx;
                const isMegaEvolutionHead = !!megaEvolutionFx && ch.headOf(si) === i;
                const megaEvolution = isMegaEvolutionHead ? megaEvolutionVisual(megaEvolutionFx) : null;
                const evolutionFx = s.evolutionFx;
                const isEvolutionHead = !!evolutionFx && ch.headOf(si) === i;
                const evolution = isEvolutionHead ? evolutionVisual(evolutionFx) : null;
                const sourceIcon = megaEvolution && megaEvolution.progress < 0.42
                    ? megaEvolutionFx.oldIcon : null;
                const shownIcon = sourceIcon && this.atlas.glyphs[sourceIcon] ? sourceIcon : icon;
                // Same floor as the horde, applied before crowd division: a lone starter is readable,
                // while a 4-pack can still thin out so the tail does not become one continuous worm.
                // The explicit stage multiplier comes after that compression, so evolution remains
                // visually obvious even inside a full pack (the old 18.5 → 24.5 px ladder was too subtle).
                // `bulk` scales both the sprite and signature attacks; tail links are now visual/follow-only,
                // so their old collision-reach aura is intentionally absent.
                const scale = (((icon ? Math.max(base, formMin(s.tier) / 48) : base)
                    + (merged ? PET_BULK * (bulk - 1) : 0)) / (1 + 0.28 * (pack - 1)))
                    * formScale(s.tier) * (mega ? 1.22 : (gigantamax ? gigantamax.size : 1))
                    * (legendary ? legendaryBodyScale(s) * (1 + 0.15 * Math.sin((1 - legendaryArrival) * Math.PI)) : 1)
                    * (dynamax ? DYNAMAX_BAND.pokemonScale : 1) * entryScale;
                const glyph = shownIcon || TIER_GLYPH[Math.min(3, Math.max(0, s.tier - 1))];
                // A 段's species is its family, so once the art is real the 元素 tint is no longer
                // carrying identity and only gets in the way: white multiply = the icon's own colours.
                const occluded = nodeOccluded(i);
                const bodyOpacity = occluded ? Math.round((head ? 255 : body) * 0.42) : (head ? 255 : body);
                const col = this.pal.get(shownIcon ? ICON_TINT : ELEMENT[family(s.fam).element],
                    Math.round(bodyOpacity * (megaEvolution ? megaEvolution.bodyAlpha : 1)));
                const flip = Math.cos(ch.na[i]) < 0;
                // The pet that just arrived gets a landing squash on the node it landed on, because a
                // new link silently appearing in the line is the same as no feedback at all.
                const pop = i === lastNode ? this.tailPop : 0;
                // §9.16 the fold's own beat. `swing` is a damped cosine over the 0.37 s window: +1 at the
                // commit (the body stretches tall), through 0, into a squash, and it lands back on exactly
                // 1 - juice that never returns to rest is a new resting state, not feedback. Scale only:
                // no seat, no `ox/oy`, no radius moves, so §9.4's 原地踏步 law covers this animation too.
                const fx = s.fx > 0 ? s.fx : 0;
                const fv = fx > 0 ? s.fxv : null;
                const swing = fv ? Math.cos((1 - fx) * TAU * 1.5) * fx * fv.amp : 0;
                for (let k = 0; k < pack; k++) {
                    const o = PACK[k];
                    // §9.4 方案 1: one frame plus squash/stretch alternating - the whole step animation.
                    // Each animal in the pack steps out of phase, which is what makes it read as many.
                    const bob = Math.sin(this.time * 8 + i * 0.9 + k * 1.7);
                    const r = 24 * scale;
                    const px = ch.nx[i] + o[0] * r;
                    const groundY = ch.ny[i] + o[1] * r + Math.abs(bob) * 2.6 + pop * 3;
                    const py = groundY + entryLift + (megaEvolution ? megaEvolution.lift : 0)
                        + (k === 0 ? charizardXFlight.lift : 0)
                        + (evolution && k === 0 ? evolution.lift : 0);
                    if (gigaEntry && k === 0) {
                        const liftRatio = entryLift / 58;
                        const shadowScale = scale * (1.45 + liftRatio * 0.48);
                        b.draw('aura', px, groundY, shadowScale * 1.35, shadowScale * 0.42,
                            0, this.pal.get('#60452f', Math.round(46 + liftRatio * 34)));
                    }
                    if (evolution && k === 0) {
                        const riseRatio = Math.max(0, Math.min(1, evolution.lift / 46));
                        const energy = Math.max(evolution.gather * 0.78,
                            evolution.whiten * (1 - evolution.reveal) * 0.56);
                        const shadow = 48 + riseRatio * 30;
                        b.draw('aura', px, groundY, scale * (1.7 + riseRatio * 0.38),
                            scale * 0.56, 0, this.pal.get('#665038', shadow));
                        if (energy > 0.025) {
                            b.draw('beam', px, groundY + evolution.lift * 0.48,
                                scale * (1.25 + energy * 1.15), scale * 0.26,
                                Math.PI / 2, this.pal.get('#fff6ce', Math.round(42 + energy * 104)));
                            for (let mote = 0; mote < 7; mote++) {
                                const angle = this.wall * (2.4 + mote * 0.035) + mote * TAU / 7 + si * 1.73;
                                const radius = scale * (0.72 + (1 - energy) * 1.72);
                                const mx = px + Math.cos(angle) * radius;
                                const my = py + Math.sin(angle) * radius * 0.76;
                                const moteScale = 0.22 + energy * 0.16;
                                b.draw(mote % 3 === 0 ? 'shard' : 'star', mx, my,
                                    moteScale, moteScale, angle,
                                    this.pal.get(mote % 2 ? '#fff4b5' : '#a9eaff', Math.round(130 + energy * 115)));
                            }
                        }
                    }
                    if (gigantamax && gigaEntry && impactFlash > 0.015 && k === 0) {
                        const expansion = 1 + (1 - impactFlash) * 1.45;
                        const ringAlpha = Math.round(235 * impactFlash);
                        b.draw('aura', px, groundY, scale * 3.25 * expansion,
                            scale * 1.35 * expansion, 0,
                            this.pal.get('#d52bff', Math.round(105 * impactFlash)));
                        b.draw('ring', px, groundY, scale * 2.15 * expansion,
                            scale * 1.38 * expansion, this.wall * 0.2,
                            this.pal.get('#ff4c9a', ringAlpha));
                        b.draw('ring', px, groundY, scale * 3.05 * expansion,
                            scale * 1.72 * expansion, -this.wall * 0.13,
                            this.pal.get('#bc69ff', Math.round(ringAlpha * 0.82)));
                    }
                    if (selectedMegaHead && k === 0) {
                        const pulse = 1 + 0.1 * Math.sin(this.wall * 7);
                        b.draw('diamond', px, py + scale * 1.45, 0.34 * pulse, 0.34 * pulse,
                            this.wall * 0.45, this.pal.get(COL.heroTrim, 205));
                    }
                    if (legendary && k === 0) {
                        const legendaryColor = ELEMENT[family(s.fam).element] || COL.gold;
                        const pulse = 1 + 0.07 * Math.sin(this.wall * 4.2 + i);
                        b.draw('aura', px, py, scale * 4.4 * pulse, scale * 4.4 * pulse, 0,
                            this.pal.get(legendaryColor, 58));
                        b.draw('ring', px, py, scale * 2.7 * pulse, scale * 2.7 * pulse,
                            this.wall * 0.32, this.pal.get(COL.heroTrim, 225));
                        b.draw('ring', px, py, scale * 3.15 / pulse, scale * 3.15 / pulse,
                            -this.wall * 0.23, this.pal.get(legendaryColor, 205));
                        for (let star = 0; star < 4; star++) {
                            const angle = this.wall * 0.72 + star * TAU / 4 + i;
                            b.draw('star', px + Math.cos(angle) * scale * 3.25,
                                py + Math.sin(angle) * scale * 3.25, 0.42, 0.42, angle,
                                this.pal.get(COL.heroTrim, 242));
                        }
                        if (legendaryArrival > 0) {
                            const bloom = 1 + (1 - legendaryArrival) * 2.2;
                            b.draw('ring', px, py, scale * bloom, scale * bloom, 0,
                                this.pal.get(COL.heroTrim, Math.round(220 * legendaryArrival)));
                        }
                    }
                    const meowthGigantamax = gigantamax?.id === 'meowth';
                    if (dynamax && k === 0) {
                        const pulse = 0.78 + 0.22 * Math.sin(this.wall * 13 + i * 0.7);
                        b.draw('aura', px, py, scale * 4.1 * pulse, scale * 4.1 * pulse, 0,
                            this.pal.get('#ff334e', 44));
                        b.draw('ring', px, py, scale * 2.55 * pulse, scale * 2.55 * pulse,
                            this.wall * 1.8, this.pal.get('#ff9a91', 238));
                    }
                    if (s.shiny && !evolution && k === 0) {
                        const shimmer = 1 + 0.08 * Math.sin(this.wall * 7 + si);
                        b.draw('aura', px, py, scale * 2.35 * shimmer, scale * 2.35 * shimmer,
                            0, this.pal.get(SHINY_GOLD, 78));
                        b.draw('ring', px, py, scale * 1.42 * shimmer, scale * 1.42 * shimmer,
                            -this.wall * 0.7, this.pal.get(SHINY_GOLD, 228));
                        for (let sparkle = 0; sparkle < 2; sparkle++) {
                            const a = this.wall * 1.7 + sparkle * Math.PI + si;
                            b.draw('star', px + Math.cos(a) * scale * 1.85,
                                py + Math.sin(a) * scale * 1.85, 0.34, 0.34, a,
                                this.pal.get('#fff9d6', 245));
                        }
                    }
                    const flightScale = k === 0 ? charizardXFlight.scale : 1;
                    const spriteScaleX = scale * flightScale * (1 - 0.08 * bob) * (1 + 0.34 * pop)
                        * (1 - 0.72 * swing) * entrySqueezeX
                        * (1 + (evolution ? 0.56 * evolution.landing * (1 - evolution.landing) : 0));
                    const spriteScaleY = scale * flightScale * (1 + 0.08 * bob) * (1 - 0.24 * pop)
                        * (1 + swing) * entrySqueezeY
                        * (1 - (evolution ? 0.34 * evolution.landing * (1 - evolution.landing) : 0));
                    if (mega && !megaEvolution && k === 0) {
                        drawMegaFormOutline(b, this.pal, this.atlas.glyphs, mega, shownIcon,
                            px, py, spriteScaleX, spriteScaleY, this.wall, si, bodyOpacity, flip);
                    }
                    if (evolution && k === 0) {
                        const oldIcon = evolutionFx.oldIcon && this.atlas.glyphs[evolutionFx.oldIcon]
                            ? evolutionFx.oldIcon : icon;
                        const targetIcon = icon;
                        const oldGlyph = oldIcon || glyph;
                        const targetGlyph = targetIcon || glyph;
                        const oldScale = spriteScaleX * formScale(evolutionFx.fromTier) / formScale(s.tier);
                        const flipScale = evolution.flipScale;
                        const drawX = px + evolution.flipOffset * scale;
                        const sourceOpacity = megaEvolution ? megaEvolution.bodyAlpha : 1;
                        const drawLayer = (name, alpha, white, xScale) => {
                            if (alpha <= 0.015) return;
                            const tint = white ? '#fffef4'
                                : (this.atlas.glyphs[name] && (name === oldIcon || name === targetIcon)
                                    ? ICON_TINT : ELEMENT[family(s.fam).element]);
                            const layerColor = this.pal.get(tint,
                                Math.round(bodyOpacity * sourceOpacity * alpha));
                            b.draw(name, drawX, py, xScale * flipScale, spriteScaleY, 0, layerColor,
                                flip !== evolution.flipSign,
                                white ? 'evolution-white'
                                    : dynamax ? DYNAMAX_BAND.shader : gigantamax ? 'gigantamax-pokemon' : null);
                        };
                        drawLayer(oldGlyph, (1 - evolution.whiten) * (1 - evolution.morph), false, oldScale);
                        drawLayer(oldGlyph, evolution.whiten * (1 - evolution.morph), true, oldScale);
                        drawLayer(targetGlyph, evolution.morph * (1 - evolution.reveal), true, spriteScaleX);
                        drawLayer(targetGlyph, evolution.reveal, false, spriteScaleX);
                    } else {
                        b.draw(glyph, px, py, spriteScaleX, spriteScaleY, 0, col, flip,
                            dynamax ? DYNAMAX_BAND.shader : gigantamax ? 'gigantamax-pokemon' : null);
                    }
                    if (mega && !megaEvolution && k === 0) {
                        const stoneKey = `megaStone_${combatForm.id}`;
                        if (!gigantamax && this.atlas.glyphs[stoneKey]) {
                            const a = this.wall * 1.35 + i;
                            b.draw(stoneKey, px + Math.cos(a) * scale * 35,
                                py + Math.sin(a) * scale * 35, 0.58, 0.58, -a, null);
                        }
                    }
                }
                if (megaEvolution) {
                    this.drawMegaEvolutionFx(b, megaEvolutionFx, ch.nx[i],
                        ch.ny[i] + megaEvolution.lift, scale, pack, si);
                }
                // 家主鼠本体不随重复捕捉膨胀；同族小鼠在本体侧后方收拢，数量不会增加碰撞体或攻击段数。
                const partySize = ch.segments.length;
                let previousMouseHosts = 0;
                for (let previousSegment = 0; previousSegment < si; previousSegment++) {
                    if (ch.segments[previousSegment].fam === 'tandemaus') previousMouseHosts++;
                }
                const companionSide = previousMouseHosts % 2 === 0 ? 1 : -1;
                const visibleCompanions = tandemausVisibleCompanionCount(companionCount);
                const companionScale = tandemausFollowerScale(scale, companionCount, partySize);
                for (let m = 0; m < visibleCompanions; m++) {
                    const mouseIndex = tandemausVisibleCompanionIndex(m, companionCount, visibleCompanions);
                    const offset = tandemausFollowerOffset(
                        ch.na[i], scale, mouseIndex, companionCount, partySize, companionSide);
                    const motion = tandemausFollowerMotion(
                        ch.na[i], scale, m, this.time, companionCount, partySize);
                    const companionGlyph = `MAUSHOLD_COMPANION_${(mouseIndex % 4) + 1}`;
                    b.draw(companionGlyph,
                        ch.nx[i] + offset.x + motion.x,
                        ch.ny[i] + offset.y + motion.y,
                        companionScale * (1 + motion.stride * 0.07),
                        companionScale * (1 - motion.stride * 0.045),
                        0, this.pal.get(ICON_TINT, head ? 255 : body), flip);
                }
                if (fv) {
                    // One ring per 节圆 the folding 段 owns, not one per 段: what merged is the whole stack,
                    // and a three-circle pile that flashes only at its head reads as one animal levelling.
                    // Ease-out on the radius like every wave in the game, and the same two hues the waves
                    // use, so the burst cannot invent a third meaning for the player to learn.
                    const e = 1 - fx * fx;
                    const rr = scale * (1.3 + 2.5 * e);
                    b.draw('ring', ch.nx[i], ch.ny[i], rr, rr, 0,
                        this.pal.get(fv.col, Math.round(205 * fx)));
                    if (fv.bloom) {
                        // The soft disc is 铸造's alone - the one step that spends both halves of the 融核
                        // price - and it is overdraw, so it stays off the ~20 automatic folds per run.
                        b.draw('aura', ch.nx[i], ch.ny[i], scale * (2.4 + 3.2 * e), scale * (2.4 + 3.2 * e),
                            0, this.pal.get(fv.col, Math.round(110 * fx)));
                    }
                    // The flash itself, on the 段's head node only and only for the first third of the
                    // window: a moment, not a trail. Spun off the visual clock so it still turns while a
                    // panel has the run clock stopped.
                    const sp = Math.min(1, Math.max(0, (fx - 0.66) / 0.34));
                    if (sp > 0 && fv.spark && ch.nodeOfSeg[i] === 0) {
                        const rs = scale * (1.15 + 1.5 * (1 - sp));
                        b.draw('star', ch.nx[i], ch.ny[i], rs, rs, this.wall * 1.9,
                            this.pal.get(COL.heroTrim, Math.round(235 * sp)));
                    }
                }
                if (head) {
                    b.draw('ring', ch.nx[i], ch.ny[i], scale * (1.35 + 0.45 * (pack - 1)),
                        scale * (1.35 + 0.45 * (pack - 1)), 0, this.pal.get(COL.heroTrim, 150));
                }
                if (s.tier >= 4) {
                    // Four 阶 is the only thing in the run you pay 融核 for, and for five of the twelve
                    // 族 its art is the same sprite as 3 阶. A node that cost 40 核 has to be readable
                    // from the whole-screen zoom, so the ring goes gold regardless of the art.
                    const r4 = scale * (1.62 + 0.45 * (pack - 1));
                    b.draw('ring', ch.nx[i], ch.ny[i], r4, r4, 0, this.pal.get(COL.gold, 225));
                }
            }

            // The hero used to be 0.62 of a 48 px glyph: ~30 px in a 720 px frame, i.e. smaller than
            // the pets it is supposed to be leading.
            const blink = p.invuln > 0 && Math.sin(this.time * 42) > 0;
            const catTier = this.supportTier('cat');
            if (catTier >= 2 && this.support.catShieldCooldown <= 0) {
                const pulse = 1 + 0.06 * Math.sin(this.time * 5);
                b.draw('ring', p.x, p.y, 1.18 * pulse, 1.18 * pulse, 0, this.pal.get(COL.gold, 210));
            }
            const walkFrame = p.speed > 8 ? Math.floor(this.time * 9) % 4 : 0;
            const trainerGlyph = this.playerAppearance > 0
                ? `trainer_${this.playerAppearance - 1}_${p.direction}_${walkFrame}` : null;
            if (trainerGlyph && this.atlas.glyphs[trainerGlyph]) {
                b.draw(trainerGlyph, p.x, p.y, 1.05, 1.05, 0,
                    this.pal.get(blink ? COL.gold : '#ffffff'));
            } else if (this.lucasReady) {
                b.draw(`lucas_${p.direction}_${walkFrame}`, p.x, p.y, 1.05, 1.05, 0,
                    this.pal.get(blink ? COL.gold : '#ffffff'));
            } else {
                b.draw('pill', p.x, p.y, HERO_SCALE * (1 - 0.05 * p.squash), HERO_SCALE * (1 + 0.05 * p.squash), 0,
                    this.pal.get(blink ? COL.gold : COL.hero));
                b.draw('dot', p.x + p.facing * 13, p.y + 7, 0.62, 0.62, 0, this.pal.get(COL.heroTrim));
            }

            const w = this.ripples;
            for (let i = 0; i < w.n; i++) {
                if (w.life[i] <= 0) continue;
                const k = Math.min(1, w.t[i] / w.life[i]);
                const R = w.r0[i] + (w.r1[i] - w.r0[i]) * (1 - (1 - k) * (1 - k));
                const col = w.hue[i] === WAVE_GOLD ? COL.gold : w.hue[i] === WAVE_DIM ? COL.dim : COL.accent;
                b.draw('ring', w.x[i], w.y[i], R / 24, R / 24, 0,
                    this.pal.get(col, Math.round(215 * (1 - k))));
            }
            b.end();
        }

        update (dt) {
            // The Pokédex owns a disposable SkillSystem arena. Keep the game clock, input, and
            // world frozen while its native Cocos particle emitters and render pass keep running.
            if (dexPreviewSimulation) {
                if (this.dexPreview !== dexPreviewSimulation) {
                    Game.prototype.setDexPreview.call(this, dexPreviewSimulation);
                }
                Game.prototype._updateDexPreview.call(this, dt);
                return;
            }
            if (this.dexPreview) {
                Game.prototype.setDexPreview.call(this, null);
                if (pauseAfterDexRestore) {
                    pauseAfterDexRestore = false;
                    cc.game.pause();
                }
                return;
            }
            if (pauseAfterDexRestore) {
                pauseAfterDexRestore = false;
                cc.game.pause();
                return;
            }
            const t0 = performance.now();
            if (dt > 0.2) dt = 0.2;
            const modalAtFrameStart = !!(this.levelUp || this.furnace.open || this.evolutionReward.open
                || this.dynamaxSelector.open || this.zCrystalSelector.open);
            if (!modalAtFrameStart && this.pending > 0 && !this.player.dead && this.upgradeRevealDelay > 0) {
                this.upgradeRevealDelay = Math.max(0, this.upgradeRevealDelay - dt);
            }
            const completedLevelChoice = this.panel.update(dt);
            if (completedLevelChoice >= 0) this.applyLevelChoice(completedLevelChoice);
            const completedEvolutionChoice = this.evolutionReward.update(dt);
            if (completedEvolutionChoice >= 0) this.chooseEvolutionReward(completedEvolutionChoice);
            this.setMusicMode(this.player.dead ? null
                : this.legendaryMap.active ? 'legendary'
                    : this.trainerBoss.active ? 'trainer' : 'field');
            // Keep the modal state from before processing input: choosing the final card closes
            // `levelUp` immediately, but that same click/key must never fall through to field play.
            this.want = this.input.sample(dt);
            const touchUiBlocked = modalAtFrameStart || this.levelUp || this.furnace.open
                || this.evolutionReward.open || this.dynamaxSelector.open || this.zCrystalSelector.open;
            if (typeof document !== 'undefined' && document.body) {
                document.body.classList.toggle('game-modal-open', touchUiBlocked);
            }
            if (touchUiBlocked) {
                if (this.touchSkillAiming) this.endTouchMegaSkillAim(true);
                this.input.setTouchFire(false);
                this.input.setTouchAxis(0, 0);
            }
            // The pointer is view space and the catch is world space; a player who never touched the
            // mouse gets the crosshair 1.2 m in front of the hero instead (§6.1, keyboard row).
            const ptr = this.input.pointer;
            if (!this.touchSkillAiming) {
                if (this.input.touch.aimSeen) {
                    this.aimWorld.x = this.player.x + this.input.touch.aimX * CATCH.aimAhead;
                    this.aimWorld.y = this.player.y + this.input.touch.aimY * CATCH.aimAhead;
                } else if (ptr.seen) {
                    this.aimWorld.x = this.cam.x + ptr.x / this.cam.z;
                    this.aimWorld.y = this.cam.y + ptr.y / this.cam.z;
                } else {
                    this.aimWorld.x = this.player.x + this.player.facing * CATCH.aimAhead;
                    this.aimWorld.y = this.player.y;
                }
            }

            const w = this.want;
            let steps = 0;
            if (this.dynamaxSelector.open) {
                this.dynamaxSelector.hover = this.dynamaxSelector.hit(ptr.x, ptr.y);
                if (w.num) this.activateDynamax(w.num - 1);
                else if (w.tap) {
                    if (this.dynamaxSelector.hover === -2) this.dynamaxSelector.turnPage(-1);
                    else if (this.dynamaxSelector.hover === -3) this.dynamaxSelector.turnPage(1);
                    else if (this.dynamaxSelector.hover >= 0) this.activateDynamax(this.dynamaxSelector.hover);
                }
            } else if (this.zCrystalSelector.open) {
                this.zCrystalSelector.hover = this.zCrystalSelector.hit(ptr.x, ptr.y);
                if (w.num) this.selectZCrystal(w.num - 1);
                else if (w.tap && this.zCrystalSelector.hover === -2) this.zCrystalSelector.turnPage(-1);
                else if (w.tap && this.zCrystalSelector.hover === -3) this.zCrystalSelector.turnPage(1);
                else if (w.tap && this.zCrystalSelector.hover >= 0) this.selectZCrystal(this.zCrystalSelector.hover);
            } else if (this.levelUp) {
                // Frozen: 1/2/3 or a click on a card. A click anywhere else is swallowed, never passed
                // on to 【掷】, so a mis-click cannot spend a throw the player did not mean.
                if (w.pointerMoved) this.panel.setHover(this.panel.hit(ptr.x, ptr.y));
                if (w.nav) this.panel.moveFocus(w.nav);
                if (w.num) this.chooseLevel(w.num - 1);
                else if (w.tap) {
                    const hit = this.panel.hit(ptr.x, ptr.y);
                    this.panel.setHover(hit);
                    this.chooseLevel(hit);
                }
            } else if (this.furnace.open) {
                // The furnace is the screen the chain is read on, so it stops the world for exactly the
                // §5.6 reason: 放生 is irreversible inside a run and must never be a reflex click.
                this.furnacePress(w);
            } else if (this.evolutionReward.open) {
                this.bossEvolutionPress(w, ptr);
            } else if (modalAtFrameStart) {
                // An animated choice just completed above. Keep this final transition frame modal
                // so its last click/key cannot leak into a throw or open the next reward screen.
            } else if (w.tap && this.hud.hitPartyButton(ptr.x, ptr.y)) {
                w.tap = false;
                w.hold = false;
                this.input.blockFireUntilRelease();
            } else if (w.tap && this.hud.hitCombatSkillButton(ptr.x, ptr.y)) {
                // Mouse fallback for IME/browser environments that swallow X. Do not let the HUD
                // click throw a ball, and aim forward rather than at the skill panel itself.
                this.aimWorld.x = this.player.x + this.player.facing * CATCH.aimAhead;
                this.aimWorld.y = this.player.y;
                w.tap = false;
                this.press(cc.KeyCode.KEY_X);
            } else if (this.pending > 0 && !this.player.dead && this.upgradeRevealDelay <= 0) {
                this.openChoice();
            }

            if (modalAtFrameStart || this.levelUp || this.furnace.open || this.evolutionReward.open
                || this.dynamaxSelector.open || this.zCrystalSelector.open) {
                // The decision is the point, so the accumulator is dropped rather than carried: a
                // player who reads for 20 s must not come back to 20 seconds of catch-up simulation.
                this.acc = 0;
                // A card/furnace action is UI-only, including on the frame it closes the panel.
                // Consume the sampled actions so a selection click cannot also throw a ball, and a
                // held fire key cannot leak through the pause into the next simulation step.
                this.want.tap = false;
                this.want.hold = false;
                this.want.num = 0;
                this.pendingZCast = false;
                this.input.blockFireUntilRelease();
                // ... but the panel's own actions splice the chain, and the node layout is rebuilt only
                // by `chain.update`, which lives inside `step`. So the frame after a 放生 / 晋升 / 铸造
                // drew the *old* seat list and read a segment that no longer exists - `visualOf()` on
                // `undefined`, which threw out of `update` and froze the picture. dt = 0 keeps this a
                // pure re-seat: no history push, no 亲密度 paid, no spring applied.
                const pl = this.player;
                this.chain.update(0, pl.x, pl.y, Math.min(1, pl.speed / pl.maxSpeed));
            } else {
                this.acc += dt;
                while (this.acc >= SIM.step && steps < SIM.maxSteps && !this.evolutionReward.open) {
                    this.step(SIM.step);
                    this.acc -= SIM.step;
                    steps += 1;
                }
            }

            this.particleBursts.update(dt);
            this.particleBursts.updateRillaboomGroves(dt, this.rillaboomFields);
            this.particleBursts.updateGigantamaxMeowth(dt, this.chain);
            this.particleBursts.updateGigantamaxAuras(dt, this.chain);
            this.particleBursts.updateGigantamaxSkillParticles(dt, this.megaFx);
            this.skills.consumeBursts((event) => {
                this.particleBursts.burst(event.fam, event.x, event.y, event.angle, event.kind, event.megaId);
                this.megaBurstFx(event);
                this.combatSfx.enqueue(event);
            });
            this.combatSfx.flush();
            if (!modalAtFrameStart && !this.levelUp && !this.furnace.open && !this.evolutionReward.open
                && !this.dynamaxSelector.open && !this.zCrystalSelector.open) {
                this.particleBursts.updateProjectileTrails(dt, this.skills);
                this.particleBursts.updateTrainerProjectileTrails(dt, this.trainerBoss);
                this.particleBursts.updateSkillEffectParticles(dt, this.skills);
                this.particleBursts.updateFieldParticles(dt, this.skills);
                this.particleBursts.updateZMoveParticles(dt, this.zMoves);
                this.particleBursts.updateMegaAreaParticles(dt, this.megaFx);
                this.particleBursts.updateSignatureSkillParticles(dt, this.megaFx);
                this.particleBursts.updateRosterAreaParticles(dt, this.megaFx);
                this.particleBursts.updateShinyWalkTrails(dt, this.chain);
            }

            const z = this.cam.z;
            const sx = this.shake > 0 ? (Math.random() - 0.5) * 26 * this.shake : 0;
            const sy = this.shake > 0 ? (Math.random() - 0.5) * 26 * this.shake : 0;
            this.backdrop.setPosition(sx, sy, 0);
            // Node scale is applied to its children around the origin, so the camera translation
            // must be scaled too: view = (world - camera) * zoom. Without this factor, the player
            // drifts by (zoom - 1) * position whenever the chain zoom is not exactly 1.
            this.world.setPosition(-this.cam.x * z + sx / z, -this.cam.y * z + sy / z, 0);
            this.world.setScale(z, z, 1);
            const floraView = cc.view.getVisibleSize();
            this.mewtwoArena.update(this.cam, this.legendaryMap,
                this.legendaryMap.active && this.legendaryMap.species === 'legend-mewtwo');
            this.lugiaArena.update(this.cam, this.legendaryMap,
                this.legendaryMap.active && this.legendaryMap.species === 'legend-lugia');
            this.rayquazaArena.update(this.cam, this.legendaryMap,
                this.legendaryMap.active && this.legendaryMap.species === 'legend-rayquaza');
            this.kyogreArena.update(this.cam, this.legendaryMap,
                this.legendaryMap.active && this.legendaryMap.species === 'legend-kyogre');
            this.hoohArena.update(this.cam, this.legendaryMap,
                this.legendaryMap.active && this.legendaryMap.species === 'legend-hooh', dt,
                this.legendaryMap.hoohSpecial.active ? 9 : 1);
            this.pond.setActive(!this.legendaryMap.active && !this.trainerBoss.active);
            this.flora.update(this.cam, floraView.width, floraView.height,
                !this.legendaryMap.active && !this.trainerBoss.active);
            this.trees.update(this.cam, floraView.width, floraView.height,
                !this.legendaryMap.active && !this.trainerBoss.active, this.player.y);
            // Before the draw pass, and on the frame clock on purpose - see `stepFrameFx`.
            this.stepFrameFx(dt);
            this.trainerTransition.step(dt);
            this.drawGround();
            this.drawEntities();
            // Telegraphs are gameplay-critical, so draw them atop the long party instead of beneath it.
            this.drawFx();
            this.trainerTransition.render();
            // The run clock stops with the panel, so the card pulse cannot ride on it.
            this.wall += dt;
            if (this.levelUp) this.panel.render(this.wall);
            else if (this.furnace.open) {
                this.furnace.render(this.chain, this.evolveHave(this.cores));
            } else if (this.evolutionReward.open) this.evolutionReward.render(this.wall);
            else if (this.dynamaxSelector.open) this.dynamaxSelector.render(this.wall);
            else if (this.zCrystalSelector.open) this.zCrystalSelector.render(this.wall);

            const cpu = performance.now() - t0;
            this.refreshLinks();
            this.perf.cpu = this.perf.cpu * 0.9 + cpu * 0.1;
            this.perf.fps = this.perf.fps * 0.9 + (1 / Math.max(dt, 1e-4)) * 0.1;
            this.perf.steps = steps;
            const st = this.batch.stats();
            this.perf.live = st.live;
            this.perf.sprites = st.total;
            this.perf.enemies = this.enemies.n;
            this.perf.balls = this.capture.bn;
            this.perf.pets = this.capture.n;
            const mm = Math.floor(this.time / 60);
            const ss = Math.floor(this.time % 60);
            const lairTarget = !this.legendaryMap.active
                ? this.legendaryLairs.siteAt(this.player.x, this.player.y, 112) : null;
            const nearLair = !!lairTarget;
            this.hud.set(
                '', '',
                this.levelUp
                    ? '暂停中 · 点一张卡或按 1 / 2 / 3 · 这一局往哪长，由这一步决定'
                    : (this.player.dead
                            ? `死亡 · ${mm}:${String(ss).padStart(2, '0')} · 击杀 ${this.enemies.kills} · 抓 ${this.stats_.caught}`
                                + ` · 进化 ${this.stats_.evolved} · 漏 ${this.stats_.missed} · R 重开`
                            : this.legendaryMap.active
                                ? '神兽地图 · 移动躲避冲撞 · 队伍自动攻击 · 神兽虚弱后投球收服'
                                : this.trainerBoss.active
                                    ? '训练家 BOSS 战 · 移动躲避弹幕 · 队伍自动攻击'
                : `${this.lockText()} · 移动 · 点击/空格投球 · 按住连掷 · E ${nearLair ? '进入神兽地点' : '进化'} · Q切技/X释放 · U升级 · R重开${this.build.stacks.zPowerBand > 0 ? ' · Z招式/C纯晶' : ''}`)
            );
            this.hud.setParty(this.chain.segments, this.chain.cap, this.chain.petTotal, this.atlas.glyphs);
            this.hud.setExperience(this.level, this.exp, EXP(this.level));
            const itemStatus = [];
            if (this.build.stacks.australianMouse) {
                const count = australianMouseCount(this.chain).toLocaleString('zh-CN');
                const remaining = Math.max(0, Math.ceil(AUSTRALIAN_MOUSE_INTERVAL - this.build.australianMouseTimer));
                itemStatus.push(`澳大利亚老鼠 · 一家鼠 ${count} 只 · ${remaining} 秒后翻倍`);
            }
            if (this.build.stacks.alcremieSweet) {
                itemStatus.push(this.alcremieRotation.pending
                    ? '草莓糖饰 · 小仙奶奖励暂存，队伍空位后加入'
                    : `草莓糖饰 · 转动移动方向 ${Math.floor(rotationProgress(this.alcremieRotation) * 100)}%`);
            }
            this.hud.setInfo('', this.toast.t > 0 ? this.toast.text : itemStatus.join(' · '));
            this.hud.setAmmo(this.build.balls);
            this.hud.setHealth(this.player.hp, this.player.maxhp);
            this.hud.setTrainer(this.playerAppearance > 0 ? TRAINER_SPRITES[this.playerAppearance - 1].name : 'Lucas',
                this.atlas.glyphs[this.playerAppearance > 0 ? `trainer_${this.playerAppearance - 1}_0_0` : 'lucas_0_0']?.frame);
            this.hud.setDynamaxStatus(this.build.stacks.dynamaxBand > 0,
                this.dynamax.remaining, this.dynamax.cooldown);
            const selectedZ = Z_CRYSTALS.find((entry) => entry.id === this.zMoves.selected);
            if (!(this.build.stacks.zPowerBand > 0)) this.hud.setZMoveStatus(false);
            else if (!selectedZ) this.hud.setZMoveStatus(true, 'Z力量手环 · 按 Z 选择纯晶', '#ffe69a');
            else {
                const count = zAffinityCount(this.chain.segments, selectedZ.type);
                const radius = zMoveMetrics(count).radius;
                const cooldown = this.zMoves.cooldown;
                const ready = cooldown <= 0 && !this.zMoves.projectile;
                const status = !count ? `${selectedZ.short}失去共鸣 · C 更换纯晶`
                    : `${selectedZ.short} ×${count} · 范围 ${Math.round(radius)}px · ${ready ? 'Z 释放 · C换晶' : `蓄力 ${Math.ceil(cooldown)}s · C换晶`}`;
                this.hud.setZMoveStatus(true, status, ready ? selectedZ.color : '#c5b9cf');
            }
            const selectedSkillUser = this.megaSkillUsers().includes(this.selectedMega)
                ? this.selectedMega : null;
            const selectedSkillForm = selectedSkillUser
                ? this.combatFormForSegment(selectedSkillUser) : null;
            const skillIcon = selectedSkillForm && selectedSkillForm.icon
                ? this.atlas.glyphs[selectedSkillForm.icon] : null;
            this.hud.setCombatSkill(selectedSkillForm,
                selectedSkillForm ? this.activeSkillForForm(selectedSkillForm) : null,
                selectedSkillUser ? selectedSkillUser.megaSkillCd : 0,
                skillIcon ? skillIcon.frame : null);
            this.hud.setBossProgress(this.enemies.wildKills, this.enemies.nextBossKillCount(),
                this.enemies.bossI + 1, this.trainerBoss.active || this.legendaryMap.active);
            this.hud.setLegendaryGuides(this.legendaryLairs.sites, this.cam, this.wall,
                !this.legendaryMap.active && !this.player.dead, nearLair ? lairTarget : null);
            if (this.trainerBoss.active) {
                const vitals = this.trainerBoss.vitals(this.enemies);
                const party = this.trainerBoss.party.map((p) => displayName(p.fam, p.tier)).join(' / ');
                this.hud.setBoss(this.trainerBoss.encounter.name, vitals.hp, vitals.maxHp,
                    party, this.trainerBoss.party.length);
            } else if (this.legendaryMap.active) {
                let index = -1;
                for (let i = 0; i < this.enemies.n; i++) {
                    if (this.enemies.legendary[i] && !this.enemies.dead[i]) { index = i; break; }
                }
                const ready = index >= 0 && this.enemies.legendaryReady[index];
                const mewtwo = index >= 0 && FAMILIES[this.enemies.fam[index]].id === 'legend-mewtwo';
                const lugia = index >= 0 && FAMILIES[this.enemies.fam[index]].id === 'legend-lugia';
                const hooh = index >= 0 && FAMILIES[this.enemies.fam[index]].id === 'legend-hooh';
                const intro = (mewtwo || lugia || hooh) && this.enemies.intro[index];
                const hoohSpecial = hooh && this.legendaryMap.hoohSpecial.active
                    ? this.legendaryMap.hoohSpecial : null;
                const warning = this.legendaryAttacks.active && this.legendaryAttacks.phase === 'warning'
                    && !ready && !intro;
                const detail = ready ? '虚弱 · 可投球收服'
                    : intro ? (lugia ? '海水聚能 · 洛奇亚现身中'
                        : hooh ? '云海翻涌 · 凤王自高空飞降' : '四方能量汇聚 · MEGA进化中')
                    : hoohSpecial ? '无效 · 凤王腾空施放神圣羽暴 · 躲避金色羽弹'
                    : warning ? `${this.legendaryAttacks.label}范围已标出 · ${Math.max(0, this.legendaryAttacks.timeLeft).toFixed(1)}秒后攻击`
                    : this.legendaryAttacks.phase === 'impact'
                            ? (this.legendaryAttacks.type === 'tsunami'
                                ? '海啸扫过 · 留在蓝色安全窄道内' : `${this.legendaryAttacks.label}冲击中 · 立即避开预警区域`)
                        : '神兽 · 击败后可捕捉';
                this.hud.setBoss(index >= 0
                    ? mewtwo && !ready && !intro ? 'MEGA超梦Y' : FAMILIES[this.enemies.fam[index]].name
                    : '神兽',
                    index >= 0 ? this.enemies.hp[index] : 0,
                    index >= 0 ? this.enemies.maxhp[index] : 0,
                    detail, 1, hooh ? 150 : 0);
            } else {
                let wildBossIndex = -1;
                for (let i = 0; i < this.enemies.n; i++) {
                    if (this.enemies.wildBoss[i] && !this.enemies.dead[i]) { wildBossIndex = i; break; }
                }
                if (wildBossIndex >= 0) {
                    const ready = this.enemies.wildBossReady[wildBossIndex] === 1;
                    const family = FAMILIES[this.enemies.fam[wildBossIndex]];
                    const attack = this.legendaryAttacks.active && this.legendaryAttacks.wildBoss
                        ? this.legendaryAttacks : null;
                    const detail = ready ? '已击败 · 投球即可收服'
                        : attack && attack.phase === 'warning'
                            ? `${attack.label} · ${Math.max(0, attack.timeLeft).toFixed(1)}秒后攻击`
                            : attack && attack.phase === 'impact' ? `${attack.label}冲击中 · 快速躲避`
                                : '野外遭遇 · 专属招式预警后发动';
                    this.hud.setBoss(`野生强敌 · ${family.name}`,
                        this.enemies.hp[wildBossIndex], this.enemies.maxhp[wildBossIndex],
                        detail, 1);
                } else this.hud.setBoss('', 0, 0);
            }
            window.__booted = true;
        }

        /** Nominal output including the 招式增伤 card — the number the horde tunes itself against. */
        dpsTotal () {
            return chainDps(this.chain) * this.build.dmg;
        }

        /** §5.7-F-3: the whole point of the split is that this stays ~1.0, and a Bullet is allowed to. */
        skillStats () {
            const m = this.skills.m;
            return {
                live: this.skills.n,
                spent: m.spent,
                landed: m.landed,
                lost: m.lost,
                wasted: m.wasted,
                volleys: m.volleys,
                hitEff: m.spent > 0 ? m.landed / m.spent : 1,
            };
        }

        stats () {
            return {
                cpu: this.perf.cpu,
                fps: this.perf.fps,
                time: this.time,
                segments: this.chain.normalSegmentCount,
                shinySegments: this.chain.shinySegmentCount,
                caughtShiny: this.stats_.caughtShiny,
                pets: this.chain.petTotal,
                nodes: this.chain.nCount,
                dps: this.dpsTotal() * lateDamageMultiplier(this.level),
                nominalDps: this.dpsTotal(),
                live: this.perf.live,
                sprites: this.perf.sprites,
                enemies: this.enemies.n,
                kills: this.enemies.kills,
                wildKills: this.enemies.wildKills,
                nextBossKills: this.enemies.nextBossKillCount(),
                captured: this.enemies.captured,
                balls: this.capture.bn,
                inbound: this.capture.n,
                skill: this.skillStats(),
                thrown: this.capture.thrown,
                bounced: this.capture.bounced,
                level: this.level,
                range: this.build.range,
                ballR: this.build.ballR,
                ballSpeed: this.build.ballSpeed,
                // What the harness asserts on: an open fan is a paused game, and a paused game must
                // not be able to tick the horde forward.
                choosing: this.levelUp ? this.levelUp.length : 0,
                // The furnace is the second legal stop, so the harness can assert the same "paused means
                // the horde cannot tick" property on it.
                furnace: this.furnace.open ? 1 : 0,
                bossReward: this.evolutionReward.open ? 1 : 0,
                queued: this.pending,
                picks: this.stats_.picks.join(' '),
                cores: this.cores,
                released: this.stats_.released,
                boss: this.trainerBoss.active ? 1 : this.enemies.bossN,
                bossKills: this.stats_.boss,
                legendaryLairs: this.legendaryLairs.sites.length,
                legendaryLairsDone: this.legendaryLairs.sites.filter((site) => site.complete).length,
                legendaryMap: this.legendaryMap.active ? 1 : 0,
                legendaryTarget: this.legendaryLairs.next ? this.legendaryLairs.next.species : null,
                hp: this.player.hp,
                caught: this.stats_.caught,
                missed: this.stats_.missed,
                zoom: this.cam.z,
                player: { x: this.player.x, y: this.player.y, speed: this.player.speed },
                tail: { x: this.chain.tail.x, y: this.chain.tail.y, speed: this.chain.tail.speed },
            };
        }
    }
    return Game;
}
