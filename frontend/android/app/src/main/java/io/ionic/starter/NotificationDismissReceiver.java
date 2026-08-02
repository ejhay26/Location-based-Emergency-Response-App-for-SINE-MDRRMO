package io.ionic.starter;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import androidx.core.app.NotificationManagerCompat;

/**
 * Cancels the tapped notification when its "Got it" action is pressed.
 * Purely local (removes the tray entry) — no network call, nothing is
 * reported back to the server.
 */
public class NotificationDismissReceiver extends BroadcastReceiver {
    private static final String TAG = "NotificationDismiss";

    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            int notificationId = intent.getIntExtra(MdrrmoMessagingService.EXTRA_NOTIFICATION_ID, -1);
            if (notificationId != -1) {
                NotificationManagerCompat.from(context).cancel(notificationId);
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to dismiss notification", e);
        }
    }
}
