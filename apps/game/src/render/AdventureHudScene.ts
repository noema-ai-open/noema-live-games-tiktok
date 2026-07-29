import Phaser from "phaser";
import {
  GIFT_FALLBACKS,
  resolveGiftAsset,
  type GiftAssetKey,
} from "../assets/giftAssetResolver";
import { FIXED_HZ, LOGICAL_HEIGHT, LOGICAL_WIDTH } from "../config/gameConfig";
import type { FeedbackBus, GiftFeedback } from "../gifts/FeedbackBus";
import type { GiftCatalogConfig } from "../gifts/giftCatalog";
import type { Simulation } from "../simulation/Simulation";

const ICON_KEYS: Readonly<Record<GiftAssetKey, string>> = {
  rose: "gift-rose",
  doughnut: "gift-doughnut",
  "hand-heart": "gift-hand-heart",
  corgi: "gift-corgi",
  galaxy: "gift-galaxy",
};

const SLOT_DATA: readonly { key: GiftAssetKey; title: string; label: string }[] = [
  { key: "rose", title: "ROSE", label: "SPRINGEN" },
  { key: "doughnut", title: "DOUGHNUT", label: "3 BAUTEILE" },
  { key: "hand-heart", title: "HAND HEART", label: "BRÜCKE" },
  { key: "corgi", title: "CORGI", label: "HELFER" },
  { key: "galaxy", title: "GALAXY", label: "ZAR-BOMBE" },
];

export class AdventureHudScene extends Phaser.Scene {
  private levelName!: Phaser.GameObjects.Text;
  private timer!: Phaser.GameObjects.Text;
  private progressFill!: Phaser.GameObjects.Rectangle;
  private checkpointText!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Container;
  private promptIcon!: Phaser.GameObjects.Image;
  private promptTitle!: Phaser.GameObjects.Text;
  private promptSub!: Phaser.GameObjects.Text;
  private routePanel!: Phaser.GameObjects.Container;
  private routeText!: Phaser.GameObjects.Text;
  private resultPanel!: Phaser.GameObjects.Container;
  private resultText!: Phaser.GameObjects.Text;
  private feedbackPanel!: Phaser.GameObjects.Container;
  private feedbackIcon!: Phaser.GameObjects.Image;
  private feedbackText!: Phaser.GameObjects.Text;
  private unsubscribe: (() => void) | null = null;
  private feedbackHideAt = 0;

  constructor(
    private readonly simulation: Simulation,
    private readonly feedback: FeedbackBus,
    private catalog: GiftCatalogConfig,
  ) {
    super({ key: "HudScene", active: false });
  }

  setCatalog(catalog: GiftCatalogConfig): void {
    this.catalog = catalog;
  }

  preload(): void {
    for (const [key, url] of Object.entries(GIFT_FALLBACKS)) {
      this.load.image(ICON_KEYS[key as GiftAssetKey], url);
    }
  }

  create(): void {
    this.createTopBar();
    this.createGiftSlots();
    this.createObstaclePrompt();
    this.createRoutePanel();
    this.createResultPanel();
    this.createFeedbackPanel();
    this.unsubscribe = this.feedback.subscribe((payload) => this.showFeedback(payload));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());
  }

  update(): void {
    const state = this.simulation.state;
    this.levelName.setText(this.simulation.director.level.name);
    this.timer.setText(formatTime(state.remainingTicks));
    this.progressFill.setScale(Math.max(0.002, this.simulation.getAscentProgress()), 1);
    this.checkpointText.setText(
      `CHECKPOINTS ${"◆".repeat(state.checkpointCount)}${"◇".repeat(Math.max(0, 3 - state.checkpointCount))}`,
    );
    this.updatePrompt();
    this.updateRouteVote();
    this.updateResult();
    if (this.time.now >= this.feedbackHideAt) this.feedbackPanel.setVisible(false);
    void this.catalog;
  }

  private createTopBar(): void {
    this.add
      .rectangle(18, 18, LOGICAL_WIDTH - 36, 112, 0x06131d, 0.92)
      .setOrigin(0)
      .setStrokeStyle(2, 0x2ccad1, 0.55)
      .setDepth(1);
    this.levelName = this.add.text(36, 34, "", {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "18px",
      fontStyle: "bold",
      color: "#eafffb",
    });
    this.timer = this.add
      .text(LOGICAL_WIDTH - 36, 31, "04:30", {
        fontFamily: "JetBrains Mono, Consolas, monospace",
        fontSize: "27px",
        fontStyle: "bold",
        color: "#ffd36a",
      })
      .setOrigin(1, 0);
    this.add.rectangle(36, 92, 410, 10, 0x173242, 1).setOrigin(0, 0.5).setDepth(2);
    this.progressFill = this.add
      .rectangle(36, 92, 410, 10, 0x5dffe0, 1)
      .setOrigin(0, 0.5)
      .setDepth(3);
    this.checkpointText = this.add.text(470, 82, "", {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "13px",
      color: "#8fc7cf",
    });
  }

  private createGiftSlots(): void {
    this.add
      .rectangle(18, LOGICAL_HEIGHT - 146, LOGICAL_WIDTH - 36, 128, 0x06131d, 0.94)
      .setOrigin(0)
      .setStrokeStyle(2, 0x2ccad1, 0.45)
      .setDepth(2);
    SLOT_DATA.forEach((slot, index) => {
      const x = 88 + index * 136;
      this.add.image(x, LOGICAL_HEIGHT - 96, ICON_KEYS[slot.key]).setDisplaySize(64, 64).setDepth(4);
      this.add
        .text(x, LOGICAL_HEIGHT - 56, slot.title, {
          fontFamily: "Inter, Arial, sans-serif",
          fontSize: "11px",
          fontStyle: "bold",
          color: "#ffffff",
        })
        .setOrigin(0.5, 0)
        .setDepth(4);
      this.add
        .text(x, LOGICAL_HEIGHT - 38, slot.label, {
          fontFamily: "Inter, Arial, sans-serif",
          fontSize: "12px",
          fontStyle: "bold",
          color: slot.key === "galaxy" ? "#ff7ca7" : "#65f4df",
        })
        .setOrigin(0.5, 0)
        .setDepth(4);
    });
  }

  private createObstaclePrompt(): void {
    const plate = this.add.rectangle(0, 0, 330, 158, 0x071924, 0.96).setStrokeStyle(4, 0x5dffe0, 0.9);
    this.promptIcon = this.add.image(-102, 0, ICON_KEYS.rose).setDisplaySize(104, 104);
    this.promptTitle = this.add.text(-30, -47, "", {
      fontFamily: "Inter, Arial Black, sans-serif",
      fontSize: "21px",
      fontStyle: "bold",
      color: "#ffffff",
    });
    this.promptSub = this.add.text(-30, -8, "", {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "17px",
      fontStyle: "bold",
      color: "#65f4df",
      wordWrap: { width: 170 },
    });
    this.prompt = this.add
      .container(LOGICAL_WIDTH / 2, 470, [plate, this.promptIcon, this.promptTitle, this.promptSub])
      .setDepth(60)
      .setVisible(false);
  }

  private createRoutePanel(): void {
    const plate = this.add.rectangle(0, 0, 650, 210, 0x071924, 0.96).setStrokeStyle(4, 0xffd36a, 0.85);
    const heading = this.add
      .text(0, -70, "CHAT ENTSCHEIDET · 10 SEKUNDEN", {
        fontFamily: "Inter, Arial Black, sans-serif",
        fontSize: "23px",
        fontStyle: "bold",
        color: "#ffd36a",
      })
      .setOrigin(0.5);
    this.routeText = this.add
      .text(0, 20, "", {
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: "32px",
        fontStyle: "bold",
        color: "#eafffb",
        align: "center",
      })
      .setOrigin(0.5);
    this.routePanel = this.add
      .container(LOGICAL_WIDTH / 2, 400, [plate, heading, this.routeText])
      .setDepth(62)
      .setVisible(false);
  }

  private createResultPanel(): void {
    const plate = this.add.rectangle(0, 0, 650, 340, 0x06131d, 0.97).setStrokeStyle(5, 0x5dffe0, 0.9);
    this.resultText = this.add
      .text(0, 0, "", {
        fontFamily: "Inter, Arial Black, sans-serif",
        fontSize: "39px",
        fontStyle: "bold",
        color: "#ffffff",
        align: "center",
        wordWrap: { width: 590 },
      })
      .setOrigin(0.5);
    this.resultPanel = this.add
      .container(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, [plate, this.resultText])
      .setDepth(80)
      .setVisible(false);
  }

  private createFeedbackPanel(): void {
    const plate = this.add.rectangle(0, 0, 610, 118, 0x071924, 0.96).setStrokeStyle(3, 0x5dffe0, 0.8);
    this.feedbackIcon = this.add.image(-242, 0, ICON_KEYS.rose).setDisplaySize(84, 84);
    this.feedbackText = this.add.text(-182, -38, "", {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "20px",
      fontStyle: "bold",
      color: "#ffffff",
      lineSpacing: 6,
    });
    this.feedbackPanel = this.add
      .container(LOGICAL_WIDTH / 2, 205, [plate, this.feedbackIcon, this.feedbackText])
      .setDepth(70)
      .setVisible(false);
  }

  private updatePrompt(): void {
    const state = this.simulation.state;
    const segment = this.simulation.director.current;
    const progress = segment.obstacleType ? this.simulation.obstacles.get(segment) : null;
    const visible = ["blocked", "performing_action", "helper_active"].includes(state.heroState);
    if (!visible || !progress || progress.resolved || segment.type === "route_fork") {
      this.prompt.setVisible(false);
      return;
    }
    const prompt = promptFor(segment.type, progress.builtParts, progress.requiredParts);
    if (!prompt) {
      this.prompt.setVisible(false);
      return;
    }
    this.promptIcon.setTexture(ICON_KEYS[prompt.key]);
    this.promptTitle.setText(prompt.title);
    this.promptSub.setText(prompt.sub);
    const camera = this.scene.get("AdventureScene").cameras.main;
    const x = Phaser.Math.Clamp(
      ((segment.waitX ?? this.simulation.hero.x) - camera.scrollX) * camera.zoom + 150,
      178,
      LOGICAL_WIDTH - 178,
    );
    const y = Phaser.Math.Clamp(segment.groundY * camera.zoom - 175, 310, 610);
    this.prompt.setPosition(x, y).setVisible(true);
  }

  private updateRouteVote(): void {
    const vote = this.simulation.routeVote.state;
    this.routePanel.setVisible(vote.active);
    if (!vote.active) return;
    const seconds = Math.max(0, Math.ceil((vote.endsTick - this.simulation.state.tick) / FIXED_HZ));
    this.routeText.setText(`1 · LINKS   ${vote.left}\n2 · RECHTS  ${vote.right}\n${seconds}s`);
  }

  private updateResult(): void {
    const state = this.simulation.state;
    const terminal = state.roundStatus === "success" || state.roundStatus === "failure";
    this.resultPanel.setVisible(terminal);
    if (!terminal) return;
    if (state.roundStatus === "success") {
      const contributor = state.lastContributor?.displayName ?? state.lastContributor?.username ?? "TEAM NOEMA";
      this.resultText
        .setText(`GIPFEL ERREICHT\nLEUCHTFEUER AKTIVIERT\n\nLETZTE HILFE:\n${contributor.toUpperCase()}`)
        .setColor("#7ffff0");
    } else {
      this.resultText.setText("ZEIT ABGELAUFEN\n\nDER GIPFEL WARTET").setColor("#ffb3c5");
    }
  }

  private showFeedback(payload: GiftFeedback): void {
    const resolution = resolveGiftAsset(payload.giftLabel, payload.bridgeIconUrl);
    const fallbackTexture = ICON_KEYS[resolution.key];
    this.feedbackIcon.setTexture(fallbackTexture);
    this.feedbackText.setText(
      `${payload.sender}\n${payload.giftLabel} ×${payload.repeatCount}\n${payload.effectLabel}`,
    );
    this.feedbackPanel.setVisible(true);
    this.feedbackHideAt = this.time.now + (payload.tier === "large" ? 5200 : 2800);
    if (!resolution.usesBridgeIcon) return;
    const dynamicKey = `bridge-gift-${hashKey(resolution.primaryUrl)}`;
    if (this.textures.exists(dynamicKey)) {
      this.feedbackIcon.setTexture(dynamicKey);
      return;
    }
    if (this.load.isLoading()) return;
    this.load.image(dynamicKey, resolution.primaryUrl);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (this.textures.exists(dynamicKey)) this.feedbackIcon.setTexture(dynamicKey);
    });
    this.load.once("loaderror", () => this.feedbackIcon.setTexture(fallbackTexture));
    this.load.start();
  }
}

function promptFor(
  type: string,
  built: number,
  required: number,
): { key: GiftAssetKey; title: string; sub: string } | null {
  if (type === "small_gap") return { key: "rose", title: "ROSE", sub: "1× SPRINGEN" };
  if (type === "high_ledge") return { key: "doughnut", title: "DOUGHNUT", sub: "3 STEINE" };
  if (type === "broken_bridge") {
    return { key: "doughnut", title: "DOUGHNUT", sub: `${required - built} BRÜCKENTEILE` };
  }
  if (type === "ravine") {
    return built === 0
      ? { key: "hand-heart", title: "HAND HEART", sub: "BRÜCKE BAUEN\nODER DOUGHNUT ×2" }
      : { key: "doughnut", title: "DOUGHNUT", sub: `${required - built} TEILE FEHLEN` };
  }
  if (type === "repair_gate") return { key: "corgi", title: "CORGI", sub: "TOR REPARIEREN" };
  return null;
}

function formatTime(ticks: number): string {
  const seconds = Math.max(0, Math.ceil(ticks / FIXED_HZ));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function hashKey(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}
