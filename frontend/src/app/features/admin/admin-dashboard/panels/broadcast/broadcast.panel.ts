import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  IonItem, IonInput, IonButton
} from '@ionic/angular/standalone';
import { ApiService } from '../../../../../core/services/api';
import { AdminUiService } from '../../admin-ui.service';
import { UtcDatePipe } from '../../../../../shared/pipes/utc-date.pipe';
import { BARANGAYS, Barangay } from '../../../../../shared/constants/barangays';

/**
 * BroadcastPanel — send an alert either town-wide (no barangays selected)
 * or scoped to one or more specific barangays via the button multi-select.
 * Multiple broadcasts (town-wide and/or barangay-scoped) can be active at
 * once; each is listed and stopped individually.
 */
@Component({
  selector: 'app-broadcast-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonItem, IonInput, IonButton, UtcDatePipe],
  templateUrl: './broadcast.panel.html',
})
export class BroadcastPanel implements OnInit {

  barangays: readonly Barangay[] = BARANGAYS;

  broadcastForm  = { message: '' };
  selectedBarangayIds: number[] = []; // empty = town-wide
  activeBroadcasts: any[] = [];
  isBroadcasting = false;

  constructor(public api: ApiService, public ui: AdminUiService) {}

  ngOnInit() {
    this.fetchBroadcasts();
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

  submitBroadcast() {
    if (!this.broadcastForm.message || this.isBroadcasting) return;
    this.isBroadcasting = true;
    const payload = {
      message: this.broadcastForm.message,
      ...(this.isTownWide ? {} : { barangay_ids: this.selectedBarangayIds }),
    };
    this.api.createBroadcast(payload).subscribe({
      next: () => {
        this.isBroadcasting = false;
        this.ui.showToast(this.isTownWide ? 'Alert sent to all citizens!' : 'Alert sent to selected barangay(s)!', 'success');
        this.broadcastForm.message = '';
        this.selectedBarangayIds = [];
        this.fetchBroadcasts();
      },
      error: () => { this.isBroadcasting = false; this.ui.showToast('Failed to send alert.', 'danger'); }
    });
  }

  endBroadcast(broadcast: any) {
    this.ui.showConfirm({
      title: 'Stop Alert',
      message: 'Citizens will stop seeing this alert. Are you sure?',
      icon: 'fa-solid fa-circle-stop', iconColor: '#eb445a', confirmLabel: 'Stop Alert', confirmColor: '#eb445a',
      action: () => {
        this.api.clearBroadcast(broadcast.broadcast_id).subscribe({
          next: () => { this.ui.showToast('Alert stopped.', 'medium'); this.fetchBroadcasts(); }
        });
      }
    });
  }
}
