import { Injectable } from '@angular/core';
import { ApiService } from './api';
import { isTauri } from '../../shared/utils/platform.util';

const POLL_INTERVAL_MS = 5000; // matches IncidentMapPanel's existing active-emergencies poll cadence

/**
 * DesktopNotificationsService — Stage 5 admin alert, polling-based.
 * Fires a native desktop notification when a NEW active SOS or hazard report appears.
 */
@Injectable({ providedIn: 'root' })
export class DesktopNotificationsService {
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  /** ids currently known "active" (Pending/Dispatched, or active hazards) — pruned every poll so this never grows unbounded as reports resolve/get cancelled. */
  private seenEmergencyIds = new Set<number>();
  private seenHazardIds = new Set<number>();
  private pollCount = 0;
  private running = false;

  constructor(private api: ApiService) {}

  private get isDesktop(): boolean {
    return isTauri();
  }

  private get notificationsSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /** Idempotent — safe to call every time the dashboard shell mounts (e.g. after a logout/login cycle) without stacking duplicate intervals. */
  async start(): Promise<void> {
    if (this.running) return;
    if (!this.isDesktop || !this.notificationsSupported) return;

    try {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    } catch {
      // Some Electron/Chromium combinations reject requestPermission outside
      // a user gesture — non-fatal, we just won't be able to notify; the
      // poll loop below still no-ops safely via notify()'s own permission check.
    }

    this.running = true;
    this.pollCount = 0;
    this.seenEmergencyIds.clear();
    this.seenHazardIds.clear();
    this.poll(); // immediate first poll to seed, rather than waiting a full interval
    this.pollHandle = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.pollHandle) { clearInterval(this.pollHandle); this.pollHandle = null; }
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
          body: `${r.incident_name || 'Emergency'} — ${r.barangay_name || 'Unresolved location'}`,
        })),
      error: () => {},
    });
    this.api.getActiveHazards().subscribe({
      next: (res: any) => this.diff(Array.isArray(res) ? res : [], this.seenHazardIds, 'hazard_id', isSeedingPoll,
        (r: any) => ({
          title: 'New Hazard Report',
          body: `${r.hazard_type || 'Hazard'} — ${r.barangay_name || 'Unresolved location'}`,
        })),
      error: () => {},
    });
  }

  /**
   * Diffs a freshly-fetched active list against a seen-id set: notifies for
   * any id not previously seen (skipped entirely on the seeding poll), then
   * replaces the set's contents with exactly the current active ids — this
   * is what prunes resolved/cancelled/dispatched-away reports out again
   * automatically, keeping the set's memory bounded by "currently active",
   * never "everything ever seen this session".
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
      if (!Number.isFinite(id)) continue; // defensive: never let a malformed row corrupt the set
      currentIds.add(id);
      if (!isSeedingPoll && !seenIds.has(id)) {
        const { title, body } = describe(r);
        this.notify(title, body);
      }
    }
    seenIds.clear();
    for (const id of currentIds) seenIds.add(id);
  }

  private notify(title: string, body: string): void {
    if (!this.notificationsSupported || Notification.permission !== 'granted') return;
    try {
      const n = new Notification(title, { body });
      n.onclick = () => { window.focus(); n.close(); };
    } catch {
      // Never let a notification failure interrupt the poll loop.
    }
  }
}
