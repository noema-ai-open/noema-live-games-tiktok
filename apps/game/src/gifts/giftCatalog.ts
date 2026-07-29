import type { NormalizedGiftPayload } from "@noema/event-protocol";
import { giftIdFromName } from "../connectors/bridgeNormalizer";
import { getAction, type GameActionId } from "./actions";

export const GIFT_CATALOG_STORAGE_KEY = "noema-ascent.gift-catalog";
export const GIFT_CATALOG_VERSION = 4;

export type GiftMappingEntry = {
  giftId: string;
  matchNames: string[];
  displayName: string;
  coinValue: number;
  action: GameActionId;
  strength: number;
  cooldownSeconds: number;
  enabled: boolean;
};

/** Legacy-compatible shape; coin tiers stay deliberately empty. */
export type GiftTierRule = {
  id: string;
  label: string;
  minCoins: number;
  maxCoins: number;
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
  tiers: GiftTierRule[];
  entries: GiftMappingEntry[];
  free: FreeActionConfig;
};

function normalizeGiftName(name: string): string {
  return name.normalize("NFKC").trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

function entry(
  displayName: string,
  coinValue: number,
  action: GameActionId,
  strength = 1,
): GiftMappingEntry {
  return {
    giftId: giftIdFromName(displayName),
    matchNames: [normalizeGiftName(displayName)],
    displayName,
    coinValue,
    action,
    strength,
    cooldownSeconds: getAction(action).defaultCooldownSeconds,
    enabled: true,
  };
}

export function createDefaultTiers(): GiftTierRule[] {
  return [];
}

export function createDefaultCatalog(): GiftCatalogConfig {
  return {
    version: GIFT_CATALOG_VERSION,
    tiers: [],
    entries: [
      entry("Rose", 1, "jump"),
      entry("Doughnut", 30, "build_blocks_3"),
      entry("Hand Heart", 100, "build_bridge"),
      entry("Corgi", 299, "helper"),
      entry("Galaxy", 1000, "tsar_bomb"),
    ],
    free: {
      like: { action: "team_energy", strength: 2 },
      follow: { action: "time_bonus", strength: 3 },
      share: { action: "team_energy", strength: 15 },
    },
  };
}

export type ResolvedEffect = {
  action: GameActionId;
  strength: number;
  cooldownSeconds: number;
  source: string;
};

export type CatalogResolution =
  | { kind: "mapped"; effect: ResolvedEffect }
  | { kind: "disabled"; label: string }
  | { kind: "unknown"; giftId: string; giftName: string };

/** giftId first, then one normalized exact name; coin value never decides. */
export function resolveGift(
  catalog: GiftCatalogConfig,
  gift: NormalizedGiftPayload,
): CatalogResolution {
  const byId = catalog.entries.find((item) => item.giftId === gift.giftId);
  const normalizedName = normalizeGiftName(gift.giftName);
  const match =
    byId ??
    catalog.entries.find((item) =>
      item.matchNames.some((name) => normalizeGiftName(name) === normalizedName),
    );
  if (!match) {
    return { kind: "unknown", giftId: gift.giftId, giftName: gift.giftName };
  }
  if (!match.enabled) return { kind: "disabled", label: match.displayName };
  return {
    kind: "mapped",
    effect: {
      action: match.action,
      strength: match.strength,
      cooldownSeconds: match.cooldownSeconds,
      source: match.displayName,
    },
  };
}

const ACTION_KEYS = new Set<GameActionId>([
  "none",
  "team_energy",
  "time_bonus",
  "jump",
  "build_blocks_3",
  "build_bridge",
  "helper",
  "tsar_bomb",
]);

export function migrateCatalog(raw: unknown): GiftCatalogConfig {
  const defaults = createDefaultCatalog();
  if (typeof raw !== "object" || raw === null) return defaults;
  const candidate = raw as Partial<GiftCatalogConfig>;
  const custom = Array.isArray(candidate.entries)
    ? candidate.entries
        .map(normalizeEntry)
        .filter((item): item is GiftMappingEntry => item !== null)
    : [];
  const entries = [...custom];
  for (const fallback of defaults.entries) {
    if (!entries.some((item) => item.giftId === fallback.giftId)) entries.push(fallback);
  }
  return { ...defaults, entries };
}

function normalizeEntry(raw: unknown): GiftMappingEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;
  if (typeof value["giftId"] !== "string") return null;
  if (typeof value["action"] !== "string" || !ACTION_KEYS.has(value["action"] as GameActionId)) {
    return null;
  }
  const displayName =
    typeof value["displayName"] === "string" ? value["displayName"] : value["giftId"];
  return {
    giftId: value["giftId"],
    matchNames: Array.isArray(value["matchNames"])
      ? value["matchNames"].filter((item): item is string => typeof item === "string")
      : [normalizeGiftName(displayName)],
    displayName,
    coinValue: typeof value["coinValue"] === "number" ? value["coinValue"] : 0,
    action: value["action"] as GameActionId,
    strength: typeof value["strength"] === "number" ? value["strength"] : 1,
    cooldownSeconds:
      typeof value["cooldownSeconds"] === "number"
        ? Math.max(0, value["cooldownSeconds"])
        : getAction(value["action"] as GameActionId).defaultCooldownSeconds,
    enabled: value["enabled"] !== false,
  };
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadCatalog(storage?: StorageLike): GiftCatalogConfig {
  const store = storage ?? safeLocalStorage();
  if (!store) return createDefaultCatalog();
  try {
    const raw = store.getItem(GIFT_CATALOG_STORAGE_KEY);
    return raw ? migrateCatalog(JSON.parse(raw)) : createDefaultCatalog();
  } catch {
    return createDefaultCatalog();
  }
}

export function saveCatalog(catalog: GiftCatalogConfig, storage?: StorageLike): void {
  const store = storage ?? safeLocalStorage();
  if (!store) return;
  try {
    store.setItem(GIFT_CATALOG_STORAGE_KEY, JSON.stringify(catalog));
  } catch {
    // Mapping remains active in memory.
  }
}

function safeLocalStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export { normalizeGiftName };
