import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AudioService {
  private audioCtx: AudioContext | null = null;
  private isMutedState = false;
  private volumeLevel = 0.8;

  constructor() {
    this.isMutedState = localStorage.getItem('sine_sound_muted') === 'true';
    const savedVol = localStorage.getItem('sine_sound_volume');
    if (savedVol !== null) {
      const v = parseFloat(savedVol);
      if (!isNaN(v) && v >= 0 && v <= 1) this.volumeLevel = v;
    }
    this.setupUserGestureUnlock();
  }

  /**
   * Mobile WebView & Autoplay Policy Unlock:
   * Browsers suspend AudioContext until an initial user gesture occurs.
   * We attach passive global listeners to immediately resume the audio context on first touch/click.
   */
  private setupUserGestureUnlock(): void {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      const ctx = this.getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      window.removeEventListener('click', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
    window.addEventListener('click', unlock, { capture: true, passive: true });
    window.addEventListener('touchstart', unlock, { capture: true, passive: true });
    window.addEventListener('keydown', unlock, { capture: true, passive: true });
  }

  isMuted(): boolean {
    return this.isMutedState;
  }

  setMuted(muted: boolean): void {
    this.isMutedState = muted;
    try { localStorage.setItem('sine_sound_muted', String(muted)); } catch {}
  }

  toggleMute(): boolean {
    this.setMuted(!this.isMutedState);
    return this.isMutedState;
  }

  getVolume(): number {
    return this.volumeLevel;
  }

  setVolume(vol: number): void {
    this.volumeLevel = Math.max(0, Math.min(1, vol));
    try { localStorage.setItem('sine_sound_volume', String(this.volumeLevel)); } catch {}
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Plays a professional, elegant dual harmonic emergency chime (D5 -> A5).
   * Web Audio API synthesized, non-intrusive, clear alert tone.
   */
  playNotificationChime(): void {
    if (this.isMutedState || this.volumeLevel <= 0) return;

    const ctx = this.getAudioContext();
    if (ctx) {
      try {
        const now = ctx.currentTime;
        const v = this.volumeLevel;

        // Tone 1: 587.33 Hz (D5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now);
        gain1.gain.setValueAtTime(0.28 * v, now);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.36);

        // Tone 2: 880 Hz (A5)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.12);
        gain2.gain.setValueAtTime(0.0001, now);
        gain2.gain.setValueAtTime(0.32 * v, now + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.46);
        return;
      } catch (err) {
        console.warn('[AudioService] Web Audio synthesis failed, trying audio element fallback', err);
      }
    }

    // Audio file fallback
    try {
      const audio = new Audio('/assets/sounds/notification-chime.wav');
      audio.volume = 0.4 * this.volumeLevel;
      audio.play().catch(() => {});
    } catch {}
  }

  /**
   * Immediate chime test playback triggered from user settings.
   */
  testChime(): void {
    const wasMuted = this.isMutedState;
    this.isMutedState = false;
    this.playNotificationChime();
    this.isMutedState = wasMuted;
  }

  /**
   * Plays a subtle, tactile click for significant UI button interactions.
   */
  playClickFeedback(): void {
    if (this.isMutedState || this.volumeLevel <= 0) return;

    const ctx = this.getAudioContext();
    if (ctx) {
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.04);
        gain.gain.setValueAtTime(0.08 * this.volumeLevel, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.045);
      } catch {}
    }
  }
}
