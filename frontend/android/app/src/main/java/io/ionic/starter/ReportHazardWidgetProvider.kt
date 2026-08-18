package io.ionic.starter

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

/**
 * Stage 3a home screen widget: a single "Report Hazard" button.
 *
 * Mirrors ReportWidgetProvider exactly (see its header comment for the full
 * deep-link rationale) but targets the hazard report flow via the `type`
 * query param, which report.page.ts's ngOnInit() already reads
 * (route.snapshot.queryParamMap.get('type')) to pick reportType.
 *
 * Must stay in sync with:
 *  - DEEP_LINK_ROUTES in deep-link.ts (host "report" -> '/report'; this
 *    widget's query string rides along, see DeepLinkService.handleUrl())
 *  - AndroidManifest.xml's MainActivity intent-filter (android:scheme)
 *  - ios/App/App/Info.plist's CFBundleURLTypes
 */
class ReportHazardWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val DEEP_LINK_URI = "sinemdrrmo://report?type=hazard"
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

        val views = RemoteViews(context.packageName, R.layout.widget_hazard).apply {
            setOnClickPendingIntent(R.id.widget_hazard_root, pendingIntent)
        }

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
}
