import { Injectable } from '@angular/core';
import { ApiService } from './api';
import { AudioService } from './audio.service';
import { UserSettingsService } from './user-settings';
import { isTauri } from '../../shared/utils/platform.util';

/**
 * DesktopNotificationsService — Cross-platform admin/dispatcher alert system.
 *
 * Polls active emergencies and hazards every 5 seconds. On any new entry:
 *  1. Plays the configured audio alert chime for that incident type via AudioService.
 *  2. Dispatches a desktop notification (native OS notification via Tauri on desktop,
 *     or Web Notifications API in browser).
 *
 * Scoped to active sessions for admin/dispatcher roles.
 */
const POLL_INTERVAL_MS = 5000;

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default';

@Injectable({ providedIn: 'root' })
export class DesktopNotificationsService {
  private pollHandle: any = null;
  private seenEmergencyIds = new Set<number>();
  private seenHazardIds    = new Set<number>();
  private pollCount = 0;
  private running = false;
  private tauriModule: any = null;

  constructor(
    private api: ApiService,
    private audio: AudioService,
    private settings: UserSettingsService,
  ) {}

  get isDesktop(): boolean {
    return isTauri();
  }

  get notificationsSupported(): boolean {
    return typeof window !== 'undefined' && ('Notification' in window || isTauri());
  }

  private async getTauriNotification(): Promise<any> {
    if (!this.isDesktop) return null;
    if (this.tauriModule) return this.tauriModule;
    try {
      this.tauriModule = await import('@tauri-apps/plugin-notification');
      return this.tauriModule;
    } catch (e) {
      console.warn('[DesktopNotifications] Failed to load @tauri-apps/plugin-notification:', e);
      return null;
    }
  }

  /**
   * Retrieves current OS/browser notification permission state.
   */
  async getPermissionStatus(): Promise<NotificationPermissionStatus> {
    if (this.isDesktop) {
      try {
        const mod = await this.getTauriNotification();
        if (mod && typeof mod.isPermissionGranted === 'function') {
          const granted = await mod.isPermissionGranted();
          return granted ? 'granted' : 'default';
        }
      } catch {}
    }

    if (typeof Notification !== 'undefined') {
      return Notification.permission as NotificationPermissionStatus;
    }

    return 'denied';
  }

  /**
   * Requests OS/browser desktop notification permission (must be called from a user gesture in web).
   */
  async requestPermission(): Promise<NotificationPermissionStatus> {
    if (this.isDesktop) {
      try {
        const mod = await this.getTauriNotification();
        if (mod) {
          if (typeof mod.requestPermission === 'function') {
            const res = await mod.requestPermission();
            if (res === 'granted' || res === true) return 'granted';
          }
          if (typeof mod.isPermissionGranted === 'function') {
            const granted = await mod.isPermissionGranted();
            if (granted) return 'granted';
          }
        }
      } catch (err) {
        console.warn('[DesktopNotifications] Tauri requestPermission error:', err);
      }
    }

    if (typeof Notification !== 'undefined') {
      try {
        const result = await Notification.requestPermission();
        return result as NotificationPermissionStatus;
      } catch (err) {
        console.warn('[DesktopNotifications] Web Notification.requestPermission error:', err);
      }
    }

    return 'denied';
  }

  /**
   * Dispatches a test notification and plays an audio chime to verify end-to-end functionality.
   */
  async sendTestNotification(): Promise<boolean> {
    try {
      this.audio.playNotificationChime('test');
    } catch {}

    const title = 'MDRRMO Notification Test';
    const body = 'Desktop notifications and alert chimes are operational.';

    return this.notify(title, body, 'test', true);
  }

  async start(): Promise<void> {
    if (this.running || !this.notificationsSupported) return;

    try {
      const status = await this.getPermissionStatus();
      if (status === 'default') {
        await this.requestPermission();
      }
    } catch {}

    this.running = true;
    this.pollCount = 0;
    this.seenEmergencyIds.clear();
    this.seenHazardIds.clear();

    // Fire immediately, then on interval
    this.poll();
    this.pollHandle = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
    this.running = false;
  }

  private poll(): void {
    const token = localStorage.getItem('api_token');
    if (!token) {
      this.stop();
      return;
    }

    const role = localStorage.getItem('role');
    if (role !== 'admin' && role !== 'dispatcher') {
      this.stop();
      return;
    }

    this.pollCount += 1;
    const isSeedingPoll = this.pollCount === 1;

    this.api.getActiveEmergencies().subscribe({
      next: (res: any) => this.diff(
        Array.isArray(res) ? res : [],
        this.seenEmergencyIds,
        'request_id',
        isSeedingPoll,
        (r: any) => ({
          title: 'New Emergency SOS',
          body: `${r.incident_name || 'Emergency'} — ${r.barangay_name || 'San Isidro'}`,
          incidentType: r.incident_name || 'Emergency',
        })
      ),
      error: () => {},
    });

    this.api.getActiveHazards().subscribe({
      next: (res: any) => this.diff(
        Array.isArray(res) ? res : [],
        this.seenHazardIds,
        'hazard_id',
        isSeedingPoll,
        (r: any) => ({
          title: 'New Hazard Report',
          body: `${r.hazard_type || 'Hazard'} — ${r.barangay_name || 'San Isidro'}`,
          incidentType: r.hazard_type || 'Hazard',
        })
      ),
      error: () => {},
    });
  }

  /**
   * Diffs a freshly-fetched active list against a seen-id set: notifies for
   * any id not previously seen (skipped entirely on the seeding poll), then
   * replaces the set's contents with exactly the current active ids.
   */
  private diff(
    list: any[],
    seenIds: Set<number>,
    idKey: 'request_id' | 'hazard_id',
    isSeedingPoll: boolean,
    describe: (r: any) => { title: string; body: string; incidentType?: string },
  ): void {
    const currentIds = new Set<number>();
    for (const r of list) {
      const id = Number(r[idKey]);
      if (!Number.isFinite(id)) continue;
      currentIds.add(id);
      if (!isSeedingPoll && !seenIds.has(id)) {
        const { title, body, incidentType } = describe(r);
        this.notify(title, body, incidentType);
      }
    }
    seenIds.clear();
    for (const id of currentIds) seenIds.add(id);
  }

  async notify(title: string, body: string, incidentType?: string, bypassToggle = false): Promise<boolean> {
    if (!bypassToggle) {
      // 1. Play alert chime sound by incident type
      try {
        this.audio.playNotificationChime(incidentType);
      } catch {}

      // Check if visual notifications are disabled in settings
      if (!this.settings.getBool('notif_emergency_alerts')) {
        return false;
      }
    }

    let dispatched = false;

    // 2. Send native desktop OS notification via Tauri if running in desktop app
    if (this.isDesktop) {
      try {
        const mod = await this.getTauriNotification();
        if (mod && typeof mod.sendNotification === 'function') {
          mod.sendNotification({
            title,
            body,
            icon: 'icons/icon.png',
          });
          return true;
        }
      } catch (err) {
        console.warn('[DesktopNotifications] Tauri sendNotification error:', err);
      }

      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('plugin:notification|notify', {
          options: {
            title,
            body,
          },
        });
        return true;
      } catch (err) {
        console.warn('[DesktopNotifications] Tauri invoke notify error:', err);
      }
    }

    // 3. Fallback to browser Notification API
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') {
        try {
          const notif = new Notification(title, {
            body,
            icon: '/assets/icon/favicon.png',
            badge: '/assets/icon/favicon.png',
          });
          notif.onclick = () => {
            window.focus();
            notif.close();
          };
          dispatched = true;
        } catch (err) {
          console.warn('[DesktopNotifications] Web Notification error:', err);
        }
      }
    }

    return dispatched;
  }
}
