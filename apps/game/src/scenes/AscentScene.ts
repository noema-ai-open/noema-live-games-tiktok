import Phaser from "phaser";
import { FIXED_STEP_MS } from "../config/gameConfig";
import { EffectLayer } from "../render/EffectLayer";
import { StructureViews } from "../render/StructureViews";
import { TsarBombRenderer } from "../render/TsarBombRenderer";
import { WorkerSprite } from "../render/WorkerSprite";
import { WorldRenderer } from "../render/WorldRenderer";
import { ensureTextures } from "../render/textures";
import type { Simulation } from "../simulation/Simulation";
import type { RoundStatus, TsarPhase, Worker } from "../simulation/types";
import type { AudioSystem } from "../systems/AudioSystem";
import type { LiveSession } from "../systems/LiveSession";

/**
 * World scene: simulation stepping plus rendering. It reads simulation state
 * and never writes to it, and it never receives connector payloads directly.
 */
export class AscentScene extends Phaser.Scene {
  private accumulator = 0;
  private workerViews = new Map<number, WorkerSprite>();
  private world!: WorldRenderer;
  private structures!: StructureViews;
  private effects!: EffectLayer;
  private tsar!: TsarBombRenderer;

  private lastTsarPhase: TsarPhase = "idle";
  private lastStatus: RoundStatus = "ready";
  private lastRescued = 0;
  private lastLost = 0;
  private lastBridgeOnline = false;
  private lastJumpActive = false;
  private lastShieldActive = false;
  private lastIntactCount = 0;
  private workerStates = new Map<number, Worker["state"]>();
  private workerCheckpoints = new Map<number, number>();

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
    this.effects = new EffectLayer(this);
    this.structures = new StructureViews(this);
    this.tsar = new TsarBombRenderer(this, this.effects);

    this.syncWorkerViews();
    this.lastIntactCount = this.intactCount();
  }

  update(_time: number, delta: number): void {
    // Live events are converted to ordered commands before the fixed steps.
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
      state.tsarBomb.phase === "warning" || state.tsarBomb.phase === "descending";

    this.syncWorkerViews();

    let progressSum = 0;
    for (const worker of this.simulation.workers) {
      this.workerViews.get(worker.id)?.update(worker, tick, {
        reducedMotion,
        alarm,
      });
      progressSum += worker.state === "rescued" ? 1 : worker.progress;
      this.trackWorkerTransitions(worker);
    }

    this.world.setParallax(
      (progressSum / Math.max(1, this.simulation.workers.length)) * 40,
    );
    this.world.update(tick, reducedMotion);
    this.structures.update(state, tick, reducedMotion);
    this.effects.updateEnvironment(state.environmentMode, tick, reducedMotion);
    this.tsar.update(state);

    this.trackStructureEvents();
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
    // A reset replaces the worker list; drop views that no longer belong.
    for (const [id, view] of this.workerViews) {
      if (alive.has(id)) continue;
      view.destroy();
      this.workerViews.delete(id);
    }
  }

  private trackWorkerTransitions(worker: Worker): void {
    const lastCheckpoint = this.workerCheckpoints.get(worker.id) ?? 0;
    if (worker.lastCheckpoint > lastCheckpoint) {
      this.workerCheckpoints.set(worker.id, worker.lastCheckpoint);
      this.effects.burstRepair(worker.x, worker.y - 8, 6);
      this.audio.play("checkpoint");
    } else if (worker.lastCheckpoint < lastCheckpoint) {
      // Round reset or a fall back to an earlier checkpoint.
      this.workerCheckpoints.set(worker.id, worker.lastCheckpoint);
    }

    const previous = this.workerStates.get(worker.id);
    if (previous === worker.state) return;
    this.workerStates.set(worker.id, worker.state);
    if (previous === undefined) return;

    if (worker.state === "jumping") {
      this.effects.burstSparks(worker.x, worker.y + 12, 5);
      this.structures.playJumpPulse();
      this.audio.play("jump");
    }
    if (worker.state === "falling") {
      this.effects.burstSmoke(worker.x, worker.y, 2);
    }
    if (previous === "falling" && worker.state === "walking") {
      this.effects.burstRescue(worker.x, worker.y, 10);
    }
    if (worker.state === "protected") {
      this.effects.burstRepair(worker.x, worker.y - 6, 4);
    }
  }

  private trackStructureEvents(): void {
    const state = this.simulation.state;

    const bridgeOnline =
      state.structures.find((item) => item.id === "bridge-alpha")?.intact ===
      true;
    if (bridgeOnline && !this.lastBridgeOnline) {
      this.structures.playBridgeBuild();
      this.audio.play("bridge");
    }
    this.lastBridgeOnline = bridgeOnline;

    const jumpActive = state.jumpFieldUntilTick > state.tick;
    if (jumpActive && !this.lastJumpActive) this.audio.play("jump");
    this.lastJumpActive = jumpActive;

    const shieldActive = state.shieldUntilTick > state.tick;
    if (shieldActive && !this.lastShieldActive) {
      this.audio.play("shield");
      this.effects.burstRepair(360, 700, 20);
    }
    this.lastShieldActive = shieldActive;

    // A structure that went from intact to broken means visible destruction.
    const intact = this.intactCount();
    if (intact < this.lastIntactCount) {
      this.effects.earthquakeDebris();
      this.audio.play("earthquake");
      if (!state.reducedMotion) this.cameras.main.shake(360, 0.006);
      else this.cameras.main.shake(120, 0.0015);
    }
    this.lastIntactCount = intact;
  }

  private trackRoundEvents(): void {
    const state = this.simulation.state;

    if (state.rescuedCount > this.lastRescued) {
      this.audio.play("rescue");
      this.effects.burstRescue(360, 150, 14);
    }
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

  private intactCount(): number {
    return this.simulation.state.structures.filter((item) => item.intact).length;
  }
}
