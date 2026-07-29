import type {
  CommandPriority,
  GameCommand,
  ViewerIdentity,
} from "@noema/event-protocol";
import { TICKS } from "../config/gameConfig";

export type GameActionId =
  | "none"
  | "team_energy"
  | "time_bonus"
  | "jump"
  | "build_blocks_3"
  | "build_bridge"
  | "helper"
  | "tsar_bomb";

export type ActionCategory = "free" | "support" | "catastrophe";

export type ActionDefinition = {
  id: GameActionId;
  label: string;
  icon: string;
  category: ActionCategory;
  priority: CommandPriority;
  defaultCooldownSeconds: number;
  build: (strength: number, actor: ViewerIdentity) => GameCommand | null;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const ACTION_DEFINITIONS: Readonly<Record<GameActionId, ActionDefinition>> = {
  none: {
    id: "none",
    label: "Keine Wirkung",
    icon: "",
    category: "free",
    priority: "low",
    defaultCooldownSeconds: 0,
    build: () => null,
  },
  team_energy: {
    id: "team_energy",
    label: "TEAM-ENERGIE",
    icon: "",
    category: "free",
    priority: "low",
    defaultCooldownSeconds: 0,
    build: (strength, actor) => ({
      type: "add_team_energy",
      amount: clamp(Math.round(strength), 1, 40),
      actor,
    }),
  },
  time_bonus: {
    id: "time_bonus",
    label: "+3 SEKUNDEN",
    icon: "",
    category: "free",
    priority: "low",
    defaultCooldownSeconds: 0,
    build: (strength, actor) => ({
      type: "add_time",
      seconds: clamp(Math.round(strength), 1, 15),
      actor,
    }),
  },
  jump: {
    id: "jump",
    label: "SPRINGEN",
    icon: "/assets/gifts/fallback/rose.png",
    category: "support",
    priority: "normal",
    defaultCooldownSeconds: 0,
    build: (_strength, actor) => ({
      type: "place_jump_field",
      zoneId: "current",
      durationTicks: Math.round(TICKS.second * 0.8),
      actor,
    }),
  },
  build_blocks_3: {
    id: "build_blocks_3",
    label: "3 BAUTEILE",
    icon: "/assets/gifts/fallback/doughnut.png",
    category: "support",
    priority: "normal",
    defaultCooldownSeconds: 0,
    build: (_strength, actor) => ({
      type: "repair_structure",
      sectionId: "current",
      amount: 3,
      actor,
    }),
  },
  build_bridge: {
    id: "build_bridge",
    label: "BRUECKE",
    icon: "/assets/gifts/fallback/hand-heart.png",
    category: "support",
    priority: "normal",
    defaultCooldownSeconds: 0,
    build: (_strength, actor) => ({
      type: "build_bridge",
      zoneId: "current",
      actor,
    }),
  },
  helper: {
    id: "helper",
    label: "HELFER",
    icon: "/assets/gifts/fallback/corgi.png",
    category: "support",
    priority: "critical",
    defaultCooldownSeconds: 0,
    build: (_strength, actor) => ({ type: "rescue_worker", actor }),
  },
  tsar_bomb: {
    id: "tsar_bomb",
    label: "ZAR-BOMBE",
    icon: "/assets/gifts/fallback/galaxy.png",
    category: "catastrophe",
    priority: "critical",
    defaultCooldownSeconds: 60,
    build: (_strength, actor) => ({ type: "tsar_bomb", actor }),
  },
};

export const SELECTABLE_ACTIONS: readonly GameActionId[] = [
  "none",
  "team_energy",
  "time_bonus",
  "jump",
  "build_blocks_3",
  "build_bridge",
  "helper",
  "tsar_bomb",
] as const;

export function getAction(id: GameActionId): ActionDefinition {
  return ACTION_DEFINITIONS[id];
}
