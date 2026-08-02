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

@Component({
  selector: 'app-analytics-panel',
  standalone: true,
  imports: [
    CommonModule,
    IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonButton,
    IonList, IonItem, IonLabel, IonPopover, IonBadge,
    UtcDatePipe
  ],
  templateUrl: './analytics.panel.html',
  styleUrl: './analytics.panel.scss',
})
export class AnalyticsPanel implements OnInit, OnDestroy {

  analyticsData: any = { daily_stats: [], type_stats: [], recent_records: [], hazard_stats: [], hazard_daily_stats: [] };
  analyticsTab: 'emergency' | 'hazard' = 'emergency';
  filteredAnalyticsRecords: any[] = [];
  trendChartType: 'bar' | 'line' = 'bar';
  chartRange = 7;
  currentFilterLabel = 'All Records';

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
    this.loadAnalytics();
  }

  loadAnalytics() {
    this.api.getAnalytics(this.chartRange).subscribe((res: any) => {
      this.analyticsData = res;
      this.filteredAnalyticsRecords = res.recent_records;
      this.currentFilterLabel = 'All Records';
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

  clearFilter() {
    this.filteredAnalyticsRecords = this.analyticsData.recent_records;
    this.currentFilterLabel = 'All Records';
  }

  filterListByType(type: string) {
    this.filteredAnalyticsRecords = this.analyticsData.recent_records.filter((r: any) => r.incident_name === type);
    this.currentFilterLabel = `Filtered: ${type} Emergencies`;
  }

  filterListByDate(date: string) {
    this.filteredAnalyticsRecords = this.analyticsData.recent_records.filter((r: any) => r.request_time.startsWith(date));
    this.currentFilterLabel = `Filtered: Activity on ${date}`;
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
