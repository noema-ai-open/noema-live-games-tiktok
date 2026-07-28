import Phaser from "phaser";
import type { Worker } from "../simulation/types";
import { PALETTE, ROBOT_ACCENTS, ROBOT_SHELLS } from "./palette";
import { TEXTURE_KEYS } from "./textures";

export type WorkerRenderContext = {
  reducedMotion: boolean;
  /** True while a catastrophe warning or impact is running. */
  alarm: boolean;
};

/**
 * One NOEMA construction robot.
 *
 * Four original variants (technician, hauler, scout, engineer) differ in shell
 * colour, accent, head shape and tool module so a 30-robot swarm stays
 * readable at phone size. Animation is procedural — no sprite sheets, no
 * skeletal rig — and driven only by simulation state plus the tick counter.
 */
export class WorkerSprite {
  readonly container: Phaser.GameObjects.Container;

  private readonly variant: number;
  private readonly accent: number;
  private readonly shield: Phaser.GameObjects.Arc;
  private readonly shieldRing: Phaser.GameObjects.Arc;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly body: Phaser.GameObjects.Graphics;
  private readonly head: Phaser.GameObjects.Graphics;
  private readonly eyeLeft: Phaser.GameObjects.Arc;
  private readonly eyeRight: Phaser.GameObjects.Arc;
  private readonly legLeft: Phaser.GameObjects.Rectangle;
  private readonly legRight: Phaser.GameObjects.Rectangle;
  private readonly armLeft: Phaser.GameObjects.Rectangle;
  private readonly armRight: Phaser.GameObjects.Rectangle;
  private readonly tool: Phaser.GameObjects.Graphics;
  private readonly alertMark: Phaser.GameObjects.Text;
  private spawnFlash = 1;

  constructor(scene: Phaser.Scene, worker: Worker) {
    this.variant = (worker.id - 1) % ROBOT_ACCENTS.length;
    this.accent = ROBOT_ACCENTS[this.variant]!;
    const shell = ROBOT_SHELLS[this.variant]!;

    this.glow = scene.add
      .image(0, 0, TEXTURE_KEYS.glow)
      .setDisplaySize(52, 52)
      .setTint(this.accent)
      .setAlpha(0.3);
    this.glow.setBlendMode(Phaser.BlendModes.ADD);

    this.shield = scene.add.circle(0, -6, 21, this.accent, 0.1);
    this.shieldRing = scene.add
      .circle(0, -6, 21)
      .setStrokeStyle(2.5, PALETTE.energySoft, 0.95);

    this.legLeft = scene.add.rectangle(-6, 14, 6, 10, shell);
    this.legRight = scene.add.rectangle(6, 14, 6, 10, shell);
    this.armLeft = scene.add.rectangle(-13, 0, 5, 13, this.accent);
    this.armRight = scene.add.rectangle(13, 0, 5, 13, this.accent);

    this.body = scene.add.graphics();
    this.drawBody(shell);

    this.head = scene.add.graphics();
    this.drawHead(shell);

    this.eyeLeft = scene.add.circle(-5, -13, 3.1, 0xffffff, 1);
    this.eyeRight = scene.add.circle(5, -13, 3.1, 0xffffff, 1);

    this.tool = scene.add.graphics();
    this.drawTool();

    this.alertMark = scene.add
      .text(0, -34, "!", {
        fontFamily: "Inter, Arial Black, sans-serif",
        fontStyle: "bold",
        fontSize: "18px",
        color: "#ff5c6e",
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.container = scene.add.container(worker.x, worker.y, [
      this.glow,
      this.shield,
      this.shieldRing,
      this.armLeft,
      this.armRight,
      this.legLeft,
      this.legRight,
      this.body,
      this.head,
      this.eyeLeft,
      this.eyeRight,
      this.tool,
      this.alertMark,
    ]);
    this.container.setDepth(20);
    this.container.setScale(0.95);
  }

  private drawBody(shell: number): void {
    const g = this.body;
    g.fillStyle(shell, 1);
    g.fillRoundedRect(-11, -8, 22, 22, 6);
    // Chest light — the strongest small-scale readability cue.
    g.fillStyle(this.accent, 0.95);
    g.fillRoundedRect(-6, -3, 12, 6, 3);
    g.lineStyle(2, this.accent, 0.9);
    g.strokeRoundedRect(-11, -8, 22, 22, 6);
    // Shoulder plate distinguishes the hauler variant.
    if (this.variant === 1) {
      g.fillStyle(this.accent, 0.75);
      g.fillRoundedRect(-14, -8, 28, 5, 2);
    }
  }

  private drawHead(shell: number): void {
    const g = this.head;
    if (this.variant === 2) {
      // Scout: narrow visor dome.
      g.fillStyle(shell, 1);
      g.fillEllipse(0, -13, 22, 18);
      g.lineStyle(2, this.accent, 0.9);
      g.strokeEllipse(0, -13, 22, 18);
    } else {
      g.fillStyle(shell, 1);
      g.fillRoundedRect(-11, -22, 22, 18, 6);
      g.lineStyle(2, this.accent, 0.9);
      g.strokeRoundedRect(-11, -22, 22, 18, 6);
    }
    // Visor.
    g.fillStyle(0x02070d, 1);
    g.fillRoundedRect(-8, -17, 16, 9, 4);
  }

  private drawTool(): void {
    const g = this.tool;
    g.lineStyle(2, this.accent, 0.95);
    if (this.variant === 0) {
      // Technician: antenna with tip.
      g.lineBetween(0, -22, 0, -31);
      g.fillStyle(this.accent, 1);
      g.fillCircle(0, -33, 3);
    } else if (this.variant === 1) {
      // Hauler: back-mounted carry frame.
      g.strokeRoundedRect(-15, -6, 5, 14, 2);
    } else if (this.variant === 2) {
      // Scout: side sensor fin.
      g.lineBetween(9, -20, 17, -26);
    } else {
      // Engineer: welding arm.
      g.lineBetween(13, 2, 20, 8);
      g.fillStyle(PALETTE.warn, 1);
      g.fillCircle(21, 9, 2.5);
    }
  }

  update(worker: Worker, tick: number, context: WorkerRenderContext): void {
    const hidden = worker.state === "lost" || worker.state === "rescued";
    this.container.setVisible(!hidden);
    if (hidden) return;

    this.container.setPosition(worker.x, worker.y);

    const motion = context.reducedMotion ? 0.35 : 1;
    const phase = tick * 0.24 + worker.id * 1.7;
    const protectedNow = worker.state === "protected";

    // Spawn: quick scale-in plus a bright flash on the chest light. A round
    // reset reuses this sprite, so the fall rotation is cleared here too.
    if (worker.state === "spawning") {
      this.spawnFlash = 1;
      this.container.rotation = 0;
    } else if (this.spawnFlash > 0) {
      this.spawnFlash = Math.max(0, this.spawnFlash - 0.06);
    }
    const spawnScale = 0.95 + this.spawnFlash * 0.35;

    this.shield.setVisible(protectedNow);
    this.shieldRing.setVisible(protectedNow);
    if (protectedNow) {
      const pulse = 0.55 + Math.sin(phase * 0.6) * 0.25 * motion;
      this.shieldRing.setAlpha(pulse);
      this.shield.setAlpha(0.08 + pulse * 0.12);
      this.shieldRing.setScale(1 + Math.sin(phase * 0.4) * 0.06 * motion);
    }

    this.glow.setAlpha(
      protectedNow ? 0.5 : worker.state === "falling" ? 0.55 : 0.28,
    );
    this.glow.setTint(
      worker.state === "falling" ? PALETTE.danger : this.accent,
    );

    switch (worker.state) {
      case "walking":
      case "protected": {
        const step = Math.sin(phase) * 4 * motion;
        this.legLeft.y = 14 + Math.max(0, step);
        this.legRight.y = 14 + Math.max(0, -step);
        this.armLeft.rotation = -step * 0.06;
        this.armRight.rotation = step * 0.06;
        this.container.rotation = Math.sin(phase * 0.5) * 0.04 * motion;
        this.container.setScale(spawnScale, spawnScale);
        this.alertMark.setVisible(false);
        break;
      }
      case "blocked": {
        // Waiting/blocked: crouch, arms up, alert mark.
        this.legLeft.y = 15;
        this.legRight.y = 15;
        this.armLeft.rotation = -0.9;
        this.armRight.rotation = 0.9;
        this.container.rotation = 0;
        this.container.setScale(spawnScale * 1.04, spawnScale * 0.86);
        this.alertMark.setVisible(true);
        this.alertMark.setAlpha(0.5 + Math.sin(tick * 0.3) * 0.5);
        break;
      }
      case "jumping": {
        this.legLeft.y = 12;
        this.legRight.y = 12;
        this.armLeft.rotation = -1.5;
        this.armRight.rotation = 1.5;
        this.container.rotation = 0;
        this.container.setScale(spawnScale * 0.9, spawnScale * 1.14);
        this.alertMark.setVisible(false);
        break;
      }
      case "falling": {
        this.legLeft.y = 16;
        this.legRight.y = 16;
        this.armLeft.rotation = -2.2;
        this.armRight.rotation = 2.2;
        this.container.rotation += context.reducedMotion ? 0.04 : 0.14;
        this.container.setScale(spawnScale);
        this.alertMark.setVisible(true);
        this.alertMark.setAlpha(1);
        break;
      }
      case "spawning": {
        this.container.setScale(spawnScale);
        this.container.rotation = 0;
        this.alertMark.setVisible(false);
        break;
      }
      default:
        break;
    }

    // Blink, and a startled wide-eye while a catastrophe warning runs.
    const blink = (tick + worker.id * 9) % 104 < 4;
    const startled = context.alarm && worker.state !== "falling";
    const eyeScale = blink ? 0.18 : startled ? 1.35 : 1;
    this.eyeLeft.setScale(eyeScale);
    this.eyeRight.setScale(eyeScale);
    const eyeColor = startled
      ? PALETTE.danger
      : worker.state === "falling"
        ? PALETTE.danger
        : 0xffffff;
    this.eyeLeft.setFillStyle(eyeColor, 1);
    this.eyeRight.setFillStyle(eyeColor, 1);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
