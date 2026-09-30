/** Looping background music with a small two-source crossfade, independent of the game tick. */
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
        this.sources = [0, 1].map((index) => {
            const node = new cc.Node(`Bgm${index + 1}`);
            node.layer = parent.layer;
            parent.addChild(node);
            const source = node.addComponent(cc.AudioSource);
            source.loop = true;
            source.playOnAwake = false;
            source.volume = 0;
            return source;
        });
        this.clips = Object.create(null);
        this.mode = null;
        this.current = -1;
        this.fade = null;
        this.raf = 0;
        this.destroyed = false;

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
        if (mode !== null && !Object.hasOwn(MUSIC_TRACKS, mode)) return;
        if (mode === this.mode) {
            if (this.fade) return;
            if (mode && (this.current < 0 || this.sources[this.current].clip !== this.clips[mode])
                && this.clips[mode]) this._transition(mode);
            return;
        }
        this.mode = mode;
        this._transition(mode);
    }

    _transition (mode) {
        if (this.destroyed) return;
        const interrupted = this.fade;
        if (this.raf && typeof window !== 'undefined') window.cancelAnimationFrame(this.raf);
        this.raf = 0;
        this.fade = null;

        // If a transition was interrupted, retain its loudest source as the outgoing track.
        if (this.current < 0 && interrupted) {
            this.current = interrupted.from >= 0 && (interrupted.to < 0
                || this.sources[interrupted.from].volume >= this.sources[interrupted.to].volume)
                ? interrupted.from : interrupted.to;
        }
        const outgoing = this.current;
        if (!mode) {
            if (outgoing < 0) return;
            this._fade(outgoing, -1, 0);
            return;
        }
        const clip = this.clips[mode];
        if (!clip) return; // Loading is async; the callback retries the latest requested mode.
        if (outgoing >= 0 && this.sources[outgoing].clip === clip) return;

        const incoming = outgoing < 0 ? 0 : 1 - outgoing;
        for (let i = 0; i < this.sources.length; i++) {
            if (i !== outgoing && i !== incoming) this.sources[i].stop();
        }
        const next = this.sources[incoming];
        next.stop();
        next.clip = clip;
        next.loop = true;
        next.volume = 0;
        try {
            next.play();
        } catch (err) {
            console.warn('[audio] BGM playback was blocked:', err && err.message || err);
            return;
        }
        this._fade(outgoing, incoming, TRACK_VOLUME[mode] || 0.18);
    }

    _fade (from, to, targetVolume) {
        const starts = this.sources.map((source) => source.volume);
        const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const apply = (now) => {
            if (this.destroyed) return;
            const t = Math.min(1, Math.max(0, (now - start) / FADE_MS));
            const eased = t * t * (3 - 2 * t);
            if (from >= 0) this.sources[from].volume = starts[from] * (1 - eased);
            if (to >= 0) this.sources[to].volume = starts[to] + (targetVolume - starts[to]) * eased;
            if (t < 1 && typeof window !== 'undefined' && window.requestAnimationFrame) {
                this.raf = window.requestAnimationFrame(apply);
                this.fade = { from, to };
                return;
            }
            if (from >= 0) {
                this.sources[from].volume = 0;
                this.sources[from].stop();
            }
            if (to >= 0) {
                this.sources[to].volume = targetVolume;
                this.current = to;
            } else this.current = -1;
            this.fade = null;
            this.raf = 0;
        };
        // In a headless harness, complete transitions synchronously.
        if (typeof window === 'undefined' || !window.requestAnimationFrame) apply(start + FADE_MS);
        else {
            this.fade = { from, to };
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
