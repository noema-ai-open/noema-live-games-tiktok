export type AudioCue =
  | "gift"
  | "footsteps"
  | "support"
  | "repair"
  | "bridge"
  | "bridge_segment"
  | "build_block"
  | "jump"
  | "land"
  | "helper_arrive"
  | "checkpoint"
  | "route_vote"
  | "bomb_warning"
  | "bomb_impact"
  | "rebuild"
  | "success"
  | "failure";

export type AudioChannel = "effects" | "warnings";

type CueSpec = {
  channel: AudioChannel;
  type: OscillatorType;
  /** Start and end frequency of the sweep, in hertz. */
  from: number;
  to: number;
  durationSeconds: number;
  gain: number;
  /** Optional second voice for a fuller chord. */
  harmonic?: number;
  /** Adds a short noise burst — used for impacts and rumble. */
  noise?: number;
};

/**
 * Every sound is synthesised locally with the Web Audio API. The repository
 * contains no third-party audio files.
 */
const CUES: Record<AudioCue, CueSpec> = {
  gift: { channel: "effects", type: "triangle", from: 780, to: 1180, durationSeconds: 0.14, gain: 0.05, harmonic: 1.5 },
  footsteps: { channel: "effects", type: "sine", from: 120, to: 90, durationSeconds: 0.08, gain: 0.022 },
  support: { channel: "effects", type: "sine", from: 620, to: 880, durationSeconds: 0.16, gain: 0.05 },
  repair: { channel: "effects", type: "sine", from: 520, to: 900, durationSeconds: 0.22, gain: 0.05, harmonic: 2 },
  bridge: { channel: "effects", type: "square", from: 240, to: 480, durationSeconds: 0.3, gain: 0.045, harmonic: 1.5 },
  bridge_segment: { channel: "effects", type: "square", from: 260, to: 520, durationSeconds: 0.25, gain: 0.045, harmonic: 1.5 },
  build_block: { channel: "effects", type: "triangle", from: 300, to: 700, durationSeconds: 0.2, gain: 0.045 },
  jump: { channel: "effects", type: "triangle", from: 380, to: 1020, durationSeconds: 0.18, gain: 0.05 },
  land: { channel: "effects", type: "sine", from: 180, to: 80, durationSeconds: 0.16, gain: 0.05, noise: 0.15 },
  helper_arrive: { channel: "effects", type: "triangle", from: 560, to: 1040, durationSeconds: 0.24, gain: 0.05, harmonic: 1.5 },
  checkpoint: { channel: "effects", type: "triangle", from: 660, to: 990, durationSeconds: 0.24, gain: 0.05 },
  route_vote: { channel: "effects", type: "sine", from: 440, to: 660, durationSeconds: 0.2, gain: 0.04 },
  bomb_warning: { channel: "warnings", type: "square", from: 420, to: 190, durationSeconds: 0.55, gain: 0.06 },
  bomb_impact: { channel: "warnings", type: "sawtooth", from: 150, to: 30, durationSeconds: 1, gain: 0.1, noise: 1 },
  rebuild: { channel: "effects", type: "sine", from: 340, to: 720, durationSeconds: 0.5, gain: 0.05, harmonic: 1.5 },
  success: { channel: "effects", type: "triangle", from: 620, to: 1240, durationSeconds: 0.6, gain: 0.06, harmonic: 1.25 },
  failure: { channel: "warnings", type: "sine", from: 260, to: 110, durationSeconds: 0.55, gain: 0.05 },
};

export class AudioSystem {
  muted = false;

  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private channels = new Map<AudioChannel, GainNode>();
  private volumes: Record<"master" | AudioChannel, number> = {
    master: 0.8,
    effects: 0.9,
    warnings: 1,
  };
  private unlocked = false;
  private noiseBuffer: AudioBuffer | null = null;

  /**
   * Browsers block audio until a user gesture. Call this from a click or key
   * handler; nothing is created before that point.
   */
  unlock(): void {
    if (this.unlocked) return;
    const context = this.ensureContext();
    if (!context) return;
    void context.resume();
    this.unlocked = true;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolumes();
  }

  setVolume(channel: "master" | AudioChannel, value: number): void {
    this.volumes[channel] = Math.max(0, Math.min(1, value));
    this.applyVolumes();
  }

  getVolume(channel: "master" | AudioChannel): number {
    return this.volumes[channel];
  }

  play(cue: AudioCue): void {
    if (this.muted || !this.unlocked) return;
    const context = this.ensureContext();
    if (!context) return;
    const spec = CUES[cue];
    const target = this.channels.get(spec.channel);
    if (!target) return;

    const now = context.currentTime;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(spec.gain, now + 0.012);
    envelope.gain.exponentialRampToValueAtTime(
      0.0001,
      now + spec.durationSeconds,
    );
    envelope.connect(target);

    this.playVoice(context, envelope, spec, spec.from, spec.to, now);
    if (spec.harmonic) {
      this.playVoice(
        context,
        envelope,
        spec,
        spec.from * spec.harmonic,
        spec.to * spec.harmonic,
        now,
        0.45,
      );
    }
    if (spec.noise) this.playNoise(context, envelope, spec, now);
  }

  private playVoice(
    context: AudioContext,
    destination: GainNode,
    spec: CueSpec,
    from: number,
    to: number,
    now: number,
    level = 1,
  ): void {
    const oscillator = context.createOscillator();
    oscillator.type = spec.type;
    oscillator.frequency.setValueAtTime(Math.max(20, from), now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, to),
      now + spec.durationSeconds,
    );
    if (level === 1) {
      oscillator.connect(destination);
    } else {
      const gain = context.createGain();
      gain.gain.value = level;
      oscillator.connect(gain);
      gain.connect(destination);
    }
    oscillator.start(now);
    oscillator.stop(now + spec.durationSeconds + 0.02);
  }

  private playNoise(
    context: AudioContext,
    destination: GainNode,
    spec: CueSpec,
    now: number,
  ): void {
    const buffer = this.ensureNoiseBuffer(context);
    if (!buffer) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(
      140,
      now + spec.durationSeconds,
    );
    const gain = context.createGain();
    gain.gain.value = spec.noise ?? 0.5;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    source.start(now);
    source.stop(now + spec.durationSeconds);
  }

  private ensureNoiseBuffer(context: AudioContext): AudioBuffer | null {
    if (this.noiseBuffer) return this.noiseBuffer;
    const length = Math.floor(context.sampleRate * 1.2);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    if (typeof AudioContext === "undefined") return null;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.connect(this.context.destination);
    for (const channel of ["effects", "warnings"] as const) {
      const gain = this.context.createGain();
      gain.connect(this.master);
      this.channels.set(channel, gain);
    }
    this.applyVolumes();
    return this.context;
  }

  private applyVolumes(): void {
    if (!this.master) return;
    this.master.gain.value = this.muted ? 0 : this.volumes.master;
    for (const [channel, node] of this.channels) {
      node.gain.value = this.volumes[channel];
    }
  }
}
