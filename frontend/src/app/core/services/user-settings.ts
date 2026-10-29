import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api';

export type SettingKey =
  | 'dark_mode'
  | 'reduce_animations'
  | 'location_auto_fetch'
  | 'map_default_style'
  | 'notif_emergency_alerts'
  | 'notif_broadcast_alerts'
  | 'save_media_to_device'
  | 'photo_cropping_enabled'
  | 'video_trimming_enabled'
  | 'desktop_zoom';

const STORAGE_KEY = 'user_settings_cache';

const DEFAULTS: Record<SettingKey, string> = {
  dark_mode:               'false',
  reduce_animations:       'false',
  location_auto_fetch:     'true',
  map_default_style:       'street',
  notif_emergency_alerts:  'true',
  notif_broadcast_alerts:  'true',
  save_media_to_device:    'false',
  photo_cropping_enabled:  'true',
  video_trimming_enabled:  'true',
  desktop_zoom:            '100',
};

@Injectable({ providedIn: 'root' })
export class UserSettingsService {

  private cache: Record<string, string> = { ...DEFAULTS };
  private router = inject(Router);

  constructor(private api: ApiService) {
    this.hydrateFromStorage();
  }

  private hydrateFromStorage(): void {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          this.cache = { ...DEFAULTS, ...parsed };
        }
      } catch {}
    }
  }

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
    this.persistSetting(key, value);
  }

  /**
   * Persists settings to localStorage and triggers server synchronization.
   * Can be deferred after transition animations to avoid main-thread disk I/O lockup.
   */
  private persistSetting(key: SettingKey, value: string): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
    const userStr = localStorage.getItem('user');
    if (!userStr) return;
    try {
      const user = JSON.parse(userStr);
      this.api.saveSetting({ user_id: user.user_id, key, value }).subscribe({
        error: () => { /* silent — local cache already updated */ }
      });
    } catch {
      // Ignore JSON parse errors
    }
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

  /**
   * Synchronous 0ms dark/light mode toggle.
   * Guarantees that EVERY section, card, button, toolbar, and text element across
   * the entire DOM flips theme colors at the exact same instant, with zero delayed
   * transitions or lingering element animations.
   */
  async toggleDarkMode(
    isDark: boolean,
    _event?: MouseEvent | TouchEvent | PointerEvent | CustomEvent | { clientX?: number; clientY?: number; target?: any },
    _origin?: HTMLElement | { x: number; y: number }
  ): Promise<void> {
    // 1. Immediately persist setting locally and sync to server
    this.setBool('dark_mode', isDark);

    // 2. Temporarily inject global transition neutralization lock
    // This suppresses all disparate CSS transitions (background, border, color, box-shadow)
    // so every section, card, button, and container turns dark/light synchronously on the exact same frame.
    const lockId = 'sine-theme-switch-lock';
    let lockStyle = document.getElementById(lockId) as HTMLStyleElement | null;
    if (!lockStyle) {
      lockStyle = document.createElement('style');
      lockStyle.id = lockId;
      lockStyle.textContent = `
        *, *::before, *::after {
          -webkit-transition: none !important;
          -moz-transition: none !important;
          -o-transition: none !important;
          -ms-transition: none !important;
          transition: none !important;
        }
      `;
      document.head.appendChild(lockStyle);
    }

    // 3. Synchronously flip dark mode class on document element
    document.documentElement.classList.toggle('ion-palette-dark', isDark);

    // 4. Force browser style recalculation across the entire DOM tree in this exact frame
    if (typeof window !== 'undefined' && document.body) {
      const _ = window.getComputedStyle(document.body).backgroundColor;
    }

    // 5. Release the transition lock after paint settles (two animation frames)
    // so interactive hover, active press feedback, and component animations are restored cleanly
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const existing = document.getElementById(lockId);
        if (existing) {
          existing.remove();
        }
      });
    });
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
    const isDark = this.getBool('dark_mode');
    document.documentElement.classList.toggle('ion-palette-dark',    isDark);
    document.documentElement.classList.toggle('reduce-animations',   this.getBool('reduce_animations'));
    this.applyZoom();
  }

  getZoom(): number {
    const val = parseInt(this.get('desktop_zoom'), 10);
    return isNaN(val) ? 100 : Math.min(150, Math.max(75, val));
  }

  setZoom(zoomPercent: number): void {
    const clamped = Math.min(150, Math.max(75, Math.round(zoomPercent)));
    this.set('desktop_zoom', String(clamped));
    this.applyZoom();
  }

  zoomIn(step: number = 10): void {
    this.setZoom(this.getZoom() + step);
  }

  zoomOut(step: number = 10): void {
    this.setZoom(this.getZoom() - step);
  }

  resetZoom(): void {
    this.setZoom(100);
  }

  applyZoom(): void {
    if (typeof document === 'undefined') return;
    const zoom = this.getZoom();
    const root = document.documentElement;
    if (zoom === 100) {
      (root.style as any).zoom = '';
    } else {
      (root.style as any).zoom = `${zoom / 100}`;
    }
  }

  /** Clear cache and remove all visual effects on logout. */
  clear(): void {
    this.cache = { ...DEFAULTS };
    localStorage.removeItem(STORAGE_KEY);
    // Remove visual effects so the login page is always clean
    document.documentElement.classList.remove('ion-palette-dark');
    document.documentElement.classList.remove('reduce-animations');
    if (typeof document !== 'undefined') {
      (document.documentElement.style as any).zoom = '';
    }
  }
}
