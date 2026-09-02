import { Injectable, signal, computed, Signal } from '@angular/core';

export interface LightboxMediaItem {
  url: string;
  isVideo: boolean;
}

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

  private resolveColor(color?: string): string {
    if (!color) return '#eb445a';
    const map: Record<string, string> = {
      danger:  '#eb445a',
      success: '#2dd36f',
      warning: '#ffc409',
      primary: '#3880ff',
      medium:  '#92949c',
      dark:    '#222428',
      light:   '#f4f5f8',
    };
    return map[color.toLowerCase()] ?? color;
  }

  /** Shows a themed confirm dialog; resolves true if the user confirmed, false if they dismissed it. */
  confirm(cfg: ConfirmDialogConfig): Promise<boolean> {
    // A dialog request arriving while one is already open shouldn't leave the
    // first caller's promise hanging forever — resolve it as "cancelled".
    this.resolver?.(false);
    this.confirmLoading.set(false);
    const resolvedConfirmColor = this.resolveColor(cfg.confirmColor);
    const resolvedIconColor    = this.resolveColor(cfg.iconColor);
    return new Promise<boolean>(resolve => {
      this.resolver = resolve;
      this.confirmDialog.set({
        ...CLOSED_STATE,
        ...cfg,
        confirmColor: resolvedConfirmColor,
        iconColor: resolvedIconColor,
        open: true
      });
    });
  }

  closingConfirm = signal(false);

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
    this.closingConfirm.set(true);
    await new Promise(r => setTimeout(r, 160));
    this.confirmDialog.update(d => ({ ...d, open: false }));
    this.closingConfirm.set(false);
    this.resolver?.(true);
    this.resolver = null;
  }

  async closeConfirm() {
    // Ignore Cancel/backdrop taps while an onConfirm action is in flight —
    // there's no safe way to "cancel" a logout request that's already been
    // sent to the server.
    if (this.confirmLoading()) return;
    this.closingConfirm.set(true);
    await new Promise(r => setTimeout(r, 160));
    this.confirmDialog.update(d => ({ ...d, open: false }));
    this.closingConfirm.set(false);
    this.resolver?.(false);
    this.resolver = null;
  }

  // ── Media lightbox ──────────────────────────────────────────────────────
  lightboxOpen  = signal(false);
  lightboxItems = signal<LightboxMediaItem[]>([]);
  lightboxIndex = signal(0);

  get lightboxUrl() {
    return computed(() => {
      const items = this.lightboxItems();
      const idx = this.lightboxIndex();
      return items[idx]?.url ?? '';
    });
  }

  get lightboxIsVideo() {
    return computed(() => {
      const items = this.lightboxItems();
      const idx = this.lightboxIndex();
      return items[idx]?.isVideo ?? false;
    });
  }

  get hasNextMedia(): boolean {
    return this.lightboxIndex() < this.lightboxItems().length - 1;
  }

  get hasPrevMedia(): boolean {
    return this.lightboxIndex() > 0;
  }

  get totalMediaCount(): number {
    return this.lightboxItems().length;
  }

  openLightbox(urlOrItems: string | string[] | LightboxMediaItem[], isVideoOrIndex: boolean | number = false, index = 0) {
    let items: LightboxMediaItem[] = [];
    let initialIndex = 0;

    if (Array.isArray(urlOrItems)) {
      items = urlOrItems.map(item => {
        if (typeof item === 'string') {
          const isVid = item.toLowerCase().endsWith('.mp4') || item.toLowerCase().endsWith('.webm');
          return { url: item, isVideo: isVid };
        }
        return item;
      });
      initialIndex = typeof isVideoOrIndex === 'number' ? isVideoOrIndex : index;
    } else if (typeof urlOrItems === 'string') {
      const isVid = typeof isVideoOrIndex === 'boolean' ? isVideoOrIndex : false;
      items = [{ url: urlOrItems, isVideo: isVid }];
      initialIndex = 0;
    }

    if (items.length === 0) return;
    this.lightboxItems.set(items);
    this.lightboxIndex.set(Math.max(0, Math.min(initialIndex, items.length - 1)));
    this.lightboxOpen.set(true);
  }

  setLightboxIndex(idx: number) {
    const total = this.lightboxItems().length;
    if (idx >= 0 && idx < total) {
      this.lightboxIndex.set(idx);
    }
  }

  nextLightboxItem() {
    this.setLightboxIndex(this.lightboxIndex() + 1);
  }

  prevLightboxItem() {
    this.setLightboxIndex(this.lightboxIndex() - 1);
  }

  closeLightbox() {
    this.lightboxOpen.set(false);
    this.lightboxItems.set([]);
    this.lightboxIndex.set(0);
  }
}
