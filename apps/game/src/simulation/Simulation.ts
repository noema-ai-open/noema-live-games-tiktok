import type {
  GameCommand,
  OrderedGameCommand,
  ViewerIdentity,
} from "@noema/event-protocol";
import { CommandQueue, OPERATOR_ACTOR } from "../commands/CommandQueue";
import {
  DEFAULT_SEED,
  LEVEL_VERSION,
  RESCUE_TARGET,
  ROUND_DURATION_TICKS,
  TICKS,
  WORKER_COUNT,
} from "../config/gameConfig";
import {
  LEVEL_GRAPH,
  TOP_FLOOR,
  getLink,
  getPlatform,
  type Link,
  type LinkId,
} from "../config/levelGraph";
import { LevelRuntime } from "./levelRuntime";
import { SeededRandom } from "./rng";
import type {
  ReplayData,
  RoundResult,
  SimulationState,
  Walker,
} from "./types";
import {
  assignQueueSlots,
  createWalker,
  pushOffPlatform,
  stepWalker,
} from "./walker";

const ACTIVE_STATES = new Set([
  "spawning",
  "walking",
  "waiting",
  "traversing",
  "riding",
  "falling",
]);

function actorFor(command: GameCommand): ViewerIdentity {
  if ("actor" in command && command.actor) return command.actor;
  return OPERATOR_ACTOR;
}

/**
 * Deterministische Rundensimulation auf dem Levelgraphen.
 *
 * Die Roboter laufen ueber echte Decks und benutzen echte Uebergaenge. Alles,
 * was Zuschauer schicken, wirkt auf genau einen dieser Uebergaenge — deshalb
 * ist jede Wirkung im Bild sichtbar.
 */
export class Simulation {
  readonly commandQueue = new CommandQueue();
  readonly level = new LevelRuntime(LEVEL_GRAPH);
  workers: Walker[] = [];
  state: SimulationState;
  commandHistory: OrderedGameCommand[] = [];
  readonly levelVersion = LEVEL_VERSION;

  private rng: SeededRandom;

  constructor(seed = DEFAULT_SEED) {
    this.rng = new SeededRandom(seed);
    this.state = this.createState(seed);
    this.workers = this.createWorkers();
  }

  private createState(seed: number): SimulationState {
    return {
      seed,
      tick: 0,
      remainingTicks: ROUND_DURATION_TICKS,
      roundStatus: "ready",
      teamEnergy: 0,
      rescuedCount: 0,
      lostCount: 0,
      safeMode: false,
      reducedMotion: false,
      liftOverdriveUntilTick: 0,
      shieldUntilTick: 0,
      environmentUntilTick: 0,
      environmentMode: "none",
      recoveryMultiplier: 1,
      tsarBomb: {
        phase: "idle",
        actor: null,
        startedTick: -1,
        impactTick: -1,
        recoveryUntilTick: -1,
        cooldownUntilTick: 0,
        impactApplied: false,
      },
      eventFeed: ["SYSTEM // Turm bereit"],
    };
  }

  private createWorkers(): Walker[] {
    return Array.from({ length: WORKER_COUNT }, (_, index) =>
      createWalker(
        LEVEL_GRAPH,
        index + 1,
        1.05 + this.rng.next() * 0.3,
        index * 14,
      ),
    );
  }

  startRound(seed = this.state.seed): void {
    this.resetRound(seed);
    this.state.roundStatus = "running";
    this.addEvent(`RUNDE // Seed ${seed}`);
  }

  resetRound(seed = this.state.seed): void {
    this.rng = new SeededRandom(seed);
    this.state = this.createState(seed);
    this.level.reset();
    this.workers = this.createWorkers();
    this.commandHistory = [];
    this.commandQueue.clear();
  }

  submit(command: GameCommand): OrderedGameCommand {
    return this.commandQueue.enqueue(command, this.state.tick, actorFor(command));
  }

  enqueueRecorded(command: OrderedGameCommand): void {
    this.commandQueue.enqueueRecorded(command);
  }

  step(): void {
    const commands = this.commandQueue.drain(this.state.tick);
    for (const command of commands) this.applyCommand(command);

    if (this.state.roundStatus !== "running") return;

    this.state.tick += 1;
    this.state.remainingTicks = Math.max(0, this.state.remainingTicks - 1);
    this.updateTimedEffects();

    this.level.step(
      this.state.tick,
      this.state.liftOverdriveUntilTick > this.state.tick,
    );
    assignQueueSlots(this.workers);
    for (const worker of this.workers) {
      stepWalker(worker, LEVEL_GRAPH, this.level, this.state.tick);
    }
    this.refreshWaitingCounts();
    this.refreshCounts();
    this.evaluateRound();
  }

  // --- Befehle --------------------------------------------------------------

  private applyCommand(item: OrderedGameCommand): void {
    const { command } = item;
    if (command.type === "reset") {
      const seed = this.state.seed;
      this.resetRound(seed);
      this.addEvent("OPERATOR // Runde zurueckgesetzt");
      return;
    }

    this.commandHistory.push(structuredClone(item));
    const actor = item.actor.displayName ?? item.actor.username;

    switch (command.type) {
      case "pause":
        if (this.state.roundStatus === "running") {
          this.state.roundStatus = "paused";
          this.addEvent("OPERATOR // Pausiert");
        }
        break;
      case "resume":
        if (
          this.state.roundStatus === "paused" ||
          this.state.roundStatus === "ready"
        ) {
          this.state.roundStatus = "running";
          this.addEvent("OPERATOR // Weiter");
        }
        break;
      case "set_safe_mode":
        this.state.safeMode = command.enabled;
        this.addEvent(`SAFE MODE // ${command.enabled ? "AN" : "AUS"}`);
        break;
      case "set_reduced_motion":
        this.state.reducedMotion = command.enabled;
        this.addEvent(`REDUCED MOTION // ${command.enabled ? "AN" : "AUS"}`);
        break;
      case "add_team_energy":
        this.addTeamEnergy(command.amount, actor);
        break;
      case "repair_structure":
        this.buildWhereNeeded(command.amount, actor);
        break;
      case "build_bridge":
        this.openKind("bridge", actor);
        break;
      case "place_jump_field":
        this.openKind("jump", actor);
        break;
      case "activate_lift":
        this.state.liftOverdriveUntilTick = Math.max(
          this.state.liftOverdriveUntilTick,
          this.state.tick + command.durationTicks,
        );
        this.addEvent(`${actor} // LIFT SCHNELLER`);
        break;
      case "place_blocker":
        this.reverseWalkers(actor);
        break;
      case "group_shield":
        this.state.shieldUntilTick = Math.max(
          this.state.shieldUntilTick,
          this.state.tick + command.durationTicks,
        );
        for (const worker of this.workers) {
          worker.protectedUntilTick = Math.max(
            worker.protectedUntilTick,
            this.state.shieldUntilTick,
          );
        }
        this.addEvent(`${actor} // TEAM-SCHILD`);
        break;
      case "rescue_worker":
        this.rescueFalling(1, actor);
        break;
      case "area_rescue":
        this.rescueFalling(6, actor);
        break;
      case "collapse_section":
        if (this.blockedBySafeMode("Einsturz")) break;
        this.breakSomething(actor);
        break;
      case "environment_shift":
        if (this.blockedBySafeMode("Umweltsabotage")) break;
        this.state.environmentMode = command.mode;
        this.state.environmentUntilTick = Math.max(
          this.state.environmentUntilTick,
          this.state.tick + command.durationTicks,
        );
        this.addEvent(
          `${actor} // ${command.mode === "wind" ? "STURM" : "SCHWERELOS"}`,
        );
        break;
      case "earthquake":
        if (this.blockedBySafeMode("Erdbeben")) break;
        this.applyEarthquake(command.severity, actor);
        break;
      case "tsar_bomb":
        this.startTsarBomb(item.actor);
        break;
    }
  }

  /**
   * Freie Interaktion laedt die Teamenergie. Ist sie voll, schaltet sie selbst
   * einen Uebergang frei — damit bleibt das Level auch ohne Geschenke
   * schaffbar, nur langsamer.
   */
  private addTeamEnergy(amount: number, actor: string): void {
    this.state.teamEnergy += amount;
    if (this.state.teamEnergy < 100) {
      this.addEvent(`${actor} // +${amount} Energie`);
      return;
    }
    this.state.teamEnergy = 0;
    const link = this.neediestLink();
    if (!link) return;
    this.level.build(link.id, link.buildRequired, this.state.tick);
    this.addEvent(`TEAM-ENERGIE // ${this.labelOf(link)} FREI`);
  }

  /** Aufbau geht dorthin, wo die meisten Roboter warten. */
  private buildWhereNeeded(amount: number, actor: string): void {
    const link = this.neediestLink();
    if (!link) {
      this.addEvent(`${actor} // Alles frei`);
      return;
    }
    const effective = Math.round(amount * this.state.recoveryMultiplier);
    const opened = this.level.build(link.id, effective, this.state.tick);
    this.addEvent(
      opened
        ? `${actor} // ${this.labelOf(link)} FREI`
        : `${actor} // ${this.labelOf(link)} +${effective}`,
    );
  }

  /** Schaltet den naechsten Uebergang dieser Bauart komplett frei. */
  private openKind(kind: Link["kind"], actor: string): void {
    const link =
      this.closedLinks().find((item) => item.kind === kind) ??
      this.neediestLink();
    if (!link) {
      this.addEvent(`${actor} // Alles frei`);
      return;
    }
    this.level.build(link.id, link.buildRequired, this.state.tick);
    this.addEvent(`${actor} // ${this.labelOf(link)} FREI`);
  }

  private closedLinks(): Link[] {
    return this.level
      .closedBuildables(this.state.tick)
      .sort((a, b) => this.waitingAt(b.id) - this.waitingAt(a.id));
  }

  private neediestLink(): Link | undefined {
    return this.closedLinks()[0];
  }

  private waitingAt(id: LinkId): number {
    return this.workers.filter(
      (worker) => worker.state === "waiting" && worker.linkId === id,
    ).length;
  }

  private labelOf(link: Link): string {
    return link.label ?? link.id.toUpperCase();
  }

  /** Dreht laufende Roboter um — die trollige Umlenkung. */
  private reverseWalkers(actor: string): void {
    let count = 0;
    for (const worker of this.workers) {
      if (worker.state !== "walking") continue;
      worker.direction = worker.direction === 1 ? -1 : 1;
      count += 1;
    }
    this.addEvent(`${actor} // UMLENKUNG x${count}`);
  }

  private rescueFalling(limit: number, actor: string): void {
    let rescued = 0;
    for (const worker of this.workers) {
      if (rescued >= limit) break;
      if (worker.state !== "falling") continue;
      // Die Rettungsdrohne setzt ihn auf dem naechsten Deck ab.
      worker.state = "walking";
      worker.fallVelocity = 0;
      worker.protectedUntilTick = this.state.tick + TICKS.second * 4;
      const platform = getPlatform(LEVEL_GRAPH, worker.platformId);
      worker.y = platform.y;
      rescued += 1;
    }
    this.addEvent(
      rescued > 0
        ? `${actor} // RETTUNG x${rescued}`
        : `${actor} // Drohne bereit`,
    );
  }

  private blockedBySafeMode(label: string): boolean {
    if (!this.state.safeMode) return false;
    this.addEvent(`SAFE MODE // ${label} blockiert`);
    return true;
  }

  /** Sabotage macht einen gebauten Uebergang wieder kaputt. */
  private breakSomething(actor: string): LinkId | null {
    const built = LEVEL_GRAPH.links.filter(
      (link) =>
        link.buildRequired > 0 &&
        this.level.getRuntime(link.id).openUntilTick > this.state.tick,
    );
    const target = built[built.length - 1];
    if (!target) {
      this.addEvent(`${actor} // Nichts zu zerstoeren`);
      return null;
    }
    this.level.breakLink(target.id);
    this.addEvent(`${actor} // ${this.labelOf(target)} ZERSTOERT`);
    return target.id;
  }

  private applyEarthquake(severity: number, actor: string): void {
    this.breakSomething(actor);
    let pushed = 0;
    for (const worker of this.workers) {
      if (!this.rng.chance(Math.min(0.4, severity * 0.4))) continue;
      if (pushOffPlatform(worker, this.state.tick)) pushed += 1;
    }
    this.addEvent(`${actor} // ERDBEBEN, ${pushed} gestuerzt`);
  }

  private startTsarBomb(actor: ViewerIdentity): void {
    const bomb = this.state.tsarBomb;
    if (this.state.roundStatus !== "running") {
      this.addEvent("ZAR-BOMBE // Erst eine Runde starten");
      return;
    }
    if (this.state.safeMode) {
      this.addEvent("SAFE MODE // ZAR-BOMBE blockiert");
      return;
    }
    if (bomb.phase !== "idle" || this.state.tick < bomb.cooldownUntilTick) {
      this.addEvent("ABKLINGZEIT // ZAR-BOMBE nicht bereit");
      return;
    }
    bomb.phase = "warning";
    bomb.actor = actor;
    bomb.startedTick = this.state.tick;
    bomb.impactTick = this.state.tick + TICKS.tsarWarning + TICKS.tsarDescent;
    bomb.recoveryUntilTick = bomb.impactTick + TICKS.rebuild;
    bomb.cooldownUntilTick = this.state.tick + TICKS.tsarCooldown;
    bomb.impactApplied = false;
    this.addEvent(`${actor.displayName ?? actor.username} // ZAR-BOMBE`);
  }

  // --- Zeitablauf -----------------------------------------------------------

  private updateTimedEffects(): void {
    if (
      this.state.environmentMode !== "none" &&
      this.state.tick >= this.state.environmentUntilTick
    ) {
      this.state.environmentMode = "none";
    }

    const bomb = this.state.tsarBomb;
    if (bomb.phase === "idle") return;
    if (this.state.tick < bomb.startedTick + TICKS.tsarWarning) {
      bomb.phase = "warning";
      return;
    }
    if (this.state.tick < bomb.impactTick) {
      bomb.phase = "descending";
      return;
    }
    if (!bomb.impactApplied) {
      bomb.phase = "impact";
      bomb.impactApplied = true;
      this.applyTsarImpact();
      return;
    }
    if (this.state.tick < bomb.recoveryUntilTick) {
      bomb.phase = "recovery";
      this.state.recoveryMultiplier = 2;
      return;
    }
    bomb.phase = "idle";
    bomb.actor = null;
    this.state.recoveryMultiplier = 1;
    this.addEvent("TEAM REBUILD // Abgeschlossen");
  }

  private applyTsarImpact(): void {
    // Etwa die Haelfte der gebauten Uebergaenge faellt, nie alle.
    const built = LEVEL_GRAPH.links.filter(
      (link) =>
        link.buildRequired > 0 &&
        this.level.getRuntime(link.id).openUntilTick > this.state.tick,
    );
    const destroy = Math.max(1, Math.round(built.length * 0.6));
    for (const link of built.slice(0, destroy)) this.level.breakLink(link.id);

    for (const worker of this.workers) {
      if (this.rng.chance(0.35)) pushOffPlatform(worker, this.state.tick);
    }
    this.state.recoveryMultiplier = 2;
    this.addEvent("EINSCHLAG // TEAM REBUILD x2");
  }

  private refreshWaitingCounts(): void {
    const counts = new Map<LinkId, number>();
    for (const worker of this.workers) {
      if (worker.state !== "waiting" || !worker.linkId) continue;
      counts.set(worker.linkId, (counts.get(worker.linkId) ?? 0) + 1);
    }
    for (const link of LEVEL_GRAPH.links) {
      this.level.setWaiting(link.id, counts.get(link.id) ?? 0);
    }
  }

  private refreshCounts(): void {
    this.state.rescuedCount = this.workers.filter(
      (worker) => worker.state === "rescued",
    ).length;
    this.state.lostCount = this.workers.filter(
      (worker) => worker.state === "lost",
    ).length;
  }

  private evaluateRound(): void {
    if (this.state.rescuedCount + this.state.lostCount === WORKER_COUNT) {
      this.state.roundStatus =
        this.state.rescuedCount >= RESCUE_TARGET ? "success" : "failure";
      this.addEvent(
        this.state.roundStatus === "success"
          ? "RUNDE // AUFSTIEG GESICHERT"
          : "RUNDE // ZIEL VERFEHLT",
      );
      return;
    }
    if (this.state.remainingTicks === 0) {
      for (const worker of this.workers) {
        if (ACTIVE_STATES.has(worker.state)) worker.state = "lost";
      }
      this.refreshCounts();
      this.state.roundStatus =
        this.state.rescuedCount >= RESCUE_TARGET ? "success" : "failure";
    }
  }

  private addEvent(message: string): void {
    this.state.eventFeed.unshift(message);
    this.state.eventFeed = this.state.eventFeed.slice(0, 8);
  }

  // --- Abfragen -------------------------------------------------------------

  getActiveCount(): number {
    return this.workers.filter((worker) => ACTIVE_STATES.has(worker.state))
      .length;
  }

  /** Mittlerer Aufstieg aller Roboter, 0..1 — fuer die Fortschrittsleiste. */
  getAscentProgress(): number {
    if (this.workers.length === 0) return 0;
    const total = this.workers.reduce(
      (sum, worker) =>
        sum + (worker.state === "rescued" ? 1 : worker.highestFloor / TOP_FLOOR),
      0,
    );
    return total / this.workers.length;
  }

  /** Uebergang mit den meisten Wartenden — fuer HUD-Hinweise. */
  getHotspot(): { link: Link; waiting: number } | null {
    let best: { link: Link; waiting: number } | null = null;
    for (const link of this.level.closedBuildables(this.state.tick)) {
      const waiting = this.waitingAt(link.id);
      if (waiting > 0 && (!best || waiting > best.waiting)) {
        best = { link, waiting };
      }
    }
    return best;
  }

  clearEventFeed(): void {
    this.state.eventFeed = [];
  }

  getResult(): RoundResult {
    const workerSignature = this.workers
      .map(
        (worker) =>
          `${worker.id}:${worker.state}:${Math.round(worker.x)}:${Math.round(worker.y)}:${worker.highestFloor}`,
      )
      .join("|");
    const linkSignature = LEVEL_GRAPH.links
      .map((link) => {
        const runtime = this.level.getRuntime(link.id);
        return `${link.id}:${runtime.buildProgress}:${runtime.openUntilTick > this.state.tick ? 1 : 0}`;
      })
      .join("|");
    return {
      seed: this.state.seed,
      tick: this.state.tick,
      status: this.state.roundStatus,
      rescued: this.state.rescuedCount,
      lost: this.state.lostCount,
      active: this.getActiveCount(),
      hash: this.hash(`${workerSignature}//${linkSignature}`),
    };
  }

  exportReplay(): ReplayData {
    return {
      formatVersion: 1,
      levelVersion: this.levelVersion,
      seed: this.state.seed,
      endTick: this.state.tick,
      commands: structuredClone(this.commandHistory),
      expectedResult: this.getResult(),
    };
  }

  private hash(value: string): string {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
}

export { getLink };
