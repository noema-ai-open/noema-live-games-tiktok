import { describe, expect, it } from "vitest";
import { loadSettings, migrateSettings } from "../src/config/appSettings";
import { resolveViewMode, shouldAutoStart } from "../src/config/viewMode";
import { ConnectorManager } from "../src/connectors/ConnectorManager";
import { RulesEngine } from "../src/gifts/RulesEngine";
import { createDefaultCatalog } from "../src/gifts/giftCatalog";
import { Simulation } from "../src/simulation/Simulation";
import { LiveSession } from "../src/systems/LiveSession";

function createSession(seed = 21) {
  const simulation = new Simulation(seed);
  const connectors = new ConnectorManager();
  const rules = new RulesEngine({ catalog: createDefaultCatalog(), streakWindowMs: 50 });
  const live = new LiveSession(simulation, connectors, rules);
  live.start();
  connectors.use("mock");
  simulation.startRound(seed);
  return { simulation, connectors, rules, live };
}

function advanceToBlock(simulation: Simulation): void {
  for (let index = 0; index < 1000 && simulation.state.heroState !== "blocked"; index += 1) {
    simulation.step();
  }
  expect(simulation.state.heroState).toBe("blocked");
}

describe("live session", () => {
  it("turns a final Rose gift into one ordered jump command", () => {
    const { simulation, connectors, live } = createSession();
    advanceToBlock(simulation);
    connectors.mock.injectGift({
      giftId: "name:rose",
      giftName: "Rose",
      coinValue: 1,
      comboFinal: true,
    });
    expect(live.dispatch()).toBe(1);
    simulation.step();
    expect(simulation.state.heroState).toBe("jumping");
    expect(simulation.commandHistory.at(-1)?.command.type).toBe("place_jump_field");
  });

  it("passes mock chat votes as ChatEvents, never GiftEvents", () => {
    const { simulation, connectors, live } = createSession();
    const event = connectors.mock.injectChat("2");
    expect(event.kind).toBe("chat");
    live.dispatch();
    simulation.step();
    expect(simulation.commandHistory.at(-1)?.command).toMatchObject({
      type: "route_vote",
      choice: "right",
    });
  });

  it("keeps sequence numbers monotonic across mixed priorities", () => {
    const { simulation, connectors, live } = createSession();
    connectors.mock.injectSimple("like", undefined, 5);
    connectors.mock.injectGift({
      giftId: "name:galaxy",
      giftName: "Galaxy",
      coinValue: 1000,
      comboFinal: true,
    });
    connectors.mock.injectSimple("follow");
    live.dispatch();
    simulation.step();
    const sequences = simulation.commandHistory.map((item) => item.sequence);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
    expect(simulation.commandHistory[0]?.command.type).toBe("tsar_bomb");
  });

  it("clears live rule state on reset without replacing connectors", () => {
    const { simulation, connectors, rules, live } = createSession(77);
    const activeConnector = connectors.getActiveId();
    connectors.mock.injectGift({
      giftId: "name:rose",
      giftName: "Rose",
      coinValue: 1,
      comboFinal: true,
    });
    live.dispatch();
    simulation.step();
    rules.reset();
    simulation.submit({ type: "reset" });
    simulation.step();
    expect(simulation.state.tick).toBe(0);
    expect(simulation.commandHistory).toHaveLength(0);
    expect(connectors.getActiveId()).toBe(activeConnector);
  });
});

describe("view and settings compatibility", () => {
  it("keeps operator and stream entry points", () => {
    expect(resolveViewMode("?view=stream")).toBe("stream");
    expect(resolveViewMode("?view=operator")).toBe("operator");
    expect(shouldAutoStart("?autostart=1")).toBe(true);
  });

  it("keeps the local NOEMA bridge default on 127.0.0.1", () => {
    const settings = loadSettings({
      getItem: () => null,
      setItem: () => undefined,
    });
    expect(settings.bridgeAddress).toBe("http://127.0.0.1:8765");
    expect(
      migrateSettings({ bridgeAddress: " http://127.0.0.1:9000 " }).bridgeAddress,
    ).toBe("http://127.0.0.1:9000");
  });
});
