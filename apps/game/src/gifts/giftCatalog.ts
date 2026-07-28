import type { NormalizedGiftPayload } from "@noema/event-protocol";
import { giftIdFromName } from "../connectors/bridgeNormalizer";
import { getAction, type GameActionId } from "./actions";

export const GIFT_CATALOG_STORAGE_KEY = "noema-ascent.gift-catalog";
export const GIFT_CATALOG_VERSION = 3;

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

/**
 * Zuordnung nach Muenzwert.
 *
 * Geschenknamen aendern sich je nach Region und Zeitpunkt, und niemand kennt
 * den vollstaendigen TikTok-Katalog. Der Muenzwert kommt aber bei jedem
 * Geschenk mit. Deshalb entscheidet er, was passiert — auch bei Geschenken,
 * die diese App noch nie gesehen hat.
 */
export type GiftTierRule = {
  id: string;
  label: string;
  minCoins: number;
  /** Obergrenze einschliesslich. `Infinity` fuer die hoechste Stufe. */
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
  /** Stufen nach Muenzwert — greifen fuer jedes Geschenk. */
  tiers: GiftTierRule[];
  /** Ausnahmen fuer einzelne Geschenke, haben Vorrang vor den Stufen. */
  entries: GiftMappingEntry[];
  free: FreeActionConfig;
};

function tier(
  id: string,
  label: string,
  minCoins: number,
  maxCoins: number,
  action: GameActionId,
  strength: number,
): GiftTierRule {
  return {
    id,
    label,
    minCoins,
    maxCoins,
    action,
    strength,
    cooldownSeconds: getAction(action).defaultCooldownSeconds,
    enabled: true,
  };
}

/**
 * Hilfe ist billig, Zerstoerung teuer — die Leiter aus dem Wirtschaftskonzept.
 *
 * Die Beispiele in den Beschriftungen stammen aus echten Geschenklisten der
 * deutschen TikTok-Oberflaeche. Sie dienen nur der Wiedererkennung; entscheidend
 * ist immer der Muenzwert, den die Bridge mitliefert.
 */
export function createDefaultTiers(): GiftTierRule[] {
  // Die Grenzen folgen der tatsaechlichen Verteilung im deutschen Katalog:
  // Der Grossteil der Geschenke kostet 1 bis 99 Coins, ueber 400 wird es sehr
  // duenn. Eine Stufe erst ab 500 haette im Stream fast nie ausgeloest.
  return [
    tier("tier-1", "1–9 · Rose, GG, Bussi", 1, 9, "repair", 20),
    tier("tier-2", "10–49 · Donut, S Blumen", 10, 49, "bridge", 1),
    tier("tier-3", "50–99 · Papierkranich, Pilz", 50, 99, "lift", 18),
    tier("tier-4", "100–299 · Handherz, Herzen", 100, 299, "team_shield", 15),
    tier("tier-5", "300–999 · Göttliche Flamme", 300, 999, "earthquake", 7),
    tier("tier-6", "ab 1.000 · Zeus", 1000, Infinity, "tsar_bomb", 1),
  ];
}

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
    tiers: createDefaultTiers(),
    // Nur echte, weit verbreitete TikTok-Geschenke als Ausnahme. Alles andere
    // laeuft ueber die Muenzstufen, damit auch unbekannte Geschenke wirken.
    entries: [
      entry(giftIdFromName("Rose"), "Rose", 1, "repair", 20, ["rosa"]),
      entry("mock_tsar_bomb", "ZAR-BOMBE Testgeschenk", 10000, "tsar_bomb", 1),
    ],
    free: {
      like: { action: "team_energy", strength: 2 },
      follow: { action: "team_energy", strength: 8 },
      share: { action: "team_energy", strength: 12 },
    },
  };
}

export type ResolvedEffect = {
  action: GameActionId;
  strength: number;
  cooldownSeconds: number;
  /** Woher die Regel kommt — fuer die Anzeige im Operator. */
  source: string;
};

export type CatalogResolution =
  | { kind: "mapped"; effect: ResolvedEffect }
  | { kind: "disabled"; label: string }
  | { kind: "unknown"; giftId: string; giftName: string };

/**
 * Reihenfolge: Ausnahme fuer genau dieses Geschenk, sonst der Name als
 * Rueckfallebene, sonst die Muenzstufe. Erst wenn auch der Muenzwert fehlt,
 * gilt ein Geschenk als unbekannt.
 */
export function resolveGift(
  catalog: GiftCatalogConfig,
  gift: NormalizedGiftPayload,
): CatalogResolution {
  const byId = catalog.entries.find((item) => item.giftId === gift.giftId);
  const name = gift.giftName.trim().toLowerCase();
  const match =
    byId ?? catalog.entries.find((item) => item.matchNames.includes(name));
  if (match) {
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

  const coins = gift.coinValue;
  if (coins > 0) {
    const rule = (catalog.tiers ?? []).find(
      (item) => coins >= item.minCoins && coins <= item.maxCoins,
    );
    if (rule) {
      if (!rule.enabled) return { kind: "disabled", label: rule.label };
      return {
        kind: "mapped",
        effect: {
          action: rule.action,
          strength: rule.strength,
          cooldownSeconds: rule.cooldownSeconds,
          source: rule.label,
        },
      };
    }
  }

  return { kind: "unknown", giftId: gift.giftId, giftName: gift.giftName };
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
  // Erfundene Platzhalter aus fruehen Fassungen entfernen: Diese Geschenke
  // gibt es auf TikTok nicht, sie haben live nie ausgeloest.
  const invented = new Set([
    giftIdFromName("Bridge Crate"),
    giftIdFromName("Jump Pad"),
    giftIdFromName("Lift Core"),
    giftIdFromName("Rescue Drone"),
    giftIdFromName("Team Aegis"),
    giftIdFromName("Crosswind"),
    giftIdFromName("Fault Line"),
  ]);
  const cleaned = merged.filter((item) => !invented.has(item.giftId));

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

  const tiers = Array.isArray(candidate.tiers)
    ? candidate.tiers
        .map((item) => normalizeTier(item))
        .filter((item): item is GiftTierRule => item !== null)
    : [];

  return {
    version: GIFT_CATALOG_VERSION,
    tiers: tiers.length > 0 ? tiers : defaults.tiers,
    entries: cleaned,
    free,
  };
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

function normalizeTier(raw: unknown): GiftTierRule | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const action = record["action"];
  if (typeof action !== "string" || !(action in ACTION_KEYS)) return null;
  const number = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return {
    id: typeof record["id"] === "string" ? record["id"] : `tier-${Date.now()}`,
    label: typeof record["label"] === "string" ? record["label"] : "Stufe",
    minCoins: number(record["minCoins"], 0),
    // JSON kennt kein Infinity; nach dem Laden steht dort null.
    maxCoins:
      record["maxCoins"] === null ? Infinity : number(record["maxCoins"], Infinity),
    action: action as GameActionId,
    strength: number(record["strength"], 1),
    cooldownSeconds: number(
      record["cooldownSeconds"],
      getAction(action as GameActionId).defaultCooldownSeconds,
    ),
    enabled: record["enabled"] !== false,
  };
}

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
