/** Screen-covering Cave of Origin/Cerulean Cave battle backdrop, centered on the active camera. */
export class WorldMewtwoArena {
    constructor (cc, world) {
        this.cc = cc;
        this.frame = null;
        this.imageWidth = 1;
        this.imageHeight = 1;
        this.node = new cc.Node('MewtwoCeruleanCaveBackdrop');
        this.node.layer = cc.Layers.Enum.UI_2D;
        world.addChild(this.node);
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

    update (camera, visibleSize, enabled) {
        const active = !!enabled && !!this.frame;
        this.node.active = active;
        if (!active) return;

        const zoom = Math.max(0.01, camera.z || 1);
        const coverWidth = Math.max(1, visibleSize.width) / zoom * 1.08;
        const coverHeight = Math.max(1, visibleSize.height) / zoom * 1.08;
        const aspect = this.imageWidth / Math.max(1, this.imageHeight);
        let width = coverWidth;
        let height = width / aspect;
        if (height < coverHeight) {
            height = coverHeight;
            width = height * aspect;
        }
        this.transform.setContentSize(width, height);
        this.node.setPosition(camera.x, camera.y, -10);
    }
}
