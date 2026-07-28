import type {
  CommandPriority,
  NormalizedLiveEvent,
} from "@noema/event-protocol";
import { getAction, type ActionDefinition, type GameActionId } from "./actions";
import { FeedbackBus, type FeedbackTier, type GiftFeedback } from "./FeedbackBus";
import {
  resolveGift,
  type GiftCatalogConfig,
  type GiftMappingEntry,
} from "./giftCatalog";
import { GiftStreakTracker, comboKeyFor } from "./GiftStreakTracker";
import { PriorityInbox } from "./PriorityInbox";

export type UnknownGift = {
  giftId: string;
  giftName: string;
  count: number;
  lastSeenAt: number;
};

export type RulesEngineOptions = {
  catalog: GiftCatalogConfig;
  feedback?: FeedbackBus;
  inbox?: PriorityInbox;
  streakWindowMs?: number;
};

/**
 * Converts normalized live events into prioritized game commands.
 *
 * Everything that reaches the simulation passes through here: schema is
 * already guaranteed by the connector, this layer adds catalog mapping,
 * streak finalization, cooldowns and priority.
 */
export class RulesEngine {
  readonly inbox: PriorityInbox;
  readonly feedback: FeedbackBus;

  private catalog: GiftCatalogConfig;
  private readonly tracker: GiftStreakTracker;
  private readonly cooldowns = new Map<string, number>();
  private readonly unknownGifts = new Map<string, UnknownGift>();
  private droppedDuplicates = 0;

  constructor(options: RulesEngineOptions) {
    this.catalog = options.catalog;
    this.feedback = options.feedback ?? new FeedbackBus();
    this.inbox = options.inbox ?? new PriorityInbox();
    this.tracker = new GiftStreakTracker(options.streakWindowMs);
  }

  setCatalog(catalog: GiftCatalogConfig): void {
    this.catalog = catalog;
  }

  getCatalog(): GiftCatalogConfig {
    return this.catalog;
  }

  getUnknownGifts(): UnknownGift[] {
    return [...this.unknownGifts.values()].sort(
      (a, b) => b.lastSeenAt - a.lastSeenAt,
    );
  }

  getDroppedDuplicates(): number {
    return this.droppedDuplicates;
  }

  reset(): void {
    this.tracker.reset();
    this.cooldowns.clear();
    this.inbox.clear();
    this.droppedDuplicates = 0;
  }

  /** Entry point for every normalized event. */
  handle(event: NormalizedLiveEvent, now = event.receivedAt): void {
    if (event.kind === "gift") {
      this.handleGift(event, now);
      return;
    }
    this.handleFree(event, now);
  }

  /**
   * Must be called regularly (once per rendered frame is enough). It finalizes
   * streaks whose window elapsed, because the NOEMA bridge does not report a
   * combo-final marker.
   */
  tick(now = Date.now()): void {
    for (const finished of this.tracker.collectExpired(now)) {
      this.applyGiftEffect(finished.event, finished.total, now, true);
    }
  }

  private handleFree(event: NormalizedLiveEvent, now: number): void {
    if (this.tracker.isDuplicate(event.eventId, now)) {
      this.droppedDuplicates += 1;
      return;
    }
    this.tracker.observe(event, now);
    if (event.kind === "chat" || event.kind === "subscription") return;

    const config =
      event.kind === "like"
        ? this.catalog.free.like
        : event.kind === "follow"
          ? this.catalog.free.follow
          : this.catalog.free.share;

    const action = getAction(config.action);
    const multiplier =
      event.kind === "like" ? Math.min(10, event.likeCount ?? 1) : 1;
    const command = action.build(config.strength * multiplier, event.actor);
    if (!command) return;
    // Free engagement always uses the low lane.
    this.inbox.push(command, "low");
  }

  private handleGift(event: NormalizedLiveEvent, now: number): void {
    const gift = event.gift;
    if (!gift) return;

    const observation = this.tracker.observe(event, now);
    if (observation.kind === "duplicate") {
      this.droppedDuplicates += 1;
      return;
    }

    const resolution = resolveGift(this.catalog, gift);
    if (resolution.kind === "unknown") {
      this.logUnknownGift(gift.giftId, gift.giftName, now);
      this.publishFeedback(event, observation.total, {
        icon: "❔",
        effectLabel: "NOCH NICHT ZUGEORDNET",
        tier: "small",
        applied: false,
      });
      return;
    }
    if (resolution.kind === "disabled") {
      this.publishFeedback(event, observation.total, {
        icon: "⏸",
        effectLabel: "DEAKTIVIERT",
        tier: "small",
        applied: false,
      });
      return;
    }

    const definition = getAction(resolution.entry.action);
    // Immediate acknowledgement — this happens on the same task as the event.
    this.publishFeedback(event, observation.total, {
      icon: definition.icon,
      effectLabel: definition.label,
      tier: tierFor(definition, resolution.entry, observation.total),
      applied: observation.kind === "final",
    });

    if (observation.kind === "final") {
      this.applyGiftEffect(event, observation.total, now, false);
    }
  }

  /** Fires the mapped command exactly once per finalized streak. */
  private applyGiftEffect(
    event: NormalizedLiveEvent,
    total: number,
    now: number,
    republishFeedback: boolean,
  ): void {
    const gift = event.gift;
    if (!gift) return;
    const resolution = resolveGift(this.catalog, gift);
    if (resolution.kind !== "mapped") return;

    const entry = resolution.entry;
    const definition = getAction(entry.action);
    if (this.isOnCooldown(entry.action, now)) {
      if (republishFeedback) {
        this.publishFeedback(event, total, {
          icon: "⏳",
          effectLabel: `${definition.label} · ABKLINGZEIT`,
          tier: "small",
          applied: false,
        });
      }
      return;
    }

    const strength = scaleStrength(definition.id, entry.strength, total);
    const command = definition.build(strength, event.actor);
    if (!command) return;

    this.startCooldown(entry.action, entry.cooldownSeconds, now);
    this.inbox.push(command, priorityFor(definition));

    if (republishFeedback) {
      this.publishFeedback(event, total, {
        icon: definition.icon,
        effectLabel: definition.label,
        tier: tierFor(definition, entry, total),
        applied: true,
      });
    }
  }

  private publishFeedback(
    event: NormalizedLiveEvent,
    total: number,
    detail: {
      icon: string;
      effectLabel: string;
      tier: FeedbackTier;
      applied: boolean;
    },
  ): void {
    const payload: GiftFeedback = {
      key: comboKeyFor(event),
      tier: detail.tier,
      icon: detail.icon,
      sender: event.actor.displayName ?? event.actor.username,
      giftLabel: event.gift?.giftName ?? event.kind,
      effectLabel: detail.effectLabel,
      repeatCount: total,
      createdAt: Date.now(),
      applied: detail.applied,
    };
    this.feedback.publish(payload);
  }

  private logUnknownGift(giftId: string, giftName: string, now: number): void {
    const existing = this.unknownGifts.get(giftId);
    if (existing) {
      existing.count += 1;
      existing.lastSeenAt = now;
      return;
    }
    this.unknownGifts.set(giftId, {
      giftId,
      giftName,
      count: 1,
      lastSeenAt: now,
    });
  }

  private isOnCooldown(action: GameActionId, now: number): boolean {
    const until = this.cooldowns.get(action);
    return until !== undefined && now < until;
  }

  private startCooldown(
    action: GameActionId,
    seconds: number,
    now: number,
  ): void {
    if (seconds <= 0) return;
    this.cooldowns.set(action, now + seconds * 1000);
  }
}

function scaleStrength(
  action: GameActionId,
  baseStrength: number,
  repeatCount: number,
): number {
  // Repeat counts scale continuous effects, but never one-shot structures.
  const scalable: GameActionId[] = ["repair", "team_energy"];
  if (!scalable.includes(action)) return baseStrength;
  return baseStrength * Math.min(20, Math.max(1, repeatCount));
}

function priorityFor(definition: ActionDefinition): CommandPriority {
  // A long streak of a normal gift stays normal — it must not outrank a bomb.
  return definition.priority;
}

function tierFor(
  definition: ActionDefinition,
  entry: GiftMappingEntry,
  total: number,
): FeedbackTier {
  if (definition.category === "catastrophe") return "large";
  const coins = entry.coinValue * Math.max(1, total);
  if (coins >= 500 || definition.priority === "critical") return "medium";
  return "small";
}
