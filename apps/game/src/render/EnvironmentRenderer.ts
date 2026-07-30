import Phaser from "phaser";
import type { AdventureLevel, LevelSegment } from "../adventure/levelTypes";
import { WORLD_RENDER_HEIGHT } from "../config/gameConfig";

/**
 * Layered PNG scenery with deterministic Phaser gameplay surfaces on top.
 *
 * The images provide atmosphere only. Ground height, gaps and collisions still
 * come exclusively from the level segments.
 */
export class EnvironmentRenderer {
  private readonly far: Phaser.GameObjects.Container;
  private readonly middle: Phaser.GameObjects.Container;
  private readonly ground: Phaser.GameObjects.Container;
  private readonly atmosphere: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, level: AdventureLevel) {
    this.far = scene.add.container(0, 0).setDepth(-30).setScrollFactor(0.14, 1);
    this.middle = scene.add.container(0, 0).setDepth(-18).setScrollFactor(0.4, 1);
    this.atmosphere = scene.add.container(0, 0).setDepth(-8).setScrollFactor(0.72, 1);
    this.ground = scene.add.container(0, 0).setDepth(0);

    const usesPaintedBackground = this.drawBackgroundArt(scene, level);
    this.drawSky(scene, level);
    if (!usesPaintedBackground) this.drawMountains(scene, level);
    this.drawClouds(scene, level);
    this.drawGround(scene, level.segments);
    if (!usesPaintedBackground) this.drawRuinLanguage(scene, level);
    this.drawLandmarks(scene, level);
    if (!usesPaintedBackground) this.drawRegionalDetails(scene, level);
  }

  update(_cameraScrollX: number, tick: number, reducedMotion: boolean): void {
    const drift = reducedMotion ? 0 : Math.sin(tick * 0.004) * 6;
    this.far.y = drift;
    this.middle.y = -drift * 0.35;
    this.atmosphere.y = drift * 0.22;
    this.atmosphere.alpha = reducedMotion ? 0.72 : 0.72 + Math.sin(tick * 0.018) * 0.08;
  }

  private drawBackgroundArt(scene: Phaser.Scene, level: AdventureLevel): boolean {
    const texture =
      level.region === "crystal_caves"
        ? "region-crystal-caverns"
        : level.region === "storm_summit"
          ? "region-storm-summit"
          : "region-neon-valley";
    if (!scene.textures.exists(texture)) return false;
    const background = scene.add
      .image(-240, 0, texture)
      .setOrigin(0)
      .setDisplaySize(2700, WORLD_RENDER_HEIGHT)
      .setAlpha(0.92);
    this.far.add(background);
    return true;
  }

  private drawSky(scene: Phaser.Scene, level: AdventureLevel): void {
    const width = level.finishX + 2200;
    const sky = scene.add.graphics();
    const skyColors =
      level.region === "crystal_caves"
        ? [0x050514, 0x11102e, 0x201351, 0x082f43]
        : level.region === "storm_summit"
          ? [0x050a16, 0x111d35, 0x24445a, 0x526979]
          : [0x030914, 0x061529, 0x123348, 0x1b4850];
    sky.fillGradientStyle(
      skyColors[0]!,
      skyColors[1]!,
      skyColors[2]!,
      skyColors[3]!,
      0.18,
    );
    sky.fillRect(-800, 0, width, WORLD_RENDER_HEIGHT);

    sky.fillStyle(0x5c2b68, 0.11);
    sky.fillCircle(level.finishX * 0.56, 300, 360);
    sky.fillStyle(0x1ee8dc, 0.07);
    sky.fillCircle(level.finishX * 0.78, 230, 440);
    this.far.add(sky);

    const stars = scene.add.graphics();
    for (let index = 0; index < 120; index += 1) {
      const x = (index * 347) % (level.finishX + 1500);
      const y = 34 + ((index * 83) % 330);
      const bright = index % 11 === 0;
      stars.fillStyle(bright ? 0xffffff : 0x8dfcff, bright ? 0.78 : 0.42);
      stars.fillCircle(x, y, bright ? 2.2 : 1);
      if (bright) {
        stars.lineStyle(1, 0xbffffa, 0.38);
        stars.lineBetween(x - 6, y, x + 6, y);
        stars.lineBetween(x, y - 6, x, y + 6);
      }
    }
    this.far.add(stars);

    const moonGlow = scene.add.graphics();
    const moonX = Math.max(560, level.finishX * 0.72);
    moonGlow.fillStyle(0x78fff0, 0.08);
    moonGlow.fillCircle(moonX, 120, 92);
    moonGlow.fillStyle(0xbffff8, 0.18);
    moonGlow.fillCircle(moonX, 120, 48);
    moonGlow.fillStyle(0xf4fff9, 0.78);
    moonGlow.fillCircle(moonX, 120, 22);
    this.far.add(moonGlow);
  }

  private drawMountains(scene: Phaser.Scene, level: AdventureLevel): void {
    const farMountains = scene.add.graphics();
    for (let x = -520; x < level.finishX + 1700; x += 560) {
      const peak = 205 + ((Math.abs(x) / 13) % 155);
      farMountains.fillStyle(x % 1120 === 0 ? 0x0d2639 : 0x102d40, 1);
      farMountains.fillTriangle(x, 650, x + 300, peak, x + 680, 650);
      farMountains.fillStyle(0x6df8ef, 0.08);
      farMountains.fillTriangle(x + 300, peak, x + 360, peak + 115, x + 215, peak + 152);
    }
    this.far.add(farMountains);

    const nearMountains = scene.add.graphics();
    for (let x = -320; x < level.finishX + 1100; x += 440) {
      const peak = 360 + ((Math.abs(x) / 9) % 105);
      nearMountains.fillStyle(x % 880 === 0 ? 0x173e49 : 0x153544, 0.98);
      nearMountains.fillTriangle(x, 700, x + 210, peak, x + 530, 700);
      nearMountains.lineStyle(2, 0x55e6df, 0.12);
      nearMountains.lineBetween(x + 210, peak, x + 390, 700);
    }
    this.middle.add(nearMountains);

    const trees = scene.add.graphics();
    for (let x = 430; x < level.finishX + 480; x += 105) {
      const height = 95 + ((x / 17) % 75);
      trees.fillStyle(x % 210 === 0 ? 0x1b5b55 : 0x143f48, 0.9);
      trees.fillTriangle(x, 670, x + 33, 670 - height, x + 68, 670);
      trees.fillStyle(0x43e3cf, 0.1);
      trees.fillCircle(x + 34, 670 - height + 35, 38);
      trees.fillStyle(0x112b32, 0.86);
      trees.fillRect(x + 30, 652, 7, 24);
    }
    this.middle.add(trees);
  }

  private drawClouds(scene: Phaser.Scene, level: AdventureLevel): void {
    const clouds = scene.add.graphics();
    for (let x = 120; x < level.finishX + 900; x += 520) {
      const y = 240 + ((x / 7) % 180);
      clouds.fillStyle(0xb8f7f2, 0.035);
      clouds.fillEllipse(x, y, 300, 54);
      clouds.fillEllipse(x + 120, y - 18, 230, 48);
      clouds.fillStyle(0xff87c8, 0.025);
      clouds.fillEllipse(x + 42, y + 16, 260, 42);
    }
    this.atmosphere.add(clouds);
  }

  private drawGround(scene: Phaser.Scene, segments: LevelSegment[]): void {
    const graphics = scene.add.graphics();
    for (const segment of segments) {
      const upperSection = segment.section >= 4;
      const top = segment.groundY;
      const crystal = ["crystal_cavern", "machine_depths"].includes(segment.visualTheme);
      const storm = ["storm_pass", "sky_ruins"].includes(segment.visualTheme);
      const base = crystal
        ? (upperSection ? 0x191c43 : 0x202650)
        : storm
          ? (upperSection ? 0x203344 : 0x294556)
          : (upperSection ? 0x132b38 : 0x19393d);
      const edge = crystal ? 0xaa72ff : storm ? 0xb7f5ff : upperSection ? 0x75f3dd : 0x49ccc2;

      const drawPlatform = (start: number, end: number, platformTop = top): void => {
        const width = Math.max(0, end - start);
        graphics.fillStyle(base, 1);
        graphics.fillRect(start, platformTop, width, WORLD_RENDER_HEIGHT - platformTop);
        graphics.fillStyle(0x234d4b, 0.74);
        graphics.fillRect(start, platformTop + 8, width, 24);
        graphics.lineStyle(6, edge, 0.78);
        graphics.lineBetween(start, platformTop, end, platformTop);
        graphics.lineStyle(2, 0xb6fff4, 0.22);
        graphics.lineBetween(start, platformTop + 8, end, platformTop + 8);

        for (let x = start + 34; x < end - 18; x += 92) {
          graphics.fillStyle(0x6dfff0, 0.14);
          graphics.fillCircle(x, platformTop + 19, 3);
          graphics.lineStyle(2, 0x10252d, 0.72);
          graphics.lineBetween(x + 18, platformTop + 34, x + 52, platformTop + 74);
        }
      };

      if (["small_gap", "broken_bridge", "ravine"].includes(segment.type)) {
        const waitX = segment.waitX ?? segment.startX + segment.length * 0.35;
        const landingX = segment.landingX ?? segment.endX - segment.length * 0.2;
        drawPlatform(segment.startX, waitX + 20);
        drawPlatform(landingX - 20, segment.endX);
        this.drawChasmGlow(graphics, waitX + 20, landingX - 20, top);
      } else if (segment.type === "high_ledge") {
        const waitX = segment.waitX ?? segment.startX + 120;
        drawPlatform(segment.startX, waitX + 20, top);
        drawPlatform(segment.landingX ?? waitX + 180, segment.endX, top - 60);
      } else {
        drawPlatform(segment.startX, segment.endX);
      }

      graphics.lineStyle(3, 0x3cf0de, 0.18);
      graphics.lineBetween(segment.startX + 12, top - 2, segment.endX - 12, top - 2);
    }
    this.ground.add(graphics);
  }

  private drawChasmGlow(
    graphics: Phaser.GameObjects.Graphics,
    start: number,
    end: number,
    top: number,
  ): void {
    const width = Math.max(0, end - start);
    graphics.fillGradientStyle(0x06111d, 0x06111d, 0x1d0b2a, 0x1d0b2a, 0.96);
    graphics.fillRect(start, top, width, WORLD_RENDER_HEIGHT - top);
    graphics.fillStyle(0xff5fa8, 0.08);
    graphics.fillEllipse(start + width / 2, top + 180, Math.max(60, width * 0.7), 260);
    graphics.lineStyle(2, 0x6dfff0, 0.16);
    for (let y = top + 72; y < WORLD_RENDER_HEIGHT; y += 74) {
      graphics.lineBetween(start + width * 0.28, y, end - width * 0.18, y + 34);
    }
  }

  private drawRuinLanguage(scene: Phaser.Scene, level: AdventureLevel): void {
    const ruins = scene.add.graphics();
    for (let x = 360; x < level.finishX - 240; x += 760) {
      const baseY = 650;
      ruins.fillStyle(0x0c2432, 0.92);
      ruins.fillRect(x, baseY - 170, 24, 170);
      ruins.fillRect(x + 160, baseY - 138, 24, 138);
      ruins.fillRect(x, baseY - 170, 184, 20);
      ruins.lineStyle(3, 0x42d9dc, 0.42);
      ruins.strokeRoundedRect(x - 4, baseY - 174, 192, 178, 8);
      ruins.fillStyle(0xff62b6, 0.26);
      ruins.fillRect(x + 70, baseY - 132, 44, 70);
      ruins.lineStyle(2, 0xff8bcd, 0.5);
      ruins.strokeRoundedRect(x + 70, baseY - 132, 44, 70, 6);
    }
    this.middle.add(ruins);
  }

  private drawLandmarks(scene: Phaser.Scene, level: AdventureLevel): void {
    const landmarks = scene.add.graphics();

    landmarks.fillStyle(0x0a2535, 1);
    landmarks.fillRoundedRect(62, 500, 236, 150, 18);
    landmarks.lineStyle(4, 0x50e6e1, 0.82);
    landmarks.strokeRoundedRect(62, 500, 236, 150, 18);
    landmarks.fillStyle(0x123d4b, 1);
    landmarks.fillRoundedRect(82, 520, 196, 82, 10);
    landmarks.lineStyle(2, 0x75fff2, 0.42);
    landmarks.strokeRoundedRect(82, 520, 196, 82, 10);
    landmarks.fillStyle(0xffd36a, 0.88);
    landmarks.fillCircle(180, 548, 13);
    landmarks.fillStyle(0x72fff0, 0.18);
    landmarks.fillCircle(180, 548, 34);

    for (const segment of level.segments) {
      if (!segment.checkpointAfter) continue;
      const x = segment.endX - 46;
      const y = segment.groundY;
      landmarks.fillStyle(0x0b2d3b, 1);
      landmarks.fillRect(x - 12, y - 86, 24, 86);
      landmarks.lineStyle(3, 0x6dfff0, 0.76);
      landmarks.strokeRoundedRect(x - 16, y - 92, 32, 92, 7);
      landmarks.fillStyle(0xff6fbd, 0.8);
      landmarks.fillCircle(x, y - 102, 9);
      landmarks.fillStyle(0xff6fbd, 0.12);
      landmarks.fillCircle(x, y - 102, 30);
    }

    const towerX = level.finishX - 34;
    landmarks.fillStyle(0x102c3d, 1);
    landmarks.fillRect(towerX - 52, 250, 104, 270);
    landmarks.fillStyle(0x173f4e, 1);
    landmarks.fillTriangle(towerX - 76, 270, towerX, 170, towerX + 76, 270);
    landmarks.lineStyle(5, 0xff66bf, 0.88);
    landmarks.lineBetween(towerX, 245, towerX, 128);
    landmarks.lineStyle(2, 0x7ffff0, 0.68);
    landmarks.lineBetween(towerX - 34, 330, towerX + 34, 330);
    landmarks.lineBetween(towerX - 28, 390, towerX + 28, 390);
    landmarks.fillStyle(0x7ffff0, 0.14);
    landmarks.fillCircle(towerX, 128, 74);
    landmarks.fillStyle(0xff6fbd, 0.18);
    landmarks.fillCircle(towerX, 128, 46);
    landmarks.fillStyle(0xffffff, 0.94);
    landmarks.fillCircle(towerX, 128, 12);

    this.ground.add(landmarks);
  }

  private drawRegionalDetails(scene: Phaser.Scene, level: AdventureLevel): void {
    const details = scene.add.graphics();
    if (level.region === "crystal_caves") {
      for (let x = 300; x < level.finishX; x += 310) {
        const height = 60 + ((x / 11) % 90);
        const y = 650;
        details.fillStyle(x % 620 === 0 ? 0xff67ca : 0x8b6dff, 0.34);
        details.fillTriangle(x, y, x + 34, y - height, x + 70, y);
        details.lineStyle(3, 0x7ffff0, 0.38);
        details.lineBetween(x + 34, y - height, x + 48, y - 8);
      }
    } else if (level.region === "storm_summit") {
      for (let x = 480; x < level.finishX; x += 680) {
        details.lineStyle(5, 0xd8fbff, 0.28);
        details.beginPath();
        details.moveTo(x, 120);
        details.lineTo(x - 38, 220);
        details.lineTo(x + 12, 214);
        details.lineTo(x - 32, 330);
        details.strokePath();
      }
      details.fillStyle(0xeaffff, 0.08);
      for (let x = 120; x < level.finishX; x += 210) {
        details.fillEllipse(x, 420 + ((x / 9) % 120), 190, 28);
      }
    }
    this.middle.add(details);
  }
}
