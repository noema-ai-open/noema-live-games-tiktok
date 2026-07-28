/**
 * Die Spielflaeche ist breiter als der Turm.
 *
 * Links entsteht dadurch eine Spalte, in der die Geschenklegende gross und
 * lesbar steht — im Streambild ist das der schwarze Bereich neben dem Turm.
 * Der Turm selbst behaelt seine Koordinaten; die Weltkamera wird nur
 * verschoben.
 */
export const SIDEBAR_WIDTH = 260;
export const TOWER_WIDTH = 720;
export const LOGICAL_WIDTH = SIDEBAR_WIDTH + TOWER_WIDTH;
export const LOGICAL_HEIGHT = 1280;
export const FIXED_HZ = 30;
export const FIXED_STEP_MS = 1000 / FIXED_HZ;
/** Eine Runde laeuft 20 Minuten — lang genug fuer einen echten Stream. */
export const ROUND_DURATION_TICKS = FIXED_HZ * 1200;
export const WORKER_COUNT = 30;
export const RESCUE_TARGET = 21;
export const LEVEL_VERSION = "ascent-tower-v1";
export const DEFAULT_SEED = 0x4e4f454d;

export const TICKS = {
  second: FIXED_HZ,
  tsarWarning: FIXED_HZ * 3,
  tsarDescent: FIXED_HZ * 2,
  rebuild: FIXED_HZ * 25,
  tsarCooldown: FIXED_HZ * 60,
} as const;
