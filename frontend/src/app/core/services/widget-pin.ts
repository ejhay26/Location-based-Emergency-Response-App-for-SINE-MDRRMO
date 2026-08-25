import { Injectable } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface WidgetPinnerPlugin {
  isSupported(): Promise<{ supported: boolean }>;
  requestPin(options?: { type?: string }): Promise<{ requested: boolean }>;
}

const WidgetPinnerNative = registerPlugin<WidgetPinnerPlugin>('WidgetPinner');

/**
 * WidgetPinService — thin, fail-closed wrapper around the native
 * WidgetPinnerPlugin (Android 8+ only; see WidgetPinnerPlugin.kt). Every
 * CTA offering to add the home screen Report widget (Settings, Home
 * banner, account-setup) calls isAvailable() before rendering itself, so
 * unsupported devices never see a button that can't do anything.
 *
 * Availability is cached per app session — device/launcher capability
 * doesn't change mid-session, so there's no reason to re-cross the native
 * bridge for every surface that checks it.
 */
@Injectable({ providedIn: 'root' })
export class WidgetPinService {

  private availableCache: boolean | null = null;

  async isAvailable(): Promise<boolean> {
    if (this.availableCache !== null) return this.availableCache;

    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      this.availableCache = false;
      return false;
    }
    try {
      const { supported } = await WidgetPinnerNative.isSupported();
      this.availableCache = supported;
      return supported;
    } catch {
      // Never trust a native bridge call unconditionally — if it throws,
      // fail closed and hide the CTA rather than risk a dead button.
      this.availableCache = false;
      return false;
    }
  }

  /** Resolves true only if the system pin prompt was successfully shown — see WidgetPinnerPlugin.requestPin(). */
  async requestPin(type: 'emergency' | 'hazard' = 'emergency'): Promise<boolean> {
    try {
      const { requested } = await WidgetPinnerNative.requestPin({ type });
      return requested;
    } catch {
      return false;
    }
  }
}
