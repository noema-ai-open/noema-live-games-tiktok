import type { HeroController } from "./HeroController";
import type { LevelDirector } from "./LevelDirector";
import type { ObstacleController } from "./ObstacleController";
import type { LevelSnapshot } from "./levelTypes";

export class CheckpointSystem {
  private current: LevelSnapshot | null = null;
  reached = 0;

  save(
    director: LevelDirector,
    obstacles: ObstacleController,
    hero: HeroController,
    remainingTicks: number,
  ): LevelSnapshot {
    this.current = {
      segmentIndex: director.segmentIndex,
      heroX: hero.x,
      heroY: hero.y,
      completedSegments: [...director.completedSegments],
      obstacleProgress: obstacles.export(),
      chosenRoute: director.chosenRoute,
      remainingTicks,
    };
    this.reached += 1;
    return structuredClone(this.current);
  }

  get(): LevelSnapshot | null {
    return this.current ? structuredClone(this.current) : null;
  }

  restore(
    director: LevelDirector,
    obstacles: ObstacleController,
    hero: HeroController,
  ): LevelSnapshot | null {
    if (!this.current) return null;
    director.setProgress(
      this.current.segmentIndex,
      this.current.completedSegments,
      this.current.chosenRoute,
    );
    obstacles.restore(this.current.obstacleProgress);
    hero.resetTo(this.current.heroX, this.current.heroY);
    return structuredClone(this.current);
  }

  clear(): void {
    this.current = null;
    this.reached = 0;
  }
}
