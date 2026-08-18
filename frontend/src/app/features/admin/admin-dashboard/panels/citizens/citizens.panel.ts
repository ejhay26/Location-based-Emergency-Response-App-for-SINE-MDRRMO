import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonButton } from '@ionic/angular/standalone';
import { ApiService } from '../../../../../core/services/api';
import { AdminUiService } from '../../admin-ui.service';
import { UserSettingsService } from '../../../../../core/services/user-settings';
import { ProxyImageDirective } from '../../../../../shared/directives/proxy-image.directive';
import { ListEnterDirective } from '../../../../../shared/directives/list-enter.directive';
import { UtcDatePipe } from '../../../../../shared/pipes/utc-date.pipe';
import { BARANGAYS } from '../../../../../shared/constants/barangays';
import { DateRangeFilterComponent } from '../../../../../shared/components/date-range-filter/date-range-filter.component';
import { FilterSummaryBarComponent } from '../../../../../shared/components/filter-summary-bar/filter-summary-bar.component';
import { DateFilterValue, matchesDateFilter, formatDateFilterLabel } from '../../../../../shared/utils/date-filter.util';
import { captureFlipRects, playFlipReorder } from '../../../../../shared/utils/flip-reflow.util';

/**
 * CitizensPanel — Accounts › Citizens. Search/filter over a card grid, plus
 * suspend/reactivate. Filtering is done client-side against the full list
 * (same as the original monolith) rather than round-tripping to the API's
 * getCitizens(filters) support, to keep behavior identical during atomization.
 */
@Component({
  selector: 'app-citizens-panel',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonButton, ProxyImageDirective, UtcDatePipe,
    DateRangeFilterComponent, FilterSummaryBarComponent, ListEnterDirective,
  ],
  templateUrl: './citizens.panel.html',
})
export class CitizensPanel implements OnInit {

  citizens: any[] = [];
  citizenSearch = '';
  citizenFilterStatus: 'all' | 'active' | 'suspended' = 'all';
  citizenBarangayFilter: number | 'all' = 'all';
  citizenDateFilter: DateFilterValue | null = null;

  readonly barangays = BARANGAYS;

  /** FLIP filter-reflow (see applyFilterChange) needs a live handle on the grid's DOM to measure card positions before/after a filter change. */
  @ViewChild('citizensGrid') citizensGrid?: ElementRef<HTMLElement>;

  constructor(public api: ApiService, public ui: AdminUiService, private settings: UserSettingsService) {}

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
      const matchBarangay = this.citizenBarangayFilter === 'all' || c.barangay_id === this.citizenBarangayFilter;
      const matchDate = matchesDateFilter(c.created_at, this.citizenDateFilter);
      return matchSearch && matchStatus && matchBarangay && matchDate;
    });
  }

  /** Chip labels for the active-filters summary bar; empty array hides the bar. */
  get activeFilterChips(): string[] {
    const chips: string[] = [];
    if (this.citizenSearch.trim())            chips.push(`"${this.citizenSearch.trim()}"`);
    if (this.citizenFilterStatus !== 'all')    chips.push(this.citizenFilterStatus === 'suspended' ? 'Suspended' : 'Active');
    if (this.citizenBarangayFilter !== 'all')  chips.push(this.barangays.find(b => b.id === this.citizenBarangayFilter)?.name ?? 'Unknown Barangay');
    if (this.citizenDateFilter)                chips.push(formatDateFilterLabel(this.citizenDateFilter));
    return chips;
  }

  trackByUserId(_index: number, c: any): number {
    return c.user_id;
  }

  /**
   * Filter-reflow (FLIP) — Citizens renders as a CSS Grid, not a
   * single-column list, so RevealAnimateDirective's height-collapse trick
   * (used by Log Archive/Verifications) doesn't reflow correctly here: a
   * zero-height grid item just leaves an empty cell instead of letting
   * siblings slide up. Filtered-out cards are removed outright (ordinary
   * *ngIf-less *ngFor diffing), and the shared FLIP helpers animate every
   * SURVIVING card sliding from its old grid position to its new one. See
   * shared/utils/flip-reflow.util.ts for the full explanation.
   *
   * Every filter-mutating call site (search input, status/barangay
   * dropdowns, date filter, clear-all) routes through this so none of them
   * skip the reflow.
   */
  private applyFilterChange(mutate: () => void): void {
    if (!this.settings.shouldAnimate()) { mutate(); return; }
    const container = this.citizensGrid?.nativeElement;
    const before = captureFlipRects(container);
    mutate();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => playFlipReorder(container, before));
    });
  }

  onSearchChange(value: string): void {
    this.applyFilterChange(() => { this.citizenSearch = value; });
  }

  onStatusFilterChange(value: 'all' | 'active' | 'suspended'): void {
    this.applyFilterChange(() => { this.citizenFilterStatus = value; });
  }

  onBarangayFilterChange(value: number | 'all'): void {
    this.applyFilterChange(() => { this.citizenBarangayFilter = value; });
  }

  onDateFilterChange(value: DateFilterValue | null): void {
    this.applyFilterChange(() => { this.citizenDateFilter = value; });
  }

  clearAllFilters(): void {
    this.applyFilterChange(() => {
      this.citizenSearch = '';
      this.citizenFilterStatus = 'all';
      this.citizenBarangayFilter = 'all';
      this.citizenDateFilter = null;
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
