import { isTestAudioMuted } from './audio-settings.js';

/** Small Cocos AudioSource wrapper for the three capture-verb sounds. */
export class CaptureSfx {
    constructor (cc, node) {
        this.cc = cc;
        this.muted = isTestAudioMuted();
        this.source = node.addComponent(cc.AudioSource);
        this.source.volume = this.muted ? 0 : 0.62;
        this.clips = Object.create(null);
        this.lastPlayed = Object.create(null);
        this.lastCryPlayed = Object.create(null);
        this.lastCryAt = -Infinity;
        this.cryClips = Object.create(null);
        this.cryLoading = Object.create(null);
        this.cryToken = 0;
        this.destroyed = false;

        if (this.muted) return;

        const sounds = {
            throw: 'ball-throw.ogg',
            hit: 'ball-hit.ogg',
            shake: 'ball-shake.ogg',
        };
        for (const [key, file] of Object.entries(sounds)) {
            cc.assetManager.loadRemote(`assets/audio/${file}`, { ext: '.ogg' }, (err, clip) => {
                if (err) {
                    console.warn(`[audio] ${key} unavailable:`, err.message || err);
                    return;
                }
                if (!this.destroyed) this.clips[key] = clip;
            });
        }
    }

    play (key, volume = 1, cooldown = 0) {
        if (this.destroyed || this.muted) return;
        const clip = this.clips[key];
        if (!clip) return; // Audio is optional: keep the game playable while files load or fail.
        const now = Date.now();
        if (now - (this.lastPlayed[key] || 0) < cooldown) return;
        this.lastPlayed[key] = now;
        this.source.playOneShot(clip, volume);
    }

    /** Play the captured species' cry on the reveal beat, lazy-loading each species only once. */
    playCry (speciesKey) {
        if (this.destroyed || this.muted || !speciesKey) return false;
        const now = Date.now();
        if (now - this.lastCryAt < 180 || now - (this.lastCryPlayed[speciesKey] || -Infinity) < 850) return false;
        this.lastCryAt = now;
        this.lastCryPlayed[speciesKey] = now;
        const cached = this.cryClips[speciesKey];
        if (cached) {
            this.source.playOneShot(cached, 0.34);
            return true;
        }
        if (this.cryLoading[speciesKey]) return true;
        this.cryLoading[speciesKey] = true;
        const token = ++this.cryToken;
        const load = (key, fallback = null) => {
            this.cc.assetManager.loadRemote(`assets/audio/cries/${key}.ogg`, { ext: '.ogg' }, (err, clip) => {
                if (this.destroyed) return;
                if (err || !clip) {
                    if (fallback && fallback !== key) load(fallback);
                    else delete this.cryLoading[speciesKey];
                    return;
                }
                delete this.cryLoading[speciesKey];
                this.cryClips[speciesKey] = clip;
                // If a later catch happened while this request was in flight, don't play a stale cry.
                if (token === this.cryToken) this.source.playOneShot(clip, 0.34);
            });
        };
        load(speciesKey, speciesKey.endsWith('_1') ? speciesKey.slice(0, -2) : null);
        return true;
    }

    destroy () {
        this.destroyed = true;
        this.clips = Object.create(null);
        this.cryClips = Object.create(null);
        this.cryLoading = Object.create(null);
        if (this.source && this.source.isValid) this.source.stop();
    }
}
