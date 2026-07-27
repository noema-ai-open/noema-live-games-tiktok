import { describe, expect, it } from "vitest";
import { SeededRandom } from "../src/simulation/rng";

describe("SeededRandom", () => {
  it("produces the same values for the same seed", () => {
    const first = new SeededRandom(42);
    const second = new SeededRandom(42);
    expect(Array.from({ length: 20 }, () => first.next())).toEqual(
      Array.from({ length: 20 }, () => second.next()),
    );
  });

  it("stays inside inclusive integer bounds", () => {
    const random = new SeededRandom(99);
    const values = Array.from({ length: 100 }, () => random.integer(3, 7));
    expect(values.every((value) => value >= 3 && value <= 7)).toBe(true);
  });
});
