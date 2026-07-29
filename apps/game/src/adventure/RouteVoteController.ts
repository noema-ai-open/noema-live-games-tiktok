import type { RouteChoice } from "./levelTypes";

export type RouteVoteSnapshot = {
  active: boolean;
  startedTick: number;
  endsTick: number;
  left: number;
  right: number;
  winner: RouteChoice | null;
};

export class RouteVoteController {
  private eventIds = new Set<string>();
  private voterIds = new Set<string>();
  private snapshot: RouteVoteSnapshot = {
    active: false,
    startedTick: -1,
    endsTick: -1,
    left: 0,
    right: 0,
    winner: null,
  };

  start(tick: number, durationTicks: number): void {
    this.eventIds.clear();
    this.voterIds.clear();
    this.snapshot = {
      active: true,
      startedTick: tick,
      endsTick: tick + durationTicks,
      left: 0,
      right: 0,
      winner: null,
    };
  }

  vote(eventId: string, voterId: string, choice: RouteChoice, tick: number): boolean {
    if (!this.snapshot.active || tick >= this.snapshot.endsTick) return false;
    if (this.eventIds.has(eventId) || this.voterIds.has(voterId)) return false;
    this.eventIds.add(eventId);
    this.voterIds.add(voterId);
    this.snapshot[choice] += 1;
    return true;
  }

  finish(tick: number): RouteChoice | null {
    if (!this.snapshot.active || tick < this.snapshot.endsTick) return null;
    this.snapshot.active = false;
    this.snapshot.winner = this.snapshot.left > this.snapshot.right ? "left" : "right";
    return this.snapshot.winner;
  }

  reset(): void {
    this.eventIds.clear();
    this.voterIds.clear();
    this.snapshot = {
      active: false,
      startedTick: -1,
      endsTick: -1,
      left: 0,
      right: 0,
      winner: null,
    };
  }

  get state(): RouteVoteSnapshot {
    return { ...this.snapshot };
  }
}
