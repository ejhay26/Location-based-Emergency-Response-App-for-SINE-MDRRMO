import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
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

  showExportModal = false;

  openExportModal(): void {
    if (this.filteredArchivedRequests.length === 0) {
      this.ui.showToast('No records match your current filters to export.', 'warning');
      return;
    }
    this.showExportModal = true;
  }

  closeExportModal(): void {
    this.showExportModal = false;
  }

  printPdfReport(): void {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const adminName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'MDRRMO Officer';
    const role = localStorage.getItem('role') || 'Admin';
    const nowStr = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const records = this.filteredArchivedRequests;
    const filterSummary = this.activeFilterChips.length > 0 ? this.activeFilterChips.join(' | ') : 'All Archived Logs';

    const rowsHtml = records.map((r, i) => `
      <tr>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e0e0e0; text-align: center; font-size: 11px;">${i + 1}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold; font-size: 12px;">${r.incident_name || 'Emergency'}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e0e0e0; font-size: 11px;">${r.first_name || ''} ${r.last_name || ''}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e0e0e0; font-size: 11px;">${r.phone || 'N/A'}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e0e0e0; font-size: 11px;">${r.barangay_name || 'Unresolved'}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e0e0e0; font-size: 11px;">${new Date(r.request_time).toLocaleString()}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e0e0e0; text-align: center; font-size: 11px;">
          <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; background: ${r.status === 'Resolved' ? '#e8f5e9' : '#f5f5f5'}; color: ${r.status === 'Resolved' ? '#2e7d32' : '#616161'};">
            ${r.status}
          </span>
          ${r.is_false_alarm ? '<span style="display: inline-block; margin-left: 4px; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 9px; background: #ffebee; color: #c62828;">FALSE ALARM</span>' : ''}
        </td>
      </tr>
    `).join('');

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>MDRRMO Log Archive Report - ${new Date().toISOString().slice(0, 10)}</title>
        <style>
          @page { size: landscape; margin: 12mm 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #222; margin: 0; padding: 15px; font-size: 12px; }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #c62828; padding-bottom: 12px; margin-bottom: 16px; }
          .header-left { display: flex; align-items: center; gap: 12px; }
          .logo-box { width: 44px; height: 44px; background: #c62828; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 14px; }
          .title-box h1 { margin: 0; font-size: 16px; text-transform: uppercase; color: #c62828; letter-spacing: 0.5px; }
          .title-box p { margin: 2px 0 0; font-size: 11px; color: #666; }
          .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f8f9fa; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #e9ecef; }
          .meta-item { font-size: 11px; }
          .meta-label { color: #888; text-transform: uppercase; font-size: 9px; font-weight: bold; margin-bottom: 2px; }
          .meta-val { font-weight: 600; color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #f1f3f5; color: #495057; font-weight: 700; font-size: 11px; text-transform: uppercase; padding: 8px 10px; border-bottom: 2px solid #dee2e6; text-align: left; }
          tr:nth-child(even) { background-color: #fafbfc; }
          .footer { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 15px; border-top: 1px solid #dee2e6; font-size: 10px; color: #888; }
          .sig-box { text-align: center; border-top: 1px solid #333; padding-top: 4px; width: 180px; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <div class="logo-box">SINE</div>
            <div class="title-box">
              <h1>MDRRMO San Isidro — Emergency Log Archive Report</h1>
              <p>Municipal Disaster Risk Reduction and Management Office • Official Record</p>
            </div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #666;">
            <div><b>Generated:</b> ${nowStr}</div>
            <div><b>Officer:</b> ${adminName} (${role.toUpperCase()})</div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <div class="meta-label">Total Records</div>
            <div class="meta-val">${records.length} Incident(s)</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Applied Filters</div>
            <div class="meta-val">${filterSummary}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Sort Order</div>
            <div class="meta-val">${this.archiveSort.toUpperCase()}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Report Status</div>
            <div class="meta-val">Official Archive Export</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align: center; width: 35px;">#</th>
              <th>Incident Type</th>
              <th>Citizen Reporter</th>
              <th>Contact Number</th>
              <th>Barangay</th>
              <th>Date & Time Reported</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          <div>This document is an official export from the MDRRMO Emergency Response System. Confidential information.</div>
          <div class="sig-box">
            <b>${adminName}</b><br>
            <span>Certified MDRRMO Personnel</span>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printHtml);
      printWindow.document.close();
      this.closeExportModal();
    } else {
      this.ui.showToast('Could not open print window. Please allow popups for this site.', 'danger');
    }
  }

  clearAllFilters(): void {
    this.archiveFilter = 'all';
    this.archiveTypeFilter = 'all';
    this.archiveBarangayFilter = 'all';
    this.archiveDateFilter = null;
  }

  markFalseAlarm(requestId: number, citizenName: string) {
    this.ui.confirm({
      title: 'Mark as False Alarm',
      message: `Mark this report by ${citizenName} as a false alarm? This will add a strike to their account. At 3 strikes, their account is automatically suspended.`,
      icon: 'fa-solid fa-triangle-exclamation',
      iconColor: '#eb445a',
      confirmLabel: 'Mark False Alarm',
      confirmColor: '#eb445a',
      onConfirm: async () => {
        try {
          const res: any = await firstValueFrom(this.api.markFalseAlarm({ request_id: requestId }));
          this.ui.showToast(res.message, 'warning');
          this.loadData();
        } catch (err: any) {
          this.ui.showToast(err.error?.message || 'Failed to mark false alarm.', 'danger');
        }
      }
    });
  }
}

