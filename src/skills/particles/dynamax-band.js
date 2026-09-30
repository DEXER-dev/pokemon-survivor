const surge = (values) => Object.freeze({ color: '#ff465b', ...values });

export const DYNAMAX_BAND_PARTICLE_PRESETS = Object.freeze({
    // 激活组合拳：全向冲击火花 + 向上喷发再落回的红色能量柱，两簇同帧发出。
    'dynamax-start': surge({
        duration: 0.14, emissionRate: 420, totalParticles: 64, life: 0.55, lifeVar: 0.18,
        angleVar: 180, speed: 122, speedVar: 60, startSize: 17, startSizeVar: 8,
        tangentialAccel: 66, radialAccel: 24, gravityY: 0, posVar: 12,
    }),
    'dynamax-start-pillar': surge({
        duration: 0.3, emissionRate: 240, totalParticles: 56, life: 0.78, lifeVar: 0.2,
        angleVar: 13, speed: 235, speedVar: 62, startSize: 13, startSizeVar: 5,
        tangentialAccel: 0, radialAccel: 0, gravityY: -190, posVar: 8,
    }),
    // 持续档：极巨化期间每隔一小会儿在巨人化本体周围冒几粒上升的红色能量尘，
    // 配合本体材质的边缘红光，替代过去那层平铺的红色罩。
    'dynamax-aura': surge({
        duration: 0.06, emissionRate: 60, totalParticles: 5, life: 0.92, lifeVar: 0.3,
        angleVar: 180, speed: 24, speedVar: 13, startSize: 9, startSizeVar: 4,
        tangentialAccel: 38, radialAccel: -10, gravityY: 30, posVar: 24,
    }),
    // 结束档：能量向内收拢的坍缩火花，和激活的向外爆发互为镜像。
    'dynamax-end': surge({
        duration: 0.08, emissionRate: 300, totalParticles: 36, life: 0.42, lifeVar: 0.14,
        angleVar: 180, speed: 84, speedVar: 44, startSize: 13, startSizeVar: 6,
        tangentialAccel: -30, radialAccel: -46, gravityY: 0, posVar: 8,
    }),
});
