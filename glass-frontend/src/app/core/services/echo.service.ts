import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { environment } from '../../../environments/environment';

/** Shape of each raw event payload arriving from the WebSocket server. */
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
 * Manages the native WebSocket connection for the entire app lifetime.
 * Exposes typed Observables for each public channel so consumers never
 * touch raw WebSocket mechanics directly.
 *
 * Lifecycle-Aware WebSocket Management:
 *   - On native mobile (Capacitor) and desktop/web tabs, pauses (disconnects)
 *     the WebSocket connection when the app is placed in the background or tab is hidden.
 *   - Automatically resumes with jitter when foregrounded.
 *   - Reconnects with exponential backoff on unexpected connection drops.
 *   - Background alerts are handled via Firebase Cloud Messaging (FCM) push notifications,
 *     drastically reducing idle TCP sockets and memory usage on the VPS.
 *
 * Channels:
 *   emergencies  — EmergencyUpdated        (SOS submit / dispatch / resolve / cancel / false_alarm)
 *   hazards      — HazardUpdated           (hazard submit / resolve)
 *   broadcasts   — BroadcastMessageUpdated (alert created / cleared)
 *   users        — UserVerified            (account approved / rejected / suspended / reinstated)
 */
@Injectable({ providedIn: 'root' })
export class EchoService implements OnDestroy {
  private socket: WebSocket | null = null;

  private shouldBeConnected = false;
  private isPaused = false;
  private pauseTimer: any = null;
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private reconnectAttempts = 0;
  private appStateListenerHandle: any = null;
  private visibilityListener: (() => void) | null = null;

  private readonly emergencyUpdated$ = new Subject<ReverbEvent['data']>();
  private readonly hazardUpdated$    = new Subject<ReverbEvent['data']>();
  private readonly broadcastUpdated$ = new Subject<ReverbEvent['data']>();
  private readonly userVerified$     = new Subject<ReverbEvent['data']>();
  private readonly connected$        = new BehaviorSubject<boolean>(false);
  private readonly resumed$          = new Subject<void>();

  readonly onConnected:        Observable<boolean>            = this.connected$.asObservable();
  get isConnected(): boolean { return this.connected$.value; }
  readonly onEmergencyUpdated: Observable<ReverbEvent['data']> = this.emergencyUpdated$.asObservable();
  readonly onHazardUpdated:    Observable<ReverbEvent['data']> = this.hazardUpdated$.asObservable();
  readonly onBroadcastUpdated: Observable<ReverbEvent['data']> = this.broadcastUpdated$.asObservable();
  /** Emits whenever a UserVerified event arrives (approved / rejected / suspended / reinstated). */
  readonly onUserVerified:     Observable<ReverbEvent['data']> = this.userVerified$.asObservable();
  /** Emits whenever the app resumes from background and restores the WebSocket connection. */
  readonly onResumed:          Observable<void>               = this.resumed$.asObservable();

  constructor() {
    this.initLifecycleListeners();
  }

  /**
   * Resolves the WebSocket URL using environment configuration.
   */
  private getWebSocketUrl(): string {
    if ((environment as any).wsUrl) {
      return (environment as any).wsUrl;
    }
    const scheme = environment.reverbScheme === 'https' ? 'wss' : 'ws';
    const host = environment.reverbHost || (typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1');
    const port = environment.reverbPort ? `:${environment.reverbPort}` : '';
    return `${scheme}://${host}${port}/ws`;
  }

  /**
   * Listens for mobile app state changes (Capacitor) and web visibility changes.
   */
  private initLifecycleListeners(): void {
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', (state) => {
        if (!state.isActive) {
          this.handleBackground();
        } else {
          this.handleForeground();
        }
      }).then(handle => {
        this.appStateListenerHandle = handle;
      }).catch(err => {
        console.warn('EchoService: Failed to bind appStateChange listener', err);
      });
    }

    if (typeof document !== 'undefined') {
      this.visibilityListener = () => {
        if (document.hidden) {
          this.handleBackground();
        } else {
          this.handleForeground();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityListener);
    }
  }

  private handleBackground(): void {
    if (!this.shouldBeConnected || this.isPaused) return;

    // 4-second grace period: prevents disconnect/reconnect churn if user
    // quickly pulls down notification shade or switches apps briefly.
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    this.pauseTimer = setTimeout(() => {
      this.pauseWebSocket();
    }, 4000);
  }

  private handleForeground(): void {
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }

    if (this.isPaused && this.shouldBeConnected) {
      // Add slight randomized jitter (50ms - 400ms) to prevent thundering-herd
      // reconnect spikes if hundreds of devices wake simultaneously.
      const jitter = Math.floor(Math.random() * 350) + 50;
      setTimeout(() => {
        if (this.shouldBeConnected) {
          this.resumeWebSocket();
        }
      }, jitter);
    }
  }

  private pauseWebSocket(): void {
    this.isPaused = true;
    this.cleanupSocket();
    this.connected$.next(false);
  }

  private resumeWebSocket(): void {
    this.isPaused = false;
    this.reconnectAttempts = 0;
    this.initSocket();
    this.resumed$.next();
  }

  connect(): void {
    this.shouldBeConnected = true;
    this.isPaused = false;
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }

    this.initSocket();
  }

  private initSocket(): void {
    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
        return;
      }
      this.cleanupSocket();
    }

    const url = this.getWebSocketUrl();
    try {
      const ws = new WebSocket(url);
      this.socket = ws;

      ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.connected$.next(true);
        this.startHeartbeat();

        // Register default channels upon connection
        try {
          ws.send(JSON.stringify({
            action: 'subscribe',
            channels: ['emergencies', 'hazards', 'broadcasts', 'users'],
          }));
        } catch {
          // Socket write error handled on next lifecycle tick
        }
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          this.handleIncomingMessage(payload);
        } catch {
          // Ignore malformed payloads
        }
      };

      ws.onerror = () => {
        // Handled on close
      };

      ws.onclose = () => {
        this.cleanupSocket();
        this.connected$.next(false);
        this.scheduleReconnect();
      };
    } catch (err) {
      console.warn('EchoService: Failed to establish WebSocket connection', err);
      this.connected$.next(false);
      this.scheduleReconnect();
    }
  }

  private handleIncomingMessage(msg: any): void {
    if (!msg) return;

    // Ignore heartbeats and control acks
    if (msg.action === 'pong' || msg.event === 'pong' || msg.event === 'connected') {
      return;
    }

    const channel = msg.channel;
    const data = msg.data;
    if (!channel || !data) return;

    switch (channel) {
      case 'emergencies':
        this.emergencyUpdated$.next(data);
        break;
      case 'hazards':
        this.hazardUpdated$.next(data);
        break;
      case 'broadcasts':
        this.broadcastUpdated$.next(data);
        break;
      case 'users':
        this.userVerified$.next(data);
        break;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        try {
          this.socket.send(JSON.stringify({ action: 'ping' }));
        } catch {
          // Heartbeat send failed
        }
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldBeConnected || this.isPaused || this.reconnectTimer) {
      return;
    }

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000) + Math.floor(Math.random() * 300);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.shouldBeConnected && !this.isPaused) {
        this.initSocket();
      }
    }, delay);
  }

  private cleanupSocket(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.onopen = null;
        this.socket.onmessage = null;
        this.socket.onerror = null;
        this.socket.onclose = null;
        this.socket.close();
      } catch {
        // Ignored
      }
      this.socket = null;
    }
  }

  disconnect(): void {
    this.shouldBeConnected = false;
    this.isPaused = false;
    if (this.pauseTimer) {
      clearTimeout(this.pauseTimer);
      this.pauseTimer = null;
    }
    this.cleanupSocket();
    this.connected$.next(false);
  }

  ngOnDestroy(): void {
    this.disconnect();
    if (this.appStateListenerHandle) {
      this.appStateListenerHandle.remove?.();
      this.appStateListenerHandle = null;
    }
    if (this.visibilityListener && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = null;
    }
  }
}
