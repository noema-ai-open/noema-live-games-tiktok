import type { NormalizedLiveEvent } from "@noema/event-protocol";
import type { ConnectorManager } from "../connectors/ConnectorManager";
import type { RulesEngine } from "../gifts/RulesEngine";
import type { Simulation } from "../simulation/Simulation";

/**
 * Glue between live events and the deterministic simulation.
 *
 * Live event → connector → rules engine → priority inbox → ordered command.
 * Nothing here touches Phaser objects.
 */
export class LiveSession {
  private unsubscribe: (() => void) | null = null;
  private lastEvents: NormalizedLiveEvent[] = [];

  constructor(
    private readonly simulation: Simulation,
    private readonly connectors: ConnectorManager,
    private readonly rules: RulesEngine,
  ) {}

  start(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.connectors.onEvent((event) => {
      this.lastEvents.push(event);
      if (this.lastEvents.length > 50) this.lastEvents.shift();
      this.rules.handle(event);
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  getRecentEvents(): readonly NormalizedLiveEvent[] {
    return this.lastEvents;
  }

  /** Drains the priority inbox into the ordered command queue. */
  dispatch(now = Date.now()): number {
    this.rules.tick(now);
    const pending = this.rules.inbox.drain();
    for (const item of pending) this.simulation.submit(item.command);
    return pending.length;
  }
}
