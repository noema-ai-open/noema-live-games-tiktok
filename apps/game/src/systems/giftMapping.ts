import type { GameCommand, ViewerIdentity } from "@noema/event-protocol";
import { TICKS } from "../config/gameConfig";

export type MockActionId =
  | "likes"
  | "follow"
  | "share"
  | "cheap_support"
  | "standard_support"
  | "strong_support"
  | "premium_support"
  | "minor_sabotage"
  | "major_sabotage"
  | "tsar_bomb";

export type MockGiftMapping = {
  id: MockActionId;
  mockGiftId: string;
  displayLabel: string;
  tier: string;
  coins: string;
  command: (actor: ViewerIdentity) => GameCommand;
};

export const MOCK_ACTOR: ViewerIdentity = {
  id: "mock-viewer",
  username: "neon_builder",
  displayName: "NeonBuilder",
};

export const MOCK_GIFT_MAPPINGS: readonly MockGiftMapping[] = [
  {
    id: "cheap_support",
    mockGiftId: "mock_micro_repair",
    displayLabel: "Micro Repair",
    tier: "Cheap support",
    coins: "1–9",
    command: (actor) => ({
      type: "repair_structure",
      amount: 24,
      actor,
    }),
  },
  {
    id: "standard_support",
    mockGiftId: "mock_bridge_crate",
    displayLabel: "Bridge Crate",
    tier: "Standard support",
    coins: "10–99",
    command: (actor) => ({
      type: "build_bridge",
      zoneId: "zone-1",
      actor,
    }),
  },
  {
    id: "strong_support",
    mockGiftId: "mock_lift_core",
    displayLabel: "Lift Core",
    tier: "Strong support",
    coins: "100–499",
    command: (actor) => ({
      type: "activate_lift",
      durationTicks: TICKS.second * 18,
      actor,
    }),
  },
  {
    id: "premium_support",
    mockGiftId: "mock_team_aegis",
    displayLabel: "Team Aegis",
    tier: "Premium support",
    coins: "500–1,999",
    command: (actor) => ({
      type: "group_shield",
      durationTicks: TICKS.second * 15,
      actor,
    }),
  },
  {
    id: "minor_sabotage",
    mockGiftId: "mock_crosswind",
    displayLabel: "Crosswind",
    tier: "Minor sabotage",
    coins: "300–999",
    command: (actor) => ({
      type: "environment_shift",
      mode: "wind",
      durationTicks: TICKS.second * 8,
      actor,
    }),
  },
  {
    id: "major_sabotage",
    mockGiftId: "mock_fault_line",
    displayLabel: "Fault Line",
    tier: "Major sabotage",
    coins: "2,000–9,999",
    command: (actor) => ({ type: "earthquake", severity: 0.7, actor }),
  },
  {
    id: "tsar_bomb",
    mockGiftId: "mock_tsar_bomb",
    displayLabel: "ZAR-BOMBE",
    tier: "Highest destructive tier",
    coins: "Premium",
    command: (actor) => ({ type: "tsar_bomb", actor }),
  },
] as const;

export function getMockGift(id: MockActionId): MockGiftMapping | undefined {
  return MOCK_GIFT_MAPPINGS.find((mapping) => mapping.id === id);
}
