import { describe, expect, it } from "vitest";
import { CheckpointSystem } from "../src/adventure/CheckpointSystem";
import { HeroController } from "../src/adventure/HeroController";
import { LevelDirector } from "../src/adventure/LevelDirector";
import { ObstacleController } from "../src/adventure/ObstacleController";
import { createBeaconLevel } from "../src/adventure/levelTemplates";

describe("CheckpointSystem", () => {
  it("stores and restores segment, hero, route, time and completed obstacles", () => {
    const director = new LevelDirector(createBeaconLevel(17));
    const obstacles = new ObstacleController();
    const hero = new HeroController(1170, 650);
    const gap = director.level.segments.find((item) => item.id === "gap-rose")!;
    obstacles.apply(gap, "jump");
    director.setProgress(3, ["station-intro", "valley-run", "gap-rose"], "left");
    const checkpoints = new CheckpointSystem();
    const saved = checkpoints.save(director, obstacles, hero, 7000);

    director.setProgress(8, [], "right");
    hero.x = 4000;
    obstacles.destroyTemporary(gap);
    const restored = checkpoints.restore(director, obstacles, hero);

    expect(restored).toEqual(saved);
    expect(director.segmentIndex).toBe(3);
    expect(director.chosenRoute).toBe("left");
    expect(hero.x).toBe(1170);
    expect(obstacles.get(gap).resolved).toBe(true);
  });
});
