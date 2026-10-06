import { DEFAULT_WORLD_LAYOUT, POND_ART_SCALE, createPondContours, inPondClearing } from './world-map-layout.js';
import { makeRng } from './rng.js';

const SHORE_PLANT_KEYS = [
    'grass_tuft_01', 'grass_tuft_02', 'grass_tuft_03', 'grass_tuft_04',
    'flowers_cream', 'flowers_yellow', 'flowers_pink', 'flowers_blueviolet',
    'mixed_cream', 'mixed_yellow', 'mixed_pink', 'mixed_blueviolet',
];

function pointInPolygon (x, y, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        const crosses = (yi > y) !== (yj > y)
            && x < (xj - xi) * (y - yi) / (yj - yi) + xi;
        if (crosses) inside = !inside;
    }
    return inside;
}

function traceSmoothContour (ctx, points, centerX, centerY) {
    const count = points.length;
    ctx.beginPath();
    ctx.moveTo(centerX + points[0][0], centerY + points[0][1]);
    for (let i = 0; i < count; i++) {
        const p0 = points[(i + count - 1) % count];
        const p1 = points[i];
        const p2 = points[(i + 1) % count];
        const p3 = points[(i + 2) % count];
        ctx.bezierCurveTo(
            centerX + p1[0] + (p2[0] - p0[0]) / 6,
            centerY + p1[1] + (p2[1] - p0[1]) / 6,
            centerX + p2[0] - (p3[0] - p1[0]) / 6,
            centerY + p2[1] - (p3[1] - p1[1]) / 6,
            centerX + p2[0], centerY + p2[1],
        );
    }
    ctx.closePath();
}

function getContourMetrics (points) {
    const lengths = [];
    const cumulative = [];
    let perimeter = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        lengths.push(length);
        cumulative.push(perimeter);
        perimeter += length;
    }
    return { lengths, cumulative, perimeter };
}

function createTexturedLakeCanvas (assets, geometry) {
    const padding = 2;
    const width = Math.ceil(geometry.outerRx * 2 + padding * 2);
    const height = Math.ceil(geometry.outerRy * 2 + padding * 2);
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const mask = maskCanvas.getContext('2d', { willReadFrequently: true });
    mask.fillStyle = '#fff';
    traceSmoothContour(mask, geometry.outer, centerX, centerY);
    mask.fill();
    mask.globalCompositeOperation = 'destination-out';
    traceSmoothContour(mask, geometry.water, centerX, centerY);
    mask.fill();

    const shoreCanvas = document.createElement('canvas');
    shoreCanvas.width = 64;
    shoreCanvas.height = 16;
    const shoreContext = shoreCanvas.getContext('2d', { willReadFrequently: true });
    shoreContext.imageSmoothingEnabled = false;
    shoreContext.drawImage(assets.shoreEdge, 0, 0, 64, 16);
    const shorePixels = shoreContext.getImageData(0, 0, 64, 16).data;
    const maskPixels = mask.getImageData(0, 0, width, height).data;
    const shoreOutput = mask.createImageData(width, height);
    const metrics = getContourMetrics(geometry.outer);

    // Follow the seeded curved shoreline and sample the supplied 64×16 bank strip.
    // This keeps its source pixels while allowing the edge to bend with each lake shape.
    for (let py = 0; py < height; py++) {
        const localY = py - centerY;
        for (let px = 0; px < width; px++) {
            const maskIndex = (py * width + px) * 4;
            if (maskPixels[maskIndex + 3] < 16) continue;
            const localX = px - centerX;
            let bestSq = Infinity;
            let bestAlong = 0;
            for (let i = 0; i < geometry.outer.length; i++) {
                const a = geometry.outer[i];
                const b = geometry.outer[(i + 1) % geometry.outer.length];
                const vx = b[0] - a[0], vy = b[1] - a[1];
                const lengthSq = vx * vx + vy * vy || 1;
                const t = Math.max(0, Math.min(1, ((localX - a[0]) * vx + (localY - a[1]) * vy) / lengthSq));
                const dx = localX - a[0] - vx * t;
                const dy = localY - a[1] - vy * t;
                const distanceSq = dx * dx + dy * dy;
                if (distanceSq < bestSq) {
                    bestSq = distanceSq;
                    bestAlong = metrics.cumulative[i] + metrics.lengths[i] * t;
                }
            }
            const sx = Math.floor(bestAlong) % 64;
            const sy = Math.min(15, Math.floor(Math.sqrt(bestSq)));
            const sourceIndex = (sy * 64 + sx) * 4;
            const alpha = Math.round(shorePixels[sourceIndex + 3] * maskPixels[maskIndex + 3] / 255);
            const out = (py * width + px) * 4;
            shoreOutput.data[out] = shorePixels[sourceIndex];
            shoreOutput.data[out + 1] = shorePixels[sourceIndex + 1];
            shoreOutput.data[out + 2] = shorePixels[sourceIndex + 2];
            shoreOutput.data[out + 3] = alpha;
        }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(shoreOutput, 0, 0);
    const waterPattern = ctx.createPattern(assets.waterCore, 'repeat');
    traceSmoothContour(ctx, geometry.water, centerX, centerY);
    ctx.fillStyle = waterPattern;
    ctx.fill();
    return canvas;
}

function signedPolygonArea (points) {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        area += a[0] * b[1] - b[0] * a[1];
    }
    return area;
}

function makeShorePlants (pond) {
    const rng = makeRng(((pond.shapeSeed || 0) ^ 0x72f36e91) >>> 0);
    const geometry = createPondContours(pond);
    const artScale = POND_ART_SCALE * (pond.scale || 1);
    const props = [];
    const count = 6 + rng.int(0, 1);
    const phase = rng.range(-0.24, 0.24);
    for (let i = 0; i < count; i++) {
        const angle = phase + (i + 0.35) * Math.PI * 2 / count;
        // Leave a broad southern approach open; the rest is a few loose mixed clumps.
        if (Math.sin(angle) > 0.70 && Math.cos(angle) > -0.35 && Math.cos(angle) < 0.55) continue;
        const extra = rng.range(30, 48);
        const x = Math.cos(angle) * (geometry.outerRx + extra);
        const y = Math.sin(angle) * (geometry.outerRy + extra);
        const key = SHORE_PLANT_KEYS[rng.int(0, SHORE_PLANT_KEYS.length - 1)];
        const isGrassTuft = key.startsWith('grass_tuft_');
        const sizeMultiplier = isGrassTuft ? 1.8 : 1.28;
        props.push({
            key,
            x: pond.x + x * artScale,
            y: pond.y + y * artScale,
            // The tufts use only about a third of their 64px atlas cell; scale them
            // independently so they read as shoreline grass without enlarging flowers equally.
            size: rng.range(42, 52) * sizeMultiplier * artScale,
            scale: isGrassTuft ? rng.range(0.88, 0.98) : rng.range(0.8, 0.92),
        });
    }
    return props;
}

/** Seeded, source-textured basin. Only the trainer collides with the water. */
export class WorldPond {
    constructor (cc, world) {
        this.cc = cc;
        this.lakeNode = new cc.Node('Lake');
        this.lakeNode.layer = cc.Layers.Enum.UI_2D;
        world.addChild(this.lakeNode);
        this.lakeSprite = this.lakeNode.addComponent(cc.Sprite);
        this.lakeSprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        this.lakeTransform = this.lakeNode.getComponent(cc.UITransform);
        this.lakeTransform.anchorX = 0.5;
        this.lakeTransform.anchorY = 0.5;

        this.plantRoot = new cc.Node('PondShorePlants');
        this.plantRoot.layer = cc.Layers.Enum.UI_2D;
        world.addChild(this.plantRoot);
        this.plantNodes = [];
        this.plantFrames = null;
        this.lakeAssets = null;
        this.layout = DEFAULT_WORLD_LAYOUT;
        this.geometry = createPondContours(this.layout.pond);
        this.waterWinding = signedPolygonArea(this.geometry.water);
        this.spawnTimer = 3;
        this.familyIndex = -1;
        this.enabled = true;
    }

    setFamilyIndex (index) {
        this.familyIndex = index;
    }

    setLakeAssets (assets) {
        this.lakeAssets = assets;
        this.rebuildLake();
    }

    setWorldLayout (layout) {
        this.layout = layout || DEFAULT_WORLD_LAYOUT;
        this.geometry = createPondContours(this.layout.pond);
        this.waterWinding = signedPolygonArea(this.geometry.water);
        this.rebuildLake();
        if (this.plantFrames) this.setPlantFrames(this.plantFrames);
    }

    rebuildLake () {
        if (!this.lakeAssets) return;
        const canvas = createTexturedLakeCanvas(this.lakeAssets, this.geometry);
        const frame = this.cc.SpriteFrame.createWithImage(canvas);
        if (frame.texture && typeof frame.texture.setFilters === 'function') frame.texture.setFilters(1, 1);
        this.lakeSprite.spriteFrame = frame;
        this.lakeTransform.setContentSize(canvas.width, canvas.height);
        const position = this.layout.pond;
        const artScale = POND_ART_SCALE * (Number.isFinite(position.scale) ? position.scale : 1);
        this.lakeNode.setPosition(position.x, position.y, -1);
        this.lakeNode.setScale(artScale, artScale, 1);
    }

    reset () {
        this.spawnTimer = 3;
    }

    setActive (enabled) {
        this.enabled = !!enabled;
        this.lakeNode.active = !!enabled;
        this.plantRoot.active = !!enabled;
    }

    setPlantFrames (frames) {
        this.plantFrames = frames;
        const props = makeShorePlants(this.layout.pond);
        for (let i = 0; i < props.length; i++) {
            const prop = props[i];
            const frame = frames[prop.key] && frames[prop.key].frame;
            if (!frame) continue;
            let entry = this.plantNodes[i];
            if (!entry) {
                const node = new this.cc.Node('PondBankPlant');
                node.layer = this.cc.Layers.Enum.UI_2D;
                this.plantRoot.addChild(node);
                const sprite = node.addComponent(this.cc.Sprite);
                sprite.sizeMode = this.cc.Sprite.SizeMode.CUSTOM;
                const transform = node.getComponent(this.cc.UITransform);
                transform.anchorX = 0.5;
                transform.anchorY = 0.16;
                entry = { node, sprite, transform };
                this.plantNodes[i] = entry;
            }
            entry.sprite.spriteFrame = frame;
            entry.transform.setContentSize(prop.size, prop.size);
            entry.node.setScale(prop.scale, prop.scale, 1);
            entry.node.setPosition(prop.x, prop.y, 0);
            entry.node.active = true;
        }
        for (let i = props.length; i < this.plantNodes.length; i++) this.plantNodes[i].node.active = false;
    }

    drawGround () {
        // The lake is now a nearest-filtered Sprite built from the processed Lake.png tileset.
        // It lives in the world node so camera motion, depth, and other ground props stay aligned.
    }

    updateEncounters (dt, playerX, playerY, enemies, minute, enabled) {
        const position = this.layout.pond;
        const pondScale = Number.isFinite(position.scale) ? position.scale : 1;
        const artScale = POND_ART_SCALE * pondScale;
        const radius = Math.max(this.geometry.waterRx, this.geometry.waterRy) * artScale;
        if (!enabled || this.familyIndex < 0 || Math.hypot(playerX - position.x, playerY - position.y) > radius + 540) return;
        this.spawnTimer -= dt;
        if (this.spawnTimer > 0) return;

        let residents = 0;
        for (let i = 0; i < enemies.n; i++) {
            if (enemies.dead[i] || enemies.trainer[i] || enemies.boss[i] || enemies.fam[i] !== this.familyIndex) continue;
            if (Math.hypot(enemies.x[i] - position.x, enemies.y[i] - position.y) < radius + 170) residents++;
        }
        if (residents < 3 && enemies.n < enemies.cfg.populationCap) {
            const slots = [[-0.34, -0.20], [0.31, 0.18], [0.06, -0.42]];
            const [nx, ny] = slots[residents % slots.length];
            enemies.spawn(position.x + nx * this.geometry.waterRx * artScale,
                position.y + ny * this.geometry.waterRy * artScale,
                this.familyIndex, 1, false, minute);
        }
        this.spawnTimer = 15;
    }

    resolvePlayer (player, radius, enabled = true, previousPosition = null) {
        if (!enabled) return;
        const position = this.layout.pond;
        const artScale = POND_ART_SCALE * (Number.isFinite(position.scale) ? position.scale : 1);
        const points = this.geometry.water;
        const targetX = player.x;
        const targetY = player.y;
        const startX = previousPosition && Number.isFinite(previousPosition.x) ? previousPosition.x : targetX;
        const startY = previousPosition && Number.isFinite(previousPosition.y) ? previousPosition.y : targetY;
        const clearance = radius / artScale + 1;

        const resolveAtCurrentPosition = () => {
            for (let iteration = 0; iteration < 8; iteration++) {
                const x = (player.x - position.x) / artScale;
                const y = (player.y - position.y) / artScale;
                let best = null;
                let bestEdge = null;
                let bestSq = Infinity;
                for (let i = 0; i < points.length; i++) {
                    const a = points[i];
                    const b = points[(i + 1) % points.length];
                    const vx = b[0] - a[0], vy = b[1] - a[1];
                    const t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / (vx * vx + vy * vy)));
                    const px = a[0] + vx * t, py = a[1] + vy * t;
                    const dx = x - px, dy = y - py;
                    const distanceSq = dx * dx + dy * dy;
                    if (distanceSq < bestSq) { bestSq = distanceSq; best = [px, py]; bestEdge = [a, b]; }
                }
                if (!best) return;

                const inside = pointInPolygon(x, y, points);
                const distance = Math.sqrt(bestSq);
                const signedDistance = inside ? -distance : distance;
                if (signedDistance >= clearance) return;

                let nx, ny;
                if (distance > 0.001) {
                    const sign = inside ? -1 : 1;
                    nx = (x - best[0]) / distance * sign;
                    ny = (y - best[1]) / distance * sign;
                } else {
                    const [a, b] = bestEdge;
                    const dx = b[0] - a[0], dy = b[1] - a[1];
                    const sign = this.waterWinding > 0 ? 1 : -1;
                    const length = Math.hypot(dx, dy) || 1;
                    nx = sign * dy / length;
                    ny = -sign * dx / length;
                }

                player.x = position.x + (best[0] + nx * clearance) * artScale;
                player.y = position.y + (best[1] + ny * clearance) * artScale;
                const inward = player.vx * nx + player.vy * ny;
                if (inward < 0) {
                    player.vx -= inward * nx;
                    player.vy -= inward * ny;
                }
            }
        };

        // Resolve along the movement path so a quick step cannot cross the whole lake.
        const dx = targetX - startX;
        const dy = targetY - startY;
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
        player.x = startX;
        player.y = startY;
        resolveAtCurrentPosition();
        for (let step = 0; step < steps; step++) {
            player.x = startX + dx * (step + 1) / steps;
            player.y = startY + dy * (step + 1) / steps;
            resolveAtCurrentPosition();
        }
    }
}

export { inPondClearing };
