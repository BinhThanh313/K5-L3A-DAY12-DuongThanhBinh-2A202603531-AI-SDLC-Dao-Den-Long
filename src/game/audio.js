// Procedural Web Audio API sound & night ambience synthesizer (browser-only, zero external assets)
export class SoundEffects {
  constructor(initialVolume = 0.7) {
    this.ctx = null;
    this.masterGain = null;
    this.ambienceOsc = null;
    this.muted = false;
    this.volume = initialVolume;
  }

  _ensureCtx() {
    if (this.muted || this.volume <= 0.001) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, Number(v)));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
    }
    return this.muted;
  }

  startAmbience() {
    const ctx = this._ensureCtx();
    if (!ctx || this.ambienceOsc) return;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.value = 110;
    osc2.frequency.value = 164.81;
    gain.gain.value = 0.02;
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);
    osc1.start();
    osc2.start();
    this.ambienceOsc = { osc1, osc2, gain };
  }

  _tone(freq, duration, type = 'sine', gainVal = 0.09, delay = 0, freqEnd = null) {
    const ctx = this._ensureCtx();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playMotePickup(carried) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0];
    const freq = scale[(Math.max(1, carried) - 1) % scale.length];
    this._tone(freq, 0.2, 'sine', 0.09);
  }

  playCharmPickup() {
    this._tone(587.33, 0.2, 'triangle', 0.1, 0);
    this._tone(880.0, 0.3, 'sine', 0.1, 0.06);
  }

  playDeposit() {
    this._tone(440, 0.14, 'triangle', 0.08);
    this._tone(659.25, 0.18, 'sine', 0.08, 0.04);
  }

  playLanternLit() {
    this._tone(392.0, 0.4, 'triangle', 0.1, 0);
    this._tone(523.25, 0.45, 'sine', 0.1, 0.06);
    this._tone(659.25, 0.5, 'sine', 0.1, 0.12);
    this._tone(783.99, 0.65, 'sine', 0.11, 0.2);
  }

  playPulse() {
    this._tone(329.63, 0.32, 'sine', 0.11, 0, 659.25);
    this._tone(659.25, 0.36, 'triangle', 0.07, 0.03);
  }

  playHit() {
    this._tone(160, 0.24, 'sawtooth', 0.1, 0, 75);
  }

  playJump() {
    this._tone(260, 0.16, 'sine', 0.07, 0, 480);
  }

  playDash() {
    this._tone(420, 0.18, 'triangle', 0.08, 0, 180);
  }

  playShadeSpawn() {
    this._tone(190, 0.35, 'sawtooth', 0.06, 0, 120);
  }

  playCountdownTick() {
    this._tone(880, 0.09, 'square', 0.05);
  }

  playWindWarning() {
    this._tone(220, 0.5, 'sine', 0.06, 0, 310);
  }

  playWin() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      this._tone(f, 0.55, 'sine', 0.1, idx * 0.1);
    });
  }

  playLose() {
    [329.63, 293.66, 246.94, 196.0].forEach((f, idx) => {
      this._tone(f, 0.4, 'triangle', 0.09, idx * 0.11);
    });
  }
}
