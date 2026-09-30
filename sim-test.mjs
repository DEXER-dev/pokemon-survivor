/*
 * Headless loop test: config + chain + enemies + capture + combat are all engine-free, so the whole
 * verb set can be proven without a renderer. Every policy in `BOTS` plays the same wave, which is how
 * the M0 pass criteria get numbers instead of opinions. Run with `node sim-test.mjs [minutes]`.
 *
 * v0.4 changed what this file is for. When capture was a vacuum the only question was "did the chain
 * grow"; with 精灵球 the ball can miss, clang off an elite, or run out of range, so the sim's headline
 * row is now 命中率 - a throw that never connects is the same failure the old 兽魂 crosshair had, and
 * it would be invisible in a table that only counts pets.
 */
import {
    BALL, BOSS, CATCH, CHAIN, ENEMY, PLAYER, FAMILIES, LEGENDARY_BOSSES, WILD_BOSSES, WILD_BOSS, WILD_FAMILY_COUNT, EXP, FURNACE, PLAYER_HP, PPM, SKILLS,
    SKILL_SHARE, VIEW, SIM, PROJ,
} from './src/config.js';
import { existsSync } from 'node:fs';
import { bulletFragmentSource, bulletStyleBodySource, bulletStyleNames } from './builtin-materials.js';
import { makeRng, randomSeed } from './src/rng.js';
import { ChainSystem, evolveGate, lineTop } from './src/chain.js';
import { EnemySystem } from './src/enemies.js';
import { CaptureSystem, EV_POP } from './src/capture.js';
import { CaptureSfx } from './src/capture-sfx.js';
import { CombatSfx, resolveCombatSound } from './src/combat-sfx.js';
import { UpgradeSfx, resolveUpgradeSound } from './src/upgrade-sfx.js';
import { MusicManager, MUSIC_TRACKS } from './src/music-manager.js';
import { CombatSystem, segDps, chainDps, nodeBonus, hitRect, hitHeart } from './src/combat.js';
import { createGame } from './src/game.js';
import { makeDexArena } from './src/dex.js';
import { SkillSystem } from './src/skills.js';
import { TrainerBossSystem } from './src/trainer-boss.js';
import { Build, roll, take, available, LEVELS } from './src/upgrades.js';
import { refund } from './src/forge.js';
import {
    ROSTER_IDS, SPECIES, stepOf, evoCeil, iconKey, iconKeys, BOSS_SPECIES, displayName, typeText, condText,
    ELEMENT_TYPE, TYPE_ZH, STONE,
} from './src/species.js';
import { Player } from './src/player.js';
import { MEGA_FORMS, MEGA_ACTIVE_SKILLS, megaCardsFor, megaFormForSegment } from './src/mega.js';
import {
    activeSkillForForm, activeSkillModuleForForm, rosterActiveFormForSegment,
    drawMegaProjectile, drawMegaActiveArea, drawMegaEffects,
    projectileModuleForSegment, projectileModuleForShot,
    projectileFamilyModuleForSegment, projectileRendererForFamily, skillParticlePresetForEvent,
    projectileImpactPresetForFamily, legendaryParticlePresetForEvent,
    fieldEffectForFamily, orbitCoreGlyphForFamily, beamEffectForFamily, slashEffectForFamily,
} from './src/skills/registry.js';
import { GRENINJA_PARTICLE_PRESETS } from './src/skills/particles/greninja.js';
import { GIGANTAMAX_FORMS, GIGANTAMAX_SKILLS, gigantamaxCardsFor, gigantamaxFormForSegment } from './src/gigantamax.js';
import { PlayLog } from './src/play-log.js';
import { SKILL_INFO, PROJECTILE_GLYPH, PROJECTILE_EFFECT } from './src/skill-info.js';
import { STARTER_GENERATIONS, STARTER_POKEMON } from './src/starter-pokemon.js';
import { tandemausFollowerMotion, tandemausFollowerOffset } from './src/companion-formation.js';
import { DYNAMAX_BAND, canDynamax, dynamaxProjectileScale } from './src/items/dynamax-band.js';
import { AUSTRALIAN_MOUSE_INTERVAL, australianMouseCount, stepAustralianMouse } from './src/items/australian-mouse.js';
import { createRotationTracker, rotationProgress, stepRotationTracker } from './src/items/rotation-sweet.js';
import { stepFields as stepRillaboomFields } from './src/skills/active/gigantamax/rillaboom.js';
import { stepCakes as stepAlcremieCakes, drawCakes as drawAlcremieCakes,
    drawEffect as drawAlcremieEffect } from './src/skills/active/roster/alcremie.js';
import { legendaryGuideLayout } from './src/lair-guide-layout.js';
import { drawLegendaryGuideIcon, legendaryGuideStyle } from './src/legendary-guide-icons.js';
import { LegendaryAttackSystem } from './src/legendary-attacks.js';
import { LegendaryLairs } from './src/legendary-lairs.js';
import { isLegendaryCompanion, legendaryBodyScale,
    stepLegendaryCompanionAttacks } from './src/skills/active/legendary/companion-bombardment.js';
import { pointInHeart } from './src/heart-shape.js';
import { SHINY_ODDS, rollShiny } from './src/shiny.js';
import { NativeParticleBursts } from './src/particles.js';
import { Hud } from './src/hud.js';
import { ZCrystalSelector } from './src/z-crystal-selector.js';
import { SKILL as BLAZIKEN_CHARGE_SKILL } from './src/skills/active/mega/blaziken.js';
import { Z_CRYSTALS, Z_POWER_BAND, zAffinityCount, zMoveMetrics } from './src/items/z-power-band.js';
import { ZMoveSystem } from './src/z-moves.js';
import { Z_MOVE_PARTICLE_PRESETS } from './src/skills/particles/z-moves.js';
import { Input } from './src/input.js';

const TAU = Math.PI * 2;
// BGM is kept on a separate looping channel and changes by game state without interrupting SFX.
{
    for (const file of Object.values(MUSIC_TRACKS)) {
        if (!existsSync(new URL(`./assets/audio/${file}`, import.meta.url))) {
            throw new Error(`missing bundled BGM: ${file}`);
        }
    }
    class AudioSource {
        constructor () { this.volume = 0; this.clip = null; this.loop = false; this.played = 0; this.stopped = 0; }
        play () { this.played++; }
        stop () { this.stopped++; }
    }
    class Node {
        constructor (name) { this.name = name; this.children = []; }
        addChild (node) { this.children.push(node); }
        addComponent (Type) { this.source = new Type(); return this.source; }
    }
    const cc = {
        Node, AudioSource,
        assetManager: { loadRemote (url, _options, callback) { callback(null, { url }); } },
    };
    const manager = new MusicManager(cc, new Node('Game'));
    manager.setMode('title');
    if (manager.current !== 0 || manager.sources[0].volume !== 0.19
        || !manager.sources[0].loop || !manager.sources[0].played) {
        throw new Error('title BGM must loop and start at its configured volume');
    }
    manager.setMode('trainer');
    if (manager.current !== 1 || manager.sources[1].clip.url.endsWith(MUSIC_TRACKS.trainer) !== true
        || manager.sources[0].volume !== 0 || !manager.sources[0].stopped) {
        throw new Error('trainer BGM must crossfade over and stop the title source');
    }
    manager.setMode(null);
    if (manager.current !== -1 || manager.sources[1].volume !== 0 || !manager.sources[1].stopped) {
        throw new Error('music must fade out and stop on game over');
    }
    manager.destroy();
    console.log('背景音乐：标题、野外、训练家与神兽曲目齐全；循环、切换与停止 PASS');
}
// Combat audio routes through event categories, then collapses a dense frame to at most one cue.
{
    if (resolveCombatSound({ kind: 'trainer-encounter' })?.file !== 'trainer-encounter.ogg'
        || resolveCombatSound({ kind: 'trainer-encounter' })?.priority !== 3
        || resolveCombatSound({ kind: 'tandemaus-throw', fam: 'tandemaus' })?.file !== 'tandemaus-throw.ogg'
        || resolveCombatSound({ kind: 'tandemaus-throw' })?.volume > 0.30
        || resolveCombatSound({ kind: 'shot', fam: 'mush' })?.file !== 'combat-grass.ogg'
        || resolveCombatSound({ kind: 'shot', fam: 'totodile' })?.file !== 'combat-water.ogg'
        || resolveCombatSound({ kind: 'z-electric-launch' })?.file !== 'combat-electric.ogg'
        || resolveCombatSound({ kind: 'flower-bloom', fam: 'sprigatito' })?.priority !== 2
        || resolveCombatSound({ kind: 'hit', fam: 'mush' }) !== null) {
        throw new Error('Combat sound routing must distinguish elements/signatures and keep ordinary impacts silent');
    }
    const played = [];
    class AudioSource {}
    const cc = {
        AudioSource,
        assetManager: { loadRemote (url, _options, callback) { callback(null, { url }); } },
    };
    const node = { addComponent (Type) {
        if (Type !== AudioSource) throw new Error('CombatSfx should attach one AudioSource');
        return { isValid: true, playOneShot (clip, volume) { played.push({ clip: clip.url, volume }); }, stop () {} };
    } };
    const audio = new CombatSfx(cc, node);
    if (!audio.clips['trainer-encounter.ogg'] || !audio.clips['tandemaus-throw.ogg']
        || !existsSync(new URL('./assets/audio/trainer-encounter.ogg', import.meta.url))
        || !existsSync(new URL('./assets/audio/tandemaus-throw.ogg', import.meta.url))) {
        throw new Error('trainer encounter and Tandemaus throw cues must be bundled and preloaded');
    }
    audio.enqueue({ kind: 'trainer-encounter' });
    if (!audio.flush(900) || played.length !== 1 || !played[0].clip.endsWith('trainer-encounter.ogg')
        || played[0].volume < 0.6) throw new Error('trainer BOSS entrance must play its encounter cue at priority');
    audio.enqueue({ kind: 'shot', fam: 'mush' });
    audio.enqueue({ kind: 'pulse', fam: 'chikorita' });
    audio.enqueue({ kind: 'mega-skill', fam: 'cyndaquil' });
    if (!audio.flush(1000) || played.length !== 2 || !played[1].clip.endsWith('combat-fire.ogg')
        || played[1].volume <= 0.2) throw new Error('Active skill audio must pre-empt ordinary volley audio');
    audio.enqueue({ kind: 'shot', fam: 'mush' });
    if (audio.flush(1100) || played.length !== 2) throw new Error('Combat audio must enforce its global overlap cooldown');
    audio.enqueue({ kind: 'shot', fam: 'mush' });
    if (!audio.flush(1600) || played.length !== 3) throw new Error('Ordinary elemental projectile audio should resume after throttling');
    audio.enqueue({ kind: 'mega-skill', fam: 'totodile' });
    if (!audio.flush(1650) || played.length !== 4) {
        throw new Error('A ready active skill must not lose its release cue to the ordinary-sound limiter');
    }
    audio.enqueue({ kind: 'tandemaus-throw', fam: 'tandemaus' });
    audio.enqueue({ kind: 'tandemaus-throw', fam: 'tandemaus' });
    if (!audio.flush(1900) || played.length !== 5 || !played[4].clip.endsWith('tandemaus-throw.ogg')
        || played[4].volume <= 0 || audio.flush(2100) || played.length !== 5) {
        throw new Error('A Maushold volley must play one restrained throw cue, even when it has many bullets');
    }
    audio.destroy();
    console.log('战斗音效：属性路由、专属/大招优先级、同帧合并与全局限频 PASS');
}
// Level-up UI has distinct, bounded cues for the reveal, focus movement, confirm, and exit.
{
    const events = ['appear', 'focus', 'confirm', 'dismiss'];
    for (const event of events) {
        const sound = resolveUpgradeSound(event);
        if (!sound || !existsSync(new URL(`./assets/audio/${sound.file}`, import.meta.url))
            || sound.volume > 0.5) throw new Error(`missing or overly loud upgrade UI cue: ${event}`);
    }
    if (resolveUpgradeSound('unknown')) throw new Error('unknown upgrade UI sound events must stay silent');
    const played = [];
    class AudioSource {}
    const cc = { AudioSource, assetManager: { loadRemote (url, _options, callback) { callback(null, { url }); } } };
    const node = { addComponent (Type) {
        if (Type !== AudioSource) throw new Error('UpgradeSfx should attach one Cocos AudioSource');
        return { isValid: true, playOneShot (clip, volume) { played.push({ url: clip.url, volume }); }, stop () {} };
    } };
    const audio = new UpgradeSfx(cc, node);
    if (!audio.play('appear', 100) || audio.play('appear', 200)
        || !audio.play('focus', 200) || audio.play('focus', 250)
        || !audio.play('confirm', 300) || !audio.play('dismiss', 310)
        || played.length !== 4) throw new Error('upgrade UI sound events must play once and respect their cooldowns');
    audio.destroy();
    if (audio.play('confirm', 600)) throw new Error('destroyed upgrade UI audio must stay silent');
    console.log('升级界面音效：开场、焦点、确认、退场四类音效与限频 PASS');
}
// Capture reveal plays the exact form cry once the ball opens, not on the throw or an unsuccessful hit.
{
    const cryKeys = [...new Set([...Object.values(SPECIES).flatMap((record) => record?.key || []),
        ...Object.values(SPECIES).map((record) => record?.form).filter(Boolean), BOSS_SPECIES.key])];
    const missing = cryKeys.filter((key) => !existsSync(new URL(`./assets/audio/cries/${key}.ogg`, import.meta.url)));
    if (missing.length) throw new Error(`missing species capture cries: ${missing.join(', ')}`);
    const played = [];
    class AudioSource {}
    const cc = { AudioSource, assetManager: { loadRemote (url, _options, callback) { callback(null, { url }); } } };
    const node = { addComponent (Type) {
        if (Type !== AudioSource) throw new Error('CaptureSfx should use one Cocos AudioSource');
        return { isValid: true, playOneShot (clip, volume) { played.push({ url: clip.url, volume }); }, stop () {} };
    } };
    const sfx = new CaptureSfx(cc, node);
    if (!sfx.playCry('PIKACHU') || played.length !== 1
        || !played[0].url.endsWith('/cries/PIKACHU.ogg') || played[0].volume !== 0.34) {
        throw new Error('capture cry must load and play the captured species audio');
    }
    sfx.destroy();
    const capture = new CaptureSystem(BALL, CATCH, makeRng(77));
    let reveal = null;
    capture.onEvent = (...args) => { if (args[0] === EV_POP) reveal = args; };
    const familyIndex = FAMILIES.findIndex((family) => family.id === 'mush');
    capture.bn = 1;
    capture.bfam[0] = familyIndex;
    capture.btier[0] = 2;
    capture.bgold[0] = 0;
    capture.bshiny[0] = 0;
    capture._release(0);
    if (!reveal || reveal[5] !== familyIndex || reveal[6] !== 2) {
        throw new Error('capture reveal event must carry the captured family and form tier for cry lookup');
    }
    console.log(`捕捉叫声：${cryKeys.length} 个图鉴形态素材齐全、异步懒加载、捕捉揭晓时播放 PASS`);
}
// Lugia's lair attack is a directed, telegraphed tsunami with a narrow safe corridor.
{
    const rng = makeRng(271828183);
    const makeWarning = (px, py) => {
        const system = new LegendaryAttackSystem();
        system.start(0, 0, 'legend-lugia');
        system.step(1.2, px, py, rng);
        if (system.type !== 'tsunami' || system.phase !== 'warning' || system.safeWidth <= 0
            || !system.label.includes('蓝色窄道')) {
            throw new Error('Lugia must announce a directed tsunami and safe strip before impact');
        }
        return system;
    };
    const aimX = -250;
    const safe = makeWarning(aimX, 0);
    const nx = -Math.sin(safe.angle);
    const ny = Math.cos(safe.angle);
    const safeX = safe.x + nx * safe.safeOffset;
    const safeY = safe.y + ny * safe.safeOffset;
    const safeResult = safe.step(1.36, safeX, safeY, rng);
    if (!safeResult || safeResult.hit || safeResult.type !== 'tsunami') {
        throw new Error('Lugia tsunami safe corridor must match the actual collision test');
    }
    const danger = makeWarning(aimX, 0);
    const dangerResult = danger.step(1.36, danger.x, danger.y, rng);
    if (!dangerResult || !dangerResult.hit || dangerResult.safeWidth !== danger.safeWidth) {
        throw new Error('Lugia tsunami must damage the announced red area while preserving the lane');
    }
    console.log('洛奇亚神兽战：定向海啸预警、蓝色长条安全道与命中判定一致 PASS');
}
// Secondary legendaries are roaming wild-boss encounters, not the primary legendary lair route.
{
    const expected = [
        ['wildboss-articuno', '急冻鸟', 'ARTICUNO', 144, 'ICE,FLYING'],
        ['wildboss-zapdos', '闪电鸟', 'ZAPDOS', 145, 'ELECTRIC,FLYING'],
        ['wildboss-moltres', '火焰鸟', 'MOLTRES', 146, 'FIRE,FLYING'],
        ['wildboss-raikou', '雷公', 'RAIKOU', 243, 'ELECTRIC'],
        ['wildboss-entei', '炎帝', 'ENTEI', 244, 'FIRE'],
        ['wildboss-suicune', '水君', 'SUICUNE', 245, 'WATER'],
    ];
    const lair = new LegendaryLairs(LEGENDARY_BOSSES);
    const firstSite = lair.unlockForBossCount(5, 0, 0, makeRng(4))[0];
    const expectedIds = expected.map(([id]) => id);
    if (WILD_BOSSES.map((family) => family.id).join(',') !== expectedIds.join(',')
        || WILD_BOSSES.some((family) => LEGENDARY_BOSSES.includes(family))
        || firstSite?.species !== 'legend-mewtwo'
        || WILD_FAMILY_COUNT !== FAMILIES.length - LEGENDARY_BOSSES.length - WILD_BOSSES.length
        || WILD_BOSS.firstAfter !== 60 || WILD_BOSS.spawnChance <= 0 || WILD_BOSS.spawnChance >= 1
        || WILD_BOSS.hpMul < 400 || WILD_BOSS.radiusMul < 5 || WILD_BOSS.walkMul <= 1 || WILD_BOSS.rest >= BOSS.rest) {
        throw new Error('wild-boss roster, independent legendary lair route, or spawn policy regression');
    }
    for (const [id, name, key, dex, type] of expected) {
        const family = FAMILIES.find((entry) => entry.id === id);
        const record = SPECIES[id];
        if (!family || family.name !== name || family.tiers[0] !== name || !record
            || record.key[0] !== key || record.dex[0] !== dex
            || record.ty[0].join(',') !== type || !iconKeys().includes(key)
            || !existsSync(new URL(`./assets/icons/${key}.png`, import.meta.url))
            || isLegendaryCompanion({ fam: id, tier: 1, count: 1 })) {
            throw new Error(`${id} roaming wild-boss icon/family separation regression`);
        }
    }
    const enemies = new EnemySystem(ENEMY, makeRng(424242));
    enemies.wildBossCd = 0;
    const event = enemies.direct(0.01, 2, 0, 0, 0, 700, null, true, true, true);
    const index = enemies.n - 1;
    if (event !== 'wildboss' || !enemies.wildBoss[index] || !enemies.boss[index]
        || !WILD_BOSSES.includes(FAMILIES[enemies.fam[index]]) || enemies.bossI !== 0
        || enemies.maxhp[index] < enemies.threat(0) * 400 || enemies.r[index] < ENEMY.radius * 5) {
        throw new Error('random roaming wild-boss spawn must stay independent of trainer-boss progression');
    }
    if (!enemies.hurt(index, enemies.maxhp[index] * 2) || !enemies.wildBossReady[index]
        || enemies.dead[index] || enemies.bossN !== 1 || enemies.hurt(index, 1)) {
        throw new Error('wild boss must survive party damage until the player defeats it and unlocks capture');
    }
    const balls = new CaptureSystem(BALL, CATCH, makeRng(1234));
    if (!balls._take(0, index, 0, 0, enemies) || !enemies.dead[index] || enemies.bossN !== 0
        || balls.bfam[0] !== enemies.fam[index]) {
        throw new Error('weakened roaming wild boss must be catchable and release the boss slot');
    }
    console.log('野外强敌：随机刷新、独立于一级神地点与训练家BOSS、强袭可避、击败后可收服 PASS');
}
// Caught legendaries keep a distinct body scale and use a locked, telegraphed, boss-prioritized AoE.
{
    const segment = { fam: 'legend-mewtwo', tier: 1, count: 1 };
    const ordinary = { fam: 'mush', tier: 3, count: 1 };
    const rng = makeRng(982451653);
    const enemies = {
        n: 3,
        x: Float32Array.of(10, 100, 360), y: Float32Array.of(0, 0, 0),
        r: Float32Array.of(8, 12, 8), hp: Float32Array.of(1e6, 1e6, 1e6),
        dead: new Uint8Array(3), legendaryReady: new Uint8Array(3),
        boss: Uint8Array.of(0, 1, 0), elite: new Uint8Array(3), trainer: new Uint8Array(3), _q: [],
        grid: { query (_x, _y, _r, out) { out.length = 0; out.push(0, 1, 2); return out; } },
        hurt (i, damage) { this.hp[i] -= damage; return false; },
    };
    const events = [];
    if (!isLegendaryCompanion(segment) || isLegendaryCompanion(ordinary)
        || legendaryBodyScale(segment) < 2.2 || legendaryBodyScale({ ...segment, count: 100 }) > 2.62) {
        throw new Error('caught legendary body scale must start large and cap duplicate growth');
    }
    segment.legendaryBombardment = { phase: 'cooldown', timer: 0.01, x: 0, y: 0, radius: 0 };
    const common = { segments: [segment, ordinary], enemies, player: { x: 0, y: 0 },
        camera: { z: 1 }, trainerBattle: false, rng, damageMul: 1,
        onImpact (source, attack, result) { events.push({ source, attack: { ...attack }, result }); } };
    stepLegendaryCompanionAttacks({ ...common, dt: 0.02 });
    const warning = segment.legendaryBombardment;
    if (warning.phase !== 'warning' || Math.abs(warning.x - enemies.x[1]) > warning.radius * 0.32 + 1) {
        throw new Error('legendary bombardment must lock a visible warning on the boss-priority target');
    }
    stepLegendaryCompanionAttacks({ ...common, dt: 0.83 });
    if (events.length !== 1 || events[0].source !== segment || events[0].result.hits < 1
        || enemies.hp[2] !== 1e6 || warning.phase !== 'impact') {
        throw new Error('legendary bombardment warning/area damage/impact must resolve once');
    }
    stepLegendaryCompanionAttacks({ ...common, dt: 0.3 });
    if (events.length !== 1 || warning.phase !== 'cooldown') {
        throw new Error('legendary bombardment must enter cooldown after its single impact');
    }
    const RenderProbe = createGame({ Component: class {} });
    const drawing = [];
    const guide = {
        circle (x, y, r) { drawing.push({ op: 'circle', x, y, r }); },
        fill () { drawing.push({ op: 'fill' }); },
        stroke () { drawing.push({ op: 'stroke' }); },
        moveTo (x, y) { drawing.push({ op: 'moveTo', x, y }); },
        lineTo (x, y) { drawing.push({ op: 'lineTo', x, y }); },
    };
    const previewWarning = { phase: 'warning', timer: 0.41, x: 180, y: -45, radius: 120 };
    RenderProbe.prototype.drawLegendaryCompanionWarnings.call({
        chain: { segments: [{ fam: 'legend-mewtwo', tier: 1, legendaryBombardment: previewWarning }] },
        wall: 0.4,
        pal: { get: (color, alpha) => ({ color, alpha }) },
    }, guide);
    const centerGuides = drawing.filter((entry) => entry.op === 'circle'
        && entry.x === previewWarning.x && entry.y === previewWarning.y);
    if (centerGuides.length !== 2 || centerGuides.some((entry) => entry.r !== previewWarning.radius)
        || drawing.filter((entry) => entry.op === 'lineTo').length !== 18) {
        throw new Error('legendary fixed-area warning must show the exact hit boundary with irregular ground scars, not a scope');
    }
    console.log('神兽入队：2.2×基础体型、重复捕捉缓增封顶、锁定预警+优先BOSS范围轰炸 PASS');
}
// Screen-space lair guidance: visible sites pin to their projection, off-screen sites clamp to the
// safe frame edge, and several destinations on one edge keep separate arrow anchors.
{
    const sites = [
        { number: 1, name: '超梦', x: 120, y: 80, complete: false },
        { number: 2, name: '洛奇亚', x: 2000, y: 0, complete: false },
        { number: 3, name: '烈空坐', x: 1800, y: 0, complete: false },
        { number: 4, name: '已完成', x: -2000, y: 900, complete: true },
    ];
    const markers = legendaryGuideLayout(sites, { x: 0, y: 0, z: 1 }, VIEW);
    const inside = markers.find((marker) => marker.site.number === 1);
    const right = markers.filter((marker) => marker.edge === 'right');
    if (markers.length !== 3 || !inside || inside.site.name !== '超梦'
        || !inside.inside || inside.x !== 120 || inside.y !== 80
        || right.length !== 2 || right.some((marker) => marker.x > VIEW.W / 2 - 48)
        || Math.abs(right[0].y - right[1].y) < 41) {
        throw new Error('multi-site legendary guide projection / edge spacing regression');
    }
    console.log('神兽地点屏幕指引：镜头内定位、镜头外贴边、多箭头避让 PASS');
}
// Every lair gets a unique, upright species emblem while its outer needle still follows the target.
{
    const lairs = LEGENDARY_BOSSES;
    const styles = lairs.map((boss) => legendaryGuideStyle(boss.id));
    const glyphs = new Set(styles.filter(Boolean).map((style) => style.glyph));
    if (styles.length !== 9 || styles.some((style) => !style) || glyphs.size !== lairs.length) {
        throw new Error('each legendary lair needs a registered, distinct map emblem');
    }
    class Color {
        constructor (r, g, b, a) { Object.assign(this, { r, g, b, a }); }
    }
    const cc = { Color };
    const drawCalls = [];
    const graphics = new Proxy({}, {
        set (target, key, value) { target[key] = value; return true; },
        get (target, key) {
            if (key in target) return target[key];
            return (...args) => drawCalls.push([key, ...args]);
        },
    });
    for (let i = 0; i < lairs.length; i++) {
        drawLegendaryGuideIcon(graphics, cc,
            { species: lairs[i].id, number: i + 1 }, 100, 100, i * Math.PI / 4, 2, false);
    }
    if (!drawCalls.some(([name]) => name === 'circle') || !drawCalls.some(([name]) => name === 'lineTo')) {
        throw new Error('legendary map emblems must draw both their medallion and directional needle');
    }
    console.log('神兽地点专属徽记：九种独特图案、统一罗盘底座、实时方向针 PASS');
}
// The real ring is the view edge + pad; at zoom 1.2 that is 640/1.2 + 90, and it is the number the
// leash recycles off, so the sim pins it instead of deriving it from a camera it does not have.
const RING = VIEW.W / 2 / VIEW.zoom0 + ENEMY.spawnRingPad;
// Must match MUZZLE in game.js: the ball leaves from the arm, so an aim solved from the hero's centre
// hits a millimetre differently than the reticle does.
const MUZZLE = 26;
const MIN = Number(process.argv[2] || 3);
// Env-overridable so a config A/B can be repeated over seeds instead of concluded from one timeline.
const SEED = Number(process.env.SEED || 20260920);
// §5.7-G-2's control arm: SKILL=0 leaves `seg.keep` undefined, so it is not "the numbers frozen" - it is
// the pre-v0.5 code path, byte for byte, running on the same seeds and the same wave table.
const SKILL = process.env.SKILL !== '0';
// Six of the twelve families have a 主技, so an unforced run spends most of its chain on animals that
// cannot fire and the A/B measures nothing. FORCED=lizard,beetle makes *both* arms go and catch the same
// species, so what is compared is the split, not how the RNG dealt the roster.
const FORCED = (process.env.FORCED || '').split(',').filter(Boolean);

// Z-Crystals read actual stage types and stacked party quantities, then launch one aimed AoE projectile.
{
    const team = [
        { fam: 'cyndaquil', tier: 1, count: 3 },
        { fam: 'fennekin', tier: 3, count: 2 },
        { fam: 'lucario', tier: 2, count: 4 },
    ];
    const fire = zAffinityCount(team, 'FIRE');
    const expectedTypes = ['NORMAL', 'FIRE', 'WATER', 'GRASS', 'ELECTRIC', 'ICE', 'FIGHTING',
        'POISON', 'GROUND', 'FLYING', 'PSYCHIC', 'BUG', 'ROCK', 'GHOST', 'DRAGON', 'DARK', 'STEEL', 'FAIRY'];
    const actualTypes = Z_CRYSTALS.map((crystal) => crystal.type);
    if (Z_CRYSTALS.length !== 18 || new Set(actualTypes).size !== 18
        || expectedTypes.some((type) => !actualTypes.includes(type)) || fire !== 5
        || zAffinityCount(team, 'PSYCHIC') !== 2 || zAffinityCount(team, 'FIGHTING') !== 4
        || zMoveMetrics(5).radius <= zMoveMetrics(1).radius
        || zMoveMetrics(10000).radius !== Z_POWER_BAND.radiusMax
        || !LEVELS.some((entry) => entry.id === 'zPowerBand' && entry.rarity === 'legendary')) {
        throw new Error('Z-Crystal roster affinity, scale curve, or unlock item regression');
    }
    const system = new ZMoveSystem();
    const launch = system.launch('fire', fire, { x: 0, y: 0 }, { x: 200, y: 0 }, 100);
    const enemy = {
        x: new Float32Array([200]), y: new Float32Array([0]), r: new Float32Array([10]),
        hp: new Float32Array([50]), dead: new Uint8Array([0]), _q: [],
        grid: { query (_x, _y, _r, out) { out.length = 0; out.push(0); return out; } },
        hurt (i, damage) {
            if (this.dead[i]) return false;
            this.hp[i] = Math.max(0, this.hp[i] - damage);
            if (this.hp[i] <= 0) this.dead[i] = 1;
            return !!this.dead[i];
        },
    };
    const impact = system.step(1, enemy);
    // 18 attributes each carry launch, moving-trail, and impact particle profiles.
    if (!launch || launch.id !== 'fire' || !(system.cooldown > 0 && system.cooldown < Z_POWER_BAND.cooldown)
        || !impact || impact.hits !== 1 || impact.kills !== 1 || !system.burst
        || Object.keys(Z_MOVE_PARTICLE_PRESETS).length !== Z_CRYSTALS.length * 3) {
        throw new Error('Z-Crystal aimed projectile, area hit, cooldown, or Cocos particle integration regression');
    }
    const cc = { KeyCode: { KEY_X: 88, KEY_Z: 90, KEY_C: 67, SPACE: 32, KEY_J: 74, DIGIT_1: 49, DIGIT_9: 57 } };
    const input = new Input(cc, VIEW, CATCH);
    const actions = [];
    let rawKeyCalls = 0;
    input.bindAction('z-power', cc.KeyCode.KEY_Z);
    input.bindAction('mega-skill', cc.KeyCode.KEY_X);
    input.onAction = (action) => actions.push(action);
    input.onKey = () => rawKeyCalls++;
    const event = { code: 'KeyZ', keyCode: 229, repeat: false, cancelable: true, preventDefault () {} };
    input._key(event);
    input._key({ ...event, repeat: true });
    const megaEvent = { ...event, code: 'KeyX' };
    input._key(megaEvent);
    input._key({ ...megaEvent, repeat: true });
    if (actions.join('|') !== 'z-power|mega-skill' || rawKeyCalls !== 0) {
        throw new Error('Z/X named skill actions / IME physical-key edge regression');
    }
    input.setTouchAxis(0.6, 0.8);
    const axis = { x: 0, y: 0 };
    input.axis(axis, 0, 0);
    input.setTouchFire(true);
    const touchHold = input.sample(1 / 60).hold;
    input.setTouchFire(false);
    input.setTouchAxis(0, 0);
    if (Math.abs(axis.x - 0.6) > 1e-6 || Math.abs(axis.y - 0.8) > 1e-6 || !touchHold
        || input.sample(1 / 60).hold) throw new Error('mobile stick vector / hold-to-fire input regression');
    // Exercise the actual game cast path: this catches missing combat-helper imports that a
    // key-mapping-only probe cannot see (the user's play log exposed hitArea as undefined here).
    const Game = createGame({ Component: class {}, KeyCode: { KEY_X: 88 } });
    const seg = { tier: 1, count: 1, megaSkillCd: 0, fam: 'specter' };
    const enemies = {
        grid: { query (_x, _y, _r, out) { out.length = 0; out.push(0); return out; } },
        _q: [], x: [20], y: [0], r: [5], dead: [0], hp: [100],
        hurt (i, damage) { this.hp[i] = Math.max(0, this.hp[i] - damage); return this.hp[i] <= 0; },
    };
    const game = {
        selectedMega: seg, player: { x: 0, y: 0 }, aimWorld: { x: 20, y: 0 },
        build: { dmg: 1 }, level: 1, enemies,
        megaSkillUsers: () => [seg],
        combatFormForSegment: () => ({ id: 'gengar', fam: 'specter', color: '#bb82ff', megaName: '超级耿鬼' }),
        activeSkillForForm: () => ({ name: '暗影禁域', radius: 158, power: 8.5, cooldown: 14 }),
        logEvent () {}, megaSkillFx () {}, playCombatSkillSound () {},
        particleBursts: { burst () {} }, wave () {}, kick () {}, say () {},
    };
    if (!Game.prototype.castMegaSkill.call(game) || enemies.hp[0] >= 100 || seg.megaSkillCd !== 14) {
        throw new Error('X active skill cast path must resolve hitArea, damage targets, and start cooldown');
    }
    const touchUsers = [
        { fam: 'torch', megaSkillCd: 0 },
        { fam: 'tide', megaSkillCd: 9 },
        { fam: 'volt', megaSkillCd: 0 },
    ];
    const touchGame = Object.create(Game.prototype);
    Object.assign(touchGame, {
        selectedMega: touchUsers[0], player: { dead: false }, levelUp: null,
        furnace: { open: false }, evolutionReward: { open: false },
        dynamaxSelector: { open: false }, zCrystalSelector: { open: false },
        megaSkillUsers: () => touchUsers,
        combatFormForSegment: (user) => ({ id: user.fam, fam: user.fam, megaName: user.fam, kind: 'mega' }),
        activeSkillForForm: () => ({ name: 'test', shape: 'circle', radius: 20, cooldown: 10 }),
        logEvent () {}, say () {},
        castMegaSkill () {
            if (!this.selectedMega || this.selectedMega.megaSkillCd > 0) return false;
            this.selectedMega.megaSkillCd = 10;
            return true;
        },
    });
    if (!Game.prototype.useTouchMegaSkill.call(touchGame) || touchGame.selectedMega !== touchUsers[2]
        || touchUsers[0].megaSkillCd !== 10) {
        throw new Error('touch skill cast should fire once and auto-select the next ready user, skipping cooldowns');
    }
    touchUsers[0].megaSkillCd = 0;
    if (!Game.prototype.cycleTouchMegaSkill.call(touchGame) || touchGame.selectedMega !== touchUsers[0]) {
        throw new Error('touch switch should manually cycle only to a ready skill');
    }
    touchUsers.forEach((user) => { user.megaSkillCd = 3; });
    if (Game.prototype.cycleTouchMegaSkill.call(touchGame)) {
        throw new Error('touch switch must not select a skill while every skill is cooling down');
    }
    touchUsers[1].megaSkillCd = 0;
    Game.prototype.refreshTouchMegaSkill.call(touchGame);
    if (touchGame.selectedMega !== touchUsers[1]) {
        throw new Error('mobile auto-selection should recover to a skill when it becomes ready');
    }
    console.log('Z/X主动技能：专用动作绑定、IME物理键识别、重复键抑制 PASS');
    console.log('手机主动技能：使用后自动跳到下一个就绪技能、手动切换跳过冷却、全冷却保护 PASS');
    console.log('Z力量手环：18属性全覆盖、真实属性/堆叠共鸣、弹道AOE/冷却、粒子 PASS');
}

// Runtime UI regressions reported in the browser: crystal cards live in entries, and charge uses hitInterval.
{
    class Color {
        constructor (r, g, b, a) { Object.assign(this, { r, g, b, a }); }
    }
    const graphics = () => ({
        clear () {}, rect () {}, fill () {}, stroke () {}, moveTo () {}, lineTo () {}, circle () {},
    });
    const selector = Object.create(ZCrystalSelector.prototype);
    Object.assign(selector, {
        cc: { Color },
        pal: { get: (hex, alpha) => ({ hex, alpha }) },
        g: graphics(),
        cards: [{ x: 0, y: 0 }],
        entries: [{ crystal: Z_CRYSTALS[0], count: 1, ...zMoveMetrics(1) }],
        page: 0, hover: 0,
        pageLabel: { string: '' }, prevLabel: { string: '' }, nextLabel: { string: '' },
    });
    selector.render(0);
    if (!selector.g.strokeColor || selector.g.strokeColor.r !== 255) {
        throw new Error('Z-Crystal selector must render using the current entry crystal, not a nonexistent card.crystal');
    }

    const hudGraphics = graphics();
    const label = () => ({ string: '', color: null, node: { active: false } });
    const hud = Object.assign(Object.create(Hud.prototype), {
        cc: { Color }, skillRoot: { active: false },
        skillSprite: { node: { active: false }, spriteFrame: null },
        skillSignature: null, skillCooldownKey: null,
        skillForm: label(), skillName: label(), skillRange: label(), skillKeyLabel: label(),
        skillStatus: label(),
        skillPanel: hudGraphics, skillDiagram: graphics(), skillKeys: graphics(), skillCooldownGauge: graphics(),
    });
    hud.setCombatSkill({ id: 'blaziken', name: '超级火焰鸡', color: '#ff705d' }, BLAZIKEN_CHARGE_SKILL, 0);
    if (!hud.skillRange.string.includes('每 0.34 秒一次')) {
        throw new Error(`Blaziken HUD should display hitInterval without throwing: ${hud.skillRange.string}`);
    }

    const skillFx = new SkillSystem();
    skillFx._fx('field', 'moth', undefined, 4, 30, 0, 0, 0.5);
    if (skillFx.nfx !== 0) throw new Error('Skill FX with invalid world position must not enter the renderer queue');
    skillFx._fx('field', 'moth', 12, -8, 30, 0, 0, 0.5);
    if (skillFx.nfx !== 1 || skillFx.fx[0].x !== 12 || skillFx.fx[0].y !== -8) {
        throw new Error('Finite skill FX world position should remain renderable');
    }
    console.log('UI异常回归：Z纯晶卡片颜色、火焰鸡冲锋间隔、无效特效坐标保护 PASS');
}

// Every bullet style must compile against the shared fragment frame: a style body redeclaring one
// of the frame's own names (p/edge/core/ink/texel/a/r) is an illegal GLSL redeclaration at the same
// scope, and a broken program renders its sprite as a blank quad - the 极巨化 sprite vanisher.
{
    const frameNames = new Set(['p', 'edge', 'core', 'ink', 'texel', 'r', 'a']);
    const names = bulletStyleNames();
    if (names.length < 36 || !names.includes('dynamax-pokemon') || !names.includes('psychic')) {
        throw new Error('bullet style roster regression');
    }
    for (const name of names) {
        const body = bulletStyleBodySource(name);
        const fragment = bulletFragmentSource(name);
        const usesMegaPolarCoordinates = name === 'mega' || name.startsWith('mega-');
        const rDeclarations = (fragment.match(/\bfloat r = length\(p\);/g) || []).length;
        const aDeclarations = (fragment.match(/\bfloat a = atan\(p\.y, p\.x\);/g) || []).length;
        if (rDeclarations !== Number(usesMegaPolarCoordinates)
            || aDeclarations !== Number(usesMegaPolarCoordinates)) {
            throw new Error(`${name} shader must declare polar coordinates exactly once when required`);
        }
        for (const line of body.split('\n')) {
            const declared = line.match(/^\s*float\s+(\w+)\s*=/);
            if (declared && frameNames.has(declared[1])) {
                throw new Error(`${name} shader redeclares shared name ${declared[1]} - GLSL compile failure`);
            }
        }
    }
    // The Pokémon-art style must read the source sprite (not the glyph frame's ink) and the frame
    // must give it sprite-space uv coordinates with the glyph-edge white-out off, or a 48 px+
    // icon quad is blown out to a white blob. The dynamax look itself is rim-weighted: the art
    // stays readable at the centre while the red energy rides the edge and travelling veins.
    const artBody = bulletStyleBodySource('dynamax-pokemon');
    const artFrag = bulletFragmentSource('dynamax-pokemon');
    if (!artBody.includes('texel.rgb * color.rgb') || !artBody.includes('rim')
        || !artBody.includes('veins') || !artBody.includes('cc_time')) {
        throw new Error('dynamax-pokemon art shader lost its source tint, rim glow, or animated veins');
    }
    const baseMix = artBody.match(/mix\(source, vec3\(1\.0, 0\.12, 0\.2\), ([\d.]+) \+/);
    if (!baseMix || Number(baseMix[1]) > 0.12) {
        throw new Error('dynamax-pokemon art shader washes the centre art with too much flat red');
    }
    if (!artFrag.includes('uv0 * 2.0 - 1.0') || artFrag.includes('edge * 0.82')) {
        throw new Error('dynamax-pokemon art shader lost its sprite-space coordinates or edge opt-out');
    }
    // 极巨化期间的持续能量粒：稀疏小簇、上浮、带寿命，让粒子系统接管氛围而不是色块。
    // 激活是「冲击火花 + 向上喷发的红柱」组合，结束是向内收拢的坍缩火花。
    const aura = skillParticlePresetForEvent('dynamax-aura');
    const pillar = skillParticlePresetForEvent('dynamax-start-pillar');
    const startBurst = skillParticlePresetForEvent('dynamax-start');
    const endBurst = skillParticlePresetForEvent('dynamax-end');
    for (const form of GIGANTAMAX_FORMS) {
        const aura = skillParticlePresetForEvent(`gmax-aura-${form.id}`);
        const skill = skillParticlePresetForEvent(`gmax-skill-${form.id}`);
        if (!aura || !skill || !aura.glyph || !skill.glyph || aura.particleClass !== 'gigantamax'
            || skill.particleClass !== 'gigantamax' || aura.totalParticles > 8 || skill.totalParticles > 20) {
            throw new Error(`${form.id} Gigantamax body/skill particle profiles are missing or exceed the budget`);
        }
    }
    const projectileParticleTypes = ['grass', 'fire', 'water', 'bolt', 'crystal', 'support'];
    const projectileParticlePresets = projectileParticleTypes.map((element) =>
        skillParticlePresetForEvent(`projectile-trail-${element}`));
    if (projectileParticlePresets.some((preset) => !preset || !preset.glyph
        || preset.glyph === 'circle' || preset.totalParticles > 8 || preset.life > 0.4)) {
        throw new Error('ordinary projectile native particle trail profiles are missing or too heavy');
    }
    const trainerParticlePresets = projectileParticleTypes.map((element) =>
        skillParticlePresetForEvent(`trainer-projectile-trail-${element}`));
    if (trainerParticlePresets.some((preset) => !preset || preset.particleClass !== 'hostile-projectile-trail'
        || !preset.glyph || preset.glyph === 'circle' || preset.totalParticles > 5 || preset.life > 0.24)) {
        throw new Error('trainer hostile-shot particle profiles are missing or exceed the shared-pool budget');
    }
    const beamParticlePresets = projectileParticleTypes.map((element) =>
        skillParticlePresetForEvent(`beam-trail-${element}`));
    if (beamParticlePresets.some((preset) => !preset || preset.particleClass !== 'beam-trail'
        || !preset.glyph || preset.glyph === 'circle' || preset.totalParticles > 6 || preset.life > 0.28)) {
        throw new Error('continuous-beam particle profiles are missing or exceed the shared-pool budget');
    }
    const orbitParticlePresets = projectileParticleTypes.map((element) =>
        skillParticlePresetForEvent(`orbit-trail-${element}`));
    if (orbitParticlePresets.some((preset) => !preset || preset.particleClass !== 'orbit-trail'
        || !preset.glyph || preset.glyph === 'circle' || preset.totalParticles > 6 || preset.life > 0.28)) {
        throw new Error('orbiting skill particle profiles are missing or exceed the shared-pool budget');
    }
    const fieldParticlePresets = projectileParticleTypes.map((element) =>
        skillParticlePresetForEvent(`field-trail-${element}`));
    if (fieldParticlePresets.some((preset) => !preset || preset.particleClass !== 'field-trail'
        || !preset.glyph || preset.glyph === 'circle' || preset.totalParticles > 5 || preset.life > 0.4)) {
        throw new Error('persistent-field particle profiles are missing or exceed the shared-pool budget');
    }
    const zTrailPresets = Z_CRYSTALS.map(({ id }) => skillParticlePresetForEvent(`z-${id}-trail`));
    if (zTrailPresets.length !== 18 || zTrailPresets.some((preset) => !preset
        || preset.particleClass !== 'z-trail' || !preset.glyph || preset.glyph === 'circle'
        || preset.totalParticles > 4 || preset.life > 0.3)) {
        throw new Error('all 18 Z projectile trails need type-specific bounded particle profiles');
    }
    const signatureProjectileFamilies = [
        'mush', 'sprigatito', 'froakie', 'tandemaus', 'lucario', 'honedge', 'machop', 'togepi',
        'buizel', 'munchlax', 'shinx', 'zorua', 'toxtricity', 'shroomish', 'hatenna',
        'impidimp', 'archen', 'smoliv', 'tadbulb', 'wattrel', 'porygon',
    ];
    const signatureParticlePresets = signatureProjectileFamilies.map((famId) =>
        skillParticlePresetForEvent(`projectile-trail-${famId}`));
    if (signatureParticlePresets.some((preset) => !preset || !preset.glyph || !preset.color
        || preset.totalParticles > 8 || preset.life > 0.45)) {
        throw new Error('signature projectile trails need distinct, bounded native particle presets');
    }
    const signatureVisuals = new Set(signatureParticlePresets.map((preset) =>
        [preset.glyph, preset.color, preset.tangentialAccel, preset.gravityY].join('|')));
    if (signatureVisuals.size !== signatureProjectileFamilies.length) {
        throw new Error('two signature projectile families unexpectedly share the exact same particle style');
    }
    const zoruaParticle = skillParticlePresetForEvent('projectile-trail-zorua');
    if (zoruaParticle.glyph !== 'crescent' || zoruaParticle.color !== '#f0a7ff'
        || zoruaParticle.totalParticles < 7 || zoruaParticle.startSize < 32
        || zoruaParticle.particleClass !== 'projectile-trail') {
        throw new Error('Zorua signature shots must leave a clearly visible native crescent-particle trail');
    }
    const trailProbe = Object.create(NativeParticleBursts.prototype);
    trailProbe.trailTimer = 0;
    trailProbe.trailCursor = 0;
    const sampledTrails = [];
    trailProbe.burst = (...args) => sampledTrails.push(args);
    const crowdedFamilies = Array(90).fill('mush');
    crowdedFamilies[74] = 'zorua';
    trailProbe.updateProjectileTrails(0.06, {
        n: crowdedFamilies.length, pfam: crowdedFamilies, pmega: Array(crowdedFamilies.length).fill(null),
        px: Array(crowdedFamilies.length).fill(0), py: Array(crowdedFamilies.length).fill(0),
        pvx: Array(crowdedFamilies.length).fill(1), pvy: Array(crowdedFamilies.length).fill(0),
    });
    if (sampledTrails.length !== 6) {
        throw new Error('particle-first projectile trails must sample six shots per tick');
    }
    const elementalSignatureProbe = Object.create(NativeParticleBursts.prototype);
    Object.assign(elementalSignatureProbe, { trailTimer: 0, trailCursor: 0 });
    const elementalSignatureSamples = [];
    elementalSignatureProbe.burst = (...args) => elementalSignatureSamples.push(args);
    const elementalSignatureFamilies = ['buizel', 'shinx', 'munchlax'];
    elementalSignatureProbe.updateProjectileTrails(0.056, {
        n: elementalSignatureFamilies.length, pfam: elementalSignatureFamilies,
        pmega: [null, null, null], px: [10, 20, 30], py: [0, 0, 0],
        pvx: [1, 1, 1], pvy: [0, 0, 0],
    });
    if (elementalSignatureSamples.length !== 3
        || elementalSignatureFamilies.some((fam) => !elementalSignatureSamples.some((entry) =>
            entry[0] === fam && entry[4] === `projectile-trail-${fam}`))) {
        throw new Error('Aqua Jet, Thunder Claw and Snore Wave must route through their dedicated native trails');
    }
    const iconTrailProbe = Object.create(NativeParticleBursts.prototype);
    Object.assign(iconTrailProbe, { trailTimer: 0, trailCursor: 0 });
    const iconSamples = [];
    iconTrailProbe.burst = (...args) => iconSamples.push(args);
    iconTrailProbe.updateProjectileTrails(0.056, {
        n: 1, pfam: ['dreepy'], pmega: [null],
        pvariant: [0], pShiny: [1], pMode: [0], pStage: [3], pr: [10],
        px: [20], py: [0], pvx: [1], pvy: [0],
        nProjectileSamples: 1,
        projectileSamples: [{ x: 10, y: 0, angle: 0, variant: 2, shiny: false, radius: 12 }],
    });
    if (iconSamples.length !== 2 || iconSamples.some((entry) => entry[4] !== 'projectile-icon')
        || iconSamples[0][6]?.glyphFrame !== 'MAUSHOLD_COMPANION_3'
        || iconSamples[1][6]?.glyphFrame !== 'DREEPY_s'
        || iconSamples.some((entry) => entry[6]?.particlePreset?.particleClass !== 'projectile-icon')
        || iconSamples[0][6]?.startSize < 40
        || iconSamples[0][6]?.particlePreset?.color !== '#ffffff'
        || iconSamples[0][6]?.particlePreset?.totalParticles !== 1
        || iconSamples[0][6]?.particlePreset?.life >= 0.14
        || iconSamples[0][6]?.particlePreset?.spinStartVar !== 0
        || iconSamples[0][6]?.particlePreset?.spinEnd !== 0) {
        throw new Error('Maushold and shiny Dragon Darts must route their real icons through native particles');
    }
    const closeHitProbe = Object.create(NativeParticleBursts.prototype);
    Object.assign(closeHitProbe, { trailTimer: 0, trailCursor: 0 });
    const contactMouseSamples = [];
    closeHitProbe.burst = (...args) => contactMouseSamples.push(args);
    closeHitProbe.updateProjectileTrails(0.016, {
        n: 0, nProjectileSamples: 1,
        projectileSamples: [{ x: 2, y: 3, angle: 0.5, variant: 0, shiny: true, radius: 8 }],
    });
    if (contactMouseSamples.length !== 1
        || contactMouseSamples[0][6]?.glyphFrame !== 'MAUSHOLD_COMPANION_1_s'
        || contactMouseSamples[0][6]?.particlePreset?.color !== '#ffffff'
        || contactMouseSamples[0][6]?.startSize !== 40) {
        throw new Error('A Maushold projectile that hits before a trail poll must still render its mouse at contact');
    }
    const sweepProbe = Object.create(NativeParticleBursts.prototype);
    sweepProbe.trailTimer = 0;
    sweepProbe.trailCursor = 0;
    const sweptShotPositions = new Set();
    let zoruaWasSampled = false;
    sweepProbe.burst = (fam, x, _y, _angle, kind) => {
        sweptShotPositions.add(x);
        if (fam === 'zorua' && kind === 'projectile-trail-zorua') zoruaWasSampled = true;
    };
    const crowdedSkills = {
        n: crowdedFamilies.length, pfam: crowdedFamilies,
        pmega: Array(crowdedFamilies.length).fill(null),
        px: Array.from({ length: crowdedFamilies.length }, (_, i) => i),
        py: Array(crowdedFamilies.length).fill(0),
        pvx: Array(crowdedFamilies.length).fill(1), pvy: Array(crowdedFamilies.length).fill(0),
    };
    for (let tick = 0; tick < 15; tick++) sweepProbe.updateProjectileTrails(0.056, crowdedSkills);
    if (sweptShotPositions.size !== crowdedFamilies.length || !zoruaWasSampled) {
        throw new Error(`crowded projectile rotation must particle-sample every live shot (${sweptShotPositions.size}/${crowdedFamilies.length})`);
    }
    const hostileTrailProbe = Object.create(NativeParticleBursts.prototype);
    hostileTrailProbe.trainerTrailTimer = 0;
    hostileTrailProbe.trainerTrailCursor = 0;
    const hostileSamples = [];
    hostileTrailProbe.burst = (...args) => hostileSamples.push(args);
    const trainerShots = {
        active: true, n: 5, slot: Array(5).fill(0), party: [{ fam: 'mush' }],
        x: [0, 1, 2, 3, 4], y: Array(5).fill(0), vx: Array(5).fill(1), vy: Array(5).fill(0),
        isMegaSlot: () => false,
    };
    for (let tick = 0; tick < 3; tick++) hostileTrailProbe.updateTrainerProjectileTrails(0.056, trainerShots);
    if (new Set(hostileSamples.map((entry) => entry[1])).size !== 5 || hostileSamples.some((entry) =>
        entry[4] !== 'trainer-projectile-trail-grass')) {
        throw new Error('every trainer boss projectile should receive a bounded elemental particle trail');
    }
    const beamProbe = Object.create(NativeParticleBursts.prototype);
    beamProbe.skillFxTimer = 0;
    beamProbe.skillFxCursor = 0;
    beamProbe.skillFxPhase = 0;
    beamProbe.skillFxScratch = [];
    const beamSamples = [];
    beamProbe.burst = (...args) => beamSamples.push(args);
    const beamFx = Array.from({ length: 5 }, (_, i) => ({
        kind: 'beam', fam: 'mush', x: i * 100, y: 4, a: 10, rot: 0,
    }));
    for (let tick = 0; tick < 3; tick++) beamProbe.updateSkillEffectParticles(0.056, { nfx: 5, fx: beamFx });
    if (beamSamples.length !== 6 || beamSamples.some((entry) => entry[4] !== 'beam-trail-grass')
        || new Set(beamSamples.slice(0, 5).map((entry) => entry[1])).size !== 5) {
        throw new Error('continuous beams should pulse bounded elemental particles along their live hit lanes');
    }
    const skillFxProbe = Object.create(NativeParticleBursts.prototype);
    skillFxProbe.skillFxTimer = 0;
    skillFxProbe.skillFxCursor = 0;
    skillFxProbe.skillFxPhase = 0;
    skillFxProbe.skillFxScratch = [];
    const skillFxSamples = [];
    skillFxProbe.burst = (...args) => skillFxSamples.push(args);
    const mixedSkillFx = [
        { kind: 'beam', fam: 'mush', x: 0, y: 0, a: 80, b: 12, rot: 0 },
        { kind: 'slash', fam: 'mush', x: 100, y: 0, a: 24, b: 1, rot: 0.4, p: 0.5 },
        { kind: 'orbit', fam: 'mush', x: 200, y: 0, a: 30, b: 4, c: 2, rot: 0.6 },
    ];
    for (let tick = 0; tick < 2; tick++) {
        skillFxProbe.updateSkillEffectParticles(0.056, { nfx: mixedSkillFx.length, fx: mixedSkillFx });
    }
    if (!skillFxSamples.some((entry) => entry[4] === 'beam-trail-grass')
        || !skillFxSamples.some((entry) => entry[4] === 'projectile-trail-mush')
        || !skillFxSamples.some((entry) => entry[4] === 'orbit-trail-grass')) {
        throw new Error('beam, slash and orbit effects must all route through their native particle profiles');
    }
    const fieldFxProbe = Object.create(NativeParticleBursts.prototype);
    fieldFxProbe.fieldFxTimer = 0;
    fieldFxProbe.fieldFxCursor = 0;
    fieldFxProbe.fieldFxPhase = 0;
    fieldFxProbe.fieldFxScratch = [];
    const fieldFxSamples = [];
    fieldFxProbe.burst = (...args) => fieldFxSamples.push(args);
    const fieldFx = Array.from({ length: 3 }, (_, i) => ({
        kind: 'field', fam: 'smoliv', x: i * 100, y: 10, a: 80, p: 0.5,
    }));
    for (let tick = 0; tick < 2; tick++) {
        fieldFxProbe.updateFieldParticles(0.121, { nfx: fieldFx.length, fx: fieldFx });
    }
    if (fieldFx.some((fx) => !fieldFxSamples.some((entry) => entry[4] === 'field-trail-grass'
        && Math.hypot(entry[1] - fx.x, entry[2] - fx.y) <= fx.a))
        || fieldFxSamples.some((entry) => entry[4] !== 'field-trail-grass'
            || Math.min(...fieldFx.map((fx) => Math.hypot(entry[1] - fx.x, entry[2] - fx.y))) > 80)) {
        throw new Error('persistent ground fields should receive bounded elemental particles within their radius');
    }
    const zTrailProbe = Object.create(NativeParticleBursts.prototype);
    zTrailProbe.zTrailTimer = 0;
    const zTrailSamples = [];
    zTrailProbe.burst = (...args) => zTrailSamples.push(args);
    const travelingZMove = { projectile: { id: 'fire', x: 12, y: 20, dx: 0, dy: 1 } };
    zTrailProbe.updateZMoveParticles(0.066, travelingZMove);
    zTrailProbe.updateZMoveParticles(0.066, travelingZMove);
    zTrailProbe.updateZMoveParticles(0.066, { projectile: null });
    if (zTrailSamples.length !== 2 || zTrailSamples.some((entry) => entry[4] !== 'z-fire-trail'
        || entry[0] !== 'mush' || entry[3] !== Math.PI / 2) || zTrailProbe.zTrailTimer !== 0) {
        throw new Error('live Z attacks should emit a rate-limited type-specific particle trail and cleanly stop');
    }
    const megaAreaProbe = Object.create(NativeParticleBursts.prototype);
    Object.assign(megaAreaProbe, {
        megaAreaTimer: 0, megaAreaCursor: 0, megaAreaPhase: 0, megaAreaScratch: [],
    });
    const megaAreaSamples = [];
    megaAreaProbe.burst = (...args) => megaAreaSamples.push(args);
    const genericMegaAreas = Array.from({ length: 3 }, (_, i) => ({
        active: true, area: true, x: i * 200, y: 20, radius: 100, angle: 0.3,
        form: { id: 'venusaur', fam: 'mush', color: '#f278c8', glyph: 'leaf' },
    }));
    const excludedMegaAreas = [
        { active: true, area: true, shape: 'heart', x: 800, y: 20, radius: 100,
            form: { id: 'gardevoir', fam: 'hatenna', color: '#ff91c8', glyph: 'heart' } },
        { active: true, area: true, x: 1000, y: 20, radius: 100,
            form: { id: 'inteleon', fam: 'sobble', color: '#65b9ed', glyph: 'wave', gigantamax: true } },
    ];
    const allMegaAreas = [...genericMegaAreas, ...excludedMegaAreas];
    for (let tick = 0; tick < 2; tick++) megaAreaProbe.updateMegaAreaParticles(0.076, allMegaAreas);
    if (genericMegaAreas.some((fx) => !megaAreaSamples.some((entry) => entry[4] === 'mega-area'
        && entry[5] === 'venusaur' && Math.hypot(entry[1] - fx.x, entry[2] - fx.y) <= fx.radius))
        || megaAreaSamples.length !== 4) {
        throw new Error('generic Mega areas should get bounded native motes while shape/Gmax FX keep dedicated handling');
    }
    const rosterAreaProbe = Object.create(NativeParticleBursts.prototype);
    Object.assign(rosterAreaProbe, {
        rosterAreaTimer: 0, rosterAreaCursor: 0, rosterAreaPhase: 0, rosterAreaScratch: [],
    });
    const rosterAreaSamples = [];
    rosterAreaProbe.burst = (...args) => rosterAreaSamples.push(args);
    const rosterAreaIds = [
        ['roster-breloom', 'shroomish'], ['roster-hatterene', 'hatenna'],
        ['roster-alcremie', 'alcremie'], ['roster-vivillon', 'vivillon'],
        ['roster-ribombee', 'cutiefly'],
    ];
    const rosterAreas = rosterAreaIds.map(([id, fam], i) => ({
        active: true, area: true, x: i * 220, y: -10, radius: 90, angle: 0.25,
        form: { id, fam, rosterActive: true, color: '#f3a9d2', glyph: 'heart' },
    }));
    rosterAreas.push({ active: true, area: true, x: 1300, y: 0, radius: 460,
        form: { id: 'roster-archeops', fam: 'archen', rosterActive: true, color: '#f0a253', glyph: 'feather' } });
    for (let tick = 0; tick < 3; tick++) rosterAreaProbe.updateRosterAreaParticles(0.076, rosterAreas);
    if (rosterAreas.slice(0, 5).some((fx) => !rosterAreaSamples.some((entry) => entry[4] === 'roster-area'
        && entry[5] === fx.form.id && Math.hypot(entry[1] - fx.x, entry[2] - fx.y) <= fx.radius))
        || rosterAreaSamples.length !== 6 || rosterAreaSamples.some((entry) => entry[5] === 'roster-archeops')) {
        throw new Error('roster active areas need bounded native particles; directional Archeops dive remains custom');
    }
    const signatureProbe = Object.create(NativeParticleBursts.prototype);
    Object.assign(signatureProbe, {
        signatureSkillTimer: 0, signatureSkillCursor: 0, signatureSkillPhase: 0,
        signatureSkillScratch: [],
    });
    const signatureSamples = [];
    signatureProbe.burst = (...args) => signatureSamples.push(args);
    const signatureAreas = [
        { id: 'blastoise', fam: 'turtle', color: '#70c9ff', glyph: 'cannon', width: 142, radius: 440 },
        { id: 'blaziken', fam: 'striker', color: '#ff705d', glyph: 'ember', width: 104, radius: 52 },
        { id: 'gardevoir', fam: 'mystic', color: '#ff91c8', glyph: 'crescent', width: 0, radius: 205 },
        { id: 'legend-hooh', fam: 'legend-hooh', color: '#ff7047', glyph: 'flame', width: 0, radius: 210 },
    ].map((form, i) => ({ active: true, area: true, shape: 'signature', x: i * 600, y: 30,
        angle: 0, width: form.width, radius: form.radius, form }));
    signatureProbe.updateSignatureSkillParticles(0.056, signatureAreas);
    signatureProbe.updateSignatureSkillParticles(0.056, signatureAreas);
    if (signatureSamples.length !== 4 || signatureSamples.some((entry) => entry[4]
        !== (entry[5] === 'blaziken' ? 'blaziken-charge-trail' : 'signature-area'))
        || signatureAreas.some((fx) => !signatureSamples.some((entry) => entry[5] === fx.form.id
            && Math.hypot(entry[1] - fx.x, entry[2] - fx.y) <= fx.radius + fx.width))) {
        throw new Error('signature Mega/legendary skill particle paths should be bounded, shaped, and rate-limited');
    }
    console.log('Signature area sampling: Blastoise corridor, Blaziken wake, Gardevoir heart and Ho-Oh fire field use bounded native particles PASS');
    const blazikenWakeProbe = Object.create(NativeParticleBursts.prototype);
    Object.assign(blazikenWakeProbe, {
        signatureSkillTimer: 0, signatureSkillCursor: 0, signatureSkillPhase: 0,
        signatureSkillScratch: [],
    });
    const blazikenWakeSamples = [];
    blazikenWakeProbe.burst = (...args) => blazikenWakeSamples.push(args);
    blazikenWakeProbe.updateSignatureSkillParticles(0.056, [{
        active: true, area: true, x: 100, y: 20, angle: 0, radius: 52,
        form: { id: 'blaziken', fam: 'striker', color: '#ff705d', glyph: 'ember' },
    }]);
    const blazikenWake = blazikenWakeSamples[0];
    const blazikenWakePreset = skillParticlePresetForEvent(blazikenWake?.[4]);
    if (!blazikenWake || blazikenWake[4] !== 'blaziken-charge-trail'
        || blazikenWake[5] !== 'blaziken' || blazikenWake[1] >= 100 || blazikenWake[3] !== 0
        || blazikenWakePreset?.glyph !== 'ember' || blazikenWakePreset?.particleClass !== 'signature-area'
        || blazikenWakePreset?.startSize < 28 || blazikenWakePreset?.emissionRate < 400) {
        throw new Error("Mega Blaziken's charge must emit a visible, backward-directed dedicated ember wake");
    }
    console.log('Mega Blaziken charge wake: dedicated large ember particles trail away from player: PASS');
    class ProbeColor { constructor (r, g, b, a) { Object.assign(this, { r, g, b, a }); } }
    class ProbeVec2 { constructor (x, y) { this.x = x; this.y = y; } }
    class ProbeParticleSystem {
        resetSystem () { this.reset = true; }
        stopSystem () {}
    }
    ProbeParticleSystem.PositionType = { GROUPED: 1 };
    class ProbeNode {
        addComponent (Type) { this.particle = new Type(); return this.particle; }
        setPosition () {}
    }
    const particleParent = { addChild () {} };
    const nativeTrails = new NativeParticleBursts({
        Color: ProbeColor, Vec2: ProbeVec2, Node: ProbeNode,
        ParticleSystem2D: ProbeParticleSystem, Layers: { Enum: { UI_2D: 1 } },
        builtinResMgr: { get: () => ({}) },
    }, particleParent, 'BASE_FRAME', 'STAR_FRAME', {
        crescent: { frame: 'CRESCENT_FRAME' }, ember: { frame: 'EMBER_FRAME' },
    }, {
        crescent: { frame: 'OUTLINED_CRESCENT_FRAME' }, ember: { frame: 'OUTLINED_EMBER_FRAME' },
    });
    nativeTrails.burst('zorua', 14, 22, 0.6, 'projectile-trail-zorua');
    const nativeZoruaSlot = nativeTrails.slots[0];
    if (!nativeZoruaSlot?.ps.reset || nativeZoruaSlot.ps.spriteFrame !== 'OUTLINED_CRESCENT_FRAME'
        || nativeZoruaSlot.ps.totalParticles !== 8 || nativeZoruaSlot.ps.startSize !== 42
        || nativeZoruaSlot.ps.endSize !== 3
        || nativeZoruaSlot.ps.startColor.r !== 240 || nativeZoruaSlot.ps.startColor.b !== 255) {
        throw new Error('Zorua projectile must use its high-contrast particle glyph and readability sizing');
    }
    nativeTrails.glyphFrames.DREEPY_s = { frame: 'SHINY_DREEPY_FRAME' };
    nativeTrails.burst('dreepy', 18, 24, 0, 'projectile-icon', null, {
        glyphFrame: 'DREEPY_s', particlePreset: {
            particleClass: 'projectile-icon', glyph: 'DREEPY_s', color: '#ffffff',
            duration: 0.018, emissionRate: 60, totalParticles: 2, life: 0.17, lifeVar: 0.015,
            angleVar: 0, speed: 0, speedVar: 0, startSize: 25, startSizeVar: 0,
            endSize: 22, spinStartVar: 12, spinEnd: 0, spinEndVar: 0,
            tangentialAccel: 0, radialAccel: 0, gravityY: 0, posVar: 0.5,
        },
    });
    const shinyDreepySlot = nativeTrails.slots.find((slot) => slot.frameKey === 'DREEPY_s');
    if (!shinyDreepySlot?.ps.reset || shinyDreepySlot.ps.spriteFrame !== 'SHINY_DREEPY_FRAME'
        || shinyDreepySlot.ps.totalParticles !== 2 || shinyDreepySlot.ps.startColor.r !== 255) {
        throw new Error('shiny Dragon Dart must use its original-color icon as a native particle frame');
    }
    nativeTrails.burst('mush', 18, 24, 0, 'mega-hit', 'venusaur');
    const megaHitSlot = nativeTrails.slots.find((slot) => slot.frameKey === 'leaf');
    if (!megaHitSlot?.ps.reset || megaHitSlot.ps.totalParticles !== 20
        || megaHitSlot.ps.spriteFrame !== 'BASE_FRAME' || megaHitSlot.ps.startColor.r !== 242) {
        throw new Error('Mega impact flashes should use bounded form-colored native glyph particles');
    }
    nativeTrails.burst('hatenna', 18, 24, 0, 'roster-area', 'roster-hatterene');
    const rosterHeartSlot = nativeTrails.slots.find((slot) => slot.frameKey === 'heart');
    if (!rosterHeartSlot?.ps.reset || rosterHeartSlot.ps.totalParticles !== 5
        || rosterHeartSlot.ps.startColor.r !== 220 || rosterHeartSlot.ps.startColor.g !== 139) {
        throw new Error('roster active-area emitters should use form-specific glyphs, colors, and bounded density');
    }
    nativeTrails.burst('turtle', 30, 40, 0, 'signature-area', 'blastoise');
    const blastoiseAreaSlot = nativeTrails.slots.find((slot) => slot.frameKey === 'cannon');
    nativeTrails.burst('legend-hooh', 30, 40, 0, 'signature-area', 'legend-hooh');
    const hoohAreaSlot = nativeTrails.slots.find((slot) => slot.frameKey === 'flame');
    if (!blastoiseAreaSlot?.ps.reset || blastoiseAreaSlot.ps.totalParticles !== 5
        || blastoiseAreaSlot.ps.startColor.b !== 255
        || !hoohAreaSlot?.ps.reset || hoohAreaSlot.ps.totalParticles !== 5
        || hoohAreaSlot.ps.startColor.r !== 255 || hoohAreaSlot.ps.startColor.g !== 112) {
        throw new Error('signature area particles must resolve native glyph and palette from each Mega/legendary form');
    }
    nativeTrails.burst('striker', 30, 40, 0, 'blaziken-charge-trail', 'blaziken');
    const blazikenTrailSlot = nativeTrails.slots.find((slot) => slot.frameKey === 'ember');
    if (!blazikenTrailSlot?.ps.reset || blazikenTrailSlot.ps.spriteFrame !== 'OUTLINED_EMBER_FRAME'
        || blazikenTrailSlot.ps.totalParticles !== 8 || blazikenTrailSlot.ps.emissionRate !== 420
        || blazikenTrailSlot.ps.startSize !== 36 || blazikenTrailSlot.ps.angle !== 180
        || blazikenTrailSlot.ps.startColor.r !== 255 || blazikenTrailSlot.ps.startColor.g !== 112) {
        throw new Error('Mega Blaziken charge must use the visible, backward-directed native ember emitter');
    }
    const impactFamilies = [...signatureProjectileFamilies, 'vivillon', 'cutiefly'];
    const signatureImpactPresets = impactFamilies.map((famId) => projectileImpactPresetForFamily(famId));
    const elementalImpactPresets = projectileParticleTypes.map((element) =>
        projectileImpactPresetForFamily('not-a-signature-family', element));
    if ([...signatureImpactPresets, ...elementalImpactPresets].some((preset) => !preset
        || preset.particleClass !== 'projectile-impact' || preset.totalParticles > 12
        || preset.life > 0.3)
        || signatureImpactPresets.some((preset, i) => {
            const trail = skillParticlePresetForEvent(`projectile-trail-${impactFamilies[i]}`);
            return preset.glyph !== trail.glyph || preset.color !== trail.color || preset.radialAccel <= 0;
        })) {
        throw new Error('ordinary and signature projectile hits must burst into matching bounded particles');
    }
    const legendaryTrails = LEGENDARY_BOSSES.map(({ id }) =>
        skillParticlePresetForEvent(`projectile-trail-${id}`));
    const legendaryBursts = LEGENDARY_BOSSES.flatMap(({ id }) => [
        legendaryParticlePresetForEvent('legendary-lair-entry', id),
        legendaryParticlePresetForEvent('legendary-attack-charge', id),
        legendaryParticlePresetForEvent('legendary-attack-impact', id),
        legendaryParticlePresetForEvent('legendary-companion-impact', id),
        legendaryParticlePresetForEvent('legendary-beam', id),
        legendaryParticlePresetForEvent('legendary-pulse', id),
        legendaryParticlePresetForEvent('legendary-shot', id),
        legendaryParticlePresetForEvent('legendary-hit', id),
    ]);
    if (legendaryTrails.some((preset) => !preset || preset.particleClass !== 'projectile-trail'
        || preset.totalParticles > 8)
        || new Set(legendaryTrails.map((preset) => preset.color)).size !== LEGENDARY_BOSSES.length
        || legendaryBursts.some((preset) => !preset || preset.particleClass !== 'legendary'
            || preset.totalParticles > 34 || !preset.glyph)) {
        throw new Error('legendary-specific trails / entrance / attack particle coverage regressed');
    }
    if (!aura || aura.totalParticles > 8 || aura.life < 0.8 || aura.color !== '#ff465b') {
        throw new Error('dynamax continuous aura particle preset regression');
    }
    if (!startBurst || startBurst.totalParticles < 50 || !pillar || pillar.totalParticles < 40
        || pillar.gravityY >= 0 || !endBurst || endBurst.radialAccel >= 0) {
        throw new Error('dynamax start-pillar / end collapse particle preset regression');
    }
    console.log('弹幕材质着色器：全样式无同名遮蔽可编译 · 宝可梦本体边缘红光+能量纹 · 极巨化能量粒三件套 PASS');
}

// Dev cheats on the raw key path (M once devolved a whole party on an accidental press) must ship
// dormant: the flag is the only thing main.js's ?debug URL param may arm.
if (SIM.debugKeys !== false) {
    throw new Error('debug keys must ship dormant - set only via the ?debug URL param');
}
console.log('调试按键门禁：默认关闭 · 仅 ?debug 参数可启用 PASS');

{
    let odds = 0;
    const rngProbe = { chance(chance) { odds = chance; return true; } };
    if (SHINY_ODDS !== 2048 || !rollShiny(rngProbe) || odds !== 1 / 2048) {
        throw new Error('Shiny rarity is not connected to the seeded 1/2048 encounter roll');
    }
    // 闪耀护符：倍率走同一掷，×4 每级，读作 1/512 → 1/128 → 1/32。
    if (!rollShiny(rngProbe, 4) || odds !== 4 / 2048 || !rollShiny(rngProbe, 64) || odds !== 64 / 2048) {
        throw new Error('shiny charm multiplier regression');
    }
    const charm = LEVELS.find((entry) => entry.id === 'shinyCharm');
    if (!charm || charm.rarity !== 'legendary' || charm.max !== 3) {
        throw new Error('shiny charm upgrade card regression');
    }
    const chain = new ChainSystem(null, CHAIN);
    chain.reset(0, 0);
    chain.cap = 1;
    if (!chain.add('mush', 1) || !chain.add('mush', 1, 1, true) || chain.add('bird', 1)
        || chain.normalSegmentCount !== 1 || chain.shinySegmentCount !== 1) {
        throw new Error('A same-family shiny must coexist without spending a normal team slot');
    }
    chain.absorb('mush', 1);
    chain.absorb('mush', 1, true);
    if (chain.segments[0].count !== 3 || chain.segments[1].count !== 3) {
        throw new Error('Same-family catches must advance the normal and shiny progress tracks once each');
    }
    let evolve = chain.findAuto({ cores: 0 });
    if (evolve < 0 || !chain.evolve(evolve, { cores: 0 })) throw new Error('Normal branch did not auto-evolve');
    evolve = chain.findAuto({ cores: 0 });
    if (evolve < 0 || !chain.evolve(evolve, { cores: 0 })
        || chain.segments.length !== 2 || chain.segments[0].tier !== 2 || chain.segments[1].tier !== 2
        || chain.segments[0].shiny || !chain.segments[1].shiny
        || chain.normalSegmentCount !== 1 || chain.shinySegmentCount !== 1) {
        throw new Error('Parallel evolution merged the rarity tracks or lost the shiny identity');
    }
    if (chain.absorb('legend-mewtwo', 1) !== 'new'
        || chain.absorb('legend-lugia', 1) !== 'new'
        || chain.absorb('legend-mewtwo', 1) !== 'top-stack'
        || chain.normalSegmentCount !== 1 || chain.shinySegmentCount !== 1
        || chain.segments.find((segment) => segment.fam === 'legend-mewtwo')?.count !== 2
        || chain.segments.find((segment) => segment.fam === 'legend-lugia')?.count !== 1) {
        throw new Error('Legendary captures must bypass a full normal roster and stack same-species duplicates');
    }

    const enemies = new EnemySystem(ENEMY, makeRng(2048));
    const wild = enemies.spawn(0, 0, 0, 1, true, 0, 0, -1, BOSS.party.length, BOSS.hpMul, false, true);
    const hp = enemies.hp[wild];
    if (enemies.hurt(wild, hp * 4) || enemies.hp[wild] !== hp || enemies.dead[wild]) {
        throw new Error('Party damage defeated or weakened a shiny encounter');
    }
    const balls = new CaptureSystem(BALL, CATCH, makeRng(9));
    if (!balls._take(0, wild, 0, 0, enemies) || balls.bshiny[0] !== 1
        || balls.bgold[0] !== 0 || enemies.dead[wild] !== 1) {
        throw new Error('A hit ball did not catch a shiny elite without the normal weaken gate');
    }

    const bursts = Object.create(NativeParticleBursts.prototype);
    bursts.shinyTrailTimer = 0;
    bursts.shinyTrailCursor = 0;
    const emitted = [];
    bursts.burst = (...args) => emitted.push(args);
    bursts.updateShinyWalkTrails(0.13, {
        nCount: 2, segments: [{ fam: 'mush', shiny: true }], segIndex: [0, 0], nodeOfSeg: [0, 1],
        nspd: [26, 26], nx: [10, 20], ny: [5, 15], na: [0.5, 0.7],
    });
    if (emitted.length !== 1 || emitted[0][4] !== 'shiny-walk') {
        throw new Error('Shiny walking trail did not emit sparsely from the moving segment head');
    }
    console.log('闪光系统：1/2048、队伍位豁免、同族双线计数进化、免伤必可捕捉、Cocos星光步迹 PASS');
}

// The family ward preserves every wild stage from party damage without blocking a capture throw.
{
    const ward = LEVELS.find((entry) => entry.id === 'familyWard');
    const familyIndex = FAMILIES.findIndex((family) => family.id === 'mush');
    const otherIndex = FAMILIES.findIndex((family) => family.id === 'bird');
    if (!ward || ward.rarity !== 'legendary' || ward.max !== 1 || ward.icon !== 'LINKINGCORD'
        || !existsSync(new URL('./assets/items/upgrades/LINKINGCORD.png', import.meta.url))
        || familyIndex < 0 || otherIndex < 0) {
        throw new Error('family ward upgrade / icon integration regression');
    }

    const enemies = new EnemySystem(ENEMY, makeRng(811));
    const protectedWild = enemies.spawn(0, 0, familyIndex, 3, false, 0);
    const unrelatedWild = enemies.spawn(20, 0, otherIndex, 1, false, 0);
    const boss = enemies.spawn(40, 0, familyIndex, 1, false, 0, 1);
    enemies.setProtectedFamilies([{ fam: 'mush', tier: 1 }], true);

    const protectedHp = enemies.hp[protectedWild];
    if (enemies.hurt(protectedWild, protectedHp * 4) || enemies.hp[protectedWild] !== 1
        || enemies.dead[protectedWild] || enemies.wildKills !== 0) {
        throw new Error('same-family wild Pokémon must remain alive at 1 HP after overkill');
    }
    enemies.hurt(protectedWild, protectedHp * 4);
    if (enemies.hp[protectedWild] !== 1 || enemies.dead[protectedWild]) {
        throw new Error('repeated party attacks must not defeat a protected family');
    }
    if (!enemies.hurt(unrelatedWild, enemies.hp[unrelatedWild] * 4) || !enemies.dead[unrelatedWild]
        || !enemies.hurt(boss, enemies.hp[boss] * 4) || !enemies.dead[boss]) {
        throw new Error('family ward must not protect unrelated wild Pokémon or bosses');
    }
    const balls = new CaptureSystem(BALL, CATCH, makeRng(812));
    if (!balls._take(0, protectedWild, 0, 0, enemies) || !enemies.dead[protectedWild]) {
        throw new Error('protected wild Pokémon must remain catchable');
    }
    enemies.setProtectedFamilies([{ fam: 'mush' }], false);
    const unprotected = enemies.spawn(60, 0, familyIndex, 1, false, 0);
    if (!enemies.hurt(unprotected, enemies.hp[unprotected] * 4) || !enemies.dead[unprotected]) {
        throw new Error('family ward protection must clear when the item is absent');
    }
    console.log('同族护符：全进化阶段保留 1 HP、非同族与BOSS照常受伤、仍可捕捉、关闭后解除保护 PASS');
}

// Rare Candy is offered only when it can perform one genuine next-stage evolution.
{
    const candy = LEVELS.find((entry) => entry.id === 'rareCandy');
    const build = new Build();
    const chain = new ChainSystem(null, CHAIN);
    chain.reset(0, 0);
    chain.add('mush', 1, 1);
    const ctx = { chain };
    if (!candy || candy.name !== '奇异糖果' || candy.rarity !== 'legendary' || candy.max !== 1
        || candy.icon !== 'RARECANDY' || !available(candy, build, ctx)
        || available(candy, build, { chain: { segments: [{ fam: 'mush', tier: 3 }] } })) {
        throw new Error('Rare Candy upgrade availability / one-time card regression');
    }
    take(candy, build, ctx);
    if (available(candy, build, ctx) || !chain.evolveReward(0)
        || chain.segments[0].tier !== 2 || chain.segments[0].count !== 1
        || !lineTop('mush', 3)) {
        throw new Error('Rare Candy must grant exactly one free stage and preserve the party count');
    }
    console.log('奇异糖果：仅可进化队伍时出现、一次性、免费进化一阶段且保留数量 PASS');
}

// Runtime runs use a fresh seed, while a saved seed must still reproduce the same opening wild species.
{
    const firstFamily = (seed) => {
        const rng = makeRng(seed);
        rng.next(); // spawn angle
        rng.chance(0.05); // opening tier
        return rng.int(0, WILD_FAMILY_COUNT - 1);
    };
    const seeds = Array.from({ length: 12 }, () => randomSeed());
    if (seeds.some((seed) => !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
        || new Set(seeds.map(firstFamily)).size < 2
        || firstFamily(20260920) !== 26) {
        throw new Error('random run seed / reproducible opening spawn regression');
    }
    console.log('Random run seed: PASS (fresh seeds vary opening family; fixed seed reproduces its first family)');
}

// New Pokémon family: all three forms, real level-up edges, icon art, and a live signature attack.
{
    const family = FAMILIES.find((entry) => entry.id === 'sprigatito');
    const icons = iconKeys();
    if (!family || family.tiers.join('|') !== '新叶喵|蒂蕾喵|魔幻假面喵'
        || evoCeil('sprigatito') !== 3
        || stepOf('sprigatito', 1)?.to !== 'FLORAGATO'
        || stepOf('sprigatito', 2)?.to !== 'MEOWSCARADA'
        || !icons.includes('SPRIGATITO') || !icons.includes('FLORAGATO') || !icons.includes('MEOWSCARADA')
        || !SKILLS.sprigatito || !existsSync(new URL('./assets/icons/SPRIGATITO.png', import.meta.url))
        || !existsSync(new URL('./assets/icons/FLORAGATO.png', import.meta.url))
        || !existsSync(new URL('./assets/icons/MEOWSCARADA.png', import.meta.url))) {
        throw new Error('Sprigatito family integration regression');
    }
console.log('新叶喵进化链、专属图标与签名弹幕: PASS');
}

// Paldea starters: both complete evolution lines must be catchable, drawable, evolvable, and armed.
{
    const icons = iconKeys();
    const families = [
        { id: 'fuecoco', names: '呆火鳄|炙烫鳄|骨纹巨声鳄', keys: ['FUECOCO', 'CROCALOR', 'SKELEDIRGE'], next: ['CROCALOR', 'SKELEDIRGE'] },
        { id: 'quaxly', names: '润水鸭|涌跃鸭|狂欢浪舞鸭', keys: ['QUAXLY', 'QUAXWELL', 'QUAQUAVAL'], next: ['QUAXWELL', 'QUAQUAVAL'] },
        { id: 'tinkatink', names: '小锻匠|巧锻匠|巨锻匠', keys: ['TINKATINK', 'TINKATUFF', 'TINKATON'], next: ['TINKATUFF', 'TINKATON'] },
        { id: 'nacli', names: '盐石宝|盐石垒|盐石巨灵', keys: ['NACLI', 'NACLSTACK', 'GARGANACL'], next: ['NACLSTACK', 'GARGANACL'] },
        { id: 'frigibax', names: '冰宝|冻脊龙|戟脊龙', keys: ['FRIGIBAX', 'ARCTIBAX', 'BAXCALIBUR'], next: ['ARCTIBAX', 'BAXCALIBUR'] },
        { id: 'chespin', names: '哈力栗|胖胖哈力|布里卡隆', keys: ['CHESPIN', 'QUILLADIN', 'CHESNAUGHT'], next: ['QUILLADIN', 'CHESNAUGHT'] },
        { id: 'fennekin', names: '火狐狸|长尾火狐|妖火红狐', keys: ['FENNEKIN', 'BRAIXEN', 'DELPHOX'], next: ['BRAIXEN', 'DELPHOX'] },
        { id: 'froakie', names: '呱呱泡蛙|呱头蛙|甲贺忍蛙', keys: ['FROAKIE', 'FROGADIER', 'GRENINJA'], next: ['FROGADIER', 'GRENINJA'] },
        { id: 'snivy', names: '藤藤蛇|青藤蛇|君主蛇', keys: ['SNIVY', 'SERVINE', 'SERPERIOR'], next: ['SERVINE', 'SERPERIOR'] },
        { id: 'tepig', names: '暖暖猪|炒炒猪|炎武王', keys: ['TEPIG', 'PIGNITE', 'EMBOAR'], next: ['PIGNITE', 'EMBOAR'] },
        { id: 'oshawott', names: '水水獭|双刃丸|大剑鬼', keys: ['OSHAWOTT', 'DEWOTT', 'SAMUROTT'], next: ['DEWOTT', 'SAMUROTT'] },
    ];
    for (const entry of families) {
        const family = FAMILIES.find((candidate) => candidate.id === entry.id);
        if (!family || family.tiers.join('|') !== entry.names || evoCeil(entry.id) !== 3
            || !entry.keys.every((key) => icons.includes(key))
            || !entry.keys.every((key) => existsSync(new URL(`./assets/icons/${key}.png`, import.meta.url)))
            || !entry.next.every((target, index) => stepOf(entry.id, index + 1)?.to === target)
            || !SKILLS[entry.id]) {
            throw new Error(`${entry.id} family integration regression`);
        }
    }
console.log('新增精灵家族：进化链、图标与专属攻击 PASS');
}

// Five new Kanto-to-Sinnoh-era families: each complete line has atlas art, evolution data, and a distinct attack presentation.
{
    const icons = iconKeys();
    const families = [
        { id: 'lucario', names: '利欧路|路卡利欧', keys: ['RIOLU', 'LUCARIO'], next: ['LUCARIO'] },
        { id: 'dratini', names: '迷你龙|哈克龙|快龙', keys: ['DRATINI', 'DRAGONAIR', 'DRAGONITE'], next: ['DRAGONAIR', 'DRAGONITE'] },
        { id: 'honedge', names: '独剑鞘|双剑鞘|坚盾剑怪', keys: ['HONEDGE', 'DOUBLADE', 'AEGISLASH'], next: ['DOUBLADE', 'AEGISLASH'] },
        { id: 'larvesta', names: '燃烧虫|火神蛾', keys: ['LARVESTA', 'VOLCARONA'], next: ['VOLCARONA'] },
        { id: 'pawniard', names: '驹刀小兵|劈斩司令|仆刀将军', keys: ['PAWNIARD', 'BISHARP', 'KINGAMBIT'], next: ['BISHARP', 'KINGAMBIT'] },
    ];
    for (const entry of families) {
        const family = FAMILIES.find((candidate) => candidate.id === entry.id);
        if (!family || family.tiers.join('|') !== entry.names || evoCeil(entry.id) !== entry.keys.length
            || !entry.keys.every((key) => icons.includes(key))
            || !entry.keys.every((key) => existsSync(new URL(`./assets/icons/${key}.png`, import.meta.url)))
            || !entry.next.every((target, index) => stepOf(entry.id, index + 1)?.to === target)
            || !SKILLS[entry.id] || !SKILL_INFO[entry.id]?.forms?.length
            || !PROJECTILE_GLYPH[entry.id] || !PROJECTILE_EFFECT[entry.id]) {
            throw new Error(`${entry.id} family integration regression`);
        }
    }
    // 弹幕签名按攻击形态各走各的渲染路径：弹射物走 family renderer，光束/领域/突袭走 fx 档案。
    const larvestaField = fieldEffectForFamily('larvesta');
    if (!projectileRendererForFamily('lucario') || !projectileRendererForFamily('honedge')
        || beamEffectForFamily('dratini')?.head !== 'dragon' || beamEffectForFamily('lucario')
        || !larvestaField || larvestaField.glyph !== 'ember' || larvestaField.marks !== 5
        || slashEffectForFamily('pawniard')?.glyph !== 'claw' || slashEffectForFamily('dratini')) {
        throw new Error('five new lines signature danmaku routing regression');
    }
console.log('新增5条宝可梦进化线：图标、进化数据、技能与签名弹幕表现 PASS');
}

// Dragapult's final-stage Dragon Darts visibly launch real Dreepy icons; earlier stages keep their shots.
{
    const family = FAMILIES.find((candidate) => candidate.id === 'dreepy');
    const draws = [];
    const renderer = projectileRendererForFamily('dreepy', 3);
    renderer?.({ draw (...args) { draws.push(args); } },
        { get (color, alpha) { return { color, alpha }; } },
        { x: 24, y: 12, size: 6, wall: 0.5, shotAngle: 0.25, index: 2, shiny: false });
    const shinyDraws = [];
    renderer?.({ draw (...args) { shinyDraws.push(args); } },
        { get (color, alpha) { return { color, alpha }; } },
        { x: 24, y: 12, size: 6, wall: 0.5, shotAngle: 0.25, index: 2, shiny: true });
    if (!family || family.tiers.join('|') !== '多龙梅西亚|多龙奇|多龙巴鲁托'
        || !['DREEPY', 'DRAKLOAK', 'DRAGAPULT'].every((key) => iconKeys().includes(key)
            && existsSync(new URL(`./assets/icons/${key}.png`, import.meta.url)))
        || projectileRendererForFamily('dreepy', 1) !== null
        || projectileRendererForFamily('dreepy', 2) !== null
        || !renderer || draws.length !== 0 || shinyDraws.length !== 0
        || skillParticlePresetForEvent('projectile-trail-dreepy')) {
        throw new Error('Dragapult must fire readable Dreepy Dragon Darts only at its final evolution stage');
    }
    const system = new SkillSystem(PROJ);
    const chain = { bx: Float32Array.of(0), by: Float32Array.of(0), na: Float32Array.of(0), bulkOf: () => 1 };
    const enemies = {
        grid: { query (_x, _y, _radius, out) { out.length = 0; out.push(0); } },
        x: Float32Array.of(120), y: Float32Array.of(0), r: Float32Array.of(8),
        hp: Float32Array.of(1e6), dead: Uint8Array.of(0),
    };
    system._aim(chain, enemies, { fam: 'dreepy', tier: 3, shiny: true }, SKILLS.dreepy, 0,
        { cd: 0, bank: 1000 }, 1, 1);
    if (system.n !== SKILLS.dreepy.shots[2]
        || Array.from(system.pStage.slice(0, system.n)).some((stage) => stage !== 3)
        || Array.from(system.pShiny.slice(0, system.n)).some((shiny) => shiny !== 1)) {
        throw new Error('Dragapult volley must retain both final-stage and shiny source metadata');
    }
    system._drop(0);
    if (system.pStage[0] !== 3 || system.pShiny[0] !== 1) {
        throw new Error('projectile compaction must preserve shiny appearance metadata');
    }
    console.log('多龙巴鲁托：最终进化发射多龙梅西亚龙箭、前两阶段保持原弹幕 PASS');
}

// Togepi's friendship-to-stone line has its own wish-star volley and real atlas icons.
{
    const family = FAMILIES.find((candidate) => candidate.id === 'togepi');
    const icons = iconKeys();
    const first = stepOf('togepi', 1);
    const second = stepOf('togepi', 2);
    const drawCalls = [];
    projectileRendererForFamily('togepi')?.({ draw: (...args) => drawCalls.push(args) },
        { get: (...args) => args }, { x: 0, y: 0, size: 5, wall: 1, shotAngle: 0, index: 0 });
    if (!family || family.tiers.join('|') !== '波克比|波克基古|波克基斯'
        || evoCeil('togepi') !== 3 || first?.to !== 'TOGETIC' || first.kind !== 'Happiness'
        || second?.to !== 'TOGEKISS' || second.kind !== 'Item' || second.arg !== 'SHINYSTONE'
        || !['TOGEPI', 'TOGETIC', 'TOGEKISS'].every((key) => icons.includes(key)
            && existsSync(new URL(`./assets/icons/${key}.png`, import.meta.url)))
        || !SKILLS.togepi || !SKILL_INFO.togepi?.forms?.[2]
        || PROJECTILE_GLYPH.togepi !== 'star' || !PROJECTILE_EFFECT.togepi
        || drawCalls.length !== 0
        || skillParticlePresetForEvent('projectile-trail-togepi')?.glyph !== 'star') {
        throw new Error('Togepi line / evolution / wish-star renderer integration regression');
    }
    console.log('波克比家族：亲密度与光之石进化、三阶段图标、星形粒子弹幕 PASS');
}

// Buizel's two-stage family routes Aqua Jet through a wave-shaped native particle trail.
{
    const family = FAMILIES.find((candidate) => candidate.id === 'buizel');
    const icons = iconKeys();
    const evolution = stepOf('buizel', 1);
    const drawCalls = [];
    projectileRendererForFamily('buizel')?.({ draw: (...args) => drawCalls.push(args) },
        { get: (...args) => args }, { x: 0, y: 0, size: 5, wall: 1, shotAngle: 0, index: 0 });
    if (!family || family.tiers.join('|') !== '泳圈鼬|浮潜鼬' || evoCeil('buizel') !== 2
        || evolution?.to !== 'FLOATZEL' || evolution.kind !== 'Level' || evolution.arg !== '26'
        || !['BUIZEL', 'FLOATZEL'].every((key) => icons.includes(key)
            && existsSync(new URL(`./assets/icons/${key}.png`, import.meta.url)))
        || !SKILLS.buizel || SKILLS.buizel.fire !== 'bullet'
        || !SKILL_INFO.buizel?.forms?.[2] || PROJECTILE_GLYPH.buizel !== 'wave'
        || PROJECTILE_EFFECT.buizel !== 'water' || drawCalls.length !== 0
        || skillParticlePresetForEvent('projectile-trail-buizel')?.glyph !== 'wave') {
        throw new Error('Buizel line / Aqua Jet renderer integration regression');
    }
    console.log('泳圈鼬家族：等级进化、双阶段图标、高速水流喷射弹幕 PASS');
}

// Munchlax's friendship evolution is paired with a particle-led, heavy snore shot.
{
    const family = FAMILIES.find((candidate) => candidate.id === 'munchlax');
    const icons = iconKeys();
    const evolution = stepOf('munchlax', 1);
    const drawCalls = [];
    projectileRendererForFamily('munchlax')?.({ draw: (...args) => drawCalls.push(args) },
        { get: (...args) => args }, { x: 0, y: 0, size: 5, wall: 1, shotAngle: 0, index: 0 });
    if (!family || family.tiers.join('|') !== '小卡比兽|卡比兽' || evoCeil('munchlax') !== 2
        || evolution?.to !== 'SNORLAX' || evolution.kind !== 'Happiness'
        || !['MUNCHLAX', 'SNORLAX'].every((key) => icons.includes(key)
            && existsSync(new URL(`./assets/icons/${key}.png`, import.meta.url)))
        || !SKILLS.munchlax || !SKILL_INFO.munchlax?.forms?.[2]
        || PROJECTILE_GLYPH.munchlax !== 'boulder' || !PROJECTILE_EFFECT.munchlax
        || drawCalls.length !== 0
        || skillParticlePresetForEvent('projectile-trail-munchlax')?.glyph !== 'crescent') {
        throw new Error('Munchlax line / friendship evolution / snore renderer integration regression');
    }
    console.log('小卡比兽家族：亲密度进化、双阶段图标、呼噜震波弹幕 PASS');
}

// Shinx's three-stage line has level evolution and a particle-led chaining thunder attack.
{
    const family = FAMILIES.find((candidate) => candidate.id === 'shinx');
    const icons = iconKeys();
    const first = stepOf('shinx', 1);
    const second = stepOf('shinx', 2);
    const drawCalls = [];
    projectileRendererForFamily('shinx')?.({ draw: (...args) => drawCalls.push(args) },
        { get: (...args) => args }, { x: 0, y: 0, size: 5, wall: 1, shotAngle: 0, index: 0 });
    if (!family || family.tiers.join('|') !== '小猫怪|勒克猫|伦琴猫' || family.element !== 'bolt'
        || evoCeil('shinx') !== 3 || first?.to !== 'LUXIO' || first.arg !== '15'
        || second?.to !== 'LUXRAY' || second.arg !== '30'
        || !['SHINX', 'LUXIO', 'LUXRAY'].every((key) => icons.includes(key)
            && existsSync(new URL(`./assets/icons/${key}.png`, import.meta.url)))
        || SKILLS.shinx?.bounces?.join(',') !== '0,1,3'
        || !SKILL_INFO.shinx?.forms?.[2]?.[0]?.includes('追猎')
        || PROJECTILE_GLYPH.shinx !== 'bolt' || PROJECTILE_EFFECT.shinx !== 'electric'
        || drawCalls.length !== 0
        || skillParticlePresetForEvent('projectile-trail-shinx')?.glyph !== 'bolt') {
        throw new Error('Shinx line / level evolution / electric chain renderer integration regression');
    }
    console.log('小猫怪家族：等级进化、三阶段图标、电光爪击连锁弹幕 PASS');
}

// Zorua's two-stage Dark line has a homing, bouncing shadow-illusion volley and native icons.
{
    const family = FAMILIES.find((candidate) => candidate.id === 'zorua');
    const icons = iconKeys();
    const evolution = stepOf('zorua', 1);
    const drawCalls = [];
    projectileRendererForFamily('zorua')?.({ draw: (...args) => drawCalls.push(args) },
        { get: (...args) => args }, { x: 0, y: 0, size: 0.5, wall: 1, shotAngle: 0.4, index: 0 });
    if (!family || family.tiers.join('|') !== '索罗亚|索罗亚克' || family.kind !== 'Homing'
        || family.element !== 'support' || evoCeil('zorua') !== 2
        || evolution?.to !== 'ZOROARK' || evolution.arg !== '30'
        || !['ZORUA', 'ZOROARK'].every((key) => icons.includes(key)
            && existsSync(new URL(`./assets/icons/${key}.png`, import.meta.url)))
        || !SPECIES.zorua.ty.every((types) => types.includes('DARK'))
        || !ELEMENT_TYPE.support.includes('DARK')
        || SKILLS.zorua?.shots?.join(',') !== '1,3' || SKILLS.zorua?.bounces?.join(',') !== '0,2'
        || !SKILL_INFO.zorua?.forms?.[1]?.[0]?.includes('百影追猎')
        || PROJECTILE_GLYPH.zorua !== 'shadow' || PROJECTILE_EFFECT.zorua !== 'shadow'
        || !bulletStyleBodySource('shadow').includes('wisps') || drawCalls.length !== 0
        || skillParticlePresetForEvent('projectile-trail-zorua')?.glyph !== 'crescent'
        || skillParticlePresetForEvent('projectile-trail-zorua')?.totalParticles < 7) {
        throw new Error('Zorua line / Dark affinity / illusion seeking renderer integration regression');
    }
    console.log('索罗亚家族：恶属性、等级进化、双阶段图标、追踪折射幻影弹幕 PASS');
}

// Toxel's Electric/Poison line has native art and a distinctive pulsing soundwave projectile.
{
    const family = FAMILIES.find((candidate) => candidate.id === 'toxtricity');
    const icons = iconKeys();
    const evolution = stepOf('toxtricity', 1);
    const drawCalls = [];
    projectileRendererForFamily('toxtricity')?.({ draw: (...args) => drawCalls.push(args) },
        { get: (...args) => args }, { x: 0, y: 0, size: 5, wall: 1, shotAngle: 0.4, index: 1 });
    if (!family || family.tiers.join('|') !== '毒电婴|颤弦蝾螈' || family.element !== 'bolt'
        || evoCeil('toxtricity') !== 2 || evolution?.to !== 'TOXTRICITY' || evolution.arg !== '30'
        || !['TOXEL', 'TOXTRICITY'].every((key) => icons.includes(key)
            && existsSync(new URL(`./assets/icons/${key}.png`, import.meta.url)))
        || !SPECIES.toxtricity.ty.every((types) => types.join(',') === 'ELECTRIC,POISON')
        || !ELEMENT_TYPE.bolt.includes('ELECTRIC') || !ELEMENT_TYPE.support.includes('POISON')
        || SKILLS.toxtricity?.shots?.join(',') !== '1,2' || SKILLS.toxtricity?.bounces?.join(',') !== '0,2'
        || !SKILL_INFO.toxtricity?.forms?.[1]?.[0]?.includes('过载和弦')
        || PROJECTILE_GLYPH.toxtricity !== 'wave' || PROJECTILE_EFFECT.toxtricity !== 'electric'
        || drawCalls.length !== 0
        || skillParticlePresetForEvent('projectile-trail-toxtricity')?.glyph !== 'bolt') {
        throw new Error('Toxel / Toxtricity family and electric soundwave renderer integration regression');
    }
    console.log('毒电婴家族：双属性、官方图标、等级进化、折射电音弹幕 PASS');
}

// Shroomish's Grass line evolves into Grass/Fighting Breloom with a native spore-pod renderer.
{
    const family = FAMILIES.find((candidate) => candidate.id === 'shroomish');
    const icons = iconKeys();
    const evolution = stepOf('shroomish', 1);
    const drawCalls = [];
    projectileRendererForFamily('shroomish')?.({ draw: (...args) => drawCalls.push(args) },
        { get: (...args) => args }, { x: 0, y: 0, size: 5, wall: 1, shotAngle: 0.4, index: 0 });
    if (!family || family.tiers.join('|') !== '蘑蘑菇|斗笠菇' || family.element !== 'grass'
        || evoCeil('shroomish') !== 2 || evolution?.to !== 'BRELOOM' || evolution.arg !== '23'
        || !['SHROOMISH', 'BRELOOM'].every((key) => icons.includes(key)
            && existsSync(new URL(`./assets/icons/${key}.png`, import.meta.url)))
        || SPECIES.shroomish.ty[0]?.join(',') !== 'GRASS'
        || SPECIES.shroomish.ty[1]?.join(',') !== 'GRASS,FIGHTING'
        || !ELEMENT_TYPE.grass.includes('GRASS') || !ELEMENT_TYPE.support.includes('FIGHTING')
        || SKILLS.shroomish?.shots?.join(',') !== '1,2' || SKILLS.shroomish?.bounces?.join(',') !== '0,2'
        || !SKILL_INFO.shroomish?.forms?.[1]?.[0]?.includes('蘑力弹幕')
        || PROJECTILE_GLYPH.shroomish !== 'blob' || PROJECTILE_EFFECT.shroomish !== 'nature'
        || drawCalls.length !== 0
        || skillParticlePresetForEvent('projectile-trail-shroomish')?.glyph !== 'spark') {
        throw new Error('Shroomish / Breloom family and spore pod renderer integration regression');
    }
    console.log('蘑蘑菇家族：草/格斗属性、官方图标、等级进化、孢子回旋弹幕 PASS');
}

// Hatenna's Psychic line finishes as Psychic/Fairy Hatterene with a dedicated moonwave renderer.
{
    const family = FAMILIES.find((candidate) => candidate.id === 'hatenna');
    const icons = iconKeys();
    const first = stepOf('hatenna', 1);
    const second = stepOf('hatenna', 2);
    const drawCalls = [];
    projectileRendererForFamily('hatenna')?.({ draw: (...args) => drawCalls.push(args) },
        { get: (...args) => args }, { x: 0, y: 0, size: 5, wall: 1, shotAngle: 0.4, index: 0 });
    if (!family || family.tiers.join('|') !== '迷布莉姆|提布莉姆|布莉姆温'
        || family.element !== 'support' || evoCeil('hatenna') !== 3
        || first?.to !== 'HATTREM' || first.arg !== '32'
        || second?.to !== 'HATTERENE' || second.arg !== '42'
        || !['HATENNA', 'HATTREM', 'HATTERENE'].every((key) => icons.includes(key)
            && existsSync(new URL(`./assets/icons/${key}.png`, import.meta.url)))
        || SPECIES.hatenna.ty[0]?.join(',') !== 'PSYCHIC'
        || SPECIES.hatenna.ty[2]?.join(',') !== 'PSYCHIC,FAIRY'
        || !ELEMENT_TYPE.support.includes('PSYCHIC') || !ELEMENT_TYPE.support.includes('FAIRY')
        || SKILLS.hatenna?.shots?.join(',') !== '1,2,3' || SKILLS.hatenna?.bounces?.join(',') !== '0,1,2'
        || !SKILL_INFO.hatenna?.forms?.[2]?.[0]?.includes('妖精终曲')
        || PROJECTILE_GLYPH.hatenna !== 'crescent' || PROJECTILE_EFFECT.hatenna !== 'psychic'
        || drawCalls.length !== 0
        || skillParticlePresetForEvent('projectile-trail-hatenna')?.glyph !== 'crescent') {
        throw new Error('Hatenna / Hattrem / Hatterene family and psychic moonwave renderer regression');
    }
    console.log('迷布莉姆家族：超能力/妖精属性、三阶图标、等级进化、魔女念波 PASS');
}

// Impidimp's Dark/Fairy line gets a layered shadow-claw barrage and three-stage level evolution.
{
    const family = FAMILIES.find((candidate) => candidate.id === 'impidimp');
    const icons = iconKeys();
    const first = stepOf('impidimp', 1);
    const second = stepOf('impidimp', 2);
    const drawCalls = [];
    projectileRendererForFamily('impidimp')?.({ draw: (...args) => drawCalls.push(args) },
        { get: (...args) => args }, { x: 0, y: 0, size: 5, wall: 1, shotAngle: 0.4, index: 0 });
    if (!family || family.tiers.join('|') !== '捣蛋小妖|诈唬魔|长毛巨魔'
        || family.element !== 'support' || evoCeil('impidimp') !== 3
        || first?.to !== 'MORGREM' || first.arg !== '32'
        || second?.to !== 'GRIMMSNARL' || second.arg !== '42'
        || !['IMPIDIMP', 'MORGREM', 'GRIMMSNARL'].every((key) => icons.includes(key)
            && existsSync(new URL(`./assets/icons/${key}.png`, import.meta.url)))
        || !SPECIES.impidimp.ty.every((types) => types.join(',') === 'DARK,FAIRY')
        || !ELEMENT_TYPE.support.includes('DARK') || !ELEMENT_TYPE.support.includes('FAIRY')
        || SKILLS.impidimp?.shots?.join(',') !== '1,2,3' || SKILLS.impidimp?.bounces?.join(',') !== '0,1,2'
        || !SKILL_INFO.impidimp?.forms?.[2]?.[0]?.includes('巨魔乱抓')
        || PROJECTILE_GLYPH.impidimp !== 'claw' || PROJECTILE_EFFECT.impidimp !== 'shadow'
        || drawCalls.length !== 0
        || skillParticlePresetForEvent('projectile-trail-impidimp')?.glyph !== 'claw') {
        throw new Error('Impidimp / Morgrem / Grimmsnarl family and shadow-claw renderer regression');
    }
    console.log('捣蛋小妖家族：恶/妖精属性、三阶图标、等级进化、暗影爪弹幕 PASS');
}

// Archen's fossil line adds a Rock/Flying two-stage evolution and a layered fossil-feather renderer.
{
    const family = FAMILIES.find((candidate) => candidate.id === 'archen');
    const icons = iconKeys();
    const evolution = stepOf('archen', 1);
    const drawCalls = [];
    projectileRendererForFamily('archen')?.({ draw: (...args) => drawCalls.push(args) },
        { get: (...args) => args }, { x: 0, y: 0, size: 5, wall: 1, shotAngle: 0.4, index: 0 });
    if (!family || family.tiers.join('|') !== '始祖小鸟|始祖大鸟' || family.element !== 'crystal'
        || evoCeil('archen') !== 2 || evolution?.to !== 'ARCHEOPS' || evolution.arg !== '37'
        || !['ARCHEN', 'ARCHEOPS'].every((key) => icons.includes(key)
            && existsSync(new URL(`./assets/icons/${key}.png`, import.meta.url)))
        || !SPECIES.archen.ty.every((types) => types.join(',') === 'ROCK,FLYING')
        || !ELEMENT_TYPE.crystal.includes('ROCK') || !ELEMENT_TYPE.support.includes('FLYING')
        || SKILLS.archen?.shots?.join(',') !== '1,2' || SKILLS.archen?.bounces?.join(',') !== '0,2'
        || !SKILL_INFO.archen?.forms?.[1]?.[0]?.includes('双翼齐射')
        || PROJECTILE_GLYPH.archen !== 'feather' || PROJECTILE_EFFECT.archen !== 'crystal'
        || drawCalls.length !== 0
        || skillParticlePresetForEvent('projectile-trail-archen')?.glyph !== 'feather') {
        throw new Error('Archen / Archeops family and fossil-feather renderer integration regression');
    }
    console.log('始祖小鸟家族：岩石/飞行属性、双阶段图标、等级进化、古代翼刃 PASS');
}

// Three Paldea lines extend the wild roster with real evolution data and their own readable shots.
{
    const families = [
        ['smoliv', ['SMOLIV', 'DOLLIV', 'ARBOLIVA'], ['928', '929', '930'],
            ['GRASS,NORMAL', 'GRASS,NORMAL', 'GRASS,NORMAL'], 'DOLLIV', '25'],
        ['tadbulb', ['TADBULB', 'BELLIBOLT'], ['938', '939'],
            ['ELECTRIC', 'ELECTRIC'], 'BELLIBOLT', 'THUNDERSTONE'],
        ['wattrel', ['WATTREL', 'KILOWATTREL'], ['940', '941'],
            ['ELECTRIC,FLYING', 'ELECTRIC,FLYING'], 'KILOWATTREL', '25'],
    ];
    const expectedParticleGlyphs = { smoliv: 'leaf', tadbulb: 'ring', wattrel: 'feather' };
    const allowedGlyphs = new Set(['circle', 'ring', 'square', 'diamond', 'hex', 'star', 'blob',
        'pill', 'cross', 'dot', 'aura', 'ball', 'field', 'beam', 'feather', 'flame', 'spark',
        'shard', 'leaf', 'claw', 'cannon', 'wave', 'shadow', 'crescent', 'needle', 'bolt',
        'ember', 'boulder', 'leafblade', 'dragon', 'fang', 'spear', 'meteor', 'heart']);
    for (const [id, keys, dex, types, target, argument] of families) {
        const family = FAMILIES.find((candidate) => candidate.id === id);
        const record = SPECIES[id];
        const edge = stepOf(id, 1);
        const nextEdge = stepOf(id, 2);
        const draws = [];
        const renderer = projectileRendererForFamily(id);
        if (!family || !record || !edge || !renderer || evoCeil(id) !== keys.length
            || family.tiers.length !== keys.length || record.key.join(',') !== keys.join(',')
            || record.dex.map(String).join(',') !== dex.join(',')
            || record.ty.map((row) => row.join(',')).join('|') !== types.join('|')
            || edge.to !== target || edge.arg !== argument
            || (id === 'smoliv' ? nextEdge?.to !== 'ARBOLIVA' : !!nextEdge)
            || keys.some((key) => !iconKeys().includes(key)
                || !existsSync(new URL(`./assets/icons/${key}.png`, import.meta.url)))
            || !SKILLS[id]?.shots || !SKILL_INFO[id]?.forms?.length
            || !allowedGlyphs.has(PROJECTILE_GLYPH[id]) || !PROJECTILE_EFFECT[id]) {
            throw new Error(`${id} new family, Pokédex chain, icon atlas or projectile data regression`);
        }
        renderer({ draw (...args) { draws.push(args); } }, { get (color, alpha) { return { color, alpha }; } },
            { x: 24, y: 12, size: 6, wall: 0.5, shotAngle: 0.25, index: 2 });
        const preset = skillParticlePresetForEvent(`projectile-trail-${id}`);
        if (draws.length !== 0 || preset?.glyph !== expectedParticleGlyphs[id]
            || preset.particleClass !== 'projectile-trail') {
            throw new Error(`${id} signature particle projectile route regression`);
        }
    }
    console.log('帕底亚新增三家族：七枚官方图标、属性/进化数据与橄榄/电泡/雷羽弹幕 PASS');
}

// Porygon evolves via its two canonical held-item stages and fires its own refracting data prisms.
{
    const family = FAMILIES.find((candidate) => candidate.id === 'porygon');
    const record = SPECIES.porygon;
    const draws = [];
    const renderer = projectileRendererForFamily('porygon');
    renderer?.({ draw (...args) { draws.push(args); } },
        { get (color, alpha) { return { color, alpha }; } },
        { x: 24, y: 12, size: 6, wall: 0.5, shotAngle: 0.25, index: 2 });
    if (!family || family.name !== '多边兽' || family.element !== 'support'
        || family.tiers.join('|') !== '多边兽|多边兽Ⅱ|多边兽Ｚ'
        || !record || record.key.join(',') !== 'PORYGON,PORYGON2,PORYGONZ'
        || record.dex.join(',') !== '137,233,474'
        || record.ty.map((row) => row.join(',')).join('|') !== 'NORMAL|NORMAL|NORMAL'
        || evoCeil('porygon') !== 3 || stepOf('porygon', 1)?.to !== 'PORYGON2'
        || stepOf('porygon', 1)?.arg !== 'UPGRADE'
        || stepOf('porygon', 2)?.to !== 'PORYGONZ'
        || stepOf('porygon', 2)?.arg !== 'DUBIOUSDISC'
        || !['PORYGON', 'PORYGON2', 'PORYGONZ'].every((key) => iconKeys().includes(key)
            && existsSync(new URL(`./assets/icons/${key}.png`, import.meta.url)))
        || SKILLS.porygon?.shots.join(',') !== '1,2,3'
        || SKILLS.porygon?.bounces.join(',') !== '0,1,2'
        || SKILL_INFO.porygon?.forms.length !== 3
        || PROJECTILE_GLYPH.porygon !== 'hex' || PROJECTILE_EFFECT.porygon !== 'psychic'
        || draws.length !== 0
        || skillParticlePresetForEvent('projectile-trail-porygon')?.glyph !== 'hex') {
        throw new Error('Porygon family, Upgrade/Dubious Disc evolution or data-prism volley regression');
    }
    console.log('多边兽家族：官方三阶图标、升级数据/可疑补丁进化与折射数据棱镜 PASS');
}

// Milcery/Alcremie roster line, authentic icons, and the continuous-turn sweet item.
{
    const family = FAMILIES.find((candidate) => candidate.id === 'alcremie');
    const record = SPECIES.alcremie;
    if (!family || family.name !== '小仙奶' || family.tiers.join('|') !== '小仙奶|霜奶仙'
        || family.kind !== 'Homing' || family.element !== 'support'
        || !record || record.key.join(',') !== 'MILCERY,ALCREMIE'
        || record.dex.join(',') !== '868,869' || evoCeil('alcremie') !== 2
        || stepOf('alcremie', 1)?.to !== 'ALCREMIE'
        || stepOf('alcremie', 1)?.arg !== 'STRAWBERRYSWEET'
        || !['MILCERY', 'ALCREMIE'].every((key) => iconKeys().includes(key)
            && existsSync(new URL(`./assets/icons/${key}.png`, import.meta.url)))
        || !SKILLS.alcremie?.shots || !SKILL_INFO.alcremie?.forms?.length
        || PROJECTILE_GLYPH.alcremie !== 'heart' || !PROJECTILE_EFFECT.alcremie) {
        throw new Error('Milcery/Alcremie family, art, evolution or cream-shot regression');
    }

    const tracker = createRotationTracker();
    let completed = 0;
    for (let i = 0; i <= 24; i++) {
        const angle = i * Math.PI * 2 / 24;
        if (stepRotationTracker(tracker, Math.cos(angle), Math.sin(angle), 1 / 60)) completed++;
    }
    if (completed !== 1 || rotationProgress(tracker) !== 0) {
        throw new Error('one continuous 360-degree steering turn must pay once');
    }

    const reversed = createRotationTracker();
    stepRotationTracker(reversed, 1, 0, 1 / 60);
    for (let i = 1; i <= 5; i++) {
        const angle = i * 0.2;
        stepRotationTracker(reversed, Math.cos(angle), Math.sin(angle), 1 / 60);
    }
    for (let i = 4; i >= 0; i--) {
        const angle = i * 0.2;
        stepRotationTracker(reversed, Math.cos(angle), Math.sin(angle), 1 / 60);
    }
    if (rotationProgress(reversed) > 1e-9) throw new Error('back-and-forth steering must not farm spin progress');

    const familyChain = new ChainSystem(null, CHAIN);
    familyChain.add('alcremie', 1, 1);
    const stackMilcery = familyChain.absorb('alcremie', 1);
    if (stackMilcery !== 'stack' || familyChain.segments.length !== 1
        || familyChain.segments[0].tier !== 1 || familyChain.segments[0].count !== 2) {
        throw new Error('a granted Milcery must stack with an owned Milcery, not duplicate it');
    }
    familyChain.segments[0].tier = 2;
    const stackOnAlcremie = familyChain.absorb('alcremie', 1);
    if (stackOnAlcremie !== 'top-stack' || familyChain.segments.length !== 1
        || familyChain.segments[0].tier !== 2 || familyChain.segments[0].count !== 3) {
        throw new Error('a granted Milcery must stack with an owned Alcremie without downgrading it');
    }
    const normalForm = rosterActiveFormForSegment({ fam: 'alcremie', tier: 2 });
    const giantForm = GIGANTAMAX_FORMS.find((form) => form.id === 'alcremie');
    const normalSkill = activeSkillForForm(normalForm);
    const giantSkill = activeSkillForForm(giantForm);
    if (!normalForm || !giantForm || normalSkill?.shape !== 'cake-drop' || normalSkill.heal !== 50
        || giantSkill?.shape !== 'cake-drop' || giantSkill.heal !== 200
        || giantForm.icon !== 'ALCREMIE_gmax' || !iconKeys().includes('ALCREMIE_gmax')
        || !existsSync(new URL('./assets/icons/ALCREMIE_gmax.png', import.meta.url))
        || activeSkillModuleForForm(normalForm)?.cast !== activeSkillModuleForForm(giantForm)?.cast
        || giantForm.size <= 1 || giantForm.rosterActive) {
        throw new Error('Alcremie ordinary and Gigantamax active skills must create differently sized 50/200 HP cakes');
    }
    const runCakeSkill = (form, skill, initialHp) => {
        const game = {
            player: { x: 12, y: -8, hp: initialHp, maxhp: 500, dead: false },
            rng: makeRng(9724), alcremieCakes: [],
            logEvent: () => {}, megaSkillFx: () => {}, wave: () => {}, say: () => {},
            particleBursts: { burst: () => {} },
        };
        const segment = { fam: 'alcremie', tier: 2, megaSkillCd: 0 };
        activeSkillModuleForForm(form).cast(game, segment, form, skill, 0, 0);
        if (game.alcremieCakes.length !== 1 || segment.megaSkillCd !== skill.cooldown
            || game.alcremieCakes[0].heal !== skill.heal
            || game.alcremieCakes[0].size !== skill.cakeSize) {
            throw new Error(`${form.name} must create its correctly-sized cake and start cooldown`);
        }
        game.player.x = game.alcremieCakes[0].x;
        game.player.y = game.alcremieCakes[0].y;
        const picked = stepAlcremieCakes(game.alcremieCakes, game.player, 1 / 60);
        if (picked.length !== 1 || picked[0].healed !== skill.heal || game.alcremieCakes.length !== 0) {
            throw new Error(`${form.name} cake pickup should restore ${skill.heal} HP exactly`);
        }
    };
    runCakeSkill(normalForm, normalSkill, 100);
    runCakeSkill(giantForm, giantSkill, 100);
    const drawCalls = [];
    const cakeGame = { wall: 0.5, atlas: { glyphs: { ALCREMIE_gmax: {} } },
        pal: { get: (color, alpha) => ({ color, alpha }) } };
    const captureBatch = { draw: (...args) => drawCalls.push(args) };
    drawAlcremieCakes(cakeGame, captureBatch, [
        { x: 0, y: 0, size: normalSkill.cakeSize, lifetime: 45, age: 0, gigantamax: false },
        { x: 1, y: 1, size: giantSkill.cakeSize, lifetime: 60, age: 0, gigantamax: true },
    ]);
    if (drawCalls.filter((call) => call[0] === 'ALCREMIE_gmax').length !== 2
        || drawCalls.some((call) => call[3] > 4 || call[4] > 4)) {
        throw new Error('healing cakes must use the dedicated cake sprite and stay within sane glyph scale');
    }
    drawCalls.length = 0;
    drawAlcremieEffect(cakeGame, captureBatch,
        { x: 0, y: 0, radius: giantSkill.cakeSize * 2.8, age: 0.1, duration: 1.1,
            form: { gigantamax: true } });
    if (drawCalls.length !== 0) {
        throw new Error('cake spawn VFX must not duplicate the persistent cake pickup sprite');
    }
    console.log('小仙奶/霜奶仙：官方图标、两阶段图鉴、奶油糖珠攻击与 360° 转向奖励 PASS');
    console.log('霜奶仙蛋糕技能：普通 50 HP / 超极巨 200 HP，可拾取与体型差异 PASS');
}

// Scatterbug line: source PBS evolution/type data, imported icon set, powder shots and Vivillon area skill.
{
    const family = FAMILIES.find((candidate) => candidate.id === 'vivillon');
    const record = SPECIES.vivillon;
    const draws = [];
    projectileRendererForFamily('vivillon')?.({ draw: (...args) => draws.push(args) },
        { get: (color, alpha) => ({ color, alpha }) },
        { x: 0, y: 0, size: 5, wall: 0.5, shotAngle: 0.3, index: 1, variant: 2 });
    const form = rosterActiveFormForSegment({ fam: 'vivillon', tier: 3 });
    if (!family || family.name !== '粉蝶虫' || family.element !== 'support' || family.kind !== 'Homing'
        || family.tiers.join('|') !== '粉蝶虫|粉蝶蛹|彩粉蝶'
        || !record || record.key.join(',') !== 'SCATTERBUG,SPEWPA,VIVILLON'
        || record.dex.join(',') !== '664,665,666'
        || record.ty.map((types) => types.join(',')).join('|') !== 'BUG|BUG|BUG,FLYING'
        || stepOf('vivillon', 1)?.to !== 'SPEWPA' || stepOf('vivillon', 1)?.arg !== '9'
        || stepOf('vivillon', 2)?.to !== 'VIVILLON' || stepOf('vivillon', 2)?.arg !== '12'
        || !['SCATTERBUG', 'SPEWPA', 'VIVILLON'].every((key) => iconKeys().includes(key)
            && existsSync(new URL(`./assets/icons/${key}.png`, import.meta.url)))
        || SKILLS.vivillon?.shots.join(',') !== '1,2,3'
        || SKILLS.vivillon?.bounces.join(',') !== '0,1,2'
        || PROJECTILE_GLYPH.vivillon !== 'feather' || PROJECTILE_EFFECT.vivillon !== 'nature'
        || draws.length !== 0 || form?.id !== 'roster-vivillon'
        || activeSkillForForm(form)?.name !== '幻彩蝶舞'
        || !skillParticlePresetForEvent('projectile-trail-vivillon')
        || !skillParticlePresetForEvent('vivillon-powder-cloud')
        || !skillParticlePresetForEvent('vivillon-wing-burst')) {
        throw new Error('Scatterbug family, PBS evolution/icons, butterfly shot or Vivillon skill registry regression');
    }
    console.log('粉蝶虫家族：PBS进化/属性、三阶段图标、蝶翼鳞粉弹幕与彩粉蝶主动技 PASS');
}

// Cutiefly/Ribombee: a Bug/Fairy line with a nectar volley and a hit-based healing active skill.
{
    const family = FAMILIES.find((candidate) => candidate.id === 'cutiefly');
    const record = SPECIES.cutiefly;
    const draws = [];
    projectileRendererForFamily('cutiefly')?.({ draw: (...args) => draws.push(args) },
        { get: (color, alpha) => ({ color, alpha }) },
        { x: 0, y: 0, size: 5, wall: 0.5, shotAngle: 0.3, index: 1, variant: 1 });
    const form = rosterActiveFormForSegment({ fam: 'cutiefly', tier: 2 });
    const skill = activeSkillForForm(form);
    if (!family || family.name !== '萌虻' || family.element !== 'support' || family.kind !== 'Homing'
        || family.tiers.join('|') !== '萌虻|蝶结萌虻'
        || !record || record.key.join(',') !== 'CUTIEFLY,RIBOMBEE'
        || record.dex.join(',') !== '742,743'
        || record.ty.map((types) => types.join(',')).join('|') !== 'BUG,FAIRY|BUG,FAIRY'
        || stepOf('cutiefly', 1)?.to !== 'RIBOMBEE' || stepOf('cutiefly', 1)?.arg !== '25'
        || !['CUTIEFLY', 'RIBOMBEE'].every((key) => iconKeys().includes(key)
            && existsSync(new URL(`./assets/icons/${key}.png`, import.meta.url))
            && existsSync(new URL(`./assets/audio/cries/${key}.ogg`, import.meta.url)))
        || SKILLS.cutiefly?.shots.join(',') !== '1,2'
        || SKILLS.cutiefly?.bounces.join(',') !== '0,2'
        || PROJECTILE_GLYPH.cutiefly !== 'heart' || PROJECTILE_EFFECT.cutiefly !== 'nature'
        || draws.length !== 0 || form?.id !== 'roster-ribombee'
        || skill?.name !== '花蜜回旋' || skill?.healCap !== 30
        || !skillParticlePresetForEvent('projectile-trail-cutiefly')
        || !skillParticlePresetForEvent('cutiefly-honey-pulse')
        || !skillParticlePresetForEvent('cutiefly-flower-burst')) {
        throw new Error('Cutiefly family, art/cry line, homing nectar volley or Ribombee skill registry regression');
    }
    console.log('萌虻家族：PBS进化/属性、两阶段图标与叫声、蜜粉弹幕/蝶结萌虻主动技 PASS');
}

// Ampharos's final-stage signature is a double electric volley that chains through nearby enemies.
{
    const family = FAMILIES.find((candidate) => candidate.id === 'lamp');
    if (!family || family.tiers.join('|') !== '咩利羊|茸茸羊|电龙' || family.kind !== 'Bullet'
        || !SKILLS.lamp || SKILLS.lamp.bounces.join(',') !== '0,1,3'
        || SKILLS.lamp.shots.join(',') !== '1,1,2'
        || !SKILL_INFO.lamp?.forms?.[2]?.[0]?.includes('连锁')
        || PROJECTILE_GLYPH.lamp !== 'bolt' || PROJECTILE_EFFECT.lamp !== 'electric') {
        throw new Error('Ampharos electric chain integration regression');
    }
    console.log('电龙专属弹幕：双发雷球与逐阶连锁传导 PASS');
}

// The opening picker offers all nine canonical trios, and every choice is a live, drawable family.
{
    const startersByGeneration = new Map(STARTER_GENERATIONS.map((generation) => [generation,
        STARTER_POKEMON.filter((starter) => starter.generation === generation)]));
    if (STARTER_GENERATIONS.length !== 9 || STARTER_POKEMON.length !== 27
        || STARTER_GENERATIONS.some((generation) => startersByGeneration.get(generation).length !== 3)
        || STARTER_POKEMON.some((starter) => !SPECIES[starter.family]
            || !FAMILIES.some((family) => family.id === starter.family && SKILL_SHARE[family.kind])
            || !SKILLS[starter.family]
            || !existsSync(new URL(`./assets/icons/${starter.icon}.png`, import.meta.url)))) {
        throw new Error('all-generations starter picker integration regression');
    }
console.log('九个世代御三家：每代三选一且图标/队伍数据齐全 PASS');
}

// Galar's three final starter forms unlock only at tier 3, use their dedicated atlas art, and have distinct attacks.
{
    const icons = iconKeys();
    const galar = GIGANTAMAX_FORMS.filter((form) => ['rillaboom', 'cinderace', 'inteleon'].includes(form.id));
    if (galar.length !== 3 || galar.some((form) => !icons.includes(form.icon)
        || !existsSync(new URL(`./assets/icons/${form.icon}.png`, import.meta.url))
        || !GIGANTAMAX_SKILLS[form.id] || !GIGANTAMAX_SKILLS[form.id].name
        || gigantamaxCardsFor({ segments: [{ fam: form.fam, tier: 2 }] }, { stacks: {} }).length !== 0)) {
        throw new Error('Galar Gigantamax assets / unlock regression');
    }
    for (const form of galar) {
        const segment = { fam: form.fam, tier: form.tier };
        const [card] = gigantamaxCardsFor({ segments: [segment] }, { stacks: {} });
        if (!card || card.gmaxForm !== form.id) throw new Error(`${form.id} Gigantamax upgrade was not offered`);
        card.apply();
        if (gigantamaxFormForSegment(segment)?.id !== form.id) throw new Error(`${form.id} Gigantamax did not activate`);
        if (!segment.gigaEntry || segment.gigaEntry.elapsed !== 0 || segment.gigaEntry.impactDone) {
            throw new Error(`${form.id} Gigantamax entry sequence was not initialized`);
        }
    }
    if (new Set(galar.map((form) => GIGANTAMAX_SKILLS[form.id].name)).size !== 3) {
        throw new Error('Galar Gigantamax signatures must stay distinct');
    }
console.log('伽勒尔御三家超极巨化：专属图标、最终进化解锁与独特技能 PASS');
}

// Gigantamax Rillaboom clears the aimed circle and leaves a simulation-timed healing grove.
{
    const form = GIGANTAMAX_FORMS.find((entry) => entry.id === 'rillaboom');
    const skill = GIGANTAMAX_SKILLS.rillaboom;
    const module = activeSkillModuleForForm(form);
    const segment = { fam: 'grookey', tier: 3, count: 1 };
    const skillFxRadii = [];
    const enemy = {
        x: Float32Array.of(100, 350, 600), y: Float32Array.of(0, 0, 0), r: Float32Array.of(8, 8, 8),
        hp: Float32Array.of(1e6, 1e6, 1e6), dead: new Uint8Array(3), _q: [],
        grid: { query (_x, _y, _r, out) { out.length = 0; out.push(0, 1, 2); return out; } },
        hurt (id, damage) {
            this.hp[id] -= damage;
            if (this.hp[id] <= 0) { this.dead[id] = 1; return true; }
            return false;
        },
    };
    const game = {
        level: 1, build: { dmg: 1 }, enemies: enemy, rillaboomFields: [], wall: 0,
        megaSkillFx (_form, x, y, radius, options) {
            skillFxRadii.push(radius);
            return { active: true, area: true, x, y, radius, duration: options.duration,
                age: 0, form: _form, shape: options.shape };
        },
        particleBursts: { burst () {} }, logEvent () {}, wave () {}, kick () {}, say () {},
        pal: { get: (color, alpha) => ({ color, alpha }) },
    };
    if (!form || !skill || !module || skill.radius !== 200
        || skill.shape !== 'healing-grove' || skill.duration !== 60
        || skill.cooldown !== 60 || skill.healRate !== 0.012
        || typeof module.cast !== 'function' || typeof module.drawPreview !== 'function'
        || typeof module.drawEffect !== 'function' || typeof module.drawField !== 'function'
        || !module.cast(game, segment, form, skill, 100, 0)
        || enemy.hp[0] >= 1e6 || enemy.hp[1] !== 1e6 || enemy.hp[2] !== 1e6
        || game.rillaboomFields.length !== 1 || game.rillaboomFields[0].radius !== skill.radius
        || game.rillaboomFields[0].x !== 100 || game.rillaboomFields[0].remaining !== 60
        || skillFxRadii[0] !== skill.radius) {
        throw new Error('Gigantamax Rillaboom targeted clear / persistent grove setup regression');
    }
    const leafPreset = skillParticlePresetForEvent('rillaboom-grove-leaf');
    const sporePreset = skillParticlePresetForEvent('rillaboom-grove-spore');
    const groveParticles = Object.create(NativeParticleBursts.prototype);
    Object.assign(groveParticles, { groveTimer: 0, groveCursor: 0, grovePhase: 0 });
    const groveBursts = [];
    groveParticles.burst = (...args) => groveBursts.push(args);
    for (let i = 0; i < 6; i++) groveParticles.updateRillaboomGroves(0.15, game.rillaboomFields);
    if (!leafPreset || leafPreset.glyph !== 'leafblade' || leafPreset.totalParticles < 3
        || !sporePreset || sporePreset.glyph !== 'spark' || groveBursts.length !== 6
        || groveBursts[0][4] !== 'rillaboom-grove-leaf'
        || groveBursts[1][4] !== 'rillaboom-grove-spore'
        || groveBursts.some((burst) => Math.hypot(burst[1] - 100, burst[2]) > skill.radius)) {
        throw new Error('Rillaboom turf native leaf/spore particles are missing, unpaced, or outside the field');
    }
    const previewRadii = [];
    module.drawPreview({ ...game, aimWorld: { x: 0, y: 0 } }, {
        circle (_x, _y, radius) { previewRadii.push(radius); }, fill () {}, stroke () {}, moveTo () {}, lineTo () {},
    }, form, skill, true, 0.5);
    if (Math.max(...previewRadii) !== skill.radius) {
        throw new Error('Rillaboom aiming preview radius diverged from the tuned skill radius');
    }
    const coinPreset = skillParticlePresetForEvent('gmax-meowth-coins');
    const glintPreset = skillParticlePresetForEvent('gmax-meowth-glints');
    const entryDust = skillParticlePresetForEvent('gmax-entry-dust');
    const entryClods = skillParticlePresetForEvent('gmax-entry-clods');
    if (entryDust?.particleClass !== 'gigantamax' || entryDust.glyph !== 'dust'
        || entryClods?.particleClass !== 'gigantamax' || entryClods.glyph !== 'boulder'
        || entryDust.totalParticles > 30 || entryClods.totalParticles > 14) {
        throw new Error('Gigantamax entry needs bounded native dust and clod particle presets');
    }
    const meowthParticles = Object.create(NativeParticleBursts.prototype);
    Object.assign(meowthParticles, { meowthTimer: 0, meowthCursor: 0, meowthPhase: 0 });
    const meowthBursts = [];
    meowthParticles.burst = (...args) => meowthBursts.push(args);
    const meowthChain = {
        nCount: 1,
        segments: [{ fam: 'cat', gigantamax: 'meowth' }],
        nx: Float32Array.of(120), ny: Float32Array.of(-35),
        headOf (index) { return index === 0 ? 0 : -1; },
    };
    for (let i = 0; i < 7; i++) meowthParticles.updateGigantamaxMeowth(0.18, meowthChain);
    const coinBursts = meowthBursts.filter((burst) => burst[4] === 'gmax-meowth-coins');
    const glintBursts = meowthBursts.filter((burst) => burst[4] === 'gmax-meowth-glints');
    if (!coinPreset || coinPreset.glyph !== 'coin' || coinPreset.startSize < 20 || coinPreset.endSize >= 12
        || !glintPreset || glintPreset.glyph !== 'star' || coinBursts.length !== 7 || glintBursts.length < 2
        || meowthBursts.some((burst) => burst[5] !== 'meowth'
            || Math.hypot(burst[1] - 120, burst[2] + 35) > 100)) {
        throw new Error('Gigantamax Meowth signature coin/glint particle stream is missing or out of orbit');
    }
    meowthParticles.updateGigantamaxMeowth(0.2, { ...meowthChain, segments: [{ fam: 'cat' }] });
    if (meowthParticles.meowthTimer !== 0 || meowthBursts.length !== 9) {
        throw new Error('Gigantamax Meowth particles should stop and reset when the form is absent');
    }
    const auraStream = Object.create(NativeParticleBursts.prototype);
    Object.assign(auraStream, { gmaxAuraTimer: 0, gmaxAuraCursor: 0, gmaxAuraPhase: 0 });
    const auraBursts = [];
    auraStream.burst = (...args) => auraBursts.push(args);
    const pikachuChain = {
        nCount: 1, segments: [{ fam: 'bean', tier: 2, gigantamax: 'pikachu' }],
        nx: Float32Array.of(55), ny: Float32Array.of(18),
        headOf (index) { return index === 0 ? 0 : -1; }, radiusOf () { return 52; },
    };
    auraStream.updateGigantamaxAuras(0.11, pikachuChain);
    if (auraBursts.length !== 1 || auraBursts[0][4] !== 'gmax-aura-pikachu'
        || auraBursts[0][5] !== 'pikachu' || Math.hypot(auraBursts[0][1] - 55, auraBursts[0][2] - 18) > 60) {
        throw new Error('Gigantamax body should emit a bounded, species-specific aura particle stream');
    }
    auraStream.updateGigantamaxAuras(0.2, { ...pikachuChain, segments: [{ fam: 'bean', tier: 2 }] });
    if (auraStream.gmaxAuraTimer !== 0) throw new Error('Gigantamax aura stream did not reset when no Gmax remained');
    const skillStream = Object.create(NativeParticleBursts.prototype);
    Object.assign(skillStream, { gmaxSkillTimer: 0, gmaxSkillCursor: 0, gmaxSkillPhase: 0 });
    const skillBursts = [];
    skillStream.burst = (...args) => skillBursts.push(args);
    const inteleonFx = [{ active: true, shape: '', age: 0.2, duration: 0.8, radius: 278,
        x: 140, y: -22, angle: 0, form: GIGANTAMAX_FORMS.find((entry) => entry.id === 'inteleon') }];
    skillStream.updateGigantamaxSkillParticles(0.07, inteleonFx);
    if (skillBursts.length !== 1 || skillBursts[0][4] !== 'gmax-skill-inteleon'
        || skillBursts[0][5] !== 'inteleon') {
        throw new Error('Gigantamax skill active areas should emit their own native particle stream');
    }
    const player = { x: 100, y: 0, hp: 20, maxhp: 100, dead: false };
    stepRillaboomFields(game.rillaboomFields, player, 10);
    if (player.hp !== 32) throw new Error(`Rillaboom grove healing rate regression: ${player.hp}`);
    player.x = 350;
    stepRillaboomFields(game.rillaboomFields, player, 10);
    if (player.hp !== 32 || game.rillaboomFields[0].remaining !== 40) {
        throw new Error('Rillaboom grove healed outside the turf or used a wall-clock timer');
    }
    const draws = [];
    module.drawField(game, { draw: (...args) => draws.push(args) }, game.rillaboomFields[0]);
    if (draws.length !== 0
        || stepRillaboomFields(game.rillaboomFields, player, 40) !== 1
        || game.rillaboomFields.length !== 0) {
        throw new Error('Rillaboom grove should use particles rather than static filled rings and still expire');
    }
    console.log('超极巨轰擂金刚猩：指定范围清场、固定草场、范围内缓回与 60 秒计时 PASS');
}

// Gigantamax Cinderace's Pyro Ball travels along player aim and sweeps a large circular hitbox.
{
    const form = GIGANTAMAX_FORMS.find((entry) => entry.id === 'cinderace');
    const skill = GIGANTAMAX_SKILLS.cinderace;
    const module = activeSkillModuleForForm(form);
    const segment = { fam: 'scorbunny', tier: 3, count: 1 };
    const enemy = {
        x: Float32Array.of(100, 350, 200), y: Float32Array.of(0, 0, 90),
        r: Float32Array.of(8, 8, 8), hp: Float32Array.of(1e6, 1e6, 1e6),
        dead: new Uint8Array(3), grid: { query (_x, _y, _r, out) { out.length = 0; out.push(0, 1, 2); } },
        hurt (id, damage) { this.hp[id] -= damage; },
    };
    const game = {
        level: 1, build: { dmg: 1 }, enemies: enemy, wall: 0,
        skillOrigin: () => ({ x: 0, y: 0 }),
        megaSkillFx (_form, x, y, radius, options) {
            return { active: true, area: true, x, y, radius, angle: options.angle,
                duration: options.duration, age: 0, form: _form, shape: options.shape };
        },
        particleBursts: { burst () {} }, logEvent () {}, kick () {}, say () {},
    };
    if (!module || skill.shape !== 'directional-fireball' || typeof module.step !== 'function'
        || typeof module.drawPreview !== 'function' || typeof module.drawEffect !== 'function'
        || !module.cast(game, segment, form, skill, 1000, 0)) {
        throw new Error('Gigantamax Cinderace directional fireball module registration regression');
    }
    module.step(game, segment, 0.8, form, skill);
    if (segment.megaSkillX <= 0 || segment.megaSkillHits !== 2 || enemy.hp[0] >= 1e6
        || enemy.hp[1] >= 1e6 || enemy.hp[2] !== 1e6) {
        throw new Error(`Cinderace fireball direction/swept collision regression: x=${segment.megaSkillX}, hits=${segment.megaSkillHits}`);
    }
console.log('超极巨闪焰王牌：玩家指定方向的大火球、扫掠命中与专属预览/渲染 PASS');
}

// Mega Blaziken's live player path is the fiery charge hitbox for the full ten-second channel.
{
    const form = MEGA_FORMS.find((entry) => entry.id === 'blaziken');
    const skill = MEGA_ACTIVE_SKILLS.blaziken;
    const module = activeSkillModuleForForm(form);
    const segment = { fam: 'striker', tier: 3, count: 1 };
    const enemy = {
        x: Float32Array.of(260, 420), y: Float32Array.of(0, 140),
        r: Float32Array.of(8, 8), hp: Float32Array.of(1e9, 1e9),
        dead: new Uint8Array(2), grid: { query (_x, _y, _r, out) { out.length = 0; out.push(0, 1); } },
        hurt (id, damage) { this.hp[id] -= damage; },
    };
    const blazikenBursts = [];
    const game = {
        level: 1, build: { dmg: 1 }, enemies: enemy,
        player: { x: 0, y: 0, vx: 0, vy: 0 }, aimWorld: { x: 1000, y: 0 },
        skillOrigin: () => ({ x: 0, y: 0 }),
        megaSkillFx (_form, x, y, radius, options) {
            return { active: true, area: true, x, y, radius, angle: options.angle,
                duration: options.duration, age: 0, form: _form, shape: options.shape };
        },
        particleBursts: { burst (...args) { blazikenBursts.push(args); } }, logEvent () {}, kick () {}, say () {},
    };
    if (!form || !module || skill.shape !== 'charge-channel' || skill.duration !== 10
        || typeof module.cast !== 'function' || typeof module.step !== 'function'
        || typeof module.playerDrive !== 'function'
        || typeof module.drawPreview !== 'function' || typeof module.drawEffect !== 'function'
        || !module.cast(game, segment, form, skill, 1000, 0)) {
        throw new Error('Mega Blaziken charge module registration regression');
    }
    let drive = module.playerDrive(game, segment, 0.1, form, skill);
    if (!drive || drive.x < 0.99 || Math.abs(drive.y) > 1e-6 || drive.speed <= 168) {
        throw new Error(`Mega Blaziken player-drive regression: ${JSON.stringify(drive)}`);
    }
    game.aimWorld = { x: 0, y: 1000 };
    drive = module.playerDrive(game, segment, 0.1, form, skill);
    if (!drive || drive.y < 0.99 || Math.abs(drive.x) > 1e-6) {
        throw new Error(`Mega Blaziken live mouse-steering regression: ${JSON.stringify(drive)}`);
    }
    game.aimWorld = { x: 1000, y: 0 };
    for (let i = 0; i < 100; i++) {
        const move = module.playerDrive(game, segment, 0.1, form, skill);
        game.player.vx = move.x * move.speed;
        game.player.vy = move.y * move.speed;
        game.player.x += game.player.vx * 0.1;
        game.player.y += game.player.vy * 0.1;
        module.step(game, segment, 0.1, form, skill);
    }
    if (segment.megaSkillActive !== 0 || segment.megaSkillHits < 1
        || enemy.hp[0] >= 1e9 || enemy.hp[1] !== 1e9 || segment.megaSkillCd !== skill.cooldown) {
        throw new Error(`Mega Blaziken ten-second charge/direction regression: active=${segment.megaSkillActive}, hits=${segment.megaSkillHits}`);
    }
    const chargeTrailBursts = blazikenBursts.filter((entry) => entry[4] === 'blaziken-charge-trail');
    if (chargeTrailBursts.length < 100 || chargeTrailBursts.some((entry) => entry[5] !== 'blaziken')) {
        throw new Error(`Mega Blaziken must leave a sustained ember wake during its channel: ${chargeTrailBursts.length} bursts`);
    }
    console.log('超级火焰鸡：10秒自动闪焰冲锋、实时转向、玩家路径胶囊伤害与火焰尾迹 PASS');
}

// Tandemaus is a two-stage line; Maushold's alternate family sprite is a form, not an extra evolution.
{
    const family = FAMILIES.find((entry) => entry.id === 'tandemaus');
    const icons = iconKeys();
    if (!family || family.tiers.join('|') !== '一家鼠|家主鼠'
        || evoCeil('tandemaus') !== 2
        || stepOf('tandemaus', 1)?.to !== 'MAUSHOLD'
        || stepOf('tandemaus', 2) !== null
        || !icons.includes('TANDEMAUS') || !icons.includes('MAUSHOLD') || !icons.includes('MAUSHOLD_1')
        || !SKILLS.tandemaus || !existsSync(new URL('./assets/icons/TANDEMAUS.png', import.meta.url))
        || !existsSync(new URL('./assets/icons/MAUSHOLD.png', import.meta.url))
        || !existsSync(new URL('./assets/icons/MAUSHOLD_1.png', import.meta.url))
        || ![1, 2, 3, 4].every((i) => icons.includes(`MAUSHOLD_COMPANION_${i}`)
            && existsSync(new URL(`./assets/icons/MAUSHOLD_COMPANION_${i}.png`, import.meta.url)))) {
        throw new Error('Tandemaus family integration regression');
    }
    console.log('一家鼠进化链、家主鼠家族形态与专属弹幕: PASS');
}

// Regression guard: stones require the final stage, and ordinary promotion is no longer a mechanic.
{
    const build = { stacks: Object.create(null) };
    const makeSeg = (fam, tier, count = 1, mega = null) => ({ fam, tier, count, mega });
    if (megaCardsFor({ segments: [makeSeg('lizard', 1), makeSeg('lizard', 2)] }, build).length !== 0) {
        throw new Error('MEGA eligibility regression: pre-final stage offered a stone');
    }
    if (megaCardsFor({ segments: [makeSeg('lizard', 3)] }, build).length !== 2) {
        throw new Error('MEGA eligibility regression: final Charizard must offer X/Y stones');
    }
    const charizard = makeSeg('lizard', 3);
    const levelBuild = new Build();
    const levelCtx = { chain: { segments: [charizard] }, player: {} };
    const levelOpts = roll(levelBuild, levelCtx, makeRng(17));
    const megaOpts = levelOpts.filter((choice) => choice.megaForm);
    if (levelOpts.length !== 3 || megaOpts.length !== 1) {
        throw new Error('MEGA level-up regression: eligible final form must reserve one of three cards');
    }
    take(megaOpts[0], levelBuild, levelCtx);
    if (charizard.mega !== megaOpts[0].megaForm) {
        throw new Error('MEGA level-up regression: choosing the stone did not activate that form');
    }
    if (megaFormForSegment(makeSeg('lizard', 2, 1, 'charizard-x'))) {
        throw new Error('MEGA state regression: non-final stage kept an active form');
    }
    const lucario = makeSeg('lucario', 2);
    const lucarioForm = MEGA_FORMS.find((form) => form.id === 'lucario');
    const lucarioCards = megaCardsFor({ segments: [makeSeg('lucario', 1), lucario] }, build);
    if (!lucarioForm || lucarioForm.finalTier !== 2 || lucarioCards.length !== 1
        || lucarioCards[0].megaForm !== 'lucario' || lucarioCards[0].stone !== 'LUCARIONITE'
        || !MEGA_ACTIVE_SKILLS.lucario || MEGA_ACTIVE_SKILLS.lucario.name !== '波导极限爆发'
        || STONE.LUCARIONITE?.zh !== '路卡利欧进化石'
        || !iconKeys().includes('LUCARIO_1')
        || !existsSync(new URL('./assets/icons/LUCARIO_1.png', import.meta.url))
        || !existsSync(new URL('./assets/items/mega/LUCARIONITE.png', import.meta.url))
        || !bulletStyleNames().includes('mega-lucario')
        || !bulletStyleBodySource('mega-lucario').includes('auraPulse')) {
        throw new Error('Mega Lucario final-tier / stone / active skill / icon / shader integration regression');
    }
    lucarioCards[0].apply();
    if (lucario.mega !== 'lucario' || megaFormForSegment(lucario)?.id !== 'lucario'
        || megaFormForSegment(makeSeg('lucario', 3, 1, 'lucario'))) {
        throw new Error('Mega Lucario state must work at its two-stage final tier only');
    }
    if (typeof ChainSystem.prototype.promote !== 'undefined') throw new Error('ordinary promotion must be removed');
    if (typeof ChainSystem.prototype.forge !== 'undefined') throw new Error('tier-4 forging must be removed');
    const log = new PlayLog();
    log.record(1.234, 'test.probe', { ok: true });
    if (log.snapshot().entries[0].time !== 1.23) throw new Error('play log timestamp regression');
    let keydown;
    let capturePhase = false;
    let downloads = 0;
    const saved = { value: null };
    const timers = [];
    const target = {
        addEventListener (type, listener, capture) {
            if (type === 'keydown') { keydown = listener; capturePhase = capture; }
        },
        removeEventListener () {},
        URL: { createObjectURL: () => 'blob:log', revokeObjectURL () {} },
        localStorage: {
            getItem () { return saved.value; },
            setItem (_key, value) { saved.value = value; },
        },
        document: {
            body: { appendChild () {} },
            createElement: () => ({ style: {}, click () { downloads++; }, remove () {} }),
        },
        setTimeout (fn) { timers.push(fn); return timers.length; },
        clearTimeout () {},
    };
    log.install(target);
    log.record(1.5, 'test.autosave', { saved: true });
    timers.shift()();
    const savedRuns = JSON.parse(target.__getSavedPokemonPlayLogs());
    if (savedRuns.length !== 1 || savedRuns[0].entries.at(-1).type !== 'test.autosave') {
        throw new Error('automatic local play-log persistence regression');
    }
    let prevented = false;
    const f9 = { key: 'F9', keyCode: 120, repeat: false, preventDefault () { prevented = true; } };
    keydown(f9);
    keydown(f9);
    if (!capturePhase || !prevented || downloads !== 1) throw new Error('F9 export input regression');
    log.destroy();
    console.log('MEGA final-stage + promotion-removal + autosave + F9 play-log probes: PASS');
}

// Dynamax Band: G-triggered item availability, valid targets, per-Pokémon projectile size, and timing.
{
    const bandBuild = new Build();
    const plain = { fam: 'lizard', tier: 3, count: 1 };
    const mega = { fam: 'lizard', tier: 3, count: 1, mega: 'charizard-x' };
    if (DYNAMAX_BAND.duration !== 30 || DYNAMAX_BAND.cooldown !== 60
        || DYNAMAX_BAND.pokemonScale < 2.3
        || DYNAMAX_BAND.shader !== 'dynamax-pokemon'
        || !canDynamax(plain, null) || canDynamax(mega, { id: 'charizard-x' })
        || canDynamax(plain, { id: 'gigantamax-charizard' })
        || dynamaxProjectileScale(plain, plain) !== 1.55
        || dynamaxProjectileScale(mega, plain) !== 1) {
        throw new Error('Dynamax Band timing / eligibility / per-segment projectile scaling regression');
    }
    // mock 的传说卡索引按 LEVELS 实时求出，池子里加新传说卡也不会让这条断言悄悄挪位。
    const legIdx = LEVELS.filter((e) => e.rarity === 'legendary').findIndex((e) => e.id === 'dynamaxBand');
    const legCount = LEVELS.filter((e) => e.rarity === 'legendary').length;
    const bandCtx = { chain: { segments: [{ fam: 'mush', tier: 1 }] }, player: {} };
    const bandChoice = roll(bandBuild, bandCtx, {
        int (min, max) {
            if (min === 0 && max === 99) return 0;
            if (min === 0 && max === legCount - 1) return legIdx;
            return max;
        },
    }).find((choice) => choice.id === 'dynamaxBand');
    if (!bandChoice) throw new Error('Dynamax Band legendary upgrade was not rollable');
    take(bandChoice, bandBuild, bandCtx);
    if (bandBuild.stacks.dynamaxBand !== 1) throw new Error('Dynamax Band was not added to the run');
    console.log('极巨手环：G道具解锁、目标限制、单体弹幕增幅、30秒/60秒参数 PASS');
}

// 投球升级：回收绳（miss 不再白费）；弹道统计与每掷额外球数固定，不进入升级池。
// 捕捉系统的回收挂点必须默认休眠——普通一局里它们不该有半点存在感。
// 命中即收服 (design call)：球碰到精英也直接收服，没有任何虚弱门槛。
{
    const balls = new CaptureSystem(BALL, CATCH, makeRng(7));
    if (balls.recycle !== 0 || balls.recycled !== 0) {
        throw new Error('capture recycle hook must ship dormant');
    }
    const ids = Object.fromEntries(LEVELS.map((entry) => [entry.id, entry]));
    if (ids.range || ids.ballR || ids.ballSpeed || ids.ballAmmo || ids.twinBall) {
        throw new Error('throw range, ball speed/radius, and ammo upgrades must not be rollable');
    }
    const fixedThrow = new Build();
    if (fixedThrow.range !== BALL.rangeBase || fixedThrow.ballSpeed !== BALL.speedBase
        || fixedThrow.ballR !== BALL.rBase || fixedThrow.balls !== BALL.startingAmmo || BALL.levelAmmo !== 5) {
        throw new Error('removing throw-stat upgrades must retain fixed base stats and starting ammo');
    }
    if (!ids.recycle || ids.recycle.max !== 2) {
        throw new Error('recycle capture upgrade regression');
    }
    // 命中即收服：满血精英被球碰到就直接入队，不需要任何前置状态。
    const eliteMock = {
        n: 1, dead: new Uint8Array(1),
        x: new Float32Array([200]), y: new Float32Array([0]), r: new Float32Array([10]),
        weaken: new Float32Array(1), elite: new Uint8Array([1]), boss: new Uint8Array(1),
        trainer: new Uint8Array(1), shiny: new Uint8Array(1), legendaryReady: new Uint8Array(1),
        fam: new Int16Array(1), tier: new Uint8Array([2]),
        flash: new Float32Array(1),
        trainerActive: false, cfg: ENEMY, capture (i) { this.dead[i] = 1; },
    };
    balls.throw(0, 0, 1, 0, { range: 300, speed: 3000, r: 15 });
    for (let i = 0; i < 60 && balls.bn > 0; i++) balls.update(0.02, eliteMock, 0, 0);
    if (!eliteMock.dead[0] || balls.taken !== 1) {
        throw new Error('elite must be caught on hit - no weaken gate');
    }
    // 入队还要飞 0.34 s 才落地，落地记录那时才进 landed。
    for (let i = 0; i < 40 && balls.landed.length === 0; i++) balls.update(0.02, eliteMock, 0, 0);
    const landed = balls.landed.pop();
    const eliteTier = (landed >> 8) & 0xff, gold = (landed >> 16) & 1;
    if (eliteTier !== 2 || gold !== 1) {
        throw new Error('elite catch must keep its tier-2 gold rewards');
    }
    // 回收绳：投空的球按 100% 概率记入回收计数。
    balls.recycle = 1;
    const emptyMock = { n: 0, dead: new Uint8Array(0), trainerActive: false };
    balls.throw(0, 0, 1, 0, { range: 100, speed: 2000, r: 15 });
    for (let i = 0; i < 60 && balls.bn > 0; i++) balls.update(0.02, emptyMock, 0, 0);
    if (balls.whiffed !== 1 || balls.recycled !== 1) {
        throw new Error('recycle did not return the whiffed ball');
    }
    console.log('投球升级：回收绳注册 · 命中即收服无虚弱门槛 · 弹道统计/单掷球数固定 PASS');
}

// 讲究围巾：全队弹幕发射间隔缩短。伤害经济按 cd 同比例缩包，所以这是节奏与击杀延迟的提升，
// 而 Build 必须默认 ×1——围巾没来之前任何一段都不能凭空变快。
{
    const probe = new Build();
    if (probe.fireRate !== 1) throw new Error('fireRate must default to 1');
    const scarf = LEVELS.find((entry) => entry.id === 'choiceScarf');
    if (!scarf || scarf.max !== 5 || typeof scarf.apply !== 'function') {
        throw new Error('choice scarf card regression');
    }
    scarf.apply(probe);
    scarf.apply(probe);
    if (Math.abs(probe.fireRate - 0.7225) > 1e-9) {
        throw new Error('choice scarf must compound -15% per pick');
    }
    console.log('讲究围巾：发射间隔 ×0.85 每级可叠 5 层 · Build 默认 ×1 PASS');
}
// v0.9.6's sweep hook: the auto gate's own density, so the ladder of thresholds can be measured without
// editing the shipped default. Unset leaves `CHAIN.autoEvery` as config has it, i.e. the shipped rung.
if (process.env.AUTOEVERY) CHAIN.autoEvery = Number(process.env.AUTOEVERY);
// v0.9.7's second dial: the 冷摞档 (§9.18). `off` / `inf` = v0.9.6's gate-only behaviour, a number = how many
// seconds a pile must stand unfed before auto takes it at its own 图鉴价.
if (process.env.AUTOCOLD) {
    CHAIN.autoCold = /^(off|inf|infinity)$/i.test(process.env.AUTOCOLD) ? Infinity : Number(process.env.AUTOCOLD);
}
// v0.9.9's price dial: `EVOLVEFLAT=0` puts the run back on the dex ladder (2/3/4 只 + 融核 + 携带秒) so the
// signed flat-3 rule can be measured against the tree it replaced, on the same seeds and the same hand speed.
if (process.env.EVOLVEFLAT !== undefined) CHAIN.evolveFlat = Number(process.env.EVOLVEFLAT);
// v0.9.9-b's *shape* dial: which law decides what a fold leaves behind — `EVOLVEKEEPS=0` the stack divides
// (shipped), `1` the pile keeps everything but `q − 1` (`count → count − q + 1`), `2` only the one member that
// transforms is spent (`count → count − 1`), `3` nothing is spent at all (`count → count`: 进化 buys 阶 and the
// pile stands). `EVOLVEFLAT` stays the **trigger** price, so the signed 「3 只就进化」
// world is reproducible at any rung and §9.20's flat-vs-dex bill still holds with the divisor law in force.
if (process.env.EVOLVEKEEPS !== undefined) CHAIN.evolveKeeps = Number(process.env.EVOLVEKEEPS);
// v0.9.9-c's *geometry* dial: what a 段's sweeping disc is sized by. `0` = v0.9.8's law (体型 × 阶, plus √k at
// 满线); `1` = the disc's area *is* the 段's per-seat DPS, so a fold cannot buy less ground than it bought
// damage. §9.22's bill is the 8 seeds × both hand speeds that decide it.
if (process.env.SWEEPAREA !== undefined) CHAIN.sweepArea = Number(process.env.SWEEPAREA);
// The four shapes `chain.foldAfter` implements, in the words the tables print them in. `0` is v0.9's law and
// the shipped one; `1` is the signed (b); `2` is 原作's own reading (进化 transforms one member, eats nothing);
// `3` is 「只需要 3 只就能进化」 read as a law rather than a price.
const FOLD_TEXT = {
    0: '整摞相除（floor(count/q)，一折吃掉 1−1/q 的摞）',
    1: '触发价不吃排场（count−q+1，一折只花 q−1 只）',
    2: '只变不吃（count−1，一折只花 1 只，其余留着长）',
    3: '进化只改阶（count，一折花 0 只 · 摞整份留着继续长）',
};
// v0.9.7's *economy* dial: how many balls a run may throw per minute. A bot throws whenever its cooldown
// allows, which lands ~1.6 只/s — an economy where a 24-只 pile is routine and the 排场 gate is a road it
// actually walks. A player aiming by hand does not, and that gap is the whole reason 自动进化 read as
// missing for four reports (§9.18). Unset = the bot's own cadence, i.e. every table measured until now.
const THROW_PM = Number(process.env.THROWPM || 0);
// v0.9.9-c's *geometry* probe (GEO=1): what a fold actually spends. `nodes` and 实测清场 are two proxies for
// one claim — that a fold buys DPS and sells **ground swept** — and until now it had no column of its own, so
// every rung of `evolveKeeps` was argued from a correlation. This samples the circles themselves every 10 s.
// Off by default, so the table's column contract (§9.17-⑥) is untouched.
const GEO = process.env.GEO === '1';
const GEO_CIRC = [];
/**
 * `FORCED` must gate the **spawn**, not the throw. 【掷】 captures whatever the ball hits (§6: 碰到谁就是
 * 谁), so filtering only `pickTarget` still lets a blocked family walk into a legal throw and come home:
 * the first "turtle only" probe turned out to carry 10 other families. `漏族` in the table below checks
 * this claim every frame instead of trusting it.
 */
const SPAWNABLE = FORCED.length === 0 ? null
    : FAMILIES.map((f, i) => i).filter(i => FORCED.indexOf(FAMILIES[i].id) >= 0);

/**
 * The species is part of the *wave*, so it comes off the horde's stream. `game.js` passes no `fam` and
 * gets `enemies.rng.int`; drawing it from the bot's stream instead (as this did until the 怪流 column
 * caught it) shifted the horde relative to the runtime by one draw per spawn - and made the deal depend
 * on how fast a policy happened to consume its own randoms.
 */
function famRoll () {
    return SPAWNABLE === null
        ? enemies.rng.int(0, FAMILIES.length - 1)
        : SPAWNABLE[enemies.rng.int(0, SPAWNABLE.length - 1)];
}

const chain = new ChainSystem(null, CHAIN);
const enemies = new EnemySystem(ENEMY, makeRng(SEED));
// Seeded mass-outbreaks must create a nearby cluster of one species/tier and replay identically.
{
    const runOutbreak = () => {
        const horde = new EnemySystem(ENEMY, makeRng(SEED + 17));
        for (let frame = 0; frame < 90 * 60; frame++) {
            const second = frame / 60;
            if (horde.direct(1 / 60, second / 60, 1, 0, 0, 500, null, true, true) !== 'outbreak') continue;
            const first = horde.n - horde.outbreakCount;
            for (let i = first; i < horde.n; i++) {
                if (horde.fam[i] !== horde.outbreakFamIdx || horde.tier[i] !== horde.outbreakTier
                    || horde.elite[i] || Math.hypot(horde.x[i] - horde.outbreakX, horde.y[i] - horde.outbreakY)
                        > ENEMY.radius * 7.2 + 1) {
                    throw new Error('wild mass-outbreak did not produce a same-species nearby cluster');
                }
            }
            return [frame, horde.outbreakFamIdx, horde.outbreakTier, horde.outbreakCount];
        }
        throw new Error('wild mass-outbreak did not trigger within 90 seconds');
    };
    const first = runOutbreak();
    const replay = runOutbreak();
    if (first.join('|') !== replay.join('|') || first[3] < 10 || first[3] > 14) {
        throw new Error('wild mass-outbreak seed replay or group size regression');
    }
    console.log(`野生大量出现: PASS（第${(first[0] / 60).toFixed(1)}秒 · 同种 ${first[3]} 只 · 固定种子可复现）`);
}
// Population is unbounded by gameplay rules. Exercise geometric growth past the former 300 cap
// and the old signed-16-bit index boundary, where skill queries used to wrap enemy ids negative.
{
    const probe = new EnemySystem({ ...ENEMY, initialCapacity: 8 }, makeRng(SEED + 3));
    for (let i = 0; i < 32770; i++) {
        if (probe.spawn(i, 0, 0, 1, false, 0) !== i) throw new Error(`horde growth regression at ${i}`);
    }
    if (probe.n !== 32770 || probe.x.length < probe.n || probe.dead.length !== probe.x.length) {
        throw new Error('horde growth regression: arrays did not expand together');
    }
    probe.x.fill(0, 0, probe.n);
    probe.y.fill(0, 0, probe.n);
    probe.update(1 / 60, 0, 0, 100000);
    if (probe.grid.count !== probe.n || !Number.isFinite(probe.vx[probe.n - 1])) {
        throw new Error('dense horde update regression');
    }
    const candidate = new Int32Array(1);
    candidate[0] = probe.n - 1;
    if (candidate[0] !== 32769) throw new Error('horde target-index regression beyond 16-bit ids');
    const wave = new EnemySystem({
        ...ENEMY, initialCapacity: 8, spawnBase: 400, spawnPerMin: 0,
        spawnPerPet: 0, spawnLatePerMin: 0, eliteAfter: Infinity,
    }, makeRng(SEED + 4));
    wave.direct(1, 0, 0, 0, 0, 500, () => 0, true);
    if (wave.n !== 400) throw new Error(`horde spawn regression: expected 400, got ${wave.n}`);
    const trainerWave = new EnemySystem({
        ...ENEMY, initialCapacity: 8, spawnBase: 4, spawnPerMin: 0,
        spawnPerPet: 0, spawnLatePerMin: 0, eliteAfter: 0, eliteEvery: 1,
        spawnRate: (minute) => minute < 0.5 ? 4 : 200,
    }, makeRng(SEED + 5));
    trainerWave.trainerActive = true;
    trainerWave.direct(0.5, 0, 0, 0, 0, 100, () => 0, true);
    const lowRateAudience = trainerWave.trainerWatchCount;
    if (trainerWave.n !== 2 || trainerWave.elite[0] || trainerWave.elite[1]
        || lowRateAudience !== BOSS.watchCount + 10) {
        throw new Error(`trainer perimeter refresh regression: expected 2 regular wilds, got ${trainerWave.n}`);
    }
    trainerWave.arenaX = 120;
    trainerWave.arenaY = -45;
    trainerWave.arenaR = 80;
    for (let i = 0; i < trainerWave.n; i++) {
        trainerWave.x[i] = trainerWave.arenaX;
        trainerWave.y[i] = trainerWave.arenaY;
    }
    trainerWave.prepareTrainerGather();
    trainerWave.trainerIntro = BOSS.formationSec;
    trainerWave.update(1 / 60, trainerWave.arenaX, trainerWave.arenaY, 500);
    for (let i = 0; i < trainerWave.n; i++) {
        const d = Math.hypot(trainerWave.x[i] - trainerWave.arenaX, trainerWave.y[i] - trainerWave.arenaY);
        if (d < 1 || d >= trainerWave.arenaR + trainerWave.r[i]) {
            throw new Error('trainer arena gathering should be smooth, not a teleport to the perimeter');
        }
    }
    for (let frame = 1; frame < 60; frame++) trainerWave.update(1 / 60, trainerWave.arenaX, trainerWave.arenaY, 500);
    for (let i = 0; i < trainerWave.n; i++) {
        if (Math.hypot(trainerWave.x[i] - trainerWave.arenaX, trainerWave.y[i] - trainerWave.arenaY)
            < trainerWave.arenaR + trainerWave.r[i] + 5.9) {
            throw new Error('trainer arena wild boundary regression: wild entered the battle ring');
        }
    }
    trainerWave.direct(0.5, 1, 0, trainerWave.arenaX, trainerWave.arenaY, 500, () => 0, true);
    trainerWave.update(1 / 60, trainerWave.arenaX, trainerWave.arenaY, 500);
    let audienceRows = 0;
    for (let i = 0; i < trainerWave.n; i++) if (trainerWave.arenaLayer[i] < 2) audienceRows++;
    if (trainerWave.n !== 102 || trainerWave.trainerWatchCount !== BOSS.watchMaxCount
        || trainerWave.trainerWatchCount <= lowRateAudience || audienceRows !== trainerWave.n) {
        throw new Error(`trainer audience should scale/promote with spawn rate: ${audienceRows}/${trainerWave.n}`);
    }
    console.log(`Trainer audience scales with spawn cadence: ${lowRateAudience} → ${trainerWave.trainerWatchCount} target places, existing/new mobs join visible rings: PASS`);
    console.log(`Uncapped horde growth probe: PASS (${probe.n} direct spawns; ${wave.n} in one wave; trainer perimeter refreshes at normal cadence)`);
    console.log('Trainer battle perimeter: wild Pokémon stay outside the arena ring: PASS');
}
/**
 * `怪流` is this file's own isolation claim, measured rather than asserted. The horde is dealt from one
 * RNG stream, and a run that inherits the previous run's leftover draws is not the same game: on seed
 * 20260920 the `merge` bot survived 10:00 in one table and died@150s in another, and only the row order
 * explained it. Sampling the first spawns from inside `spawn()` is what makes that failure visible
 * instead of readable only in a footnote - the strings must be identical across all six bots.
 */
const horde = { seq: [] };
const rawSpawn = enemies.spawn.bind(enemies);
enemies.spawn = (x, y, famIdx, tier, elite, minute, boss) => {
    if (horde.seq.length < 4) horde.seq.push(`${FAMILIES[famIdx].id}${tier}${elite ? 'e' : ''}${boss ? 'B' : ''}`);
    return rawSpawn(x, y, famIdx, tier, elite, minute, boss);
};
const capture = new CaptureSystem(BALL, CATCH, makeRng(SEED + 1));
const combat = new CombatSystem(ENEMY, PLAYER);
{
    if (Math.abs(combat.bite(0, 0, 0, 1) - 6.6) > 1e-8 || BOSS.projectileDamage !== 11
        || BOSS.projectileWarning !== 0.62) {
        throw new Error('enemy threat tune changed damage targets or reduced the dodge telegraph');
    }
    const pressureProbe = new TrainerBossSystem();
    const pressureEnemies = new EnemySystem(ENEMY, makeRng(SEED + 6));
    pressureProbe.start(pressureEnemies, 0, 0, 0, 1, 0);
    if (Math.abs(pressureProbe.arenaR * pressureProbe.zoom - 0.42 * Math.min(VIEW.W, VIEW.H)) > 1e-5
        || Math.abs(pressureProbe.party[0].period - BOSS.encounters[0].party[0].period / 1.12) > 1e-6) {
        throw new Error('trainer arena size or opening attack cadence regression');
    }
    console.log('Enemy pressure tuning: tier-1 bite, trainer damage/cadence, 42% arena radius and readable warning verified: PASS');
}
{
    const fence = new TrainerBossSystem();
    fence.active = true;
    fence.cx = 0;
    fence.cy = 0;
    fence.arenaR = 100;
    const hero = { x: 150, y: 0, vx: 80, vy: 12 };
    fence.constrainPlayer(hero);
    if (Math.hypot(hero.x, hero.y) > fence.arenaR - PLAYER.radius + 1e-4 || hero.vx > 0) {
        throw new Error('trainer battle player arena boundary regression');
    }
    const wilds = {
        x: Float32Array.from([0]), y: Float32Array.from([0]), r: Float32Array.from([12]),
        dead: new Uint8Array(1), weaken: new Float32Array(1), trainer: new Uint8Array(1),
        legendaryReady: new Uint8Array(1), elite: new Uint8Array(1), boss: new Uint8Array(1),
        tier: new Uint8Array([2]), trainerActive: true,
        grid: { query (_x, _y, _r, out) { out.length = 0; out.push(0); return out; } },
    };
    if (combat.contact(wilds, 0, 0).hits !== 0) throw new Error('trainer fight wild contact damage regression');
    wilds.trainerActive = false;
    if (combat.contact(wilds, 0, 0).hits !== 1) throw new Error('normal wild contact behavior changed');
    console.log('Trainer battle: player stays inside arena and wild contact cannot damage; outside-battle contact remains: PASS');
}
const skills = new SkillSystem();
skills.on = SKILL;
{
    const family = FAMILIES.find((candidate) => candidate.id === 'lizard');
    const arena = makeDexArena(family, 1, 1, { x: 385, y: 180 });
    for (let frame = 0; frame < 98; frame++) {
        arena.skills.step(1 / 60, arena.chain, arena.enemies, 1, 1, 1);
    }
    if (arena.enemies.grid.count !== 4 || arena.skills.m.volleys !== 2) {
        throw new Error('Pokédex training targets must be indexed so ordinary auto-projectiles can fire');
    }
    console.log('Pokédex preview: training targets are indexed and Charmander fires at its 1.60 s cadence: PASS');
}
{
    const probe = new SkillSystem();
    const encounter = {
        x: Float32Array.from([8, 90, 40]), y: Float32Array.from([0, 0, 0]),
        r: Float32Array.from([8, 8, 8]), dead: new Uint8Array(3),
        boss: new Uint8Array(3), legendary: new Uint8Array(3), legendaryReady: new Uint8Array(3),
        trainer: Uint8Array.from([0, 1, 0]), trainerActive: true, bossN: 0,
        grid: { query (_x, _y, _r, out) { out.length = 0; out.push(0, 1, 2); return out; } },
    };
    const targets = new Int32Array([0, 2, 1]);
    if (probe._nearest(encounter, 0, 0, 120) !== 1
        || probe._prioritize(encounter, targets, targets.length) !== 3 || targets[0] !== 1) {
        throw new Error('boss encounter attack-priority regression');
    }
    console.log('Boss fight attack targeting: trainer boss is prioritized over nearby wild Pokémon while wild targets remain enabled: PASS');
}
{
    const captureIndex = 0;
    const selector = new SkillSystem();
    const nearby = {
        x: Float32Array.from([2, 18]), y: Float32Array.from([0, 0]),
        r: Float32Array.from([2, 2]), dead: new Uint8Array(2), aimedCaptureTarget: captureIndex,
        grid: { query (_x, _y, _r, out) { out.length = 0; out.push(0, 1); return out; } },
    };
    if (selector._nearest(nearby, 0, 0, 32) !== 1) {
        throw new Error('party targeting should skip the capture-reticle target and choose the next wild body');
    }
    const protectedEnemies = new EnemySystem(ENEMY, makeRng(SEED + 91));
    const target = protectedEnemies.spawn(0, 0, 0, 1, false, 0);
    const other = protectedEnemies.spawn(24, 0, 1, 1, false, 0);
    protectedEnemies.aimedCaptureTarget = target;
    const targetHp = protectedEnemies.hp[target];
    const otherHp = protectedEnemies.hp[other];
    protectedEnemies.hurt(target, 10);
    protectedEnemies.hurt(other, 10);
    if (protectedEnemies.hp[target] !== targetHp || protectedEnemies.hp[other] >= otherHp) {
        throw new Error('the reserved catch target should stay safe while nearby wild targets remain attackable');
    }
    const GameProbe = createGame({ Component: class {} });
    const captureProbe = new EnemySystem(ENEMY, makeRng(SEED + 92));
    const aimed = captureProbe.spawn(60, 0, 0, 1, false, 0);
    const captureGuard = {
        trainerBoss: { active: false }, build: { balls: 1, range: 120, ballR: 5 },
        enemies: captureProbe, capture: new CaptureSystem(BALL, CATCH, makeRng(SEED + 93)),
        aim: () => ({ x: 0, y: 0, dx: 1, dy: 0 }),
    };
    if (GameProbe.prototype.captureGuardTarget.call(captureGuard) !== aimed) {
        throw new Error('capture guard should reserve the exact body the ball preview predicts');
    }
    captureGuard.build.balls = 0;
    if (GameProbe.prototype.captureGuardTarget.call(captureGuard) !== -1) {
        throw new Error('capture guard should release its target when no ball is available');
    }
    console.log('Capture aiming: party attacks skip and protect the reticle-locked catch target: PASS');
}
{
    const palette = { get: (color, alpha) => ({ color, alpha }) };
    const fx = { age: 0.4, duration: 1, radius: 180, x: 8, y: 12, angle: 0.3,
        form: { id: 'charizard-x', color: '#55d9f5', glyph: 'claw' } };
    const megaDraws = [];
    drawMegaActiveArea({ pal: palette }, { draw: (...args) => megaDraws.push(args) }, fx,
        { pattern: 1, motifs: 4 });
    if (megaDraws.length !== 1 || megaDraws[0][0] !== 'ring' || megaDraws[0][3] !== fx.radius / 24
        || megaDraws.some((call) => call[call.length - 1] !== 'mega-charizard-x')) {
        throw new Error('Mega generic area should retain a subdued guide at the actual hit radius');
    }
    const gmaxDraws = [];
    drawMegaActiveArea({ pal: palette }, { draw: (...args) => gmaxDraws.push(args) },
        { ...fx, form: { ...fx.form, id: 'inteleon', gigantamax: true } }, { motifs: 4 });
    if (gmaxDraws.length !== 0) {
        throw new Error('Gigantamax area renderer should defer entirely to native particles');
    }
    console.log('Mega/Gmax active-area renderer: faint Mega hit-radius guide, Gmax delegated to particles PASS');
}
{
    const draws = [];
    const palette = { get: (color, alpha) => ({ color, alpha }) };
    const form = { id: 'venusaur', color: '#f278c8', glyph: 'leaf' };
    const game = { megaFx: [
        { active: true, hit: false, area: false, age: 0.4, duration: 1, x: 1, y: 2, angle: 0.2, form },
        { active: true, hit: true, area: false, age: 0.3, duration: 1, x: 3, y: 4, angle: 0.4, form },
        { active: true, hit: false, area: true, age: 0.2, duration: 1, x: 5, y: 6, angle: 0.6, form },
        { active: false, hit: false, area: false, age: 0, duration: 1, x: 0, y: 0, angle: 0, form },
    ], pal: palette, wall: 2 };
    let areaCalls = 0;
    drawMegaEffects(game, { draw: (...args) => draws.push(args) }, {
        activeSkillForForm: () => ({ pattern: 0 }), activeSkillModuleForForm: () => null,
        drawMegaActiveArea: () => { areaCalls++; },
    });
    if (draws.length !== 0 || areaCalls !== 1) {
        throw new Error('Mega launch/hit should be particle-only while active areas keep their renderer dispatch');
    }
    console.log('Mega launch/hit particles: sprite overlays removed while active areas retain their dispatch PASS');
}
{
    const draws = [];
    drawMegaProjectile({ draw (...args) { draws.push(args); } },
        { get: (color, alpha) => ({ color, alpha }) },
        { form: { id: 'venusaur', color: '#f278c8', glyph: 'leaf' },
            x: 12, y: 24, size: 2, angle: 0.4, wall: 1, index: 0 });
    if (draws.length !== 0
        || !MEGA_FORMS.some((entry) => entry.id === 'venusaur' && entry.glyph === 'leaf')) {
        throw new Error('Mega projectile sprite renderer should defer to form-specific particle trails');
    }
    console.log('Mega signature projectiles: sprite layers removed; form-specific particle silhouette retained: PASS');
}
{
    const draws = [];
    const palette = { get: (color, alpha) => ({ color, alpha }) };
    drawMegaProjectile({ draw (...args) { draws.push(args); } }, palette,
        { form: { id: 'gardevoir', color: '#ff91c8', glyph: 'crescent' },
            x: 12, y: 24, size: 2, angle: 0.4, wall: 1, index: 0 });
    const skill = MEGA_ACTIVE_SKILLS.gardevoir;
    const module = activeSkillModuleForForm({ id: 'gardevoir' });
    const targets = {
        x: Float32Array.from([0, -40, 92]), y: Float32Array.from([0, 35, 92]),
        r: Float32Array.from([0, 0, 0]), hp: Float32Array.from([10, 10, 10]),
        dead: new Uint8Array(3), _q: [],
        grid: { query (_x, _y, _r, out) { out.length = 0; out.push(0, 1, 2); return out; } },
        hurt (i, damage) { const killed = this.hp[i] <= damage; this.hp[i] -= damage; return killed; },
    };
    const result = hitHeart(targets, 0, 0, 100, 2);
    if (!pointInHeart(0, 0, 1, 1) || !pointInHeart(-0.4, 0.3, 1, 1)
        || pointInHeart(0.92, 0.92, 1, 1) || result.hits !== 2 || result.kills !== 0
        || skill.shape !== 'heart' || !module || typeof module.cast !== 'function'
        || typeof module.drawPreview !== 'function' || typeof module.drawEffect !== 'function'
        || draws.length !== 0
        || skillParticlePresetForEvent('projectile-trail-gardevoir')?.glyph) {
        throw new Error('Mega Gardevoir heart projectile, target shape, or skill module regression');
    }
    console.log('Mega Gardevoir module: distinct heart volleys, heart-shaped area hits and active-skill dispatch: PASS');
}
{
    const expected = { moth: ['flame', 4, 0.7], drop: ['dot', 5, -0.3], mayfly: ['shard', 4, 0.7] };
    for (const [family, [glyph, marks, direction]] of Object.entries(expected)) {
        const effect = fieldEffectForFamily(family);
        if (!effect || effect.glyph !== glyph || effect.marks !== marks || effect.direction !== direction) {
            throw new Error(`Field decoration profile changed for ${family}`);
        }
    }
    if (orbitCoreGlyphForFamily('mush') !== 'blob' || orbitCoreGlyphForFamily('ordinary') !== 'star'
        || fieldEffectForFamily('ordinary')) {
        throw new Error('Field effect registry changed Bulbasaur orbit or generic field fallback');
    }
    console.log('Signature field/orbit effect modules: family-specific decoration and generic fallback: PASS');
}
{
    const bloom = skillParticlePresetForEvent('flower-bloom');
    const water = skillParticlePresetForEvent('water-channel');
    const splash = skillParticlePresetForEvent('water-impact');
    if (!bloom || bloom.particleClass !== 'flower' || bloom.glyph !== 'leaf' || bloom.totalParticles !== 74
        || bloom.emissionRate !== 460 || bloom.color !== '#ef82cf'
        || !water || water.particleClass !== 'mega-channel' || water.glyph !== 'wave'
        || water.totalParticles !== 8 || water.emissionRate !== 300
        || !splash || splash.particleClass !== 'water-impact' || splash.glyph !== 'wave'
        || splash.totalParticles !== 11 || skillParticlePresetForEvent('ordinary-hit')) {
        throw new Error('Skill-specific Cocos particle presets changed or leaked into generic events');
    }
    console.log('Species skill particle modules: Meowscarada bloom and Blastoise water beam/impact presets: PASS');
}
{
    const renderer = projectileRendererForFamily('mush');
    const draws = [];
    const batch = { draw (...args) { draws.push(args); } };
    const palette = { get (color, alpha) { return { color, alpha }; } };
    if (typeof renderer !== 'function' || projectileRendererForFamily('unregistered-family')) {
        throw new Error('Bulbasaur seed renderer registry routed an unrelated family');
    }
    renderer(batch, palette, { x: 10, y: 20, size: 4, wall: 0, shotAngle: 0, index: 0 });
    const seedTrail = skillParticlePresetForEvent('projectile-trail-mush');
    if (draws.length !== 0 || seedTrail?.glyph !== 'leafblade'
        || seedTrail.particleClass !== 'projectile-trail') {
        throw new Error('Bulbasaur seed should use its native leafblade particles without a sprite overlay');
    }
    console.log('Bulbasaur seed projectile: leafblade ParticleSystem2D stream only PASS');
}
{
    const palette = { get: (color, alpha) => ({ color, alpha }) };
    const expectations = { lucario: 'spark', honedge: 'crescent' };
    for (const [famId, glyph] of Object.entries(expectations)) {
        const renderer = projectileRendererForFamily(famId);
        const draws = [];
        if (typeof renderer !== 'function') throw new Error(`${famId} signature renderer missing`);
        renderer({ draw (...args) { draws.push(args); } }, palette,
            { x: 10, y: 20, size: 4, wall: 0.5, shotAngle: 0, index: 3 });
        const preset = skillParticlePresetForEvent(`projectile-trail-${famId}`);
        if (draws.length !== 0 || preset?.glyph !== glyph
            || preset.particleClass !== 'projectile-trail' || preset.totalParticles < 7) {
            throw new Error(`${famId} signature shot must be drawn only by its ${glyph} particle stream`);
        }
    }
    console.log('波导/灵刃签名弹幕：spark 与 crescent 粒子替代精灵批次叠绘 PASS');
}
{
    const expectedGlyphs = {
        buizel: 'wave', shinx: 'bolt', munchlax: 'crescent', machop: 'claw', togepi: 'star',
    };
    const palette = { get: () => ({}) };
    for (const [famId, glyph] of Object.entries(expectedGlyphs)) {
        const preset = skillParticlePresetForEvent(`projectile-trail-${famId}`);
        const renderer = projectileRendererForFamily(famId);
        let draws = 0;
        renderer({ draw () { draws++; } }, palette,
            { x: 0, y: 0, size: 4, wall: 1, shotAngle: 0, index: 0 });
        if (!preset || preset.glyph !== glyph || preset.totalParticles < 7
            || preset.particleClass !== 'projectile-trail' || draws !== 0) {
            throw new Error(`${famId} projectile should be represented by its native ${glyph} particle stream only`);
        }
    }
    console.log('水流喷射/电光爪击/呼噜震波/十字拳/祈愿星：专属粒子替代精灵批次叠绘 PASS');
}
{
    const particleOnlyFamilies = [
        ['mush', 1], ['lucario', 2], ['honedge', 3], ['machop', 2],
        ['togepi', 3], ['buizel', 2], ['munchlax', 2], ['shinx', 3], ['zorua', 2],
        ['toxtricity', 2], ['shroomish', 2], ['hatenna', 3], ['impidimp', 3],
        ['archen', 2], ['smoliv', 3], ['tadbulb', 2], ['wattrel', 2], ['porygon', 3],
        ['vivillon', 3], ['cutiefly', 2], ['dreepy', 3],
    ];
    const palette = { get: () => ({}) };
    for (const [family, stage] of particleOnlyFamilies) {
        const draws = [];
        const renderer = projectileRendererForFamily(family, stage);
        if (typeof renderer !== 'function') throw new Error(`${family} renderer route missing`);
        renderer({ draw: (...args) => draws.push(args) }, palette,
            { x: 0, y: 0, size: 4, wall: 1, shotAngle: 0, index: 0, variant: 0 });
        if (draws.length !== 0) throw new Error(`${family} left a SpriteBatch projectile overlay behind`);
    }
    console.log('21 条粒子型专属弹幕：无 SpriteBatch 弹体覆盖；一家鼠保留实时鼠形弹体 PASS');
}
{
    const targets = {
        x: Float32Array.from([30, 50, 50, 0, -10]),
        y: Float32Array.from([0, 14, 20, 0, 0]),
        r: Float32Array.from([5, 5, 5, 5, 5]),
        hp: Float32Array.from([100, 100, 100, 100, 100]),
        dead: new Uint8Array(5), _q: [],
        grid: { query (_x, _y, _r, out) { out.length = 0; out.push(0, 1, 2, 3, 4); return out; } },
        hurt (i, damage) { this.hp[i] -= damage; return false; },
    };
    const inside = hitRect(targets, 0, 0, 100, 20, 0, 10);
    const waterCannon = MEGA_ACTIVE_SKILLS.blastoise;
    const waterModule = activeSkillModuleForForm({ id: 'blastoise' });
    if (inside.hits !== 3 || waterCannon.shape !== 'rect-beam' || waterCannon.duration !== 3
        || !(waterCannon.radius > 0 && waterCannon.width > 0 && waterCannon.tick > 0)
        || !waterModule || typeof waterModule.cast !== 'function'
        || typeof waterModule.step !== 'function' || typeof waterModule.drawEffect !== 'function') {
        throw new Error('Mega Blastoise sustained rectangular cannon footprint regression');
    }
    console.log('Mega Blastoise module registry: 3-second 440x142 rectangular water cannon and exact rotated-box hit test: PASS');
}
{
    const cases = [
        ['shroomish', 2, 'roster-breloom', 'spore-field'],
        ['hatenna', 3, 'roster-hatterene', 'heart-heal'],
        ['archen', 2, 'roster-archeops', 'dive-line'],
        ['vivillon', 3, 'roster-vivillon', 'pollen-garden'],
        ['cutiefly', 2, 'roster-ribombee', 'honey-orbit'],
    ];
    for (const [fam, tier, id, shape] of cases) {
        const form = rosterActiveFormForSegment({ fam, tier });
        const skill = activeSkillForForm(form);
        const module = activeSkillModuleForForm(form);
        if (!form || form.id !== id || skill.shape !== shape || typeof module?.cast !== 'function'
            || typeof module.drawPreview !== 'function' || typeof module.drawEffect !== 'function') {
            throw new Error(`${fam} roster-active-skill registry/renderer integration regression`);
        }
        if (rosterActiveFormForSegment({ fam, tier: tier - 1 })
            || rosterActiveFormForSegment({ fam, tier, mega: 'some-mega' })
            || rosterActiveFormForSegment({ fam, tier, gigantamax: 'some-gmax' })) {
            throw new Error(`${fam} active skill unlocked on a pre-evolution or transformed form`);
        }
    }

    const makeEnemies = (xs, ys, boss = []) => ({
        x: Float32Array.from(xs), y: Float32Array.from(ys), r: Float32Array.from(xs.map(() => 6)),
        hp: Float32Array.from(xs.map(() => 1e6)), dead: new Uint8Array(xs.length),
        boss: Uint8Array.from(xs.map((_, i) => boss.includes(i) ? 1 : 0)),
        trainer: new Uint8Array(xs.length), entangled: [], _q: [],
        grid: { query (_x, _y, _r, out) { out.length = 0; for (let i = 0; i < xs.length; i++) out.push(i); return out; } },
        hurt (i, damage) { this.hp[i] -= damage; return false; },
        entangle (i, seconds) { this.entangled.push([i, seconds]); },
    });
    const makeGame = (enemies) => ({
        enemies, build: { dmg: 1 }, level: 1, wall: 0, aimWorld: { x: 450, y: 0 },
        player: { hp: 40, maxhp: 100 }, particleBursts: { burst () {} }, events: [],
        logEvent (...args) { this.events.push(args); }, megaSkillFx () {}, wave () {}, kick () {}, say () {},
        skillOrigin () { return { x: 0, y: 0 }; },
        pal: { get (color, alpha) { return { color, alpha }; } },
    });
    const segment = (fam, tier) => ({ fam, tier, count: 1, megaSkillCd: 0 });
    const breloomEnemies = makeEnemies([0, 24], [0, 0], [1]);
    const breloomForm = rosterActiveFormForSegment({ fam: 'shroomish', tier: 2 });
    activeSkillModuleForForm(breloomForm).cast(makeGame(breloomEnemies), segment('shroomish', 2),
        breloomForm, activeSkillForForm(breloomForm), 0, 0);
    if (breloomEnemies.entangled.length !== 1 || breloomEnemies.entangled[0][0] !== 0) {
        throw new Error('Breloom spore field must root ordinary mobs while leaving bosses unstunned');
    }

    const hattereneGame = makeGame(makeEnemies([0, 22, -22], [0, 0, 0]));
    const hattereneForm = rosterActiveFormForSegment({ fam: 'hatenna', tier: 3 });
    activeSkillModuleForForm(hattereneForm).cast(hattereneGame, segment('hatenna', 3),
        hattereneForm, activeSkillForForm(hattereneForm), 0, 0);
    if (!(hattereneGame.player.hp > 40 && hattereneGame.player.hp <= 58)) {
        throw new Error(`Hatterene heart skill hit-based healing regression: hp=${hattereneGame.player.hp}`);
    }

    const archeopsEnemies = makeEnemies([100, 450], [0, 0]);
    const archeopsGame = makeGame(archeopsEnemies);
    const archeopsForm = rosterActiveFormForSegment({ fam: 'archen', tier: 2 });
    activeSkillModuleForForm(archeopsForm).cast(archeopsGame, segment('archen', 2),
        archeopsForm, activeSkillForForm(archeopsForm), 500, 0);
    if (!(archeopsEnemies.hp[0] < 1e6 && archeopsEnemies.hp[1] < archeopsEnemies.hp[0])) {
        throw new Error('Archeops dive lane and endpoint burst must deliver the two-stage damage');
    }
    const vivillonEnemies = makeEnemies([0, 45, 90], [0, 0, 0], [2]);
    const vivillonGame = makeGame(vivillonEnemies);
    const vivillonBursts = [];
    vivillonGame.particleBursts.burst = (...args) => vivillonBursts.push(args);
    const vivillonForm = rosterActiveFormForSegment({ fam: 'vivillon', tier: 3 });
    const vivillonSkill = activeSkillForForm(vivillonForm);
    const vivillonSegment = segment('vivillon', 3);
    activeSkillModuleForForm(vivillonForm).cast(vivillonGame, vivillonSegment, vivillonForm, vivillonSkill, 0, 0);
    if (!(vivillonEnemies.hp[0] < 1e6 && vivillonEnemies.hp[1] < 1e6 && vivillonEnemies.hp[2] < 1e6)
        || vivillonEnemies.entangled.length !== 2 || vivillonEnemies.entangled.some(([i]) => i === 2)
        || vivillonSegment.megaSkillCd !== vivillonSkill.cooldown
        || vivillonBursts.map((args) => args[4]).join(',') !== 'vivillon-powder-cloud,vivillon-wing-burst'
        || vivillonGame.events[0]?.[1]?.drowsed !== 2) {
        throw new Error('Vivillon pollen garden should damage the full area, pin ordinary wilds, and spare boss control');
    }
    const cutieflyEnemies = makeEnemies([0, 45, 90], [0, 0, 0]);
    const cutieflyGame = makeGame(cutieflyEnemies);
    const cutieflyBursts = [];
    cutieflyGame.particleBursts.burst = (...args) => cutieflyBursts.push(args);
    const cutieflyForm = rosterActiveFormForSegment({ fam: 'cutiefly', tier: 2 });
    const cutieflySkill = activeSkillForForm(cutieflyForm);
    const cutieflySegment = segment('cutiefly', 2);
    activeSkillModuleForForm(cutieflyForm).cast(cutieflyGame, cutieflySegment,
        cutieflyForm, cutieflySkill, 0, 0);
    if (!(cutieflyEnemies.hp[0] < 1e6 && cutieflyEnemies.hp[1] < 1e6 && cutieflyEnemies.hp[2] < 1e6)
        || cutieflyGame.player.hp !== 55 || cutieflySegment.megaSkillCd !== cutieflySkill.cooldown
        || cutieflyGame.events[0]?.[1]?.healed !== 15
        || cutieflyBursts.map((args) => args[4]).join(',') !== 'cutiefly-honey-pulse,cutiefly-flower-burst') {
        throw new Error('Ribombee honey spiral should damage its zone and heal up to five HP per target hit');
    }
    console.log('普通最终形态主动技能：Q/X 注册、阶段门槛、蘑菇定身/爱心回血/始祖鸟俯冲/彩粉蝶控场判定 PASS');
}
{
    const floral = new SkillSystem({ cap: 32, live: 32, overkill: 1.15 });
    let includeTarget = true;
    let hitCount = 0;
    const target = {
        x: Float32Array.from([100]), y: Float32Array.from([0]), r: Float32Array.from([8]),
        hp: Float32Array.from([1e6]), dead: new Uint8Array(1),
        grid: { query (_x, _y, _r, out) { out.length = 0; if (includeTarget) out.push(0); return out; } },
        hurt (id, damage) { hitCount++; this.hp[id] -= damage; },
    };
    const chainProbe = {
        bx: Float32Array.of(0), by: Float32Array.of(0), na: Float32Array.of(0),
        bulkOf () { return 1; },
    };
    const segment = { fam: 'sprigatito', tier: 3, count: 1 };
    if (projectileModuleForSegment(segment) !== projectileModuleForShot(1, 'sprigatito')
        || projectileModuleForSegment({ fam: 'sprigatito', tier: 2 })
        || projectileModuleForShot(0, 'sprigatito')) {
        throw new Error('Meowscarada projectile module registry routed a non-signature shot');
    }
    const gear = { cd: 0, bank: 1000 };
    floral._aim(chainProbe, target, segment, SKILLS.sprigatito, 0, gear, 1, 1);
    if (floral.n !== 8 || floral.pMode.slice(0, 8).some((mode) => mode !== 1)
        || floral.pStage.slice(0, 8).some((stage) => stage !== 1)) {
        throw new Error('Meowscarada floral volley did not launch eight outbound petals');
    }

    // Force the first petal through one target on each leg; the other seven remain in the ordinary
    // eight-petal launch asserted above and are removed from this isolated collision probe.
    floral.n = 1;
    floral.px[0] = 95;
    floral.pvx[0] = 1000;
    floral.pvy[0] = 0;
    floral.pleft[0] = 40;
    floral._fly(0.01, target);
    if (hitCount !== 1 || floral.pLegHit[0] !== 1) throw new Error(`floral outbound hit gate regression: hits=${hitCount}, leg=${floral.pLegHit[0]}, mode=${floral.pMode[0]}, pos=${floral.px[0]}, vx=${floral.pvx[0]}, left=${floral.pleft[0]}`);
    floral.pStage[0] = 2;
    floral.pLegHit[0] = 0;
    floral.px[0] = 105;
    floral.pvx[0] = -1000;
    floral.pvy[0] = 0;
    floral.pleft[0] = 40;
    floral._fly(0.01, target);
    if (hitCount !== 2 || floral.pLegHit[0] !== 1) throw new Error('floral return hit gate regression');

    const misses = new SkillSystem({ cap: 32, live: 32, overkill: 1.15 });
    const missGear = { cd: 0, bank: 1000 };
    misses._aim(chainProbe, target, segment, SKILLS.sprigatito, 0, missGear, 1, 1);
    includeTarget = false;
    for (let frame = 0; frame < 180; frame++) misses._fly(1 / 120, target);
    if (misses.n !== 0 || !misses.bursts.slice(0, misses.nBursts).some((event) => event.kind === 'flower-bloom')
        || !misses.bursts.slice(0, misses.nBursts).some((event) => event.kind === 'flower-catch')) {
        throw new Error(`floral petals did not bloom and return: n=${misses.n}, events=${misses.bursts.slice(0, misses.nBursts).map((event) => event.kind).join(',')}, stage=${misses.pStage[0]}, x=${misses.px[0]}, y=${misses.py[0]}, left=${misses.pleft[0]}`);
    }
    console.log('Meowscarada floral volley: eight petals bloom and return; same target can be hit once per leg: PASS');
}
{
    const shuriken = new SkillSystem({ cap: 16, live: 16, overkill: 1.15 });
    const targets = {
        x: Float32Array.of(80, 130, 180), y: Float32Array.of(0, 0, 0),
        r: Float32Array.of(8, 8, 8), hp: Float32Array.of(1e6, 1e6, 1e6),
        dead: new Uint8Array(3), grid: { query (_x, _y, _r, out) { out.length = 0; out.push(0, 1, 2); return out; } },
        hurt (id, damage) { this.hp[id] -= damage; },
    };
    const chainProbe = {
        bx: Float32Array.of(0), by: Float32Array.of(0), na: Float32Array.of(0),
        bulkOf () { return 1; },
    };
    const segment = { fam: 'froakie', tier: 3, count: 1 };
    if (projectileModuleForSegment(segment) !== projectileModuleForShot(1, 'froakie')
        || projectileModuleForSegment({ fam: 'froakie', tier: 2 })
        || projectileModuleForShot(0, 'froakie')) {
        throw new Error('Greninja water-shuriken module must route only final-stage signature shots');
    }
    const gear = { cd: 0, bank: 1000 };
    shuriken._aim(chainProbe, targets, segment, SKILLS.froakie, 0, gear, 1, 1);
    if (shuriken.n !== 1 || shuriken.pMode[0] !== 1 || shuriken.pdmg[0] <= 0) {
        throw new Error('Greninja must launch one budget-priced signature water shuriken');
    }
    shuriken.px[0] = 60;
    shuriken.pvx[0] = 1000;
    shuriken.pvy[0] = 0;
    shuriken.pleft[0] = 400;
    for (let i = 0; i < 3; i++) shuriken._fly(0.04, targets);
    if (shuriken.n !== 0 || !targets.hp.every((hp) => hp < 1e6)
        || !shuriken.bursts.slice(0, shuriken.nBursts).some((event) => event.kind === 'shuriken-splash')) {
        throw new Error(`Greninja shuriken failed to pierce three targets: live=${shuriken.n}, hp=${targets.hp}`);
    }
    const draws = [];
    projectileModuleForShot(1, 'froakie').draw({ draw: (...args) => draws.push(args) },
        { get: (color, alpha) => ({ color, alpha }) },
        { x: 0, y: 0, size: 1, wall: 0.5, shotAngle: 0 });
    const splash = GRENINJA_PARTICLE_PRESETS['shuriken-splash'];
    if (draws.length !== 0 || !splash || splash.totalParticles !== 48
        || splash.glyph !== 'shard' || splash.particleClass !== 'shuriken') {
        throw new Error('Greninja should use its native shard projectile and impact particles only');
    }
    console.log('Greninja Water Shuriken: one rotating blade, three-target piercing, dedicated Cocos particle impact: PASS');
}

// 弹幕溅射：普通弹命中时，以弹体半径为界对范围内的敌人结算同额伤害——
// 「尺寸够大也可以打一片」的核心规则。远处的怪必须分毫未损。
{
    const splashSys = new SkillSystem({ cap: 16, live: 16, overkill: 1.15 });
    const mk = () => ({
        x: Float32Array.of(80, 95, 60, 300), y: Float32Array.of(0, 26, -26, 0),
        r: Float32Array.of(8, 8, 8, 8), hp: new Float64Array([1e6, 1e6, 1e6, 1e6]),
        dead: new Uint8Array(4), flash: new Float32Array(4),
        grid: { query (_x, _y, _r, out) { out.length = 0; out.push(0, 1, 2, 3); return out; } },
        hurt (id, damage) { this.hp[id] -= damage; },
    });
    const fireBullet = (sys, targets, pr) => {
        sys.n = 1;
        sys.pr[0] = pr;
        sys.pdmg[0] = 500;
        sys.px[0] = 40;
        sys.pvx[0] = 1000;
        sys.pvy[0] = 0;
        sys.pleft[0] = 100;
        sys.pavoid[0] = -1;
        sys.pavoid2[0] = -1;
        sys.pbounce[0] = 0;
        for (let i = 0; i < 4 && sys.n > 0; i++) sys._fly(0.04, targets);
    };
    const targets = mk();
    splashSys.splashMul = 5;
    fireBullet(splashSys, targets, 12);
    if (targets.hp[3] !== 1e6 || targets.hp[0] > 1e6 - 300
        || targets.hp[1] > 1e6 - 300 || targets.hp[2] > 1e6 - 300) {
        throw new Error(`projectile splash regression: hp=${targets.hp}`);
    }
    // 对照组：溅射关闭时只有直击目标掉血。
    const ctrl = mk();
    splashSys.splashMul = 0;
    fireBullet(splashSys, ctrl, 12);
    if (ctrl.hp[0] >= 1e6 - 300 || ctrl.hp[1] !== 1e6 || ctrl.hp[2] !== 1e6) {
        throw new Error('splash-off control arm regression');
    }
    // 黑带：溅射半径 ×1.15 每级。
    const bb = new Build();
    if (bb.splashR !== 1) throw new Error('splashR must default to 1');
    const belt = LEVELS.find((entry) => entry.id === 'blackBelt');
    belt.apply(bb);
    belt.apply(bb);
    if (Math.abs(bb.splashR - 1.3225) > 1e-9) throw new Error('blackBelt splash radius compounding regression');
    console.log('弹幕溅射：命中点弹体半径内全体受击 · 远处免伤 · 黑带放大溅射半径 PASS');
}

// 王者之证的击杀记账挂点：野生击杀按 fam 上报、训练家/BOSS 豁免、默认休眠。
// 计数满 10 → 发放的策略在 game.js（依赖队伍状态），这里验证上报管道本身。
{
    const horde = new EnemySystem(ENEMY, makeRng(11));
    const kills = [];
    horde.onKill = (famIdx, trainer, boss) => kills.push([famIdx, trainer, boss]);
    const wild = horde.spawn(0, 0, 3, 1, false, 0);
    horde.hurt(wild, 1e6);
    const trainerMob = horde.spawn(0, 0, 3, 1, false, 0);
    horde.trainer[trainerMob] = 1;
    horde.hurt(trainerMob, 1e6);
    // 喂管上报全部死亡并携带旗标，豁免过滤由 game.js 的回填策略完成。
    if (kills.length !== 2 || JSON.stringify(kills[0]) !== '[3,false,false]'
        || JSON.stringify(kills[1]) !== '[3,true,false]') {
        throw new Error('kings-rock kill feed regression: flags must reach the grant policy');
    }
    const charm = LEVELS.find((entry) => entry.id === 'kingsRock');
    if (!charm || charm.rarity !== 'legendary' || charm.max !== 1) {
        throw new Error('kings rock upgrade card regression');
    }
    console.log('王者之证：野生击杀按 fam 上报 · 训练家豁免 · 传说卡注册 PASS');
}

// 击杀飞轮：击杀给伤害银行充能速率 +8%，封顶 ×2.5，无击杀按 0.8/s 回落 ×1。
// 潮汐 hp 自缩放同时放缓（1.07/分钟、^0.7），升级的清场收益才能被玩家拿到。
{
    const wheel = new SkillSystem({ cap: 8, live: 8, overkill: 1.15 });
    if (wheel.killBoost !== 1) throw new Error('kill flywheel must ship at ×1');
    for (let i = 0; i < 40; i++) wheel.killFeedback();
    if (wheel.killBoost < 2 || wheel.killBoost > 2.5) {
        throw new Error(`kill flywheel cap regression: ${wheel.killBoost}`);
    }
    for (let i = 0; i < 12; i++) wheel.step(1, { segments: [], nCount: 0 }, { n: 0 }, 1, 100);
    if (wheel.killBoost > 1.001) throw new Error('kill flywheel must decay back to ×1 without kills');
    if (ENEMY.hpGrowth >= 1.1 || ENEMY.hpScaleExp >= 0.75) {
        throw new Error('horde pressure curve must stay below the pre-flywheel linear wall');
    }
    console.log(`击杀飞轮：+8%/杀封顶 ×2.5 · 无击杀回落 ×1 · 潮汐 hpGrowth ${ENEMY.hpGrowth}/分 hpScaleExp ${ENEMY.hpScaleExp} PASS`);
}
const player = new Player(PLAYER, PLAYER_HP);
let rng;

// The same Build the runtime's panel writes into, so a card cannot be balanced in one place and
// played in another. `ctx` mirrors game.js's two-cardinal fields.
const build = new Build();
const ctx = { chain, player };
combat.mods = build;
// The two furnace wallets, so 融核 is measured as 收入 - 支出 like §9.6-⑤-2 read it, not as a count of
// one of the two halves.
const s = { time: 0, exp: 0, level: 1, pending: 0, repeat: 0, head: 0, cores: 0, spent: 0 };
const st = {};

function reset () {
    s.time = 0;
    s.exp = 0;
    s.level = 1;
    s.pending = 0;
    s.repeat = 0;
    s.head = 0;
    s.cores = 0;
    s.spent = 0;
    rng = makeRng(SEED + 2);
    // Rewind the horde. `clear()` empties the pool but leaves `rng` where the last bot's death left it,
    // so bots 2-6 of every table below were played against a wave nobody else saw; `怪流` is the column
    // that proves this line runs.
    enemies.rng = makeRng(SEED);
    horde.seq.length = 0;
    build.reset();
    chain.reset(0, 0);
    chain.add(FAMILIES[0].id, 1, 1);
    enemies.clear();
    capture.reset();
    skills.reset();
    player.reset();
}

/**
 * A level in the headless run cannot pause anything, so it queues and is spent the same frame. The
 * card itself still comes from the runtime's own pool and roll - `pref` only says which of the three
 * the bot would reach for, which is the thing being measured.
 */
function gainExp (n, pol) {
    s.exp += n * build.expMul;
    while (s.exp >= EXP(s.level)) {
        s.exp -= EXP(s.level);
        s.level++;
        s.pending++;
        if (!player.dead) player.hp = Math.min(player.maxhp, player.hp + player.maxhp * PLAYER.levelHeal);
        const opts = roll(build, ctx, rng);
        if (opts.length === 0) {
            // §4's pool is finite, so this line is reachable. It is the second half of §9.6-⑤-2's
            // complaint wearing another currency: the level still arrives, and from here on it buys nothing.
            if (!st.dryLv) { st.dryAt = s.time; st.dryLv = s.level; }
            s.pending = 0;
            break;
        }
        const want = (pol.pref || []).map((id) => opts.find((e) => e.id === id)).find(Boolean);
        const pick = want || opts[0];
        take(pick, build, ctx);
        st.picks.push(pick.id);
        player.speedMul = build.speedMul;
        s.pending--;
    }
}

/**
 * The policy matrix. Movement is the same for every catching bot on purpose: the ball replaced the
 * walk-to-the-soul leg, so the only variable left between `greedy` and `merge` is what the crosshair
 * is pointed at - which is exactly the decision §6.5-3 says the verb has to leave with the player.
 * `run` and `kite` are controls: they prove that surviving without throwing is possible but stagnant.
 */
const BOTS = {
    idle: { move: 'idle' },
    run: { move: 'wander' },
    kite: { move: 'flee' },
    // The honest novice: nearest thing, no lead, no idea that an elite shrugs a ball off.
    greedy: { move: 'flee', throw: true, pref: ['repeat', 'cap', 'dmg', 'skillSize', 'hp', 'speed'] },
    // The builder: aims for a link that folds, leads the target, and spends a full chain on 融核.
    merge: { move: 'flee', throw: true, fold: true, lead: true, pref: ['cap', 'dmg', 'skillSize', 'repeat', 'hp', 'speed'] },
    // §7.1-4's arm: the same builder, and every legal 段内进化 taken the instant it becomes legal. That is
    // the upper bound on the rule's strength rather than a play pattern - a player folds when they want
    // one, and a row that dies with the rule switched on is the finding, not the bot being dumb.
    evo: { move: 'flee', throw: true, fold: true, lead: true, evolve: true, pref: ['cap', 'dmg', 'skillSize', 'repeat', 'hp', 'speed'] },
    // v0.9.2's shipping rule, and deliberately not an upper bound like `evo`: the same builder, taking one
    // `chain.findAuto` fold per turn - the exact function `game.step` calls. So this row is what the default
    // does to a run, while `evo` stays what the rule *could* do if nothing were forbidden.
    auto: { move: 'flee', throw: true, fold: true, lead: true, auto: true, pref: ['cap', 'dmg', 'skillSize', 'repeat', 'hp', 'speed'] },
};

function folds (famIdx, tier) {
    const fam = FAMILIES[famIdx].id;
    for (const seg of chain.segments) if (seg.fam === fam && seg.tier === tier) return true;
    return false;
}

/**
 * The animal a throw should go to. `greedy` takes the nearest live body; `merge` takes the nearest one
 * that folds into a live stack, and refuses to spend a ball on an elite it has not knocked 虚弱 - a
 * bounced throw is a whole cooldown, so that refusal is the same kind of skill as leading a target.
 */
function pickTarget (pol) {
    let best = -1;
    let bd = Infinity;
    let alt = -1;
    let ad = Infinity;
    for (let i = 0; i < enemies.n; i++) {
        if (enemies.dead[i]) continue;
        const dx = enemies.x[i] - player.x;
        const dy = enemies.y[i] - player.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > build.range + enemies.r[i]) continue;
        if (d < ad) { ad = d; alt = i; }
        const elite = enemies.elite[i] === 1;
        if (pol.fold) {
            if (!folds(enemies.fam[i], elite ? 2 : enemies.tier[i])) continue;
        }
        if (d < bd) { bd = d; best = i; }
    }
    if (pol.fold) return best >= 0 ? best : alt;
    return alt;
}

/** Two fixed-point passes of "where will it be when the ball gets there". */
function aimAt (i, lead) {
    let tx = enemies.x[i];
    let ty = enemies.y[i];
    const sp = build.ballSpeed;
    if (lead) {
        for (let k = 0; k < 2; k++) {
            const d = Math.hypot(tx - player.x, ty - player.y);
            const t = Math.max(0, (d - MUZZLE) / sp);
            tx = enemies.x[i] + enemies.vx[i] * t;
            ty = enemies.y[i] + enemies.vy[i] * t;
        }
    }
    let dx = tx - player.x;
    let dy = ty - player.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    return { x: player.x + dx * MUZZLE, y: player.y + dy * MUZZLE, dx, dy };
}

/**
 * The 熔炉 played by a bot, which is the actual M1-a question: §9.6-⑤-2 counted 1,573 融核 earned against
 * zero spent, and a sink nobody reaches is not a sink. Two rules the panel obeys too - never sell a link
 * inside the 三连, never sell a 3 阶 (it is tomorrow's 三连) - and one the human does not need: hold off
 * while the 基因 is missing, because 放生 cannot buy one and stripping the chain for it is pure loss.
 * The real panel stops the clock while it is open; this one spends between waves with time running, which
 * is the single fidelity the headless run gives up.
 */
/** Away from the local mass - the only reason the hero is allowed to be twice as fast as the horde. */
function fleeVec () {
    let fx = 0;
    let fy = 0;
    for (let i = 0; i < enemies.n; i++) {
        const dx = player.x - enemies.x[i];
        const dy = player.y - enemies.y[i];
        const d2 = dx * dx + dy * dy;
        if (d2 > 320 * 320 || d2 < 1) continue;
        const inv = 1 / d2;
        fx += dx * inv;
        fy += dy * inv;
    }
    const l = Math.sqrt(fx * fx + fy * fy);
    if (l < 1e-6) {
        if (rng.chance(0.02)) s.head = rng.next() * TAU;
        return { x: Math.cos(s.head), y: Math.sin(s.head) };
    }
    return { x: fx / l, y: fy / l };
}

function step (dt, pol) {
    s.time += dt;
    const minute = s.time / 60;

    if (pol.move === 'idle') {
        player.update(dt, { x: 0, y: 0 });
    } else if (pol.move === 'flee') {
        player.update(dt, fleeVec());
    } else {
        if (rng.chance(0.02)) s.head = rng.next() * TAU;
        player.update(dt, { x: Math.cos(s.head), y: Math.sin(s.head) });
    }
    chain.update(dt, player.x, player.y, Math.min(1, player.speed / player.maxSpeed));

    enemies.threatDps = chainDps(chain) * build.dmg;
    // §5's 波次表, called rather than copied. The copy used to differ from the runtime in one live way:
    // it had no pre-3:00 tier-2 mobs, so every balance number below was measured against a horde easier
    // than the one the build actually sends. `famRoll` is the `FORCED` probe hook.
    if (enemies.direct(dt, minute, chain.petTotal, player.x, player.y, RING, famRoll) === 'boss') {
        st.bossAt = s.time;
        st.bossSpawn++;
        // The boss's HP and the `dps` that minted it, sampled on the same frame. `threat()` is
        // `threatDps/cap × clearSec`, so `hp/dps` must come out the same for a 14-段 chain and a 26-段 one
        // - which is the §5.4 self-reference made readable, and it is only a claim if it is printed.
        st.bossHp.push([enemies.maxhp[enemies.n - 1], enemies.threatDps]);
    }
    enemies.update(dt, player.x, player.y, RING);
    skills.step(dt, chain, enemies, build.dmg, player.maxSpeed, build.skillSize);
    // A death is EXP, and so is a catch: `enemies.capture` puts the ball's victim on the same counter,
    // so the level curve does not quietly tax the one verb that builds the chain.
    if (enemies.kn > 0) gainExp(enemies.kn, pol);
    enemies.kn = 0;
    // game.js's `drainBoss`, mirrored: the 兽王基因 is the only thing in the game that makes the 熔炉's
    // price reachable, so a sim that never pays it cannot measure the sink it is supposed to balance.
    if (enemies.bossDown) {
        enemies.bossDown = 0;
        s.cores += BOSS.cores;
        st.cores += BOSS.cores;
        st.bossKills++;
        st.bossTtl.push(st.bossAt > 0 ? +(s.time - st.bossAt).toFixed(1) : 0);
    }

    const touch = combat.contact(enemies, player.x, player.y);
    player.hurt(touch.hits > 0 ? combat.bite(minute, touch.elite, touch.boss) : 0);
    if (player.dead && build.sashReady) {
        build.sashReady = false;
        player.dead = false;
        player.hp = Math.max(1, Math.ceil(player.maxhp * 0.35));
        player.invuln = 2;
    }
    if (!player.dead && build.regen > 0) player.hp = Math.min(player.maxhp, player.hp + player.maxhp * build.regen * dt);
    if (touch.hits > 0 && touch.boss) st.bossBites++;

    const last = chain.nCount - 1;
    const tx = last >= 0 ? chain.nx[last] : player.x;
    const ty = last >= 0 ? chain.ny[last] : player.y;
    capture.update(dt, enemies, tx, ty);
    if (enemies.dirty) enemies.cull();

    for (const rec of capture.landed) {
        const fam = FAMILIES[rec & 0xff].id;
        const tier = (rec >> 8) & 0xff;
        let res = chain.absorb(fam, tier);
        if (res === 'overflow') {
            st.overflow++;
            // 链位已满 → 1 融核 + 2 EXP, at game.js's exact rate: a furnace whose income the sim reads
            // short is a furnace that looks unaffordable for the wrong reason.
            s.cores += 1;
            st.cores += 1;
            gainExp(2, pol);
        } else if ((rec >> 16) & 0xff) {
            // 金词条 (an elite catch) pays the same 1 融核 in both halves of the game.
            s.cores += 1;
            st.cores += 1;
        }
    }
    capture.landed.length = 0;
    st.missed += capture.whiffed;
    capture.whiffed = 0;

    if (pol.evolve) {
        // §7.1-4 taken to its upper bound: fold the frontmost ready stack, re-read, repeat. `findEvolve`
        // re-runs after each fold, so one fat stack runs 1→2→3 inside a single frame exactly the way a
        // chained 晋升 does, and the guard is only there because the ceiling rule is what stops it.
        // v0.9: the gate is the species' own, so the bot has to carry its purse (`have`) through it and
        // pay what it charges - a 石头 step the sim got for free would be a price nobody balanced.
        for (let guard = 0; guard < chain.cap * 2; guard++) {
            const have = { cores: s.cores };
            const i = chain.findEvolve(have);
            if (i < 0) break;
            st.evoFam.push(`${chain.segments[i].fam}:${chain.segments[i].tier}`);
            const r = chain.evolve(i, have);
            if (!r) break;
            s.cores -= r.spent;
            s.spent += r.spent;
            st.evolved++;
        }
    }
    if (pol.auto) {
        // v0.9.2's shipping rule, called the same way the field calls it: one `findAuto` fold per turn, no
        // cascade. `findAuto` is the restriction sitting on top of `evolveGate` — 不花融核, and the pile must
        // already stand on all 3 节圆 and still stand on 3 after the division (§9.15-①). So this row and the
        // `evo` row differ by exactly the things auto is forbidden to touch - which is the whole question
        // "what does the default do to a run" asked of the default itself.
        const have = { cores: s.cores };
        const i = chain.findAuto(have);
        if (i >= 0) {
            // Which of the two roads folded this one, counted at the fold rather than inferred from the
            // 进化 total: "④ 到底出不出手" is a count question, and the delta of two 进化 columns is a
            // rate that hides the case where the gate and the clock fire on the same pile.
            const seg = chain.segments[i];
            const g = evolveGate(seg, have);
            const byGate = chain.autoNodesAt(seg.count) === CHAIN.nodesMax
                && chain.autoNodesAt(chain.foldAfter(seg.count, g.q)) === CHAIN.nodesMax;
            st[byGate ? 'gateFolds' : 'coldFolds']++;
            if (!byGate) st.coldSizes.push(seg.count);
            st.evoFam.push(`${chain.segments[i].fam}:${chain.segments[i].tier}`);
            const r = chain.evolve(i, have);
            if (r) {
                s.cores -= r.spent;
                s.spent += r.spent;
                st.evolved++;
            }
        }
    }
    if (GEO && s.time >= st.geoAt) {
        st.geoAt += 10;
        const circ = GEO_CIRC;
        circ.length = 0;
        let area = 0, clamp = 0;
        for (let i = 0; i < chain.nCount; i++) {
            const seg = chain.segments[chain.segIndex[i]];
            const r = chain.radiusOf(seg, seg.tier) * build.splashR * (seg.orb || 1);
            if (r >= VIEW.fieldMaxR) clamp++;
            circ.push(chain.nx[i], chain.ny[i], r);
            area += Math.PI * r * r;
        }
        const reach = PLAYER.radius + ENEMY.radius;
        let alive = 0, swept = 0, touching = 0, hpSum = 0;
        for (let i = 0; i < enemies.n; i++) {
            if (enemies.dead[i]) continue;
            alive++;
            hpSum += enemies.maxhp[i];
            const ex = enemies.x[i], ey = enemies.y[i], er = enemies.r[i];
            const hx = ex - player.x, hy = ey - player.y, hr = reach + er;
            if (hx * hx + hy * hy <= hr * hr) touching++;
            for (let k = 0; k < circ.length; k += 3) {
                const dx = ex - circ[k], dy = ey - circ[k + 1], rr = circ[k + 2] + er;
                if (dx * dx + dy * dy <= rr * rr) { swept++; break; }
            }
        }
        const pct = (n) => String(alive ? Math.round(n / alive * 100) : 0).padStart(2);
        const nominal = chainDps(chain) * build.dmg;
        const duty = nominal ? Math.round((enemies.dealt - st.dealtAt) / 10 / nominal * 100) : 0;
        st.dealtAt = enemies.dealt;
        st.geo.push(`+${String(Math.round(s.time)).padStart(4, ' ')}s 圈${String(chain.nCount).padStart(2)}`
            + ` 地${(area / PPM / PPM).toFixed(0)}m² 尾${(chain.nCount * chain.spacing / PPM).toFixed(0)}m`
            + ` 在扫${pct(swept)}% 咬身${pct(touching)}%`
            + ` 封顶${clamp}`
            + ` 实付${String(duty).padStart(3)}% 怪血${Math.round(alive ? hpSum / alive : 0)}`
            + ` 掉血${((st.hpPrev - player.hp) / 10).toFixed(1)}/s`
            + ` hp${Math.round(player.hp)} 只${chain.petTotal} dps${Math.round(nominal)}`);
        st.hpPrev = player.hp;
    }
    // §5.4 legality check, sampled every 30 s: field HP against chain DPS, and how many bodies are
    // actually on screen. Under ~2 s the horde is scenery; over ~12 s the run is a wall.
    if (s.time >= st.at) {
        st.at += 30;
        let hp = 0;
        for (let i = 0; i < enemies.n; i++) hp += enemies.hp[i];
        // `厚` is the thickest single same-family-same-tier pile, i.e. the number `findAuto` compares against
        // 24·q. It is in this row because "自动怎么还没来" is answered by this column and nothing else.
        let thick = 0;
        for (const sg of chain.segments) if (sg.count > thick) thick = sg.count;
        // v0.9.8's own isolation probe, and it is a *count* question rather than a code-reading question:
        // `topBulk` is dead config in this economy if no 满线 link ever gets fat, and "the rule never fired"
        // is the mistake §9.15-③ made about the eager arm. A link is merged when its body is bigger than
        // the seats it owns (1 seat at the top of a line), and `胖度` is in 节圆当量. Sampled with the rest
        // of the row, so a pile that merged and was then 放生 between samples is not counted.
        let merged = 0;
        for (const sg of chain.segments) {
            const b = chain.bulkOf(sg);
            if (b > chain.visualOf(sg)) { merged++; if (b > st.topPeak) st.topPeak = b; }
        }
        if (merged > st.topLinks) st.topLinks = merged;
        const dps = chainDps(chain) * build.dmg;
        const m = Math.floor(s.time / 60);
        const sec = String(Math.round(s.time - m * 60)).padStart(2, '0');
        const th = capture.thrown;
        st.curve.push(`${m}:${sec} 清${dps ? (hp / dps).toFixed(1) : '∞'}s 场${enemies.n} dps${Math.round(dps)}`
            + ` 段${chain.segments.length}/${chain.cap} 厚${thick} 进${st.evolved} 球${st.thrownAt ? th - st.thrownAt : th} 中${th ? Math.round(capture.taken / th * 100) : 0}%`);
        st.thrownAt = th;
    }

    s.repeat -= dt;
    if (pol.throw && s.repeat <= 0 && (!THROW_PM || s.time - st.lastThrow >= 60 / THROW_PM)) {
        const i = pickTarget(pol);
        if (i >= 0) {
            const o = aimAt(i, !!pol.lead);
            if (capture.throw(o.x, o.y, o.dx, o.dy,
                { range: build.range, speed: build.ballSpeed, r: build.ballR })) {
                s.repeat = build.repeat;
                st.lastThrow = s.time;
            }
        }
    }
}

const tally = (list) => {
    const m = Object.create(null);
    for (const k of list) m[k] = (m[k] || 0) + 1;
    return Object.keys(m).map((k) => `${k}:${m[k]}`).join(' ');
};

function run (name) {
    const pol = BOTS[name];
    reset();
    for (const k of Object.keys(st)) delete st[k];
    st.missed = 0;
    st.overflow = 0;
    st.cores = 0;
    st.picks = [];
    st.at = 1;
    st.curve = [];
    st.geo = [];
    st.geoAt = 10;
    st.hpPrev = player.hp;
    st.dealtAt = enemies.dealt;
    st.thrownAt = 0;
    st.lastThrow = 0;
    st.bossAt = 0;
    st.bossSpawn = 0;
    st.bossKills = 0;
    st.bossBites = 0;
    st.bossTtl = [];
    st.bossHp = [];
    st.forged = 0;
    st.released = 0;
    st.evolved = 0;
    st.evoFam = [];
    st.gateFolds = 0;
    st.coldFolds = 0;
    st.coldSizes = [];
    st.topPeak = 0;
    st.topLinks = 0;
    st.dryAt = 0;
    st.dryLv = 0;
    let peakNodes = 0;
    let peakField = 0;
    let peakBalls = 0;
    let peakPending = 0;
    let peakShots = 0;
    // `FORCED` is a claim that only these families can ever be on the chain. §9.8-①'s lesson is that a
    // probe which does not check its own isolation reports its contamination as gameplay, so the claim
    // is verified frame by frame and printed as `漏族` rather than assumed.
    let offForced = '';
    let fieldSum = 0;
    let frames = 0;
    const t0 = performance.now();
    while (s.time < MIN * 60 && !player.dead) {
        step(1 / 60, pol);
        if (FORCED.length) {
            for (const g of chain.segments) {
                if (FORCED.indexOf(g.fam) < 0 && g.fam !== FAMILIES[0].id && offForced.indexOf(g.fam) < 0) {
                    offForced += (offForced ? ',' : '') + g.fam;
                }
            }
        }
        peakNodes = Math.max(peakNodes, chain.nCount);
        peakField = Math.max(peakField, enemies.n + chain.nCount + capture.n + capture.bn);
        peakBalls = Math.max(peakBalls, capture.bn);
        peakPending = Math.max(peakPending, capture.n);
        peakShots = Math.max(peakShots, skills.n);
        fieldSum += enemies.n;
        frames++;
    }
    const th = capture.thrown;
    const m = skills.m;
    // Little's law, measured: mean field over the rate bodies actually leave. §5.4's promise is about
    // this number, not about the `hp/dps` proxy the curve prints - the proxy cannot see a missed shot.
    const out = (enemies.kills + enemies.captured) / Math.max(1 / 60, s.time);
    const row = {
        bot: name,
        ended: player.dead ? `死了@${s.time.toFixed(0)}s` : `${MIN}min`,
        lv: s.level,
        segs: chain.segments.length,
        cap: chain.cap,
        t2: chain.segments.filter(x => x.tier >= 2).length,
        pets: chain.petTotal,
        nodes: chain.nCount + '↑' + peakNodes,
        // `未合体` = no 满线 link ever got fatter than the body it walks on, i.e. v0.9.8's merge paid for
        // nothing in this economy. `6当量×2体` = the fattest merged body seen, and how many were merged.
        满线合体: st.topPeak > 1 ? `${st.topPeak}当量×${st.topLinks}体` : '未合体',
        dps: Math.round(chainDps(chain) * build.dmg),
        实测清场: +((fieldSum / Math.max(1, frames)) / Math.max(0.01, out)).toFixed(2),
        kills: enemies.kills,
        kPM: Math.round(enemies.kills / Math.max(1 / 60, s.time / 60)),
        投球: th,
        命中: capture.taken,
        '命中%': th ? Math.round(capture.taken / th * 100) : 0,
        '空球%': th ? Math.round(st.missed / th * 100) : 0,
        弹开: capture.bounced,
        '收服/min': +(capture.taken / Math.max(1 / 60, s.time / 60)).toFixed(1),
        溢出: st.overflow,
        进化: st.evolved,
        // Which lines actually got to evolve, at which 阶 - the count column alone cannot tell "the 石头
        // price bound" from "nobody caught that species". 皮丘 only appears here if it sat on the chain
        // for its 30 s, which is the 亲密度 gate being measured instead of asserted.
        进化族: tally(st.evoFam) || '-',
        // §9.6-⑤-2's line, now a column instead of a footnote: 融核 in, 融核 out, and what is left in the
        // purse. `花 0` alongside a nonzero 得 is the failure this whole milestone exists to close.
        核: `${st.cores}得/${s.spent}花/${s.cores}留`,
        放生: st.released,
        // The other side of "does the currency bind". After 卡池取满 the level-up still arrives and buys
        // nothing, so this is the minute mark where EXP turns into the same decorative number 融核 was at
        // §9.6-⑤-2 - and `未枯` means the bot died before it found the ceiling.
        卡枯: st.dryLv ? `${Math.floor(st.dryAt / 60)}:${String(Math.round(st.dryAt % 60)).padStart(2, '0')} lv${st.dryLv}` : '未枯',
        BOSS: `${st.bossKills}/${st.bossSpawn}只 ${st.bossTtl.length ? st.bossTtl.join('/') + 's' : '未死'}`
            + ` 咬${st.bossBites}`,
        // HP ÷ the DPS that minted it = the fight's length at 100% tail duty. §5.4 prices mob HP off the
        // player's own chain, so this is a constant (`200 × clearSec / cap`) whatever the build is; the
        // measured 秒 above divided into it is the duty cycle the fight really got.
        'BOSS秒/满占空': st.bossHp.map(([h, d]) => `${Math.round(h)}血 ${Math.round(d)}dps = ${(h / d).toFixed(2)}s`).join(' · ') || '-',
        '主技中%': m.spent > 0 ? Math.round(m.landed / m.spent * 100) : 0,
        '主技空%': m.spent > 0 ? Math.round(m.lost / m.spent * 100) : 0,
        '过量%': m.landed > 0 ? Math.round(m.wasted / m.landed * 100) : 0,
        弹: `${skills.n}↑${peakShots}`,
        漏族: offForced || '-',
        齐: m.volleys,
        // Ready and funded but nothing standing in it: the count that separates "the form never got a
        // turn" from "the form kept whiffing at an already-cleared ring".
        干: m.dry,
        '在途/峰': `${capture.n}/${peakPending}`,
        '球/峰': `${capture.bn}/${peakBalls}`,
        hp: Math.round(player.hp),
        peakField,
        怪流: horde.seq.join(' '),
        picks: tally(st.picks),
        msPerFrame: +(performance.now() - t0).toFixed(0) / (s.time * 60),
    };
    row.curve = st.curve;
    row.geo = st.geo;
    // v0.9.7's ④ readout, kept *off* the table on purpose: the column count is the contract the per-seed
    // byte-comparisons of §9.17-⑥ are written against. `curve` is excluded the same way.
    row.road = { gate: st.gateFolds, cold: st.coldFolds, sizes: st.coldSizes.slice() };
    return row;
}

console.log(`\n=== ${MIN} min · seed ${SEED} · 主技 ${SKILL ? '开' : '关'} · uncapped horde · 基准投程${(BALL.rangeBase / PPM).toFixed(0)}m · ${Object.keys(BOTS).length} policies ===`);
// The rungs this world can actually hand out, walked off the roster instead of typed in. `v0.9.6` wrote
// `[2, 3, 4]` here as if a price ladder were part of the geometry; `CHAIN.evolveFlat` (v0.9.9) proved the
// assumption expensive in the only way a header can be wrong: it printed 16-只 and 32-只 auto gates that no
// step in the game costs, so the line looked like two rungs of headroom above every pile. A header printed
// from the same `stepOf` the gates read cannot do that again.
const PRICE_Q = (() => {
    const s = new Set();
    for (const f of ROSTER_IDS) for (let t = 1; t < evoCeil(f); t++) { const st = stepOf(f, t); if (st) s.add(st.q); }
    return [...s].sort((a, b) => a - b);
})();
// Every table below is a statement about one geometry. Since v0.9.6 that geometry has *two* densities:
// `nodeEvery` is the picture and the damage radius, `autoEvery` is only the auto gate (threshold =
// `autoEvery·(nodesMax−1)·q`). A table is comparable to another table that prints the same pair here,
// and this line is the only place both get read for the header — a rung change must show up here first.
console.log(`节圆: 屏 1 个/${CHAIN.nodeEvery} 只 · 最多 ${CHAIN.nodesMax} 个（满线合体 1 体，胖至 ${CHAIN.topBulk} 个当量）· 门 1 个/${CHAIN.autoEvery} 只 → 自动门 ${PRICE_Q.map(q => `${q}合1=${chain.autoThresholdAt(q)}`).join(' · ')} 只${PRICE_Q.length === 1 ? '（全 roster 只有这一档价）' : ''}`
    // The second road is a clock, not a 只数, so it prints as one: 图鉴价档 folds a pile at its own 图鉴价
    // once it has stood unfed this long and the fold costs no drawn 节圆 (§9.18). `放手 0 s` = no wait at all,
    // i.e. 「只要 3 只就自动进化」, which is what v0.9.8 ships.
    + ` · 图鉴价档 ${Number.isFinite(CHAIN.autoCold) ? `放手 ${CHAIN.autoCold} s 就按图鉴价折（${PRICE_Q.map(q => `${q}合1=${q}只`).join(' · ')}）` : '关（只走门）'}`
    // The economy the table was played in, printed for the same reason the densities are: a 只数 threshold
    // means nothing without the 只/s that feeds it. And the fold's *shape*, because two tables whose shapes
    // differ are not two rungs of one dial — one spends 1−1/q of the pile per 阶, the other spends q−1 只.
    + ` · 折叠 ${FOLD_TEXT[CHAIN.evolveKeeps] || `未知档 ⚠ ${CHAIN.evolveKeeps}`}`
    // Which law sizes the 甩尾 discs, because a table is only comparable to a table with the same one: `0`
    // is v0.9.8's (体型 × 阶, √k at 满线), a positive number is §9.22's exponent — the disc radius is
    // `一节圆 × (段每节圆的 dps)^p`, so `0.5` means "area ∝ damage" and no fold can cost ground.
    + ` · 清扫 ${CHAIN.sweepArea ? `半径=一节圆×(dps/节圆)^${CHAIN.sweepArea}，封顶 ${VIEW.fieldMaxR}px` : '半径=体型×阶（满线 √k）'}`
    + ` · 手速 ${THROW_PM ? `限 ${THROW_PM} 球/min` : '不限（bot 自己的冷却）'}`);
const rows = Object.keys(BOTS).map(run);
console.table(rows.map(({ curve, geo, road, ...r }) => r));
// The health check for the table above, printed instead of assumed: every policy on the same string is
// what "one wave, played every way" actually means. A mismatch invalidates every other column.
const flow = new Set(rows.map((r) => r.怪流));
console.log(`怪流 ${flow.size === 1 ? `${rows.length} 行一致 · 每行都是同一手牌` : `${rows.length} 行不一致 ⚠ 怪流没有回卷`}: ${rows[0].怪流}`
    + (flow.size === 1 ? '' : ' | ' + rows.map((r) => `${r.bot}=${r.怪流}`).join(' | ')));
console.log('清场时间 秒/场上数量 —— 低于 ~2s 说明怪海已经是布景，不是压力。球N = 这 30s 内投了几球，中% = 到该时刻的累计命中率:');
for (const r of rows) console.log(`  ${r.bot.padEnd(7)} ${r.curve.join('  ')}`);

// GEO=1: the circles themselves. `地` is the *sum* of the discs' areas (overlaps counted twice), `尾` is
// nCount × spacing — the length of the corridor they sit in, which is the part a merged body does not get
// back from √k. `在扫%` is the share of the live horde standing inside at least one disc *this frame*, and
// `咬身%` the share on the hero's body, i.e. the ones actually billing HP.
if (GEO) {
    console.log('GEO 每 10s 的判决几何（圈数/地皮/尾长/被扫占比/贴身占比/掉血）:');
    for (const r of rows) for (const g of r.geo) console.log(`  ${r.bot.padEnd(7)} ${g}`);
}

// The one column `进化` cannot answer: not "how many folds" but "which rule made them". `cold = 0` on a
// rung with a finite clock means ④ never fired and the whole road is dead code in this economy.
if (CHAIN.autoEvolve) {
    console.log('自动折走的是哪条路（①② 门 / ④ 图鉴价）:');
    for (const r of rows) {
        const d = r.road;
        if (!d || (d.gate === 0 && d.cold === 0)) continue;
        const sz = d.sizes.sort((a, b) => a - b);
        console.log(`  ${r.bot.padEnd(7)} 门 ${d.gate} 次 · 图鉴价 ${d.cold} 次`
            + (d.cold ? `（折时只数 ${sz[0]}–${sz[sz.length - 1]}，中位 ${sz[sz.length >> 1]}）` : '（这一局没有摞走图鉴价路）'));
    }
}

console.log('\n=== §5.7-G-2 地基测试: 一段一节点一只不死的怪，开关主技的总伤害必须相等 ===');
{
    const dt = 1 / 60;
    const T = 8;
    // `count: 1` pins the 段 to a single visible 节, so exactly one circle ever touches the probe body and
    // the crowd multiplier is 1 on both sides — the sweep's damage is then `budget × keep × bonus`, and the
    // only question left is whether the missing `1-keep` reappears as shots. An immortal body pins out
    // overkill, which is a separate finding the table above measures.
    const probe = (fam, tier, whip, on) => {
        chain.reset(0, 0);
        chain.segments.length = 0;
        chain.add(fam, tier, 1);
        enemies.clear();
        capture.reset();
        skills.reset();
        skills.on = on;
        // `combat.mods` still points at the last bot's Build, and a leftover 尾击增伤 stack scales only the
        // sweep - the shots are handed an explicit dmgMul - so the probe has to buy the cards back out.
        build.reset();
        player.reset();
        const k = enemies.spawn(200, 0, 0, 1, false, 0);
        enemies.maxhp[k] = 1e9;
        enemies.hp[k] = 1e9;
        let bsum = 0;
        const frames = Math.round(T / dt);
        for (let f = 0; f < frames; f++) {
            // 甩 = a hard turn at twice the hero's top speed, which is the cheapest way to make `nspd`
            // climb into the 甩尾 band. Not the 1680 px/s orbit the probe below uses: at that speed a
            // muzzle travels most of the way to the target per frame, so every shot "misses" for a reason
            // no player can reproduce, and the test would be measuring its own puppet.
            const a = whip ? f * 0.028 : 0;
            const hx = Math.cos(a) * 200;
            const hy = Math.sin(a) * 200;
            chain.update(dt, hx, hy, whip ? 1 : 0);
            bsum += nodeBonus(chain, 0, player.maxSpeed);
            // Park the body on the seat, then let `update` drag it ~1.4 px and rehash the grid: both arms
            // must always have one reachable contact, or the test compares aim rather than the split.
            enemies.x[k] = chain.bx[0] + 20;
            enemies.y[k] = chain.by[0];
            enemies.update(dt, hx, hy, RING);
            skills.step(dt, chain, enemies, 1, player.maxSpeed, build.skillSize);
        }
        // Money still in the bank at the cutoff was withheld from the tail and has not reached the world
        // yet; `lost` is money the channel could not place. Both belong on the left side of the identity.
        const sk = chain.segments[0].sk;
        return {
            dealt: enemies.dealt,
            held: sk ? sk.bank : 0,
            lost: skills.m.lost,
            bon: bsum / frames,
        };
    };
    for (const whip of [false, true]) {
        const cells = [];
        let worst = 0;
        let bdiff = 0;
        let bn = 1;
        for (const fam of Object.keys(SKILLS)) {
            // Tier 4 is in this loop on purpose: §5.7-E's per-tier tables stop at 3, and the only thing
            // standing between a forged 4 阶段 and a NaN radius is `tAt`'s clamp in skills.js.
            for (let tier = 1; tier <= 4; tier++) {
                const off = probe(fam, tier, whip, false);
                const on = probe(fam, tier, whip, true);
                bn = off.bon;
                const d = off.dealt > 0 ? (on.dealt + on.held + on.lost - off.dealt) / off.dealt : 0;
                worst = Math.max(worst, Math.abs(d));
                // §5.7-A-4's guard, read straight off the multiplier: if 位移 ever leaked into `nspd`, the
                // pouncing arm would report a fatter bonus than the still one.
                bdiff = Math.max(bdiff, Math.abs(on.bon - off.bon));
                cells.push(`${fam}${tier} ${off.dealt.toFixed(0)}→${on.dealt.toFixed(0)}`
                    + `${on.lost > 0.5 ? ` 漏${on.lost.toFixed(0)}` : ''}`);
            }
        }
        console.log(`${whip ? '甩尾行进' : '原地站立'} 加成×${bn.toFixed(2)} · ${cells.join(' · ')}`);
        console.log(`  账面漂移最大 ${Math.round(worst * 10000) / 10}% · 两臂加成差 ${Math.round(bdiff * 1000) / 10}% —— ${worst < 0.005 && bdiff < 0.002
            ? '拆分守恒，主技只改形状'
            : '← 不守恒：主技在加成或在漏，§5.4 的怪血曲线已经不成立'}`);
    }
    skills.on = SKILL;
    chain.reset(0, 0);
    enemies.clear();
    skills.reset();
}

console.log('\n=== §6.1 球的几何: 固定投程 / 飞行时长 / 走廊宽度 / 池容量 ===');
{
    const b = new Build();
    console.log(`固定 9m 投程 / 24m/s 弹速 → 最长 ${((b.range) / b.ballSpeed).toFixed(2)}s 飞行 · `
        + `擦边容差 ${b.ballR}px + 怪 ${ENEMY.radius}px = ${(b.ballR + ENEMY.radius).toFixed(0)}px 走廊半宽`);
    console.log(`按住连掷 ${(1 / b.repeat).toFixed(1)} 球/秒 · 球池 ${BALL.cap} · 投程不会通过升级改变`);
}

console.log('\n=== 甩尾 speed bonus: tail vs head node speed on a hard turn ===');
chain.reset(0, 0);
chain.segments.length = 0;
for (let i = 0; i < 6; i++) chain.add(FAMILIES[i].id, 1, 12);
let hx = 0;
let hy = 0;
for (let f = 0; f < 120; f++) {
    const a = f * 0.14;
    hx = Math.cos(a) * 200;
    hy = Math.sin(a) * 200;
    chain.update(1 / 60, hx, hy, 1);
}
console.log('head', chain.nspd[0].toFixed(1), 'px/s · tail', chain.nspd[chain.nCount - 1].toFixed(1),
    'px/s · bonus', (1 + 0.8 * Math.min(1, Math.max(0, chain.nspd[chain.nCount - 1] / player.maxSpeed - 1))).toFixed(2) + 'x');

console.log('\n=== §4 升级池: 每张卡都能取到上限，上限处仍然合法，没有 NaN 也没有白卡 ===');
chain.reset(0, 0);
player.reset();
for (const e of LEVELS) {
    const b = new Build();
    const x = { chain, player };
    let n = 0;
    while (n < 60 && available(e, b, x)) {
        take(e, b, x);
        n++;
    }
    // `delta` reads "现在 → 取一次后", so at the cap the left half is the run's real terminal value
    // and the right half is a pick that can no longer be offered.
    const [at, next] = e.delta(b, x).split(' → ');
    const bad = /NaN|Infinity|undefined/.test(`${at}${next}`);
    console.log(`${e.id.padEnd(9)} 取满 ${String(n).padStart(2)}/${e.max}`
        + ` · 终值 ${at.padEnd(11)} · 第 ${n + 1} 次预览 ${next}${bad ? '  ← 非法' : ''}${n < e.max ? '  ← 提前封顶' : ''}`);
}
{
    const b = new Build();
    const x = { chain, player };
    take(LEVELS.find((e) => e.id === 'luckyEgg'), b, x);
    take(LEVELS.find((e) => e.id === 'leftovers'), b, x);
    take(LEVELS.find((e) => e.id === 'focusSash'), b, x);
    if (b.expMul !== 1.25 || b.regen !== 0.015 || !b.sashReady) {
        throw new Error('Pokémon-item upgrades did not apply their advertised effects');
    }
    console.log('Pokémon-item upgrade effects: PASS (Lucky Egg / Leftovers / Focus Sash)');
}
// The Australian Mouse adds one Tandemaus immediately, then doubles the live family every run-minute.
{
    const item = LEVELS.find((entry) => entry.id === 'australianMouse');
    const build = new Build();
    const chain = new ChainSystem(null, CHAIN);
    chain.reset(0, 0);
    chain.cap = 2;
    chain.add('mush', 1);
    const ctx = { chain };
    if (!item || item.name !== '澳大利亚老鼠' || item.rarity !== 'legendary' || item.max !== 1
        || item.icon !== 'AUSTRALIANMOUSE'
        || !existsSync(new URL('./assets/icons/TANDEMAUS.png', import.meta.url))
        || !available(item, build, ctx) || !item.delta(build, ctx).includes('0 → 1')) {
        throw new Error('Australian Mouse legendary card, icon source, and first-party preview must be wired');
    }
    take(item, build, ctx);
    const mice = chain.segments.find((segment) => segment.fam === 'tandemaus');
    if (!mice || mice.count !== 1 || chain.companionCountOf(mice) !== 1
        || build.australianMouseTimer !== 0 || available(item, build, ctx)) {
        throw new Error('Australian Mouse must add exactly one Tandemaus immediately and be one-time');
    }
    const fixedRadius = chain.radiusOf(mice);
    chain.absorb('tandemaus', 1);
    if (australianMouseCount(chain) !== 2 || stepAustralianMouse(AUSTRALIAN_MOUSE_INTERVAL - 0.01, build, chain)) {
        throw new Error('Australian Mouse must wait for a complete 60-second run interval');
    }
    const firstDouble = stepAustralianMouse(0.01, build, chain);
    if (!firstDouble || firstDouble.before !== 2 || firstDouble.after !== 4
        || mice.count !== 4 || chain.companionCountOf(mice) !== 4 || chain.radiusOf(mice) !== fixedRadius) {
        throw new Error('Australian Mouse must double both the family count and mouse followers without enlarging them');
    }
    const secondDouble = stepAustralianMouse(AUSTRALIAN_MOUSE_INTERVAL, build, chain);
    if (!secondDouble || secondDouble.before !== 4 || secondDouble.after !== 8
        || chain.companionCountOf(mice) !== 8) {
        throw new Error('Australian Mouse doubling must repeat on each later minute');
    }
    const full = new ChainSystem(null, CHAIN);
    full.reset(0, 0);
    full.cap = 1;
    full.add('mush', 1);
    if (available(item, new Build(), { chain: full })) {
        throw new Error('Australian Mouse must wait for a party slot if its first Tandemaus cannot stack');
    }
    const shinyChain = new ChainSystem(null, CHAIN);
    shinyChain.reset(0, 0);
    shinyChain.cap = 1;
    shinyChain.add('tandemaus', 1, 2, true);
    const shinyBuild = new Build();
    if (!available(item, shinyBuild, { chain: shinyChain })) {
        throw new Error('Australian Mouse must be able to add a normal line beside a shiny one');
    }
    take(item, shinyBuild, { chain: shinyChain });
    if (australianMouseCount(shinyChain) !== 3
        || shinyChain.segments.find((segment) => !segment.shiny)?.count !== 1
        || shinyChain.segments.find((segment) => segment.shiny)?.count !== 2) {
        throw new Error('Australian Mouse must add exactly one normal Tandemaus without capture mirroring');
    }
    const shinyDouble = stepAustralianMouse(AUSTRALIAN_MOUSE_INTERVAL, shinyBuild, shinyChain);
    if (shinyDouble?.before !== 3 || shinyDouble.after !== 6
        || shinyChain.segments.find((segment) => !segment.shiny)?.companions !== 2
        || shinyChain.segments.find((segment) => segment.shiny)?.companions !== 4) {
        throw new Error('Australian Mouse must double both ordinary and shiny family members');
    }
    console.log('澳大利亚老鼠：传说道具即时入队 · 每60秒翻倍 · 增加跟随鼠与弹幕数量、不增大体型 PASS');
}
{
    const b = new Build();
    const x = { chain, player };
    const item = LEVELS.find((entry) => entry.id === 'alcremieSweet');
    if (!item || item.rarity || item.max !== 1 || item.icon !== 'ALCREMIESWEET'
        || !item.note.includes('一整圈')) {
        throw new Error('Strawberry Sweet must be a normal one-time item with clear full-turn instructions');
    }
    take(item, b, x);
    if (b.stacks.alcremieSweet !== 1 || available(item, b, x)) {
        throw new Error('Strawberry Sweet must equip once and not reappear as a duplicate card');
    }
    console.log('草莓糖饰：普通升级道具、完成旋转生小仙奶 PASS');
}
{
    const b = new Build();
    const x = { chain, player };
    const item = LEVELS.find((e) => e.id === 'expShare');
    take(item, b, x);
    chain.segments.length = 0;
    chain.add('mush', 1, 2);
    const boosted = evolveGate(chain.segments[0], { cores: 0, evolveNeed: b.expShare ? 2 : 0 });
    const normal = evolveGate(chain.segments[0], { cores: 0 });
    const have = { cores: 0, evolveNeed: b.expShare ? 2 : 0 };
    const auto = chain.findAuto(have);
    const evolved = auto >= 0 ? chain.evolve(auto, have) : null;
    if (!boosted.ok || boosted.q !== 2 || !boosted.text.includes('学习装置') || normal.ok
        || auto !== 0 || !evolved || evolved.seg.tier !== 2) {
        throw new Error('Learning Device did not lower the evolution threshold to two copies');
    }
    console.log('Learning Device: PASS (two-copy gate; automatic evolution; ordinary gate unchanged)');
}
{
    chain.segments.length = 0;
    chain.cap = 4;
    chain.add('mush', 1, 1);
    const result = chain.absorb('mush', 2);
    if (result !== 'family-evolve' || chain.segments.length !== 1
        || chain.segments[0].tier !== 2 || chain.segments[0].count !== 2
        || chain.lastAbsorbPromotions.length !== 1 || chain.lastAbsorbPromotions[0].fromTier !== 1) {
        throw new Error('Catching an evolved family member must replace the owned base form in-place');
    }
    console.log('同家族进化形态替换: PASS（捕获高阶形态就地替换低阶成员，保留队伍位与堆叠计数）');
}
{
    chain.segments.length = 0;
    chain.cap = 4;
    chain.add('mush', 1, 2);
    chain.add('mush', 2, 1);
    chain.add('mush', 3, 1);
    const have = { cores: 0, evolveNeed: 2 };
    let at = chain.findAuto(have);
    const first = at >= 0 ? chain.evolve(at, have) : null;
    const firstOk = !!first && first.merged === 1 && first.seg.tier === 2 && first.seg.count >= 2;
    at = chain.findAuto(have);
    const second = at >= 0 ? chain.evolve(at, have) : null;
    if (!firstOk || !second || second.merged !== 1 || second.seg.tier !== 3 || second.seg.count < 2
        || chain.segments.length !== 1) {
        throw new Error('evolving duplicate stage stacks did not merge and continue the evolution chain');
    }
    console.log('Evolution stage merge: PASS (same-stage stacks combine and Learning Device continues the chain)');
}
{
    chain.segments.length = 0;
    chain.cap = 4;
    chain.add('mush', 2, 1);
    chain.add('mush', 3, CHAIN.nodeEvery * 2 - 1);
    const finalForm = chain.segments[1];
    const beforeBulk = chain.bulkOf(finalForm);
    const beforeVisualBulk = chain.visualBulkOf(finalForm);
    const result = chain.absorb('mush', 1);
    if (result !== 'top-stack' || chain.segments.length !== 2 || chain.segments[0].count !== 1 || finalForm.tier !== 3
        || finalForm.count !== CHAIN.nodeEvery * 2 || chain.bulkOf(finalForm) !== beforeBulk + 1
        || chain.visualBulkOf(finalForm) <= beforeVisualBulk) {
        throw new Error('catching an earlier family stage did not grow the owned final-form body');
    }
    console.log('Final-form family growth: PASS (earlier-stage catch feeds and visibly enlarges final form)');
}
// Every captured Tandemaus-family member adds a companion at any evolution stage, without inflating the body.
{
    const soloFollower = tandemausFollowerOffset(Math.PI, 1, 0, 1);
    const pairedLeft = tandemausFollowerOffset(Math.PI / 2, 1, 0, 2);
    const pairedRight = tandemausFollowerOffset(Math.PI / 2, 1, 1, 2);
    const pack8 = Array.from({ length: 8 }, (_, i) => tandemausFollowerOffset(0, 1, i, 8));
    const firstStep = tandemausFollowerMotion(Math.PI, 1, 0, 0.1);
    const secondStep = tandemausFollowerMotion(Math.PI, 1, 1, 0.1);
    if (soloFollower.x >= 0 || Math.abs(soloFollower.y) > 1e-8
        || pairedLeft.y <= 0 || pairedRight.y <= 0 || pairedLeft.x * pairedRight.x >= 0
        || Math.abs(pairedLeft.x + pairedRight.x) > 1e-8
        || new Set(pack8.slice(0, 4).map((point) => point.y.toFixed(3))).size !== 4
        || Math.abs(pack8[4].x - pack8[0].x - 24) > 1e-8
        || Math.hypot(firstStep.x - secondStep.x, firstStep.y - secondStep.y) < 0.1) {
        throw new Error('Tandemaus followers must form a lively, staggered four-column pack behind Maushold');
    }
    chain.segments.length = 0;
    chain.cap = 4;
    chain.add('tandemaus', 1, 1);
    const maushold = chain.segments[0];
    const initialRadius = chain.radiusOf(maushold);
    const bodyFixed = () => chain.bulkOf(maushold) === 1 && chain.visualBulkOf(maushold) === 1
        && chain.visualOf(maushold) === 1 && chain.radiusOf(maushold) === initialRadius;
    if (chain.companionCountOf(maushold) !== 1 || !bodyFixed()
        || chain.absorb('tandemaus', 1) !== 'stack' || chain.companionCountOf(maushold) !== 2
        || !chain.evolveReward(0) || maushold.tier !== 2 || chain.companionCountOf(maushold) !== 2
        || chain.absorb('tandemaus', 2) !== 'top-stack' || chain.companionCountOf(maushold) !== 3
        || chain.absorb('tandemaus', 1) !== 'top-stack' || chain.companionCountOf(maushold) !== 4
        || !bodyFixed()) {
        throw new Error('Tandemaus-family catch did not add a companion at each stage');
    }
    chain.segments.push({ ...maushold, count: 1, companions: 4 });
    chain.mergeStageAt(0);
    if (chain.segments.length !== 1 || chain.companionCountOf(maushold) !== 8) {
        throw new Error('Maushold evolution merge lost companion count');
    }
    chain.segments.length = 0;
    chain.cap = 1;
    chain.add('tandemaus', 1, 1);
    if (chain.absorb('tandemaus', 2) !== 'family-evolve' || chain.segments.length !== 1
        || chain.segments[0].tier !== 2 || chain.companionCountOf(chain.segments[0]) !== 2) {
        throw new Error('Full-team Tandemaus-family catch did not replace the base form and add a companion');
    }
    console.log('一家鼠家族捕捉成长: PASS（各阶段每抓一只就加一只小鼠，体型固定）');
}
// Tandemaus attacks add one mouse projectile per extra family member while keeping every shot the same size.
{
    const fireFirstMouseVolley = (count) => {
        const c = new ChainSystem(null, CHAIN);
        c.cap = 1;
        c.add('tandemaus', 1, count);
        const skill = new SkillSystem();
        const shot = { cd: 0, bank: 1e9 };
        const target = {
            grid: { query: (_x, _y, _r, out) => { out.push(0); return out; } },
            dead: [false], x: [80], y: [0], r: [12], hp: [1e9],
        };
        skill._aim(c, target, c.segments[0], SKILLS.tandemaus, 0, shot, 1, 1);
        const launchEvents = [];
        skill.consumeBursts((event) => launchEvents.push(event.kind));
        const expectedShots = 2 + count - 1;
        if (skill.n !== expectedShots || skill.pvariant[0] !== 0 || skill.pvariant[1] !== 1
            || launchEvents.length !== 1 || launchEvents[0] !== 'tandemaus-throw') {
            throw new Error('Tandemaus volley did not emit mouse-icon bullets');
        }
        skill._fly(1 / 60, target);
        if (skill.nProjectileSamples !== expectedShots
            || skill.projectileSamples[0].variant !== 0 || skill.projectileSamples[1].variant !== 1
            || skill.projectileSamples.some((sample) => !Number.isFinite(sample.x) || !Number.isFinite(sample.y))) {
            throw new Error('Live mouse bullets must publish their actual per-step flight positions');
        }
        return { shots: expectedShots, radius: skill.pr[0] };
    };
    const familyModule = projectileFamilyModuleForSegment({ fam: 'tandemaus', tier: 2 });
    const renderer = projectileRendererForFamily('tandemaus');
    const draws = [];
    const soloVolley = fireFirstMouseVolley(1);
    const groupVolley = fireFirstMouseVolley(8);
    if (!familyModule || familyModule.variant(5) !== 1 || typeof renderer !== 'function'
        || soloVolley.shots !== 2 || groupVolley.shots !== 9
        || soloVolley.radius !== groupVolley.radius) {
        throw new Error('Tandemaus family members must add fixed-size shots to each volley');
    }
    const closeChain = new ChainSystem(null, CHAIN);
    closeChain.cap = 1;
    closeChain.add('tandemaus', 1, 1);
    const closeSkill = new SkillSystem();
    const closeTarget = {
        grid: { query: (_x, _y, _r, out) => { out.push(0); return out; } },
        dead: [false], x: [8], y: [0], r: [24], hp: [1e9], hurt () {},
    };
    closeSkill._aim(closeChain, closeTarget, closeChain.segments[0], SKILLS.tandemaus,
        0, { cd: 0, bank: 1e9 }, 1, 1);
    closeSkill._fly(1 / 60, closeTarget);
    if (closeSkill.n !== 0 || closeSkill.nProjectileSamples !== 2) {
        throw new Error('A point-blank mouse volley must still render its last live samples before impact');
    }
    renderer({ draw (...args) { draws.push(args); } }, { get: (color, alpha) => ({ color, alpha }) },
        { x: 0, y: 0, size: 10, wall: 0.25, shotAngle: 0, index: 1, variant: 2 });
    if (draws.length !== 1 || draws[0][0] !== 'MAUSHOLD_COMPANION_3'
        || draws[0][3] < 0.42 || draws[0][6]?.color !== '#ffffff') {
        throw new Error('The live Tandemaus projectile must render its mouse sprite in flight');
    }
    console.log('一家鼠小鼠弹幕: PASS（实机弹体沿技能坐标移动，粒子沿真实轨迹跟随）');
}
{
    chain.segments.length = 0;
    chain.cap = 2;
    chain.add('mush', 2, 1);
    chain.add('cat', 1, 1);
    const res = chain.absorb('mush', 1);
    const have = { cores: 0, evolveNeed: 2 };
    const gate = evolveGate(chain.segments[0], have);
    const auto = chain.findAuto(have);
    const evolved = auto >= 0 ? chain.evolve(auto, have) : null;
    if (res !== 'family-stack' || !gate.ok || auto !== 0 || !evolved || evolved.seg.tier !== 3) {
        throw new Error('Full-team family overflow did not feed the owned evolution line');
    }
    console.log('Full-team family catch + Learning Device: PASS (overflow feeds owned line and evolves)');
}
chain.reset(0, 0);
player.reset();

console.log(`\n=== §设定 图鉴审计: ${ROSTER_IDS.length} 条线逐行对照数据表，并且逐个文件核对图标真的在盘上 ===`);
{
    // v0.9 made `species.js` a rules table, so this is no longer a pretty-print: the `edge` strings are
    // what `chain.evolve` charges, and a name with no PNG behind it draws nothing. Both halves are
    // checked here - the data against the signed 元素 axis, and the art against `assets/icons/`.
    const elOf = Object.create(null);
    for (const f of FAMILIES) elOf[f.id] = f.element;
    const has = (k) => {
        try {
            return existsSync(new URL(`./assets/icons/${k}.png`, import.meta.url));
        } catch (e) {
            return true;
        }
    };
    let missIcon = 0;
    for (const id of ROSTER_IDS) {
        const s = SPECIES[id];
        const ty = s.ty.map((t) => t.map((x) => TYPE_ZH[x] || x).join('/')).join('·');
        // The 元素 axis is our signed mechanical class; a canon type outside its list is not an error, it
        // is the seam where a real Pokémon stopped matching the greybox it replaced - printed, not hidden.
        const allow = ELEMENT_TYPE[elOf[id]] || [];
        const off = s.ty.flat().filter((t) => allow.indexOf(t) < 0);
        const icons = [];
        for (let t = 1; t <= 4; t++) {
            const k = iconKey(id, t);
            if (k && !has(k)) {
                missIcon++;
                icons.push(`${t}阶缺图 ${k}`);
            }
        }
        const altBranch = [];
        for (let t = 1; t <= s.edge.length; t++) {
            const st = stepOf(id, t);
            if (!st) continue;
            for (const a of st.alt) altBranch.push(`${a.to}(${a.kind}${a.arg ? ' ' + a.arg : ''})${has(a.to) ? '' : ' 无图'}`);
        }
        console.log(`${id.padEnd(7)} ${elOf[id].padEnd(7)} #${s.dex[0]}→${s.dex[s.dex.length - 1]}`
            + ` ${ty.padEnd(19)} ${s.zh.join('→')}`
            + ` · 边[${s.edge.join(' | ')}]`
            + `${altBranch.length ? ` · 支线未开放 ${altBranch.join(',')}` : ''}`
            + `${icons.length ? ` · ${icons.join(',')}` : ''}`
            + `${off.length ? ` · 元素外类型 ${off.map((x) => TYPE_ZH[x] || x).join('/')}` : ''}`);
    }
    const noArt = iconKeys().filter((k) => !has(k));
    console.log(`图标: 表内 ${iconKeys().length} 个键 · 盘上缺 ${noArt.join(',') || '无'}（${missIcon} 个 阶位）`
        + ` · BOSS ${BOSS_SPECIES.key}(${BOSS_SPECIES.zh}) 缺图 ${has(BOSS_SPECIES.key) ? '无' : '是'}`);
}

console.log('\n=== §5.4 count^0.65: the one curve that decides whether 抓不完 is legal ===');
for (const c of [1, 12, 36, 120, 300]) {
    const a3 = segDps({ tier: 1, count: c }) * 3;
    console.log(`count ${String(c).padStart(3)} · 1阶 ${segDps({ tier: 1, count: c }).toFixed(0).padStart(4)}`
        + ` · 2阶 ${segDps({ tier: 2, count: c }).toFixed(0).padStart(4)}`
        + ` · 3阶 ${segDps({ tier: 3, count: c }).toFixed(0).padStart(4)}`
        + ` · 4阶 ${segDps({ tier: 4, count: c }).toFixed(0).padStart(4)}`
        + ` · 3段升1段(2阶×${3 * c}) = ${(segDps({ tier: 2, count: c * 3 }) / a3).toFixed(2)}x DPS`);
}

console.log('\n=== §7.1-4 段内进化: 各族按自己的图鉴线要价（条件 → 只数/融核/秒 → 实测倍率）===');
{
    // v0.8 priced every fold at a flat 3 只, i.e. one number for twelve species. v0.9 reads each line's
    // own `Evolutions` edge, so this prints the whole ladder per family: what one 阶 step asks for, what
    // it pays back - measured through `segDps`, never quoted from the q formula - and what it takes to
    // walk one pet from 1 阶 to the top of its own dex line.
    const every = [];
    for (const id of ROSTER_IDS) {
        const ceil = evoCeil(id);
        const steps = [];
        let pets = 1, cores = 0, secs = 0;
        for (let t = 1; t < ceil; t++) {
            const st = stepOf(id, t);
            if (!st) break;
            chain.segments.length = 0;
            chain.add(id, t, st.q);
            const seg = chain.segments[0];
            // The ladder column below is about *what the step costs*, and a 亲密度 step costs time, so the
            // clock goes on the link before it is priced. Both non-pile prices are then checked as gates:
            // one 核 short must lock, and one second short must lock - a printed price nobody can fail to
            // pay is decoration.
            seg.age = st.sec;
            const d0 = segDps(seg);
            const cgate = st.cores > 0 ? (evolveGate(seg, { cores: st.cores - 1 }).ok ? '核门✗' : '核门✓') : '';
            seg.age = Math.max(0, st.sec - 1);
            const tgate = st.sec > 0 ? (evolveGate(seg, { cores: st.cores }).ok ? '时门✗' : '时门✓') : '';
            seg.age = st.sec;
            const g = evolveGate(seg, { cores: st.cores });
            const r = g.ok ? chain.evolve(0, { cores: st.cores }) : null;
            const ratio = r ? segDps(r.seg) / d0 : 0;
            // 「1 只到顶」 inverted through the *shipped* remainder law: to finish a fold holding `pets` 只 you
            // must have entered it with `pets·q` under the divisor, `pets + q − 1` at rung 1, and `pets + 1` at
            // rung 2. The three are the same number only at the pile this loop folds (`q` 只), which is why the
            // column has to follow `foldAfter` rather than restate a formula. Rung 3 spends nothing, so the
            // whole line is walked on one pile of `q` 只 and the column stops meaning "caught along the way" -
            // which is precisely what 「只需要 3 只就能进化」 costs, so it prints instead of being smoothed over.
            pets = CHAIN.evolveKeeps === 3 ? Math.max(pets, st.q)
                : CHAIN.evolveKeeps === 2 ? pets + 1
                    : CHAIN.evolveKeeps ? pets + st.q - 1 : pets * st.q;
            cores += st.cores;
            secs += st.sec;
            every.push({ id, t, q: st.q, cores: st.cores, sec: st.sec, kind: st.kind, txt: condText(st), ratio });
            steps.push(`${t}→${t + 1} ${(st.kind + (st.arg ? ' ' + st.arg : '')).padEnd(11)}`
                + `${st.q}合1${st.cores ? `+${st.cores}核` : ''}${st.sec ? `+${st.sec}s` : ''}`
                + ` ×${r ? ratio.toFixed(2) : '不可'}`
                + `${cgate || tgate ? ` [${[cgate, tgate].filter(Boolean).join(' ')}]` : ''}`);
        }
        console.log(`${id.padEnd(7)} ${'阶1 ' + typeText(id, 1)} ${displayName(id, 1)}→${displayName(id, ceil)}`
            + ` · ${steps.join(' · ')} ‖ 1 只到顶 ${pets} 只 · ${cores} 核 · ${secs}s 携带`);
    }
    // The reason `CHAIN.evolveLv` has one entry and not two: past some q, `DPS`'s ×3.0-×3.2 per 阶 stops
    // beating `count^0.65`, and a step that returns ~×1.05 is a button that costs five pets for nothing.
    // Printing the worst step of the 22 is what makes "no dead fold" a measured property of the roster.
    const worst = every.reduce((a, b) => (b.ratio < a.ratio ? b : a));
    const best = every.reduce((a, b) => (b.ratio > a.ratio ? b : a));
    console.log(`步数 ${every.length} · 最差一步 ${worst.id} ${worst.t}→${worst.t + 1}（${worst.q} 合 1）= ×${worst.ratio.toFixed(2)}`
        + ` · 最好一步 ${best.id} ${best.t}→${best.t + 1}（${best.q} 合 1）= ×${best.ratio.toFixed(2)}`
        + ` · 全部 ≥ ×1.2 → ${every.every(x => x.ratio >= 1.2) ? '没有白折的一步' : '有白折的一步 ⚠'}`);
    // v0.9.9 changed what this audit has to prove. On the dex ladder it checked each family's own price;
    // under his signed rule there is one price, so the property worth pinning is that the ladder is *gone* -
    // every step of every line reads `q = evolveFlat`, 融核 0, 携带 0. A step that leaks a price back in would
    // not show up in the roster dump below (it prints the same sentence for both worlds), so this is the row
    // that says which currency died: 融核 survives only as 铸造's money.
    if (CHAIN.evolveFlat) {
        const off = every.filter(x => x.q !== CHAIN.evolveFlat || x.cores || x.sec);
        // The second half of the same sentence, and the reason it is a line and not a clause: `priceOf` was
        // pinned, but `condText` still had the 图鉴价 ladder's own shape written into it, so the 熔炉 row for
        // a 石头 步 read 「同族 3 合 1 + 0 融核」. A zero price on the one line whose job is to name the price
        // is the old ladder surviving as a ghost in the display, and only the panel's own text can show it.
        const ghost = every.filter(x => /融核|携带/.test(x.txt));
        console.log(`价格钉平: ${every.length} 步全部 ${CHAIN.evolveFlat} 合 1 · 0 核 · 0 秒 → `
            + (off.length ? `${off.length} 步漏网 ⚠（${off.slice(0, 4).map(x => `${x.id}${x.t}→${x.t + 1}`).join(' ')}）`
                : '无一步例外 ✓ · 当前固定进化价不消耗融核')
            + ` · 面板不印 0 价 → ${ghost.length ? `${ghost.length} 步还在要钱 ⚠（${ghost[0].id}${ghost[0].t}「${ghost[0].txt}」）` : '23 步的图鉴文本里没有融核/携带 ✓'}`
            + ` · 图鉴条件仍照读（${[...new Set(every.map(x => x.kind))].sort().join('/')}）`);
    }
    // v0.9's stated law for a *ratio* price: the same 阶 step buys the same multiplier whether the pile holds
    // one 只 or forty, because `segDps` is `DPS[tier] × count^0.65` and the count term cancels into
    // `(1/q)^0.65` — so the multiplier depends on `q` and on nothing else. The comment that used to sit here
    // claimed the opposite (a flat 只 price "would get cheaper per fold the fatter the stack was"), and the
    // rows below printed ×1.57 four times to contradict it. What that claim was reaching for is a flat
    // *absolute* price (「每次多收 5 只」) — v0.8's shape, and the thing this loop would catch.
    // The second reason to rewrite it is v0.9.9: the loop used to probe `FAMILIES[0]`, whose 图鉴价 happens to
    // *equal* the flat price (3 只), so both worlds printed the same four numbers and the row proved nothing
    // about the ladder it was written to defend. It now walks the prices this world actually hands out.
    const probe = FAMILIES[0].id;
    // Print the shape before the numbers, because the verdict underneath means the opposite thing in the
    // other world. The divisor law is ratio-neutral *by design* (that is §5.4's whole argument for ÷q), so a
    // drift there is a regression. The remainder law buys back the 排场 that §9.20-⑧ measured the divisor
    // eating, and the price of buying it is exactly this drift: a fold on a fat pile returns closer to the raw
    // 阶 multiplier, and the pile can pay the next one the moment it has `q` 只 again.
    console.log(`   折叠形状: ${FOLD_TEXT[CHAIN.evolveKeeps] || `未知档 ⚠ ${CHAIN.evolveKeeps}`}`);
    for (const q of PRICE_Q) {
        const rs = [1, 2, 4, 40].map((mult) => {
            const c = q * mult;
            return segDps({ tier: 2, count: chain.foldAfter(c, q) }) / segDps({ tier: 1, count: c });
        });
        const same = rs.every((v) => Math.abs(v - rs[0]) < 1e-9);
        const span = `×${Math.min(...rs).toFixed(2)}–×${Math.max(...rs).toFixed(2)}`;
        console.log(`   堆叠不变性 ${q}合1 ${[1, 2, 4, 40].map((m, i) => `×${m * q}=${rs[i].toFixed(2)}`).join(' ')}`
            + ` → ${same ? '肥瘦同价 ✓（倍率里只有 q，没有摞的肥度）'
                : CHAIN.evolveKeeps ? `随肥度漂移 ${span}（触发价形状的设计后果，不是回归）`
                    : `随肥度漂移 ⚠ ${span}`}`);
    }
    chain.segments.length = 0;
    chain.add(probe, 3, 120);
    console.log(`门: 3阶×120 → findEvolve()=${chain.findEvolve({ cores: 9999 })} evolve(0)=${chain.evolve(0, { cores: 9999 })}`
        + `（§7.1「4 阶只能铸」对段内进化同样成立）· 段 1→${chain.segments.length} 段`);
    // 喵喵 is the two-stage line: its own dex depth, not `CHAIN.evolveCeil`, is what stops it at 2 阶.
    chain.segments.length = 0;
    chain.add('cat', 2, 99);
    console.log(`短图鉴线: 猫老大 2阶×99 → findEvolve()=${chain.findEvolve({ cores: 9999 })}`
        + ` evolve(0)=${chain.evolve(0, { cores: 9999 })}（短图鉴线不会凭空增加进化阶段）`);
    // Automatic evolution now follows `evolveGate` immediately. These rows retain the old geometry and
    // cooldown scenarios as regression probes, and assert that neither delays a ready stack.
    // Retain the old size calculations so the probes cover stacks on both sides of those boundaries.
    const fullAt = chain.autoThresholdAt(1);            // the first pile that stands on all 3 门节圆
    const readyAt = (fam, tier) => {
        chain.segments.length = 0;
        chain.add(fam, tier, 400);
        const g = evolveGate(chain.segments[0], { cores: 9999 });
        return g.q ? chain.autoThresholdAt(g.q) : fullAt * 4;   // 顶格档：给一摞够大的，只为验证它仍然被拒
    };
    const tFold = readyAt('mush', 1);
    const tStone = readyAt('moth', 2);
    // `autoCold` is pinned inside the loop to show that fed time no longer changes the decision.
    const PROBE_COLD = 20;
    const backCold = CHAIN.autoCold;
    CHAIN.autoCold = PROBE_COLD;
    const qOf = (fam, tier) => {
        chain.segments.length = 0;
        chain.add(fam, tier, 400);
        return evolveGate(chain.segments[0], { cores: 9999 }).q;
    };
    const qMush = qOf('mush', 1);                                   // 妙蛙种子 1 阶的图鉴价
    // The smallest pile that stands on 2 屏节圆 while its fold lands on 1 — the shape ④ exists to refuse.
    // Read through `foldAfter`, so it is the *shipped* shape's refusal that gets pinned: under the remainder
    // law almost no pile loses a circle, and the search would find nothing to refuse.
    const twoToOne = (() => {
        for (let c = qMush; c < 400; c++) {
            if (chain.nodesAt(c) === 2 && chain.nodesAt(chain.foldAfter(c, qMush)) < 2) return c;
        }
    })();
    // Is 禁令② a *ban* in this shape, or an identity? A rung that never lowers `count` cannot drop a circle, so
    // the two rows below would have no case to build and would silently re-test clause ① while claiming to pin ②
    // — the §9.20 lesson that a probe whose test value equals the pinned value proves nothing, one rung further.
    const ban2Alive = (() => {
        for (let c = 1; c < 4000; c++) {
            if (chain.autoNodesAt(c) === CHAIN.nodesMax
                && chain.autoNodesAt(chain.foldAfter(c, qMush)) < CHAIN.nodesMax) return c;
        }
        for (let c = 1; c < 4000; c++) {
            if (chain.nodesAt(c) !== chain.nodesAt(chain.foldAfter(c, qMush))) return c;
        }
    })();
    // `want` is the automatic result; `wantM` confirms the manual gate still reports its own eligibility.
    const autoCases = [
        ['门满 3 节 · 折完门仍 3 节 · 不花核', 'mush', 1, tFold, 9999, 0, 0, 0],
        ...(ban2Alive === undefined ? [] : [
            ['门满 3 节 · 折完门只剩 2 节', 'mush', 1, tFold - 1, 9999, 0, 0, 0],
        ]),
        ['小摞（达到同族进化价）', 'mush', 1, fullAt - 1, 9999, 0, 0, 0],
        ['石头步（要交融核）· 图鉴价世界', 'moth', 2, tStone, 9999, -1, 0, 0, undefined, 0],
        ['3 阶顶格（4 阶只能铸）', 'mush', 3, readyAt('mush', 3), 9999, -1, -1, 0],
        [`冷摞（放手 ${PROBE_COLD} s · 只付图鉴价）`, 'mush', 1, qMush, 0, 0, 0, PROBE_COLD],
        [`热摞（同样 ${qMush} 只 · 刚抓到）`, 'mush', 1, qMush, 0, 0, 0, 0],
        ...(ban2Alive === undefined || twoToOne === undefined ? [] : [
            [`冷摞但折完掉一个屏节圆（${twoToOne}→${chain.foldAfter(twoToOne, qMush)}只）`, 'mush', 1, twoToOne, 0, 0, 0, PROBE_COLD],
        ]),
        ['冷摞也要融核（禁令③优先）· 图鉴价世界', 'moth', 2, qOf('moth', 2), 9999, -1, 0, PROBE_COLD, undefined, 0],
        // Pin the old cooldown setting on both sides of its boundary: neither value delays a ready stack now.
        ...(Number.isFinite(backCold) && backCold >= 1 ? [
            [`定稿档 ${backCold} s 整（只付图鉴价）`, 'mush', 1, qMush, 0, 0, 0, backCold, backCold],
            [`定稿档 差 1 s（${backCold - 1} s）`, 'mush', 1, qMush, 0, 0, 0, backCold - 1, backCold],
        ] : []),
    ];
    let autoOk = true;
    // Keep the manual result alongside auto so evolution prices and the top-stage cap remain visible.
    let isoOk = true;
    // Two of these rows price a step in 融核, which v0.9.9's flat price deletes from the whole roster — so a
    // ban with no reachable case would go untested exactly when it stops mattering. Those rows carry their
    // own `flat` field and run in the 图鉴价 world; the rest see the shipped one.
    const backFlat = CHAIN.evolveFlat;
    for (const [why, fam, tier, count, cores, want, wantM, fed, cold, flat] of autoCases) {
        CHAIN.autoCold = cold === undefined ? PROBE_COLD : cold;
        CHAIN.evolveFlat = flat === undefined ? backFlat : flat;
        chain.segments.length = 0;
        chain.add(fam, tier, count);
        chain.segments[0].fed = fed;
        const got = chain.findAuto({ cores });
        const manual = chain.findEvolve({ cores: 9999 });
        if (got !== want) autoOk = false;
        if (manual !== wantM) isoOk = false;
        console.log(`自动进化门 ${why.padEnd(34)} ${fam} ${tier}阶×${String(count).padStart(3)}`
            + ` 冷${String(fed).padStart(2)}s/档${CHAIN.autoCold}s${CHAIN.evolveFlat ? ` · ${CHAIN.evolveFlat}合1` : ' · 图鉴价'}`
            + ` → findAuto()=${got}（期望 ${want}）· 手动 E=${manual}（期望 ${wantM}）`);
    }
    CHAIN.evolveFlat = backFlat;
    CHAIN.autoCold = backCold;
    console.log(`自动进化规则: ${autoOk ? '门槛满足即折叠' : '有 ✗ —— 判定不符 ⚠'}`
        + ` · 手动门槛探针: ${isoOk ? '✓' : '有 ✗ ⚠'}`
        + ` · 含融核成本的进化仍留给玩家`);
    // Keep the fed-time bookkeeping probe even though it no longer gates automatic evolution.
    chain.segments.length = 0;
    chain.add('mush', 1, qMush);
    chain.update(0, 0, 0, 0);                                   // the frame the catch lands on
    for (let k = 0; k < PROBE_COLD; k++) chain.update(1, 0, -k, 0);
    const aged = chain.segments[0].fed;
    chain.absorb('mush', 1);
    chain.update(0, 0, -21, 0);
    const reset = chain.segments[0].fed;
    console.log(`冷摞时钟: 放手 ${PROBE_COLD} s → fed=${aged}（期望 ${PROBE_COLD}）· 又抓到 1 只 → fed=${reset}（期望 0）`
        + ` · ${aged === PROBE_COLD && reset === 0 ? '一个写者，改 count 的地方不必记得清它' : '⚠ 时钟与 count 脱钩'}`);
    // v0.9.8 「进化满之后再抓到同族 = 体系变大、弹幕也变大」 as corrected by the screenshot the player sent
    // (「为什么同一类型的挤在一起…不能进化也要合在一起，改变的是体型」). Three claims, all geometry rather than
    // balance, so they are pinned here instead of being watched for in the tables above:
    //   ① a link at the top of its line owns ONE seat however many 只 it holds, while a link that can still
    //     evolve keeps the ordinary 节圆 law - the crowd in the screenshot is what ① forbids;
    //   ② the 只数 that used to buy seats buys 体型 instead, in the same currency every radius reads;
    //   ③ the seat arrays are still big enough. Typed arrays swallow an out-of-range write *silently*, so a
    //     too-small `maxNodes` would show up as a tail that quietly stops growing, not as an error.
    chain.segments.length = 0;
    const bigAt = CHAIN.topBulk * CHAIN.nodeEvery;
    chain.add('cat', 2, bigAt);                                   // 喵喵线只有两阶：36 只站在图鉴头
    chain.add('cat', 1, bigAt);                                   // 同族、同只数，但还能进化
    const a0 = chain.segments[0]; const a1 = chain.segments[1];
    const got = `${chain.visualOf(a0)}体/${chain.bulkOf(a0)}当量`;
    const want = `1体/${CHAIN.topBulk}当量`;
    const gotM = `${chain.visualOf(a1)}体/${chain.bulkOf(a1)}当量`;
    const wantM = `${CHAIN.nodesMax}体/${CHAIN.nodesMax}当量`;
    console.log(`满线合体: 同族同 ${bigAt} 只 → 线顶 ${got}（期望 ${want}）· 还能进化 ${gotM}（期望 ${wantM}）`
        + ` · ${got === want && gotM === wantM ? '到顶的合成一只大的，没到顶的照旧排成一串' : '⚠ 合体规则被改动'}`);
    //   ④ 「合在一起」 must not buy **less ground** than the crowd it replaced. This one is a balance
    //     invariant with a body count: un-compensated, the manual control arm lost 3 of its 8 survivors at
    //     24 球/min (§9.19-⑤) and no other column in the table says why. Below the 节圆 cap the merged disc
    //     has *exactly* the crowd's summed area (area, not radius, is the continuous quantity across a
    //     merge); past the cap 只数 keeps buying more, which is the 「体型变大」 half of the same sentence.
    let loses = 0, even = true, past = 0;
    for (let n = 1; n <= bigAt; n++) {
        const s = { fam: 'cat', tier: 2, count: n };                    // 喵喵线到顶：只数只买体型
        const k = chain.nodesAt(n);                                     // 合体前这一摞走几个节圆
        const R = chain.radiusOf(s, 2);
        const one = CHAIN.headRadius(k, 2);
        if (R * R < k * one * one - 1e-9) loses = n;
        // Equality is owed only while the body is still under the 节圆 cap (`bulk ≤ nodesMax`) - past it the
        // surplus is the point. Reading the cap off `k` instead would be always-true and cry wolf from 18 只.
        if (chain.bulkOf(s) <= CHAIN.nodesMax) {
            if (Math.abs(R * R - k * one * one) > 1e-9) even = false;
        } else if (R * R > k * one * one + 1e-9) past++;
    }
    const fat = chain.radiusOf({ fam: 'cat', tier: 2, count: bigAt }, 2);
    console.log(CHAIN.sweepArea
        // Under §9.22's law the crowd and the merged body are the same expression (area ∝ the 段's per-seat
        // damage × its seats), so this row's question is no longer "did the √k compensate" but "did the law
        // stay proportional at all" — and the clamp is the one place where it deliberately stops.
        ? `合体面积: 清扫律 = 面积∝每节圆dps^${CHAIN.sweepArea}，本节圆 ${CHAIN.headRadius(1, 1)}px · ${bigAt} 只一处`
            + ` ${fat >= VIEW.fieldMaxR ? `顶到封顶 ${VIEW.fieldMaxR}px（纸面伤害已跑赢地皮）` : `未封顶 ${fat.toFixed(0)}px`}`
        : `合体面积: 1–${bigAt} 只逐档 一只 ≥ 它替掉的 ${CHAIN.nodesMax} 圆之和 · ${loses ? `⚠ ${loses} 只处输了` : '无一档输 ✓'}`
            + ` · 未达体型上限处${even ? '与 crowd 面积严格相等 ✓' : '⚠ 与 crowd 不等'} · 过了上限还多买 ${past} 档`
            + ` · ${bigAt} 只一处 ×${(fat * fat / (3 * CHAIN.headRadius(3, 2) ** 2)).toFixed(2)}`);
    // v0.9.9-c's own invariant, and it is the sentence the player signed rather than a re-read of the last one:
    // 「合在一起」不许少扫一寸地, extended to the case √k was never written for — a **fold**. `area(seg)` here is
    // the ground the 段's discs actually cover (seats × πr²), which is the quantity `combat.sweep` grinds the
    // horde with and the quantity `ENEMY.threat` priced the horde against. Every 3合1 pile on a 2-阶 step is
    // walked: the fold must never return less ground than the pile it spent.
    const area = (sg) => chain.visualOf(sg) * Math.PI * chain.radiusOf(sg, sg.tier) ** 2;
    const dpsOf = (sg) => segDps(sg);   // one writer: `combat.segDps`, not a re-typed formula
    let foldLoses = 0, densBad = 0, clampAt = 0;
    for (let n = 3; n <= bigAt; n += 3) {
        const before = { fam: 'cat', tier: 1, count: n };
        const after = { fam: 'cat', tier: 2, count: chain.foldAfter(n, 3) };
        if (area(after) < area(before) - 1e-9 && !foldLoses) foldLoses = n;
        // The other half of the same law, in the units the wave is priced in: damage per m² must not run away
        // with 阶, or §5.4 is charging for a strength the geometry cannot deliver.
        const d0 = dpsOf(before) / area(before) * 1e6, d1 = dpsOf(after) / area(after) * 1e6;
        if (CHAIN.sweepArea && Math.abs(d1 / d0 - 1) > 0.02 && !densBad) densBad = n;
        if (CHAIN.sweepArea && !clampAt
            && chain.radiusOf(after, 2) >= VIEW.fieldMaxR) clampAt = n;
    }
    console.log(`折叠面积: 3–${bigAt} 只每档 1→2 阶 地皮 ${foldLoses ? `⚠ 在 ${foldLoses} 只处变少` : '只增不减 ✓'}`
        + ` · 每百万 px² 的伤害 ${CHAIN.sweepArea ? (densBad ? `⚠ 在 ${densBad} 只处随阶漂移` : '与 阶 无关 ✓（这就是"面积=伤害"的意思）') : '随 阶 变（旧律，见 §9.22）'}`
        + ` · 封顶 ${CHAIN.sweepArea ? (clampAt ? `${clampAt} 只起顶到 ${VIEW.fieldMaxR}px` : '全程未顶') : '不适用'}`);
    chain.reset(0, 0);
    chain.growCap(999);
    for (let k = 0; k < chain.cap; k++) chain.add('cat', 1, bigAt);
    chain.update(1 / 60, 0, 0, 1);
    const seats = chain.nCount;
    chain.segments.length = 0;
    for (let k = 0; k < chain.cap; k++) chain.add('cat', 2, bigAt);
    chain.update(1 / 60, 0, 0, 1);
    console.log(`节圆预算: 满员 ${chain.cap} 段 → 还能进化 ${seats} 体 / 全满线 ${chain.nCount} 体 / 数组 ${chain.maxNodes}`
        + ` · ${seats === chain.cap * CHAIN.nodesMax && chain.nCount === chain.cap
            && chain.maxNodes === (CHAIN.hardCap + FAMILIES.length) * CHAIN.nodesMax
            ? `普通上限${CHAIN.hardCap}段 + 闪光家族预留${FAMILIES.length}段（节点数组有界）PASS`
            : `⚠ 节点预算 ${chain.maxNodes}，预期 ${(CHAIN.hardCap + FAMILIES.length) * CHAIN.nodesMax}`}`);
    chain.segments.length = 0;
}

console.log('\n=== §5.5-D 熔炉: 融核的两头都从同一张表读，所以面板和 sim 不可能各说一套 ===');
{
    const back = [1, 9, 10, 120, 300].map((c) => {
        const r = refund({ count: c });
        return `×${c}→${r.exp}EXP+${r.cores}核`;
    });
    console.log(`放生（${FURNACE.expBack * 100}% EXP + 1 核/${FURNACE.coreEvery} 只） ${back.join(' · ')}`);

    chain.reset(0, 0);
    chain.segments.length = 0;
    for (let i = 0; i < 5; i++) chain.add(FAMILIES[i].id, i >= 2 ? 3 : 1, 60 + i * 20);
    chain.reset(0, 0);
    chain.segments.length = 0;
}
