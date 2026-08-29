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
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';
import { TourService } from '../../../../../core/services/tour';

import { UtcDatePipe } from '../../../../../shared/pipes/utc-date.pipe';

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
    AppIconComponent, UtcDatePipe
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
  private tourSub?: Subscription;

  readonly DEMO_VERIFICATION = {
    user_id: 999999,
    first_name: 'Maria Clara',
    last_name: 'Santos',
    username: 'mariasantos',
    email: 'maria.santos@example.com',
    phone: '09171234567',
    barangay_id: 1,
    valid_id_type: 'National ID (PhilID)',
    valid_id_number: '1234-5678-9012-3456',
    valid_id_expiry: '2030-12-31',
    valid_id_proof: 'assets/sample-id-front.jpg',
    valid_id_proof_back: 'assets/sample-id-back.jpg',
    selfie_with_id_proof: 'assets/sample-id-selfie.jpg',
    created_at: new Date().toISOString(),
    is_demo: true
  };

  constructor(
    public api: ApiService,
    public ui: AdminUiService,
    private echo: EchoService,
    public tour: TourService,
  ) {}

  ngOnInit() {
    this.loadPendingVerifications();
    this.echo.connect();
    // Refresh immediately when any admin approves/rejects an application.
    this.echoUserSub = this.echo.onUserVerified.subscribe(() => {
      this.loadPendingVerifications();
    });

    this.tourSub = this.tour.stepChange$.subscribe(({ active }) => {
      if (active && this.pendingVerifications.length === 0) {
        this.pendingVerifications = [this.DEMO_VERIFICATION];
      } else if (!active && this.pendingVerifications.length === 1 && this.pendingVerifications[0].is_demo) {
        this.pendingVerifications = [];
      }
    });
  }

  ngOnDestroy() {
    this.echoUserSub?.unsubscribe();
    this.tourSub?.unsubscribe();
  }

  loadPendingVerifications() {
    this.api.getPendingVerifications().subscribe((res: any) => {
      if (Array.isArray(res) && res.length > 0) {
        this.pendingVerifications = res;
      } else if (this.tour.isActive()) {
        this.pendingVerifications = [this.DEMO_VERIFICATION];
      } else {
        this.pendingVerifications = [];
      }
    });
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
    const user = this.pendingVerifications.find(u => u.user_id === userId);
    const name = user ? `${user.first_name} ${user.last_name}` : 'this citizen';
    this.ui.showConfirm({
      title: 'Approve Verification',
      message: `Are you sure you want to approve ID verification for ${name}?`,
      icon: 'user-check', iconColor: '#2dd36f', confirmLabel: 'Approve', confirmColor: '#2dd36f',
      action: async () => {
        try {
          await firstValueFrom(this.api.approveUser({ user_id: userId }));
          this.ui.showToast('Citizen ID verified.', 'success');
          this.loadPendingVerifications();
        } catch {
          this.ui.showToast('Approval failed.', 'danger');
        }
      }
    });
  }

  rejectCitizen(userId: number) {
    const user = this.pendingVerifications.find(u => u.user_id === userId);
    const name = user ? `${user.first_name} ${user.last_name}` : 'this citizen';
    this.ui.showConfirm({
      title: 'Reject Verification',
      message: `Reject ID verification for ${name}?`,
      icon: 'user-xmark', iconColor: '#eb445a', confirmLabel: 'Reject', confirmColor: '#eb445a',
      action: async () => {
        try {
          await firstValueFrom(this.api.rejectUser({ user_id: userId }));
          this.ui.showToast('Verification rejected.', 'medium');
          this.loadPendingVerifications();
        } catch {
          this.ui.showToast('Rejection failed.', 'danger');
        }
      }
    });
  }

  copiedIdMap: { [userId: number]: boolean } = {};

  async copyIdNumber(user: any): Promise<void> {
    if (!user?.valid_id_number) return;
    try {
      await navigator.clipboard.writeText(user.valid_id_number);
      this.copiedIdMap[user.user_id] = true;
      this.ui.showToast(`Copied ID Number: ${user.valid_id_number}`, 'success');
      setTimeout(() => {
        this.copiedIdMap[user.user_id] = false;
      }, 2500);
    } catch {
      this.ui.showToast('Could not copy to clipboard', 'medium');
    }
  }
}
