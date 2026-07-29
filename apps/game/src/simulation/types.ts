import type { OrderedGameCommand, ViewerIdentity } from "@noema/event-protocol";
import type { HeroGameState } from "../adventure/HeroStateMachine";
import type { RouteChoice } from "../adventure/levelTypes";
import type { LevelCelebrationStyle } from "../adventure/levelTypes";

export type RoundStatus = "ready" | "running" | "paused" | "success" | "failure";
export type TsarPhase = "idle" | "warning" | "descending" | "impact" | "recovery";

export type TsarBombState = {
  phase: TsarPhase;
  actor: ViewerIdentity | null;
  transactionId: string | null;
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
  heroState: HeroGameState;
  segmentId: string;
  levelIndex: number;
  levelCount: number;
  completedLevelIds: string[];
  levelCelebration: {
    active: boolean;
    style: LevelCelebrationStyle;
    startedTick: number;
    endsTick: number;
  };
  teamEnergy: number;
  checkpointCount: number;
  safeMode: boolean;
  reducedMotion: boolean;
  chosenRoute: RouteChoice | null;
  lastContributor: ViewerIdentity | null;
  tsarBomb: TsarBombState;
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
