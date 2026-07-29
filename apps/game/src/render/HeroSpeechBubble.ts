import Phaser from "phaser";
import type { SimulationState } from "../simulation/types";

export class HeroSpeechBubble {
  private readonly container: Phaser.GameObjects.Container;
  private readonly text: Phaser.GameObjects.Text;
  private wasVisible = false;

  constructor(private readonly scene: Phaser.Scene) {
    const background = scene.add.graphics();
    background.fillStyle(0x0b2735, 0.97);
    background.fillRoundedRect(-130, -38, 260, 76, 18);
    background.lineStyle(4, 0x73fff0, 1);
    background.strokeRoundedRect(-130, -38, 260, 76, 18);
    background.fillStyle(0xff5fa8, 1);
    background.fillRoundedRect(-108, -31, 68, 4, 2);

    const tail = scene.add
      .triangle(-62, 48, 0, 0, 32, 0, 20, 25, 0x0b2735, 0.97)
      .setStrokeStyle(4, 0x73fff0, 1);

    this.text = scene.add
      .text(0, 3, "", {
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: "20px",
        fontStyle: "bold",
        color: "#effff8",
        align: "center",
        wordWrap: { width: 224 },
      })
      .setOrigin(0.5);

    this.container = scene.add
      .container(0, 0, [tail, background, this.text])
      .setDepth(40)
      .setVisible(false);
  }

  update(
    state: SimulationState,
    heroX: number,
    heroY: number,
    _tick: number,
    reducedMotion: boolean,
  ): void {
    const visible = state.speechBubble.visible;
    this.container.setPosition(heroX - 20, heroY - 190);
    this.text.setText(state.speechBubble.text);

    if (!visible) {
      if (this.wasVisible) this.scene.tweens.killTweensOf(this.container);
      this.container.setVisible(false).setAlpha(0).setScale(1);
      this.wasVisible = false;
      return;
    }

    if (!this.wasVisible) {
      this.scene.tweens.killTweensOf(this.container);
      this.container.setVisible(true);
      if (reducedMotion) {
        this.container.setAlpha(1).setScale(1);
      } else {
        this.container.setAlpha(0).setScale(0.72);
        this.scene.tweens.add({
          targets: this.container,
          alpha: 1,
          scaleX: 1,
          scaleY: 1,
          duration: 200,
          ease: "Back.easeOut",
        });
      }
    }

    this.wasVisible = true;
  }
}
