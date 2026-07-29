/** Kompakter Spielblock fuer den Bereich direkt unter dem Kamerabild. */
export const LOGICAL_WIDTH = 720;
export const LOGICAL_HEIGHT = 760;
/** Die Welt behaelt ihre bisherigen Y-Koordinaten; nur der Kameraausschnitt wird kompakter. */
export const WORLD_RENDER_HEIGHT = 960;
export const WORLD_CAMERA_SCROLL_Y = 155;
export const WORLD_GROUND_Y = 650;
export const FIXED_HZ = 30;
export const FIXED_STEP_MS = 1000 / FIXED_HZ;
export const ROUND_DURATION_TICKS = FIXED_HZ * 270;
export const LEVEL_VERSION = "adventure-campaign-v2";
export const DEFAULT_SEED = 0x4e4f454d;

export const TICKS = {
  second: FIXED_HZ,
  tsarWarning: FIXED_HZ * 3,
  tsarDescent: FIXED_HZ,
  rebuild: FIXED_HZ * 3,
  tsarCooldown: FIXED_HZ * 60,
  routeVote: FIXED_HZ * 10,
  speechBubbleDelay: FIXED_HZ * 3,
  speechBubbleCooldown: FIXED_HZ * 12,
  levelCelebration: FIXED_HZ * 4,
  successHold: FIXED_HZ * 12,
  failureHold: FIXED_HZ * 8,
} as const;
