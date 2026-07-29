import { describe, expect, it } from "vitest";
import { ReplayService } from "../src/replay/ReplayService";
import { Simulation } from "../src/simulation/Simulation";

describe("ReplayService", () => {
  it("reproduces the same seeded adventure state", () => {
    const simulation = new Simulation(20260729);
    simulation.startRound();
    while (simulation.state.heroState !== "blocked") simulation.step();
    simulation.submit({ type: "place_jump_field", zoneId: "current", durationTicks: 24 });
    for (let index = 0; index < 90; index += 1) simulation.step();

    const service = new ReplayService();
    const replay = service.capture(simulation);
    const comparison = service.replay(replay);
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
