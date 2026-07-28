import Phaser from "phaser";
import { SeededRandom } from "../simulation/rng";

export const TEXTURE_KEYS = {
  glow: "noema-glow",
  spark: "noema-spark",
  smoke: "noema-smoke",
  shard: "noema-shard",
  grain: "noema-grain",
} as const;

/**
 * All textures are generated at runtime from Phaser primitives. The repository
 * therefore contains no third-party image assets.
 */
export function ensureTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(TEXTURE_KEYS.glow)) {
    const size = 64;
    const canvas = scene.textures.createCanvas(TEXTURE_KEYS.glow, size, size);
    const context = canvas?.context;
    if (context) {
      const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.35, "rgba(255,255,255,0.55)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
      canvas?.refresh();
    }
  }

  if (!scene.textures.exists(TEXTURE_KEYS.spark)) {
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(3, 0, 2, 10);
    graphics.fillStyle(0xffffff, 0.5);
    graphics.fillRect(2, 2, 4, 6);
    graphics.generateTexture(TEXTURE_KEYS.spark, 8, 10);
    graphics.destroy();
  }

  if (!scene.textures.exists(TEXTURE_KEYS.smoke)) {
    const size = 96;
    const canvas = scene.textures.createCanvas(TEXTURE_KEYS.smoke, size, size);
    const context = canvas?.context;
    if (context) {
      const rng = new SeededRandom(0x5c0f1a);
      for (let index = 0; index < 26; index += 1) {
        const x = 16 + rng.next() * 64;
        const y = 16 + rng.next() * 64;
        const radius = 8 + rng.next() * 20;
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, "rgba(255,255,255,0.20)");
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);
      }
      canvas?.refresh();
    }
  }

  if (!scene.textures.exists(TEXTURE_KEYS.shard)) {
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillTriangle(0, 12, 6, 0, 12, 9);
    graphics.generateTexture(TEXTURE_KEYS.shard, 12, 12);
    graphics.destroy();
  }

  if (!scene.textures.exists(TEXTURE_KEYS.grain)) {
    const size = 128;
    const canvas = scene.textures.createCanvas(TEXTURE_KEYS.grain, size, size);
    const context = canvas?.context;
    if (context) {
      const rng = new SeededRandom(0x71a17e);
      const image = context.createImageData(size, size);
      for (let index = 0; index < image.data.length; index += 4) {
        const value = Math.floor(rng.next() * 255);
        image.data[index] = value;
        image.data[index + 1] = value;
        image.data[index + 2] = value;
        image.data[index + 3] = 14;
      }
      context.putImageData(image, 0, 0);
      canvas?.refresh();
    }
  }
}
