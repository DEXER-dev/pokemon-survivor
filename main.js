/*
 * Cocos 3.8.8 built from source, driven without the Creator editor: the scene graph, every
 * material and every visual are constructed in code. See docs/游戏设计方案.md §10.5.
 */
import { installBuiltin2DMaterials } from './builtin-materials.js';
import { VIEW, COL, CHAIN, SIM } from './src/config.js';
import { hexToRgb } from './src/batch.js';
import { createGame } from './src/game.js';
import { TRAINER_SPRITES } from './src/trainer-sprites.js';
import { STARTER_POKEMON, STARTER_GENERATIONS } from './src/starter-pokemon.js';
import { installDex } from './src/dex.js';

// Dev cheats (M/T/Y/N/[ ]/F/B/H/L) stay dormant in normal play; append ?debug to the URL to arm them.
try { if (new URLSearchParams(location.search).has('debug')) SIM.debugKeys = true; } catch (_) { /* optional */ }

function fail (err) {
    const status = document.getElementById('boot');
    if (status) {
        status.textContent = '启动失败：' + (err && err.message ? err.message : err);
        status.style.color = '#ff8b8b';
    }
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

// Keep the 16:9 game frame as large as the viewport permits, reserving a line for controls.
function fitFrame () {
    const wrap = document.getElementById('wrap');
    const hint = document.getElementById('hint');
    const hintH = hint && hint.style.display !== 'none' ? hint.getBoundingClientRect().height : 0;
    // The wrapper follows 100dvh/100vw, including native fullscreen. visualViewport can remain
    // pinch-zoomed or briefly stale during fullscreen/orientation transitions, so don't let it
    // shrink the game canvas independently of the actual layout viewport.
    const usableH = Math.max(1, wrap.clientHeight - hintH - 8);
    const usableW = Math.max(1, wrap.clientWidth - 8);
    const ratio = VIEW.W / VIEW.H;
    const cssH = Math.round(Math.min(usableH, usableW / ratio, 1080));
    const cssW = Math.max(1, Math.round(cssH * ratio));
    const dpr = Math.min(2, cc.screen.devicePixelRatio || 1);
    cc.screen.windowSize = new cc.Size(cssW * dpr, cssH * dpr);
    cc.view.setDesignResolutionSize(VIEW.W, VIEW.H, cc.ResolutionPolicy.EXACT_FIT);
    const frame = document.getElementById('GameDiv');
    frame.style.width = cssW + 'px';
    frame.style.height = cssH + 'px';
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
    cc.game.run(() => {
      cc.director.runScene(buildScene());
      const titleScreen = document.getElementById('titleScreen');
      const startButton = document.getElementById('startAdventure');
      installDex(cc, () => !titleScreen.hidden);
      const trainerOptions = document.getElementById('trainerOptions');
      const trainerCurrent = document.getElementById('trainerCurrent');
      const starterOptions = document.getElementById('starterOptions');
      const generationOptions = document.getElementById('generationOptions');
      const trainers = [{ file: 'NPC_198_Lucas.png', name: 'Lucas' }, ...TRAINER_SPRITES];
      let selectedTrainer = 0;
      try {
        const saved = Number(window.localStorage.getItem('pokemon-survivor-trainer'));
        if (Number.isInteger(saved) && saved >= 0 && saved < trainers.length) selectedTrainer = saved;
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
        portrait.style.backgroundImage = `url("./assets/${index === 0 ? 'player' : 'trainers'}/${trainer.file}")`;
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
        if (window.__game && window.__game.setPlayerAppearance) window.__game.setPlayerAppearance(selectedTrainer);
        try { window.localStorage.setItem('pokemon-survivor-trainer', String(selectedTrainer)); } catch (_) { /* optional */ }
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
      const startAdventure = async () => {
        if (hasStarted) return;
        hasStarted = true;
        startButton.disabled = true;
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
        if (game && game.setPlayerAppearance) game.setPlayerAppearance(selectedTrainer);
        if (game && game.setStartingPokemon) game.setStartingPokemon(selectedStarter);
        try { window.localStorage.setItem('pokemon-survivor-trainer', String(selectedTrainer)); } catch (_) { /* optional */ }
        titleScreen.hidden = true;
        document.getElementById('hint').style.display = '';
        // A title-screen keypress must not leak through as the first throw of the run.
        if (window.__game && window.__game.input) window.__game.input.blockFireUntilRelease();
        fitFrame();
        cc.game.resume();
        cc.game.canvas.focus();
      };
      startButton.addEventListener('click', startAdventure);
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
      for (const button of document.querySelectorAll('[data-touch-action]')) {
        const action = button.dataset.touchAction;
        const releaseFire = () => {
          const game = window.__game;
          if (action === 'fire' && game && game.input) game.input.setTouchFire(false);
          button.classList.remove('pressed');
        };
        button.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          event.stopPropagation();
          button.classList.add('pressed');
          if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
          const game = window.__game;
          if (!game) return;
          if (action === 'fire' && game.input) game.input.setTouchFire(true);
          else if (action === 'cycle' && game.cycleTouchMegaSkill) game.cycleTouchMegaSkill();
          else if (action === 'skill' && game.useTouchMegaSkill) game.useTouchMegaSkill();
          else if (action === 'zpower') game.pressAction('z-power');
          else if (action === 'zselect') game.pressAction('z-crystal-select');
          else if (touchKeys[action] !== undefined) game.press(touchKeys[action]);
        });
        button.addEventListener('pointerup', releaseFire);
        button.addEventListener('pointercancel', releaseFire);
        button.addEventListener('lostpointercapture', releaseFire);
      }
      // There is one action on this modal screen, so Tab/Shift+Tab stay on its primary control.
      titleScreen.addEventListener('keydown', (event) => {
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
            && !event.target.closest('.trainer-options')) {
          event.preventDefault();
          startAdventure();
        }
        if (event.key === 'Tab') {
          event.preventDefault();
            const controls = [...generationButtons, ...starterButtons, ...trainerButtons, document.getElementById('trainerPrevious'),
            document.getElementById('trainerNext'), startButton, document.getElementById('dexFromTitle')];
          const index = controls.indexOf(document.activeElement);
          controls[(index + (event.shiftKey ? controls.length - 1 : 1)) % controls.length].focus();
        }
      });
      titleScreen.hidden = false;
      cc.game.pause();
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
        startButton.focus();
    });
} catch (err) {
    fail(err);
}
