import Phaser from "phaser";
import type { HeroSnapshot } from "../adventure/HeroController";
import { WORLD_GROUND_Y } from "../config/gameConfig";

export class HeroView {
  readonly container: Phaser.GameObjects.Container;

  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly body: Phaser.GameObjects.Rectangle;
  private readonly head: Phaser.GameObjects.Arc;
  private readonly leftArm: Phaser.GameObjects.Rectangle;
  private readonly rightArm: Phaser.GameObjects.Rectangle;
  private readonly leftLeg: Phaser.GameObjects.Rectangle;
  private readonly rightLeg: Phaser.GameObjects.Rectangle;
  private readonly core: Phaser.GameObjects.Arc;
  private readonly eyes: Phaser.GameObjects.Rectangle[];
  private readonly antenna: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    this.shadow = scene.add.ellipse(0, 2, 58, 14, 0x02080c, 0.42);
    this.leftLeg = scene.add.rectangle(-12, -22, 12, 30, 0x183b4d).setOrigin(0.5, 0);
    this.rightLeg = scene.add.rectangle(12, -22, 12, 30, 0x1d5064).setOrigin(0.5, 0);
    this.leftArm = scene.add.rectangle(-29, -63, 11, 38, 0x32d8dc).setOrigin(0.5, 0.15);
    this.rightArm = scene.add.rectangle(29, -63, 11, 38, 0x46f1d7).setOrigin(0.5, 0.15);
    this.body = scene.add
      .rectangle(0, -55, 52, 58, 0x0d3243)
      .setStrokeStyle(3, 0x43ecdf, 0.9);
    this.core = scene.add
      .circle(0, -55, 13, 0xffd36a)
      .setStrokeStyle(4, 0x5dfff0, 0.9);
    this.head = scene.add
      .circle(0, -99, 29, 0xe8f7ee)
      .setStrokeStyle(4, 0x1dd7dd, 1);
    const leftEye = scene.add.rectangle(-10, -101, 6, 11, 0x07161c);
    const rightEye = scene.add.rectangle(10, -101, 6, 11, 0x07161c);
    this.eyes = [leftEye, rightEye];
    this.antenna = scene.add.rectangle(0, -136, 5, 20, 0x43ecdf).setOrigin(0.5, 1);
    const antennaLight = scene.add
      .circle(0, -140, 6, 0xff5fb3)
      .setStrokeStyle(2, 0xffffff, 0.8);

    this.container = scene.add.container(120, WORLD_GROUND_Y, [
      this.shadow,
      this.leftLeg,
      this.rightLeg,
      this.leftArm,
      this.rightArm,
      this.body,
      this.core,
      this.head,
      leftEye,
      rightEye,
      this.antenna,
      antennaLight,
    ]);
    this.container.setDepth(30);
  }

  update(hero: HeroSnapshot, tick: number, reducedMotion: boolean): void {
    this.container.setPosition(hero.x, hero.y);
    this.container.setScale(hero.facing, 1);

    const motion = reducedMotion ? 0.35 : 1;
    const phase = tick * 0.34;
    this.resetPose();

    switch (hero.animation) {
      case "run": {
        const swing = Math.sin(phase) * 0.65 * motion;
        this.leftLeg.rotation = swing;
        this.rightLeg.rotation = -swing;
        this.leftArm.rotation = -swing * 0.75;
        this.rightArm.rotation = swing * 0.75;
        this.container.y = hero.y + Math.abs(Math.sin(phase)) * -3 * motion;
        break;
      }
      case "jump":
        this.leftLeg.rotation = -0.55;
        this.rightLeg.rotation = 0.55;
        this.leftArm.rotation = -1.7;
        this.rightArm.rotation = 1.7;
        break;
      case "climb":
        this.leftArm.rotation = Math.sin(phase) * 0.7 - 0.7;
        this.rightArm.rotation = -Math.sin(phase) * 0.7 + 0.7;
        this.leftLeg.rotation = -this.rightArm.rotation * 0.6;
        this.rightLeg.rotation = -this.leftArm.rotation * 0.6;
        break;
      case "point":
        this.rightArm.rotation = -1.45;
        this.head.rotation = -0.12;
        break;
      case "fall":
        this.leftArm.rotation = -1.2;
        this.rightArm.rotation = 1.2;
        this.leftLeg.rotation = 0.55;
        this.rightLeg.rotation = -0.55;
        this.container.rotation = Math.sin(phase * 0.45) * 0.12 * motion;
        break;
      case "celebrate":
        this.leftArm.rotation = -2.6;
        this.rightArm.rotation = 2.6;
        this.container.y = hero.y - Math.abs(Math.sin(phase * 0.65)) * 10 * motion;
        break;
      case "scared":
      case "bomb_reaction":
        this.leftArm.rotation = -1.9;
        this.rightArm.rotation = 1.9;
        this.antenna.rotation = Math.sin(phase * 1.8) * 0.16 * motion;
        break;
      case "push":
        this.leftArm.rotation = -1.3;
        this.rightArm.rotation = -1.3;
        this.container.rotation = 0.08;
        break;
      case "land":
        this.leftLeg.rotation = -0.25;
        this.rightLeg.rotation = 0.25;
        this.body.y = -50;
        break;
      default:
        this.container.y = hero.y + Math.sin(phase * 0.22) * 2 * motion;
        this.head.rotation = Math.sin(phase * 0.16) * 0.035 * motion;
    }

    const blink = tick % 92 < 4;
    for (const eye of this.eyes) eye.setScale(1, blink ? 0.15 : 1);
    this.core.setAlpha(0.8 + Math.abs(Math.sin(tick * 0.08)) * 0.2);
    this.shadow.setScale(
      1 - Math.min(0.45, Math.max(0, (WORLD_GROUND_Y - hero.y) / 420)),
      1,
    );
  }

  private resetPose(): void {
    this.container.rotation = 0;
    this.body.y = -55;
    this.head.rotation = 0;
    this.antenna.rotation = 0;
    this.leftArm.rotation = 0.12;
    this.rightArm.rotation = -0.12;
    this.leftLeg.rotation = 0;
    this.rightLeg.rotation = 0;
  }
}
