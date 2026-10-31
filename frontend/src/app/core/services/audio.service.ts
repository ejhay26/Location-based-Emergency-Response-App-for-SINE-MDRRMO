import { Injectable } from '@angular/core';

export interface SoundOption {
  id: string;
  label: string;
  description: string;
  file: string;
  gain?: number;
}

export const AVAILABLE_SOUNDS: SoundOption[] = [
  { id: 'chime_harmonic', label: 'Harmonic Chime', description: 'Dual harmonic tone (D5 to A5)', file: 'chime_harmonic.wav', gain: 0.8 },
  { id: 'alert_urgent',   label: 'Urgent Alert',   description: 'Rapid staccato urgency pulses', file: 'alert_urgent.wav', gain: 0.75 },
  { id: 'sonar_depth',    label: 'Sonar Depth',    description: 'Low resonant acoustic double pulse', file: 'sonar_depth.wav', gain: 0.85 },
  { id: 'ping_strike',    label: 'Twin Strike',    description: 'High descending metallic ping', file: 'ping_strike.wav', gain: 0.75 },
  { id: 'siren_chirp',    label: 'Security Chirp', description: 'Ascending security sweep', file: 'siren_chirp.wav', gain: 0.8 },
  { id: 'beacon_radar',   label: 'Radar Beacon',   description: 'Resonant locator radar ping', file: 'beacon_radar.wav', gain: 0.8 },
  { id: 'radio_roger',    label: 'Radio Roger',    description: 'VHF radio key and roger chirp', file: 'radio_roger.wav', gain: 0.75 },
  { id: 'pager_digital',  label: 'Digital Pager',  description: 'Fast dual electronic pulse', file: 'pager_digital.wav', gain: 0.7 },
  { id: 'bell_warm',      label: 'Warm Bell',      description: 'Soft marimba chord', file: 'bell_warm.wav', gain: 0.8 },
  { id: 'emergency_siren',label: 'Emergency Siren',description: 'Hi-lo response vehicle tone', file: 'emergency_siren.wav', gain: 0.75 },
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

  getAllIncidentSounds(): Record<string, string> {
    return { ...this.incidentSoundMap };
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
    this.playSound(soundId);
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
          // Fallback to Web Audio synthesis if blocked or file missing
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

        case 'siren_chirp': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(500, now);
          osc.frequency.exponentialRampToValueAtTime(850, now + 0.18);
          gain.gain.setValueAtTime(0.35 * volume, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.22);

          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(550, now + 0.2);
          osc2.frequency.exponentialRampToValueAtTime(950, now + 0.38);
          gain2.gain.setValueAtTime(0.0001, now);
          gain2.gain.setValueAtTime(0.38 * volume, now + 0.2);
          gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.2);
          osc2.stop(now + 0.44);
          break;
        }

        case 'beacon_radar': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(660, now);
          gain.gain.setValueAtTime(0.38 * volume, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.46);
          break;
        }

        case 'radio_roger': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(852, now);
          gain.gain.setValueAtTime(0.32 * volume, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.15);

          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(1108, now + 0.16);
          gain2.gain.setValueAtTime(0.0001, now);
          gain2.gain.setValueAtTime(0.35 * volume, now + 0.16);
          gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.16);
          osc2.stop(now + 0.34);
          break;
        }

        case 'pager_digital': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(1318.5, now);
          gain.gain.setValueAtTime(0.2 * volume, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.11);

          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'square';
          osc2.frequency.setValueAtTime(1567.98, now + 0.14);
          gain2.gain.setValueAtTime(0.0001, now);
          gain2.gain.setValueAtTime(0.22 * volume, now + 0.14);
          gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.14);
          osc2.stop(now + 0.28);
          break;
        }

        case 'bell_warm': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(523.25, now);
          gain.gain.setValueAtTime(0.32 * volume, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.42);
          break;
        }

        case 'emergency_siren': {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(920, now);
          osc.frequency.setValueAtTime(720, now + 0.26);
          gain.gain.setValueAtTime(0.25 * volume, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.54);
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
