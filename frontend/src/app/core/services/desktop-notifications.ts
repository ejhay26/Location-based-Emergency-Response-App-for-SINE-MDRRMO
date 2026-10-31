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

@Injectable({ providedIn: 'root' })
export class DesktopNotificationsService {
  private pollHandle: any = null;
  private seenEmergencyIds = new Set<number>();
  private seenHazardIds    = new Set<number>();
  private pollCount = 0;
  private running = false;
  private tauriInvoke: any = null;

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

  async start(): Promise<void> {
    if (this.running || !this.notificationsSupported) return;

    if (this.isDesktop) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        this.tauriInvoke = invoke;
        const granted = await invoke('plugin:notification|is_permission_granted');
        if (!granted) {
          await invoke('plugin:notification|request_permission');
        }
      } catch (err) {
        console.warn('[DesktopNotifications] Failed to load Tauri core invoke:', err);
      }
    }

    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        await Notification.requestPermission();
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

  private async notify(title: string, body: string, incidentType?: string): Promise<void> {
    // 1. Play alert chime sound by incident type
    try {
      this.audio.playNotificationChime(incidentType);
    } catch {}

    // Check if visual notifications are disabled in settings
    if (!this.settings.getBool('notif_emergency_alerts')) {
      return;
    }

    // 2. Send native desktop OS notification via Tauri if running in desktop app
    if (this.isDesktop && this.tauriInvoke) {
      try {
        await this.tauriInvoke('plugin:notification|notify', {
          options: {
            title,
            body,
          },
        });
        return;
      } catch (err) {
        console.warn('[DesktopNotifications] Tauri native notification error:', err);
      }
    }

    // 3. Fallback to browser Notification API
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
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
      } catch {}
    }
  }
}
