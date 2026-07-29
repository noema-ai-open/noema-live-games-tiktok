import type { NormalizedLiveEvent } from "@noema/event-protocol";
import type { Connector } from "./Connector";
import { MockConnector } from "./MockConnector";
import { NoemaLiveBridgeConnector } from "./NoemaLiveBridgeConnector";
import {
  DEFAULT_BRIDGE_ADDRESS,
  type ConnectionSnapshot,
  type ConnectorId,
  type EventListener,
  type StatusListener,
} from "./connectionTypes";

/**
 * Owns exactly one active connector and forwards its normalized events to the
 * game. Switching connectors always tears down the previous subscriptions, so
 * no event is delivered twice.
 */
export class ConnectorManager {
  readonly mock = new MockConnector();
  readonly bridge: NoemaLiveBridgeConnector;

  private active: Connector | null = null;
  private unsubscribeEvent: (() => void) | null = null;
  private unsubscribeStatus: (() => void) | null = null;
  private readonly eventListeners = new Set<EventListener>();
  private readonly statusListeners = new Set<StatusListener>();

  constructor(bridgeAddress = DEFAULT_BRIDGE_ADDRESS) {
    this.bridge = new NoemaLiveBridgeConnector({ address: bridgeAddress });
  }

  onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    const snapshot = this.getSnapshot();
    if (snapshot) listener(snapshot);
    return () => this.statusListeners.delete(listener);
  }

  getActiveId(): ConnectorId | null {
    return this.active?.id ?? null;
  }

  getSnapshot(): ConnectionSnapshot | null {
    return this.active?.getSnapshot() ?? null;
  }

  /**
   * Delivers an operator-generated mock event while preserving the active
   * connector. When mock is active it has already forwarded the event through
   * its normal subscription, so forwarding it again would create a duplicate.
   */
  forwardOperatorTestEvent(event: NormalizedLiveEvent): void {
    if (this.active === this.mock) return;
    this.fanOutEvent(event);
  }

  use(id: ConnectorId): Connector {
    const next = id === "mock" ? this.mock : this.bridge;
    if (this.active === next) {
      next.connect();
      return next;
    }
    this.detach();
    this.active = next;
    this.unsubscribeEvent = next.onEvent((event) => this.fanOutEvent(event));
    this.unsubscribeStatus = next.onStatus((snapshot) =>
      this.fanOutStatus(snapshot),
    );
    next.connect();
    return next;
  }

  stop(): void {
    this.active?.disconnect();
    this.detach();
    this.active = null;
  }

  private detach(): void {
    this.unsubscribeEvent?.();
    this.unsubscribeStatus?.();
    this.unsubscribeEvent = null;
    this.unsubscribeStatus = null;
    if (this.active) this.active.disconnect();
  }

  private fanOutEvent(event: NormalizedLiveEvent): void {
    for (const listener of this.eventListeners) listener(event);
  }

  private fanOutStatus(snapshot: ConnectionSnapshot): void {
    for (const listener of this.statusListeners) listener(snapshot);
  }
}
