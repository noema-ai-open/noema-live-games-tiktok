import Phaser from "phaser";
import { FIXED_STEP_MS, LOGICAL_HEIGHT, LOGICAL_WIDTH } from "../config/gameConfig";
import type { Simulation } from "../simulation/Simulation";
import type { RoundStatus, TsarPhase } from "../simulation/types";
import type { AudioSystem } from "../systems/AudioSystem";
import type { LiveSession } from "../systems/LiveSession";
import { EnvironmentRenderer } from "./EnvironmentRenderer";
import { HeroView } from "./HeroView";
import { LevelCelebrationRenderer } from "./LevelCelebrationRenderer";
import { ObstacleView } from "./ObstacleView";
import { TsarBombRenderer } from "./TsarBombRenderer";

export class AdventureScene extends Phaser.Scene {
  private accumulator = 0;
  private environment!: EnvironmentRenderer;
  private heroView!: HeroView;
  private obstacleView!: ObstacleView;
  private bombView!: TsarBombRenderer;
  private celebrationView!: LevelCelebrationRenderer;
  private lastAnimation = "";
  private lastParts = 0;
  private lastCheckpoint = 0;
  private lastTsarPhase: TsarPhase = "idle";
  private lastStatus: RoundStatus = "ready";
  private lastHeroState = "boot";
  private renderedLevelId = "";
  private levelCelebrationWasActive = false;

  constructor(
    private readonly simulation: Simulation,
    private readonly audio: AudioSystem,
    private readonly live?: LiveSession,
  ) {
    super({ key: "AdventureScene" });
  }

  create(): void {
    const level = this.simulation.director.level;
    this.renderedLevelId = level.id;
    this.cameras.main.setBackgroundColor("#07111f");
    this.cameras.main.setBounds(0, 0, level.finishX + 300, LOGICAL_HEIGHT);
    this.environment = new EnvironmentRenderer(this, level);
    this.obstacleView = new ObstacleView(this, this.simulation);
    this.heroView = new HeroView(this);
    this.bombView = new TsarBombRenderer(this);
    this.celebrationView = new LevelCelebrationRenderer(this);
  }

  update(_time: number, delta: number): void {
    this.live?.dispatch();
    this.accumulator = Math.min(250, this.accumulator + delta);
    while (this.accumulator >= FIXED_STEP_MS) {
      this.simulation.step();
      this.accumulator -= FIXED_STEP_MS;
    }
    this.renderAdventure();
  }

  private renderAdventure(): void {
    if (this.renderedLevelId !== this.simulation.director.level.id) {
      this.scene.restart();
      return;
    }
    const state = this.simulation.state;
    const hero = this.simulation.hero.snapshot();
    this.heroView.update(hero, state.tick, state.reducedMotion);
    this.obstacleView.update();
    this.environment.update(this.cameras.main.scrollX, state.tick, state.reducedMotion);
    this.bombView.update(state);
    this.celebrationView.update(state);
    this.updateCamera();
    this.trackAudio();
  }

  private updateCamera(): void {
    const state = this.simulation.state;
    const segment = this.simulation.director.current;
    const wide =
      segment.camera === "wide" ||
      state.heroState === "performing_action" ||
      state.tsarBomb.phase !== "idle";
    const targetZoom = wide ? 0.82 : 0.92;
    this.cameras.main.zoom = Phaser.Math.Linear(
      this.cameras.main.zoom,
      targetZoom,
      state.reducedMotion ? 0.35 : 0.06,
    );

    const focusX =
      state.heroState === "blocked" || state.heroState === "performing_action"
        ? (segment.waitX ?? this.simulation.hero.x) + 170
        : this.simulation.hero.x + 260;
    const maxScroll = Math.max(0, this.simulation.director.level.finishX + 300 - LOGICAL_WIDTH);
    const desired = Phaser.Math.Clamp(focusX - LOGICAL_WIDTH * 0.42, 0, maxScroll);
    this.cameras.main.scrollX = Phaser.Math.Linear(
      this.cameras.main.scrollX,
      desired,
      state.reducedMotion ? 0.4 : 0.08,
    );
  }

  private trackAudio(): void {
    const state = this.simulation.state;
    const animation = this.simulation.hero.animation;
    if (state.heroState === "running" && state.tick % 12 === 0) {
      this.audio.play("footsteps");
    }
    if (state.heroState === "route_vote" && this.lastHeroState !== "route_vote") {
      this.audio.play("route_vote");
    }
    if (this.lastHeroState === "helper_active" && state.heroState === "running") {
      this.audio.play("repair");
    }
    if (animation !== this.lastAnimation) {
      if (animation === "jump") this.audio.play("jump");
      if (animation === "land") this.audio.play("land");
      if (state.heroState === "helper_active") this.audio.play("helper_arrive");
      this.lastAnimation = animation;
    }

    const currentParts = Object.values(this.simulation.obstacles.export()).reduce(
      (sum, progress) => sum + progress.visibleParts,
      0,
    );
    if (currentParts > this.lastParts) {
      this.audio.play(
        this.simulation.director.current.type === "ravine"
          ? "bridge_segment"
          : "build_block",
      );
    }
    this.lastParts = currentParts;

    if (state.checkpointCount > this.lastCheckpoint) this.audio.play("checkpoint");
    this.lastCheckpoint = state.checkpointCount;

    if (state.tsarBomb.phase !== this.lastTsarPhase) {
      if (state.tsarBomb.phase === "warning") this.audio.play("bomb_warning");
      if (state.tsarBomb.phase === "impact") this.audio.play("bomb_impact");
      if (state.tsarBomb.phase === "recovery") this.audio.play("rebuild");
      this.lastTsarPhase = state.tsarBomb.phase;
    }

    if (state.levelCelebration.active && !this.levelCelebrationWasActive) {
      this.audio.play("fireworks");
    }
    this.levelCelebrationWasActive = state.levelCelebration.active;

    if (state.roundStatus !== this.lastStatus) {
      if (state.roundStatus === "success") this.audio.play("success");
      if (state.roundStatus === "failure") this.audio.play("failure");
      this.lastStatus = state.roundStatus;
    }
    this.lastHeroState = state.heroState;
  }
}
