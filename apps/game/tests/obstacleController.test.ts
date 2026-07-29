import { describe, expect, it } from "vitest";
import { ObstacleController } from "../src/adventure/ObstacleController";
import { createBeaconLevel } from "../src/adventure/levelTemplates";

function segment(id: string) {
  return createBeaconLevel(1).segments.find((item) => item.id === id)!;
}

describe("ObstacleController", () => {
  it("creates exactly three components per Doughnut", () => {
    const controller = new ObstacleController();
    const ledge = segment("high-ledge");
    const result = controller.apply(ledge, "build_blocks");
    expect(result.partsAdded).toBe(3);
    expect(controller.get(ledge).builtParts).toBe(3);
  });

  it("builds a whole six-part ravine bridge with Hand Heart", () => {
    const controller = new ObstacleController();
    const ravine = segment("ravine-main");
    const result = controller.apply(ravine, "build_bridge");
    expect(result.partsAdded).toBe(6);
    expect(controller.get(ravine).resolved).toBe(false);
    while (controller.revealNextPart(ravine)) {
      // Animation reveals collision-bearing parts one at a time.
    }
    expect(controller.get(ravine)).toMatchObject({
      builtParts: 6,
      visibleParts: 6,
      resolved: true,
    });
  });

  it("opens a repair gate only after the helper completes", () => {
    const controller = new ObstacleController();
    const gate = segment("beacon-gate");
    const result = controller.apply(gate, "helper");
    expect(result.accepted).toBe(true);
    expect(controller.get(gate).resolved).toBe(false);
    controller.completeHelper(gate);
    expect(controller.get(gate).resolved).toBe(true);
  });
});
