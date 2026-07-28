import { describe, expect, it } from "vitest";
import {
  giftIdFromName,
  normalizeBridgeFrame,
} from "../src/connectors/bridgeNormalizer";
import {
  bridgeHttpUrl,
  bridgeWebSocketUrl,
  reconnectDelayMs,
} from "../src/connectors/connectionTypes";

const giftFrame = {
  platform: "tiktok",
  event_type: "gift",
  event_id: "tiktok-123",
  timestamp: "2026-07-28T08:00:00+00:00",
  user: {
    display_name: "NeonBuilder",
    user_id: "tt:4711",
    is_moderator: false,
    is_subscriber: true,
  },
  message: null,
  metadata: { gift_name: "Rose", repeat_count: 3, diamond_count: 1 },
};

describe("bridge normalizer", () => {
  it("maps a gift event to the normalized contract", () => {
    const frame = normalizeBridgeFrame(giftFrame, 1000);
    expect(frame.kind).toBe("event");
    if (frame.kind !== "event") return;
    expect(frame.event.source).toBe("noema-bridge");
    expect(frame.event.kind).toBe("gift");
    expect(frame.event.eventId).toBe("tiktok-123");
    expect(frame.event.actor.displayName).toBe("NeonBuilder");
    expect(frame.event.gift).toEqual({
      giftId: giftIdFromName("Rose"),
      giftName: "Rose",
      coinValue: 1,
      repeatCount: 3,
    });
    expect(frame.event.timestamp).toBe(Date.parse("2026-07-28T08:00:00Z"));
  });

  it("maps chat and like events and keeps the like count", () => {
    const chat = normalizeBridgeFrame({
      ...giftFrame,
      event_type: "chat_message",
      message: "Los geht's!",
      metadata: {},
    });
    expect(chat.kind === "event" && chat.event.kind).toBe("chat");
    expect(chat.kind === "event" && chat.event.message).toBe("Los geht's!");

    const like = normalizeBridgeFrame({
      ...giftFrame,
      event_type: "like",
      message: null,
      metadata: { like_count: 12 },
    });
    expect(like.kind === "event" && like.event.likeCount).toBe(12);
  });

  it("reports bridge status, system and blocked frames separately", () => {
    const status = normalizeBridgeFrame({
      ...giftFrame,
      event_type: "status",
      message: null,
      metadata: { status: "connected", room_id: "42" },
    });
    expect(status).toEqual({ kind: "status", status: "connected", roomId: "42" });

    expect(normalizeBridgeFrame({ type: "system", text: "Bereit" })).toEqual({
      kind: "system",
      text: "Bereit",
    });
    expect(
      normalizeBridgeFrame({ type: "blocked", reason: "cooldown", event: {} }),
    ).toEqual({ kind: "blocked", reason: "cooldown" });
  });

  it("ignores unusable payloads instead of forwarding them", () => {
    expect(normalizeBridgeFrame(null).kind).toBe("ignored");
    expect(normalizeBridgeFrame("nope").kind).toBe("ignored");
    expect(normalizeBridgeFrame({ event_type: "join" }).kind).toBe("ignored");
  });

  it("falls back to safe defaults for incomplete gift metadata", () => {
    const frame = normalizeBridgeFrame(
      { ...giftFrame, user: {}, metadata: {} },
      500,
    );
    if (frame.kind !== "event") throw new Error("expected event");
    expect(frame.event.actor.displayName).toBe("Anonym");
    expect(frame.event.gift?.repeatCount).toBe(1);
    expect(frame.event.gift?.coinValue).toBe(0);
  });

  it("honours combo markers when a connector provides them", () => {
    const frame = normalizeBridgeFrame({
      ...giftFrame,
      metadata: {
        gift_name: "Galaxy",
        gift_id: "5655",
        repeat_count: 4,
        repeat_end: true,
        combo_id: "abc",
      },
    });
    if (frame.kind !== "event") throw new Error("expected event");
    expect(frame.event.gift).toMatchObject({
      giftId: "5655",
      comboId: "abc",
      comboFinal: true,
      repeatCount: 4,
    });
  });
});

describe("bridge addressing", () => {
  it("derives the documented websocket endpoint", () => {
    expect(bridgeWebSocketUrl("http://127.0.0.1:8765")).toBe(
      "ws://127.0.0.1:8765/ws/events",
    );
    expect(bridgeWebSocketUrl("127.0.0.1:8765/")).toBe(
      "ws://127.0.0.1:8765/ws/events",
    );
    expect(bridgeHttpUrl("127.0.0.1:8765", "/status")).toBe(
      "http://127.0.0.1:8765/status",
    );
  });

  it("uses capped exponential backoff", () => {
    expect(reconnectDelayMs(0)).toBe(1000);
    expect(reconnectDelayMs(1)).toBe(2000);
    expect(reconnectDelayMs(3)).toBe(8000);
    expect(reconnectDelayMs(20)).toBe(30000);
  });
});
