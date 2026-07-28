import {
  PROTOCOL_VERSION,
  type LiveEventKind,
  type NormalizedGiftPayload,
  type NormalizedLiveEvent,
  type ViewerIdentity,
} from "@noema/event-protocol";
import { SeededRandom } from "../simulation/rng";
import { BaseConnector } from "./Connector";
import type { ConnectorId } from "./connectionTypes";

const MOCK_VIEWERS: readonly ViewerIdentity[] = [
  { id: "mock:1", username: "neon_builder", displayName: "NeonBuilder" },
  { id: "mock:2", username: "byte_queen", displayName: "ByteQueen" },
  { id: "mock:3", username: "circuit_boi", displayName: "CircuitBoi" },
  { id: "mock:4", username: "robo_bean", displayName: "RoboBean" },
  { id: "mock:5", username: "orbit_now", displayName: "OrbitNow" },
] as const;

let counter = 0;
function nextEventId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}-${Date.now()}`;
}

/**
 * Offline event source. It produces the same normalized events as the bridge
 * connector so the offline mode exercises the identical pipeline.
 */
export class MockConnector extends BaseConnector {
  readonly id: ConnectorId = "mock";

  private timer: ReturnType<typeof setInterval> | null = null;
  private rng = new SeededRandom(0x4d4f434b);

  connect(): void {
    this.setStatus("connected", "Offline-Testmodus aktiv");
  }

  disconnect(): void {
    this.stopAmbient();
    this.setStatus("offline", "Offline-Testmodus beendet");
  }

  /** Optional ambient traffic so the offline demo does not look static. */
  startAmbient(intervalMs = 2600): void {
    this.stopAmbient();
    this.timer = setInterval(() => this.emitAmbient(), intervalMs);
  }

  stopAmbient(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  isAmbientRunning(): boolean {
    return this.timer !== null;
  }

  /** Injects one operator-triggered test event. */
  injectGift(
    gift: Omit<NormalizedGiftPayload, "repeatCount"> & { repeatCount?: number },
    actor: ViewerIdentity = MOCK_VIEWERS[0]!,
    eventId = nextEventId("mock-gift"),
  ): NormalizedLiveEvent {
    const event = this.buildEvent("gift", actor, eventId);
    event.gift = {
      ...gift,
      repeatCount: gift.repeatCount ?? 1,
    };
    this.emitEvent(event);
    this.publishStatus();
    return event;
  }

  injectSimple(
    kind: Exclude<LiveEventKind, "gift">,
    actor: ViewerIdentity = MOCK_VIEWERS[0]!,
    likeCount?: number,
  ): NormalizedLiveEvent {
    const event = this.buildEvent(kind, actor, nextEventId(`mock-${kind}`));
    if (kind === "like") event.likeCount = likeCount ?? 10;
    this.emitEvent(event);
    this.publishStatus();
    return event;
  }

  private emitAmbient(): void {
    const actor = MOCK_VIEWERS[this.rng.integer(0, MOCK_VIEWERS.length - 1)]!;
    const roll = this.rng.next();
    if (roll < 0.62) {
      this.injectSimple("like", actor, this.rng.integer(3, 18));
      return;
    }
    if (roll < 0.76) {
      this.injectSimple("follow", actor);
      return;
    }
    if (roll < 0.86) {
      this.injectSimple("share", actor);
      return;
    }
    this.injectGift(
      { giftId: "mock_rose", giftName: "Rose", coinValue: 1 },
      actor,
    );
  }

  private buildEvent(
    kind: LiveEventKind,
    actor: ViewerIdentity,
    eventId: string,
  ): NormalizedLiveEvent {
    const now = Date.now();
    return {
      protocolVersion: PROTOCOL_VERSION,
      eventId,
      source: "mock",
      kind,
      timestamp: now,
      receivedAt: now,
      actor,
    };
  }
}

export { MOCK_VIEWERS };
