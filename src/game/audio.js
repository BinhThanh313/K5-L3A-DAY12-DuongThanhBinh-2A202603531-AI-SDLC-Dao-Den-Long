// Procedural Web Audio API sound synthesizer (browser-only creativity, zero external assets)
export class SoundEffects {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  _ensureCtx() {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  _tone(freq, duration, type = 'sine', gainVal = 0.08, delay = 0) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playMotePickup(carried) {
    // Pentatonic ascending chime
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0];
    const freq = scale[(Math.max(1, carried) - 1) % scale.length];
    this._tone(freq, 0.22, 'sine', 0.08);
    this._tone(freq * 2, 0.14, 'triangle', 0.03, 0.02);
  }

  playDeposit() {
    this._tone(440, 0.16, 'triangle', 0.07);
    this._tone(659.25, 0.2, 'sine', 0.07, 0.05);
  }

  playLanternLit() {
    this._tone(392.0, 0.45, 'triangle', 0.09, 0);
    this._tone(523.25, 0.5, 'sine', 0.09, 0.07);
    this._tone(659.25, 0.55, 'sine', 0.09, 0.14);
    this._tone(783.99, 0.7, 'sine', 0.1, 0.22);
  }

  playPulse() {
    this._tone(329.63, 0.35, 'sine', 0.1, 0);
    this._tone(659.25, 0.4, 'triangle', 0.07, 0.03);
  }

  playHit() {
    this._tone(140, 0.25, 'sawtooth', 0.08, 0);
    this._tone(95, 0.3, 'triangle', 0.09, 0.05);
  }

  playWin() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      this._tone(f, 0.6, 'sine', 0.09, idx * 0.11);
    });
  }

  playLose() {
    [329.63, 293.66, 246.94, 196.0].forEach((f, idx) => {
      this._tone(f, 0.45, 'triangle', 0.08, idx * 0.12);
    });
  }
}
