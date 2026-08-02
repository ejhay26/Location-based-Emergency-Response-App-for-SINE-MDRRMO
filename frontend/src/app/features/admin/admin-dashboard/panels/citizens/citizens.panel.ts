import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonButton } from '@ionic/angular/standalone';
import { ApiService } from '../../../../../core/services/api';
import { AdminUiService } from '../../admin-ui.service';
import { ProxyImageDirective } from '../../../../../shared/directives/proxy-image.directive';
import { UtcDatePipe } from '../../../../../shared/pipes/utc-date.pipe';

/**
 * CitizensPanel — Accounts › Citizens. Search/filter over a card grid, plus
 * suspend/reactivate. Filtering is done client-side against the full list
 * (same as the original monolith) rather than round-tripping to the API's
 * getCitizens(filters) support, to keep behavior identical during atomization.
 */
@Component({
  selector: 'app-citizens-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, IonButton, ProxyImageDirective, UtcDatePipe],
  templateUrl: './citizens.panel.html',
})
export class CitizensPanel implements OnInit {

  citizens: any[] = [];
  citizenSearch = '';
  citizenFilterStatus: 'all' | 'active' | 'suspended' = 'all';

  constructor(public api: ApiService, public ui: AdminUiService) {}

  ngOnInit() {
    this.loadCitizens();
  }

  get filteredCitizens(): any[] {
    const search = this.citizenSearch.trim().toLowerCase();
    return this.citizens.filter(c => {
      const matchSearch = !search ||
        `${c.first_name} ${c.last_name} ${c.username} ${c.email} ${c.phone}`
          .toLowerCase().includes(search);
      const matchStatus = this.citizenFilterStatus === 'all' ||
        (this.citizenFilterStatus === 'suspended' ? c.account_status === 'banned' : c.account_status === 'active');
      return matchSearch && matchStatus;
    });
  }

  loadCitizens() {
    this.api.getCitizens().subscribe((res: any) => { this.citizens = res; });
  }

  suspendCitizen(citizen: any) {
    const isSuspended = citizen.account_status === 'banned';
    this.ui.showConfirm({
      title: `${isSuspended ? 'Reinstate' : 'Suspend'} Account`,
      message: isSuspended
        ? `Reinstate ${citizen.first_name} ${citizen.last_name}? They will regain full access.`
        : `Suspend ${citizen.first_name} ${citizen.last_name}? They will be locked out immediately.`,
      icon: isSuspended ? 'fa-solid fa-user-check' : 'fa-solid fa-user-slash',
      iconColor: isSuspended ? '#2dd36f' : '#eb445a',
      confirmLabel: isSuspended ? 'Reinstate' : 'Suspend',
      confirmColor: isSuspended ? '#2dd36f' : '#eb445a',
      action: () => {
        const call = isSuspended
          ? this.api.reactivateCitizen({ user_id: citizen.user_id })
          : this.api.suspendCitizen({ user_id: citizen.user_id });
        call.subscribe({
          next: () => { this.ui.showToast(isSuspended ? 'Account reinstated.' : 'Account suspended.', isSuspended ? 'success' : 'warning'); this.loadCitizens(); },
          error: () => this.ui.showToast('Action failed. Try again.', 'danger')
        });
      }
    });
  }
}
