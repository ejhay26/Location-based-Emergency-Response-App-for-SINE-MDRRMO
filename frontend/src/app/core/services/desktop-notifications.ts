import { Injectable } from '@angular/core';
import { ApiService } from './api';
import { AudioService } from './audio.service';
import { UserSettingsService } from './user-settings';
import { isTauri } from '../../shared/utils/platform.util';

const POLL_INTERVAL_MS = 5000; // matches IncidentMapPanel's existing active-emergencies poll cadence

/**
 * DesktopNotificationsService — Cross-platform admin/dispatcher alert system.
 * Dispatches native OS notifications across Windows, Linux, and macOS via Tauri v2 IPC,
 * with standard browser Notification fallback, accompanied by audio chimes.
 */
@Injectable({ providedIn: 'root' })
export class DesktopNotificationsService {
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  /** ids currently known "active" (Pending/Dispatched, or active hazards) — pruned every poll so this never grows unbounded. */
  private seenEmergencyIds = new Set<number>();
  private seenHazardIds = new Set<number>();
  private pollCount = 0;
  private running = false;
  private tauriInvoke: ((cmd: string, args?: any) => Promise<any>) | null = null;

  constructor(
    private api: ApiService,
    private audio: AudioService,
    private settings: UserSettingsService,
  ) {}

  private get isDesktop(): boolean {
    return isTauri();
  }

  private get notificationsSupported(): boolean {
    return typeof window !== 'undefined' && ('Notification' in window || isTauri());
  }

  /** Idempotent — safe to call every time the dashboard shell mounts without stacking duplicate intervals. */
  async start(): Promise<void> {
    if (this.running) return;
    if (!this.notificationsSupported) return;

    if (this.isDesktop) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        this.tauriInvoke = invoke;
        // Request permission via Tauri notification plugin
        try {
          const granted = await invoke<boolean>('plugin:notification|is_permission_granted');
          if (!granted) {
            await invoke('plugin:notification|request_permission');
          }
        } catch {
          // Fallback if plugin permissions query fails
        }
      } catch (err) {
        console.warn('[DesktopNotifications] Failed to load Tauri core invoke:', err);
      }
    }

    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    } catch {
      // Non-fatal if browser blocks permission prompt outside gesture
    }

    this.running = true;
    this.pollCount = 0;
    this.seenEmergencyIds.clear();
    this.seenHazardIds.clear();
    this.poll(); // immediate first poll to seed
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
    if (!localStorage.getItem('api_token')) {
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
      next: (res: any) => this.diff(Array.isArray(res) ? res : [], this.seenEmergencyIds, 'request_id', isSeedingPoll,
        (r: any) => ({
          title: 'New Emergency SOS',
          body: `${r.incident_name || 'Emergency'} — ${r.barangay_name || 'San Isidro'}`,
        })),
      error: () => {},
    });

    this.api.getActiveHazards().subscribe({
      next: (res: any) => this.diff(Array.isArray(res) ? res : [], this.seenHazardIds, 'hazard_id', isSeedingPoll,
        (r: any) => ({
          title: 'New Hazard Report',
          body: `${r.hazard_type || 'Hazard'} — ${r.barangay_name || 'San Isidro'}`,
        })),
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
    describe: (r: any) => { title: string; body: string },
  ): void {
    const currentIds = new Set<number>();
    for (const r of list) {
      const id = Number(r[idKey]);
      if (!Number.isFinite(id)) continue;
      currentIds.add(id);
      if (!isSeedingPoll && !seenIds.has(id)) {
        const { title, body } = describe(r);
        this.notify(title, body);
      }
    }
    seenIds.clear();
    for (const id of currentIds) seenIds.add(id);
  }

  private async notify(title: string, body: string): Promise<void> {
    // 1. Play alert chime sound
    try {
      this.audio.playNotificationChime();
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
          }
        });
        return;
      } catch (tauriErr) {
        console.warn('[DesktopNotifications] Tauri native notification error:', tauriErr);
      }
    }

    // 3. Fallback to standard web Notification API
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const n = new Notification(title, { body });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      } catch {}
    }
  }
}
