import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TourOverlayComponent, AppDialogsComponent, AppTitlebarComponent } from './shared/components/index';
import { UserSettingsService } from './core/services/user-settings';
import { LocationService } from './core/services/location';
import { DeepLinkService } from './core/services/deep-link';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  imports: [IonApp, IonRouterOutlet, TourOverlayComponent, AppDialogsComponent, AppTitlebarComponent],
})
export class AppComponent implements OnInit {
  /**
   * True only when running inside the Electron desktop shell (see
   * frontend/main.js), never on the web build or native Android/iOS.
   */
  isElectron = false;

  constructor(
    private router: Router,
    private settings: UserSettingsService,
    private locationSvc: LocationService,
    private deepLink: DeepLinkService,
  ) {}

  ngOnInit() {
    this.isElectron = this.detectElectron();

    // Only apply persisted DOM settings (dark mode, reduce animations) when
    // the user is already logged in. This prevents dark mode from leaking
    // onto the login/register pages on cold start.
    const user = localStorage.getItem('user');
    if (user) {
      this.settings.applyToDom();
      this.locationSvc.start();
    } else {
      // Clean cold start (Login page): red header -> white window controls
      this.settings.syncElectronTitleBar(true);
    }

    // Sync window controls whenever navigating between routes
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const url = event.urlAfterRedirects || event.url || '';
      const isRedHeader = !url.startsWith('/admin');
      this.settings.syncElectronTitleBar(isRedHeader);
    });

    // Listens for widget/external-launch deep links (native only, no-op
    // elsewhere). Must be registered once at root so it's live regardless
    // of which page the app happens to cold-start on.
    this.deepLink.init();
  }

  /**
   * Detects the Electron desktop shell. With nodeIntegration: true in
   * main.js, `window.process.versions.electron` is injected directly into
   * the renderer — checked first since it can't false-positive. Falls back
   * to a User-Agent sniff (Electron always appends an "Electron/x.y.z"
   * token) in case that global is ever unavailable, so a browser or a
   * native mobile WebView can never both return true here.
   */
  private detectElectron(): boolean {
    const electronVersion = (window as unknown as { process?: { versions?: { electron?: string } } }).process?.versions?.electron;
    if (electronVersion) return true;
    return /electron/i.test(navigator.userAgent);
  }
}
