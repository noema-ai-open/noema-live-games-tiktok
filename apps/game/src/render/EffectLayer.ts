import Phaser from "phaser";
import { PALETTE } from "./palette";
import { TEXTURE_KEYS } from "./textures";

/**
 * Pooled one-shot effects.
 *
 * Every emitter has a hard `maxAliveParticles` cap and is created once, so a
 * long round cannot grow the particle count without bound.
 */
export class EffectLayer {
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly smoke: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly debris: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly repair: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly rescue: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly windLines: Phaser.GameObjects.Graphics;
  private readonly floatDust: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private readonly scene: Phaser.Scene) {
    this.sparks = scene.add
      .particles(0, 0, TEXTURE_KEYS.spark, {
        lifespan: 500,
        speed: { min: 60, max: 200 },
        gravityY: 320,
        scale: { start: 1, end: 0 },
        tint: [PALETTE.warn, 0xfff0c0],
        blendMode: Phaser.BlendModes.ADD,
        maxAliveParticles: 70,
        emitting: false,
      })
      .setDepth(40);

    this.smoke = scene.add
      .particles(0, 0, TEXTURE_KEYS.smoke, {
        lifespan: 1800,
        speed: { min: 20, max: 90 },
        scale: { start: 0.6, end: 2.2 },
        alpha: { start: 0.5, end: 0 },
        tint: [0x30506a, 0x1a2b3c],
        maxAliveParticles: 40,
        emitting: false,
      })
      .setDepth(38);

    this.debris = scene.add
      .particles(0, 0, TEXTURE_KEYS.shard, {
        lifespan: 1400,
        speed: { min: 90, max: 320 },
        gravityY: 520,
        rotate: { start: 0, end: 360 },
        scale: { start: 1.2, end: 0.4 },
        tint: [PALETTE.towerEdge, PALETTE.warn],
        maxAliveParticles: 60,
        emitting: false,
      })
      .setDepth(39);

    this.repair = scene.add
      .particles(0, 0, TEXTURE_KEYS.glow, {
        lifespan: 900,
        speed: { min: 20, max: 80 },
        scale: { start: 0.28, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: PALETTE.support,
        blendMode: Phaser.BlendModes.ADD,
        maxAliveParticles: 50,
        emitting: false,
      })
      .setDepth(41);

    this.rescue = scene.add
      .particles(0, 0, TEXTURE_KEYS.glow, {
        lifespan: 1100,
        speedY: { min: -160, max: -60 },
        speedX: { min: -40, max: 40 },
        scale: { start: 0.3, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: PALETTE.energySoft,
        blendMode: Phaser.BlendModes.ADD,
        maxAliveParticles: 40,
        emitting: false,
      })
      .setDepth(41);

    this.floatDust = scene.add
      .particles(0, 0, TEXTURE_KEYS.glow, {
        x: { min: 100, max: 620 },
        y: { min: 200, max: 1140 },
        lifespan: 2600,
        speedY: { min: -40, max: -12 },
        scale: { start: 0.14, end: 0 },
        alpha: { start: 0.5, end: 0 },
        tint: PALETTE.support,
        blendMode: Phaser.BlendModes.ADD,
        frequency: 120,
        maxAliveParticles: 30,
        emitting: false,
      })
      .setDepth(37);

    this.windLines = scene.add.graphics().setDepth(36);
  }

  burstSparks(x: number, y: number, count = 14): void {
    this.sparks.emitParticleAt(x, y, count);
  }

  burstSmoke(x: number, y: number, count = 8): void {
    this.smoke.emitParticleAt(x, y, count);
  }

  burstDebris(x: number, y: number, count = 16): void {
    this.debris.emitParticleAt(x, y, count);
  }

  burstRepair(x: number, y: number, count = 14): void {
    this.repair.emitParticleAt(x, y, count);
  }

  burstRescue(x: number, y: number, count = 12): void {
    this.rescue.emitParticleAt(x, y, count);
  }

  /** Environment visuals for wind and low gravity. */
  updateEnvironment(
    mode: "none" | "wind" | "low_gravity",
    tick: number,
    reducedMotion: boolean,
  ): void {
    this.windLines.clear();
    if (mode === "wind") {
      const motion = reducedMotion ? 0.3 : 1;
      this.windLines.lineStyle(2, PALETTE.energySoft, 0.28);
      for (let index = 0; index < 12; index += 1) {
        const y = 150 + index * 86;
        const offset = ((tick * 6 * motion + index * 90) % 760) - 60;
        this.windLines.lineBetween(offset, y, offset + 90, y + 8);
      }
    }
    if (mode === "low_gravity") {
      if (!this.floatDust.emitting) this.floatDust.start();
    } else if (this.floatDust.emitting) {
      this.floatDust.stop();
    }
  }

  /** Dust and sparks shaken loose by an earthquake. */
  earthquakeDebris(): void {
    for (let index = 0; index < 4; index += 1) {
      const x = 140 + Math.random() * 440;
      const y = 300 + Math.random() * 760;
      this.burstSmoke(x, y, 3);
      this.burstDebris(x, y, 5);
    }
  }

  getScene(): Phaser.Scene {
    return this.scene;
  }
}
