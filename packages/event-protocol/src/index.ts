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
      type: "add_team_energy";
      amount: number;
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
