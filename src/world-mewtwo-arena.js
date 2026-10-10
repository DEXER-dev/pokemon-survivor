export const MEWTWO_ARENA_BOUNDS = Object.freeze({ halfWidth: 550, halfHeight: 286 });

export const MEWTWO_ARENA_SIZE = Object.freeze({ width: 1200, height: 1200 * 941 / 1672 });
export const LUGIA_ARENA_BOUNDS = Object.freeze({ halfWidth: 550, halfHeight: 345 });
export const LUGIA_ARENA_SIZE = Object.freeze({ width: 1200, height: 1200 * 1024 / 1536 });
export const RAYQUAZA_ARENA_BOUNDS = Object.freeze({ halfWidth: 550, halfHeight: 310 });
export const RAYQUAZA_ARENA_SIZE = Object.freeze({ width: 1200, height: 1200 * 941 / 1672 });
export const KYOGRE_ARENA_BOUNDS = Object.freeze({ halfWidth: 550, halfHeight: 310 });
export const KYOGRE_ARENA_SIZE = Object.freeze({ width: 1200, height: 1200 * 941 / 1672 });
export const KYOGRE_ARENA_SQUARE_BOUNDS = Object.freeze({ halfWidth: 550, halfHeight: 550 });
export const KYOGRE_ARENA_SQUARE_SIZE = Object.freeze({ width: 1200, height: 1200 });
const ARENA_WORLD_WIDTH = 1200;

// Inner blue-water edge, traced in normalized image coordinates. Keep the player on the sand,
// while leaving the irregular foam shoreline visible around the pool.
const KYOGRE_POOL_SQUARE = Object.freeze([
    [0.455, 0.107], [0.482, 0.096], [0.526, 0.097], [0.545, 0.116],
    [0.568, 0.119], [0.591, 0.124], [0.625, 0.125], [0.641, 0.138],
    [0.679, 0.140], [0.700, 0.153], [0.738, 0.158], [0.765, 0.172],
    [0.784, 0.193], [0.786, 0.224], [0.802, 0.239], [0.826, 0.250],
    [0.837, 0.278], [0.856, 0.291], [0.867, 0.328], [0.875, 0.365],
    [0.869, 0.403], [0.850, 0.424], [0.824, 0.430], [0.805, 0.443],
    [0.799, 0.469], [0.810, 0.491], [0.797, 0.508], [0.767, 0.516],
    [0.744, 0.526], [0.735, 0.552], [0.711, 0.560], [0.700, 0.580],
    [0.672, 0.589], [0.655, 0.578], [0.624, 0.582], [0.607, 0.566],
    [0.590, 0.551], [0.560, 0.551], [0.545, 0.573], [0.524, 0.596],
    [0.488, 0.594], [0.470, 0.575], [0.453, 0.558], [0.429, 0.550],
    [0.411, 0.531], [0.395, 0.525], [0.382, 0.508], [0.349, 0.505],
    [0.330, 0.497], [0.312, 0.490], [0.301, 0.473], [0.286, 0.460],
    [0.270, 0.438], [0.256, 0.434], [0.247, 0.412], [0.251, 0.385],
    [0.249, 0.360], [0.260, 0.338], [0.280, 0.330], [0.284, 0.305],
    [0.304, 0.292], [0.311, 0.260], [0.333, 0.240], [0.341, 0.211],
    [0.365, 0.196], [0.385, 0.179], [0.413, 0.177], [0.440, 0.176],
    [0.457, 0.190], [0.480, 0.198], [0.501, 0.185], [0.510, 0.158],
    [0.535, 0.145], [0.559, 0.143], [0.575, 0.131],
]);

const KYOGRE_POOL_LANDSCAPE = Object.freeze([
    [0.241, 0.000], [0.758, 0.000], [0.779, 0.020], [0.811, 0.022],
    [0.823, 0.067], [0.846, 0.082], [0.857, 0.132], [0.873, 0.166],
    [0.884, 0.218], [0.892, 0.278], [0.901, 0.337], [0.894, 0.385],
    [0.869, 0.411], [0.841, 0.425], [0.823, 0.454], [0.797, 0.469],
    [0.773, 0.478], [0.749, 0.504], [0.719, 0.512], [0.700, 0.496],
    [0.665, 0.494], [0.645, 0.477], [0.615, 0.466], [0.590, 0.457],
    [0.562, 0.455], [0.545, 0.476], [0.516, 0.483], [0.496, 0.467],
    [0.466, 0.462], [0.445, 0.447], [0.414, 0.440], [0.394, 0.426],
    [0.368, 0.419], [0.348, 0.401], [0.324, 0.394], [0.310, 0.378],
    [0.287, 0.376], [0.276, 0.352], [0.273, 0.316], [0.263, 0.294],
    [0.268, 0.256], [0.279, 0.231], [0.271, 0.199], [0.282, 0.170],
    [0.297, 0.160], [0.301, 0.124], [0.319, 0.108], [0.338, 0.096],
    [0.352, 0.057], [0.377, 0.042], [0.396, 0.028], [0.416, 0.018],
]);

function toWorldPolygon (uv, worldHeight) {
    return Object.freeze(uv.map(([x, y]) => Object.freeze([
        (x - 0.5) * ARENA_WORLD_WIDTH,
        (0.5 - y) * worldHeight,
    ])));
}

const KYOGRE_POOL_WORLD_SQUARE = toWorldPolygon(KYOGRE_POOL_SQUARE, 1200);
const KYOGRE_POOL_WORLD_LANDSCAPE = toWorldPolygon(KYOGRE_POOL_LANDSCAPE, 1200 * 941 / 1672);

function pointInPolygon (x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
        if ((yi > y) !== (yj > y)
            && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

/** Push a player back onto the sandy shore if their feet approach or enter Kyogre's pool. */
export function constrainKyogrePlayerToShore (player, centerX, centerY, square, radius = 15) {
    const polygon = square ? KYOGRE_POOL_WORLD_SQUARE : KYOGRE_POOL_WORLD_LANDSCAPE;
    let x = player.x - centerX, y = player.y - centerY;
    const clearance = radius + 4;
    let collided = false, normalX = 0, normalY = 0;
    // A concave cove can put the nearest point on a neighboring shoreline segment after the
    // first projection, so settle the correction before returning to the movement loop.
    for (let pass = 0; pass < 4; pass++) {
        const inside = pointInPolygon(x, y, polygon);
        let nearestX = 0, nearestY = 0, nearestDistanceSq = Infinity;
        for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i], b = polygon[(i + 1) % polygon.length];
            const dx = b[0] - a[0], dy = b[1] - a[1];
            const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
            const qx = a[0] + dx * t, qy = a[1] + dy * t;
            const distanceSq = (x - qx) ** 2 + (y - qy) ** 2;
            if (distanceSq < nearestDistanceSq) {
                nearestDistanceSq = distanceSq;
                nearestX = qx;
                nearestY = qy;
            }
        }
        if (!inside && nearestDistanceSq >= (clearance - 0.5) ** 2) break;

        normalX = inside ? nearestX - x : x - nearestX;
        normalY = inside ? nearestY - y : y - nearestY;
        let normalLength = Math.hypot(normalX, normalY);
        if (normalLength < 0.001) {
            const centroid = polygon.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]);
            normalX = nearestX - centroid[0] / polygon.length;
            normalY = nearestY - centroid[1] / polygon.length;
            normalLength = Math.hypot(normalX, normalY) || 1;
        }
        normalX /= normalLength;
        normalY /= normalLength;
        x = nearestX + normalX * clearance;
        y = nearestY + normalY * clearance;
        collided = true;
    }
    if (!collided) return false;
    player.x = centerX + x;
    player.y = centerY + y;

    // Preserve motion along the shoreline, but remove velocity that would drive the player back
    // into the water on the next frame.
    const inwardVelocity = player.vx * normalX + player.vy * normalY;
    if (inwardVelocity < 0) {
        player.vx -= normalX * inwardVelocity;
        player.vy -= normalY * inwardVelocity;
    }
    player.speed = Math.hypot(player.vx, player.vy);
    return true;
}

/** Shared finite-room renderer; each legendary still owns a distinct map image and bounds. */
class WorldArenaBackdrop {
    constructor (cc, gameRoot, nodeName) {
        this.cc = cc;
        this.frame = null;
        this.imageWidth = 1;
        this.imageHeight = 1;
        this.node = new cc.Node(nodeName);
        this.node.layer = cc.Layers.Enum.UI_2D;
        gameRoot.addChild(this.node);
        // Root sibling order is explicit: ground graphics, cave art, then world actors.
        // Keeping this screen-space layer out of World prevents camera depth sorting from
        // burying the backdrop beneath the ground graphics on some renderer paths.
        this.node.setSiblingIndex(1);
        this.sprite = this.node.addComponent(cc.Sprite);
        this.sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        this.transform = this.node.getComponent(cc.UITransform);
        this.transform.anchorX = 0.5;
        this.transform.anchorY = 0.5;
        this.node.active = false;
    }

    setBackdrop ({ frame, width, height }) {
        this.frame = frame;
        this.imageWidth = width;
        this.imageHeight = height;
        this.sprite.spriteFrame = frame;
    }

    update (camera, center, enabled) {
        const active = !!enabled && !!this.frame;
        this.node.active = active;
        if (!active) return;

        const zoom = Math.max(0.01, camera.z || 1);
        const aspect = this.imageWidth / Math.max(1, this.imageHeight);
        const width = ARENA_WORLD_WIDTH * zoom;
        const height = width / aspect;
        this.transform.setContentSize(width, height);
        this.node.setPosition((center.x - camera.x) * zoom, (center.y - camera.y) * zoom, 0);
    }
}

/** Finite Cerulean Cave chamber, rendered in screen space from its world position. */
export class WorldMewtwoArena extends WorldArenaBackdrop {
    constructor (cc, gameRoot) {
        super(cc, gameRoot, 'MewtwoCeruleanCaveBackdrop');
    }
}

/** Finite Whirl Islands waterfall chamber. */
export class WorldLugiaArena extends WorldArenaBackdrop {
    constructor (cc, gameRoot) {
        super(cc, gameRoot, 'LugiaWhirlIslandsBackdrop');
    }
}

/** Finite Sky Pillar summit room for Rayquaza's legendary encounter. */
export class WorldRayquazaArena extends WorldArenaBackdrop {
    constructor (cc, gameRoot) {
        super(cc, gameRoot, 'RayquazaSkyPillarBackdrop');
    }
}

/** Finite Marine Cave pool and surrounding sand for Kyogre's legendary encounter. */
export class WorldKyogreArena extends WorldArenaBackdrop {
    constructor (cc, gameRoot) {
        super(cc, gameRoot, 'KyogreMarineCaveBackdrop');
        this.backdrops = null;
        this.layout = '';
    }

    setBackdrops (backdrops) {
        this.backdrops = backdrops;
        this.layout = '';
    }

    update (camera, center, enabled) {
        if (!this.backdrops) {
            super.update(camera, center, enabled);
            return;
        }
        const view = this.cc.view.getVisibleSize();
        const layout = view.width / Math.max(1, view.height) < 1.35 ? 'square' : 'landscape';
        if (layout !== this.layout) {
            this.layout = layout;
            this.setBackdrop(this.backdrops[layout]);
        }
        super.update(camera, center, enabled);
    }
}

const HOOH_CLOUD_LAYOUT = [
    [-4, -6, 22, 0.92], [84, -5, 22, 0.90],
    [-8, 11, 20, 0.90], [86, 13, 18, 0.88],
    [-6, 28, 17, 0.84], [83, 30, 20, 0.90],
    [-7, 44, 21, 0.78], [85, 46, 20, 0.82],
    [-6, 59, 19, 0.86], [83, 60, 20, 0.78],
    [-4, 74, 16, 0.72], [86, 76, 17, 0.78],
];

/** Ho-Oh's summit uses twelve separately animated cloud sprites behind the transparent tower art. */
export class WorldHoOhArena {
    constructor (cc, gameRoot) {
        this.cc = cc;
        this.foreground = null;
        this.clouds = [];
        this.imageWidth = 1672;
        this.imageHeight = 941;
        this.wall = 0;
        this.node = new cc.Node('HoOhBellTowerArena');
        this.node.layer = cc.Layers.Enum.UI_2D;
        gameRoot.addChild(this.node);
        this.node.setSiblingIndex(1);
        this.transform = this.node.addComponent(cc.UITransform);
        this.transform.anchorX = 0.5;
        this.transform.anchorY = 0.5;
        this.node.active = false;
    }

    setAssets ({ foreground, clouds }) {
        this.imageWidth = foreground.width;
        this.imageHeight = foreground.height;
        const addSprite = (name, asset) => {
            const node = new this.cc.Node(name);
            node.layer = this.cc.Layers.Enum.UI_2D;
            this.node.addChild(node);
            const sprite = node.addComponent(this.cc.Sprite);
            sprite.spriteFrame = asset.frame;
            sprite.sizeMode = this.cc.Sprite.SizeMode.CUSTOM;
            const transform = node.getComponent(this.cc.UITransform);
            transform.anchorX = 0.5;
            transform.anchorY = 0.5;
            return { node, sprite, transform, asset };
        };

        // Insert the clouds first so the transparent tower silhouette covers their inner edges.
        this.clouds = clouds.map((asset, index) => {
            const cloud = addSprite(`HoOhCloud${index + 1}`, asset);
            cloud.sprite.color = new this.cc.Color(255, 255, 255,
                Math.round(HOOH_CLOUD_LAYOUT[index][3] * 255));
            return cloud;
        });
        this.foreground = addSprite('HoOhTowerForeground', foreground);
    }

    update (camera, center, enabled, dt = 0, speed = 1) {
        const active = !!enabled && !!this.foreground;
        this.node.active = active;
        if (!active) return;

        this.wall += Math.max(0, dt);
        const zoom = Math.max(0.01, camera.z || 1);
        const width = 1200 * zoom;
        const height = width * this.imageHeight / this.imageWidth;
        this.transform.setContentSize(width, height);
        this.node.setPosition((center.x - camera.x) * zoom, (center.y - camera.y) * zoom, 0);
        this.foreground.transform.setContentSize(width, height);
        this.foreground.node.setPosition(0, 0, 0);

        const gale = speed > 1.01;
        const amplitude = gale ? 135 : 18;
        const frequency = gale ? 0.92 : 0.102;
        for (let index = 0; index < this.clouds.length; index++) {
            const cloud = this.clouds[index];
            const [left, top, widthPercent] = HOOH_CLOUD_LAYOUT[index];
            const cloudWidth = width * widthPercent / 100;
            const cloudHeight = cloudWidth * cloud.asset.height / cloud.asset.width;
            const baseX = width * (left / 100 + widthPercent / 200 - 0.5);
            const baseY = height * (0.5 - top / 100) - cloudHeight * 0.5;
            const phase = index * 2.399963 + (index % 2 ? Math.PI : 0);
            const direction = index % 2 ? -1 : 1;
            const travel = Math.sin(this.wall * frequency + phase);
            const driftX = direction * amplitude * travel * zoom;
            const driftY = Math.cos(this.wall * frequency * 0.72 + phase) * (gale ? 12 : 3) * zoom;
            cloud.transform.setContentSize(cloudWidth, cloudHeight);
            cloud.node.setPosition(baseX + driftX, baseY + driftY, 0);
        }
    }
}
