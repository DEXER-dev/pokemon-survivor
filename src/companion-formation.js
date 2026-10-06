const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
export const TANDEMAUS_VISIBLE_COMPANION_CAP = 48;
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const finiteCount = (value) => value === Infinity ? Number.MAX_SAFE_INTEGER
    : Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

/** Render a representative cloud instead of an unbounded number of sprites late in a run. */
export function tandemausVisibleCompanionCount (count) {
    return Math.min(TANDEMAUS_VISIBLE_COMPANION_CAP, finiteCount(count));
}

/** Evenly sample a very large family across its full formation footprint. */
export function tandemausVisibleCompanionIndex (visibleIndex, count, visibleCount) {
    const total = finiteCount(count);
    const visible = Math.max(1, Math.floor(visibleCount));
    if (total <= visible) return Math.max(0, Math.min(total - 1, Math.floor(visibleIndex)));
    return Math.floor((Math.max(0, visibleIndex) + 0.5) * total / visible);
}

/** Crowding pressure for a mouse family living inside a large Pokémon party. */
export function tandemausFollowerCrowd (count, partySize = 1) {
    const companions = Math.max(1, finiteCount(count));
    const roster = Math.max(1, finiteCount(partySize));
    const familyPressure = clamp01((companions - 8) / 16);
    const partyPressure = clamp01((roster - 12) / 12) * clamp01((companions - 1) / 7);
    return Math.max(familyPressure, partyPressure);
}

/**
 * A shallow trailing fan for a small family, blending into a bounded, off-axis mouse cloud as
 * either the family or the Pokémon roster grows. `side` alternates between Maushold hosts so
 * multiple family groups do not all spill into the same flank of the party train.
 */
export function tandemausFollowerOffset (heading, scale, index, count, partySize = 1, side = 1) {
    const companions = Math.max(1, finiteCount(count));
    const follower = Math.max(0, Math.min(companions - 1, Math.floor(index)));
    const unit = Math.max(0, scale);
    const forwardX = Math.cos(heading);
    const forwardY = Math.sin(heading);
    const lateralX = -forwardY;
    const lateralY = forwardX;
    const sideSign = side < 0 ? -1 : 1;
    const crowd = tandemausFollowerCrowd(companions, partySize);

    const progress = companions > 1 ? follower / (companions - 1) : 0.5;
    const arcHalfAngle = 0.35 + Math.min(0.62, Math.sqrt(companions) * 0.105);
    const angle = (progress - 0.5) * 2 * arcHalfAngle;
    const arcRadius = unit * (30 + Math.min(26, Math.sqrt(companions) * 5));
    const fanForward = unit * 18 + arcRadius * (1 - Math.cos(angle));
    const fanSide = arcRadius * Math.sin(angle);

    // Golden-angle sampling creates a soft-edged crowd without rows or a growing rectangle.
    // Its radius is capped, so doubling a very large family never doubles its screen footprint.
    const clusterRadius = unit * (12 + Math.min(28, Math.sqrt(companions) * 5));
    const radial = clusterRadius * Math.sqrt((follower + 0.5) / companions);
    const phase = follower * GOLDEN_ANGLE + sideSign * 0.18;
    const clusterForward = unit * 2 + radial * Math.cos(phase) * 0.42;
    const clusterSide = sideSign * (unit * (39 + Math.min(13, Math.sqrt(companions) * 2))
        + radial * Math.sin(phase));

    const forward = fanForward + (clusterForward - fanForward) * crowd;
    const lateral = fanSide + (clusterSide - fanSide) * crowd;
    return {
        x: forwardX * forward + lateralX * lateral,
        y: forwardY * forward + lateralY * lateral,
    };
}

/** Keep crowded mice visually legible while compressing the family into its local pocket. */
export function tandemausFollowerScale (scale, count, partySize = 1) {
    const base = Math.max(0.22, Math.min(0.32, scale * 0.56));
    return base * (1 - 0.18 * tandemausFollowerCrowd(count, partySize));
}

/** Small, out-of-phase footsteps animate followers without moving gameplay or collision positions. */
export function tandemausFollowerMotion (heading, scale, index, time, count = 1, partySize = 1) {
    const tailX = Math.cos(heading);
    const tailY = Math.sin(heading);
    const crowd = tandemausFollowerCrowd(count, partySize);
    const motionScale = 1 - crowd * 0.38;
    const phase = time * 11 - index * 1.21;
    const stride = Math.sin(phase);
    const weave = Math.sin(phase * 0.68 + 0.5);
    const stepX = (tailX * stride * scale * 2.4 - tailY * weave * scale * 1.2) * motionScale;
    const stepY = (tailY * stride * scale * 2.4 + tailX * weave * scale * 1.2) * motionScale;
    return {
        x: stepX,
        y: stepY + Math.max(0, Math.sin(phase * 1.9)) * scale * 3 * motionScale,
        stride,
    };
}
