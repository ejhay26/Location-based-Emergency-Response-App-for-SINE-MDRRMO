package io.ionic.starter;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Extends (does not replace) Capacitor's own push-notifications
 * MessagingService. super.onMessageReceived() / super.onNewToken() are
 * called first and unchanged, so the existing JS-side 'pushNotificationReceived'
 * / 'registration' listeners in push-notifications.ts keep working exactly
 * as before.
 *
 * This class only ADDS: building our own system notification with a
 * "Got it" dismiss action. The backend (FirebasePushService.php) sends
 * Android messages data-only specifically so this service — not the OS's
 * automatic notification display, which supports no custom actions — is
 * always what controls what's shown.
 *
 * Registered in AndroidManifest.xml in place of the plugin's own
 * MessagingService entry (which is removed via tools:node="remove"), since
 * Android only supports one FirebaseMessagingService per app.
 *
 * All notification-building is wrapped in try/catch: a failure here must
 * never crash the app process (this runs inline in FCM message delivery),
 * especially for an emergency-response app — worst case is a missed
 * notification, not a force-close.
 */
public class MdrrmoMessagingService extends MessagingService {

    private static final String TAG = "MdrrmoMessagingService";
    private static final String CHANNEL_ID = "mdrrmo_alerts";
    static final String ACTION_DISMISS = "io.ionic.starter.ACTION_DISMISS_NOTIFICATION";
    static final String EXTRA_NOTIFICATION_ID = "notificationId";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        try {
            Map<String, String> data = remoteMessage.getData();
            String title = data.get("title");
            String body = data.get("body");
            if (title == null && body == null) return; // silent/data-only ping, nothing to show

            showNotification(title != null ? title : "MDRRMO Alert", body != null ? body : "");
        } catch (Exception e) {
            // Never let a notification-building failure crash the app.
            Log.e(TAG, "Failed to display notification", e);
        }
    }

    private void showNotification(String title, String body) {
        Context context = getApplicationContext();
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && manager.getNotificationChannel(CHANNEL_ID) == null) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "MDRRMO Alerts", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Emergency dispatch updates and public safety broadcasts.");
            manager.createNotificationChannel(channel);
        }

        int notificationId = (int) System.currentTimeMillis();
        int pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);

        Intent dismissIntent = new Intent(context, NotificationDismissReceiver.class);
        dismissIntent.setAction(ACTION_DISMISS);
        dismissIntent.putExtra(EXTRA_NOTIFICATION_ID, notificationId);
        PendingIntent dismissPendingIntent = PendingIntent.getBroadcast(
                context, notificationId, dismissIntent, pendingIntentFlags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                // A stock system icon, not the app's adaptive launcher icon —
                // adaptive icons (multi-layer XML) are a known crash trigger
                // when passed to setSmallIcon(), which expects a flat,
                // alpha-only "status bar style" drawable.
                .setSmallIcon(android.R.drawable.stat_sys_warning)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .addAction(0, "Got it", dismissPendingIntent);

        // Tapping the notification body still opens the app, same as the
        // default OS-displayed notification did before this change.
        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent != null) {
            launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent contentPendingIntent = PendingIntent.getActivity(
                    context, notificationId, launchIntent, pendingIntentFlags);
            builder.setContentIntent(contentPendingIntent);
        }

        NotificationManagerCompat.from(context).notify(notificationId, builder.build());
    }
}
