import { Injectable, inject, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import {
  ModalController,
  AlertController,
  ActionSheetController,
  PopoverController,
} from '@ionic/angular/standalone';
import { DialogService } from './dialog.service';
import { TourService } from './tour';
import { KeyboardShortcutsService } from './keyboard-shortcuts.service';

@Injectable({
  providedIn: 'root',
})
export class BackNavigationService implements OnDestroy {
  private location = inject(Location);
  private router = inject(Router);
  private modalCtrl = inject(ModalController);
  private alertCtrl = inject(AlertController);
  private actionSheetCtrl = inject(ActionSheetController);
  private popoverCtrl = inject(PopoverController);
  private dialog = inject(DialogService);
  private tour = inject(TourService);
  private shortcuts = inject(KeyboardShortcutsService);

  private sub?: Subscription;
  private isInitialized = false;

  init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Android Hardware Back Button & Predictive Back Gesture (Capacitor Native)
    if (Capacitor.isNativePlatform()) {
      App.addListener('backButton', async ({ canGoBack }) => {
        const overlayDismissed = await this.dismissTopOverlay();
        if (overlayDismissed) return;

        if (canGoBack) {
          this.location.back();
        } else {
          try {
            await App.exitApp();
          } catch {
            // Ignored on non-supporting devices
          }
        }
      }).catch(() => {});
    }

    // 2. Desktop Keyboard Shortcuts & Escape Dispatcher
    this.sub = this.shortcuts.backAction$.subscribe(async (action) => {
      if (action === 'back') {
        const overlayDismissed = await this.dismissTopOverlay();
        if (!overlayDismissed) {
          this.location.back();
        }
      } else if (action === 'forward') {
        this.location.forward();
      } else if (action === 'escape') {
        await this.dismissTopOverlay();
      }
    });

    // 3. Fallback for Web/PWA popstate navigation
    window.addEventListener('popstate', () => {
      void this.dismissTopOverlay();
    });
  }

  /**
   * Dismiss the topmost open modal, dialog, alert, or overlay across the application.
   * Returns true if an overlay was dismissed, false if none were active.
   */
  async dismissTopOverlay(): Promise<boolean> {
    // 1. Fullscreen Lightbox
    if (this.dialog.lightboxOpen()) {
      this.dialog.closeLightbox();
      return true;
    }

    // 2. App-wide Confirm Dialog
    if (this.dialog.confirmDialog().open) {
      await this.dialog.closeConfirm();
      return true;
    }

    // 3. Quick Search Palette
    if (this.shortcuts.isQuickSearchOpen()) {
      this.shortcuts.closeQuickSearch();
      return true;
    }

    // 4. Guided Tour Overlay
    if (this.tour.isActive()) {
      this.tour.cancel();
      return true;
    }

    // 5. Ionic Overlays via Controllers
    try {
      const topAlert = await this.alertCtrl.getTop();
      if (topAlert) {
        await topAlert.dismiss();
        return true;
      }
    } catch {}

    try {
      const topActionSheet = await this.actionSheetCtrl.getTop();
      if (topActionSheet) {
        await topActionSheet.dismiss();
        return true;
      }
    } catch {}

    try {
      const topPopover = await this.popoverCtrl.getTop();
      if (topPopover) {
        await topPopover.dismiss();
        return true;
      }
    } catch {}

    try {
      const topModal = await this.modalCtrl.getTop();
      if (topModal) {
        await topModal.dismiss();
        return true;
      }
    } catch {}

    // 6. Inline / declarative Ionic Modals and Overlays in DOM
    const openModals = Array.from(
      document.querySelectorAll<HTMLElement>('ion-modal, ion-alert, ion-action-sheet, ion-popover')
    ).filter(
      (el) =>
        !el.classList.contains('overlay-hidden') &&
        (el.classList.contains('show-modal') || (el as any).isOpen)
    );

    if (openModals.length > 0) {
      const top = openModals[openModals.length - 1];
      if (typeof (top as any).dismiss === 'function') {
        await (top as any).dismiss();
        return true;
      }
    }

    return false;
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
