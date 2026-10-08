/** Screen-covering Cerulean Cave backdrop, kept between the ground and world actors. */
export class WorldMewtwoArena {
    constructor (cc, gameRoot) {
        this.cc = cc;
        this.frame = null;
        this.imageWidth = 1;
        this.imageHeight = 1;
        this.node = new cc.Node('MewtwoCeruleanCaveBackdrop');
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

    update (visibleSize, enabled) {
        const active = !!enabled && !!this.frame;
        this.node.active = active;
        if (!active) return;

        const coverWidth = Math.max(1, visibleSize.width) * 1.08;
        const coverHeight = Math.max(1, visibleSize.height) * 1.08;
        const aspect = this.imageWidth / Math.max(1, this.imageHeight);
        let width = coverWidth;
        let height = width / aspect;
        if (height < coverHeight) {
            height = coverHeight;
            width = height * aspect;
        }
        this.transform.setContentSize(width, height);
        this.node.setPosition(0, 0, 0);
    }
}
