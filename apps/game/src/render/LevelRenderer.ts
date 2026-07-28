import Phaser from "phaser";
import {
  LEVEL_GRAPH,
  getPlatform,
  type LevelGraph,
  type LevelRenderState,
  type Link,
  type LinkRuntimeState,
} from "../config/levelGraph";
import { PALETTE, toCss } from "./palette";
import { ensureTextures, TEXTURE_KEYS } from "./textures";

const DECK_HEIGHT = 20;
const BRIDGE_SEGMENT_COUNT = 6;
const BRIDGE_HEIGHT = 14;
const PROGRESS_WIDTH = 190;
const PROGRESS_FILL_WIDTH = 172;
const LIFT_CAR_WIDTH = 70;
const LIFT_CAR_HEIGHT = 62;
const MAX_PASSENGER_DOTS = 6;

type ProgressView = {
  container: Phaser.GameObjects.Container;
  panel: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  waiting: Phaser.GameObjects.Text;
  lastProgress: number;
  lastRequired: number;
  lastWaiting: number;
};

type BridgeView = {
  link: Link;
  y: number;
  segments: Phaser.GameObjects.Rectangle[];
  progress: ProgressView;
  wasOpen: boolean;
};

type JumpView = {
  link: Link;
  y: number;
  pad: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Image;
  progress: ProgressView;
  lastParticleTick: number;
};

type LiftView = {
  link: Link;
  x: number;
  lowerY: number;
  upperY: number;
  car: Phaser.GameObjects.Container;
  doorLeft: Phaser.GameObjects.Rectangle;
  doorRight: Phaser.GameObjects.Rectangle;
  passengerDots: Phaser.GameObjects.Arc[];
  position: { x: number; y: number };
};

/**
 * Zeichnet die echte Level-Geometrie und bildet den Laufzeitzustand der
 * Übergänge auf bereits angelegte Phaser-Objekte ab.
 */
export class LevelRenderer {
  private readonly ownedObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly runtimeById = new Map<string, LinkRuntimeState>();
  private readonly bridgeViews: BridgeView[] = [];
  private readonly jumpViews: JumpView[] = [];
  private readonly liftViews: LiftView[] = [];
  private readonly liftById = new Map<string, LiftView>();
  private readonly bridgeSparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly jumpParticles: Phaser.GameObjects.Particles.ParticleEmitter;
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly graph: LevelGraph = LEVEL_GRAPH,
  ) {
    ensureTextures(scene);

    const linkGeometry = this.own(scene.add.graphics().setDepth(6));
    this.buildStaticLinks(linkGeometry);
    const deckGeometry = this.own(scene.add.graphics().setDepth(7));
    this.buildPlatforms(deckGeometry);

    this.bridgeSparks = this.own(
      scene.add
        .particles(0, 0, TEXTURE_KEYS.spark, {
          lifespan: 480,
          speed: { min: 55, max: 180 },
          angle: { min: 195, max: 345 },
          gravityY: 300,
          scale: { start: 1, end: 0 },
          tint: [PALETTE.warn, PALETTE.support, 0xfff0c0],
          blendMode: Phaser.BlendModes.ADD,
          maxAliveParticles: 48,
          emitting: false,
        })
        .setDepth(16),
    );

    this.jumpParticles = this.own(
      scene.add
        .particles(0, 0, TEXTURE_KEYS.glow, {
          lifespan: 900,
          speedY: { min: -145, max: -70 },
          speedX: { min: -22, max: 22 },
          scale: { start: 0.2, end: 0 },
          alpha: { start: 0.85, end: 0 },
          tint: PALETTE.support,
          blendMode: Phaser.BlendModes.ADD,
          maxAliveParticles: 32,
          emitting: false,
        })
        .setDepth(15),
    );
  }

  update(state: LevelRenderState, tick: number, reducedMotion: boolean): void {
    if (this.destroyed) return;

    this.runtimeById.clear();
    for (const runtime of state.links) {
      this.runtimeById.set(runtime.id, runtime);
    }

    for (const view of this.bridgeViews) {
      const runtime = this.runtimeById.get(view.link.id);
      const open = runtime?.open === true;
      const required = Math.max(
        0,
        runtime?.buildRequired ?? view.link.buildRequired,
      );
      const built = Math.max(0, runtime?.buildProgress ?? 0);
      const ratio =
        open || required === 0 ? 1 : Phaser.Math.Clamp(built / required, 0, 1);

      for (let index = 0; index < view.segments.length; index += 1) {
        const segment = view.segments[index];
        if (!segment) continue;
        const local = Phaser.Math.Clamp(
          ratio * view.segments.length - index,
          0,
          1,
        );
        segment.setScale(local, 1);
        segment.setAlpha(local === 0 ? 0 : 0.42 + local * 0.58);
        segment.setFillStyle(
          open ? PALETTE.support : PALETTE.deckFill,
          open ? 0.82 : 1,
        );
        segment.setStrokeStyle(
          2,
          open ? PALETTE.support : PALETTE.warn,
          open ? 1 : 0.9,
        );
        segment.setBlendMode(
          open ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL,
        );
      }

      if (open && !view.wasOpen) {
        this.bridgeSparks.emitParticleAt(
          (view.link.fromX + view.link.toX) / 2,
          view.y,
          reducedMotion ? 10 : 24,
        );
      }
      view.wasOpen = open;

      view.progress.container.setVisible(!open);
      if (!open) {
        this.updateProgress(
          view.progress,
          view.link,
          built,
          required,
          runtime?.waiting ?? 0,
          tick,
          reducedMotion,
          false,
        );
      }
    }

    for (const view of this.jumpViews) {
      const runtime = this.runtimeById.get(view.link.id);
      const open = runtime?.open === true;
      const required = Math.max(
        0,
        runtime?.buildRequired ?? view.link.buildRequired,
      );
      const built = Math.max(0, runtime?.buildProgress ?? 0);

      view.pad.setFillStyle(
        open ? PALETTE.support : PALETTE.towerNear,
        open ? 0.95 : 1,
      );
      view.pad.setStrokeStyle(
        2,
        open ? PALETTE.support : PALETTE.towerEdge,
        open ? 1 : 0.72,
      );
      const glowPulse = reducedMotion
        ? 0.28
        : 0.3 + Math.sin(tick * 0.16) * 0.12;
      view.glow.setAlpha(open ? glowPulse : 0);

      this.updateProgress(
        view.progress,
        view.link,
        built,
        required,
        runtime?.waiting ?? 0,
        tick,
        reducedMotion,
        open,
      );

      const particleInterval = reducedMotion ? 12 : 5;
      if (
        open &&
        tick !== view.lastParticleTick &&
        tick % particleInterval === 0
      ) {
        this.jumpParticles.emitParticleAt(
          view.link.fromX,
          view.y - 5,
          reducedMotion ? 1 : 2,
        );
        view.lastParticleTick = tick;
      }
    }

    for (const view of this.liftViews) {
      const runtime = this.runtimeById.get(view.link.id);
      const position = Phaser.Math.Clamp(runtime?.carPosition ?? 0, 0, 1);
      const carY =
        Phaser.Math.Linear(view.lowerY, view.upperY, position) -
        LIFT_CAR_HEIGHT / 2;

      view.car.setPosition(view.x, carY);
      view.position.x = view.x;
      view.position.y = carY;

      const doorsOpen = runtime?.carDoorsOpen === true;
      view.doorLeft.x = doorsOpen ? -24 : -13;
      view.doorRight.x = doorsOpen ? 24 : 13;

      const passengers = Math.max(0, runtime?.carPassengers ?? 0);
      for (let index = 0; index < view.passengerDots.length; index += 1) {
        const dot = view.passengerDots[index];
        dot?.setVisible(index < passengers);
      }
    }
  }

  /** Weltposition der Kabine, damit die Szene mitfahrende Roboter setzen kann. */
  getLiftCarPosition(linkId: string): { x: number; y: number } | null {
    if (this.destroyed) return null;
    return this.liftById.get(linkId)?.position ?? null;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.runtimeById.clear();
    this.liftById.clear();
    for (const object of this.ownedObjects) object.destroy();
    this.ownedObjects.length = 0;
    this.bridgeViews.length = 0;
    this.jumpViews.length = 0;
    this.liftViews.length = 0;
  }

  private own<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.ownedObjects.push(object);
    return object;
  }

  private buildPlatforms(graphics: Phaser.GameObjects.Graphics): void {
    for (const platform of this.graph.platforms) {
      const width = platform.xEnd - platform.xStart;

      graphics.fillStyle(0x000000, 0.35);
      graphics.fillRoundedRect(
        platform.xStart + 4,
        platform.y + 8,
        width,
        18,
        6,
      );
      graphics.fillStyle(PALETTE.deckFill, 1);
      graphics.fillRoundedRect(
        platform.xStart,
        platform.y,
        width,
        DECK_HEIGHT,
        6,
      );
      graphics.fillStyle(PALETTE.deckTop, 1);
      graphics.fillRoundedRect(platform.xStart, platform.y, width, 7, 3);
      graphics.lineStyle(3, PALETTE.deckLight, 0.9);
      graphics.strokeRoundedRect(
        platform.xStart,
        platform.y,
        width,
        DECK_HEIGHT,
        6,
      );

      graphics.lineStyle(1, PALETTE.deckLight, 0.28);
      for (
        let x = platform.xStart + 10;
        x < platform.xEnd - 8;
        x += 16
      ) {
        graphics.lineBetween(x, platform.y + 9, x, platform.y + 18);
      }

      const strip = this.own(
        this.scene.add
          .rectangle(
            platform.xStart + width / 2,
            platform.y - 1,
            width - 6,
            3,
            PALETTE.deckLight,
            0.85,
          )
          .setDepth(8),
      );
      strip.setBlendMode(Phaser.BlendModes.ADD);

      if (platform.label) {
        this.own(
          this.scene.add
            .text(platform.xStart + 8, platform.y + 24, platform.label.toUpperCase(), {
              fontFamily: "Inter, Arial, sans-serif",
              fontStyle: "bold",
              fontSize: "12px",
              color: PALETTE.textDim,
            })
            .setDepth(10),
        );
      }
    }
  }

  private buildStaticLinks(graphics: Phaser.GameObjects.Graphics): void {
    for (const link of this.graph.links) {
      switch (link.kind) {
        case "stair":
          this.buildStair(graphics, link);
          break;
        case "bridge":
          this.buildBridge(graphics, link);
          break;
        case "lift":
          this.buildLift(graphics, link);
          break;
        case "jump":
          this.buildJump(link);
          break;
        case "exit":
          this.buildExit(graphics, link);
          break;
      }
    }
  }

  private buildStair(
    graphics: Phaser.GameObjects.Graphics,
    link: Link,
  ): void {
    const from = getPlatform(this.graph, link.from);
    const to = getPlatform(this.graph, link.to);
    const direction = link.fromX < 360 ? 1 : -1;
    const middleX = (link.fromX + link.toX) / 2 + direction * 48;
    const middleY = (from.y + to.y) / 2;

    graphics.lineStyle(4, PALETTE.towerNear, 0.9);
    graphics.beginPath();
    graphics.moveTo(link.fromX, from.y);
    graphics.lineTo(middleX, middleY);
    graphics.lineTo(link.toX, to.y);
    graphics.strokePath();

    graphics.lineStyle(2, PALETTE.deckLight, 0.48);
    graphics.beginPath();
    graphics.moveTo(link.fromX, from.y - 7);
    graphics.lineTo(middleX, middleY - 7);
    graphics.lineTo(link.toX, to.y - 7);
    graphics.strokePath();

    for (let index = 1; index <= 6; index += 1) {
      const t = index / 7;
      let x: number;
      let y: number;
      if (t <= 0.5) {
        const local = t * 2;
        x = Phaser.Math.Linear(link.fromX, middleX, local);
        y = Phaser.Math.Linear(from.y, middleY, local);
      } else {
        const local = (t - 0.5) * 2;
        x = Phaser.Math.Linear(middleX, link.toX, local);
        y = Phaser.Math.Linear(middleY, to.y, local);
      }
      graphics.lineBetween(x - 14, y, x + 14, y);
    }
  }

  private buildBridge(
    graphics: Phaser.GameObjects.Graphics,
    link: Link,
  ): void {
    const platform = getPlatform(this.graph, link.from);
    const left = Math.min(link.fromX, link.toX);
    const right = Math.max(link.fromX, link.toX);
    const gapWidth = right - left;
    const segmentWidth = gapWidth / BRIDGE_SEGMENT_COUNT;

    graphics.fillStyle(PALETTE.towerNear, 1);
    graphics.fillRect(left - 10, platform.y - 2, 12, 34);
    graphics.fillRect(right - 2, platform.y - 2, 12, 34);
    graphics.lineStyle(2, PALETTE.warn, 0.9);
    graphics.strokeRect(left - 10, platform.y - 2, 12, 34);
    graphics.strokeRect(right - 2, platform.y - 2, 12, 34);

    graphics.lineStyle(2, PALETTE.warn, 0.55);
    for (let x = left + 4; x < right; x += 13) {
      graphics.lineBetween(x, platform.y + 30, x + 15, platform.y + 48);
    }
    graphics.lineStyle(1, PALETTE.warn, 0.25);
    graphics.lineBetween(left, platform.y + 49, right, platform.y + 49);

    const segments: Phaser.GameObjects.Rectangle[] = [];
    for (let index = 0; index < BRIDGE_SEGMENT_COUNT; index += 1) {
      const segment = this.own(
        this.scene.add
          .rectangle(
            left + index * segmentWidth,
            platform.y + BRIDGE_HEIGHT / 2,
            Math.max(2, segmentWidth - 2),
            BRIDGE_HEIGHT,
            PALETTE.deckFill,
            1,
          )
          .setOrigin(0, 0.5)
          .setStrokeStyle(2, PALETTE.warn, 0.9)
          .setScale(0, 1)
          .setDepth(12),
      );
      segments.push(segment);
    }

    const progress = this.createProgressView(
      (left + right) / 2,
      platform.y - 56,
    );
    this.bridgeViews.push({
      link,
      y: platform.y,
      segments,
      progress,
      wasOpen: false,
    });
  }

  private buildLift(
    graphics: Phaser.GameObjects.Graphics,
    link: Link,
  ): void {
    const from = getPlatform(this.graph, link.from);
    const to = getPlatform(this.graph, link.to);
    const top = Math.min(from.y, to.y);
    const bottom = Math.max(from.y, to.y);
    const shaftX = (link.fromX + link.toX) / 2;

    graphics.fillStyle(0x061420, 0.86);
    graphics.fillRect(shaftX - 45, top, 90, bottom - top);
    graphics.lineStyle(3, PALETTE.towerEdge, 0.72);
    graphics.strokeRect(shaftX - 45, top, 90, bottom - top);
    graphics.lineStyle(3, PALETTE.deckLight, 0.38);
    graphics.lineBetween(shaftX - 31, top, shaftX - 31, bottom);
    graphics.lineBetween(shaftX + 31, top, shaftX + 31, bottom);
    graphics.lineStyle(1, PALETTE.towerEdge, 0.35);
    for (let y = top + 18; y < bottom; y += 28) {
      graphics.lineBetween(shaftX - 39, y, shaftX + 39, y);
    }

    const body = this.scene.add
      .rectangle(0, 0, LIFT_CAR_WIDTH, LIFT_CAR_HEIGHT, 0x0b2434, 1)
      .setStrokeStyle(3, PALETTE.support, 0.95);
    const window_ = this.scene.add
      .rectangle(0, -10, 52, 22, 0x0b3a48, 1)
      .setStrokeStyle(1, PALETTE.energySoft, 0.55);
    const doorway = this.scene.add.rectangle(0, 17, 52, 22, 0x03080f, 0.9);
    const doorLeft = this.scene.add
      .rectangle(-13, 17, 25, 22, PALETTE.deckTop, 1)
      .setStrokeStyle(1, PALETTE.towerEdge, 0.8);
    const doorRight = this.scene.add
      .rectangle(13, 17, 25, 22, PALETTE.deckTop, 1)
      .setStrokeStyle(1, PALETTE.towerEdge, 0.8);
    const lightStrip = this.scene.add.rectangle(
      0,
      -LIFT_CAR_HEIGHT / 2 + 5,
      54,
      4,
      PALETTE.support,
      1,
    );
    lightStrip.setBlendMode(Phaser.BlendModes.ADD);

    const passengerDots: Phaser.GameObjects.Arc[] = [];
    for (let index = 0; index < MAX_PASSENGER_DOTS; index += 1) {
      const dot = this.scene.add
        .circle(-20 + index * 8, -9, 3, PALETTE.energySoft, 0.95)
        .setVisible(false);
      passengerDots.push(dot);
    }

    const carY = from.y - LIFT_CAR_HEIGHT / 2;
    const car = this.own(
      this.scene.add
        .container(shaftX, carY, [
          body,
          window_,
          doorway,
          doorLeft,
          doorRight,
          lightStrip,
          ...passengerDots,
        ])
        .setDepth(14),
    );
    const view: LiftView = {
      link,
      x: link.fromX,
      lowerY: from.y,
      upperY: to.y,
      car,
      doorLeft,
      doorRight,
      passengerDots,
      position: { x: shaftX, y: carY },
    };
    this.liftViews.push(view);
    this.liftById.set(link.id, view);
  }

  private buildJump(link: Link): void {
    const platform = getPlatform(this.graph, link.from);
    const glow = this.own(
      this.scene.add
        .image(link.fromX, platform.y - 18, TEXTURE_KEYS.glow)
        .setDisplaySize(130, 84)
        .setTint(PALETTE.support)
        .setAlpha(0)
        .setDepth(10),
    );
    glow.setBlendMode(Phaser.BlendModes.ADD);

    const pad = this.own(
      this.scene.add
        .rectangle(
          link.fromX,
          platform.y + 2,
          76,
          10,
          PALETTE.towerNear,
          1,
        )
        .setStrokeStyle(2, PALETTE.towerEdge, 0.72)
        .setDepth(12),
    );
    const progress = this.createProgressView(
      link.fromX,
      platform.y - 64,
    );
    this.jumpViews.push({
      link,
      y: platform.y,
      pad,
      glow,
      progress,
      lastParticleTick: -1,
    });
  }

  private buildExit(
    graphics: Phaser.GameObjects.Graphics,
    link: Link,
  ): void {
    const platform = getPlatform(this.graph, link.from);
    const gateWidth = 82;
    const gateHeight = 72;
    const left = link.fromX - gateWidth / 2;
    const top = platform.y - gateHeight;

    graphics.fillStyle(0x062b24, 0.94);
    graphics.fillRoundedRect(left, top, gateWidth, gateHeight, 10);
    graphics.lineStyle(4, PALETTE.support, 0.95);
    graphics.strokeRoundedRect(left, top, gateWidth, gateHeight, 10);
    graphics.fillStyle(PALETTE.support, 0.14);
    graphics.fillRoundedRect(left + 10, top + 26, gateWidth - 20, 38, 7);

    const halo = this.own(
      this.scene.add
        .image(link.fromX, top + gateHeight / 2, TEXTURE_KEYS.glow)
        .setDisplaySize(150, 118)
        .setTint(PALETTE.support)
        .setAlpha(0.26)
        .setDepth(8),
    );
    halo.setBlendMode(Phaser.BlendModes.ADD);

    this.own(
      this.scene.add
        .text(link.fromX, top + 8, (link.label ?? "AUSGANG").toUpperCase(), {
          fontFamily: "Inter, Arial, sans-serif",
          fontStyle: "bold",
          fontSize: "14px",
          color: toCss(PALETTE.support),
        })
        .setOrigin(0.5, 0)
        .setDepth(11),
    );
  }

  private createProgressView(x: number, y: number): ProgressView {
    const panel = this.scene.add
      .rectangle(0, 0, PROGRESS_WIDTH, 48, 0x03080f, 0.94)
      .setStrokeStyle(2, PALETTE.warn, 0.82);
    const label = this.scene.add
      .text(0, -15, "", {
        fontFamily: "Inter, Arial, sans-serif",
        fontStyle: "bold",
        fontSize: "14px",
        color: PALETTE.text,
      })
      .setOrigin(0.5);
    const track = this.scene.add.rectangle(
      0,
      2,
      PROGRESS_FILL_WIDTH,
      9,
      PALETTE.towerNear,
      1,
    );
    const fill = this.scene.add
      .rectangle(
        -PROGRESS_FILL_WIDTH / 2,
        2,
        PROGRESS_FILL_WIDTH,
        9,
        PALETTE.warn,
        1,
      )
      .setOrigin(0, 0.5)
      .setScale(0, 1);
    const waiting = this.scene.add
      .text(0, 16, "", {
        fontFamily: "Inter, Arial, sans-serif",
        fontStyle: "bold",
        fontSize: "13px",
        color: toCss(PALETTE.warn),
      })
      .setOrigin(0.5)
      .setVisible(false);
    const container = this.own(
      this.scene.add
        .container(x, y, [panel, label, track, fill, waiting])
        .setDepth(18),
    );
    return {
      container,
      panel,
      fill,
      label,
      waiting,
      lastProgress: -1,
      lastRequired: -1,
      lastWaiting: -1,
    };
  }

  private updateProgress(
    view: ProgressView,
    link: Link,
    progress: number,
    required: number,
    waiting: number,
    tick: number,
    reducedMotion: boolean,
    open: boolean,
  ): void {
    const displayedProgress = open ? required : progress;
    const roundedProgress = Math.min(
      Math.max(0, Math.floor(displayedProgress)),
      Math.max(0, Math.floor(required)),
    );
    const roundedRequired = Math.max(0, Math.floor(required));
    const roundedWaiting = Math.max(0, Math.floor(waiting));
    const ratio =
      open || roundedRequired === 0
        ? 1
        : Phaser.Math.Clamp(progress / required, 0, 1);

    view.fill.setScale(ratio, 1);
    view.fill.setFillStyle(open ? PALETTE.support : PALETTE.warn, 1);
    view.panel.setStrokeStyle(
      2,
      open ? PALETTE.support : PALETTE.warn,
      0.82,
    );
    if (
      roundedProgress !== view.lastProgress ||
      roundedRequired !== view.lastRequired
    ) {
      const label = (link.label ?? this.defaultLabel(link)).toUpperCase();
      view.label.setText(`${label}  ${roundedProgress}/${roundedRequired}`);
      view.lastProgress = roundedProgress;
      view.lastRequired = roundedRequired;
    }

    if (roundedWaiting !== view.lastWaiting) {
      view.waiting.setVisible(roundedWaiting > 0);
      view.waiting.setText(
        roundedWaiting > 0 ? `WARTEN: ${roundedWaiting}` : "",
      );
      view.lastWaiting = roundedWaiting;
    }

    if (roundedWaiting > 0) {
      const alpha = reducedMotion
        ? 0.94
        : 0.78 + Math.sin(tick * 0.16) * 0.2;
      view.container.setAlpha(alpha);
    } else {
      view.container.setAlpha(1);
    }
  }

  private defaultLabel(link: Link): string {
    switch (link.kind) {
      case "bridge":
        return "BRÜCKE";
      case "jump":
        return "SPRUNGFELD";
      case "lift":
        return "LIFT";
      case "stair":
        return "TREPPE";
      case "exit":
        return "AUSGANG";
    }
  }
}
