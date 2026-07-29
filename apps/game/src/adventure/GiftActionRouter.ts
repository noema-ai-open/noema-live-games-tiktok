import type { GameCommand, ViewerIdentity } from "@noema/event-protocol";
import type { AdventureAction } from "./levelTypes";

export type GiftActionId =
  | "jump"
  | "build_blocks_3"
  | "build_bridge"
  | "helper"
  | "tsar_bomb";

export class GiftActionRouter {
  toAdventureAction(command: GameCommand): AdventureAction | null {
    switch (command.type) {
      case "place_jump_field":
        return "jump";
      case "repair_structure":
        return "build_blocks";
      case "build_bridge":
        return "build_bridge";
      case "rescue_worker":
      case "area_rescue":
        return "helper";
      default:
        return null;
    }
  }

  toCommand(action: GiftActionId, actor: ViewerIdentity, transactionId: string): GameCommand {
    switch (action) {
      case "jump":
        return { type: "place_jump_field", zoneId: "current", durationTicks: 24, actor };
      case "build_blocks_3":
        return { type: "repair_structure", sectionId: "current", amount: 3, actor };
      case "build_bridge":
        return { type: "build_bridge", zoneId: "current", actor };
      case "helper":
        return { type: "rescue_worker", actor };
      case "tsar_bomb":
        return { type: "tsar_bomb", transactionId, actor };
    }
  }
}
