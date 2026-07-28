import {
  LEVEL_GRAPH,
  getLink,
  getPlatform,
  type LevelGraph,
  type LevelRenderState,
  type Link,
  type LinkId,
  type LinkRuntimeState,
} from "../config/levelGraph";
import { TICKS } from "../config/gameConfig";

/** Zustand eines Übergangs zur Laufzeit. */
export type LinkRuntime = {
  buildProgress: number;
  /** Bis zu diesem Tick begehbar. `Infinity` = dauerhaft offen. */
  openUntilTick: number;
};

/**
 * Der Lift ist ein echtes Fahrzeug, kein Schalter.
 *
 * Er fährt einen festen Zyklus: unten halten mit offenen Türen, hochfahren,
 * oben halten mit offenen Türen, runterfahren. Roboter steigen nur ein,
 * während er unten steht und die Türen offen sind — deshalb sieht man sie
 * warten, einsteigen und mitfahren.
 */
export type LiftState = {
  /** 0 = untere Etage, 1 = obere Etage. */
  position: number;
  phase: "unten" | "auffahrt" | "oben" | "abfahrt";
  phaseUntilTick: number;
  doorsOpen: boolean;
  passengers: number;
};

const LIFT_DOOR_TICKS = TICKS.second * 3;
const LIFT_TRAVEL_TICKS = TICKS.second * 2;
const LIFT_OVERDRIVE_FACTOR = 0.5;

export class LevelRuntime {
  readonly graph: LevelGraph;
  private readonly links = new Map<LinkId, LinkRuntime>();
  private readonly lifts = new Map<LinkId, LiftState>();
  /** Wie viele Roboter gerade vor einem Übergang warten. */
  private readonly waiting = new Map<LinkId, number>();

  constructor(graph: LevelGraph = LEVEL_GRAPH) {
    this.graph = graph;
    this.reset();
  }

  reset(): void {
    this.links.clear();
    this.lifts.clear();
    this.waiting.clear();
    for (const link of this.graph.links) {
      this.links.set(link.id, {
        buildProgress: 0,
        // Was keinen Aufbau braucht, ist von Anfang an offen.
        openUntilTick: link.buildRequired === 0 ? Infinity : 0,
      });
      if (link.kind === "lift") {
        this.lifts.set(link.id, {
          position: 0,
          phase: "unten",
          phaseUntilTick: LIFT_DOOR_TICKS,
          doorsOpen: true,
          passengers: 0,
        });
      }
    }
  }

  getRuntime(id: LinkId): LinkRuntime {
    const runtime = this.links.get(id);
    if (!runtime) throw new Error(`Unbekannter Link: ${id}`);
    return runtime;
  }

  getLift(id: LinkId): LiftState | undefined {
    return this.lifts.get(id);
  }

  /** Kann ein Roboter diesen Übergang jetzt betreten? */
  isOpen(link: Link, tick: number): boolean {
    if (link.kind === "lift") {
      const lift = this.lifts.get(link.id);
      // Einsteigen nur unten bei offenen Türen.
      return lift !== undefined && lift.phase === "unten" && lift.doorsOpen;
    }
    return this.getRuntime(link.id).openUntilTick > tick;
  }

  /**
   * Baut an einem Übergang weiter. Gibt zurück, ob er dadurch aufgegangen ist —
   * daran hängt die Rückmeldung an den Absender.
   */
  build(id: LinkId, amount: number, tick: number): boolean {
    const link = getLink(this.graph, id);
    const runtime = this.getRuntime(id);
    if (link.buildRequired === 0) return false;
    if (runtime.openUntilTick > tick) return false;

    runtime.buildProgress += amount;
    if (runtime.buildProgress < link.buildRequired) return false;

    runtime.buildProgress = 0;
    runtime.openUntilTick =
      link.openTicks === "permanent" ? Infinity : tick + link.openTicks;
    return true;
  }

  /** Sabotage: macht einen gebauten Übergang wieder zunichte. */
  breakLink(id: LinkId): boolean {
    const link = getLink(this.graph, id);
    if (link.buildRequired === 0) return false;
    const runtime = this.getRuntime(id);
    if (runtime.openUntilTick === 0 && runtime.buildProgress === 0) return false;
    runtime.openUntilTick = 0;
    runtime.buildProgress = 0;
    return true;
  }

  /** Alle Übergänge, die Aufbau brauchen und gerade zu sind. */
  closedBuildables(tick: number): Link[] {
    return this.graph.links.filter(
      (link) =>
        link.buildRequired > 0 && this.getRuntime(link.id).openUntilTick <= tick,
    );
  }

  setWaiting(id: LinkId, count: number): void {
    this.waiting.set(id, count);
  }

  getWaiting(id: LinkId): number {
    return this.waiting.get(id) ?? 0;
  }

  /** Fährt die Liftkabinen einen Tick weiter. */
  step(tick: number, overdrive: boolean): void {
    for (const [id, lift] of this.lifts) {
      if (tick < lift.phaseUntilTick) {
        if (lift.phase === "auffahrt" || lift.phase === "abfahrt") {
          this.advanceCar(lift, tick);
        }
        continue;
      }
      const travel = Math.round(
        LIFT_TRAVEL_TICKS * (overdrive ? LIFT_OVERDRIVE_FACTOR : 1),
      );
      const doors = Math.round(
        LIFT_DOOR_TICKS * (overdrive ? LIFT_OVERDRIVE_FACTOR : 1),
      );
      switch (lift.phase) {
        case "unten":
          lift.phase = "auffahrt";
          lift.doorsOpen = false;
          lift.phaseUntilTick = tick + travel;
          break;
        case "auffahrt":
          lift.phase = "oben";
          lift.position = 1;
          lift.doorsOpen = true;
          lift.phaseUntilTick = tick + doors;
          break;
        case "oben":
          lift.phase = "abfahrt";
          lift.doorsOpen = false;
          lift.passengers = 0;
          lift.phaseUntilTick = tick + travel;
          break;
        case "abfahrt":
          lift.phase = "unten";
          lift.position = 0;
          lift.doorsOpen = true;
          lift.phaseUntilTick = tick + doors;
          break;
      }
      void id;
    }
  }

  private advanceCar(lift: LiftState, tick: number): void {
    const remaining = lift.phaseUntilTick - tick;
    const total = Math.max(1, LIFT_TRAVEL_TICKS);
    const done = Math.max(0, Math.min(1, 1 - remaining / total));
    lift.position = lift.phase === "auffahrt" ? done : 1 - done;
  }

  /** Weltposition der Liftkabine, damit Mitfahrer daran kleben. */
  carWorldPosition(id: LinkId): { x: number; y: number } | null {
    const lift = this.lifts.get(id);
    if (!lift) return null;
    const link = getLink(this.graph, id);
    const bottom = getPlatform(this.graph, link.from).y;
    const top = getPlatform(this.graph, link.to).y;
    return { x: link.fromX, y: bottom + (top - bottom) * lift.position };
  }

  /** Momentaufnahme für den Renderer. */
  renderState(tick: number): LevelRenderState {
    const links: LinkRuntimeState[] = this.graph.links.map((link) => {
      const runtime = this.getRuntime(link.id);
      const entry: LinkRuntimeState = {
        id: link.id,
        open: this.isLinkVisuallyOpen(link, tick),
        buildProgress: runtime.buildProgress,
        buildRequired: link.buildRequired,
        waiting: this.getWaiting(link.id),
      };
      const lift = this.lifts.get(link.id);
      if (lift) {
        entry.carPosition = lift.position;
        entry.carDoorsOpen = lift.doorsOpen;
        entry.carPassengers = lift.passengers;
      }
      return entry;
    });
    return { links };
  }

  /**
   * Für die Anzeige gilt eine Brücke als offen, sobald sie steht — auch wenn
   * gerade niemand einsteigen kann. Beim Lift ist "offen" der Schacht selbst.
   */
  private isLinkVisuallyOpen(link: Link, tick: number): boolean {
    if (link.kind === "lift") return true;
    return this.getRuntime(link.id).openUntilTick > tick;
  }
}
