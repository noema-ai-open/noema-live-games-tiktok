import Phaser from "phaser";
import type { LevelSegment, ObstacleProgress } from "../adventure/levelTypes";

export class BlockBuilderView {
  private readonly blocks: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene, segment: LevelSegment) {
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
      } else if (!visible) {
        block.setVisible(false);
      }
    }
  }

  destroy(): void {
    for (const block of this.blocks) block.destroy(true);
  }
}
