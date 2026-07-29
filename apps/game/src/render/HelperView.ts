import Phaser from "phaser";

type HelperVisualState = "hidden" | "entering" | "active" | "exiting";

export class HelperView {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;
  private readonly tail: Phaser.GameObjects.Triangle;
  private readonly beam: Phaser.GameObjects.Rectangle;
  private visualState: HelperVisualState = "hidden";
  private requestedActive = false;
  private targetX = 0;
  private targetY = 0;
  private greetingUntilTick = -1;
  private lastSparkTick = -1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
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
    this.targetX = x;
    this.targetY = y - 72;
    if (active !== this.requestedActive) {
      this.requestedActive = active;
      if (active) {
        this.beginEntrance(tick, reducedMotion);
      } else {
        this.beginExit(reducedMotion);
      }
    }

    if (this.visualState === "hidden") return;

    const motion = reducedMotion ? 0.25 : 1;
    if (this.visualState === "active") {
      const greeting = tick < this.greetingUntilTick;
      const hop = greeting
        ? Math.abs(Math.sin(tick * 0.62)) * (reducedMotion ? 3 : 11)
        : 0;
      this.container.setPosition(
        this.targetX,
        this.targetY + Math.sin(tick * 0.18) * 5 * motion - hop,
      );
      this.tail.rotation =
        Math.sin(tick * (greeting ? 0.72 : 0.35)) *
        (greeting ? (reducedMotion ? 0.42 : 0.9) : 0.5 * motion);
    } else if (this.visualState === "entering") {
      this.tail.rotation = Math.sin(tick * 0.72) * (reducedMotion ? 0.38 : 0.85);
    }

    this.beam.setAlpha(0.35 + Math.abs(Math.sin(tick * 0.22)) * 0.45);
    if (active) this.emitRepairSparks(tick, reducedMotion);
  }

  private beginEntrance(tick: number, reducedMotion: boolean): void {
    this.scene.tweens.killTweensOf(this.container);
    const camera = this.scene.cameras.main;
    this.visualState = "entering";
    this.greetingUntilTick = tick + (reducedMotion ? 6 : 15);
    this.container
      .setVisible(true)
      .setAlpha(reducedMotion ? 0.72 : 0.28)
      .setPosition(camera.worldView.left - 86, this.targetY + (reducedMotion ? 8 : 28));
    this.scene.tweens.add({
      targets: this.container,
      x: this.targetX,
      y: this.targetY,
      alpha: 1,
      duration: reducedMotion ? 140 : 360,
      ease: "Back.easeOut",
      onComplete: () => {
        if (!this.requestedActive) return;
        this.visualState = "active";
      },
    });
  }

  private beginExit(reducedMotion: boolean): void {
    if (this.visualState === "hidden") return;
    this.scene.tweens.killTweensOf(this.container);
    this.visualState = "exiting";
    const exitX = this.scene.cameras.main.worldView.right + 96;
    this.scene.tweens.add({
      targets: this.container,
      x: exitX,
      y: this.container.y - (reducedMotion ? 5 : 28),
      alpha: reducedMotion ? 0.5 : 0.12,
      duration: reducedMotion ? 150 : 340,
      ease: "Quad.easeIn",
      onComplete: () => {
        if (this.requestedActive) return;
        this.visualState = "hidden";
        this.container.setVisible(false).setAlpha(1);
      },
    });
  }

  private emitRepairSparks(tick: number, reducedMotion: boolean): void {
    const interval = reducedMotion ? 30 : 24;
    if (tick % interval !== 0 || tick === this.lastSparkTick) return;
    this.lastSparkTick = tick;

    const count = reducedMotion ? 1 : 4;
    for (let index = 0; index < count; index += 1) {
      const offsetY = (index - (count - 1) / 2) * 7;
      const startX = this.container.x + 43;
      const startY = this.container.y - 3 + offsetY;
      const particle = this.scene.add
        .circle(
          startX,
          startY,
          reducedMotion ? 2.2 : 3,
          index % 2 === 0 ? 0x73fff0 : 0xffd36a,
          0.92,
        )
        .setDepth(29)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: particle,
        x: startX + (reducedMotion ? 48 : 102 + index * 7),
        y: startY + Math.sin(index * 1.8) * (reducedMotion ? 2 : 9),
        alpha: 0,
        scale: 0.35,
        duration: reducedMotion ? 120 : 270,
        ease: "Sine.easeInOut",
        onComplete: () => particle.destroy(),
      });
    }
  }
}
