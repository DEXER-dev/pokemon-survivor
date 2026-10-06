import { isTestAudioMuted } from './audio-settings.js';

/** One looping BGM source. A single player makes overlapping music tracks impossible. */
export const MUSIC_TRACKS = Object.freeze({
    title: 'bgm-title.ogg',
    field: 'bgm-field.mp3',
    trainer: 'bgm-trainer-boss.mp3',
    legendary: 'bgm-legendary.ogg',
});

const TRACK_VOLUME = Object.freeze({ title: 0.19, field: 0.17, trainer: 0.20, legendary: 0.20 });
const FADE_MS = 900;

export class MusicManager {
    constructor (cc, parent) {
        this.cc = cc;
        this.muted = isTestAudioMuted();
        const node = new cc.Node('Bgm');
        node.layer = parent.layer;
        parent.addChild(node);
        const source = node.addComponent(cc.AudioSource);
        source.loop = true;
        source.playOnAwake = false;
        source.volume = 0;
        this.sources = [source];
        this.clips = Object.create(null);
        this.mode = null;
        this.current = -1;
        this.fade = null;
        this.raf = 0;
        this.destroyed = false;

        if (this.muted) return;

        for (const [mode, file] of Object.entries(MUSIC_TRACKS)) {
            const ext = file.slice(file.lastIndexOf('.'));
            cc.assetManager.loadRemote(`assets/audio/${file}`, { ext }, (err, clip) => {
                if (err) {
                    console.warn(`[audio] BGM ${file} unavailable:`, err.message || err);
                    return;
                }
                if (this.destroyed) return;
                this.clips[mode] = clip;
                if (this.mode === mode && this.current < 0) this._transition(mode);
            });
        }
    }

    setMode (mode) {
        if (this.muted) return;
        if (mode !== null && !Object.hasOwn(MUSIC_TRACKS, mode)) return;
        if (mode === this.mode) {
            if (this.fade) return;
            if (mode && (this.current < 0 || this.sources[0].clip !== this.clips[mode])
                && this.clips[mode]) this._transition(mode);
            return;
        }
        this.mode = mode;
        this._transition(mode);
    }

    _transition (mode) {
        if (this.destroyed) return;
        if (this.raf && typeof window !== 'undefined') window.cancelAnimationFrame(this.raf);
        this.raf = 0;
        this.fade = null;

        const source = this.sources[0];
        if (!mode) {
            if (this.current >= 0) this._fade(null);
            return;
        }

        const clip = this.clips[mode];
        if (!clip) {
            // Do not leave the previous field track audible while a requested battle track loads.
            source.volume = 0;
            source.stop();
            this.current = -1;
            return; // Loading is async; the callback retries the latest requested mode.
        }
        source.volume = 0;
        source.stop();
        source.clip = clip;
        source.loop = true;
        try {
            source.play();
        } catch (err) {
            console.warn('[audio] BGM playback was blocked:', err && err.message || err);
            this.current = -1;
            return;
        }
        this.current = 0;
        this._fade(TRACK_VOLUME[mode] || 0.18);
    }

    _fade (targetVolume) {
        const source = this.sources[0];
        const startVolume = source.volume;
        const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const apply = (now) => {
            if (this.destroyed) return;
            const t = Math.min(1, Math.max(0, (now - start) / FADE_MS));
            const eased = t * t * (3 - 2 * t);
            source.volume = targetVolume === null ? startVolume * (1 - eased)
                : startVolume + (targetVolume - startVolume) * eased;
            if (t < 1 && typeof window !== 'undefined' && window.requestAnimationFrame) {
                this.raf = window.requestAnimationFrame(apply);
                this.fade = true;
                return;
            }
            source.volume = targetVolume === null ? 0 : targetVolume;
            if (targetVolume === null) {
                source.stop();
                this.current = -1;
            } else this.current = 0;
            this.fade = null;
            this.raf = 0;
        };
        // In a headless harness, complete transitions synchronously.
        if (typeof window === 'undefined' || !window.requestAnimationFrame) apply(start + FADE_MS);
        else {
            this.fade = true;
            this.raf = window.requestAnimationFrame(apply);
        }
    }

    destroy () {
        this.destroyed = true;
        if (this.raf && typeof window !== 'undefined') window.cancelAnimationFrame(this.raf);
        this.raf = 0;
        this.fade = null;
        for (const source of this.sources) {
            source.stop();
            source.clip = null;
        }
        this.clips = Object.create(null);
    }
}
