import { DEFAULT_BRIDGE_ADDRESS } from "../connectors/connectionTypes";
import type { ConnectorId } from "../connectors/connectionTypes";

export const APP_SETTINGS_STORAGE_KEY = "noema-ascent.settings";
export const APP_SETTINGS_VERSION = 1;

export type AppSettings = {
  version: number;
  bridgeAddress: string;
  lastConnector: ConnectorId;
  safeMode: boolean;
  reducedMotion: boolean;
  muted: boolean;
  masterVolume: number;
};

export function createDefaultSettings(): AppSettings {
  return {
    version: APP_SETTINGS_VERSION,
    bridgeAddress: DEFAULT_BRIDGE_ADDRESS,
    lastConnector: "mock",
    safeMode: false,
    // Respect the operating system preference on first start.
    reducedMotion: prefersReducedMotion(),
    muted: false,
    masterVolume: 0.8,
  };
}

export function migrateSettings(raw: unknown): AppSettings {
  const defaults = createDefaultSettings();
  if (typeof raw !== "object" || raw === null) return defaults;
  const record = raw as Record<string, unknown>;
  const address = record["bridgeAddress"];
  const connector = record["lastConnector"];
  return {
    version: APP_SETTINGS_VERSION,
    bridgeAddress:
      typeof address === "string" && address.trim().length > 0
        ? address.trim()
        : defaults.bridgeAddress,
    lastConnector:
      connector === "noema-bridge" || connector === "mock"
        ? connector
        : defaults.lastConnector,
    safeMode: record["safeMode"] === true,
    reducedMotion:
      typeof record["reducedMotion"] === "boolean"
        ? record["reducedMotion"]
        : defaults.reducedMotion,
    muted: record["muted"] === true,
    masterVolume:
      typeof record["masterVolume"] === "number" &&
      Number.isFinite(record["masterVolume"])
        ? Math.max(0, Math.min(1, record["masterVolume"] as number))
        : defaults.masterVolume,
  };
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadSettings(storage?: StorageLike): AppSettings {
  const store = storage ?? safeStorage();
  if (!store) return createDefaultSettings();
  try {
    const raw = store.getItem(APP_SETTINGS_STORAGE_KEY);
    if (!raw) return createDefaultSettings();
    return migrateSettings(JSON.parse(raw));
  } catch {
    return createDefaultSettings();
  }
}

export function saveSettings(
  settings: AppSettings,
  storage?: StorageLike,
): void {
  const store = storage ?? safeStorage();
  if (!store) return;
  try {
    store.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable — settings stay in memory */
  }
}

function prefersReducedMotion(): boolean {
  try {
    return (
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
}

function safeStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
