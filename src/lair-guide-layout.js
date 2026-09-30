/** Project each unfinished lair into the fixed screen-space HUD and clamp off-screen targets. */
export function legendaryGuideLayout (sites, camera, view) {
    const halfW = view.W / 2;
    const halfH = view.H / 2;
    const bounds = { left: -halfW + 48, right: halfW - 48, bottom: -halfH + 70, top: halfH - 100 };
    const markers = [];
    for (const site of sites) {
        if (!site || site.complete || !Number.isFinite(site.x) || !Number.isFinite(site.y)) continue;
        const dx = (site.x - camera.x) * camera.z;
        const dy = (site.y - camera.y) * camera.z;
        const inside = dx >= bounds.left && dx <= bounds.right && dy >= bounds.bottom && dy <= bounds.top;
        if (inside) {
            markers.push({ site, x: dx, y: dy, angle: Math.atan2(dy, dx), inside, edge: 'inside' });
            continue;
        }
        const tx = dx === 0 ? Infinity : Math.min(Math.abs(bounds.left / dx), Math.abs(bounds.right / dx));
        const ty = dy === 0 ? Infinity : Math.min(Math.abs(bounds.bottom / dy), Math.abs(bounds.top / dy));
        const t = Math.min(tx, ty);
        const edge = tx < ty ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'bottom' : 'top');
        markers.push({ site, x: dx * t, y: dy * t, angle: Math.atan2(dy, dx), inside, edge });
    }

    // Keep several destinations on the same edge readable without changing their aim direction.
    for (const edge of ['left', 'right', 'top', 'bottom']) {
        const group = markers.filter((marker) => marker.edge === edge)
            .sort((a, b) => (edge === 'left' || edge === 'right' ? a.y - b.y : a.x - b.x));
        if (group.length < 2) continue;
        const vertical = edge === 'left' || edge === 'right';
        const low = vertical ? bounds.bottom : bounds.left;
        const high = vertical ? bounds.top : bounds.right;
        const coordinate = (marker) => vertical ? marker.y : marker.x;
        const setCoordinate = (marker, value) => { if (vertical) marker.y = value; else marker.x = value; };
        for (let i = 1; i < group.length; i++) {
            setCoordinate(group[i], Math.max(coordinate(group[i]), coordinate(group[i - 1]) + 50));
        }
        const overflow = coordinate(group[group.length - 1]) - high;
        if (overflow > 0) for (const marker of group) setCoordinate(marker, coordinate(marker) - overflow);
        const underflow = low - coordinate(group[0]);
        if (underflow > 0) for (const marker of group) setCoordinate(marker, coordinate(marker) + underflow);
    }
    return markers;
}
