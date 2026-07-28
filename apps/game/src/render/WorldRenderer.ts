import Phaser from "phaser";
import {
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  SIDEBAR_WIDTH,
} from "../config/gameConfig";
import { SeededRandom } from "../simulation/rng";
import { PALETTE } from "./palette";
import { TEXTURE_KEYS } from "./textures";

type Layer = {
  container: Phaser.GameObjects.Container;
  /** How strongly the layer reacts to the parallax value (0 = static). */
  depthFactor: number;
};

/**
 * Builds the static world background: sky, distant skyline, the megastructure
 * itself and atmosphere. Nothing here reads simulation state except the
 * parallax offset handed in by the scene.
 */
export class WorldRenderer {
  private readonly layers: Layer[] = [];
  private readonly energyLines: Phaser.GameObjects.Graphics;
  private readonly pulseDots: Phaser.GameObjects.Arc[] = [];
  private readonly warningLights: Phaser.GameObjects.Arc[] = [];
  private readonly rng = new SeededRandom(0x10ffee);
  private parallax = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.buildSky();
    this.buildSkyline();
    this.buildTower();
    this.energyLines = scene.add.graphics().setDepth(6);
    this.buildAtmosphere();
  }

  /** `value` is 0 at the bottom of the tower and 1 at the exit. */
  setParallax(value: number): void {
    this.parallax = Phaser.Math.Linear(this.parallax, value, 0.06);
    for (const layer of this.layers) {
      layer.container.y = -this.parallax * layer.depthFactor;
    }
  }

  update(tick: number, reducedMotion: boolean): void {
    const speed = reducedMotion ? 0.02 : 0.06;
    this.energyLines.clear();
    this.energyLines.lineStyle(2, PALETTE.energy, 0.22);
    for (let index = 0; index < 5; index += 1) {
      const x = 96 + index * 132;
      this.energyLines.lineBetween(x, 120, x, 1160);
    }
    for (const [index, dot] of this.pulseDots.entries()) {
      const phase = (tick * speed + index * 40) % 1040;
      dot.y = 1160 - phase;
      dot.setAlpha(0.25 + Math.sin(phase * 0.02) * 0.25 + 0.4);
    }
    for (const [index, light] of this.warningLights.entries()) {
      const on = Math.floor(tick / 22 + index) % 3 === 0;
      light.setAlpha(on ? 0.95 : 0.15);
    }
  }

  private addLayer(depthFactor: number, depth: number): Layer {
    const container = this.scene.add.container(0, 0).setDepth(depth);
    const layer: Layer = { container, depthFactor };
    this.layers.push(layer);
    return layer;
  }

  private buildSky(): void {
    const graphics = this.scene.add.graphics().setDepth(-40);
    graphics.fillGradientStyle(
      PALETTE.skyTop,
      PALETTE.skyTop,
      PALETTE.skyBottom,
      PALETTE.skyBottom,
      1,
    );
    graphics.fillRect(-SIDEBAR_WIDTH, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Warm horizon glow behind the tower base.
    graphics.fillStyle(PALETTE.warn, 0.06);
    graphics.fillEllipse(360, 1180, 900, 420);

    const grain = this.scene.add
      .tileSprite(360 - SIDEBAR_WIDTH / 2, 640, LOGICAL_WIDTH, LOGICAL_HEIGHT, TEXTURE_KEYS.grain)
      .setDepth(-39)
      .setAlpha(0.5);
    grain.setBlendMode(Phaser.BlendModes.SCREEN);
  }

  private buildSkyline(): void {
    const far = this.addLayer(26, -30);
    const near = this.addLayer(52, -20);

    for (let index = 0; index < 22; index += 1) {
      const x = this.rng.integer(-40, 760);
      const width = this.rng.integer(34, 92);
      const height = this.rng.integer(240, 760);
      const y = 1180 - height;
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(PALETTE.towerFar, 0.85);
      graphics.fillRect(x, y, width, height);
      graphics.fillStyle(PALETTE.energy, 0.05);
      for (let row = y + 16; row < 1180; row += 22) {
        graphics.fillRect(x + 6, row, width - 12, 3);
      }
      far.container.add(graphics);
    }

    for (let index = 0; index < 9; index += 1) {
      const x = index % 2 === 0 ? this.rng.integer(-60, 120) : this.rng.integer(600, 780);
      const width = this.rng.integer(70, 130);
      const height = this.rng.integer(420, 900);
      const y = 1200 - height;
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(PALETTE.hazeNear, 0.92);
      graphics.fillRect(x, y, width, height);
      graphics.lineStyle(2, PALETTE.towerEdge, 0.25);
      graphics.strokeRect(x, y, width, height);
      graphics.fillStyle(PALETTE.warn, 0.09);
      for (let row = y + 24; row < 1200; row += 34) {
        graphics.fillRect(x + 10, row, width - 20, 6);
      }
      near.container.add(graphics);
    }
  }

  private buildTower(): void {
    const structure = this.scene.add.graphics().setDepth(-10);

    // Main shaft.
    structure.fillStyle(PALETTE.towerMid, 0.96);
    structure.fillRoundedRect(70, 84, 580, 1104, 26);
    structure.lineStyle(5, PALETTE.towerEdge, 0.75);
    structure.strokeRoundedRect(70, 84, 580, 1104, 26);

    // Inner recess creates depth against the outer frame.
    structure.fillStyle(PALETTE.towerFar, 0.9);
    structure.fillRoundedRect(102, 108, 516, 1056, 18);

    // Structural ribs.
    structure.lineStyle(3, PALETTE.towerNear, 0.55);
    for (let y = 132; y < 1160; y += 62) {
      structure.lineBetween(104, y, 616, y);
    }
    structure.lineStyle(2, PALETTE.towerEdge, 0.22);
    for (let x = 132; x < 620; x += 84) {
      structure.lineBetween(x, 110, x, 1162);
    }

    // Diagonal bracing for an industrial silhouette.
    structure.lineStyle(4, PALETTE.towerNear, 0.4);
    for (let y = 140; y < 1140; y += 124) {
      structure.lineBetween(112, y, 236, y + 110);
      structure.lineBetween(484, y + 110, 608, y);
    }

    // Service pipes on both flanks.
    const pipes = this.scene.add.graphics().setDepth(-8);
    for (const x of [86, 634]) {
      pipes.fillStyle(PALETTE.towerNear, 0.95);
      pipes.fillRoundedRect(x - 9, 110, 18, 1050, 9);
      pipes.fillStyle(PALETTE.energy, 0.16);
      pipes.fillRoundedRect(x - 3, 110, 6, 1050, 3);
    }
  }

  private buildAtmosphere(): void {
    for (let index = 0; index < 10; index += 1) {
      const x = 96 + (index % 5) * 132;
      const dot = this.scene.add
        .circle(x, 1160, 4, PALETTE.energy, 0.8)
        .setDepth(7);
      dot.setBlendMode(Phaser.BlendModes.ADD);
      this.pulseDots.push(dot);
    }

    for (const [x, y] of [
      [96, 300],
      [634, 470],
      [96, 760],
      [634, 980],
    ] as const) {
      const light = this.scene.add.circle(x, y, 6, PALETTE.danger, 0.9).setDepth(9);
      light.setBlendMode(Phaser.BlendModes.ADD);
      this.warningLights.push(light);
    }

    // Slow atmospheric dust, capped and pooled by the emitter itself.
    const dust = this.scene.add.particles(0, 0, TEXTURE_KEYS.glow, {
      x: { min: 90, max: 630 },
      y: { min: 120, max: 1180 },
      lifespan: 6000,
      speedY: { min: -14, max: -4 },
      speedX: { min: -6, max: 6 },
      scale: { start: 0.12, end: 0 },
      alpha: { start: 0.22, end: 0 },
      frequency: 220,
      maxAliveParticles: 34,
      tint: PALETTE.energySoft,
      blendMode: Phaser.BlendModes.ADD,
    });
    dust.setDepth(10);
  }
}
