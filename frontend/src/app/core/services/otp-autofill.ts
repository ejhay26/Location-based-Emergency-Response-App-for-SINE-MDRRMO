import { Injectable, NgZone } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/**
 * OtpAutofillService — auto-reads SMS OTP codes so the user doesn't have
 * to type them.
 *
 * Two completely separate mechanisms depending on platform, each with zero
 * overlap in how it works:
 *
 * - ANDROID (native app only): the SMS User Consent API via
 *   `@capawesome/capacitor-android-sms-retriever`. When a matching SMS
 *   arrives, the OS shows a one-tap consent dialog; once the user taps
 *   Allow, this service receives the full message text and extracts the
 *   4-digit code itself via regex. No SMS permission, no app-signature
 *   hash, no special format required in the SMS body — PhilSmsService just
 *   needs to send a message under 140 bytes containing the code, which it
 *   already does.
 *   (This replaced an earlier WebOTP-based approach — WebOTP binds to the
 *   WebView's top-level origin, which for a bundled Capacitor app defaults
 *   to `https://localhost`, not any real domain, so it could never
 *   reliably match the SMS's origin hint. SMS User Consent has no such
 *   binding, which is why it was chosen instead.)
 *
 * - iOS: needs no code at all. iOS autofills OTPs from SMS/Mail directly
 *   into the QuickType bar whenever the input has
 *   `autocomplete="one-time-code"` (already set on every OTP input in this
 *   app). `listen()` is a deliberate no-op on iOS.
 *
 * - Web/desktop (Electron admin, `ionic serve`): no-op. Neither mechanism
 *   applies outside a real Android device.
 */
@Injectable({ providedIn: 'root' })
export class OtpAutofillService {

  private cancelled = false;

  constructor(private zone: NgZone) {}

  /**
   * Start listening for an SMS OTP and call `onReceived` with the
   * extracted 4-digit code. Safe to call on any platform — silently no-ops
   * anywhere but native Android. Call stop() when the OTP screen is
   * dismissed so a late-arriving SMS after the user navigated away doesn't
   * fire a stale callback.
   */
  listen(onReceived: (code: string) => void): void {
    if (Capacitor.getPlatform() !== 'android' || !Capacitor.isNativePlatform()) return;

    this.cancelled = false;
    // Dynamic import: this plugin has no web implementation, and importing
    // it eagerly at module load would pull native-only code into every
    // build target (Electron admin, browser dev server) that never runs
    // on Android. Loaded only when actually about to be used.
    import('@capawesome/capacitor-android-sms-retriever')
      .then(({ AndroidSmsRetriever }) => AndroidSmsRetriever.retrieveSms())
      .then(({ message }) => {
        if (this.cancelled) return; // user navigated away before the SMS arrived
        const code = message.match(/\d{4}/)?.[0];
        if (code) this.zone.run(() => onReceived(code));
      })
      .catch(() => { /* TIMEOUT, user declined consent, or plugin unavailable — silent */ });
  }

  /** Cancel the pending listener. Call from ngOnDestroy and on dismiss. */
  stop(): void {
    this.cancelled = true;
  }
}
