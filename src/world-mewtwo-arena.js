export const MEWTWO_ARENA_BOUNDS = Object.freeze({ halfWidth: 550, halfHeight: 286 });

export const MEWTWO_ARENA_SIZE = Object.freeze({ width: 1200, height: 1200 * 941 / 1672 });
export const LUGIA_ARENA_BOUNDS = Object.freeze({ halfWidth: 550, halfHeight: 345 });
export const LUGIA_ARENA_SIZE = Object.freeze({ width: 1200, height: 1200 * 1024 / 1536 });
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
