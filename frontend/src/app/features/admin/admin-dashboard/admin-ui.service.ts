import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { ApiService } from '../../../core/services/api';
import { DialogService, ConfirmDialogConfig } from '../../../core/services/dialog.service';
import { BARANGAYS } from '../../../shared/constants/barangays';

export type { ConfirmDialogConfig };

/**
 * AdminUiService — cross-cutting UI concerns shared by every admin-dashboard
 * panel: the media lightbox, the confirm dialog, toasts, and the storage
 * proxy-URL / file-type helpers used throughout the old monolithic page.
 *
 * The confirm dialog and lightbox delegate to the app-wide DialogService
 * (rendered once by <app-dialogs> at the true app root) so admin shares the
 * exact same dialog implementation as the citizen and auth screens, rather
 * than owning a second copy. Panels' call sites (`ui.showConfirm({...})`,
 * `ui.openLightbox(...)`) are unchanged — only what backs them moved.
 */
@Injectable({ providedIn: 'root' })
export class AdminUiService {

  constructor(private toastController: ToastController, private api: ApiService, private dialog: DialogService) {}

  // ── Media lightbox (delegates to DialogService) ──────────────────────────
  get lightboxOpen()    { return this.dialog.lightboxOpen; }
  get lightboxUrl()     { return this.dialog.lightboxUrl; }
  get lightboxIsVideo() { return this.dialog.lightboxIsVideo; }

  openLightbox(urlOrItems: any, isVideoOrIndex: any = false, allMedia?: string[]) {
    if (allMedia && Array.isArray(allMedia) && allMedia.length > 0) {
      const items = allMedia.map(m => ({
        url: this.getProxyUrl(m),
        isVideo: this.isVideoFile(m)
      }));
      const idx = allMedia.indexOf(urlOrItems);
      this.dialog.openLightbox(items, Math.max(0, idx));
      return;
    }
    this.dialog.openLightbox(urlOrItems, isVideoOrIndex);
  }
  closeLightbox() { this.dialog.closeLightbox(); }

  // ── Confirm dialog (delegates to DialogService, action-callback flavor) ──
  showConfirm(cfg: ConfirmDialogConfig & { action: () => void }) {
    this.dialog.confirm(cfg).then(confirmed => { if (confirmed) cfg.action(); });
  }
  /** Passthrough to DialogService.confirm() for call sites that need the promise directly — e.g. to pass an `onConfirm` async action so the dialog itself shows the loading state instead of `action()` firing after the dialog has already closed. */
  confirm(cfg: ConfirmDialogConfig): Promise<boolean> {
    return this.dialog.confirm(cfg);
  }
  runConfirm()   { this.dialog.runConfirm(); }
  closeConfirm() { this.dialog.closeConfirm(); }

  // ── Toast ────────────────────────────────────────────────────────────────
  async showToast(msg: string, color = 'danger') {
    const toast = await this.toastController.create({ message: msg, duration: 3000, position: 'bottom', color });
    await toast.present();
  }

  // ── Barangay names ───────────────────────────────────────────────────────
  // Single source of truth is shared/constants/barangays.ts — mirrored here
  // only as a fast id→name lookup map so callers don't re-scan the array.
  // Keyed by string: array.reduce() (rather than Object.fromEntries(), which
  // needs an ES2019+ lib target this project's ES2018 tsconfig doesn't set).
  private barangayNames: Record<string, string> = BARANGAYS.reduce((map, b) => {
    map[String(b.id)] = b.name;
    return map;
  }, {} as Record<string, string>);
  getBarangayName(id: number): string { return this.barangayNames[id] || `Barangay #${id}`; }

  // ── File / media helpers ─────────────────────────────────────────────────
  getProxyUrl(path: string | null | undefined): string {
    return this.api.resolveFileUrl(path);
  }

  isVideoFile(path: string): boolean {
    return path?.toLowerCase().endsWith('.mp4') || path?.toLowerCase().endsWith('.webm');
  }

  getFilename(path: string): string {
    return path ? path.split('/').pop() || 'Unknown File' : 'No File Attachment';
  }
}
