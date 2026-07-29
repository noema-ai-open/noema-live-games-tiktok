import { DEFAULT_SEED } from "../config/gameConfig";
import type { AdventureLevel, LevelSegment } from "./levelTypes";

const beaconSegments: LevelSegment[] = [
  {
    id: "station-intro", section: 1, type: "intro", length: 520, startX: 0, endX: 520,
    groundY: 650, visualTheme: "research_valley", next: ["valley-run"], camera: "follow",
    successCriterion: "NURI leaves the research station",
  },
  {
    id: "valley-run", section: 1, type: "run", length: 400, startX: 520, endX: 920,
    groundY: 650, visualTheme: "research_valley", next: ["gap-rose"], camera: "follow",
    successCriterion: "NURI reaches the first gap",
  },
  {
    id: "gap-rose", section: 1, type: "small_gap", length: 380, startX: 920, endX: 1300,
    groundY: 650, visualTheme: "neon_forest", obstacleType: "small_gap",
    requiredAction: "jump", requiredAmount: 1, checkpointAfter: true, next: ["slope-run"],
    camera: "anticipate", successCriterion: "NURI lands beyond the gap", waitX: 1010, landingX: 1170,
  },
  {
    id: "slope-run", section: 2, type: "run", length: 300, startX: 1300, endX: 1600,
    groundY: 630, visualTheme: "ruined_slope", next: ["high-ledge"], camera: "follow",
    successCriterion: "NURI reaches the steep ledge",
  },
  {
    id: "high-ledge", section: 2, type: "high_ledge", length: 520, startX: 1600, endX: 2120,
    groundY: 610, visualTheme: "ruined_slope", obstacleType: "high_ledge",
    requiredAction: "build_blocks", requiredAmount: 3, checkpointAfter: true, next: ["route-fork"],
    camera: "focus", successCriterion: "Three energy stones form a climbable stair",
    waitX: 1740, landingX: 1950,
  },
  {
    id: "route-fork", section: 3, type: "route_fork", length: 480, startX: 2120, endX: 2600,
    groundY: 550, visualTheme: "ruined_slope", obstacleType: "route_fork",
    next: ["route-left-gap", "route-right-bridge"], camera: "wide",
    successCriterion: "A ten second chat vote chooses the route", waitX: 2260, landingX: 2480,
  },
  {
    id: "route-left-gap", section: 3, type: "small_gap", length: 420, startX: 2600, endX: 3020,
    groundY: 530, visualTheme: "neon_forest", obstacleType: "small_gap",
    requiredAction: "jump", requiredAmount: 1, next: ["ravine-main"], camera: "anticipate",
    successCriterion: "NURI clears the risky upper gap", waitX: 2700, landingX: 2870,
  },
  {
    id: "route-right-bridge", section: 3, type: "broken_bridge", length: 520,
    startX: 2600, endX: 3120, groundY: 610, visualTheme: "ancient_ravine",
    obstacleType: "broken_bridge", requiredAction: "build_blocks", requiredAmount: 3,
    alternatives: [{ action: "build_bridge", amount: 1 }], next: ["ravine-main"], camera: "focus",
    successCriterion: "The safe route bridge is repaired", waitX: 2740, landingX: 2990,
  },
  {
    id: "ravine-main", section: 4, type: "ravine", length: 840, startX: 3120, endX: 3960,
    groundY: 610, visualTheme: "ancient_ravine", obstacleType: "ravine",
    requiredAction: "build_bridge", requiredAmount: 1,
    alternatives: [{ action: "build_blocks", amount: 6 }], checkpointAfter: true,
    next: ["summit-climb"], camera: "wide", successCriterion: "All six bridge segments are solid",
    waitX: 3280, landingX: 3770,
  },
  {
    id: "summit-climb", section: 5, type: "run", length: 520, startX: 3960, endX: 4480,
    groundY: 570, visualTheme: "beacon_summit", next: ["beacon-gate"], camera: "follow",
    successCriterion: "NURI reaches the summit gate",
  },
  {
    id: "beacon-gate", section: 5, type: "repair_gate", length: 500, startX: 4480, endX: 4980,
    groundY: 540, visualTheme: "beacon_summit", obstacleType: "repair_gate",
    requiredAction: "helper", requiredAmount: 1, next: ["beacon-finish"], camera: "focus",
    successCriterion: "The Corgi helper repairs and opens the gate", waitX: 4620, landingX: 4840,
  },
  {
    id: "beacon-finish", section: 5, type: "finish", length: 520, startX: 4980, endX: 5500,
    groundY: 520, visualTheme: "beacon_summit", next: [], camera: "wide",
    successCriterion: "NURI inserts the core and activates the sky beacon",
  },
];

const cavernSegments: LevelSegment[] = [
  {
    id: "cavern-intro", section: 1, type: "intro", length: 420, startX: 0, endX: 420,
    groundY: 650, visualTheme: "crystal_cavern", next: ["crystal-run"], camera: "follow",
    successCriterion: "NURI enters the neon caverns",
  },
  {
    id: "crystal-run", section: 1, type: "run", length: 440, startX: 420, endX: 860,
    groundY: 650, visualTheme: "crystal_cavern", next: ["crystal-gap"], camera: "follow",
    successCriterion: "NURI reaches the crystal fissure",
  },
  {
    id: "crystal-gap", section: 1, type: "small_gap", length: 400, startX: 860, endX: 1260,
    groundY: 650, visualTheme: "crystal_cavern", obstacleType: "small_gap",
    requiredAction: "jump", requiredAmount: 1, checkpointAfter: true, next: ["machine-ledge"],
    camera: "anticipate", successCriterion: "NURI jumps the crystal fissure", waitX: 960, landingX: 1130,
  },
  {
    id: "machine-ledge", section: 2, type: "high_ledge", length: 560, startX: 1260, endX: 1820,
    groundY: 630, visualTheme: "machine_depths", obstacleType: "high_ledge",
    requiredAction: "build_blocks", requiredAmount: 3, checkpointAfter: true, next: ["cavern-fork"],
    camera: "focus", successCriterion: "Energy blocks reach the old machine deck",
    waitX: 1410, landingX: 1640,
  },
  {
    id: "cavern-fork", section: 3, type: "route_fork", length: 460, startX: 1820, endX: 2280,
    groundY: 570, visualTheme: "machine_depths", obstacleType: "route_fork",
    next: ["upper-crystal-gap", "lower-machine-bridge"], camera: "wide",
    successCriterion: "Chat chooses the crystal or machine route", waitX: 1960, landingX: 2160,
  },
  {
    id: "upper-crystal-gap", section: 3, type: "small_gap", length: 440, startX: 2280, endX: 2720,
    groundY: 550, visualTheme: "crystal_cavern", obstacleType: "small_gap",
    requiredAction: "jump", requiredAmount: 1, next: ["cavern-ravine"], camera: "anticipate",
    successCriterion: "NURI clears the upper crystal crack", waitX: 2390, landingX: 2560,
  },
  {
    id: "lower-machine-bridge", section: 3, type: "broken_bridge", length: 520,
    startX: 2280, endX: 2800, groundY: 620, visualTheme: "machine_depths",
    obstacleType: "broken_bridge", requiredAction: "build_blocks", requiredAmount: 3,
    alternatives: [{ action: "build_bridge", amount: 1 }], next: ["cavern-ravine"], camera: "focus",
    successCriterion: "The old machine bridge is restored", waitX: 2420, landingX: 2680,
  },
  {
    id: "cavern-ravine", section: 4, type: "ravine", length: 820, startX: 2800, endX: 3620,
    groundY: 610, visualTheme: "crystal_cavern", obstacleType: "ravine",
    requiredAction: "build_bridge", requiredAmount: 1,
    alternatives: [{ action: "build_blocks", amount: 6 }], checkpointAfter: true,
    next: ["reactor-run"], camera: "wide", successCriterion: "The crystal abyss is bridged",
    waitX: 2960, landingX: 3440,
  },
  {
    id: "reactor-run", section: 5, type: "run", length: 500, startX: 3620, endX: 4120,
    groundY: 590, visualTheme: "machine_depths", next: ["reactor-gate"], camera: "follow",
    successCriterion: "NURI reaches the sealed reactor",
  },
  {
    id: "reactor-gate", section: 5, type: "repair_gate", length: 500, startX: 4120, endX: 4620,
    groundY: 570, visualTheme: "machine_depths", obstacleType: "repair_gate",
    requiredAction: "helper", requiredAmount: 1, next: ["cavern-finish"], camera: "focus",
    successCriterion: "The helper opens the reactor seal", waitX: 4260, landingX: 4480,
  },
  {
    id: "cavern-finish", section: 5, type: "finish", length: 520, startX: 4620, endX: 5140,
    groundY: 550, visualTheme: "crystal_cavern", next: [], camera: "wide",
    successCriterion: "NURI charges the core at the crystal relay",
  },
];

const stormSegments: LevelSegment[] = [
  {
    id: "storm-intro", section: 1, type: "intro", length: 420, startX: 0, endX: 420,
    groundY: 650, visualTheme: "storm_pass", next: ["wind-run"], camera: "follow",
    successCriterion: "NURI enters the storm pass",
  },
  {
    id: "wind-run", section: 1, type: "run", length: 430, startX: 420, endX: 850,
    groundY: 650, visualTheme: "storm_pass", next: ["storm-gap"], camera: "follow",
    successCriterion: "NURI reaches the broken sky path",
  },
  {
    id: "storm-gap", section: 1, type: "small_gap", length: 410, startX: 850, endX: 1260,
    groundY: 650, visualTheme: "storm_pass", obstacleType: "small_gap",
    requiredAction: "jump", requiredAmount: 1, checkpointAfter: true, next: ["sky-ledge"],
    camera: "anticipate", successCriterion: "NURI jumps through the storm", waitX: 950, landingX: 1130,
  },
  {
    id: "sky-ledge", section: 2, type: "high_ledge", length: 560, startX: 1260, endX: 1820,
    groundY: 620, visualTheme: "sky_ruins", obstacleType: "high_ledge",
    requiredAction: "build_blocks", requiredAmount: 3, checkpointAfter: true, next: ["storm-fork"],
    camera: "focus", successCriterion: "Energy blocks reach the sky ruins",
    waitX: 1410, landingX: 1650,
  },
  {
    id: "storm-fork", section: 3, type: "route_fork", length: 470, startX: 1820, endX: 2290,
    groundY: 560, visualTheme: "sky_ruins", obstacleType: "route_fork",
    next: ["lightning-gap", "shelter-bridge"], camera: "wide",
    successCriterion: "Chat chooses speed or shelter", waitX: 1960, landingX: 2160,
  },
  {
    id: "lightning-gap", section: 3, type: "small_gap", length: 430, startX: 2290, endX: 2720,
    groundY: 540, visualTheme: "storm_pass", obstacleType: "small_gap",
    requiredAction: "jump", requiredAmount: 1, next: ["sky-ravine"], camera: "anticipate",
    successCriterion: "NURI clears the lightning gap", waitX: 2390, landingX: 2570,
  },
  {
    id: "shelter-bridge", section: 3, type: "broken_bridge", length: 520,
    startX: 2290, endX: 2810, groundY: 610, visualTheme: "sky_ruins",
    obstacleType: "broken_bridge", requiredAction: "build_blocks", requiredAmount: 3,
    alternatives: [{ action: "build_bridge", amount: 1 }], next: ["sky-ravine"], camera: "focus",
    successCriterion: "The sheltered ruin bridge is restored", waitX: 2430, landingX: 2690,
  },
  {
    id: "sky-ravine", section: 4, type: "ravine", length: 840, startX: 2810, endX: 3650,
    groundY: 600, visualTheme: "storm_pass", obstacleType: "ravine",
    requiredAction: "build_bridge", requiredAmount: 1,
    alternatives: [{ action: "build_blocks", amount: 6 }], checkpointAfter: true,
    next: ["summit-storm-run"], camera: "wide", successCriterion: "The storm ravine is bridged",
    waitX: 2970, landingX: 3460,
  },
  {
    id: "summit-storm-run", section: 5, type: "run", length: 500, startX: 3650, endX: 4150,
    groundY: 570, visualTheme: "sky_ruins", next: ["final-gate"], camera: "follow",
    successCriterion: "NURI reaches the final beacon gate",
  },
  {
    id: "final-gate", section: 5, type: "repair_gate", length: 500, startX: 4150, endX: 4650,
    groundY: 550, visualTheme: "sky_ruins", obstacleType: "repair_gate",
    requiredAction: "helper", requiredAmount: 1, next: ["storm-finish"], camera: "focus",
    successCriterion: "The helper repairs the final beacon gate", waitX: 4290, landingX: 4510,
  },
  {
    id: "storm-finish", section: 5, type: "finish", length: 540, startX: 4650, endX: 5190,
    groundY: 530, visualTheme: "storm_pass", next: [], camera: "wide",
    successCriterion: "NURI activates the highest sky beacon",
  },
];

function level(
  seed: number,
  id: string,
  name: string,
  region: AdventureLevel["region"],
  celebration: AdventureLevel["celebration"],
  finishX: number,
  segments: LevelSegment[],
): AdventureLevel {
  return {
    id,
    name,
    version: "2.0.0",
    seed,
    region,
    celebration,
    startX: 120,
    finishX,
    segments: structuredClone(segments),
  };
}

export function createAdventureCampaign(seed = DEFAULT_SEED): AdventureLevel[] {
  return [
    level(seed, "path-to-sky-beacon", "DER WEG ZUM HIMMELSLEUCHTFEUER", "valley", "spark_burst", 5360, beaconSegments),
    level(seed ^ 0x19a2b3c4, "neon-caverns", "DIE KRISTALLHÖHLEN", "crystal_caves", "crystal_wave", 5000, cavernSegments),
    level(seed ^ 0x63d91f27, "storm-pass", "DER STURMGIPFEL", "storm_summit", "fireworks", 5050, stormSegments),
  ];
}

export function createBeaconLevel(seed = DEFAULT_SEED): AdventureLevel {
  return createAdventureCampaign(seed)[0]!;
}
