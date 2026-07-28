import {
  getLink,
  getPlatform,
  linkLeadsForward,
  linksFrom,
  type LevelGraph,
  type Link,
  type LinkId,
  type PlatformId,
} from "../config/levelGraph";
import type { LevelRuntime } from "./levelRuntime";

export type WalkerState =
  | "spawning"
  /** Läuft auf einer Plattform. */
  | "walking"
  /** Steht vor einem gesperrten Übergang und wartet auf Hilfe. */
  | "waiting"
  /** Benutzt gerade eine Treppe, Brücke oder ein Sprungfeld. */
  | "traversing"
  /** Fährt im Lift mit. */
  | "riding"
  | "falling"
  | "rescued"
  | "lost";

export type Walker = {
  id: number;
  variant: number;
  platformId: PlatformId;
  x: number;
  y: number;
  direction: -1 | 1;
  /** Pixel pro Tick. */
  speed: number;
  state: WalkerState;
  linkId: LinkId | null;
  /** 0..1 während eines Übergangs. */
  linkProgress: number;
  spawnTick: number;
  protectedUntilTick: number;
  /** Platz in der Warteschlange, damit sich der Stau staffelt. */
  queueSlot: number;
  fallVelocity: number;
  /** Höchste erreichte Etage — für Fortschritt und Rückwurf. */
  highestFloor: number;
};

export const QUEUE_SPACING = 17;

export function createWalker(
  graph: LevelGraph,
  id: number,
  speed: number,
  spawnTick: number,
): Walker {
  const platform = getPlatform(graph, graph.spawnPlatform);
  return {
    id,
    variant: (id - 1) % 4,
    platformId: platform.id,
    // Leicht versetzt starten, damit der Pulk nicht als ein Klotz losläuft.
    x: graph.spawnX + (((id * 37) % 11) - 5) * 12,
    y: platform.y,
    direction: id % 2 === 0 ? 1 : -1,
    speed,
    state: "spawning",
    linkId: null,
    linkProgress: 0,
    spawnTick,
    protectedUntilTick: 0,
    queueSlot: 0,
    fallVelocity: 0,
    highestFloor: platform.floor,
  };
}

/**
 * Ein Simulationsschritt für einen Roboter.
 *
 * Die Regeln sind bewusst einfach und ohne Zufall, damit die Runde exakt
 * wiederholbar bleibt: laufen, an einer Kante umdrehen, vor einem gesperrten
 * Übergang stehenbleiben, ihn benutzen sobald er offen ist.
 */
export function stepWalker(
  walker: Walker,
  graph: LevelGraph,
  runtime: LevelRuntime,
  tick: number,
): void {
  if (walker.state === "rescued" || walker.state === "lost") return;

  if (walker.state === "spawning") {
    if (tick < walker.spawnTick) return;
    walker.state = "walking";
  }

  switch (walker.state) {
    case "walking":
      stepWalking(walker, graph, runtime, tick);
      return;
    case "waiting":
      stepWaiting(walker, graph, runtime, tick);
      return;
    case "traversing":
      stepTraversing(walker, graph, tick);
      return;
    case "riding":
      stepRiding(walker, graph, runtime, tick);
      return;
    case "falling":
      stepFalling(walker, graph);
      return;
    default:
      return;
  }
}

function stepWalking(
  walker: Walker,
  graph: LevelGraph,
  runtime: LevelRuntime,
  tick: number,
): void {
  const platform = getPlatform(graph, walker.platformId);
  walker.y = platform.y;

  const upward = linksFrom(graph, platform.id).filter((link) =>
    linkLeadsForward(graph, link),
  );
  if (upward.length === 0) {
    patrol(walker, platform.xStart, platform.xEnd);
    return;
  }

  // Ziel ist der nächste Aufstieg in Laufrichtung. Gibt es in dieser Richtung
  // keinen mehr, dreht der Roboter um — wie an einer Wand.
  const ahead = upward
    .filter((link) =>
      walker.direction === 1
        ? link.fromX >= walker.x - 1
        : link.fromX <= walker.x + 1,
    )
    .sort((a, b) =>
      walker.direction === 1 ? a.fromX - b.fromX : b.fromX - a.fromX,
    );

  const target = ahead[0];
  if (!target) {
    walker.direction = walker.direction === 1 ? -1 : 1;
    return;
  }

  const distance = Math.abs(target.fromX - walker.x);
  if (distance <= walker.speed) {
    walker.x = target.fromX;
    enterOrWait(walker, graph, runtime, target, tick);
    return;
  }

  walker.x += walker.speed * walker.direction;
  clampToPlatform(walker, platform.xStart, platform.xEnd);
}

function enterOrWait(
  walker: Walker,
  graph: LevelGraph,
  runtime: LevelRuntime,
  link: Link,
  tick: number,
): void {
  if (!runtime.isOpen(link, tick)) {
    walker.state = "waiting";
    walker.linkId = link.id;
    return;
  }
  beginTraverse(walker, graph, runtime, link, tick);
}

function beginTraverse(
  walker: Walker,
  graph: LevelGraph,
  runtime: LevelRuntime,
  link: Link,
  tick: number,
): void {
  walker.linkId = link.id;
  walker.linkProgress = 0;
  if (link.kind === "lift") {
    const lift = runtime.getLift(link.id);
    if (lift) lift.passengers += 1;
    walker.state = "riding";
    const car = runtime.carWorldPosition(link.id);
    if (car) {
      walker.x = car.x;
      walker.y = car.y;
    }
    return;
  }
  walker.state = "traversing";
  void tick;
}

function stepWaiting(
  walker: Walker,
  graph: LevelGraph,
  runtime: LevelRuntime,
  tick: number,
): void {
  const link = walker.linkId ? getLink(graph, walker.linkId) : null;
  if (!link) {
    walker.state = "walking";
    return;
  }
  const platform = getPlatform(graph, walker.platformId);
  walker.y = platform.y;

  // Anstellen: Der erste steht am Übergang, die anderen dahinter.
  const offset = walker.queueSlot * QUEUE_SPACING;
  walker.x = clamp(
    link.fromX - offset * walker.direction,
    platform.xStart,
    platform.xEnd,
  );

  if (runtime.isOpen(link, tick)) {
    beginTraverse(walker, graph, runtime, link, tick);
  }
}

function stepTraversing(walker: Walker, graph: LevelGraph, tick: number): void {
  const link = walker.linkId ? getLink(graph, walker.linkId) : null;
  if (!link) {
    walker.state = "walking";
    return;
  }
  walker.linkProgress += 1 / Math.max(1, link.travelTicks);

  const from = getPlatform(graph, link.from);
  const to = getPlatform(graph, link.to);
  const t = Math.min(1, walker.linkProgress);
  walker.x = link.fromX + (link.toX - link.fromX) * t;
  walker.y = from.y + (to.y - from.y) * t;
  // Ein Sprung fliegt einen Bogen statt einer Geraden.
  if (link.kind === "jump") walker.y -= Math.sin(t * Math.PI) * 46;

  if (walker.linkProgress < 1) return;
  arrive(walker, graph, link);
  void tick;
}

function stepRiding(
  walker: Walker,
  graph: LevelGraph,
  runtime: LevelRuntime,
  tick: number,
): void {
  const link = walker.linkId ? getLink(graph, walker.linkId) : null;
  if (!link) {
    walker.state = "walking";
    return;
  }
  const lift = runtime.getLift(link.id);
  const car = runtime.carWorldPosition(link.id);
  if (!lift || !car) {
    arrive(walker, graph, link);
    return;
  }
  walker.x = car.x;
  walker.y = car.y;
  // Aussteigen erst, wenn die Kabine oben steht und die Türen offen sind.
  if (lift.phase === "oben" && lift.doorsOpen) {
    arrive(walker, graph, link);
  }
  void tick;
}

function arrive(walker: Walker, graph: LevelGraph, link: Link): void {
  if (link.kind === "exit") {
    walker.state = "rescued";
    return;
  }
  const to = getPlatform(graph, link.to);
  walker.platformId = to.id;
  walker.x = clamp(link.toX, to.xStart, to.xEnd);
  walker.y = to.y;
  walker.state = "walking";
  walker.linkId = null;
  walker.linkProgress = 0;
  walker.highestFloor = Math.max(walker.highestFloor, to.floor);
  // Nach dem Aufstieg in Richtung Deckmitte weiterlaufen.
  walker.direction = walker.x < (to.xStart + to.xEnd) / 2 ? 1 : -1;
}

function stepFalling(walker: Walker, graph: LevelGraph): void {
  walker.fallVelocity += 1.4;
  walker.y += walker.fallVelocity;

  const landing = platformBelow(graph, walker.x, walker.y);
  if (landing) {
    walker.platformId = landing.id;
    walker.y = landing.y;
    walker.x = clamp(walker.x, landing.xStart, landing.xEnd);
    walker.state = "walking";
    walker.fallVelocity = 0;
    walker.linkId = null;
    return;
  }
  if (walker.y > 1320) walker.state = "lost";
}

/** Wirft einen Roboter vom Deck — Erdbeben, Sturm, ZAR-BOMBE. */
export function pushOffPlatform(walker: Walker, tick: number): boolean {
  if (walker.protectedUntilTick > tick) return false;
  if (walker.state !== "walking" && walker.state !== "waiting") return false;
  walker.state = "falling";
  walker.fallVelocity = 0;
  walker.linkId = null;
  walker.y += 4;
  return true;
}

function platformBelow(
  graph: LevelGraph,
  x: number,
  y: number,
): { id: PlatformId; y: number; xStart: number; xEnd: number } | null {
  let best: (typeof graph.platforms)[number] | null = null;
  for (const platform of graph.platforms) {
    if (platform.y <= y) continue;
    if (x < platform.xStart || x > platform.xEnd) continue;
    if (!best || platform.y < best.y) best = platform;
  }
  return best;
}

function patrol(walker: Walker, xStart: number, xEnd: number): void {
  walker.x += walker.speed * walker.direction;
  turnAtEdge(walker, xStart, xEnd);
}

/**
 * Umdrehen an der Deckkante. Ohne Sicherheitsabstand, weil Uebergaenge genau
 * auf der Kante liegen duerfen — mit Abstand waeren sie unerreichbar.
 */
function clampToPlatform(walker: Walker, xStart: number, xEnd: number): void {
  turnAtEdge(walker, xStart, xEnd);
}

function turnAtEdge(walker: Walker, xStart: number, xEnd: number): void {
  if (walker.x <= xStart) {
    walker.x = xStart;
    walker.direction = 1;
  } else if (walker.x >= xEnd) {
    walker.x = xEnd;
    walker.direction = -1;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Verteilt die Warteplätze, damit die Schlange sichtbar wird. */
export function assignQueueSlots(walkers: Walker[]): void {
  const byLink = new Map<LinkId, Walker[]>();
  for (const walker of walkers) {
    if (walker.state !== "waiting" || !walker.linkId) continue;
    const list = byLink.get(walker.linkId) ?? [];
    list.push(walker);
    byLink.set(walker.linkId, list);
  }
  for (const list of byLink.values()) {
    list.sort((a, b) => a.id - b.id);
    for (const [index, walker] of list.entries()) walker.queueSlot = index;
  }
}
