import Phaser from "phaser";
import type {
  HeroAnimation,
  HeroSnapshot,
} from "../adventure/HeroController";
import { NURI_SPRITE_SHEET } from "../assets/heroAssetConfig";
import { WORLD_GROUND_Y } from "../config/gameConfig";

const VISUAL_GROUND_OFFSET = 7;
const HERO_SCALE = 0.78;
const FRAME_TICKS: Partial<Record<HeroAnimation, number>> = {
  run: 4,
  idle: 16,
};

/** PNG-backed NURI view. Gameplay coordinates remain owned by HeroController. */
export class HeroView {
  readonly container: Phaser.GameObjects.Container;

  private readonly scene: Phaser.Scene;
  private readonly trail: Phaser.GameObjects.Graphics;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly trailPoints: { x: number; y: number }[] = [];
  private lastAnimation: HeroAnimation | "" = "";
  private lastTrailTick = -1;
  private fallStartY = 0;
  private maxFallDistance = 0;
  private landingWobbleStartedTick = -1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.trail = scene.add.graphics().setDepth(29);
    this.shadow = scene.add.ellipse(0, 1, 74, 17, 0x02080c, 0.5);
    this.sprite = scene.add
      .sprite(0, 13, "nuri-v1", 0)
      .setOrigin(0.5, 1)
      .setScale(HERO_SCALE);
    this.container = scene.add
      .container(120, WORLD_GROUND_Y, [this.shadow, this.sprite])
      .setDepth(30);
  }

  update(hero: HeroSnapshot, tick: number, reducedMotion: boolean): void {
    const visualY = hero.y - VISUAL_GROUND_OFFSET;
    const animation = hero.animation;
    const animationChanged = animation !== this.lastAnimation;

    if (animationChanged && animation === "fall") {
      this.fallStartY = hero.y;
      this.maxFallDistance = 0;
    }
    if (animation === "fall") {
      this.maxFallDistance = Math.max(this.maxFallDistance, hero.y - this.fallStartY);
    }
    if (animationChanged && animation === "land") {
      this.emitLandingBurst(hero.x, hero.y, reducedMotion);
      if (this.lastAnimation === "fall" && this.maxFallDistance > 90) {
        this.landingWobbleStartedTick = tick;
      }
    }

    this.container
      .setPosition(hero.x, visualY)
      .setScale(hero.facing, 1)
      .setRotation(0);
    this.sprite
      .setPosition(0, 13)
      .setScale(HERO_SCALE)
      .setRotation(0)
      .setAlpha(1);
    this.updateFrame(animation, tick);
    this.updatePose(animation, visualY, tick, reducedMotion);
    this.updateTrail(hero, visualY, tick, reducedMotion);

    this.shadow.setScale(
      1 - Math.min(0.48, Math.max(0, (WORLD_GROUND_Y - hero.y) / 390)),
      1,
    );
    this.shadow.setAlpha(animation === "jump" || animation === "fall" ? 0.28 : 0.5);
    this.lastAnimation = animation;
  }

  private updateFrame(animation: HeroAnimation, tick: number): void {
    const frames = NURI_SPRITE_SHEET.animations[animation];
    const frameTicks = FRAME_TICKS[animation] ?? 8;
    const frameIndex = Math.floor(tick / frameTicks) % frames.length;
    this.sprite.setFrame(frames[frameIndex]!);
  }

  private updatePose(
    animation: HeroAnimation,
    visualY: number,
    tick: number,
    reducedMotion: boolean,
  ): void {
    const motion = reducedMotion ? 0.28 : 1;
    const phase = tick * 0.28;

    if (animation === "run") {
      this.container.y = visualY - Math.abs(Math.sin(phase)) * 3 * motion;
      this.sprite.rotation = Math.sin(phase) * 0.025 * motion;
    } else if (animation === "idle" || animation === "wait") {
      this.container.y = visualY - Math.abs(Math.sin(phase * 0.45)) * 2 * motion;
    } else if (animation === "fall") {
      this.sprite.rotation = Math.sin(phase * 0.5) * 0.1 * motion;
    } else if (animation === "celebrate") {
      this.container.y = visualY - Math.abs(Math.sin(phase * 0.75)) * 12 * motion;
    } else if (animation === "bomb_reaction" || animation === "scared") {
      this.sprite.rotation = Math.sin(phase * 1.3) * 0.045 * motion;
    } else if (animation === "land") {
      this.sprite.setScale(HERO_SCALE * 1.04, HERO_SCALE * 0.94);
      const wobbleAge = tick - this.landingWobbleStartedTick;
      const wobbleTicks = reducedMotion ? 2 : 6;
      if (wobbleAge >= 0 && wobbleAge < wobbleTicks) {
        this.container.rotation =
          Math.sin(wobbleAge * Math.PI * 0.85) *
          (reducedMotion ? 0.015 : 0.055) *
          (1 - wobbleAge / wobbleTicks);
      }
    }
  }

  private updateTrail(
    hero: HeroSnapshot,
    visualY: number,
    tick: number,
    reducedMotion: boolean,
  ): void {
    const airborne = hero.animation === "jump" || hero.animation === "fall";
    if (airborne && tick !== this.lastTrailTick) {
      this.trailPoints.push({
        x: hero.x - hero.facing * 20,
        y: visualY - 62,
      });
      this.lastTrailTick = tick;
    } else if (!airborne) {
      this.trailPoints.length = 0;
    }

    const maxPoints = reducedMotion ? 3 : 7;
    while (this.trailPoints.length > maxPoints) this.trailPoints.shift();

    this.trail.clear();
    for (let index = 1; index < this.trailPoints.length; index += 1) {
      const previous = this.trailPoints[index - 1]!;
      const point = this.trailPoints[index]!;
      const progress = index / this.trailPoints.length;
      const alpha = progress * (reducedMotion ? 0.16 : 0.42);
      this.trail.lineStyle(reducedMotion ? 2 : 5, 0x6dfff0, alpha);
      this.trail.lineBetween(previous.x, previous.y, point.x, point.y);
      this.trail.fillStyle(index % 2 === 0 ? 0xff65b5 : 0xffffff, alpha * 0.9);
      this.trail.fillCircle(point.x, point.y, reducedMotion ? 1.5 : 2.8);
    }
  }

  private emitLandingBurst(x: number, y: number, reducedMotion: boolean): void {
    const offsets = [-34, -23, -12, 0, 12, 23, 34];
    const count = reducedMotion ? 3 : offsets.length;
    const start = Math.floor((offsets.length - count) / 2);
    for (let index = 0; index < count; index += 1) {
      const offset = offsets[start + index]!;
      const particle = this.scene.add
        .circle(x + offset * 0.18, y - 4, reducedMotion ? 2.5 : 4, 0x78fff0, 0.9)
        .setDepth(29)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: particle,
        x: x + offset * (reducedMotion ? 0.28 : 1),
        y: y - (reducedMotion ? 5 : 18 + (index % 3) * 7),
        alpha: 0,
        scale: reducedMotion ? 0.75 : 0.25,
        duration: reducedMotion ? 130 : 220,
        ease: "Quad.easeOut",
        onComplete: () => particle.destroy(),
      });
    }
  }
}
