import type { NormalizedGiftPayload } from "@noema/event-protocol";
import { giftIdFromName } from "../connectors/bridgeNormalizer";
import { getAction, type GameActionId } from "./actions";

export const GIFT_CATALOG_STORAGE_KEY = "noema-ascent.gift-catalog";
export const GIFT_CATALOG_VERSION = 2;

export type GiftMappingEntry = {
  /** Preferred key. Gift names are only used as a fallback. */
  giftId: string;
  /** Lowercase gift names that resolve to this entry when the id is unknown. */
  matchNames: string[];
  displayName: string;
  /** Coin value observed for this gift; informational, kept editable. */
  coinValue: number;
  action: GameActionId;
  strength: number;
  cooldownSeconds: number;
  enabled: boolean;
};

export type FreeActionConfig = {
  like: { action: GameActionId; strength: number };
  follow: { action: GameActionId; strength: number };
  share: { action: GameActionId; strength: number };
};

export type GiftCatalogConfig = {
  version: number;
  entries: GiftMappingEntry[];
  free: FreeActionConfig;
};

function entry(
  giftId: string,
  displayName: string,
  coinValue: number,
  action: GameActionId,
  strength: number,
  matchNames: string[] = [],
): GiftMappingEntry {
  return {
    giftId,
    matchNames: [displayName.toLowerCase(), ...matchNames],
    displayName,
    coinValue,
    action,
    strength,
    cooldownSeconds: getAction(action).defaultCooldownSeconds,
    enabled: true,
  };
}

/**
 * Sensible starting values. TikTok gift catalogs change per region and over
 * time, so nothing here is treated as global truth — the operator can remap
 * every row, and unknown gifts stay inert until they are mapped.
 */
export function createDefaultCatalog(): GiftCatalogConfig {
  return {
    version: GIFT_CATALOG_VERSION,
    entries: [
      entry(giftIdFromName("Rose"), "Rose", 1, "repair", 24, ["rosa", "rose"]),
      entry(giftIdFromName("Finger Heart"), "Finger Heart", 5, "team_energy", 6),
      entry(giftIdFromName("Bridge Crate"), "Bridge Crate", 30, "bridge", 1, [
        "mock_bridge_crate",
      ]),
      entry(giftIdFromName("Jump Pad"), "Jump Pad", 45, "jump_field", 15),
      entry(giftIdFromName("Lift Core"), "Lift Core", 199, "lift", 18),
      entry(giftIdFromName("Rescue Drone"), "Rescue Drone", 299, "rescue_one", 1),
      entry(giftIdFromName("Team Aegis"), "Team Aegis", 999, "team_shield", 15),
      entry(giftIdFromName("Crosswind"), "Crosswind", 500, "wind", 8),
      entry(giftIdFromName("Fault Line"), "Fault Line", 3000, "earthquake", 7),
      // Deliberately a normal, editable row: Galaxy is not hard-coded truth.
      entry(giftIdFromName("Galaxy"), "Galaxy", 1000, "tsar_bomb", 1),
      entry("mock_tsar_bomb", "ZAR-BOMBE Testgeschenk", 10000, "tsar_bomb", 1),
    ],
    free: {
      like: { action: "team_energy", strength: 2 },
      follow: { action: "team_energy", strength: 8 },
      share: { action: "team_energy", strength: 12 },
    },
  };
}

export type CatalogResolution =
  | { kind: "mapped"; entry: GiftMappingEntry }
  | { kind: "disabled"; entry: GiftMappingEntry }
  | { kind: "unknown"; giftId: string; giftName: string };

/** Resolves a gift by id first, then by lowercase name as documented fallback. */
export function resolveGift(
  catalog: GiftCatalogConfig,
  gift: NormalizedGiftPayload,
): CatalogResolution {
  const byId = catalog.entries.find((item) => item.giftId === gift.giftId);
  const name = gift.giftName.trim().toLowerCase();
  const match =
    byId ?? catalog.entries.find((item) => item.matchNames.includes(name));
  if (!match) return { kind: "unknown", giftId: gift.giftId, giftName: gift.giftName };
  return match.enabled
    ? { kind: "mapped", entry: match }
    : { kind: "disabled", entry: match };
}

/**
 * Accepts any previously stored shape and repairs it. Unknown versions are
 * merged onto the defaults instead of being thrown away.
 */
export function migrateCatalog(raw: unknown): GiftCatalogConfig {
  const defaults = createDefaultCatalog();
  if (typeof raw !== "object" || raw === null) return defaults;
  const candidate = raw as Partial<GiftCatalogConfig>;
  const entries = Array.isArray(candidate.entries)
    ? candidate.entries
        .map((item) => normalizeEntry(item))
        .filter((item): item is GiftMappingEntry => item !== null)
    : [];

  const merged = [...entries];
  for (const fallback of defaults.entries) {
    if (!merged.some((item) => item.giftId === fallback.giftId)) {
      merged.push(fallback);
    }
  }

  const free = defaults.free;
  const rawFree = candidate.free;
  if (rawFree && typeof rawFree === "object") {
    for (const key of ["like", "follow", "share"] as const) {
      const value = (rawFree as Record<string, unknown>)[key];
      if (typeof value !== "object" || value === null) continue;
      const record = value as Record<string, unknown>;
      const action = record["action"];
      const strength = record["strength"];
      if (typeof action === "string" && action in ACTION_KEYS) {
        free[key].action = action as GameActionId;
      }
      if (typeof strength === "number" && Number.isFinite(strength)) {
        free[key].strength = strength;
      }
    }
  }

  return { version: GIFT_CATALOG_VERSION, entries: merged, free };
}

const ACTION_KEYS: Record<string, true> = {
  none: true,
  team_energy: true,
  repair: true,
  bridge: true,
  jump_field: true,
  lift: true,
  team_shield: true,
  rescue_one: true,
  area_rescue: true,
  wind: true,
  low_gravity: true,
  collapse: true,
  earthquake: true,
  tsar_bomb: true,
};

function normalizeEntry(raw: unknown): GiftMappingEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const giftId = record["giftId"];
  const action = record["action"];
  if (typeof giftId !== "string" || giftId.length === 0) return null;
  if (typeof action !== "string" || !(action in ACTION_KEYS)) return null;
  const displayName =
    typeof record["displayName"] === "string" && record["displayName"]
      ? (record["displayName"] as string)
      : giftId;
  const matchNames = Array.isArray(record["matchNames"])
    ? (record["matchNames"] as unknown[]).filter(
        (item): item is string => typeof item === "string",
      )
    : [displayName.toLowerCase()];
  const numberOr = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;

  return {
    giftId,
    matchNames,
    displayName,
    coinValue: numberOr(record["coinValue"], 0),
    action: action as GameActionId,
    strength: numberOr(record["strength"], 1),
    cooldownSeconds: numberOr(
      record["cooldownSeconds"],
      getAction(action as GameActionId).defaultCooldownSeconds,
    ),
    enabled: record["enabled"] !== false,
  };
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadCatalog(storage?: StorageLike): GiftCatalogConfig {
  const store = storage ?? safeLocalStorage();
  if (!store) return createDefaultCatalog();
  try {
    const raw = store.getItem(GIFT_CATALOG_STORAGE_KEY);
    if (!raw) return createDefaultCatalog();
    return migrateCatalog(JSON.parse(raw));
  } catch {
    return createDefaultCatalog();
  }
}

export function saveCatalog(
  catalog: GiftCatalogConfig,
  storage?: StorageLike,
): void {
  const store = storage ?? safeLocalStorage();
  if (!store) return;
  try {
    store.setItem(GIFT_CATALOG_STORAGE_KEY, JSON.stringify(catalog));
  } catch {
    /* storage full or blocked — mapping stays in memory */
  }
}

function safeLocalStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
