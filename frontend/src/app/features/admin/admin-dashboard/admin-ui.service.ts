import { Injectable } from '@angular/core';
import { signal } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { ApiService } from '../../../core/services/api';

export interface ConfirmDialogConfig {
  title: string;
  message: string;
  icon: string;
  iconColor: string;
  confirmLabel: string;
  confirmColor: string;
  action: () => void;
}

/**
 * AdminUiService — cross-cutting UI concerns shared by every admin-dashboard
 * panel: the media lightbox, the confirm dialog, toasts, and the storage
 * proxy-URL / file-type helpers used throughout the old monolithic page.
 *
 * One instance, one lightbox, one confirm dialog — panels call these methods
 * instead of each owning a duplicate overlay.
 */
@Injectable({ providedIn: 'root' })
export class AdminUiService {

  constructor(private toastController: ToastController, private api: ApiService) {}

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

  // ── Confirm dialog ───────────────────────────────────────────────────────
  confirmDialog = signal<ConfirmDialogConfig & { open: boolean }>({
    open: false, title: '', message: '', icon: '', iconColor: '', confirmLabel: '', confirmColor: '', action: () => {}
  });

  showConfirm(cfg: ConfirmDialogConfig) {
    this.confirmDialog.set({ open: true, ...cfg });
  }
  runConfirm() {
    this.confirmDialog().action();
    this.confirmDialog.update(d => ({ ...d, open: false }));
  }
  closeConfirm() {
    this.confirmDialog.update(d => ({ ...d, open: false }));
  }

  // ── Toast ────────────────────────────────────────────────────────────────
  async showToast(msg: string, color = 'danger') {
    const toast = await this.toastController.create({ message: msg, duration: 3000, position: 'bottom', color });
    await toast.present();
  }

  // ── Barangay names ───────────────────────────────────────────────────────
  private barangayNames: Record<number, string> = {
    1: 'Alua', 2: 'Calaba', 3: 'Malapit', 4: 'Mangga', 5: 'Poblacion',
    6: 'Pulo', 7: 'San Roque', 8: 'Santo Cristo', 9: 'Tabon'
  };
  getBarangayName(id: number): string { return this.barangayNames[id] || `Barangay #${id}`; }

  // ── File / media helpers ─────────────────────────────────────────────────
  getProxyUrl(path: string | null | undefined): string {
    if (!path || path.trim() === '') return '';
    if (path.includes('ionicframework.com')) return '';
    if (path.startsWith('blob:') || path.startsWith('data:')) return path;
    try {
      const origin = this.api.apiOrigin;
      if (!origin) return '';
      let relative = path;
      if (/^https?:\/\//i.test(path)) {
        const match = path.match(/\/(storage\/.+)$/);
        if (!match) return '';
        relative = match[1];
      }
      const filePart = relative.replace(/^storage\//, '');
      return `${origin}/storage-proxy/${filePart}`;
    } catch { return ''; }
  }

  isVideoFile(path: string): boolean {
    return path?.toLowerCase().endsWith('.mp4') || path?.toLowerCase().endsWith('.webm');
  }

  getFilename(path: string): string {
    return path ? path.split('/').pop() || 'Unknown File' : 'No File Attachment';
  }
}
