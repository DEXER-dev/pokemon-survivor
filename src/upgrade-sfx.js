import { isTestAudioMuted } from './audio-settings.js';

/** Short, original UI cues for the level-up choice flow. */
const SOUNDS = Object.freeze({
    appear: Object.freeze({ file: 'ui-upgrade-appear.ogg', volume: 0.34, cooldown: 180 }),
    focus: Object.freeze({ file: 'ui-upgrade-focus.ogg', volume: 0.20, cooldown: 90 }),
    confirm: Object.freeze({ file: 'ui-upgrade-confirm.ogg', volume: 0.42, cooldown: 160 }),
    dismiss: Object.freeze({ file: 'ui-upgrade-dismiss.ogg', volume: 0.26, cooldown: 180 }),
});

export function resolveUpgradeSound (event) {
    return SOUNDS[event] || null;
}

export class UpgradeSfx {
    constructor (cc, node) {
        this.cc = cc;
        this.muted = isTestAudioMuted();
        this.source = node.addComponent(cc.AudioSource);
        this.source.volume = this.muted ? 0 : 0.62;
        this.clips = Object.create(null);
        this.lastPlayed = Object.create(null);
        this.destroyed = false;

        if (this.muted) return;

        for (const [key, sound] of Object.entries(SOUNDS)) {
            cc.assetManager.loadRemote(`assets/audio/${sound.file}`, { ext: '.ogg' }, (err, clip) => {
                if (err) {
                    console.warn(`[audio] upgrade ${key} unavailable:`, err.message || err);
                    return;
                }
                if (!this.destroyed) this.clips[key] = clip;
            });
        }
    }

    play (event, now = Date.now()) {
        if (this.destroyed || this.muted) return false;
        const sound = resolveUpgradeSound(event);
        const clip = sound && this.clips[event];
        if (!sound || !clip || now - (this.lastPlayed[event] ?? -Infinity) < sound.cooldown) return false;
        this.lastPlayed[event] = now;
        this.source.playOneShot(clip, sound.volume);
        return true;
    }

    destroy () {
        this.destroyed = true;
        this.clips = Object.create(null);
        if (this.source && this.source.isValid) this.source.stop();
    }
}
