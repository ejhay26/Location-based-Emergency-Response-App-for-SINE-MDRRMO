import { Injectable } from '@angular/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { ApiService } from './api';

@Injectable({ providedIn: 'root' })
export class PushNotificationsService {

  constructor(private api: ApiService) {}

  async registerPush(userId: number): Promise<void> {
    if (!Capacitor.isNativePlatform()) return; // skip on web/Electron

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') return;

    await PushNotifications.register();

    PushNotifications.addListener('registration', (token: Token) => {
      // Cache locally so unregisterPush() (called on logout) can tell the
      // backend exactly which device_tokens row to delete for this device,
      // without deleting the user's other devices' tokens.
      localStorage.setItem('push_token', token.value);
      this.api.savePushToken({ user_id: userId, token: token.value, platform: Capacitor.getPlatform() }).subscribe();
    });

    PushNotifications.addListener('registrationError', (err: any) => {
      console.error('Push registration error:', err);
    });

    // App is in foreground — notification received silently
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Foreground notification:', notification);
      // Optionally show an in-app toast here
    });

    // User tapped a notification
    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      const data = action.notification.data;
      console.log('Notification tapped:', data);
      // Navigate based on data.type if needed
    });
  }

  /**
   * Deletes this device's token from the backend (so it stops receiving
   * broadcasts) and clears the local cache. Call on logout. Safe no-op on
   * web/Electron or if registerPush() was never called (nothing cached).
   */
  unregisterPush(): void {
    const token = localStorage.getItem('push_token');
    if (!token) return;
    localStorage.removeItem('push_token');
    this.api.deletePushToken({ token }).subscribe({ error: () => {} });
  }
}
