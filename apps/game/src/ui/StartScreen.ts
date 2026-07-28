import { SUPPORT_URL } from "../config/viewMode";
import type { AppSettings } from "../config/appSettings";
import type { ConnectionSnapshot } from "../connectors/connectionTypes";

export type StartChoice =
  | { mode: "offline" }
  | { mode: "bridge"; address: string };

export type StartScreenHandlers = {
  onTestConnection: (address: string) => Promise<boolean>;
  onStart: (choice: StartChoice) => void;
  onAddressChange: (address: string) => void;
};

const STATUS_LABELS: Record<ConnectionSnapshot["status"], string> = {
  offline: "Nicht verbunden",
  connecting: "Verbinde …",
  connected: "Live verbunden",
  reconnecting: "Neuer Verbindungsversuch",
  error: "Fehler",
};

/**
 * The first screen a streamer sees. It never asks for a password, a cookie or
 * any TikTok credential — the game talks to the locally running bridge.
 */
export class StartScreen {
  private readonly root: HTMLElement;
  private page: "home" | "bridge" | "about" = "home";
  private snapshot: ConnectionSnapshot | null = null;
  private testResult: string | null = null;

  constructor(
    parent: HTMLElement,
    private readonly settings: AppSettings,
    private readonly handlers: StartScreenHandlers,
  ) {
    this.root = document.createElement("div");
    this.root.className = "start-screen";
    parent.append(this.root);
    this.render();
    this.root.addEventListener("click", (event) => this.onClick(event));
    this.root.addEventListener("input", (event) => this.onInput(event));
  }

  setSnapshot(snapshot: ConnectionSnapshot): void {
    this.snapshot = snapshot;
    const status = this.root.querySelector<HTMLElement>("[data-connection]");
    if (status) status.innerHTML = this.connectionMarkup();
  }

  hide(): void {
    this.root.classList.add("is-hidden");
  }

  show(): void {
    this.root.classList.remove("is-hidden");
    this.page = "home";
    this.render();
  }

  destroy(): void {
    this.root.remove();
  }

  private onClick(event: Event): void {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-nav]");
    if (!target) return;
    const nav = target.dataset["nav"];
    if (nav === "bridge" || nav === "home" || nav === "about") {
      this.page = nav;
      this.render();
      return;
    }
    if (nav === "offline") {
      this.handlers.onStart({ mode: "offline" });
      return;
    }
    if (nav === "test") {
      void this.runTest();
      return;
    }
    if (nav === "connect") {
      this.handlers.onStart({ mode: "bridge", address: this.addressValue() });
    }
  }

  private onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.dataset["field"] !== "address") return;
    this.handlers.onAddressChange(input.value.trim());
  }

  private addressValue(): string {
    const input = this.root.querySelector<HTMLInputElement>(
      '[data-field="address"]',
    );
    return input?.value.trim() || this.settings.bridgeAddress;
  }

  private async runTest(): Promise<void> {
    this.testResult = "Prüfe Verbindung …";
    this.renderTestResult();
    const reachable = await this.handlers.onTestConnection(this.addressValue());
    this.testResult = reachable
      ? "Bridge über HTTP erreichbar."
      : "HTTP-Prüfung nicht möglich (normal ohne Proxy). Der Ereignis-Stream wird beim Verbinden geprüft.";
    this.renderTestResult();
  }

  private renderTestResult(): void {
    const element = this.root.querySelector<HTMLElement>("[data-test-result]");
    if (element) element.textContent = this.testResult ?? "";
  }

  private render(): void {
    this.root.innerHTML =
      this.page === "home"
        ? this.homeMarkup()
        : this.page === "bridge"
          ? this.bridgeMarkup()
          : this.aboutMarkup();
  }

  private homeMarkup(): string {
    return `
      <div class="start-card">
        <p class="start-eyebrow">NOEMA LIVE GAMES</p>
        <h1 class="start-title">NOEMA Ascent</h1>
        <p class="start-subtitle">Interactive LIVE Rescue Game</p>
        <div class="start-actions">
          <button class="start-button primary" data-nav="offline">Offline testen</button>
          <button class="start-button" data-nav="bridge">Live Bridge verbinden</button>
          <button class="start-button ghost" disabled title="Noch nicht verfügbar">TikFinity – später</button>
        </div>
        <div class="start-links">
          <button class="start-link" data-nav="bridge">Einstellungen</button>
          <a class="start-link" href="${SUPPORT_URL}" target="_blank" rel="noopener noreferrer">Projekt unterstützen</a>
          <button class="start-link" data-nav="about">Über das Projekt</button>
        </div>
        <p class="start-brand">Powered by NOEMA AI</p>
      </div>
    `;
  }

  private bridgeMarkup(): string {
    return `
      <div class="start-card wide">
        <button class="start-back" data-nav="home">← Zurück</button>
        <h2 class="start-heading">Öffentlichen TikTok-Livestream verbinden</h2>
        <p class="start-note">
          Kein Passwort erforderlich. Die App benötigt keine TikTok-Zugangsdaten.
        </p>
        <label class="start-field">
          Adresse der NOEMA Live Bridge
          <input data-field="address" type="text" value="${escapeHtml(this.settings.bridgeAddress)}" spellcheck="false" />
        </label>
        <p class="start-hint">
          Die Bridge läuft lokal auf deinem Rechner und lauscht standardmäßig auf
          <code>http://127.0.0.1:8765</code>. Der öffentliche TikTok-Name wird
          in der Bridge eingestellt, nicht hier.
        </p>
        <div class="start-actions row">
          <button class="start-button" data-nav="test">Verbindung testen</button>
          <button class="start-button primary" data-nav="connect">Verbinden &amp; Runde starten</button>
        </div>
        <p class="start-test" data-test-result>${escapeHtml(this.testResult ?? "")}</p>
        <div class="start-connection" data-connection>${this.connectionMarkup()}</div>
      </div>
    `;
  }

  private aboutMarkup(): string {
    return `
      <div class="start-card wide">
        <button class="start-back" data-nav="home">← Zurück</button>
        <h2 class="start-heading">Über das Projekt</h2>
        <p class="start-paragraph">
          NOEMA Ascent ist ein interaktives Spiel für TikTok-LIVE-Streams.
          Zuschauer helfen einem Team kleiner Roboter beim Aufstieg durch eine
          beschädigte Megastruktur — mit Likes und Geschenken.
        </p>
        <p class="start-paragraph">
          Alle Ereignisse werden lokal verarbeitet. Es gibt kein Benutzerkonto,
          keine Registrierung und keine Cloud-Datenbank. Die App fragt niemals
          nach TikTok-Zugangsdaten.
        </p>
        <h3 class="start-subheading">Projekt unterstützen</h3>
        <p class="start-paragraph">
          NOEMA Live Games bleibt kostenlos und öffentlich nutzbar.
          KI-Infrastruktur, Tests, Grafik und Weiterentwicklung verursachen
          laufende Kosten. Wer das Projekt gerne nutzt oder damit Einnahmen
          erzielt, kann die weitere Entwicklung freiwillig unterstützen.
        </p>
        <a class="start-button" href="${SUPPORT_URL}" target="_blank" rel="noopener noreferrer">Projekt unterstützen</a>
        <p class="start-brand">Powered by NOEMA AI</p>
      </div>
    `;
  }

  private connectionMarkup(): string {
    if (!this.snapshot) {
      return `<span class="pill">Noch keine Verbindung</span>`;
    }
    const snapshot = this.snapshot;
    return `
      <span class="pill status-${snapshot.status}">${STATUS_LABELS[snapshot.status]}</span>
      <span class="pill">${escapeHtml(snapshot.detail)}</span>
      <span class="pill">${snapshot.eventsPerSecond} Ereignisse/s</span>
      <span class="pill">Profil: ${escapeHtml(snapshot.profile ?? "unbekannt")}</span>
      <span class="pill">Letztes Ereignis: ${escapeHtml(snapshot.lastEventLabel ?? "—")}</span>
    `;
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
