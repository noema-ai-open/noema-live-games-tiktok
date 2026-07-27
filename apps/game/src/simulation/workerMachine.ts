import { positionOnPath } from "../config/level";
import type { RouteKind, Worker } from "./types";

export function createWorker(
  id: number,
  route: RouteKind,
  speed: number,
): Worker {
  const start = positionOnPath(route, 0);
  return {
    id,
    state: "spawning",
    route,
    x: start.x,
    y: start.y,
    progress: 0,
    speed,
    direction: 1,
    spawnTick: (id - 1) * 12,
    velocityY: 0,
    stateUntilTick: 0,
    protectedUntilTick: 0,
    lastCheckpoint: 0,
    lastHazardCycle: -1,
    lateralOffset: 0,
  };
}

export function beginFall(worker: Worker): void {
  worker.state = "falling";
  worker.velocityY = 0;
  worker.direction = 1;
}

export function beginJump(
  worker: Worker,
  currentTick: number,
  durationTicks: number,
): void {
  worker.state = "jumping";
  worker.stateUntilTick = currentTick + durationTicks;
  worker.velocityY = -7;
}

export function blockAndReverse(
  worker: Worker,
  currentTick: number,
  durationTicks: number,
): void {
  worker.state = "blocked";
  worker.direction = -1;
  worker.stateUntilTick = currentTick + durationTicks;
}

export function protectWorker(worker: Worker, untilTick: number): void {
  if (worker.state === "rescued" || worker.state === "lost") return;
  worker.protectedUntilTick = Math.max(worker.protectedUntilTick, untilTick);
  if (
    worker.state !== "spawning" &&
    worker.state !== "falling" &&
    worker.state !== "jumping"
  ) {
    worker.state = "protected";
  }
}

export function returnToCheckpoint(worker: Worker): void {
  worker.progress =
    worker.lastCheckpoint === 2
      ? 0.72
      : worker.lastCheckpoint === 1
        ? 0.36
        : 0;
  const position = positionOnPath(worker.route, worker.progress);
  worker.x = position.x;
  worker.y = position.y;
  worker.velocityY = 0;
  worker.direction = 1;
  worker.state = "walking";
}

export function syncWorkerPosition(worker: Worker): void {
  const position = positionOnPath(worker.route, worker.progress);
  worker.x = position.x + worker.lateralOffset;
  worker.y = position.y;
}
