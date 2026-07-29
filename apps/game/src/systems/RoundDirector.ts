import type { Simulation } from "../simulation/Simulation";

export type RoundDirectorOptions = {
  enabled: boolean;
  /** Wie lange das Ergebnis stehen bleibt, bevor die naechste Runde startet. */
  delaySeconds: number;
  successDelaySeconds?: number;
  failureDelaySeconds?: number;
  /** Wird beim Neustart gerufen, damit Aufrufer aufraeumen koennen. */
  onRestart?: (seed: number) => void;
};

/**
 * Automodus: startet nach dem Rundenende von selbst eine neue Runde.
 *
 * Ein Stream laeuft stundenlang; niemand soll dabei am Rechner sitzen und nach
 * jeder Runde einen Knopf druecken. Das Ergebnis bleibt kurz stehen, damit die
 * Zuschauer es lesen koennen, dann geht es mit einem neuen Seed weiter.
 */
export class RoundDirector {
  private timer: ReturnType<typeof setInterval> | null = null;
  private restartAt: number | null = null;
  private options: RoundDirectorOptions;

  constructor(
    private readonly simulation: Simulation,
    options: RoundDirectorOptions,
  ) {
    this.options = options;
  }

  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => this.tick(), 500);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.restartAt = null;
  }

  setEnabled(enabled: boolean): void {
    this.options = { ...this.options, enabled };
    if (!enabled) this.restartAt = null;
  }

  isEnabled(): boolean {
    return this.options.enabled;
  }

  /** Sekunden bis zum Neustart, sonst null — fuer die Anzeige. */
  getCountdown(now = Date.now()): number | null {
    if (this.restartAt === null) return null;
    return Math.max(0, Math.ceil((this.restartAt - now) / 1000));
  }

  private tick(now = Date.now()): void {
    const status = this.simulation.state.roundStatus;
    const finished = status === "success" || status === "failure";

    if (!finished || !this.options.enabled) {
      // Sobald wieder gespielt wird, ist ein geplanter Neustart hinfaellig.
      if (!finished) this.restartAt = null;
      return;
    }

    if (this.restartAt === null) {
      const delay =
        status === "success"
          ? (this.options.successDelaySeconds ?? this.options.delaySeconds)
          : (this.options.failureDelaySeconds ?? this.options.delaySeconds);
      this.restartAt = now + delay * 1000;
      return;
    }
    if (now < this.restartAt) return;

    this.restartAt = null;
    // Neuer Seed pro Runde, damit sich der Verlauf unterscheidet. Innerhalb
    // einer Runde bleibt alles deterministisch und wiederholbar.
    const seed = (this.simulation.state.seed * 1664525 + 1013904223) >>> 0;
    this.simulation.startRound(seed);
    this.options.onRestart?.(seed);
  }

  /** Nur fuer Tests: einen Durchlauf mit fester Zeit ausloesen. */
  tickAt(now: number): void {
    this.tick(now);
  }
}
