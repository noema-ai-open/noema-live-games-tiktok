import Phaser from "phaser";
import type { AdventureLevel, LevelSegment } from "../adventure/levelTypes";
import { LOGICAL_HEIGHT } from "../config/gameConfig";

export class EnvironmentRenderer {
  private readonly far: Phaser.GameObjects.Container;
  private readonly middle: Phaser.GameObjects.Container;
  private readonly ground: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, level: AdventureLevel) {
    this.far = scene.add.container(0, 0).setDepth(-20).setScrollFactor(0.16, 1);
    this.middle = scene.add.container(0, 0).setDepth(-10).setScrollFactor(0.42, 1);
    this.ground = scene.add.container(0, 0).setDepth(0);

    this.drawSky(scene, level);
    this.drawMountains(scene, level);
    this.drawGround(scene, level.segments);
    this.drawLandmarks(scene, level);
  }

  update(cameraScrollX: number, tick: number, reducedMotion: boolean): void {
    const drift = reducedMotion ? 0 : Math.sin(tick * 0.004) * 6;
    this.far.y = drift;
    this.middle.y = -drift * 0.35;
    void cameraScrollX;
  }

  private drawSky(scene: Phaser.Scene, level: AdventureLevel): void {
    const sky = scene.add.graphics();
    sky.fillGradientStyle(0x07111f, 0x07111f, 0x122d3c, 0x122d3c, 1);
    sky.fillRect(-800, 0, level.finishX + 2200, LOGICAL_HEIGHT);
    this.far.add(sky);

    const stars = scene.add.graphics();
    stars.fillStyle(0x8dfcff, 0.5);
    for (let index = 0; index < 90; index += 1) {
      const x = (index * 347) % (level.finishX + 1400);
      const y = 40 + ((index * 83) % 280);
      stars.fillCircle(x, y, index % 7 === 0 ? 2 : 1);
    }
    this.far.add(stars);
  }

  private drawMountains(scene: Phaser.Scene, level: AdventureLevel): void {
    const farMountains = scene.add.graphics();
    farMountains.fillStyle(0x102a3b, 1);
    for (let x = -400; x < level.finishX + 1600; x += 620) {
      farMountains.fillTriangle(x, 630, x + 330, 190 + ((x / 10) % 150), x + 720, 630);
    }
    this.far.add(farMountains);

    const nearMountains = scene.add.graphics();
    nearMountains.fillStyle(0x173744, 0.95);
    for (let x = -260; x < level.finishX + 1000; x += 460) {
      nearMountains.fillTriangle(x, 680, x + 220, 370 + ((x / 8) % 100), x + 520, 680);
    }
    this.middle.add(nearMountains);

    const trees = scene.add.graphics();
    for (let x = 620; x < 3300; x += 120) {
      trees.fillStyle(x % 240 === 0 ? 0x1b5a55 : 0x153f48, 0.85);
      trees.fillTriangle(x, 660, x + 35, 480 - ((x / 20) % 55), x + 70, 660);
      trees.fillStyle(0x43e3cf, 0.12);
      trees.fillCircle(x + 35, 510, 42);
    }
    this.middle.add(trees);
  }

  private drawGround(scene: Phaser.Scene, segments: LevelSegment[]): void {
    const graphics = scene.add.graphics();
    for (const segment of segments) {
      graphics.fillStyle(segment.section >= 4 ? 0x17313b : 0x1d3b3d, 1);
      graphics.lineStyle(5, segment.section >= 4 ? 0x65e7d2 : 0x4ac5bd, 0.72);
      const top = segment.groundY;
      const drawPlatform = (start: number, end: number, platformTop = top): void => {
        graphics.fillRect(start, platformTop, Math.max(0, end - start), LOGICAL_HEIGHT - platformTop);
        graphics.lineBetween(start, platformTop, end, platformTop);
      };

      if (["small_gap", "broken_bridge", "ravine"].includes(segment.type)) {
        const waitX = segment.waitX ?? segment.startX + segment.length * 0.35;
        const landingX = segment.landingX ?? segment.endX - segment.length * 0.2;
        drawPlatform(segment.startX, waitX + 20);
        drawPlatform(landingX - 20, segment.endX);
      } else if (segment.type === "high_ledge") {
        const waitX = segment.waitX ?? segment.startX + 120;
        drawPlatform(segment.startX, waitX + 20, top);
        drawPlatform(segment.landingX ?? waitX + 180, segment.endX, top - 60);
      } else {
        drawPlatform(segment.startX, segment.endX);
      }
    }
    this.ground.add(graphics);
  }

  private drawLandmarks(scene: Phaser.Scene, level: AdventureLevel): void {
    const landmarks = scene.add.graphics();
    landmarks.fillStyle(0x0b2634, 1);
    landmarks.fillRoundedRect(80, 520, 210, 130, 14);
    landmarks.lineStyle(3, 0x50e6e1, 0.8);
    landmarks.strokeRoundedRect(80, 520, 210, 130, 14);
    landmarks.fillStyle(0xffd36a, 0.85);
    landmarks.fillCircle(185, 562, 14);

    landmarks.fillStyle(0x142a3a, 1);
    landmarks.fillRect(level.finishX - 70, 260, 90, 260);
    landmarks.lineStyle(5, 0xff66bf, 0.85);
    landmarks.lineBetween(level.finishX - 25, 260, level.finishX - 25, 150);
    landmarks.fillStyle(0x7ffff0, 0.25);
    landmarks.fillCircle(level.finishX - 25, 150, 54);
    landmarks.fillStyle(0xffffff, 0.9);
    landmarks.fillCircle(level.finishX - 25, 150, 12);
    this.ground.add(landmarks);
  }
}
