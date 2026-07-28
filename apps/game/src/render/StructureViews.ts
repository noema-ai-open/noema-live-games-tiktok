import Phaser from "phaser";
import type { SimulationState } from "../simulation/types";
import { PALETTE, toCss } from "./palette";
import { TEXTURE_KEYS } from "./textures";

const BRIDGE_X = 236;
const BRIDGE_Y = 862;
const BRIDGE_SEGMENTS = 6;
const BRIDGE_SEGMENT_WIDTH = 32;

/**
 * All gift-built structures. Each one shows its own build-up, its online state
 * and its damage, so a viewer can tell what their gift actually did.
 */
export class StructureViews {
  private readonly bridgeSegments: Phaser.GameObjects.Rectangle[] = [];
  private readonly bridgeSparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly bridgeLabel: Phaser.GameObjects.Text;
  private bridgeProgress = 0;

  private readonly jumpPad: Phaser.GameObjects.Rectangle;
  private readonly jumpGlow: Phaser.GameObjects.Image;
  private readonly jumpParticles: Phaser.GameObjects.Particles.ParticleEmitter;

  private readonly liftShaft: Phaser.GameObjects.Rectangle;
  private readonly liftCar: Phaser.GameObjects.Container;
  private readonly liftLights: Phaser.GameObjects.Rectangle[] = [];

  private readonly movingPlatform: Phaser.GameObjects.Container;
  private readonly hazardBeam: Phaser.GameObjects.Rectangle;
  private readonly hazardGlow: Phaser.GameObjects.Image;

  private readonly teamShieldDome: Phaser.GameObjects.Arc;
  private readonly checkpointMarkers: Phaser.GameObjects.Container[] = [];
  private readonly damageOverlay: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene) {
    // --- Bridge -----------------------------------------------------------
    const anchorLeft = scene.add
      .rectangle(BRIDGE_X - 18, BRIDGE_Y + 4, 24, 26, PALETTE.towerNear)
      .setStrokeStyle(2, PALETTE.warn, 0.8)
      .setDepth(11);
    const anchorRight = scene.add
      .rectangle(
        BRIDGE_X + BRIDGE_SEGMENTS * BRIDGE_SEGMENT_WIDTH + 18,
        BRIDGE_Y + 4,
        24,
        26,
        PALETTE.towerNear,
      )
      .setStrokeStyle(2, PALETTE.warn, 0.8)
      .setDepth(11);
    anchorLeft.setVisible(true);
    anchorRight.setVisible(true);

    for (let index = 0; index < BRIDGE_SEGMENTS; index += 1) {
      const segment = scene.add
        .rectangle(
          BRIDGE_X + index * BRIDGE_SEGMENT_WIDTH + BRIDGE_SEGMENT_WIDTH / 2,
          BRIDGE_Y,
          BRIDGE_SEGMENT_WIDTH - 3,
          12,
          PALETTE.deckFill,
        )
        .setStrokeStyle(2, PALETTE.warn, 0.95)
        .setDepth(12)
        .setScale(0, 1);
      this.bridgeSegments.push(segment);
    }

    this.bridgeSparks = scene.add
      .particles(0, 0, TEXTURE_KEYS.spark, {
        lifespan: 420,
        speed: { min: 40, max: 130 },
        angle: { min: 200, max: 340 },
        gravityY: 260,
        scale: { start: 0.9, end: 0 },
        tint: [PALETTE.warn, 0xffe6a8],
        blendMode: Phaser.BlendModes.ADD,
        maxAliveParticles: 40,
        emitting: false,
      })
      .setDepth(14);

    this.bridgeLabel = scene.add
      .text(BRIDGE_X + 96, BRIDGE_Y - 26, "BRÜCKE OFFLINE", {
        fontFamily: "Inter, Arial, sans-serif",
        fontStyle: "bold",
        fontSize: "13px",
        color: toCss(PALETTE.warn),
      })
      .setOrigin(0.5)
      .setDepth(15);

    // --- Jump field -------------------------------------------------------
    this.jumpGlow = scene.add
      .image(360, 1020, TEXTURE_KEYS.glow)
      .setDisplaySize(220, 120)
      .setTint(PALETTE.support)
      .setAlpha(0)
      .setDepth(10);
    this.jumpGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.jumpPad = scene.add
      .rectangle(360, 1030, 150, 10, PALETTE.support, 0.9)
      .setStrokeStyle(2, 0xffffff, 0.6)
      .setDepth(11)
      .setVisible(false);
    this.jumpParticles = scene.add
      .particles(0, 0, TEXTURE_KEYS.glow, {
        x: { min: 292, max: 428 },
        y: 1028,
        lifespan: 900,
        speedY: { min: -150, max: -70 },
        scale: { start: 0.22, end: 0 },
        alpha: { start: 0.8, end: 0 },
        tint: PALETTE.support,
        blendMode: Phaser.BlendModes.ADD,
        frequency: 90,
        maxAliveParticles: 26,
        emitting: false,
      })
      .setDepth(12);

    // --- Lift -------------------------------------------------------------
    this.liftShaft = scene.add
      .rectangle(544, 470, 78, 300, 0x061420, 0.85)
      .setStrokeStyle(2, PALETTE.towerEdge, 0.7)
      .setDepth(3);
    const car = scene.add
      .rectangle(0, 0, 62, 54, 0x0b2434)
      .setStrokeStyle(3, PALETTE.support, 0.95);
    const window_ = scene.add.rectangle(0, -6, 44, 22, 0x0b3a48, 1);
    const door = scene.add.rectangle(0, 16, 44, 12, PALETTE.support, 0.35);
    for (let index = 0; index < 3; index += 1) {
      const light = this.scene.add.rectangle(
        -20 + index * 20,
        -22,
        12,
        3,
        PALETTE.support,
        0.9,
      );
      this.liftLights.push(light);
    }
    this.liftCar = scene.add
      .container(544, 470, [car, window_, door, ...this.liftLights])
      .setDepth(13);

    // --- Moving platform --------------------------------------------------
    const platformBody = scene.add
      .rectangle(0, 0, 120, 16, PALETTE.deckFill)
      .setStrokeStyle(3, PALETTE.energy, 0.9);
    const platformStrip = scene.add.rectangle(0, -9, 110, 3, PALETTE.energy, 0.9);
    platformStrip.setBlendMode(Phaser.BlendModes.ADD);
    this.movingPlatform = scene.add
      .container(302, 438, [platformBody, platformStrip])
      .setDepth(12);

    // --- Timed hazard -----------------------------------------------------
    this.hazardGlow = scene.add
      .image(350, 666, TEXTURE_KEYS.glow)
      .setDisplaySize(320, 70)
      .setTint(PALETTE.danger)
      .setAlpha(0)
      .setDepth(10);
    this.hazardGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.hazardBeam = scene.add
      .rectangle(350, 666, 268, 7, PALETTE.danger, 0.85)
      .setDepth(11);

    // --- Team shield ------------------------------------------------------
    this.teamShieldDome = scene.add
      .circle(360, 700, 330, PALETTE.energy, 0.05)
      .setStrokeStyle(3, PALETTE.energySoft, 0.5)
      .setDepth(24)
      .setVisible(false);

    // --- Checkpoints ------------------------------------------------------
    this.checkpointMarkers.push(this.buildCheckpoint(1, 216, 718));
    this.checkpointMarkers.push(this.buildCheckpoint(2, 470, 480));

    this.damageOverlay = scene.add.graphics().setDepth(16);
  }

  private buildCheckpoint(
    index: number,
    x: number,
    y: number,
  ): Phaser.GameObjects.Container {
    const plate = this.scene.add
      .rectangle(0, 0, 128, 40, 0x04121c, 0.94)
      .setStrokeStyle(2, PALETTE.energy, 0.9);
    const label = this.scene.add
      .text(0, 0, `CHECKPOINT ${index}`, {
        fontFamily: "Inter, Arial, sans-serif",
        fontStyle: "bold",
        fontSize: "13px",
        color: toCss(PALETTE.energySoft),
      })
      .setOrigin(0.5);
    const beacon = this.scene.add.circle(-52, 0, 5, PALETTE.energy, 1);
    beacon.setBlendMode(Phaser.BlendModes.ADD);
    return this.scene.add.container(x, y, [plate, label, beacon]).setDepth(15);
  }

  /** Fired by the scene when a bridge command lands. */
  playBridgeBuild(): void {
    this.bridgeSparks.emitParticleAt(BRIDGE_X + 96, BRIDGE_Y, 24);
  }

  playJumpPulse(): void {
    this.jumpParticles.emitParticleAt(360, 1026, 12);
  }

  update(state: SimulationState, tick: number, reducedMotion: boolean): void {
    const motion = reducedMotion ? 0.35 : 1;
    const bridge = state.structures.find((item) => item.id === "bridge-alpha");
    const bridgeOnline = bridge?.intact === true;
    const target = bridgeOnline ? 1 : 0;
    this.bridgeProgress = Phaser.Math.Linear(this.bridgeProgress, target, 0.14);

    for (const [index, segment] of this.bridgeSegments.entries()) {
      // Segments extend one after another, left to right.
      const local = Phaser.Math.Clamp(
        this.bridgeProgress * BRIDGE_SEGMENTS - index,
        0,
        1,
      );
      segment.setScale(local, 1);
      segment.setAlpha(0.35 + local * 0.65);
      segment.setFillStyle(
        local > 0.98 ? PALETTE.deckFill : PALETTE.towerNear,
        1,
      );
    }
    this.bridgeLabel.setText(
      bridgeOnline
        ? `BRÜCKE ONLINE · ${Math.round((bridge?.health ?? 0))}%`
        : "BRÜCKE OFFLINE",
    );
    this.bridgeLabel.setColor(
      toCss(bridgeOnline ? PALETTE.support : PALETTE.warn),
    );

    const jumpActive = state.jumpFieldUntilTick > state.tick;
    this.jumpPad.setVisible(jumpActive);
    this.jumpGlow.setAlpha(
      jumpActive ? 0.35 + Math.sin(tick * 0.2) * 0.15 * motion : 0,
    );
    if (jumpActive && !this.jumpParticles.emitting) this.jumpParticles.start();
    if (!jumpActive && this.jumpParticles.emitting) this.jumpParticles.stop();

    const liftBoost = state.liftActiveUntilTick > state.tick;
    const liftSpeed = liftBoost ? 0.075 : 0.03;
    this.liftCar.y = 470 + Math.sin(tick * liftSpeed) * 128;
    const liftColor = liftBoost ? PALETTE.support : PALETTE.towerEdge;
    for (const [index, light] of this.liftLights.entries()) {
      const on = liftBoost
        ? Math.floor(tick / 4 + index) % 3 === 0
        : Math.floor(tick / 14 + index) % 3 === 0;
      light.setFillStyle(liftColor, on ? 1 : 0.25);
    }
    this.liftShaft.setStrokeStyle(2, liftColor, liftBoost ? 0.95 : 0.6);

    this.movingPlatform.x = 302 + Math.sin(tick * 0.035) * 106;

    const hazardActive = state.tick % 180 < 44;
    this.hazardBeam.setAlpha(hazardActive ? 0.9 : 0.08);
    this.hazardGlow.setAlpha(hazardActive ? 0.4 : 0);
    this.hazardBeam.setFillStyle(
      hazardActive ? PALETTE.danger : PALETTE.towerEdge,
      1,
    );

    const shieldActive = state.shieldUntilTick > state.tick;
    this.teamShieldDome.setVisible(shieldActive);
    if (shieldActive) {
      const pulse = 0.35 + Math.sin(tick * 0.12) * 0.2 * motion;
      this.teamShieldDome.setStrokeStyle(3, PALETTE.energySoft, pulse + 0.3);
      this.teamShieldDome.setFillStyle(PALETTE.energy, 0.04 + pulse * 0.04);
      this.teamShieldDome.setScale(1 + Math.sin(tick * 0.08) * 0.015 * motion);
    }

    for (const [index, marker] of this.checkpointMarkers.entries()) {
      marker.setAlpha(0.75 + Math.sin(tick * 0.06 + index) * 0.2);
    }

    this.renderDamage(state);
  }

  /** Broken temporary structures are drawn as visible gaps and debris. */
  private renderDamage(state: SimulationState): void {
    this.damageOverlay.clear();
    const shortcut = state.structures.find(
      (item) => item.id === "shortcut-deck",
    );
    if (shortcut && !shortcut.intact) {
      this.damageOverlay.fillStyle(PALETTE.danger, 0.16);
      this.damageOverlay.fillRect(250, 776, 180, 14);
      this.damageOverlay.lineStyle(3, PALETTE.danger, 0.75);
      this.damageOverlay.lineBetween(250, 783, 300, 796);
      this.damageOverlay.lineBetween(380, 796, 430, 783);
    }
    const brace = state.structures.find((item) => item.id === "route-brace");
    if (brace && !brace.intact) {
      this.damageOverlay.lineStyle(3, PALETTE.danger, 0.6);
      this.damageOverlay.lineBetween(150, 520, 210, 540);
    }
  }
}
