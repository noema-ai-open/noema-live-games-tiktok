import { describe, expect, it } from "vitest";
import { ReplayService } from "../src/replay/ReplayService";
import { Simulation } from "../src/simulation/Simulation";

describe("ReplayService", () => {
  it("reproduces the same deterministic final result", () => {
    const simulation = new Simulation(20260727);
    simulation.startRound();
    // Eine aktive Zuschauerschaft nachstellen: regelmaessig Aufbau schicken,
    // damit die Uebergaenge aufgehen und Roboter oben ankommen.
    while (simulation.state.roundStatus === "running") {
      if (simulation.state.tick % 120 === 0) {
        simulation.submit({ type: "repair_structure", amount: 20 });
      }
      if (simulation.state.tick % 900 === 300) {
        simulation.submit({ type: "activate_lift", durationTicks: 600 });
      }
      simulation.step();
    }

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
