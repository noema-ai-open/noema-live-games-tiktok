import Phaser from "phaser";
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from "./config/gameConfig";
import { ReplayService } from "./replay/ReplayService";
import { AscentScene } from "./scenes/AscentScene";
import { Simulation } from "./simulation/Simulation";
import { AudioSystem } from "./systems/AudioSystem";
import "./styles/main.css";
import { OperatorPanel } from "./ui/OperatorPanel";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("App root not found");

app.innerHTML = `
  <div class="app-layout">
    <section class="game-column" aria-label="NOEMA Ascent game preview">
      <div class="game-frame">
        <div id="game-root"></div>
      </div>
    </section>
    <aside id="operator-root" class="operator-panel" aria-label="Local operator panel"></aside>
  </div>
`;

const simulation = new Simulation();
const audio = new AudioSystem();
const replays = new ReplayService();
simulation.startRound();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  width: LOGICAL_WIDTH,
  height: LOGICAL_HEIGHT,
  backgroundColor: "#04101c",
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [new AscentScene(simulation, audio)],
});

const operatorRoot = document.querySelector<HTMLElement>("#operator-root");
if (!operatorRoot) throw new Error("Operator root not found");
const panel = new OperatorPanel(operatorRoot, simulation, replays, audio);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    panel.destroy();
    game.destroy(true);
  });
}
