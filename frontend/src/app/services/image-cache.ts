import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ImageCacheService {

  private cache = new Map<string, string>();

  async resolve(path: string | null | undefined): Promise<string> {
    if (!path || path.trim() === '') return '';
    if (path.startsWith('blob:') || path.startsWith('data:')) return path;

    const url = this.toProxyUrl(path);
    if (!url) return '';

    if (this.cache.has(url)) return this.cache.get(url)!;

    try {
      const res = await fetch(url, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
        mode: 'cors',
      });
      if (!res.ok) return '';
      const blob = await res.blob();
      if (blob.size === 0) return '';
      const blobUrl = URL.createObjectURL(blob);
      this.cache.set(url, blobUrl);
      return blobUrl;
    } catch {
      return '';
    }
  }

  getCached(path: string | null | undefined): string {
    if (!path) return '';
    if (path.startsWith('blob:') || path.startsWith('data:')) return path;
    const url = this.toProxyUrl(path);
    return url ? (this.cache.get(url) ?? '') : '';
  }

  /**
   * Converts a storage path to a proxy URL.
   *
   * "storage/profiles/file.png"
   *   → "https://ngrok-url/storage-proxy/profiles/file.png"
   *
   * The /storage-proxy/ route in web.php adds CORS headers explicitly,
   * bypassing ngrok's interstitial and Laravel's CORS middleware gap.
   */
  private toProxyUrl(path: string): string {
    try {
      const apiUrl = environment.apiUrl || '';
      if (!apiUrl) return '';
      const origin = apiUrl.replace(/\/api\/?$/, '');
      if (!origin) return '';

      // Strip any absolute URL prefix — extract just the storage/... part.
      let relative = path;
      if (/^https?:\/\//i.test(path)) {
        const match = path.match(/\/(storage\/.+)$/);
        if (!match) return '';
        relative = match[1];
      }

      // relative is now "storage/profiles/file.png"
      // strip the "storage/" prefix to get "profiles/file.png"
      const filePart = relative.replace(/^storage\//, '');
      return `${origin}/storage-proxy/${filePart}`;
    } catch {
      return '';
    }
  }

  clear() {
    this.cache.forEach(blobUrl => {
      if (blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
    });
    this.cache.clear();
  }
}
