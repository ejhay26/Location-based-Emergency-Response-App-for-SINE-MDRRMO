import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TourOverlayComponent, AppDialogsComponent, AppTitlebarComponent } from './shared/components/index';
import { isTauri, isElectron } from './shared/utils/platform.util';
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
  isDesktop = false;

  constructor(
    private router: Router,
    private settings: UserSettingsService,
    private locationSvc: LocationService,
    private deepLink: DeepLinkService,
  ) {}

  ngOnInit() {
    this.isDesktop = isElectron() || isTauri();

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
}
