import { describe, expect, it } from "vitest";
import { RouteVoteController } from "../src/adventure/RouteVoteController";

describe("RouteVoteController", () => {
  it("counts left and right correctly", () => {
    const vote = new RouteVoteController();
    vote.start(10, 300);
    expect(vote.vote("event-1", "viewer-1", "left", 20)).toBe(true);
    expect(vote.vote("event-2", "viewer-2", "right", 21)).toBe(true);
    expect(vote.vote("event-3", "viewer-3", "left", 22)).toBe(true);
    expect(vote.state).toMatchObject({ left: 2, right: 1 });
    expect(vote.finish(310)).toBe("left");
  });

  it("does not count duplicate events or duplicate viewers", () => {
    const vote = new RouteVoteController();
    vote.start(0, 300);
    expect(vote.vote("same", "viewer-1", "left", 1)).toBe(true);
    expect(vote.vote("same", "viewer-2", "right", 2)).toBe(false);
    expect(vote.vote("different", "viewer-1", "right", 3)).toBe(false);
    expect(vote.state).toMatchObject({ left: 1, right: 0 });
  });
});
