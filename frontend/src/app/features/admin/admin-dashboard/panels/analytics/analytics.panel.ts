import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { RevealAnimateDirective } from '../../../../../shared/directives/reveal-animate.directive';
import { ListEnterDirective } from '../../../../../shared/directives/list-enter.directive';
import { BARANGAYS } from '../../../../../shared/constants/barangays';

@Component({
  selector: 'app-analytics-panel',
  standalone: true,
  imports: [
    CommonModule,
    IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonButton,
    IonList, IonItem, IonLabel, IonPopover, IonBadge,
    UtcDatePipe, DateRangeFilterComponent, FilterSummaryBarComponent, RevealAnimateDirective, ListEnterDirective,
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

  // Type-click (chart/popover), barangay, and date filters are independent
  // and combine (AND) - e.g. "Fire" + "Poblacion" + "Aug 1-3" narrows to
  // fires in Poblacion reported in that window.
  activeTypeFilter: string | null = null;
  /** Selected barangay_id, or null (no filter). A null record barangay_id (unresolved location) never matches a specific filter. */
  activeBarangayFilter: number | null = null;
  analyticsDateFilter: DateFilterValue | null = null;

  private trendChartInstance: any;
  private typeChartInstance: any;
  private barangayChartInstance: any;
  private hazardTrendChartInstance: any;
  private hazardTypeChartInstance: any;
  private hazardBarangayChartInstance: any;

  constructor(public api: ApiService) {}

  ngOnInit() {
    this.loadAnalytics();
  }

  ngOnDestroy() {
    if (this.trendChartInstance)          this.trendChartInstance.destroy();
    if (this.typeChartInstance)           this.typeChartInstance.destroy();
    if (this.barangayChartInstance)       this.barangayChartInstance.destroy();
    if (this.hazardTrendChartInstance)    this.hazardTrendChartInstance.destroy();
    if (this.hazardTypeChartInstance)     this.hazardTypeChartInstance.destroy();
    if (this.hazardBarangayChartInstance) this.hazardBarangayChartInstance.destroy();
  }

  setChartRange(days: number) {
    this.chartRange = days;
    this.loadAnalytics(); // loadAnalytics() clears analyticsDateFilter, re-focusing the preset row
  }

  /** Applying a custom date from the calendar re-focuses the calendar chip and deselects the Today/7/30/90 presets (handled reactively in the template). Clearing it falls back to "Today", not whatever preset happened to be active before. */
  onAnalyticsDateFilterChange(value: DateFilterValue | null) {
    if (value === null) {
      this.setChartRange(1);
    } else {
      this.analyticsDateFilter = value;
    }
  }

  loadAnalytics() {
    this.api.getAnalytics(this.chartRange).subscribe((res: any) => {
      this.analyticsData = res;
      this.activeTypeFilter = null;
      this.activeBarangayFilter = null;
      this.analyticsDateFilter = null;
      this.analyticsTab === 'emergency' ? this.renderCharts() : this.renderHazardCharts();
    });
  }

  switchAnalyticsTab(tab: 'emergency' | 'hazard') {
    this.analyticsTab = tab;
    setTimeout(() => { tab === 'emergency' ? this.renderCharts() : this.renderHazardCharts(); }, 100);
  }

  // Redraws whichever trend/type pair is currently visible, since both
  // chart types (bar/line) are shared across the emergency and hazard tabs.
  toggleChartType() {
    this.trendChartType = this.trendChartType === 'bar' ? 'line' : 'bar';
    this.analyticsTab === 'emergency' ? this.renderCharts() : this.renderHazardCharts();
  }

  /** The visible record list: recent_records narrowed by whichever filters (type/date) are active, combined with AND. */
  get filteredAnalyticsRecords(): any[] {
    return (this.analyticsData.recent_records || []).filter((r: any) => this.matchesAnalyticsFilter(r));
  }

  /**
   * Filter shrink-and-reflow (RevealAnimateDirective, permanent-mount
   * pattern) — Trend Logs is a single-column list, same as Log
   * Archive/Verifications, so it uses the simpler height-collapse reflow:
   * the template iterates the FULL (unfiltered) recent_records list so
   * every card stays mounted, and this predicate drives each card's
   * [appRevealAnimate] instead of removing non-matching cards outright.
   */
  matchesAnalyticsFilter(r: any): boolean {
    const recordType    = r.incident_name || r.hazard_type;
    const matchType     = !this.activeTypeFilter || recordType === this.activeTypeFilter;
    const matchBarangay = !this.activeBarangayFilter || r.barangay_id === this.activeBarangayFilter;
    const dateField     = r.request_time || r.created_at;
    const matchDate     = matchesDateFilter(dateField, this.analyticsDateFilter);
    return matchType && matchBarangay && matchDate;
  }

  trackByRequestId(_index: number, r: any): number {
    return r.request_id || r.hazard_id;
  }

  /** Chip labels for the active-filters summary bar; empty array hides the bar. */
  get activeFilterChips(): string[] {
    const chips: string[] = [];
    if (this.activeTypeFilter)   chips.push(this.activeTypeFilter);
    if (this.activeBarangayFilter) chips.push(this.barangayOptions.find(b => b.id === this.activeBarangayFilter)?.name || '');
    if (this.analyticsDateFilter) chips.push(formatDateFilterLabel(this.analyticsDateFilter));
    return chips;
  }

  filterListByType(type: string) {
    this.activeTypeFilter = type;
  }

  /** Quick filter triggered by clicking a slice on the barangay doughnut chart, or picking one from the filter popover. */
  filterListByBarangay(barangayName: string) {
    this.activeBarangayFilter = this.barangayOptions.find(b => b.name === barangayName)?.id ?? null;
  }

  /** Quick filter triggered by clicking a bar/point on the trend chart - narrows to that single day. */
  filterListByDate(date: string) {
    this.analyticsDateFilter = { mode: 'single', dates: [date] };
  }

  clearAllFilters() {
    this.activeTypeFilter = null;
    this.activeBarangayFilter = null;
    this.analyticsDateFilter = null;
  }

  renderCharts() {
    const trendCanvas    = document.getElementById('trendChart')    as HTMLCanvasElement;
    const typeCanvas     = document.getElementById('typeChart')     as HTMLCanvasElement;
    const barangayCanvas = document.getElementById('barangayChart') as HTMLCanvasElement;
    if (!trendCanvas || !typeCanvas || !barangayCanvas) return;
    if (this.trendChartInstance)    this.trendChartInstance.destroy();
    if (this.typeChartInstance)     this.typeChartInstance.destroy();
    if (this.barangayChartInstance) this.barangayChartInstance.destroy();
    const dates = this.analyticsData.daily_stats.map((d: any) => d.date);
    this.trendChartInstance = new Chart(trendCanvas, {
      type: this.trendChartType,
      data: {
        labels: dates,
        datasets: [
          { label: 'Fire',    data: this.analyticsData.daily_stats.map((d: any) => Number(d.fire)    || 0), backgroundColor: 'rgba(235,68,90,0.6)',  borderColor: '#eb445a', borderWidth: 2, tension: 0.2 },
          { label: 'Flood',   data: this.analyticsData.daily_stats.map((d: any) => Number(d.flood)   || 0), backgroundColor: 'rgba(56,128,255,0.6)',  borderColor: '#3880ff', borderWidth: 2, tension: 0.2 },
          { label: 'Medical', data: this.analyticsData.daily_stats.map((d: any) => Number(d.medical) || 0), backgroundColor: 'rgba(45,211,111,0.6)',  borderColor: '#2dd36f', borderWidth: 2, tension: 0.2 },
          { label: 'Crime',   data: this.analyticsData.daily_stats.map((d: any) => Number(d.crime)   || 0), backgroundColor: 'rgba(181,95,230,0.6)',  borderColor: '#bc6fff', borderWidth: 2, tension: 0.2 },
          { label: 'Others',  data: this.analyticsData.daily_stats.map((d: any) => Number(d.others)  || 0), backgroundColor: 'rgba(146,148,156,0.6)', borderColor: '#92949c', borderWidth: 2, tension: 0.2 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { stepSize: 1 }, beginAtZero: true } }, onClick: (_e, elements) => { if (elements.length > 0) this.filterListByDate(dates[elements[0].index]); } }
    });
    const types = this.analyticsData.type_stats.map((t: any) => t.incident_name);
    this.typeChartInstance = new Chart(typeCanvas, {
      type: 'doughnut',
      data: { labels: types, datasets: [{ data: this.analyticsData.type_stats.map((t: any) => t.total), backgroundColor: ['#eb445a','#3880ff','#2dd36f','#bc6fff'], hoverOffset: 10 }] },
      options: { responsive: true, maintainAspectRatio: false, onClick: (_e, elements) => { if (elements.length > 0) this.filterListByType(types[elements[0].index]); } }
    });

    const barangayNames  = (this.analyticsData.barangay_stats || []).map((b: any) => b.barangay_name);
    const barangayTotals = (this.analyticsData.barangay_stats || []).map((b: any) => b.total);
    this.barangayChartInstance = new Chart(barangayCanvas, {
      type: 'doughnut',
      data: { labels: barangayNames, datasets: [{ data: barangayTotals, backgroundColor: ['#eb445a','#3880ff','#2dd36f','#bc6fff','#ffc409','#92949c','#e0ac00','#5260ff','#f4a942'], hoverOffset: 10 }] },
      options: { responsive: true, maintainAspectRatio: false, onClick: (_e, elements) => { if (elements.length > 0) this.filterListByBarangay(barangayNames[elements[0].index]); } }
    });
  }

  renderHazardCharts() {
    const tc = document.getElementById('hazardTrendChart')    as HTMLCanvasElement;
    const dc = document.getElementById('hazardTypeChart')     as HTMLCanvasElement;
    const bc = document.getElementById('hazardBarangayChart') as HTMLCanvasElement;
    if (!tc || !dc || !bc) return;
    if (this.hazardTrendChartInstance)    this.hazardTrendChartInstance.destroy();
    if (this.hazardTypeChartInstance)     this.hazardTypeChartInstance.destroy();
    if (this.hazardBarangayChartInstance) this.hazardBarangayChartInstance.destroy();

    const dates = (this.analyticsData.hazard_daily_stats || []).map((d: any) => d.date);
    this.hazardTrendChartInstance = new Chart(tc, {
      type: this.trendChartType,
      data: {
        labels: dates,
        datasets: [
          { label: 'Flood',       data: (this.analyticsData.hazard_daily_stats || []).map((d: any) => Number(d.flood)      || 0), backgroundColor: 'rgba(56,128,255,0.6)',  borderColor: '#3880ff', borderWidth: 2, tension: 0.2 },
          { label: 'Road Issue',  data: (this.analyticsData.hazard_daily_stats || []).map((d: any) => Number(d.road)       || 0), backgroundColor: 'rgba(255,196,9,0.6)',   borderColor: '#ffc409', borderWidth: 2, tension: 0.2 },
          { label: 'Fallen Tree', data: (this.analyticsData.hazard_daily_stats || []).map((d: any) => Number(d.tree)       || 0), backgroundColor: 'rgba(45,211,111,0.6)',  borderColor: '#2dd36f', borderWidth: 2, tension: 0.2 },
          { label: 'Electrical',  data: (this.analyticsData.hazard_daily_stats || []).map((d: any) => Number(d.electrical) || 0), backgroundColor: 'rgba(235,68,90,0.6)',   borderColor: '#eb445a', borderWidth: 2, tension: 0.2 },
          { label: 'Others',      data: (this.analyticsData.hazard_daily_stats || []).map((d: any) => Number(d.others)     || 0), backgroundColor: 'rgba(146,148,156,0.6)', borderColor: '#92949c', borderWidth: 2, tension: 0.2 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { ticks: { stepSize: 1 }, beginAtZero: true } },
        onClick: (_e, elements) => {
          if (elements.length > 0) this.filterListByDate(dates[elements[0].index]);
        }
      }
    });

    const types  = (this.analyticsData.hazard_stats || []).map((t: any) => t.hazard_type || 'Others');
    const counts = (this.analyticsData.hazard_stats || []).map((t: any) => Number(t.total) || 0);
    this.hazardTypeChartInstance = new Chart(dc, {
      type: 'doughnut',
      data: {
        labels: types,
        datasets: [{
          data: counts,
          backgroundColor: ['#3880ff','#ffc409','#2dd36f','#eb445a','#92949c','#bc6fff','#e0ac00'],
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_e, elements) => {
          if (elements.length > 0) this.filterListByType(types[elements[0].index]);
        }
      }
    });

    const hazBarangayNames  = (this.analyticsData.hazard_barangay_stats || []).map((b: any) => b.barangay_name);
    const hazBarangayTotals = (this.analyticsData.hazard_barangay_stats || []).map((b: any) => Number(b.total) || 0);
    this.hazardBarangayChartInstance = new Chart(bc, {
      type: 'doughnut',
      data: {
        labels: hazBarangayNames,
        datasets: [{
          data: hazBarangayTotals,
          backgroundColor: ['#eb445a','#3880ff','#2dd36f','#bc6fff','#ffc409','#92949c','#e0ac00','#5260ff','#f4a942'],
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_e, elements) => {
          if (elements.length > 0) this.filterListByBarangay(hazBarangayNames[elements[0].index]);
        }
      }
    });
  }
}
