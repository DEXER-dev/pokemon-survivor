/** Canonical opening choices, grouped by generation and backed by the game's live families. */
export const STARTER_POKEMON = [
    { generation: 1, family: 'mush', name: '妙蛙种子', icon: 'BULBASAUR', style: '草系 · 孢子弹幕' },
    { generation: 1, family: 'lizard', name: '小火龙', icon: 'CHARMANDER', style: '火系 · 炽焰弹' },
    { generation: 1, family: 'turtle', name: '杰尼龟', icon: 'SQUIRTLE', style: '水系 · 扫射水柱' },
    { generation: 2, family: 'chikorita', name: '菊草叶', icon: 'CHIKORITA', style: '草系 · 治愈叶环' },
    { generation: 2, family: 'cyndaquil', name: '火球鼠', icon: 'CYNDAQUIL', style: '火系 · 爆炎火球' },
    { generation: 2, family: 'totodile', name: '小锯鳄', icon: 'TOTODILE', style: '水系 · 潮汐冲击' },
    { generation: 3, family: 'grove', name: '木守宫', icon: 'TREECKO', style: '草系 · 叶刃扇射' },
    { generation: 3, family: 'striker', name: '火稚鸡', icon: 'TORCHIC', style: '火系 · 烈焰冲锋' },
    { generation: 3, family: 'drop', name: '水跃鱼', icon: 'MUDKIP', style: '水系 · 冰泡领域' },
    { generation: 4, family: 'turtwig', name: '草苗龟', icon: 'TURTWIG', style: '草系 · 根须结界' },
    { generation: 4, family: 'chimchar', name: '小火焰猴', icon: 'CHIMCHAR', style: '火系 · 筋斗火轮' },
    { generation: 4, family: 'piplup', name: '波加曼', icon: 'PIPLUP', style: '水系 · 冰潮光束' },
    { generation: 5, family: 'snivy', name: '藤藤蛇', icon: 'SNIVY', style: '草系 · 藤鞭扫射' },
    { generation: 5, family: 'tepig', name: '暖暖猪', icon: 'TEPIG', style: '火系 · 烈焰冲锋' },
    { generation: 5, family: 'oshawott', name: '水水獭', icon: 'OSHAWOTT', style: '水系 · 贝刃回旋' },
    { generation: 6, family: 'chespin', name: '哈力栗', icon: 'CHESPIN', style: '草系 · 荆棘护阵' },
    { generation: 6, family: 'fennekin', name: '火狐狸', icon: 'FENNEKIN', style: '火系 · 魔焰念光' },
    { generation: 6, family: 'froakie', name: '呱呱泡蛙', icon: 'FROAKIE', style: '水系 · 水手里剑' },
    { generation: 7, family: 'badger', name: '木木枭', icon: 'ROWLET', style: '草系 · 追踪羽箭' },
    { generation: 7, family: 'litten', name: '火斑喵', icon: 'LITTEN', style: '火系 · 暗焰爪击' },
    { generation: 7, family: 'popplio', name: '球球海狮', icon: 'POPPLIO', style: '水系 · 泡泡圆舞' },
    { generation: 8, family: 'grookey', name: '敲音猴', icon: 'GROOKEY', style: '草系 · 鼓点震荡' },
    { generation: 8, family: 'scorbunny', name: '炎兔儿', icon: 'SCORBUNNY', style: '火系 · 火焰飞踢' },
    { generation: 8, family: 'sobble', name: '泪眼蜥', icon: 'SOBBLE', style: '水系 · 精准水弹' },
    { generation: 9, family: 'sprigatito', name: '新叶喵', icon: 'SPRIGATITO', style: '草系 · 魔术叶刃' },
    { generation: 9, family: 'fuecoco', name: '呆火鳄', icon: 'FUECOCO', style: '火系 · 歌声燃环' },
    { generation: 9, family: 'quaxly', name: '润水鸭', icon: 'QUAXLY', style: '水系 · 水舞飞踢' },
];

export const STARTER_GENERATIONS = [...new Set(STARTER_POKEMON.map((starter) => starter.generation))];
export const STARTER_BY_FAMILY = new Map(STARTER_POKEMON.map((starter) => [starter.family, starter]));
