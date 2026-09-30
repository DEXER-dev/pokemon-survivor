const DEFAULT_CAPACITY = 800;
const STORAGE_KEY = 'pokemon-survivors-play-logs-v1';
const MAX_SAVED_RUNS = 6;
const SAVE_DELAY_MS = 1500;

/** Small, local-only, bounded event log for reproducing gameplay bugs. */
export class PlayLog {
    constructor (capacity = DEFAULT_CAPACITY) {
        this.capacity = Math.max(100, capacity | 0);
        this.startedAt = new Date().toISOString();
        this.entries = [];
        this.sequence = 0;
        this.target = null;
        this.lastDownloadAt = 0;
        this.saveTimer = null;
        this.onKey = (event) => {
            if ((event.key !== 'F9' && event.keyCode !== 120) || event.repeat) return;
            event.preventDefault();
            this.download();
        };
        this.onError = (event) => this.record(0, 'runtime.error', {
            message: String(event.message || 'Unknown error'),
            file: String(event.filename || ''), line: event.lineno || 0, column: event.colno || 0,
        });
        this.onRejection = (event) => this.record(0, 'runtime.unhandled-rejection', {
            reason: this.safeValue(event.reason),
        });
        this.onPageHide = () => this.flushPersist();
        this.onVisibilityChange = () => {
            if (this.target && this.target.document && this.target.document.visibilityState === 'hidden') {
                this.flushPersist();
            }
        };
    }

    safeValue (value) {
        try {
            const json = JSON.stringify(value);
            return json === undefined ? String(value) : JSON.parse(json);
        } catch (_) {
            return String(value);
        }
    }

    record (gameTime, type, data = {}) {
        this.entries.push({
            seq: ++this.sequence,
            time: Math.round(Math.max(0, Number(gameTime) || 0) * 100) / 100,
            at: new Date().toISOString(),
            type,
            data: this.safeValue(data),
        });
        if (this.entries.length > this.capacity) this.entries.splice(0, this.entries.length - this.capacity);
        this.schedulePersist();
    }

    snapshot () {
        return {
            format: 'pokemon-survivors-play-log',
            version: 1,
            startedAt: this.startedAt,
            exportedAt: new Date().toISOString(),
            capacity: this.capacity,
            entries: this.entries.slice(),
        };
    }

    install (target = window) {
        this.target = target;
        target.__pokemonPlayLog = this;
        target.__getPokemonPlayLog = () => JSON.stringify(this.snapshot(), null, 2);
        target.__getSavedPokemonPlayLogs = () => JSON.stringify(this.readSavedRuns(), null, 2);
        target.__exportPokemonPlayLog = () => this.download();
        // Capture before Cocos' canvas/document handlers can stop propagation.
        target.addEventListener('keydown', this.onKey, true);
        target.addEventListener('error', this.onError);
        target.addEventListener('unhandledrejection', this.onRejection);
        target.addEventListener('pagehide', this.onPageHide);
        target.addEventListener('visibilitychange', this.onVisibilityChange);
        this.persist();
    }

    readSavedRuns () {
        try {
            if (!this.target || !this.target.localStorage) return [];
            const runs = JSON.parse(this.target.localStorage.getItem(STORAGE_KEY) || '[]');
            return Array.isArray(runs) ? runs : [];
        } catch (_) {
            return [];
        }
    }

    persist () {
        try {
            if (!this.target || !this.target.localStorage) return false;
            const runs = this.readSavedRuns().filter((run) => run && run.startedAt !== this.startedAt);
            runs.push(this.snapshot());
            this.target.localStorage.setItem(STORAGE_KEY, JSON.stringify(runs.slice(-MAX_SAVED_RUNS)));
            return true;
        } catch (_) {
            // Private browsing, disabled storage, or quota limits must never interrupt gameplay.
            return false;
        }
    }

    schedulePersist () {
        if (!this.target || this.saveTimer !== null) return;
        if (typeof this.target.setTimeout !== 'function') {
            this.persist();
            return;
        }
        this.saveTimer = this.target.setTimeout(() => {
            this.saveTimer = null;
            this.persist();
        }, SAVE_DELAY_MS);
    }

    flushPersist () {
        if (this.saveTimer !== null && this.target && typeof this.target.clearTimeout === 'function') {
            this.target.clearTimeout(this.saveTimer);
        }
        this.saveTimer = null;
        return this.persist();
    }

    download () {
        if (!this.target || typeof Blob === 'undefined' || !this.target.URL) return false;
        this.flushPersist();
        // F9 is handled by both the window capture listener and the Cocos input bridge. A single
        // physical press should still create only one file.
        const now = Date.now();
        if (now - this.lastDownloadAt < 750) return true;
        const blob = new Blob([JSON.stringify(this.snapshot(), null, 2)], { type: 'application/json' });
        const url = this.target.URL.createObjectURL(blob);
        const link = this.target.document.createElement('a');
        link.href = url;
        link.download = `pokemon-play-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        link.style.display = 'none';
        this.target.document.body.appendChild(link);
        link.click();
        link.remove();
        this.lastDownloadAt = now;
        this.target.setTimeout(() => this.target.URL.revokeObjectURL(url), 1000);
        return true;
    }

    destroy () {
        if (!this.target) return;
        this.flushPersist();
        this.target.removeEventListener('keydown', this.onKey, true);
        this.target.removeEventListener('error', this.onError);
        this.target.removeEventListener('unhandledrejection', this.onRejection);
        this.target.removeEventListener('pagehide', this.onPageHide);
        this.target.removeEventListener('visibilitychange', this.onVisibilityChange);
        delete this.target.__pokemonPlayLog;
        delete this.target.__getPokemonPlayLog;
        delete this.target.__getSavedPokemonPlayLogs;
        delete this.target.__exportPokemonPlayLog;
        this.target = null;
    }
}
