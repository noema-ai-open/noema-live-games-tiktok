import Phaser from "phaser";
import type { HeroSnapshot } from "../adventure/HeroController";
import { WORLD_GROUND_Y } from "../config/gameConfig";

const VISUAL_GROUND_OFFSET = 12;

/**
 * Procedural placeholder for NURI.
 *
 * The hero is intentionally assembled from simple Phaser primitives so the
 * adventure remains fully playable before the final sprite sheet exists. The
 * silhouette reads as a small explorer rather than as the old swarm robot and
 * every part can later be replaced by a texture without touching gameplay.
 */
export class HeroView {
  readonly container: Phaser.GameObjects.Container;

  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly backpack: Phaser.GameObjects.Rectangle;
  private readonly backpackCore: Phaser.GameObjects.Arc;
  private readonly scarfTail: Phaser.GameObjects.Rectangle;
  private readonly body: Phaser.GameObjects.Rectangle;
  private readonly belt: Phaser.GameObjects.Rectangle;
  private readonly hood: Phaser.GameObjects.Arc;
  private readonly face: Phaser.GameObjects.Arc;
  private readonly hair: Phaser.GameObjects.Ellipse;
  private readonly leftArm: Phaser.GameObjects.Rectangle;
  private readonly rightArm: Phaser.GameObjects.Rectangle;
  private readonly leftGlove: Phaser.GameObjects.Arc;
  private readonly rightGlove: Phaser.GameObjects.Arc;
  private readonly leftLeg: Phaser.GameObjects.Rectangle;
  private readonly rightLeg: Phaser.GameObjects.Rectangle;
  private readonly leftBoot: Phaser.GameObjects.Rectangle;
  private readonly rightBoot: Phaser.GameObjects.Rectangle;
  private readonly core: Phaser.GameObjects.Arc;
  private readonly eyes: Phaser.GameObjects.Arc[];
  private readonly leftLens: Phaser.GameObjects.Arc;
  private readonly rightLens: Phaser.GameObjects.Arc;
  private readonly goggleBand: Phaser.GameObjects.Rectangle;
  private readonly mouth: Phaser.GameObjects.Arc;
  private readonly antenna: Phaser.GameObjects.Rectangle;
  private readonly antennaLight: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene) {
    this.shadow = scene.add.ellipse(0, 4, 72, 18, 0x02080c, 0.46);

    this.scarfTail = scene.add
      .rectangle(-34, -79, 42, 10, 0xff5fa8)
      .setOrigin(0.9, 0.5)
      .setStrokeStyle(2, 0xffa4cd, 0.7);

    this.backpack = scene.add
      .rectangle(-27, -61, 30, 56, 0x102c40)
      .setStrokeStyle(3, 0x35dfe5, 0.85);
    this.backpackCore = scene.add
      .circle(-33, -62, 11, 0x123b55)
      .setStrokeStyle(4, 0x6dfff0, 0.95);

    this.leftLeg = scene.add.rectangle(-13, -24, 14, 34, 0x244a5c).setOrigin(0.5, 0);
    this.rightLeg = scene.add.rectangle(13, -24, 14, 34, 0x2b6170).setOrigin(0.5, 0);
    this.leftBoot = scene.add
      .rectangle(-17, 8, 25, 13, 0x10222c)
      .setOrigin(0.5, 0.5)
      .setStrokeStyle(2, 0x58e5dc, 0.45);
    this.rightBoot = scene.add
      .rectangle(17, 8, 25, 13, 0x10222c)
      .setOrigin(0.5, 0.5)
      .setStrokeStyle(2, 0x58e5dc, 0.45);

    this.leftArm = scene.add
      .rectangle(-31, -66, 13, 43, 0x1c8192)
      .setOrigin(0.5, 0.14)
      .setStrokeStyle(2, 0x59eee4, 0.55);
    this.rightArm = scene.add
      .rectangle(31, -66, 13, 43, 0x24a2a3)
      .setOrigin(0.5, 0.14)
      .setStrokeStyle(2, 0x62f8de, 0.55);
    this.leftGlove = scene.add.circle(-31, -27, 8, 0xffd0ad).setStrokeStyle(2, 0xfff0d8, 0.8);
    this.rightGlove = scene.add.circle(31, -27, 8, 0xffd0ad).setStrokeStyle(2, 0xfff0d8, 0.8);

    this.body = scene.add
      .rectangle(0, -58, 58, 64, 0x0b394d)
      .setStrokeStyle(4, 0x4ce9df, 0.88);
    this.belt = scene.add.rectangle(0, -33, 54, 10, 0x12232f).setStrokeStyle(2, 0xffd16d, 0.8);
    this.core = scene.add
      .circle(0, -59, 14, 0xffc95c)
      .setStrokeStyle(4, 0x76fff0, 0.95);

    this.hood = scene.add
      .circle(0, -105, 37, 0x0c4a60)
      .setStrokeStyle(5, 0x39e0de, 0.95);
    this.face = scene.add
      .circle(0, -102, 28, 0xffd8b8)
      .setStrokeStyle(2, 0xfff1dc, 0.8);
    this.hair = scene.add
      .ellipse(-4, -120, 42, 20, 0x3b2534)
      .setRotation(-0.12);

    this.goggleBand = scene.add.rectangle(0, -126, 59, 8, 0x18242f).setStrokeStyle(2, 0x55e8e1, 0.7);
    this.leftLens = scene.add
      .circle(-17, -128, 12, 0x164c68, 0.92)
      .setStrokeStyle(4, 0x7bfff4, 0.95);
    this.rightLens = scene.add
      .circle(17, -128, 12, 0x164c68, 0.92)
      .setStrokeStyle(4, 0x7bfff4, 0.95);

    const leftEye = scene.add.circle(-9, -101, 4, 0x10202b);
    const rightEye = scene.add.circle(9, -101, 4, 0x10202b);
    this.eyes = [leftEye, rightEye];
    this.mouth = scene.add.arc(0, -89, 6, 12, 168, false, 0x9a3954);

    this.antenna = scene.add.rectangle(24, -151, 4, 16, 0x43ecdf).setOrigin(0.5, 1);
    this.antennaLight = scene.add
      .circle(24, -154, 5, 0xff5fb3)
      .setStrokeStyle(2, 0xffffff, 0.82);

    this.container = scene.add.container(120, WORLD_GROUND_Y, [
      this.shadow,
      this.scarfTail,
      this.backpack,
      this.backpackCore,
      this.leftLeg,
      this.rightLeg,
      this.leftBoot,
      this.rightBoot,
      this.leftArm,
      this.rightArm,
      this.leftGlove,
      this.rightGlove,
      this.body,
      this.belt,
      this.core,
      this.hood,
      this.face,
      this.hair,
      this.goggleBand,
      this.leftLens,
      this.rightLens,
      leftEye,
      rightEye,
      this.mouth,
      this.antenna,
      this.antennaLight,
    ]);
    this.container.setDepth(30);
  }

  update(hero: HeroSnapshot, tick: number, reducedMotion: boolean): void {
    const visualY = hero.y - VISUAL_GROUND_OFFSET;
    this.container.setPosition(hero.x, visualY);
    this.container.setScale(hero.facing, 1);

    const motion = reducedMotion ? 0.35 : 1;
    const phase = tick * 0.34;
    this.resetPose();

    switch (hero.animation) {
      case "run": {
        const swing = Math.sin(phase) * 0.68 * motion;
        this.leftLeg.rotation = swing;
        this.rightLeg.rotation = -swing;
        this.leftBoot.rotation = swing * 0.55;
        this.rightBoot.rotation = -swing * 0.55;
        this.leftArm.rotation = -swing * 0.78;
        this.rightArm.rotation = swing * 0.78;
        this.scarfTail.rotation = -0.18 + Math.sin(phase * 0.7) * 0.1 * motion;
        this.container.y = visualY - Math.abs(Math.sin(phase)) * 4 * motion;
        break;
      }
      case "jump":
        this.leftLeg.rotation = -0.58;
        this.rightLeg.rotation = 0.58;
        this.leftBoot.rotation = 0.2;
        this.rightBoot.rotation = -0.2;
        this.leftArm.rotation = -1.75;
        this.rightArm.rotation = 1.75;
        this.scarfTail.rotation = -0.55;
        break;
      case "climb":
        this.leftArm.rotation = Math.sin(phase) * 0.72 - 0.72;
        this.rightArm.rotation = -Math.sin(phase) * 0.72 + 0.72;
        this.leftLeg.rotation = -this.rightArm.rotation * 0.62;
        this.rightLeg.rotation = -this.leftArm.rotation * 0.62;
        break;
      case "point":
        this.rightArm.rotation = -1.48;
        this.rightGlove.y = -66;
        this.hood.rotation = -0.1;
        break;
      case "fall":
        this.leftArm.rotation = -1.25;
        this.rightArm.rotation = 1.25;
        this.leftLeg.rotation = 0.58;
        this.rightLeg.rotation = -0.58;
        this.scarfTail.rotation = -1.05;
        this.container.rotation = Math.sin(phase * 0.45) * 0.13 * motion;
        break;
      case "celebrate":
        this.leftArm.rotation = -2.58;
        this.rightArm.rotation = 2.58;
        this.mouth.setScale(1.35);
        this.container.y = visualY - Math.abs(Math.sin(phase * 0.65)) * 12 * motion;
        break;
      case "scared":
      case "bomb_reaction":
        this.leftArm.rotation = -1.92;
        this.rightArm.rotation = 1.92;
        this.hood.rotation = Math.sin(phase * 1.2) * 0.05 * motion;
        this.antenna.rotation = Math.sin(phase * 1.8) * 0.18 * motion;
        break;
      case "push":
        this.leftArm.rotation = -1.32;
        this.rightArm.rotation = -1.32;
        this.container.rotation = 0.08;
        break;
      case "land":
        this.leftLeg.rotation = -0.28;
        this.rightLeg.rotation = 0.28;
        this.body.y = -52;
        this.hood.y = -101;
        break;
      default:
        this.container.y = visualY + Math.sin(phase * 0.22) * 2.5 * motion;
        this.hood.rotation = Math.sin(phase * 0.16) * 0.035 * motion;
        this.scarfTail.rotation = -0.08 + Math.sin(phase * 0.15) * 0.05 * motion;
    }

    const blink = tick % 92 < 4;
    for (const eye of this.eyes) eye.setScale(1, blink ? 0.16 : 1);
    this.core.setAlpha(0.82 + Math.abs(Math.sin(tick * 0.08)) * 0.18);
    this.backpackCore.setAlpha(0.64 + Math.abs(Math.sin(tick * 0.065 + 1)) * 0.34);
    this.antennaLight.setAlpha(0.72 + Math.abs(Math.sin(tick * 0.12)) * 0.28);
    this.shadow.setScale(
      1 - Math.min(0.45, Math.max(0, (WORLD_GROUND_Y - hero.y) / 420)),
      1,
    );
  }

  private resetPose(): void {
    this.container.rotation = 0;
    this.shadow.y = 4 + VISUAL_GROUND_OFFSET;
    this.body.y = -58;
    this.hood.y = -105;
    this.hood.rotation = 0;
    this.antenna.rotation = 0;
    this.scarfTail.rotation = -0.08;
    this.leftArm.rotation = 0.12;
    this.rightArm.rotation = -0.12;
    this.leftLeg.rotation = 0;
    this.rightLeg.rotation = 0;
    this.leftBoot.rotation = 0;
    this.rightBoot.rotation = 0;
    this.leftGlove.y = -27;
    this.rightGlove.y = -27;
    this.mouth.setScale(1);
  }
}
