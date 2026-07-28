import { describe, expect, it } from "vitest";
import { TICKS, WORKER_COUNT } from "../src/config/gameConfig";
import { LEVEL_GRAPH } from "../src/config/levelGraph";
import { Simulation } from "../src/simulation/Simulation";

/** Alle Uebergaenge, die Aufbau brauchen und gerade offen sind. */
function openBuildables(simulation: Simulation): number {
  return simulation.level
    .renderState(simulation.state.tick)
    .links.filter((link) => link.buildRequired > 0 && link.open).length;
}

describe("Simulation", () => {
  it("laesst die Roboter starten und laufen", () => {
    const simulation = new Simulation(7);
    simulation.startRound();
    for (let index = 0; index < 60; index += 1) simulation.step();
    const first = simulation.workers[0]!;
    expect(first.state).not.toBe("spawning");
    expect(simulation.getActiveCount()).toBe(WORKER_COUNT);
  });

  it("staut die Roboter vor einem gesperrten Uebergang", () => {
    const simulation = new Simulation(8);
    simulation.startRound();
    for (let index = 0; index < 900; index += 1) simulation.step();
    const waiting = simulation.workers.filter(
      (worker) => worker.state === "waiting",
    );
    expect(waiting.length).toBeGreaterThan(0);
    expect(simulation.getHotspot()?.waiting).toBeGreaterThan(0);
  });

  it("schaltet mit einem Geschenk einen Uebergang frei", () => {
    const simulation = new Simulation(9);
    simulation.startRound();
    for (let index = 0; index < 600; index += 1) simulation.step();
    expect(openBuildables(simulation)).toBe(0);

    simulation.submit({ type: "build_bridge", zoneId: "zone-1" });
    simulation.step();
    expect(openBuildables(simulation)).toBe(1);
  });

  it("baut dort, wo die meisten warten", () => {
    const simulation = new Simulation(10);
    simulation.startRound();
    for (let index = 0; index < 900; index += 1) simulation.step();
    const hotspot = simulation.getHotspot();
    expect(hotspot).not.toBeNull();

    simulation.submit({ type: "repair_structure", amount: 999 });
    simulation.step();
    const state = simulation.level.renderState(simulation.state.tick);
    expect(state.links.find((link) => link.id === hotspot!.link.id)?.open).toBe(
      true,
    );
  });

  it("laedt Teamenergie und schaltet bei 100 selbst frei", () => {
    const simulation = new Simulation(11);
    simulation.startRound();
    for (let index = 0; index < 600; index += 1) simulation.step();
    for (let index = 0; index < 10; index += 1) {
      simulation.submit({ type: "add_team_energy", amount: 12 });
      simulation.step();
    }
    expect(openBuildables(simulation)).toBeGreaterThan(0);
    expect(simulation.state.teamEnergy).toBeLessThan(100);
  });

  it("schuetzt alle Roboter mit dem Team-Schild", () => {
    const simulation = new Simulation(12);
    simulation.startRound();
    simulation.submit({
      type: "group_shield",
      durationTicks: TICKS.second * 10,
    });
    simulation.step();
    expect(
      simulation.workers.every(
        (worker) => worker.protectedUntilTick > simulation.state.tick,
      ),
    ).toBe(true);
  });

  it("blockiert zerstoerende Befehle im Safe Mode", () => {
    const simulation = new Simulation(13);
    simulation.startRound();
    simulation.submit({ type: "build_bridge", zoneId: "zone-1" });
    simulation.submit({ type: "set_safe_mode", enabled: true });
    simulation.step();
    const before = openBuildables(simulation);

    simulation.submit({ type: "collapse_section" });
    simulation.step();
    expect(openBuildables(simulation)).toBe(before);
  });

  it("zerstoert einen gebauten Uebergang durch Sabotage", () => {
    const simulation = new Simulation(14);
    simulation.startRound();
    simulation.submit({ type: "build_bridge", zoneId: "zone-1" });
    simulation.step();
    expect(openBuildables(simulation)).toBe(1);

    simulation.submit({ type: "collapse_section" });
    simulation.step();
    expect(openBuildables(simulation)).toBe(0);
  });

  it("haelt die ZAR-BOMBE-Abklingzeit ein", () => {
    const simulation = new Simulation(15);
    simulation.startRound();
    simulation.submit({ type: "tsar_bomb" });
    simulation.step();
    const firstStart = simulation.state.tsarBomb.startedTick;
    simulation.submit({ type: "tsar_bomb" });
    simulation.step();
    expect(simulation.state.tsarBomb.startedTick).toBe(firstStart);
  });

  it("laesst geschuetzte Roboter den Einschlag ueberstehen", () => {
    const simulation = new Simulation(16);
    simulation.startRound();
    simulation.submit({
      type: "group_shield",
      durationTicks: TICKS.second * 60,
    });
    simulation.submit({ type: "tsar_bomb" });
    simulation.step();
    for (
      let index = 0;
      index < TICKS.tsarWarning + TICKS.tsarDescent + 2;
      index += 1
    ) {
      simulation.step();
    }
    expect(simulation.state.tsarBomb.impactApplied).toBe(true);
    expect(
      simulation.workers.every((worker) => worker.state !== "falling"),
    ).toBe(true);
  });

  it("setzt die Runde zurueck, ohne den Seed zu aendern", () => {
    const simulation = new Simulation(17);
    simulation.startRound();
    simulation.submit({ type: "build_bridge", zoneId: "zone-1" });
    for (let index = 0; index < 100; index += 1) simulation.step();

    simulation.submit({ type: "reset" });
    simulation.step();
    expect(simulation.state.tick).toBe(0);
    expect(simulation.state.seed).toBe(17);
    expect(simulation.commandHistory).toHaveLength(0);
    expect(openBuildables(simulation)).toBe(0);
    expect(
      simulation.workers.every((worker) => worker.state === "spawning"),
    ).toBe(true);
  });

  it("kennt jeden Uebergang aus dem Levelgraphen", () => {
    const simulation = new Simulation(18);
    const state = simulation.level.renderState(0);
    expect(state.links).toHaveLength(LEVEL_GRAPH.links.length);
  });
});
