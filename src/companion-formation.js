/** Staggered four-column mouse pack, projected along the chain's tail-facing heading. */
export function tandemausFollowerOffset (heading, scale, index, count) {
    const tailX = Math.cos(heading);
    const tailY = Math.sin(heading);
    const columns = 4;
    const row = Math.floor(index / columns);
    const rowSize = Math.min(columns, Math.max(1, count - row * columns));
    const side = index % columns - (rowSize - 1) / 2;
    const distance = scale * (34 + row * 24);
    const lateral = side * scale * 26;
    return {
        x: tailX * distance - tailY * lateral,
        y: tailY * distance + tailX * lateral,
    };
}

/** Small, out-of-phase footsteps animate followers without moving their gameplay or collision positions. */
export function tandemausFollowerMotion (heading, scale, index, time) {
    const tailX = Math.cos(heading);
    const tailY = Math.sin(heading);
    const phase = time * 11 - index * 1.21;
    const stride = Math.sin(phase);
    const weave = Math.sin(phase * 0.68 + 0.5);
    const stepX = tailX * stride * scale * 2.4 - tailY * weave * scale * 1.2;
    const stepY = tailY * stride * scale * 2.4 + tailX * weave * scale * 1.2;
    return {
        x: stepX,
        y: stepY + Math.max(0, Math.sin(phase * 1.9)) * scale * 3,
        stride,
    };
}
