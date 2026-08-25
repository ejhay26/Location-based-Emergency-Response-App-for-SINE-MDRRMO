import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonItem, IonInput, IonButton
} from '@ionic/angular/standalone';
import { ApiService } from '../../../../../core/services/api';
import { AdminUiService } from '../../admin-ui.service';
import { EchoService } from '../../../../../core/services/echo.service';
import { UtcDatePipe } from '../../../../../shared/pipes/utc-date.pipe';
import { ListEnterDirective } from '../../../../../shared/directives/list-enter.directive';
import { ProxyImageDirective } from '../../../../../shared/directives/proxy-image.directive';
import { BARANGAYS, Barangay } from '../../../../../shared/constants/barangays';
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';

/**
 * BroadcastPanel — send an alert either town-wide (no barangays selected)
 * or scoped to one or more specific barangays via the button multi-select.
 * Multiple broadcasts (town-wide and/or barangay-scoped) can be active at
 * once; each is listed and stopped individually.
 *
 * Real-time: subscribes to the Echo 'broadcasts' channel so the active
 * list updates instantly when any admin creates or clears an alert —
 * including from another browser session or the Electron admin dashboard.
 *
 * Both the Send Alert and Stop Alert actions go through a confirmation
 * dialog. The dialog's own Confirm button shows a loading spinner via
 * DialogService.onConfirm() — the HTTP call happens inside the dialog's
 * loading state, so there is no separate isBroadcasting / isStoppingId
 * flag needed; the dialog handles it.
 */
export interface BroadcastMediaItem {
  preview: string;
  type: 'image' | 'video';
  file?: File;
}

@Component({
  selector: 'app-broadcast-panel',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonItem, IonInput, IonButton,
    UtcDatePipe, ListEnterDirective, ProxyImageDirective, AppIconComponent
  ],
  templateUrl: './broadcast.panel.html',
})
export class BroadcastPanel implements OnInit, OnDestroy {

  barangays: readonly Barangay[] = BARANGAYS;

  broadcastForm = { title: '', message: '' };
  selectedMedia: BroadcastMediaItem[] = [];
  selectedBarangayIds: number[] = []; // empty = town-wide
  activeBroadcasts: any[] = [];

  private echoBroadcastSub?: Subscription;

  constructor(
    public api: ApiService,
    public ui: AdminUiService,
    private echo: EchoService,
  ) {}

  ngOnInit() {
    this.fetchBroadcasts();
    this.echo.connect();
    this.echoBroadcastSub = this.echo.onBroadcastUpdated.subscribe(() => {
      this.fetchBroadcasts();
    });
  }

  ngOnDestroy() {
    this.echoBroadcastSub?.unsubscribe();
  }

  get isTownWide(): boolean {
    return this.selectedBarangayIds.length === 0;
  }

  selectTownWide(): void {
    this.selectedBarangayIds = [];
  }

  toggleBarangay(id: number): void {
    const idx = this.selectedBarangayIds.indexOf(id);
    if (idx === -1) this.selectedBarangayIds.push(id);
    else this.selectedBarangayIds.splice(idx, 1);
  }

  isBarangaySelected(id: number): boolean {
    return this.selectedBarangayIds.includes(id);
  }

  fetchBroadcasts() {
    this.api.getActiveBroadcast().subscribe({
      next: (res: any) => { this.activeBroadcasts = Array.isArray(res) ? res : (res?.message ? [res] : []); },
      error: () => {}
    });
  }

  triggerFileInput(): void {
    if (this.selectedMedia.length >= 4) {
      this.ui.showToast('Maximum 4 media attachments allowed per announcement.', 'warning');
      return;
    }
    document.getElementById('broadcastMediaInput')?.click();
  }

  onFilesSelected(event: any): void {
    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'video/mp4'];
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB

    for (let i = 0; i < files.length; i++) {
      if (this.selectedMedia.length >= 4) {
        this.ui.showToast('Maximum 4 media attachments reached.', 'warning');
        break;
      }

      const file = files[i];
      if (!allowedTypes.includes(file.type.toLowerCase())) {
        this.ui.showToast(`"${file.name}" is not supported. Only PNG, JPEG, and MP4 files are allowed.`, 'danger');
        continue;
      }

      if (file.size > maxSizeBytes) {
        this.ui.showToast(`"${file.name}" exceeds the 10MB size limit.`, 'danger');
        continue;
      }

      const reader = new FileReader();
      const isVideo = file.type.toLowerCase().includes('video') || file.name.toLowerCase().endsWith('.mp4');
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          this.selectedMedia.push({
            preview: reader.result,
            type: isVideo ? 'video' : 'image',
            file
          });
        }
      };
      reader.readAsDataURL(file);
    }

    event.target.value = '';
  }

  removeMedia(index: number): void {
    this.selectedMedia.splice(index, 1);
  }

  /**
   * Opens a confirmation dialog before sending. The HTTP call is placed
   * inside `onConfirm` so the dialog's own Confirm button shows the loading
   * spinner for the full duration of the request — no separate flag needed.
   */
  confirmSubmitBroadcast() {
    if (!this.broadcastForm.message.trim()) return;

    const target = this.isTownWide
      ? 'every citizen in San Isidro'
      : `citizens in: ${this.selectedBarangayIds.map(id => this.barangays.find(b => b.id === id)?.name).join(', ')}`;

    const details: any[] = [
      { label: 'Target',  value: this.isTownWide ? 'Town-wide (all citizens)' : target, icon: 'map-pin' },
    ];

    if (this.broadcastForm.title.trim()) {
      details.push({ label: 'Title', value: this.broadcastForm.title.trim(), icon: 'file-text' });
    }

    details.push({ label: 'Message', value: this.broadcastForm.message.trim(), icon: 'message-square' });

    if (this.selectedMedia.length > 0) {
      details.push({ label: 'Attachments', value: `${this.selectedMedia.length} file(s) attached`, icon: 'paperclip' });
    }

    this.ui.confirm({
      title: 'Send Alert / Announcement',
      message: `This will immediately push an official notification and notice to ${target}. This cannot be unsent — only stopped.`,
      icon: 'broadcast',
      iconColor: '#eb445a',
      confirmLabel: 'Send Announcement',
      confirmColor: 'danger',
      details,
      onConfirm: () => new Promise<void>((resolve, reject) => {
        const payload: any = {
          title: this.broadcastForm.title.trim() || undefined,
          message: this.broadcastForm.message.trim(),
          media_files: this.selectedMedia.map(m => m.preview),
          ...(this.isTownWide ? {} : { barangay_ids: this.selectedBarangayIds }),
        };
        this.api.createBroadcast(payload).subscribe({
          next: () => {
            this.ui.showToast(
              this.isTownWide ? 'Announcement sent to all citizens!' : 'Announcement sent to selected barangay(s)!',
              'success',
            );
            this.broadcastForm.title   = '';
            this.broadcastForm.message = '';
            this.selectedMedia         = [];
            this.selectedBarangayIds   = [];
            this.fetchBroadcasts();
            resolve();
          },
          error: () => {
            this.ui.showToast('Failed to send announcement.', 'danger');
            reject();
          },
        });
      }),
    });
  }

  /**
   * Opens a confirmation dialog before stopping the alert. Same pattern —
   * the HTTP call lives inside `onConfirm` so the dialog button shows the
   * spinner for the full request duration.
   */
  endBroadcast(broadcast: any) {
    this.ui.confirm({
      title: 'Stop Alert',
      message: 'Citizens will immediately stop seeing this alert. This cannot be undone — you would need to send a new alert to notify them again.',
      icon: 'close',
      iconColor: '#eb445a',
      confirmLabel: 'Stop Alert',
      confirmColor: 'danger',
      details: [
        { label: 'Target',  value: broadcast.location,  icon: 'map-pin' },
        { label: 'Message', value: broadcast.message,   icon: 'message-square' },
      ],
      onConfirm: () => new Promise<void>((resolve, reject) => {
        this.api.clearBroadcast(broadcast.broadcast_id).subscribe({
          next: () => {
            this.ui.showToast('Alert stopped.', 'medium');
            this.fetchBroadcasts();
            resolve();
          },
          error: () => {
            this.ui.showToast('Failed to stop alert.', 'danger');
            reject();
          },
        });
      }),
    });
  }

  trackByBroadcastId(_index: number, b: any): number {
    return b.broadcast_id;
  }
}
