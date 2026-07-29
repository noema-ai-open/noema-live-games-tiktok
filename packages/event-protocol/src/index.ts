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

export type LiveEventSource = "tiktok" | "mock" | "operator" | "noema-bridge";

export type LiveEventEnvelope = {
  protocolVersion: typeof PROTOCOL_VERSION;
  id: string;
  source: LiveEventSource;
  kind: LiveEventKind;
  occurredAt: string;
  actor: ViewerIdentity;
  payload: Record<string, unknown>;
};

/**
 * Gift metadata carried by a normalized live event. Only `giftName` is
 * guaranteed by every connector; ids, coin values and combo markers are
 * optional because upstream connectors do not all report them.
 */
export type NormalizedGiftPayload = {
  giftId: string;
  giftName: string;
  coinValue: number;
  repeatCount: number;
  /** Current artwork supplied by the bridge. Local fallbacks remain mandatory. */
  iconUrl?: string;
  comboId?: string;
  comboFinal?: boolean;
};

/**
 * The only event shape the game runtime ever sees. Raw bridge or TikTok
 * payloads are converted into this contract inside a connector.
 */
export type NormalizedLiveEvent = {
  protocolVersion: typeof PROTOCOL_VERSION;
  eventId: string;
  source: LiveEventSource;
  kind: LiveEventKind;
  /** Milliseconds since epoch, taken from the connector payload when present. */
  timestamp: number;
  /** Local arrival time, used for combo windows and latency reporting. */
  receivedAt: number;
  actor: ViewerIdentity;
  gift?: NormalizedGiftPayload;
  likeCount?: number;
  message?: string;
};

/** Dispatch class for ordered commands. Critical never waits behind low. */
export type CommandPriority = "critical" | "normal" | "low";

export type GameCommand =
  | {
      type: "add_team_energy";
      amount: number;
      actor?: ViewerIdentity;
    }
  | {
      type: "add_time";
      seconds: number;
      actor?: ViewerIdentity;
    }
  | {
      type: "route_vote";
      eventId: string;
      choice: "left" | "right";
      actor?: ViewerIdentity;
    }
  | {
      type: "build_bridge";
      zoneId: string;
      actor?: ViewerIdentity;
    }
  | {
      type: "repair_structure";
      sectionId?: string;
      amount: number;
      actor?: ViewerIdentity;
    }
  | {
      type: "place_blocker";
      x: number;
      durationTicks: number;
      actor?: ViewerIdentity;
    }
  | {
      type: "place_jump_field";
      zoneId: string;
      durationTicks: number;
      actor?: ViewerIdentity;
    }
  | {
      type: "activate_lift";
      durationTicks: number;
      actor?: ViewerIdentity;
    }
  | {
      type: "group_shield";
      durationTicks: number;
      radius?: number;
      actor?: ViewerIdentity;
    }
  | {
      type: "rescue_worker";
      workerId?: number;
      actor?: ViewerIdentity;
    }
  | {
      type: "area_rescue";
      x: number;
      y: number;
      radius: number;
      actor?: ViewerIdentity;
    }
  | {
      type: "collapse_section";
      sectionId?: string;
      actor?: ViewerIdentity;
    }
  | {
      type: "environment_shift";
      mode: "wind" | "low_gravity";
      durationTicks: number;
      actor?: ViewerIdentity;
    }
  | {
      type: "earthquake";
      severity: number;
      actor?: ViewerIdentity;
    }
  | {
      type: "tsar_bomb";
      /** Gift transaction id; the simulation processes it at most once. */
      transactionId?: string;
      actor?: ViewerIdentity;
    }
  | {
      type: "set_safe_mode";
      enabled: boolean;
    }
  | {
      type: "set_reduced_motion";
      enabled: boolean;
    }
  | {
      type: "pause" | "resume" | "reset";
    };

export type OrderedGameCommand = {
  protocolVersion: typeof PROTOCOL_VERSION;
  sequence: number;
  tick: number;
  actor: ViewerIdentity;
  command: GameCommand;
};

export type GatewayMessage = OrderedGameCommand;
