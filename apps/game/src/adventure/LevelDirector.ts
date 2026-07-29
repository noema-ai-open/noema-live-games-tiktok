import type { AdventureLevel, LevelSegment, RouteChoice } from "./levelTypes";

export class LevelDirector {
  segmentIndex = 0;
  chosenRoute: RouteChoice | null = null;
  readonly completedSegments = new Set<string>();

  constructor(readonly level: AdventureLevel) {}

  get current(): LevelSegment {
    return this.level.segments[this.segmentIndex]!;
  }

  get progress(): number {
    return this.level.segments.length <= 1
      ? 1
      : this.segmentIndex / (this.level.segments.length - 1);
  }

  chooseRoute(choice: RouteChoice): void {
    this.chosenRoute = choice;
  }

  completeCurrent(): LevelSegment {
    const completed = this.current;
    this.completedSegments.add(completed.id);
    const nextId = this.resolveNext(completed);
    if (nextId) {
      const nextIndex = this.level.segments.findIndex((segment) => segment.id === nextId);
      if (nextIndex >= 0) this.segmentIndex = nextIndex;
    }
    return completed;
  }

  setProgress(segmentIndex: number, completed: Iterable<string>, route: RouteChoice | null): void {
    this.segmentIndex = Math.max(0, Math.min(this.level.segments.length - 1, segmentIndex));
    this.completedSegments.clear();
    for (const id of completed) this.completedSegments.add(id);
    this.chosenRoute = route;
  }

  private resolveNext(segment: LevelSegment): string | undefined {
    if (segment.type !== "route_fork") return segment.next[0];
    return this.chosenRoute === "left" ? segment.next[0] : segment.next[1];
  }
}
