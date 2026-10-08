const LIFT_SECONDS = 0.72;
const WARNING_SECONDS = 0.88;
const FALL_SECONDS = 0.62;
const VOLLEY_GAP_SECONDS = 0.28;
const RETURN_SECONDS = 0.62;
const STRIKE_RADIUS = 44;

// Stage-space marks from the approved preview. Open lanes between the marks are intentional.
const VOLLEYS = [
    [[22, 31], [38, 47], [59, 36], [77, 50]],
    [[15, 47], [31, 32], [48, 51], [65, 34], [83, 47]],
    [[18, 31], [34, 50], [50, 34], [66, 50], [82, 31]],
];

export function createHoOhSpecialState () {
    return { active: false, phase: 'idle', timer: 0, phaseDuration: 0,
        elapsed: 0, volley: 0, strikes: [] };
}

export function startHoOhSpecial (state) {
    state.active = true;
    state.phase = 'lift';
    state.timer = LIFT_SECONDS;
    state.phaseDuration = LIFT_SECONDS;
    state.elapsed = 0;
    state.volley = 0;
    state.strikes = [];
}

function setWarning (state, viewport, arena) {
    const marks = VOLLEYS[state.volley];
    const halfWidth = Math.min(viewport.width * 0.5, arena.halfWidth);
    const halfHeight = Math.min(viewport.height * 0.5, arena.halfHeight);
    state.strikes = marks.map(([x, y]) => ({
        x: arena.x + Math.max(-arena.halfWidth, Math.min(arena.halfWidth, (x / 50 - 1) * halfWidth)),
        y: arena.y + Math.max(-arena.halfHeight, Math.min(arena.halfHeight, (0.5 - y / 100) * viewport.height)),
        radius: STRIKE_RADIUS,
    }));
    state.phase = 'warning';
    state.timer = WARNING_SECONDS;
    state.phaseDuration = WARNING_SECONDS;
}

/** Advance the special and report one-shot impacts/completion without engine dependencies. */
export function stepHoOhSpecial (state, dt, viewport, arena, player) {
    if (!state.active || !(dt > 0)) return [];
    state.elapsed += dt;
    let remaining = dt;
    const events = [];
    // Fixed-step updates are small, but the loop also handles a tab-resume frame cleanly.
    for (let transitions = 0; state.active && remaining >= 0 && transitions < 8; transitions++) {
        const consumed = Math.min(remaining, state.timer);
        state.timer = Math.max(0, state.timer - consumed);
        remaining -= consumed;
        if (state.timer > 0) break;

        if (state.phase === 'lift') {
            setWarning(state, viewport, arena);
            events.push({ type: 'warning', volley: state.volley, strikes: state.strikes });
        } else if (state.phase === 'warning') {
            state.phase = 'fall';
            state.timer = FALL_SECONDS;
            state.phaseDuration = FALL_SECONDS;
        } else if (state.phase === 'fall') {
            const hit = state.strikes.some((strike) =>
                Math.hypot(player.x - strike.x, player.y - strike.y) <= strike.radius + player.radius);
            events.push({ type: 'impact', volley: state.volley, strikes: state.strikes, hit });
            state.volley++;
            state.phase = state.volley < VOLLEYS.length ? 'pause' : 'return';
            state.timer = state.phase === 'pause' ? VOLLEY_GAP_SECONDS : RETURN_SECONDS;
            state.phaseDuration = state.timer;
        } else if (state.phase === 'pause') {
            setWarning(state, viewport, arena);
            events.push({ type: 'warning', volley: state.volley, strikes: state.strikes });
        } else if (state.phase === 'return') {
            state.active = false;
            state.phase = 'idle';
            state.timer = 0;
            state.phaseDuration = 0;
            state.strikes = [];
            events.push({ type: 'complete' });
        } else {
            state.active = false;
            state.phase = 'idle';
            break;
        }
        if (remaining <= 0) break;
    }
    return events;
}

export const HOOH_SPECIAL_LIFT_SECONDS = LIFT_SECONDS;
export const HOOH_SPECIAL_RETURN_SECONDS = RETURN_SECONDS;
