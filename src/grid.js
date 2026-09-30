/*
 * Uniform-hash spatial grid. Box2D is deliberately absent (§10.2): 300 seekers only need
 * neighbour lookups, and a rebuild-per-frame grid costs far less than a physics island.
 * Buckets are kept between frames so a steady state allocates nothing.
 */
export class SpatialGrid {
    constructor (cell) {
        this.cell = cell;
        this.buckets = new Map();
        this.count = 0;
    }

    _key (cx, cy) {
        // 8192-cell offset keeps negative coordinates in a positive integer key space.
        return (cx + 8192) * 16384 + (cy + 8192);
    }

    clear () {
        for (const bucket of this.buckets.values()) bucket.length = 0;
        this.count = 0;
    }

    insert (id, x, y) {
        const key = this._key(Math.floor(x / this.cell), Math.floor(y / this.cell));
        let bucket = this.buckets.get(key);
        if (bucket === undefined) {
            bucket = [];
            this.buckets.set(key, bucket);
        }
        bucket.push(id);
        this.count++;
    }

    /** Fills `out` with ids whose cell overlaps the query box; caller filters by true distance. */
    query (x, y, r, out, maxPerBucket = Infinity) {
        out.length = 0;
        const c = this.cell;
        const x0 = Math.floor((x - r) / c);
        const x1 = Math.floor((x + r) / c);
        const y0 = Math.floor((y - r) / c);
        const y1 = Math.floor((y + r) / c);
        for (let cx = x0; cx <= x1; cx++) {
            for (let cy = y0; cy <= y1; cy++) {
                const bucket = this.buckets.get(this._key(cx, cy));
                if (bucket === undefined) continue;
                if (bucket.length <= maxPerBucket) {
                    for (let i = 0; i < bucket.length; i++) out.push(bucket[i]);
                } else {
                    // Dense crowds must not turn each seeker's separation check into an O(n²) scan.
                    // Sample across the full bucket, so older ids do not monopolize the neighbours.
                    const stride = Math.ceil(bucket.length / maxPerBucket);
                    for (let i = 0; i < bucket.length; i += stride) out.push(bucket[i]);
                }
            }
        }
        return out;
    }
}
