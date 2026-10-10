const TAU = Math.PI * 2;

/** Distance-aware choice with two-move memory; randomness changes tactics, not just order. */
export function chooseLugiaMove (attack, rng, distance, phaseTwo) {
    if (attack.attackCount === 0) return 0;
    const weights = distance < 210 ? [1, 2, 0.5, 5, 3]
        : distance > 420 ? [5, 3, 1, 2, 4] : [3, 4, 3, 3, 3];
    if (phaseTwo) { weights[3] *= 1.4; weights[4] *= 1.5; }
    // Short pressure exchanges build toward a signature release, then a longer opening.
    if (attack.lugiaPressure >= 2) { weights[0] *= 2.5; weights[2] *= 3; }
    const history = attack.lugiaHistory || [];
    // Don't repeat either of the previous two actions, or cast the safe-eye wave
    // when the player is already inside its eye or beyond its reach.
    history.forEach((move) => { weights[move] = 0; });
    if (distance < 110 || distance > (phaseTwo ? 520 : 460)) weights[2] = 0;
    let roll = rng.next() * weights.reduce((sum, w) => sum + w, 0);
    for (let i = 0; i < weights.length; i++) {
        roll -= weights[i];
        if (roll < 0) return i;
    }
    return weights.findIndex((w) => w > 0);
}

/** Current damage footprint, shared by collision and both rendering passes. */
export function lugiaImpactAreas (attack, elapsed) {
    if (attack.sequenceKind === 'lugia-tide') {
        return attack.lugiaShots.flatMap((delay) => {
            const travel = (elapsed - delay) / attack.lugiaTravelTime;
            if (travel < 0 || travel > 1) return [];
            const radius = 100 + travel * (attack.length - 100);
            return [{ shape: 'ring', x: attack.sourceX, y: attack.sourceY,
                radius, innerRadius: Math.max(76, radius - attack.width) }];
        });
    }
    return attack.areas.flatMap((route) => attack.lugiaShots.flatMap((shotDelay) => {
        const travel = (elapsed - shotDelay - (route.delay || 0)) / attack.lugiaTravelTime;
        if (travel < 0 || travel > 1) return [];
        const distance = 48 + travel * (route.length - 96);
        return { shape: 'rect', x: attack.sourceX + Math.cos(route.angle) * distance,
            y: attack.sourceY + Math.sin(route.angle) * distance,
            length: attack.moveIndex === 0 ? 96 : 58, width: route.width, angle: route.angle };
    }));
}

export function buildLugiaPattern (attack, angle, phaseTwo, moveIndex, rng) {
    attack.lugiaVariant = rng.next() < 0.5 ? 0 : 1;
    attack.lugiaHistory = [...(attack.lugiaHistory || []), moveIndex].slice(-2);
    attack.lugiaPressure = moveIndex === 0 || moveIndex === 2 ? 0 : (attack.lugiaPressure || 0) + 1;
    attack.type = 'signature';
    attack.angle = angle;
    attack.x = attack.sourceX;
    attack.y = attack.sourceY;
    attack.safeWidth = attack.safeOffset = 0;
    attack.safeAreas = [];
    attack.markers = [];
    attack.length = phaseTwo ? 780 : 720;
    attack.width = phaseTwo ? 86 : 68;
    attack.windupDuration = [1.45, 1.1, 1.9, 1.2, 1.4][moveIndex];
    attack.lugiaRecovery = [1.8, 1.15, 2.5, 1.3, 1.65][moveIndex] - (phaseTwo ? 0.25 : 0);
    attack.lugiaTravelTime = moveIndex === 2 ? 1.8 : moveIndex === 0 ? 1.05 : 1.45;
    attack.lugiaShots = attack.lugiaVariant && phaseTwo ? [0, 0.55] : [0];
    attack.sequenceKind = ['lugia-aeroblast', 'lugia-gust', 'lugia-tide', 'lugia-sweep', 'lugia-crossfire'][moveIndex];
    attack.name = ['气旋攻击 · 横向闪避', '翼风齐射 · 穿过风隙', '潮汐之环 · 靠近风眼',
        '掠翼扫射 · 避开连续风刃', '交错风阵 · 看准两轮间隙'][moveIndex];
    if (moveIndex === 2) {
        attack.length = phaseTwo ? 560 : 500;
        attack.width = phaseTwo ? 52 : 42;
        attack.areas = [{ shape: 'ring', x: attack.x, y: attack.y,
            radius: attack.length, innerRadius: 76 }];
        attack.safeAreas = [{ shape: 'circle', x: attack.x, y: attack.y, radius: 76 }];
    } else {
        let spreads = moveIndex === 0 ? [0] : phaseTwo ? [-0.64, -0.32, 0, 0.32, 0.64] : [-0.44, 0, 0.44];
        if (moveIndex === 3) {
            spreads = [-0.72, -0.36, 0, 0.36, 0.72];
            if (attack.lugiaVariant) spreads.reverse();
            attack.lugiaShots = [0];
        } else if (moveIndex === 4) {
            spreads = [-0.48, 0, 0.48, -0.24, 0.24];
            attack.lugiaShots = [0];
        }
        attack.areas = spreads.map((spread, index) => {
            const heading = angle + spread;
            return { shape: 'rect', x: attack.x + Math.cos(heading) * attack.length / 2,
                y: attack.y + Math.sin(heading) * attack.length / 2,
                length: attack.length, width: moveIndex === 0 ? attack.width : phaseTwo ? 38 : 32,
                angle: heading, delay: moveIndex === 3 ? index * 0.18 : moveIndex === 4 && index >= 3 ? 0.65 : 0 };
        });
    }
    attack.impactDuration = attack.lugiaTravelTime + Math.max(...attack.lugiaShots)
        + Math.max(...attack.areas.map((area) => area.delay || 0));
}

export function drawLugiaAttack (batch, pal, attack, wall, progress, impact) {
    const draw = (glyph, x, y, sx, sy, angle, color, alpha) =>
        batch.draw(glyph, x, y, sx, sy, angle, pal.get(color, alpha));
    if (!impact) {
        // Charge belongs to Lugia, rather than a collection of effects at distant targets.
        const radius = 65 - progress * 30;
        const charge = progress * progress;
        const size = 1.05 + charge * (attack.moveIndex === 2 ? 1.25 : 0.8);
        draw('aura', attack.sourceX, attack.sourceY, size, size, 0, '#72def2', 35 + charge * 85);
        for (let i = 0; i < 6; i++) {
            const a = i * TAU / 6 - wall * 1.3;
            draw('diamond', attack.sourceX + Math.cos(a) * radius,
                attack.sourceY + Math.sin(a) * radius, 0.18, 0.3, a, '#d9ffff', 180);
        }
        // A brief local tightening signals the release without covering the battlefield.
        if (progress > 0.76) {
            const lock = (progress - 0.76) / 0.24;
            draw('ring', attack.sourceX, attack.sourceY, 1.45 - lock * 0.55,
                0.85 - lock * 0.25, 0, '#e3ffff', 65 + lock * 150);
        }
        return;
    }
    const elapsed = progress * attack.impactDuration;
    const release = Math.max(0, 1 - elapsed / 0.28);
    if (release > 0) {
        const scale = 0.8 + (1 - release) * (attack.moveIndex === 2 ? 1.8 : 1.0);
        draw('ring', attack.sourceX, attack.sourceY, scale, scale * 0.7,
            0, '#d9ffff', Math.round(release * 180));
    }
    const areas = lugiaImpactAreas(attack, progress * attack.impactDuration);
    for (const area of areas) {
        if (area.shape === 'ring') {
            // Small crests trace the actual wavefront; the graphics pass draws its exact annulus.
            for (let i = 0; i < 24; i++) {
                const a = i * TAU / 24;
                const r = (area.radius + area.innerRadius) / 2;
                draw('wave', area.x + Math.cos(a) * r, area.y + Math.sin(a) * r,
                    0.55, 0.42, a + Math.PI / 2, '#dcffff', 200);
            }
        } else {
            const ux = Math.cos(area.angle), uy = Math.sin(area.angle);
            const nx = -uy, ny = ux;
            // Tapered wisps trail behind a curved leading edge, without a closed outline.
            for (const side of [-1, 1]) {
                const offset = side * area.width * 0.22;
                draw('legendRay', area.x - ux * area.length * 0.22 + nx * offset,
                    area.y - uy * area.length * 0.22 + ny * offset,
                    area.length / 62, area.width / 90, area.angle, '#72def2', 150);
            }
            draw('legendArc', area.x, area.y, area.width / 48, area.length / 62,
                area.angle - Math.PI / 2, '#b8f6ff', 235);
            draw('legendRay', area.x, area.y, area.length / 64, area.width / 120,
                area.angle, '#edffff', 230);
        }
    }
}
