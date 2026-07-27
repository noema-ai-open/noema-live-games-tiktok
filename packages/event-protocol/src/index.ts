export const PROTOCOL_VERSION = "1.0" as const;

export type ViewerIdentity = {
  id: string;
  username: string;
  displayName?: string;
};

export type LiveEventKind =
  | "like"
  | "follow"
  | "share"
  | "chat"
  | "gift"
  | "subscription";

export type LiveEventEnvelope = {
  protocolVersion: typeof PROTOCOL_VERSION;
  id: string;
  source: "tiktok" | "mock" | "operator";
  kind: LiveEventKind;
  occurredAt: string;
  actor: ViewerIdentity;
  payload: Record<string, unknown>;
};

export type GameCommand =
  | {
      type: "team-energy";
      amount: number;
      actor?: ViewerIdentity;
    }
  | {
      type: "boost";
      strength: number;
      actor?: ViewerIdentity;
    }
  | {
      type: "hazard";
      severity: number;
      actor?: ViewerIdentity;
    }
  | {
      type: "shield";
      durationMs: number;
      actor?: ViewerIdentity;
    }
  | {
      type: "pause" | "resume" | "reset";
    };

export type GatewayMessage = {
  protocolVersion: typeof PROTOCOL_VERSION;
  sequence: number;
  sentAt: string;
  command: GameCommand;
};
