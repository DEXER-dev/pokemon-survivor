import { FAMILIES } from './config.js';
import { isTestAudioMuted } from './audio-settings.js';

const FAMILY_ELEMENT = new Map(FAMILIES.map((family) => [family.id, family.element]));

const ELEMENT_SOUNDS = Object.freeze({
    fire: 'combat-fire.ogg',
    water: 'combat-water.ogg',
    grass: 'combat-grass.ogg',
    bolt: 'combat-electric.ogg',
    crystal: 'combat-crystal.ogg',
    support: 'combat-fire.ogg',
});

const ELEMENT_VOLUME = Object.freeze({
    fire: 0.12,
    water: 0.11,
    grass: 0.11,
    bolt: 0.09,
    crystal: 0.10,
    support: 0.09,
});

const Z_AUDIO_ELEMENT = Object.freeze({
    electric: 'bolt',
    bug: 'crystal',
    ground: 'crystal',
    rock: 'crystal',
    steel: 'crystal',
    ice: 'water',
});

const RAYQUAZA_ENTRY_SOUND = 'rayquaza-cloud-opening.ogg';

// Keep the approved preview's fire-first rhythm in the actual Mega skill: ignition, Charizard's
// cry, two fast flame sweeps, then a bright burst and a short ember tail.
const CHARIZARD_X_AUDIO_PLAN = Object.freeze([
    Object.freeze({ delay: 0, file: 'charizard-x/blue-flame-ignite.ogg', volume: 0.45, key: 'charizard-x-ignite' }),
    Object.freeze({ delay: 165, file: 'cries/CHARIZARD_1.ogg', volume: 0.22, key: 'charizard-x-cry' }),
    Object.freeze({ delay: 220, file: 'charizard-x/blue-flame-embers.ogg', volume: 0.13, key: 'charizard-x-embers-pre' }),
    Object.freeze({ delay: 240, file: 'charizard-x/blue-flame-sweep-a.ogg', volume: 0.25, key: 'charizard-x-sweep-a' }),
    Object.freeze({ delay: 330, file: 'charizard-x/blue-flame-sweep-b.ogg', volume: 0.20, key: 'charizard-x-sweep-b' }),
    Object.freeze({ delay: 760, file: 'charizard-x/blue-flame-burst.ogg', volume: 0.40, key: 'charizard-x-burst' }),
    Object.freeze({ delay: 820, file: 'charizard-x/blue-flame-embers.ogg', volume: 0.25, key: 'charizard-x-embers-post' }),
]);

const resolveSound = (event) => {
    if (!event) return null;
    const kind = event.kind || '';
    if (kind === 'legendary-lair-entry') {
        return event.fam === 'legend-rayquaza'
            ? { key: 'rayquaza-lair-opening', file: RAYQUAZA_ENTRY_SOUND, volume: 0.64,
                priority: 3, cooldown: 0, globalCooldown: 0 }
            : null;
    }
    if (kind === 'tandemaus-throw') {
        return { key: 'tandemaus-throw', file: 'tandemaus-throw.ogg', volume: 0.28,
            priority: 1, cooldown: 380, globalCooldown: 180 };
    }
    const zMatch = /^z-([a-z]+)-(launch|impact)$/.exec(kind);
    const element = zMatch ? Z_AUDIO_ELEMENT[zMatch[1]] || zMatch[1]
        : FAMILY_ELEMENT.get(event.fam) || 'support';
    const elemental = ELEMENT_SOUNDS[element] || ELEMENT_SOUNDS.support;

    if (kind === 'shot' || kind === 'pulse' || kind === 'beam') {
        return { key: `basic-${element}`, file: elemental, volume: ELEMENT_VOLUME[element] || 0.1,
            priority: 0, cooldown: 780, globalCooldown: 420 };
    }
    if (kind === 'flower-launch' || kind === 'flower-catch' || kind === 'flower-bloom'
        || kind === 'flower-hit') {
        return { key: 'signature-flower', file: 'combat-grass.ogg', volume: 0.20,
            priority: 2, cooldown: 560, globalCooldown: 220 };
    }
    if (kind === 'shuriken-launch' || kind === 'shuriken-hit' || kind === 'shuriken-splash') {
        return { key: 'signature-shuriken', file: 'combat-water.ogg', volume: 0.20,
            priority: 2, cooldown: 620, globalCooldown: 220 };
    }
    if (kind === 'mega' || kind === 'mega-hit') {
        return { key: `mega-${element}`, file: elemental, volume: 0.22,
            priority: 1, cooldown: 900, globalCooldown: 220 };
    }
    if (kind === 'blaziken-charge') {
        return { key: 'blaziken-charge', file: 'combat-fire.ogg', volume: 0.52,
            priority: 3, cooldown: 900, globalCooldown: 0 };
    }
    if (kind === 'mega-skill' || kind === 'water-channel' || kind === 'z-fire-launch'
        || kind === 'z-water-launch' || kind === 'z-grass-launch' || kind === 'z-electric-launch'
        || (zMatch && zMatch[2] === 'launch')) {
        return { key: `ultimate-${element}`, file: elemental, volume: 0.42,
            priority: 3, cooldown: 1100, globalCooldown: 180 };
    }
    if ((zMatch && zMatch[2] === 'impact') || kind === 'blaziken-charge-hit'
        || kind === 'hooh-fire-barrage-hit') {
        return { key: `ultimate-impact-${element}`, file: 'combat-impact.ogg', volume: 0.38,
            priority: 3, cooldown: 750, globalCooldown: 180 };
    }
    if (kind === 'blaziken-charge' || kind === 'cinderace-fireball-launch'
        || kind === 'hooh-fire-barrage' || kind === 'legendary-attack') {
        return { key: `signature-${element}`, file: elemental, volume: 0.30,
            priority: 2, cooldown: 720, globalCooldown: 200 };
    }
    // Ordinary hit events are intentionally silent. A crowd volley can touch many enemies in one frame;
    // only signature/ultimate events above get impact audio.
    return null;
};

/** Small, bounded combat voice: collapse each frame's bursts, rotate element cues, and cap overlap. */
export class CombatSfx {
    constructor (cc, node) {
        this.muted = isTestAudioMuted();
        this.source = node.addComponent(cc.AudioSource);
        this.source.volume = this.muted ? 0 : 0.62;
        this.clips = Object.create(null);
        this.destroyed = false;
        this.lastPlayed = Object.create(null);
        this.lastGlobal = -Infinity;
        this.roundRobin = 0;
        this.pending = new Array(12);
        this.nPending = 0;

        if (this.muted) return;

        const sounds = new Set(Object.values(ELEMENT_SOUNDS));
        sounds.add('combat-impact.ogg');
        sounds.add('tandemaus-throw.ogg');
        sounds.add(RAYQUAZA_ENTRY_SOUND);
        for (const cue of CHARIZARD_X_AUDIO_PLAN) sounds.add(cue.file);
        for (const file of sounds) {
            cc.assetManager.loadRemote(`assets/audio/${file}`, { ext: '.ogg' }, (err, clip) => {
                if (err) {
                    console.warn(`[audio] combat ${file} unavailable:`, err.message || err);
                    return;
                }
                if (!this.destroyed) this.clips[file] = clip;
            });
        }
    }

    enqueue (event) {
        if (this.destroyed || this.muted) return;
        if (event && event.kind === 'charizard-x-skill') {
            const enqueuedAt = Date.now();
            for (const cue of CHARIZARD_X_AUDIO_PLAN) {
                if (this.nPending >= this.pending.length) break;
                this.pending[this.nPending++] = {
                    ...cue, priority: 3, cooldown: 0, globalCooldown: 0,
                    enqueuedAt, scheduledAt: enqueuedAt + cue.delay, sequence: true,
                };
            }
            return;
        }
        const sound = resolveSound(event);
        if (!sound) return;
        const queued = { ...sound, enqueuedAt: Date.now() };
        if (!this.clips[sound.file] && sound.priority < 3) return;
        for (let i = 0; i < this.nPending; i++) {
            if (this.pending[i].key === sound.key) {
                if (sound.priority > this.pending[i].priority) this.pending[i] = queued;
                return;
            }
        }
        if (this.nPending < this.pending.length) this.pending[this.nPending++] = queued;
    }

    flush (now = Date.now()) {
        if (this.destroyed || this.muted || !this.nPending) return false;
        let best = -1;
        let bestPriority = -1;
        const unloaded = [];
        const waiting = [];
        for (let offset = 0; offset < this.nPending; offset++) {
            const i = (this.roundRobin + offset) % this.nPending;
            const sound = this.pending[i];
            if (sound.scheduledAt && now < sound.scheduledAt) {
                waiting.push(sound);
                continue;
            }
            if (!this.clips[sound.file]) {
                if (sound.priority >= 3 && Date.now() - sound.enqueuedAt <= 2500) unloaded.push(sound);
                continue;
            }
            // Most combat cues collapse to the best one for this frame; the Charizard X plan is a
            // deliberate timeline, so keep its other ready cues queued after one is selected.
            if (sound.sequence) waiting.push(sound);
            if (now - (this.lastPlayed[sound.key] ?? -Infinity) < sound.cooldown
                || (sound.priority < 3 && now - this.lastGlobal < sound.globalCooldown)) continue;
            if (sound.priority > bestPriority) {
                best = i;
                bestPriority = sound.priority;
            }
        }
        const selected = best >= 0 ? this.pending[best] : null;
        const remaining = selected ? waiting.filter((sound) => sound !== selected) : waiting;
        this.nPending = remaining.length + unloaded.length;
        for (let i = 0; i < remaining.length; i++) this.pending[i] = remaining[i];
        for (let i = 0; i < unloaded.length; i++) this.pending[remaining.length + i] = unloaded[i];
        if (best < 0) return false;
        const sound = selected;
        const clip = this.clips[sound.file];
        if (!clip) return false;
        this.lastPlayed[sound.key] = now;
        this.lastGlobal = now;
        this.roundRobin = (best + 1) % this.pending.length;
        this.source.playOneShot(clip, sound.volume);
        return true;
    }

    destroy () {
        this.destroyed = true;
        this.nPending = 0;
        this.clips = Object.create(null);
        if (this.source && this.source.isValid) this.source.stop();
    }
}

export { resolveSound as resolveCombatSound };
