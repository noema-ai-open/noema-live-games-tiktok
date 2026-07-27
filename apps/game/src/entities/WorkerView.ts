import Phaser from "phaser";
import type { Worker } from "../simulation/types";

const BODY_COLORS = [0x2ee7ff, 0xffa62e, 0x7ef29a, 0xc77dff];

export class WorkerView {
  readonly container: Phaser.GameObjects.Container;
  private readonly shield: Phaser.GameObjects.Arc;
  private readonly body: Phaser.GameObjects.Rectangle;
  private readonly eyeLeft: Phaser.GameObjects.Arc;
  private readonly eyeRight: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, worker: Worker) {
    const color = BODY_COLORS[(worker.id - 1) % BODY_COLORS.length]!;
    this.shield = scene.add
      .circle(0, -5, 18, 0x3ae8ff, 0.12)
      .setStrokeStyle(2, 0x7df5ff, 0.95);
    const antenna = scene.add.rectangle(0, -21, 3, 8, 0x9feaff);
    const antennaTip = scene.add.circle(0, -26, 3, color);
    this.body = scene.add
      .rectangle(0, -4, 24, 25, 0x102b3c)
      .setStrokeStyle(3, color);
    const face = scene.add.rectangle(0, -7, 18, 10, 0x07121e);
    this.eyeLeft = scene.add.circle(-5, -7, 2.6, 0xc8ffff);
    this.eyeRight = scene.add.circle(5, -7, 2.6, 0xc8ffff);
    const legLeft = scene.add.rectangle(-6, 13, 5, 8, color);
    const legRight = scene.add.rectangle(6, 13, 5, 8, color);
    this.container = scene.add.container(worker.x, worker.y, [
      this.shield,
      antenna,
      antennaTip,
      legLeft,
      legRight,
      this.body,
      face,
      this.eyeLeft,
      this.eyeRight,
    ]);
    this.container.setScale(0.78);
    this.container.setDepth(12);
  }

  update(worker: Worker, tick: number): void {
    const visible = worker.state !== "lost" && worker.state !== "rescued";
    this.container.setVisible(visible);
    if (!visible) return;
    this.container.setPosition(worker.x, worker.y);
    this.shield.setVisible(worker.state === "protected");
    this.shield.setAlpha(0.42 + Math.sin(tick * 0.16 + worker.id) * 0.18);
    const walking =
      worker.state === "walking" || worker.state === "protected";
    this.container.rotation = walking
      ? Math.sin(tick * 0.2 + worker.id) * 0.055
      : worker.state === "falling"
        ? tick * 0.06
        : 0;
    this.container.scaleY = worker.state === "blocked" ? 0.68 : 0.78;
    const blink = (tick + worker.id * 7) % 93 < 4;
    this.eyeLeft.scaleY = blink ? 0.25 : 1;
    this.eyeRight.scaleY = blink ? 0.25 : 1;
    this.body.setFillStyle(
      worker.state === "falling" ? 0x3b1422 : 0x102b3c,
    );
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
