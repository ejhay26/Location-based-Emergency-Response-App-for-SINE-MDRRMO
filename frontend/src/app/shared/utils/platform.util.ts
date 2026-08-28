/**
 * Runtime desktop-shell detection. Both Electron and Tauri load the exact
 * same Angular build (`www/`) — these checks are what let a handful of
 * shared components (titlebar window controls, the OSM tile URL) branch
 * per-shell without needing separate builds. Both return false in the
 * browser and in Capacitor's Android/iOS webviews.
 */

/**
 * True inside the Tauri desktop shell. Tauri injects
 * `window.__TAURI_INTERNALS__` into every window it creates, before any
 * app code runs — checking for it is the documented, version-stable way
 * to detect the Tauri runtime (`window.isTauri` only exists in newer 2.x
 * releases, so it's not used here).
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
}

/**
 * True inside the legacy Electron desktop shell (the `nodeIntegration:
 * true, contextIsolation: false` bridge main.js currently sets up).
 */
export function isElectron(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const electronRequire = (window as unknown as { require?: (mod: string) => any }).require;
    return typeof electronRequire === 'function' && !!electronRequire('electron');
  } catch {
    return false;
  }
}
