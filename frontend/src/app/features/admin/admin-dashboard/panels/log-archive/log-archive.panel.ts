import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonButton, IonBadge } from '@ionic/angular/standalone';
import { ApiService } from '../../../../../core/services/api';
import { AdminUiService } from '../../admin-ui.service';
import { UserSettingsService } from '../../../../../core/services/user-settings';
import { ProxyImageDirective } from '../../../../../shared/directives/proxy-image.directive';
import { VideoThumbnailDirective } from '../../../../../shared/directives/video-thumbnail.directive';
import { RevealAnimateDirective } from '../../../../../shared/directives/reveal-animate.directive';
import { ListEnterDirective } from '../../../../../shared/directives/list-enter.directive';
import { UtcDatePipe } from '../../../../../shared/pipes/utc-date.pipe';
import { DateRangeFilterComponent } from '../../../../../shared/components/date-range-filter/date-range-filter.component';
import { FilterSummaryBarComponent } from '../../../../../shared/components/filter-summary-bar/filter-summary-bar.component';
import { DateFilterValue, matchesDateFilter, formatDateFilterLabel } from '../../../../../shared/utils/date-filter.util';
import { captureFlipRects, playFlipReorder } from '../../../../../shared/utils/flip-reflow.util';
import { BARANGAYS } from '../../../../../shared/constants/barangays';

const ARCHIVE_FILTER_LABELS: Record<string, string> = {
  resolved: 'Resolved', false_alarm: 'False Alarms', cancelled: 'Cancelled',
};

@Component({
  selector: 'app-log-archive-panel',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonButton, IonBadge, ProxyImageDirective, VideoThumbnailDirective, UtcDatePipe,
    DateRangeFilterComponent, FilterSummaryBarComponent, RevealAnimateDirective, ListEnterDirective,
  ],
  templateUrl: './log-archive.panel.html',
})
export class LogArchivePanel implements OnInit {

  archivedRequests: any[] = [];

  archiveFilter: 'all' | 'resolved' | 'false_alarm' | 'cancelled' = 'all';
  archiveSort: 'newest' | 'oldest' | 'type' = 'newest';
  archiveTypeFilter = 'all';
  archiveDateFilter: DateFilterValue | null = null;
  /** Selected barangay_id, or 'all'. A null barangay_id (unresolved location) only matches 'all'. */
  archiveBarangayFilter: number | 'all' = 'all';
  readonly barangayOptions = BARANGAYS;

  /** FLIP sort-reorder (see onSortChange) needs a live handle on the list's DOM to measure card positions before/after a re-sort. */
  @ViewChild('archiveListContainer') archiveListContainer?: ElementRef<HTMLElement>;

  constructor(public api: ApiService, public ui: AdminUiService, private settings: UserSettingsService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.getArchivedEmergencies().subscribe((res: any) => { this.archivedRequests = res; });
  }

  get filteredArchivedRequests(): any[] {
    return this.sortedArchivedRequests.filter(r => this.matchesArchiveFilter(r));
  }

  /**
   * Post-Stage-5 follow-up (filter shrink-and-reflow) — sort applied, but
   * NOT filtered. The template iterates this (unfiltered-by-status/type/date)
   * list so every card stays mounted; `matchesArchiveFilter` below drives
   * each card's `[appRevealAnimate]` instead, collapsing non-matching cards
   * to a true zero in place rather than removing them outright.
   */
  get sortedArchivedRequests(): any[] {
    const list = [...this.archivedRequests];
    if (this.archiveSort === 'newest') list.sort((a, b) => new Date(b.request_time).getTime() - new Date(a.request_time).getTime());
    if (this.archiveSort === 'oldest') list.sort((a, b) => new Date(a.request_time).getTime() - new Date(b.request_time).getTime());
    if (this.archiveSort === 'type')   list.sort((a, b) => a.incident_name.localeCompare(b.incident_name));
    return list;
  }

  matchesArchiveFilter(r: any): boolean {
    if (this.archiveFilter === 'resolved'    && !(r.status === 'Resolved' && !r.is_false_alarm)) return false;
    if (this.archiveFilter === 'false_alarm' && !r.is_false_alarm) return false;
    if (this.archiveFilter === 'cancelled'   && r.status !== 'Cancelled') return false;
    if (this.archiveTypeFilter !== 'all'     && r.incident_name !== this.archiveTypeFilter) return false;
    if (this.archiveBarangayFilter !== 'all' && r.barangay_id !== this.archiveBarangayFilter) return false;
    return matchesDateFilter(r.request_time, this.archiveDateFilter);
  }

  trackByRequestId(_index: number, r: any): number {
    return r.request_id;
  }

  /**
   * Sort-order reflow (FLIP) — changing sort reorders the SAME set of cards
   * (trackBy keeps the DOM nodes, Angular's differ just moves them), which
   * by default happens as an instant jump. This makes it a genuine animated
   * reorder instead, via the shared captureFlipRects/playFlipReorder
   * helpers (shared/utils/flip-reflow.util.ts — see that file for the full
   * FLIP explanation; this used to be two private methods duplicated here,
   * now shared with the grid-panel filter-reflow use case too).
   */
  onSortChange(newSort: 'newest' | 'oldest' | 'type') {
    if (!this.settings.shouldAnimate() || newSort === this.archiveSort) {
      this.archiveSort = newSort;
      return;
    }
    const container = this.archiveListContainer?.nativeElement;
    const before = captureFlipRects(container);
    this.archiveSort = newSort;

    // Two rAFs: the first waits for Angular's change detection (triggered by
    // the property assignment above) to actually patch the DOM into its new
    // order; the second waits for the browser to have committed layout for
    // that new order, so the 'after' measurement is accurate rather than
    // catching an in-between state.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => playFlipReorder(container, before));
    });
  }

  get archiveIncidentTypes(): string[] {
    return [...new Set(this.archivedRequests.map(r => r.incident_name))].sort();
  }

  /** Chip labels for the active-filters summary bar; empty array hides the bar. */
  get activeFilterChips(): string[] {
    const chips: string[] = [];
    if (this.archiveFilter !== 'all')     chips.push(ARCHIVE_FILTER_LABELS[this.archiveFilter]);
    if (this.archiveTypeFilter !== 'all') chips.push(this.archiveTypeFilter);
    if (this.archiveBarangayFilter !== 'all') chips.push(this.barangayOptions.find(b => b.id === this.archiveBarangayFilter)?.name || '');
    if (this.archiveDateFilter)           chips.push(formatDateFilterLabel(this.archiveDateFilter));
    return chips;
  }

  clearAllFilters(): void {
    this.archiveFilter = 'all';
    this.archiveTypeFilter = 'all';
    this.archiveBarangayFilter = 'all';
    this.archiveDateFilter = null;
  }

  markFalseAlarm(requestId: number, citizenName: string) {
    this.ui.showConfirm({
      title: 'Mark as False Alarm',
      message: `Mark this report by ${citizenName} as a false alarm? This will add a strike to their account. At 3 strikes, their account is automatically suspended.`,
      icon: 'fa-solid fa-triangle-exclamation', iconColor: '#eb445a', confirmLabel: 'Mark False Alarm', confirmColor: '#eb445a',
      action: () => {
        this.api.markFalseAlarm({ request_id: requestId }).subscribe({
          next: (res: any) => { this.ui.showToast(res.message, 'warning'); this.loadData(); },
          error: (err: any) => this.ui.showToast(err.error?.message || 'Failed to mark false alarm.', 'danger')
        });
      }
    });
  }
}
