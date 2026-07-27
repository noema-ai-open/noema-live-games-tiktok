export type AudioCue =
  | "support"
  | "rescue"
  | "checkpoint"
  | "warning"
  | "earthquake"
  | "countdown"
  | "explosion"
  | "rebuild"
  | "success"
  | "failure";

const FREQUENCIES: Record<AudioCue, number> = {
  support: 620,
  rescue: 840,
  checkpoint: 740,
  warning: 190,
  earthquake: 82,
  countdown: 260,
  explosion: 58,
  rebuild: 440,
  success: 920,
  failure: 130,
};

export class AudioSystem {
  muted = false;
  private context: AudioContext | null = null;

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  play(cue: AudioCue): void {
    if (this.muted || typeof AudioContext === "undefined") return;
    this.context ??= new AudioContext();
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type =
      cue === "explosion" || cue === "earthquake" ? "sawtooth" : "sine";
    oscillator.frequency.setValueAtTime(FREQUENCIES[cue], now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(30, FREQUENCIES[cue] * 0.72),
      now + 0.16,
    );
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(
      cue === "explosion" ? 0.15 : 0.06,
      now + 0.015,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.21);
  }
}
