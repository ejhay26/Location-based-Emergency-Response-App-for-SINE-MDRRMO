import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { PushNotifications } from '@capacitor/push-notifications';

export type PermissionResult = 'granted' | 'denied' | 'prompt' | 'unavailable';

export interface AppPermissions {
  location: PermissionResult;
  camera: PermissionResult;
  notifications: PermissionResult;
}

/**
 * PermissionInitService — centralised permission handler for Android and iOS.
 *
 * Android notes:
 *  - Permissions are declared in AndroidManifest.xml; this service requests
 *    them at runtime (Android 6+).
 *  - ACCESS_COARSE_LOCATION is used as a fallback when precise location is
 *    denied — reflected by checkPermissions() returning 'granted' on
 *    coarseLocation even when location is 'denied'.
 *  - CAMERA and READ_MEDIA_IMAGES/READ_EXTERNAL_STORAGE must be in the manifest.
 *  - POST_NOTIFICATIONS must be in the manifest (Android 13+/API 33+).
 *
 * iOS notes:
 *  - Permission strings (NSLocationWhenInUseUsageDescription, NSCameraUsageDescription,
 *    NSPhotoLibraryUsageDescription) must be in Info.plist.
 *  - iOS only ever prompts once — if denied, the user must go to Settings.
 *  - PushNotifications on iOS requires APNs setup in your Apple Developer account.
 *  - check*() reflects what the system already knows; request*() is a no-op
 *    if already denied on iOS (the OS will not show the dialog again).
 *
 * GENERATE THIS FILE:
 *   ionic generate service services/permission-init
 * Then replace the generated stub with this.
 */
@Injectable({ providedIn: 'root' })
export class PermissionInitService {

  /** Check current status of all three permissions without prompting. */
  async checkAll(): Promise<AppPermissions> {
    return {
      location:      await this.checkLocation(),
      camera:        await this.checkCamera(),
      notifications: await this.checkNotifications(),
    };
  }

  /** Request all permissions in the order that feels most natural to users. */
  async requestAll(): Promise<AppPermissions> {
    return {
      location:      await this.requestLocation(),
      camera:        await this.requestCamera(),
      notifications: await this.requestNotifications(),
    };
  }

  // ── Location ────────────────────────────────────────────────────────────

  async checkLocation(): Promise<PermissionResult> {
    if (!Capacitor.isNativePlatform()) return 'unavailable';
    try {
      const s = await Geolocation.checkPermissions();
      // Treat coarse-location approval as 'granted' for our purposes.
      return (s.location === 'granted' || s.coarseLocation === 'granted')
        ? 'granted' : (s.location as PermissionResult);
    } catch { return 'unavailable'; }
  }

  async requestLocation(): Promise<PermissionResult> {
    if (!Capacitor.isNativePlatform()) return 'unavailable';
    try {
      const current = await Geolocation.checkPermissions();
      if (current.location === 'granted' || current.coarseLocation === 'granted') return 'granted';
      // Already hard-denied on iOS: prompt state is gone, return early.
      if (current.location === 'denied') return 'denied';
      const result = await Geolocation.requestPermissions();
      return (result.location === 'granted' || result.coarseLocation === 'granted')
        ? 'granted' : 'denied';
    } catch { return 'unavailable'; }
  }

  // ── Camera ───────────────────────────────────────────────────────────────

  async checkCamera(): Promise<PermissionResult> {
    if (!Capacitor.isNativePlatform()) return 'unavailable';
    try {
      const s = await Camera.checkPermissions();
      return (s.camera === 'granted' || s.photos === 'granted')
        ? 'granted' : (s.camera as PermissionResult);
    } catch { return 'unavailable'; }
  }

  async requestCamera(): Promise<PermissionResult> {
    if (!Capacitor.isNativePlatform()) return 'unavailable';
    try {
      const current = await Camera.checkPermissions();
      if (current.camera === 'granted' || current.photos === 'granted') return 'granted';
      if (current.camera === 'denied') return 'denied';
      const result = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
      return (result.camera === 'granted' || result.photos === 'granted')
        ? 'granted' : 'denied';
    } catch { return 'unavailable'; }
  }

  // ── Push Notifications ───────────────────────────────────────────────────

  async checkNotifications(): Promise<PermissionResult> {
    if (!Capacitor.isNativePlatform()) return 'unavailable';
    try {
      const s = await PushNotifications.checkPermissions();
      return s.receive as PermissionResult;
    } catch { return 'unavailable'; }
  }

  async requestNotifications(): Promise<PermissionResult> {
    if (!Capacitor.isNativePlatform()) return 'unavailable';
    try {
      const current = await PushNotifications.checkPermissions();
      if (current.receive === 'granted') return 'granted';
      if (current.receive === 'denied') return 'denied';
      const result = await PushNotifications.requestPermissions();
      return result.receive as PermissionResult;
    } catch { return 'unavailable'; }
  }
}
