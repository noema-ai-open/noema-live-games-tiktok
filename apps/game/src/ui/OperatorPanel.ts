import type { GameCommand } from "@noema/event-protocol";
import { TICKS } from "../config/gameConfig";
import type { ReplayService } from "../replay/ReplayService";
import type { Simulation } from "../simulation/Simulation";
import type { AudioSystem } from "../systems/AudioSystem";
import {
  getMockGift,
  MOCK_ACTOR,
  type MockActionId,
} from "../systems/giftMapping";

export class OperatorPanel {
  private readonly root: HTMLElement;
  private readonly simulation: Simulation;
  private readonly replays: ReplayService;
  private readonly audio: AudioSystem;
  private readonly intervalId: number;
  private clearedBeforeSequence = 0;
  private lastTerminalTick = -1;

  constructor(
    root: HTMLElement,
    simulation: Simulation,
    replays: ReplayService,
    audio: AudioSystem,
  ) {
    this.root = root;
    this.simulation = simulation;
    this.replays = replays;
    this.audio = audio;
    this.root.innerHTML = this.template();
    this.bindEvents();
    this.render();
    this.intervalId = window.setInterval(() => this.render(), 160);
  }

  destroy(): void {
    window.clearInterval(this.intervalId);
    this.root.replaceChildren();
  }

  private template(): string {
    return `
      <section class="panel-heading">
        <div>
          <p class="eyebrow">LOCAL MOCK ADAPTER</p>
          <h1>NOEMA Ascent Control</h1>
        </div>
        <span class="offline-badge">OFFLINE</span>
      </section>

      <section class="status-grid" aria-label="Simulation status">
        <div><span>State</span><strong data-status="state">ready</strong></div>
        <div><span>Tick</span><strong data-status="tick">0</strong></div>
        <div><span>Seed</span><strong data-status="seed">0</strong></div>
        <div><span>Workers</span><strong data-status="workers">30</strong></div>
        <div><span>Rescued / Lost</span><strong data-status="result-counts">0 / 0</strong></div>
        <div><span>Energy</span><strong data-status="energy">15%</strong></div>
      </section>

      <section class="control-section">
        <div class="section-title"><span>Round</span><small data-status="round-result">Not started</small></div>
        <label class="seed-field">Seed <input data-input="seed" type="number" value="${this.simulation.state.seed}" /></label>
        <div class="button-grid four">
          <button class="primary" data-action="start">Start round</button>
          <button data-command="pause">Pause</button>
          <button data-command="resume">Resume</button>
          <button class="danger-soft" data-action="reset">Reset</button>
        </div>
        <div class="toggle-row">
          <label><input data-toggle="safe" type="checkbox" /> Safe mode</label>
          <label><input data-toggle="motion" type="checkbox" /> Reduced motion</label>
          <label><input data-toggle="mute" type="checkbox" /> Mute</label>
        </div>
      </section>

      <section class="control-section">
        <div class="section-title"><span>Free interaction</span><small>Mock events</small></div>
        <div class="button-grid three">
          <button data-action="likes">+ Likes</button>
          <button data-action="follow">Follow</button>
          <button data-action="share">Share</button>
        </div>
      </section>

      <section class="control-section">
        <div class="section-title"><span>Gift tiers</span><small>Configurable mock IDs</small></div>
        <div class="gift-grid">
          <button data-gift="cheap_support"><b>1–9</b><span>Cheap support</span></button>
          <button data-gift="standard_support"><b>10–99</b><span>Standard support</span></button>
          <button data-gift="strong_support"><b>100–499</b><span>Strong support</span></button>
          <button data-gift="premium_support"><b>500–1,999</b><span>Premium support</span></button>
          <button class="sabotage" data-gift="minor_sabotage"><b>300–999</b><span>Minor sabotage</span></button>
          <button class="sabotage" data-gift="major_sabotage"><b>2,000–9,999</b><span>Major sabotage</span></button>
        </div>
        <button class="tsar-button" data-gift="tsar_bomb">
          <span>⚠</span><b>ZAR-BOMBE</b><small>Highest destructive tier · global cooldown</small>
        </button>
      </section>

      <section class="control-section">
        <div class="section-title"><span>Tool diagnostics</span><small>Ordered commands</small></div>
        <div class="button-grid four compact">
          <button data-action="jump">Jump field</button>
          <button data-action="blocker">Blocker</button>
          <button data-action="rescue">Rescue one</button>
          <button data-action="area-rescue">Area rescue</button>
        </div>
      </section>

      <section class="recovery-strip" data-status="recovery">Recovery inactive</section>
      <section class="cooldown-list" data-status="cooldowns"></section>

      <section class="control-section">
        <div class="section-title"><span>Replay</span><small data-status="replay-result">No comparison yet</small></div>
        <div class="button-grid three">
          <button data-action="replay">Replay last round</button>
          <button data-action="copy">Copy replay JSON</button>
          <button data-action="clear">Clear log</button>
        </div>
        <textarea data-input="replay" rows="5" spellcheck="false" placeholder="Paste replay JSON to import"></textarea>
        <div class="button-grid two compact">
          <button data-action="export">Export to editor</button>
          <button data-action="import">Import replay JSON</button>
        </div>
      </section>

      <section class="log-section">
        <div class="section-title"><span>Ordered command log</span><small data-status="command-count">0 commands</small></div>
        <ol class="command-log" data-status="command-log"></ol>
      </section>
    `;
  }

  private bindEvents(): void {
    this.root.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "button",
      );
      if (!target) return;
      const command = target.dataset.command;
      const action = target.dataset.action;
      const gift = target.dataset.gift as MockActionId | undefined;
      if (command === "pause" || command === "resume") {
        this.submit({ type: command });
      } else if (gift) {
        this.triggerGift(gift);
      } else if (action) {
        void this.handleAction(action);
      }
    });

    this.root.addEventListener("change", (event) => {
      const input = event.target as HTMLInputElement;
      if (input.dataset.toggle === "safe") {
        this.submit({ type: "set_safe_mode", enabled: input.checked });
      } else if (input.dataset.toggle === "motion") {
        this.submit({ type: "set_reduced_motion", enabled: input.checked });
      } else if (input.dataset.toggle === "mute") {
        this.audio.setMuted(input.checked);
      }
    });
  }

  private submit(command: GameCommand): void {
    this.simulation.submit(command);
  }

  private triggerGift(id: MockActionId): void {
    const mapping = getMockGift(id);
    if (!mapping) return;
    this.submit(mapping.command(MOCK_ACTOR));
    this.audio.play(id.includes("sabotage") ? "earthquake" : "support");
  }

  private async handleAction(action: string): Promise<void> {
    if (action === "start") {
      this.captureCurrentRound();
      const seedInput = this.root.querySelector<HTMLInputElement>(
        '[data-input="seed"]',
      );
      const seed = Number(seedInput?.value ?? this.simulation.state.seed);
      this.simulation.startRound(Number.isFinite(seed) ? seed >>> 0 : undefined);
      return;
    }
    if (action === "reset") {
      this.captureCurrentRound();
      this.submit({ type: "reset" });
      return;
    }
    if (action === "likes") {
      this.submit({ type: "add_team_energy", amount: 8, actor: MOCK_ACTOR });
      return;
    }
    if (action === "follow") {
      this.submit({
        type: "group_shield",
        durationTicks: TICKS.second * 4,
        radius: 110,
        actor: MOCK_ACTOR,
      });
      return;
    }
    if (action === "share") {
      this.submit({ type: "add_team_energy", amount: 14, actor: MOCK_ACTOR });
      return;
    }
    if (action === "jump") {
      this.submit({
        type: "place_jump_field",
        zoneId: "zone-1",
        durationTicks: TICKS.second * 15,
      });
      return;
    }
    if (action === "blocker") {
      this.submit({
        type: "place_blocker",
        x: 0.4,
        durationTicks: TICKS.second * 8,
      });
      return;
    }
    if (action === "rescue") {
      this.submit({ type: "rescue_worker" });
      return;
    }
    if (action === "area-rescue") {
      this.submit({ type: "area_rescue", x: 360, y: 860, radius: 360 });
      return;
    }
    if (action === "clear") {
      this.clearedBeforeSequence =
        this.simulation.commandQueue.getNextSequence() - 1;
      this.simulation.clearEventFeed();
      return;
    }
    if (action === "export") {
      const editor = this.root.querySelector<HTMLTextAreaElement>(
        '[data-input="replay"]',
      );
      if (editor) editor.value = this.replays.exportJson(this.simulation);
      return;
    }
    if (action === "copy") {
      const json = this.replays.exportJson(this.simulation);
      await navigator.clipboard.writeText(json);
      this.setText("replay-result", "Replay JSON copied");
      return;
    }
    if (action === "import") {
      const editor = this.root.querySelector<HTMLTextAreaElement>(
        '[data-input="replay"]',
      );
      if (!editor?.value.trim()) return;
      const replay = this.replays.importJson(editor.value);
      this.setText(
        "replay-result",
        `Imported ${replay.commands.length} commands`,
      );
      return;
    }
    if (action === "replay") {
      const replay =
        this.replays.getLastReplay() ?? this.replays.capture(this.simulation);
      const comparison = this.replays.replay(replay);
      this.setText(
        "replay-result",
        comparison.matches
          ? `Deterministic match · ${comparison.result.hash}`
          : `Mismatch · ${comparison.result.hash}`,
      );
    }
  }

  private captureCurrentRound(): void {
    if (this.simulation.state.tick > 0) this.replays.capture(this.simulation);
  }

  private render(): void {
    const state = this.simulation.state;
    if (
      (state.roundStatus === "success" || state.roundStatus === "failure") &&
      this.lastTerminalTick !== state.tick
    ) {
      this.replays.capture(this.simulation);
      this.lastTerminalTick = state.tick;
    }

    this.setText("state", state.roundStatus.toUpperCase());
    this.setText("tick", String(state.tick));
    this.setText("seed", String(state.seed));
    this.setText("workers", String(this.simulation.getActiveCount()));
    this.setText(
      "result-counts",
      `${state.rescuedCount} / ${state.lostCount}`,
    );
    this.setText("energy", `${Math.round(state.teamEnergy)}%`);
    this.setText(
      "round-result",
      `${state.roundStatus.toUpperCase()} · ${state.rescuedCount} rescued`,
    );
    this.setText(
      "recovery",
      state.tsarBomb.phase === "recovery"
        ? `TEAM REBUILD · ${Math.ceil((state.tsarBomb.recoveryUntilTick - state.tick) / TICKS.second)}s · helpful repair x${state.recoveryMultiplier}`
        : "Recovery inactive",
    );

    const cooldown = Math.max(
      0,
      state.tsarBomb.cooldownUntilTick - state.tick,
    );
    this.setText(
      "cooldowns",
      `ZAR-BOMBE ${Math.ceil(cooldown / TICKS.second)}s  ·  Shield ${Math.ceil(Math.max(0, state.shieldUntilTick - state.tick) / TICKS.second)}s  ·  Lift ${Math.ceil(Math.max(0, state.liftActiveUntilTick - state.tick) / TICKS.second)}s  ·  Environment ${state.environmentMode}`,
    );

    const commands = this.simulation.commandHistory.filter(
      (item) => item.sequence > this.clearedBeforeSequence,
    );
    this.setText("command-count", `${commands.length} commands`);
    const log = this.root.querySelector<HTMLOListElement>(
      '[data-status="command-log"]',
    );
    if (log) {
      log.replaceChildren(
        ...commands
          .slice()
          .reverse()
          .slice(0, 80)
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
  }

  private setText(key: string, value: string): void {
    const element = this.root.querySelector<HTMLElement>(
      `[data-status="${key}"]`,
    );
    if (element) element.textContent = value;
  }
}
