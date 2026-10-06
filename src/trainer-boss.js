/*
 * Trainer-team encounter: the party is a small, finite-state bullet-hell controller. Opponent
 * Pokémon live in EnemySystem so the player's existing skill and sweep systems can damage them;
 * this class owns their formation, warning windows, hostile shots, arena bounds and encounter flow.
 */
import { BOSS, ELEMENT, FAMILIES, PLAYER, VIEW } from './config.js';
import { MEGA_BY_ID, MEGA_FORMS } from './mega.js';

const TAU = Math.PI * 2;
const CAP = 96;
const MAX_PARTY = Math.max(BOSS.party.length, ...BOSS.encounters.map((e) => e.party.length));

export class TrainerBossSystem {
    constructor () {
        this.x = new Float32Array(CAP);
        this.y = new Float32Array(CAP);
        this.vx = new Float32Array(CAP);
        this.vy = new Float32Array(CAP);
        this.r = new Float32Array(CAP);
        this.damage = new Float32Array(CAP);
        this.life = new Float32Array(CAP);
        this.slot = new Uint8Array(CAP);
        this.n = 0;
        this.active = false;
        this.cx = 0;
        this.cy = 0;
        this.arenaR = 0;
        this.zoom = 1;
        this.clock = 0;
        this.formationLeft = 0;
        this.encounter = null;
        this.party = BOSS.party;
        this.cooldown = new Float32Array(MAX_PARTY);
        this.warning = new Float32Array(MAX_PARTY);
        this.aim = new Float32Array(MAX_PARTY);
        this.maxHp = 0;
        this.megaSlot = -1;
        this.megaForm = null;
        this.megaActive = false;
        this.megaSpec = null;
        this.damageMul = 1;
        this.phaseTwo = false;
        this.commandCooldown = BOSS.commandPeriod;
    }

    reset (enemies) {
        this.active = false;
        this.n = 0;
        this.clock = 0;
        this.formationLeft = 0;
        this.maxHp = 0;
        this.megaSlot = -1;
        this.megaForm = null;
        this.megaActive = false;
        this.megaSpec = null;
        this.damageMul = 1;
        this.phaseTwo = false;
        this.commandCooldown = BOSS.commandPeriod;
        this.cooldown.fill(0);
        this.warning.fill(0);
        this.aim.fill(0);
        if (enemies) {
            enemies.trainerActive = false;
            enemies.trainerIntro = 0;
        }
    }

    start (enemies, px, py, minute, zoom, encounterIndex = 0) {
        this.reset();
        this.encounterIndex = Math.max(0, encounterIndex | 0);
        this.encounter = BOSS.encounters[this.encounterIndex % BOSS.encounters.length];
        const rank = Math.min(10, this.encounterIndex);
        const hpScale = 1 + rank * 0.24;
        const periodScale = 1.12 + Math.min(0.48, rank * 0.055);
        const speedScale = 1 + Math.min(0.36, rank * 0.04);
        this.damageMul = 1 + Math.min(0.55, rank * 0.06);
        this.phaseTwo = false;
        this.commandCooldown = BOSS.commandPeriod;
        this.party = this.encounter.party.map((member) => ({
            ...member,
            period: member.period / periodScale,
            speed: member.speed * speedScale,
        }));
        this.megaSpec = null;
        this.megaSlot = -1;
        this.megaForm = null;
        this.megaActive = false;
        if (this.encounterIndex >= 2) {
            const configured = this.encounter.mega;
            if (configured) {
                const member = this.party[configured.slot];
                const form = MEGA_BY_ID[configured.form];
                if (member && form && member.fam === form.fam) {
                    this.megaSlot = configured.slot;
                    this.megaForm = form;
                    this.megaSpec = configured;
                }
            }
            // Repeating chapters still get a Mega ace, even if an older encounter definition has no
            // explicit form; never apply a form to the wrong species family.
            if (!this.megaForm) {
                for (let slot = 0; slot < this.party.length && !this.megaForm; slot++) {
                    const form = MEGA_FORMS.find((candidate) => candidate.fam === this.party[slot].fam);
                    if (form) {
                        this.megaSlot = slot;
                        this.megaForm = form;
                        this.megaSpec = { slot, form: form.id };
                    }
                }
            }
            // The first chapter's original roster has no Mega-capable species. If it returns in the
            // post-game rematch loop, the trainer brings a Sceptile as the team's Mega ace.
            if (!this.megaForm) {
                const form = MEGA_BY_ID.sceptile;
                this.megaSlot = 0;
                this.megaForm = form;
                this.party[0] = { ...this.party[0], fam: form.fam, tier: 3, pattern: 'spiral', shots: 8 };
                this.megaSpec = { slot: 0, form: form.id, pattern: 'spiral', shots: 8 };
            }
        }
        this.active = true;
        this.cx = px;
        this.cy = py;
        this.zoom = Math.max(0.6, zoom || 1);
        this.arenaR = Math.min(VIEW.W, VIEW.H) * BOSS.arenaRatio / this.zoom;
        this.formationLeft = BOSS.formationSec;
        enemies.trainerActive = true;
        enemies.trainerIntro = BOSS.formationSec;
        enemies.arenaX = this.cx;
        enemies.arenaY = this.cy;
        enemies.arenaR = this.arenaR;
        enemies.prepareTrainerGather();

        for (let i = 0; i < this.party.length; i++) {
            const member = this.party[i];
            const fam = FAMILIES.findIndex((f) => f.id === member.fam);
            if (fam < 0) continue;
            const angle = -Math.PI / 2 + TAU * i / this.party.length;
            const x = this.cx + Math.cos(angle) * this.arenaR * 0.67;
            const y = this.cy + Math.sin(angle) * this.arenaR * 0.67;
            const memberHpScale = i === this.megaSlot ? 1.42 : 1;
            const row = enemies.spawn(x, y, fam, member.tier, false, minute, 0, i,
                this.party.length, (this.encounter.hpMul || BOSS.hpMul) * hpScale * memberHpScale);
            if (row >= 0) this.maxHp += enemies.maxhp[row];
            this.cooldown[i] = 1.25 + i * 0.6;
        }
        this._placeParty(enemies);
    }

    _placeParty (enemies) {
        for (let i = 0; i < enemies.n; i++) {
            if (!enemies.trainer[i]) continue;
            const slot = enemies.trainerSlot[i];
            const members = Math.max(1, this.party.length);
            const orbitSpeed = this.phaseTwo ? BOSS.phaseTwoOrbitSpeed : BOSS.formationOrbitSpeed;
            const angle = -Math.PI / 2 + TAU * slot / members + this.clock * orbitSpeed;
            const radius = this.arenaR * (this.phaseTwo ? 0.7 : 0.67);
            enemies.x[i] = this.cx + Math.cos(angle) * radius;
            enemies.y[i] = this.cy + Math.sin(angle) * radius + Math.sin(this.clock * 2.1 + slot) * 3;
            enemies.vx[i] = enemies.vy[i] = 0;
        }
    }

    _shotAngle (spec, base, index, count, clock = this.clock) {
        if (spec.pattern === 'ring-gap') {
            const spacing = TAU / (count + 1);
            return base + Math.PI + (index - (count - 1) / 2) * spacing;
        }
        if (spec.pattern === 'cross') return base + index * Math.PI / 2;
        if (spec.pattern === 'spiral') return base + clock * 1.1 + index * TAU / count;
        const spread = spec.pattern === 'focus' ? spec.spread * 0.45 : spec.spread;
        return base + (index - (count - 1) / 2) * spread / Math.max(1, count - 1);
    }

    _liveRow (slot, enemies) {
        for (let i = 0; i < enemies.n; i++) {
            if (enemies.trainer[i] && enemies.trainerSlot[i] === slot && !enemies.dead[i]) return i;
        }
        return -1;
    }

    _leadAim (slot, sx, sy, player) {
        const spec = this.party[slot];
        const speed = Math.max(1, spec.speed * (this.phaseTwo ? BOSS.phaseTwoSpeedMul : 1));
        const dx = player.x - sx;
        const dy = player.y - sy;
        const lead = Math.min(0.32, Math.hypot(dx, dy) / speed * 0.35);
        const vx = Number.isFinite(player.vx) ? player.vx : 0;
        const vy = Number.isFinite(player.vy) ? player.vy : 0;
        return Math.atan2(dy + vy * lead, dx + vx * lead);
    }

    _startCommand (enemies, player) {
        const rows = [];
        for (let slot = 0; slot < this.party.length; slot++) {
            const row = this._liveRow(slot, enemies);
            if (row < 0) continue;
            if (this.warning[slot] > 0) return false;
            rows.push([slot, row]);
        }
        if (!rows.length) return false;
        for (const [slot, row] of rows) {
            const spec = this.party[slot];
            this.aim[slot] = this._leadAim(slot, enemies.x[row], enemies.y[row], player);
            this.warning[slot] = BOSS.commandWarning;
            this.cooldown[slot] = spec.period * (this.phaseTwo ? BOSS.phaseTwoPeriodMul : 1);
        }
        return true;
    }

    _updatePhase (enemies) {
        if (this.phaseTwo || this.maxHp <= 0) return false;
        if (this.vitals(enemies).hp > this.maxHp * BOSS.phaseTwoAt) return false;
        this.phaseTwo = true;
        this.commandCooldown = Math.min(this.commandCooldown, 1.35);
        for (let slot = 0; slot < this.party.length; slot++) {
            const period = this.party[slot].period * BOSS.phaseTwoPeriodMul;
            this.cooldown[slot] = Math.min(this.cooldown[slot], period * 0.55);
        }
        return true;
    }

    step (dt, enemies, player, iFrame = PLAYER.iFrame, tryShield = null) {
        if (!this.active) return 0;
        this.clock += dt;
        this._placeParty(enemies);
        if (this.formationLeft > 0) {
            this.formationLeft = Math.max(0, this.formationLeft - dt);
            enemies.trainerIntro = this.formationLeft;
            return 0;
        }
        this._tryMega(enemies, player);
        this._updatePhase(enemies);
        this.commandCooldown = Math.max(0, this.commandCooldown - dt);
        if (this.commandCooldown <= 0) {
            if (this._startCommand(enemies, player)) {
                this.commandCooldown = this.phaseTwo ? BOSS.phaseTwoCommandPeriod : BOSS.commandPeriod;
            } else this.commandCooldown = 0.15;
        }

        for (let slot = 0; slot < this.party.length; slot++) {
            const source = this._liveRow(slot, enemies);
            if (source < 0) continue;
            if (this.warning[slot] > 0) {
                this.warning[slot] -= dt;
                if (this.warning[slot] <= 0) this._fire(slot, enemies.x[source], enemies.y[source]);
            } else {
                this.cooldown[slot] -= dt;
                if (this.cooldown[slot] <= 0) {
                    this.cooldown[slot] = this.party[slot].period
                        * (this.phaseTwo ? BOSS.phaseTwoPeriodMul : 1);
                    this.warning[slot] = BOSS.projectileWarning;
                    this.aim[slot] = this._leadAim(slot, enemies.x[source], enemies.y[source], player);
                }
            }
        }

        let hit = 0;
        for (let i = 0; i < this.n; i++) {
            this.x[i] += this.vx[i] * dt;
            this.y[i] += this.vy[i] * dt;
            this.life[i] -= dt;
            const dx = player.x - this.x[i];
            const dy = player.y - this.y[i];
            const rr = PLAYER.radius + this.r[i];
            if (dx * dx + dy * dy <= rr * rr) {
                const blocked = tryShield && tryShield();
                if (blocked || player.hurt(this.damage[i], iFrame)) hit++;
                this._remove(i--);
                continue;
            }
            const ax = this.x[i] - this.cx;
            const ay = this.y[i] - this.cy;
            if (this.life[i] <= 0 || ax * ax + ay * ay > (this.arenaR + 50) ** 2) this._remove(i--);
        }
        return hit;
    }

    _fire (slot, sx, sy) {
        const spec = this.party[slot];
        const mega = this.megaActive && slot === this.megaSlot;
        const base = this.aim[slot];
        const count = spec.shots;
        const speed = spec.speed;
        for (let i = 0; i < count && this.n < CAP; i++) {
            const angle = this._shotAngle(spec, base, i, count);
            const n = this.n++;
            this.x[n] = sx;
            this.y[n] = sy;
            const megaSpeed = mega ? 1.12 : 1;
            const phaseSpeed = this.phaseTwo ? BOSS.phaseTwoSpeedMul : 1;
            this.vx[n] = Math.cos(angle) * speed * megaSpeed * phaseSpeed;
            this.vy[n] = Math.sin(angle) * speed * megaSpeed * phaseSpeed;
            this.r[n] = BOSS.projectileRadius * (mega ? 1.24 : 1) * (this.phaseTwo ? 1.08 : 1);
            this.damage[n] = BOSS.projectileDamage * this.damageMul
                * (mega ? 1.28 : 1) * (this.phaseTwo ? BOSS.phaseTwoDamageMul : 1);
            this.life[n] = 4.5;
            this.slot[n] = slot;
        }
    }

    _tryMega (enemies, player) {
        if (!this.megaForm || this.megaActive || this.formationLeft > 0) return;
        if (this.vitals(enemies).hp > this.maxHp * 0.68) return;
        const livingRow = (slot) => {
            for (let i = 0; i < enemies.n; i++) {
                if (enemies.trainer[i] && enemies.trainerSlot[i] === slot && !enemies.dead[i]) return i;
            }
            return -1;
        };
        let row = livingRow(this.megaSlot);
        if (row < 0) {
            // If the announced ace was knocked out first, let another surviving, compatible team
            // member Mega evolve instead of silently dropping the phase.
            for (let slot = 0; slot < this.party.length; slot++) {
                const form = MEGA_FORMS.find((candidate) => candidate.fam === this.party[slot].fam);
                const candidateRow = form ? livingRow(slot) : -1;
                if (candidateRow < 0) continue;
                const spec = this.party[slot];
                const pattern = form.id === 'gengar' ? 'ring-gap'
                    : form.id === 'swampert' || form.id === 'salamence' ? 'spiral' : 'cross';
                this.megaSlot = slot;
                this.megaForm = form;
                this.megaSpec = {
                    slot, form: form.id, pattern,
                    shots: Math.min(9, Math.max(spec.shots + 2, Math.ceil(form.shots * 0.75))),
                    spread: spec.spread || 0.6,
                };
                row = candidateRow;
                break;
            }
        }
        if (row < 0) return;

        const spec = this.party[this.megaSlot];
        this.megaActive = true;
        spec.pattern = this.megaSpec.pattern || spec.pattern;
        spec.shots = Math.max(spec.shots, this.megaSpec.shots || this.megaForm.shots);
        if (this.megaSpec.spread !== undefined) spec.spread = this.megaSpec.spread;
        spec.period = Math.max(1.45, spec.period * 0.76);
        spec.speed *= 1.2;
        enemies.hp[row] = Math.min(enemies.maxhp[row], enemies.hp[row] + enemies.maxhp[row] * 0.18);
        enemies.r[row] *= 1.25;
        this.megaX = enemies.x[row];
        this.megaY = enemies.y[row];
        this.cooldown[this.megaSlot] = 0.2;
        this.warning[this.megaSlot] = BOSS.projectileWarning + 0.42;
        this.aim[this.megaSlot] = Math.atan2(player.y - enemies.y[row], player.x - enemies.x[row]);
    }

    isMegaSlot (slot) {
        return this.megaActive && slot === this.megaSlot;
    }

    _remove (i) {
        const last = --this.n;
        if (i === last) return;
        this.x[i] = this.x[last];
        this.y[i] = this.y[last];
        this.vx[i] = this.vx[last];
        this.vy[i] = this.vy[last];
        this.r[i] = this.r[last];
        this.damage[i] = this.damage[last];
        this.life[i] = this.life[last];
        this.slot[i] = this.slot[last];
    }

    constrainPlayer (player) {
        if (!this.active) return;
        const dx = player.x - this.cx;
        const dy = player.y - this.cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        const limit = Math.max(0, this.arenaR - PLAYER.radius - 2);
        if (d <= limit || d < 1e-4) return;
        const nx = dx / d;
        const ny = dy / d;
        const outward = player.vx * nx + player.vy * ny;
        // The arena is a real boundary: keeping the player's full collision radius inside prevents
        // a soft-edge overshoot from letting the hero meet the harmless wild crowd outside.
        player.x = this.cx + nx * limit;
        player.y = this.cy + ny * limit;
        if (outward > 0) {
            player.vx -= nx * outward;
            player.vy -= ny * outward;
        }
    }

    vitals (enemies) {
        let hp = 0;
        let count = 0;
        for (let i = 0; i < enemies.n; i++) {
            if (!enemies.trainer[i]) continue;
            count++;
            hp += Math.max(0, enemies.hp[i]);
        }
        return { hp, maxHp: this.maxHp, count, formationLeft: this.formationLeft };
    }

    finishIfDefeated (enemies) {
        if (!this.active) return false;
        const { count } = this.vitals(enemies);
        if (count > 0) return false;
        this.active = false;
        this.n = 0;
        enemies.trainerActive = false;
        enemies.trainerIntro = 0;
        return true;
    }

    drawArenaAndWarnings (g, pal, enemies) {
        if (!this.active) return;
        if (enemies.trainerIntro > 0) {
            const fade = Math.min(1, enemies.trainerIntro / 0.65);
            const phase = this.clock * 0.22;
            g.strokeColor = pal.get('#58d9d1', Math.round(105 * fade));
            g.lineWidth = 2;
            // Curved guide streams explain the audience's motion: they spiral in from outside,
            // then fade as the wild Pokémon settle into their two perimeter rings.
            for (let ray = 0; ray < 10; ray++) {
                const start = phase + TAU * ray / 10;
                const outer = this.arenaR + 205;
                const inner = this.arenaR + 38;
                g.moveTo(this.cx + Math.cos(start) * outer, this.cy + Math.sin(start) * outer);
                for (let step = 1; step <= 12; step++) {
                    const t = step / 12;
                    const r = outer + (inner - outer) * t;
                    const a = start + 0.58 * t;
                    g.lineTo(this.cx + Math.cos(a) * r, this.cy + Math.sin(a) * r);
                }
                g.stroke();
            }
        }
        g.strokeColor = pal.get(this.phaseTwo ? '#d84a55' : '#746a8e', this.phaseTwo ? 180 : 110);
        g.lineWidth = this.phaseTwo ? 5 : 4;
        g.circle(this.cx, this.cy, this.arenaR);
        g.stroke();
        for (let i = 0; i < enemies.n; i++) {
            if (!enemies.trainer[i]) continue;
            const slot = enemies.trainerSlot[i];
            const warning = this.warning[slot];
            if (warning <= 0 || enemies.dead[i]) continue;
            const alpha = Math.round(210 * Math.min(1, warning / Math.max(BOSS.projectileWarning, BOSS.commandWarning)));
            const spec = this.party[slot];
            const shots = Math.max(1, spec.shots);
            const color = this.isMegaSlot(slot) ? this.megaForm.color : this.phaseTwo ? '#ff596d' : '#d84a55';
            g.strokeColor = pal.get(color, alpha);
            g.lineWidth = this.isMegaSlot(slot) ? 3 : 2;
            const fromX = enemies.x[i];
            const fromY = enemies.y[i];
            const relX = fromX - this.cx;
            const relY = fromY - this.cy;
            for (let shot = 0; shot < shots; shot++) {
                const angle = this._shotAngle(spec, this.aim[slot], shot, shots);
                const dot = relX * Math.cos(angle) + relY * Math.sin(angle);
                const remain = Math.max(0, dot * dot + this.arenaR * this.arenaR - relX * relX - relY * relY);
                const length = Math.max(0, -dot + Math.sqrt(remain));
                g.moveTo(fromX, fromY);
                g.lineTo(fromX + Math.cos(angle) * length, fromY + Math.sin(angle) * length);
            }
            g.stroke();
            g.circle(enemies.x[i], enemies.y[i], enemies.r[i] + 12);
            g.stroke();
        }
    }

    drawProjectiles (batch, palette) {
        // Hostile moving shots are rendered by NativeParticleBursts.updateTrainerProjectileTrails.
    }

    drawTrainer (batch, palette, glyphs, time = 0) {
        if (!this.active) return;
        const x = this.cx + this.arenaR * 0.78;
        const trainer = this.encounterIndex % 10;
        const walk = [0, 1, 2, 1][Math.floor(time * 7) % 4];
        const key = `trainer_${trainer}_1_${walk}`;
        batch.draw(glyphs && glyphs[key] ? key : 'pill', x, this.cy, 1.28, 1.28, 0,
            palette.get('#ffffff', 255));
    }
}
