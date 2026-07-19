import { Injectable, NgZone } from '@angular/core';

/**
 * OtpAutofillService — auto-reads SMS OTP codes using the WebOTP API.
 *
 * HOW TO GENERATE THIS FILE:
 *   ionic generate service services/otp-autofill
 * Then replace the generated content with this.
 *
 * HOW IT WORKS:
 * On Android (Chrome/Capacitor WebView), when the backend sends an SMS that
 * ends with a line like:
 *   @yoursite.ngrok-free.app #1234
 *   (format: @<origin> #<code>)
 * The OS automatically reads it and calls your callback with "1234".
 * This works WITHOUT any Contacts permission — the OS reads only OTPs.
 *
 * To enable it in your Semaphore SMS messages, append to SemaphoreService:
 *   $message .= "\n@{$_SERVER['HTTP_HOST']} #{$otp}";
 * But since ngrok domains rotate, set APP_URL in .env and use:
 *   $origin = parse_url(config('app.url'), PHP_URL_HOST);
 *   $message .= "\n@{$origin} #{$otp}";
 *
 * iOS does not support WebOTP — on iOS the keyboard's QuickType bar
 * surfaces OTP suggestions automatically from SMS without any JS needed.
 * No extra code required for iOS; this service silently does nothing there.
 */
@Injectable({ providedIn: 'root' })
export class OtpAutofillService {

  private abortController: AbortController | null = null;

  constructor(private zone: NgZone) {}

  /**
   * Start listening for an SMS OTP and call `onReceived` when one arrives.
   * Safe to call on platforms where WebOTP is unsupported — it silently exits.
   * Call stop() when the OTP screen is dismissed to cancel the pending request.
   */
  listen(onReceived: (code: string) => void): void {
    if (!('OTPCredential' in window)) return; // iOS / unsupported browsers — no-op

    this.stop(); // cancel any previous listener
    this.abortController = new AbortController();

    (navigator as any).credentials
      .get({ otp: { transport: ['sms'] }, signal: this.abortController.signal })
      .then((credential: any) => {
        if (credential?.code) {
          this.zone.run(() => onReceived(credential.code));
        }
      })
      .catch(() => { /* aborted or not supported — silent */ });
  }

  /** Cancel the pending OTP listener. Call from ngOnDestroy and on dismiss. */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}