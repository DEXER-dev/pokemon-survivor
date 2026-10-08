/*
 * Cocos 3.8.8 built from source, driven without the Creator editor: the scene graph, every
 * material and every visual are constructed in code. See docs/游戏设计方案.md §10.5.
 */
import { installBuiltin2DMaterials } from './builtin-materials.js';
import { VIEW, COL, CHAIN, SIM, BOSS, LEGENDARY_BOSSES, WILD_BOSSES } from './src/config.js';
import { hexToRgb } from './src/batch.js';
import { preloadImages } from './src/atlas.js';
import { createGame } from './src/game.js';
import { TRAINER_SPRITES, PLAYER_APPEARANCES } from './src/trainer-sprites.js';
import { STARTER_POKEMON, STARTER_GENERATIONS } from './src/starter-pokemon.js';
import { iconKeys } from './src/species.js';
import { installDex } from './src/dex.js';
import { GAME_FONT } from './src/ui-font.js';
import { UPDATE_LOG_ENTRIES } from './src/update-log.js';

const nativeAppShell = document.documentElement.dataset.nativeShell === 'true'
    || new URLSearchParams(location.search).has('desktop');
if (nativeAppShell) document.querySelector('.title-download-links')?.remove();

const assetLoading = document.getElementById('assetLoading');
const assetProgressBar = document.getElementById('assetProgressBar');
const assetProgressText = document.getElementById('assetProgressText');
const assetLoadingMessage = document.getElementById('assetLoadingMessage');
const gameFontReady = document.fonts.load(`16px "${GAME_FONT}"`).then((faces) => {
    if (!faces.length) console.warn(`[font] ${GAME_FONT} did not load; using system fallback`);
}).catch((err) => console.warn(`[font] ${GAME_FONT} unavailable; using system fallback`, err));
const gameReadyPromise = new Promise((resolve) => {
    window.addEventListener('pokemon-survivor-game-ready', () => resolve(window.__game), { once: true });
});
const updateAssetProgress = (complete, total, failed) => {
    const percent = total ? Math.floor((complete / total) * 100) : 100;
    assetProgressBar.style.width = `${percent}%`;
    assetProgressBar.parentElement.setAttribute('aria-valuenow', String(percent));
    assetProgressText.textContent = `${complete} / ${total} 张图片${failed ? ` · ${failed} 张未能载入` : ''}`;
};
const initialImagePaths = [
    // Prioritize the small environment atlases that make the world readable. Species,
    // trainer, and upgrade art loads progressively in the background and must not keep
    // the title screen behind a barrier of hundreds of unrelated images.
    'assets/tilesets/KANTO50S_TREE_FAMILIES.png',
    'assets/tilesets/KANTO50S_FLORA_ADDON.png',
    'assets/tilesets/lake-processed/Lake_WATER_CORE_64x64.png',
    'assets/tilesets/lake-processed/Lake_EDGE_TOP_64x16_GAME_GROUND.png',
];
const initialImagesPromise = preloadImages(initialImagePaths, updateAssetProgress);

// Dev cheats (M/T/Y/N/[ ]/F/B/H/L) stay dormant in normal play; append ?debug to the URL to arm them.
try { if (new URLSearchParams(location.search).has('debug')) SIM.debugKeys = true; } catch (_) { /* optional */ }

function fail (err) {
    const status = document.getElementById('boot');
    if (status) {
        status.textContent = '启动失败：' + (err && err.message ? err.message : err);
        status.style.color = '#ff8b8b';
    }
    if (assetLoadingMessage) assetLoadingMessage.textContent = '游戏资源初始化失败';
    if (assetProgressText) assetProgressText.textContent = err && err.message ? err.message : String(err);
    console.error(err);
}

let cc;
try {
    cc = await import('./engine/cc.js');
    if (!cc || !cc.game) throw new Error('engine bundle did not export a usable "cc" module');
    window.cc = cc;
    // The frame pacer is requestAnimationFrame-driven, and a backgrounded tab never fires it -
    // so expose the loop's own entry points to drive boot and simulation by hand.
    window.__step = () => cc.game._updateCallback();
    window.__pump = (n, dt) => {
        for (let i = 0; i < n; i++) cc.director.tick(dt === undefined ? 1 / 60 : dt);
    };
} catch (err) {
    fail(err);
    throw err;
}

const Game = createGame(cc);
cc._decorator.ccclass('Game')(Game);

function rgba (hex) {
    const [r, g, b] = hexToRgb(hex);
    return new cc.Color(r, g, b, 255);
}

function buildScene () {
    const scene = new cc.Scene('petchain');
    scene.layer = cc.Layers.Enum.UI_2D;

    const canvasNode = new cc.Node('Canvas');
    canvasNode.layer = cc.Layers.Enum.UI_2D;
    scene.addChild(canvasNode);

    const camNode = new cc.Node('Camera');
    camNode.layer = cc.Layers.Enum.DEFAULT;
    camNode.setPosition(0, 0, 1000);
    canvasNode.addChild(camNode);

    const cam = camNode.addComponent(cc.Camera);
    cam.projection = cc.Camera.ProjectionType.ORTHO;
    cam.orthoHeight = VIEW.H / 2;
    cam.near = 0;
    cam.far = 1 << 30;
    cam.clearFlags = cc.Camera.ClearFlag.SOLID_COLOR;
    cam.clearColor = rgba(COL.wall);
    cam.visibility = cc.Layers.Enum.UI_2D;

    const canvas = canvasNode.addComponent(cc.Canvas);
    canvas.cameraComponent = cam;

    const view = new cc.Node('View');
    view.layer = cc.Layers.Enum.UI_2D;
    canvasNode.addChild(view);
    view.addComponent(Game);

    return scene;
}

// Fill the available viewport and reserve only the line used by gameplay controls.
function fitFrame () {
    const wrap = document.getElementById('wrap');
    const hint = document.getElementById('hint');
    const hintVisible = hint && hint.style.display !== 'none';
    const hintH = hintVisible ? hint.getBoundingClientRect().height : 0;
    const wrapStyle = getComputedStyle(wrap);
    const horizontalInsets = parseFloat(wrapStyle.paddingLeft) + parseFloat(wrapStyle.paddingRight);
    const verticalInsets = parseFloat(wrapStyle.paddingTop) + parseFloat(wrapStyle.paddingBottom);
    // The wrapper follows 100dvh/100vw, including native fullscreen. visualViewport can remain
    // pinch-zoomed or briefly stale during fullscreen/orientation transitions, so don't let it
    // shrink the game canvas independently of the actual layout viewport.
    // Fill the available viewport; FIXED_HEIGHT lets wide windows reveal more horizontal world
    // instead of leaving letterbox bars or stretching the 2D scene.
    const usableH = Math.max(1, wrap.clientHeight - verticalInsets - hintH - (hintVisible ? 4 : 0));
    const usableW = Math.max(1, wrap.clientWidth - horizontalInsets);
    const cssH = Math.round(usableH);
    const cssW = Math.round(usableW);
    const dpr = Math.min(2, cc.screen.devicePixelRatio || 1);
    cc.screen.windowSize = new cc.Size(cssW * dpr, cssH * dpr);
    cc.view.setDesignResolutionSize(VIEW.W, VIEW.H, cc.ResolutionPolicy.FIXED_HEIGHT);
    const frame = document.getElementById('GameDiv');
    frame.style.width = cssW + 'px';
    frame.style.height = cssH + 'px';
    window.__game?.hud?.setViewport(cc.view.getVisibleSize().width);
}

try {
    document.getElementById('boot').textContent = `引擎 ${cc.ENGINE_VERSION || '?'} 已加载，正在初始化…`;
    await cc.game.init({
        debugMode: cc.DebugMode.INFO,
        settingsPath: '',
        overrideSettings: { screen: { exactFitScreen: false } },
    });
    installBuiltin2DMaterials(cc);
    // settings.json is absent, so the view never got a design resolution and every later window
    // resize would re-apply 0x0.
    cc.view.resizeWithBrowserSize(false);
    fitFrame();
    let fitQueued = false;
    const queueFitFrame = () => {
        if (fitQueued) return;
        fitQueued = true;
        requestAnimationFrame(() => {
            fitQueued = false;
            fitFrame();
        });
    };
    window.addEventListener('resize', queueFitFrame, { passive: true });
    window.addEventListener('orientationchange', queueFitFrame, { passive: true });
    document.addEventListener('fullscreenchange', queueFitFrame);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', queueFitFrame, { passive: true });
    if (window.ResizeObserver) {
        window.__gameFrameObserver = new ResizeObserver(queueFitFrame);
        window.__gameFrameObserver.observe(document.getElementById('wrap'));
    }
    await gameFontReady;
    cc.game.run(() => {
      cc.director.runScene(buildScene());
      const titleScreen = document.getElementById('titleScreen');
      const startButton = document.getElementById('startAdventure');
      const debugBossTools = document.getElementById('debugBossTools');
      const debugBossSelect = document.getElementById('debugBossSelect');
      const debugBossStart = document.getElementById('debugBossStart');
      if (SIM.debugKeys) {
        debugBossTools.hidden = false;
        const debugBossChoices = [
          ...BOSS.encounters.map((encounter, index) => ({
            id: `trainer:${index}`, label: `训练家 BOSS · ${encounter.name}`,
          })),
          ...LEGENDARY_BOSSES.map((boss) => ({ id: boss.id, label: `神兽地点 · ${boss.name}` })),
          ...WILD_BOSSES.map((boss) => ({ id: boss.id, label: `野外强敌 · ${boss.name}` })),
        ];
        for (const choice of debugBossChoices) {
          const option = document.createElement('option');
          option.value = choice.id;
          option.textContent = choice.label;
          debugBossSelect.append(option);
        }
        debugBossSelect.value = 'legend-mewtwo';
      }
      const updateLogDialog = document.getElementById('updateLogDialog');
      const updateLogOpen = document.getElementById('updateLogOpen');
      const updateLogClose = document.getElementById('updateLogClose');
      const updateLogList = document.getElementById('updateLogEntries');
      const downloadLinks = [...titleScreen.querySelectorAll('.title-download-link')];
      const latestUpdate = UPDATE_LOG_ENTRIES[0];
      document.getElementById('updateLogLatestDate').textContent = latestUpdate.date.replaceAll('-', '.');
      updateLogOpen.setAttribute('aria-label',
        `查看更新日志，最近更新：${latestUpdate.title}，${latestUpdate.date}`);
      const updateLogFragment = document.createDocumentFragment();
      for (const entry of UPDATE_LOG_ENTRIES) {
        const article = document.createElement('article');
        article.className = 'update-log-entry';
        const meta = document.createElement('div');
        meta.className = 'update-log-meta';
        const date = document.createElement('time');
        date.dateTime = entry.date;
        date.textContent = entry.date.replaceAll('-', '.');
        const category = document.createElement('span');
        category.className = 'update-log-category';
        category.textContent = entry.category;
        const heading = document.createElement('h3');
        heading.textContent = entry.title;
        const description = document.createElement('p');
        description.textContent = entry.description;
        meta.append(date, category);
        article.append(meta, heading, description);
        updateLogFragment.append(article);
      }
      updateLogList.replaceChildren(updateLogFragment);
      updateLogOpen.addEventListener('click', () => {
        if (typeof updateLogDialog.showModal === 'function') updateLogDialog.showModal();
        else updateLogDialog.setAttribute('open', '');
        updateLogOpen.setAttribute('aria-expanded', 'true');
        updateLogClose.focus();
      });
      const closeUpdateLog = () => {
        if (typeof updateLogDialog.close === 'function' && updateLogDialog.open) updateLogDialog.close();
        else updateLogDialog.removeAttribute('open');
        updateLogOpen.setAttribute('aria-expanded', 'false');
        updateLogOpen.focus();
      };
      updateLogClose.addEventListener('click', closeUpdateLog);
      updateLogDialog.addEventListener('cancel', () => updateLogOpen.setAttribute('aria-expanded', 'false'));
      updateLogDialog.addEventListener('close', () => updateLogOpen.setAttribute('aria-expanded', 'false'));
      updateLogDialog.addEventListener('click', (event) => {
        if (event.target === updateLogDialog) closeUpdateLog();
      });
      installDex(cc, () => !titleScreen.hidden);
      const trainerOptions = document.getElementById('trainerOptions');
      const trainerCurrent = document.getElementById('trainerCurrent');
      const starterOptions = document.getElementById('starterOptions');
      const generationOptions = document.getElementById('generationOptions');
      const titlePokemonField = document.getElementById('titlePokemonField');
      const titleBackgroundKeys = iconKeys();
      const titleLaneCount = 7;
      const buildTitlePokemonFlow = (field, iconsPerRun) => {
        for (let laneIndex = 0; laneIndex < titleLaneCount; laneIndex++) {
          const lane = document.createElement('div');
          lane.className = `title-pokemon-lane${laneIndex % 2 ? ' reverse' : ''}`;
          lane.style.setProperty('--title-travel', `${61 + laneIndex * 12}s`);
          const strip = document.createElement('div');
          strip.className = 'title-pokemon-strip';
          strip.style.animationDelay = `${laneIndex * -8}s`;
          for (let repeat = 0; repeat < 2; repeat++) {
            const run = document.createElement('div');
            run.className = 'title-pokemon-run';
            for (let iconIndex = 0; iconIndex < iconsPerRun; iconIndex++) {
              const rosterOffset = Math.floor(laneIndex * titleBackgroundKeys.length / titleLaneCount);
              const rosterIndex = (rosterOffset
                + Math.floor(iconIndex * titleBackgroundKeys.length / iconsPerRun))
                % titleBackgroundKeys.length;
              const icon = document.createElement('span');
              icon.className = 'title-pokemon-drift-icon';
              icon.style.backgroundImage = `url("./assets/icons/${titleBackgroundKeys[rosterIndex]}.png")`;
              icon.style.setProperty('--title-icon-scale', [0.78, 1.08, 0.91, 1.16][(iconIndex + laneIndex) % 4]);
              icon.style.setProperty('--title-icon-tilt', `${((iconIndex * 17 + laneIndex * 11) % 13) - 6}deg`);
              run.appendChild(icon);
            }
            strip.appendChild(run);
          }
          lane.appendChild(strip);
          field.appendChild(lane);
        }
      };
      buildTitlePokemonFlow(titlePokemonField, 22);
      const qishu = TRAINER_SPRITES[PLAYER_APPEARANCES.qishu - 1];
      const nemona = TRAINER_SPRITES[PLAYER_APPEARANCES.nemona - 1];
      const trainers = [
        { file: 'NPC_198_Lucas.png', name: 'Lucas', id: 'lucas', appearance: PLAYER_APPEARANCES.lucas },
        { ...qishu, id: 'qishu', appearance: PLAYER_APPEARANCES.qishu },
        { ...nemona, id: 'nemona', appearance: PLAYER_APPEARANCES.nemona },
      ];
      let selectedTrainer = 0;
      try {
        const saved = window.localStorage.getItem('pokemon-survivor-trainer');
        // Keep stable IDs and numeric indices saved by earlier builds; removed boss choices fall back to Lucas.
        const savedIndex = trainers.findIndex((trainer) => trainer.id === saved
          || String(trainer.appearance) === saved);
        if (savedIndex >= 0) selectedTrainer = savedIndex;
      } catch (_) { /* Storage can be disabled; the selection still works for this visit. */ }
      const trainerButtons = trainers.map((trainer, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'trainer-option';
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-label', trainer.name);
        const portrait = document.createElement('span');
        portrait.className = 'trainer-portrait';
        portrait.setAttribute('aria-hidden', 'true');
        portrait.style.backgroundImage = `url("./assets/${trainer.appearance === 0 ? 'player' : 'trainers'}/${trainer.file}")`;
        const label = document.createElement('span');
        label.className = 'trainer-option-name';
        label.textContent = trainer.name;
        button.append(portrait, label);
        button.addEventListener('click', () => selectTrainer(index));
        trainerOptions.appendChild(button);
        return button;
      });
      let selectedStarter = STARTER_POKEMON[0].family;
      try {
        const saved = window.localStorage.getItem('pokemon-survivor-starter');
        if (STARTER_POKEMON.some((starter) => starter.family === saved)) selectedStarter = saved;
      } catch (_) { /* Storage can be disabled; the selection still works for this visit. */ }
      let selectedGeneration = STARTER_POKEMON.find((starter) => starter.family === selectedStarter).generation;
      const generationButtons = STARTER_GENERATIONS.map((generation) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'generation-option';
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', 'false');
        button.textContent = `第${generation}世代`;
        button.addEventListener('click', () => selectGeneration(generation));
        generationOptions.appendChild(button);
        return button;
      });
      let starterButtons = [];
      const renderStarterOptions = () => {
        starterOptions.replaceChildren();
        const choices = STARTER_POKEMON.filter((starter) => starter.generation === selectedGeneration);
        starterButtons = choices.map((starter) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'starter-option';
          button.setAttribute('aria-pressed', String(starter.family === selectedStarter));
          button.setAttribute('aria-label', `${starter.name}，${starter.style}`);
          const portrait = document.createElement('span');
          portrait.className = 'starter-portrait';
          portrait.setAttribute('aria-hidden', 'true');
          portrait.style.backgroundImage = `url("./assets/icons/${starter.icon}.png")`;
          const playStarterCry = () => window.__game?.captureSfx?.playCry(starter.icon);
          button.addEventListener('pointerenter', playStarterCry);
          button.addEventListener('focus', playStarterCry);
          const name = document.createElement('span');
          name.className = 'starter-option-name';
          name.textContent = starter.name;
          const style = document.createElement('span');
          style.className = 'starter-option-style';
          style.textContent = starter.style;
          button.append(portrait, name, style);
          button.addEventListener('click', () => selectStarter(starter.family));
          starterOptions.appendChild(button);
          return button;
        });
        generationButtons.forEach((button, index) => {
          button.setAttribute('aria-selected', String(STARTER_GENERATIONS[index] === selectedGeneration));
          button.setAttribute('tabindex', STARTER_GENERATIONS[index] === selectedGeneration ? '0' : '-1');
        });
      };
      const selectStarter = (family) => {
        const starter = STARTER_POKEMON.find((entry) => entry.family === family);
        if (!starter) return;
        selectedStarter = family;
        selectedGeneration = starter.generation;
        renderStarterOptions();
        if (window.__game && window.__game.setStartingPokemon) window.__game.setStartingPokemon(family);
        try { window.localStorage.setItem('pokemon-survivor-starter', family); } catch (_) { /* optional */ }
      };
      const selectGeneration = (generation) => {
        if (!STARTER_GENERATIONS.includes(generation)) return;
        selectedGeneration = generation;
        const choices = STARTER_POKEMON.filter((starter) => starter.generation === generation);
        if (!choices.some((starter) => starter.family === selectedStarter)) selectedStarter = choices[0].family;
        renderStarterOptions();
        selectStarter(selectedStarter);
      };
      const selectTrainer = (index) => {
        selectedTrainer = (index + trainers.length) % trainers.length;
        trainerButtons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === selectedTrainer)));
        trainerCurrent.textContent = `当前形象：${trainers[selectedTrainer].name}`;
        if (window.__game && window.__game.setPlayerAppearance) {
          window.__game.setPlayerAppearance(trainers[selectedTrainer].appearance);
        }
        try { window.localStorage.setItem('pokemon-survivor-trainer', trainers[selectedTrainer].id); } catch (_) { /* optional */ }
        trainerButtons[selectedTrainer].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      };
      renderStarterOptions();
      selectStarter(selectedStarter);
      document.getElementById('trainerPrevious').addEventListener('click', () => selectTrainer(selectedTrainer - 1));
      document.getElementById('trainerNext').addEventListener('click', () => selectTrainer(selectedTrainer + 1));
      selectTrainer(selectedTrainer);
      let hasStarted = false;
      const beginTitleMusic = () => {
        if (!hasStarted && window.__game && window.__game.setMusicMode) {
          window.__game.setMusicMode('title');
        }
      };
      titleScreen.addEventListener('pointerdown', beginTitleMusic, { capture: true });
      const startAdventure = async (debugBossId = null) => {
        if (hasStarted) return;
        hasStarted = true;
        startButton.disabled = true;
        if (debugBossStart) debugBossStart.disabled = true;
        const game = window.__game;
        // Start from the click gesture before mobile fullscreen/orientation awaits, so browsers
        // don't reject the first music playback under their autoplay policy.
        if (game && game.setMusicMode) game.setMusicMode('field');
        if (window.matchMedia('(pointer: coarse)').matches) {
          // Mobile browsers require a user gesture for fullscreen/orientation locking; both are
          // progressive enhancements, so a denial must never prevent the run from starting.
          try {
            if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
              await document.documentElement.requestFullscreen();
            }
            if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
          } catch (_) { /* Some browsers only allow landscape after the user rotates the device. */ }
        }
        if (game && game.trainerSpritesPromise) await game.trainerSpritesPromise;
        if (game && game.setPlayerAppearance) game.setPlayerAppearance(trainers[selectedTrainer].appearance);
        if (game && game.setStartingPokemon) game.setStartingPokemon(selectedStarter);
        try { window.localStorage.setItem('pokemon-survivor-trainer', trainers[selectedTrainer].id); } catch (_) { /* optional */ }
        titleScreen.hidden = true;
        document.getElementById('hint').style.display = 'none';
        // A title-screen keypress must not leak through as the first throw of the run.
        if (window.__game && window.__game.input) window.__game.input.blockFireUntilRelease();
        fitFrame();
        if (debugBossId && game && game.debugStartBoss) game.debugStartBoss(debugBossId);
        cc.game.resume();
        cc.game.canvas.focus();
      };
      startButton.addEventListener('click', startAdventure);
      if (SIM.debugKeys) debugBossStart.addEventListener('click', () => startAdventure(debugBossSelect.value));
      const stick = document.getElementById('touchStick');
      const stickHandle = stick.querySelector('span');
      let stickPointer = -1;
      const updateStick = (event) => {
        const game = window.__game;
        if (!game || !game.input) return;
        const rect = stick.getBoundingClientRect();
        const radius = Math.max(1, rect.width * 0.36);
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const length = Math.hypot(dx, dy);
        const scale = length > radius ? radius / length : 1;
        const nx = dx * scale / radius;
        const ny = -dy * scale / radius;
        game.input.setTouchAxis(nx, ny);
        stickHandle.style.left = `${50 + nx * 34}%`;
        stickHandle.style.top = `${50 - ny * 34}%`;
      };
      stick.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        stickPointer = event.pointerId;
        stick.setPointerCapture(event.pointerId);
        updateStick(event);
      });
      stick.addEventListener('pointermove', (event) => {
        if (event.pointerId === stickPointer) updateStick(event);
      });
      const releaseStick = (event) => {
        if (event.pointerId !== stickPointer) return;
        stickPointer = -1;
        const game = window.__game;
        if (game && game.input) game.input.setTouchAxis(0, 0);
        stickHandle.style.left = '50%';
        stickHandle.style.top = '50%';
      };
      stick.addEventListener('pointerup', releaseStick);
      stick.addEventListener('pointercancel', releaseStick);
      stick.addEventListener('lostpointercapture', releaseStick);
      const touchKeys = { dynamax: cc.KeyCode.KEY_G, restart: cc.KeyCode.KEY_R };
      const touchActions = document.getElementById('touchActions');
      const skillButton = touchActions.querySelector('[data-touch-action="skill"]');
      const cancelSkillButton = touchActions.querySelector('[data-touch-action="cycle"]');
      const touchAimHint = document.getElementById('touchAimHint');
      let skillPointer = -1;
      let skillPointerStart = null;
      let skillPointerDragged = false;
      const setTouchAimUi = (active) => {
        touchActions.classList.toggle('touch-aiming', active);
        skillButton.classList.toggle('touch-aiming-button', active);
        cancelSkillButton.classList.toggle('touch-cancel-slot', active);
        skillButton.innerHTML = active ? '松手<br>释放' : '技能<br>使用';
        cancelSkillButton.innerHTML = active ? '拖到<br>取消' : 'Q<br>切换';
        skillButton.setAttribute('aria-label', active ? '拖动选择技能落点，松手释放' : '按住并拖动选择技能落点，松手释放');
        cancelSkillButton.setAttribute('aria-label', active ? '将技能按钮拖到此处取消技能' : '切换到下一个没有冷却的主动技能');
        if (active) touchAimHint.textContent = '拖动选位置 · 松手释放';
      };
      const updateTouchSkillAim = (event) => {
        const game = window.__game;
        const canvas = cc.game.canvas;
        const rect = canvas && canvas.getBoundingClientRect();
        if (!game || !rect || rect.width <= 0 || rect.height <= 0 || !game.updateTouchMegaSkillAim) return;
        const px = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
        const py = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
        const designScale = VIEW.H / rect.height;
        const zoom = Math.max(0.001, game.cam && game.cam.z || 1);
        const x = game.cam.x + (px - rect.width / 2) * designScale / zoom;
        const y = game.cam.y + (rect.height / 2 - py) * designScale / zoom;
        const inRange = game.updateTouchMegaSkillAim(x, y);
        touchAimHint.textContent = inRange ? '拖动选位置 · 松手释放' : '超出技能距离 · 已贴近最远处';
      };
      const endTouchSkillAim = (event, canceled) => {
        if (skillPointer < 0 || (event && event.pointerId !== skillPointer)) return;
        const game = window.__game;
        if (!canceled && event) {
          if (skillPointerDragged) updateTouchSkillAim(event);
          const rect = cancelSkillButton.getBoundingClientRect();
          canceled = skillPointerDragged && event.clientX >= rect.left && event.clientX <= rect.right
            && event.clientY >= rect.top && event.clientY <= rect.bottom;
        }
        skillPointer = -1;
        skillPointerStart = null;
        skillPointerDragged = false;
        if (game && game.endTouchMegaSkillAim) game.endTouchMegaSkillAim(!!canceled);
        skillButton.classList.remove('pressed');
        setTouchAimUi(false);
      };
      for (const button of document.querySelectorAll('[data-touch-action]')) {
        const action = button.dataset.touchAction;
        if (action === 'skill') {
          button.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (skillPointer >= 0) return;
            const game = window.__game;
            if (!game || !game.beginTouchMegaSkillAim || !game.beginTouchMegaSkillAim()) return;
            skillPointer = event.pointerId;
            skillPointerStart = { x: event.clientX, y: event.clientY };
            skillPointerDragged = false;
            button.classList.add('pressed');
            if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
            if (game.input) game.input.setTouchFire(false);
            setTouchAimUi(true);
          });
          button.addEventListener('pointermove', (event) => {
            if (event.pointerId !== skillPointer || !skillPointerStart) return;
            if (!skillPointerDragged
                && Math.hypot(event.clientX - skillPointerStart.x, event.clientY - skillPointerStart.y) >= 10) {
              skillPointerDragged = true;
            }
            if (skillPointerDragged) updateTouchSkillAim(event);
          });
          button.addEventListener('pointerup', (event) => endTouchSkillAim(event, false));
          button.addEventListener('pointercancel', (event) => endTouchSkillAim(event, true));
          button.addEventListener('lostpointercapture', (event) => endTouchSkillAim(event, true));
          continue;
        }
        const releaseFire = () => {
          const game = window.__game;
          if (action === 'fire' && game && game.input) game.input.setTouchFire(false);
          button.classList.remove('pressed');
        };
        button.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const game = window.__game;
          if (!game) return;
          // The other finger may keep steering with the left stick, but no right-side action can
          // fire or switch the selected skill while this finger is choosing its landing point.
          if (game.touchSkillAiming) return;
          button.classList.add('pressed');
          if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
          if (action === 'fire' && game.input) game.input.setTouchFire(true);
          else if (action === 'cycle' && game.cycleTouchMegaSkill) game.cycleTouchMegaSkill();
          else if (action === 'zpower') game.pressAction('z-power');
          else if (action === 'zselect') game.pressAction('z-crystal-select');
          else if (touchKeys[action] !== undefined) game.press(touchKeys[action]);
        });
        button.addEventListener('pointerup', releaseFire);
        button.addEventListener('pointercancel', releaseFire);
        button.addEventListener('lostpointercapture', releaseFire);
      }
      // Keep the title-screen pickers and utility buttons reachable with Tab/Shift+Tab.
      titleScreen.addEventListener('keydown', (event) => {
        if (updateLogDialog.open) return;
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          if (event.target.closest('.starter-options')) {
            const choices = STARTER_POKEMON.filter((starter) => starter.generation === selectedGeneration);
            const index = choices.findIndex((starter) => starter.family === selectedStarter);
            selectStarter(choices[(index + choices.length - 1) % choices.length].family);
          } else if (event.target.closest('.generation-options')) {
            const index = STARTER_GENERATIONS.indexOf(selectedGeneration);
            selectGeneration(STARTER_GENERATIONS[(index + STARTER_GENERATIONS.length - 1) % STARTER_GENERATIONS.length]);
          } else selectTrainer(selectedTrainer - 1);
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          if (event.target.closest('.starter-options')) {
            const choices = STARTER_POKEMON.filter((starter) => starter.generation === selectedGeneration);
            const index = choices.findIndex((starter) => starter.family === selectedStarter);
            selectStarter(choices[(index + 1) % choices.length].family);
          } else if (event.target.closest('.generation-options')) {
            const index = STARTER_GENERATIONS.indexOf(selectedGeneration);
            selectGeneration(STARTER_GENERATIONS[(index + 1) % STARTER_GENERATIONS.length]);
          } else selectTrainer(selectedTrainer + 1);
        } else if (event.key === 'Enter' && event.target !== startButton
            && event.target !== document.getElementById('dexFromTitle')
            && !event.target.closest('.title-download-link')
            && event.target !== updateLogOpen
            && event.target !== debugBossSelect
            && event.target !== debugBossStart
            && !event.target.closest('.trainer-options')) {
          event.preventDefault();
          startAdventure();
        }
        if (event.key === 'Tab') {
          event.preventDefault();
            const controls = [...generationButtons, ...starterButtons, ...trainerButtons, document.getElementById('trainerPrevious'),
            document.getElementById('trainerNext'), startButton,
            ...(SIM.debugKeys ? [debugBossSelect, debugBossStart] : []),
            ...downloadLinks, document.getElementById('dexFromTitle')];
          controls.push(updateLogOpen);
          const index = controls.indexOf(document.activeElement);
          controls[(index + (event.shiftKey ? controls.length - 1 : 1)) % controls.length].focus();
        }
      });
      titleScreen.hidden = true;
      startButton.disabled = true;
      fitFrame();
      document.getElementById('boot').style.display = 'none';
      document.getElementById('GameDiv').style.display = '';
        // The 按键表 is the first sentence he reads in the page, so the price inside it is written by the
        // rule that charges it and not by a string: 「E 按图鉴进化」 was accurate while `priceOf` walked the
        // dex ladder, and v0.9.9's `evolveFlat` makes it a half-truth about 只数 (§9.13-⑥, §9.17-⑤).
        document.getElementById('hint').textContent = `宠列 · WASD/方向键或按住鼠标移动 · Space/J 连掷`
            + ` · 轻点=只打瞄准那一只 · E 手动进化 · ${CHAIN.evolveFlat ? `同族 ${CHAIN.evolveFlat} 只自动进化` : '按图鉴条件进化'}`
            + `（${Number.isFinite(CHAIN.autoCold) ? `同一摞放手 ${CHAIN.autoCold} 秒也自己折` : '够大的摞会自己折'}）`
            + ` · Q选择MEGA技能 / X释放区域技 · 升级 1/2/3 选卡`
            + (SIM.debugKeys ? ' · DEBUG：L 获得澳大利亚老鼠' : '');
        document.getElementById('hint').style.display = 'none';
        fitFrame();
        assetLoading.hidden = false;
        assetLoadingMessage.textContent = '正在启动游戏场景…';
        void (async () => {
            const game = await gameReadyPromise;
            cc.game.pause();
            assetLoadingMessage.textContent = '正在读取宝可梦精灵图…';
            const imageResult = await initialImagesPromise;
            assetProgressBar.style.width = '100%';
            assetProgressBar.parentElement.setAttribute('aria-valuenow', '100');
            assetProgressText.textContent = imageResult.failed
                ? `${imageResult.failed} 张图片不可用，将使用默认图形继续`
                : `${imageResult.loaded} 张图片已读取`;
            if (!game || !game.visualAssetsReadyPromise) throw new Error('游戏精灵图集尚未初始化');
            assetLoadingMessage.textContent = '正在创建游戏纹理…';
            await game.visualAssetsReadyPromise;
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            assetLoading.hidden = true;
            titleScreen.hidden = false;
            startButton.disabled = false;
            startButton.focus();
        })().catch(fail);
    });
} catch (err) {
    fail(err);
}
