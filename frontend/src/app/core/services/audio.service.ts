import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AudioService {
  private audioCtx: AudioContext | null = null;
  private isMutedState = false;

  constructor() {
    this.isMutedState = localStorage.getItem('sine_sound_muted') === 'true';
  }

  isMuted(): boolean {
    return this.isMutedState;
  }

  setMuted(muted: boolean): void {
    this.isMutedState = muted;
    localStorage.setItem('sine_sound_muted', String(muted));
  }

  toggleMute(): boolean {
    this.setMuted(!this.isMutedState);
    return this.isMutedState;
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
    if (this.isMutedState) return;

    const ctx = this.getAudioContext();
    if (ctx) {
      try {
        const now = ctx.currentTime;

        // Tone 1: 587.33 Hz (D5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now);
        gain1.gain.setValueAtTime(0.28, now);
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
        gain2.gain.setValueAtTime(0.32, now + 0.12);
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
      audio.volume = 0.4;
      audio.play().catch(() => {});
    } catch {}
  }

  /**
   * Plays a subtle, tactile click for significant UI button interactions.
   */
  playClickFeedback(): void {
    if (this.isMutedState) return;

    const ctx = this.getAudioContext();
    if (ctx) {
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.045);
        return;
      } catch {}
    }

    try {
      const audio = new Audio('/assets/sounds/touch-click.wav');
      audio.volume = 0.15;
      audio.play().catch(() => {});
    } catch {}
  }
}
