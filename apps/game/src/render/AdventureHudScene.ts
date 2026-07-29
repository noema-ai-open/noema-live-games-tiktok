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

const SLOT_DATA: readonly {
  key: GiftAssetKey;
  title: string;
  label: string;
  accent: number;
}[] = [
  { key: "rose", title: "ROSE", label: "SPRINGEN", accent: 0xff6aa9 },
  { key: "doughnut", title: "DOUGHNUT", label: "3 BAUTEILE", accent: 0xff86c8 },
  { key: "hand-heart", title: "HAND HEART", label: "BRÜCKE", accent: 0xffbe63 },
  { key: "corgi", title: "CORGI", label: "HELFER", accent: 0x67ef9b },
  { key: "galaxy", title: "GALAXY", label: "ZAR-BOMBE", accent: 0xb979ff },
];

/**
 * Stream-safe HUD for the 720x960 block below the camera image.
 *
 * Gameplay remains visible in the upper part of the game block. TikTok may
 * cover the lower third with chat, so progress and the permanent legend live
 * there while the timer and current action remain above the overlay zone.
 */
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
    this.add
      .text(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - 3, "Powered by NOEMA AI", {
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: "11px",
        color: "#6f9ba5",
      })
      .setOrigin(0.5, 1)
      .setDepth(4);
    this.unsubscribe = this.feedback.subscribe((payload) => this.showFeedback(payload));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe?.());
  }

  update(): void {
    const state = this.simulation.state;
    this.levelName.setText(
      `LEVEL ${state.levelIndex + 1}/${state.levelCount} · ${this.simulation.director.level.name}`,
    );
    this.timer.setText(formatTime(state.remainingTicks));
    const seconds = Math.ceil(state.remainingTicks / FIXED_HZ);
    this.timer.setColor(seconds <= 30 ? "#ff668d" : seconds <= 60 ? "#ffd36a" : "#ffffff");
    this.timer.setScale(
      !state.reducedMotion && seconds <= 30
        ? 1 + Math.abs(Math.sin(state.tick * 0.16)) * 0.08
        : 1,
    );
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
      .rectangle(18, 14, LOGICAL_WIDTH - 36, 66, 0x041019, 0.86)
      .setOrigin(0)
      .setStrokeStyle(2, 0x2ccad1, 0.62)
      .setDepth(1);

    this.add
      .text(34, 22, "NOEMA ASCENT", {
        fontFamily: "Inter, Arial Black, sans-serif",
        fontSize: "13px",
        fontStyle: "bold",
        color: "#65f4df",
      })
      .setDepth(3);

    this.levelName = this.add.text(34, 47, "", {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "bold",
      color: "#eafffb",
    }).setDepth(5);

    this.timer = this.add
      .text(LOGICAL_WIDTH - 34, 22, "04:30", {
        fontFamily: "JetBrains Mono, Consolas, monospace",
        fontSize: "31px",
        fontStyle: "bold",
        color: "#ffd36a",
      })
      .setOrigin(1, 0)
      .setDepth(6);

    this.add
      .rectangle(18, 724, LOGICAL_WIDTH - 36, 66, 0x041019, 0.91)
      .setOrigin(0)
      .setStrokeStyle(2, 0x2ccad1, 0.52)
      .setDepth(2);
    this.add
      .text(32, 733, "KAMPAGNENFORTSCHRITT", {
        fontFamily: "Inter, Arial Black, sans-serif",
        fontSize: "11px",
        fontStyle: "bold",
        color: "#86b9c2",
      })
      .setDepth(4);
    this.add.rectangle(32, 766, 410, 12, 0x173242, 1).setOrigin(0, 0.5).setDepth(2);
    this.progressFill = this.add
      .rectangle(32, 766, 410, 12, 0x5dffe0, 1)
      .setOrigin(0, 0.5)
      .setDepth(3);

    this.checkpointText = this.add.text(466, 757, "", {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "11px",
      fontStyle: "bold",
      color: "#8fc7cf",
    });
  }

  private createGiftSlots(): void {
    this.add
      .rectangle(18, 800, LOGICAL_WIDTH - 36, 142, 0x041019, 0.94)
      .setOrigin(0)
      .setStrokeStyle(2, 0x2ccad1, 0.48)
      .setDepth(2);

    this.add
      .text(30, 807, "GESCHENKE", {
        fontFamily: "Inter, Arial Black, sans-serif",
        fontSize: "11px",
        fontStyle: "bold",
        color: "#86b9c2",
      })
      .setDepth(4);

    SLOT_DATA.forEach((slot, index) => {
      const x = 76 + index * 142;
      this.add
        .rectangle(x, 873, 126, 108, 0x071924, 0.94)
        .setStrokeStyle(2, slot.accent, slot.key === "galaxy" ? 0.92 : 0.62)
        .setDepth(3);
      this.add
        .circle(x, 851, 31, slot.accent, 0.08)
        .setStrokeStyle(1, slot.accent, 0.2)
        .setDepth(3);
      this.add.image(x, 851, ICON_KEYS[slot.key]).setDisplaySize(58, 58).setDepth(4);
      this.add
        .text(x, 884, slot.title, {
          fontFamily: "Inter, Arial, sans-serif",
          fontSize: "10px",
          fontStyle: "bold",
          color: "#ffffff",
        })
        .setOrigin(0.5, 0)
        .setDepth(4);
      this.add
        .text(x, 906, slot.label, {
          fontFamily: "Inter, Arial, sans-serif",
          fontSize: "11px",
          fontStyle: "bold",
          color: slot.key === "galaxy" ? "#ff7ca7" : "#65f4df",
        })
        .setOrigin(0.5, 0)
        .setDepth(4);
    });
  }

  private createObstaclePrompt(): void {
    const glow = this.add.rectangle(0, 0, 358, 176, 0x42e8dc, 0.08);
    const plate = this.add
      .rectangle(0, 0, 342, 160, 0x05131d, 0.97)
      .setStrokeStyle(4, 0x5dffe0, 0.94);
    this.promptIcon = this.add.image(-105, 0, ICON_KEYS.rose).setDisplaySize(108, 108);
    this.promptTitle = this.add.text(-32, -48, "", {
      fontFamily: "Inter, Arial Black, sans-serif",
      fontSize: "22px",
      fontStyle: "bold",
      color: "#ffffff",
    });
    this.promptSub = this.add.text(-32, -8, "", {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "18px",
      fontStyle: "bold",
      color: "#65f4df",
      wordWrap: { width: 178 },
    });
    this.prompt = this.add
      .container(LOGICAL_WIDTH - 185, 255, [glow, plate, this.promptIcon, this.promptTitle, this.promptSub])
      .setDepth(60)
      .setVisible(false);
  }

  private createRoutePanel(): void {
    const plate = this.add
      .rectangle(0, 0, 342, 176, 0x05131d, 0.97)
      .setStrokeStyle(4, 0xffd36a, 0.9);
    const heading = this.add
      .text(0, -57, "CHAT ENTSCHEIDET · 10 SEKUNDEN", {
        fontFamily: "Inter, Arial Black, sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#ffd36a",
      })
      .setOrigin(0.5);
    this.routeText = this.add
      .text(0, 18, "", {
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: "27px",
        fontStyle: "bold",
        color: "#eafffb",
        align: "center",
      })
      .setOrigin(0.5);
    this.routePanel = this.add
      .container(LOGICAL_WIDTH - 185, 255, [plate, heading, this.routeText])
      .setDepth(62)
      .setVisible(false);
  }

  private createResultPanel(): void {
    const plate = this.add
      .rectangle(0, 0, 650, 340, 0x041019, 0.98)
      .setStrokeStyle(5, 0x5dffe0, 0.92);
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
      .container(LOGICAL_WIDTH / 2, 315, [plate, this.resultText])
      .setDepth(80)
      .setVisible(false);
  }

  private createFeedbackPanel(): void {
    const plate = this.add
      .rectangle(0, 0, 610, 92, 0x05131d, 0.97)
      .setStrokeStyle(3, 0x5dffe0, 0.84);
    this.feedbackIcon = this.add.image(-248, 0, ICON_KEYS.rose).setDisplaySize(72, 72);
    this.feedbackText = this.add.text(-198, -32, "", {
      fontFamily: "Inter, Arial, sans-serif",
      fontSize: "18px",
      fontStyle: "bold",
      color: "#ffffff",
      lineSpacing: 3,
    });
    this.feedbackPanel = this.add
      .container(LOGICAL_WIDTH / 2, 124, [plate, this.feedbackIcon, this.feedbackText])
      .setDepth(70)
      .setVisible(false);
  }

  private updatePrompt(): void {
    const state = this.simulation.state;
    const segment = this.simulation.director.current;
    const progress = segment.obstacleType ? this.simulation.obstacles.get(segment) : null;
    const visible = ["blocked", "performing_action", "helper_active"].includes(state.heroState);
    if (
      !visible ||
      !progress ||
      progress.resolved ||
      segment.type === "route_fork" ||
      this.feedbackPanel.visible
    ) {
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
    this.prompt.setPosition(LOGICAL_WIDTH - 185, 255).setVisible(true);
  }

  private updateRouteVote(): void {
    const vote = this.simulation.routeVote.state;
    this.routePanel.setVisible(vote.active);
    if (!vote.active) return;
    const seconds = Math.max(
      0,
      Math.ceil((vote.endsTick - this.simulation.state.tick) / FIXED_HZ),
    );
    this.routeText.setText(`1 · LINKS   ${vote.left}\n2 · RECHTS  ${vote.right}\n${seconds}s`);
  }

  private updateResult(): void {
    const state = this.simulation.state;
    const terminal = state.roundStatus === "success" || state.roundStatus === "failure";
    this.resultPanel.setVisible(terminal);
    if (!terminal) return;
    if (state.roundStatus === "success") {
      const contributor =
        state.lastContributor?.displayName ??
        state.lastContributor?.username ??
        "TEAM NOEMA";
      this.resultText
        .setText(
          `GIPFEL ERREICHT\nLEUCHTFEUER AKTIVIERT\n\nLETZTE HILFE:\n${contributor.toUpperCase()}`,
        )
        .setColor("#7ffff0");
    } else {
      this.resultText
        .setText("ZEIT ABGELAUFEN\n\nDER GIPFEL WARTET")
        .setColor("#ffb3c5");
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
  if (type === "high_ledge") {
    return { key: "doughnut", title: "DOUGHNUT", sub: "3 STEINE" };
  }
  if (type === "broken_bridge") {
    return {
      key: "doughnut",
      title: "DOUGHNUT",
      sub: `${required - built} BRÜCKENTEILE`,
    };
  }
  if (type === "ravine") {
    return built === 0
      ? {
          key: "hand-heart",
          title: "HAND HEART",
          sub: "BRÜCKE BAUEN\nODER DOUGHNUT ×2",
        }
      : {
          key: "doughnut",
          title: "DOUGHNUT",
          sub: `${required - built} TEILE FEHLEN`,
        };
  }
  if (type === "repair_gate") {
    return { key: "corgi", title: "CORGI", sub: "TOR REPARIEREN" };
  }
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
