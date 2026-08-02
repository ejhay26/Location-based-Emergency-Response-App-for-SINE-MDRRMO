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

@Component({
  selector: 'app-broadcast-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonItem, IonInput, IonButton, UtcDatePipe],
  templateUrl: './broadcast.panel.html',
})
export class BroadcastPanel implements OnInit {

  broadcastForm  = { message: '' };
  recentBroadcast: any = null;
  isBroadcasting = false;

  constructor(public api: ApiService, public ui: AdminUiService) {}

  ngOnInit() {
    this.fetchBroadcast();
  }

  fetchBroadcast() {
    this.api.getActiveBroadcast().subscribe((res: any) => { this.recentBroadcast = (res && res.message) ? res : null; });
  }

  submitBroadcast() {
    if (!this.broadcastForm.message || this.isBroadcasting) return;
    this.isBroadcasting = true;
    this.api.createBroadcast(this.broadcastForm).subscribe({
      next: () => {
        this.isBroadcasting = false;
        this.ui.showToast('Alert sent to all citizens!', 'success');
        this.broadcastForm.message = '';
        this.fetchBroadcast();
      },
      error: () => { this.isBroadcasting = false; this.ui.showToast('Failed to send alert.', 'danger'); }
    });
  }

  endBroadcast() {
    this.ui.showConfirm({
      title: 'Stop Alert',
      message: 'Citizens will stop seeing this alert. Are you sure?',
      icon: 'fa-solid fa-circle-stop', iconColor: '#eb445a', confirmLabel: 'Stop Alert', confirmColor: '#eb445a',
      action: () => {
        this.api.clearBroadcast().subscribe({ next: () => { this.ui.showToast('Alert stopped.', 'medium'); this.fetchBroadcast(); } });
      }
    });
  }
}
