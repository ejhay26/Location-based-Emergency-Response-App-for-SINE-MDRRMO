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
  citizenFilterStatus: 'all' | 'active' | 'suspended' | 'has_strikes' | 'clean' = 'all';
  citizenBarangayFilter: number | 'all' = 'all';
  citizenDateFilter: DateFilterValue | null = null;

  // Strike Management Modal
  isStrikeModalOpen = false;
  selectedCitizen: any = null;
  selectedStrikeReason = 'Prank / False Alarm (No actual emergency found on site)';
  customStrikeReason = '';
  isSubmittingStrike = false;

  readonly STRIKE_PRESET_REASONS: string[] = [
    'Prank / False Alarm (No actual emergency found on site)',
    'Inaccurate or Fabricated Emergency Details',
    'Abusive or Disruptive Misuse of SOS System',
    'Accidental Activation without Prompt Cancellation',
    'Other / Custom Reason'
  ];

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
    // Refresh when any account status changes (suspend / reinstate / approve / strike).
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
      let matchStatus = true;
      if (this.citizenFilterStatus === 'active') {
        matchStatus = c.account_status === 'active';
      } else if (this.citizenFilterStatus === 'suspended') {
        matchStatus = c.account_status === 'banned';
      } else if (this.citizenFilterStatus === 'has_strikes') {
        matchStatus = (c.false_alarm_strikes || 0) > 0;
      } else if (this.citizenFilterStatus === 'clean') {
        matchStatus = !c.false_alarm_strikes || c.false_alarm_strikes === 0;
      }
      const matchBarangay = this.citizenBarangayFilter === 'all' || c.barangay_id === this.citizenBarangayFilter;
      const matchDate = matchesDateFilter(c.created_at, this.citizenDateFilter);
      return matchSearch && matchStatus && matchBarangay && matchDate;
    });
  }

  get activeFilterChips(): string[] {
    const chips: string[] = [];
    if (this.citizenSearch.trim())            chips.push(`"${this.citizenSearch.trim()}"`);
    if (this.citizenFilterStatus !== 'all') {
      const labels: Record<string, string> = {
        active: 'Active',
        suspended: 'Suspended',
        has_strikes: 'Has Strikes (1+)',
        clean: 'Clean Record (0 Strikes)'
      };
      chips.push(labels[this.citizenFilterStatus] || this.citizenFilterStatus);
    }
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
  onStatusFilterChange(value: 'all' | 'active' | 'suspended' | 'has_strikes' | 'clean'): void { this.applyFilterChange(() => { this.citizenFilterStatus = value; }); }
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

  // ── Strike Management Modal ──────────────────────────────────────────
  openStrikeModal(citizen: any) {
    this.selectedCitizen = citizen;
    this.selectedStrikeReason = this.STRIKE_PRESET_REASONS[0];
    this.customStrikeReason = '';
    this.isStrikeModalOpen = true;
  }

  closeStrikeModal() {
    this.isStrikeModalOpen = false;
    this.selectedCitizen = null;
    this.customStrikeReason = '';
  }

  submitIssueStrike() {
    if (!this.selectedCitizen || this.isSubmittingStrike) return;
    const finalReason = this.selectedStrikeReason === 'Other / Custom Reason'
      ? (this.customStrikeReason.trim() || 'Unspecified false alarm report')
      : this.selectedStrikeReason;

    const currentStrikes = this.selectedCitizen.false_alarm_strikes || 0;
    const newStrikeCount = currentStrikes + 1;
    const willBan = newStrikeCount >= 3;

    this.ui.showConfirm({
      title: willBan ? 'Issue Strike 3 & Auto-Suspend' : `Issue False Alarm Strike (${newStrikeCount} of 3)`,
      message: willBan
        ? `Issue Strike 3 to ${this.selectedCitizen.first_name} ${this.selectedCitizen.last_name}? Their account will be AUTOMATICALLY SUSPENDED and a formal notice email will be dispatched.`
        : `Record Strike ${newStrikeCount} of 3 for ${this.selectedCitizen.first_name} ${this.selectedCitizen.last_name}? A warning email and push notification will be sent to them.`,
      icon: 'alert-triangle',
      iconColor: '#eb445a',
      confirmLabel: willBan ? 'Issue Strike & Suspend' : 'Confirm Strike',
      confirmColor: '#eb445a',
      action: () => {
        this.isSubmittingStrike = true;
        this.api.issueStrike({
          user_id: this.selectedCitizen.user_id,
          reason: finalReason
        }).subscribe({
          next: (res) => {
            this.isSubmittingStrike = false;
            this.ui.showToast(res.message || 'Strike issued successfully.', willBan ? 'danger' : 'warning');
            this.closeStrikeModal();
            this.loadCitizens();
          },
          error: (err) => {
            this.isSubmittingStrike = false;
            this.ui.showToast(err.error?.message || 'Could not issue strike.', 'danger');
          }
        });
      }
    });
  }

  resetCitizenStrikes(citizen: any) {
    this.ui.showConfirm({
      title: 'Reset Citizen Strikes',
      message: `Clear all false alarm strikes for ${citizen.first_name} ${citizen.last_name}? Their record will be reset to 0/3 strikes and any strike-related suspension will be lifted.`,
      icon: 'rotate-ccw',
      iconColor: '#2dd36f',
      confirmLabel: 'Reset Strikes to 0',
      confirmColor: '#2dd36f',
      action: () => {
        this.api.resetStrikes({ user_id: citizen.user_id }).subscribe({
          next: (res) => {
            this.ui.showToast(res.message || 'Strikes reset to 0.', 'success');
            if (this.isStrikeModalOpen) this.closeStrikeModal();
            this.loadCitizens();
          },
          error: (err) => {
            this.ui.showToast(err.error?.message || 'Could not reset strikes.', 'danger');
          }
        });
      }
    });
  }

  suspendCitizen(citizen: any) {
    const isSuspended = citizen.account_status === 'banned';
    this.ui.showConfirm({
      title: `${isSuspended ? 'Reinstate' : 'Suspend'} Account`,
      message: isSuspended
        ? `Reinstate ${citizen.first_name} ${citizen.last_name}? They will regain full access.`
        : `Suspend ${citizen.first_name} ${citizen.last_name}? They will be locked out immediately.`,
      icon: isSuspended ? 'user-check' : 'user-xmark',
      iconColor: isSuspended ? '#2dd36f' : '#eb445a',
      confirmLabel: isSuspended ? 'Reinstate' : 'Suspend',
      confirmColor: isSuspended ? '#2dd36f' : '#eb445a',
      action: () => {
        const call = isSuspended
          ? this.api.reactivateCitizen({ user_id: citizen.user_id })
          : this.api.suspendCitizen({ user_id: citizen.user_id, reason: 'Administrative suspension by MDRRMO staff.' });
        call.subscribe({
          next: () => {
            this.ui.showToast(
              isSuspended ? 'Account reinstated.' : 'Account suspended.',
              isSuspended ? 'success' : 'warning',
              {
                text: 'Undo',
                handler: () => {
                  const undoCall = isSuspended
                    ? this.api.suspendCitizen({ user_id: citizen.user_id, reason: 'Undo reinstate' })
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
