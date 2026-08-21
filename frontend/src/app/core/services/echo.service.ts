import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { environment } from '../../../environments/environment';

/** Shape of each raw event payload arriving from Reverb. */
export interface ReverbEvent {
  channel: 'emergencies' | 'hazards' | 'broadcasts' | 'users';
  event: string;
  data: {
    action: string;
    request_id?: number;
    hazard_id?: number;
    broadcast_id?: number;
    user_id?: number;
  };
}

/**
 * Manages the single Laravel Echo (Reverb) WebSocket connection for the
 * entire app lifetime. Exposes typed Observables for each public channel
 * so consumers never touch Echo or Pusher directly.
 *
 * Channels:
 *   emergencies  — EmergencyUpdated   (SOS submit / dispatch / resolve / cancel / false_alarm)
 *   hazards      — HazardUpdated      (hazard submit / resolve)
 *   broadcasts   — BroadcastMessageUpdated (alert created / cleared)
 *   users        — UserVerified       (account approved / rejected / suspended / reinstated)
 */
@Injectable({ providedIn: 'root' })
export class EchoService implements OnDestroy {
  // Typed as `any` to avoid the laravel-echo "reverb" vs "pusher" generic
  // mismatch — the runtime behaviour is identical regardless of the type param.
  private echo: any = null;

  private readonly emergencyUpdated$ = new Subject<ReverbEvent['data']>();
  private readonly hazardUpdated$    = new Subject<ReverbEvent['data']>();
  private readonly broadcastUpdated$ = new Subject<ReverbEvent['data']>();
  private readonly userVerified$     = new Subject<ReverbEvent['data']>();
  private readonly connected$        = new Subject<boolean>();

  readonly onConnected:        Observable<boolean>            = this.connected$.asObservable();
  readonly onEmergencyUpdated: Observable<ReverbEvent['data']> = this.emergencyUpdated$.asObservable();
  readonly onHazardUpdated:    Observable<ReverbEvent['data']> = this.hazardUpdated$.asObservable();
  readonly onBroadcastUpdated: Observable<ReverbEvent['data']> = this.broadcastUpdated$.asObservable();
  /** Emits whenever a UserVerified event arrives (approved / rejected / suspended / reinstated). */
  readonly onUserVerified:     Observable<ReverbEvent['data']> = this.userVerified$.asObservable();

  connect(): void {
    if (this.echo) return;

    (window as any).Pusher = Pusher;

    const echo = new Echo({
      broadcaster:       'reverb',
      key:               environment.reverbKey,
      wsHost:            environment.reverbHost,
      wsPort:            environment.reverbPort,
      wssPort:           environment.reverbPort,
      forceTLS:          environment.reverbScheme === 'https',
      enabledTransports: ['ws', 'wss'],
      disableStats:      true,
    });

    this.echo = echo;

    echo.connector.pusher.connection.bind('connected',    () => this.connected$.next(true));
    echo.connector.pusher.connection.bind('disconnected', () => this.connected$.next(false));
    echo.connector.pusher.connection.bind('error',        () => this.connected$.next(false));

    echo.channel('emergencies').listen('.EmergencyUpdated', (data: ReverbEvent['data']) => {
      this.emergencyUpdated$.next(data);
    });

    echo.channel('hazards').listen('.HazardUpdated', (data: ReverbEvent['data']) => {
      this.hazardUpdated$.next(data);
    });

    echo.channel('broadcasts').listen('.BroadcastMessageUpdated', (data: ReverbEvent['data']) => {
      this.broadcastUpdated$.next(data);
    });

    // `users` channel — account lifecycle events (approve / reject / suspend / reinstate).
    // Used by: VerificationsPanel, CitizensPanel, DispatchersPanel, PendingVerificationPage.
    echo.channel('users').listen('.UserVerified', (data: ReverbEvent['data']) => {
      this.userVerified$.next(data);
    });
  }

  disconnect(): void {
    if (!this.echo) return;
    this.echo.disconnect();
    this.echo = null;
    this.connected$.next(false);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
