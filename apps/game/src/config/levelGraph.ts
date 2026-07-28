/**
 * Level v2 — echte Geometrie statt gemalter Linie.
 *
 * Der Prototyp hat die Roboter über einen einzigen Fortschrittswert (0..1)
 * geschoben und Brücke, Lift und Sprungfeld als Schalter behandelt. Dadurch
 * hatte kein Bauteil eine sichtbare Wirkung: Niemand ist je in den Lift
 * eingestiegen, weil es keinen Lift gab — nur eine erlaubte Zahl.
 *
 * Hier ist der Turm ein Graph:
 *   - `Platform`: ein begehbares Deck mit fester Höhe und Breite.
 *   - `Link`: der Übergang zwischen zwei Decks. Ein Link ist entweder
 *     dauerhaft begehbar (Treppe) oder muss von den Zuschauern freigeschaltet
 *     werden (Brücke, Lift, Sprungfeld).
 *
 * Ein Roboter steht immer auf genau einer Plattform an einer echten
 * x-Position und benutzt einen Link, um weiterzukommen. Ist der Link gesperrt,
 * bleibt er davor stehen — und die Warteschlange davor ist das Signal an die
 * Zuschauer, wo Hilfe gebraucht wird.
 */

export type PlatformId = string;
export type LinkId = string;

export type Platform = {
  id: PlatformId;
  /** Y der begehbaren Oberkante in Weltkoordinaten. */
  y: number;
  /** Linke und rechte Kante des Decks. */
  xStart: number;
  xEnd: number;
  /** Etage von unten gezählt, nur für Anzeige und Fortschritt. */
  floor: number;
  label?: string;
};

/**
 * `stair`  — dauerhaft begehbar, kostet nur Zeit.
 * `bridge` — waagerechte Lücke; nur begehbar, wenn gebaut.
 * `lift`   — senkrechter Schacht; nur begehbar, wenn die Kabine da ist.
 * `jump`   — Sprungfeld; nur begehbar, solange das Feld aktiv ist.
 * `exit`   — Ausgang oben; wer hier ankommt, ist gerettet.
 */
export type LinkKind = "stair" | "bridge" | "lift" | "jump" | "exit";

export type Link = {
  id: LinkId;
  kind: LinkKind;
  from: PlatformId;
  to: PlatformId;
  /** X auf der Ausgangsplattform, an dem der Übergang beginnt. */
  fromX: number;
  /** X auf der Zielplattform, an dem der Roboter ankommt. */
  toX: number;
  /** Ticks, die der Übergang dauert. */
  travelTicks: number;
  /**
   * Wie viel Aufbau nötig ist, bis der Link benutzbar wird. 0 = immer offen.
   * Brücken und Sprungfelder werden damit von Geschenken freigeschaltet.
   */
  buildRequired: number;
  /**
   * Bleibt der Link nach dem Freischalten dauerhaft offen (Brücke) oder nur
   * für eine begrenzte Zeit (Sprungfeld)?
   */
  openTicks: number | "permanent";
  label?: string;
};

export type LevelGraph = {
  version: string;
  platforms: Platform[];
  links: Link[];
  spawnPlatform: PlatformId;
  spawnX: number;
  exitPlatform: PlatformId;
};

const F = (floor: number): number => 1160 - floor * 110;

/**
 * Der Turm: zehn Etagen, zwei Aufstiegswege, drei Engstellen, die
 * freigeschaltet werden müssen.
 *
 * Aufbau von unten nach oben:
 *   Etage 0  Startdeck
 *   Etage 1  geteiltes Deck mit Lücke  -> BRÜCKE
 *   Etage 2  durchgehendes Deck
 *   Etage 3  geteiltes Deck mit Lücke  -> SPRUNGFELD als Alternative
 *   Etage 4  Kerndeck                  -> LIFT nach Etage 6
 *   Etage 5  Zwischendeck (Treppenweg, langsam)
 *   Etage 6  Umsteigedeck
 *   Etage 7  geteiltes Deck mit Lücke  -> BRÜCKE
 *   Etage 8  Vordach
 *   Etage 9  Ausgang
 */
export const LEVEL_GRAPH: LevelGraph = {
  version: "ascent-tower-v2",
  spawnPlatform: "p0",
  spawnX: 360,
  exitPlatform: "p9",
  platforms: [
    { id: "p0", floor: 0, y: F(0), xStart: 110, xEnd: 610, label: "START" },

    { id: "p1a", floor: 1, y: F(1), xStart: 100, xEnd: 330 },
    { id: "p1b", floor: 1, y: F(1), xStart: 430, xEnd: 620 },

    { id: "p2", floor: 2, y: F(2), xStart: 110, xEnd: 610, label: "ZONE 1" },

    { id: "p3a", floor: 3, y: F(3), xStart: 110, xEnd: 320 },
    { id: "p3b", floor: 3, y: F(3), xStart: 430, xEnd: 610 },

    { id: "p4", floor: 4, y: F(4), xStart: 100, xEnd: 620, label: "KERN" },

    { id: "p5", floor: 5, y: F(5), xStart: 120, xEnd: 400 },

    { id: "p6", floor: 6, y: F(6), xStart: 300, xEnd: 620, label: "UMSTIEG" },

    { id: "p7a", floor: 7, y: F(7), xStart: 120, xEnd: 330 },
    { id: "p7b", floor: 7, y: F(7), xStart: 420, xEnd: 600 },

    { id: "p8", floor: 8, y: F(8), xStart: 260, xEnd: 600 },

    { id: "p9", floor: 9, y: F(9), xStart: 250, xEnd: 470, label: "AUSGANG" },
  ],
  links: [
    // Etage 0 -> 1: zwei Treppen, links und rechts. Immer offen.
    { id: "l-0-1a", kind: "stair", from: "p0", to: "p1a", fromX: 160, toX: 160, travelTicks: 26, buildRequired: 0, openTicks: "permanent" },
    { id: "l-0-1b", kind: "stair", from: "p0", to: "p1b", fromX: 560, toX: 560, travelTicks: 26, buildRequired: 0, openTicks: "permanent" },

    // Etage 1: Lücke in der Mitte. Ohne Brücke kommt von links niemand rüber.
    { id: "l-bridge-1", kind: "bridge", from: "p1a", to: "p1b", fromX: 330, toX: 430, travelTicks: 30, buildRequired: 24, openTicks: "permanent", label: "BRÜCKE 1" },

    // Etage 1 -> 2: nur von der rechten Seite. Deshalb muss die Brücke stehen
    // oder der Roboter von Anfang an rechts hochgelaufen sein.
    { id: "l-1-2", kind: "stair", from: "p1b", to: "p2", fromX: 560, toX: 560, travelTicks: 26, buildRequired: 0, openTicks: "permanent" },

    // Etage 2 -> 3: Treppe links, Sprungfeld rechts als schnelle Abkürzung.
    { id: "l-2-3a", kind: "stair", from: "p2", to: "p3a", fromX: 160, toX: 160, travelTicks: 26, buildRequired: 0, openTicks: "permanent" },
    { id: "l-jump-1", kind: "jump", from: "p2", to: "p3b", fromX: 520, toX: 520, travelTicks: 14, buildRequired: 18, openTicks: 300, label: "SPRUNGFELD" },

    // Etage 3: Lücke, per Brücke zu schließen.
    { id: "l-bridge-2", kind: "bridge", from: "p3a", to: "p3b", fromX: 320, toX: 430, travelTicks: 32, buildRequired: 30, openTicks: "permanent", label: "BRÜCKE 2" },

    { id: "l-3-4", kind: "stair", from: "p3b", to: "p4", fromX: 560, toX: 560, travelTicks: 26, buildRequired: 0, openTicks: "permanent" },

    // Etage 4: Entweder langsam über die Treppen (4 -> 5 -> 6) oder schnell
    // mit dem Lift (4 -> 6). Der Lift ist der sichtbare Gewinn eines Geschenks.
    { id: "l-4-5", kind: "stair", from: "p4", to: "p5", fromX: 150, toX: 150, travelTicks: 34, buildRequired: 0, openTicks: "permanent" },
    { id: "l-5-6", kind: "stair", from: "p5", to: "p6", fromX: 380, toX: 380, travelTicks: 34, buildRequired: 0, openTicks: "permanent" },
    { id: "l-lift", kind: "lift", from: "p4", to: "p6", fromX: 560, toX: 560, travelTicks: 60, buildRequired: 0, openTicks: "permanent", label: "LIFT" },

    { id: "l-6-7", kind: "stair", from: "p6", to: "p7b", fromX: 520, toX: 520, travelTicks: 26, buildRequired: 0, openTicks: "permanent" },

    // Etage 7: letzte Lücke vor dem Dach.
    { id: "l-bridge-3", kind: "bridge", from: "p7b", to: "p7a", fromX: 420, toX: 330, travelTicks: 30, buildRequired: 36, openTicks: "permanent", label: "BRÜCKE 3" },

    { id: "l-7-8", kind: "stair", from: "p7a", to: "p8", fromX: 300, toX: 300, travelTicks: 28, buildRequired: 0, openTicks: "permanent" },
    { id: "l-8-9", kind: "stair", from: "p8", to: "p9", fromX: 360, toX: 360, travelTicks: 26, buildRequired: 0, openTicks: "permanent" },

    { id: "l-exit", kind: "exit", from: "p9", to: "p9", fromX: 360, toX: 360, travelTicks: 12, buildRequired: 0, openTicks: "permanent", label: "AUSGANG" },
  ],
};

/**
 * Was der Renderer pro Bild über einen Link wissen muss.
 *
 * Das ist die Schnittstelle zwischen Simulation und Darstellung: Die
 * Simulation füllt sie, der Renderer liest sie und fasst nichts anderes an.
 */
export type LinkRuntimeState = {
  id: LinkId;
  /** Begehbar? Bei Brücken heißt das gebaut, beim Lift Kabine da. */
  open: boolean;
  /** Bereits geleisteter Aufbau. */
  buildProgress: number;
  buildRequired: number;
  /** Anzahl Roboter, die davor warten — treibt die Dringlichkeitsanzeige. */
  waiting: number;
  /** Nur beim Lift: 0 = untere Etage, 1 = obere Etage. */
  carPosition?: number;
  /** Nur beim Lift: Türen offen, Roboter steigen gerade ein oder aus. */
  carDoorsOpen?: boolean;
  /** Nur beim Lift: wie viele gerade mitfahren. */
  carPassengers?: number;
};

export type LevelRenderState = {
  links: LinkRuntimeState[];
};

export function getPlatform(graph: LevelGraph, id: PlatformId): Platform {
  const platform = graph.platforms.find((item) => item.id === id);
  if (!platform) throw new Error(`Unbekannte Plattform: ${id}`);
  return platform;
}

export function getLink(graph: LevelGraph, id: LinkId): Link {
  const link = graph.links.find((item) => item.id === id);
  if (!link) throw new Error(`Unbekannter Link: ${id}`);
  return link;
}

/** Alle Links, die von dieser Plattform wegführen. */
export function linksFrom(graph: LevelGraph, id: PlatformId): Link[] {
  return graph.links.filter((link) => link.from === id);
}

/**
 * Abstand jeder Plattform zum Ausgang, in Anzahl Übergängen.
 *
 * Die Etage allein reicht als Wegweiser nicht: Eine Brücke verbindet zwei
 * Decks auf derselben Höhe und ist trotzdem der einzige Weg weiter. Deshalb
 * wird der Abstand einmal rückwärts vom Ausgang aus berechnet, und ein
 * Roboter nimmt nur Übergänge, die ihn dem Ausgang näher bringen.
 */
export function distanceToExit(graph: LevelGraph): Map<PlatformId, number> {
  const distance = new Map<PlatformId, number>();
  distance.set(graph.exitPlatform, 0);

  // Breitensuche über die umgedrehten Kanten.
  const queue: PlatformId[] = [graph.exitPlatform];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDistance = distance.get(current)!;
    for (const link of graph.links) {
      if (link.to !== current || link.from === current) continue;
      if (distance.has(link.from)) continue;
      distance.set(link.from, currentDistance + 1);
      queue.push(link.from);
    }
  }
  return distance;
}

export const DISTANCE_TO_EXIT = distanceToExit(LEVEL_GRAPH);

/** Bringt dieser Übergang den Roboter näher an den Ausgang? */
export function linkLeadsForward(
  graph: LevelGraph,
  link: Link,
  distance: Map<PlatformId, number> = DISTANCE_TO_EXIT,
): boolean {
  if (link.kind === "exit") return true;
  const here = distance.get(link.from);
  const there = distance.get(link.to);
  if (here === undefined || there === undefined) return false;
  return there < here;
}

/** Höchste Etage im Level, für Fortschrittsanzeigen. */
export const TOP_FLOOR = Math.max(
  ...LEVEL_GRAPH.platforms.map((platform) => platform.floor),
);
