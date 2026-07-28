import { describe, expect, it } from "vitest";
import { loadSettings, migrateSettings } from "../src/config/appSettings";
import { resolveViewMode, shouldAutoStart } from "../src/config/viewMode";
import { ConnectorManager } from "../src/connectors/ConnectorManager";
import { RulesEngine } from "../src/gifts/RulesEngine";
import { createDefaultCatalog } from "../src/gifts/giftCatalog";
import { ReplayService } from "../src/replay/ReplayService";
import { Simulation } from "../src/simulation/Simulation";
import { LiveSession } from "../src/systems/LiveSession";

function createSession(seed = 21) {
  const simulation = new Simulation(seed);
  const connectors = new ConnectorManager();
  const rules = new RulesEngine({
    catalog: createDefaultCatalog(),
    streakWindowMs: 50,
  });
  const live = new LiveSession(simulation, connectors, rules);
  live.start();
  connectors.use("mock");
  simulation.startRound(seed);
  return { simulation, connectors, rules, live };
}

function advance(simulation: Simulation, ticks: number): void {
  for (let index = 0; index < ticks; index += 1) simulation.step();
}

describe("live session", () => {
  it("turns a live gift into an ordered command", () => {
    const { simulation, connectors, live } = createSession();
    connectors.mock.injectGift({
      giftId: "name:donut",
      giftName: "Donut",
      coinValue: 30,
      comboFinal: true,
    });
    live.dispatch();
    simulation.step();

    // Der Befehl schaltet einen Uebergang frei, der Aufbau braucht.
    const opened = simulation.level
      .renderState(simulation.state.tick)
      .links.filter((link) => link.buildRequired > 0 && link.open);
    expect(opened.length).toBeGreaterThan(0);
    expect(simulation.commandHistory).toHaveLength(1);
    expect(simulation.commandHistory[0]?.command.type).toBe("build_bridge");
  });

  it("keeps sequence numbers monotonic while dispatching mixed priorities", () => {
    const { simulation, connectors, live } = createSession();
    connectors.mock.injectSimple("like", undefined, 5);
    // 199 Coins ist die Schild-Stufe und damit ein kritischer Befehl.
    connectors.mock.injectGift({
      giftId: "name:herzen",
      giftName: "Herzen",
      coinValue: 199,
      comboFinal: true,
    });
    connectors.mock.injectSimple("follow");
    live.dispatch();
    simulation.step();

    const sequences = simulation.commandHistory.map((item) => item.sequence);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
    // Critical first, free engagement afterwards.
    expect(simulation.commandHistory[0]?.command.type).toBe("group_shield");
  });

  it("replays a round driven by live events deterministically", () => {
    const { simulation, connectors, live } = createSession(4242);
    const replays = new ReplayService();

    for (const [gift, coins] of [
      ["Donut", 30],
      ["Papierkranich", 99],
      ["Herzen", 199],
    ] as const) {
      connectors.mock.injectGift({
        giftId: `name:${gift.toLowerCase()}`,
        giftName: gift,
        coinValue: coins,
        comboFinal: true,
      });
      live.dispatch();
      advance(simulation, 25);
    }
    advance(simulation, 120);

    const replay = replays.capture(simulation);
    expect(replay.commands.length).toBeGreaterThan(0);
    const comparison = replays.replay(replay);
    expect(comparison.matches).toBe(true);
  });

  it("clears live state on reset so a new round starts clean", () => {
    const { simulation, connectors, rules, live } = createSession(77);
    connectors.mock.injectGift({
      giftId: "name:rose",
      giftName: "Rose",
      coinValue: 1,
      comboFinal: true,
    });
    live.dispatch();
    advance(simulation, 10);

    rules.reset();
    simulation.submit({ type: "reset" });
    simulation.step();

    expect(simulation.state.tick).toBe(0);
    expect(simulation.commandHistory).toHaveLength(0);
    expect(rules.getDroppedDuplicates()).toBe(0);
    expect(rules.inbox.size()).toBe(0);
  });

  it("blocks the ZAR-BOMBE while safe mode is on and allows it afterwards", () => {
    const { simulation, connectors, live } = createSession(99);
    simulation.submit({ type: "set_safe_mode", enabled: true });
    simulation.step();

    connectors.mock.injectGift({
      giftId: "mock_tsar_bomb",
      giftName: "ZAR-BOMBE Testgeschenk",
      coinValue: 10000,
      comboFinal: true,
    });
    live.dispatch();
    simulation.step();
    expect(simulation.state.tsarBomb.phase).toBe("idle");

    simulation.submit({ type: "set_safe_mode", enabled: false });
    simulation.step();
    simulation.submit({ type: "tsar_bomb" });
    simulation.step();
    expect(simulation.state.tsarBomb.phase).toBe("warning");
  });

  it("carries reduced motion through the command queue", () => {
    const simulation = new Simulation(5);
    simulation.startRound();
    simulation.submit({ type: "set_reduced_motion", enabled: true });
    simulation.step();
    expect(simulation.state.reducedMotion).toBe(true);
    simulation.submit({ type: "set_reduced_motion", enabled: false });
    simulation.step();
    expect(simulation.state.reducedMotion).toBe(false);
  });
});

describe("view modes", () => {
  it("selects the stream view only for an explicit request", () => {
    expect(resolveViewMode("?view=stream")).toBe("stream");
    expect(resolveViewMode("?view=operator")).toBe("operator");
    expect(resolveViewMode("")).toBe("operator");
    expect(resolveViewMode("?view=anything")).toBe("operator");
  });

  it("reads the autostart flag", () => {
    expect(shouldAutoStart("?autostart=1")).toBe(true);
    expect(shouldAutoStart("?autostart=true")).toBe(true);
    expect(shouldAutoStart("?view=stream")).toBe(false);
  });
});

describe("app settings", () => {
  it("repairs incomplete stored settings", () => {
    const migrated = migrateSettings({
      bridgeAddress: "  http://127.0.0.1:9000 ",
      lastConnector: "something-else",
      masterVolume: 4,
    });
    expect(migrated.bridgeAddress).toBe("http://127.0.0.1:9000");
    expect(migrated.lastConnector).toBe("mock");
    expect(migrated.masterVolume).toBe(1);
    expect(migrated.version).toBe(1);
  });

  it("falls back to defaults when nothing is stored", () => {
    const settings = loadSettings({
      getItem: () => null,
      setItem: () => undefined,
    });
    expect(settings.bridgeAddress).toBe("http://127.0.0.1:8765");
  });
});
