import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { CombatSfx, resolveCombatSound } from '../src/combat-sfx.js';
import { LegendaryAttackSystem } from '../src/legendary-attacks.js';

let now = 10000;
const originalNow = Date.now;
Date.now = () => now;
const played = [];
class AudioSource {}
const cc = { AudioSource, assetManager: { loadRemote: (url, options, cb) => cb(null, { url }) } };
const node = { addComponent: () => ({ isValid: true,
    playOneShot: (clip, volume) => played.push({ file: clip.url, volume, at: now }), stop () {} }) };
const rng = { next: () => 0.8 }; // Include phase-two second volleys.
try {
    const files = new Set();
    for (let move = 0; move < 5; move++) {
        const sound = resolveCombatSound({ kind: 'lugia-boss-release', moveIndex: move });
        assert(existsSync(new URL(`../assets/audio/${sound.file}`, import.meta.url)));
        files.add(sound.file);
        const audio = new CombatSfx(cc, node);
        const attack = new LegendaryAttackSystem();
        attack.start(0, 0, 'legend-lugia');
        attack._buildPattern(rng, 300, 0, 0, 0, true, move);
        attack.attackCount = 1;
        attack.phase = 'warning'; attack.timeLeft = attack.windupDuration;
        played.length = 0;
        audio.syncLugiaAttack(attack); audio.flush(now);
        assert.equal(played.length, 1);
        assert(played[0].file.endsWith('charge.ogg'));
        audio.syncLugiaAttack(attack); audio.flush(now);
        assert.equal(played.length, 1, 'Charge cannot repeat each frame');
        now += attack.windupDuration * 1000;
        attack.step(attack.timeLeft, 600, 600, rng);
        const launchAt = now;
        const delays = [...new Set(attack.areas.flatMap(route =>
            attack.lugiaShots.map(shot => shot + (route.delay || 0))))].sort((a, b) => a - b);
        audio.syncLugiaAttack(attack); audio.flush(now);
        const beforePause = played.length;
        now += 1000;
        audio.syncLugiaAttack(attack); audio.flush(now);
        assert.equal(played.length, beforePause, 'Frozen simulation cannot launch future sounds');
        now -= 1000;
        for (let i = 0; i < Math.ceil(attack.impactDuration / 0.02); i++) {
            now += 20;
            attack.step(0.02, 600, 600, rng);
            audio.syncLugiaAttack(attack); audio.flush(now);
        }
        assert.equal(played.length, 1 + delays.length, 'One audio cue per actual volley');
        delays.forEach((delay, i) => assert(Math.abs(played[i + 1].at - launchAt - delay * 1000) <= 21));
        if (move === 4) assert(played[2].file.endsWith('cross-reply.ogg'));
        assert(played.every(cue => cue.volume > 0 && cue.volume <= 0.4));
        audio.syncLugiaAttack(null);
        assert.equal(audio.nPending, 0, 'Leaving combat cancels pending boss sounds');
        audio.destroy();
    }
    assert.equal(files.size, 5, 'Each move needs a distinct sound');
    const audio = new CombatSfx(cc, node);
    played.length = 0;
    audio.enqueue({ kind: 'lugia-boss-release', moveIndex: 0 });
    now += 300;
    assert.equal(audio.flush(now), false, 'Discard outdated boss cues');
    assert.equal(played.length, 0);
    audio.destroy();
    console.log('Lugia audio PASS: five unique attacks, charge, phase-two volleys, sweep timing, cross reply, cancellation and stale-cue guard');
} finally { Date.now = originalNow; }
