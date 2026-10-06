/** Human trainer overworld sheets; boss sprites stay in BOSS.encounters order, followed by player-only options.
 *  Append new appearances at the end so existing encounter → sprite indices never shift. */
export const TRAINER_SPRITES = [
    { file: 'NPC_164_Gym_Leader_Gardenia.png', name: '菜种' },
    { file: 'NPC_170_Gym_Leader_Volkner.png', name: '电次' },
    { file: 'NPC_001_Ace_Trainer_M.png', name: '王牌训练家' },
    { file: 'NPC_166_Gym_Leader_Crasher_Wake.png', name: '吉宪' },
    { file: 'NPC_167_Gym_Leader_Fantina.png', name: '梅丽莎' },
    { file: 'NPC_168_Gym_Leader_Byron.png', name: '东瓜' },
    { file: 'NPC_177_Elite_Four_Flint.png', name: '大叶' },
    { file: 'NPC_162_Gym_Leader_Clair.png', name: '小椿' },
    { file: 'NPC_178_Elite_Four_Lucian.png', name: '悟松' },
    { file: 'NPC_183_Champion_Cynthia.png', name: '竹兰' },
    { file: 'QISHU.png', name: '奇树' },
    { file: 'trRival_Nemona_Violet.png', name: '尼莫' },
];

/** Player-selectable portraits. Boss portraits remain in TRAINER_SPRITES for encounters. */
export const PLAYER_APPEARANCES = Object.freeze({
    lucas: 0,
    qishu: TRAINER_SPRITES.findIndex((trainer) => trainer.name === '奇树') + 1,
    nemona: TRAINER_SPRITES.findIndex((trainer) => trainer.name === '尼莫') + 1,
});
