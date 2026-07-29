import Phaser from "phaser";
import { LOGICAL_WIDTH } from "../config/gameConfig";
import type { SimulationState } from "../simulation/types";

const COLORS = [0x65f4df, 0xff65b5, 0xffd36a, 0x9d78ff, 0xffffff] as const;

/** Deterministic, asset-free level-end celebration for the stream view. */
export class LevelCelebrationRenderer {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(88);
    this.title = scene.add
      .text(LOGICAL_WIDTH / 2, 104, "", {
        fontFamily: "Inter, Arial Black, sans-serif",
        fontSize: "34px",
        fontStyle: "bold",
        color: "#ffffff",
        stroke: "#07111f",
        strokeThickness: 8,
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(89)
      .setVisible(false);
  }

  update(state: SimulationState): void {
    this.graphics.clear();
    this.title.setVisible(state.levelCelebration.active);
    if (!state.levelCelebration.active) return;

    this.title.setText(
      state.levelIndex + 1 === state.levelCount
        ? "HIMMELSLEUCHTFEUER AKTIVIERT"
        : `LEVEL ${state.levelIndex + 1} GESCHAFFT`,
    );

    const elapsed = Math.max(0, state.tick - state.levelCelebration.startedTick);
    const burstCount = state.reducedMotion ? 3 : 7;
    for (let index = 0; index < burstCount; index += 1) {
      const delay = index * 12;
      const age = Math.max(0, elapsed - delay);
      if (age <= 0 || age > 72) continue;
      const progress = age / 72;
      const centerX = 80 + ((index * 137 + state.seed) % 560);
      const centerY = 170 + ((index * 83 + state.seed) % 280);
      const radius = (state.reducedMotion ? 28 : 92) * Math.sin(Math.PI * progress);
      const alpha = Math.max(0, 1 - progress);
      const rays = state.reducedMotion ? 6 : 14;
      for (let ray = 0; ray < rays; ray += 1) {
        const angle = (Math.PI * 2 * ray) / rays + index * 0.37;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        const color = COLORS[(index + ray) % COLORS.length]!;
        this.graphics.fillStyle(color, alpha);
        this.graphics.fillCircle(x, y, state.reducedMotion ? 3 : 4.5);
        if (!state.reducedMotion) {
          this.graphics.lineStyle(2, color, alpha * 0.55);
          this.graphics.lineBetween(
            centerX + Math.cos(angle) * radius * 0.45,
            centerY + Math.sin(angle) * radius * 0.45,
            x,
            y,
          );
        }
      }
    }
  }
}
