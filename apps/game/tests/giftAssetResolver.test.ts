import { describe, expect, it } from "vitest";
import {
  GIFT_FALLBACKS,
  resolveGiftAsset,
} from "../src/assets/giftAssetResolver";

describe("gift asset resolver", () => {
  it("prefers a valid current bridge icon", () => {
    expect(resolveGiftAsset("Corgi", "https://cdn.example/corgi.png")).toMatchObject({
      key: "corgi",
      primaryUrl: "https://cdn.example/corgi.png",
      fallbackUrl: GIFT_FALLBACKS.corgi,
      usesBridgeIcon: true,
    });
  });

  it("falls back to the local PNG when the bridge icon is absent or invalid", () => {
    expect(resolveGiftAsset("Galaxy", "broken-url")).toEqual({
      key: "galaxy",
      primaryUrl: GIFT_FALLBACKS.galaxy,
      fallbackUrl: GIFT_FALLBACKS.galaxy,
      usesBridgeIcon: false,
    });
  });
});
