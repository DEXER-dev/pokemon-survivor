const TAU = Math.PI * 2;

/** Progression and world placement for the post-fourth-boss legendary lairs. */
export class LegendaryLairs {
    constructor (families) {
        this.families = families;
        this.reset();
    }

    reset () {
        this.sites = [];
        this.activeId = null;
    }

    /** Bosses 1-4 do not unlock lairs; every defeat from boss 5 adds one new location. */
    unlockForBossCount (defeated, x, y, rng) {
        const target = Math.max(0, Math.floor(defeated) - 4);
        const added = [];
        while (this.sites.length < target) {
            const index = this.sites.length;
            const family = this.families[index % this.families.length];
            const angle = rng.next() * TAU;
            const distance = 1250 + (index % 3) * 260 + Math.floor(index / 3) * 140;
            const site = {
                id: `legendary-lair-${index + 1}`,
                number: index + 1,
                species: family.id,
                name: family.name,
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance,
                complete: false,
            };
            this.sites.push(site);
            added.push(site);
        }
        return added;
    }

    get active () {
        return this.sites.find((site) => site.id === this.activeId) || null;
    }

    get next () {
        return this.active || this.sites.find((site) => !site.complete) || null;
    }

    /** Choose the nearest unlocked, unfinished lair that the player can currently enter. */
    siteAt (x, y, radius) {
        if (this.active) return null;
        const radiusSq = radius * radius;
        let nearest = null;
        let nearestSq = radiusSq;
        for (const site of this.sites) {
            if (site.complete) continue;
            const dx = site.x - x;
            const dy = site.y - y;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq > nearestSq) continue;
            nearest = site;
            nearestSq = distanceSq;
        }
        return nearest;
    }

    canEnter (x, y, radius) {
        return !!this.siteAt(x, y, radius);
    }

    enter (x, y, radius) {
        const site = this.siteAt(x, y, radius);
        if (!site) return null;
        this.activeId = site.id;
        return site;
    }

    completeActive () {
        const site = this.active;
        if (site) site.complete = true;
        this.activeId = null;
        return site;
    }

    leaveActive () {
        this.activeId = null;
    }
}
