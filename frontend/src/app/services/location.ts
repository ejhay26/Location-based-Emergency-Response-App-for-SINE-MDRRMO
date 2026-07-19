import { Injectable, OnDestroy } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { UserSettingsService } from './user-settings';

export interface CachedPosition { lat: number; lng: number; accuracy: number; timestamp: number; }

@Injectable({ providedIn: 'root' })
export class LocationService implements OnDestroy {

  private watchId: string | null = null;
  cachedPosition: CachedPosition | null = null;

  constructor(private userSettings: UserSettingsService) {}

  async start(): Promise<void> {
    if (this.watchId) return;
    if (!this.userSettings.getBool('location_auto_fetch')) return;

    try {
      const perm = await Geolocation.requestPermissions()
        .catch(() => ({ location: 'denied' as const }));
      if (perm.location === 'denied') return;

      // Seed the cache immediately with a one-shot fix so the report page
      // has a position on the very first open, before watchPosition fires.
      try {
        const initial = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        });
        this.cachedPosition = {
          lat:       initial.coords.latitude,
          lng:       initial.coords.longitude,
          accuracy:  initial.coords.accuracy,
          timestamp: initial.timestamp,
        };
      } catch {
        // GPS cold start failed — watch will populate cache when it can.
      }

      // Start continuous watch to keep cache fresh.
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
        }
      );
    } catch { /* GPS unavailable */ }
  }

  stop(): void {
    if (this.watchId) {
      Geolocation.clearWatch({ id: this.watchId }).catch(() => {});
      this.watchId = null;
    }
    this.cachedPosition = null;
  }

  async restart(): Promise<void> { this.stop(); await this.start(); }

  ngOnDestroy() { this.stop(); }
}
