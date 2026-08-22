import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, firstValueFrom } from 'rxjs';
import { IonButton } from '@ionic/angular/standalone';
import { ApiService } from '../../../../../core/services/api';
import { AdminUiService } from '../../admin-ui.service';
import { EchoService } from '../../../../../core/services/echo.service';
import { ProxyImageDirective } from '../../../../../shared/directives/proxy-image.directive';
import { RevealAnimateDirective } from '../../../../../shared/directives/reveal-animate.directive';
import { ListEnterDirective } from '../../../../../shared/directives/list-enter.directive';
import { BARANGAYS } from '../../../../../shared/constants/barangays';
import { DateRangeFilterComponent } from '../../../../../shared/components/date-range-filter/date-range-filter.component';
import { FilterSummaryBarComponent } from '../../../../../shared/components/filter-summary-bar/filter-summary-bar.component';
import { DateFilterValue, matchesDateFilter, formatDateFilterLabel } from '../../../../../shared/utils/date-filter.util';

/**
 * VerificationsPanel — refreshes its queue in real-time via the Echo
 * `users` channel (UserVerified event). When one admin approves or rejects
 * an application, all other admin sessions update immediately without
 * polling. No fallback poll needed — this panel is admin-only and always
 * foreground; a missed event is recovered by the user's next interaction.
 */
@Component({
  selector: 'app-verifications-panel',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonButton, ProxyImageDirective,
    DateRangeFilterComponent, FilterSummaryBarComponent, RevealAnimateDirective, ListEnterDirective,
  ],
  templateUrl: './verifications.panel.html',
})
export class VerificationsPanel implements OnInit, OnDestroy {

  pendingVerifications: any[] = [];

  verificationSearch = '';
  verificationBarangayFilter: number | 'all' = 'all';
  verificationIdTypeFilter = 'all';
  verificationDateFilter: DateFilterValue | null = null;

  readonly barangays = BARANGAYS;

  private echoUserSub?: Subscription;

  constructor(
    public api: ApiService,
    public ui: AdminUiService,
    private echo: EchoService,
  ) {}

  ngOnInit() {
    this.loadPendingVerifications();
    this.echo.connect();
    // Refresh immediately when any admin approves/rejects an application.
    this.echoUserSub = this.echo.onUserVerified.subscribe(() => {
      this.loadPendingVerifications();
    });
  }

  ngOnDestroy() {
    this.echoUserSub?.unsubscribe();
  }

  loadPendingVerifications() {
    this.api.getPendingVerifications().subscribe((res: any) => { this.pendingVerifications = res; });
  }

  get filteredVerifications(): any[] {
    return this.pendingVerifications.filter(u => this.matchesVerificationFilter(u));
  }

  matchesVerificationFilter(u: any): boolean {
    const search = this.verificationSearch.trim().toLowerCase();
    const matchSearch = !search ||
      `${u.first_name} ${u.last_name} ${u.username} ${u.email} ${u.phone}`
        .toLowerCase().includes(search);
    const matchBarangay = this.verificationBarangayFilter === 'all' || u.barangay_id === this.verificationBarangayFilter;
    const matchIdType = this.verificationIdTypeFilter === 'all' || u.valid_id_type === this.verificationIdTypeFilter;
    const matchDate = matchesDateFilter(u.created_at, this.verificationDateFilter);
    return matchSearch && matchBarangay && matchIdType && matchDate;
  }

  trackByUserId(_index: number, u: any): number {
    return u.user_id;
  }

  get verificationIdTypes(): string[] {
    return [...new Set(this.pendingVerifications.map(u => u.valid_id_type).filter((t): t is string => !!t))].sort();
  }

  get activeFilterChips(): string[] {
    const chips: string[] = [];
    if (this.verificationSearch.trim())            chips.push(`"${this.verificationSearch.trim()}"`);
    if (this.verificationBarangayFilter !== 'all')  chips.push(this.barangays.find(b => b.id === this.verificationBarangayFilter)?.name ?? 'Unknown Barangay');
    if (this.verificationIdTypeFilter !== 'all')    chips.push(this.verificationIdTypeFilter);
    if (this.verificationDateFilter)                chips.push(formatDateFilterLabel(this.verificationDateFilter));
    return chips;
  }

  clearAllFilters(): void {
    this.verificationSearch = '';
    this.verificationBarangayFilter = 'all';
    this.verificationIdTypeFilter = 'all';
    this.verificationDateFilter = null;
  }

  approveCitizen(userId: number) {
    this.ui.confirm({
      title: 'Approve Citizen',
      message: 'Approve this citizen? They will be able to submit reports.',
      icon: 'fa-solid fa-user-check',
      iconColor: '#2dd36f',
      confirmLabel: 'Approve',
      confirmColor: '#2dd36f',
      onConfirm: async () => {
        await firstValueFrom(this.api.approveUser({ user_id: userId }));
        this.ui.showToast('Citizen approved!', 'success');
        this.loadPendingVerifications();
      }
    });
  }

  rejectCitizen(userId: number) {
    this.ui.confirm({
      title: 'Deny Application',
      message: 'Deny this registration? They will need to register again.',
      icon: 'fa-solid fa-user-xmark',
      iconColor: '#eb445a',
      confirmLabel: 'Deny',
      confirmColor: '#eb445a',
      onConfirm: async () => {
        await firstValueFrom(this.api.rejectUser({ user_id: userId }));
        this.ui.showToast('Application denied.', 'medium');
        this.loadPendingVerifications();
      }
    });
  }
}
