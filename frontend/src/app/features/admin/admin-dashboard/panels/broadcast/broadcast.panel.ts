import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  IonItem, IonInput, IonButton,
  IonSelect, IonSelectOption,
  IonSegment, IonSegmentButton, IonLabel
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
    IonSelect, IonSelectOption,
    IonSegment, IonSegmentButton, IonLabel,
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
  scheduledBroadcasts: any[] = [];
  archivedBroadcasts: any[] = [];

  // Collapsible section states
  showActiveSection = true;
  showScheduledSection = true;
  showArchivedSection = false;

  // Post Scheduling
  isScheduled = false;
  scheduledDateTime = '';

  months = [
    { value: '01', label: 'Jan' }, { value: '02', label: 'Feb' },
    { value: '03', label: 'Mar' }, { value: '04', label: 'Apr' },
    { value: '05', label: 'May' }, { value: '06', label: 'Jun' },
    { value: '07', label: 'Jul' }, { value: '08', label: 'Aug' },
    { value: '09', label: 'Sep' }, { value: '10', label: 'Oct' },
    { value: '11', label: 'Nov' }, { value: '12', label: 'Dec' },
  ];

  schedMonth = '';
  schedDay = '';
  schedYear = '';
  schedHour = '09';
  schedMinute = '00';
  schedPeriod = 'AM';

  hours = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  minutes = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

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

  get selectedBarangayNames(): string {
    return this.selectedBarangayIds
      .map(id => this.barangays.find(b => b.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  }

  get scheduledYears(): string[] {
    const y = new Date().getFullYear();
    return [String(y), String(y + 1)];
  }

  get daysInSchedMonth(): number[] {
    const month = parseInt(this.schedMonth, 10) || 1;
    const year = parseInt(this.schedYear, 10) || new Date().getFullYear();
    const daysCount = new Date(year, month, 0).getDate();
    return Array.from({ length: daysCount }, (_, i) => i + 1);
  }

  deliveryMode: 'immediate' | 'scheduled' = 'immediate';

  onDeliveryModeChange(ev?: any): void {
    const val = ev?.detail?.value || this.deliveryMode;
    this.deliveryMode = val;
    this.setScheduledMode(val === 'scheduled');
  }

  setScheduledMode(enable: boolean): void {
    this.isScheduled = enable;
    this.deliveryMode = enable ? 'scheduled' : 'immediate';
    if (enable) {
      if (!this.schedYear) {
        this.initScheduledDateTime();
      } else {
        this.autoCorrectIfPast(false);
      }
    } else {
      this.scheduledDateTime = '';
    }
  }

  initScheduledDateTime(): void {
    const target = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    this.schedYear = String(target.getFullYear());
    this.schedMonth = String(target.getMonth() + 1).padStart(2, '0');
    this.schedDay = String(target.getDate());
    let h = target.getHours();
    this.schedPeriod = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    this.schedHour = String(h).padStart(2, '0');
    this.schedMinute = '00';
    this.updateScheduledDateTime();
  }

  autoCorrectIfPast(notify = false): boolean {
    if (!this.isScheduled) return true;
    this.updateScheduledDateTime();
    if (!this.scheduledDateTime) return true;

    const scheduledTime = new Date(this.scheduledDateTime).getTime();
    const now = Date.now();

    // If the scheduled time is in the past or within 1 minute of current time
    if (isNaN(scheduledTime) || scheduledTime <= now) {
      const corrected = new Date(now + 10 * 60 * 1000); // Set to +10 mins
      this.schedYear = String(corrected.getFullYear());
      this.schedMonth = String(corrected.getMonth() + 1).padStart(2, '0');
      this.schedDay = String(corrected.getDate());
      let h = corrected.getHours();
      this.schedPeriod = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      this.schedHour = String(h).padStart(2, '0');
      const m = Math.ceil(corrected.getMinutes() / 5) * 5;
      this.schedMinute = String(m >= 60 ? 55 : m).padStart(2, '0');
      this.updateScheduledDateTime();

      if (notify) {
        this.ui.showToast(
          `Selected time was in the past. We automatically adjusted it to ${this.formattedSchedulePreview} (+10 mins).`,
          'secondary'
        );
      }
      return false;
    }
    return true;
  }

  updateScheduledDateTime(): void {
    if (!this.schedYear || !this.schedMonth || !this.schedDay) {
      this.scheduledDateTime = '';
      return;
    }
    let hour24 = parseInt(this.schedHour, 10);
    if (this.schedPeriod === 'PM' && hour24 < 12) hour24 += 12;
    if (this.schedPeriod === 'AM' && hour24 === 12) hour24 = 0;
    const hourStr = String(hour24).padStart(2, '0');
    const dayStr = String(this.schedDay).padStart(2, '0');
    this.scheduledDateTime = `${this.schedYear}-${this.schedMonth}-${dayStr}T${hourStr}:${this.schedMinute}`;
  }

  get formattedSchedulePreview(): string {
    if (!this.schedYear || !this.schedMonth || !this.schedDay) return '';
    let hour24 = parseInt(this.schedHour, 10);
    if (this.schedPeriod === 'PM' && hour24 < 12) hour24 += 12;
    if (this.schedPeriod === 'AM' && hour24 === 12) hour24 = 0;
    const hourStr = String(hour24).padStart(2, '0');
    const dayStr = String(this.schedDay).padStart(2, '0');
    const dateObj = new Date(`${this.schedYear}-${this.schedMonth}-${dayStr}T${hourStr}:${this.schedMinute}:00`);
    if (isNaN(dateObj.getTime())) return '';
    return dateObj.toLocaleString([], {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  get isPastScheduleTime(): boolean {
    if (!this.isScheduled || !this.scheduledDateTime) return false;
    const target = new Date(this.scheduledDateTime).getTime();
    return !isNaN(target) && target <= Date.now();
  }

  timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  fetchBroadcasts() {
    this.api.getActiveBroadcast().subscribe({
      next: (res: any) => {
        if (res && typeof res === 'object' && !Array.isArray(res)) {
          this.activeBroadcasts    = res.active || [];
          this.scheduledBroadcasts = res.scheduled || [];
          this.archivedBroadcasts  = res.archived || [];
        } else if (Array.isArray(res)) {
          this.activeBroadcasts    = res;
          this.scheduledBroadcasts = [];
          this.archivedBroadcasts  = [];
        }
      },
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

    if (this.isScheduled) {
      this.updateScheduledDateTime();
      if (!this.scheduledDateTime) {
        this.ui.showToast('Please select a release date and time for the scheduled announcement.', 'warning');
        return;
      }
      if (this.isPastScheduleTime) {
        this.ui.showToast('The selected date and time is in the past. Please choose a future time.', 'warning');
        return;
      }
    }

    const target = this.isTownWide
      ? 'every citizen in San Isidro'
      : `citizens in: ${this.selectedBarangayIds.map(id => this.barangays.find(b => b.id === id)?.name).join(', ')}`;

    const details: any[] = [
      { label: 'Target',  value: this.isTownWide ? 'Town-wide (all citizens)' : target, icon: 'map-pin' },
    ];

    if (this.isScheduled) {
      const scheduledFormatted = new Date(this.scheduledDateTime).toLocaleString([], {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      details.push({ label: 'Scheduled For', value: scheduledFormatted, icon: 'calendar-clock' });
    }

    if (this.broadcastForm.title.trim()) {
      details.push({ label: 'Title', value: this.broadcastForm.title.trim(), icon: 'file-text' });
    }

    details.push({ label: 'Message', value: this.broadcastForm.message.trim(), icon: 'message-square' });

    if (this.selectedMedia.length > 0) {
      details.push({ label: 'Attachments', value: `${this.selectedMedia.length} file(s) attached`, icon: 'paperclip' });
    }

    this.ui.confirm({
      title: this.isScheduled ? 'Schedule Alert / Announcement' : 'Send Alert / Announcement',
      message: this.isScheduled
        ? `This announcement will be automatically released to ${target} at the scheduled time.`
        : `This will immediately push an official notification and notice to ${target}. This cannot be unsent — only stopped.`,
      icon: this.isScheduled ? 'calendar-clock' : 'broadcast',
      iconColor: '#eb445a',
      confirmLabel: this.isScheduled ? 'Schedule Announcement' : 'Send Announcement',
      confirmColor: 'danger',
      details,
      onConfirm: () => new Promise<void>((resolve, reject) => {
        const payload: any = {
          title: this.broadcastForm.title.trim() || undefined,
          message: this.broadcastForm.message.trim(),
          media_files: this.selectedMedia.map(m => m.preview),
          ...(this.isTownWide ? {} : { barangay_ids: this.selectedBarangayIds }),
          ...(this.isScheduled ? { scheduled_at: this.scheduledDateTime } : {}),
        };
        this.api.createBroadcast(payload).subscribe({
          next: (res: any) => {
            this.ui.showToast(
              res?.message || (this.isScheduled ? 'Announcement scheduled!' : 'Announcement sent!'),
              'success',
            );
            this.broadcastForm.title   = '';
            this.broadcastForm.message = '';
            this.selectedMedia         = [];
            this.selectedBarangayIds   = [];
            this.isScheduled           = false;
            this.scheduledDateTime     = '';
            this.schedYear             = '';
            this.schedMonth            = '';
            this.schedDay              = '';
            this.fetchBroadcasts();
            resolve();
          },
          error: (err: any) => {
            this.ui.showToast(err?.error?.message || 'Failed to send announcement.', 'danger');
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
