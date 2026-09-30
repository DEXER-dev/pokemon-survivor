/*
 * Dev-facing readout only; the shipped HUD is M1 work. Each label owns a full-width box in view
 * space and aligns inside it, so margins never depend on the measured text width.
 */
import { VIEW, COL } from './config.js';
import { hexToRgb } from './batch.js';
import { legendaryGuideLayout } from './lair-guide-layout.js';
import { drawLegendaryGuideIcon, legendaryGuideStyle } from './legendary-guide-icons.js';
import { traceHeart } from './heart-shape.js';
import { iconKey, shinyKey } from './species.js';
import { megaFormForSegment } from './mega.js';
import { gigantamaxFormForSegment } from './gigantamax.js';

const PARTY_ICON_LIMIT = 39;
const PARTY_ICON_STEP = 26;

export function makeLabel (cc, parent, name, y, size, hex, align, x = 0, width = VIEW.W - 36) {
    const node = new cc.Node(name);
    node.layer = cc.Layers.Enum.UI_2D;
    node.setPosition(x, y, 0);
    parent.addChild(node);
    const l = node.addComponent(cc.Label);
    const A = cc.Label.HorizontalAlign;
    const [r, g, b] = hexToRgb(hex);
    l.fontSize = size;
    l.lineHeight = Math.round(size * 1.3);
    l.color = new cc.Color(r, g, b, 255);
    l.horizontalAlign = align === 'left' ? A.LEFT : align === 'right' ? A.RIGHT : A.CENTER;
    l.verticalAlign = cc.Label.VerticalAlign.CENTER;
    l.overflow = cc.Label.Overflow.NONE;
    node.getComponent(cc.UITransform).setContentSize(width, Math.round(size * 1.6));
    return l;
}

export class Hud {
    constructor (cc, parent) {
        this.cc = cc;
        const root = new cc.Node('Hud');
        root.layer = cc.Layers.Enum.UI_2D;
        parent.addChild(root);
        this.guideRoot = new cc.Node('LegendaryLairGuides');
        this.guideRoot.layer = cc.Layers.Enum.UI_2D;
        root.addChild(this.guideRoot);
        this.guideGraphics = this.guideRoot.addComponent(cc.Graphics);
        this.guideLabels = [];
        this.guideColors = ['#ffd16d', '#79eaff', '#ff8fbb', '#a9f080', '#c4a0ff', '#ff9d63', '#7ef0cf', '#fff08a']
            .map((hex) => { const [r, g, b] = hexToRgb(hex); return new cc.Color(r, g, b, 255); });
        this.guideLabelKeys = [];
        this.stat = makeLabel(cc, root, 'Stat', VIEW.H / 2 - 30, 20, COL.text, 'left');
        this.info = makeLabel(cc, root, 'Info', VIEW.H / 2 - 56, 18, COL.text, 'left');
        this.info.node.active = false;
        this.toast = makeLabel(cc, root, 'Toast', VIEW.H / 2 - 82, 17, COL.ink,
            'left', -VIEW.W / 2 + 230, 430);
        this.chain = makeLabel(cc, root, 'Chain', VIEW.H / 2 - 30, 20, COL.accent, 'right');
        // The old full-width performance/party strings competed with one another at the top edge.
        // Keep the useful level readout below, and use the top line for the actual party sprites.
        this.stat.node.active = false;
        this.chain.node.active = false;
        this.partyRoot = new cc.Node('PartyRoster');
        this.partyRoot.layer = cc.Layers.Enum.UI_2D;
        this.partyRoot.setPosition(0, VIEW.H / 2 - 14, 0);
        root.addChild(this.partyRoot);
        this.partyPanel = this.partyRoot.addComponent(cc.Graphics);
        this.partySummary = makeLabel(cc, this.partyRoot, 'PartySummary', 0, 12,
            '#fff0cb', 'left', -VIEW.W / 2 + 28 + 77, 154);
        this.partyOverflow = makeLabel(cc, this.partyRoot, 'PartyOverflow', 0, 12,
            '#ffe49b', 'center', 0, 34);
        this.partyOverflow.node.active = false;
        this.partyCells = [];
        this.partySignature = null;
        this.partySummaryKey = null;
        const partyStartX = -VIEW.W / 2 + 190;
        for (let i = 0; i < PARTY_ICON_LIMIT; i++) {
            const cell = new cc.Node(`PartyPokemon${i}`);
            cell.layer = cc.Layers.Enum.UI_2D;
            cell.setPosition(partyStartX + i * PARTY_ICON_STEP, 0, 0);
            this.partyRoot.addChild(cell);
            const frame = cell.addComponent(cc.Graphics);
            const spriteNode = new cc.Node('Icon');
            spriteNode.layer = cc.Layers.Enum.UI_2D;
            cell.addChild(spriteNode);
            const sprite = spriteNode.addComponent(cc.Sprite);
            sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            spriteNode.getComponent(cc.UITransform).setContentSize(22, 22);
            const badgeNode = new cc.Node('CountBadge');
            badgeNode.layer = cc.Layers.Enum.UI_2D;
            cell.addChild(badgeNode);
            const badge = badgeNode.addComponent(cc.Graphics);
            const count = makeLabel(cc, cell, 'Count', -9, 9, '#fff0ae', 'center', 7, 14);
            this.partyCells.push({ node: cell, frame, sprite, badge, count, key: null });
        }
        this.partyRoot.active = false;
        this.expRoot = new cc.Node('ExperienceBar');
        this.expRoot.layer = cc.Layers.Enum.UI_2D;
        this.expRoot.setPosition(0, VIEW.H / 2 - 64, 0);
        root.addChild(this.expRoot);
        this.expPanel = this.expRoot.addComponent(cc.Graphics);
        this.expLabel = makeLabel(cc, this.expRoot, 'ExperienceLabel', 8, 13,
            '#fff0cb', 'left', 0, 290);
        const expGaugeNode = new cc.Node('ExperienceGauge');
        expGaugeNode.layer = cc.Layers.Enum.UI_2D;
        this.expRoot.addChild(expGaugeNode);
        this.expGauge = expGaugeNode.addComponent(cc.Graphics);
        this.expKey = null;
        this.hint = makeLabel(cc, root, 'Hint', -VIEW.H / 2 + 28, 17, COL.text, 'center');
        this.dynamaxStatus = makeLabel(cc, root, 'DynamaxBandStatus', -VIEW.H / 2 + 164,
            14, '#ff6978', 'left', -VIEW.W / 2 + 150, 276);
        this.dynamaxStatus.node.active = false;
        this.dynamaxStatusKey = null;
        this.zMoveStatus = makeLabel(cc, root, 'ZMoveStatus', -VIEW.H / 2 + 140,
            14, '#ffe69a', 'left', -VIEW.W / 2 + 150, 360);
        this.zMoveStatus.node.active = false;
        this.zMoveStatusKey = null;
        this.ammoRoot = new cc.Node('AmmoCounter');
        this.ammoRoot.layer = cc.Layers.Enum.UI_2D;
        this.ammoRoot.setPosition(VIEW.W / 2 - 136, -VIEW.H / 2 + 108, 0);
        root.addChild(this.ammoRoot);
        const ammoPanel = new cc.Node('AmmoPanel');
        ammoPanel.layer = cc.Layers.Enum.UI_2D;
        this.ammoRoot.addChild(ammoPanel);
        this.ammoPanel = ammoPanel.addComponent(cc.Graphics);
        const ballNode = new cc.Node('BallIcon');
        ballNode.layer = cc.Layers.Enum.UI_2D;
        ballNode.setPosition(-52, 0, 0);
        this.ammoRoot.addChild(ballNode);
        this.ballSprite = ballNode.addComponent(cc.Sprite);
        this.ballSprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        ballNode.getComponent(cc.UITransform).setContentSize(40, 40);
        this.ammoCaption = makeLabel(cc, this.ammoRoot, 'AmmoCaption', 17, 13, COL.heroTrim, 'center', 18, 76);
        this.ammoCount = makeLabel(cc, this.ammoRoot, 'AmmoCount', -13, 32, COL.gold, 'center', 18, 76);
        this.ammoValue = null;
        this.setAmmo(5);
        this.healthRoot = new cc.Node('PlayerHealth');
        this.healthRoot.layer = cc.Layers.Enum.UI_2D;
        this.healthRoot.setPosition(-VIEW.W / 2 + 168, -VIEW.H / 2 + 108, 0);
        root.addChild(this.healthRoot);
        this.healthPanel = this.healthRoot.addComponent(cc.Graphics);
        this.healthValue = null;
        this.healthMaxValue = null;
        this.healthTag = makeLabel(cc, this.healthRoot, 'HealthTag', 15, 16, '#ffe6a6', 'center', -96, 46);
        this.healthText = makeLabel(cc, this.healthRoot, 'HealthValue', 15, 16, '#fff9ec', 'center', 24, 176);
        const healthGaugeNode = new cc.Node('HealthGauge');
        healthGaugeNode.layer = cc.Layers.Enum.UI_2D;
        healthGaugeNode.setPosition(0, -19, 0);
        this.healthRoot.addChild(healthGaugeNode);
        this.healthGauge = healthGaugeNode.addComponent(cc.Graphics);
        this.bossProgressRoot = new cc.Node('BossProgress');
        this.bossProgressRoot.layer = cc.Layers.Enum.UI_2D;
        this.bossProgressRoot.setPosition(0, -VIEW.H / 2 + 108, 0);
        root.addChild(this.bossProgressRoot);
        const progressPanel = this.bossProgressRoot.addComponent(cc.Graphics);
        progressPanel.fillColor = new cc.Color(28, 20, 38, 235);
        progressPanel.rect(-218, -24, 436, 48);
        progressPanel.fill();
        progressPanel.strokeColor = new cc.Color(255, 206, 116, 210);
        progressPanel.lineWidth = 2;
        progressPanel.rect(-218, -24, 436, 48);
        progressPanel.stroke();
        this.bossProgress = makeLabel(cc, this.bossProgressRoot, 'BossProgressText', 0, 16,
            '#fff1ce', 'center', 0, 420);
        this.bossProgressKey = null;
        this.bossProgressBattle = null;
        this.bossProgressRoot.active = false;
        this.bossRoot = new cc.Node('BossHealth');
        this.bossRoot.layer = cc.Layers.Enum.UI_2D;
        root.addChild(this.bossRoot);
        const bossPanelNode = new cc.Node('BossPanel');
        bossPanelNode.layer = cc.Layers.Enum.UI_2D;
        bossPanelNode.setPosition(0, 210, 0);
        this.bossRoot.addChild(bossPanelNode);
        const bossPanel = bossPanelNode.addComponent(cc.Graphics);
        bossPanel.fillColor = new cc.Color(28, 20, 38, 244);
        bossPanel.rect(-334, -56, 668, 112);
        bossPanel.fill();
        bossPanel.strokeColor = new cc.Color(255, 206, 116, 245);
        bossPanel.lineWidth = 3;
        bossPanel.rect(-334, -56, 668, 112);
        bossPanel.stroke();
        this.bossTitle = makeLabel(cc, this.bossRoot, 'BossTitle', 246, 21, '#ffe6a6', 'center', 0, 640);
        this.bossHp = makeLabel(cc, this.bossRoot, 'BossHP', 216, 16, '#fff9ec', 'center', 0, 600);
        const gaugeNode = new cc.Node('BossGauge');
        gaugeNode.layer = cc.Layers.Enum.UI_2D;
        gaugeNode.setPosition(0, 176, 0);
        this.bossRoot.addChild(gaugeNode);
        this.bossGauge = gaugeNode.addComponent(cc.Graphics);
        this.bossRoot.active = false;

        // A persistent, visual readout for the currently selected Mega / Gigantamax area skill.
        // It sits above the bottom-right ammo counter and away from the bottom-center boss tracker.
        this.skillRoot = new cc.Node('CombatSkillPanel');
        this.skillRoot.layer = cc.Layers.Enum.UI_2D;
        this.skillRoot.setPosition(VIEW.W / 2 - 190, -VIEW.H / 2 + 270, 0);
        root.addChild(this.skillRoot);
        this.skillPanel = this.skillRoot.addComponent(cc.Graphics);
        const cooldownNode = new cc.Node('SkillCooldownGauge');
        cooldownNode.layer = cc.Layers.Enum.UI_2D;
        this.skillRoot.addChild(cooldownNode);
        this.skillCooldownGauge = cooldownNode.addComponent(cc.Graphics);
        const scopeNode = new cc.Node('SkillRangeDiagram');
        scopeNode.layer = cc.Layers.Enum.UI_2D;
        scopeNode.setPosition(-111, 5, 0);
        this.skillRoot.addChild(scopeNode);
        this.skillDiagram = scopeNode.addComponent(cc.Graphics);
        const skillIconNode = new cc.Node('SkillPokemonIcon');
        skillIconNode.layer = cc.Layers.Enum.UI_2D;
        skillIconNode.setPosition(-111, 5, 0);
        this.skillRoot.addChild(skillIconNode);
        this.skillSprite = skillIconNode.addComponent(cc.Sprite);
        this.skillSprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        skillIconNode.getComponent(cc.UITransform).setContentSize(48, 48);
        this.skillForm = makeLabel(cc, this.skillRoot, 'SkillForm', 61, 13,
            '#9eeaff', 'left', 12, 184);
        this.skillName = makeLabel(cc, this.skillRoot, 'SkillName', 36, 19,
            '#fff5d7', 'left', 12, 184);
        this.skillRange = makeLabel(cc, this.skillRoot, 'SkillRange', 8, 14,
            '#ffdc8a', 'left', 12, 184);
        this.skillStatus = makeLabel(cc, this.skillRoot, 'SkillStatus', -20, 14,
            '#72f0b0', 'left', 12, 184);
        const keyNode = new cc.Node('SkillKeyHint');
        keyNode.layer = cc.Layers.Enum.UI_2D;
        keyNode.setPosition(0, -59, 0);
        this.skillRoot.addChild(keyNode);
        this.skillKeys = keyNode.addComponent(cc.Graphics);
        this.skillKeyLabel = makeLabel(cc, keyNode, 'SkillKeyLabel', 0, 12,
            '#f4edff', 'center', 0, 280);
        this.skillSignature = null;
        this.skillCooldownKey = null;
        this.skillRoot.active = false;
        this.root = root;
    }

    setLegendaryGuides (sites, camera, time, visible = true, entrySite = null) {
        const markers = visible ? legendaryGuideLayout(sites, camera, VIEW) : [];
        // Guides are created before the HUD panels. Keep them on top so a destination on the same
        // screen edge as the boss tracker, health, or ammo panel cannot disappear underneath it.
        if (this.guideRoot.parent) {
            this.guideRoot.setSiblingIndex(this.guideRoot.parent.children.length - 1);
        }
        const g = this.guideGraphics;
        g.clear();
        for (let i = 0; i < this.guideLabels.length; i++) this.guideLabels[i].node.active = i < markers.length;
        while (this.guideLabels.length < markers.length) {
            const label = makeLabel(this.cc, this.guideRoot, `LairGuideLabel${this.guideLabels.length + 1}`,
                0, 13, '#fff3cc', 'center', 0, 150);
            label.node.active = false;
            this.guideLabels.push(label);
            this.guideLabelKeys.push('');
        }

        markers.forEach((marker, i) => {
            const { site, x, y, angle, inside, edge } = marker;
            const style = legendaryGuideStyle(site.species);
            const color = style
                ? new this.cc.Color(style.color[0], style.color[1], style.color[2], 255)
                : this.guideColors[(site.number - 1) % this.guideColors.length];
            const label = this.guideLabels[i];
            const labelKey = `${site.number}|${site.species}|${site.name}|${color.r}|${color.g}|${color.b}`;
            if (this.guideLabelKeys[i] !== labelKey) {
                this.guideLabelKeys[i] = labelKey;
                label.string = `#${site.number} ${site.name}`;
                label.color = color;
            }
            let lx = x;
            let ly = y - 38;
            if (!inside) {
                if (edge === 'left') lx += 82;
                else if (edge === 'right') lx -= 82;
                else if (edge === 'top') ly -= 10;
                else ly += 42;
            }
            lx = Math.max(-VIEW.W / 2 + 82, Math.min(VIEW.W / 2 - 82, lx));
            ly = Math.max(-VIEW.H / 2 + 36, Math.min(VIEW.H / 2 - 116, ly));
            label.node.setPosition(lx, ly, 0);

            drawLegendaryGuideIcon(g, this.cc, site, x, y, angle, time, inside);
        });

        // In-range entry prompt: the gold ground ring alone never told anyone to press E, so the
        // moment the player walks into the lair's 112 px band the screen marks the door itself.
        if (visible && entrySite) {
            const dx = (entrySite.x - camera.x) * camera.z;
            const dy = (entrySite.y - camera.y) * camera.z;
            const pulse = 0.5 + 0.5 * Math.sin(time * 6);
            g.strokeColor = new this.cc.Color(255, 229, 155, Math.round(150 + pulse * 105));
            g.lineWidth = 4.5;
            g.circle(dx, dy, 44 + pulse * 8);
            g.stroke();
            g.strokeColor = new this.cc.Color(255, 229, 155, Math.round(70 + pulse * 70));
            g.lineWidth = 2;
            g.circle(dx, dy, 58 + pulse * 10);
            g.stroke();
            // Dark amber with a pale outline: the prompt sits on the light field, where the gold
            // rings alone wash out just like the gold ground ring did.
            const label = this.lairPromptLabel || (this.lairPromptLabel = (() => {
                const l = makeLabel(this.cc, this.guideRoot, 'LairEntryPrompt', 0, 16,
                    '#5b3a06', 'center', 0, 300);
                if ('enableOutline' in l) {
                    l.enableOutline = true;
                    l.outlineColor = new this.cc.Color(255, 244, 214, 220);
                    l.outlineWidth = 3;
                }
                return l;
            })());
            label.node.active = true;
            label.node.setPosition(
                Math.max(-VIEW.W / 2 + 110, Math.min(VIEW.W / 2 - 110, dx)),
                Math.max(-VIEW.H / 2 + 30, Math.min(VIEW.H / 2 - 40, dy - 96)), 0);
            const text = `按 E 进入 · #${entrySite.number} ${entrySite.name} 领域`;
            if (this.lairPromptText !== text) {
                this.lairPromptText = text;
                label.string = text;
            }
        } else if (this.lairPromptLabel) {
            this.lairPromptLabel.node.active = false;
        }
    }

    set (stat, chain, hint) {
        this.stat.string = stat;
        this.chain.string = chain;
        this.hint.string = hint;
    }

    /** Render the live team as a compact icon roster; unchanged cells keep their nodes and frames. */
    setParty (segments, cap, petTotal, glyphs) {
        this.partyRoot.active = segments.length > 0;
        let shinyCount = 0;
        let normalCount = 0;
        let legendaryCount = 0;
        for (const segment of segments) {
            if (segment.shiny) shinyCount++;
            if (typeof segment.fam === 'string' && segment.fam.startsWith('legend-')) legendaryCount++;
            else if (!segment.shiny) normalCount++;
        }
        const summaryKey = `${normalCount}|${legendaryCount}|${cap}|${petTotal}|${shinyCount}`;
        if (summaryKey !== this.partySummaryKey) {
            this.partySummaryKey = summaryKey;
            const legendaryLabel = legendaryCount ? ` · 传说 ${legendaryCount}` : '';
            this.partySummary.string = `队伍 ${normalCount}/${cap}${legendaryLabel} · ${petTotal}只 · ✨${shinyCount}`;
        }

        const signature = segments.map((segment) =>
            `${segment.fam}:${segment.tier}:${segment.count}:${segment.shiny ? 1 : 0}:${segment.mega || ''}:${segment.gigantamax || ''}`
        ).join('|');
        if (signature !== this.partySignature) {
            this.partySignature = signature;
            const panel = this.partyPanel;
            panel.clear();
            panel.fillColor = new this.cc.Color(25, 21, 39, 220);
            panel.rect(-VIEW.W / 2 + 8, -21, VIEW.W - 16, 42);
            panel.fill();
            panel.strokeColor = new this.cc.Color(137, 103, 199, 195);
            panel.lineWidth = 1.5;
            panel.rect(-VIEW.W / 2 + 8, -21, VIEW.W - 16, 42);
            panel.stroke();
        }

        const visible = Math.min(segments.length, PARTY_ICON_LIMIT);
        for (let i = 0; i < this.partyCells.length; i++) {
            const cell = this.partyCells[i];
            const segment = i < visible ? segments[i] : null;
            cell.node.active = !!segment;
            if (!segment) continue;

            const mega = megaFormForSegment(segment);
            const gigantamax = gigantamaxFormForSegment(segment);
            const baseKey = mega ? mega.icon : (gigantamax && gigantamax.icon) || iconKey(segment.fam, segment.tier);
            const shinyIcon = segment.shiny && baseKey ? shinyKey(baseKey) : null;
            const icon = shinyIcon && glyphs[shinyIcon] ? shinyIcon : baseKey;
            const glyph = icon && glyphs[icon];
            if (glyph && cell.sprite.spriteFrame !== glyph.frame) cell.sprite.spriteFrame = glyph.frame;
            cell.sprite.node.active = !!glyph;
            cell.count.string = segment.count > 1
                ? (segment.count > 99 ? '99+' : `×${segment.count}`) : '';

            if (cell.key !== icon || cell.signature !== `${segment.shiny}|${!!mega}|${!!gigantamax}|${segment.count > 1}`) {
                cell.key = icon;
                cell.signature = `${segment.shiny}|${!!mega}|${!!gigantamax}|${segment.count > 1}`;
                const border = segment.shiny ? new this.cc.Color(255, 213, 105, 255)
                    : mega || gigantamax ? new this.cc.Color(117, 224, 255, 245)
                        : new this.cc.Color(108, 99, 133, 210);
                const g = cell.frame;
                g.clear();
                g.fillColor = new this.cc.Color(14, 12, 23, 235);
                g.rect(-12, -12, 24, 24);
                g.fill();
                g.strokeColor = border;
                g.lineWidth = segment.shiny ? 2 : 1;
                g.rect(-12, -12, 24, 24);
                g.stroke();
                if (segment.shiny) {
                    g.fillColor = new this.cc.Color(255, 226, 125, 255);
                    g.circle(-8, 8, 2.2);
                    g.fill();
                    g.moveTo(-8, 4); g.lineTo(-8, 12);
                    g.moveTo(-12, 8); g.lineTo(-4, 8);
                    g.stroke();
                }
                const badge = cell.badge;
                badge.clear();
                if (segment.count > 1) {
                    badge.fillColor = new this.cc.Color(22, 18, 32, 245);
                    badge.rect(0, -12, 14, 9);
                    badge.fill();
                    badge.strokeColor = new this.cc.Color(255, 220, 139, 230);
                    badge.lineWidth = 0.8;
                    badge.rect(0, -12, 14, 9);
                    badge.stroke();
                }
            }
        }
        const overflow = Math.max(0, segments.length - PARTY_ICON_LIMIT);
        this.partyOverflow.node.active = overflow > 0;
        if (overflow > 0) {
            this.partyOverflow.node.setPosition(-VIEW.W / 2 + 190 + PARTY_ICON_LIMIT * PARTY_ICON_STEP, 0, 0);
            this.partyOverflow.string = `+${overflow}`;
        }
    }

    /**
     * The toast gets its own line rather than being appended to 状态: with `Overflow.NONE` the label
     * grows around its centre, so an appended sentence pushed the whole block past the 1280 view and cut
     * its own tail off the right edge - which is precisely the half of a refusal a player needs.
     */
    setInfo (info, toast) {
        // The old always-on stats sentence was too dense. Persistent run progress now lives in the
        // XP bar; only short-lived event messages remain here.
        this.info.string = '';
        this.toast.string = toast || '';
    }

    /** Compact current-level progress; redraw only when the visible integer EXP changes. */
    setExperience (level, current, required) {
        const value = Math.max(0, Math.floor(current));
        const goal = Math.max(1, Math.floor(required));
        const key = `${level}|${value}|${goal}`;
        if (key === this.expKey) return;
        this.expKey = key;
        this.expLabel.string = `Lv ${level}　EXP ${value} / ${goal}`;

        const panel = this.expPanel;
        panel.clear();
        panel.fillColor = new this.cc.Color(25, 21, 39, 226);
        panel.rect(-164, -18, 328, 36);
        panel.fill();
        panel.strokeColor = new this.cc.Color(137, 103, 199, 210);
        panel.lineWidth = 1.25;
        panel.rect(-164, -18, 328, 36);
        panel.stroke();

        const gauge = this.expGauge;
        gauge.clear();
        gauge.fillColor = new this.cc.Color(12, 11, 22, 255);
        gauge.rect(-148, -12, 296, 5);
        gauge.fill();
        const progress = Math.max(0, Math.min(1, current / goal));
        if (progress > 0) {
            gauge.fillColor = new this.cc.Color(73, 218, 151, 255);
            gauge.rect(-146, -11, 292 * progress, 3);
            gauge.fill();
            gauge.fillColor = new this.cc.Color(213, 255, 231, 135);
            gauge.rect(-146, -10, 292 * progress, 1);
            gauge.fill();
        }
        gauge.strokeColor = new this.cc.Color(255, 240, 215, 235);
        gauge.lineWidth = 1;
        gauge.rect(-148, -12, 296, 5);
        gauge.stroke();
    }

    /** Update the prominent, edge-anchored inventory only when its value changes. */
    setAmmo (count) {
        count = Math.max(0, Math.floor(count));
        if (count === this.ammoValue) return;
        this.ammoValue = count;

        const panel = this.ammoPanel;
        panel.clear();
        panel.fillColor = new this.cc.Color(43, 37, 64, 225);
        panel.rect(-92, -38, 184, 76);
        panel.fill();
        panel.strokeColor = count > 0
            ? new this.cc.Color(122, 92, 196, 230)
            : new this.cc.Color(195, 68, 81, 245);
        panel.lineWidth = 2;
        panel.rect(-92, -38, 184, 76);
        panel.stroke();

        this.ammoCaption.string = count > 0 ? '捕兽球' : '球已耗尽';
        this.ammoCount.string = String(count);
        const [r, g, b] = hexToRgb(count > 0 ? COL.gold : '#e85d67');
        this.ammoCount.color = new this.cc.Color(r, g, b, 255);
    }

    setBallFrame (frame) {
        this.ballSprite.spriteFrame = frame;
    }

    setDynamaxStatus (owned, remaining = 0, cooldown = 0) {
        this.dynamaxStatus.node.active = !!owned;
        if (!owned) {
            this.dynamaxStatusKey = null;
            return;
        }
        const active = remaining > 0;
        const ready = !active && cooldown <= 0;
        const label = active ? `极巨化强化中 · ${Math.ceil(remaining)} 秒`
            : ready ? '极巨手环 · G 选择宝可梦'
                : `极巨手环冷却中 · ${Math.ceil(cooldown)} 秒`;
        const color = active ? '#ff586b' : ready ? '#ffd27a' : '#c5b9cf';
        const key = `${label}|${color}`;
        if (key === this.dynamaxStatusKey) return;
        this.dynamaxStatusKey = key;
        this.dynamaxStatus.string = label;
        const [r, g, b] = hexToRgb(color);
        this.dynamaxStatus.color = new this.cc.Color(r, g, b, 255);
    }

    setZMoveStatus (owned, label = '', color = '#ffe69a') {
        this.zMoveStatus.node.active = !!owned;
        if (!owned) {
            this.zMoveStatusKey = null;
            return;
        }
        const key = `${label}|${color}`;
        if (key === this.zMoveStatusKey) return;
        this.zMoveStatusKey = key;
        this.zMoveStatus.string = label;
        const [r, g, b] = hexToRgb(color);
        this.zMoveStatus.color = new this.cc.Color(r, g, b, 255);
    }

    /** Show the selected area skill, its range and live cooldown without relying on toast text. */
    setCombatSkill (form, skill, cooldown, iconFrame = null) {
        if (!form || !skill) {
            this.skillRoot.active = false;
            this.skillSignature = null;
            this.skillCooldownKey = null;
            return;
        }
        this.skillRoot.active = true;
        this.skillSprite.node.active = !!iconFrame;
        if (iconFrame && this.skillSprite.spriteFrame !== iconFrame) this.skillSprite.spriteFrame = iconFrame;
        const signature = `${form.id}|${skill.name}|${skill.shape || ''}|${skill.radius}|${skill.width || 0}|${skill.range || 0}|${skill.duration || 0}|${skill.interval || 0}|${skill.cooldown}|${form.color}`;
        const remain = Math.max(0, cooldown || 0);
        const cooldownKey = `${signature}|${Math.ceil(remain * 10)}`;
        if (signature !== this.skillSignature) {
            this.skillSignature = signature;
            const category = form.category || (form.gigantamax ? '超极巨化' : 'MEGA');
            const chargeInterval = Number.isFinite(skill.hitInterval) ? skill.hitInterval
                : Number.isFinite(skill.interval) ? skill.interval : null;
            this.skillForm.string = `${category} · ${form.name || form.megaName}`;
            this.skillName.string = skill.name;
            this.skillRange.string = skill.shape === 'rect-beam'
                ? `矩形水炮 ${Math.round(skill.radius)}×${Math.round(skill.width)} px · ${skill.duration} 秒`
                : skill.shape === 'cake-drop'
                    ? `随机生成 · 回复 ${skill.heal} HP · ${skill.dropRadius} px 内`
                : skill.shape === 'circle-barrage'
                    ? `圆形火焰弹幕 · 半径 ${Math.round(skill.radius)} px · ${skill.duration} 秒`
                : skill.shape === 'heart'
                    ? `爱心范围 ${Math.round(skill.radius * 2)}×${Math.round(skill.radius * 2)} px`
                : skill.shape === 'directional-fireball'
                    ? `方向火球 · 飞行 ${Math.round(skill.range)} px · 半径 ${Math.round(skill.radius)} px`
                : skill.shape === 'charge-channel'
                    ? `自动冲锋 · ${skill.duration} 秒 · ${chargeInterval === null
                        ? '沿途持续伤害' : `每 ${chargeInterval.toFixed(2)} 秒一次`}`
                : skill.shape === 'healing-grove'
                    ? `青草场地 · 半径 ${Math.round(skill.radius)} px · ${skill.duration} 秒`
                : skill.shape === 'spore-field'
                    ? `孢子禁区 · 半径 ${Math.round(skill.radius)} px · 定身 ${skill.rootDuration} 秒`
                : skill.shape === 'heart-heal'
                    ? `爱心净化 · 命中回复 ${Math.round(skill.healPerHit * 100)}% · 上限 ${Math.round(skill.healCap * 100)}% HP`
                : skill.shape === 'dive-line'
                    ? `俯冲航道 ${Math.round(skill.range)}×${Math.round(skill.width)} px · 落点半径 ${Math.round(skill.radius)} px`
                : `范围半径 ${Math.round(skill.radius)} px`;
            this.skillKeyLabel.string = 'Q 切换精灵     点击释放 / X';

            const color = hexToRgb(form.color || '#70e8ff');
            const [r, g, b] = color;
            const p = this.skillPanel;
            p.clear();
            p.fillColor = new this.cc.Color(25, 22, 43, 242);
            p.rect(-158, -78, 316, 156);
            p.fill();
            p.fillColor = new this.cc.Color(r, g, b, 25);
            p.rect(-155, 51, 310, 24);
            p.fill();
            p.strokeColor = new this.cc.Color(r, g, b, 235);
            p.lineWidth = 2;
            p.rect(-158, -78, 316, 156);
            p.stroke();
            p.fillColor = new this.cc.Color(r, g, b, 220);
            p.rect(-157, -77, 4, 154);
            p.fill();

            const d = this.skillDiagram;
            d.clear();
            d.fillColor = new this.cc.Color(r, g, b, 38);
            d.strokeColor = new this.cc.Color(r, g, b, 225);
            d.lineWidth = 2.5;
            if (skill.shape === 'rect-beam') {
                d.rect(-15, -34, 30, 68);
                d.fill();
                d.rect(-15, -34, 30, 68);
                d.stroke();
                d.strokeColor = new this.cc.Color(220, 248, 255, 180);
                d.lineWidth = 1.5;
                d.moveTo(-9, -22); d.lineTo(9, -22);
                d.moveTo(-9, 0); d.lineTo(9, 0);
                d.moveTo(-9, 22); d.lineTo(9, 22);
                d.stroke();
            } else if (skill.shape === 'heart' || skill.shape === 'heart-heal') {
                traceHeart(d, 0, 0, 34, 36);
                d.fill();
                traceHeart(d, 0, 0, 34, 36);
                d.stroke();
                d.strokeColor = new this.cc.Color(255, 240, 248, 165);
                d.lineWidth = 1.5;
                traceHeart(d, 0, 0, 27, 29);
                d.stroke();
            } else if (skill.shape === 'directional-fireball') {
                d.moveTo(-38, 0); d.lineTo(30, 0);
                d.stroke();
                d.fillColor = new this.cc.Color(r, g, b, 92);
                d.circle(23, 0, 14);
                d.fill();
                d.strokeColor = new this.cc.Color(255, 242, 190, 240);
                d.lineWidth = 2;
                d.circle(23, 0, 14);
                d.stroke();
                d.fillColor = new this.cc.Color(255, 242, 190, 255);
                d.circle(23, 0, 5);
                d.fill();
            } else if (skill.shape === 'charge-channel') {
                d.moveTo(-38, 0); d.lineTo(30, 0);
                d.stroke();
                d.strokeColor = new this.cc.Color(255, 242, 190, 220);
                d.lineWidth = 1.5;
                d.moveTo(-30, -13); d.lineTo(15, -13);
                d.moveTo(-30, 13); d.lineTo(15, 13);
                d.stroke();
                d.fillColor = new this.cc.Color(r, g, b, 90);
                d.circle(23, 0, 14);
                d.fill();
                d.strokeColor = new this.cc.Color(255, 242, 190, 235);
                d.lineWidth = 2;
                d.circle(23, 0, 14);
                d.stroke();
                d.fillColor = new this.cc.Color(255, 242, 190, 255);
                d.circle(23, 0, 5);
                d.fill();
            } else if (skill.shape === 'healing-grove') {
                d.circle(0, 0, 34);
                d.fill();
                d.circle(0, 0, 34);
                d.stroke();
                d.strokeColor = new this.cc.Color(216, 255, 176, 190);
                d.lineWidth = 1.5;
                d.circle(0, 0, 26);
                d.stroke();
                for (let i = 0; i < 6; i++) {
                    const a = i * Math.PI / 3;
                    d.moveTo(Math.cos(a) * 15, Math.sin(a) * 15);
                    d.lineTo(Math.cos(a) * 28, Math.sin(a) * 28);
                }
                d.stroke();
            } else if (skill.shape === 'spore-field') {
                d.circle(0, 0, 35);
                d.fill();
                d.circle(0, 0, 35);
                d.stroke();
                d.circle(0, 0, 25);
                d.stroke();
                for (let i = 0; i < 8; i++) {
                    const a = i * Math.PI / 4;
                    d.circle(Math.cos(a) * 27, Math.sin(a) * 27, 3);
                    d.fill();
                }
            } else if (skill.shape === 'dive-line') {
                d.rect(-35, -10, 67, 20);
                d.fill();
                d.rect(-35, -10, 67, 20);
                d.stroke();
                d.circle(31, 0, 11);
                d.stroke();
                d.strokeColor = new this.cc.Color(255, 244, 206, 205);
                d.lineWidth = 1.5;
                d.moveTo(-25, -5); d.lineTo(19, -5);
                d.moveTo(-25, 5); d.lineTo(19, 5);
                d.stroke();
            } else {
                d.circle(0, 0, 37);
                d.fill();
                d.circle(0, 0, 37);
                d.stroke();
                d.strokeColor = new this.cc.Color(220, 231, 255, 115);
                d.lineWidth = 1;
                d.moveTo(-31, 0); d.lineTo(31, 0);
                d.moveTo(0, -31); d.lineTo(0, 31);
                d.stroke();
            }
            d.fillColor = new this.cc.Color(255, 238, 177, 255);
            d.circle(0, 0, 5);
            d.fill();
            d.fillColor = new this.cc.Color(r, g, b, 255);
            d.circle(25, 20, 4);
            d.fill();

            const k = this.skillKeys;
            k.clear();
            k.fillColor = new this.cc.Color(r, g, b, 34);
            k.rect(-148, -11, 296, 22);
            k.fill();
            k.strokeColor = new this.cc.Color(r, g, b, 110);
            k.lineWidth = 1;
            k.rect(-148, -11, 296, 22);
            k.stroke();
        }
        if (cooldownKey !== this.skillCooldownKey) {
            this.skillCooldownKey = cooldownKey;
            const ready = remain <= 0;
            this.skillStatus.string = ready ? '就绪 · 可以释放' : `充能中 · ${remain.toFixed(1)} 秒`;
            const [cr, cg, cb] = hexToRgb(ready ? '#57e6a2' : '#ffbd62');
            this.skillStatus.color = new this.cc.Color(cr, cg, cb, 255);
            const gauge = this.skillCooldownGauge;
            gauge.clear();
            gauge.fillColor = new this.cc.Color(12, 11, 22, 255);
            // Keep the bar centered inside the card: its old 12..190 span poked past the card's
            // right edge (-158..158), and sat directly against the Q/X hint strip.
            gauge.rect(-140, -42, 280, 8);
            gauge.fill();
            const progress = ready ? 1 : Math.max(0, Math.min(1, 1 - remain / Math.max(0.1, skill.cooldown)));
            if (progress > 0) {
                gauge.fillColor = new this.cc.Color(cr, cg, cb, 255);
                gauge.rect(-138, -40, 276 * progress, 4);
                gauge.fill();
            }
        }
    }

    /** The skill hint strip is also a real mouse/touch button, as a fallback for IME key capture. */
    hitCombatSkillButton (viewX, viewY) {
        if (!this.skillRoot.active) return false;
        const centerX = VIEW.W / 2 - 190;
        const centerY = -VIEW.H / 2 + 270;
        const localX = viewX - centerX;
        const localY = viewY - centerY;
        return localX >= -148 && localX <= 148 && localY >= -73 && localY <= -45;
    }

    /** Keep the player's life readable at all times, with redraws only when the displayed HP changes. */
    setHealth (hp, maxHp) {
        maxHp = Math.max(1, Math.ceil(maxHp));
        const current = Math.max(0, Math.min(maxHp, Math.ceil(hp)));
        if (current === this.healthValue && maxHp === this.healthMaxValue) return;
        this.healthValue = current;
        this.healthMaxValue = maxHp;
        const p = current / maxHp;
        this.healthText.string = `${current} / ${maxHp}`;

        const panel = this.healthPanel;
        panel.clear();
        panel.fillColor = new this.cc.Color(28, 20, 38, 244);
        panel.rect(-130, -38, 260, 76);
        panel.fill();
        panel.strokeColor = new this.cc.Color(255, 206, 116, 230);
        panel.lineWidth = 2;
        panel.rect(-130, -38, 260, 76);
        panel.stroke();

        const g = this.healthGauge;
        g.clear();
        g.fillColor = new this.cc.Color(16, 13, 24, 255);
        g.rect(-116, -10, 232, 20);
        g.fill();
        if (p > 0) {
            const color = p <= 0.25
                ? new this.cc.Color(255, 57, 65, 255)
                : p <= 0.5 ? new this.cc.Color(255, 177, 54, 255) : new this.cc.Color(63, 213, 120, 255);
            g.fillColor = color;
            g.rect(-112, -7, 224 * p, 14);
            g.fill();
            g.fillColor = new this.cc.Color(255, 255, 255, 135);
            g.rect(-112, 2, 224 * p, 3);
            g.fill();
        }
        g.strokeColor = new this.cc.Color(255, 242, 220, 255);
        g.lineWidth = 2;
        g.rect(-116, -10, 232, 20);
        g.stroke();
    }

    setBossProgress (kills, threshold, bossNumber, inBattle = false) {
        if (inBattle !== this.bossProgressBattle) {
            this.bossProgressBattle = inBattle;
            this.bossProgressRoot.active = !inBattle;
        }
        if (inBattle) return;
        const key = `${kills}|${threshold}|${bossNumber}`;
        if (key === this.bossProgressKey) return;
        this.bossProgressKey = key;
        this.bossProgress.string = `野生击败 ${kills.toLocaleString('zh-CN')} / ${threshold.toLocaleString('zh-CN')} · 第 ${bossNumber} 场 BOSS`;
    }

    setBoss (name, hp, maxHp, detail = 'BOSS · 不可捕捉', segments = 1) {
        const show = maxHp > 0;
        this.bossRoot.active = show;
        if (!show) return;
        const p = Math.max(0, Math.min(1, hp / maxHp));
        this.bossTitle.string = `${name} · ${detail}`;
        this.bossHp.string = `${Math.ceil(hp).toLocaleString('zh-CN')} / ${Math.ceil(maxHp).toLocaleString('zh-CN')} HP · ${Math.round(p * 100)}%`;
        const g = this.bossGauge;
        g.clear();
        g.fillColor = new this.cc.Color(16, 13, 24, 255);
        g.rect(-302, -15, 604, 30);
        g.fill();
        if (p > 0) {
            const low = p <= 0.25;
            g.fillColor = low ? new this.cc.Color(255, 52, 60, 255) : new this.cc.Color(245, 67, 74, 255);
            g.rect(-298, -11, 596 * p, 22);
            g.fill();
            g.fillColor = new this.cc.Color(255, 184, 139, 230);
            g.rect(-298, 4, 596 * p, 5);
            g.fill();
        }
        g.strokeColor = new this.cc.Color(255, 226, 168, 255);
        g.lineWidth = 3;
        g.rect(-302, -15, 604, 30);
        g.stroke();
        if (segments > 1) {
            g.strokeColor = new this.cc.Color(255, 237, 204, 235);
            g.lineWidth = 3;
            for (let i = 1; i < segments; i++) {
                const x = -298 + 596 * i / segments;
                g.moveTo(x, -11);
                g.lineTo(x, 11);
            }
            g.stroke();
        }
    }
}
