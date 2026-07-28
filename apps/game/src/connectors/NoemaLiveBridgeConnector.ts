import { BaseConnector } from "./Connector";
import { normalizeBridgeFrame } from "./bridgeNormalizer";
import {
  bridgeHttpUrl,
  bridgeWebSocketUrl,
  reconnectDelayMs,
  type ConnectorId,
  type ConnectorOptions,
} from "./connectionTypes";

type SocketFactory = (url: string) => WebSocket;

/**
 * Connects to a locally running NOEMA TikTok Live Bridge.
 *
 * Only endpoints that actually exist in that project are used:
 *   - `GET  /status`      → mode and connector status
 *   - `GET  /connection`  → public TikTok account the bridge is configured for
 *   - `WS   /ws/events`   → push stream of events, blocked notices and notices
 *
 * The bridge ships no CORS headers, so the REST probes are best-effort and a
 * failure never blocks the WebSocket, which is not subject to CORS.
 */
export class NoemaLiveBridgeConnector extends BaseConnector {
  readonly id: ConnectorId = "noema-bridge";

  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;
  private readonly createSocket: SocketFactory;

  constructor(
    private options: ConnectorOptions,
    createSocket: SocketFactory = (url) => new WebSocket(url),
  ) {
    super();
    this.createSocket = createSocket;
  }

  setAddress(address: string): void {
    this.options = { ...this.options, address };
  }

  getAddress(): string {
    return this.options.address;
  }

  connect(): void {
    this.closedByUser = false;
    this.openSocket();
    void this.probeRest();
  }

  disconnect(): void {
    this.closedByUser = true;
    this.clearReconnectTimer();
    this.teardownSocket();
    this.reconnectAttempts = 0;
    this.resetMetrics();
    this.setStatus("offline", "Getrennt");
  }

  /**
   * Prueft den Ereignis-Stream selbst — nicht nur HTTP.
   *
   * Der WebSocket ist der Weg, ueber den die Ereignisse tatsaechlich kommen,
   * und er unterliegt keiner CORS-Beschraenkung. Deshalb ist er die einzige
   * Pruefung, die eine verlaessliche Aussage liefert.
   */
  probeWebSocket(timeoutMs = 6000): Promise<boolean> {
    return new Promise((resolve) => {
      let socket: WebSocket;
      try {
        socket = this.createSocket(bridgeWebSocketUrl(this.options.address));
      } catch {
        resolve(false);
        return;
      }
      let settled = false;
      const finish = (ok: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.onopen = null;
        socket.onerror = null;
        socket.onclose = null;
        try {
          socket.close();
        } catch {
          /* schon geschlossen */
        }
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), timeoutMs);
      socket.onopen = () => finish(true);
      socket.onerror = () => finish(false);
      socket.onclose = () => finish(false);
    });
  }

  /** One-shot check used by the "Verbindung testen" button. */
  async probeRest(): Promise<boolean> {
    try {
      const response = await fetch(
        bridgeHttpUrl(this.options.address, "/status"),
        { method: "GET" },
      );
      if (!response.ok) return false;
      const payload = (await response.json()) as Record<string, unknown>;
      const mode = payload["mode"];
      if (typeof mode === "string") this.mode = mode;
      await this.probeConnection();
      this.publishStatus();
      return true;
    } catch {
      // Expected without a CORS proxy — the WebSocket remains authoritative.
      return false;
    }
  }

  private async probeConnection(): Promise<void> {
    try {
      const response = await fetch(
        bridgeHttpUrl(this.options.address, "/connection"),
        { method: "GET" },
      );
      if (!response.ok) return;
      const payload = (await response.json()) as Record<string, unknown>;
      const username = payload["tiktok_username"];
      this.profile = typeof username === "string" && username ? username : null;
    } catch {
      /* ignored, see probeRest */
    }
  }

  private openSocket(): void {
    this.teardownSocket();
    let url: string;
    try {
      url = bridgeWebSocketUrl(this.options.address);
    } catch {
      this.setStatus("error", "Ungültige Bridge-Adresse");
      return;
    }

    this.setStatus(
      this.reconnectAttempts > 0 ? "reconnecting" : "connecting",
      this.reconnectAttempts > 0
        ? `Neuer Verbindungsversuch (${this.reconnectAttempts})`
        : "Verbinde mit lokaler Bridge …",
    );

    let socket: WebSocket;
    try {
      socket = this.createSocket(url);
    } catch {
      this.scheduleReconnect("Verbindung fehlgeschlagen");
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus("connected", "Live verbunden");
    };
    socket.onmessage = (message: MessageEvent) => this.handleMessage(message);
    socket.onerror = () => {
      if (this.socket === socket) this.setStatus("error", "Verbindungsfehler");
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      // Detach immediately so a closed socket can never deliver again.
      detachHandlers(socket);
      if (this.closedByUser) return;
      this.scheduleReconnect("Live nicht erkannt");
    };
  }

  private handleMessage(message: MessageEvent): void {
    if (typeof message.data !== "string") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(message.data);
    } catch {
      return;
    }
    const frame = normalizeBridgeFrame(parsed);
    if (frame.kind === "event") {
      this.emitEvent(frame.event);
      this.publishStatus();
      return;
    }
    if (frame.kind === "status" && frame.status !== "unknown") {
      // The bridge only labels its own connect/disconnect events; a status
      // frame without a label says nothing and must not overwrite the detail.
      this.detail =
        frame.status === "connected"
          ? "Live verbunden"
          : `Bridge-Status: ${frame.status}`;
      this.publishStatus();
    }
  }

  private scheduleReconnect(reason: string): void {
    if (this.closedByUser || this.reconnectTimer !== null) return;
    const delay = reconnectDelayMs(this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.setStatus(
      "reconnecting",
      `${reason} · neuer Versuch in ${Math.round(delay / 1000)}s`,
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer === null) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private teardownSocket(): void {
    const socket = this.socket;
    if (!socket) return;
    this.socket = null;
    detachHandlers(socket);
    try {
      socket.close();
    } catch {
      /* already closing */
    }
  }
}

function detachHandlers(socket: WebSocket): void {
  socket.onopen = null;
  socket.onmessage = null;
  socket.onerror = null;
  socket.onclose = null;
}
