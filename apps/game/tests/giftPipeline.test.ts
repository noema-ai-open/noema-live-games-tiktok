import {
  PROTOCOL_VERSION,
  type NormalizedGiftPayload,
  type NormalizedLiveEvent,
} from "@noema/event-protocol";
import { beforeEach, describe, expect, it } from "vitest";
import { giftIdFromName } from "../src/connectors/bridgeNormalizer";
import { FeedbackBus, type GiftFeedback } from "../src/gifts/FeedbackBus";
import {
  GIFT_CATALOG_STORAGE_KEY,
  createDefaultCatalog,
  loadCatalog,
  resolveGift,
  saveCatalog,
} from "../src/gifts/giftCatalog";
import { GiftStreakTracker } from "../src/gifts/GiftStreakTracker";
import { PriorityInbox } from "../src/gifts/PriorityInbox";
import { RulesEngine } from "../src/gifts/RulesEngine";

let sequence = 0;
function giftEvent(
  gift: Partial<NormalizedGiftPayload> & { giftName: string },
  eventId = `gift-${++sequence}`,
): NormalizedLiveEvent {
  const payload: NormalizedGiftPayload = {
    giftId: gift.giftId ?? giftIdFromName(gift.giftName),
    giftName: gift.giftName,
    coinValue: gift.coinValue ?? 1,
    repeatCount: gift.repeatCount ?? 1,
  };
  if (gift.comboFinal !== undefined) payload.comboFinal = gift.comboFinal;
  if (gift.iconUrl !== undefined) payload.iconUrl = gift.iconUrl;
  return {
    protocolVersion: PROTOCOL_VERSION,
    eventId,
    source: "noema-bridge",
    kind: "gift",
    timestamp: 1000,
    receivedAt: 1000,
    actor: { id: "viewer-1", username: "viewer", displayName: "Viewer One" },
    gift: payload,
  };
}

function chatEvent(message: string, eventId: string): NormalizedLiveEvent {
  return {
    protocolVersion: PROTOCOL_VERSION,
    eventId,
    source: "noema-bridge",
    kind: "chat",
    timestamp: 1000,
    receivedAt: 1000,
    actor: { id: "viewer-1", username: "viewer" },
    message,
  };
}

function createEngine() {
  const feedback = new FeedbackBus();
  const received: GiftFeedback[] = [];
  feedback.subscribe((item) => received.push(item));
  const inbox = new PriorityInbox();
  const engine = new RulesEngine({
    catalog: createDefaultCatalog(),
    feedback,
    inbox,
    streakWindowMs: 100,
  });
  return { engine, inbox, received };
}

describe("gift streak tracker", () => {
  it("drops duplicate transaction events and finalizes one streak once", () => {
    const tracker = new GiftStreakTracker(100);
    const event = giftEvent({ giftName: "Rose" }, "same");
    expect(tracker.observe(event, 1000).kind).toBe("progress");
    expect(tracker.observe(event, 1010).kind).toBe("duplicate");
    expect(tracker.collectExpired(1200)).toHaveLength(1);
    expect(tracker.collectExpired(1400)).toHaveLength(0);
  });
});

describe("adventure gift rules", () => {
  beforeEach(() => {
    sequence = 0;
  });

  it("maps only the five exact gifts to their visible actions", () => {
    const expected = new Map([
      ["Rose", "place_jump_field"],
      ["Doughnut", "repair_structure"],
      ["Hand Heart", "build_bridge"],
      ["Corgi", "rescue_worker"],
      ["Galaxy", "tsar_bomb"],
    ]);
    for (const [name, commandType] of expected) {
      const { engine, inbox } = createEngine();
      engine.handle(giftEvent({ giftName: name, comboFinal: true }), 1000);
      expect(inbox.drain()[0]?.command.type).toBe(commandType);
    }
  });

  it("emits bridge icon metadata but keeps a local fallback available", () => {
    const { engine, received } = createEngine();
    engine.handle(
      giftEvent({
        giftName: "Rose",
        comboFinal: true,
        iconUrl: "https://cdn.example/rose.png",
      }),
      1000,
    );
    expect(received[0]).toMatchObject({
      giftLabel: "Rose",
      bridgeIconUrl: "https://cdn.example/rose.png",
      effectLabel: "SPRINGEN",
    });
  });

  it("logs an unknown gift without using its coin value for a random action", () => {
    const { engine, inbox, received } = createEngine();
    engine.handle(
      giftEvent({
        giftId: "unknown-expensive",
        giftName: "Unbekanntes Geschenk",
        coinValue: 999_999,
        comboFinal: true,
      }),
      1000,
    );
    expect(inbox.size()).toBe(0);
    expect(engine.getUnknownGifts()).toHaveLength(1);
    expect(received.at(-1)?.effectLabel).toBe("NOCH NICHT ZUGEORDNET");
  });

  it("fires Galaxy once per gift transaction and respects its cooldown", () => {
    const { engine, inbox } = createEngine();
    const first = giftEvent({ giftName: "Galaxy", comboFinal: true }, "galaxy-1");
    engine.handle(first, 1000);
    engine.handle(first, 1010);
    engine.handle(
      giftEvent({ giftName: "Galaxy", comboFinal: true }, "galaxy-2"),
      2000,
    );
    const bombs = inbox.drain().filter((item) => item.command.type === "tsar_bomb");
    expect(bombs).toHaveLength(1);
    expect(bombs[0]?.command).toMatchObject({ transactionId: "galaxy-1" });
  });

  it("keeps chat votes separate from gifts and deduplicates event ids", () => {
    const { engine, inbox } = createEngine();
    engine.handle(chatEvent("links", "chat-1"), 1000);
    engine.handle(chatEvent("links", "chat-1"), 1010);
    engine.handle(chatEvent("Rose", "chat-2"), 1020);
    const commands = inbox.drain();
    expect(commands).toHaveLength(1);
    expect(commands[0]?.command).toMatchObject({ type: "route_vote", choice: "left" });
  });

  it("accepts 1 and 2 as live route votes", () => {
    const { engine, inbox } = createEngine();
    engine.handle(chatEvent("1", "number-left"), 1000);
    const second = chatEvent("2", "number-right");
    second.actor = { id: "viewer-2", username: "viewer-two" };
    engine.handle(second, 1001);
    expect(inbox.drain().map((item) => item.command)).toMatchObject([
      { type: "route_vote", choice: "left" },
      { type: "route_vote", choice: "right" },
    ]);
  });

  it("routes likes, follows and shares only to free support actions", () => {
    const { engine, inbox } = createEngine();
    const base = {
      protocolVersion: PROTOCOL_VERSION,
      source: "noema-bridge" as const,
      timestamp: 1000,
      receivedAt: 1000,
      actor: { id: "viewer-2", username: "supporter" },
    };
    engine.handle({ ...base, eventId: "like", kind: "like", likeCount: 10 }, 1000);
    engine.handle({ ...base, eventId: "follow", kind: "follow" }, 1001);
    engine.handle({ ...base, eventId: "share", kind: "share" }, 1002);
    expect(inbox.drain().map((item) => item.command.type)).toEqual([
      "add_team_energy",
      "add_time",
      "add_team_energy",
    ]);
  });
});

describe("gift catalog", () => {
  it("resolves giftId first, then an exact normalized name, never coins", () => {
    const catalog = createDefaultCatalog();
    expect(
      resolveGift(catalog, {
        giftId: "unknown-id",
        giftName: "  HAND   HEART ",
        coinValue: 0,
        repeatCount: 1,
      }),
    ).toMatchObject({ kind: "mapped", effect: { action: "build_bridge" } });
    expect(
      resolveGift(catalog, {
        giftId: "unknown-id",
        giftName: "Galaxy extra",
        coinValue: 999_999,
        repeatCount: 1,
      }),
    ).toMatchObject({ kind: "unknown" });
  });

  it("round-trips through local storage", () => {
    const backing = new Map<string, string>();
    const storage = {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => void backing.set(key, value),
    };
    const catalog = createDefaultCatalog();
    saveCatalog(catalog, storage);
    expect(backing.has(GIFT_CATALOG_STORAGE_KEY)).toBe(true);
    expect(loadCatalog(storage).entries).toHaveLength(5);
  });
});

describe("priority inbox", () => {
  it("keeps catastrophe commands ahead of normal and free support", () => {
    const inbox = new PriorityInbox();
    inbox.push({ type: "add_team_energy", amount: 1 }, "low");
    inbox.push({ type: "build_bridge", zoneId: "current" }, "normal");
    inbox.push({ type: "tsar_bomb", transactionId: "tx" }, "critical");
    expect(inbox.drain().map((item) => item.command.type)).toEqual([
      "tsar_bomb",
      "build_bridge",
      "add_team_energy",
    ]);
  });
});
