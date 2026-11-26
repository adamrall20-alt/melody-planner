export type AmbientTrackId = 'rain' | 'cafe' | 'fire' | 'waves';

interface TrackNodes {
  source: AudioBufferSourceNode;
  gain: GainNode;
  lfo?: OscillatorNode;
}

class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private activeTracks = new Map<AmbientTrackId, TrackNodes>();
  private volumes: Record<AmbientTrackId, number> = {
    rain: 0.45,
    cafe: 0.35,
    fire: 0.4,
    waves: 0.4,
  };

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private createNoiseBuffer(ctx: AudioContext, type: 'pink' | 'brown'): AudioBuffer {
    const length = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    if (type === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      }
    } else {
      let lastOut = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 1.8;
      }
    }
    return buffer;
  }

  toggleTrack(id: AmbientTrackId): boolean {
    if (this.activeTracks.has(id)) {
      this.stopTrack(id);
      return false;
    }
    this.startTrack(id);
    return true;
  }

  startTrack(id: AmbientTrackId): void {
    if (this.activeTracks.has(id)) return;
    const ctx = this.ensureContext();
    const source = ctx.createBufferSource();
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    gain.gain.value = this.volumes[id] * 0.55;

    let lfo: OscillatorNode | undefined;

    if (id === 'rain') {
      source.buffer = this.createNoiseBuffer(ctx, 'pink');
      filter.type = 'bandpass';
      filter.frequency.value = 1100;
      filter.Q.value = 0.45;
    } else if (id === 'cafe') {
      source.buffer = this.createNoiseBuffer(ctx, 'brown');
      filter.type = 'lowpass';
      filter.frequency.value = 480;
    } else if (id === 'fire') {
      source.buffer = this.createNoiseBuffer(ctx, 'brown');
      filter.type = 'bandpass';
      filter.frequency.value = 260;
      filter.Q.value = 0.8;
      lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 3.2;
      lfoGain.gain.value = 0.08;
      lfo.connect(lfoGain).connect(gain.gain);
      lfo.start();
    } else {
      // ocean waves
      source.buffer = this.createNoiseBuffer(ctx, 'pink');
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.12;
      lfoGain.gain.value = 0.18;
      lfo.connect(lfoGain).connect(gain.gain);
      lfo.start();
    }

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
    this.activeTracks.set(id, { source, gain, lfo });
  }

  stopTrack(id: AmbientTrackId): void {
    const nodes = this.activeTracks.get(id);
    if (!nodes) return;
    try {
      nodes.source.stop();
      nodes.source.disconnect();
      nodes.lfo?.stop();
      nodes.gain.disconnect();
    } catch {
      // ignore
    }
    this.activeTracks.delete(id);
  }

  stopAll(): void {
    for (const id of [...this.activeTracks.keys()]) {
      this.stopTrack(id);
    }
  }

  setVolume(id: AmbientTrackId, value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.volumes[id] = clamped;
    const nodes = this.activeTracks.get(id);
    if (nodes && this.ctx) {
      nodes.gain.gain.setTargetAtTime(clamped * 0.55, this.ctx.currentTime, 0.05);
    }
  }

  getVolume(id: AmbientTrackId): number {
    return this.volumes[id];
  }

  isPlaying(id: AmbientTrackId): boolean {
    return this.activeTracks.has(id);
  }

  playChime(): void {
    const ctx = this.ensureContext();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + idx * 0.11;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.72);
    });
  }
}

export const ambientAudio = new AmbientAudioEngine();
