import { describe, expect, it } from "vitest";
import { GiftActionRouter } from "../src/adventure/GiftActionRouter";

const actor = { id: "viewer-1", username: "nori-fan" };

describe("GiftActionRouter", () => {
  it("maps the five central gifts to deterministic commands", () => {
    const router = new GiftActionRouter();
    expect(router.toCommand("jump", actor, "a").type).toBe("place_jump_field");
    expect(router.toCommand("build_blocks_3", actor, "b")).toMatchObject({
      type: "repair_structure",
      amount: 3,
    });
    expect(router.toCommand("build_bridge", actor, "c").type).toBe("build_bridge");
    expect(router.toCommand("helper", actor, "d").type).toBe("rescue_worker");
    expect(router.toCommand("tsar_bomb", actor, "tx")).toMatchObject({
      type: "tsar_bomb",
      transactionId: "tx",
    });
  });

  it("leaves unrelated legacy commands inert", () => {
    const router = new GiftActionRouter();
    expect(
      router.toAdventureAction({ type: "earthquake", severity: 5, actor }),
    ).toBeNull();
  });
});
