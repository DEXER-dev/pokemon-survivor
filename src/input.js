/*
 * Two verbs, never a third (§6.1): steer, and 掷. Keyboard and hold-to-move pointer input feed the same
 * normalised steering vector, while the catch lives next to it as a press record - a short press is a
 * precise "this one", a long press is a repeat, and the difference has to be measured, not guessed.
 */
export class Input {
    constructor (cc, view, catc) {
        this.cc = cc;
        this.view = view;
        this.catc = catc;
        this.keys = Object.create(null);
        this.pointer = { x: 0, y: 0, down: false, seen: false };
        this.pointerMoved = false;
        this.touch = { x: 0, y: 0, aimX: 1, aimY: 0, aimSeen: false, firing: false };
        this.press = { active: false, ms: 0, moved: 0, touch: false };
        this.tap = false;
        this.keyTap = false;
        this.numTap = 0;
        this.menuNavTap = 0;
        this.held = false;
        this.ignoreFireUntilRelease = false;
        this.actionBindings = new Map();
        this.onAction = null;
        this._nativeTarget = null;
        this._key = (e) => {
            if ((typeof document !== 'undefined' && document.body.classList.contains('dex-opened'))
                || e.target?.closest?.('button,input,select,[role="dialog"]')) return;
            const code = this._physicalCode(e);
            if (code === null) return;
            const wasDown = !!this.keys[code];
            if (!wasDown) this._edge(code, true);
            this.keys[code] = true;
            const action = this.actionBindings.get(code);
            if (action) {
                if (!wasDown && !e.repeat && this.onAction) this.onAction(action, e);
            } else if (this.onKey) this.onKey(code, true, e);
            // Keep Space/arrows from scrolling the page while they control the game. Capture phase
            // sees the physical key before Cocos or an IME-backed hidden text input rewrites it.
            if (e.cancelable) e.preventDefault();
        };
        this._keyUp = (e) => {
            if ((typeof document !== 'undefined' && document.body.classList.contains('dex-opened'))
                || e.target?.closest?.('button,input,select,[role="dialog"]')) return;
            const code = this._physicalCode(e);
            if (code === null) return;
            this.keys[code] = false;
            const K = this.cc.KeyCode;
            if (code === K.SPACE || code === K.KEY_J) {
                if (!this.keys[K.SPACE] && !this.keys[K.KEY_J]) this.ignoreFireUntilRelease = false;
            }
            if (this.onKey) this.onKey(code, false, e);
        };
        this._blur = () => {
            this.keys = Object.create(null);
            this.pointer.down = false;
            this.touch.x = this.touch.y = 0;
            this.touch.firing = false;
            this.press.active = false;
            this.press.touch = false;
            this.held = false;
            this.ignoreFireUntilRelease = false;
            this.menuNavTap = 0;
            this.pointerMoved = false;
        };
        this._edge = (code, down) => {
            const K = this.cc.KeyCode;
            if (down && (code === K.SPACE || code === K.KEY_J)) this.keyTap = true;
            // Modal choices are edges off the same gate as 【掷】, so OS key repeat cannot walk a
            // held number through multiple options in one frame. Most screens use 1–4; the boss
            // evolution reward pages up to eight party links at once.
            if (down && code >= K.DIGIT_1 && code <= K.DIGIT_9) this.numTap = code - K.DIGIT_1 + 1;
            if (down && (code === K.ARROW_LEFT || code === K.KEY_A)) this.menuNavTap = -1;
            if (down && (code === K.ARROW_RIGHT || code === K.KEY_D)) this.menuNavTap = 1;
        };
        this._move = (e) => {
            const p = e.getUILocation();
            const x = p.x - view.W / 2;
            const y = p.y - view.H / 2;
            if (this.press.active) this.press.moved += Math.abs(x - this.pointer.x) + Math.abs(y - this.pointer.y);
            this.pointer.x = x;
            this.pointer.y = y;
            this.pointer.seen = true;
            this.pointerMoved = true;
        };
        this._down = (e, touch = false) => {
            this._move(e);
            this.pointer.down = true;
            this.press.active = true;
            this.press.ms = 0;
            this.press.moved = 0;
            this.press.touch = touch;
        };
        this._touchDown = (e) => this._down(e, true);
        this._up = (e) => {
            if (e && typeof e.getUILocation === 'function') this._move(e);
            this.pointer.down = false;
            const maxMs = this.press.touch ? Math.max(this.catc.tapMaxMs, 500) : this.catc.tapMaxMs;
            const maxMove = this.press.touch ? Math.max(this.catc.tapMaxMove, 36) : this.catc.tapMaxMove;
            if (this.press.active
                && this.press.ms < maxMs
                && this.press.moved < maxMove) this.tap = true;
            this.press.active = false;
            this.press.touch = false;
        };
        this._cancel = () => {
            this.pointer.down = false;
            this.press.active = false;
            this.press.touch = false;
        };
    }

    /**
     * Resolve the physical key first. During Chinese IME composition, browsers commonly report
     * keyCode 229 even though `code` still identifies the pressed key (KeyW, Space, Digit1, ...).
     * Fall back to keyCode for older browsers, but never turn an unidentified IME event into an action.
     */
    _physicalCode (e) {
        const K = this.cc.KeyCode;
        const physical = e.code || '';
        let name = '';
        if (/^Key[A-Z]$/.test(physical)) name = `KEY_${physical.slice(3)}`;
        else if (/^Digit[1-9]$/.test(physical)) name = `DIGIT_${physical.slice(5)}`;
        else if (physical === 'Space') name = 'SPACE';
        else if (physical === 'ArrowLeft' || physical === 'ArrowRight'
            || physical === 'ArrowUp' || physical === 'ArrowDown') name = physical.replace('Arrow', 'ARROW_').toUpperCase();
        else if (physical === 'BracketLeft') name = 'BRACKET_LEFT';
        else if (physical === 'BracketRight') name = 'BRACKET_RIGHT';
        else if (physical === 'F9') name = 'F9';
        if (name && K[name] !== undefined) return K[name];
        return e.keyCode === 229 || !Number.isFinite(e.keyCode) ? null : e.keyCode;
    }

    bind () {
        const { input, Input: EV } = this.cc;
        // Use native capture-phase events rather than Cocos' translated keyCode events. This works
        // even if the canvas briefly loses focus, and preserves physical key identity under IME.
        this._nativeTarget = window;
        this._nativeTarget.addEventListener('keydown', this._key, true);
        this._nativeTarget.addEventListener('keyup', this._keyUp, true);
        this._nativeTarget.addEventListener('blur', this._blur);
        input.on(EV.EventType.MOUSE_MOVE, this._move, this);
        input.on(EV.EventType.MOUSE_DOWN, this._down, this);
        input.on(EV.EventType.MOUSE_UP, this._up, this);
        input.on(EV.EventType.TOUCH_MOVE, this._move, this);
        input.on(EV.EventType.TOUCH_START, this._touchDown, this);
        input.on(EV.EventType.TOUCH_END, this._up, this);
        input.on(EV.EventType.TOUCH_CANCEL, this._cancel, this);
    }

    /** Bind a discrete physical key to a named gameplay action; gameplay never needs its key code. */
    bindAction (action, code) {
        if (!action || !Number.isFinite(code)) return false;
        this.actionBindings.set(code, action);
        return true;
    }

    /** Feed the mobile virtual stick into the same movement/aim path as keyboard and pointer input. */
    setTouchAxis (x, y) {
        const length = Math.hypot(x, y);
        if (length < 0.07) {
            this.touch.x = this.touch.y = 0;
            return;
        }
        const scale = Math.min(1, length);
        this.touch.x = x / length * scale;
        this.touch.y = y / length * scale;
        this.touch.aimX = x / length;
        this.touch.aimY = y / length;
        this.touch.aimSeen = true;
    }

    setTouchFire (held) {
        this.touch.firing = !!held;
    }

    unbind () {
        const { input, Input: EV } = this.cc;
        this.touch.x = this.touch.y = 0;
        this.touch.firing = false;
        this.pointerMoved = false;
        this.menuNavTap = 0;
        if (this._nativeTarget) {
            this._nativeTarget.removeEventListener('keydown', this._key, true);
            this._nativeTarget.removeEventListener('keyup', this._keyUp, true);
            this._nativeTarget.removeEventListener('blur', this._blur);
            this._nativeTarget = null;
        }
        input.off(EV.EventType.MOUSE_MOVE, this._move, this);
        input.off(EV.EventType.MOUSE_DOWN, this._down, this);
        input.off(EV.EventType.MOUSE_UP, this._up, this);
        input.off(EV.EventType.TOUCH_MOVE, this._move, this);
        input.off(EV.EventType.TOUCH_START, this._touchDown, this);
        input.off(EV.EventType.TOUCH_END, this._up, this);
        input.off(EV.EventType.TOUCH_CANCEL, this._cancel, this);
    }

    /** A fire key held across a modal panel must be released before it can fire again. */
    blockFireUntilRelease () {
        const K = this.cc.KeyCode;
        if (this.keys[K.SPACE] || this.keys[K.KEY_J]) this.ignoreFireUntilRelease = true;
    }

    /** `selfX/selfY` are view-space (zoomed) coordinates of the hero; pointer steering is
     *  distance-scaled so releasing toward the hero slows it instead of jittering. */
    axis (out, selfX, selfY) {
        const K = this.cc.KeyCode;
        const k = this.keys;
        let x = 0;
        let y = 0;
        if (k[K.ARROW_LEFT] || k[K.KEY_A]) x -= 1;
        if (k[K.ARROW_RIGHT] || k[K.KEY_D]) x += 1;
        if (k[K.ARROW_UP] || k[K.KEY_W]) y += 1;
        if (k[K.ARROW_DOWN] || k[K.KEY_S]) y -= 1;
        if (x !== 0 || y !== 0) {
            const l = Math.sqrt(x * x + y * y);
            out.x = x / l;
            out.y = y / l;
            return out;
        }
        if (Math.hypot(this.touch.x, this.touch.y) > 0) {
            out.x = this.touch.x;
            out.y = this.touch.y;
            return out;
        }
        if (this.pointer.down) {
            const dx = this.pointer.x - selfX;
            const dy = this.pointer.y - selfY;
            const l = Math.sqrt(dx * dx + dy * dy);
            const mag = Math.max(0, Math.min(1, (l - 10) / 70));
            out.x = l > 1e-4 ? (dx / l) * mag : 0;
            out.y = l > 1e-4 ? (dy / l) * mag : 0;
            return out;
        }
        out.x = 0;
        out.y = 0;
        return out;
    }

    /**
     * Read once per frame, before the fixed steps. A pointer hold stays steering - it is already the
     * movement verb - so the repeat-catch is Space/J and the pointer contributes precise taps.
     */
    sample (dt) {
        if (this.press.active) this.press.ms += dt * 1000;
        const K = this.cc.KeyCode;
        this.held = !this.ignoreFireUntilRelease
            && !!(this.keys[K.SPACE] || this.keys[K.KEY_J] || this.touch.firing);
        const tap = this.tap || this.keyTap;
        this.tap = false;
        this.keyTap = false;
        const num = this.numTap;
        this.numTap = 0;
        const nav = this.menuNavTap;
        this.menuNavTap = 0;
        const pointerMoved = this.pointerMoved;
        this.pointerMoved = false;
        return { tap, hold: this.held, num, nav, pointerMoved };
    }
}
