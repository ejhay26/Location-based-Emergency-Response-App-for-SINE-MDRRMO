import { Component, ElementRef, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { IonButton } from '@ionic/angular/standalone';
import { ApiService } from '../../../../../core/services/api';
import { AdminUiService } from '../../admin-ui.service';
import { EchoService } from '../../../../../core/services/echo.service';
import { UserSettingsService } from '../../../../../core/services/user-settings';
import { ProxyImageDirective } from '../../../../../shared/directives/proxy-image.directive';
import { ListEnterDirective } from '../../../../../shared/directives/list-enter.directive';
import { UtcDatePipe } from '../../../../../shared/pipes/utc-date.pipe';
import { BARANGAYS } from '../../../../../shared/constants/barangays';
import { DateRangeFilterComponent } from '../../../../../shared/components/date-range-filter/date-range-filter.component';
import { FilterSummaryBarComponent } from '../../../../../shared/components/filter-summary-bar/filter-summary-bar.component';
import { DateFilterValue, matchesDateFilter, formatDateFilterLabel } from '../../../../../shared/utils/date-filter.util';
import { captureFlipRects, playFlipReorder } from '../../../../../shared/utils/flip-reflow.util';
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';

@Component({
  selector: 'app-citizens-panel',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonButton, ProxyImageDirective, UtcDatePipe,
    DateRangeFilterComponent, FilterSummaryBarComponent, ListEnterDirective,
    AppIconComponent
  ],
  templateUrl: './citizens.panel.html',
})
export class CitizensPanel implements OnInit, OnDestroy {

  citizens: any[] = [];
  citizenSearch = '';
  citizenFilterStatus: 'all' | 'active' | 'suspended' = 'all';
  citizenBarangayFilter: number | 'all' = 'all';
  citizenDateFilter: DateFilterValue | null = null;

  readonly barangays = BARANGAYS;

  @ViewChild('citizensGrid') citizensGrid?: ElementRef<HTMLElement>;

  private echoUserSub?: Subscription;

  constructor(
    public api: ApiService,
    public ui: AdminUiService,
    private echo: EchoService,
    private settings: UserSettingsService,
  ) {}

  ngOnInit() {
    this.loadCitizens();
    this.echo.connect();
    // Refresh when any account status changes (suspend / reinstate / approve).
    this.echoUserSub = this.echo.onUserVerified.subscribe(() => {
      this.loadCitizens();
    });
  }

  ngOnDestroy() {
    this.echoUserSub?.unsubscribe();
  }

  get filteredCitizens(): any[] {
    const search = this.citizenSearch.trim().toLowerCase();
    return this.citizens.filter(c => {
      const matchSearch = !search ||
        `${c.first_name} ${c.last_name} ${c.username} ${c.email} ${c.phone}`
          .toLowerCase().includes(search);
      const matchStatus = this.citizenFilterStatus === 'all' ||
        (this.citizenFilterStatus === 'suspended' ? c.account_status === 'banned' : c.account_status === 'active');
      const matchBarangay = this.citizenBarangayFilter === 'all' || c.barangay_id === this.citizenBarangayFilter;
      const matchDate = matchesDateFilter(c.created_at, this.citizenDateFilter);
      return matchSearch && matchStatus && matchBarangay && matchDate;
    });
  }

  get activeFilterChips(): string[] {
    const chips: string[] = [];
    if (this.citizenSearch.trim())            chips.push(`"${this.citizenSearch.trim()}"`);
    if (this.citizenFilterStatus !== 'all')    chips.push(this.citizenFilterStatus === 'suspended' ? 'Suspended' : 'Active');
    if (this.citizenBarangayFilter !== 'all')  chips.push(this.barangays.find(b => b.id === this.citizenBarangayFilter)?.name ?? 'Unknown Barangay');
    if (this.citizenDateFilter)                chips.push(formatDateFilterLabel(this.citizenDateFilter));
    return chips;
  }

  trackByUserId(_index: number, c: any): number { return c.user_id; }

  private applyFilterChange(mutate: () => void): void {
    if (!this.settings.shouldAnimate()) { mutate(); return; }
    const container = this.citizensGrid?.nativeElement;
    const before = captureFlipRects(container);
    mutate();
    requestAnimationFrame(() => requestAnimationFrame(() => playFlipReorder(container, before)));
  }

  onSearchChange(value: string):                    void { this.applyFilterChange(() => { this.citizenSearch = value; }); }
  onStatusFilterChange(value: 'all' | 'active' | 'suspended'): void { this.applyFilterChange(() => { this.citizenFilterStatus = value; }); }
  onBarangayFilterChange(value: number | 'all'):    void { this.applyFilterChange(() => { this.citizenBarangayFilter = value; }); }
  onDateFilterChange(value: DateFilterValue | null): void { this.applyFilterChange(() => { this.citizenDateFilter = value; }); }
  clearAllFilters(): void {
    this.applyFilterChange(() => {
      this.citizenSearch = ''; this.citizenFilterStatus = 'all';
      this.citizenBarangayFilter = 'all'; this.citizenDateFilter = null;
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
      icon: isSuspended ? 'user-check' : 'user-slash',
      iconColor: isSuspended ? '#2dd36f' : '#eb445a',
      confirmLabel: isSuspended ? 'Reinstate' : 'Suspend',
      confirmColor: isSuspended ? '#2dd36f' : '#eb445a',
      action: () => {
        const call = isSuspended
          ? this.api.reactivateCitizen({ user_id: citizen.user_id })
          : this.api.suspendCitizen({ user_id: citizen.user_id });
        call.subscribe({
          next: () => {
            this.ui.showToast(
              isSuspended ? 'Account reinstated.' : 'Account suspended.',
              isSuspended ? 'success' : 'warning',
              {
                text: 'Undo',
                handler: () => {
                  const undoCall = isSuspended
                    ? this.api.suspendCitizen({ user_id: citizen.user_id })
                    : this.api.reactivateCitizen({ user_id: citizen.user_id });
                  undoCall.subscribe({
                    next: () => {
                      this.ui.showToast('Action undone.', 'medium');
                      this.loadCitizens();
                    },
                    error: () => this.ui.showToast('Could not undo action.', 'danger')
                  });
                }
              }
            );
            this.loadCitizens();
          },
          error: () => this.ui.showToast('Action failed. Try again.', 'danger')
        });
      }
    });
  }
}
