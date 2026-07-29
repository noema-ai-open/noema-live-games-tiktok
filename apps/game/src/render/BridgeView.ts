import Phaser from "phaser";
import type { LevelSegment, ObstacleProgress } from "../adventure/levelTypes";

export class BridgeView {
  private readonly scene: Phaser.Scene;
  private readonly segments: Phaser.GameObjects.Container[] = [];
  private readonly energyFlow: Phaser.GameObjects.Rectangle;
  private readonly flowStartX: number;
  private readonly flowEndX: number;
  private visibleCount = 0;
  private flowReducedMotion: boolean | null = null;

  constructor(scene: Phaser.Scene, segment: LevelSegment) {
    this.scene = scene;
    const start = (segment.waitX ?? segment.startX) + 20;
    const end = (segment.landingX ?? segment.endX) - 20;
    const count = segment.type === "ravine" ? 6 : 3;
    const width = (end - start) / count;

    for (let index = 0; index < count; index += 1) {
      const plate = scene.add
        .rectangle(0, 0, Math.max(42, width - 8), 20, 0x47e8df, 0.96)
        .setStrokeStyle(3, 0xcafff6, 0.9);
      const brace = scene.add.rectangle(0, 13, Math.max(34, width - 20), 7, 0x17465a, 1);
      const glow = scene.add.rectangle(0, -4, Math.max(28, width - 28), 4, 0xffffff, 0.8);
      const container = scene.add
        // The plate is 20 px high: +10 keeps its upper edge exactly on the
        // gameplay ground line used by HeroController.
        .container(start + width * (index + 0.5), segment.groundY + 10, [brace, plate, glow])
        .setDepth(12)
        .setVisible(false);
      this.segments.push(container);
    }

    this.flowStartX = start + 16;
    this.flowEndX = end - 16;
    this.energyFlow = scene.add
      .rectangle(this.flowStartX, segment.groundY + 3, Math.max(24, width * 0.55), 5, 0xffffff, 0.88)
      .setDepth(14)
      .setVisible(false)
      .setBlendMode(Phaser.BlendModes.ADD);
  }

  update(progress: ObstacleProgress, reducedMotion: boolean): void {
    for (let index = 0; index < this.segments.length; index += 1) {
      const segment = this.segments[index]!;
      const visible = index < progress.visibleParts;
      if (visible && !segment.visible) {
        segment.setVisible(true);
        segment.setScale(reducedMotion ? 1 : 0.25, reducedMotion ? 1 : 0.1);
        segment.scene.tweens.add({
          targets: segment,
          scaleX: 1,
          scaleY: 1,
          duration: reducedMotion ? 80 : 260,
          ease: "Back.easeOut",
        });
      } else if (!visible) {
        segment.setVisible(false);
      }
    }

    const complete = progress.visibleParts === this.segments.length;
    const completionChanged = complete !== (this.visibleCount === this.segments.length);
    if (completionChanged || (complete && reducedMotion !== this.flowReducedMotion)) {
      this.updateEnergyFlow(complete, reducedMotion);
    }
    this.visibleCount = progress.visibleParts;
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.energyFlow);
    this.energyFlow.destroy();
    for (const segment of this.segments) segment.destroy(true);
    this.segments.length = 0;
  }

  private updateEnergyFlow(complete: boolean, reducedMotion: boolean): void {
    this.scene.tweens.killTweensOf(this.energyFlow);
    this.flowReducedMotion = complete ? reducedMotion : null;
    if (!complete) {
      this.energyFlow.setVisible(false);
      return;
    }

    this.energyFlow.setVisible(true);
    if (reducedMotion) {
      this.energyFlow
        .setPosition((this.flowStartX + this.flowEndX) / 2, this.energyFlow.y)
        .setAlpha(0.34)
        .setScale(1.8, 0.75);
      return;
    }

    this.energyFlow
      .setPosition(this.flowStartX, this.energyFlow.y)
      .setAlpha(0.92)
      .setScale(1);
    this.scene.tweens.add({
      targets: this.energyFlow,
      x: this.flowEndX,
      alpha: { from: 0.28, to: 0.92 },
      duration: 1150,
      ease: "Sine.easeInOut",
      repeat: -1,
      yoyo: false,
    });
  }
}
