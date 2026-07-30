import type { HeroAnimation } from "../adventure/HeroController";

export type HeroSpriteSheetConfig = {
  imageUrl: string;
  frameWidth: number;
  frameHeight: number;
  animations: Record<HeroAnimation, number[]>;
};

/**
 * Drop-in contract for a later NURI spritesheet. HeroView currently renders
 * articulated procedural body parts and uses the same animation names.
 */
export const NURI_SPRITE_SHEET: HeroSpriteSheetConfig = {
  imageUrl: "/assets/hero/nuri-spritesheet-v1.png",
  frameWidth: 256,
  frameHeight: 256,
  animations: {
    idle: [0],
    run: [0, 1, 0, 2],
    wait: [4],
    point: [5],
    jump: [6],
    fall: [6],
    land: [8],
    climb: [9],
    push: [5],
    celebrate: [11],
    scared: [10],
    bomb_reaction: [10],
  },
};
