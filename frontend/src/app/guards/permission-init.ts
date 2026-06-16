import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';

@Injectable({ providedIn: 'root' })
export class PermissionInitService {

  // Call this once from welcome.page.ts on first app open.
  // All methods are proper class methods — no loose async functions.
  async requestAll(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return; // skip on web/Electron

    try {
      await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
    } catch { /* permission dialog dismissed or unavailable */ }

    try {
      await Geolocation.requestPermissions();
    } catch { /* location denied — handled per-use */ }
  }
}