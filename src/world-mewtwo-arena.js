export const MEWTWO_ARENA_BOUNDS = Object.freeze({ halfWidth: 550, halfHeight: 286 });

export const MEWTWO_ARENA_SIZE = Object.freeze({ width: 1200, height: 1200 * 941 / 1672 });
export const LUGIA_ARENA_BOUNDS = Object.freeze({ halfWidth: 550, halfHeight: 345 });
export const LUGIA_ARENA_SIZE = Object.freeze({ width: 1200, height: 1200 * 1024 / 1536 });
export const RAYQUAZA_ARENA_BOUNDS = Object.freeze({ halfWidth: 550, halfHeight: 310 });
export const RAYQUAZA_ARENA_SIZE = Object.freeze({ width: 1200, height: 1200 * 941 / 1672 });
const ARENA_WORLD_WIDTH = 1200;

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
