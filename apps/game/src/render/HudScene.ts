import Phaser from "phaser";
import {
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  RESCUE_TARGET,
  TICKS,
  WORKER_COUNT,
} from "../config/gameConfig";
import type { FeedbackBus, GiftFeedback } from "../gifts/FeedbackBus";
import { getAction } from "../gifts/actions";
import type { GiftCatalogConfig } from "../gifts/giftCatalog";
import type { Simulation } from "../simulation/Simulation";
import { PALETTE, toCss } from "./palette";
import { ensureTextures } from "./textures";

type Toast = {
  key: string;
  container: Phaser.GameObjects.Container;
  plate: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Text;
  title: Phaser.GameObjects.Text;
  subtitle: Phaser.GameObjects.Text;
  count: Phaser.GameObjects.Text;
  expiresAt: number;
  active: boolean;
};

const TOAST_SLOTS = 4;
const TOAST_LIFETIME_MS = 4200;

/**
 * Overlay scene. It runs on its own camera so world shake never wobbles the
 * readouts, and it is the only place that shows text to viewers.
 */
export class HudScene extends Phaser.Scene {
  private rescueValue!: Phaser.GameObjects.Text;
  private rescueBar!: Phaser.GameObjects.Rectangle;
  private timerValue!: Phaser.GameObjects.Text;
  private energyBar!: Phaser.GameObjects.Rectangle;
  private energyValue!: Phaser.GameObjects.Text;
  private statusChips: {
    root: Phaser.GameObjects.Container;
    plate: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
  }[] = [];
  private progressFill!: Phaser.GameObjects.Rectangle;
  private legend!: Phaser.GameObjects.Text;
  private resultBanner!: Phaser.GameObjects.Container;
  private resultText!: Phaser.GameObjects.Text;
  private bigEvent!: Phaser.GameObjects.Text;
  private toasts: Toast[] = [];
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly simulation: Simulation,
    private readonly feedback: FeedbackBus,
    private catalog: GiftCatalogConfig,
  ) {
    super({ key: "HudScene", active: false });
  }

  setCatalog(catalog: GiftCatalogConfig): void {
    this.catalog = catalog;
    if (this.legend) this.legend.setText(this.buildLegend());
  }

  create(): void {
    ensureTextures(this);
    this.buildTopBar();
    this.buildProgressRail();
    this.buildBottomBar();
    this.buildToasts();
    this.buildBanners();

    this.unsubscribe = this.feedback.subscribe((item) =>
      this.showFeedback(item),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
    });
  }

  update(): void {
    const state = this.simulation.state;
    const now = this.time.now;

    const rescued = state.rescuedCount;
    this.rescueValue.setText(
      `${String(rescued).padStart(2, "0")} / ${WORKER_COUNT}`,
    );
    this.rescueBar.setScale(
      Phaser.Math.Clamp(rescued / RESCUE_TARGET, 0, 1),
      1,
    );

    const seconds = Math.ceil(state.remainingTicks / TICKS.second);
    this.timerValue.setText(
      `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`,
    );
    this.timerValue.setColor(seconds <= 30 ? toCss(PALETTE.danger) : PALETTE.text);

    const energy = Phaser.Math.Clamp(state.teamEnergy / 100, 0, 1);
    this.energyBar.setScale(energy, 1);
    this.energyValue.setText(`${Math.round(state.teamEnergy)}%`);

    this.updateChips(state.tick);

    const progress =
      this.simulation.workers.reduce(
        (total, worker) =>
          total + (worker.state === "rescued" ? 1 : worker.progress),
        0,
      ) / WORKER_COUNT;
    this.progressFill.setScale(1, Phaser.Math.Clamp(progress, 0.01, 1));

    this.resultText.setText(this.resultLabel());
    this.resultBanner.setVisible(this.resultLabel().length > 0);

    this.bigEvent.setText(state.eventFeed[0] ?? "");

    this.updateToasts(now);
  }

  // --- construction -------------------------------------------------------

  private buildTopBar(): void {
    // The plate stops above the exit gate (world y 108) so the goal stays free.
    const plate = this.add.graphics().setDepth(1);
    plate.fillStyle(0x03080f, 0.84);
    plate.fillRoundedRect(14, 10, 692, 84, 14);
    plate.lineStyle(2, PALETTE.towerEdge, 0.55);
    plate.strokeRoundedRect(14, 10, 692, 84, 14);

    this.add
      .text(32, 18, "GERETTET", {
        fontFamily: "Inter, Arial, sans-serif",
        fontStyle: "bold",
        fontSize: "13px",
        color: PALETTE.textDim,
      })
      .setDepth(2);
    this.rescueValue = this.add
      .text(30, 32, "00 / 30", {
        fontFamily: "Inter, Arial Black, sans-serif",
        fontStyle: "bold",
        fontSize: "36px",
        color: toCss(PALETTE.support),
      })
      .setDepth(2);
    this.add
      .text(32, 74, `ZIEL ${RESCUE_TARGET}`, {
        fontFamily: "Inter, Arial, sans-serif",
        fontStyle: "bold",
        fontSize: "12px",
        color: PALETTE.textDim,
      })
      .setDepth(2);

    this.add.rectangle(214, 80, 150, 7, 0x0e2430, 1).setOrigin(0, 0.5).setDepth(2);
    this.rescueBar = this.add
      .rectangle(214, 80, 150, 7, PALETTE.support, 1)
      .setOrigin(0, 0.5)
      .setDepth(3);

    this.add
      .text(692, 18, "ZEIT", {
        fontFamily: "Inter, Arial, sans-serif",
        fontStyle: "bold",
        fontSize: "13px",
        color: PALETTE.textDim,
      })
      .setOrigin(1, 0)
      .setDepth(2);
    this.timerValue = this.add
      .text(692, 32, "04:00", {
        fontFamily: "Inter, Arial Black, sans-serif",
        fontStyle: "bold",
        fontSize: "36px",
        color: PALETTE.text,
      })
      .setOrigin(1, 0)
      .setDepth(2);

    this.add
      .text(392, 74, "TEAM-ENERGIE", {
        fontFamily: "Inter, Arial, sans-serif",
        fontStyle: "bold",
        fontSize: "12px",
        color: toCss(PALETTE.warn),
      })
      .setDepth(2);
    this.add.rectangle(512, 80, 130, 7, 0x2a2312, 1).setOrigin(0, 0.5).setDepth(2);
    this.energyBar = this.add
      .rectangle(512, 80, 130, 7, PALETTE.warn, 1)
      .setOrigin(0, 0.5)
      .setDepth(3);
    this.energyValue = this.add
      .text(692, 74, "15%", {
        fontFamily: "Inter, Arial, sans-serif",
        fontStyle: "bold",
        fontSize: "13px",
        color: toCss(PALETTE.warn),
      })
      .setOrigin(1, 0)
      .setDepth(3);

    // Status chips run along the very bottom, clear of the tower and the goal.
    const labels = ["SCHILD", "LIFT", "GEFAHR", "UMWELT"];
    for (const [index, label] of labels.entries()) {
      const x = 14 + index * 173;
      const chipPlate = this.add
        .rectangle(x, 1240, 166, 30, 0x05121b, 0.88)
        .setOrigin(0, 0)
        .setStrokeStyle(2, PALETTE.towerEdge, 0.5)
        .setDepth(2);
      const chipLabel = this.add
        .text(x + 83, 1255, label, {
          fontFamily: "Inter, Arial, sans-serif",
          fontStyle: "bold",
          fontSize: "13px",
          color: PALETTE.textDim,
        })
        .setOrigin(0.5)
        .setDepth(3);
      this.statusChips.push({
        root: this.add.container(0, 0).setDepth(3),
        plate: chipPlate,
        label: chipLabel,
      });
    }
  }

  private buildProgressRail(): void {
    this.add
      .rectangle(700, 640, 10, 420, 0x0a1c28, 0.9)
      .setDepth(2)
      .setOrigin(0.5);
    this.progressFill = this.add
      .rectangle(700, 850, 10, 420, PALETTE.energy, 0.95)
      .setOrigin(0.5, 1)
      .setDepth(3);
    this.add
      .text(700, 414, "▲", {
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
        color: toCss(PALETTE.support),
      })
      .setOrigin(0.5)
      .setDepth(3);
  }

  private buildBottomBar(): void {
    const plate = this.add.graphics().setDepth(1);
    plate.fillStyle(0x03080f, 0.86);
    plate.fillRoundedRect(378, 1040, 328, 190, 16);
    plate.lineStyle(2, PALETTE.towerEdge, 0.5);
    plate.strokeRoundedRect(378, 1040, 328, 190, 16);

    this.add
      .text(396, 1052, "DEIN GESCHENK WIRKT", {
        fontFamily: "Inter, Arial, sans-serif",
        fontStyle: "bold",
        fontSize: "14px",
        color: toCss(PALETTE.warn),
      })
      .setDepth(2);
    this.legend = this.add
      .text(396, 1076, this.buildLegend(), {
        fontFamily: "Inter, Arial, sans-serif",
        fontStyle: "bold",
        fontSize: "15px",
        color: PALETTE.text,
        lineSpacing: 5,
      })
      .setDepth(2);

    this.bigEvent = this.add
      .text(542, 1214, "", {
        fontFamily: "Inter, Arial, sans-serif",
        fontStyle: "bold",
        fontSize: "13px",
        color: PALETTE.textDim,
      })
      .setOrigin(0.5)
      .setDepth(2);

    this.add
      .text(360, 1224, "Powered by NOEMA AI", {
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: "12px",
        color: "#5d7688",
      })
      .setOrigin(0.5)
      .setDepth(2);
  }

  /** Legend is generated from the active mapping, never hard-coded. */
  private buildLegend(): string {
    const wanted = ["repair", "bridge", "lift", "team_shield", "tsar_bomb"];
    const lines: string[] = [];
    for (const action of wanted) {
      const entry = this.catalog.entries.find(
        (item) => item.action === action && item.enabled,
      );
      if (!entry) continue;
      const definition = getAction(entry.action);
      lines.push(`${definition.icon} ${entry.displayName} → ${definition.label}`);
      if (lines.length >= 5) break;
    }
    return lines.join("\n");
  }

  private buildToasts(): void {
    for (let index = 0; index < TOAST_SLOTS; index += 1) {
      const y = 1196 - index * 58;
      const plate = this.add
        .rectangle(0, 0, 348, 50, 0x061420, 0.94)
        .setOrigin(0, 0.5)
        .setStrokeStyle(2, PALETTE.energy, 0.85);
      const icon = this.add
        .text(16, 0, "🌹", { fontSize: "24px" })
        .setOrigin(0, 0.5);
      const title = this.add
        .text(54, -10, "", {
          fontFamily: "Inter, Arial, sans-serif",
          fontStyle: "bold",
          fontSize: "17px",
          color: PALETTE.text,
        })
        .setOrigin(0, 0.5);
      const subtitle = this.add
        .text(54, 11, "", {
          fontFamily: "Inter, Arial, sans-serif",
          fontStyle: "bold",
          fontSize: "14px",
          color: toCss(PALETTE.support),
        })
        .setOrigin(0, 0.5);
      const count = this.add
        .text(334, 0, "", {
          fontFamily: "Inter, Arial Black, sans-serif",
          fontStyle: "bold",
          fontSize: "22px",
          color: toCss(PALETTE.warn),
        })
        .setOrigin(1, 0.5);
      const container = this.add
        .container(18, y, [plate, icon, title, subtitle, count])
        .setDepth(6)
        .setVisible(false);
      this.toasts.push({
        key: "",
        container,
        plate,
        icon,
        title,
        subtitle,
        count,
        expiresAt: 0,
        active: false,
      });
    }
  }

  private buildBanners(): void {
    const plate = this.add
      .rectangle(0, 0, 560, 130, 0x03090f, 0.93)
      .setStrokeStyle(3, PALETTE.support, 0.9);
    this.resultText = this.add
      .text(0, 0, "", {
        fontFamily: "Inter, Arial Black, sans-serif",
        fontStyle: "bold",
        fontSize: "40px",
        color: PALETTE.text,
        align: "center",
      })
      .setOrigin(0.5);
    this.resultBanner = this.add
      .container(360, 620, [plate, this.resultText])
      .setDepth(9)
      .setVisible(false);
  }

  // --- per frame ----------------------------------------------------------

  private updateChips(tick: number): void {
    const state = this.simulation.state;
    const chipStates: { text: string; color: number; active: boolean }[] = [
      {
        text:
          state.shieldUntilTick > tick
            ? `SCHILD ${Math.ceil((state.shieldUntilTick - tick) / TICKS.second)}s`
            : "SCHILD AUS",
        color: PALETTE.energy,
        active: state.shieldUntilTick > tick,
      },
      {
        text:
          state.liftActiveUntilTick > tick
            ? `LIFT OVERDRIVE ${Math.ceil((state.liftActiveUntilTick - tick) / TICKS.second)}s`
            : "LIFT NORMAL",
        color: PALETTE.support,
        active: state.liftActiveUntilTick > tick,
      },
      {
        text: tick % 180 < 44 ? "GEFAHR AKTIV" : "GEFAHR RUHT",
        color: PALETTE.danger,
        active: tick % 180 < 44,
      },
      {
        text:
          state.environmentMode === "wind"
            ? "STURM"
            : state.environmentMode === "low_gravity"
              ? "SCHWERELOS"
              : "UMWELT STABIL",
        color: PALETTE.warn,
        active: state.environmentMode !== "none",
      },
    ];

    for (const [index, chip] of this.statusChips.entries()) {
      const next = chipStates[index]!;
      chip.label.setText(next.text);
      chip.label.setColor(next.active ? toCss(next.color) : PALETTE.textDim);
      chip.plate.setStrokeStyle(
        2,
        next.active ? next.color : PALETTE.towerEdge,
        next.active ? 0.95 : 0.4,
      );
    }
  }

  private resultLabel(): string {
    const status = this.simulation.state.roundStatus;
    if (status === "success") return "AUFSTIEG GESICHERT\nRUNDE GESCHAFFT";
    if (status === "failure") return "ZIEL VERFEHLT\nNEUE RUNDE STARTEN";
    if (status === "paused") return "PAUSIERT";
    return "";
  }

  private showFeedback(item: GiftFeedback): void {
    const existing = this.toasts.find(
      (toast) => toast.active && toast.key === item.key,
    );
    const toast = existing ?? this.claimToast();
    toast.key = item.key;
    toast.active = true;
    toast.expiresAt = this.time.now + TOAST_LIFETIME_MS;
    toast.icon.setText(item.icon);
    toast.title.setText(item.sender);
    toast.subtitle.setText(
      item.applied ? item.effectLabel : `${item.effectLabel} …`,
    );
    toast.count.setText(item.repeatCount > 1 ? `×${item.repeatCount}` : "");
    const accent =
      item.tier === "large"
        ? PALETTE.catastrophe
        : item.tier === "medium"
          ? PALETTE.warn
          : PALETTE.energy;
    toast.plate.setStrokeStyle(2, accent, 0.95);
    toast.subtitle.setColor(toCss(accent));
    toast.container.setVisible(true).setAlpha(1);

    if (!existing) {
      toast.container.setScale(0.86, 1);
      this.tweens.add({
        targets: toast.container,
        scaleX: 1,
        duration: 180,
        ease: "Back.easeOut",
      });
    } else {
      this.tweens.add({
        targets: toast.count,
        scale: { from: 1.4, to: 1 },
        duration: 160,
        ease: "Cubic.easeOut",
      });
    }
  }

  /** Reuses the oldest slot instead of creating new objects. */
  private claimToast(): Toast {
    const free = this.toasts.find((toast) => !toast.active);
    if (free) return free;
    return this.toasts.reduce((oldest, toast) =>
      toast.expiresAt < oldest.expiresAt ? toast : oldest,
    );
  }

  private updateToasts(now: number): void {
    for (const toast of this.toasts) {
      if (!toast.active) continue;
      const remaining = toast.expiresAt - now;
      if (remaining <= 0) {
        toast.active = false;
        toast.key = "";
        toast.container.setVisible(false);
        continue;
      }
      if (remaining < 600) toast.container.setAlpha(remaining / 600);
    }
  }
}

export const HUD_BOUNDS = { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT };
