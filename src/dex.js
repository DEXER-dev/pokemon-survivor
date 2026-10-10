/* Isolated training arena; attacks and active forms reuse the production combat systems. */
import { CHAIN, ENEMY, FAMILIES, PLAYER, PLAYER_HP, SKILLS } from './config.js';
import { SkillSystem } from './skills.js';
import { EnemySystem } from './enemies.js';
import { Player } from './player.js';
import { makeRng } from './rng.js';
import { lateDamageMultiplier } from './combat.js';
import { DEX_PREVIEW_ZOOM, setDexPreviewSimulation } from './game.js';
import { lineTop } from './chain.js';
import { SPECIES, displayName, dexText, typeText, iconKey, stepOf, condText } from './species.js';
import { SKILL_INFO } from './skill-info.js';
import { ROSTER_ACTIVE_FORMS } from './skills/active/roster/index.js';
import { MEGA_FORMS } from './mega.js';
import { GIGANTAMAX_FORMS } from './gigantamax.js';
import { activeSkillForForm } from './skills/registry.js';
import { FORM as HO_OH_FORM } from './skills/active/legendary/ho-oh.js';
import { LEGENDARY_ACTIVE_FORMS } from './skills/active/legendary/other-legendaries.js';
import { hasCompanionSignature } from './skills/active/legendary/companion-bombardment.js';

const W = 640, H = 360;
const at = (v, tier) => Array.isArray(v) ? v[Math.min(tier - 1, v.length - 1)] : v;
const $ = (id) => document.getElementById(id);
const kindName = { bullet: '弹幕', beam: '光束', field: '领域', garden: '花园', lunge: '突进', orbit: '环绕' };
const icon = (key) => key ? `assets/icons/${encodeURIComponent(key)}.png` : '';

function indexDexTargets (enemies) {
    // Training targets stay still, so they do not pass through EnemySystem.update like live mobs.
    // SkillSystem acquires every target through this grid; without indexing them, preview shots never fire.
    enemies.grid.clear();
    for (let i = 0; i < enemies.n; i++) {
        if (!enemies.dead[i]) enemies.grid.insert(i, enemies.x[i], enemies.y[i]);
    }
}

function createPreviewFlora (player) {
    const plants = [
        [-190, -128, 4], [-46, -196, 0], [164, -132, 9],
        [236, 42, 6], [98, 176, 2], [-174, 154, 11],
    ].map(([dx, dy, frameIndex]) => ({
        x: player.x + dx, y: player.y + dy, frameIndex, size: 64, scale: 1,
    }));
    const planted = [];
    const scratch = [];
    let sequence = 0;
    return {
        plants,
        plant (x, y) {
            const index = sequence++;
            const frameIndex = index % 2 === 0 ? index % 4 : 8 + index % 4;
            if (planted.length >= 12) {
                plants.splice(6, 1);
                planted.shift();
            }
            const plant = { x, y, frameIndex, size: 58, scale: 0.88 };
            planted.push(plant);
            plants.push(plant);
            return plant;
        },
        firingPlants (x, y, radius, limit = 8, cursor = 0) {
            scratch.length = 0;
            const radius2 = radius * radius;
            let total = 0;
            for (const plant of plants) {
                const dx = plant.x - x;
                const dy = plant.y - y;
                if (dx * dx + dy * dy <= radius2) total++;
            }
            scratch.total = total;
            if (!total || limit <= 0) return scratch;
            const start = cursor % total;
            const wanted = Math.min(limit, total);
            for (let pass = 0; pass < 2 && scratch.length < wanted; pass++) {
                let index = 0;
                for (const plant of plants) {
                    const dx = plant.x - x;
                    const dy = plant.y - y;
                    if (dx * dx + dy * dy > radius2) continue;
                    const current = index++;
                    if (pass === 0 ? current < start : current >= start) continue;
                    scratch.push(plant);
                    if (scratch.length >= wanted) break;
                }
            }
            return scratch;
        },
    };
}

export function makeDexArena (fam, tier, count, target) {
    const cfg = SKILLS[fam.id];
    const seg = { fam: fam.id, tier, count, kind: fam.kind, shiny: false, affixes: [] };
    const player = new Player(PLAYER, PLAYER_HP);
    player.x = 640;
    player.y = 360;
    const targetWorld = {
        x: player.x + (target.x - W / 2) * 2 / DEX_PREVIEW_ZOOM,
        y: player.y + (target.y - H / 2) * 2 / DEX_PREVIEW_ZOOM,
    };
    const bulkOf = () => fam.id === 'tandemaus' ? 1
        : Math.min(lineTop(fam.id, tier) ? CHAIN.topBulk : CHAIN.nodesMax,
            1 + Math.floor(count / CHAIN.nodeEvery));
    const chain = {
        segments: [seg], nCount: 1, segIndex: new Int16Array([0]),
        nx: new Float64Array([player.x - 34]), ny: new Float64Array([player.y]),
        bx: new Float64Array([player.x - 34]), by: new Float64Array([player.y]),
        ox: new Float32Array(1), oy: new Float32Array(1),
        na: new Float64Array([Math.PI]), nspd: new Float32Array([0]), bulkOf,
        headOf: (index) => index === 0 ? 0 : -1,
        companionCountOf: () => count,
    };
    const enemies = new EnemySystem(ENEMY, { next: () => 0.5 });
    // A target at the cursor center overlaps the preview player when the page opens, so fast shots
    // hit during their launch tick and appear only as impact bursts. Keep the nearest dummy far
    // enough from the muzzle for its live projectile sprite and native particle trail to read.
    const points = [[115, 0], [150, -124], [230, 92], [80, 136]];
    for (const [dx, dy] of points) {
        const i = enemies.spawn(targetWorld.x + dx, targetWorld.y + dy, 0, 1, false, 0, 0, -1, 1, 1, false, false);
        enemies.hp[i] = enemies.maxhp[i] = 100000;
        enemies.r[i] = 15;
    }
    indexDexTargets(enemies);
    const skills = new SkillSystem();
    const flora = createPreviewFlora(player);
    const fxCount = 40;
    const arena = {
        fam, cfg, seg, chain, enemies, skills, player, flora,
        build: { dmg: 1, fireRate: 1, skillSize: 1, splashR: 1, stacks: Object.create(null) },
        camera: { x: player.x, y: player.y, z: DEX_PREVIEW_ZOOM },
        visibleSize: { width: W, height: H },
        rng: makeRng(0xD3C5), megaFx: Array.from({ length: 36 }, () => ({
            active: false, x: 0, y: 0, angle: 0, age: 0, duration: 0, form: null,
            hit: false, area: false, radius: 0, shape: '', width: 0, segment: null, sustain: false,
        })),
        megaFxSlot: 0, rillaboomFields: [], alcremieCakes: [],
        ripples: {
            x: new Float32Array(fxCount), y: new Float32Array(fxCount),
            r0: new Float32Array(fxCount), r1: new Float32Array(fxCount),
            t: new Float32Array(fxCount), life: new Float32Array(fxCount),
            hue: new Uint8Array(fxCount), n: 0, slot: 0,
        },
        target: targetWorld, aimWorld: targetWorld, heading: Math.PI, time: 0, wall: 0, level: 1,
    };
    return arena;
}

export function installDex (cc, isTitleVisible) {
    const dialog = $('dexDialog'), canvas = $('dexArena'), ctx = canvas.getContext('2d');
    // The Pokédex needs the full viewport on phones, independent of the game frame.
    document.body.append(dialog);
    const list = $('dexList'), search = $('dexSearch');
    const countInput = $('dexCount'), activeSelect = $('dexActiveForm');
    const families = FAMILIES.filter((fam, index) => SPECIES[fam.id]
        && FAMILIES.findIndex((other) => other.id === fam.id) === index)
        .sort((a, b) => SPECIES[a.id].dex[0] - SPECIES[b.id].dex[0]);
    let fam = families[0], tier = 1, count = 1, arena = null, target = { x: 385, y: 180 };
    let formOptions = [], pendingCast = null;
    let accumulator = 0, returnFocus = null;
    function resetArena () {
        arena = makeDexArena(fam, tier, count, target);
        applySelectedForm();
        pendingCast = null;
        accumulator = 0;
        syncRuntimePreview();
        updateCastButton();
    }
    function syncRuntimePreview () {
        if (dialog.hidden) return;
        setDexPreviewSimulation({
            accumulator,
            getArena: () => arena,
            step,
            aimOffset: () => ({
                x: (target.x - W / 2) * 2 / DEX_PREVIEW_ZOOM,
                y: (target.y - H / 2) * 2 / DEX_PREVIEW_ZOOM,
            }),
            consumeCastRequest: () => { const request = pendingCast; pendingCast = null; return request; },
            iconKey: () => iconKey(fam.id, tier),
        });
    }
    function updateList () {
        const q = search.value.trim().toLowerCase();
        list.replaceChildren();
        for (const f of families) {
            const s = SPECIES[f.id];
            if (q && ![...s.zh, ...s.en, ...s.dex.map(String)].some((v) => v.toLowerCase().includes(q))) continue;
            const b = document.createElement('button');
            b.type = 'button'; b.setAttribute('role', 'option');
            b.setAttribute('aria-selected', String(f.id === fam.id));
            const img = document.createElement('img'); img.src = icon(iconKey(f.id, 1)); img.alt = '';
            const span = document.createElement('span'); span.textContent = `${dexText(f.id, 1)} · ${displayName(f.id, 1)}`;
            b.append(img, span); b.addEventListener('click', () => {
                fam = f; tier = 1; count = f.id === 'tandemaus' ? 8 : 1;
                countInput.value = String(count); updateList(); updateDetails();
            });
            list.append(b);
        }
    }
    function updateDetails () {
        $('dexLegendaryCast').hidden = !hasCompanionSignature({ fam: fam.id });
        $('dexNumber').textContent = dexText(fam.id, tier);
        $('dexName').textContent = displayName(fam.id, tier);
        $('dexType').textContent = `${typeText(fam.id, tier)} · ${fam.id === 'chikorita' ? '花园弹幕' : fam.kind}`;
        $('dexPortrait').replaceChildren();
        const img = document.createElement('img'); img.src = icon(iconKey(fam.id, tier)); img.alt = '';
        $('dexPortrait').append(img);
        $('dexStages').replaceChildren();
        for (let t = 1; t <= SPECIES[fam.id].zh.length; t++) {
            const b = document.createElement('button'); b.type = 'button';
            b.setAttribute('aria-pressed', String(t === tier));
            b.textContent = `${t}阶 ${displayName(fam.id, t)}`;
            b.addEventListener('click', () => { tier = t; updateDetails(); });
            $('dexStages').append(b);
        }
        const step = stepOf(fam.id, tier);
        $('dexEvolution').textContent = step ? `下一阶：${condText(step)}` : '当前图鉴线到顶 · 再收服同族可增加体型与弹幕尺寸';
        $('dexCountValue').textContent = String(count);
        const cfg = SKILLS[fam.id];
        const info = SKILL_INFO[fam.id]?.forms?.[tier - 1];
        $('dexPassiveName').textContent = `自动主技 · ${info?.[0] || kindName[cfg?.fire] || '无'}`;
        $('dexPassiveInfo').textContent = cfg
            ? `${info?.[1] || kindName[cfg.fire] || ''} · ${kindName[cfg.fire] || cfg.fire} · 间隔 ${cfg.cd?.toFixed(2) || '—'} 秒${cfg.shots ? ` · 每轮 ${at(cfg.shots, tier)} 发` : ''}`
            : '这一形态没有独立自动主技。';
        formOptions = [
            ...ROSTER_ACTIVE_FORMS.filter((f) => f.fam === fam.id && f.tier === tier),
            ...MEGA_FORMS.filter((f) => f.fam === fam.id && tier === SPECIES[fam.id].zh.length),
            ...GIGANTAMAX_FORMS.filter((f) => f.fam === fam.id && tier === f.tier),
            ...(fam.id === 'legend-hooh' ? [HO_OH_FORM] : LEGENDARY_ACTIVE_FORMS.filter((f) => f.fam === fam.id)),
        ];
        activeSelect.replaceChildren();
        for (const form of formOptions) {
            const option = document.createElement('option'); option.value = form.id;
            option.textContent = form.category ? `${form.category} · ${form.name || form.megaName}` : (form.name || form.megaName || form.id);
            activeSelect.append(option);
        }
        activeSelect.hidden = !formOptions.length;
        updateActiveInfo();
        resetArena();
    }
    function selectedActive () {
        const form = formOptions.find((f) => f.id === activeSelect.value);
        return form ? { form, skill: activeSkillForForm(form) } : null;
    }
    function applySelectedForm () {
        if (!arena) return;
        const entry = selectedActive();
        const form = entry?.form;
        arena.seg.mega = form && !form.gigantamax && MEGA_FORMS.some((mega) => mega.id === form.id)
            ? form.id : null;
        arena.seg.gigantamax = form?.gigantamax ? form.id : null;
        arena.seg.megaSkillCd = 0;
        arena.seg.megaCd = 0.45;
    }
    function updateActiveInfo () {
        const entry = selectedActive();
        $('dexActiveName').textContent = entry ? `主动技能 · ${entry.skill.name}` : '主动技能 · 未解锁';
        $('dexActiveInfo').textContent = entry
            ? entry.skill.shape === 'charizard-x-cross'
                ? `${entry.form.name || entry.form.megaName}专属 · 玩家选点 · 升空后释放全屏 X 形蓝焰 · 冷却 ${entry.skill.cooldown || 0} 秒`
                : `${entry.form.name || entry.form.megaName}专属 · 冷却 ${entry.skill.cooldown || 0} 秒 · ${entry.skill.radius ? `范围 ${entry.skill.radius}px` : entry.skill.range ? `距离 ${entry.skill.range}px` : '特殊效果'}${entry.skill.duration ? ` · 持续 ${entry.skill.duration} 秒` : ''} · 使用正式技能与粒子系统，命中仅作用于训练靶`
            : '当前阶没有可释放的主动技能；部分最终形态可通过 MEGA 或超极巨化解锁。';
        $('dexCast').hidden = !entry;
        if (entry?.skill.description) {
            $('dexActiveInfo').textContent = `${entry.form.name || entry.form.megaName}专属 · ${entry.skill.description} · 冷却 ${entry.skill.cooldown} 秒 · 持续 ${entry.skill.duration} 秒`;
        }
        updateCastButton();
    }
    function updateCastButton () {
        const remaining = Math.max(0, arena?.seg.megaSkillCd || 0);
        $('dexCast').disabled = remaining > 0 || !!pendingCast;
        $('dexCast').textContent = pendingCast ? '施放中…'
            : remaining > 0 ? `冷却 ${remaining.toFixed(1)} 秒` : '释放主动技能';
    }
    function step (dt) {
        if (!arena) return;
        arena.time += dt;
        arena.wall += dt;
        arena.target.x = arena.player.x + (target.x - W / 2) * 2 / DEX_PREVIEW_ZOOM;
        arena.target.y = arena.player.y + (target.y - H / 2) * 2 / DEX_PREVIEW_ZOOM;
        indexDexTargets(arena.enemies);
        for (let i = 0; i < arena.enemies.n; i++) {
            if (arena.enemies.flash[i] > 0) arena.enemies.flash[i] = Math.max(0, arena.enemies.flash[i] - dt);
        }
        if (arena.seg.megaSkillCd > 0) arena.seg.megaSkillCd = Math.max(0, arena.seg.megaSkillCd - dt);
        if (arena.cfg) {
            arena.skills.splashMul = arena.build.splashR || 1;
            arena.skills.step(dt, arena.chain, arena.enemies,
                arena.build.dmg * lateDamageMultiplier(arena.level), arena.player.maxSpeed,
                arena.build.skillSize, null, arena.build.fireRate, arena.flora);
        }
        updateCastButton();
    }
    function draw () {
        if (dialog.hidden) return;
        const renderedGame = document.getElementById('GameCanvas');
        if (!renderedGame) return;
        try {
            ctx.clearRect(0, 0, W, H);
            // Cocos preserves this camera frame so its actual ParticleSystem2D output can be
            // downscaled into the Pokédex viewport without redrawing particles in Canvas2D.
            // SHOW_ALL preserves the training room's 16:9 camera on every window shape.
            // Copy only that viewport, excluding the surrounding letterbox bars.
            const viewport = cc.view.getViewportRect();
            if (viewport.width <= 0 || viewport.height <= 0) return;
            ctx.drawImage(renderedGame, viewport.x,
                renderedGame.height - viewport.y - viewport.height,
                viewport.width, viewport.height, 0, 0, W, H);
        } catch (error) {
            console.warn('[dex] native preview capture failed:', error);
        }
    }
    function open (source) {
        if (!dialog.hidden) return;
        returnFocus = source || document.activeElement;
        dialog.hidden = false; document.body.classList.add('game-modal-open', 'dex-opened');
        window.dispatchEvent(new Event('dex-viewport-change'));
        $('wrap').setAttribute('inert', '');
        window.__game?.input?._blur?.();
        updateList(); updateDetails();
        // The title screen deliberately pauses Cocos; resume only the render loop so the isolated
        // Pokédex scene can animate. Its Game.update branch freezes the real run while this is open.
        cc.director.on(cc.Director.EVENT_AFTER_DRAW, draw);
        cc.game.resume();
        $('dexClose').focus();
    }
    function close () {
        if (dialog.hidden) return;
        dialog.hidden = true; document.body.classList.remove('dex-opened');
        window.dispatchEvent(new Event('dex-viewport-change'));
        $('wrap').removeAttribute('inert');
        if (!isTitleVisible()) document.body.classList.remove('game-modal-open');
        setDexPreviewSimulation(null, isTitleVisible());
        cc.director.off(cc.Director.EVENT_AFTER_DRAW, draw);
        window.__game?.input?._blur?.();
        returnFocus?.focus?.();
    }
    $('dexFromTitle').addEventListener('click', (e) => open(e.currentTarget));
    $('dexClose').addEventListener('click', close);
    $('dexReset').addEventListener('click', resetArena);
    $('dexLegendaryCast').addEventListener('click', () => {
        if (!arena || !hasCompanionSignature(arena.seg)) return;
        arena.seg.legendaryBombardment = { phase: 'cooldown', timer: 0, x: 0, y: 0, radius: 0 };
    });
    $('dexCast').addEventListener('click', () => {
        const entry = selectedActive();
        if (!entry || arena.seg.megaSkillCd > 0 || pendingCast) return;
        pendingCast = entry.form;
        updateCastButton();
    });
    activeSelect.addEventListener('change', () => {
        pendingCast = null;
        resetArena();
        updateActiveInfo();
    });
    search.addEventListener('input', updateList);
    search.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowDown') return;
        const first = list.querySelector('button');
        if (first) { event.preventDefault(); first.focus(); }
    });
    list.addEventListener('keydown', (event) => {
        const delta = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1
            : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 0;
        if (!delta) return;
        const buttons = [...list.querySelectorAll('button')];
        const index = buttons.indexOf(document.activeElement);
        if (index < 0 || !buttons.length) return;
        event.preventDefault();
        const next = buttons[(index + delta + buttons.length) % buttons.length];
        next.click(); list.querySelector('button[aria-selected="true"]')?.focus();
    });
    countInput.addEventListener('input', () => { count = Number(countInput.value); $('dexCountValue').textContent = String(count); resetArena(); });
    const aim = (event) => {
        const rect = canvas.getBoundingClientRect();
        target.x = Math.max(215, Math.min(600, (event.clientX - rect.left) * W / rect.width));
        target.y = Math.max(25, Math.min(335, H - (event.clientY - rect.top) * H / rect.height));
        if (arena) {
            arena.target.x = arena.player.x + (target.x - W / 2) * 2 / DEX_PREVIEW_ZOOM;
            arena.target.y = arena.player.y + (target.y - H / 2) * 2 / DEX_PREVIEW_ZOOM;
        }
    };
    canvas.addEventListener('pointerdown', (event) => { canvas.setPointerCapture(event.pointerId); aim(event); });
    canvas.addEventListener('pointermove', (event) => { if (event.buttons) aim(event); });
    dialog.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') { event.preventDefault(); close(); return; }
        if (event.key === 'Tab') {
            const controls = [...dialog.querySelectorAll('button:not([hidden]):not([disabled]),input:not([hidden]),select:not([hidden])')];
            const i = controls.indexOf(document.activeElement);
            if ((event.shiftKey && i === 0) || (!event.shiftKey && i === controls.length - 1)) {
                event.preventDefault(); controls[event.shiftKey ? controls.length - 1 : 0].focus();
            }
        }
    });
    return { open, close };
}
