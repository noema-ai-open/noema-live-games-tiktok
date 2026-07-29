export type HeroGameState =
  | "boot"
  | "intro"
  | "running"
  | "approaching_obstacle"
  | "blocked"
  | "route_vote"
  | "performing_action"
  | "jumping"
  | "climbing"
  | "falling"
  | "helper_active"
  | "checkpoint"
  | "level_complete"
  | "bomb_warning"
  | "bomb_impact"
  | "resetting"
  | "success"
  | "failure"
  | "paused";

const transitions: Readonly<Record<HeroGameState, readonly HeroGameState[]>> = {
  boot: ["intro"],
  intro: ["running", "paused"],
  running: [
    "approaching_obstacle",
    "route_vote",
    "falling",
    "checkpoint",
    "level_complete",
    "success",
    "failure",
    "bomb_warning",
    "paused",
  ],
  approaching_obstacle: ["blocked", "route_vote", "running", "bomb_warning", "paused"],
  blocked: ["performing_action", "jumping", "helper_active", "falling", "bomb_warning", "paused"],
  route_vote: ["running", "bomb_warning", "paused"],
  performing_action: ["blocked", "climbing", "running", "bomb_warning", "paused"],
  jumping: ["running", "falling", "bomb_warning", "paused"],
  climbing: ["running", "falling", "bomb_warning", "paused"],
  falling: ["helper_active", "resetting", "bomb_warning", "paused"],
  helper_active: ["running", "resetting", "bomb_warning", "paused"],
  checkpoint: ["running", "bomb_warning", "paused"],
  level_complete: ["intro", "success", "bomb_warning", "paused"],
  bomb_warning: ["bomb_impact"],
  bomb_impact: ["resetting"],
  resetting: ["running", "blocked"],
  success: ["intro"],
  failure: ["intro"],
  paused: [
    "running",
    "blocked",
    "route_vote",
    "performing_action",
    "jumping",
    "climbing",
    "falling",
    "helper_active",
    "checkpoint",
    "level_complete",
  ],
};

export class HeroStateMachine {
  state: HeroGameState = "boot";
  private beforePause: HeroGameState = "running";

  canEnter(next: HeroGameState): boolean {
    return next === this.state || transitions[this.state].includes(next);
  }

  enter(next: HeroGameState): boolean {
    if (next === this.state || !this.canEnter(next)) return false;
    if (next === "paused") this.beforePause = this.state;
    this.state = next;
    return true;
  }

  resume(): boolean {
    if (this.state !== "paused") return false;
    this.state = this.beforePause === "paused" ? "running" : this.beforePause;
    return true;
  }

  force(next: HeroGameState): void {
    this.state = next;
  }
}
