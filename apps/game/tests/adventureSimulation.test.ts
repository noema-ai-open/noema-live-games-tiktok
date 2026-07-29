import { describe, expect, it } from "vitest";
import { ROUND_DURATION_TICKS } from "../src/config/gameConfig";
import { Simulation } from "../src/simulation/Simulation";
import { createAdventureCampaign } from "../src/adventure/levelTemplates";

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
    let lastLevelIndex = simulation.state.levelIndex;
    const remainingTicksAfterLevelSwitch: number[] = [];
    for (let index = 0; index < 12_000 && simulation.state.roundStatus === "running"; index += 1) {
      if (simulation.state.levelIndex !== lastLevelIndex) {
        lastLevelIndex = simulation.state.levelIndex;
        remainingTicksAfterLevelSwitch.push(simulation.state.remainingTicks);
      }
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
    expect(simulation.state.levelCount).toBe(3);
    expect(simulation.state.completedLevelIds).toHaveLength(3);
    expect(simulation.state.levelIndex).toBe(2);
    expect(simulation.state.eventFeed).toContain(
      "GIPFEL ERREICHT // LEUCHTFEUER AKTIVIERT",
    );
    // A level switch must not silently carry over the previous level's
    // remaining time: every new level starts with its own full timer.
    expect(remainingTicksAfterLevelSwitch).toHaveLength(2);
    for (const remaining of remainingTicksAfterLevelSwitch) {
      expect(remaining).toBe(ROUND_DURATION_TICKS);
    }
  });

  it("gives each of the three regions its own distinct segments and palette", () => {
    const [beacon, cavern, storm] = createAdventureCampaign();
    const levels = [beacon!, cavern!, storm!];

    const regions = new Set(levels.map((level) => level.region));
    const celebrations = new Set(levels.map((level) => level.celebration));
    expect(regions.size).toBe(3);
    expect(celebrations.size).toBe(3);

    for (const level of levels) {
      expect(level.segments.length).toBeGreaterThanOrEqual(10);
      const themes = new Set(level.segments.map((segment) => segment.visualTheme));
      expect(themes.size).toBeGreaterThanOrEqual(2);
    }

    const themesByLevel = levels.map(
      (level) => new Set(level.segments.map((segment) => segment.visualTheme)),
    );
    expect(themesByLevel[0]).not.toEqual(themesByLevel[1]);
    expect(themesByLevel[1]).not.toEqual(themesByLevel[2]);
    expect(themesByLevel[0]).not.toEqual(themesByLevel[2]);
  });

  it("keeps all three levels deterministic and playable offline for a fixed seed", () => {
    const first = createAdventureCampaign(777);
    const second = createAdventureCampaign(777);
    expect(first).toEqual(second);

    for (const level of first) {
      expect(level.segments[0]!.startX).toBeGreaterThanOrEqual(0);
      expect(level.segments.at(-1)!.type).toBe("finish");
      for (const segment of level.segments) {
        for (const nextId of segment.next) {
          expect(level.segments.some((candidate) => candidate.id === nextId)).toBe(true);
        }
      }
    }
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
