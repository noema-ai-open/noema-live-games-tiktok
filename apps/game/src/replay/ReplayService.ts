import type { ReplayData, RoundResult } from "../simulation/types";
import { Simulation } from "../simulation/Simulation";

export type ReplayComparison = {
  result: RoundResult;
  matches: boolean;
};

export class ReplayService {
  private lastReplay: ReplayData | null = null;

  capture(simulation: Simulation): ReplayData {
    this.lastReplay = simulation.exportReplay();
    return structuredClone(this.lastReplay);
  }

  getLastReplay(): ReplayData | null {
    return this.lastReplay ? structuredClone(this.lastReplay) : null;
  }

  exportJson(simulation?: Simulation): string {
    const replay = simulation ? this.capture(simulation) : this.lastReplay;
    if (!replay) throw new Error("No replay has been captured");
    return JSON.stringify(replay, null, 2);
  }

  importJson(json: string): ReplayData {
    const candidate = JSON.parse(json) as Partial<ReplayData>;
    if (
      candidate.formatVersion !== 1 ||
      typeof candidate.seed !== "number" ||
      typeof candidate.endTick !== "number" ||
      !Array.isArray(candidate.commands) ||
      !candidate.expectedResult
    ) {
      throw new Error("Invalid replay data");
    }
    this.lastReplay = candidate as ReplayData;
    return structuredClone(this.lastReplay);
  }

  replay(data = this.lastReplay): ReplayComparison {
    if (!data) throw new Error("No replay available");
    const simulation = new Simulation(data.seed);
    simulation.startRound(data.seed);
    for (const command of data.commands) {
      simulation.enqueueRecorded(command);
    }
    while (
      simulation.state.tick < data.endTick &&
      (simulation.state.roundStatus === "running" ||
        simulation.state.roundStatus === "paused")
    ) {
      simulation.step();
    }
    const result = simulation.getResult();
    return {
      result,
      matches:
        result.hash === data.expectedResult.hash &&
        result.rescued === data.expectedResult.rescued &&
        result.lost === data.expectedResult.lost &&
        result.status === data.expectedResult.status,
    };
  }
}
