import {
  PROTOCOL_VERSION,
  type NormalizedGiftPayload,
  type NormalizedLiveEvent,
} from "@noema/event-protocol";
import { beforeEach, describe, expect, it } from "vitest";
import { giftIdFromName } from "../src/connectors/bridgeNormalizer";
import { FeedbackBus, type GiftFeedback } from "../src/gifts/FeedbackBus";
import {
  createDefaultCatalog,
  loadCatalog,
  migrateCatalog,
  resolveGift,
  saveCatalog,
  GIFT_CATALOG_STORAGE_KEY,
} from "../src/gifts/giftCatalog";
import { GiftStreakTracker } from "../src/gifts/GiftStreakTracker";
import { PriorityInbox } from "../src/gifts/PriorityInbox";
import { RulesEngine } from "../src/gifts/RulesEngine";

let sequence = 0;

function giftEvent(
  gift: Partial<NormalizedGiftPayload> & { giftName: string },
  options: {
    eventId?: string;
    actorId?: string;
    receivedAt?: number;
  } = {},
): NormalizedLiveEvent {
  sequence += 1;
  const actorId = options.actorId ?? "tt:1";
  const receivedAt = options.receivedAt ?? 1000;
  const payload: NormalizedGiftPayload = {
    giftId: gift.giftId ?? giftIdFromName(gift.giftName),
    giftName: gift.giftName,
    coinValue: gift.coinValue ?? 1,
    repeatCount: gift.repeatCount ?? 1,
  };
  if (gift.comboId !== undefined) payload.comboId = gift.comboId;
  if (gift.comboFinal !== undefined) payload.comboFinal = gift.comboFinal;
  return {
    protocolVersion: PROTOCOL_VERSION,
    eventId: options.eventId ?? `event-${sequence}`,
    source: "noema-bridge",
    kind: "gift",
    timestamp: receivedAt,
    receivedAt,
    actor: { id: actorId, username: actorId, displayName: `Viewer ${actorId}` },
    gift: payload,
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
    streakWindowMs: 1000,
  });
  return { engine, inbox, received };
}

describe("gift streak tracker", () => {
  it("drops a repeated event id", () => {
    const tracker = new GiftStreakTracker(1000);
    const event = giftEvent({ giftName: "Rose" }, { eventId: "same" });
    expect(tracker.observe(event, 1000).kind).toBe("progress");
    expect(tracker.observe(event, 1010).kind).toBe("duplicate");
  });

  it("aggregates a rising repeat count into one streak", () => {
    const tracker = new GiftStreakTracker(1000);
    tracker.observe(
      giftEvent({ giftName: "Rose", repeatCount: 1 }, { eventId: "a" }),
      1000,
    );
    tracker.observe(
      giftEvent({ giftName: "Rose", repeatCount: 2 }, { eventId: "b" }),
      1200,
    );
    const last = tracker.observe(
      giftEvent({ giftName: "Rose", repeatCount: 15 }, { eventId: "c" }),
      1400,
    );
    expect(last).toMatchObject({ kind: "progress", total: 15 });
    const finished = tracker.collectExpired(3000);
    expect(finished).toHaveLength(1);
    expect(finished[0]?.total).toBe(15);
  });

  it("never lowers the total on late or out-of-order frames", () => {
    const tracker = new GiftStreakTracker(1000);
    tracker.observe(
      giftEvent({ giftName: "Rose", repeatCount: 9 }, { eventId: "high" }),
      1000,
    );
    const late = tracker.observe(
      giftEvent({ giftName: "Rose", repeatCount: 3 }, { eventId: "late" }),
      1100,
    );
    expect(late).toMatchObject({ total: 9, delta: 0 });
  });

  it("starts a new streak after the previous one ended", () => {
    const tracker = new GiftStreakTracker(1000);
    tracker.observe(
      giftEvent({ giftName: "Rose", repeatCount: 4 }, { eventId: "1" }),
      1000,
    );
    expect(tracker.collectExpired(2500)).toHaveLength(1);
    const next = tracker.observe(
      giftEvent({ giftName: "Rose", repeatCount: 1 }, { eventId: "2" }),
      3000,
    );
    expect(next).toMatchObject({ kind: "progress", total: 1 });
  });

  it("keeps two senders apart", () => {
    const tracker = new GiftStreakTracker(1000);
    tracker.observe(
      giftEvent({ giftName: "Rose" }, { eventId: "a", actorId: "tt:1" }),
      1000,
    );
    tracker.observe(
      giftEvent({ giftName: "Rose" }, { eventId: "b", actorId: "tt:2" }),
      1000,
    );
    expect(tracker.collectExpired(2500)).toHaveLength(2);
  });

  it("finalizes immediately when the connector reports the combo end", () => {
    const tracker = new GiftStreakTracker(5000);
    const result = tracker.observe(
      giftEvent(
        { giftName: "Galaxy", repeatCount: 2, comboFinal: true },
        { eventId: "final" },
      ),
      1000,
    );
    expect(result.kind).toBe("final");
    expect(tracker.collectExpired(9000)).toHaveLength(0);
  });
});

describe("rules engine", () => {
  beforeEach(() => {
    sequence = 0;
  });

  it("acknowledges a small gift immediately without firing the effect twice", () => {
    const { engine, inbox, received } = createEngine();
    engine.handle(giftEvent({ giftName: "Rose", repeatCount: 1 }), 1000);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      sender: "Viewer tt:1",
      giftLabel: "Rose",
      effectLabel: "REPARATUR",
      applied: false,
    });
    expect(inbox.size()).toBe(0);

    engine.tick(4000);
    expect(inbox.size()).toBe(1);
    expect(inbox.drain()[0]?.command).toMatchObject({
      type: "repair_structure",
    });
  });

  it("publishes the acknowledgement synchronously, without any polling", () => {
    const { engine, received } = createEngine();
    expect(received).toHaveLength(0);
    engine.handle(giftEvent({ giftName: "Rose" }), 1000);
    // Same task as the incoming event: no timer, no interval, no await.
    expect(received).toHaveLength(1);
    expect(received[0]?.createdAt).toBeGreaterThan(0);
  });

  it("fires one command for a whole rose streak", () => {
    const { engine, inbox } = createEngine();
    for (let index = 1; index <= 15; index += 1) {
      engine.handle(
        giftEvent(
          { giftName: "Rose", repeatCount: index },
          { eventId: `rose-${index}`, receivedAt: 1000 + index * 20 },
        ),
        1000 + index * 20,
      );
    }
    expect(inbox.size()).toBe(0);
    engine.tick(5000);
    const drained = inbox.drain();
    expect(drained).toHaveLength(1);
    expect(drained[0]?.command).toMatchObject({ type: "repair_structure" });
  });

  it("triggers ZAR-BOMBE only once per streak", () => {
    const { engine, inbox } = createEngine();
    for (let index = 1; index <= 4; index += 1) {
      engine.handle(
        giftEvent(
          { giftName: "Zeus", repeatCount: index, coinValue: 34000 },
          { eventId: `zeus-${index}`, receivedAt: 1000 + index * 20 },
        ),
        1000 + index * 20,
      );
    }
    engine.tick(5000);
    const drained = inbox.drain();
    expect(drained.filter((item) => item.command.type === "tsar_bomb")).toHaveLength(
      1,
    );
  });

  it("keeps a second ZAR-BOMBE out while the cooldown runs", () => {
    const { engine, inbox } = createEngine();
    engine.handle(
      giftEvent(
        { giftName: "Zeus", comboFinal: true, coinValue: 34000 },
        { eventId: "g1" },
      ),
      1000,
    );
    engine.handle(
      giftEvent(
        { giftName: "Zeus", comboFinal: true, coinValue: 34000 },
        { eventId: "g2", actorId: "tt:9", receivedAt: 5000 },
      ),
      5000,
    );
    expect(
      inbox.drain().filter((item) => item.command.type === "tsar_bomb"),
    ).toHaveLength(1);
  });

  it("drops duplicate event ids", () => {
    const { engine, inbox } = createEngine();
    const event = giftEvent({ giftName: "Rose" }, { eventId: "dup" });
    engine.handle(event, 1000);
    engine.handle(event, 1050);
    expect(engine.getDroppedDuplicates()).toBe(1);
    engine.tick(5000);
    expect(inbox.drain()).toHaveLength(1);
  });

  it("logs unknown gifts without triggering a random effect", () => {
    const { engine, inbox, received } = createEngine();
    // Ohne Muenzwert kann keine Stufe greifen — nur dann gilt es als unbekannt.
    engine.handle(
      giftEvent({ giftName: "Brandneues Geschenk", coinValue: 0 }, { eventId: "x" }),
      1000,
    );
    engine.tick(5000);
    expect(inbox.size()).toBe(0);
    expect(engine.getUnknownGifts()).toHaveLength(1);
    expect(received.at(-1)?.effectLabel).toBe("NOCH NICHT ZUGEORDNET");
  });

  it("puts a premium gift in front of a like burst", () => {
    const { engine, inbox } = createEngine();
    for (let index = 0; index < 5; index += 1) {
      engine.handle(
        {
          protocolVersion: PROTOCOL_VERSION,
          eventId: `like-${index}`,
          source: "noema-bridge",
          kind: "like",
          timestamp: 1000,
          receivedAt: 1000,
          actor: { id: "tt:5", username: "tt:5" },
          likeCount: 4,
        },
        1000,
      );
    }
    engine.handle(
      giftEvent(
        // 199 Coins entspricht der Schild-Stufe (Herzen, Rhythmus-Bot).
        { giftName: "Herzen", comboFinal: true, coinValue: 199 },
        { eventId: "herzen" },
      ),
      1000,
    );
    const drained = inbox.drain();
    expect(drained[0]?.command.type).toBe("group_shield");
    expect(drained[0]?.priority).toBe("critical");
    expect(drained.at(-1)?.priority).toBe("low");
  });
});

describe("gift catalog", () => {
  it("resolves by gift id and falls back to the name", () => {
    const catalog = createDefaultCatalog();
    const byName = resolveGift(catalog, {
      giftId: "unbekannte-id",
      giftName: "rose",
      coinValue: 1,
      repeatCount: 1,
    });
    expect(byName.kind).toBe("mapped");
    expect(byName.kind === "mapped" && byName.effect.action).toBe("repair");

    // Ohne Muenzwert bleibt ein Geschenk unbekannt.
    const unknown = resolveGift(catalog, {
      giftId: "nope",
      giftName: "Nope",
      coinValue: 0,
      repeatCount: 1,
    });
    expect(unknown.kind).toBe("unknown");
  });

  it("ordnet ein voellig unbekanntes Geschenk ueber seinen Muenzwert zu", () => {
    const catalog = createDefaultCatalog();
    // Muenzwerte echter Geschenke aus der deutschen TikTok-Liste.
    for (const [coins, action] of [
      [1, "repair"],
      [5, "repair"],
      [30, "bridge"],
      [88, "lift"],
      [199, "team_shield"],
      [999, "earthquake"],
      [34000, "tsar_bomb"],
    ] as const) {
      const result = resolveGift(catalog, {
        giftId: `nie-gesehen-${coins}`,
        giftName: "Voellig neues Geschenk",
        coinValue: coins,
        repeatCount: 1,
      });
      expect(result.kind, `${coins} Coins`).toBe("mapped");
      expect(result.kind === "mapped" && result.effect.action).toBe(action);
    }
  });

  it("wirft die erfundenen Platzhalter beim Laden raus", () => {
    const migrated = migrateCatalog({
      version: 2,
      entries: [
        {
          giftId: "name:team-aegis",
          displayName: "Team Aegis",
          action: "team_shield",
          strength: 15,
        },
      ],
    });
    expect(
      migrated.entries.some((item) => item.giftId === "name:team-aegis"),
    ).toBe(false);
    expect(migrated.tiers.length).toBeGreaterThan(0);
  });

  it("reports disabled entries instead of mapping them", () => {
    const catalog = createDefaultCatalog();
    catalog.entries[0]!.enabled = false;
    const result = resolveGift(catalog, {
      giftId: catalog.entries[0]!.giftId,
      giftName: catalog.entries[0]!.displayName,
      coinValue: 1,
      repeatCount: 1,
    });
    expect(result.kind).toBe("disabled");
  });

  it("migrates an older stored config and keeps custom rows", () => {
    const migrated = migrateCatalog({
      version: 1,
      entries: [
        {
          giftId: "custom-1",
          displayName: "Eigenes Geschenk",
          action: "lift",
          strength: 12,
        },
        { giftId: "broken" },
      ],
    });
    expect(migrated.version).toBe(3);
    expect(migrated.entries.some((item) => item.giftId === "custom-1")).toBe(true);
    expect(migrated.entries.some((item) => item.giftId === "broken")).toBe(false);
    expect(migrated.free.like.action).toBe("team_energy");
  });

  it("round-trips through a storage implementation", () => {
    const backing = new Map<string, string>();
    const storage = {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => void backing.set(key, value),
    };
    const catalog = createDefaultCatalog();
    catalog.entries[0]!.strength = 99;
    saveCatalog(catalog, storage);
    expect(backing.has(GIFT_CATALOG_STORAGE_KEY)).toBe(true);
    expect(loadCatalog(storage).entries[0]?.strength).toBe(99);
  });

  it("falls back to defaults when stored data is corrupt", () => {
    const storage = {
      getItem: () => "{not json",
      setItem: () => undefined,
    };
    expect(loadCatalog(storage).entries.length).toBeGreaterThan(0);
  });
});

describe("priority inbox", () => {
  it("drains critical before normal before low and keeps FIFO inside a lane", () => {
    const inbox = new PriorityInbox();
    inbox.push({ type: "add_team_energy", amount: 1 }, "low");
    inbox.push({ type: "build_bridge", zoneId: "zone-1" }, "normal");
    inbox.push({ type: "tsar_bomb" }, "critical");
    inbox.push({ type: "add_team_energy", amount: 2 }, "low");
    const drained = inbox.drain();
    expect(drained.map((item) => item.command.type)).toEqual([
      "tsar_bomb",
      "build_bridge",
      "add_team_energy",
      "add_team_energy",
    ]);
    expect(inbox.size()).toBe(0);
  });
});
