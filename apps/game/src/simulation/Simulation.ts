import type {
  GameCommand,
  OrderedGameCommand,
  ViewerIdentity,
} from "@noema/event-protocol";
import { CommandQueue, OPERATOR_ACTOR } from "../commands/CommandQueue";
import { CHECKPOINT_PROGRESS } from "../config/level";
import {
  DEFAULT_SEED,
  LEVEL_VERSION,
  RESCUE_TARGET,
  ROUND_DURATION_TICKS,
  TICKS,
  WORKER_COUNT,
} from "../config/gameConfig";
import { SeededRandom } from "./rng";
import type {
  ReplayData,
  RoundResult,
  SimulationState,
  TemporaryStructure,
  Worker,
} from "./types";
import {
  beginFall,
  beginJump,
  blockAndReverse,
  createWorker,
  protectWorker,
  returnToCheckpoint,
  syncWorkerPosition,
} from "./workerMachine";

const ACTIVE_STATES = new Set([
  "spawning",
  "walking",
  "falling",
  "jumping",
  "blocked",
  "protected",
]);

function freshStructures(): TemporaryStructure[] {
  return [
    {
      id: "bridge-alpha",
      kind: "bridge",
      intact: false,
      health: 0,
      temporary: true,
    },
    {
      id: "shortcut-deck",
      kind: "route",
      intact: true,
      health: 100,
      temporary: true,
    },
    {
      id: "jump-field",
      kind: "jump-field",
      intact: false,
      health: 0,
      temporary: true,
    },
    {
      id: "route-brace",
      kind: "route",
      intact: true,
      health: 100,
      temporary: true,
    },
  ];
}

function actorFor(command: GameCommand): ViewerIdentity {
  if ("actor" in command && command.actor) return command.actor;
  return OPERATOR_ACTOR;
}

export class Simulation {
  readonly commandQueue = new CommandQueue();
  workers: Worker[] = [];
  state: SimulationState;
  commandHistory: OrderedGameCommand[] = [];
  readonly levelVersion = LEVEL_VERSION;

  private rng: SeededRandom;
  private checkpointAnnouncements = new Set<number>();

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
      teamEnergy: 15,
      rescuedCount: 0,
      lostCount: 0,
      safeMode: false,
      reducedMotion: false,
      liftActiveUntilTick: 0,
      shieldUntilTick: 0,
      blockerUntilTick: 0,
      jumpFieldUntilTick: 0,
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
      structures: freshStructures(),
      eventFeed: ["SYSTEM // Tower link ready"],
    };
  }

  private createWorkers(): Worker[] {
    return Array.from({ length: WORKER_COUNT }, (_, index) => {
      const route = index % 5 === 0 ? "risky" : "safe";
      // Langsamer als im Prototyp: Ein Roboter braucht knapp zwei Minuten nach
      // oben, damit Geschenke ueberhaupt Zeit haben zu wirken.
      return createWorker(index + 1, route, 0.0004 + this.rng.next() * 0.00004);
    });
  }

  startRound(seed = this.state.seed): void {
    this.resetRound(seed);
    this.state.roundStatus = "running";
    this.addEvent(`ROUND // Seed ${seed}`);
  }

  resetRound(seed = this.state.seed): void {
    this.rng = new SeededRandom(seed);
    this.state = this.createState(seed);
    this.workers = this.createWorkers();
    this.commandHistory = [];
    this.commandQueue.clear();
    this.checkpointAnnouncements.clear();
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
    for (const worker of this.workers) this.updateWorker(worker);
    this.refreshCounts();
    this.evaluateRound();
  }

  private applyCommand(item: OrderedGameCommand): void {
    const { command } = item;
    if (command.type === "reset") {
      const seed = this.state.seed;
      this.resetRound(seed);
      this.addEvent("OPERATOR // Round reset");
      return;
    }

    this.commandHistory.push(structuredClone(item));
    const actor = item.actor.displayName ?? item.actor.username;

    switch (command.type) {
      case "pause":
        if (this.state.roundStatus === "running") {
          this.state.roundStatus = "paused";
          this.addEvent("OPERATOR // Simulation paused");
        }
        break;
      case "resume":
        if (
          this.state.roundStatus === "paused" ||
          this.state.roundStatus === "ready"
        ) {
          this.state.roundStatus = "running";
          this.addEvent("OPERATOR // Simulation resumed");
        }
        break;
      case "set_safe_mode":
        this.state.safeMode = command.enabled;
        this.addEvent(`SAFE MODE // ${command.enabled ? "ON" : "OFF"}`);
        break;
      case "set_reduced_motion":
        this.state.reducedMotion = command.enabled;
        this.addEvent(`REDUCED MOTION // ${command.enabled ? "ON" : "OFF"}`);
        break;
      case "add_team_energy":
        this.state.teamEnergy = Math.min(
          100,
          this.state.teamEnergy + command.amount,
        );
        this.addEvent(`${actor} // +${command.amount} team energy`);
        break;
      case "repair_structure":
        this.applyRepair(command.amount, actor);
        break;
      case "build_bridge":
        this.buildBridge(actor);
        break;
      case "place_blocker":
        this.state.blockerUntilTick = Math.max(
          this.state.blockerUntilTick,
          this.state.tick + command.durationTicks,
        );
        this.structure("route-brace").intact = true;
        this.addEvent(`${actor} // Direction brace placed`);
        break;
      case "place_jump_field":
        this.state.jumpFieldUntilTick = Math.max(
          this.state.jumpFieldUntilTick,
          this.state.tick + command.durationTicks,
        );
        this.structure("jump-field").intact = true;
        this.structure("jump-field").health = 100;
        this.addEvent(`${actor} // Jump field online`);
        break;
      case "activate_lift":
        this.state.liftActiveUntilTick = Math.max(
          this.state.liftActiveUntilTick,
          this.state.tick + command.durationTicks,
        );
        this.addEvent(`${actor} // Lift overdrive`);
        break;
      case "group_shield":
        this.state.shieldUntilTick = Math.max(
          this.state.shieldUntilTick,
          this.state.tick + command.durationTicks,
        );
        for (const worker of this.workers) {
          protectWorker(worker, this.state.shieldUntilTick);
        }
        this.addEvent(`${actor} // Team shield`);
        break;
      case "rescue_worker":
        this.rescueOne(command.workerId, actor);
        break;
      case "area_rescue":
        this.rescueArea(command.x, command.y, command.radius, actor);
        break;
      case "collapse_section":
        if (this.blockedBySafeMode("Route collapse")) break;
        this.collapseOne(command.sectionId);
        this.addEvent(`${actor} // Temporary route collapsed`);
        break;
      case "environment_shift":
        if (this.blockedBySafeMode("Environment sabotage")) break;
        this.state.environmentMode = command.mode;
        this.state.environmentUntilTick = Math.max(
          this.state.environmentUntilTick,
          this.state.tick + command.durationTicks,
        );
        this.addEvent(`${actor} // ${command.mode.replace("_", " ")}`);
        break;
      case "earthquake":
        if (this.blockedBySafeMode("Earthquake")) break;
        this.applyEarthquake(command.severity);
        this.addEvent(`${actor} // MAJOR EARTHQUAKE`);
        break;
      case "tsar_bomb":
        this.startTsarBomb(item.actor);
        break;
    }
  }

  private applyRepair(amount: number, actor: string): void {
    const effective = Math.round(amount * this.state.recoveryMultiplier);
    const target =
      this.state.structures.find((structure) => !structure.intact) ??
      this.state.structures.find((structure) => structure.health < 100);
    if (target) {
      target.health = Math.min(100, target.health + effective);
      if (target.health >= 50) target.intact = true;
      this.addEvent(`${actor} // Repair +${effective}`);
      return;
    }
    const falling = this.workers.find((worker) => worker.state === "falling");
    if (falling) returnToCheckpoint(falling);
    this.addEvent(`${actor} // Protective repair pulse`);
  }

  private buildBridge(actor: string): void {
    const bridge = this.structure("bridge-alpha");
    bridge.intact = true;
    bridge.health = 100;
    this.state.teamEnergy = Math.max(0, this.state.teamEnergy - 10);
    this.addEvent(`${actor} // Bridge constructed`);
  }

  private rescueOne(workerId: number | undefined, actor: string): void {
    const worker =
      (workerId === undefined
        ? undefined
        : this.workers.find((candidate) => candidate.id === workerId)) ??
      this.workers.find((candidate) => candidate.state === "falling");
    if (worker && worker.state === "falling") {
      returnToCheckpoint(worker);
      protectWorker(worker, this.state.tick + TICKS.second * 3);
      this.addEvent(`${actor} // Worker ${worker.id} recovered`);
    } else {
      this.addEvent(`${actor} // Rescue drone standing by`);
    }
  }

  private rescueArea(x: number, y: number, radius: number, actor: string): void {
    let rescued = 0;
    for (const worker of this.workers) {
      if (worker.state !== "falling") continue;
      if (Math.hypot(worker.x - x, worker.y - y) <= radius) {
        returnToCheckpoint(worker);
        protectWorker(worker, this.state.tick + TICKS.second * 3);
        rescued += 1;
      }
    }
    this.addEvent(`${actor} // Area rescue x${rescued}`);
  }

  private blockedBySafeMode(label: string): boolean {
    if (!this.state.safeMode) return false;
    this.addEvent(`SAFE MODE // ${label} blocked`);
    return true;
  }

  private collapseOne(sectionId?: string): void {
    const target =
      (sectionId
        ? this.state.structures.find(
            (structure) => structure.id === sectionId && structure.intact,
          )
        : undefined) ??
      this.state.structures.find(
        (structure) => structure.intact && structure.id !== "route-brace",
      );
    if (!target) return;
    target.intact = false;
    target.health = 0;
  }

  private applyEarthquake(severity: number): void {
    this.collapseOne();
    for (const worker of this.workers) {
      if (
        worker.route === "risky" &&
        (worker.state === "walking" || worker.state === "blocked") &&
        worker.protectedUntilTick <= this.state.tick &&
        this.rng.chance(Math.min(0.45, severity * 0.45))
      ) {
        beginFall(worker);
      }
    }
  }

  private startTsarBomb(actor: ViewerIdentity): void {
    const bomb = this.state.tsarBomb;
    if (this.state.roundStatus !== "running") {
      this.addEvent("ZAR-BOMBE // Start a round first");
      return;
    }
    if (this.state.safeMode) {
      this.addEvent("SAFE MODE // ZAR-BOMBE blocked");
      return;
    }
    if (bomb.phase !== "idle" || this.state.tick < bomb.cooldownUntilTick) {
      this.addEvent("COOLDOWN // ZAR-BOMBE unavailable");
      return;
    }
    bomb.phase = "warning";
    bomb.actor = actor;
    bomb.startedTick = this.state.tick;
    bomb.impactTick = this.state.tick + TICKS.tsarWarning + TICKS.tsarDescent;
    bomb.recoveryUntilTick = bomb.impactTick + TICKS.rebuild;
    bomb.cooldownUntilTick = this.state.tick + TICKS.tsarCooldown;
    bomb.impactApplied = false;
    this.addEvent(
      `${actor.displayName ?? actor.username} // ZAR-BOMBE INBOUND`,
    );
  }

  private updateTimedEffects(): void {
    if (
      this.state.environmentMode !== "none" &&
      this.state.tick >= this.state.environmentUntilTick
    ) {
      this.state.environmentMode = "none";
    }
    if (this.state.tick >= this.state.jumpFieldUntilTick) {
      const jumpField = this.structure("jump-field");
      jumpField.intact = false;
      jumpField.health = 0;
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
    this.addEvent("TEAM REBUILD // Recovery complete");
  }

  private applyTsarImpact(): void {
    const intact = this.state.structures.filter((structure) => structure.intact);
    const destroyCount = Math.max(1, Math.round(intact.length * 0.6));
    const shuffled = [...intact].sort(() => this.rng.next() - 0.5);
    for (const structure of shuffled.slice(0, destroyCount)) {
      structure.intact = false;
      structure.health = 0;
    }
    for (const worker of this.workers) {
      if (!ACTIVE_STATES.has(worker.state)) continue;
      if (worker.protectedUntilTick > this.state.tick) continue;
      if (this.rng.chance(0.32)) {
        worker.progress = Math.max(
          worker.lastCheckpoint === 2
            ? CHECKPOINT_PROGRESS[1]
            : worker.lastCheckpoint === 1
              ? CHECKPOINT_PROGRESS[0]
              : 0,
          worker.progress - 0.08,
        );
        worker.lateralOffset = this.rng.integer(-58, 58);
        beginJump(worker, this.state.tick, TICKS.second);
      }
    }
    this.state.recoveryMultiplier = 2;
    this.addEvent("IMPACT // TEAM REBUILD x2");
  }

  private updateWorker(worker: Worker): void {
    if (worker.state === "rescued" || worker.state === "lost") return;
    if (worker.state === "spawning") {
      if (this.state.tick < worker.spawnTick) return;
      worker.state =
        worker.protectedUntilTick > this.state.tick ? "protected" : "walking";
    }

    if (worker.state === "falling") {
      const gravity =
        this.state.environmentMode === "low_gravity" ? 0.28 : 0.82;
      worker.velocityY += gravity;
      worker.y += worker.velocityY;
      if (worker.y > 1235) worker.state = "lost";
      return;
    }

    if (worker.state === "jumping") {
      worker.progress = Math.min(1, worker.progress + worker.speed * 1.7);
      worker.velocityY += 0.48;
      syncWorkerPosition(worker);
      worker.y += Math.min(0, worker.velocityY * 2.4);
      worker.lateralOffset *= 0.93;
      if (this.state.tick >= worker.stateUntilTick) {
        worker.state =
          worker.protectedUntilTick > this.state.tick ? "protected" : "walking";
        worker.velocityY = 0;
      }
      this.checkProgress(worker);
      return;
    }

    if (worker.state === "blocked") {
      worker.progress = Math.max(0, worker.progress - worker.speed * 0.55);
      syncWorkerPosition(worker);
      if (this.state.tick >= worker.stateUntilTick) {
        worker.direction = 1;
        worker.state =
          worker.protectedUntilTick > this.state.tick ? "protected" : "walking";
      }
      return;
    }

    if (
      worker.state === "protected" &&
      worker.protectedUntilTick <= this.state.tick
    ) {
      worker.state = "walking";
    }

    worker.progress = Math.min(1, worker.progress + worker.speed);
    worker.lateralOffset *= 0.9;
    if (
      this.state.environmentMode === "wind" &&
      worker.protectedUntilTick <= this.state.tick
    ) {
      worker.lateralOffset = Math.min(42, worker.lateralOffset + 0.7);
    }
    syncWorkerPosition(worker);

    if (
      this.state.blockerUntilTick > this.state.tick &&
      worker.progress >= 0.4 &&
      worker.progress < 0.43
    ) {
      blockAndReverse(worker, this.state.tick, TICKS.second);
      return;
    }

    if (worker.route === "risky") {
      this.updateRiskyRoute(worker);
    } else {
      this.updateSafeRoute(worker);
    }
    this.checkProgress(worker);
  }

  private updateRiskyRoute(worker: Worker): void {
    if (worker.progress >= 0.205 && worker.progress < 0.24) {
      const bridge = this.structure("bridge-alpha").intact;
      const jumpField = this.state.jumpFieldUntilTick > this.state.tick;
      if (!bridge && jumpField) {
        worker.progress = 0.25;
        beginJump(worker, this.state.tick, TICKS.second);
      } else if (!bridge) {
        beginFall(worker);
      }
    }
    if (
      worker.progress >= 0.46 &&
      worker.progress < 0.5 &&
      !this.structure("shortcut-deck").intact
    ) {
      beginFall(worker);
    }
  }

  private updateSafeRoute(worker: Worker): void {
    const hazardCycle = Math.floor(this.state.tick / 180);
    const hazardActive = this.state.tick % 180 < 44;
    if (
      worker.progress >= 0.47 &&
      worker.progress < 0.5 &&
      hazardActive &&
      worker.protectedUntilTick <= this.state.tick &&
      worker.lastHazardCycle !== hazardCycle
    ) {
      worker.lastHazardCycle = hazardCycle;
      blockAndReverse(worker, this.state.tick, TICKS.second);
      return;
    }

    const liftReady =
      this.state.liftActiveUntilTick > this.state.tick ||
      this.state.tick % 180 < 64;
    if (worker.progress >= 0.62 && worker.progress < 0.65 && !liftReady) {
      blockAndReverse(worker, this.state.tick, Math.floor(TICKS.second * 0.7));
      return;
    }

    const platformReady = this.state.tick % 150 < 82;
    if (
      worker.progress >= 0.81 &&
      worker.progress < 0.835 &&
      !platformReady
    ) {
      blockAndReverse(worker, this.state.tick, Math.floor(TICKS.second * 0.5));
    }
  }

  private checkProgress(worker: Worker): void {
    if (
      worker.lastCheckpoint < 1 &&
      worker.progress >= CHECKPOINT_PROGRESS[0]
    ) {
      worker.lastCheckpoint = 1;
      this.announceCheckpoint(1);
    }
    if (
      worker.lastCheckpoint < 2 &&
      worker.progress >= CHECKPOINT_PROGRESS[1]
    ) {
      worker.lastCheckpoint = 2;
      this.announceCheckpoint(2);
    }
    if (worker.progress >= 1) {
      worker.state = "rescued";
      worker.x = 360;
      worker.y = 126;
      if ((this.state.rescuedCount + 1) % 5 === 0) {
        this.addEvent(`RESCUE // ${this.state.rescuedCount + 1} secured`);
      }
    }
  }

  private announceCheckpoint(checkpoint: number): void {
    if (this.checkpointAnnouncements.has(checkpoint)) return;
    this.checkpointAnnouncements.add(checkpoint);
    this.addEvent(`CHECKPOINT ${checkpoint} // Online`);
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
    const terminal = this.state.rescuedCount + this.state.lostCount;
    if (terminal === WORKER_COUNT) {
      this.state.roundStatus =
        this.state.rescuedCount >= RESCUE_TARGET ? "success" : "failure";
      this.addEvent(
        this.state.roundStatus === "success"
          ? "ROUND // ASCENT SECURED"
          : "ROUND // TARGET MISSED",
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

  private structure(id: string): TemporaryStructure {
    const structure = this.state.structures.find((item) => item.id === id);
    if (!structure) throw new Error(`Unknown structure: ${id}`);
    return structure;
  }

  private addEvent(message: string): void {
    this.state.eventFeed.unshift(message);
    this.state.eventFeed = this.state.eventFeed.slice(0, 8);
  }

  getActiveCount(): number {
    return this.workers.filter((worker) => ACTIVE_STATES.has(worker.state))
      .length;
  }

  clearEventFeed(): void {
    this.state.eventFeed = [];
  }

  getResult(): RoundResult {
    const workerSignature = this.workers
      .map(
        (worker) =>
          `${worker.id}:${worker.state}:${Math.round(worker.progress * 10000)}:${worker.lastCheckpoint}`,
      )
      .join("|");
    const structureSignature = this.state.structures
      .map(
        (structure) =>
          `${structure.id}:${structure.intact ? 1 : 0}:${structure.health}`,
      )
      .join("|");
    return {
      seed: this.state.seed,
      tick: this.state.tick,
      status: this.state.roundStatus,
      rescued: this.state.rescuedCount,
      lost: this.state.lostCount,
      active: this.getActiveCount(),
      hash: this.hash(`${workerSignature}//${structureSignature}`),
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
