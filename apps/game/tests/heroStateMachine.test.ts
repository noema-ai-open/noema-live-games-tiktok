import { describe, expect, it } from "vitest";
import { HeroController } from "../src/adventure/HeroController";
import { HeroStateMachine } from "../src/adventure/HeroStateMachine";

describe("HeroStateMachine", () => {
  it("rejects an incompatible second jump", () => {
    const hero = new HeroController(100, 650);
    hero.block();
    expect(hero.beginJump(240, 650)).toBe(true);
    expect(hero.beginJump(360, 650)).toBe(false);
    expect(hero.state).toBe("jumping");
  });

  it("supports the required visible hero states", () => {
    const machine = new HeroStateMachine();
    for (const state of [
      "boot",
      "intro",
      "running",
      "approaching_obstacle",
      "blocked",
      "route_vote",
      "performing_action",
      "jumping",
      "climbing",
      "falling",
      "helper_active",
      "checkpoint",
      "bomb_warning",
      "bomb_impact",
      "resetting",
      "success",
      "failure",
      "paused",
    ] as const) {
      machine.force(state);
      expect(machine.state).toBe(state);
    }
  });
});
