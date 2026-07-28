import type {
  CommandPriority,
  GameCommand,
  ViewerIdentity,
} from "@noema/event-protocol";
import { TICKS } from "../config/gameConfig";

export type GameActionId =
  | "none"
  | "team_energy"
  | "repair"
  | "bridge"
  | "jump_field"
  | "lift"
  | "team_shield"
  | "rescue_one"
  | "area_rescue"
  | "wind"
  | "low_gravity"
  | "collapse"
  | "earthquake"
  | "tsar_bomb";

export type ActionCategory = "free" | "support" | "sabotage" | "catastrophe";

export type ActionDefinition = {
  id: GameActionId;
  /** Short German label shown to viewers in the gift feedback. */
  label: string;
  icon: string;
  category: ActionCategory;
  priority: CommandPriority;
  defaultCooldownSeconds: number;
  /**
   * Builds the ordered command. `strength` scales the effect inside safe
   * bounds; it is clamped by every builder.
   */
  build: (strength: number, actor: ViewerIdentity) => GameCommand | null;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const ACTION_DEFINITIONS: Readonly<
  Record<GameActionId, ActionDefinition>
> = {
  none: {
    id: "none",
    label: "Keine Wirkung",
    icon: "•",
    category: "free",
    priority: "low",
    defaultCooldownSeconds: 0,
    build: () => null,
  },
  team_energy: {
    id: "team_energy",
    label: "+ TEAM-ENERGIE",
    icon: "⚡",
    category: "free",
    priority: "low",
    defaultCooldownSeconds: 0,
    build: (strength, actor) => ({
      type: "add_team_energy",
      amount: clamp(Math.round(strength), 1, 25),
      actor,
    }),
  },
  repair: {
    id: "repair",
    label: "REPARATUR",
    icon: "🌹",
    category: "support",
    priority: "normal",
    defaultCooldownSeconds: 0,
    build: (strength, actor) => ({
      type: "repair_structure",
      amount: clamp(Math.round(strength), 4, 120),
      actor,
    }),
  },
  bridge: {
    id: "bridge",
    label: "BRÜCKE",
    icon: "🌉",
    category: "support",
    priority: "normal",
    defaultCooldownSeconds: 4,
    build: (_strength, actor) => ({
      type: "build_bridge",
      zoneId: "zone-1",
      actor,
    }),
  },
  jump_field: {
    id: "jump_field",
    label: "SPRUNGFELD",
    icon: "⤴",
    category: "support",
    priority: "normal",
    defaultCooldownSeconds: 4,
    build: (strength, actor) => ({
      type: "place_jump_field",
      zoneId: "zone-1",
      durationTicks: TICKS.second * clamp(Math.round(strength), 5, 30),
      actor,
    }),
  },
  lift: {
    id: "lift",
    label: "LIFT-OVERDRIVE",
    icon: "🛗",
    category: "support",
    priority: "normal",
    defaultCooldownSeconds: 6,
    build: (strength, actor) => ({
      type: "activate_lift",
      durationTicks: TICKS.second * clamp(Math.round(strength), 6, 40),
      actor,
    }),
  },
  team_shield: {
    id: "team_shield",
    label: "TEAM-SCHILD",
    icon: "🛡",
    category: "support",
    priority: "critical",
    defaultCooldownSeconds: 8,
    build: (strength, actor) => ({
      type: "group_shield",
      durationTicks: TICKS.second * clamp(Math.round(strength), 5, 30),
      actor,
    }),
  },
  rescue_one: {
    id: "rescue_one",
    label: "RETTUNG",
    icon: "🚁",
    category: "support",
    priority: "normal",
    defaultCooldownSeconds: 2,
    build: (_strength, actor) => ({ type: "rescue_worker", actor }),
  },
  area_rescue: {
    id: "area_rescue",
    label: "GROSSE RETTUNG",
    icon: "🚁",
    category: "support",
    priority: "critical",
    defaultCooldownSeconds: 10,
    build: (strength, actor) => ({
      type: "area_rescue",
      x: 360,
      y: 780,
      radius: clamp(Math.round(strength) * 20, 120, 520),
      actor,
    }),
  },
  wind: {
    id: "wind",
    label: "STURM",
    icon: "🌀",
    category: "sabotage",
    priority: "normal",
    defaultCooldownSeconds: 10,
    build: (strength, actor) => ({
      type: "environment_shift",
      mode: "wind",
      durationTicks: TICKS.second * clamp(Math.round(strength), 4, 20),
      actor,
    }),
  },
  low_gravity: {
    id: "low_gravity",
    label: "SCHWERELOS",
    icon: "🌙",
    category: "sabotage",
    priority: "normal",
    defaultCooldownSeconds: 10,
    build: (strength, actor) => ({
      type: "environment_shift",
      mode: "low_gravity",
      durationTicks: TICKS.second * clamp(Math.round(strength), 4, 20),
      actor,
    }),
  },
  collapse: {
    id: "collapse",
    label: "EINSTURZ",
    icon: "💥",
    category: "sabotage",
    priority: "normal",
    defaultCooldownSeconds: 12,
    build: (_strength, actor) => ({ type: "collapse_section", actor }),
  },
  earthquake: {
    id: "earthquake",
    label: "ERDBEBEN",
    icon: "〰",
    category: "sabotage",
    priority: "critical",
    defaultCooldownSeconds: 20,
    build: (strength, actor) => ({
      type: "earthquake",
      severity: clamp(strength / 10, 0.2, 1),
      actor,
    }),
  },
  tsar_bomb: {
    id: "tsar_bomb",
    // Viewer facing name is always exactly this string.
    label: "ZAR-BOMBE",
    icon: "☢",
    category: "catastrophe",
    priority: "critical",
    defaultCooldownSeconds: 60,
    build: (_strength, actor) => ({ type: "tsar_bomb", actor }),
  },
};

export const SELECTABLE_ACTIONS: readonly GameActionId[] = [
  "none",
  "team_energy",
  "repair",
  "bridge",
  "jump_field",
  "lift",
  "team_shield",
  "rescue_one",
  "area_rescue",
  "wind",
  "low_gravity",
  "collapse",
  "earthquake",
  "tsar_bomb",
] as const;

export function getAction(id: GameActionId): ActionDefinition {
  return ACTION_DEFINITIONS[id];
}
