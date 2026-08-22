import { Injectable } from '@angular/core';
import { ApiService } from './api';

@Injectable({ providedIn: 'root' })
export class ImageCacheService {

  private cache = new Map<string, string>();

  constructor(private api: ApiService) {}

  /**
   * Resolves a stored file reference to a directly-usable <img>/background
   * URL. Two fundamentally different paths depending on the shape:
   *
   * 1. LEGACY local-disk proxy ("storage/profiles/file.png") — routed
   *    through Laravel's /storage-proxy/ route via fetch()+blob(), because
   *    that route (and ngrok tunnels generally) need the
   *    'ngrok-skip-browser-warning' header and don't reliably set CORS
   *    headers for a plain <img> load.
   *
   * 2. EVERYTHING ELSE (R2 URLs, or any other external URL) — used
   *    directly, no fetch/blob involved. This is deliberate, not a
   *    shortcut: a plain <img src="https://...">/background-image loads
   *    cross-origin images fine with ZERO CORS headers required — CORS
   *    only gates JS-level access to the pixel data (fetch, canvas), which
   *    this app never needs for an avatar/proof photo. Routing these
   *    through fetch()+blob() was a real bug (fixed here) that broke any
   *    URL without a CORS policy, including third-party ones like a
   *    seeded placeholder avatar — those were never going to need blob
   *    conversion, so attempting it only added a failure mode with zero
   *    benefit.
   */
  async resolve(path: string | null | undefined): Promise<string> {
    if (!path || path.trim() === '') return '';
    if (path.startsWith('blob:') || path.startsWith('data:')) return path;

    const legacyUrl = this.toLegacyProxyUrl(path);
    if (!legacyUrl) {
      // Not our legacy proxy shape — R2 or any other external URL passes
      // straight through untouched, no network round-trip through here.
      return path;
    }

    if (this.cache.has(legacyUrl)) return this.cache.get(legacyUrl)!;

    try {
      const res = await fetch(legacyUrl, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
        mode: 'cors',
      });
      if (!res.ok) return '';
      const blob = await res.blob();
      if (blob.size === 0) return '';
      const blobUrl = URL.createObjectURL(blob);
      this.cache.set(legacyUrl, blobUrl);
      return blobUrl;
    } catch {
      return '';
    }
  }

  /** Synchronous best-effort lookup — instant for non-legacy URLs (no fetch needed at all), cache-only for the legacy proxy path. */
  getCached(path: string | null | undefined): string {
    if (!path) return '';
    if (path.startsWith('blob:') || path.startsWith('data:')) return path;
    const legacyUrl = this.toLegacyProxyUrl(path);
    if (!legacyUrl) return path; // R2/external — always immediately usable, nothing to cache
    return this.cache.get(legacyUrl) ?? '';
  }

  /**
   * Returns the /storage-proxy/... URL ONLY for the legacy local-disk
   * shape ("storage/profiles/file.png", bare or embedded in an absolute
   * URL). Returns null for anything else (R2 URLs, arbitrary external
   * URLs) — callers must treat null as "use the path directly, no proxy".
   */
  private toLegacyProxyUrl(path: string): string | null {
    try {
      const isAbsoluteUrl = /^https?:\/\//i.test(path);
      let relative: string;

      if (isAbsoluteUrl) {
        const storageMatch = path.match(/\/(storage\/.+)$/);
        if (storageMatch) {
          relative = storageMatch[1];
        } else {
          const reportsMatch = path.match(/\/(reports\/.+)$/);
          if (reportsMatch) {
            relative = reportsMatch[1];
          } else {
            return null; // R2 / external — not our legacy shape
          }
        }
      } else if (path.startsWith('storage/')) {
        relative = path;
      } else if (path.startsWith('reports/') || path.startsWith('profiles/') || path.startsWith('hazards/')) {
        relative = path;
      } else {
        return null; // not a recognizable legacy path at all
      }

      const origin = this.api.apiOrigin;
      if (!origin) return null;

      const filePart = relative.replace(/^storage\//, '').replace(/^\/+/, '');
      return `${origin}/storage-proxy/${filePart}`;
    } catch {
      return null;
    }
  }

  clear() {
    this.cache.forEach(blobUrl => {
      if (blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
    });
    this.cache.clear();
  }
}
