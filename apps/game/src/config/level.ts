import type { RouteKind } from "../simulation/types";

export type LevelPoint = { x: number; y: number };

export const SAFE_PATH: readonly LevelPoint[] = [
  { x: 360, y: 1138 },
  { x: 174, y: 1082 },
  { x: 174, y: 982 },
  { x: 404, y: 944 },
  { x: 532, y: 862 },
  { x: 532, y: 752 },
  { x: 252, y: 700 },
  { x: 174, y: 608 },
  { x: 174, y: 504 },
  { x: 430, y: 462 },
  { x: 544, y: 376 },
  { x: 544, y: 280 },
  { x: 360, y: 224 },
  { x: 360, y: 142 },
] as const;

export const RISKY_PATH: readonly LevelPoint[] = [
  { x: 360, y: 1138 },
  { x: 504, y: 1064 },
  { x: 504, y: 968 },
  { x: 350, y: 864 },
  { x: 256, y: 788 },
  { x: 414, y: 706 },
  { x: 526, y: 620 },
  { x: 392, y: 526 },
  { x: 296, y: 438 },
  { x: 248, y: 348 },
  { x: 360, y: 252 },
  { x: 360, y: 142 },
] as const;

export const CHECKPOINT_PROGRESS = [0.36, 0.72] as const;

export const getPath = (route: RouteKind): readonly LevelPoint[] =>
  route === "safe" ? SAFE_PATH : RISKY_PATH;

export function positionOnPath(route: RouteKind, progress: number): LevelPoint {
  const path = getPath(route);
  const clamped = Math.max(0, Math.min(1, progress));
  const scaled = clamped * (path.length - 1);
  const index = Math.min(Math.floor(scaled), path.length - 2);
  const local = scaled - index;
  const from = path[index]!;
  const to = path[index + 1]!;
  return {
    x: from.x + (to.x - from.x) * local,
    y: from.y + (to.y - from.y) * local,
  };
}

export const PLATFORM_LEVELS = [
  { y: 1164, x: 110, width: 500, color: 0xf6ad32 },
  { y: 1084, x: 112, width: 230, color: 0x1bd6ff },
  { y: 982, x: 122, width: 190, color: 0x1bd6ff },
  { y: 872, x: 326, width: 250, color: 0xff8b38 },
  { y: 752, x: 224, width: 370, color: 0x20d7ff },
  { y: 620, x: 118, width: 245, color: 0x39ee9b },
  { y: 500, x: 140, width: 360, color: 0x17c9ff },
  { y: 386, x: 340, width: 250, color: 0xff9d2e },
  { y: 270, x: 170, width: 390, color: 0x5df891 },
  { y: 172, x: 250, width: 220, color: 0x5df891 },
] as const;
