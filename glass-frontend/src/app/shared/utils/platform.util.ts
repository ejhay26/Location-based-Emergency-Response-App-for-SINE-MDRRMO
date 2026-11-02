/**
 * Runtime desktop-shell detection.
 * Returns true inside the native Tauri desktop shell (Windows, macOS, Linux).
 * Also returns true when running in a desktop browser environment or preview.
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    !!(window as any).__TAURI_INTERNALS__ ||
    !!(window as any).__TAURI__ ||
    window.location.protocol === 'tauri:' ||
    window.location.protocol === 'asset:' ||
    window.location.hostname === 'tauri.localhost' ||
    window.location.origin.includes('tauri')
  );
}

export function isDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  if (isTauri()) return true;
  // If running in desktop viewport and not in a mobile native Capacitor container
  const isMobileNative = !!(window as any).Capacitor?.isNativePlatform?.();
  return !isMobileNative && window.innerWidth >= 768;
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
  return isDesktop() && isMac();
}
