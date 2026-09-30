/*
 * The roster's real Pokémon lines. From v0.9 on this is **not** display-only:
 * `chain.evolve` reads the `Evolutions` edges below, so this table is a rules table and the 图鉴 is
 * the same data the gate uses. One source, because a panel that teaches 「雷之石」 while the code
 * charges 3 只 is the exact lie §9.11-⑥-4 bans.
 *
 * Provenance, per field - all of it from the source database, so a reviewer greps instead of trusting:
 *   `key`  an `InternalName` from PBS/pokemon.txt, and the icon file name under assets/icons/
 *   `dex`  that record's `[n]` header
 *   `en`   that record's own `Name`
 *   `ty`   `Type1`/`Type2`, **per stage**, because canon changes mid-line (狙射树枭 drops 飞 for 幽)
 *   `ab`   the final stage's `Abilities` + `HiddenAbility`, verbatim
 *   `edge` the `Evolutions` value of each stage's own record, commas and all, unedited
 *   `zh`   NOT from the pack: this database ships no CJK name table, so these are the official
 *          Simplified-Chinese species names from model memory. `en` + `dex` are the audit anchor.
 *
 * What is deliberately *not* imported, and why:
 *   `Rareness` / catch rate - §6.1 signs 命中即收服: the aim picks the species, no capture dice.
 *   the type chart - a zero-output hero gives a matchup nothing to decide (§9.11-⑥-2).
 *   `Moves` - §5.7's 主技 are per-族 mechanics on the signed 形态 axis, not per-species move lists.
 */

import { CHAIN, tierName } from './config.js';
import { MEGA_FORMS } from './mega.js';
import { GIGANTAMAX_FORMS } from './gigantamax.js';

/** 'pokemon' draws the icon atlas; 'original' falls back to the §8 greybox glyphs and §8 names. */
export const SPECIES_MODE = 'pokemon';

/** evolution stones this roster spends, with the `price` column of PBS/items.txt. */
export const STONE = {
    DUSKSTONE: { en: 'Dusk Stone', zh: '暮光之石', price: 2100 },
    THUNDERSTONE: { en: 'Thunder Stone', zh: '雷之石', price: 2100 },
    WATERSTONE: { en: 'Water Stone', zh: '水之石', price: 2100 },
    LINKINGCORD: { en: 'Linking Cord', zh: '联结之绳', price: 5000 },
    KINGSROCK: { en: "King's Rock", zh: '王者之证', price: 6000 },
    GENGARITE: { en: 'Gengarite', zh: '耿鬼进化石', price: 2100 },
    GARDEVOIRITE: { en: 'Gardevoirite', zh: '沙奈朵进化石', price: 2100 },
    BEEDRILLITE: { en: 'Beedrillite', zh: '大针蜂进化石', price: 2100 },
    AMPHAROSITE: { en: 'Ampharosite', zh: '电龙进化石', price: 2100 },
    PIDGEOTITE: { en: 'Pidgeotite', zh: '大比鸟进化石', price: 2100 },
    BLAZIKENITE: { en: 'Blazikenite', zh: '火焰鸡进化石', price: 2100 },
    ALAKAZITE: { en: 'Alakazite', zh: '胡地进化石', price: 2100 },
    AGGRONITE: { en: 'Aggronite', zh: '波士可多拉进化石', price: 2100 },
    SCEPTILITE: { en: 'Sceptilite', zh: '蜥蜴王进化石', price: 2100 },
    SALAMENCITE: { en: 'Salamencite', zh: '暴飞龙进化石', price: 2100 },
    GARCHOMPITE: { en: 'Garchompite', zh: '烈咬陆鲨进化石', price: 2100 },
    METAGROSSITE: { en: 'Metagrossite', zh: '巨金怪进化石', price: 2100 },
    TYRANITARITE: { en: 'Tyranitarite', zh: '班基拉斯进化石', price: 2100 },
    LUCARIONITE: { en: 'Lucarionite', zh: '路卡利欧进化石', price: 2100 },
    SHINYSTONE: { en: 'Shiny Stone', zh: '光之石', price: 2100 },
    PROTECTOR: { en: 'Protector', zh: '护具', price: 3000 },
    ELECTIRIZER: { en: 'Electirizer', zh: '电力增幅器', price: 3000 },
    MAGMARIZER: { en: 'Magmarizer', zh: '熔岩增幅器', price: 3000 },
    UPGRADE: { en: 'Upgrade', zh: '升级数据', price: 3000 },
    DUBIOUSDISC: { en: 'Dubious Disc', zh: '可疑补丁', price: 3000 },
    STRAWBERRYSWEET: { en: 'Strawberry Sweet', zh: '草莓糖饰', price: 2100 },
};

export const SPECIES = {
    chikorita: {
        key: ['CHIKORITA', 'BAYLEEF', 'MEGANIUM'], dex: [152, 153, 154],
        en: ['Chikorita', 'Bayleef', 'Meganium'], zh: ['菊草叶', '月桂叶', '大竺葵'],
        ty: [['GRASS'], ['GRASS'], ['GRASS']], ab: 'OVERGROW', hid: 'LEAFGUARD',
        edge: ['BAYLEEF,Level,16', 'MEGANIUM,Level,32'], form: null,
    },
    cyndaquil: {
        key: ['CYNDAQUIL', 'QUILAVA', 'TYPHLOSION'], dex: [155, 156, 157],
        en: ['Cyndaquil', 'Quilava', 'Typhlosion'], zh: ['火球鼠', '火岩鼠', '火暴兽'],
        ty: [['FIRE'], ['FIRE'], ['FIRE']], ab: 'BLAZE', hid: 'FLASHFIRE',
        edge: ['QUILAVA,Level,14', 'TYPHLOSION,Level,36'], form: null,
    },
    totodile: {
        key: ['TOTODILE', 'CROCONAW', 'FERALIGATR'], dex: [158, 159, 160],
        en: ['Totodile', 'Croconaw', 'Feraligatr'], zh: ['小锯鳄', '蓝鳄', '大力鳄'],
        ty: [['WATER'], ['WATER'], ['WATER']], ab: 'TORRENT', hid: 'SHEERFORCE',
        edge: ['CROCONAW,Level,18', 'FERALIGATR,Level,30'], form: null,
    },
    turtwig: {
        key: ['TURTWIG', 'GROTLE', 'TORTERRA'], dex: [387, 388, 389],
        en: ['Turtwig', 'Grotle', 'Torterra'], zh: ['草苗龟', '树林龟', '土台龟'],
        ty: [['GRASS'], ['GRASS'], ['GRASS', 'GROUND']], ab: 'OVERGROW', hid: 'SHELLARMOR',
        edge: ['GROTLE,Level,18', 'TORTERRA,Level,32'], form: null,
    },
    chimchar: {
        key: ['CHIMCHAR', 'MONFERNO', 'INFERNAPE'], dex: [390, 391, 392],
        en: ['Chimchar', 'Monferno', 'Infernape'], zh: ['小火焰猴', '猛火猴', '烈焰猴'],
        ty: [['FIRE'], ['FIRE', 'FIGHTING'], ['FIRE', 'FIGHTING']], ab: 'BLAZE', hid: 'IRONFIST',
        edge: ['MONFERNO,Level,14', 'INFERNAPE,Level,36'], form: null,
    },
    piplup: {
        key: ['PIPLUP', 'PRINPLUP', 'EMPOLEON'], dex: [393, 394, 395],
        en: ['Piplup', 'Prinplup', 'Empoleon'], zh: ['波加曼', '波皇子', '帝王拿波'],
        ty: [['WATER'], ['WATER'], ['WATER', 'STEEL']], ab: 'TORRENT', hid: 'DEFIANT',
        edge: ['PRINPLUP,Level,16', 'EMPOLEON,Level,36'], form: null,
    },
    litten: {
        key: ['LITTEN', 'TORRACAT', 'INCINEROAR'], dex: [725, 726, 727],
        en: ['Litten', 'Torracat', 'Incineroar'], zh: ['火斑喵', '炎热喵', '炽焰咆哮虎'],
        ty: [['FIRE'], ['FIRE'], ['FIRE', 'DARK']], ab: 'BLAZE', hid: 'INTIMIDATE',
        edge: ['TORRACAT,Level,17', 'INCINEROAR,Level,34'], form: null,
    },
    popplio: {
        key: ['POPPLIO', 'BRIONNE', 'PRIMARINA'], dex: [728, 729, 730],
        en: ['Popplio', 'Brionne', 'Primarina'], zh: ['球球海狮', '花漾海狮', '西狮海壬'],
        ty: [['WATER'], ['WATER'], ['WATER', 'FAIRY']], ab: 'TORRENT', hid: 'LIQUIDVOICE',
        edge: ['BRIONNE,Level,17', 'PRIMARINA,Level,34'], form: null,
    },
    grookey: {
        key: ['GROOKEY', 'THWACKEY', 'RILLABOOM'], dex: [810, 811, 812],
        en: ['Grookey', 'Thwackey', 'Rillaboom'], zh: ['敲音猴', '啪咚猴', '轰擂金刚猩'],
        ty: [['GRASS'], ['GRASS'], ['GRASS']], ab: 'OVERGROW', hid: 'GRASSYSURGE',
        edge: ['THWACKEY,Level,16', 'RILLABOOM,Level,35'], form: null,
    },
    scorbunny: {
        key: ['SCORBUNNY', 'RABOOT', 'CINDERACE'], dex: [813, 814, 815],
        en: ['Scorbunny', 'Raboot', 'Cinderace'], zh: ['炎兔儿', '腾蹴小将', '闪焰王牌'],
        ty: [['FIRE'], ['FIRE'], ['FIRE']], ab: 'BLAZE', hid: 'LIBERO',
        edge: ['RABOOT,Level,16', 'CINDERACE,Level,35'], form: null,
    },
    sobble: {
        key: ['SOBBLE', 'DRIZZILE', 'INTELEON'], dex: [816, 817, 818],
        en: ['Sobble', 'Drizzile', 'Inteleon'], zh: ['泪眼蜥', '变涩蜥', '千面避役'],
        ty: [['WATER'], ['WATER'], ['WATER']], ab: 'TORRENT', hid: 'SNIPER',
        edge: ['DRIZZILE,Level,16', 'INTELEON,Level,35'], form: null,
    },
    // 草 - Area 孢子环. Venusaur's flower is the spore payload; 茂盛 is the hook §5.5-C names.
    mush: {
        key: ['BULBASAUR', 'IVYSAUR', 'VENUSAUR'], dex: [1, 2, 3],
        en: ['Bulbasaur', 'Ivysaur', 'Venusaur'], zh: ['妙蛙种子', '妙蛙草', '妙蛙花'],
        ty: [['GRASS', 'POISON'], ['GRASS', 'POISON'], ['GRASS', 'POISON']],
        ab: 'THICKFAT,OVERGROW', hid: 'CHLOROPHYLL',
        edge: ['IVYSAUR,Level,16', 'VENUSAUR,Level,32'],
        form: 'VENUSAUR_1',
    },
    // 草 - Homing 追踪箭. 长臂 is this database's Decidueye ability and it names the mechanic.
    badger: {
        key: ['ROWLET', 'DARTRIX', 'DECIDUEYE'], dex: [722, 723, 724],
        en: ['Rowlet', 'Dartrix', 'Decidueye'], zh: ['木木枭', '投羽枭', '狙射树枭'],
        ty: [['GRASS', 'FLYING'], ['GRASS', 'FLYING'], ['GRASS', 'GHOST']],
        ab: 'LONGREACH,OVERGROW', hid: 'KEENEYE',
        edge: ['DARTRIX,Level,17', 'DECIDUEYE,Level,34'],
        form: 'DECIDUEYE_1',
    },
    // 新叶喵 → 蒂蕾喵 → 魔幻假面喵：草系起步，最终进化增加恶属性。
    sprigatito: {
        key: ['SPRIGATITO', 'FLORAGATO', 'MEOWSCARADA'], dex: [906, 907, 908],
        en: ['Sprigatito', 'Floragato', 'Meowscarada'], zh: ['新叶喵', '蒂蕾喵', '魔幻假面喵'],
        ty: [['GRASS'], ['GRASS'], ['GRASS', 'DARK']],
        ab: 'OVERGROW', hid: 'PROTEAN',
        edge: ['FLORAGATO,Level,16', 'MEOWSCARADA,Level,36'],
        form: null,
    },
    // 呆火鳄一系：最终阶段获得幽灵属性，进化条件沿用帕底亚图鉴的等级线。
    fuecoco: {
        key: ['FUECOCO', 'CROCALOR', 'SKELEDIRGE'], dex: [909, 910, 911],
        en: ['Fuecoco', 'Crocalor', 'Skeledirge'], zh: ['呆火鳄', '炙烫鳄', '骨纹巨声鳄'],
        ty: [['FIRE'], ['FIRE'], ['FIRE', 'GHOST']],
        ab: 'BLAZE', hid: 'UNAWARE',
        edge: ['CROCALOR,Level,16', 'SKELEDIRGE,Level,36'],
        form: null,
    },
    // 润水鸭一系：最终阶段获得格斗属性，舞步突进作为专属战斗表现。
    quaxly: {
        key: ['QUAXLY', 'QUAXWELL', 'QUAQUAVAL'], dex: [912, 913, 914],
        en: ['Quaxly', 'Quaxwell', 'Quaquaval'], zh: ['润水鸭', '涌跃鸭', '狂欢浪舞鸭'],
        ty: [['WATER'], ['WATER'], ['WATER', 'FIGHTING']],
        ab: 'TORRENT', hid: 'MOXIE',
        edge: ['QUAXWELL,Level,16', 'QUAQUAVAL,Level,36'],
        form: null,
    },
    // 小锻匠一系：钢/妖属性与巨锤攻击对应，按帕底亚等级条件进化。
    tinkatink: {
        key: ['TINKATINK', 'TINKATUFF', 'TINKATON'], dex: [957, 958, 959],
        en: ['Tinkatink', 'Tinkatuff', 'Tinkaton'], zh: ['小锻匠', '巧锻匠', '巨锻匠'],
        ty: [['FAIRY', 'STEEL'], ['FAIRY', 'STEEL'], ['FAIRY', 'STEEL']],
        ab: 'MOLDBREAKER,OWNTEMPO', hid: 'PICKPOCKET',
        edge: ['TINKATUFF,Level,24', 'TINKATON,Level,38'],
        form: null,
    },
    // 盐石宝一系：盐岩属性线，进化后形成更厚重的结晶身躯。
    nacli: {
        key: ['NACLI', 'NACLSTACK', 'GARGANACL'], dex: [932, 933, 934],
        en: ['Nacli', 'Naclstack', 'Garganacl'], zh: ['盐石宝', '盐石垒', '盐石巨灵'],
        ty: [['ROCK'], ['ROCK'], ['ROCK']],
        ab: 'PURIFYINGSALT,STURDY', hid: 'CLEARBODY',
        edge: ['NACLSTACK,Level,24', 'GARGANACL,Level,38'],
        form: null,
    },
    // 冰宝一系：龙/冰属性，戟脊龙用逐阶扩大的寒冰龙息攻击。
    frigibax: {
        key: ['FRIGIBAX', 'ARCTIBAX', 'BAXCALIBUR'], dex: [996, 997, 998],
        en: ['Frigibax', 'Arctibax', 'Baxcalibur'], zh: ['冰宝', '冻脊龙', '戟脊龙'],
        ty: [['DRAGON', 'ICE'], ['DRAGON', 'ICE'], ['DRAGON', 'ICE']],
        ab: 'THERMALEXCHANGE', hid: 'ICEBODY',
        edge: ['ARCTIBAX,Level,35', 'BAXCALIBUR,Level,54'],
        form: null,
    },
    // 哈力栗一系：布里卡隆兼具草与格斗属性。
    chespin: {
        key: ['CHESPIN', 'QUILLADIN', 'CHESNAUGHT'], dex: [650, 651, 652],
        en: ['Chespin', 'Quilladin', 'Chesnaught'], zh: ['哈力栗', '胖胖哈力', '布里卡隆'],
        ty: [['GRASS'], ['GRASS'], ['GRASS', 'FIGHTING']],
        ab: 'OVERGROW', hid: 'BULLETPROOF',
        edge: ['QUILLADIN,Level,16', 'CHESNAUGHT,Level,36'],
        form: null,
    },
    // 火狐狸一系：最终形态加入超能力属性。
    fennekin: {
        key: ['FENNEKIN', 'BRAIXEN', 'DELPHOX'], dex: [653, 654, 655],
        en: ['Fennekin', 'Braixen', 'Delphox'], zh: ['火狐狸', '长尾火狐', '妖火红狐'],
        ty: [['FIRE'], ['FIRE'], ['FIRE', 'PSYCHIC']],
        ab: 'BLAZE', hid: 'MAGICIAN',
        edge: ['BRAIXEN,Level,16', 'DELPHOX,Level,36'],
        form: null,
    },
    // 呱呱泡蛙一系：甲贺忍蛙最终获得恶属性，契合高速追踪手里剑。
    froakie: {
        key: ['FROAKIE', 'FROGADIER', 'GRENINJA'], dex: [656, 657, 658],
        en: ['Froakie', 'Frogadier', 'Greninja'], zh: ['呱呱泡蛙', '呱头蛙', '甲贺忍蛙'],
        ty: [['WATER'], ['WATER'], ['WATER', 'DARK']],
        ab: 'TORRENT', hid: 'PROTEAN',
        edge: ['FROGADIER,Level,16', 'GRENINJA,Level,36'],
        form: null,
    },
    // 藤藤蛇一系：君主蛇保持纯草属性，藤鞭主技逐阶拓宽。
    snivy: {
        key: ['SNIVY', 'SERVINE', 'SERPERIOR'], dex: [495, 496, 497],
        en: ['Snivy', 'Servine', 'Serperior'], zh: ['藤藤蛇', '青藤蛇', '君主蛇'],
        ty: [['GRASS'], ['GRASS'], ['GRASS']],
        ab: 'OVERGROW', hid: 'CONTRARY',
        edge: ['SERVINE,Level,17', 'SERPERIOR,Level,36'],
        form: null,
    },
    // 暖暖猪一系：炎武王在最终阶段增加格斗属性。
    tepig: {
        key: ['TEPIG', 'PIGNITE', 'EMBOAR'], dex: [498, 499, 500],
        en: ['Tepig', 'Pignite', 'Emboar'], zh: ['暖暖猪', '炒炒猪', '炎武王'],
        ty: [['FIRE'], ['FIRE', 'FIGHTING'], ['FIRE', 'FIGHTING']],
        ab: 'BLAZE', hid: 'THICKFAT',
        edge: ['PIGNITE,Level,17', 'EMBOAR,Level,36'],
        form: null,
    },
    // 水水獭一系：大剑鬼使用水流与贝壳刀刃进行连续弹射斩击。
    oshawott: {
        key: ['OSHAWOTT', 'DEWOTT', 'SAMUROTT'], dex: [501, 502, 503],
        en: ['Oshawott', 'Dewott', 'Samurott'], zh: ['水水獭', '双刃丸', '大剑鬼'],
        ty: [['WATER'], ['WATER'], ['WATER']],
        ab: 'TORRENT', hid: 'SHELLARMOR',
        edge: ['DEWOTT,Level,17', 'SAMUROTT,Level,36'],
        form: null,
    },
    // 一家鼠 → 家主鼠：家主鼠的三口之家/四口之家是同一进化阶段的外观变体。
    tandemaus: {
        key: ['TANDEMAUS', 'MAUSHOLD'], dex: [924, 925],
        en: ['Tandemaus', 'Maushold'], zh: ['一家鼠', '家主鼠'],
        ty: [['NORMAL'], ['NORMAL']],
        ab: 'RUNAWAY,PICKUP', hid: 'OWNTEMPO',
        edge: ['MAUSHOLD,Level,25'], form: 'MAUSHOLD_1',
    },
    // 火 - Bullet. 茂盛/太阳之力 is already a "spend HP for damage" card, which is §5.5-C's shape.
    lizard: {
        key: ['CHARMANDER', 'CHARMELEON', 'CHARIZARD'], dex: [4, 5, 6],
        en: ['Charmander', 'Charmeleon', 'Charizard'], zh: ['小火龙', '火恐龙', '喷火龙'],
        ty: [['FIRE'], ['FIRE'], ['FIRE', 'DRAGON']],
        ab: 'LEVITATE,BLAZE', hid: 'SOLARPOWER',
        edge: ['CHARMELEON,Level,16', 'CHARIZARD,Level,36'],
        form: 'CHARIZARD_1',
    },
    // 火 - Area 烛焰环. A floating lantern is the only silhouette that reads as a standing flame.
    // No form art was imported for the line, so 水晶灯火灵's 4 阶 keeps the 3 阶 sprite + the 金环.
    moth: {
        key: ['LITWICK', 'LAMPENT', 'CHANDELURE'], dex: [607, 608, 609],
        en: ['Litwick', 'Lampent', 'Chandelure'], zh: ['烛光灵', '灯火幽灵', '水晶灯火灵'],
        ty: [['GHOST', 'FIRE'], ['GHOST', 'FIRE'], ['GHOST', 'FIRE']],
        ab: 'FLASHFIRE,FLAMEBODY', hid: 'INFILTRATOR',
        edge: ['LAMPENT,Level,27', 'CHANDELURE,Item,DUSKSTONE'],
        form: null,
    },
    // 水 - Area. 加速 is the bulk-and-splash read of 潮汐泡鲸; 泥鱼兽 picks up 地 on the way up.
    drop: {
        key: ['MUDKIP', 'MARSHTOMP', 'SWAMPERT'], dex: [258, 259, 260],
        en: ['Mudkip', 'Marshtomp', 'Swampert'], zh: ['水跃鱼', '沼跃鱼', '巨沼怪'],
        ty: [['WATER'], ['WATER', 'GROUND'], ['WATER', 'GROUND']],
        ab: 'SWIFTSWIM,TORRENT', hid: 'SANDFORCE',
        edge: ['MARSHTOMP,Level,16', 'SWAMPERT,Level,36'],
        form: 'SWAMPERT_1',
    },
    // 水 - Beam. Blastoise's twin cannons are the beam, and 降雨 is weather pressure on a lane.
    turtle: {
        key: ['SQUIRTLE', 'WARTORTLE', 'BLASTOISE'], dex: [7, 8, 9],
        en: ['Squirtle', 'Wartortle', 'Blastoise'], zh: ['杰尼龟', '卡咪龟', '水箭龟'],
        ty: [['WATER'], ['WATER'], ['WATER']],
        ab: 'DRIZZLE,TORRENT', hid: 'RAINDISH',
        edge: ['WARTORTLE,Level,16', 'BLASTOISE,Level,36'],
        form: 'BLASTOISE_1',
    },
    // 电 - Bullet. The only line here whose first step is not a level: 皮丘 evolves on 亲密度.
    bean: {
        key: ['PICHU', 'PIKACHU', 'RAICHU'], dex: [172, 25, 26],
        en: ['Pichu', 'Pikachu', 'Raichu'], zh: ['皮丘', '皮卡丘', '雷丘'],
        ty: [['ELECTRIC'], ['ELECTRIC'], ['ELECTRIC']],
        ab: 'STATIC,TRANSISTOR', hid: 'LIGHTNINGROD',
        edge: ['PIKACHU,Happiness,', 'RAICHU,Item,THUNDERSTONE'],
        form: 'RAICHU_1',
    },
    // 电 - Homing 磁力. 磁力 pulling is literally what 磁甲虫 buys; no form art for 自爆磁怪.
    beetle: {
        key: ['MAGNEMITE', 'MAGNETON', 'MAGNEZONE'], dex: [81, 82, 462],
        en: ['Magnemite', 'Magneton', 'Magnezone'], zh: ['小磁怪', '三合一磁怪', '自爆磁怪'],
        ty: [['ELECTRIC', 'STEEL'], ['ELECTRIC', 'STEEL'], ['ELECTRIC', 'STEEL']],
        ab: 'ANALYTIC,STURDY', hid: 'MAGNETPULL',
        edge: ['MAGNETON,Level,30', 'MAGNEZONE,Item,THUNDERSTONE'],
        form: null,
    },
    // 晶 - Bullet. A living boulder with a core; 坚硬 matches §5.7's unkillable-front-node read.
    // Its last step is 联结之绳 - the trade item this database renamed, which is why it costs the most.
    shell: {
        key: ['GEODUDE', 'GRAVELER', 'GOLEM'], dex: [74, 75, 76],
        en: ['Geodude', 'Graveler', 'Golem'], zh: ['小拳石', '隆隆石', '隆隆岩'],
        ty: [['ROCK', 'GROUND'], ['ROCK', 'GROUND'], ['ROCK', 'GROUND']],
        ab: 'ROCKHEAD,STURDY', hid: 'SANDVEIL',
        edge: ['GRAVELER,Level,25', 'GOLEM,Item,LINKINGCORD'],
        form: 'GOLEM_1',
    },
    // 晶 - Area. Flygon is the only real dragonfly in the set, and 飘浮 is why it stays in the ring.
    // 50 级 is the slowest step in the roster, so it is also the dearest fold (§7.1-4).
    mayfly: {
        key: ['TRAPINCH', 'VIBRAVA', 'FLYGON'], dex: [328, 329, 330],
        en: ['Trapinch', 'Vibrava', 'Flygon'], zh: ['大颚蚁', '超音波幼虫', '沙漠蜻蜓'],
        ty: [['BUG', 'GROUND'], ['BUG', 'DRAGON'], ['BUG', 'DRAGON']],
        ab: 'LEVITATE,COMPOUNDEYES', hid: 'SANDFORCE',
        edge: ['VIBRAVA,Level,25', 'FLYGON,Level,50'],
        form: null,
    },
    // 支援 - Support 吞金. 吸水 is the "it drinks what lands on it" read of a 吸金 toad.
    // 蚊香君 has a real branch (水之石→蚊香泳士 / 王者之证→蚊香蛙皇); only the first is in the atlas,
    // so only the first is offered - see `altBranches`.
    toad: {
        key: ['POLIWAG', 'POLIWHIRL', 'POLIWRATH'], dex: [60, 61, 62],
        en: ['Poliwag', 'Poliwhirl', 'Poliwrath'], zh: ['蚊香蝌蚪', '蚊香君', '蚊香泳士'],
        ty: [['WATER'], ['WATER'], ['WATER', 'FIGHTING']],
        ab: 'WATERABSORB,SWIFTSWIM', hid: 'DAMP',
        edge: ['POLIWHIRL,Level,25', 'POLIWRATH,Item,WATERSTONE,POLITOED,Item,KINGSROCK'],
        form: null,
    },
    // 支援 - Support 治疗. 技师 is the "small inputs, big payoff" healing scaling.
    // THIS LINE HAS TWO STAGES, and v0.9 stopped pretending otherwise: 喵喵→猫老大 is the whole dex
    // line, so normal evolution ends at 2 阶; the separate forge recipe only starts from actual 3 阶 links.
    // Its `edge` also carries a second branch, 喵头目, gated on `None` - i.e. on a *form* of 喵喵
    // this game does not have, so it stays in `altBranches` rather than becoming a fake third stage.
    cat: {
        key: ['MEOWTH', 'PERSIAN'], dex: [52, 53],
        en: ['Meowth', 'Persian'], zh: ['喵喵', '猫老大'],
        ty: [['NORMAL'], ['NORMAL']],
        ab: 'LIMBER,TECHNICIAN', hid: 'UNNERVE',
        edge: ['PERSIAN,Level,28,PERRSERKER,None,'],
        form: 'PERSIAN_1',
    },
    specter: {
        key: ['GASTLY', 'HAUNTER', 'GENGAR'], dex: [92, 93, 94],
        en: ['Gastly', 'Haunter', 'Gengar'], zh: ['鬼斯', '鬼斯通', '耿鬼'],
        ty: [['GHOST', 'POISON'], ['GHOST', 'POISON'], ['GHOST', 'POISON']],
        ab: 'CURSED BODY', hid: 'LEVITATE',
        edge: ['HAUNTER,Level,25', 'GENGAR,Trade,'], form: 'GENGAR_1',
    },
    mystic: {
        key: ['RALTS', 'KIRLIA', 'GARDEVOIR'], dex: [280, 281, 282],
        en: ['Ralts', 'Kirlia', 'Gardevoir'], zh: ['拉鲁拉丝', '奇鲁莉安', '沙奈朵'],
        ty: [['PSYCHIC'], ['PSYCHIC'], ['PSYCHIC', 'FAIRY']],
        ab: 'SYNCHRONIZE,TRACE', hid: 'TELEPATHY',
        edge: ['KIRLIA,Level,20', 'GARDEVOIR,Level,30'], form: 'GARDEVOIR_1',
    },
    machop: {
        key: ['MACHOP', 'MACHOKE', 'MACHAMP'], dex: [66, 67, 68],
        en: ['Machop', 'Machoke', 'Machamp'], zh: ['腕力', '豪力', '怪力'],
        ty: [['FIGHTING'], ['FIGHTING'], ['FIGHTING']],
        ab: 'GUTS,NOGUARD', hid: 'STEADFAST',
        edge: ['MACHOKE,Level,28', 'MACHAMP,Trade,'], form: null,
    },
    togepi: {
        key: ['TOGEPI', 'TOGETIC', 'TOGEKISS'], dex: [175, 176, 468],
        en: ['Togepi', 'Togetic', 'Togekiss'], zh: ['波克比', '波克基古', '波克基斯'],
        ty: [['FAIRY'], ['FAIRY', 'FLYING'], ['FAIRY', 'FLYING']],
        ab: 'HUSTLE,SERENEGRACE', hid: 'SUPERLUCK',
        edge: ['TOGETIC,Happiness,', 'TOGEKISS,Item,SHINYSTONE'], form: null,
    },
    buizel: {
        key: ['BUIZEL', 'FLOATZEL'], dex: [418, 419],
        en: ['Buizel', 'Floatzel'], zh: ['泳圈鼬', '浮潜鼬'],
        ty: [['WATER'], ['WATER']],
        ab: 'SWIFTSWIM', hid: 'WATERVEIL',
        edge: ['FLOATZEL,Level,26'], form: null,
    },
    munchlax: {
        key: ['MUNCHLAX', 'SNORLAX'], dex: [446, 143],
        en: ['Munchlax', 'Snorlax'], zh: ['小卡比兽', '卡比兽'],
        ty: [['NORMAL'], ['NORMAL']],
        ab: 'IMMUNITY,THICKFAT', hid: 'GLUTTONY',
        edge: ['SNORLAX,Happiness,'], form: null,
    },
    shinx: {
        key: ['SHINX', 'LUXIO', 'LUXRAY'], dex: [403, 404, 405],
        en: ['Shinx', 'Luxio', 'Luxray'], zh: ['小猫怪', '勒克猫', '伦琴猫'],
        ty: [['ELECTRIC'], ['ELECTRIC'], ['ELECTRIC']],
        ab: 'RIVALRY,INTIMIDATE', hid: 'GUTS',
        edge: ['LUXIO,Level,15', 'LUXRAY,Level,30'], form: null,
    },
    zorua: {
        key: ['ZORUA', 'ZOROARK'], dex: [570, 571],
        en: ['Zorua', 'Zoroark'], zh: ['索罗亚', '索罗亚克'],
        ty: [['DARK'], ['DARK']], ab: 'ILLUSION', hid: '',
        edge: ['ZOROARK,Level,30'], form: null,
    },
    toxtricity: {
        key: ['TOXEL', 'TOXTRICITY'], dex: [848, 849],
        en: ['Toxel', 'Toxtricity'], zh: ['毒电婴', '颤弦蝾螈'],
        ty: [['ELECTRIC', 'POISON'], ['ELECTRIC', 'POISON']],
        ab: 'PUNKROCK,PLUS,MINUS', hid: 'TECHNICIAN',
        edge: ['TOXTRICITY,Level,30'], form: null,
    },
    shroomish: {
        key: ['SHROOMISH', 'BRELOOM'], dex: [285, 286],
        en: ['Shroomish', 'Breloom'], zh: ['蘑蘑菇', '斗笠菇'],
        ty: [['GRASS'], ['GRASS', 'FIGHTING']],
        ab: 'EFFECTSPORE,POISONHEAL', hid: 'QUICKFEET',
        edge: ['BRELOOM,Level,23'], form: null,
    },
    hatenna: {
        key: ['HATENNA', 'HATTREM', 'HATTERENE'], dex: [856, 857, 858],
        en: ['Hatenna', 'Hattrem', 'Hatterene'], zh: ['迷布莉姆', '提布莉姆', '布莉姆温'],
        ty: [['PSYCHIC'], ['PSYCHIC'], ['PSYCHIC', 'FAIRY']],
        ab: 'HEALER,ANTICIPATION', hid: 'MAGICBOUNCE',
        edge: ['HATTREM,Level,32', 'HATTERENE,Level,42'], form: null,
    },
    impidimp: {
        key: ['IMPIDIMP', 'MORGREM', 'GRIMMSNARL'], dex: [859, 860, 861],
        en: ['Impidimp', 'Morgrem', 'Grimmsnarl'], zh: ['捣蛋小妖', '诈唬魔', '长毛巨魔'],
        ty: [['DARK', 'FAIRY'], ['DARK', 'FAIRY'], ['DARK', 'FAIRY']],
        ab: 'PRANKSTER,FRISK', hid: 'PICKPOCKET',
        edge: ['MORGREM,Level,32', 'GRIMMSNARL,Level,42'], form: null,
    },
    archen: {
        key: ['ARCHEN', 'ARCHEOPS'], dex: [566, 567],
        en: ['Archen', 'Archeops'], zh: ['始祖小鸟', '始祖大鸟'],
        ty: [['ROCK', 'FLYING'], ['ROCK', 'FLYING']],
        ab: 'DEFEATIST', hid: '',
        edge: ['ARCHEOPS,Level,37'], form: null,
    },
    smoliv: {
        key: ['SMOLIV', 'DOLLIV', 'ARBOLIVA'], dex: [928, 929, 930],
        en: ['Smoliv', 'Dolliv', 'Arboliva'], zh: ['迷你芙', '奥利纽', '奥利瓦'],
        ty: [['GRASS', 'NORMAL'], ['GRASS', 'NORMAL'], ['GRASS', 'NORMAL']],
        ab: 'SEEDSOWER', hid: 'HARVEST',
        edge: ['DOLLIV,Level,25', 'ARBOLIVA,Level,35'], form: null,
    },
    tadbulb: {
        key: ['TADBULB', 'BELLIBOLT'], dex: [938, 939],
        en: ['Tadbulb', 'Bellibolt'], zh: ['光蚪仔', '电肚蛙'],
        ty: [['ELECTRIC'], ['ELECTRIC']],
        ab: 'ELECTROMORPHOSIS,STATIC', hid: 'DAMP',
        edge: ['BELLIBOLT,Item,THUNDERSTONE'], form: null,
    },
    wattrel: {
        key: ['WATTREL', 'KILOWATTREL'], dex: [940, 941],
        en: ['Wattrel', 'Kilowattrel'], zh: ['电海燕', '大电海燕'],
        ty: [['ELECTRIC', 'FLYING'], ['ELECTRIC', 'FLYING']],
        ab: 'WINDPOWER,VOLTABSORB', hid: 'COMPETITIVE',
        edge: ['KILOWATTREL,Level,25'], form: null,
    },
    porygon: {
        key: ['PORYGON', 'PORYGON2', 'PORYGONZ'], dex: [137, 233, 474],
        en: ['Porygon', 'Porygon2', 'Porygon-Z'], zh: ['多边兽', '多边兽Ⅱ', '多边兽Ｚ'],
        ty: [['NORMAL'], ['NORMAL'], ['NORMAL']],
        ab: 'ADAPTABILITY,DOWNLOAD', hid: 'ANALYTIC',
        edge: ['PORYGON2,Item,UPGRADE', 'PORYGONZ,Item,DUBIOUSDISC'], form: null,
    },
    alcremie: {
        key: ['MILCERY', 'ALCREMIE'], dex: [868, 869],
        en: ['Milcery', 'Alcremie'], zh: ['小仙奶', '霜奶仙'],
        ty: [['FAIRY'], ['FAIRY']], ab: 'SWEETVEIL', hid: 'AROMAVEIL',
        edge: ['ALCREMIE,Item,STRAWBERRYSWEET'], form: null,
    },
    vivillon: {
        key: ['SCATTERBUG', 'SPEWPA', 'VIVILLON'], dex: [664, 665, 666],
        en: ['Scatterbug', 'Spewpa', 'Vivillon'], zh: ['粉蝶虫', '粉蝶蛹', '彩粉蝶'],
        ty: [['BUG'], ['BUG'], ['BUG', 'FLYING']],
        ab: 'SHIELDDUST,COMPOUNDEYES', hid: 'FRIENDGUARD',
        edge: ['SPEWPA,Level,9', 'VIVILLON,Level,12'], form: null,
    },
    cutiefly: {
        key: ['CUTIEFLY', 'RIBOMBEE'], dex: [742, 743],
        en: ['Cutiefly', 'Ribombee'], zh: ['萌虻', '蝶结萌虻'],
        ty: [['BUG', 'FAIRY'], ['BUG', 'FAIRY']],
        ab: 'SWEETVEIL,SHIELDDUST', hid: 'HONEYGATHER',
        edge: ['RIBOMBEE,Level,25'], form: null,
    },
    wasp: {
        key: ['WEEDLE', 'KAKUNA', 'BEEDRILL'], dex: [13, 14, 15],
        en: ['Weedle', 'Kakuna', 'Beedrill'], zh: ['独角虫', '铁壳蛹', '大针蜂'],
        ty: [['BUG', 'POISON'], ['BUG', 'POISON'], ['BUG', 'POISON']],
        ab: 'SWARM', hid: 'SNIPER',
        edge: ['KAKUNA,Level,7', 'BEEDRILL,Level,10'], form: 'BEEDRILL_1',
    },
    lamp: {
        key: ['MAREEP', 'FLAAFFY', 'AMPHAROS'], dex: [179, 180, 181],
        en: ['Mareep', 'Flaaffy', 'Ampharos'], zh: ['咩利羊', '茸茸羊', '电龙'],
        ty: [['ELECTRIC'], ['ELECTRIC'], ['ELECTRIC']],
        ab: 'STATIC', hid: 'PLUS',
        edge: ['FLAAFFY,Level,15', 'AMPHAROS,Level,30'], form: 'AMPHAROS_1',
    },
    bird: {
        key: ['PIDGEY', 'PIDGEOTTO', 'PIDGEOT'], dex: [16, 17, 18],
        en: ['Pidgey', 'Pidgeotto', 'Pidgeot'], zh: ['波波', '比比鸟', '大比鸟'],
        ty: [['NORMAL', 'FLYING'], ['NORMAL', 'FLYING'], ['NORMAL', 'FLYING']],
        ab: 'KEENEYE,TANGLEDFEET', hid: 'BIGPECKS',
        edge: ['PIDGEOTTO,Level,18', 'PIDGEOT,Level,36'], form: 'PIDGEOT_1',
    },
    striker: {
        key: ['TORCHIC', 'COMBUSKEN', 'BLAZIKEN'], dex: [255, 256, 257],
        en: ['Torchic', 'Combusken', 'Blaziken'], zh: ['火稚鸡', '力壮鸡', '火焰鸡'],
        ty: [['FIRE'], ['FIRE', 'FIGHTING'], ['FIRE', 'FIGHTING']],
        ab: 'BLAZE', hid: 'SPEEDBOOST',
        edge: ['COMBUSKEN,Level,16', 'BLAZIKEN,Level,36'], form: 'BLAZIKEN_1',
    },
    sage: {
        key: ['ABRA', 'KADABRA', 'ALAKAZAM'], dex: [63, 64, 65],
        en: ['Abra', 'Kadabra', 'Alakazam'], zh: ['凯西', '勇基拉', '胡地'],
        ty: [['PSYCHIC'], ['PSYCHIC'], ['PSYCHIC']],
        ab: 'SYNCHRONIZE,INNERFOCUS', hid: 'MAGICGUARD',
        edge: ['KADABRA,Level,16', 'ALAKAZAM,Trade,'], form: 'ALAKAZAM_1',
    },
    iron: {
        key: ['ARON', 'LAIRON', 'AGGRON'], dex: [304, 305, 306],
        en: ['Aron', 'Lairon', 'Aggron'], zh: ['可可多拉', '可多拉', '波士可多拉'],
        ty: [['STEEL', 'ROCK'], ['STEEL', 'ROCK'], ['STEEL', 'ROCK']],
        ab: 'STURDY,ROCKHEAD', hid: 'HEAVYMETAL',
        edge: ['LAIRON,Level,32', 'AGGRON,Level,42'], form: 'AGGRON_1',
    },
    grove: {
        key: ['TREECKO', 'GROVYLE', 'SCEPTILE'], dex: [252, 253, 254],
        en: ['Treecko', 'Grovyle', 'Sceptile'], zh: ['木守宫', '森林蜥蜴', '蜥蜴王'],
        ty: [['GRASS'], ['GRASS'], ['GRASS']],
        ab: 'OVERGROW', hid: 'UNBURDEN',
        edge: ['GROVYLE,Level,16', 'SCEPTILE,Level,36'], form: 'SCEPTILE_1',
    },
    drake: {
        key: ['BAGON', 'SHELGON', 'SALAMENCE'], dex: [371, 372, 373],
        en: ['Bagon', 'Shelgon', 'Salamence'], zh: ['宝贝龙', '甲壳龙', '暴飞龙'],
        ty: [['DRAGON'], ['DRAGON'], ['DRAGON', 'FLYING']],
        ab: 'INTIMIDATE', hid: 'MOXIE',
        edge: ['SHELGON,Level,30', 'SALAMENCE,Level,50'], form: 'SALAMENCE_1',
    },
    shark: {
        key: ['GIBLE', 'GABITE', 'GARCHOMP'], dex: [443, 444, 445],
        en: ['Gible', 'Gabite', 'Garchomp'], zh: ['圆陆鲨', '尖牙陆鲨', '烈咬陆鲨'],
        ty: [['DRAGON', 'GROUND'], ['DRAGON', 'GROUND'], ['DRAGON', 'GROUND']],
        ab: 'SANDVEIL', hid: 'ROUGHSKIN',
        edge: ['GABITE,Level,24', 'GARCHOMP,Level,48'], form: 'GARCHOMP_1',
    },
    metal: {
        key: ['BELDUM', 'METANG', 'METAGROSS'], dex: [374, 375, 376],
        en: ['Beldum', 'Metang', 'Metagross'], zh: ['铁哑铃', '金属怪', '巨金怪'],
        ty: [['STEEL', 'PSYCHIC'], ['STEEL', 'PSYCHIC'], ['STEEL', 'PSYCHIC']],
        ab: 'CLEARBODY', hid: 'LIGHTMETAL',
        edge: ['METANG,Level,20', 'METAGROSS,Level,45'], form: 'METAGROSS_1',
    },
    tyran: {
        key: ['LARVITAR', 'PUPITAR', 'TYRANITAR'], dex: [246, 247, 248],
        en: ['Larvitar', 'Pupitar', 'Tyranitar'], zh: ['幼基拉斯', '沙基拉斯', '班基拉斯'],
        ty: [['ROCK', 'GROUND'], ['ROCK', 'GROUND'], ['ROCK', 'DARK']],
        ab: 'SANDSTREAM', hid: 'UNNERVE',
        edge: ['PUPITAR,Level,30', 'TYRANITAR,Level,55'], form: 'TYRANITAR_1',
    },
    starling: {
        key: ['STARLY', 'STARAVIA', 'STARAPTOR'], dex: [396, 397, 398],
        en: ['Starly', 'Staravia', 'Staraptor'], zh: ['姆克儿', '姆克鸟', '姆克鹰'],
        ty: [['NORMAL', 'FLYING'], ['NORMAL', 'FLYING'], ['NORMAL', 'FLYING']],
        ab: 'INTIMIDATE', hid: 'RECKLESS',
        edge: ['STARAVIA,Level,14', 'STARAPTOR,Level,34'], form: null,
    },
    penguin: {
        key: ['PIPLUP', 'PRINPLUP', 'EMPOLEON'], dex: [393, 394, 395],
        en: ['Piplup', 'Prinplup', 'Empoleon'], zh: ['波加曼', '波皇子', '帝王拿波'],
        ty: [['WATER'], ['WATER'], ['WATER', 'STEEL']],
        ab: 'TORRENT', hid: 'DEFIANT',
        edge: ['PRINPLUP,Level,16', 'EMPOLEON,Level,36'], form: null,
    },
    simian: {
        key: ['CHIMCHAR', 'MONFERNO', 'INFERNAPE'], dex: [390, 391, 392],
        en: ['Chimchar', 'Monferno', 'Infernape'], zh: ['小火焰猴', '猛火猴', '烈焰猴'],
        ty: [['FIRE'], ['FIRE', 'FIGHTING'], ['FIRE', 'FIGHTING']],
        ab: 'BLAZE', hid: 'IRONFIST',
        edge: ['MONFERNO,Level,14', 'INFERNAPE,Level,36'], form: null,
    },
    lynx: {
        key: ['SHINX', 'LUXIO', 'LUXRAY'], dex: [403, 404, 405],
        en: ['Shinx', 'Luxio', 'Luxray'], zh: ['小猫怪', '勒克猫', '伦琴猫'],
        ty: [['ELECTRIC'], ['ELECTRIC'], ['ELECTRIC']],
        ab: 'RIVALRY,INTIMIDATE', hid: 'GUTS',
        edge: ['LUXIO,Level,15', 'LUXRAY,Level,30'], form: null,
    },
    bat: {
        key: ['ZUBAT', 'GOLBAT', 'CROBAT'], dex: [41, 42, 169],
        en: ['Zubat', 'Golbat', 'Crobat'], zh: ['超音蝠', '大嘴蝠', '叉字蝠'],
        ty: [['POISON', 'FLYING'], ['POISON', 'FLYING'], ['POISON', 'FLYING']],
        ab: 'INNERFOCUS,INFILTRATOR', hid: 'INFILTRATOR',
        edge: ['GOLBAT,Level,22', 'CROBAT,Happiness,'], form: null,
    },
    rose: {
        key: ['BUDEW', 'ROSELIA', 'ROSERADE'], dex: [406, 315, 407],
        en: ['Budew', 'Roselia', 'Roserade'], zh: ['含羞苞', '毒蔷薇', '罗丝雷朵'],
        ty: [['GRASS', 'POISON'], ['GRASS', 'POISON'], ['GRASS', 'POISON']],
        ab: 'NATURALCURE,POISONPOINT', hid: 'TECHNICIAN',
        edge: ['ROSELIA,Happiness,', 'ROSERADE,Item,SHINYSTONE'], form: null,
    },
    rider: {
        key: ['RHYHORN', 'RHYDON', 'RHYPERIOR'], dex: [111, 112, 464],
        en: ['Rhyhorn', 'Rhydon', 'Rhyperior'], zh: ['独角犀牛', '钻角犀兽', '超甲狂犀'],
        ty: [['GROUND', 'ROCK'], ['GROUND', 'ROCK'], ['GROUND', 'ROCK']],
        ab: 'LIGHTNINGROD,ROCKHEAD', hid: 'SOLIDROCK',
        edge: ['RHYDON,Level,36', 'RHYPERIOR,Item,PROTECTOR'], form: null,
    },
    spark: {
        key: ['ELEKID', 'ELECTABUZZ', 'ELECTIVIRE'], dex: [239, 125, 466],
        en: ['Elekid', 'Electabuzz', 'Electivire'], zh: ['电击怪', '电击兽', '电击魔兽'],
        ty: [['ELECTRIC'], ['ELECTRIC'], ['ELECTRIC']],
        ab: 'MOTORDRIVE', hid: 'VITALSPIRIT',
        edge: ['ELECTABUZZ,Level,30', 'ELECTIVIRE,Item,ELECTIRIZER'], form: null,
    },
    magma: {
        key: ['MAGBY', 'MAGMAR', 'MAGMORTAR'], dex: [240, 126, 467],
        en: ['Magby', 'Magmar', 'Magmortar'], zh: ['鸭嘴宝宝', '鸭嘴火兽', '鸭嘴炎兽'],
        ty: [['FIRE'], ['FIRE'], ['FIRE']],
        ab: 'FLAMEBODY', hid: 'VITALSPIRIT',
        edge: ['MAGMAR,Level,30', 'MAGMORTAR,Item,MAGMARIZER'], form: null,
    },
    mammoth: {
        key: ['SWINUB', 'PILOSWINE', 'MAMOSWINE'], dex: [220, 221, 473],
        en: ['Swinub', 'Piloswine', 'Mamoswine'], zh: ['小山猪', '长毛猪', '象牙猪'],
        ty: [['ICE', 'GROUND'], ['ICE', 'GROUND'], ['ICE', 'GROUND']],
        ab: 'OBLIVIOUS,SNOWCLOAK', hid: 'THICKFAT',
        edge: ['PILOSWINE,Level,33', 'MAMOSWINE,HasMove,ANCIENTPOWER'], form: null,
    },
    hydra: {
        key: ['DEINO', 'ZWEILOUS', 'HYDREIGON'], dex: [633, 634, 635],
        en: ['Deino', 'Zweilous', 'Hydreigon'], zh: ['单首龙', '双首暴龙', '三首恶龙'],
        ty: [['DARK', 'DRAGON'], ['DARK', 'DRAGON'], ['DARK', 'DRAGON']],
        ab: 'LEVITATE', hid: 'LEVITATE',
        edge: ['ZWEILOUS,Level,38', 'HYDREIGON,Level,55'], form: null,
    },
    axe: {
        key: ['AXEW', 'FRAXURE', 'HAXORUS'], dex: [610, 611, 612],
        en: ['Axew', 'Fraxure', 'Haxorus'], zh: ['牙牙', '斧牙龙', '双斧战龙'],
        ty: [['DRAGON'], ['DRAGON'], ['DRAGON']],
        ab: 'RIVALRY,MOLDBREAKER', hid: 'UNNERVE',
        edge: ['FRAXURE,Level,38', 'HAXORUS,Level,48'], form: null,
    },
    goo: {
        key: ['GOOMY', 'SLIGGOO', 'GOODRA'], dex: [704, 705, 706],
        en: ['Goomy', 'Sliggoo', 'Goodra'], zh: ['黏黏宝', '黏美儿', '黏美龙'],
        ty: [['DRAGON'], ['DRAGON'], ['DRAGON']],
        ab: 'SAPSIPPER,HYDRATION', hid: 'GOOEY',
        edge: ['SLIGGOO,Level,40', 'GOODRA,Level,50'], form: null,
    },
    rook: {
        key: ['ROOKIDEE', 'CORVISQUIRE', 'CORVIKNIGHT'], dex: [821, 822, 823],
        en: ['Rookidee', 'Corvisquire', 'Corviknight'], zh: ['稚山雀', '蓝鸦', '钢铠鸦'],
        ty: [['FLYING'], ['FLYING'], ['FLYING', 'STEEL']],
        ab: 'PRESSURE,UNNERVE', hid: 'MIRRORARMOR',
        edge: ['CORVISQUIRE,Level,18', 'CORVIKNIGHT,Level,38'], form: null,
    },
    dreepy: {
        key: ['DREEPY', 'DRAKLOAK', 'DRAGAPULT'], dex: [885, 886, 887],
        en: ['Dreepy', 'Drakloak', 'Dragapult'], zh: ['多龙梅西亚', '多龙奇', '多龙巴鲁托'],
        ty: [['DRAGON', 'GHOST'], ['DRAGON', 'GHOST'], ['DRAGON', 'GHOST']],
        ab: 'CLEARBODY,INFILTRATOR', hid: 'CURSEDBODY',
        edge: ['DRAKLOAK,Level,35', 'DRAGAPULT,Level,55'], form: null,
    },
    croc: {
        key: ['SANDILE', 'KROKOROK', 'KROOKODILE'], dex: [551, 552, 553],
        en: ['Sandile', 'Krokorok', 'Krookodile'], zh: ['黑眼鳄', '混混鳄', '流氓鳄'],
        ty: [['GROUND', 'DARK'], ['GROUND', 'DARK'], ['GROUND', 'DARK']],
        ab: 'INTIMIDATE,MOXIE', hid: 'ANGERPOINT',
        edge: ['KROKOROK,Level,27', 'KROOKODILE,Level,40'], form: null,
    },
    lucario: {
        key: ['RIOLU', 'LUCARIO'], dex: [447, 448],
        en: ['Riolu', 'Lucario'], zh: ['利欧路', '路卡利欧'],
        ty: [['FIGHTING'], ['FIGHTING', 'STEEL']],
        ab: 'JUSTIFIED,STEADFAST', hid: 'INNERFOCUS',
        edge: ['LUCARIO,HasMove,AURASPHERE'], form: null,
    },
    dratini: {
        key: ['DRATINI', 'DRAGONAIR', 'DRAGONITE'], dex: [147, 148, 149],
        en: ['Dratini', 'Dragonair', 'Dragonite'], zh: ['迷你龙', '哈克龙', '快龙'],
        ty: [['DRAGON'], ['DRAGON'], ['DRAGON', 'FLYING']],
        ab: 'INNERFOCUS,MULTISCALE', hid: 'PRESSURE',
        edge: ['DRAGONAIR,Level,30', 'DRAGONITE,Level,50'], form: null,
    },
    honedge: {
        key: ['HONEDGE', 'DOUBLADE', 'AEGISLASH'], dex: [679, 680, 681],
        en: ['Honedge', 'Doublade', 'Aegislash'], zh: ['独剑鞘', '双剑鞘', '坚盾剑怪'],
        ty: [['STEEL', 'GHOST'], ['STEEL', 'GHOST'], ['STEEL', 'GHOST']],
        ab: 'STANCECHANGE', hid: '',
        edge: ['DOUBLADE,Level,35', 'AEGISLASH,Item,DUSKSTONE'], form: null,
    },
    larvesta: {
        key: ['LARVESTA', 'VOLCARONA'], dex: [636, 637],
        en: ['Larvesta', 'Volcarona'], zh: ['燃烧虫', '火神蛾'],
        ty: [['BUG', 'FIRE'], ['BUG', 'FIRE']],
        ab: 'FLAMEBODY,SWARM', hid: 'DROUGHT',
        edge: ['VOLCARONA,Level,32'], form: null,
    },
    pawniard: {
        key: ['PAWNIARD', 'BISHARP', 'KINGAMBIT'], dex: [624, 625, 983],
        en: ['Pawniard', 'Bisharp', 'Kingambit'], zh: ['驹刀小兵', '劈斩司令', '仆刀将军'],
        ty: [['DARK', 'STEEL'], ['DARK', 'STEEL'], ['DARK', 'STEEL']],
        ab: 'DEFIANT,SUPREMEOVERLORD', hid: 'PRESSURE',
        edge: ['BISHARP,Level,28', 'KINGAMBIT,Level,45'], form: null,
    },
    'legend-mewtwo': { key: ['MEWTWO'], dex: [150], en: ['Mewtwo'], zh: ['超梦'], ty: [['PSYCHIC']], ab: 'PRESSURE', hid: 'UNNERVE', edge: [], form: null },
    'legend-lugia': { key: ['LUGIA'], dex: [249], en: ['Lugia'], zh: ['洛奇亚'], ty: [['PSYCHIC', 'FLYING']], ab: 'PRESSURE', hid: 'MULTISCALE', edge: [], form: null },
    'legend-hooh': { key: ['HOOH'], dex: [250], en: ['Ho-Oh'], zh: ['凤王'], ty: [['FIRE', 'FLYING']], ab: 'PRESSURE', hid: 'REGENERATOR', edge: [], form: null },
    'legend-rayquaza': { key: ['RAYQUAZA'], dex: [384], en: ['Rayquaza'], zh: ['烈空坐'], ty: [['DRAGON', 'FLYING']], ab: 'AIRLOCK', hid: 'AIRLOCK', edge: [], form: null },
    'legend-kyogre': { key: ['KYOGRE'], dex: [382], en: ['Kyogre'], zh: ['盖欧卡'], ty: [['WATER']], ab: 'DRIZZLE', hid: 'DRIZZLE', edge: [], form: null },
    'legend-groudon': { key: ['GROUDON'], dex: [383], en: ['Groudon'], zh: ['固拉多'], ty: [['GROUND']], ab: 'DROUGHT', hid: 'DROUGHT', edge: [], form: null },
    'legend-dialga': { key: ['DIALGA'], dex: [483], en: ['Dialga'], zh: ['帝牙卢卡'], ty: [['STEEL', 'DRAGON']], ab: 'PRESSURE', hid: 'TELEPATHY', edge: [], form: null },
    'legend-palkia': { key: ['PALKIA'], dex: [484], en: ['Palkia'], zh: ['帕路奇亚'], ty: [['WATER', 'DRAGON']], ab: 'PRESSURE', hid: 'TELEPATHY', edge: [], form: null },
    'legend-arceus': { key: ['ARCEUS'], dex: [493], en: ['Arceus'], zh: ['阿尔宙斯'], ty: [['NORMAL']], ab: 'MULTITYPE', hid: 'MULTITYPE', edge: [], form: null },
    'wildboss-articuno': { key: ['ARTICUNO'], dex: [144], en: ['Articuno'], zh: ['急冻鸟'], ty: [['ICE', 'FLYING']], ab: 'SNOWCLOAK', hid: 'PRESSURE', edge: [], form: null },
    'wildboss-zapdos': { key: ['ZAPDOS'], dex: [145], en: ['Zapdos'], zh: ['闪电鸟'], ty: [['ELECTRIC', 'FLYING']], ab: 'STATIC', hid: 'PRESSURE', edge: [], form: null },
    'wildboss-moltres': { key: ['MOLTRES'], dex: [146], en: ['Moltres'], zh: ['火焰鸟'], ty: [['FIRE', 'FLYING']], ab: 'FLAMEBODY', hid: 'PRESSURE', edge: [], form: null },
    'wildboss-raikou': { key: ['RAIKOU'], dex: [243], en: ['Raikou'], zh: ['雷公'], ty: [['ELECTRIC']], ab: 'VOLTABSORB', hid: 'INNERFOCUS', edge: [], form: null },
    'wildboss-entei': { key: ['ENTEI'], dex: [244], en: ['Entei'], zh: ['炎帝'], ty: [['FIRE']], ab: 'FLASHFIRE', hid: 'INNERFOCUS', edge: [], form: null },
    'wildboss-suicune': { key: ['SUICUNE'], dex: [245], en: ['Suicune'], zh: ['水君'], ty: [['WATER']], ab: 'WATERABSORB', hid: 'INNERFOCUS', edge: [], form: null },
};

/**
 * §6.1's 3:00 BOSS. Uncatchable (every ball clangs), so it owes the roster nothing.
 * `form` stays null because TYRANITAR_1 exists in the pack but was never imported into assets/icons -
 * naming art that is not on disk is the same lie in the other direction.
 */
export const BOSS_SPECIES = {
    key: 'TYRANITAR', dex: 248, en: 'Tyranitar', zh: '班基拉斯',
    ty: ['ROCK', 'DARK'], ab: 'SANDSTREAM,BATTLEARMOR', hid: 'UNNERVE', form: null,
};

/** Our six 元素 - the signed mechanical axis - against the types the borrowed art actually has. */
export const ELEMENT_TYPE = {
    grass: ['GRASS'], fire: ['FIRE'], water: ['WATER'], bolt: ['ELECTRIC'],
    crystal: ['ROCK', 'GROUND', 'BUG', 'STEEL', 'DRAGON'], support: ['NORMAL', 'FAIRY', 'FIGHTING', 'GHOST', 'DARK', 'POISON', 'PSYCHIC', 'FLYING'],
};

export const TYPE_ZH = {
    NORMAL: '普', FIRE: '火', WATER: '水', GRASS: '草', ELECTRIC: '电', ICE: '冰',
    FIGHTING: '斗', POISON: '毒', GROUND: '地', FLYING: '飞', PSYCHIC: '超', BUG: '虫',
    ROCK: '岩', GHOST: '幽', DRAGON: '龙', DARK: '恶', STEEL: '钢', FAIRY: '妖',
};

const FALLBACK = ['mush', 'chikorita', 'cyndaquil', 'totodile', 'badger', 'sprigatito', 'lizard', 'fuecoco', 'moth', 'drop', 'quaxly', 'tinkatink', 'nacli', 'frigibax', 'chespin', 'fennekin', 'froakie', 'snivy', 'tepig', 'oshawott', 'tandemaus', 'turtwig', 'chimchar', 'piplup', 'litten', 'popplio', 'grookey', 'scorbunny', 'sobble', 'turtle', 'bean', 'beetle', 'shell', 'mayfly', 'toad', 'cat', 'specter', 'mystic', 'machop', 'togepi', 'buizel', 'munchlax', 'wasp', 'lamp', 'bird', 'striker', 'sage', 'iron', 'grove', 'drake', 'shark', 'metal', 'tyran', 'starling', 'penguin', 'simian', 'lynx', 'bat', 'rose', 'rider', 'spark', 'magma', 'mammoth', 'hydra', 'axe', 'goo', 'rook', 'dreepy', 'croc', 'lucario', 'dratini', 'honedge', 'larvesta', 'pawniard', 'shinx', 'zorua', 'toxtricity', 'shroomish', 'hatenna', 'impidimp', 'archen', 'smoliv', 'tadbulb', 'wattrel', 'porygon', 'alcremie', 'vivillon', 'cutiefly', 'wildboss-articuno', 'wildboss-zapdos', 'wildboss-moltres', 'wildboss-raikou', 'wildboss-entei', 'wildboss-suicune', 'legend-mewtwo', 'legend-lugia', 'legend-hooh', 'legend-rayquaza', 'legend-kyogre', 'legend-groudon', 'legend-dialga', 'legend-palkia', 'legend-arceus'];

export const speciesOf = (famId) => SPECIES[famId] || null;

/** How far 段内进化 may take this line: its own dex depth and the game's 3 阶 ceiling. */
export function evoCeil (famId) {
    const s = SPECIES[famId];
    return Math.min(CHAIN.evolveCeil, s === undefined || s === null ? CHAIN.evolveCeil : s.key.length);
}

/**
 * One record's `Evolutions` value, split into (target, condition, argument) triples. Branching lines
 * are legal in this file - 蚊香君 and 喵喵 both have two - so the parse keeps every branch and the
 * caller picks the one whose target this atlas actually draws.
 */
function parseEdge (line) {
    const f = String(line || '').split(',');
    const out = [];
    for (let i = 0; i + 1 < f.length; i += 3) out.push({ to: f[i], kind: f[i + 1], arg: f[i + 2] || '' });
    return out;
}

/**
 * The price of a condition, and the law behind it: **a 等级 step is the one that asks for a pile**,
 * because that is what levelling means; a 石头 or 亲密度 step asks for something else and is therefore
 * the cheap fold (2 合 1). 只数 comes from the level number itself through `CHAIN.evolveLv`, so 沙漠蜻蜓
 * at 50 级 costs more of the stack than 妙蛙草 at 16 - which is the whole reason the ladder is
 * per-family now instead of the flat 3 v0.8 measured.
 */
function priceOf (st) {
    const c = CHAIN;
    // v0.9.9's signed rule: one price for the whole roster, in one currency. This short-circuit is the *only*
    // place it lives, so `0` hands every step back to the dex ladder below without touching a reader —
    // `evolveGate`, the 熔炉 rows, the HUD 短标 and `autoThresholdAt` all come through here.
    if (c.evolveFlat) return { q: c.evolveFlat, cores: 0, sec: 0 };
    if (st.kind === 'Level') {
        const n = Number(st.arg) || 0;
        let q = c.evolveBase;
        for (const gate of c.evolveLv) if (n >= gate) q++;
        return { q, cores: 0, sec: 0 };
    }
    if (st.kind === 'Item') {
        const s = STONE[st.arg] || { price: 2100 };
        return { q: c.evolveSkip, cores: Math.max(1, Math.round(s.price / c.evolveCoin)), sec: 0 };
    }
    if (st.kind === 'Happiness') return { q: c.evolveSkip, cores: 0, sec: c.happySec };
    // `None`: canonically gated on a form this game has no notion of. Cheapest fold, no currency.
    return { q: c.evolveSkip, cores: 0, sec: 0 };
}

/**
 * The step from 阶 `tier` to 阶 `tier + 1`, or null when the line ends there.
 * `alt` holds the branches this atlas cannot draw, so the 图鉴 can name the debt instead of hiding it.
 */
export function stepOf (famId, tier) {
    const s = SPECIES[famId];
    if (!s || tier < 1 || tier > s.key.length) return null;
    const line = parseEdge(s.edge[tier - 1]);
    if (!line.length) return null;
    const next = s.key[tier];
    let main = null;
    const alt = [];
    for (const st of line) {
        // The atlas draws exactly one of a branching line, so the branch whose target is this line's own
        // next name is the step; the others go to `alt` and stay 图鉴 debt rather than a fake price.
        if (main === null && st.to === next) main = st;
        else alt.push(st);
    }
    if (!main) main = line[0];
    const p = priceOf(main);
    return {
        fam: famId, tier, to: main.to, kind: main.kind, arg: main.arg, edge: s.edge[tier - 1],
        q: p.q, cores: p.cores, sec: p.sec,
        stone: main.kind === 'Item' ? (STONE[main.arg] || null) : null,
        alt: alt.map((a) => ({ to: a.to, kind: a.kind, arg: a.arg })),
    };
}

/**
 * One line of 图鉴 text: what this link's next 阶 actually demands, in Pokémon's own words.
 * The two extra currencies print *only when they are non-zero*. Before v0.9.9 a 石头 step always cost 融核 and
 * a 亲密 step always cost 携带秒, so the clause was free; with the price pinned flat both are 0, and the one
 * line whose job is to name the price was reading 「同族 3 合 1 + 0 融核」 —— a cost nobody can fail to pay is
 * not information, it is the old ladder's ghost. On the 图鉴价 ladder nothing changes (cores is `max(1, …)`
 * and `happySec` is 30), so this is a silence, not a re-price.
 */
export function condText (st) {
    if (!st) return '图鉴线到头';
    const core = st.cores ? ` + ${st.cores} 融核` : '';
    const carry = st.sec ? ` + 携带 ${st.sec}s` : '';
    // 「N 合 1」 describes what a fold *spends*, not what it *asks for*, and `chain.foldAfter` is the only
    // writer of that. So the sentence has to read the same switch: on the divisor law 3 只 really do become 1;
    // on any rung that keeps the pile, saying 「合 1」 would print a number the player can watch not happen.
    const fuse = CHAIN.evolveKeeps ? `集满 ${st.q} 只即进化` : `同族 ${st.q} 合 1`;
    if (st.kind === 'Level') return `等级 ${st.arg} · ${fuse}`;
    if (st.kind === 'Item') return `${st.stone ? st.stone.zh : st.arg} · ${fuse}${core}`;
    if (st.kind === 'Happiness') return `亲密度 · ${fuse}${carry}`;
    if (st.kind === 'HasMove') return `${st.arg === 'ANCIENTPOWER' ? '原始之力' : st.arg || '指定招式'} · ${fuse}`;
    return `${st.arg || '分支'} · ${fuse}`;
}

const clampTier = (tier) => Math.max(1, Math.min(4, tier | 0));

/**
 * Atlas key for a 段 of `fam` at 阶 `tier`. Past the end of a short line the body wears the line's own
 * form art, because forged bodies are not dex stages and the atlas has no more species to give them.
 */
export function iconKey (famId, tier) {
    if (SPECIES_MODE !== 'pokemon') return null;
    const s = SPECIES[famId];
    if (s === null || s === undefined) return null;
    const t = clampTier(tier);
    if (t <= s.key.length) return s.key[t - 1];
    return s.form || s.key[s.key.length - 1];
}

/** Shiny half of the same source frame; loaded for free, unused until 闪光 has a chain rule. */
export const shinyKey = (key) => `${key}_s`;

/** Every atlas key this table can ask for, so the loader knows the full set up front. */
export function iconKeys () {
    const out = [];
    for (const id of FALLBACK) {
        for (let tier = 1; tier <= 4; tier++) {
            const k = iconKey(id, tier);
            if (k && out.indexOf(k) < 0) out.push(k);
        }
    }
    for (const form of MEGA_FORMS) if (out.indexOf(form.icon) < 0) out.push(form.icon);
    for (const form of GIGANTAMAX_FORMS) if (form.icon && out.indexOf(form.icon) < 0) out.push(form.icon);
    for (let i = 1; i <= 4; i++) out.push(`MAUSHOLD_COMPANION_${i}`);
    if (SPECIES_MODE === 'pokemon') out.push(BOSS_SPECIES.key);
    return out;
}

/**
 * The name on screen. A 段 past the end of its own dex line is labelled as a forged form
 * rather than being handed an invented species, which is what v0.7's 圣光喵 was.
 */
export function displayName (famId, tier) {
    const s = SPECIES[famId];
    if (SPECIES_MODE !== 'pokemon' || !s) return tierName(famId, tier);
    const t = clampTier(tier);
    if (t <= s.zh.length) return s.zh[t - 1];
    return `${s.zh[s.zh.length - 1]}·形态`;
}

/** 图鉴编号, e.g. `#001`. Past the end of a short line it stays the top stage's number. */
export function dexText (famId, tier) {
    const s = SPECIES[famId];
    if (!s) return '';
    const d = s.dex[Math.min(clampTier(tier), s.dex.length) - 1];
    return `#${String(d).padStart(3, '0')}`;
}

/** This stage's own types, e.g. 「草/毒」 - 狙射树枭 is 草/幽 and its pre-evolutions are 草/飞. */
export function typeText (famId, tier) {
    const s = SPECIES[famId];
    if (s === null || s === undefined) return '';
    return s.ty[Math.min(clampTier(tier), s.ty.length) - 1].map((t) => TYPE_ZH[t] || t).join('/');
}

/** Every family's first stage - the roster as the 图鉴 would print it, used by the sim's audit table. */
export const ROSTER_IDS = FALLBACK;
