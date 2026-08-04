import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonButton, IonItem, IonInput, IonSelect, IonSelectOption,
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonContent
} from '@ionic/angular/standalone';
import { ApiService } from '../../../../../core/services/api';
import { AdminUiService } from '../../admin-ui.service';
import { ProxyImageDirective } from '../../../../../shared/directives/proxy-image.directive';
import { BARANGAYS } from '../../../../../shared/constants/barangays';
import { DateRangeFilterComponent } from '../../../../../shared/components/date-range-filter/date-range-filter.component';
import { FilterSummaryBarComponent } from '../../../../../shared/components/filter-summary-bar/filter-summary-bar.component';
import { DateFilterValue, matchesDateFilter, formatDateFilterLabel } from '../../../../../shared/utils/date-filter.util';

interface DispatcherForm {
  first_name: string;
  last_name: string;
  phone: string;
  username: string;
  email: string;
  password: string;
  barangay_id: number | null;
}

/**
 * DispatchersPanel — Accounts › Dispatchers. Card grid + self-contained
 * add/edit modal, mirroring how the dispatch modal lives inside
 * IncidentMapPanel rather than the shell.
 */
@Component({
  selector: 'app-dispatchers-panel',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonButton, IonItem, IonInput, IonSelect, IonSelectOption,
    IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonContent,
    ProxyImageDirective, DateRangeFilterComponent, FilterSummaryBarComponent,
  ],
  templateUrl: './dispatchers.panel.html',
})
export class DispatchersPanel implements OnInit {

  dispatchers: any[] = [];

  dispatcherSearch = '';
  dispatcherBarangayFilter: number | 'all' = 'all';
  dispatcherDateFilter: DateFilterValue | null = null;

  readonly barangays = BARANGAYS;

  isDispatcherModalOpen = false;
  isSavingDispatcher = false;
  editingDispatcher: any = null;
  dispatcherForm: DispatcherForm = {
    first_name: '', last_name: '', phone: '', username: '', email: '', password: '', barangay_id: null
  };

  constructor(public api: ApiService, public ui: AdminUiService) {}

  ngOnInit() {
    this.loadDispatchers();
  }

  loadDispatchers() {
    this.api.getDispatchers().subscribe((res: any) => { this.dispatchers = res; });
  }

  get filteredDispatchers(): any[] {
    const search = this.dispatcherSearch.trim().toLowerCase();
    return this.dispatchers.filter(d => {
      const matchSearch = !search ||
        `${d.first_name} ${d.last_name} ${d.username} ${d.email} ${d.phone}`
          .toLowerCase().includes(search);
      const matchBarangay = this.dispatcherBarangayFilter === 'all' || d.barangay_id === this.dispatcherBarangayFilter;
      const matchDate = matchesDateFilter(d.created_at, this.dispatcherDateFilter);
      return matchSearch && matchBarangay && matchDate;
    });
  }

  /** Chip labels for the active-filters summary bar; empty array hides the bar. */
  get activeFilterChips(): string[] {
    const chips: string[] = [];
    if (this.dispatcherSearch.trim())            chips.push(`"${this.dispatcherSearch.trim()}"`);
    if (this.dispatcherBarangayFilter !== 'all')  chips.push(this.barangays.find(b => b.id === this.dispatcherBarangayFilter)?.name ?? 'Unknown Barangay');
    if (this.dispatcherDateFilter)                chips.push(formatDateFilterLabel(this.dispatcherDateFilter));
    return chips;
  }

  clearAllFilters(): void {
    this.dispatcherSearch = '';
    this.dispatcherBarangayFilter = 'all';
    this.dispatcherDateFilter = null;
  }

  openDispatcherModal(dispatcher: any | null) {
    this.editingDispatcher = dispatcher;
    this.dispatcherForm = dispatcher
      ? {
          first_name: dispatcher.first_name, last_name: dispatcher.last_name, phone: dispatcher.phone,
          username: dispatcher.username, email: dispatcher.email, password: '', barangay_id: dispatcher.barangay_id
        }
      : { first_name: '', last_name: '', phone: '', username: '', email: '', password: '', barangay_id: null };
    this.isDispatcherModalOpen = true;
  }

  saveDispatcherForm() {
    if (this.isSavingDispatcher) return;
    this.isSavingDispatcher = true;

    if (this.editingDispatcher) {
      const payload: any = { user_id: this.editingDispatcher.user_id, ...this.dispatcherForm };
      if (!payload.password) delete payload.password;
      this.api.updateDispatcher(payload).subscribe({
        next: () => {
          this.isSavingDispatcher = false;
          this.ui.showToast('Dispatcher updated!', 'success');
          this.isDispatcherModalOpen = false;
          this.loadDispatchers();
        },
        error: () => { this.isSavingDispatcher = false; this.ui.showToast('Update failed.', 'danger'); }
      });
    } else {
      this.api.createDispatcher(this.dispatcherForm).subscribe({
        next: () => {
          this.isSavingDispatcher = false;
          this.ui.showToast('Dispatcher created!', 'success');
          this.isDispatcherModalOpen = false;
          this.loadDispatchers();
        },
        error: () => { this.isSavingDispatcher = false; this.ui.showToast('Creation failed.', 'danger'); }
      });
    }
  }

  confirmDeactivateDispatcher(dispatcher: any) {
    this.ui.showConfirm({
      title: 'Remove Dispatcher',
      message: `Remove ${dispatcher.first_name} ${dispatcher.last_name}? They will no longer be able to log in.`,
      icon: 'fa-solid fa-user-slash', iconColor: '#eb445a', confirmLabel: 'Remove', confirmColor: '#eb445a',
      action: () => {
        this.api.deactivateDispatcher({ user_id: dispatcher.user_id }).subscribe({
          next: () => { this.ui.showToast('Dispatcher removed.', 'medium'); this.loadDispatchers(); },
          error: () => this.ui.showToast('Failed to remove dispatcher.', 'danger')
        });
      }
    });
  }
}
