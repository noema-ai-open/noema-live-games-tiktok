import Phaser from "phaser";
import { FIXED_STEP_MS, RESCUE_TARGET, TICKS } from "../config/gameConfig";
import { PLATFORM_LEVELS, RISKY_PATH, SAFE_PATH } from "../config/level";
import { WorkerView } from "../entities/WorkerView";
import type { Simulation } from "../simulation/Simulation";
import type { RoundStatus, TsarPhase } from "../simulation/types";
import type { AudioSystem } from "../systems/AudioSystem";

type Hud = {
  rescue: Phaser.GameObjects.Text;
  timer: Phaser.GameObjects.Text;
  energy: Phaser.GameObjects.Text;
  eventFeed: Phaser.GameObjects.Text;
  zone1: Phaser.GameObjects.Text;
  zone2: Phaser.GameObjects.Text;
  zone3: Phaser.GameObjects.Text;
  result: Phaser.GameObjects.Text;
  recovery: Phaser.GameObjects.Text;
};

export class AscentScene extends Phaser.Scene {
  private readonly simulation: Simulation;
  private readonly audio: AudioSystem;
  private accumulator = 0;
  private workerViews = new Map<number, WorkerView>();
  private effects!: Phaser.GameObjects.Graphics;
  private movingPlatform!: Phaser.GameObjects.Rectangle;
  private liftCar!: Phaser.GameObjects.Rectangle;
  private hazardBeam!: Phaser.GameObjects.Rectangle;
  private effectTitle!: Phaser.GameObjects.Text;
  private effectSubtitle!: Phaser.GameObjects.Text;
  private effectCount!: Phaser.GameObjects.Text;
  private hud!: Hud;
  private lastTsarPhase: TsarPhase = "idle";
  private lastStatus: RoundStatus = "ready";
  private lastRescued = 0;

  constructor(simulation: Simulation, audio: AudioSystem) {
    super({ key: "AscentScene" });
    this.simulation = simulation;
    this.audio = audio;
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#04101c");
    this.drawWorld();
    for (const worker of this.simulation.workers) {
      this.workerViews.set(
        worker.id,
        new WorkerView(this, worker),
      );
    }
    this.effects = this.add.graphics().setDepth(80);
    this.effectTitle = this.createEffectText(54);
    this.effectSubtitle = this.createEffectText(18);
    this.effectCount = this.createEffectText(48);
    this.hud = this.createHud();
  }

  update(_time: number, delta: number): void {
    this.accumulator = Math.min(250, this.accumulator + delta);
    while (this.accumulator >= FIXED_STEP_MS) {
      this.simulation.step();
      this.accumulator -= FIXED_STEP_MS;
    }
    this.renderState();
  }

  private drawWorld(): void {
    const background = this.add.graphics();
    background.fillGradientStyle(0x071b2e, 0x071b2e, 0x02070d, 0x02070d);
    background.fillRect(0, 0, 720, 1280);
    for (let index = 0; index < 14; index += 1) {
      const x = 28 + index * 52;
      background.fillStyle(index % 2 === 0 ? 0x0b2b43 : 0x0a2134, 0.55);
      background.fillRect(x, 90, 30, 1080);
      background.lineStyle(1, 0x1b5772, 0.3);
      background.lineBetween(x, 90, x + 30, 1170);
    }

    const tower = this.add.graphics();
    tower.fillStyle(0x06111d, 0.93);
    tower.fillRoundedRect(78, 90, 564, 1090, 20);
    tower.lineStyle(4, 0x1a5068, 0.7);
    tower.strokeRoundedRect(78, 90, 564, 1090, 20);
    tower.lineStyle(1, 0x27647c, 0.25);
    for (let y = 120; y < 1160; y += 58) {
      tower.lineBetween(88, y, 632, y);
    }

    this.drawPath(SAFE_PATH, 0x20dcff, 0.14);
    this.drawPath(RISKY_PATH, 0xff6a4a, 0.12);

    for (const platform of PLATFORM_LEVELS) {
      const graphics = this.add.graphics();
      graphics.fillStyle(0x0c2635, 1);
      graphics.fillRoundedRect(platform.x, platform.y, platform.width, 18, 5);
      graphics.lineStyle(3, platform.color, 0.82);
      graphics.strokeRoundedRect(platform.x, platform.y, platform.width, 18, 5);
      graphics.lineStyle(2, platform.color, 0.28);
      graphics.lineBetween(
        platform.x + 8,
        platform.y + 9,
        platform.x + platform.width - 8,
        platform.y + 9,
      );
    }

    const exit = this.add.graphics();
    exit.fillStyle(0x092e2c, 0.96);
    exit.fillRoundedRect(268, 98, 184, 76, 12);
    exit.lineStyle(4, 0x52ffad, 0.9);
    exit.strokeRoundedRect(268, 98, 184, 76, 12);
    this.add
      .text(360, 112, "EXIT", {
        fontFamily: "Arial Black, sans-serif",
        fontSize: "22px",
        color: "#aaffd0",
      })
      .setOrigin(0.5, 0);
    this.add
      .text(360, 140, "ASCENT GATE  ↑", {
        fontFamily: "Arial, sans-serif",
        fontStyle: "bold",
        fontSize: "14px",
        color: "#54ffc2",
      })
      .setOrigin(0.5, 0);

    this.drawCheckpoint(1, 216, 718);
    this.drawCheckpoint(2, 470, 480);
    this.drawConstructionZone("ZONE 1 // BRIDGE", 96, 894, 0xffad33);
    this.drawConstructionZone("ZONE 2 // CORE", 406, 650, 0x28dfff);
    this.drawConstructionZone("ZONE 3 // LIFT", 96, 394, 0x5bff9e);

    this.movingPlatform = this.add
      .rectangle(302, 438, 112, 14, 0x1c4f67)
      .setStrokeStyle(3, 0x54eaff)
      .setDepth(5);
    this.liftCar = this.add
      .rectangle(542, 346, 62, 50, 0x0c2c3c)
      .setStrokeStyle(3, 0x69ffa9)
      .setDepth(6);
    this.hazardBeam = this.add
      .rectangle(350, 666, 260, 6, 0xff4c36, 0.75)
      .setDepth(7);

    this.add
      .text(360, 1204, "Powered by NOEMA AI", {
        fontFamily: "Arial, sans-serif",
        fontSize: "15px",
        color: "#7893a5",
      })
      .setOrigin(0.5);
  }

  private drawPath(
    path: readonly { x: number; y: number }[],
    color: number,
    alpha: number,
  ): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(5, color, alpha);
    graphics.beginPath();
    graphics.moveTo(path[0]!.x, path[0]!.y);
    for (const point of path.slice(1)) graphics.lineTo(point.x, point.y);
    graphics.strokePath();
  }

  private drawCheckpoint(
    number: number,
    x: number,
    y: number,
  ): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x08283d, 0.96);
    graphics.fillRoundedRect(x - 54, y - 18, 108, 36, 8);
    graphics.lineStyle(2, 0x27cfff, 0.9);
    graphics.strokeRoundedRect(x - 54, y - 18, 108, 36, 8);
    this.add
      .text(x, y, `◆ CHECKPOINT ${number}`, {
        fontFamily: "Arial, sans-serif",
        fontStyle: "bold",
        fontSize: "11px",
        color: "#75eaff",
      })
      .setOrigin(0.5);
  }

  private drawConstructionZone(
    label: string,
    x: number,
    y: number,
    color: number,
  ): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x06131f, 0.88);
    graphics.fillRoundedRect(x, y, 152, 50, 8);
    graphics.lineStyle(2, color, 0.72);
    graphics.strokeRoundedRect(x, y, 152, 50, 8);
    this.add.text(x + 12, y + 8, label, {
      fontFamily: "Arial, sans-serif",
      fontStyle: "bold",
      fontSize: "12px",
      color: `#${color.toString(16).padStart(6, "0")}`,
    });
  }

  private createHud(): Hud {
    const overlay = this.add.graphics().setDepth(50);
    overlay.fillStyle(0x030b12, 0.88);
    overlay.fillRoundedRect(16, 18, 190, 72, 12);
    overlay.fillRoundedRect(514, 18, 190, 72, 12);
    overlay.fillRoundedRect(16, 1068, 330, 122, 12);
    overlay.fillRoundedRect(360, 1068, 344, 122, 12);
    overlay.lineStyle(2, 0x315b70, 0.8);
    overlay.strokeRoundedRect(16, 18, 190, 72, 12);
    overlay.strokeRoundedRect(514, 18, 190, 72, 12);

    const text = (
      x: number,
      y: number,
      value: string,
      size: number,
      color = "#ffffff",
    ) =>
      this.add
        .text(x, y, value, {
          fontFamily: "Arial, sans-serif",
          fontStyle: "bold",
          fontSize: `${size}px`,
          color,
        })
        .setDepth(55);

    text(30, 29, "RESCUED", 12, "#7f9bad");
    const rescue = text(30, 47, "00 / 30", 28, "#5dff9e");
    text(528, 29, "ROUND TIMER", 12, "#7f9bad");
    const timer = text(528, 47, "04:00", 28);
    const energy = text(360, 24, "⚡ TEAM ENERGY 015%", 16, "#ffd35a").setOrigin(
      0.5,
      0,
    );
    const eventFeed = text(28, 1080, "", 12, "#c9e6f4");
    eventFeed.setLineSpacing(4);
    text(375, 1080, "GIFT → ACTION", 12, "#7f9bad");
    text(
      375,
      1101,
      "MICRO → REPAIR\nSTANDARD → BRIDGE\nSTRONG → LIFT\nPREMIUM → SHIELD\n⚠ ZAR-BOMBE → SPECTACLE",
      12,
      "#dff8ff",
    ).setLineSpacing(2);
    const zone1 = text(108, 919, "OPEN PIT", 11, "#ffcc73");
    const zone2 = text(418, 675, "HAZARD ACTIVE", 11, "#72eaff");
    const zone3 = text(108, 419, "LIFT CYCLING", 11, "#86ffc0");
    const recovery = text(360, 184, "", 22, "#ffe66d").setOrigin(0.5, 0);
    const result = text(360, 596, "", 34, "#ffffff").setOrigin(0.5);
    result.setAlign("center");
    return {
      rescue,
      timer,
      energy,
      eventFeed,
      zone1,
      zone2,
      zone3,
      result,
      recovery,
    };
  }

  private renderState(): void {
    const state = this.simulation.state;
    for (const worker of this.simulation.workers) {
      this.workerViews.get(worker.id)?.update(worker, state.tick);
    }

    const seconds = Math.ceil(state.remainingTicks / TICKS.second);
    this.hud.rescue.setText(
      `${String(state.rescuedCount).padStart(2, "0")} / 30  ·  TARGET ${RESCUE_TARGET}`,
    );
    this.hud.timer.setText(
      `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`,
    );
    this.hud.energy.setText(
      `⚡ TEAM ENERGY ${String(Math.round(state.teamEnergy)).padStart(3, "0")}%`,
    );
    this.hud.eventFeed.setText(state.eventFeed.join("\n"));
    this.hud.zone1.setText(
      state.structures.find((item) => item.id === "bridge-alpha")?.intact
        ? "BRIDGE ONLINE"
        : "OPEN PIT",
    );
    this.hud.zone2.setText(
      state.tick % 180 < 44 ? "HAZARD ACTIVE" : "HAZARD COOLING",
    );
    this.hud.zone3.setText(
      state.liftActiveUntilTick > state.tick ? "LIFT OVERDRIVE" : "LIFT CYCLING",
    );
    this.hud.recovery.setText(
      state.tsarBomb.phase === "recovery"
        ? `TEAM REBUILD  ·  ${Math.ceil((state.tsarBomb.recoveryUntilTick - state.tick) / TICKS.second)}s  ·  REPAIR x2`
        : "",
    );
    this.hud.result.setText(
      state.roundStatus === "success"
        ? "ASCENT SECURED\nROUND COMPLETE"
        : state.roundStatus === "failure"
          ? "TARGET MISSED\nREBUILD AND RETRY"
          : state.roundStatus === "paused"
            ? "SIMULATION PAUSED"
            : "",
    );

    this.movingPlatform.x = 302 + Math.sin(state.tick * 0.035) * 106;
    const liftBoost = state.liftActiveUntilTick > state.tick ? 0.09 : 0.035;
    this.liftCar.y = 346 + Math.sin(state.tick * liftBoost) * 66;
    this.hazardBeam.setAlpha(state.tick % 180 < 44 ? 0.92 : 0.09);
    this.renderTsarBomb();
    this.playStateAudio();
  }

  private renderTsarBomb(): void {
    const state = this.simulation.state;
    const bomb = state.tsarBomb;
    this.effects.clear();
    this.effectTitle.setVisible(false);
    this.effectSubtitle.setVisible(false);
    this.effectCount.setVisible(false);
    if (bomb.phase === "idle" || bomb.phase === "recovery") return;

    if (bomb.phase === "warning") {
      const elapsed = state.tick - bomb.startedTick;
      const countdown = Math.max(
        1,
        Math.ceil((TICKS.tsarWarning - elapsed) / TICKS.second),
      );
      this.effects.fillStyle(0x160308, 0.82);
      this.effects.fillRect(0, 0, 720, 1280);
      this.effects.fillStyle(0xff234f, 0.95);
      this.effects.fillRoundedRect(70, 466, 580, 220, 20);
      this.setEffectText(
        this.effectTitle,
        "ZAR-BOMBE",
        360,
        506,
        54,
        "#ffffff",
      );
      this.setEffectText(
        this.effectSubtitle,
        `INBOUND // ${bomb.actor?.displayName ?? bomb.actor?.username ?? "UNKNOWN"}`,
        360,
        576,
        18,
        "#23030a",
      );
      this.setEffectText(
        this.effectCount,
        String(countdown),
        360,
        620,
        48,
        "#23030a",
      );
    } else if (bomb.phase === "descending") {
      const descentStart = bomb.startedTick + TICKS.tsarWarning;
      const progress =
        (state.tick - descentStart) / Math.max(1, TICKS.tsarDescent);
      const y = 160 + progress * 720;
      this.effects.fillStyle(0x000000, 0.35);
      this.effects.fillRect(0, 0, 720, 1280);
      this.effects.fillStyle(0xff405c, 0.25);
      this.effects.fillCircle(360, y, 74);
      this.effects.fillStyle(0x10131a, 1);
      this.effects.fillEllipse(360, y, 58, 118);
      this.effects.fillTriangle(331, y - 25, 300, y - 68, 338, y - 52);
      this.effects.fillTriangle(389, y - 25, 420, y - 68, 382, y - 52);
      this.setEffectText(
        this.effectTitle,
        "ZAR-BOMBE",
        360,
        98,
        38,
        "#ff4d68",
      );
    } else if (bomb.phase === "impact") {
      this.effects.fillStyle(
        state.reducedMotion ? 0xff5a3d : 0xffffff,
        state.reducedMotion ? 0.34 : 0.92,
      );
      this.effects.fillRect(0, 0, 720, 1280);
      this.effects.lineStyle(16, 0xffd37a, 0.85);
      this.effects.strokeCircle(360, 780, 260);
      this.effects.fillStyle(0xff7a2b, 0.7);
      this.effects.fillCircle(360, 754, 118);
      this.effects.fillRoundedRect(322, 750, 76, 260, 34);
      this.effects.fillStyle(0xffd35a, 0.55);
      this.effects.fillEllipse(360, 690, 330, 150);
    }

    if (
      bomb.phase === "impact" &&
      this.lastTsarPhase !== "impact" &&
      !state.reducedMotion
    ) {
      this.cameras.main.shake(650, 0.012);
    }
  }

  private createEffectText(size: number): Phaser.GameObjects.Text {
    return this.add
      .text(0, 0, "", {
        fontFamily: "Arial Black, sans-serif",
        fontSize: `${size}px`,
        color: "#ffffff",
        align: "center",
      })
      .setOrigin(0.5, 0)
      .setDepth(90)
      .setVisible(false);
  }

  private setEffectText(
    text: Phaser.GameObjects.Text,
    value: string,
    x: number,
    y: number,
    size: number,
    color: string,
  ): void {
    text.setText(value);
    text.setPosition(x, y);
    text.setFontSize(size);
    text.setColor(color);
    text.setVisible(true);
  }

  private playStateAudio(): void {
    const state = this.simulation.state;
    if (state.rescuedCount > this.lastRescued) this.audio.play("rescue");
    if (state.tsarBomb.phase !== this.lastTsarPhase) {
      if (state.tsarBomb.phase === "warning") this.audio.play("warning");
      if (state.tsarBomb.phase === "descending") this.audio.play("countdown");
      if (state.tsarBomb.phase === "impact") this.audio.play("explosion");
      if (state.tsarBomb.phase === "recovery") this.audio.play("rebuild");
    }
    if (state.roundStatus !== this.lastStatus) {
      if (state.roundStatus === "success") this.audio.play("success");
      if (state.roundStatus === "failure") this.audio.play("failure");
    }
    this.lastRescued = state.rescuedCount;
    this.lastTsarPhase = state.tsarBomb.phase;
    this.lastStatus = state.roundStatus;
  }
}
