import { PROTOCOL_VERSION } from "@noema/event-protocol";
import { describe, expect, it } from "vitest";
import {
  CommandQueue,
  OPERATOR_ACTOR,
} from "../src/commands/CommandQueue";

describe("CommandQueue", () => {
  it("assigns monotonic sequence numbers and drains in order", () => {
    const queue = new CommandQueue();
    const first = queue.enqueue({ type: "pause" }, 4);
    const second = queue.enqueue({ type: "resume" }, 4);
    expect(first.sequence).toBe(1);
    expect(second.sequence).toBe(2);
    expect(queue.drain(4).map((item) => item.sequence)).toEqual([1, 2]);
  });

  it("orders recorded commands by sequence, not insertion order", () => {
    const queue = new CommandQueue();
    queue.enqueueRecorded({
      protocolVersion: PROTOCOL_VERSION,
      sequence: 9,
      tick: 2,
      actor: OPERATOR_ACTOR,
      command: { type: "resume" },
    });
    queue.enqueueRecorded({
      protocolVersion: PROTOCOL_VERSION,
      sequence: 8,
      tick: 2,
      actor: OPERATOR_ACTOR,
      command: { type: "pause" },
    });
    expect(queue.drain(2).map((item) => item.sequence)).toEqual([8, 9]);
  });
});
