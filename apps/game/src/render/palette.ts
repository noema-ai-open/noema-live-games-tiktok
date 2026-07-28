/**
 * NOEMA Ascent colour system.
 *
 * The world is a cold industrial megastructure lit by warm construction light.
 * Support effects are cyan/green, sabotage is amber/red, catastrophe is
 * magenta-red. Every value is an original choice for this project.
 */
export const PALETTE = {
  skyTop: 0x0a1b33,
  skyBottom: 0x03080f,
  hazeFar: 0x14324f,
  hazeNear: 0x0a2135,

  towerFar: 0x0a1a2a,
  towerMid: 0x102a3f,
  towerNear: 0x16394f,
  towerEdge: 0x2b6c88,

  deckFill: 0x0d2233,
  deckTop: 0x1d4a63,
  deckLight: 0x3fd8ff,

  energy: 0x3fe8ff,
  energySoft: 0x9df3ff,
  support: 0x5dffa8,
  warn: 0xffb43a,
  danger: 0xff4d5e,
  catastrophe: 0xff2f6d,

  text: "#eaf6ff",
  textDim: "#8fb0c6",
  textWarn: "#ffd27a",
} as const;

export const ROBOT_ACCENTS = [
  0x3fe8ff, // cyan technician
  0xffa63a, // amber hauler
  0x7dff9f, // green scout
  0xc98cff, // violet engineer
] as const;

export const ROBOT_SHELLS = [0x14304a, 0x2a2438, 0x123a34, 0x2c2140] as const;

export function toCss(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}
