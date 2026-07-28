import type { NormalizedLiveEvent } from "@noema/event-protocol";

export type StreakObservation =
  /** Same event id already processed — dropped. */
  | { kind: "duplicate"; comboKey: string }
  /** Streak is still running; only the visible counter changes. */
  | { kind: "progress"; comboKey: string; total: number; delta: number }
  /** Streak is complete; the full effect fires exactly once. */
  | { kind: "final"; comboKey: string; total: number; delta: number };

export type FinalizedStreak = {
  comboKey: string;
  total: number;
  event: NormalizedLiveEvent;
};

type StreakRecord = {
  comboKey: string;
  total: number;
  lastSeenAt: number;
  event: NormalizedLiveEvent;
  finalized: boolean;
};

export const DEFAULT_STREAK_WINDOW_MS = 2500;
const SEEN_EVENT_TTL_MS = 5 * 60 * 1000;
const SEEN_EVENT_LIMIT = 4000;

/**
 * Deduplicates connector events and aggregates gift streaks.
 *
 * A streak is keyed by `comboId` when the connector reports one, otherwise by
 * sender plus gift id. `repeatCount` is treated as a running total, so late or
 * out-of-order frames can never lower it and never fire a second effect.
 */
export class GiftStreakTracker {
  private readonly seenEvents = new Map<string, number>();
  private readonly streaks = new Map<string, StreakRecord>();

  constructor(private readonly windowMs = DEFAULT_STREAK_WINDOW_MS) {}

  /** True when the event id was already handled. */
  isDuplicate(eventId: string, now = Date.now()): boolean {
    this.pruneSeen(now);
    return this.seenEvents.has(eventId);
  }

  observe(event: NormalizedLiveEvent, now = event.receivedAt): StreakObservation {
    const comboKey = comboKeyFor(event);
    if (this.isDuplicate(event.eventId, now)) {
      return { kind: "duplicate", comboKey };
    }
    this.seenEvents.set(event.eventId, now);

    const repeatCount = Math.max(1, event.gift?.repeatCount ?? 1);
    const existing = this.streaks.get(comboKey);

    if (!existing || now - existing.lastSeenAt > this.windowMs) {
      if (existing) this.streaks.delete(comboKey);
      const record: StreakRecord = {
        comboKey,
        total: repeatCount,
        lastSeenAt: now,
        event,
        finalized: false,
      };
      if (event.gift?.comboFinal === true) {
        record.finalized = true;
        this.streaks.delete(comboKey);
        return { kind: "final", comboKey, total: repeatCount, delta: repeatCount };
      }
      this.streaks.set(comboKey, record);
      return { kind: "progress", comboKey, total: repeatCount, delta: repeatCount };
    }

    // Late or out-of-order frames must not reduce the total.
    const total = Math.max(existing.total, repeatCount);
    const delta = total - existing.total;
    existing.total = total;
    existing.lastSeenAt = now;
    existing.event = event;

    if (event.gift?.comboFinal === true) {
      existing.finalized = true;
      this.streaks.delete(comboKey);
      return { kind: "final", comboKey, total, delta };
    }
    return { kind: "progress", comboKey, total, delta };
  }

  /**
   * Finalizes every streak whose window elapsed. Connectors that never send a
   * combo-final marker (the NOEMA bridge is one of them) rely on this.
   */
  collectExpired(now = Date.now()): FinalizedStreak[] {
    const finished: FinalizedStreak[] = [];
    for (const [key, record] of this.streaks) {
      if (now - record.lastSeenAt <= this.windowMs) continue;
      this.streaks.delete(key);
      if (record.finalized) continue;
      finished.push({
        comboKey: key,
        total: record.total,
        event: record.event,
      });
    }
    return finished;
  }

  /** Streaks currently in flight — used by the live counter in the feedback. */
  getOpenStreak(comboKey: string): number {
    return this.streaks.get(comboKey)?.total ?? 0;
  }

  reset(): void {
    this.seenEvents.clear();
    this.streaks.clear();
  }

  private pruneSeen(now: number): void {
    if (this.seenEvents.size < SEEN_EVENT_LIMIT) {
      if (this.seenEvents.size < 512) return;
    }
    for (const [id, seenAt] of this.seenEvents) {
      if (now - seenAt > SEEN_EVENT_TTL_MS) this.seenEvents.delete(id);
    }
    while (this.seenEvents.size > SEEN_EVENT_LIMIT) {
      const oldest = this.seenEvents.keys().next();
      if (oldest.done) break;
      this.seenEvents.delete(oldest.value);
    }
  }
}

export function comboKeyFor(event: NormalizedLiveEvent): string {
  if (event.gift?.comboId) return `combo:${event.gift.comboId}`;
  if (event.gift) return `gift:${event.actor.id}:${event.gift.giftId}`;
  return `${event.kind}:${event.actor.id}`;
}
