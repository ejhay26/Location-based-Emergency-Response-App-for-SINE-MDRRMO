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
