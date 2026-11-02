import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonButton,
  IonList, IonItem, IonLabel, IonPopover, IonBadge
} from '@ionic/angular/standalone';
import Chart from 'chart.js/auto';
import { ApiService } from '../../../../../core/services/api';
import { UtcDatePipe } from '../../../../../shared/pipes/utc-date.pipe';
import { DateRangeFilterComponent } from '../../../../../shared/components/date-range-filter/date-range-filter.component';
import { FilterSummaryBarComponent } from '../../../../../shared/components/filter-summary-bar/filter-summary-bar.component';
import { DateFilterValue, matchesDateFilter, formatDateFilterLabel } from '../../../../../shared/utils/date-filter.util';
import { BARANGAYS } from '../../../../../shared/constants/barangays';
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';
import { CustomTooltipDirective } from '../../../../../shared/directives/custom-tooltip.directive';

@Component({
  selector: 'app-analytics-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonButton,
    IonList, IonItem, IonLabel, IonPopover, IonBadge,
    UtcDatePipe, DateRangeFilterComponent, FilterSummaryBarComponent,
    AppIconComponent, CustomTooltipDirective
  ],
  templateUrl: './analytics.panel.html',
  styleUrl: './analytics.panel.scss',
})
export class AnalyticsPanel implements OnInit, OnDestroy {

  analyticsData: any = { daily_stats: [], type_stats: [], recent_records: [], barangay_stats: [], hazard_stats: [], hazard_daily_stats: [], hazard_barangay_stats: [] };
  analyticsTab: 'emergency' | 'hazard' = 'emergency';
  trendChartType: 'bar' | 'line' = 'bar';
  chartRange = 1;

  readonly barangayOptions = BARANGAYS;

  activeTypeFilter: string | null = null;
  activeBarangayFilter: number | null = null;
  analyticsDateFilter: DateFilterValue | null = null;

  filteredAnalyticsRecords: any[] = [];
  activeFilterChips: string[] = [];
  isLoading = false;

  private trendChartInstance: any = null;
  private typeChartInstance: any = null;
  private barangayChartInstance: any = null;
  private hazardTrendChartInstance: any = null;
  private hazardTypeChartInstance: any = null;
  private hazardBarangayChartInstance: any = null;
  private analyticsSub?: any = null;

  constructor(
    public api: ApiService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.loadAnalytics();
  }

  ngOnDestroy() {
    if (this.analyticsSub) {
      this.analyticsSub.unsubscribe();
      this.analyticsSub = null;
    }
    this.destroyAllCharts();
  }

  private destroyAllCharts() {
    this.ngZone.runOutsideAngular(() => {
      if (this.trendChartInstance)          { try { this.trendChartInstance.destroy(); } catch (_) {} this.trendChartInstance = null; }
      if (this.typeChartInstance)           { try { this.typeChartInstance.destroy(); } catch (_) {} this.typeChartInstance = null; }
      if (this.barangayChartInstance)       { try { this.barangayChartInstance.destroy(); } catch (_) {} this.barangayChartInstance = null; }
      if (this.hazardTrendChartInstance)    { try { this.hazardTrendChartInstance.destroy(); } catch (_) {} this.hazardTrendChartInstance = null; }
      if (this.hazardTypeChartInstance)     { try { this.hazardTypeChartInstance.destroy(); } catch (_) {} this.hazardTypeChartInstance = null; }
      if (this.hazardBarangayChartInstance) { try { this.hazardBarangayChartInstance.destroy(); } catch (_) {} this.hazardBarangayChartInstance = null; }
    });
  }

  setChartRange(days: number) {
    if (this.chartRange === days && !this.analyticsDateFilter) return;
    this.chartRange = days;
    this.analyticsDateFilter = null;
    this.loadAnalytics();
  }

  onAnalyticsDateFilterChange(value: DateFilterValue | null) {
    if (value === null) {
      this.setChartRange(1);
    } else {
      this.analyticsDateFilter = value;
      this.updateFilteredRecords();
    }
  }

  loadAnalytics() {
    if (this.analyticsSub) {
      this.analyticsSub.unsubscribe();
      this.analyticsSub = null;
    }
    this.isLoading = true;
    this.analyticsSub = this.api.getAnalytics(this.chartRange).subscribe({
      next: (res: any) => {
        this.analyticsData = res || { daily_stats: [], type_stats: [], recent_records: [], barangay_stats: [], hazard_stats: [], hazard_daily_stats: [], hazard_barangay_stats: [] };
        this.activeTypeFilter = null;
        this.activeBarangayFilter = null;
        this.updateFilteredRecords();
        this.isLoading = false;
        this.cdr.detectChanges();
        setTimeout(() => {
          if (this.analyticsTab === 'emergency') {
            this.renderCharts();
          } else {
            this.renderHazardCharts();
          }
        }, 50);
      },
      error: (err: any) => {
        console.error('[AnalyticsPanel] getAnalytics error:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  switchAnalyticsTab(tab: 'emergency' | 'hazard') {
    if (this.analyticsTab === tab) return;
    this.analyticsTab = tab;
    this.destroyAllCharts();
    this.cdr.detectChanges();
    setTimeout(() => {
      if (tab === 'emergency') {
        this.renderCharts();
      } else {
        this.renderHazardCharts();
      }
    }, 50);
  }

  toggleChartType() {
    this.trendChartType = this.trendChartType === 'bar' ? 'line' : 'bar';
    if (this.analyticsTab === 'emergency') {
      this.renderCharts();
    } else {
      this.renderHazardCharts();
    }
  }

  updateFilteredRecords() {
    const raw = this.analyticsData.recent_records || [];
    this.filteredAnalyticsRecords = raw.filter((r: any) => this.matchesAnalyticsFilter(r));

    const chips: string[] = [];
    if (this.activeTypeFilter) chips.push(this.activeTypeFilter);
    if (this.activeBarangayFilter) chips.push(this.barangayOptions.find(b => b.id === this.activeBarangayFilter)?.name || '');
    if (this.analyticsDateFilter) chips.push(formatDateFilterLabel(this.analyticsDateFilter));
    this.activeFilterChips = chips;
  }

  matchesAnalyticsFilter(r: any): boolean {
    const recordType    = r.incident_name || r.hazard_type;
    const matchType     = !this.activeTypeFilter || recordType === this.activeTypeFilter;
    const matchBarangay = !this.activeBarangayFilter || r.barangay_id === this.activeBarangayFilter;
    const dateField     = r.request_time || r.created_at;
    const matchDate     = matchesDateFilter(dateField, this.analyticsDateFilter);
    return matchType && matchBarangay && matchDate;
  }

  trackByRequestId(_index: number, r: any): number {
    return r.request_id || r.hazard_id || _index;
  }

  filterListByType(type: string) {
    this.activeTypeFilter = this.activeTypeFilter === type ? null : type;
    this.updateFilteredRecords();
  }

  filterListByBarangay(barangayName: string) {
    const foundId = this.barangayOptions.find(b => b.name === barangayName)?.id ?? null;
    this.activeBarangayFilter = this.activeBarangayFilter === foundId ? null : foundId;
    this.updateFilteredRecords();
  }

  filterListByDate(date: string) {
    this.analyticsDateFilter = { mode: 'single', dates: [date] };
    this.updateFilteredRecords();
  }

  clearAllFilters() {
    this.activeTypeFilter = null;
    this.activeBarangayFilter = null;
    this.analyticsDateFilter = null;
    this.updateFilteredRecords();
  }

  renderCharts() {
    this.ngZone.runOutsideAngular(() => {
      const trendCanvas    = document.getElementById('trendChart')    as HTMLCanvasElement;
      const typeCanvas     = document.getElementById('typeChart')     as HTMLCanvasElement;
      const barangayCanvas = document.getElementById('barangayChart') as HTMLCanvasElement;
      if (!trendCanvas || !typeCanvas || !barangayCanvas) return;

      if (this.trendChartInstance)    { try { this.trendChartInstance.destroy(); } catch (_) {} this.trendChartInstance = null; }
      if (this.typeChartInstance)     { try { this.typeChartInstance.destroy(); } catch (_) {} this.typeChartInstance = null; }
      if (this.barangayChartInstance) { try { this.barangayChartInstance.destroy(); } catch (_) {} this.barangayChartInstance = null; }

      const daily = this.analyticsData.daily_stats || [];
      const dates = daily.map((d: any) => d.date);
      
      try {
        this.trendChartInstance = new Chart(trendCanvas, {
          type: this.trendChartType,
          data: {
            labels: dates.length > 0 ? dates : ['No records'],
            datasets: [
              { label: 'Fire',    data: daily.map((d: any) => Number(d.fire)    || 0), backgroundColor: 'rgba(235,68,90,0.6)',  borderColor: '#eb445a', borderWidth: 2, tension: 0.2 },
              { label: 'Flood',   data: daily.map((d: any) => Number(d.flood)   || 0), backgroundColor: 'rgba(56,128,255,0.6)',  borderColor: '#3880ff', borderWidth: 2, tension: 0.2 },
              { label: 'Medical', data: daily.map((d: any) => Number(d.medical) || 0), backgroundColor: 'rgba(45,211,111,0.6)',  borderColor: '#2dd36f', borderWidth: 2, tension: 0.2 },
              { label: 'Crime',   data: daily.map((d: any) => Number(d.crime)   || 0), backgroundColor: 'rgba(181,95,230,0.6)',  borderColor: '#bc6fff', borderWidth: 2, tension: 0.2 },
              { label: 'Others',  data: daily.map((d: any) => Number(d.others)  || 0), backgroundColor: 'rgba(146,148,156,0.6)', borderColor: '#92949c', borderWidth: 2, tension: 0.2 }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            resizeDelay: 150,
            animation: { duration: 600, easing: 'easeOutQuart' },
            scales: { y: { ticks: { stepSize: 1 }, beginAtZero: true } },
            onClick: (_e, elements) => {
              if (elements.length > 0 && dates[elements[0].index]) {
                this.ngZone.run(() => {
                  this.filterListByDate(dates[elements[0].index]);
                });
              }
            }
          }
        });
      } catch (e) {
        console.warn('trendChart init warning:', e);
      }

      const typeStats = this.analyticsData.type_stats || [];
      const types = typeStats.map((t: any) => t.incident_name);
      const typeTotals = typeStats.map((t: any) => Number(t.total) || 0);

      try {
        this.typeChartInstance = new Chart(typeCanvas, {
          type: 'doughnut',
          data: {
            labels: types.length > 0 ? types : ['No records'],
            datasets: [{
              data: typeTotals.length > 0 ? typeTotals : [1],
              backgroundColor: typeTotals.length > 0 ? ['#eb445a','#3880ff','#2dd36f','#bc6fff'] : ['#e0e0e0'],
              hoverOffset: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            resizeDelay: 150,
            animation: { animateRotate: true, animateScale: true, duration: 600, easing: 'easeOutQuart' },
            onClick: (_e, elements) => {
              if (elements.length > 0 && types[elements[0].index]) {
                this.ngZone.run(() => {
                  this.filterListByType(types[elements[0].index]);
                });
              }
            }
          }
        });
      } catch (e) {
        console.warn('typeChart init warning:', e);
      }

      const bgyStats = this.analyticsData.barangay_stats || [];
      const barangayNames  = bgyStats.map((b: any) => b.barangay_name);
      const barangayTotals = bgyStats.map((b: any) => Number(b.total) || 0);

      try {
        this.barangayChartInstance = new Chart(barangayCanvas, {
          type: 'doughnut',
          data: {
            labels: barangayNames.length > 0 ? barangayNames : ['No records'],
            datasets: [{
              data: barangayTotals.length > 0 ? barangayTotals : [1],
              backgroundColor: barangayTotals.length > 0 ? ['#eb445a','#3880ff','#2dd36f','#bc6fff','#ffc409','#92949c','#e0ac00','#5260ff','#f4a942'] : ['#e0e0e0'],
              hoverOffset: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            resizeDelay: 150,
            animation: { animateRotate: true, animateScale: true, duration: 600, easing: 'easeOutQuart' },
            onClick: (_e, elements) => {
              if (elements.length > 0 && barangayNames[elements[0].index]) {
                this.ngZone.run(() => {
                  this.filterListByBarangay(barangayNames[elements[0].index]);
                });
              }
            }
          }
        });
      } catch (e) {
        console.warn('barangayChart init warning:', e);
      }
    });
  }

  renderHazardCharts() {
    this.ngZone.runOutsideAngular(() => {
      const tc = document.getElementById('hazardTrendChart')    as HTMLCanvasElement;
      const dc = document.getElementById('hazardTypeChart')     as HTMLCanvasElement;
      const bc = document.getElementById('hazardBarangayChart') as HTMLCanvasElement;
      if (!tc || !dc || !bc) return;

      if (this.hazardTrendChartInstance)    { try { this.hazardTrendChartInstance.destroy(); } catch (_) {} this.hazardTrendChartInstance = null; }
      if (this.hazardTypeChartInstance)     { try { this.hazardTypeChartInstance.destroy(); } catch (_) {} this.hazardTypeChartInstance = null; }
      if (this.hazardBarangayChartInstance) { try { this.hazardBarangayChartInstance.destroy(); } catch (_) {} this.hazardBarangayChartInstance = null; }

      const hazDaily = this.analyticsData.hazard_daily_stats || [];
      const dates = hazDaily.map((d: any) => d.date);

      try {
        this.hazardTrendChartInstance = new Chart(tc, {
          type: this.trendChartType,
          data: {
            labels: dates.length > 0 ? dates : ['No records'],
            datasets: [
              { label: 'Flood',       data: hazDaily.map((d: any) => Number(d.flood)      || 0), backgroundColor: 'rgba(56,128,255,0.6)',  borderColor: '#3880ff', borderWidth: 2, tension: 0.2 },
              { label: 'Road Issue',  data: hazDaily.map((d: any) => Number(d.road)       || 0), backgroundColor: 'rgba(255,196,9,0.6)',   borderColor: '#ffc409', borderWidth: 2, tension: 0.2 },
              { label: 'Fallen Tree', data: hazDaily.map((d: any) => Number(d.tree)       || 0), backgroundColor: 'rgba(45,211,111,0.6)',  borderColor: '#2dd36f', borderWidth: 2, tension: 0.2 },
              { label: 'Electrical',  data: hazDaily.map((d: any) => Number(d.electrical) || 0), backgroundColor: 'rgba(235,68,90,0.6)',   borderColor: '#eb445a', borderWidth: 2, tension: 0.2 },
              { label: 'Others',      data: hazDaily.map((d: any) => Number(d.others)     || 0), backgroundColor: 'rgba(146,148,156,0.6)', borderColor: '#92949c', borderWidth: 2, tension: 0.2 }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            resizeDelay: 150,
            animation: { duration: 600, easing: 'easeOutQuart' },
            scales: { y: { ticks: { stepSize: 1 }, beginAtZero: true } },
            onClick: (_e, elements) => {
              if (elements.length > 0 && dates[elements[0].index]) {
                this.ngZone.run(() => {
                  this.filterListByDate(dates[elements[0].index]);
                });
              }
            }
          }
        });
      } catch (e) {
        console.warn('hazardTrendChart init warning:', e);
      }

      const hazStats = this.analyticsData.hazard_stats || [];
      const types  = hazStats.map((t: any) => t.hazard_type || 'Others');
      const counts = hazStats.map((t: any) => Number(t.total) || 0);

      try {
        this.hazardTypeChartInstance = new Chart(dc, {
          type: 'doughnut',
          data: {
            labels: types.length > 0 ? types : ['No records'],
            datasets: [{
              data: counts.length > 0 ? counts : [1],
              backgroundColor: counts.length > 0 ? ['#3880ff','#ffc409','#2dd36f','#eb445a','#92949c','#bc6fff','#e0ac00'] : ['#e0e0e0'],
              hoverOffset: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            resizeDelay: 150,
            animation: { animateRotate: true, animateScale: true, duration: 600, easing: 'easeOutQuart' },
            onClick: (_e, elements) => {
              if (elements.length > 0 && types[elements[0].index]) {
                this.ngZone.run(() => {
                  this.filterListByType(types[elements[0].index]);
                });
              }
            }
          }
        });
      } catch (e) {
        console.warn('hazardTypeChart init warning:', e);
      }

      const hazBgyStats = this.analyticsData.hazard_barangay_stats || [];
      const hazBarangayNames  = hazBgyStats.map((b: any) => b.barangay_name);
      const hazBarangayTotals = hazBgyStats.map((b: any) => Number(b.total) || 0);

      try {
        this.hazardBarangayChartInstance = new Chart(bc, {
          type: 'doughnut',
          data: {
            labels: hazBarangayNames.length > 0 ? hazBarangayNames : ['No records'],
            datasets: [{
              data: hazBarangayTotals.length > 0 ? hazBarangayTotals : [1],
              backgroundColor: hazBarangayTotals.length > 0 ? ['#eb445a','#3880ff','#2dd36f','#bc6fff','#ffc409','#92949c','#e0ac00','#5260ff','#f4a942'] : ['#e0e0e0'],
              hoverOffset: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            resizeDelay: 150,
            animation: { animateRotate: true, animateScale: true, duration: 600, easing: 'easeOutQuart' },
            onClick: (_e, elements) => {
              if (elements.length > 0 && hazBarangayNames[elements[0].index]) {
                this.ngZone.run(() => {
                  this.filterListByBarangay(hazBarangayNames[elements[0].index]);
                });
              }
            }
          }
        });
      } catch (e) {
        console.warn('hazardBarangayChart init warning:', e);
      }
    });
  }

  
  get exportPreviewList(): any[] {
    return (this.analyticsTab === 'emergency' ? this.analyticsData.type_stats : this.analyticsData.hazard_stats) || [];
  }

  showExportModal = false;
  exportReportTitle = 'MDRRMO San Isidro — Executive Analytics & Operations Intelligence Report';
  exportOfficeName = 'Municipal Disaster Risk Reduction and Management Office (SINE - San Isidro, Nueva Ecija)';
  exportPreparedBy = 'MDRRMO Data Officer';
  exportDesignation = 'MDRRMO Operations & Statistics Lead';
  exportRemarks = 'Certified executive operations and incident statistics summary for municipal emergency preparedness and resource allocation.';

  openExportModal(): void {
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
    const role = this.exportDesignation || 'MDRRMO Operations Lead';
    const nowStr = new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const isEmergency = this.analyticsTab === 'emergency';
    const typeList = isEmergency ? (this.analyticsData.type_stats || []) : (this.analyticsData.hazard_stats || []);
    const brgyList = isEmergency ? (this.analyticsData.barangay_stats || []) : (this.analyticsData.hazard_barangay_stats || []);
    const records = this.filteredAnalyticsRecords || [];

    const dateScopeStr = this.analyticsDateFilter ? formatDateFilterLabel(this.analyticsDateFilter) : (this.chartRange === 1 ? 'Today (24 Hours)' : `Last ${this.chartRange} Days`);

    const typeRowsHtml = typeList.map((t: any) => `
      <tr>
        <td style="padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-weight: 700;">${t.incident_name || t.hazard_type || 'Unspecified'}</td>
        <td style="padding: 7px 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 800; color: #c62828;">${t.count}</td>
      </tr>
    `).join('');

    const brgyRowsHtml = brgyList.map((b: any) => `
      <tr>
        <td style="padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${b.barangay_name || 'San Isidro (General Area)'}</td>
        <td style="padding: 7px 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 800; color: #111827;">${b.count}</td>
      </tr>
    `).join('');

    const topBarangay = brgyList.length > 0 ? (brgyList[0].barangay_name || 'San Isidro') : 'None Recorded';

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
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
          .kpi-card { background: #f9fafb; padding: 12px 14px; border-radius: 8px; border: 1px solid #e5e7eb; }
          .kpi-label { color: #6b7280; text-transform: uppercase; font-size: 9px; font-weight: 800; margin-bottom: 3px; }
          .kpi-val { font-size: 16px; font-weight: 800; color: #c62828; }
          .two-col-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 10px; }
          table { width: 100%; border-collapse: collapse; }
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
            <div><b>Reporting Lead:</b> ${adminName}</div>
          </div>
        </div>

        ${this.exportRemarks ? `<div class="remarks-banner"><b>Operational Intelligence Remarks:</b> ${this.exportRemarks}</div>` : ''}

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Scope Focus</div>
            <div class="kpi-val" style="font-size: 13px; color: #111827;">${isEmergency ? 'Emergency Incidents' : 'Public Hazard Reports'}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Reporting Period</div>
            <div class="kpi-val" style="font-size: 13px; color: #111827;">${dateScopeStr}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Logged Records</div>
            <div class="kpi-val">${records.length} Records</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Highest Concentration</div>
            <div class="kpi-val" style="font-size: 13px; color: #111827;">${topBarangay}</div>
          </div>
        </div>

        <div class="two-col-grid">
          <div>
            <h3 style="margin: 0 0 6px 0; font-size: 11.5px; font-weight: 800; text-transform: uppercase; color: #374151;">Incident Distribution by Category</h3>
            <table>
              <thead>
                <tr>
                  <th>Category / Classification</th>
                  <th style="text-align: right;">Count</th>
                </tr>
              </thead>
              <tbody>
                ${typeRowsHtml || '<tr><td colspan="2" style="padding:10px; text-align:center; color:#9ca3af;">No recorded types</td></tr>'}
              </tbody>
            </table>
          </div>

          <div>
            <h3 style="margin: 0 0 6px 0; font-size: 11.5px; font-weight: 800; text-transform: uppercase; color: #374151;">Geographic Distribution by Barangay</h3>
            <table>
              <thead>
                <tr>
                  <th>Barangay Jurisdiction</th>
                  <th style="text-align: right;">Incidents</th>
                </tr>
              </thead>
              <tbody>
                ${brgyRowsHtml || '<tr><td colspan="2" style="padding:10px; text-align:center; color:#9ca3af;">No recorded barangays</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <div class="footer">
          <div>
            <div><b>MDRRMO Emergency Operations Center</b> • Statistical Intelligence Assessment</div>
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
              <div style="color: #4b5563; font-size: 9.5px; text-transform: uppercase;">Head of Office / MDRRMC Executive</div>
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
      console.warn('Popup blocked');
    }
    this.closeExportModal();
  }

}
