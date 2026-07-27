import { describe, expect, it } from "vitest";
import { TICKS } from "../src/config/gameConfig";
import { Simulation } from "../src/simulation/Simulation";

const apply = (simulation: Simulation): void => simulation.step();

describe("Simulation", () => {
  it("transitions a worker from spawning to walking and falling at the pit", () => {
    const simulation = new Simulation(7);
    simulation.startRound();
    const worker = simulation.workers[0]!;
    apply(simulation);
    expect(worker.state).toBe("walking");
    worker.progress = 0.21;
    worker.state = "walking";
    apply(simulation);
    expect(worker.state).toBe("falling");
  });

  it("builds the bridge through an ordered command", () => {
    const simulation = new Simulation(8);
    simulation.startRound();
    simulation.submit({ type: "build_bridge", zoneId: "zone-1" });
    apply(simulation);
    expect(
      simulation.state.structures.find(
        (structure) => structure.id === "bridge-alpha",
      )?.intact,
    ).toBe(true);
    expect(simulation.commandHistory[0]?.sequence).toBe(1);
  });

  it("applies a group shield to active workers", () => {
    const simulation = new Simulation(9);
    simulation.startRound();
    simulation.submit({
      type: "group_shield",
      durationTicks: TICKS.second * 10,
    });
    apply(simulation);
    expect(
      simulation.workers.every(
        (worker) =>
          worker.state === "protected" || worker.state === "spawning",
      ),
    ).toBe(true);
    expect(simulation.workers[0]!.protectedUntilTick).toBeGreaterThan(
      simulation.state.tick,
    );
  });

  it("collapses a selected temporary route section", () => {
    const simulation = new Simulation(10);
    simulation.startRound();
    simulation.submit({
      type: "collapse_section",
      sectionId: "shortcut-deck",
    });
    apply(simulation);
    expect(
      simulation.state.structures.find(
        (structure) => structure.id === "shortcut-deck",
      )?.intact,
    ).toBe(false);
  });

  it("blocks destructive commands in safe mode", () => {
    const simulation = new Simulation(11);
    simulation.startRound();
    simulation.submit({ type: "set_safe_mode", enabled: true });
    simulation.submit({
      type: "collapse_section",
      sectionId: "shortcut-deck",
    });
    apply(simulation);
    expect(
      simulation.state.structures.find(
        (structure) => structure.id === "shortcut-deck",
      )?.intact,
    ).toBe(true);
  });

  it("enforces the ZAR-BOMBE cooldown", () => {
    const simulation = new Simulation(12);
    simulation.startRound();
    simulation.submit({ type: "tsar_bomb" });
    apply(simulation);
    const firstStart = simulation.state.tsarBomb.startedTick;
    simulation.submit({ type: "tsar_bomb" });
    apply(simulation);
    expect(simulation.state.tsarBomb.startedTick).toBe(firstStart);
    expect(simulation.state.tsarBomb.cooldownUntilTick).toBeGreaterThan(
      simulation.state.tick,
    );
  });

  it("keeps protected workers safe during ZAR-BOMBE impact", () => {
    const simulation = new Simulation(13);
    simulation.startRound();
    simulation.submit({
      type: "group_shield",
      durationTicks: TICKS.second * 20,
    });
    simulation.submit({ type: "tsar_bomb" });
    apply(simulation);
    const protectedIds = simulation.workers.map((worker) => worker.id);
    for (let index = 0; index < TICKS.tsarWarning + TICKS.tsarDescent; index += 1) {
      apply(simulation);
    }
    expect(simulation.state.tsarBomb.impactApplied).toBe(true);
    expect(
      simulation.workers
        .filter((worker) => protectedIds.includes(worker.id))
        .every(
          (worker) => worker.state !== "falling" && worker.state !== "lost",
        ),
    ).toBe(true);
  });

  it("resets all round state without changing the seed", () => {
    const simulation = new Simulation(14);
    simulation.startRound();
    for (let index = 0; index < 20; index += 1) apply(simulation);
    simulation.submit({ type: "add_team_energy", amount: 50 });
    apply(simulation);
    simulation.submit({ type: "reset" });
    apply(simulation);
    expect(simulation.state.tick).toBe(0);
    expect(simulation.state.seed).toBe(14);
    expect(simulation.state.teamEnergy).toBe(15);
    expect(simulation.state.roundStatus).toBe("ready");
    expect(simulation.commandHistory).toHaveLength(0);
    expect(
      simulation.workers.every((worker) => worker.state === "spawning"),
    ).toBe(true);
  });
});
