import type { NormalizedLiveEvent } from "@noema/event-protocol";
import type {
  ConnectionSnapshot,
  ConnectionStatus,
  ConnectorId,
  EventListener,
  StatusListener,
} from "./connectionTypes";

/**
 * A connector produces normalized live events and nothing else. Raw bridge or
 * platform payloads never leave the connector.
 */
export interface Connector {
  readonly id: ConnectorId;
  connect(): void;
  disconnect(): void;
  getSnapshot(): ConnectionSnapshot;
  onEvent(listener: EventListener): () => void;
  onStatus(listener: StatusListener): () => void;
}

/**
 * Shared listener bookkeeping. Sets are used so a listener registered twice
 * still only fires once — reconnects must never multiply callbacks.
 */
export abstract class BaseConnector implements Connector {
  abstract readonly id: ConnectorId;

  protected status: ConnectionStatus = "offline";
  protected detail = "Nicht verbunden";
  protected profile: string | null = null;
  protected mode: string | null = null;
  protected reconnectAttempts = 0;
  protected totalEvents = 0;
  protected lastEventLabel: string | null = null;
  protected lastEventAt: number | null = null;

  private readonly eventListeners = new Set<EventListener>();
  private readonly statusListeners = new Set<StatusListener>();
  private recentEventTimes: number[] = [];

  abstract connect(): void;
  abstract disconnect(): void;

  onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.getSnapshot());
    return () => this.statusListeners.delete(listener);
  }

  getSnapshot(): ConnectionSnapshot {
    return {
      connectorId: this.id,
      status: this.status,
      detail: this.detail,
      profile: this.profile,
      mode: this.mode,
      eventsPerSecond: this.eventsPerSecond(),
      totalEvents: this.totalEvents,
      lastEventLabel: this.lastEventLabel,
      lastEventAt: this.lastEventAt,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  protected emitEvent(event: NormalizedLiveEvent): void {
    this.totalEvents += 1;
    this.lastEventAt = event.receivedAt;
    this.lastEventLabel = describeEvent(event);
    this.recentEventTimes.push(event.receivedAt);
    if (this.recentEventTimes.length > 240) {
      this.recentEventTimes = this.recentEventTimes.slice(-240);
    }
    for (const listener of this.eventListeners) listener(event);
  }

  protected setStatus(status: ConnectionStatus, detail: string): void {
    this.status = status;
    this.detail = detail;
    this.publishStatus();
  }

  protected publishStatus(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.statusListeners) listener(snapshot);
  }

  protected eventsPerSecond(now = Date.now()): number {
    const cutoff = now - 5000;
    this.recentEventTimes = this.recentEventTimes.filter(
      (time) => time >= cutoff,
    );
    return Math.round((this.recentEventTimes.length / 5) * 10) / 10;
  }

  protected resetMetrics(): void {
    this.recentEventTimes = [];
    this.totalEvents = 0;
    this.lastEventLabel = null;
    this.lastEventAt = null;
  }
}

export function describeEvent(event: NormalizedLiveEvent): string {
  const name = event.actor.displayName ?? event.actor.username;
  if (event.kind === "gift" && event.gift) {
    return `${name} · ${event.gift.giftName} ×${event.gift.repeatCount}`;
  }
  if (event.kind === "like") return `${name} · ${event.likeCount ?? 1} Likes`;
  if (event.kind === "chat") return `${name} · Chat`;
  return `${name} · ${event.kind}`;
}
