import { Injectable, signal } from '@angular/core';

/** Configuration for a themed confirm dialog (shared app-wide — citizen, auth, and admin). */
export interface ConfirmDialogConfig {
  title: string;
  message: string;
  icon: string;
  iconColor: string;
  confirmLabel: string;
  confirmColor: string;
  cancelLabel?: string;
}

type ConfirmDialogState = ConfirmDialogConfig & { open: boolean };

const CLOSED_STATE: ConfirmDialogState = {
  open: false, title: '', message: '', icon: '', iconColor: '',
  confirmLabel: '', confirmColor: '', cancelLabel: 'Cancel',
};

/**
 * DialogService — the single, app-wide source of themed confirm dialogs and
 * the media lightbox, rendered once by <app-dialogs> at the true app root
 * (see app.component.html) so every screen — citizen tabs, auth flow, and
 * the admin dashboard — shares one implementation instead of each owning
 * native ion-alerts or a duplicate overlay.
 *
 * `confirm()` is Promise-based (`if (await dialog.confirm({...}))`), which
 * is the natural shape for "ask, then branch" call sites. AdminUiService
 * additionally exposes an action-callback style (`showConfirm({..., action})`)
 * for its existing panels — that flavor delegates to this same service so
 * there is exactly one dialog implementation underneath both APIs.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {

  confirmDialog = signal<ConfirmDialogState>(CLOSED_STATE);
  private resolver: ((confirmed: boolean) => void) | null = null;

  /** Shows a themed confirm dialog; resolves true if the user confirmed, false if they dismissed it. */
  confirm(cfg: ConfirmDialogConfig): Promise<boolean> {
    // A dialog request arriving while one is already open shouldn't leave the
    // first caller's promise hanging forever — resolve it as "cancelled".
    this.resolver?.(false);
    return new Promise<boolean>(resolve => {
      this.resolver = resolve;
      this.confirmDialog.set({ ...CLOSED_STATE, ...cfg, open: true });
    });
  }

  runConfirm() {
    this.confirmDialog.update(d => ({ ...d, open: false }));
    this.resolver?.(true);
    this.resolver = null;
  }

  closeConfirm() {
    this.confirmDialog.update(d => ({ ...d, open: false }));
    this.resolver?.(false);
    this.resolver = null;
  }

  // ── Media lightbox ──────────────────────────────────────────────────────
  lightboxOpen    = signal(false);
  lightboxUrl     = signal('');
  lightboxIsVideo = signal(false);

  openLightbox(url: string, isVideo: boolean) {
    this.lightboxUrl.set(url);
    this.lightboxIsVideo.set(isVideo);
    this.lightboxOpen.set(true);
  }
  closeLightbox() {
    this.lightboxOpen.set(false);
    this.lightboxUrl.set('');
    this.lightboxIsVideo.set(false);
  }
}
