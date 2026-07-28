import Phaser from "phaser";
import {
  loadSettings,
  saveSettings,
  type AppSettings,
} from "./config/appSettings";
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from "./config/gameConfig";
import { resolveViewMode, shouldAutoStart } from "./config/viewMode";
import { ConnectorManager } from "./connectors/ConnectorManager";
import type { ConnectionSnapshot } from "./connectors/connectionTypes";
import { loadCatalog, saveCatalog } from "./gifts/giftCatalog";
import { RulesEngine } from "./gifts/RulesEngine";
import { HudScene } from "./render/HudScene";
import { ReplayService } from "./replay/ReplayService";
import { AscentScene } from "./scenes/AscentScene";
import { Simulation } from "./simulation/Simulation";
import { AudioSystem } from "./systems/AudioSystem";
import { LiveSession } from "./systems/LiveSession";
import "./styles/main.css";
import { OperatorPanel } from "./ui/OperatorPanel";
import { StartScreen, type StartChoice } from "./ui/StartScreen";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("App root not found");

const viewMode = resolveViewMode();
let settings: AppSettings = loadSettings();

app.dataset["view"] = viewMode;
app.innerHTML =
  viewMode === "stream"
    ? `<div class="stream-layout"><div class="game-frame"><div id="game-root"></div></div></div>`
    : `<div class="app-layout">
         <section class="game-column" aria-label="NOEMA Ascent Vorschau">
           <div class="game-frame"><div id="game-root"></div></div>
         </section>
         <aside id="operator-root" class="operator-panel" aria-label="Lokales Operator-Panel"></aside>
       </div>`;

const simulation = new Simulation();
const audio = new AudioSystem();
const replays = new ReplayService();
const connectors = new ConnectorManager(settings.bridgeAddress);
const rules = new RulesEngine({ catalog: loadCatalog() });
const live = new LiveSession(simulation, connectors, rules);
live.start();

audio.setMuted(settings.muted);
audio.setVolume("master", settings.masterVolume);

const hudScene = new HudScene(simulation, rules.feedback, rules.getCatalog());
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-root",
  width: LOGICAL_WIDTH,
  height: LOGICAL_HEIGHT,
  backgroundColor: "#03080f",
  render: { antialias: true, pixelArt: false, roundPixels: false },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [new AscentScene(simulation, audio, live), hudScene],
});

// The HUD runs in parallel on its own camera so world shake never moves it.
game.scene.start("HudScene");

function persist(next: AppSettings): void {
  settings = next;
  saveSettings(settings);
}

function applyAccessibility(): void {
  simulation.submit({ type: "set_safe_mode", enabled: settings.safeMode });
  simulation.submit({
    type: "set_reduced_motion",
    enabled: settings.reducedMotion,
  });
}

function beginRound(choice: StartChoice): void {
  audio.unlock();
  if (choice.mode === "bridge") {
    connectors.bridge.setAddress(choice.address);
    persist({
      ...settings,
      bridgeAddress: choice.address,
      lastConnector: "noema-bridge",
    });
    connectors.use("noema-bridge");
  } else {
    persist({ ...settings, lastConnector: "mock" });
    connectors.use("mock");
    connectors.mock.startAmbient();
  }
  rules.reset();
  simulation.startRound();
  applyAccessibility();
}

let startScreen: StartScreen | null = null;
let operatorPanel: OperatorPanel | null = null;

if (viewMode === "operator") {
  const operatorRoot = document.querySelector<HTMLElement>("#operator-root");
  if (!operatorRoot) throw new Error("Operator root not found");

  operatorPanel = new OperatorPanel(operatorRoot, {
    simulation,
    replays,
    audio,
    connectors,
    rules,
    live,
    settings,
    onSettingsChange: (next) => persist(next),
    onCatalogChange: (catalog) => {
      rules.setCatalog(catalog);
      hudScene.setCatalog(catalog);
      saveCatalog(catalog);
    },
    onBackToStart: () => startScreen?.show(),
  });

  startScreen = new StartScreen(app, settings, {
    onAddressChange: (address) => persist({ ...settings, bridgeAddress: address }),
    onTestConnection: async (address) => {
      connectors.bridge.setAddress(address);
      return connectors.bridge.probeRest();
    },
    onStart: (choice) => {
      startScreen?.hide();
      beginRound(choice);
    },
  });
} else {
  // Stream view: reuse the last local configuration, no controls on screen.
  if (settings.lastConnector === "noema-bridge") {
    connectors.use("noema-bridge");
  } else {
    connectors.use("mock");
    connectors.mock.startAmbient();
  }
  // Order matters: startRound() clears the command queue, so the accessibility
  // commands have to be submitted afterwards.
  if (shouldAutoStart()) simulation.startRound();
  applyAccessibility();
}

connectors.onStatus((snapshot: ConnectionSnapshot) => {
  startScreen?.setSnapshot(snapshot);
  operatorPanel?.setSnapshot(snapshot);
});

// Audio may only start after a user gesture.
const unlockAudio = (): void => audio.unlock();
window.addEventListener("pointerdown", unlockAudio, { once: true });
window.addEventListener("keydown", unlockAudio, { once: true });

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    live.stop();
    connectors.stop();
    operatorPanel?.destroy();
    startScreen?.destroy();
    game.destroy(true);
  });
}
