import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Tiny pub/sub so PushNotificationsService can tell HomePage "a broadcast
 * push just arrived, refetch now" without the two having a direct
 * dependency on each other. HomePage subscribes in ngOnInit and unsubscribes
 * in ngOnDestroy alongside its polling interval.
 */
@Injectable({ providedIn: 'root' })
export class BroadcastRefreshService {
  private readonly refresh$ = new Subject<void>();
  readonly onRefresh = this.refresh$.asObservable();

  trigger(): void {
    this.refresh$.next();
  }
}
