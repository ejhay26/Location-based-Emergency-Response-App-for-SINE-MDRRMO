import { Injectable, signal } from '@angular/core';

/** One label/value row shown in a confirm dialog's optional details summary (e.g. "Type: Fire", "Photos: 2"). */
export interface ConfirmDialogDetail {
  label: string;
  value: string;
  icon?: string;
}

/** Configuration for a themed confirm dialog (shared app-wide — citizen, auth, and admin). */
export interface ConfirmDialogConfig {
  title: string;
  message: string;
  icon: string;
  iconColor: string;
  confirmLabel: string;
  confirmColor: string;
  cancelLabel?: string;
  /** Optional "here's what you're about to submit" summary rows, rendered between the message and the action buttons. */
  details?: ConfirmDialogDetail[];
  /**
   * Optional async action to run when the user taps Confirm. When present,
   * the dialog stays open and its Confirm button shows a loading spinner
   * until this resolves/rejects, then the dialog closes and confirm()'s
   * promise resolves true — so the loading state lives in the confirm
   * dialog itself rather than in whatever button originally opened it.
   * When omitted, the dialog closes immediately on Confirm (unchanged
   * behavior for every other confirm() call site in the app).
   */
  onConfirm?: () => Promise<void>;
}

type ConfirmDialogState = ConfirmDialogConfig & { open: boolean };

const CLOSED_STATE: ConfirmDialogState = {
  open: false, title: '', message: '', icon: '', iconColor: '',
  confirmLabel: '', confirmColor: '', cancelLabel: 'Cancel', details: undefined,
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
  /** True while a confirmed dialog's onConfirm() is in flight — drives the Confirm button's spinner and blocks the Cancel/backdrop-close path so an in-flight action (e.g. logout) can't be interrupted mid-request. */
  confirmLoading = signal(false);
  private resolver: ((confirmed: boolean) => void) | null = null;

  /** Shows a themed confirm dialog; resolves true if the user confirmed, false if they dismissed it. */
  confirm(cfg: ConfirmDialogConfig): Promise<boolean> {
    // A dialog request arriving while one is already open shouldn't leave the
    // first caller's promise hanging forever — resolve it as "cancelled".
    this.resolver?.(false);
    this.confirmLoading.set(false);
    return new Promise<boolean>(resolve => {
      this.resolver = resolve;
      this.confirmDialog.set({ ...CLOSED_STATE, ...cfg, open: true });
    });
  }

  /**
   * Tapping Confirm. If the config carries an `onConfirm` async action, the
   * dialog stays open with the Confirm button showing a spinner until it
   * settles, then closes; otherwise behaves exactly as before (immediate
   * close + resolve).
   */
  async runConfirm() {
    const cfg = this.confirmDialog();
    if (cfg.onConfirm) {
      this.confirmLoading.set(true);
      try {
        await cfg.onConfirm();
      } finally {
        this.confirmLoading.set(false);
      }
    }
    this.confirmDialog.update(d => ({ ...d, open: false }));
    this.resolver?.(true);
    this.resolver = null;
  }

  closeConfirm() {
    // Ignore Cancel/backdrop taps while an onConfirm action is in flight —
    // there's no safe way to "cancel" a logout request that's already been
    // sent to the server.
    if (this.confirmLoading()) return;
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
