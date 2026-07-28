import Phaser from "phaser";
import { FIXED_STEP_MS } from "../config/gameConfig";
import { EffectLayer } from "../render/EffectLayer";
import { LevelRenderer } from "../render/LevelRenderer";
import { TsarBombRenderer } from "../render/TsarBombRenderer";
import { WorkerSprite } from "../render/WorkerSprite";
import { WorldRenderer } from "../render/WorldRenderer";
import { ensureTextures } from "../render/textures";
import type { Simulation } from "../simulation/Simulation";
import type { RoundStatus, TsarPhase, Walker } from "../simulation/types";
import type { AudioSystem } from "../systems/AudioSystem";
import type { LiveSession } from "../systems/LiveSession";

/**
 * Weltszene: Simulationstakt und Darstellung. Sie liest den Simulationsstand
 * und schreibt nie hinein, und sie bekommt niemals Connector-Daten zu sehen.
 */
export class AscentScene extends Phaser.Scene {
  private accumulator = 0;
  private workerViews = new Map<number, WorkerSprite>();
  private world!: WorldRenderer;
  private levelRenderer!: LevelRenderer;
  private effects!: EffectLayer;
  private tsar!: TsarBombRenderer;

  private lastTsarPhase: TsarPhase = "idle";
  private lastStatus: RoundStatus = "ready";
  private lastRescued = 0;
  private lastLost = 0;
  private lastOpenLinks = 0;
  private workerStates = new Map<number, Walker["state"]>();
  private workerFloors = new Map<number, number>();

  constructor(
    private readonly simulation: Simulation,
    private readonly audio: AudioSystem,
    private readonly live?: LiveSession,
  ) {
    super({ key: "AscentScene" });
  }

  create(): void {
    ensureTextures(this);
    this.cameras.main.setBackgroundColor("#03080f");

    this.world = new WorldRenderer(this);
    this.levelRenderer = new LevelRenderer(this);
    this.effects = new EffectLayer(this);
    this.tsar = new TsarBombRenderer(this, this.effects);

    this.syncWorkerViews();
    this.lastOpenLinks = this.countOpenLinks();
  }

  update(_time: number, delta: number): void {
    // Live-Ereignisse werden vor den festen Schritten zu Befehlen.
    this.live?.dispatch();

    this.accumulator = Math.min(250, this.accumulator + delta);
    while (this.accumulator >= FIXED_STEP_MS) {
      this.simulation.step();
      this.accumulator -= FIXED_STEP_MS;
    }
    this.render();
  }

  private render(): void {
    const state = this.simulation.state;
    const tick = state.tick;
    const reducedMotion = state.reducedMotion;
    const alarm =
      state.tsarBomb.phase === "warning" ||
      state.tsarBomb.phase === "descending";

    this.syncWorkerViews();

    for (const worker of this.simulation.workers) {
      this.workerViews.get(worker.id)?.update(worker, tick, {
        reducedMotion,
        alarm,
      });
      this.trackWorkerTransitions(worker);
    }

    this.world.setParallax(this.simulation.getAscentProgress() * 40);
    this.world.update(tick, reducedMotion);
    this.levelRenderer.update(this.simulation.level.renderState(tick), tick, reducedMotion);
    this.effects.updateEnvironment(state.environmentMode, tick, reducedMotion);
    this.tsar.update(state);

    this.trackLevelEvents();
    this.trackRoundEvents();
  }

  private syncWorkerViews(): void {
    const alive = new Set<number>();
    for (const worker of this.simulation.workers) {
      alive.add(worker.id);
      if (!this.workerViews.has(worker.id)) {
        this.workerViews.set(worker.id, new WorkerSprite(this, worker));
      }
    }
    // Ein Reset ersetzt die Roboterliste; verwaiste Figuren entfernen.
    for (const [id, view] of this.workerViews) {
      if (alive.has(id)) continue;
      view.destroy();
      this.workerViews.delete(id);
    }
  }

  private trackWorkerTransitions(worker: Walker): void {
    const floor = this.workerFloors.get(worker.id) ?? 0;
    if (worker.highestFloor > floor) {
      this.workerFloors.set(worker.id, worker.highestFloor);
      this.effects.burstRepair(worker.x, worker.y - 8, 4);
    }

    const previous = this.workerStates.get(worker.id);
    if (previous === worker.state) return;
    this.workerStates.set(worker.id, worker.state);
    if (previous === undefined) return;

    if (worker.state === "traversing") {
      this.effects.burstSparks(worker.x, worker.y + 10, 4);
    }
    if (worker.state === "riding") {
      this.audio.play("lift");
    }
    if (worker.state === "falling") {
      this.effects.burstSmoke(worker.x, worker.y, 2);
    }
    if (previous === "falling" && worker.state === "walking") {
      this.effects.burstRescue(worker.x, worker.y, 8);
    }
    if (worker.state === "rescued") {
      this.effects.burstRescue(worker.x, worker.y, 12);
    }
  }

  private trackLevelEvents(): void {
    const open = this.countOpenLinks();
    if (open > this.lastOpenLinks) {
      this.audio.play("bridge");
    } else if (open < this.lastOpenLinks) {
      // Ein Übergang ist zerstört worden.
      this.effects.earthquakeDebris();
      this.audio.play("earthquake");
      const shake = this.simulation.state.reducedMotion ? 0.0015 : 0.006;
      this.cameras.main.shake(this.simulation.state.reducedMotion ? 120 : 360, shake);
    }
    this.lastOpenLinks = open;
  }

  private countOpenLinks(): number {
    const tick = this.simulation.state.tick;
    return this.simulation.level.renderState(tick).links.filter(
      (link) => link.open && link.buildRequired > 0,
    ).length;
  }

  private trackRoundEvents(): void {
    const state = this.simulation.state;

    if (state.rescuedCount > this.lastRescued) this.audio.play("rescue");
    if (state.lostCount > this.lastLost) this.audio.play("failure");

    if (state.tsarBomb.phase !== this.lastTsarPhase) {
      if (state.tsarBomb.phase === "warning") this.audio.play("warning");
      if (state.tsarBomb.phase === "descending") this.audio.play("countdown");
      if (state.tsarBomb.phase === "impact") this.audio.play("explosion");
      if (state.tsarBomb.phase === "recovery") this.audio.play("rebuild");
    }

    if (state.roundStatus !== this.lastStatus) {
      if (state.roundStatus === "success") this.audio.play("success");
      if (state.roundStatus === "failure") this.audio.play("failure");
    }

    this.lastRescued = state.rescuedCount;
    this.lastLost = state.lostCount;
    this.lastTsarPhase = state.tsarBomb.phase;
    this.lastStatus = state.roundStatus;
  }
}
