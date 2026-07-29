import Phaser from "phaser";

export class HelperView {
  private readonly container: Phaser.GameObjects.Container;
  private readonly tail: Phaser.GameObjects.Triangle;
  private readonly beam: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    const body = scene.add
      .ellipse(0, 0, 64, 38, 0xffa938, 1)
      .setStrokeStyle(3, 0xeffff8, 0.9);
    const head = scene.add
      .circle(28, -15, 22, 0xffc05c, 1)
      .setStrokeStyle(3, 0xeffff8, 0.9);
    const earA = scene.add.triangle(15, -39, 0, 18, 12, 0, 22, 20, 0xff8e2a);
    const earB = scene.add.triangle(40, -42, 0, 20, 11, 0, 22, 20, 0xff8e2a);
    const eye = scene.add.circle(35, -18, 4, 0x07161c);
    this.tail = scene.add.triangle(-39, -5, 0, 8, 28, 0, 0, -8, 0xffa938);
    this.beam = scene.add.rectangle(68, 1, 78, 8, 0x73fff0, 0.65).setOrigin(0, 0.5);
    this.container = scene.add
      .container(0, 0, [this.tail, body, head, earA, earB, eye, this.beam])
      .setDepth(28)
      .setVisible(false);
  }

  update(
    active: boolean,
    x: number,
    y: number,
    tick: number,
    reducedMotion: boolean,
  ): void {
    this.container.setVisible(active).setPosition(x, y - 72);
    if (!active) return;
    const motion = reducedMotion ? 0.25 : 1;
    this.container.y += Math.sin(tick * 0.18) * 5 * motion;
    this.tail.rotation = Math.sin(tick * 0.35) * 0.5 * motion;
    this.beam.setAlpha(0.35 + Math.abs(Math.sin(tick * 0.22)) * 0.45);
  }
}
