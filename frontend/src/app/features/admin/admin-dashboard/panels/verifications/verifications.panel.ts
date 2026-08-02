import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonButton } from '@ionic/angular/standalone';
import { ApiService } from '../../../../../core/services/api';
import { AdminUiService } from '../../admin-ui.service';
import { ProxyImageDirective } from '../../../../../shared/directives/proxy-image.directive';

@Component({
  selector: 'app-verifications-panel',
  standalone: true,
  imports: [CommonModule, IonButton, ProxyImageDirective],
  templateUrl: './verifications.panel.html',
})
export class VerificationsPanel implements OnInit {

  pendingVerifications: any[] = [];

  constructor(public api: ApiService, public ui: AdminUiService) {}

  ngOnInit() {
    this.loadPendingVerifications();
  }

  loadPendingVerifications() {
    this.api.getPendingVerifications().subscribe((res: any) => { this.pendingVerifications = res; });
  }

  approveCitizen(userId: number) {
    this.ui.showConfirm({
      title: 'Approve Citizen',
      message: 'Approve this citizen? They will be able to submit reports.',
      icon: 'fa-solid fa-user-check', iconColor: '#2dd36f', confirmLabel: 'Approve', confirmColor: '#2dd36f',
      action: () => {
        this.api.approveUser({ user_id: userId }).subscribe({
          next: () => { this.ui.showToast('Citizen approved!', 'success'); this.loadPendingVerifications(); }
        });
      }
    });
  }

  rejectCitizen(userId: number) {
    this.ui.showConfirm({
      title: 'Deny Application',
      message: 'Deny this registration? They will need to register again.',
      icon: 'fa-solid fa-user-xmark', iconColor: '#eb445a', confirmLabel: 'Deny', confirmColor: '#eb445a',
      action: () => {
        this.api.rejectUser({ user_id: userId }).subscribe({
          next: () => { this.ui.showToast('Application denied.', 'medium'); this.loadPendingVerifications(); }
        });
      }
    });
  }
}
