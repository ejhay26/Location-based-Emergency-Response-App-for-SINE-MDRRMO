import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonButton,
  IonList, IonItem, IonLabel, IonPopover, IonBadge,
  IonSegment, IonSegmentButton
} from '@ionic/angular/standalone';
import Chart from 'chart.js/auto';
import { ApiService } from '../../../../../core/services/api';
import { UtcDatePipe } from '../../../../../shared/pipes/utc-date.pipe';
import { DateRangeFilterComponent } from '../../../../../shared/components/date-range-filter/date-range-filter.component';
import { FilterSummaryBarComponent } from '../../../../../shared/components/filter-summary-bar/filter-summary-bar.component';
import { DateFilterValue, matchesDateFilter, formatDateFilterLabel } from '../../../../../shared/utils/date-filter.util';
import { BARANGAYS } from '../../../../../shared/constants/barangays';
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';

@Component({
  selector: 'app-analytics-panel',
  standalone: true,
  imports: [
    CommonModule,
    IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonButton,
    IonList, IonItem, IonLabel, IonPopover, IonBadge,
    IonSegment, IonSegmentButton,
    UtcDatePipe, DateRangeFilterComponent, FilterSummaryBarComponent,
    AppIconComponent
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

  constructor(
    public api: ApiService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    console.log('[AnalyticsPanel] ngOnInit');
    this.loadAnalytics();
  }

  ngOnDestroy() {
    console.log('[AnalyticsPanel] ngOnDestroy');
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
    this.isLoading = true;
    this.api.getAnalytics(this.chartRange).subscribe({
      next: (res: any) => {
        console.log('[AnalyticsPanel] getAnalytics response received');
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
}
