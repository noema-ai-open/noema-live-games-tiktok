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

function driveToLevel(simulation: Simulation, targetLevel: number): void {
  let vote = 0;
  for (let index = 0; index < 20_000 && simulation.state.levelIndex < targetLevel; index += 1) {
    if (simulation.state.heroState === "blocked") {
      const type = simulation.director.current.type;
      if (type === "small_gap") {
        simulation.submit({ type: "place_jump_field", zoneId: "current", durationTicks: 24 });
      } else if (type === "high_ledge") {
        simulation.submit({ type: "repair_structure", amount: 3 });
      } else if (type === "broken_bridge" || type === "ravine") {
        simulation.submit({ type: "build_bridge", zoneId: "current" });
      } else if (type === "repair_gate") {
        simulation.submit({ type: "rescue_worker" });
      }
    }
    if (simulation.state.heroState === "route_vote" && simulation.routeVote.state.left === 0) {
      simulation.submit({ type: "route_vote", eventId: `campaign-vote-${vote++}`, choice: "left" });
    }
    simulation.step();
  }
  expect(simulation.state.levelIndex).toBe(targetLevel);
}

describe("ZAR-BOMBE reset", () => {
  it("resets the complete campaign from level 3 to a fresh level 1", () => {
    const simulation = new Simulation(7);
    simulation.startRound();
    driveToLevel(simulation, 2);
    expect(simulation.state.completedLevelIds).toHaveLength(2);
    for (let index = 0; index < TICKS.second * 3; index += 1) simulation.step();

    simulation.submit({ type: "tsar_bomb", transactionId: "galaxy-1" });
    simulation.step();
    expect(simulation.state.tsarBomb.phase).toBe("warning");
    finishBomb(simulation);

    expect(simulation.state.tsarBomb.phase).toBe("idle");
    expect(simulation.state.levelIndex).toBe(0);
    expect(simulation.director.level.id).toBe("path-to-sky-beacon");
    expect(simulation.state.completedLevelIds).toEqual([]);
    expect(simulation.hero.x).toBe(simulation.director.level.startX);
    expect(simulation.state.remainingTicks).toBeGreaterThan(TICKS.second * 269);
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
