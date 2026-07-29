import type { AdventureAction, LevelSegment, ObstacleProgress } from "./levelTypes";

export type ObstacleActionResult = {
  accepted: boolean;
  completed: boolean;
  partsAdded: number;
  durationTicks: number;
};

export class ObstacleController {
  private readonly progress = new Map<string, ObstacleProgress>();

  get(segment: LevelSegment): ObstacleProgress {
    const existing = this.progress.get(segment.id);
    if (existing) return existing;
    const created: ObstacleProgress = {
      segmentId: segment.id,
      builtParts: 0,
      visibleParts: 0,
      requiredParts: this.requiredParts(segment),
      resolved: false,
      buildRevision: 0,
    };
    this.progress.set(segment.id, created);
    return created;
  }

  apply(segment: LevelSegment, action: AdventureAction): ObstacleActionResult {
    const state = this.get(segment);
    if (state.resolved) {
      return { accepted: false, completed: true, partsAdded: 0, durationTicks: 0 };
    }

    if (action === "jump" && segment.requiredAction === "jump") {
      state.builtParts = 1;
      state.visibleParts = 1;
      state.resolved = true;
      state.buildRevision += 1;
      return { accepted: true, completed: true, partsAdded: 1, durationTicks: 24 };
    }

    if (action === "helper" && segment.requiredAction === "helper") {
      state.builtParts = 1;
      state.buildRevision += 1;
      return { accepted: true, completed: false, partsAdded: 1, durationTicks: 60 };
    }

    if (action === "build_bridge") {
      const allowed =
        segment.requiredAction === "build_bridge" ||
        segment.alternatives?.some((alternative) => alternative.action === "build_bridge");
      if (!allowed) {
        return { accepted: false, completed: false, partsAdded: 0, durationTicks: 0 };
      }
      const added = Math.max(0, state.requiredParts - state.builtParts);
      state.builtParts = state.requiredParts;
      state.buildRevision += 1;
      return {
        accepted: true,
        completed: false,
        partsAdded: added,
        durationTicks: Math.max(18, added * 12),
      };
    }

    if (action === "build_blocks") {
      const allowed =
        segment.requiredAction === "build_blocks" ||
        segment.alternatives?.some((alternative) => alternative.action === "build_blocks");
      if (!allowed) {
        return { accepted: false, completed: false, partsAdded: 0, durationTicks: 0 };
      }
      const added = Math.min(3, state.requiredParts - state.builtParts);
      state.builtParts += Math.max(0, added);
      state.buildRevision += 1;
      return {
        accepted: added > 0,
        completed: false,
        partsAdded: Math.max(0, added),
        durationTicks: Math.max(1, added) * 12,
      };
    }

    return { accepted: false, completed: false, partsAdded: 0, durationTicks: 0 };
  }

  revealNextPart(segment: LevelSegment): boolean {
    const state = this.get(segment);
    if (state.visibleParts >= state.builtParts) return false;
    state.visibleParts += 1;
    if (state.visibleParts >= state.requiredParts) state.resolved = true;
    return true;
  }

  completeHelper(segment: LevelSegment): void {
    const state = this.get(segment);
    state.visibleParts = state.requiredParts;
    state.builtParts = state.requiredParts;
    state.resolved = true;
  }

  destroyTemporary(segment: LevelSegment): void {
    const state = this.get(segment);
    state.builtParts = 0;
    state.visibleParts = 0;
    state.resolved = false;
    state.buildRevision += 1;
  }

  export(): Record<string, ObstacleProgress> {
    return Object.fromEntries(
      [...this.progress.entries()].map(([id, state]) => [id, structuredClone(state)]),
    );
  }

  restore(snapshot: Record<string, ObstacleProgress>): void {
    this.progress.clear();
    for (const [id, state] of Object.entries(snapshot)) {
      this.progress.set(id, structuredClone(state));
    }
  }

  private requiredParts(segment: LevelSegment): number {
    if (segment.type === "ravine") return 6;
    return Math.max(1, segment.requiredAmount ?? 1);
  }
}
