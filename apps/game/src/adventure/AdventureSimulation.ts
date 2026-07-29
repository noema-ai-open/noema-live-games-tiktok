import type {
  GameCommand,
  OrderedGameCommand,
  ViewerIdentity,
} from "@noema/event-protocol";
import { CommandQueue, OPERATOR_ACTOR } from "../commands/CommandQueue";
import {
  DEFAULT_SEED,
  FIXED_HZ,
  LEVEL_VERSION,
  ROUND_DURATION_TICKS,
  TICKS,
  WORLD_GROUND_Y,
} from "../config/gameConfig";
import type {
  ReplayData,
  RoundResult,
  SimulationState,
} from "../simulation/types";
import { CheckpointSystem } from "./CheckpointSystem";
import { GiftActionRouter } from "./GiftActionRouter";
import { HeroController } from "./HeroController";
import { LevelDirector } from "./LevelDirector";
import { ObstacleController } from "./ObstacleController";
import { RouteVoteController } from "./RouteVoteController";
import { createAdventureCampaign } from "./levelTemplates";
import type { AdventureAction, AdventureLevel, LevelSegment } from "./levelTypes";

const INTRO_TICKS = FIXED_HZ * 2;
const CHECKPOINT_TICKS = Math.round(FIXED_HZ * 0.65);
const FALL_PENALTY_TICKS = FIXED_HZ * 5;

function actorFor(command: GameCommand): ViewerIdentity {
  if ("actor" in command && command.actor) return command.actor;
  return OPERATOR_ACTOR;
}

export class AdventureSimulation {
  readonly commandQueue = new CommandQueue();
  readonly levelVersion = LEVEL_VERSION;
  readonly giftActions = new GiftActionRouter();
  readonly routeVote = new RouteVoteController();

  levels: AdventureLevel[];
  levelIndex = 0;
  hero: HeroController;
  director: LevelDirector;
  obstacles: ObstacleController;
  checkpoints: CheckpointSystem;
  state: SimulationState;
  commandHistory: OrderedGameCommand[] = [];

  private processedBombTransactions = new Set<string>();
  private checkpointUntilTick = -1;
  private lastRevealTick = -1;
  private fallResetPending = false;
  private introUntilTick = INTRO_TICKS;

  constructor(seed = DEFAULT_SEED) {
    this.levels = createAdventureCampaign(seed);
    this.hero = new HeroController();
    this.director = new LevelDirector(this.levels[0]!);
    this.obstacles = new ObstacleController();
    this.checkpoints = new CheckpointSystem();
    this.state = this.createState(seed);
    this.hero.startIntro();
    this.syncState();
  }

  startRound(seed = this.state.seed): void {
    this.resetRound(seed);
    this.state.roundStatus = "running";
    this.hero.startIntro();
    this.addEvent(`RUNDE // Seed ${seed}`);
    this.syncState();
  }

  resetRound(seed = this.state.seed): void {
    this.levels = createAdventureCampaign(seed);
    this.levelIndex = 0;
    this.hero = new HeroController();
    this.director = new LevelDirector(this.levels[0]!);
    this.obstacles = new ObstacleController();
    this.checkpoints = new CheckpointSystem();
    this.state = this.createState(seed);
    this.commandHistory = [];
    this.commandQueue.clear();
    this.processedBombTransactions.clear();
    this.checkpointUntilTick = -1;
    this.lastRevealTick = -1;
    this.fallResetPending = false;
    this.introUntilTick = INTRO_TICKS;
    this.routeVote.reset();
    this.hero.startIntro();
    this.syncState();
  }

  submit(command: GameCommand): OrderedGameCommand {
    return this.commandQueue.enqueue(command, this.state.tick, actorFor(command));
  }

  enqueueRecorded(command: OrderedGameCommand): void {
    this.commandQueue.enqueueRecorded(command);
  }

  step(): void {
    for (const command of this.commandQueue.drain(this.state.tick)) {
      this.applyCommand(command);
    }

    if (this.state.roundStatus !== "running") {
      this.syncState();
      return;
    }

    this.state.tick += 1;

    if (this.updateBomb()) {
      this.syncState();
      return;
    }

    if (this.state.levelCelebration.active) {
      this.updateLevelCelebration();
      this.syncState();
      return;
    }

    this.state.remainingTicks = Math.max(0, this.state.remainingTicks - 1);

    if (this.state.remainingTicks === 0) {
      this.finishFailure();
      this.syncState();
      return;
    }

    this.updateAdventure();
    this.syncState();
  }

  getActiveCount(): number {
    return this.state.roundStatus === "running" || this.state.roundStatus === "paused" ? 1 : 0;
  }

  getAscentProgress(): number {
    const level = this.director.level;
    const local = Math.max(
      0,
      Math.min(1, (this.hero.x - level.startX) / (level.finishX - level.startX)),
    );
    return (this.levelIndex + local) / this.levels.length;
  }

  clearEventFeed(): void {
    this.state.eventFeed = [];
  }

  getResult(): RoundResult {
    const obstacleSignature = Object.values(this.obstacles.export())
      .sort((a, b) => a.segmentId.localeCompare(b.segmentId))
      .map((item) => `${item.segmentId}:${item.visibleParts}:${item.resolved ? 1 : 0}`)
      .join("|");
    const signature = [
      Math.round(this.hero.x),
      Math.round(this.hero.y),
      this.hero.state,
      this.levelIndex,
      this.state.completedLevelIds.join(","),
      this.director.segmentIndex,
      this.director.chosenRoute ?? "-",
      [...this.director.completedSegments].join(","),
      obstacleSignature,
      this.state.remainingTicks,
    ].join("//");
    return {
      seed: this.state.seed,
      tick: this.state.tick,
      status: this.state.roundStatus,
      rescued: this.state.roundStatus === "success" ? 1 : 0,
      lost: this.state.roundStatus === "failure" ? 1 : 0,
      active: this.getActiveCount(),
      hash: this.hash(signature),
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

  private createState(seed: number): SimulationState {
    return {
      seed,
      tick: 0,
      remainingTicks: ROUND_DURATION_TICKS,
      roundStatus: "ready",
      heroState: "intro",
      speechBubble: {
        visible: false,
        text: "",
        blockedSinceTick: null,
        lastShownUntilTick: null,
      },
      segmentId: "station-intro",
      levelIndex: 0,
      levelCount: this.levels.length,
      completedLevelIds: [],
      levelCelebration: {
        active: false,
        style: this.levels[0]!.celebration,
        startedTick: -1,
        endsTick: -1,
      },
      teamEnergy: 0,
      checkpointCount: 0,
      safeMode: false,
      reducedMotion: false,
      chosenRoute: null,
      lastContributor: null,
      tsarBomb: {
        phase: "idle",
        actor: null,
        transactionId: null,
        startedTick: -1,
        impactTick: -1,
        recoveryUntilTick: -1,
        cooldownUntilTick: 0,
        impactApplied: false,
      },
      eventFeed: ["SYSTEM // Adventure bereit"],
    };
  }

  private applyCommand(item: OrderedGameCommand): void {
    const command = item.command;
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
          this.hero.pause();
          this.addEvent("OPERATOR // Pausiert");
        }
        return;
      case "resume":
        if (this.state.roundStatus === "paused" || this.state.roundStatus === "ready") {
          this.state.roundStatus = "running";
          this.hero.resume();
          this.addEvent("OPERATOR // Weiter");
        }
        return;
      case "set_safe_mode":
        this.state.safeMode = command.enabled;
        this.addEvent(`SAFE MODE // ${command.enabled ? "AN" : "AUS"}`);
        return;
      case "set_reduced_motion":
        this.state.reducedMotion = command.enabled;
        this.addEvent(`REDUCED MOTION // ${command.enabled ? "AN" : "AUS"}`);
        return;
      case "add_team_energy":
        this.addTeamEnergy(command.amount, actor);
        return;
      case "add_time":
        this.state.remainingTicks += Math.max(0, Math.round(command.seconds * FIXED_HZ));
        this.addEvent(`${actor} // +${command.seconds}s`);
        return;
      case "route_vote":
        if (this.routeVote.vote(command.eventId, item.actor.id, command.choice, this.state.tick)) {
          this.addEvent(`${actor} // ${command.choice === "left" ? "LINKS" : "RECHTS"}`);
        }
        return;
      case "tsar_bomb":
        this.startBomb(item.actor, command.transactionId ?? `command:${item.sequence}`);
        return;
      default:
        this.applyAdventureAction(command, item.actor);
    }
  }

  private applyAdventureAction(command: GameCommand, actor: ViewerIdentity): void {
    const action = this.giftActions.toAdventureAction(command);
    if (!action) return;

    if (action === "helper" && this.hero.state === "falling") {
      if (this.hero.beginHelper(FIXED_HZ)) {
        this.state.lastContributor = actor;
        this.fallResetPending = true;
        this.addEvent(`${actor.displayName ?? actor.username} // HELFER-RETTUNG`);
      }
      return;
    }

    if (this.hero.state !== "blocked") return;
    const segment = this.director.current;
    const result = this.obstacles.apply(segment, action);
    if (!result.accepted) return;

    this.state.lastContributor = actor;
    const name = actor.displayName ?? actor.username;
    if (action === "jump") {
      this.hero.beginJump(segment.landingX ?? segment.endX, segment.groundY);
      this.addEvent(`${name} // SPRINGEN`);
      return;
    }
    if (action === "helper") {
      this.hero.beginHelper(result.durationTicks);
      this.addEvent(`${name} // HELFER`);
      return;
    }

    this.hero.beginBuild(result.durationTicks);
    this.lastRevealTick = this.state.tick;
    this.addEvent(
      action === "build_bridge"
        ? `${name} // BRUECKE`
        : `${name} // ${result.partsAdded} BAUTEILE`,
    );
  }

  private addTeamEnergy(amount: number, actor: string): void {
    this.state.teamEnergy = Math.min(100, this.state.teamEnergy + Math.max(0, amount));
    this.addEvent(`${actor} // TEAM-ENERGIE +${amount}`);
    if (this.state.teamEnergy < 100 || this.hero.state !== "blocked") return;
    this.state.teamEnergy = 0;

    const segment = this.director.current;
    if (segment.requiredAction === "jump") {
      this.obstacles.apply(segment, "jump");
      this.hero.beginJump(segment.landingX ?? segment.endX, segment.groundY);
      this.addEvent("TEAM-ENERGIE // FREIER SPRUNG");
      return;
    }

    const progress = this.obstacles.get(segment);
    if (progress.builtParts < progress.requiredParts) {
      progress.builtParts += 1;
      progress.buildRevision += 1;
      this.hero.beginBuild(12);
      this.lastRevealTick = this.state.tick;
      this.addEvent("TEAM-ENERGIE // 1 BAUTEIL");
    }
  }

  private updateAdventure(): void {
    if (this.hero.state === "intro") {
      if (this.state.tick >= this.introUntilTick) {
        this.director.completeCurrent();
        this.hero.startRunning();
      }
      return;
    }

    if (this.hero.state === "checkpoint") {
      if (this.state.tick >= this.checkpointUntilTick) this.hero.startRunning();
      return;
    }

    if (this.hero.state === "route_vote") {
      const winner = this.routeVote.finish(this.state.tick);
      if (!winner) return;
      this.director.chooseRoute(winner);
      this.hero.x = this.director.current.landingX ?? this.director.current.endX;
      this.completeCurrentSegment();
      this.addEvent(`ROUTE // ${winner === "left" ? "LINKS" : "RECHTS"}`);
      return;
    }

    if (this.hero.state === "jumping" || this.hero.state === "climbing") {
      if (!this.hero.stepAction()) return;
      this.hero.animation = "land";
      this.completeCurrentSegment();
      return;
    }

    if (this.hero.state === "performing_action") {
      this.revealBuiltParts();
      if (!this.hero.stepAction()) return;
      this.revealAllBuiltParts();
      const progress = this.obstacles.get(this.director.current);
      if (!progress.resolved) {
        this.hero.block();
        return;
      }
      if (this.director.current.type === "high_ledge") {
        this.hero.block();
        this.hero.beginClimb(
          this.director.current.landingX ?? this.director.current.endX,
          this.director.current.groundY - 60,
        );
        return;
      }
      this.hero.startRunning();
      return;
    }

    if (this.hero.state === "helper_active") {
      if (!this.hero.stepAction()) return;
      if (this.fallResetPending) {
        this.fallResetPending = false;
        this.restoreCheckpoint(FALL_PENALTY_TICKS);
        return;
      }
      this.obstacles.completeHelper(this.director.current);
      this.hero.startRunning();
      return;
    }

    if (this.hero.state === "falling") {
      if (!this.hero.stepAction()) return;
      this.restoreCheckpoint(FALL_PENALTY_TICKS);
      return;
    }

    if (this.hero.state === "resetting") {
      this.hero.startRunning();
      return;
    }

    if (this.hero.state !== "running" && this.hero.state !== "approaching_obstacle") return;
    const segment = this.director.current;
    this.hero.y = segment.groundY;

    if (segment.type === "finish") {
      if (this.hero.stepRunning(this.director.level.finishX)) this.finishCurrentLevel();
      return;
    }

    if (!segment.obstacleType) {
      this.hero.y = segment.groundY;
      if (this.hero.stepRunning(segment.endX)) this.completeCurrentSegment();
      return;
    }

    if (segment.type === "route_fork") {
      const waitX = segment.waitX ?? segment.endX;
      if (this.hero.stepRunning(waitX)) {
        this.hero.machine.force("route_vote");
        this.hero.animation = "point";
        this.routeVote.start(this.state.tick, TICKS.routeVote);
        this.addEvent("CHAT-VOTE // links rechts 1 2");
      }
      return;
    }

    const progress = this.obstacles.get(segment);
    if (progress.resolved) {
      this.hero.y = segment.groundY;
      if (this.hero.stepRunning(segment.endX)) this.completeCurrentSegment();
      return;
    }

    const waitX = segment.waitX ?? segment.startX;
    if (waitX - this.hero.x <= 110 && this.hero.state === "running") this.hero.approach();
    if (this.hero.stepRunning(waitX)) this.hero.block();
  }

  private completeCurrentSegment(): void {
    const completed = this.director.current;
    this.director.completeCurrent();
    if (completed.checkpointAfter) {
      this.checkpoints.save(this.director, this.obstacles, this.hero, this.state.remainingTicks);
      this.state.checkpointCount = this.checkpoints.reached;
      this.hero.machine.force("checkpoint");
      this.hero.animation = "celebrate";
      this.checkpointUntilTick = this.state.tick + CHECKPOINT_TICKS;
      this.addEvent(`CHECKPOINT ${this.checkpoints.reached}`);
      return;
    }
    this.hero.startRunning();
  }

  private revealBuiltParts(): void {
    if (this.state.tick - this.lastRevealTick < 12) return;
    if (this.obstacles.revealNextPart(this.director.current)) {
      this.lastRevealTick = this.state.tick;
    }
  }

  private revealAllBuiltParts(): void {
    while (this.obstacles.revealNextPart(this.director.current)) {
      // Deterministic catch-up if a frame or duration boundary coincides.
    }
  }

  private startBomb(actor: ViewerIdentity, transactionId: string): void {
    const bomb = this.state.tsarBomb;
    if (this.processedBombTransactions.has(transactionId)) return;
    this.processedBombTransactions.add(transactionId);
    if (this.state.roundStatus !== "running") return;
    if (this.state.safeMode) {
      this.addEvent("SAFE MODE // ZAR-BOMBE blockiert");
      return;
    }
    if (bomb.phase !== "idle" || this.state.tick < bomb.cooldownUntilTick) {
      this.addEvent("ABKLINGZEIT // ZAR-BOMBE nicht bereit");
      return;
    }
    if (
      this.hero.state === "intro" ||
      this.hero.state === "level_complete" ||
      this.hero.state === "success" ||
      this.hero.state === "failure"
    ) return;

    bomb.phase = "warning";
    bomb.actor = actor;
    bomb.transactionId = transactionId;
    bomb.startedTick = this.state.tick;
    bomb.impactTick = this.state.tick + TICKS.tsarWarning + TICKS.tsarDescent;
    bomb.recoveryUntilTick = bomb.impactTick + TICKS.rebuild;
    bomb.cooldownUntilTick = this.state.tick + TICKS.tsarCooldown;
    bomb.impactApplied = false;
    this.hero.beginBombWarning();
    this.addEvent(`${actor.displayName ?? actor.username} // ZAR-BOMBE`);
  }

  private updateBomb(): boolean {
    const bomb = this.state.tsarBomb;
    if (bomb.phase === "idle") return false;
    const descentTick = bomb.startedTick + TICKS.tsarWarning;
    if (this.state.tick < descentTick) {
      bomb.phase = "warning";
      return true;
    }
    if (this.state.tick < bomb.impactTick) {
      bomb.phase = "descending";
      return true;
    }
    if (!bomb.impactApplied) {
      bomb.phase = "impact";
      bomb.impactApplied = true;
      this.obstacles.destroyTemporary(this.director.current);
      this.hero.beginBombImpact();
      this.addEvent("EINSCHLAG // TEAM REBUILD");
      return true;
    }
    if (this.state.tick < bomb.recoveryUntilTick) {
      bomb.phase = "recovery";
      return true;
    }

    const cooldownUntilTick = bomb.cooldownUntilTick;
    this.resetCampaignAfterBomb();
    this.state.tsarBomb.cooldownUntilTick = cooldownUntilTick;
    const resetBomb = this.state.tsarBomb;
    resetBomb.phase = "idle";
    resetBomb.actor = null;
    resetBomb.transactionId = null;
    resetBomb.impactApplied = false;
    this.addEvent("TEAM REBUILD // ZURUECK ZU LEVEL 1");
    return true;
  }

  private finishCurrentLevel(): void {
    if (this.state.levelCelebration.active) return;
    if (!this.state.completedLevelIds.includes(this.director.level.id)) {
      this.state.completedLevelIds.push(this.director.level.id);
    }
    this.state.levelCelebration = {
      active: true,
      style: this.director.level.celebration,
      startedTick: this.state.tick,
      endsTick: this.state.tick + TICKS.levelCelebration,
    };
    this.hero.celebrateLevel();
    this.addEvent(`LEVEL ${this.levelIndex + 1} GESCHAFFT // FEUERWERK`);
  }

  private updateLevelCelebration(): void {
    if (this.state.tick < this.state.levelCelebration.endsTick) return;
    this.state.levelCelebration.active = false;
    if (this.levelIndex >= this.levels.length - 1) {
      this.finishSuccess();
      return;
    }
    this.loadLevel(this.levelIndex + 1);
    this.addEvent(`LEVEL ${this.levelIndex + 1} // ${this.director.level.name}`);
  }

  private loadLevel(index: number): void {
    this.levelIndex = Math.max(0, Math.min(this.levels.length - 1, index));
    const level = this.levels[this.levelIndex]!;
    this.hero = new HeroController(level.startX, level.segments[0]?.groundY ?? WORLD_GROUND_Y);
    this.director = new LevelDirector(level);
    this.obstacles = new ObstacleController();
    this.checkpoints = new CheckpointSystem();
    this.routeVote.reset();
    this.checkpointUntilTick = -1;
    this.lastRevealTick = -1;
    this.fallResetPending = false;
    this.state.levelIndex = this.levelIndex;
    this.state.levelCount = this.levels.length;
    this.state.remainingTicks = ROUND_DURATION_TICKS;
    this.state.speechBubble = {
      visible: false,
      text: "",
      blockedSinceTick: null,
      lastShownUntilTick: null,
    };
    this.state.checkpointCount = 0;
    this.state.chosenRoute = null;
    this.state.levelCelebration = {
      active: false,
      style: level.celebration,
      startedTick: -1,
      endsTick: -1,
    };
    this.introUntilTick = this.state.tick + INTRO_TICKS;
    this.hero.startIntro();
  }

  private resetCampaignAfterBomb(): void {
    this.state.completedLevelIds = [];
    this.state.teamEnergy = 0;
    this.state.lastContributor = null;
    this.loadLevel(0);
  }

  private restoreCheckpoint(timePenaltyTicks: number): void {
    const snapshot = this.checkpoints.restore(this.director, this.obstacles, this.hero);
    if (snapshot) {
      this.state.remainingTicks = Math.max(
        0,
        snapshot.remainingTicks - timePenaltyTicks,
      );
    } else {
      this.hero.resetTo(this.director.level.startX, WORLD_GROUND_Y);
      this.director.setProgress(0, [], null);
      this.director.completeCurrent();
      this.state.remainingTicks = Math.max(0, this.state.remainingTicks - timePenaltyTicks);
    }
    this.hero.startRunning();
  }

  private finishSuccess(): void {
    this.state.roundStatus = "success";
    this.hero.celebrate();
    this.addEvent("GIPFEL ERREICHT // LEUCHTFEUER AKTIVIERT");
  }

  private finishFailure(): void {
    this.state.roundStatus = "failure";
    this.hero.fail();
    this.addEvent("ZEIT ABGELAUFEN // GIPFEL NICHT ERREICHT");
  }

  private syncState(): void {
    this.state.heroState = this.hero.state;
    this.updateSpeechBubble();
    this.state.segmentId = this.director.current.id;
    this.state.levelIndex = this.levelIndex;
    this.state.levelCount = this.levels.length;
    this.state.chosenRoute = this.director.chosenRoute;
    this.state.checkpointCount = this.checkpoints.reached;
  }

  private updateSpeechBubble(): void {
    const bubble = this.state.speechBubble;
    if (this.state.heroState !== "blocked") {
      bubble.blockedSinceTick = null;
      if (bubble.visible) {
        bubble.lastShownUntilTick = this.state.tick;
        bubble.visible = false;
      }
      return;
    }

    bubble.blockedSinceTick ??= this.state.tick;
    const delayElapsed =
      this.state.tick - bubble.blockedSinceTick >= TICKS.speechBubbleDelay;
    const cooldownElapsed =
      bubble.lastShownUntilTick === null ||
      this.state.tick - bubble.lastShownUntilTick >= TICKS.speechBubbleCooldown;
    if (delayElapsed && cooldownElapsed) {
      bubble.visible = true;
      bubble.text = "Help me, please!";
    }
  }

  private addEvent(message: string): void {
    this.state.eventFeed.unshift(message);
    this.state.eventFeed = this.state.eventFeed.slice(0, 8);
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

export type { AdventureAction, LevelSegment };
