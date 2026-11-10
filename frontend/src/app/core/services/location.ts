import { Injectable, OnDestroy } from '@angular/core';
import { Geolocation, Position } from '@capacitor/geolocation';
import { BehaviorSubject } from 'rxjs';
import { UserSettingsService } from './user-settings';

export interface CachedPosition {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

const LAST_POS_STORAGE_KEY = 'sine_last_known_pos';

@Injectable({ providedIn: 'root' })
export class LocationService implements OnDestroy {

  private watchId: string | null = null;
  cachedPosition: CachedPosition | null = null;
  private positionSubject = new BehaviorSubject<CachedPosition | null>(null);
  position$ = this.positionSubject.asObservable();
  private isLocating = false;

  constructor(private userSettings: UserSettingsService) {
    this.restoreCachedPosition();
  }

  /**
   * Restores persisted last known position from localStorage if recorded within the last 2 hours.
   * Guarantees instantaneous (0ms) map centering on app boot or emergency modal open.
   */
  private restoreCachedPosition(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(LAST_POS_STORAGE_KEY);
      if (raw) {
        const parsed: CachedPosition = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed.lat === 'number' &&
          typeof parsed.lng === 'number' &&
          Date.now() - parsed.timestamp < 7200000
        ) {
          this.cachedPosition = parsed;
          this.positionSubject.next(this.cachedPosition);
        }
      }
    } catch {}
  }

  /**
   * Updates cached position in memory and storage, notifying all subscribers.
   */
  public updateCachedPosition(pos: Position | { coords: { latitude: number; longitude: number; accuracy?: number }; timestamp?: number }): CachedPosition | null {
    if (!pos?.coords) return null;
    const entry: CachedPosition = {
      lat:       pos.coords.latitude,
      lng:       pos.coords.longitude,
      accuracy:  pos.coords.accuracy ?? 15,
      timestamp: pos.timestamp || Date.now(),
    };
    this.cachedPosition = entry;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(LAST_POS_STORAGE_KEY, JSON.stringify(entry));
      } catch {}
    }
    this.positionSubject.next(entry);
    return entry;
  }

  /**
   * Fast permission check. Returns true if granted, attempts request if promptable.
   */
  async ensurePermission(): Promise<boolean> {
    try {
      const status = await Geolocation.checkPermissions().catch(() => null);
      if (status?.location === 'granted') return true;
      if (status?.location === 'denied') return false;
      const req = await Geolocation.requestPermissions().catch(() => ({ location: 'denied' as const }));
      return req.location === 'granted';
    } catch {
      return false;
    }
  }

  /**
   * Ultra-fast multi-tiered position resolver designed for emergency response:
   * 1. Returns existing cache immediately if < 30s old (<1ms).
   * 2. Attempts cached/coarse OS location with maximumAge (typically 20ms - 200ms).
   * 3. Concurrently refines with high-accuracy GPS satellite fix without stalling UI.
   */
  async getFastPosition(options?: { highAccuracy?: boolean }): Promise<CachedPosition | null> {
    if (!this.userSettings.getBool('location_auto_fetch') && !options?.highAccuracy) {
      return null;
    }

    const hasPerm = await this.ensurePermission();
    if (!hasPerm) return null;

    // Fast check: if cache is very fresh (< 30 seconds), use it immediately!
    if (this.cachedPosition && Date.now() - this.cachedPosition.timestamp < 30000) {
      if (options?.highAccuracy) {
        this.refineWithHighAccuracy();
      }
      return this.cachedPosition;
    }

    // Attempt fast coarse/cached location with maximumAge (instantaneous if device has recent cell/WiFi/GPS cache)
    try {
      const fastPromise = Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 2500,
        maximumAge: 60000,
      });
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('fast-timeout')), 2600)
      );
      const fastFix = await Promise.race([fastPromise, timeoutPromise]).catch(() => null);

      if (fastFix?.coords) {
        this.updateCachedPosition(fastFix);
        if (options?.highAccuracy) {
          this.refineWithHighAccuracy();
        }
        return this.cachedPosition;
      }
    } catch {}

    // Fallback: standard high-accuracy GPS with bounded timeout (max 4.5s)
    try {
      const fineFix = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 4500,
        maximumAge: 15000,
      }).catch(async () => {
        return await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 2500,
          maximumAge: 180000,
        }).catch(() => null);
      });

      if (fineFix?.coords) {
        return this.updateCachedPosition(fineFix);
      }
    } catch {}

    return this.cachedPosition;
  }

  private refineWithHighAccuracy(): void {
    if (this.isLocating) return;
    this.isLocating = true;
    Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 6000,
      maximumAge: 5000,
    }).then(pos => {
      this.isLocating = false;
      if (pos?.coords) {
        this.updateCachedPosition(pos);
      }
    }).catch(() => {
      this.isLocating = false;
    });
  }

  /**
   * Seeds initial position fix on app boot or login.
   */
  async seedPosition(): Promise<void> {
    if (!this.userSettings.getBool('location_auto_fetch')) return;
    await this.getFastPosition({ highAccuracy: true });
  }

  /**
   * Start continuous high-accuracy live tracking.
   * Scoped to active map/report views (e.g. ReportMapComponent).
   */
  async startLiveTracking(): Promise<void> {
    if (this.watchId) return;
    if (!this.userSettings.getBool('location_auto_fetch')) return;

    const hasPerm = await this.ensurePermission();
    if (!hasPerm) return;

    // Immediately resolve fast position while watch initializes
    this.getFastPosition({ highAccuracy: true });

    try {
      this.watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
        (pos, err) => {
          if (err || !pos?.coords) return;
          this.updateCachedPosition(pos);
        }
      );
    } catch { /* GPS unavailable */ }
  }

  /**
   * Stop continuous high-accuracy live tracking when leaving map/report views.
   * Preserves the last cached position for future fast lookups.
   */
  async stopLiveTracking(): Promise<void> {
    if (this.watchId) {
      await Geolocation.clearWatch({ id: this.watchId }).catch(() => {});
      this.watchId = null;
    }
  }

  /** Default start method: seeds initial position fix. */
  async start(): Promise<void> {
    await this.seedPosition();
  }

  /**
   * Stops live tracking watcher while PRESERVING cached position for instant reuse.
   */
  stop(): void {
    this.stopLiveTracking();
  }

  /**
   * Clears cache explicitly (e.g. on full user logout).
   */
  clearCache(): void {
    this.stopLiveTracking();
    this.cachedPosition = null;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(LAST_POS_STORAGE_KEY);
      } catch {}
    }
    this.positionSubject.next(null);
  }

  async restart(): Promise<void> {
    this.stopLiveTracking();
    await this.seedPosition();
    if (this.userSettings.getBool('location_auto_fetch')) {
      await this.startLiveTracking();
    }
  }

  ngOnDestroy() {
    this.stopLiveTracking();
  }
}
