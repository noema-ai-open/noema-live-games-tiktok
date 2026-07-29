import { describe, expect, it } from "vitest";
import { TICKS } from "../src/config/gameConfig";
import { Simulation } from "../src/simulation/Simulation";

function prepareCheckpointAtRavine(simulation: Simulation) {
  simulation.startRound();
  const gap = simulation.director.level.segments.find((item) => item.id === "gap-rose")!;
  simulation.obstacles.apply(gap, "jump");
  const index = simulation.director.level.segments.findIndex((item) => item.id === "ravine-main");
  const completed = ["station-intro", "valley-run", "gap-rose", "high-ledge", "route-fork"];
  simulation.director.setProgress(index, completed, "right");
  const ravine = simulation.director.current;
  simulation.hero.x = ravine.waitX!;
  simulation.hero.y = ravine.groundY;
  simulation.hero.block();
  simulation.checkpoints.save(
    simulation.director,
    simulation.obstacles,
    simulation.hero,
    simulation.state.remainingTicks,
  );
  return { gap, ravine, completed };
}

function finishBomb(simulation: Simulation): void {
  for (
    let index = 0;
    index < TICKS.tsarWarning + TICKS.tsarDescent + TICKS.rebuild + 8;
    index += 1
  ) {
    simulation.step();
  }
}

describe("ZAR-BOMBE reset", () => {
  it("destroys only current temporary parts and restores the checkpoint", () => {
    const simulation = new Simulation(7);
    const { gap, ravine, completed } = prepareCheckpointAtRavine(simulation);
    simulation.submit({ type: "repair_structure", amount: 3 });
    for (let index = 0; index < 40; index += 1) simulation.step();
    expect(simulation.obstacles.get(ravine).visibleParts).toBe(3);

    simulation.submit({ type: "tsar_bomb", transactionId: "galaxy-1" });
    simulation.step();
    expect(simulation.state.tsarBomb.phase).toBe("warning");
    finishBomb(simulation);

    expect(simulation.state.tsarBomb.phase).toBe("idle");
    expect(simulation.hero.x).toBe(ravine.waitX);
    expect(simulation.obstacles.get(ravine).visibleParts).toBe(0);
    expect(simulation.obstacles.get(gap).resolved).toBe(true);
    for (const id of completed) expect(simulation.director.completedSegments.has(id)).toBe(true);
  });

  it("processes a Galaxy transaction at most once", () => {
    const simulation = new Simulation(8);
    prepareCheckpointAtRavine(simulation);
    simulation.submit({ type: "tsar_bomb", transactionId: "same-transaction" });
    simulation.submit({ type: "tsar_bomb", transactionId: "same-transaction" });
    simulation.step();
    const startedAt = simulation.state.tsarBomb.startedTick;
    finishBomb(simulation);
    simulation.state.tick = simulation.state.tsarBomb.cooldownUntilTick;
    simulation.submit({ type: "tsar_bomb", transactionId: "same-transaction" });
    simulation.step();
    expect(simulation.state.tsarBomb.phase).toBe("idle");
    expect(simulation.state.tsarBomb.startedTick).toBe(startedAt);
  });

  it("blocks Galaxy in Safe Mode", () => {
    const simulation = new Simulation(9);
    prepareCheckpointAtRavine(simulation);
    simulation.submit({ type: "set_safe_mode", enabled: true });
    simulation.step();
    simulation.submit({ type: "tsar_bomb", transactionId: "safe" });
    simulation.step();
    expect(simulation.state.tsarBomb.phase).toBe("idle");
  });
});
