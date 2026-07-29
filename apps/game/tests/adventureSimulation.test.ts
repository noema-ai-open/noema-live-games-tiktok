import { describe, expect, it } from "vitest";
import { Simulation } from "../src/simulation/Simulation";

function advanceUntil(
  simulation: Simulation,
  predicate: () => boolean,
  maxTicks = 12_000,
): void {
  for (let index = 0; index < maxTicks && !predicate(); index += 1) simulation.step();
  expect(predicate()).toBe(true);
}

describe("AdventureSimulation", () => {
  it("runs NURI automatically to the first real obstacle and waits there", () => {
    const simulation = new Simulation(1);
    simulation.startRound();
    const startX = simulation.hero.x;
    advanceUntil(simulation, () => simulation.state.heroState === "blocked");
    expect(simulation.hero.x).toBeGreaterThan(startX);
    expect(simulation.state.segmentId).toBe("gap-rose");
    expect(simulation.hero.x).toBe(simulation.director.current.waitX);
  });

  it("processes one Rose jump and ignores a second Rose during that jump", () => {
    const simulation = new Simulation(2);
    simulation.startRound();
    advanceUntil(simulation, () => simulation.state.heroState === "blocked");
    simulation.submit({ type: "place_jump_field", zoneId: "current", durationTicks: 24 });
    simulation.step();
    expect(simulation.state.heroState).toBe("jumping");
    const target = simulation.director.current.landingX;
    simulation.submit({ type: "place_jump_field", zoneId: "current", durationTicks: 24 });
    simulation.step();
    expect(simulation.state.heroState).toBe("jumping");
    advanceUntil(simulation, () => simulation.state.checkpointCount === 1);
    expect(simulation.hero.x).toBe(target);
    expect(simulation.obstacles.get(simulation.director.level.segments[2]!).builtParts).toBe(1);
  });

  it("does not let NURI cross a ravine before its bridge is complete", () => {
    const simulation = new Simulation(3);
    simulation.startRound();
    const index = simulation.director.level.segments.findIndex((item) => item.id === "ravine-main");
    simulation.director.setProgress(index, [], "right");
    const ravine = simulation.director.current;
    simulation.hero.x = ravine.waitX!;
    simulation.hero.y = ravine.groundY;
    simulation.hero.block();
    simulation.submit({ type: "build_bridge", zoneId: "current" });
    simulation.step();
    expect(simulation.hero.x).toBe(ravine.waitX);
    expect(simulation.obstacles.get(ravine).resolved).toBe(false);
    advanceUntil(simulation, () => simulation.obstacles.get(ravine).resolved);
    expect(simulation.hero.x).toBe(ravine.waitX);
    advanceUntil(simulation, () => simulation.hero.x > ravine.waitX!);
  });

  it("completes the hand-built level with gifts and a chat route vote", () => {
    const simulation = new Simulation(4);
    simulation.startRound();
    let voteSent = false;
    for (let index = 0; index < 12_000 && simulation.state.roundStatus === "running"; index += 1) {
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
      if (simulation.state.heroState === "route_vote" && !voteSent) {
        voteSent = true;
        simulation.submit({ type: "route_vote", eventId: "vote-1", choice: "right" });
      }
      simulation.step();
    }
    expect(voteSent).toBe(true);
    expect(simulation.state.chosenRoute).toBe("right");
    expect(simulation.state.roundStatus).toBe("success");
    expect(simulation.state.eventFeed).toContain(
      "GIPFEL ERREICHT // LEUCHTFEUER AKTIVIERT",
    );
  });

  it("fails cleanly when the round timer expires", () => {
    const simulation = new Simulation(5);
    simulation.startRound();
    simulation.state.remainingTicks = 1;
    simulation.step();
    expect(simulation.state.roundStatus).toBe("failure");
    expect(simulation.state.heroState).toBe("failure");
  });

  it("never creates the old 30-worker swarm", () => {
    const simulation = new Simulation(6);
    expect("workers" in simulation).toBe(false);
    expect(simulation.getActiveCount()).toBe(0);
    simulation.startRound();
    expect(simulation.getActiveCount()).toBe(1);
  });
});
