/** One deliberate, continuous 360° steer rotation per Alcremie Sweet reward. */
export const ROTATION_TAU = Math.PI * 2;

const MIN_STEER = 0.35;
const MIN_DELTA = 0.018;
const MAX_DELTA = Math.PI * 0.72;
const RESET_AFTER_IDLE = 0.8;

export function createRotationTracker () {
    return { angle: null, direction: 0, radians: 0, idle: 0, pending: false, granted: 0 };
}

export function resetRotationTracker (tracker) {
    tracker.angle = null;
    tracker.direction = 0;
    tracker.radians = 0;
    tracker.idle = 0;
    tracker.pending = false;
    tracker.granted = 0;
    return tracker;
}

/**
 * Feed a normalized steering vector. Keyboard, pointer steering and the mobile stick all converge on
 * this action-space vector. Reverse motion cancels progress, a snap turn restarts the gesture, and a
 * brief pause is allowed so a full turn need not be one uninterrupted joystick sweep.
 */
export function stepRotationTracker (tracker, x, y, dt) {
    const magnitude = Math.hypot(x, y);
    if (!(magnitude >= MIN_STEER) || !(dt > 0)) {
        tracker.idle += Math.max(0, dt || 0);
        tracker.angle = null;
        if (tracker.idle > RESET_AFTER_IDLE) {
            tracker.direction = 0;
            tracker.radians = 0;
        }
        return false;
    }

    const angle = Math.atan2(y, x);
    tracker.idle = 0;
    if (tracker.angle === null) {
        tracker.angle = angle;
        return false;
    }

    let delta = angle - tracker.angle;
    while (delta > Math.PI) delta -= ROTATION_TAU;
    while (delta < -Math.PI) delta += ROTATION_TAU;
    tracker.angle = angle;
    if (Math.abs(delta) < MIN_DELTA) return false;
    if (Math.abs(delta) > MAX_DELTA) {
        tracker.direction = 0;
        tracker.radians = 0;
        return false;
    }

    const direction = Math.sign(delta);
    if (!tracker.direction) tracker.direction = direction;
    if (direction === tracker.direction) tracker.radians += Math.abs(delta);
    else tracker.radians = Math.max(0, tracker.radians - Math.abs(delta));

    // Floating-point angle unwrapping can land a few ulps below 2π on an exact full turn.
    if (tracker.radians < ROTATION_TAU - 1e-6) return false;
    tracker.radians = 0;
    tracker.direction = 0;
    return true;
}

export function rotationProgress (tracker) {
    return Math.max(0, Math.min(1, tracker.radians / ROTATION_TAU));
}
