import { describe, expect, it } from "vitest";
import { ReplayService } from "../src/replay/ReplayService";
import { Simulation } from "../src/simulation/Simulation";

describe("ReplayService", () => {
  it("reproduces the same deterministic final result", () => {
    const simulation = new Simulation(20260727);
    simulation.startRound();
    simulation.submit({ type: "add_team_energy", amount: 12 });
    simulation.submit({ type: "build_bridge", zoneId: "zone-1" });
    simulation.step();
    for (let index = 0; index < 140; index += 1) simulation.step();
    simulation.submit({
      type: "place_jump_field",
      zoneId: "zone-1",
      durationTicks: 240,
    });
    while (simulation.state.roundStatus === "running") simulation.step();

    const replayService = new ReplayService();
    const replay = replayService.capture(simulation);
    const comparison = replayService.replay(replay);

    // Dieser Test prueft Determinismus, nicht die Balance: Die Zahl der
    // Geretteten haengt am Tempo und darf sich beim Ausbalancieren aendern.
    expect(replay.expectedResult.rescued).toBeGreaterThan(0);
    expect(comparison.matches).toBe(true);
    expect(comparison.result).toEqual(replay.expectedResult);
  });

  it("exports and imports replay JSON", () => {
    const simulation = new Simulation(22);
    simulation.startRound();
    simulation.step();
    const first = new ReplayService();
    const json = first.exportJson(simulation);
    const second = new ReplayService();
    expect(second.importJson(json).seed).toBe(22);
  });
});
