import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { ApiService } from './api';

/**
 * NetworkService — real backend reachability, not just navigator.onLine.
 *
 * `navigator.onLine` only reflects whether the device's network INTERFACE
 * is up (Wi-Fi/cellular associated) — it says nothing about whether the
 * internet, or specifically this app's backend, is actually reachable.
 * Classic false positives this matters for:
 *   - Captive portals (connected to Wi-Fi, but every request redirects to
 *     a login page until the person taps through it)
 *   - The backend itself being down while the device's own connection is fine
 *   - A cellular connection with an interface that's "up" but has no
 *     signal/data throughput (common in a disaster area at cell tower
 *     capacity limits)
 * For an emergency app deciding whether to queue-or-send, trusting
 * navigator.onLine alone would falsely tell the user "sent" when the
 * request actually can't reach anywhere.
 */
@Injectable({ providedIn: 'root' })
export class NetworkService {
  private readonly _isOnline = signal<boolean>(navigator.onLine);
  /** Reactive, read-only — bind directly in templates for a connectivity badge. */
  readonly isOnline = this._isOnline.asReadonly();

  constructor(private http: HttpClient, private api: ApiService) {
    // 'online' is a hint to re-verify, never trusted on its own — recheck()
    // does the real probe. 'offline' IS trustworthy taken alone: if the OS
    // itself says the interface dropped, no probe will succeed anyway.
    window.addEventListener('online', () => { this.recheck(); });
    window.addEventListener('offline', () => { this._isOnline.set(false); });
  }

  /**
   * Actively probes the backend's health route (/api/health).
   * Short 5s timeout: on a genuinely bad connection this should fail fast
   * rather than hang the caller (report submission) waiting on it.
   */
  async recheck(): Promise<boolean> {
    try {
      await firstValueFrom(
        this.api.healthCheck().pipe(timeout(5000))
      );
      this._isOnline.set(true);
      return true;
    } catch {
      // If browser reports navigator.onLine is true, check if standard internet works
      const onlineFallback = typeof navigator !== 'undefined' ? navigator.onLine : false;
      this._isOnline.set(onlineFallback);
      return onlineFallback;
    }
  }
}
