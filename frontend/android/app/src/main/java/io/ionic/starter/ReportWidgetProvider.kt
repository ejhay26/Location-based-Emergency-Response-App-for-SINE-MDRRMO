package io.ionic.starter

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

/**
 * Stage 3a home screen widget: a single "Report Emergency" button.
 *
 * Tapping it fires an explicit ACTION_VIEW intent at MainActivity with the
 * app's custom deep-link scheme (sinemdrrmo://report). MainActivity's
 * launchMode="singleTask" means Capacitor's BridgeActivity routes this
 * through onNewIntent() into the appUrlOpen listener, which
 * DeepLinkService (frontend/src/app/core/services/deep-link.ts) picks up
 * and — via AuthGuard — either navigates straight to /report or defers to
 * it after login.
 *
 * Must stay in sync with:
 *  - DEEP_LINK_SCHEME / DEEP_LINK_ROUTES in deep-link.ts
 *  - AndroidManifest.xml's MainActivity intent-filter (android:scheme)
 *  - ios/App/App/Info.plist's CFBundleURLTypes
 */
class ReportWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val DEEP_LINK_URI = "sinemdrrmo://report"
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId)
        }
    }

    private fun updateWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
        val launchIntent = Intent(Intent.ACTION_VIEW, Uri.parse(DEEP_LINK_URI)).apply {
            // Explicit component: this must open our app, never a chooser —
            // a bare ACTION_VIEW with only a data URI could otherwise be
            // resolved to any other app that (maliciously or accidentally)
            // registers the same scheme.
            setClassName(context, "io.ionic.starter.MainActivity")
            // Widget taps originate outside any Activity context, so a new
            // task is required; singleTask on MainActivity then collapses
            // this onto the existing instance (if any) via onNewIntent().
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        // FLAG_IMMUTABLE: this PendingIntent is never filled in or reused by
        // another process, so it must stay immutable — mandatory on API 31+
        // and the safer default below that too.
        val pendingIntent = PendingIntent.getActivity(
            context,
            appWidgetId,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val views = RemoteViews(context.packageName, R.layout.widget_report).apply {
            setOnClickPendingIntent(R.id.widget_report_root, pendingIntent)
        }

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
}
