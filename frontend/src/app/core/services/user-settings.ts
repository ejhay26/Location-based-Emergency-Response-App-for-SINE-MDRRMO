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
  | 'video_trimming_enabled';

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
};

@Injectable({ providedIn: 'root' })
export class UserSettingsService {

  private cache: Record<string, string> = { ...DEFAULTS };
  private router = inject(Router);

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

  /** True while a circular reveal is currently mid-flight. */
  private isThemeTransitioning = false;
  /**
   * Holds at most the LATEST toggle request made while `isThemeTransitioning`
   * is true. Spam-tapping never interrupts the circle already playing — it
   * just overwrites this slot — so the animation reads as physically "held"
   * rather than snapping/restarting on every tap. Once the in-flight reveal
   * finishes, exactly one follow-up transition plays for whatever the user
   * last asked for (if it still differs from the committed state).
   */
  private queuedThemeRequest: { isDark: boolean; x: number; y: number } | null = null;

  /** Resolves click/touch/target coordinates from a toggle event, defaulting to viewport center. Callers can pass explicit { x, y } coordinates directly, or an HTMLElement origin. */
  private resolveThemeOrigin(
    event?: MouseEvent | TouchEvent | PointerEvent | CustomEvent | { clientX?: number; clientY?: number; target?: any },
    origin?: HTMLElement | { x: number; y: number }
  ): { x: number; y: number } {
    const vw = window.innerWidth || 360;
    const vh = window.innerHeight || 640;
    let x = Math.round(vw / 2);
    let y = Math.round(vh / 2);

    // 1. Direct explicit coordinates take highest precedence
    if (origin && typeof (origin as any).x === 'number' && typeof (origin as any).y === 'number') {
      const ox = (origin as any).x;
      const oy = (origin as any).y;
      if (ox >= 0 && ox <= vw && oy >= 0 && oy <= vh) {
        return { x: Math.round(ox), y: Math.round(oy) };
      }
    }

    // 2. Direct physical pointer / touch coordinates from the user's gesture
    if (event) {
      const clientX = (event as any).clientX ??
        (event as TouchEvent).touches?.[0]?.clientX ??
        (event as TouchEvent).changedTouches?.[0]?.clientX;
      const clientY = (event as any).clientY ??
        (event as TouchEvent).touches?.[0]?.clientY ??
        (event as TouchEvent).changedTouches?.[0]?.clientY;

      if (typeof clientX === 'number' && typeof clientY === 'number' && clientX > 0 && clientY > 0) {
        return {
          x: Math.max(0, Math.min(vw, Math.round(clientX))),
          y: Math.max(0, Math.min(vh, Math.round(clientY))),
        };
      }
    }

    // 3. Element bounding rect relative to the active viewport
    const originEl = (origin instanceof HTMLElement) ? origin : null;
    if (originEl && typeof originEl.getBoundingClientRect === 'function') {
      const rect = originEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return {
          x: Math.max(0, Math.min(vw, Math.round(rect.left + rect.width / 2))),
          y: Math.max(0, Math.min(vh, Math.round(rect.top + rect.height / 2))),
        };
      }
    }

    // 4. Target element on the event itself
    if (event) {
      const targetEl = (event as any).target || (event as any).currentTarget;
      if (targetEl && typeof targetEl.getBoundingClientRect === 'function') {
        const rect = targetEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return {
            x: Math.max(0, Math.min(vw, Math.round(rect.left + rect.width / 2))),
            y: Math.max(0, Math.min(vh, Math.round(rect.top + rect.height / 2))),
          };
        }
      }
    }

    return { x, y };
  }

  /**
   * Telegram-style circular dark/light mode transition with authentic iOS physics.
   * Light -> Dark: new dark theme expands OUTWARD from toggle coordinates.
   * Dark -> Light: old dark theme retracts INWARD into toggle coordinates.
   *
   * Spam-proof by LOCKING rather than interrupting: while a reveal is
   * playing, further calls are queued (latest wins) instead of restarting
   * the animation — see queuedThemeRequest above.
   */
  async toggleDarkMode(
    isDark: boolean,
    event?: MouseEvent | TouchEvent | PointerEvent | CustomEvent | { clientX?: number; clientY?: number; target?: any },
    origin?: HTMLElement | { x: number; y: number }
  ): Promise<void> {
    const { x, y } = this.resolveThemeOrigin(event, origin);

    if (this.isThemeTransitioning) {
      // Only queue if the requested state differs from the state actively being transitioned to
      if (isDark !== this.getBool('dark_mode')) {
        this.queuedThemeRequest = { isDark, x, y };
      }
      return;
    }

    await this.runThemeReveal(isDark, x, y);

    // Replay at most one follow-up transition if rapid tapping requested a different end-state
    if (this.queuedThemeRequest && this.queuedThemeRequest.isDark !== this.getBool('dark_mode')) {
      const next = this.queuedThemeRequest;
      this.queuedThemeRequest = null;
      await this.runThemeReveal(next.isDark, next.x, next.y);
    }
    this.queuedThemeRequest = null;
  }

  private async runThemeReveal(isDark: boolean, x: number, y: number): Promise<void> {
    this.isThemeTransitioning = true;
    try {
      // 1. Immediately update setting state for 0ms reactive UI feedback
      this.setBool('dark_mode', isDark);

      const doc = document as any;
      const supportsViewTransition = typeof doc.startViewTransition === 'function' && this.shouldAnimate();

      if (!supportsViewTransition) {
        document.documentElement.classList.toggle('ion-palette-dark', isDark);
        return;
      }

      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      // Custom properties the declarative @keyframes in _base.scss read —
      // set BEFORE startViewTransition() so the very first frame the
      // pseudo-elements paint already has the correct clip-path origin and radius.
      const root = document.documentElement;
      root.style.setProperty('--reveal-x', `${x}px`);
      root.style.setProperty('--reveal-y', `${y}px`);
      root.style.setProperty('--reveal-r', `${endRadius}px`);

      const animMode = isDark ? 'to-dark' : 'to-light';
      root.setAttribute('data-theme-anim', animMode);
      root.classList.add('theme-transitioning');

      const transition = doc.startViewTransition(() => {
        document.documentElement.classList.toggle('ion-palette-dark', isDark);
      });

      try {
        await transition.finished;
      } catch {
        document.documentElement.classList.toggle('ion-palette-dark', isDark);
      } finally {
        root.classList.remove('theme-transitioning');
        root.removeAttribute('data-theme-anim');
        root.style.removeProperty('--reveal-x');
        root.style.removeProperty('--reveal-y');
        root.style.removeProperty('--reveal-r');
      }
    } finally {
      this.isThemeTransitioning = false;
    }
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
