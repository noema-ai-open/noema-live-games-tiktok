import Phaser from "phaser";
import type { LevelSegment, ObstacleProgress } from "../adventure/levelTypes";

export class BlockBuilderView {
  private readonly scene: Phaser.Scene;
  private readonly blocks: Phaser.GameObjects.Container[] = [];
  private readonly effects = new Set<Phaser.GameObjects.GameObject>();

  constructor(scene: Phaser.Scene, segment: LevelSegment) {
    this.scene = scene;
    const originX = (segment.waitX ?? segment.startX) + 58;
    for (let index = 0; index < 3; index += 1) {
      const size = 56;
      const block = scene.add
        .rectangle(0, 0, size, size, 0x1f8790, 1)
        .setStrokeStyle(4, 0x72fff0, 0.95);
      const core = scene.add.rectangle(0, 0, 25, 25, 0xffd36a, 0.8).setRotation(Math.PI / 4);
      const container = scene.add
        .container(
          originX + index * 50,
          segment.groundY - size / 2 - index * 31,
          [block, core],
        )
        .setDepth(13)
        .setVisible(false);
      this.blocks.push(container);
    }
  }

  update(progress: ObstacleProgress, reducedMotion: boolean): void {
    for (let index = 0; index < this.blocks.length; index += 1) {
      const block = this.blocks[index]!;
      const visible = index < progress.visibleParts;
      if (visible && !block.visible) {
        block.setVisible(true);
        block.setAlpha(reducedMotion ? 1 : 0.2);
        block.setScale(reducedMotion ? 1 : 0.45);
        block.scene.tweens.add({
          targets: block,
          alpha: 1,
          scale: 1,
          duration: reducedMotion ? 80 : 280,
          ease: "Back.easeOut",
        });
        this.emitAppearanceEffects(block.x, block.y, reducedMotion);
      } else if (!visible) {
        block.setVisible(false);
      }
    }
  }

  destroy(): void {
    for (const effect of this.effects) {
      this.scene.tweens.killTweensOf(effect);
      effect.destroy();
    }
    this.effects.clear();
    for (const block of this.blocks) block.destroy(true);
  }

  private emitAppearanceEffects(x: number, y: number, reducedMotion: boolean): void {
    const flash = this.track(
      this.scene.add
        .circle(x, y, reducedMotion ? 39 : 48, 0xdffff9, reducedMotion ? 0.28 : 0.58)
        .setDepth(12)
        .setBlendMode(Phaser.BlendModes.ADD),
    );
    const ring = this.track(
      this.scene.add
        .circle(x, y, 31, 0x72fff0, 0)
        .setStrokeStyle(reducedMotion ? 2 : 4, 0xbffff8, reducedMotion ? 0.48 : 0.9)
        .setDepth(14),
    );

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: reducedMotion ? 1.12 : 1.45,
      duration: reducedMotion ? 90 : 240,
      ease: "Quad.easeOut",
      onComplete: () => this.destroyEffect(flash),
    });
    this.scene.tweens.add({
      targets: ring,
      alpha: 0,
      scale: reducedMotion ? 1.22 : 1.65,
      duration: reducedMotion ? 110 : 300,
      ease: "Cubic.easeOut",
      onComplete: () => this.destroyEffect(ring),
    });

    const particleCount = reducedMotion ? 2 : 6;
    for (let index = 0; index < particleCount; index += 1) {
      const angle = (Math.PI * 2 * index) / particleCount + Math.PI / 6;
      const distance = reducedMotion ? 13 : 38 + (index % 2) * 10;
      const particle = this.track(
        this.scene.add
          .circle(x, y, reducedMotion ? 2.5 : 3.5, index % 2 === 0 ? 0xffd36a : 0x72fff0, 0.95)
          .setDepth(14)
          .setBlendMode(Phaser.BlendModes.ADD),
      );
      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.3,
        duration: reducedMotion ? 100 : 260,
        ease: "Quad.easeOut",
        onComplete: () => this.destroyEffect(particle),
      });
    }
  }

  private track<T extends Phaser.GameObjects.GameObject>(effect: T): T {
    this.effects.add(effect);
    return effect;
  }

  private destroyEffect(effect: Phaser.GameObjects.GameObject): void {
    this.effects.delete(effect);
    effect.destroy();
  }
}
