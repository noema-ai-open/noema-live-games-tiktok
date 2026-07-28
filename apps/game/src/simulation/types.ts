import type { OrderedGameCommand, ViewerIdentity } from "@noema/event-protocol";
import type { Walker, WalkerState } from "./walker";

export type { Walker, WalkerState };
/** Alte Namen, damit bestehende Aufrufer lesbar bleiben. */
export type Worker = Walker;
export type WorkerState = WalkerState;

export type RoundStatus = "ready" | "running" | "paused" | "success" | "failure";
export type TsarPhase = "idle" | "warning" | "descending" | "impact" | "recovery";

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
  /** Laedt sich durch Likes, Follows und Shares und schaltet dann selbst frei. */
  teamEnergy: number;
  rescuedCount: number;
  lostCount: number;
  safeMode: boolean;
  reducedMotion: boolean;
  /** Solange gesetzt, faehrt der Lift doppelt so schnell. */
  liftOverdriveUntilTick: number;
  shieldUntilTick: number;
  environmentUntilTick: number;
  environmentMode: "none" | "wind" | "low_gravity";
  recoveryMultiplier: number;
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
