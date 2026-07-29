import { describe, expect, it } from "vitest";
import { AdventureSimulation } from "../src/adventure/AdventureSimulation";
import { FIXED_HZ, TICKS } from "../src/config/gameConfig";

function advanceUntilBlocked(simulation: AdventureSimulation): void {
  for (
    let index = 0;
    index < FIXED_HZ * 30 && simulation.state.heroState !== "blocked";
    index += 1
  ) {
    simulation.step();
  }
  expect(simulation.state.heroState).toBe("blocked");
}

function advanceUntilBubbleVisible(simulation: AdventureSimulation): void {
  for (
    let index = 0;
    index <= TICKS.speechBubbleDelay && !simulation.state.speechBubble.visible;
    index += 1
  ) {
    simulation.step();
  }
  expect(simulation.state.speechBubble.visible).toBe(true);
}

describe("hero speech bubble", () => {
  it("appears only after NURI has been blocked for three seconds", () => {
    const simulation = new AdventureSimulation(101);
    simulation.startRound();
    simulation.hero.block();
    simulation.step();

    for (let index = 0; index < TICKS.speechBubbleDelay - 1; index += 1) {
      simulation.step();
    }
    expect(simulation.state.speechBubble.visible).toBe(false);

    simulation.step();
    expect(simulation.state.speechBubble).toMatchObject({
      visible: true,
      text: "Help me, please!",
    });
  });

  it("stays hidden while NURI keeps running", () => {
    const simulation = new AdventureSimulation(102);
    simulation.startRound();
    simulation.hero.runSpeed = 0;
    simulation.hero.startRunning();

    for (let index = 0; index < TICKS.speechBubbleCooldown; index += 1) {
      simulation.step();
      expect(simulation.state.heroState).toBe("running");
      expect(simulation.state.speechBubble.visible).toBe(false);
    }
  });

  it("disappears immediately when a Rose command starts the jump", () => {
    const simulation = new AdventureSimulation(103);
    simulation.startRound();
    advanceUntilBlocked(simulation);
    advanceUntilBubbleVisible(simulation);

    simulation.submit({
      type: "place_jump_field",
      zoneId: "current",
      durationTicks: FIXED_HZ,
    });
    simulation.step();

    expect(simulation.state.heroState).toBe("jumping");
    expect(simulation.state.speechBubble.visible).toBe(false);
    expect(simulation.state.speechBubble.blockedSinceTick).toBeNull();
    expect(simulation.state.speechBubble.lastShownUntilTick).toBe(simulation.state.tick);
  });

  it("observes the cooldown before appearing during a later block", () => {
    const simulation = new AdventureSimulation(104);
    simulation.startRound();
    advanceUntilBlocked(simulation);
    advanceUntilBubbleVisible(simulation);

    simulation.submit({
      type: "place_jump_field",
      zoneId: "current",
      durationTicks: FIXED_HZ,
    });
    simulation.step();
    const hiddenAt = simulation.state.speechBubble.lastShownUntilTick;
    expect(hiddenAt).not.toBeNull();

    simulation.hero.block();
    while (simulation.state.tick < hiddenAt! + TICKS.speechBubbleCooldown - 1) {
      simulation.step();
    }
    expect(simulation.state.speechBubble.visible).toBe(false);

    simulation.step();
    expect(simulation.state.tick - hiddenAt!).toBe(TICKS.speechBubbleCooldown);
    expect(simulation.state.speechBubble.visible).toBe(true);
  });
});
