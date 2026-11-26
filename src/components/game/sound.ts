/**
 * Browser-only (Web Audio), so it lives outside `src/lib/`.
 *
 * Zero-asset Web Audio synthesizer for tactile game feedback.
 * Every sound is generated on the fly — no MP3s required.
 *
 * The AudioContext is created lazily on first use (which always happens inside
 * a user gesture in this app), so browsers' autoplay policies are respected.
 */

type Wave = OscillatorType;

interface ToneOptions {
  freq: number;
  /** Optional frequency to glide to over the note's duration. */
  toFreq?: number;
  start?: number;
  duration: number;
  type?: Wave;
  gain?: number;
  attack?: number;
  detune?: number;
  /** Optional low-pass cutoff for warmer timbres. */
  lowpass?: number;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.015);
    }
  }

  isMuted() {
    return this.muted;
  }

  /** Call from a user gesture to unlock audio early (e.g. the Start button). */
  unlock() {
    this.getContext();
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      // Unprefixed AudioContext is supported by every evergreen browser (Safari 14.1+).
      if (typeof window.AudioContext !== "function") return null;
      this.ctx = new window.AudioContext();

      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 8;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.15;

      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(compressor);
      compressor.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private tone(ctx: AudioContext, opts: ToneOptions) {
    if (!this.master) return;
    const {
      freq,
      toFreq,
      start = 0,
      duration,
      type = "sine",
      gain = 0.3,
      attack = 0.005,
      detune = 0,
      lowpass,
    } = opts;
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.detune.value = detune;
    if (toFreq) osc.frequency.exponentialRampToValueAtTime(toFreq, t0 + duration);

    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    let tail: AudioNode = osc;
    if (lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = lowpass;
      filter.Q.value = 0.8;
      osc.connect(filter);
      tail = filter;
    }
    tail.connect(amp);
    amp.connect(this.master);

    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  private noiseBurst(ctx: AudioContext, start: number, duration: number, gain: number, bandHz: number) {
    if (!this.master) return;
    const t0 = ctx.currentTime + start;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = bandHz;
    band.Q.value = 1.4;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    src.connect(band);
    band.connect(amp);
    amp.connect(this.master);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  private play(render: (ctx: AudioContext) => void) {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      render(ctx);
    } catch {
      // Audio is non-essential feedback; never let it break gameplay.
    }
  }

  /** Crisp tactile tap for buttons and answer tiles. */
  click() {
    this.play((ctx) => {
      this.tone(ctx, { freq: 1350, toFreq: 520, duration: 0.06, type: "triangle", gain: 0.32, attack: 0.002 });
      this.noiseBurst(ctx, 0, 0.025, 0.12, 3200);
    });
  }

  /** Bright rising arpeggio chime. */
  correct() {
    this.play((ctx) => {
      const notes = [1046.5, 1318.5, 1568, 2093];
      notes.forEach((freq, i) => {
        this.tone(ctx, { freq, start: i * 0.065, duration: 0.42, type: "sine", gain: 0.24 });
        this.tone(ctx, { freq: freq * 2, start: i * 0.065, duration: 0.2, type: "triangle", gain: 0.05 });
      });
    });
  }

  /** Low detuned buzz. */
  wrong() {
    this.play((ctx) => {
      this.tone(ctx, { freq: 155, toFreq: 92, duration: 0.42, type: "sawtooth", gain: 0.2, lowpass: 900 });
      this.tone(ctx, { freq: 158, toFreq: 94, duration: 0.42, type: "square", gain: 0.1, detune: 18, lowpass: 700 });
    });
  }

  /** Woodblock-style urgency tick; `intensity` 0…1 raises pitch and volume. */
  tick(intensity = 0) {
    this.play((ctx) => {
      const level = Math.min(Math.max(intensity, 0), 1);
      const freq = 1500 + level * 900;
      this.tone(ctx, { freq, toFreq: freq * 0.7, duration: 0.07, type: "square", gain: 0.1 + level * 0.12, lowpass: 4200 });
      this.noiseBurst(ctx, 0, 0.02, 0.08 + level * 0.08, 5000);
    });
  }

  /** Descending "time's up" sweep. */
  timeUp() {
    this.play((ctx) => {
      this.tone(ctx, { freq: 660, toFreq: 180, duration: 0.5, type: "triangle", gain: 0.26 });
      this.tone(ctx, { freq: 330, toFreq: 90, duration: 0.55, type: "sawtooth", gain: 0.08, lowpass: 800 });
    });
  }

  /** Whoosh-up sparkle when a streak milestone is reached. */
  streak() {
    this.play((ctx) => {
      this.tone(ctx, { freq: 400, toFreq: 2400, duration: 0.3, type: "sawtooth", gain: 0.08, lowpass: 3000 });
      [2637, 3136, 3951].forEach((freq, i) =>
        this.tone(ctx, { freq, start: 0.18 + i * 0.05, duration: 0.25, type: "sine", gain: 0.1 }),
      );
    });
  }

  /** Brassy podium fanfare. */
  fanfare() {
    this.play((ctx) => {
      const seq: Array<[number, number, number]> = [
        [523.25, 0, 0.16],
        [659.25, 0.16, 0.16],
        [783.99, 0.32, 0.16],
        [1046.5, 0.5, 0.9],
      ];
      seq.forEach(([freq, start, duration]) => {
        this.tone(ctx, { freq, start, duration, type: "sawtooth", gain: 0.13, lowpass: 2400, attack: 0.02 });
        this.tone(ctx, { freq, start, duration, type: "square", gain: 0.05, detune: 7, lowpass: 1800, attack: 0.02 });
      });
      // Final chord shimmer
      [1318.5, 1568].forEach((freq) =>
        this.tone(ctx, { freq, start: 0.5, duration: 0.9, type: "triangle", gain: 0.08, attack: 0.03 }),
      );
      this.noiseBurst(ctx, 0.5, 0.35, 0.06, 6000);
    });
  }
}

export const sound = new SoundEngine();
