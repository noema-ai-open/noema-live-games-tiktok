import type { GameCommand } from "@noema/event-protocol";
import type { AppSettings } from "../config/appSettings";
import { TICKS } from "../config/gameConfig";
import { SUPPORT_URL } from "../config/viewMode";
import type { ConnectionSnapshot } from "../connectors/connectionTypes";
import type { ConnectorManager } from "../connectors/ConnectorManager";
import { MOCK_VIEWERS } from "../connectors/MockConnector";
import type { GiftCatalogConfig } from "../gifts/giftCatalog";
import type { RulesEngine } from "../gifts/RulesEngine";
import type { ReplayService } from "../replay/ReplayService";
import type { Simulation } from "../simulation/Simulation";
import type { AudioSystem } from "../systems/AudioSystem";
import type { LiveSession } from "../systems/LiveSession";
import { GiftMappingEditor } from "./GiftMappingEditor";
import { escapeHtml } from "./StartScreen";

export type OperatorPanelDeps = {
  simulation: Simulation;
  replays: ReplayService;
  audio: AudioSystem;
  connectors: ConnectorManager;
  rules: RulesEngine;
  live: LiveSession;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onCatalogChange: (catalog: GiftCatalogConfig) => void;
  onBackToStart: () => void;
};

type TestGift = {
  id: string;
  label: string;
  tier: string;
  giftName: string;
  coins: number;
};

/**
 * Echte Geschenke aus der deutschen TikTok-Liste mit ihrem Muenzwert. So testet
 * man genau das, was live auch ankommt — inklusive der richtigen Stufe.
 */
const TEST_GIFTS: readonly TestGift[] = [
  { id: "rose", label: "Rose", tier: "1 Coin · Aufbau", giftName: "Rose", coins: 1 },
  { id: "gg", label: "GG", tier: "1 Coin · Aufbau", giftName: "GG", coins: 1 },
  { id: "donut", label: "Donut", tier: "30 · Lücke", giftName: "Donut", coins: 30 },
  { id: "kranich", label: "Papierkranich", tier: "99 · Lift", giftName: "Papierkranich", coins: 99 },
  { id: "handherz", label: "Handherz", tier: "100 · Schild", giftName: "Handherz", coins: 100 },
  { id: "herzen", label: "Herzen", tier: "199 · Schild", giftName: "Herzen", coins: 199 },
  { id: "flamme", label: "Göttliche Flamme", tier: "999 · Erdbeben", giftName: "Göttliche Flamme", coins: 999 },
] as const;

const STATUS_LABELS: Record<ConnectionSnapshot["status"], string> = {
  offline: "Getrennt",
  connecting: "Verbinde",
  connected: "Live verbunden",
  reconnecting: "Reconnect",
  error: "Fehler",
};

/**
 * Local operator workspace. Everything technical lives here so the stream view
 * stays clean.
 */
export class OperatorPanel {
  private readonly root: HTMLElement;
  private readonly deps: OperatorPanelDeps;
  private readonly intervalId: number;
  private mappingEditor: GiftMappingEditor | null = null;
  private clearedBeforeSequence = 0;
  private lastTerminalTick = -1;
  private snapshot: ConnectionSnapshot | null = null;
  private streakCounter = 0;

  constructor(root: HTMLElement, deps: OperatorPanelDeps) {
    this.root = root;
    this.deps = deps;
    this.root.innerHTML = this.template();
    this.mountMappingEditor();
    this.bindEvents();
    this.render();
    this.intervalId = window.setInterval(() => this.render(), 200);
  }

  destroy(): void {
    window.clearInterval(this.intervalId);
    this.root.replaceChildren();
  }

  setSnapshot(snapshot: ConnectionSnapshot): void {
    this.snapshot = snapshot;
  }

  private template(): string {
    return `
      <section class="panel-heading">
        <div>
          <p class="eyebrow">OPERATOR VIEW · LOKAL</p>
          <h1>NOEMA Ascent Control</h1>
        </div>
        <button class="ghost-button" data-action="home">Startbildschirm</button>
      </section>

      <section class="control-section">
        <div class="section-title"><span>Verbindung</span><small data-status="connector">—</small></div>
        <div class="status-grid two">
          <div><span>Status</span><strong data-status="conn-status">—</strong></div>
          <div><span>Ereignisse/s</span><strong data-status="conn-eps">0</strong></div>
          <div><span>Profil</span><strong data-status="conn-profile">—</strong></div>
          <div><span>Letztes Ereignis</span><strong data-status="conn-last">—</strong></div>
        </div>
        <div class="button-grid two">
          <button data-action="use-mock">Offline-Quelle</button>
          <button data-action="use-bridge">Live Bridge</button>
        </div>
        <label class="seed-field">Bridge-Adresse
          <input data-input="address" type="text" spellcheck="false" value="${escapeHtml(this.deps.settings.bridgeAddress)}" />
        </label>
        <div class="button-grid two compact">
          <button data-action="ambient">Zufalls-Ereignisse an/aus</button>
          <button data-action="disconnect">Trennen</button>
        </div>
      </section>

      <section class="status-grid" aria-label="Simulationsstatus">
        <div><span>Zustand</span><strong data-status="state">ready</strong></div>
        <div><span>Tick</span><strong data-status="tick">0</strong></div>
        <div><span>Seed</span><strong data-status="seed">0</strong></div>
        <div><span>Aktiv</span><strong data-status="workers">30</strong></div>
        <div><span>Gerettet / Verloren</span><strong data-status="result-counts">0 / 0</strong></div>
        <div><span>Energie</span><strong data-status="energy">15%</strong></div>
      </section>

      <section class="control-section">
        <div class="section-title"><span>Runde</span><small data-status="round-result">Nicht gestartet</small></div>
        <label class="seed-field">Seed <input data-input="seed" type="number" value="${this.deps.simulation.state.seed}" /></label>
        <div class="button-grid four">
          <button class="primary" data-action="start">Runde starten</button>
          <button data-command="pause">Pause</button>
          <button data-command="resume">Weiter</button>
          <button class="danger-soft" data-action="reset">Zurücksetzen</button>
        </div>
        <div class="toggle-row">
          <label><input data-toggle="safe" type="checkbox" /> Safe Mode</label>
          <label><input data-toggle="motion" type="checkbox" /> Reduced Motion</label>
          <label><input data-toggle="mute" type="checkbox" /> Stumm</label>
          <label><input data-toggle="auto" type="checkbox" ${this.deps.settings.autoRestart ? "checked" : ""} /> Automodus</label>
        </div>
        <p class="hint" data-status="auto-hint">Neue Runde startet automatisch.</p>
        <label class="slider-field">Lautstärke
          <input data-input="volume" type="range" min="0" max="100" value="${Math.round(this.deps.settings.masterVolume * 100)}" />
        </label>
      </section>

      <section class="control-section">
        <div class="section-title"><span>Testereignisse</span><small>Erzeugen echte Live-Events</small></div>
        <div class="button-grid three">
          <button data-free="like">+ Likes</button>
          <button data-free="follow">Follow</button>
          <button data-free="share">Share</button>
        </div>
        <div class="gift-grid">
          ${TEST_GIFTS.map(
            (gift) => `
            <button data-test-gift="${gift.id}"><b>${escapeHtml(gift.label)}</b><span>${escapeHtml(gift.tier)}</span></button>`,
          ).join("")}
        </div>
        <div class="button-grid two compact">
          <button data-action="streak">Rose-Serie ×5 senden</button>
          <button data-action="duplicate">Doppeltes Ereignis senden</button>
        </div>
        <button class="tsar-button" data-test-gift="tsar">
          <span>⚠</span><b>ZAR-BOMBE</b><small>Zeus · 34.000 Coins · globale Abklingzeit</small>
        </button>
      </section>

      <section class="control-section">
        <div class="section-title"><span>Werkzeug-Diagnose</span><small>Direkte Befehle</small></div>
        <div class="button-grid four compact">
          <button data-action="jump">Sprungfeld</button>
          <button data-action="blocker">Umlenkung</button>
          <button data-action="rescue">Rettung</button>
          <button data-action="area-rescue">Flächenrettung</button>
        </div>
      </section>

      <section class="recovery-strip" data-status="recovery">Wiederaufbau inaktiv</section>
      <section class="cooldown-list" data-status="cooldowns"></section>

      <section class="control-section" data-mapping></section>

      <section class="control-section">
        <div class="section-title"><span>Replay</span><small data-status="replay-result">Kein Vergleich</small></div>
        <div class="button-grid three">
          <button data-action="replay">Letzte Runde nachspielen</button>
          <button data-action="copy">Replay-JSON kopieren</button>
          <button data-action="clear">Log leeren</button>
        </div>
        <textarea data-input="replay" rows="4" spellcheck="false" placeholder="Replay-JSON einfügen"></textarea>
        <div class="button-grid two compact">
          <button data-action="export">In Editor exportieren</button>
          <button data-action="import">Replay-JSON importieren</button>
        </div>
      </section>

      <section class="log-section">
        <div class="section-title"><span>Live-Ereignisse</span><small data-status="dupes">0 Duplikate verworfen</small></div>
        <ol class="command-log" data-status="event-log"></ol>
      </section>

      <section class="log-section">
        <div class="section-title"><span>Befehlsprotokoll</span><small data-status="command-count">0 Befehle</small></div>
        <ol class="command-log" data-status="command-log"></ol>
      </section>

      <section class="support-section">
        <p>
          NOEMA Live Games bleibt kostenlos und öffentlich nutzbar. KI-Infrastruktur,
          Tests, Grafik und Weiterentwicklung verursachen laufende Kosten. Wer das
          Projekt gerne nutzt oder damit Einnahmen erzielt, kann die weitere
          Entwicklung freiwillig unterstützen.
        </p>
        <a href="${SUPPORT_URL}" target="_blank" rel="noopener noreferrer">Projekt unterstützen</a>
      </section>
    `;
  }

  private mountMappingEditor(): void {
    const host = this.root.querySelector<HTMLElement>("[data-mapping]");
    if (!host) return;
    this.mappingEditor = new GiftMappingEditor(host, this.deps.rules.getCatalog(), {
      onChange: (catalog) => this.deps.onCatalogChange(catalog),
      getUnknownGifts: () => this.deps.rules.getUnknownGifts(),
    });
  }

  private bindEvents(): void {
    this.root.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "button",
      );
      if (!target) return;
      this.deps.audio.unlock();

      const command = target.dataset["command"];
      const action = target.dataset["action"];
      const free = target.dataset["free"];
      const testGift = target.dataset["testGift"];

      if (command === "pause" || command === "resume") {
        this.submit({ type: command });
      } else if (free) {
        this.sendFree(free);
      } else if (testGift) {
        this.sendTestGift(testGift);
      } else if (action) {
        void this.handleAction(action);
      }
    });

    this.root.addEventListener("change", (event) => {
      const input = event.target as HTMLInputElement;
      const toggle = input.dataset["toggle"];
      if (toggle === "safe") {
        this.submit({ type: "set_safe_mode", enabled: input.checked });
        this.updateSettings({ safeMode: input.checked });
      } else if (toggle === "motion") {
        this.submit({ type: "set_reduced_motion", enabled: input.checked });
        this.updateSettings({ reducedMotion: input.checked });
      } else if (toggle === "auto") {
        this.updateSettings({ autoRestart: input.checked });
      } else if (toggle === "mute") {
        this.deps.audio.setMuted(input.checked);
        this.updateSettings({ muted: input.checked });
      } else if (input.dataset["input"] === "address") {
        const address = input.value.trim();
        this.deps.connectors.bridge.setAddress(address);
        this.updateSettings({ bridgeAddress: address });
      }
    });

    this.root.addEventListener("input", (event) => {
      const input = event.target as HTMLInputElement;
      if (input.dataset["input"] !== "volume") return;
      const value = Number(input.value) / 100;
      this.deps.audio.setVolume("master", value);
      this.updateSettings({ masterVolume: value });
    });
  }

  private updateSettings(patch: Partial<AppSettings>): void {
    this.deps.onSettingsChange({ ...this.deps.settings, ...patch });
  }

  private submit(command: GameCommand): void {
    this.deps.simulation.submit(command);
  }

  private sendFree(kind: string): void {
    if (kind === "like") {
      this.deps.connectors.mock.injectSimple("like", MOCK_VIEWERS[1]!, 12);
      return;
    }
    if (kind === "follow") {
      this.deps.connectors.mock.injectSimple("follow", MOCK_VIEWERS[2]!);
      return;
    }
    this.deps.connectors.mock.injectSimple("share", MOCK_VIEWERS[3]!);
  }

  private sendTestGift(id: string): void {
    this.deps.audio.play("gift");
    if (id === "tsar") {
      this.deps.connectors.mock.injectGift(
        {
          giftId: "mock_tsar_bomb",
          giftName: "Zeus",
          coinValue: 34000,
          comboFinal: true,
        },
        MOCK_VIEWERS[0]!,
      );
      return;
    }
    const gift = TEST_GIFTS.find((item) => item.id === id);
    if (!gift) return;
    this.deps.connectors.mock.injectGift(
      {
        giftId: `name:${gift.giftName.toLowerCase().replace(/\s+/g, "-")}`,
        giftName: gift.giftName,
        coinValue: gift.coins,
        comboFinal: true,
      },
      MOCK_VIEWERS[0]!,
    );
  }

  private sendStreak(): void {
    this.streakCounter += 1;
    const comboId = `test-streak-${this.streakCounter}`;
    for (let index = 1; index <= 5; index += 1) {
      window.setTimeout(() => {
        this.deps.connectors.mock.injectGift(
          {
            giftId: "name:rose",
            giftName: "Rose",
            coinValue: 1,
            repeatCount: index,
            comboId,
            ...(index === 5 ? { comboFinal: true } : {}),
          },
          MOCK_VIEWERS[1]!,
          `${comboId}-${index}`,
        );
      }, index * 180);
    }
  }

  private sendDuplicate(): void {
    const eventId = `duplicate-${Date.now()}`;
    for (let index = 0; index < 2; index += 1) {
      this.deps.connectors.mock.injectGift(
        {
          giftId: "name:bridge-crate",
          giftName: "Bridge Crate",
          coinValue: 30,
          comboFinal: true,
        },
        MOCK_VIEWERS[2]!,
        eventId,
      );
    }
  }

  private async handleAction(action: string): Promise<void> {
    const simulation = this.deps.simulation;
    switch (action) {
      case "home":
        this.deps.onBackToStart();
        return;
      case "use-mock":
        this.deps.connectors.use("mock");
        this.updateSettings({ lastConnector: "mock" });
        return;
      case "use-bridge":
        this.deps.connectors.bridge.setAddress(this.addressValue());
        this.deps.connectors.use("noema-bridge");
        this.updateSettings({
          lastConnector: "noema-bridge",
          bridgeAddress: this.addressValue(),
        });
        return;
      case "disconnect":
        this.deps.connectors.stop();
        return;
      case "ambient":
        if (this.deps.connectors.mock.isAmbientRunning()) {
          this.deps.connectors.mock.stopAmbient();
        } else {
          this.deps.connectors.mock.startAmbient();
        }
        return;
      case "start": {
        this.captureCurrentRound();
        const seedInput = this.root.querySelector<HTMLInputElement>(
          '[data-input="seed"]',
        );
        const seed = Number(seedInput?.value ?? simulation.state.seed);
        this.deps.rules.reset();
        simulation.startRound(Number.isFinite(seed) ? seed >>> 0 : undefined);
        this.applyPersistentToggles();
        return;
      }
      case "reset":
        this.captureCurrentRound();
        this.deps.rules.reset();
        this.submit({ type: "reset" });
        return;
      case "streak":
        this.sendStreak();
        return;
      case "duplicate":
        this.sendDuplicate();
        return;
      case "jump":
        this.submit({
          type: "place_jump_field",
          zoneId: "zone-1",
          durationTicks: TICKS.second * 15,
        });
        return;
      case "blocker":
        this.submit({
          type: "place_blocker",
          x: 0.4,
          durationTicks: TICKS.second * 8,
        });
        return;
      case "rescue":
        this.submit({ type: "rescue_worker" });
        return;
      case "area-rescue":
        this.submit({ type: "area_rescue", x: 360, y: 860, radius: 360 });
        return;
      case "clear":
        this.clearedBeforeSequence =
          simulation.commandQueue.getNextSequence() - 1;
        simulation.clearEventFeed();
        return;
      case "export": {
        const editor = this.replayEditor();
        if (editor) editor.value = this.deps.replays.exportJson(simulation);
        return;
      }
      case "copy": {
        const json = this.deps.replays.exportJson(simulation);
        await navigator.clipboard.writeText(json);
        this.setText("replay-result", "Replay-JSON kopiert");
        return;
      }
      case "import": {
        const editor = this.replayEditor();
        if (!editor?.value.trim()) return;
        const replay = this.deps.replays.importJson(editor.value);
        this.setText("replay-result", `${replay.commands.length} Befehle geladen`);
        return;
      }
      case "replay": {
        const replay =
          this.deps.replays.getLastReplay() ??
          this.deps.replays.capture(simulation);
        const comparison = this.deps.replays.replay(replay);
        this.setText(
          "replay-result",
          comparison.matches
            ? `Deterministisch · ${comparison.result.hash}`
            : `Abweichung · ${comparison.result.hash}`,
        );
        return;
      }
      default:
        return;
    }
  }

  /** Safe mode and reduced motion survive a round restart. */
  private applyPersistentToggles(): void {
    const settings = this.deps.settings;
    if (settings.safeMode) {
      this.submit({ type: "set_safe_mode", enabled: true });
    }
    if (settings.reducedMotion) {
      this.submit({ type: "set_reduced_motion", enabled: true });
    }
  }

  private addressValue(): string {
    const input = this.root.querySelector<HTMLInputElement>(
      '[data-input="address"]',
    );
    return input?.value.trim() || this.deps.settings.bridgeAddress;
  }

  private replayEditor(): HTMLTextAreaElement | null {
    return this.root.querySelector<HTMLTextAreaElement>('[data-input="replay"]');
  }

  private captureCurrentRound(): void {
    if (this.deps.simulation.state.tick > 0) {
      this.deps.replays.capture(this.deps.simulation);
    }
  }

  private render(): void {
    const simulation = this.deps.simulation;
    const state = simulation.state;

    if (
      (state.roundStatus === "success" || state.roundStatus === "failure") &&
      this.lastTerminalTick !== state.tick
    ) {
      this.deps.replays.capture(simulation);
      this.lastTerminalTick = state.tick;
    }

    const snapshot = this.snapshot;
    this.setText(
      "connector",
      snapshot
        ? snapshot.connectorId === "mock"
          ? "Offline-Quelle"
          : "NOEMA Live Bridge"
        : "keine Quelle",
    );
    const statusLabel = snapshot ? STATUS_LABELS[snapshot.status] : "—";
    // Verbunden, aber still: Das ist der haeufigste Fall und sieht sonst aus
    // wie ein Fehler. Die Bridge steht dann, nur TikTok sendet nichts.
    const idleMs =
      snapshot?.lastEventAt === null || snapshot?.lastEventAt === undefined
        ? Infinity
        : Date.now() - snapshot.lastEventAt;
    const silent =
      snapshot?.status === "connected" &&
      snapshot.connectorId === "noema-bridge" &&
      idleMs > 25000;
    this.setText(
      "conn-status",
      !snapshot
        ? statusLabel
        : silent
          ? `${statusLabel} · keine TikTok-Ereignisse — läuft dein Livestream?`
          : snapshot.detail === statusLabel
            ? statusLabel
            : `${statusLabel} · ${snapshot.detail}`,
    );
    this.setText("conn-eps", snapshot ? String(snapshot.eventsPerSecond) : "0");
    this.setText("conn-profile", snapshot?.profile ?? "—");
    this.setText("conn-last", snapshot?.lastEventLabel ?? "—");

    this.setText("state", state.roundStatus.toUpperCase());
    this.setText("tick", String(state.tick));
    this.setText("seed", String(state.seed));
    this.setText("workers", String(simulation.getActiveCount()));
    this.setText("result-counts", `${state.rescuedCount} / ${state.lostCount}`);
    this.setText("energy", `${Math.round(state.teamEnergy)}%`);
    this.setText(
      "round-result",
      `${state.roundStatus.toUpperCase()} · ${state.rescuedCount} gerettet`,
    );
    this.setText(
      "recovery",
      state.tsarBomb.phase === "recovery"
        ? `TEAM REBUILD · ${Math.ceil((state.tsarBomb.recoveryUntilTick - state.tick) / TICKS.second)}s · Reparatur ×${state.recoveryMultiplier}`
        : "Wiederaufbau inaktiv",
    );
    this.setText(
      "cooldowns",
      `ZAR-BOMBE ${Math.ceil(Math.max(0, state.tsarBomb.cooldownUntilTick - state.tick) / TICKS.second)}s · Schild ${Math.ceil(Math.max(0, state.shieldUntilTick - state.tick) / TICKS.second)}s · Lift ${Math.ceil(Math.max(0, state.liftOverdriveUntilTick - state.tick) / TICKS.second)}s · Umwelt ${state.environmentMode}`,
    );
    this.setText(
      "dupes",
      `${this.deps.rules.getDroppedDuplicates()} Duplikate verworfen`,
    );

    this.renderEventLog();
    this.renderCommandLog();
    this.mappingEditor?.refreshUnknown();
  }

  private renderEventLog(): void {
    const list = this.root.querySelector<HTMLOListElement>(
      '[data-status="event-log"]',
    );
    if (!list) return;
    const events = [...this.deps.live.getRecentEvents()].reverse().slice(0, 30);
    list.replaceChildren(
      ...events.map((event) => {
        const row = document.createElement("li");
        const kind = document.createElement("b");
        kind.textContent = event.kind;
        const detail = document.createElement("span");
        const name = event.actor.displayName ?? event.actor.username;
        detail.textContent = event.gift
          ? `${name} · ${event.gift.giftName} ×${event.gift.repeatCount}`
          : `${name}${event.likeCount ? ` · ${event.likeCount} Likes` : ""}`;
        row.append(kind, detail);
        return row;
      }),
    );
  }

  private renderCommandLog(): void {
    const commands = this.deps.simulation.commandHistory.filter(
      (item) => item.sequence > this.clearedBeforeSequence,
    );
    this.setText("command-count", `${commands.length} Befehle`);
    const log = this.root.querySelector<HTMLOListElement>(
      '[data-status="command-log"]',
    );
    if (!log) return;
    log.replaceChildren(
      ...commands
        .slice()
        .reverse()
        .slice(0, 60)
        .map((item) => {
          const row = document.createElement("li");
          const sequence = document.createElement("b");
          sequence.textContent = `#${item.sequence}`;
          const detail = document.createElement("span");
          detail.textContent = `t${item.tick} · ${item.command.type} · ${item.actor.displayName ?? item.actor.username}`;
          row.append(sequence, detail);
          return row;
        }),
    );
  }

  private setText(key: string, value: string): void {
    const element = this.root.querySelector<HTMLElement>(
      `[data-status="${key}"]`,
    );
    if (element) element.textContent = value;
  }
}
