import { normalizeGiftName } from "../gifts/giftCatalog";

export type GiftAssetKey = "rose" | "doughnut" | "hand-heart" | "corgi" | "galaxy";

export const GIFT_FALLBACKS: Readonly<Record<GiftAssetKey, string>> = {
  rose: "/assets/gifts/fallback/rose.png?v=4",
  doughnut: "/assets/gifts/fallback/doughnut.png?v=4",
  "hand-heart": "/assets/gifts/fallback/hand-heart.png?v=4",
  corgi: "/assets/gifts/fallback/corgi.png?v=4",
  galaxy: "/assets/gifts/fallback/galaxy.png?v=4",
};

const KEY_BY_NAME: Readonly<Record<string, GiftAssetKey>> = {
  rose: "rose",
  doughnut: "doughnut",
  "hand heart": "hand-heart",
  corgi: "corgi",
  galaxy: "galaxy",
};

export type GiftAssetResolution = {
  key: GiftAssetKey;
  primaryUrl: string;
  fallbackUrl: string;
  usesBridgeIcon: boolean;
};

export function resolveGiftAsset(
  giftName: string,
  bridgeIconUrl?: string,
): GiftAssetResolution {
  const key = KEY_BY_NAME[normalizeGiftName(giftName)] ?? "rose";
  const fallbackUrl = GIFT_FALLBACKS[key];
  const validBridgeUrl = safeHttpUrl(bridgeIconUrl);
  return {
    key,
    primaryUrl: validBridgeUrl ?? fallbackUrl,
    fallbackUrl,
    usesBridgeIcon: validBridgeUrl !== null,
  };
}

export function fallbackForKey(key: GiftAssetKey): string {
  return GIFT_FALLBACKS[key];
}

function safeHttpUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
