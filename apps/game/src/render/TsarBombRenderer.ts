import Phaser from "phaser";
import { LOGICAL_HEIGHT, LOGICAL_WIDTH, TICKS } from "../config/gameConfig";
import type { SimulationState, TsarPhase } from "../simulation/types";

export class TsarBombRenderer {
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private readonly warning: Phaser.GameObjects.Text;
  private readonly sender: Phaser.GameObjects.Text;
  private readonly countdown: Phaser.GameObjects.Text;
  private readonly bomb: Phaser.GameObjects.Container;
  private readonly rebuild: Phaser.GameObjects.Text;
  private lastPhase: TsarPhase = "idle";

  constructor(private readonly scene: Phaser.Scene) {
    this.overlay = scene.add
      .rectangle(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0xff164f, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(100);
    this.warning = scene.add
      .text(LOGICAL_WIDTH / 2, 112, "ZAR-BOMBE", {
        fontFamily: "Inter, Arial Black, sans-serif",
        fontSize: "70px",
        fontStyle: "bold",
        color: "#fff3f6",
        stroke: "#7d082b",
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(103)
      .setVisible(false);
    this.sender = scene.add
      .text(LOGICAL_WIDTH / 2, 180, "", {
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: "25px",
        fontStyle: "bold",
        color: "#ffcad8",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(103)
      .setVisible(false);
    this.countdown = scene.add
      .text(LOGICAL_WIDTH / 2, 310, "3", {
        fontFamily: "Inter, Arial Black, sans-serif",
        fontSize: "150px",
        fontStyle: "bold",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(103)
      .setVisible(false);

    const shell = scene.add
      .circle(0, 0, 46, 0x171c29, 1)
      .setStrokeStyle(6, 0xff3c73, 1);
    const stripe = scene.add.rectangle(0, 0, 68, 16, 0xffd36a, 1).setRotation(-0.4);
    const spark = scene.add.circle(0, -55, 9, 0xffffff, 1);
    this.bomb = scene.add
      .container(LOGICAL_WIDTH / 2, -100, [shell, stripe, spark])
      .setScrollFactor(0)
      .setDepth(104)
      .setVisible(false);
    this.rebuild = scene.add
      .text(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, "TEAM REBUILD", {
        fontFamily: "Inter, Arial Black, sans-serif",
        fontSize: "64px",
        fontStyle: "bold",
        color: "#7ffff0",
        backgroundColor: "#071924dd",
        padding: { x: 34, y: 20 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(105)
      .setVisible(false);
  }

  update(state: SimulationState): void {
    const bomb = state.tsarBomb;
    const changed = bomb.phase !== this.lastPhase;
    this.hide();

    if (bomb.phase === "warning") {
      const elapsed = state.tick - bomb.startedTick;
      const seconds = Math.max(1, Math.ceil((TICKS.tsarWarning - elapsed) / TICKS.second));
      this.overlay.setAlpha(state.reducedMotion ? 0.08 : 0.12 + Math.abs(Math.sin(elapsed * 0.18)) * 0.18);
      this.warning.setVisible(true);
      this.sender
        .setText(`${senderName(state)} HAT DIE ZAR-BOMBE AKTIVIERT`)
        .setVisible(true);
      this.countdown.setText(String(seconds)).setVisible(true);
    } else if (bomb.phase === "descending") {
      const start = bomb.startedTick + TICKS.tsarWarning;
      const progress = Phaser.Math.Clamp((state.tick - start) / TICKS.tsarDescent, 0, 1);
      this.overlay.setAlpha(state.reducedMotion ? 0.08 : 0.15);
      this.warning.setVisible(true);
      this.sender.setText(senderName(state)).setVisible(true);
      this.bomb
        .setVisible(true)
        .setPosition(LOGICAL_WIDTH / 2, -80 + progress * (LOGICAL_HEIGHT + 130));
      if (!state.reducedMotion) this.bomb.rotation = progress * 1.4;
    } else if (bomb.phase === "impact") {
      this.overlay.setAlpha(state.reducedMotion ? 0.25 : 0.82);
      this.rebuild.setVisible(true);
      if (changed) {
        this.scene.cameras.main.shake(
          state.reducedMotion ? 120 : 620,
          state.reducedMotion ? 0.0015 : 0.012,
        );
      }
    } else if (bomb.phase === "recovery") {
      this.overlay.setFillStyle(0x082d35, 0.28).setAlpha(1);
      this.rebuild.setVisible(true);
    }

    this.lastPhase = bomb.phase;
  }

  private hide(): void {
    this.overlay.setFillStyle(0xff164f, 1).setAlpha(0);
    this.warning.setVisible(false);
    this.sender.setVisible(false);
    this.countdown.setVisible(false);
    this.bomb.setVisible(false);
    this.rebuild.setVisible(false);
  }
}

function senderName(state: SimulationState): string {
  const actor = state.tsarBomb.actor;
  return (actor?.displayName ?? actor?.username ?? "UNBEKANNT").toUpperCase();
}
