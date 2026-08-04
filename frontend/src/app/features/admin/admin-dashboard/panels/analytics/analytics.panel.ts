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

@Component({
  selector: 'app-analytics-panel',
  standalone: true,
  imports: [
    CommonModule,
    IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonButton,
    IonList, IonItem, IonLabel, IonPopover, IonBadge,
    UtcDatePipe, DateRangeFilterComponent, FilterSummaryBarComponent,
  ],
  templateUrl: './analytics.panel.html',
  styleUrl: './analytics.panel.scss',
})
export class AnalyticsPanel implements OnInit, OnDestroy {

  analyticsData: any = { daily_stats: [], type_stats: [], recent_records: [], hazard_stats: [], hazard_daily_stats: [] };
  analyticsTab: 'emergency' | 'hazard' = 'emergency';
  trendChartType: 'bar' | 'line' = 'bar';
  chartRange = 1;

  // Type-click (chart/popover) and date filters are independent and combine
  // (AND) - e.g. "Fire" + "Aug 1-3" narrows to fires reported in that window.
  activeTypeFilter: string | null = null;
  analyticsDateFilter: DateFilterValue | null = null;

  private trendChartInstance: any;
  private typeChartInstance: any;
  private hazardTrendChartInstance: any;
  private hazardTypeChartInstance: any;

  constructor(public api: ApiService) {}

  ngOnInit() {
    this.loadAnalytics();
  }

  ngOnDestroy() {
    if (this.trendChartInstance)       this.trendChartInstance.destroy();
    if (this.typeChartInstance)        this.typeChartInstance.destroy();
    if (this.hazardTrendChartInstance) this.hazardTrendChartInstance.destroy();
    if (this.hazardTypeChartInstance)  this.hazardTypeChartInstance.destroy();
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
    return (this.analyticsData.recent_records || []).filter((r: any) => {
      const matchType = !this.activeTypeFilter || r.incident_name === this.activeTypeFilter;
      const matchDate = matchesDateFilter(r.request_time, this.analyticsDateFilter);
      return matchType && matchDate;
    });
  }

  /** Chip labels for the active-filters summary bar; empty array hides the bar. */
  get activeFilterChips(): string[] {
    const chips: string[] = [];
    if (this.activeTypeFilter)   chips.push(this.activeTypeFilter);
    if (this.analyticsDateFilter) chips.push(formatDateFilterLabel(this.analyticsDateFilter));
    return chips;
  }

  filterListByType(type: string) {
    this.activeTypeFilter = type;
  }

  /** Quick filter triggered by clicking a bar/point on the trend chart - narrows to that single day. */
  filterListByDate(date: string) {
    this.analyticsDateFilter = { mode: 'single', dates: [date] };
  }

  clearAllFilters() {
    this.activeTypeFilter = null;
    this.analyticsDateFilter = null;
  }

  renderCharts() {
    const trendCanvas = document.getElementById('trendChart') as HTMLCanvasElement;
    const typeCanvas  = document.getElementById('typeChart')  as HTMLCanvasElement;
    if (!trendCanvas || !typeCanvas) return;
    if (this.trendChartInstance) this.trendChartInstance.destroy();
    if (this.typeChartInstance)  this.typeChartInstance.destroy();
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
  }

  renderHazardCharts() {
    const tc = document.getElementById('hazardTrendChart') as HTMLCanvasElement;
    const dc = document.getElementById('hazardTypeChart')  as HTMLCanvasElement;
    if (!tc || !dc) return;
    if (this.hazardTrendChartInstance) this.hazardTrendChartInstance.destroy();
    if (this.hazardTypeChartInstance)  this.hazardTypeChartInstance.destroy();
    const dates  = (this.analyticsData.hazard_daily_stats || []).map((d: any) => d.date);
    const totals = (this.analyticsData.hazard_daily_stats || []).map((d: any) => Number(d.total) || 0);
    this.hazardTrendChartInstance = new Chart(tc, {
      type: this.trendChartType,
      data: { labels: dates, datasets: [{ label: 'Hazard Reports', data: totals, backgroundColor: 'rgba(255,196,9,0.6)', borderColor: '#ffc409', borderWidth: 2, tension: 0.2 }] },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { stepSize: 1 }, beginAtZero: true } } }
    });
    const types  = (this.analyticsData.hazard_stats || []).map((t: any) => t.hazard_type || 'Unknown');
    const counts = (this.analyticsData.hazard_stats || []).map((t: any) => t.total);
    this.hazardTypeChartInstance = new Chart(dc, {
      type: 'doughnut',
      data: { labels: types, datasets: [{ data: counts, backgroundColor: ['#3880ff','#ffc409','#e0ac00','#2dd36f','#92949c'], hoverOffset: 10 }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}
