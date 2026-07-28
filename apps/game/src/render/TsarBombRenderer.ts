import Phaser from "phaser";
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, TICKS } from "../config/gameConfig";
import type { SimulationState, TsarPhase } from "../simulation/types";
import type { EffectLayer } from "./EffectLayer";
import { PALETTE, toCss } from "./palette";
import { TEXTURE_KEYS } from "./textures";

/**
 * The premium spectacle.
 *
 * Viewer-facing name is always exactly `ZAR-BOMBE`; the internal command stays
 * `tsar_bomb`. The sequence is stylized science fiction — a reactor payload,
 * an energy shockwave and a rebuild phase. There is no war imagery, no blood
 * and no casualties: workers are scattered and the tower is rebuilt.
 */
export class TsarBombRenderer {
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly vignette: Phaser.GameObjects.Rectangle;
  private readonly alarmBar: Phaser.GameObjects.Rectangle;
  private readonly title: Phaser.GameObjects.Text;
  private readonly sender: Phaser.GameObjects.Text;
  private readonly countdown: Phaser.GameObjects.Text;
  private readonly rebuildBanner: Phaser.GameObjects.Container;
  private readonly rebuildText: Phaser.GameObjects.Text;
  private readonly rebuildBar: Phaser.GameObjects.Rectangle;
  private readonly bomb: Phaser.GameObjects.Container;
  private readonly bombGlow: Phaser.GameObjects.Image;
  private readonly flash: Phaser.GameObjects.Rectangle;
  private readonly shockwave: Phaser.GameObjects.Arc;
  private lastPhase: TsarPhase = "idle";
  private lastCountdown = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly effects: EffectLayer,
  ) {
    this.overlay = scene.add.graphics().setDepth(60).setVisible(false);

    this.vignette = scene.add
      .rectangle(360, 640, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0x1a0009, 1)
      .setDepth(59)
      .setAlpha(0);

    this.alarmBar = scene.add
      .rectangle(360, 640, LOGICAL_WIDTH, LOGICAL_HEIGHT, PALETTE.catastrophe, 1)
      .setDepth(58)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.title = scene.add
      .text(360, 470, "ZAR-BOMBE", {
        fontFamily: "Inter, Arial Black, sans-serif",
        fontStyle: "bold",
        fontSize: "72px",
        color: "#ffffff",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(70)
      .setVisible(false);
    this.title.setShadow(0, 0, toCss(PALETTE.catastrophe), 28, true, true);

    this.sender = scene.add
      .text(360, 540, "", {
        fontFamily: "Inter, Arial, sans-serif",
        fontStyle: "bold",
        fontSize: "26px",
        color: toCss(PALETTE.warn),
        align: "center",
        wordWrap: { width: 620 },
      })
      .setOrigin(0.5)
      .setDepth(70)
      .setVisible(false);

    this.countdown = scene.add
      .text(360, 660, "", {
        fontFamily: "Inter, Arial Black, sans-serif",
        fontStyle: "bold",
        fontSize: "120px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(70)
      .setVisible(false);

    // Stylized payload silhouette: a reactor core, not a weapon replica.
    this.bombGlow = scene.add
      .image(0, 0, TEXTURE_KEYS.glow)
      .setDisplaySize(260, 260)
      .setTint(PALETTE.catastrophe)
      .setAlpha(0.5);
    this.bombGlow.setBlendMode(Phaser.BlendModes.ADD);
    const shell = scene.add.graphics();
    shell.fillStyle(0x121820, 1);
    shell.fillEllipse(0, 0, 72, 118);
    shell.fillStyle(0x1e2a36, 1);
    shell.fillEllipse(0, -14, 62, 70);
    shell.fillStyle(PALETTE.catastrophe, 0.95);
    shell.fillCircle(0, 6, 15);
    shell.lineStyle(3, PALETTE.catastrophe, 0.7);
    shell.strokeEllipse(0, 0, 72, 118);
    // Stabiliser fins.
    shell.fillStyle(0x1e2a36, 1);
    shell.fillTriangle(-24, 44, -52, 76, -18, 66);
    shell.fillTriangle(24, 44, 52, 76, 18, 66);
    this.bomb = scene.add
      .container(360, -160, [this.bombGlow, shell])
      .setDepth(66)
      .setVisible(false);

    this.flash = scene.add
      .rectangle(360, 640, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0xffffff, 1)
      .setDepth(72)
      .setAlpha(0);

    this.shockwave = scene.add
      .circle(360, 780, 40)
      .setStrokeStyle(14, PALETTE.catastrophe, 0.9)
      .setDepth(67)
      .setVisible(false);
    this.shockwave.setBlendMode(Phaser.BlendModes.ADD);

    const bannerPlate = scene.add
      .rectangle(0, 0, 520, 96, 0x05131a, 0.94)
      .setStrokeStyle(3, PALETTE.support, 0.9);
    this.rebuildText = scene.add
      .text(0, -18, "TEAM REBUILD", {
        fontFamily: "Inter, Arial Black, sans-serif",
        fontStyle: "bold",
        fontSize: "40px",
        color: toCss(PALETTE.support),
      })
      .setOrigin(0.5);
    const barBack = scene.add.rectangle(0, 26, 440, 12, 0x0e2a34, 1);
    this.rebuildBar = scene.add
      .rectangle(-220, 26, 440, 12, PALETTE.support, 1)
      .setOrigin(0, 0.5);
    this.rebuildBanner = scene.add
      .container(360, 300, [bannerPlate, this.rebuildText, barBack, this.rebuildBar])
      .setDepth(68)
      .setVisible(false);
  }

  update(state: SimulationState): void {
    const bomb = state.tsarBomb;
    const reduced = state.reducedMotion;
    const phaseChanged = bomb.phase !== this.lastPhase;

    this.overlay.clear();
    this.overlay.setVisible(false);

    switch (bomb.phase) {
      case "warning":
        this.renderWarning(state, reduced);
        break;
      case "descending":
        this.renderDescent(state, reduced);
        break;
      case "impact":
        this.renderImpact(state, reduced, phaseChanged);
        break;
      case "recovery":
        this.renderRecovery(state);
        break;
      default:
        this.hideAll();
        break;
    }

    if (phaseChanged) this.lastPhase = bomb.phase;
  }

  private renderWarning(state: SimulationState, reduced: boolean): void {
    const bomb = state.tsarBomb;
    const elapsed = state.tick - bomb.startedTick;
    const seconds = Math.max(
      1,
      Math.ceil((TICKS.tsarWarning - elapsed) / TICKS.second),
    );

    // Pulsing red alarm wash; much calmer under reduced motion.
    const pulse = reduced ? 0.1 : 0.18 + Math.abs(Math.sin(elapsed * 0.22)) * 0.2;
    this.alarmBar.setAlpha(pulse);
    this.vignette.setAlpha(0.55);

    this.title.setVisible(true).setAlpha(1).setScale(1);
    this.sender.setVisible(true);
    this.sender.setText(
      `${senderName(state)} HAT DIE ZAR-BOMBE AKTIVIERT`,
    );
    this.countdown.setVisible(true).setText(String(seconds));
    if (seconds !== this.lastCountdown) {
      this.lastCountdown = seconds;
      if (!reduced) {
        this.scene.tweens.add({
          targets: this.countdown,
          scale: { from: 1.45, to: 1 },
          duration: 260,
          ease: "Cubic.easeOut",
        });
      }
    }
    this.bomb.setVisible(false);
    this.shockwave.setVisible(false);
    this.rebuildBanner.setVisible(false);
    this.flash.setAlpha(0);
  }

  private renderDescent(state: SimulationState, reduced: boolean): void {
    const bomb = state.tsarBomb;
    const start = bomb.startedTick + TICKS.tsarWarning;
    const progress = Phaser.Math.Clamp(
      (state.tick - start) / Math.max(1, TICKS.tsarDescent),
      0,
      1,
    );

    this.vignette.setAlpha(0.6);
    this.alarmBar.setAlpha(reduced ? 0.08 : 0.12);
    this.title.setVisible(true);
    this.title.setPosition(360, 210);
    this.title.setFontSize(46);
    this.sender.setVisible(true).setPosition(360, 262).setFontSize(20);
    this.countdown.setVisible(false);

    this.bomb.setVisible(true);
    this.bomb.setPosition(360, -120 + progress * 900);
    this.bomb.setScale(0.7 + progress * 0.5);
    this.bombGlow.setAlpha(0.35 + progress * 0.5);
    if (!reduced) this.bomb.rotation = Math.sin(state.tick * 0.3) * 0.05;

    // Trailing sparks along the descent.
    if (state.tick % 2 === 0) {
      this.effects.burstSparks(360, this.bomb.y - 60, 3);
    }
  }

  private renderImpact(
    state: SimulationState,
    reduced: boolean,
    phaseChanged: boolean,
  ): void {
    this.title.setVisible(false);
    this.sender.setVisible(false);
    this.countdown.setVisible(false);
    this.bomb.setVisible(false);
    this.vignette.setAlpha(0.35);
    this.alarmBar.setAlpha(0);

    if (phaseChanged) {
      this.flash.setAlpha(reduced ? 0.28 : 0.95);
      this.scene.tweens.add({
        targets: this.flash,
        alpha: 0,
        duration: reduced ? 420 : 900,
        ease: "Quad.easeOut",
      });

      this.shockwave.setVisible(true);
      this.shockwave.setScale(0.1);
      this.shockwave.setAlpha(0.95);
      this.scene.tweens.add({
        targets: this.shockwave,
        scale: reduced ? 6 : 11,
        alpha: 0,
        duration: reduced ? 700 : 1100,
        ease: "Cubic.easeOut",
        onComplete: () => this.shockwave.setVisible(false),
      });

      if (!reduced) {
        this.scene.cameras.main.shake(700, 0.014);
        this.scene.cameras.main.flash(220, 255, 170, 190);
      } else {
        this.scene.cameras.main.shake(180, 0.002);
      }

      // Stylized energy cloud: rings of smoke plus debris, no fireball realism.
      for (let index = 0; index < 5; index += 1) {
        const y = 820 - index * 60;
        this.effects.burstSmoke(360, y, 7);
      }
      this.effects.burstDebris(360, 800, 30);
      this.effects.burstSparks(360, 790, 40);
    }

    // Persistent bloom while the impact tick is on screen.
    this.overlay.setVisible(true);
    this.overlay.fillStyle(PALETTE.catastrophe, reduced ? 0.1 : 0.2);
    this.overlay.fillCircle(360, 800, 300);
    this.overlay.fillStyle(0xffd6a0, reduced ? 0.08 : 0.16);
    this.overlay.fillEllipse(360, 700, 420, 200);
  }

  private renderRecovery(state: SimulationState): void {
    const bomb = state.tsarBomb;
    this.hideSequence();
    this.vignette.setAlpha(0.12);

    const total = Math.max(1, TICKS.rebuild);
    const remaining = Math.max(0, bomb.recoveryUntilTick - state.tick);
    const progress = 1 - remaining / total;
    this.rebuildBanner.setVisible(true);
    this.rebuildBar.setScale(Phaser.Math.Clamp(progress, 0, 1), 1);
    this.rebuildText.setText(
      `TEAM REBUILD  ·  ${Math.ceil(remaining / TICKS.second)}s  ·  REPARATUR ×${state.recoveryMultiplier}`,
    );
    this.rebuildText.setFontSize(28);

    if (state.tick % 6 === 0 && !state.reducedMotion) {
      this.effects.burstRepair(
        180 + Math.random() * 360,
        520 + Math.random() * 480,
        4,
      );
    }
  }

  private hideSequence(): void {
    this.title.setVisible(false);
    this.sender.setVisible(false);
    this.countdown.setVisible(false);
    this.bomb.setVisible(false);
    this.alarmBar.setAlpha(0);
    this.flash.setAlpha(0);
  }

  private hideAll(): void {
    this.hideSequence();
    this.rebuildBanner.setVisible(false);
    this.shockwave.setVisible(false);
    this.vignette.setAlpha(0);
    this.lastCountdown = -1;
    // Restore layout defaults for the next activation.
    this.title.setPosition(360, 470).setFontSize(72);
    this.sender.setPosition(360, 540).setFontSize(26);
  }
}

function senderName(state: SimulationState): string {
  const actor = state.tsarBomb.actor;
  if (!actor) return "UNBEKANNT";
  return (actor.displayName ?? actor.username).toUpperCase();
}
