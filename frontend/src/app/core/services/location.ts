import { Injectable, OnDestroy } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { BehaviorSubject } from 'rxjs';
import { UserSettingsService } from './user-settings';

export interface CachedPosition { lat: number; lng: number; accuracy: number; timestamp: number; }

@Injectable({ providedIn: 'root' })
export class LocationService implements OnDestroy {

  private watchId: string | null = null;
  cachedPosition: CachedPosition | null = null;
  private positionSubject = new BehaviorSubject<CachedPosition | null>(null);
  position$ = this.positionSubject.asObservable();

  constructor(private userSettings: UserSettingsService) {}

  /**
   * Seed initial position fix into cache on app boot or login without
   * starting a persistent, battery-draining GPS watcher.
   */
  async seedPosition(): Promise<void> {
    if (!this.userSettings.getBool('location_auto_fetch')) return;

    try {
      const perm = await Geolocation.requestPermissions()
        .catch(() => ({ location: 'denied' as const }));
      if (perm.location === 'denied') return;

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      }).catch(async () => {
        return await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 6000,
        }).catch(() => null);
      });

      if (pos?.coords) {
        this.cachedPosition = {
          lat:       pos.coords.latitude,
          lng:       pos.coords.longitude,
          accuracy:  pos.coords.accuracy,
          timestamp: pos.timestamp,
        };
        this.positionSubject.next(this.cachedPosition);
      }
    } catch { /* GPS unavailable */ }
  }

  /**
   * Start continuous high-accuracy live tracking.
   * Scoped to active map/report views (e.g. ReportMapComponent).
   */
  async startLiveTracking(): Promise<void> {
    if (this.watchId) return;
    if (!this.userSettings.getBool('location_auto_fetch')) return;

    try {
      const perm = await Geolocation.requestPermissions()
        .catch(() => ({ location: 'denied' as const }));
      if (perm.location === 'denied') return;

      this.watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 15000 },
        (pos, err) => {
          if (err || !pos) return;
          this.cachedPosition = {
            lat:       pos.coords.latitude,
            lng:       pos.coords.longitude,
            accuracy:  pos.coords.accuracy,
            timestamp: pos.timestamp,
          };
          this.positionSubject.next(this.cachedPosition);
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

  /** Default start method: seeds initial position fix on app start/login. */
  async start(): Promise<void> {
    await this.seedPosition();
  }

  /** Fully stop tracking and clear cache. */
  stop(): void {
    this.stopLiveTracking();
    this.cachedPosition = null;
  }

  async restart(): Promise<void> {
    this.stop();
    await this.seedPosition();
  }

  ngOnDestroy() {
    this.stop();
  }
}
