import { isTestAudioMuted } from './audio-settings.js';

const SOUNDS = Object.freeze({
    charge: Object.freeze({ file: 'mega-charge-whoosh.mp3', volume: 0.28 }),
    burst: Object.freeze({ file: 'mega-orb-shatter.mp3', volume: 0.34 }),
    reveal: Object.freeze({ file: 'mega-reveal.ogg', volume: 0.3 }),
});

/** Dedicated, sourced Mega Evolution cues. The existing test mute query applies here as well. */
export class EvolutionSfx {
    constructor (cc, node) {
        this.muted = isTestAudioMuted();
        this.source = node.addComponent(cc.AudioSource);
        this.source.volume = this.muted ? 0 : 0.62;
        this.clips = Object.create(null);
        this.destroyed = false;
        if (this.muted) return;

        for (const [key, sound] of Object.entries(SOUNDS)) {
            const ext = sound.file.slice(sound.file.lastIndexOf('.'));
            cc.assetManager.loadRemote(`assets/audio/evolution-preview/${sound.file}`, { ext }, (err, clip) => {
                if (err) {
                    console.warn(`[audio] Mega Evolution ${key} unavailable:`, err.message || err);
                    return;
                }
                if (!this.destroyed) this.clips[key] = clip;
            });
        }
    }

    play (event) {
        if (this.destroyed || this.muted) return false;
        const sound = SOUNDS[event];
        const clip = sound && this.clips[event];
        if (!sound || !clip) return false;
        this.source.playOneShot(clip, sound.volume);
        return true;
    }

    destroy () {
        this.destroyed = true;
        this.clips = Object.create(null);
        if (this.source && this.source.isValid) this.source.stop();
    }
}
