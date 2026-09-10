/**
 * Runtime desktop-shell detection.
 * Returns true inside the native Tauri desktop shell (Windows, macOS, Linux).
 * Returns false in the browser and in Capacitor's Android/iOS webviews.
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
}

export function isDesktop(): boolean {
  return isTauri();
}

/**
 * Returns true if running in macOS (either web or desktop).
 */
export function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Macintosh|MacIntel|MacPPC|Mac68K|Mac/i.test(navigator.userAgent || navigator.platform || '');
}

/**
 * Returns true specifically inside the native Tauri desktop shell on macOS.
 */
export function isMacDesktop(): boolean {
  return isTauri() && isMac();
}
