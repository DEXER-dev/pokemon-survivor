/* Adventure HUD: compact edge panels with cached readouts. */
import { HUD, color, card, gauge } from './hud-theme.js';
import { VIEW, COL } from './config.js';
import { hexToRgb } from './batch.js';
import { legendaryGuideLayout } from './lair-guide-layout.js';
import { drawLegendaryGuideIcon, legendaryGuideStyle } from './legendary-guide-icons.js';
import { traceHeart } from './heart-shape.js';
import { iconKey, shinyKey } from './species.js';
import { megaFormForSegment } from './mega.js';
import { gigantamaxFormForSegment } from './gigantamax.js';
import { GAME_FONT } from './ui-font.js';

const PARTY_ICON_LIMIT = 16;
const PARTY_ICON_STEP = 40;
const PARTY_COLUMNS = 8;

export function makeLabel (cc, parent, name, y, size, hex, align, x = 0, width = VIEW.W - 36) {
    const node = new cc.Node(name);
    node.layer = cc.Layers.Enum.UI_2D;
    node.setPosition(x, y, 0);
    parent.addChild(node);
    const l = node.addComponent(cc.Label);
    l.fontFamily = GAME_FONT;
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
        this.toast = makeLabel(cc, root, 'Toast', VIEW.H / 2 - 132, 14, HUD.ink,
            'center', 0, 430);
        this.chain = makeLabel(cc, root, 'Chain', VIEW.H / 2 - 30, 20, COL.accent, 'right');
        // The old full-width performance/party strings competed with one another at the top edge.
        // Keep the useful level readout below, and use the top line for the actual party sprites.
        this.stat.node.active = false;
        this.chain.node.active = false;
        this.partyRoot = new cc.Node('PartyRoster');
        this.partyRoot.layer = cc.Layers.Enum.UI_2D;
        this.partyRoot.setPosition(-VIEW.W / 2 + 186, VIEW.H / 2 - 64, 0);
        this.partyExpanded = false;
        this.partyPage = 0;
        this.partyVisibleRows = 1;
        root.addChild(this.partyRoot);
        this.partyPanel = this.partyRoot.addComponent(cc.Graphics);
        this.partySummary = makeLabel(cc, this.partyRoot, 'PartySummary', 20, 13,
            HUD.ink, 'left', 0, 300);
        this.partySummary.overflow = cc.Label.Overflow.SHRINK;
        this.partyOverflow = makeLabel(cc, this.partyRoot, 'PartyOverflow', 0, 12,
            HUD.muted, 'right', 108, 90);
        this.partyOverflow.node.active = false;
        this.partyPager = makeLabel(cc, this.partyRoot, 'PartyPager', -86, 12,
            HUD.ink, 'center', 0, 290);
        this.partyPager.node.active = false;
        this.partyCells = [];
        this.partySignature = null;
        this.partySummaryKey = null;
        const partyStartX = -140;
        for (let i = 0; i < PARTY_ICON_LIMIT; i++) {
            const cell = new cc.Node(`PartyPokemon${i}`);
            cell.layer = cc.Layers.Enum.UI_2D;
            cell.setPosition(partyStartX + (i % PARTY_COLUMNS) * PARTY_ICON_STEP, -15 - Math.floor(i / PARTY_COLUMNS) * 36, 0);
            this.partyRoot.addChild(cell);
            const frame = cell.addComponent(cc.Graphics);
            const spriteNode = new cc.Node('Icon');
            spriteNode.layer = cc.Layers.Enum.UI_2D;
            cell.addChild(spriteNode);
            const sprite = spriteNode.addComponent(cc.Sprite);
            sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            spriteNode.getComponent(cc.UITransform).setContentSize(30, 30);
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
        this.expRoot.setPosition(0, VIEW.H / 2 - 44, 0);
        root.addChild(this.expRoot);
        this.expPanel = this.expRoot.addComponent(cc.Graphics);
        this.expLabel = makeLabel(cc, this.expRoot, 'ExperienceLabel', 8, 13,
            HUD.ink, 'center', 0, 248);
        const expGaugeNode = new cc.Node('ExperienceGauge');
        expGaugeNode.layer = cc.Layers.Enum.UI_2D;
        this.expRoot.addChild(expGaugeNode);
        this.expGauge = expGaugeNode.addComponent(cc.Graphics);
        this.expKey = null;
        this.hint = makeLabel(cc, root, 'Hint', -VIEW.H / 2 + 23, 12, HUD.ink, 'center');
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
        this.ammoRoot.setPosition(VIEW.W / 2 - 142, -VIEW.H / 2 + 86, 0);
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
        this.ammoCaption = makeLabel(cc, this.ammoRoot, 'AmmoCaption', 20, 13, HUD.muted, 'center', 18, 76);
        this.ammoCount = makeLabel(cc, this.ammoRoot, 'AmmoCount', -5, 28, HUD.ink, 'center', 18, 76);
        this.ammoKey = makeLabel(cc, this.ammoRoot, 'ThrowKey', -30, 10, HUD.muted, 'center', 0, 160);
        this.ammoKey.string = 'SPACE / 点击 · 投球';
        this.ammoValue = null;
        this.setAmmo(5);
        this.healthRoot = new cc.Node('PlayerHealth');
        this.healthRoot.layer = cc.Layers.Enum.UI_2D;
        this.healthRoot.setPosition(-VIEW.W / 2 + 158, -VIEW.H / 2 + 86, 0);
        root.addChild(this.healthRoot);
        this.healthPanel = this.healthRoot.addComponent(cc.Graphics);
        this.healthValue = null;
        this.healthMaxValue = null;
        this.healthTag = makeLabel(cc, this.healthRoot, 'HealthTag', 19, 13, HUD.ink, 'left', -20, 90);
        this.healthText = makeLabel(cc, this.healthRoot, 'HealthValue', 19, 12, HUD.muted, 'right', 74, 88);
        this.healthTag.string = '训练师';
        this.healthTag.overflow = cc.Label.Overflow.SHRINK;
        const portraitNode = new cc.Node('TrainerPortrait');
        portraitNode.layer = cc.Layers.Enum.UI_2D;
        portraitNode.setPosition(-98, 9, 0);
        this.healthRoot.addChild(portraitNode);
        this.trainerSprite = portraitNode.addComponent(cc.Sprite);
        this.trainerSprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        portraitNode.getComponent(cc.UITransform).setContentSize(48, 48);
        this.healthCaption = makeLabel(cc, this.healthRoot, 'HealthCaption', -29, 10, HUD.muted, 'left', 0, 228);
        this.healthCaption.string = 'HP · 冒险进行中';
        const healthGaugeNode = new cc.Node('HealthGauge');
        healthGaugeNode.layer = cc.Layers.Enum.UI_2D;
        healthGaugeNode.setPosition(26, -8, 0);
        this.healthRoot.addChild(healthGaugeNode);
        this.healthGauge = healthGaugeNode.addComponent(cc.Graphics);
        this.bossProgressRoot = new cc.Node('BossProgress');
        this.bossProgressRoot.layer = cc.Layers.Enum.UI_2D;
        this.bossProgressRoot.setPosition(0, -VIEW.H / 2 + 84, 0);
        root.addChild(this.bossProgressRoot);
        this.progressPanel = this.bossProgressRoot.addComponent(cc.Graphics);
        card(this.progressPanel, cc, -180, -37, 360, 74, '#f5cb65');
        this.bossProgress = makeLabel(cc, this.bossProgressRoot, 'BossProgressText', 12, 13,
            HUD.ink, 'left', -48, 228);
        this.bossBadge = makeLabel(cc, this.bossProgressRoot, 'BossBadge', 12, 11,
            '#a05037', 'right', 113, 106);
        const progressGauge = new cc.Node('AdventureGauge');
        progressGauge.layer = cc.Layers.Enum.UI_2D;
        this.bossProgressRoot.addChild(progressGauge);
        this.progressGauge = progressGauge.addComponent(cc.Graphics);
        this.progressCaption = makeLabel(cc, this.bossProgressRoot, 'AdventureCaption', -26, 9,
            HUD.muted, 'center', 0, 320);
        this.progressCaption.string = '收服伙伴 · 向下一场挑战前进';
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
        card(bossPanel, cc, -260, -56, 520, 112, HUD.red);
        this.bossTitle = makeLabel(cc, this.bossRoot, 'BossTitle', 246, 17, HUD.ink, 'center', 0, 490);
        this.bossTitle.overflow = cc.Label.Overflow.SHRINK;
        this.bossHp = makeLabel(cc, this.bossRoot, 'BossHP', 216, 13, HUD.muted, 'center', 0, 480);
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
            HUD.muted, 'left', 12, 184);
        this.skillName = makeLabel(cc, this.skillRoot, 'SkillName', 36, 19,
            HUD.ink, 'left', 12, 184);
        this.skillRange = makeLabel(cc, this.skillRoot, 'SkillRange', 8, 14,
            HUD.muted, 'left', 12, 184);
        this.skillStatus = makeLabel(cc, this.skillRoot, 'SkillStatus', -20, 14,
            '#72f0b0', 'left', 12, 184);
        const keyNode = new cc.Node('SkillKeyHint');
        keyNode.layer = cc.Layers.Enum.UI_2D;
        keyNode.setPosition(0, -59, 0);
        this.skillRoot.addChild(keyNode);
        this.skillKeys = keyNode.addComponent(cc.Graphics);
        this.skillKeyLabel = makeLabel(cc, keyNode, 'SkillKeyLabel', 0, 12,
            HUD.ink, 'center', 0, 280);
        this.skillSignature = null;
        this.skillCooldownKey = null;
        this.skillRoot.active = false;
        this.root = root;
        this.setViewport(cc.view?.getVisibleSize?.().width || VIEW.W);
    }

    setViewport(width) {
        const scale = Math.min(1, width / VIEW.W);
        const place = (node, x, y) => { node.setPosition(x, y, 0); node.setScale(scale, scale, 1); };
        const left = -width / 2 + 20;
        const right = width / 2 - 20;
        place(this.partyRoot, left + 166 * scale, VIEW.H / 2 - 20 - 46 * scale);
        place(this.expRoot, 0, VIEW.H / 2 - 20 - 27 * scale);
        place(this.healthRoot, left + 130 * scale, -VIEW.H / 2 + 42 + 44 * scale);
        place(this.ammoRoot, right - 104 * scale, -VIEW.H / 2 + 42 + 44 * scale);
        place(this.bossProgressRoot, 0, -VIEW.H / 2 + 42 + 37 * scale);
        place(this.skillRoot, right - 158 * scale, -VIEW.H / 2 + 150 + 78 * scale);
        this.bossRoot.setScale(scale, scale, 1);
        this.hint.overflow = this.cc.Label.Overflow.SHRINK;
        this.hint.node.getComponent(this.cc.UITransform).setContentSize(width - 40, 24);
        this.hudScale = scale;
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
        this.partyPageCount = Math.max(1, Math.ceil(segments.length / PARTY_ICON_LIMIT));
        this.partyPage = Math.min(this.partyPage, this.partyPageCount - 1);
        let shinyCount = 0;
        let normalCount = 0;
        let legendaryCount = 0;
        for (const segment of segments) {
            if (segment.shiny) shinyCount++;
            if (typeof segment.fam === 'string' && segment.fam.startsWith('legend-')) legendaryCount++;
            else if (!segment.shiny) normalCount++;
        }
        const summaryKey = `${normalCount}|${legendaryCount}|${cap}|${petTotal}|${shinyCount}|${this.partyExpanded}`;
        if (summaryKey !== this.partySummaryKey) {
            this.partySummaryKey = summaryKey;
            const legendaryLabel = legendaryCount ? ` · 传说 ${legendaryCount}` : '';
            this.partySummary.string = `队伍 ${normalCount}/${cap}${legendaryLabel} · ${petTotal}只 · ✨${shinyCount}`;
        }

        const signature = segments.map((segment) =>
            `${segment.fam}:${segment.tier}:${segment.count}:${segment.shiny ? 1 : 0}:${segment.mega || ''}:${segment.gigantamax || ''}`
        ).join('|') + `|${this.partyExpanded}|${cap}|${this.partyPage}`;
        if (signature !== this.partySignature) {
            this.partySignature = signature;
            const rows = this.partyExpanded ? 2 : 1;
            this.partyVisibleRows = Math.max(1, rows);
            const extra = (this.partyVisibleRows - 1) * 36;
            card(this.partyPanel, this.cc, -166, -38 - extra - (this.partyExpanded ? 30 : 0),
                332, 84 + extra + (this.partyExpanded ? 30 : 0), HUD.green);
            for (let i = 0; i < PARTY_COLUMNS; i++) {
                this.partyPanel.fillColor = color(this.cc, '#e6eadb');
                this.partyPanel.circle(-140 + i * PARTY_ICON_STEP, -15, 13);
                this.partyPanel.fill();
            }
        }

        const offset = this.partyExpanded ? this.partyPage * PARTY_ICON_LIMIT : 0;
        const visible = Math.min(segments.length - offset, this.partyExpanded ? PARTY_ICON_LIMIT : PARTY_COLUMNS);
        this.partyPager.node.active = this.partyExpanded;
        this.partyPager.string = `‹ 上一页     ${this.partyPage + 1} / ${this.partyPageCount}     下一页 ›`;
        for (let i = 0; i < this.partyCells.length; i++) {
            const cell = this.partyCells[i];
            const segment = i < visible ? segments[offset + i] : null;
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
                        : color(this.cc, HUD.green);
                const g = cell.frame;
                g.clear();
                g.fillColor = color(this.cc, '#edf3df');
                g.roundRect(-16, -16, 32, 32, 8);
                g.fill();
                g.strokeColor = border;
                g.lineWidth = segment.shiny ? 2 : 1;
                g.roundRect(-16, -16, 32, 32, 8);
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
        const overflow = Math.max(0, segments.length - PARTY_COLUMNS);
        this.partyOverflow.node.active = true;
        if (this.partyOverflow.node.active) {
            this.partyOverflow.node.setPosition(112, 36, 0);
            this.partyOverflow.string = this.partyExpanded ? '收起 ▴' : overflow > 0 ? `+${overflow} 展开 ▾` : '展开 ▾';
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

        card(this.expPanel, this.cc, -138, -27, 276, 54, HUD.blue);
        gauge(this.expGauge, this.cc, -121, -15, 242, 9, current / goal, HUD.blue);
    }

    /** Update the prominent, edge-anchored inventory only when its value changes. */
    setAmmo (count) {
        count = Math.max(0, Math.floor(count));
        if (count === this.ammoValue) return;
        this.ammoValue = count;

        card(this.ammoPanel, this.cc, -104, -44, 208, 88, count > 0 ? HUD.red : '#e39765');
        this.ammoCaption.string = count > 0 ? '精灵球' : '精灵球已耗尽';
        this.ammoCount.string = `×${count}`;
        this.ammoCount.color = color(this.cc, count > 0 ? HUD.ink : HUD.red);
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
            card(p, this.cc, -158, -78, 316, 156, form.color || HUD.blue);

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
            const [cr, cg, cb] = hexToRgb(ready ? '#328361' : '#a56b29');
            this.skillStatus.color = new this.cc.Color(cr, cg, cb, 255);
            const progress = ready ? 1 : Math.max(0, Math.min(1, 1 - remain / Math.max(0.1, skill.cooldown)));
            gauge(this.skillCooldownGauge, this.cc, -140, -42, 280, 8, progress, ready ? HUD.green : '#f5cb65');
        }
    }

    /** The skill hint strip is also a real mouse/touch button, as a fallback for IME key capture. */
    hitCombatSkillButton (viewX, viewY) {
        if (!this.skillRoot.active) return false;
        const localX = (viewX - this.skillRoot.position.x) / this.hudScale;
        const localY = (viewY - this.skillRoot.position.y) / this.hudScale;
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

        card(this.healthPanel, this.cc, -130, -44, 260, 88, HUD.green);
        this.healthPanel.fillColor = color(this.cc, '#e7edda');
        this.healthPanel.circle(-98, 9, 24); this.healthPanel.fill();
        gauge(this.healthGauge, this.cc, -86, -6, 174, 12, p,
            p <= 0.25 ? HUD.red : p <= 0.5 ? '#f5cb65' : HUD.green);
        this.healthCaption.string = p <= 0.25 ? 'HP · 小心！体力不足' : 'HP · 冒险进行中';
    }

    setTrainer(name, frame) {
        this.healthTag.string = name || '训练师';
        this.trainerSprite.node.active = !!frame;
        if (frame && this.trainerSprite.spriteFrame !== frame) this.trainerSprite.spriteFrame = frame;
    }

    hitPartyButton(viewX, viewY) {
        const x = (viewX - this.partyRoot.position.x) / this.hudScale;
        const y = (viewY - this.partyRoot.position.y) / this.hudScale;
        const bottom = this.partyExpanded ? -104 : -38;
        if (!this.partyRoot.active || x < -166 || x > 166 || y > 46 || y < bottom) return false;
        if (this.partyExpanded && y < -70) {
            if (x < -35) this.partyPage = Math.max(0, this.partyPage - 1);
            else if (x > 35) this.partyPage = Math.min(this.partyPageCount - 1, this.partyPage + 1);
            return true;
        }
        if (this.partyExpanded && y < 8) return true;
        this.partyExpanded = !this.partyExpanded;
        return true;
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
        this.bossProgress.string = `野生击败 ${kills.toLocaleString('zh-CN')} / ${threshold.toLocaleString('zh-CN')}`;
        this.bossBadge.string = `BOSS · 第 ${bossNumber} 场`;
        gauge(this.progressGauge, this.cc, -160, -9, 320, 8, kills / Math.max(1, threshold), '#f5cb65');
    }

    setBoss (name, hp, maxHp, detail = 'BOSS · 不可捕捉', segments = 1) {
        const show = maxHp > 0;
        this.bossRoot.active = show;
        if (!show) return;
        const p = Math.max(0, Math.min(1, hp / maxHp));
        this.bossTitle.string = `${name} · ${detail}`;
        this.bossHp.string = `${Math.ceil(hp).toLocaleString('zh-CN')} / ${Math.ceil(maxHp).toLocaleString('zh-CN')} HP · ${Math.round(p * 100)}%`;
        const g = this.bossGauge;
        gauge(g, this.cc, -240, -8, 480, 16, p, HUD.red);
        if (segments > 1) {
            g.strokeColor = new this.cc.Color(255, 237, 204, 235);
            g.lineWidth = 3;
            for (let i = 1; i < segments; i++) {
                const x = -238 + 476 * i / segments;
                g.moveTo(x, -6);
                g.lineTo(x, 6);
            }
            g.stroke();
        }
    }
}
