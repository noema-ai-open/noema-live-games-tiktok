import { FIXED_HZ, WORLD_GROUND_Y } from "../config/gameConfig";
import { HeroStateMachine, type HeroGameState } from "./HeroStateMachine";

export type HeroAnimation =
  | "idle"
  | "run"
  | "wait"
  | "point"
  | "jump"
  | "fall"
  | "land"
  | "climb"
  | "push"
  | "celebrate"
  | "scared"
  | "bomb_reaction";

export type HeroSnapshot = {
  x: number;
  y: number;
  state: HeroGameState;
  animation: HeroAnimation;
  facing: 1 | -1;
  actionProgress: number;
};

export class HeroController {
  readonly machine = new HeroStateMachine();
  x: number;
  y: number;
  facing: 1 | -1 = 1;
  animation: HeroAnimation = "idle";
  actionProgress = 0;
  runSpeed = 4.1;

  private actionStartX = 0;
  private actionStartY = 0;
  private actionTargetX = 0;
  private actionTargetY = 0;
  private actionTicks = 0;
  private actionDuration = 1;

  constructor(x = 120, y = WORLD_GROUND_Y) {
    this.x = x;
    this.y = y;
  }

  get state(): HeroGameState {
    return this.machine.state;
  }

  startIntro(): void {
    this.machine.force("intro");
    this.animation = "point";
  }

  startRunning(): void {
    this.machine.force("running");
    this.animation = "run";
    this.actionProgress = 0;
  }

  approach(): void {
    if (this.machine.enter("approaching_obstacle")) this.animation = "scared";
  }

  block(): void {
    this.machine.force("blocked");
    this.animation = "point";
    this.actionProgress = 0;
  }

  beginJump(targetX: number, targetY: number): boolean {
    if (this.state !== "blocked") return false;
    this.machine.force("jumping");
    this.animation = "jump";
    this.beginMotion(targetX, targetY, Math.round(FIXED_HZ * 0.8));
    return true;
  }

  beginClimb(targetX: number, targetY: number): boolean {
    if (this.state !== "blocked" && this.state !== "performing_action") return false;
    this.machine.force("climbing");
    this.animation = "climb";
    this.beginMotion(targetX, targetY, Math.round(FIXED_HZ * 1.25));
    return true;
  }

  beginHelper(durationTicks = FIXED_HZ * 2): boolean {
    if (this.state !== "blocked" && this.state !== "falling") return false;
    this.machine.force("helper_active");
    this.animation = "wait";
    this.actionTicks = 0;
    this.actionDuration = durationTicks;
    this.actionProgress = 0;
    return true;
  }

  beginBuild(durationTicks: number): boolean {
    if (this.state !== "blocked" && this.state !== "performing_action") return false;
    this.machine.force("performing_action");
    this.animation = "wait";
    this.actionTicks = 0;
    this.actionDuration = Math.max(1, durationTicks);
    this.actionProgress = 0;
    return true;
  }

  beginFall(): boolean {
    if (!["running", "blocked", "jumping", "climbing"].includes(this.state)) return false;
    this.machine.force("falling");
    this.animation = "fall";
    this.actionTicks = 0;
    this.actionDuration = FIXED_HZ * 2;
    this.actionProgress = 0;
    return true;
  }

  beginBombWarning(): void {
    this.machine.force("bomb_warning");
    this.animation = "bomb_reaction";
  }

  beginBombImpact(): void {
    this.machine.force("bomb_impact");
    this.animation = "fall";
  }

  resetTo(x: number, y: number): void {
    this.machine.force("resetting");
    this.x = x;
    this.y = y;
    this.animation = "land";
    this.actionProgress = 0;
  }

  celebrate(): void {
    this.machine.force("success");
    this.animation = "celebrate";
  }

  fail(): void {
    this.machine.force("failure");
    this.animation = "scared";
  }

  pause(): boolean {
    return this.machine.enter("paused");
  }

  resume(): boolean {
    const resumed = this.machine.resume();
    if (resumed) this.animation = this.state === "running" ? "run" : "wait";
    return resumed;
  }

  stepRunning(stopX?: number): boolean {
    if (this.state !== "running" && this.state !== "approaching_obstacle") return false;
    const limit = stopX ?? Number.POSITIVE_INFINITY;
    this.x = Math.min(limit, this.x + this.runSpeed);
    this.animation = "run";
    if (this.x >= limit) {
      this.x = limit;
      return true;
    }
    return false;
  }

  stepAction(): boolean {
    if (!["jumping", "climbing", "performing_action", "helper_active", "falling"].includes(this.state)) {
      return false;
    }
    this.actionTicks += 1;
    this.actionProgress = Math.min(1, this.actionTicks / this.actionDuration);

    if (this.state === "jumping" || this.state === "climbing") {
      const t = this.ease(this.actionProgress);
      this.x = this.actionStartX + (this.actionTargetX - this.actionStartX) * t;
      this.y = this.actionStartY + (this.actionTargetY - this.actionStartY) * t;
      if (this.state === "jumping") this.y -= Math.sin(Math.PI * t) * 125;
    } else if (this.state === "falling") {
      this.y += 8 + this.actionProgress * 16;
    }

    return this.actionProgress >= 1;
  }

  snapshot(): HeroSnapshot {
    return {
      x: this.x,
      y: this.y,
      state: this.state,
      animation: this.animation,
      facing: this.facing,
      actionProgress: this.actionProgress,
    };
  }

  private beginMotion(targetX: number, targetY: number, durationTicks: number): void {
    this.actionStartX = this.x;
    this.actionStartY = this.y;
    this.actionTargetX = targetX;
    this.actionTargetY = targetY;
    this.actionTicks = 0;
    this.actionDuration = Math.max(1, durationTicks);
    this.actionProgress = 0;
  }

  private ease(value: number): number {
    return value < 0.5
      ? 2 * value * value
      : 1 - Math.pow(-2 * value + 2, 2) / 2;
  }
}
