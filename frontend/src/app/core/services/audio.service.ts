import { Injectable } from '@angular/core';

export interface SoundOption {
  id: string;
  label: string;
  file: string;
  gain?: number;
}

export const AVAILABLE_SOUNDS: SoundOption[] = [
  { id: 'chime_harmonic',  label: 'Harmonic Chime',  file: 'chime_harmonic.wav', gain: 0.8 },
  { id: 'alert_urgent',    label: 'Urgent Alert',    file: 'alert_urgent.wav', gain: 0.75 },
  { id: 'sonar_depth',     label: 'Sonar Depth',     file: 'sonar_depth.wav', gain: 0.85 },
  { id: 'ping_strike',     label: 'Twin Strike',     file: 'ping_strike.wav', gain: 0.75 },
  { id: 'siren_chirp',     label: 'Security Chirp',  file: 'siren_chirp.wav', gain: 0.8 },
  { id: 'beacon_radar',    label: 'Radar Beacon',    file: 'beacon_radar.wav', gain: 0.8 },
  { id: 'radio_roger',     label: 'Radio Roger',     file: 'radio_roger.wav', gain: 0.75 },
  { id: 'pager_digital',   label: 'Digital Pager',   file: 'pager_digital.wav', gain: 0.7 },
  { id: 'bell_warm',       label: 'Warm Bell',       file: 'bell_warm.wav', gain: 0.8 },
  { id: 'emergency_siren', label: 'Emergency Siren', file: 'emergency_siren.wav', gain: 0.75 },
  { id: 'rapid_beep',      label: 'Rapid Beeps',     file: 'rapid_beep.wav', gain: 0.75 },
  { id: 'echo_pulse',      label: 'Echo Pulse',      file: 'echo_pulse.wav', gain: 0.8 },
  { id: 'tactical_klaxon', label: 'Tactical Klaxon', file: 'tactical_klaxon.wav', gain: 0.8 },
  { id: 'subtle_ping',     label: 'Subtle Ping',     file: 'subtle_ping.wav', gain: 0.8 },
  { id: 'police_siren',    label: 'Police Siren',    file: 'police_siren.wav', gain: 0.75 },
  { id: 'double_chime',    label: 'Double Chime',    file: 'double_chime.wav', gain: 0.8 },
];

export const DEFAULT_INCIDENT_SOUNDS: Record<string, string> = {
  fire: 'alert_urgent',
  flood: 'sonar_depth',
  medical: 'chime_harmonic',
  crime: 'siren_chirp',
  accident: 'ping_strike',
  hazard: 'beacon_radar',
  default: 'chime_harmonic',
};

@Injectable({ providedIn: 'root' })
export class AudioService {
  private audioCtx: AudioContext | null = null;
  private isMutedState = false;
  private volumeLevel = 0.8;
  private incidentSoundMap: Record<string, string> = { ...DEFAULT_INCIDENT_SOUNDS };

  constructor() {
    this.isMutedState = localStorage.getItem('sine_sound_muted') === 'true';
    const savedVol = localStorage.getItem('sine_sound_volume');
    if (savedVol !== null) {
      const v = parseFloat(savedVol);
      if (!isNaN(v) && v >= 0 && v <= 1) this.volumeLevel = v;
    }

    const savedMap = localStorage.getItem('sine_incident_sound_map');
    if (savedMap) {
      try {
        const parsed = JSON.parse(savedMap);
        if (parsed && typeof parsed === 'object') {
          this.incidentSoundMap = { ...DEFAULT_INCIDENT_SOUNDS, ...parsed };
        }
      } catch {}
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

  getIncidentSound(type: string): string {
    const norm = (type || 'default').toLowerCase().trim();
    return this.incidentSoundMap[norm] || this.incidentSoundMap['default'] || 'chime_harmonic';
  }

  setIncidentSound(type: string, soundId: string): void {
    const norm = (type || 'default').toLowerCase().trim();
    this.incidentSoundMap[norm] = soundId;
    try {
      localStorage.setItem('sine_incident_sound_map', JSON.stringify(this.incidentSoundMap));
    } catch {}
  }

  private incidentVolumeMap: Record<string, number> = {};

  getIncidentVolume(type: string): number {
    const norm = (type || 'default').toLowerCase().trim();
    if (this.incidentVolumeMap[norm] !== undefined) {
      return this.incidentVolumeMap[norm];
    }
    try {
      const stored = localStorage.getItem('sine_incident_volumes');
      if (stored) {
        this.incidentVolumeMap = JSON.parse(stored);
      }
    } catch {}
    return typeof this.incidentVolumeMap[norm] === 'number' ? this.incidentVolumeMap[norm] : 1.0;
  }

  setIncidentVolume(type: string, volume: number): void {
    const norm = (type || 'default').toLowerCase().trim();
    this.incidentVolumeMap[norm] = Math.max(0, Math.min(1, volume));
    try {
      localStorage.setItem('sine_incident_volumes', JSON.stringify(this.incidentVolumeMap));
    } catch {}
  }

  getAllIncidentSounds(): Record<string, string> {
    return { ...this.incidentSoundMap };
  }

  getSoundLabel(soundId: string): string {
    const s = AVAILABLE_SOUNDS.find(item => item.id === soundId);
    return s?.label || soundId;
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
   * Resolves category key from an incident or hazard title.
   */
  public resolveCategory(incidentType?: string): string {
    if (!incidentType) return 'default';
    const lower = incidentType.toLowerCase();
    if (lower.includes('fire')) return 'fire';
    if (lower.includes('flood')) return 'flood';
    if (lower.includes('medical') || lower.includes('health') || lower.includes('injury')) return 'medical';
    if (lower.includes('crime') || lower.includes('theft') || lower.includes('violence') || lower.includes('police')) return 'crime';
    if (lower.includes('accident') || lower.includes('vehicular') || lower.includes('crash') || lower.includes('collision')) return 'accident';
    if (lower.includes('hazard') || lower.includes('wire') || lower.includes('tree') || lower.includes('obstruction') || lower.includes('street')) return 'hazard';
    return 'default';
  }

  /**
   * Plays the designated chime for the given incident type or general notification.
   */
  playNotificationChime(incidentType?: string): void {
    if (this.isMutedState || this.volumeLevel <= 0) return;
    const category = this.resolveCategory(incidentType);
    const soundId = this.getIncidentSound(category);
    const indVol = this.getIncidentVolume(category);
    this.playSound(soundId, indVol);
  }

  /**
   * Plays a specific sound by ID with optional volume multiplier.
   */
  playSound(soundId: string, volumeScale = 1.0): void {
    if (this.isMutedState || this.volumeLevel <= 0) return;

    const opt = AVAILABLE_SOUNDS.find(s => s.id === soundId) || AVAILABLE_SOUNDS[0];
    const targetVol = Math.max(0, Math.min(1, this.volumeLevel * (opt.gain ?? 0.8) * volumeScale));

    // Try HTML5 Audio element first
    try {
      const audio = new Audio(`/assets/sounds/${opt.file}`);
      audio.volume = targetVol;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          this.synthesizeSound(opt.id, targetVol);
        });
      }
      return;
    } catch {
      this.synthesizeSound(opt.id, targetVol);
    }
  }

  /**
   * Immediate test playback for previewing sounds in Settings.
   */
  testSound(soundId: string): void {
    const wasMuted = this.isMutedState;
    this.isMutedState = false;
    this.playSound(soundId);
    this.isMutedState = wasMuted;
  }

  testChime(): void {
    const wasMuted = this.isMutedState;
    this.isMutedState = false;
    this.playNotificationChime();
    this.isMutedState = wasMuted;
  }

  /**
   * Web Audio API synthesized fallback for all sound IDs.
   */
  private synthesizeSound(soundId: string, volume: number): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      switch (soundId) {
        case 'alert_urgent': {
          const pulses = [
            { start: 0, dur: 0.12, freq: 880 },
            { start: 0.16, dur: 0.12, freq: 1046.5 },
            { start: 0.32, dur: 0.16, freq: 880 },
          ];
          for (const p of pulses) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(p.freq, now + p.start);
            gain.gain.setValueAtTime(0.0001, now + p.start);
            gain.gain.linearRampToValueAtTime(0.28 * volume, now + p.start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + p.start + p.dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + p.start);
            osc.stop(now + p.start + p.dur + 0.02);
          }
          break;
        }

        case 'sonar_depth': {
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(392.0, now);
          gain1.gain.setValueAtTime(0.35 * volume, now);
          gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.32);

          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(440.0, now + 0.18);
          gain2.gain.setValueAtTime(0.0001, now);
          gain2.gain.setValueAtTime(0.38 * volume, now + 0.18);
          gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.18);
          osc2.stop(now + 0.54);
          break;
        }

        case 'ping_strike': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(1046.5, now);
          gain.gain.setValueAtTime(0.4 * volume, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.24);

          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(783.99, now + 0.1);
          gain2.gain.setValueAtTime(0.0001, now);
          gain2.gain.setValueAtTime(0.42 * volume, now + 0.1);
          gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.1);
          osc2.stop(now + 0.42);
          break;
        }

        case 'rapid_beep': {
          for (const b of [0, 0.11, 0.22]) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(980, now + b);
            gain.gain.setValueAtTime(0.0001, now + b);
            gain.gain.linearRampToValueAtTime(0.35 * volume, now + b + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + b + 0.07);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + b);
            osc.stop(now + b + 0.08);
          }
          break;
        }

        case 'echo_pulse': {
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(740, now);
          gain1.gain.setValueAtTime(0.38 * volume, now);
          gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.26);

          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(740, now + 0.16);
          gain2.gain.setValueAtTime(0.0001, now);
          gain2.gain.setValueAtTime(0.22 * volume, now + 0.16);
          gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.16);
          osc2.stop(now + 0.43);
          break;
        }

        case 'subtle_ping': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1174.66, now);
          gain.gain.setValueAtTime(0.35 * volume, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.36);
          break;
        }

        case 'double_chime': {
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(783.99, now);
          gain1.gain.setValueAtTime(0.32 * volume, now);
          gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.26);

          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(659.25, now + 0.16);
          gain2.gain.setValueAtTime(0.0001, now);
          gain2.gain.setValueAtTime(0.36 * volume, now + 0.16);
          gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.16);
          osc2.stop(now + 0.46);
          break;
        }

        case 'chime_harmonic':
        default: {
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(587.33, now);
          gain1.gain.setValueAtTime(0.28 * volume, now);
          gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.36);

          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(880, now + 0.12);
          gain2.gain.setValueAtTime(0.0001, now);
          gain2.gain.setValueAtTime(0.32 * volume, now + 0.12);
          gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.12);
          osc2.stop(now + 0.46);
          break;
        }
      }
    } catch {}
  }

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
