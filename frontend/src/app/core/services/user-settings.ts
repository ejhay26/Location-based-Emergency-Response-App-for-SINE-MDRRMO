import { Injectable } from '@angular/core';
import { ApiService } from './api';

export type SettingKey =
  | 'dark_mode'
  | 'reduce_animations'
  | 'location_auto_fetch'
  | 'map_default_style'
  | 'notif_emergency_alerts'
  | 'notif_broadcast_alerts'
  | 'save_media_to_device';

const STORAGE_KEY = 'user_settings_cache';

const DEFAULTS: Record<SettingKey, string> = {
  dark_mode:               'false',
  reduce_animations:       'false',
  location_auto_fetch:     'true',
  map_default_style:       'street',
  notif_emergency_alerts:  'true',
  notif_broadcast_alerts:  'true',
  save_media_to_device:    'false',
};

@Injectable({ providedIn: 'root' })
export class UserSettingsService {

  private cache: Record<string, string> = { ...DEFAULTS };

  constructor(private api: ApiService) {}

  /** Call once after login to pull settings from the server into local cache. */
  async loadFromServer(userId: number): Promise<void> {
    return new Promise(resolve => {
      this.api.getSettings(userId).subscribe({
        next: (res: Record<string, string>) => {
          this.cache = { ...DEFAULTS, ...res };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
          this.applyToDom();
          resolve();
        },
        error: () => {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) this.cache = { ...DEFAULTS, ...JSON.parse(stored) };
          resolve();
        }
      });
    });
  }

  /** Read a setting synchronously from local cache. */
  get(key: SettingKey): string {
    return this.cache[key] ?? DEFAULTS[key];
  }

  /** Write a setting locally and fire-and-forget sync to the server. */
  set(key: SettingKey, value: string): void {
    this.cache[key] = value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    const user = JSON.parse(userStr);
    this.api.saveSetting({ user_id: user.user_id, key, value }).subscribe({
      error: () => { /* silent — local cache already updated */ }
    });
  }

  getBool(key: SettingKey): boolean          { return this.get(key) === 'true'; }
  setBool(key: SettingKey, val: boolean): void { this.set(key, val ? 'true' : 'false'); }

  /**
   * Stage 5 — the single gate every Motion animation call in the app must
   * check before animating (per the `reduce_animations` setting). Directives
   * (`RevealAnimateDirective`, `PressFeedbackDirective`) and any component
   * that calls Motion's `animate()` directly (TabsPage, ReportPage) all read
   * this instead of re-deriving the same `!getBool('reduce_animations')`
   * check independently.
   */
  shouldAnimate(): boolean {
    return !this.getBool('reduce_animations');
  }

  /** Apply all visual settings to the DOM. Call on app start and after login. */
  applyToDom(): void {
    // On app start the cache may still be at DEFAULTS because loadFromServer
    // hasn't run yet. Hydrate from localStorage first so persisted settings
    // are applied immediately without waiting for a network round-trip.
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { this.cache = { ...DEFAULTS, ...JSON.parse(stored) }; } catch {}
    }
    document.documentElement.classList.toggle('ion-palette-dark',    this.getBool('dark_mode'));
    document.documentElement.classList.toggle('reduce-animations',   this.getBool('reduce_animations'));
  }

  /** Clear cache and remove all visual effects on logout. */
  clear(): void {
    this.cache = { ...DEFAULTS };
    localStorage.removeItem(STORAGE_KEY);
    // Remove visual effects so the login page is always clean
    document.documentElement.classList.remove('ion-palette-dark');
    document.documentElement.classList.remove('reduce-animations');
  }
}
