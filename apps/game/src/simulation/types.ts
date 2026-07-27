import type { OrderedGameCommand, ViewerIdentity } from "@noema/event-protocol";

export type WorkerState =
  | "spawning"
  | "walking"
  | "falling"
  | "jumping"
  | "blocked"
  | "protected"
  | "rescued"
  | "lost";

export type RouteKind = "safe" | "risky";
export type RoundStatus = "ready" | "running" | "paused" | "success" | "failure";
export type TsarPhase = "idle" | "warning" | "descending" | "impact" | "recovery";

export type Worker = {
  id: number;
  state: WorkerState;
  route: RouteKind;
  x: number;
  y: number;
  progress: number;
  speed: number;
  direction: -1 | 1;
  spawnTick: number;
  velocityY: number;
  stateUntilTick: number;
  protectedUntilTick: number;
  lastCheckpoint: 0 | 1 | 2;
  lastHazardCycle: number;
  lateralOffset: number;
};

export type TemporaryStructure = {
  id: string;
  kind: "bridge" | "route" | "jump-field" | "blocker";
  intact: boolean;
  health: number;
  temporary: true;
};

export type TsarBombState = {
  phase: TsarPhase;
  actor: ViewerIdentity | null;
  startedTick: number;
  impactTick: number;
  recoveryUntilTick: number;
  cooldownUntilTick: number;
  impactApplied: boolean;
};

export type SimulationState = {
  seed: number;
  tick: number;
  remainingTicks: number;
  roundStatus: RoundStatus;
  teamEnergy: number;
  rescuedCount: number;
  lostCount: number;
  safeMode: boolean;
  reducedMotion: boolean;
  liftActiveUntilTick: number;
  shieldUntilTick: number;
  blockerUntilTick: number;
  jumpFieldUntilTick: number;
  environmentUntilTick: number;
  environmentMode: "none" | "wind" | "low_gravity";
  recoveryMultiplier: number;
  tsarBomb: TsarBombState;
  structures: TemporaryStructure[];
  eventFeed: string[];
};

export type RoundResult = {
  seed: number;
  tick: number;
  status: RoundStatus;
  rescued: number;
  lost: number;
  active: number;
  hash: string;
};

export type ReplayData = {
  formatVersion: 1;
  levelVersion: string;
  seed: number;
  endTick: number;
  commands: OrderedGameCommand[];
  expectedResult: RoundResult;
};
