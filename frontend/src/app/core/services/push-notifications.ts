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
      // Save token to your backend
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
}
