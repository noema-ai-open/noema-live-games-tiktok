import type { NormalizedLiveEvent } from "@noema/event-protocol";

export type ConnectionStatus =
  | "offline"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export type ConnectorId = "mock" | "noema-bridge";

export type ConnectionSnapshot = {
  connectorId: ConnectorId;
  status: ConnectionStatus;
  /** Human readable German status line for the operator view. */
  detail: string;
  /** Public TikTok account reported by the bridge, when it knows one. */
  profile: string | null;
  /** Bridge mode (`mock`, `live`, `fallback`) when reported. */
  mode: string | null;
  eventsPerSecond: number;
  totalEvents: number;
  lastEventLabel: string | null;
  lastEventAt: number | null;
  reconnectAttempts: number;
};

export type EventListener = (event: NormalizedLiveEvent) => void;
export type StatusListener = (snapshot: ConnectionSnapshot) => void;

export type ConnectorOptions = {
  /** Base address of the local bridge, e.g. `http://127.0.0.1:8765`. */
  address: string;
};

export const DEFAULT_BRIDGE_ADDRESS = "http://127.0.0.1:8765";

/** Backoff schedule for reconnects: capped exponential, no endless tight loop. */
export const RECONNECT_INITIAL_MS = 1000;
export const RECONNECT_FACTOR = 2;
export const RECONNECT_MAX_MS = 30000;

export function reconnectDelayMs(attempt: number): number {
  if (attempt < 0) throw new Error("attempt must not be negative");
  return Math.min(
    RECONNECT_MAX_MS,
    RECONNECT_INITIAL_MS * RECONNECT_FACTOR ** attempt,
  );
}

/** Turns `http://host:port` into the matching `ws://host:port/ws/events`. */
export function bridgeWebSocketUrl(address: string): string {
  const trimmed = address.trim().replace(/\/+$/, "");
  const withScheme = /^[a-z]+:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  const url = new URL(withScheme);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/events";
  url.search = "";
  return url.toString();
}

export function bridgeHttpUrl(address: string, path: string): string {
  const trimmed = address.trim().replace(/\/+$/, "");
  const withScheme = /^[a-z]+:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  const url = new URL(withScheme);
  url.pathname = path;
  return url.toString();
}
