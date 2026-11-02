import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Tiny pub/sub so any real-time source — PushNotificationsService (FCM)
 * or EchoService (Reverb WebSocket) — can tell HomePage "something changed,
 * refetch now" without the two having a direct dependency on each other.
 * HomePage subscribes in ngOnInit and unsubscribes in ngOnDestroy alongside
 * its fallback polling interval.
 *
 * Also holds the last-fetched broadcast list as a simple in-memory cache.
 * `/report` is a top-level route outside the tabs' cached route structure,
 * so navigating there and back destroys and recreates HomePage — without
 * this, its ngOnInit would start from an empty array every time, and the
 * announcement cards would visibly vanish and re-play their entrance
 * animation on every return trip, reading as an unwanted reload. Since this
 * service is `providedIn: 'root'`, it survives HomePage's destroy/recreate
 * as long as the app itself is still running, so HomePage can paint the
 * cached list immediately and only silently refresh in the background.
 *
 * Real-time sources that call trigger():
 *   1. PushNotificationsService — FCM push arrives while app is foregrounded
 *   2. EchoService — BroadcastMessageUpdated WebSocket event from Reverb
 */
@Injectable({ providedIn: 'root' })
export class BroadcastRefreshService {
  private readonly refresh$ = new Subject<void>();
  readonly onRefresh = this.refresh$.asObservable();

  /** Last-fetched broadcast list, or null if nothing has been fetched yet this session. */
  lastBroadcasts: any[] | null = null;

  trigger(): void {
    this.refresh$.next();
  }
}
