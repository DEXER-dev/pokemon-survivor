import assert from 'node:assert/strict';
import { BOSS, ENEMY, PLAYER } from '../src/config.js';
import { EnemySystem } from '../src/enemies.js';
import { TrainerBossSystem } from '../src/trainer-boss.js';
import { makeRng } from '../src/rng.js';

const setup = (chapter = 0) => {
    const enemies = new EnemySystem(ENEMY, makeRng(239));
    const boss = new TrainerBossSystem();
    boss.start(enemies, 0, 0, chapter, 1, chapter);
    boss.formationLeft = 0; enemies.trainerIntro = 0;
    return { enemies, boss };
};
for (let chapter = 0; chapter < 10; chapter++) {
    const { boss, enemies } = setup(chapter);
    const hero = { x: boss.arenaR * 0.8, y: 0, vx: 0, vy: 140, hurt: () => true };
    boss.cooldown.fill(50); boss.commandCooldown = 0;
    const fired = [];
    const fire = boss._fire.bind(boss);
    boss._fire = (slot, x, y) => { fired.push({ slot, clock: boss.clock }); fire(slot, x, y); };
    boss.step(1 / 60, enemies, hero);
    assert.equal(boss.lastCommandMode, 0);
    assert(boss.commandRole.includes(-2), 'A blocker must cut one escape side');
    const source = boss._liveRow(0, enemies);
    const x = enemies.x[source], y = enemies.y[source];
    const firstAim = boss.aim[0];
    hero.y += 60;
    boss.step(0.1, enemies, hero);
    assert.equal(enemies.x[source], x);
    assert.equal(enemies.y[source], y);
    assert.notEqual(boss.aim[0], firstAim, 'Early warning should react to movement');
    while (boss.warning[0] > 0.26) boss.step(1 / 120, enemies, hero);
    const lockedAim = boss.aim[0];
    hero.y -= 200;
    boss.step(0.1, enemies, hero);
    assert.equal(boss.aim[0], lockedAim, 'Late warning gives a committed dodge window');
    while (fired.length < boss.party.length) boss.step(1 / 120, enemies, hero);
    assert(fired.at(-1).clock - fired[0].clock >= 0.5, 'Team attacks must release in stages');
    assert(boss.commandRecovery > 1, 'A completed combo leaves a counterattack window');
    const count = fired.length;
    boss.step(0.4, enemies, hero);
    assert.equal(fired.length, count);
    boss.warning.fill(0);
    assert(boss._startCommand(enemies, hero));
    assert.notEqual(boss.lastCommandMode, 0, 'Do not repeat the same team instruction');
    boss.reset(enemies);
    assert(boss.volleySpec.every(spec => spec === null));
    assert(boss.commandRole.every(role => role === -1));
}

// Defeated partners stop participating; the last member accelerates instead of idling.
{
    const { boss, enemies } = setup(0);
    for (let slot = 1; slot < boss.party.length; slot++) {
        const row = boss._liveRow(slot, enemies);
        enemies.dead[row] = 1; enemies.hp[row] = 0;
        boss.commandRole[slot] = 0; boss.warning[slot] = 1;
    }
    boss.cooldown.fill(0); boss.commandCooldown = 50;
    boss.step(1 / 60, enemies, { x: 0, y: 0, vx: 0, vy: 0, hurt: () => true });
    assert.equal(boss.warning[1], 0);
    assert.equal(boss.commandRole[1], -1);
    const expected = boss.party[0].period * (boss.phaseTwo ? BOSS.phaseTwoPeriodMul : 1) * 0.68;
    assert(Math.abs(boss.cooldown[0] - expected) < 1e-5);
}

// Unchanging movement should carry risk, even without additional contact damage.
for (const style of ['stand', 'circle']) {
    const { boss, enemies } = setup(0);
    let hits = 0, invuln = 0;
    const hero = { x: 0, y: 0, vx: 0, vy: 0,
        hurt () { if (invuln > 0) return false; invuln = PLAYER.iFrame; hits++; return true; } };
    for (let i = 0; i < 60 * 30; i++) {
        const t = i / 60, radius = boss.arenaR * 0.62, angularSpeed = PLAYER.speed / radius;
        invuln = Math.max(0, invuln - 1 / 60);
        if (style === 'circle') {
            hero.x = Math.cos(t * angularSpeed) * radius;
            hero.y = Math.sin(t * angularSpeed) * radius;
            hero.vx = -Math.sin(t * angularSpeed) * PLAYER.speed;
            hero.vy = Math.cos(t * angularSpeed) * PLAYER.speed;
        }
        boss.step(1 / 60, enemies, hero);
        assert(boss.n <= 96, 'Hostile bullet pool must stay bounded');
    }
    assert(hits > 0, `${style} movement should no longer be automatically safe`);
    console.log(`Opening trainer: ${style}, ${hits} hits / 30 seconds`);
}
console.log('Trainer tactics PASS: 10 chapters, blockers, tracking/lock, staggered release, counterattack window, command variety and movement pressure');
