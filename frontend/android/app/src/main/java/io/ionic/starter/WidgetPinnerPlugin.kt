package io.ionic.starter

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * WidgetPinnerPlugin — bridges the "Add Report Widget to Home Screen" CTAs
 * (Settings item, Home banner, account-setup slide) to Android's
 * AppWidgetManager.requestPinAppWidget(), so users can pin
 * ReportWidgetProvider without hunting for it in the launcher's widget
 * picker.
 *
 * requestPinAppWidget() is API 26+ (Android 8.0 Oreo) only, and even then
 * some OEM launchers don't implement it. isRequestPinAppWidgetSupported()
 * checks both at once, so isSupported() below is the single source of
 * truth every CTA in the app gates on before rendering itself. Below API
 * 26 or on unsupported launchers, CTAs simply don't show — the app never
 * attempts (and fails) the request.
 */
@CapacitorPlugin(name = "WidgetPinner")
class WidgetPinnerPlugin : Plugin() {

    @PluginMethod
    fun isSupported(call: PluginCall) {
        val result = JSObject()
        result.put("supported", isPinRequestSupported())
        call.resolve(result)
    }

    /**
     * Fires the system "add to home screen" prompt for ReportWidgetProvider.
     *
     * `requested` reflects only whether Android successfully *displayed*
     * the confirmation prompt — not whether the user went on to accept it.
     * We deliberately don't wire up the optional success PendingIntent
     * callback here; every CTA's copy is written to say "confirm in the
     * prompt", never "widget added", to stay honest about that distinction.
     */
    @PluginMethod
    fun requestPin(call: PluginCall) {
        if (!isPinRequestSupported()) {
            val result = JSObject()
            result.put("requested", false)
            call.resolve(result)
            return
        }
        try {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val provider = ComponentName(context, ReportWidgetProvider::class.java)
            val submitted = appWidgetManager.requestPinAppWidget(provider, null, null)
            val result = JSObject()
            result.put("requested", submitted)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to request widget pin: ${e.message}", e)
        }
    }

    private fun isPinRequestSupported(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
        val appWidgetManager = AppWidgetManager.getInstance(context) ?: return false
        return appWidgetManager.isRequestPinAppWidgetSupported
    }
}
