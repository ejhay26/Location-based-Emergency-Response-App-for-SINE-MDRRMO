import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App, URLOpenListenerEvent } from '@capacitor/app';

/**
 * Custom URL scheme used for all in-app deep links (Home Screen Widgets,
 * and any future external launch source). Must stay in sync with:
 *  - android/app/src/main/AndroidManifest.xml (MainActivity intent-filter)
 *  - ios/App/App/Info.plist (CFBundleURLTypes)
 */
const DEEP_LINK_SCHEME = 'sinemdrrmo';

/**
 * Maps a deep-link host (the part right after "sinemdrrmo://") to the
 * in-app route it should open. Add new widget/shortcut targets here —
 * both the Android AppWidgetProvider and the iOS WidgetKit extension only
 * need to know the host string, not the Angular route shape.
 */
const DEEP_LINK_ROUTES: Record<string, string> = {
  report: '/report',
};

const PENDING_KEY = 'pending_deep_link';

@Injectable({ providedIn: 'root' })
export class DeepLinkService {

  constructor(private router: Router) {}

  /** Call once, from AppComponent.ngOnInit(). No-op on web/Electron. */
  init(): void {
    if (!Capacitor.isNativePlatform()) return;

    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      this.handleUrl(event.url);
    });
  }

  private handleUrl(rawUrl: string): void {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      console.warn('DeepLinkService: unparseable URL', rawUrl);
      return;
    }

    if (url.protocol !== `${DEEP_LINK_SCHEME}:`) return; // not ours — ignore

    if (url.hostname === 'report') {
      const type = url.searchParams.get('type') === 'hazard' ? 'hazard' : 'emergency';
      this.navigateOrDefer(`/tabs/home?open_report=${type}`);
      return;
    }

    const route = DEEP_LINK_ROUTES[url.hostname];
    if (!route) {
      console.warn('DeepLinkService: unknown deep-link host', url.hostname);
      return;
    }

    const target = route + url.search;
    this.navigateOrDefer(target);
  }

  private navigateOrDefer(target: string): void {
    const user = localStorage.getItem('user');
    const role = localStorage.getItem('role');

    if (user && role === 'citizen') {
      // Already logged in as the only role this widget applies to — go now.
      this.router.navigateByUrl(target);
      return;
    }

    // Not logged in (or logged in as admin/dispatcher, for whom this
    // citizen-only target doesn't apply): stash it and send to login.
    // consumePendingDeepLink() is called after a successful citizen login.
    sessionStorage.setItem(PENDING_KEY, target);
    this.router.navigate(['/login']);
  }

  /**
   * Called by LoginPage right after a successful citizen login. Returns the
   * deferred deep-link target (and clears it) if one is pending, else null.
   */
  consumePendingDeepLink(): string | null {
    const target = sessionStorage.getItem(PENDING_KEY);
    if (target) sessionStorage.removeItem(PENDING_KEY);
    return target;
  }
}
