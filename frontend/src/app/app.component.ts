import { Component, OnInit, AfterViewInit, OnDestroy, isDevMode } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TourOverlayComponent, AppDialogsComponent, AppTitlebarComponent, QuickSearchPaletteComponent } from './shared/components/index';
import { isTauri, isMacDesktop } from './shared/utils/platform.util';
import { TourService } from './core/services/tour';
import { UserSettingsService } from './core/services/user-settings';
import { LocationService } from './core/services/location';
import { DeepLinkService } from './core/services/deep-link';
import { KeyboardShortcutsService } from './core/services/keyboard-shortcuts.service';
import { EchoService } from './core/services/echo.service';
import { AuthSessionService } from './core/services/auth-session.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  imports: [IonApp, IonRouterOutlet, TourOverlayComponent, AppDialogsComponent, AppTitlebarComponent, QuickSearchPaletteComponent],
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  isDesktop = false;
  isMac = false;
  private userVerifiedSub?: Subscription;

  constructor(
    private router: Router,
    public tour: TourService,
    private settings: UserSettingsService,
    private locationSvc: LocationService,
    private deepLink: DeepLinkService,
    private shortcuts: KeyboardShortcutsService,
    private echo: EchoService,
    private authSession: AuthSessionService,
  ) {}

  ngOnInit() {
    this.isDesktop = isTauri();
    this.isMac = isMacDesktop();

    // Initialize global keyboard shortcuts (desktop power keys, quick search, etc.)
    this.shortcuts.init();

    // Disable default browser context menu on production desktop builds
    if (this.isDesktop && !isDevMode()) {
      document.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    // Only apply persisted DOM settings (dark mode, reduce animations) and
    // initialize WebSocket connection when the user is already logged in.
    const user = localStorage.getItem('user');
    if (user) {
      this.settings.applyToDom();
      this.locationSvc.start();
      this.echo.connect();
    }

    // Single-device login enforcement listener:
    // When a citizen logs in on another device, backend broadcasts 'force-logout'
    // on the 'users' channel with the affected user_id.
    this.userVerifiedSub = this.echo.onUserVerified.subscribe((data) => {
      if (data?.action === 'force-logout') {
        const rawUser = localStorage.getItem('user');
        if (!rawUser) return;
        try {
          const currentUser = JSON.parse(rawUser);
          if (currentUser && Number(currentUser.user_id) === Number(data.user_id)) {
            void this.authSession.terminateSession(
              'Your account was logged in from another device. You have been signed out on this device.'
            );
          }
        } catch {
          // JSON parse error ignored
        }
      }
    });

    // Listens for widget/external-launch deep links (native only, no-op
    // elsewhere). Must be registered once at root so it's live regardless
    // of which page the app happens to cold-start on.
    this.deepLink.init();
  }

  ngOnDestroy() {
    this.userVerifiedSub?.unsubscribe();
  }

  ngAfterViewInit() {
    this.dismissSplash();
    if (this.isDesktop) {
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        const win = getCurrentWindow();
        win.show().catch((err) => console.warn('Tauri window show error:', err));
        win.setFocus().catch(() => {});
      }).catch((err) => console.warn('Tauri window module load error:', err));
    }
  }

  /**
   * Gracefully sweeps the first-paint splash curtain upward with an arched
   * bottom edge revealing the compiled dashboard underneath.
   */
  private dismissSplash() {
    if (typeof document === 'undefined') return;
    const splash = document.getElementById('sine-splash');
    if (!splash) return;

    const shouldAnimate = this.settings.shouldAnimate();
    if (!shouldAnimate) {
      splash.style.transition = 'opacity 200ms ease';
      splash.style.opacity = '0';
      setTimeout(() => splash.remove(), 220);
      return;
    }

    // Allow initial paint of the underlying view to settle before curtain lift
    setTimeout(() => {
      splash.classList.add('splash-dismiss');
      splash.addEventListener('animationend', () => {
        splash.remove();
      }, { once: true });
      setTimeout(() => splash.remove(), 1200);
    }, 280);
  }
}

