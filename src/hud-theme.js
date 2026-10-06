/* Small reusable handheld-style surfaces, in the game's 1280 × 720 view space. */
export const HUD = { ink: '#26384a', paper: '#fff7e3', muted: '#667c80', blue: '#72bce8', green: '#69c989', red: '#ef665c' };

export function color(cc, hex, alpha = 255) {
    const n = parseInt(hex.slice(1), 16);
    return new cc.Color(n >> 16, (n >> 8) & 255, n & 255, alpha);
}

export function card(g, cc, x, y, width, height, accent = HUD.blue) {
    g.clear();
    g.fillColor = color(cc, HUD.ink, 40);
    g.roundRect(x, y - 5, width, height, 14); g.fill();
    g.fillColor = color(cc, HUD.paper);
    g.strokeColor = color(cc, HUD.ink);
    g.lineWidth = 2.5;
    g.roundRect(x, y, width, height, 14); g.fill(); g.stroke();
    g.fillColor = color(cc, accent);
    g.roundRect(x + 12, y + height - 7, 38, 4, 2); g.fill();
}

export function gauge(g, cc, x, y, width, height, progress, tint) {
    g.clear();
    g.fillColor = color(cc, '#dce5d9');
    g.roundRect(x, y, width, height, height / 2); g.fill();
    const fill = Math.max(0, Math.min(1, progress)) * (width - 4);
    if (fill > 0) {
        g.fillColor = color(cc, tint);
        g.roundRect(x + 2, y + 2, fill, height - 4, Math.min(fill / 2, (height - 4) / 2)); g.fill();
    }
    g.strokeColor = color(cc, HUD.ink, 180);
    g.lineWidth = 1.5;
    g.roundRect(x, y, width, height, height / 2); g.stroke();
}
