import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { IonButton, IonBadge, IonSkeletonText } from '@ionic/angular/standalone';
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
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';
import { FilterDropdownComponent, FilterDropdownOption } from '../../../../../shared/components/filter-dropdown/filter-dropdown.component';
import { CustomTooltipDirective } from '../../../../../shared/directives/custom-tooltip.directive';

const ARCHIVE_FILTER_LABELS: Record<string, string> = {
  resolved: 'Resolved', false_alarm: 'False Alarms', cancelled: 'Cancelled',
};

@Component({
  selector: 'app-log-archive-panel',
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonButton, IonBadge, IonSkeletonText, ProxyImageDirective, VideoThumbnailDirective, UtcDatePipe,
    DateRangeFilterComponent, FilterSummaryBarComponent, ListEnterDirective,
    AppIconComponent, FilterDropdownComponent, CustomTooltipDirective
  ],
  templateUrl: './log-archive.panel.html',
  styleUrls: ['./log-archive.panel.scss'],
})
export class LogArchivePanel implements OnInit {

  /** macOS Finder view mode: 'list' (horizontal cards) or 'grid' (multi-column cards) */
  viewMode: 'grid' | 'list' = (typeof localStorage !== 'undefined' && localStorage.getItem('sine_admin_log_archive_view') as 'grid' | 'list') || 'list';

  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode = mode;
    try {
      localStorage.setItem('sine_admin_log_archive_view', mode);
    } catch {}
  }


  isLoading = true;
  archivedRequests: any[] = [];

  archiveFilter: 'all' | 'resolved' | 'false_alarm' | 'cancelled' = 'all';
  archiveSort: 'newest' | 'oldest' | 'type' = 'newest';
  archiveTypeFilter = 'all';
  archiveDateFilter: DateFilterValue | null = null;
  archiveBarangayFilter: number[] = [];
  readonly barangayOptions = BARANGAYS;

  get typeDropdownOptions() {
    return [
      { value: 'all', label: 'All Types' },
      ...this.archiveIncidentTypes.map(t => ({ value: t, label: t }))
    ];
  }

  readonly barangayDropdownOptions: FilterDropdownOption[] = [
    { value: 'all', label: 'All Barangays (Reset)' },
    ...BARANGAYS.map(b => ({ value: b.id, label: b.name }))
  ];

  readonly sortDropdownOptions = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'type', label: 'By Type' }
  ];

  /** FLIP sort-reorder (see onSortChange) needs a live handle on the list's DOM to measure card positions before/after a re-sort. */
  @ViewChild('archiveListContainer') archiveListContainer?: ElementRef<HTMLElement>;

  constructor(public api: ApiService, public ui: AdminUiService, private settings: UserSettingsService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    this.api.getArchivedEmergencies().subscribe({
      next: (res: any) => {
        this.archivedRequests = Array.isArray(res) ? res : [];
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.ui.showToast('Failed to load incident archive logs.', 'danger');
      }
    });
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
    if (this.archiveBarangayFilter.length > 0 && !this.archiveBarangayFilter.some(id => Number(id) === Number(r.barangay_id))) return false;
    return matchesDateFilter(r.request_time, this.archiveDateFilter);
  }

    getIncidentColor(name: string): string {
    switch (name) {
      case 'Fire': return '#eb445a';
      case 'Flood': return '#3880ff';
      case 'Medical': return '#2dd36f';
      case 'Crime': return '#bc6fff';
      case 'Vehicular Accident': return '#ff9800';
      case 'Hazard': return '#ffc409';
      default: return '#92949c';
    }
  }

  getIncidentIcon(name: string): string {
    switch (name) {
      case 'Fire': return 'flame';
      case 'Flood': return 'droplet';
      case 'Medical': return 'medical';
      case 'Crime': return 'shield-alert';
      case 'Vehicular Accident': return 'car';
      case 'Hazard': return 'hazard';
      default: return 'triangle-exclamation';
    }
  }

  trackByRequestId(_index: number, r: any): number {
    return r.request_id;
  }

  getBarangayDisplay(req: any): string {
    if (req.barangay_name && req.barangay_name !== 'Unresolved') {
      return req.barangay_name;
    }
    if (req.barangay_id) {
      const b = this.barangayOptions.find(item => item.id === Number(req.barangay_id));
      if (b) return b.name;
    }
    return 'San Isidro (General Area)';
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
    if (this.archiveFilter !== 'all') chips.push(ARCHIVE_FILTER_LABELS[this.archiveFilter]);
    if (this.archiveTypeFilter !== 'all') chips.push(this.archiveTypeFilter);
    if (this.archiveBarangayFilter.length > 0) {
      if (this.archiveBarangayFilter.length === 1) {
        const b = this.barangayOptions.find(x => Number(x.id) === Number(this.archiveBarangayFilter[0]));
        if (b) chips.push(b.name);
      } else {
        chips.push(`${this.archiveBarangayFilter.length} Barangays`);
      }
    }
    if (this.archiveDateFilter) chips.push(formatDateFilterLabel(this.archiveDateFilter));
    return chips;
  }

  showExportModal = false;
  exportReportTitle = 'MDRRMO San Isidro — Emergency Log Archive Report';
  exportOfficeName = 'Municipal Disaster Risk Reduction and Management Office (SINE - San Isidro, Nueva Ecija)';
  exportPreparedBy = 'MDRRMO Officer';
  exportDesignation = 'MDRRMO Operations Officer';
  exportRemarks = 'Certified official dispatch and incident log records of the Municipal Disaster Risk Reduction and Management Office.';

  openExportModal(): void {
    if (this.filteredArchivedRequests.length === 0) {
      this.ui.showToast('No records match your current filters to export.', 'warning');
      return;
    }
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    if (user) {
      const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
      if (name) this.exportPreparedBy = name;
    }
    const role = localStorage.getItem('role') || 'Admin';
    this.exportDesignation = (role.toLowerCase() === 'admin') ? 'MDRRMO Administrator' : 'Lead Operations Dispatcher';
    this.showExportModal = true;
  }

  closeExportModal(): void {
    this.showExportModal = false;
  }

  printPdfReport(): void {
    const adminName = this.exportPreparedBy || 'MDRRMO Officer';
    const role = this.exportDesignation || 'MDRRMO Operations';
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
        <td style="padding: 7px 10px; border-bottom: 1px solid #e0e0e0; text-align: center; font-size: 11px;">${i + 1}</td>
        <td style="padding: 7px 10px; border-bottom: 1px solid #e0e0e0; font-weight: bold; font-size: 11.5px;">${r.incident_name || 'Emergency'}</td>
        <td style="padding: 7px 10px; border-bottom: 1px solid #e0e0e0; font-size: 11px;">${r.first_name || ''} ${r.last_name || ''}</td>
        <td style="padding: 7px 10px; border-bottom: 1px solid #e0e0e0; font-size: 11px;">${r.phone || 'N/A'}</td>
        <td style="padding: 7px 10px; border-bottom: 1px solid #e0e0e0; font-size: 11px;">${r.barangay_name || 'Unresolved'}</td>
        <td style="padding: 7px 10px; border-bottom: 1px solid #e0e0e0; font-size: 11px;">${new Date(r.request_time).toLocaleString()}</td>
        <td style="padding: 7px 10px; border-bottom: 1px solid #e0e0e0; font-size: 11px;">${r.agency ? (r.agency + (r.unit_name ? ' (' + r.unit_name + ')' : '')) : '—'}</td>
        <td style="padding: 7px 10px; border-bottom: 1px solid #e0e0e0; font-size: 11px;">${r.dispatched_by_name ? 'Disp: ' + r.dispatched_by_name : ''}${r.resolved_by_name ? (r.dispatched_by_name ? '<br>' : '') + 'Res: ' + r.resolved_by_name : ''}</td>
        <td style="padding: 7px 10px; border-bottom: 1px solid #e0e0e0; text-align: center; font-size: 11px;">
          <span style="display: inline-block; padding: 2px 7px; border-radius: 4px; font-weight: bold; font-size: 10px; background: ${r.status === 'Resolved' ? '#e8f5e9' : '#f5f5f5'}; color: ${r.status === 'Resolved' ? '#2e7d32' : '#616161'};">
            ${r.status}
          </span>
          ${r.is_false_alarm ? '<span style="display: inline-block; margin-left: 3px; padding: 2px 5px; border-radius: 4px; font-weight: bold; font-size: 9px; background: #ffebee; color: #c62828;">FALSE ALARM</span>' : ''}
        </td>
      </tr>
    `).join('');

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${this.exportReportTitle} - ${new Date().toISOString().slice(0, 10)}</title>
        <style>
          @page { size: landscape; margin: 12mm 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; margin: 0; padding: 15px; font-size: 11.5px; }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2.5px solid #c62828; padding-bottom: 12px; margin-bottom: 14px; }
          .header-left { display: flex; align-items: center; gap: 14px; }
          .logo-img { width: 48px; height: 48px; border-radius: 8px; object-fit: contain; box-shadow: 0 2px 6px rgba(0,0,0,0.15); }
          .title-box h1 { margin: 0; font-size: 16px; text-transform: uppercase; color: #c62828; letter-spacing: 0.5px; font-weight: 800; }
          .title-box p { margin: 3px 0 0; font-size: 11px; color: #4b5563; font-weight: 600; }
          .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f9fafb; padding: 10px 14px; border-radius: 8px; margin-bottom: 14px; border: 1px solid #e5e7eb; }
          .meta-item { font-size: 11px; }
          .meta-label { color: #6b7280; text-transform: uppercase; font-size: 9px; font-weight: 800; margin-bottom: 2px; }
          .meta-val { font-weight: 700; color: #111827; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background: #f3f4f6; color: #374151; font-weight: 800; font-size: 10.5px; text-transform: uppercase; padding: 8px 10px; border-bottom: 2px solid #d1d5db; text-align: left; }
          tr:nth-child(even) { background-color: #fafbfc; }
          .remarks-banner { background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; padding: 8px 12px; border-radius: 6px; font-size: 11px; color: #92400e; margin-bottom: 12px; }
          .footer { margin-top: 26px; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 14px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #6b7280; }
          .sig-box { text-align: center; border-top: 1.5px solid #111827; padding-top: 4px; width: 200px; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <img src="/assets/icon/logo.jpg" alt="MDRRMO Logo" class="logo-img" onerror="this.style.display='none';" />
            <div class="title-box">
              <h1>${this.exportReportTitle}</h1>
              <p>${this.exportOfficeName}</p>
            </div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #4b5563;">
            <div><b>Generated:</b> ${nowStr}</div>
            <div><b>Signatory:</b> ${adminName}</div>
          </div>
        </div>

        ${this.exportRemarks ? `<div class="remarks-banner"><b>Operations Note:</b> ${this.exportRemarks}</div>` : ''}

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
            <div class="meta-label">Classification</div>
            <div class="meta-val">Official Archive Situational Report</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="text-align: center; width: 32px;">#</th>
              <th>Incident Type</th>
              <th>Citizen Reporter</th>
              <th>Contact Number</th>
              <th>Barangay</th>
              <th>Date & Time Reported</th>
              <th>Assigned Unit</th>
              <th>Handled By</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          <div>
            <div><b>MDRRMO Emergency Response System</b> • Confidential Government Document</div>
            <div style="margin-top: 2px;">Municipal Hall Compound, San Isidro, Nueva Ecija (SINE)</div>
          </div>
          <div style="display: flex; gap: 36px;">
            <div class="sig-box">
              <div style="font-weight: 700; color: #111827; font-size: 11px;">${adminName}</div>
              <div style="color: #4b5563; font-size: 9.5px; text-transform: uppercase;">${role}</div>
              <div style="color: #9ca3af; font-size: 8.5px; margin-top: 2px;">Prepared By</div>
            </div>
            <div class="sig-box">
              <div style="font-weight: 700; color: #111827; font-size: 11px;">Municipal Disaster Risk Reduction Officer</div>
              <div style="color: #4b5563; font-size: 9.5px; text-transform: uppercase;">Head of Office / Incident Commander</div>
              <div style="color: #9ca3af; font-size: 8.5px; margin-top: 2px;">Approved & Certified Correct</div>
            </div>
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
    } else {
      this.ui.showToast('Please allow popups to generate and print PDF reports.', 'warning');
    }
    this.closeExportModal();
  }

  clearAllFilters(): void {
    this.archiveFilter = 'all';
    this.archiveTypeFilter = 'all';
    this.archiveBarangayFilter = [];
    this.archiveDateFilter = null;
  }

  markFalseAlarm(requestId: number, citizenName: string) {
    this.ui.confirm({
      title: 'Mark as False Alarm',
      message: `Mark this report by ${citizenName} as a false alarm? This will add a strike to their account. At 3 strikes, their account is automatically suspended.`,
      icon: 'alert',
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
