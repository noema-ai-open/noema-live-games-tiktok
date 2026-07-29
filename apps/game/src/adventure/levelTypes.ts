export type SegmentType =
  | "intro"
  | "run"
  | "small_gap"
  | "high_ledge"
  | "broken_bridge"
  | "ravine"
  | "rock_block"
  | "repair_gate"
  | "route_fork"
  | "checkpoint"
  | "finish";

export type AdventureAction =
  | "jump"
  | "build_blocks"
  | "build_bridge"
  | "helper";

export type VisualTheme =
  | "research_valley"
  | "neon_forest"
  | "ruined_slope"
  | "ancient_ravine"
  | "beacon_summit";

export type CameraBehavior = "follow" | "anticipate" | "wide" | "focus";

export type ActionRequirement = {
  action: AdventureAction;
  amount: number;
};

export type LevelSegment = {
  id: string;
  section: 1 | 2 | 3 | 4 | 5;
  type: SegmentType;
  length: number;
  startX: number;
  endX: number;
  groundY: number;
  visualTheme: VisualTheme;
  obstacleType?: SegmentType;
  requiredAction?: AdventureAction;
  requiredAmount?: number;
  alternatives?: ActionRequirement[];
  checkpointAfter?: boolean;
  next: string[];
  camera: CameraBehavior;
  successCriterion: string;
  waitX?: number;
  landingX?: number;
};

export type RouteChoice = "left" | "right";

export type AdventureLevel = {
  id: string;
  name: string;
  version: string;
  seed: number;
  startX: number;
  finishX: number;
  segments: LevelSegment[];
};

export type ObstacleProgress = {
  segmentId: string;
  builtParts: number;
  visibleParts: number;
  requiredParts: number;
  resolved: boolean;
  buildRevision: number;
};

export type LevelSnapshot = {
  segmentIndex: number;
  heroX: number;
  heroY: number;
  completedSegments: string[];
  obstacleProgress: Record<string, ObstacleProgress>;
  chosenRoute: RouteChoice | null;
  remainingTicks: number;
};
