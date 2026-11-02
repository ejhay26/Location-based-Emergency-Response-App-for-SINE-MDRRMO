import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  ModalController,
  PopoverController,
  AlertController,
  LoadingController,
  ActionSheetController,
  MenuController,
} from '@ionic/angular/standalone';
import { DialogService } from './dialog.service';
import { ToastService } from './toast.service';
import { LocationService } from './location';
import { UserSettingsService } from './user-settings';
import { PushNotificationsService } from './push-notifications';
import { ImageCacheService } from './image-cache';
import { EchoService } from './echo.service';
import { ApiService } from './api';

export interface TerminateSessionOptions {
  draftPayload?: any;
}

/**
 * AuthSessionService — Centralized session teardown and overlay cleanup routine.
 * Handles force-logout events (e.g. duplicate citizen login on another device),
 * HTTP 401 session expirations, and manual logouts.
 *
 * Ensures all Ionic overlays (modals, popovers, alerts, loaders, action sheets)
 * and root dialogs (confirm modals, lightbox) are cleanly dismissed so no orphaned
 * components survive over the login screen.
 */
@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private router = inject(Router);
  private modalCtrl = inject(ModalController);
  private popoverCtrl = inject(PopoverController);
  private alertCtrl = inject(AlertController);
  private loadingCtrl = inject(LoadingController);
  private actionSheetCtrl = inject(ActionSheetController);
  private menuCtrl = inject(MenuController);
  private dialog = inject(DialogService);
  private toast = inject(ToastService);
  private locationSvc = inject(LocationService);
  private settings = inject(UserSettingsService);
  private pushNotifications = inject(PushNotificationsService);
  private imageCache = inject(ImageCacheService);
  private echo = inject(EchoService);
  private api = inject(ApiService);

  private isTerminating = false;

  get isTerminatingSession(): boolean {
    return this.isTerminating;
  }

  /**
   * Systematically dismisses every active overlay element.
   * Traverses all Ionic overlay controllers via loop and applies a DOM-level sweep
   * to catch any inline or detached overlays.
   */
  async dismissAllOverlays(): Promise<void> {
    const dismissAllFromCtrl = async (ctrl: any) => {
      try {
        let top = await ctrl.getTop();
        let limit = 25;
        while (top && limit-- > 0) {
          await ctrl.dismiss(null, 'force-logout').catch(() => {});
          top = await ctrl.getTop();
        }
      } catch {
        // Overlay dismiss error ignored
      }
    };

    await dismissAllFromCtrl(this.modalCtrl);
    await dismissAllFromCtrl(this.popoverCtrl);
    await dismissAllFromCtrl(this.alertCtrl);
    await dismissAllFromCtrl(this.loadingCtrl);
    await dismissAllFromCtrl(this.actionSheetCtrl);

    try {
      await this.menuCtrl.close();
    } catch {
      // Menu close error ignored
    }

    // Dismiss root confirm dialog and lightbox
    this.dialog.dismissAll();

    // DOM fallback for any stray Ionic overlay custom elements
    if (typeof document !== 'undefined') {
      const openOverlays = document.querySelectorAll(
        'ion-modal, ion-popover, ion-alert, ion-loading, ion-action-sheet'
      );
      for (const overlay of Array.from(openOverlays)) {
        try {
          if (typeof (overlay as any).dismiss === 'function') {
            await (overlay as any).dismiss(null, 'force-logout').catch(() => {});
          }
        } catch {
          // Fallback dismiss ignored
        }
      }
    }
  }

  /**
   * Terminates the current authenticated session:
   * 1. Preserves draft data if supplied.
   * 2. Dismisses all active overlays.
   * 3. Unregisters push notifications and hardware trackers.
   * 4. Clears cached data and auth tokens.
   * 5. Navigates to /login with replaceUrl.
   * 6. Displays an informative toast to the user.
   */
  async terminateSession(reason: string, options?: TerminateSessionOptions): Promise<void> {
    if (this.isTerminating) return;
    this.isTerminating = true;

    try {
      // 1. Preserve draft payload if provided
      if (options?.draftPayload) {
        try {
          sessionStorage.setItem('pending_report_draft', JSON.stringify(options.draftPayload));
        } catch {
          try {
            const stripped = { ...options.draftPayload, mediaFiles: [] };
            sessionStorage.setItem('pending_report_draft', JSON.stringify(stripped));
          } catch {
            // Storage quota error ignored
          }
        }
      }

      // 2. Dismiss all overlays across the app
      await this.dismissAllOverlays();

      // 3. Unregister push tokens and stop hardware sensors
      try {
        await this.pushNotifications.unregisterPush();
      } catch {
        // Unregister push error ignored
      }

      this.locationSvc.stop();
      this.settings.clear();
      this.imageCache.clear();
      this.echo.disconnect();
      this.api.clearToken();

      // 4. Remove local auth records
      localStorage.removeItem('api_token');
      localStorage.removeItem('user');
      localStorage.removeItem('role');

      // 5. Reset DOM theme attributes
      if (typeof document !== 'undefined') {
        document.documentElement.classList.remove('ion-palette-dark');
        document.documentElement.classList.remove('reduce-animations');
      }

      // 6. Redirect to login
      await this.router.navigate(['/login'], { replaceUrl: true });

      // 7. Surface informative toast message
      if (reason) {
        this.toast.show({
          message: reason,
          duration: 5000,
          position: 'top',
          color: 'warning',
        });
      }
    } finally {
      setTimeout(() => {
        this.isTerminating = false;
      }, 500);
    }
  }
}
