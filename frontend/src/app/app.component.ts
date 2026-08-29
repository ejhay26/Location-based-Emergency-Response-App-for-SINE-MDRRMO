import { Component, OnInit, isDevMode } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TourOverlayComponent, AppDialogsComponent, AppTitlebarComponent } from './shared/components/index';
import { isTauri } from './shared/utils/platform.util';
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
    this.isDesktop = isTauri();

    // Disable default browser context menu on production desktop builds
    if (this.isDesktop && !isDevMode()) {
      document.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // Only apply persisted DOM settings (dark mode, reduce animations) when
    // the user is already logged in. This prevents dark mode from leaking
    // onto the login/register pages on cold start.
    const user = localStorage.getItem('user');
    if (user) {
      this.settings.applyToDom();
      this.locationSvc.start();
    }

    // Listens for widget/external-launch deep links (native only, no-op
    // elsewhere). Must be registered once at root so it's live regardless
    // of which page the app happens to cold-start on.
    this.deepLink.init();
  }
}
