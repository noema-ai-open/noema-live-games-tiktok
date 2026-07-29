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
  imageUrl: "/assets/hero/nuri-spritesheet.png",
  frameWidth: 256,
  frameHeight: 256,
  animations: {
    idle: [0, 1],
    run: [2, 3, 4, 5, 6, 7],
    wait: [8, 9],
    point: [10, 11],
    jump: [12, 13, 14],
    fall: [15, 16],
    land: [17, 18],
    climb: [19, 20, 21, 22],
    push: [23, 24],
    celebrate: [25, 26, 27],
    scared: [28, 29],
    bomb_reaction: [30, 31, 32],
  },
};
