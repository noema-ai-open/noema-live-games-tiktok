import {
  PROTOCOL_VERSION,
  type LiveEventKind,
  type NormalizedGiftPayload,
  type NormalizedLiveEvent,
} from "@noema/event-protocol";

/**
 * Result of interpreting one raw WebSocket frame of the NOEMA TikTok Live
 * Bridge (`/ws/events`).
 *
 * The bridge sends three shapes on that socket:
 *  - an `Event` payload (see `app/events/models.py::Event.json_payload`)
 *  - `{ "type": "blocked", "reason": ..., "event": ... }`
 *  - `{ "type": "system", "text": ... }`
 */
export type BridgeFrame =
  | { kind: "event"; event: NormalizedLiveEvent }
  | { kind: "status"; status: string; roomId?: string }
  | { kind: "system"; text: string }
  | { kind: "blocked"; reason: string }
  | { kind: "ignored"; reason: string };

const EVENT_KIND_BY_BRIDGE_TYPE: Record<string, LiveEventKind> = {
  chat_message: "chat",
  like: "like",
  follow: "follow",
  share: "share",
  gift: "gift",
  subscribe: "subscription",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

/** Stable synthetic gift id for connectors that only report a gift name. */
export function giftIdFromName(name: string): string {
  return `name:${name.trim().toLowerCase().replace(/\s+/g, "-")}`;
}

function parseGift(
  metadata: Record<string, unknown>,
): NormalizedGiftPayload | undefined {
  const giftName = asString(metadata["gift_name"]) ?? "Unbekanntes Geschenk";
  const giftId =
    asString(metadata["gift_id"]) ??
    asString(metadata["giftId"]) ??
    giftIdFromName(giftName);
  const repeatCount = Math.max(
    1,
    Math.trunc(
      asNumber(metadata["repeat_count"]) ?? asNumber(metadata["count"]) ?? 1,
    ),
  );
  const coinValue = Math.max(
    0,
    Math.trunc(
      asNumber(metadata["diamond_count"]) ??
        asNumber(metadata["coin_value"]) ??
        0,
    ),
  );
  const comboId = asString(metadata["combo_id"]);
  const comboFinal =
    asBoolean(metadata["repeat_end"]) ?? asBoolean(metadata["combo_final"]);

  const gift: NormalizedGiftPayload = {
    giftId,
    giftName,
    coinValue,
    repeatCount,
  };
  if (comboId !== undefined) gift.comboId = comboId;
  if (comboFinal !== undefined) gift.comboFinal = comboFinal;
  return gift;
}

/**
 * Converts one raw bridge frame into the normalized contract. Anything the
 * game cannot use is reported as `ignored` instead of being forwarded, so the
 * runtime never sees a raw payload.
 */
export function normalizeBridgeFrame(
  raw: unknown,
  receivedAt = Date.now(),
): BridgeFrame {
  const frame = asRecord(raw);
  if (!frame) return { kind: "ignored", reason: "kein Objekt" };

  const frameType = asString(frame["type"]);
  if (frameType === "system") {
    return { kind: "system", text: asString(frame["text"]) ?? "" };
  }
  if (frameType === "blocked") {
    return { kind: "blocked", reason: asString(frame["reason"]) ?? "gefiltert" };
  }

  const bridgeType = asString(frame["event_type"]);
  if (!bridgeType) return { kind: "ignored", reason: "kein event_type" };

  const metadata = asRecord(frame["metadata"]) ?? {};

  if (bridgeType === "status") {
    const result: BridgeFrame = {
      kind: "status",
      status: asString(metadata["status"]) ?? "unknown",
    };
    const roomId = asString(metadata["room_id"]);
    return roomId ? { ...result, roomId } : result;
  }

  const kind = EVENT_KIND_BY_BRIDGE_TYPE[bridgeType];
  if (!kind) return { kind: "ignored", reason: `${bridgeType} wird ignoriert` };

  const user = asRecord(frame["user"]) ?? {};
  const displayName = asString(user["display_name"]) ?? "Anonym";
  const userId = asString(user["user_id"]) ?? `anonymous:${displayName}`;
  const eventId = asString(frame["event_id"]) ?? `bridge:${receivedAt}`;
  const parsedTimestamp = Date.parse(asString(frame["timestamp"]) ?? "");

  const event: NormalizedLiveEvent = {
    protocolVersion: PROTOCOL_VERSION,
    eventId,
    source: "noema-bridge",
    kind,
    timestamp: Number.isFinite(parsedTimestamp) ? parsedTimestamp : receivedAt,
    receivedAt,
    actor: { id: userId, username: userId, displayName },
  };

  if (kind === "gift") {
    const gift = parseGift(metadata);
    if (gift) event.gift = gift;
  }
  if (kind === "like") {
    event.likeCount = Math.max(
      1,
      Math.trunc(asNumber(metadata["like_count"]) ?? 1),
    );
  }
  if (kind === "chat") {
    const message = asString(frame["message"]);
    if (message !== undefined) event.message = message.slice(0, 200);
  }

  return { kind: "event", event };
}
