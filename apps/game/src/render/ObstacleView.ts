import Phaser from "phaser";
import type { AdventureSimulation } from "../adventure/AdventureSimulation";
import { BlockBuilderView } from "./BlockBuilderView";
import { BridgeView } from "./BridgeView";
import { HelperView } from "./HelperView";

export class ObstacleView {
  private readonly bridges = new Map<string, BridgeView>();
  private readonly blocks = new Map<string, BlockBuilderView>();
  private readonly gates = new Map<string, Phaser.GameObjects.Container>();
  private readonly helper: HelperView;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly simulation: AdventureSimulation,
  ) {
    this.helper = new HelperView(scene);
    this.createStaticObstacles();
  }

  update(): void {
    const reduced = this.simulation.state.reducedMotion;
    for (const segment of this.simulation.director.level.segments) {
      if (!segment.obstacleType) continue;
      const progress = this.simulation.obstacles.get(segment);
      this.bridges.get(segment.id)?.update(progress, reduced);
      this.blocks.get(segment.id)?.update(progress, reduced);

      const gate = this.gates.get(segment.id);
      if (gate) {
        gate.alpha = Phaser.Math.Linear(
          gate.alpha,
          progress.resolved ? 0.22 : 1,
          reduced ? 0.35 : 0.12,
        );
        gate.scaleY = Phaser.Math.Linear(
          gate.scaleY,
          progress.resolved ? 0.08 : 1,
          reduced ? 0.35 : 0.12,
        );
      }
    }

    const current = this.simulation.director.current;
    this.helper.update(
      this.simulation.hero.state === "helper_active",
      (current.waitX ?? this.simulation.hero.x) - 85,
      current.groundY,
      this.simulation.state.tick,
      reduced,
    );
  }

  private createStaticObstacles(): void {
    for (const segment of this.simulation.director.level.segments) {
      if (segment.type === "ravine" || segment.type === "broken_bridge") {
        this.bridges.set(segment.id, new BridgeView(this.scene, segment));
      }
      if (segment.type === "high_ledge") {
        this.blocks.set(segment.id, new BlockBuilderView(this.scene, segment));
      }
      if (segment.type === "repair_gate") {
        const gateImage = this.scene.add
          .image(0, 0, "world-gate-closed")
          .setOrigin(0.5, 1)
          .setDisplaySize(178, 178);
        const gate = this.scene.add
          .container(segment.waitX ?? segment.startX, segment.groundY, [gateImage])
          .setDepth(15);
        this.gates.set(segment.id, gate);
      }
      if (segment.type === "route_fork") {
        const stem = this.scene.add.rectangle(0, 0, 12, 120, 0x214859);
        const leftSign = this.scene.add
          .text(-82, -82, "1  LINKS\nKURZ · RISIKO", {
            fontFamily: "Inter, Arial, sans-serif",
            fontSize: "17px",
            color: "#eafffb",
            backgroundColor: "#0c2430",
            padding: { x: 12, y: 8 },
            align: "center",
          })
          .setOrigin(0.5);
        const rightSign = this.scene.add
          .text(88, -22, "2  RECHTS\nLANG · SICHER", {
            fontFamily: "Inter, Arial, sans-serif",
            fontSize: "17px",
            color: "#eafffb",
            backgroundColor: "#0c2430",
            padding: { x: 12, y: 8 },
            align: "center",
          })
          .setOrigin(0.5);
        this.scene.add
          .container(segment.waitX ?? segment.startX, segment.groundY, [stem, leftSign, rightSign])
          .setDepth(10);
      }
    }
  }
}
