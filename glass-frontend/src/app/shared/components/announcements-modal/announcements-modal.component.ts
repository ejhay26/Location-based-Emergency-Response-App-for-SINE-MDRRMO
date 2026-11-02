import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton } from '@ionic/angular/standalone';
import { ModalController } from '@ionic/angular/standalone';
import { DialogService } from '../../../core/services/dialog.service';
import { ApiService } from '../../../core/services/api';
import { UtcDatePipe, parseServerDate } from '../../pipes/utc-date.pipe';
import { ProxyImageDirective } from '../../directives/proxy-image.directive';

import { AppIconComponent } from '../app-icon/app-icon.component';

@Component({
  selector: 'app-announcements-modal',
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, UtcDatePipe, ProxyImageDirective, AppIconComponent],
  templateUrl: './announcements-modal.component.html',
})
export class AnnouncementsModalComponent {
  @Input() broadcasts: any[] = [];

  private modalCtrl = inject(ModalController);
  private dialog = inject(DialogService);
  private api = inject(ApiService);

  dismiss(): void {
    this.modalCtrl.dismiss();
  }

  openMedia(path: string, isVideo = false, allMedia?: string[]): void {
    if (allMedia && Array.isArray(allMedia) && allMedia.length > 0) {
      const items = allMedia.map(m => ({
        url: this.getMediaUrl(m),
        isVideo: this.isVideoFile(m)
      }));
      const idx = allMedia.indexOf(path);
      this.dialog.openLightbox(items, Math.max(0, idx));
      return;
    }
    const url = this.getMediaUrl(path);
    this.dialog.openLightbox(url, isVideo);
  }

  isVideoFile(path: string): boolean {
    return path?.toLowerCase().endsWith('.mp4') || path?.toLowerCase().endsWith('.webm');
  }

  getMediaUrl(path: string): string {
    return this.api.resolveFileUrl(path);
  }

  timeAgo(dateStr: string): string {
    const date = parseServerDate(dateStr);
    if (!date) return '';
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  trackById(_index: number, item: any): number {
    return item.broadcast_id;
  }
}
