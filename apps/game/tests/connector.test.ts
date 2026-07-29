import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectorManager } from "../src/connectors/ConnectorManager";
import { NoemaLiveBridgeConnector } from "../src/connectors/NoemaLiveBridgeConnector";

class FakeSocket {
  static instances: FakeSocket[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  open(): void {
    this.onopen?.();
  }

  receive(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent);
  }

  fail(): void {
    this.onclose?.();
  }

  close(): void {
    this.closed = true;
  }
}

const giftFrame = {
  platform: "tiktok",
  event_type: "gift",
  event_id: "e1",
  timestamp: "2026-07-28T08:00:00Z",
  user: { display_name: "NeonBuilder", user_id: "tt:1" },
  metadata: { gift_name: "Rose", repeat_count: 1, diamond_count: 1 },
};

describe("NoemaLiveBridgeConnector", () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no cors")));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("connects to the documented websocket endpoint and forwards normalized events", () => {
    const connector = new NoemaLiveBridgeConnector(
      { address: "http://127.0.0.1:8765" },
      (url) => new FakeSocket(url) as unknown as WebSocket,
    );
    const events: string[] = [];
    connector.onEvent((event) => events.push(event.kind));
    connector.connect();

    const socket = FakeSocket.instances[0]!;
    expect(socket.url).toBe("ws://127.0.0.1:8765/ws/events");
    socket.open();
    expect(connector.getSnapshot().status).toBe("connected");

    socket.receive(giftFrame);
    socket.receive({ type: "system", text: "hallo" });
    expect(events).toEqual(["gift"]);
    expect(connector.getSnapshot().totalEvents).toBe(1);
  });

  it("reconnects with backoff and never registers a listener twice", () => {
    const connector = new NoemaLiveBridgeConnector(
      { address: "127.0.0.1:8765" },
      (url) => new FakeSocket(url) as unknown as WebSocket,
    );
    let deliveries = 0;
    connector.onEvent(() => {
      deliveries += 1;
    });
    connector.connect();

    // First failure without a successful handshake: 1s.
    FakeSocket.instances[0]!.fail();
    expect(connector.getSnapshot().status).toBe("reconnecting");
    vi.advanceTimersByTime(999);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(2);

    // Second failure in a row doubles the delay.
    FakeSocket.instances[1]!.fail();
    vi.advanceTimersByTime(1999);
    expect(FakeSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(3);

    const live = FakeSocket.instances[2]!;
    live.open();
    // A successful handshake resets the backoff.
    expect(connector.getSnapshot().reconnectAttempts).toBe(0);
    live.receive(giftFrame);
    expect(deliveries).toBe(1);

    // A dead socket must not deliver anything after being replaced.
    FakeSocket.instances[0]!.receive({ ...giftFrame, event_id: "e2" });
    expect(deliveries).toBe(1);
  });

  it("stops reconnecting after an explicit disconnect", () => {
    const connector = new NoemaLiveBridgeConnector(
      { address: "127.0.0.1:8765" },
      (url) => new FakeSocket(url) as unknown as WebSocket,
    );
    connector.connect();
    FakeSocket.instances[0]!.open();
    connector.disconnect();
    vi.advanceTimersByTime(60000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(connector.getSnapshot().status).toBe("offline");
  });
});

describe("ConnectorManager", () => {
  it("delivers each event once and detaches the previous connector on switch", () => {
    const manager = new ConnectorManager();
    const kinds: string[] = [];
    manager.onEvent((event) => kinds.push(event.kind));

    manager.use("mock");
    manager.mock.injectSimple("follow");
    expect(kinds).toEqual(["follow"]);
    expect(manager.getActiveId()).toBe("mock");

    manager.use("mock");
    manager.mock.injectSimple("share");
    expect(kinds).toEqual(["follow", "share"]);

    manager.stop();
    manager.mock.injectSimple("follow");
    expect(kinds).toHaveLength(2);
  });

  it("forwards operator test events without duplicating active mock events", () => {
    const manager = new ConnectorManager();
    const kinds: string[] = [];
    manager.onEvent((event) => kinds.push(event.kind));

    const inactiveMockEvent = manager.mock.injectSimple("follow");
    manager.forwardOperatorTestEvent(inactiveMockEvent);
    expect(kinds).toEqual(["follow"]);

    manager.use("mock");
    const activeMockEvent = manager.mock.injectSimple("share");
    manager.forwardOperatorTestEvent(activeMockEvent);
    expect(kinds).toEqual(["follow", "share"]);
  });
});
