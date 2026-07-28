import { describe, expect, it } from "vitest";
import { LEVEL_GRAPH, getLink } from "../src/config/levelGraph";
import { LevelRuntime } from "../src/simulation/levelRuntime";
import {
  assignQueueSlots,
  createWalker,
  pushOffPlatform,
  stepWalker,
  type Walker,
  type WalkerState,
} from "../src/simulation/walker";

/**
 * TypeScript verengt walker.state nach einer direkten Zuweisung und weiss
 * nicht, dass stepWalker den Zustand aendert. Der Umweg hebt die Verengung auf.
 */
const stateOf = (walker: Walker): WalkerState => walker.state;

const SPEED = 1.6;

function makeWalkers(count: number): Walker[] {
  return Array.from({ length: count }, (_, index) =>
    createWalker(LEVEL_GRAPH, index + 1, SPEED, index * 6),
  );
}

/** Lässt die Welt laufen; `build` darf pro Tick Aufbau leisten. */
function simulate(
  walkers: Walker[],
  runtime: LevelRuntime,
  ticks: number,
  build?: (runtime: LevelRuntime, tick: number) => void,
): void {
  for (let tick = 0; tick < ticks; tick += 1) {
    build?.(runtime, tick);
    runtime.step(tick, false);
    assignQueueSlots(walkers);
    for (const walker of walkers) {
      stepWalker(walker, LEVEL_GRAPH, runtime, tick);
    }
    const counts = new Map<string, number>();
    for (const walker of walkers) {
      if (walker.state === "waiting" && walker.linkId) {
        counts.set(walker.linkId, (counts.get(walker.linkId) ?? 0) + 1);
      }
    }
    for (const link of LEVEL_GRAPH.links) {
      runtime.setWaiting(link.id, counts.get(link.id) ?? 0);
    }
  }
}

describe("Level-Graph", () => {
  it("verbindet jeden Link mit vorhandenen Plattformen", () => {
    const ids = new Set(LEVEL_GRAPH.platforms.map((platform) => platform.id));
    for (const link of LEVEL_GRAPH.links) {
      expect(ids.has(link.from), `from ${link.id}`).toBe(true);
      expect(ids.has(link.to), `to ${link.id}`).toBe(true);
    }
  });

  it("legt jeden Übergang auf seine Plattformen", () => {
    for (const link of LEVEL_GRAPH.links) {
      const from = LEVEL_GRAPH.platforms.find((p) => p.id === link.from)!;
      const to = LEVEL_GRAPH.platforms.find((p) => p.id === link.to)!;
      expect(link.fromX).toBeGreaterThanOrEqual(from.xStart);
      expect(link.fromX).toBeLessThanOrEqual(from.xEnd);
      expect(link.toX).toBeGreaterThanOrEqual(to.xStart);
      expect(link.toX).toBeLessThanOrEqual(to.xEnd);
    }
  });
});

describe("Roboter auf dem Turm", () => {
  it("kommt ohne Hilfe nicht am Ausgang an und staut sich sichtbar", () => {
    const runtime = new LevelRuntime();
    const walkers = makeWalkers(12);
    simulate(walkers, runtime, 3000);

    expect(walkers.every((walker) => walker.state !== "rescued")).toBe(true);
    const waiting = walkers.filter((walker) => walker.state === "waiting");
    expect(waiting.length).toBeGreaterThan(0);
    // Der Stau steht an einem Übergang, der Aufbau braucht.
    for (const walker of waiting) {
      expect(getLink(LEVEL_GRAPH, walker.linkId!).buildRequired).toBeGreaterThan(0);
    }
  });

  it("stellt die Wartenden hintereinander an", () => {
    const runtime = new LevelRuntime();
    const walkers = makeWalkers(8);
    simulate(walkers, runtime, 1500);
    const waiting = walkers
      .filter((walker) => walker.state === "waiting")
      .sort((a, b) => a.queueSlot - b.queueSlot);
    if (waiting.length >= 2) {
      const positions = new Set(waiting.map((walker) => Math.round(walker.x)));
      expect(positions.size).toBeGreaterThan(1);
    }
  });

  it("erreicht mit Aufbauhilfe den Ausgang", () => {
    const runtime = new LevelRuntime();
    const walkers = makeWalkers(12);
    simulate(walkers, runtime, 6000, (level, tick) => {
      // Alle zwei Sekunden ein wenig Aufbau, wie eine aktive Zuschauerschaft.
      if (tick % 60 !== 0) return;
      const closed = level.closedBuildables(tick);
      const target = closed[0];
      if (target) level.build(target.id, 12, tick);
    });
    expect(walkers.filter((walker) => walker.state === "rescued").length)
      .toBeGreaterThan(0);
  });

  it("nimmt den Lift und faehrt sichtbar mit", () => {
    const runtime = new LevelRuntime();
    const walker = createWalker(LEVEL_GRAPH, 1, SPEED, 0);
    const lift = getLink(LEVEL_GRAPH, "l-lift");
    // Direkt auf das Kerndeck setzen, damit der Lift dran ist.
    walker.platformId = lift.from;
    walker.x = lift.fromX - 60;
    walker.direction = 1;
    walker.state = "walking";

    let rode = false;
    for (let tick = 0; tick < 600; tick += 1) {
      runtime.step(tick, false);
      stepWalker(walker, LEVEL_GRAPH, runtime, tick);
      if (stateOf(walker) === "riding") rode = true;
      if (walker.platformId === lift.to) break;
    }
    expect(rode).toBe(true);
    expect(walker.platformId).toBe(lift.to);
  });

  it("faengt einen heruntergestossenen Roboter auf dem Deck darunter auf", () => {
    const runtime = new LevelRuntime();
    const walker = createWalker(LEVEL_GRAPH, 1, SPEED, 0);
    walker.state = "walking";
    walker.platformId = "p4";
    walker.x = 300;
    walker.y = 720;

    expect(pushOffPlatform(walker, 0)).toBe(true);
    for (let tick = 0; tick < 200; tick += 1) {
      stepWalker(walker, LEVEL_GRAPH, runtime, tick);
      if (stateOf(walker) === "walking") break;
    }
    expect(stateOf(walker)).toBe("walking");
    expect(walker.platformId).not.toBe("p4");
  });

  it("schuetzt Roboter unter Schild vor dem Sturz", () => {
    const walker = createWalker(LEVEL_GRAPH, 1, SPEED, 0);
    walker.state = "walking";
    walker.protectedUntilTick = 100;
    expect(pushOffPlatform(walker, 10)).toBe(false);
    expect(stateOf(walker)).toBe("walking");
  });

  it("laeuft deterministisch", () => {
    const runA = () => {
      const runtime = new LevelRuntime();
      const walkers = makeWalkers(10);
      simulate(walkers, runtime, 2000, (level, tick) => {
        if (tick % 90 === 0) {
          const closed = level.closedBuildables(tick)[0];
          if (closed) level.build(closed.id, 10, tick);
        }
      });
      return walkers.map((w) => `${w.id}:${w.state}:${Math.round(w.x)}:${Math.round(w.y)}`).join("|");
    };
    expect(runA()).toBe(runA());
  });
});
