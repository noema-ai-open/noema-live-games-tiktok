import type { CommandPriority, GameCommand } from "@noema/event-protocol";

export type PendingCommand = {
  priority: CommandPriority;
  command: GameCommand;
};

const ORDER: readonly CommandPriority[] = ["critical", "normal", "low"];

/**
 * Buffers commands for one dispatch step so a premium gift never waits behind
 * a burst of likes.
 *
 * Ordering is a pure function of (priority, arrival index): critical first,
 * then normal, then low, each in FIFO order. Because the buffer is drained in
 * one deterministic pass before sequence numbers are assigned, replays stay
 * reproducible.
 */
export class PriorityInbox {
  private readonly lanes = new Map<CommandPriority, PendingCommand[]>([
    ["critical", []],
    ["normal", []],
    ["low", []],
  ]);

  push(command: GameCommand, priority: CommandPriority): void {
    this.lanes.get(priority)?.push({ command, priority });
  }

  size(): number {
    let total = 0;
    for (const lane of this.lanes.values()) total += lane.length;
    return total;
  }

  drain(): PendingCommand[] {
    const drained: PendingCommand[] = [];
    for (const priority of ORDER) {
      const lane = this.lanes.get(priority);
      if (!lane || lane.length === 0) continue;
      drained.push(...lane);
      lane.length = 0;
    }
    return drained;
  }

  clear(): void {
    for (const lane of this.lanes.values()) lane.length = 0;
  }
}
