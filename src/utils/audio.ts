// Web Audio API Synthesizer for UI sound effects
class SoundController {
  private ctx: AudioContext | null = null;
  public soundEnabled: boolean = true;

  constructor() {
    // Read user preference from localStorage if available
    try {
      const saved = localStorage.getItem('talqa_sound_enabled');
      if (saved !== null) {
        this.soundEnabled = saved === 'true';
      }
    } catch {
      this.soundEnabled = true;
    }
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleSound(): boolean {
    this.soundEnabled = !this.soundEnabled;
    try {
      localStorage.setItem('talqa_sound_enabled', String(this.soundEnabled));
    } catch {}
    if (this.soundEnabled) {
      this.playSuccess();
    }
    return this.soundEnabled;
  }

  // Futuristic click/tap
  public playTap() {
    if (!this.soundEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {}
  }

  // Connection Success Chime
  public playSuccess() {
    if (!this.soundEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

      notes.forEach((freq, index) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + index * 0.07);

        gain.gain.setValueAtTime(0, now + index * 0.07);
        gain.gain.linearRampToValueAtTime(0.12, now + index * 0.07 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.07 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + index * 0.07);
        osc.stop(now + index * 0.07 + 0.35);
      });
    } catch {}
  }

  // Error / Alert sound
  public playError() {
    if (!this.soundEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(150, now + 0.25);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {}
  }

  // QR Scan Beep
  public playScanBeep() {
    if (!this.soundEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.setValueAtTime(1800, now + 0.06);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch {}
  }

  // Realistic mechanical wheel tick sound
  public playWheelTick() {
    if (!this.soundEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.025);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.025);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.025);
    } catch {}
  }

  // Grand victory fanfare for winning card prize
  public playFanfare() {
    if (!this.soundEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      // Arpeggio notes: C5, E5, G5, C6, E6, G6
      const arpeggio = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];

      arpeggio.forEach((freq, idx) => {
        if (!this.ctx) return;
        const noteStart = now + idx * 0.08;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(0.18, noteStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + (idx === arpeggio.length - 1 ? 0.8 : 0.28));

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + (idx === arpeggio.length - 1 ? 0.8 : 0.28));
      });
    } catch {}
  }
}

export const soundManager = new SoundController();
