import {
  PROTOCOL_VERSION,
  type GameCommand,
  type OrderedGameCommand,
  type ViewerIdentity,
} from "@noema/event-protocol";

export const OPERATOR_ACTOR: ViewerIdentity = {
  id: "local-operator",
  username: "operator",
  displayName: "Local Operator",
};

export class CommandQueue {
  private nextSequence = 1;
  private pending: OrderedGameCommand[] = [];

  enqueue(
    command: GameCommand,
    tick: number,
    actor: ViewerIdentity = OPERATOR_ACTOR,
  ): OrderedGameCommand {
    const item: OrderedGameCommand = {
      protocolVersion: PROTOCOL_VERSION,
      sequence: this.nextSequence++,
      tick,
      actor,
      command,
    };
    this.pending.push(item);
    return item;
  }

  enqueueRecorded(item: OrderedGameCommand): void {
    this.pending.push(structuredClone(item));
    this.nextSequence = Math.max(this.nextSequence, item.sequence + 1);
  }

  drain(currentTick: number): OrderedGameCommand[] {
    const ready = this.pending
      .filter((item) => item.tick <= currentTick)
      .sort((a, b) => a.sequence - b.sequence);
    const readySequences = new Set(ready.map((item) => item.sequence));
    this.pending = this.pending.filter(
      (item) => !readySequences.has(item.sequence),
    );
    return ready;
  }

  clear(resetSequence = false): void {
    this.pending = [];
    if (resetSequence) this.nextSequence = 1;
  }

  getNextSequence(): number {
    return this.nextSequence;
  }
}
