# 二级神伙伴特效素材

此目录保存核验过的原始素材、裁切清单和构建后的 nearest-neighbor 图集。所有上游素材均为 CC0/公共领域；游戏内运行时只加载 `sublegendary-atlas.png`。

- [Pixel Art Spells — DevWizard](https://opengameart.org/content/pixel-art-spells), CC0：普通水球、雷针、火球、雷核、水矢，以及冰枪、火弹、水花条带。原始压缩包为 `source/pixel-art-spells-devwizard.zip`。
- [M484 Lightning Weapon — Master484](https://opengameart.org/content/m484-lightning-weapon), CC0/公共领域：闪电鸟主动招式的四个短线/折角部件。来源图保留在 `source/m484-lightning-master484.png`；构建时只移除红色参考线和黑底。
- [Pixel art sword slash effect — tbbk](https://opengameart.org/content/pixel-art-sword-slash-effect), CC0：雷公主动招式的三种月牙斩痕。来源图为 `source/pixel-slash-tbbk.png`。
- [Explosion Animation — den_yes](https://opengameart.org/content/explosion-animation-1), CC0：炎帝主动招式的六帧 32×32 踏击爆裂。来源图为 `source/explosion-den_yes.png`。

运行 `python tools/build-sublegendary-vfx-atlas.py` 可从这些原始文件重建图集与 `manifest.json`。构建过程只做无损帧裁切、透明化 M484 黑底/参考线和 64px 透明格布局，不放大素材像素。
