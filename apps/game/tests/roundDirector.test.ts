import { describe, expect, it } from "vitest";
import { Simulation } from "../src/simulation/Simulation";
import { RoundDirector } from "../src/systems/RoundDirector";

/** Bringt die Runde zu Ende, ohne 20 Minuten zu simulieren. */
function finishRound(simulation: Simulation): void {
  simulation.startRound(4242);
  simulation.state.remainingTicks = 1;
  simulation.step();
  simulation.step();
}

describe("Automodus", () => {
  it("startet nach dem Rundenende eine neue Runde", () => {
    const simulation = new Simulation(4242);
    const director = new RoundDirector(simulation, {
      enabled: true,
      delaySeconds: 10,
    });
    finishRound(simulation);
    expect(simulation.state.roundStatus).not.toBe("running");
    const firstSeed = simulation.state.seed;

    // Erster Durchlauf plant nur, die Wartezeit laeuft noch.
    director.tickAt(1000);
    expect(director.getCountdown(1000)).toBe(10);
    director.tickAt(5000);
    expect(simulation.state.roundStatus).not.toBe("running");

    director.tickAt(11_500);
    expect(simulation.state.roundStatus).toBe("running");
    expect(simulation.state.tick).toBe(0);
    // Neuer Seed, damit sich die Runden unterscheiden.
    expect(simulation.state.seed).not.toBe(firstSeed);
  });

  it("startet nichts, solange der Automodus aus ist", () => {
    const simulation = new Simulation(7);
    const director = new RoundDirector(simulation, {
      enabled: false,
      delaySeconds: 5,
    });
    finishRound(simulation);
    director.tickAt(1000);
    director.tickAt(60_000);
    expect(simulation.state.roundStatus).not.toBe("running");
    expect(director.getCountdown(60_000)).toBeNull();
  });

  it("meldet den Neustart, damit Aufrufer aufraeumen koennen", () => {
    const simulation = new Simulation(9);
    const seen: number[] = [];
    const director = new RoundDirector(simulation, {
      enabled: true,
      delaySeconds: 1,
      onRestart: (seed) => seen.push(seed),
    });
    finishRound(simulation);
    director.tickAt(0);
    director.tickAt(2000);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(simulation.state.seed);
  });

  it("vergisst einen geplanten Neustart, wenn wieder gespielt wird", () => {
    const simulation = new Simulation(11);
    const director = new RoundDirector(simulation, {
      enabled: true,
      delaySeconds: 10,
    });
    finishRound(simulation);
    director.tickAt(0);
    expect(director.getCountdown(0)).toBe(10);

    simulation.startRound(11);
    director.tickAt(1000);
    expect(director.getCountdown(1000)).toBeNull();
  });
});
