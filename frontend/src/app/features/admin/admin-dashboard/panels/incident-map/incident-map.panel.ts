import { Component, Input, OnChanges, AfterViewInit, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription, interval, firstValueFrom } from 'rxjs';
import {
  IonCard, IonCardContent, IonButton, IonRadioGroup, IonRadio, IonModal,
  IonHeader, IonToolbar, IonTitle, IonButtons, IonContent,
  IonSegment, IonSegmentButton, IonLabel
} from '@ionic/angular/standalone';
import * as L from 'leaflet';
import { ApiService } from '../../../../../core/services/api';
import { AdminUiService } from '../../admin-ui.service';
import { EchoService } from '../../../../../core/services/echo.service';
import { ProxyImageDirective } from '../../../../../shared/directives/proxy-image.directive';
import { VideoThumbnailDirective } from '../../../../../shared/directives/video-thumbnail.directive';
import { ListEnterDirective } from '../../../../../shared/directives/list-enter.directive';
import { UtcDatePipe } from '../../../../../shared/pipes/utc-date.pipe';
import { BARANGAYS } from '../../../../../shared/constants/barangays';
import { DateRangeFilterComponent } from '../../../../../shared/components/date-range-filter/date-range-filter.component';
import { DateFilterValue, matchesDateFilter } from '../../../../../shared/utils/date-filter.util';
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';

/**
 * Fallback polling interval for the incident map — active continuously as
 * a safety net. When the Reverb WebSocket is connected, events arrive
 * immediately and the 30s poll becomes a silent background reconciliation
 * pass. When disconnected (network blip, mobile background, etc.), the
 * poll is the sole update mechanism. 30s matches decision 54.
 * Replaces the previous 5s setInterval, which was unnecessarily aggressive.
 */
const FALLBACK_POLL_MS = 30_000;

@Component({
  selector: 'app-incident-map-panel',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonCard, IonCardContent, IonButton, IonRadioGroup, IonRadio, IonModal,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonContent,
    IonSegment, IonSegmentButton, IonLabel,
    ProxyImageDirective, VideoThumbnailDirective, ListEnterDirective,
    UtcDatePipe, DateRangeFilterComponent, AppIconComponent
  ],
  templateUrl: './incident-map.panel.html',
  styleUrl: './incident-map.panel.scss',
})
export class IncidentMapPanel implements OnChanges, AfterViewInit, OnDestroy {

  /** Which list is shown in the right-hand column — the map itself always shows both layers. */
  @Input() mode: 'active' | 'hazards' = 'active';

  /** Options for the barangay filter dropdown — the 9 San Isidro barangays, same reference list used elsewhere (registration, admin broadcast targeting). */
  readonly barangayOptions = BARANGAYS;
  /** Selected barangay_id, or 'all'. Filters both the plotted map markers and the right-hand list — a report with a null barangay_id (unresolved location) never matches a specific barangay filter. */
  barangayFilter: number | 'all' = 'all';

  activeRequests: any[] = [];
  activeHazards: any[] = [];
  availableResponders: any[] = [];
  availableVehicles: any[] = [];
  filteredVehicles: any[] = [];

  selectedRequestId: number | null = null;
  previewType: 'emergency' | 'hazard' | null = null;

  mapStyle: 'street' | 'satellite' = 'street';
  private map: any;
  private mapMarkers: any[] = [];
  private streetLayer: any;
  private satelliteLayer: any;
  private bgyLabelsLayer: any;

  private fallbackPollSub?: Subscription;
  private echoEmergencySub?: Subscription;
  private echoHazardSub?: Subscription;

  isDispatchModalOpen = false;
  isDispatching = false;
  dispatchForm = { request_id: null as number | null, responder_id: null, vehicle_id: null };

  selectedBarangays: number[] = [];
  selectedTypes: string[] = [];
  dateFilter = 'all';
  customCalendarFilter: DateFilterValue | null = null;

  private bgyGeoJson: any = null;
  private townBounds: any = null;
  private highlightBgyLayer: any = null;

  emergencyTypeOptions = [
    { id: 'Fire',    label: 'Fire',      icon: 'flame',        color: '#eb445a' },
    { id: 'Flood',   label: 'Flood',     icon: 'droplet',      color: '#3880ff' },
    { id: 'Medical', label: 'Medical',   icon: 'medical',      color: '#2dd36f' },
    { id: 'Crime',   label: 'Crime',     icon: 'shield-alert', color: '#bc6fff' },
    { id: 'Others',  label: 'Others',    icon: 'circle-alert', color: '#ffc409' }
  ];

  hazardTypeOptions = [
    { id: 'Flooded Street',    label: 'Flood',       icon: 'droplet',      color: '#3880ff' },
    { id: 'Road Obstruction',  label: 'Road',        icon: 'hazard',       color: '#e0ac00' },
    { id: 'Fallen Tree',       label: 'Tree',        icon: 'trees',        color: '#2dd36f' },
    { id: 'Downed Wire',       label: 'Wire',        icon: 'zap',          color: '#ffc409' },
    { id: 'Others',            label: 'Others',      icon: 'circle-alert', color: '#eb445a' }
  ];

  dateFilterOptions = [
    { id: 'all',   label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: '7d',    label: '7 Days' },
    { id: '30d',   label: '30 Days' }
  ];

  queueWidth = 390;
  isResizingQueue = false;
  private startX = 0;
  private startWidth = 0;

  constructor(
    private http: HttpClient,
    public api: ApiService,
    public ui: AdminUiService,
    private echo: EchoService,
  ) {
    const savedWidth = localStorage.getItem('admin_map_queue_width');
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (!isNaN(parsed) && parsed >= 300 && parsed <= 650) {
        this.queueWidth = parsed;
      }
    }
  }

  onSplitterMouseDown(event: MouseEvent) {
    event.preventDefault();
    this.isResizingQueue = true;
    this.startX = event.clientX;
    this.startWidth = this.queueWidth;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', this.onSplitterMouseMove);
    window.addEventListener('mouseup', this.onSplitterMouseUp);
  }

  private onSplitterMouseMove = (event: MouseEvent) => {
    if (!this.isResizingQueue) return;
    const delta = this.startX - event.clientX;
    const newWidth = Math.max(300, Math.min(650, this.startWidth + delta));
    this.queueWidth = newWidth;
    if (this.map) {
      this.map.invalidateSize();
    }
  };

  private onSplitterMouseUp = () => {
    if (!this.isResizingQueue) return;
    this.isResizingQueue = false;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', this.onSplitterMouseMove);
    window.removeEventListener('mouseup', this.onSplitterMouseUp);
    localStorage.setItem('admin_map_queue_width', String(this.queueWidth));
    if (this.map) {
      this.map.invalidateSize();
    }
  };

  ngOnChanges(changes: SimpleChanges) {
    if (changes['mode']) {
      this.selectedRequestId = null;
      this.previewType = null;
      this.selectedTypes = [];
      this.plotMarkers();
    }
  }

  ngAfterViewInit() {
    this.loadData();
    setTimeout(() => this.initMap(), 250);

    this.echo.connect();

    this.echoEmergencySub = this.echo.onEmergencyUpdated.subscribe(() => {
      this.loadData();
    });

    this.echoHazardSub = this.echo.onHazardUpdated.subscribe(() => {
      this.loadData();
    });

    this.fallbackPollSub = interval(FALLBACK_POLL_MS).subscribe(() => {
      this.loadData();
    });
  }

  ngOnDestroy() {
    this.fallbackPollSub?.unsubscribe();
    this.echoEmergencySub?.unsubscribe();
    this.echoHazardSub?.unsubscribe();
    window.removeEventListener('mousemove', this.onSplitterMouseMove);
    window.removeEventListener('mouseup', this.onSplitterMouseUp);
    if (this.map) {
      try {
        this.map.remove();
      } catch (e) {
        console.warn('Map teardown warning:', e);
      }
      this.map = null;
    }
  }

  loadData() {
    this.api.getActiveEmergencies().subscribe((res: any) => { this.activeRequests = res; this.plotMarkers(); });
    this.api.getActiveHazards().subscribe((res: any)     => { this.activeHazards  = res; this.plotMarkers(); });
  }

  invalidateMapSize() {
    if (!this.map) return;
    setTimeout(() => this.map.invalidateSize(), 260);
  }

  normalizeBgyName(name: string): string {
    return (name || '')
      .toLowerCase()
      .replace(/\bsto\.?\b/g, 'santo')
      .replace(/\bsta\.?\b/g, 'santa')
      .replace(/[^a-z0-9]/g, '');
  }

  matchesFilters(r: any, isHazard = false): boolean {
    if (this.selectedBarangays.length > 0) {
      if (!r.barangay_id || !this.selectedBarangays.includes(r.barangay_id)) {
        return false;
      }
    }
    if (this.selectedTypes.length > 0) {
      if (isHazard) {
        const hType = (r.hazard_type || '').toLowerCase();
        const matchesAny = this.selectedTypes.some(t => {
          const target = t.toLowerCase();
          if (target === 'others') {
            return !['flood', 'road', 'tree', 'wire'].some(k => hType.includes(k));
          }
          return hType.includes(target.split(' ')[0]);
        });
        if (!matchesAny) return false;
      } else {
        if (!this.selectedTypes.includes(r.incident_name)) return false;
      }
    }
    if (this.customCalendarFilter && this.customCalendarFilter.dates.length > 0) {
      if (!matchesDateFilter(r.request_time || r.created_at, this.customCalendarFilter)) {
        return false;
      }
    } else if (this.dateFilter !== 'all') {
      const itemDate = new Date(r.request_time || r.created_at).getTime();
      const now = Date.now();
      if (this.dateFilter === 'today') {
        const startOfDay = new Date().setHours(0, 0, 0, 0);
        if (itemDate < startOfDay) return false;
      } else if (this.dateFilter === '7d') {
        if (now - itemDate > 7 * 86400000) return false;
      } else if (this.dateFilter === '30d') {
        if (now - itemDate > 30 * 86400000) return false;
      }
    }
    return true;
  }

  get filteredActiveRequests(): any[] {
    return this.activeRequests.filter(r => this.matchesFilters(r, false));
  }

  get filteredActiveHazards(): any[] {
    return this.activeHazards.filter(h => this.matchesFilters(h, true));
  }

  toggleBarangayFilter(id: number | 'all') {
    if (id === 'all') {
      this.selectedBarangays = [];
    } else {
      const idx = this.selectedBarangays.indexOf(id);
      if (idx > -1) {
        this.selectedBarangays.splice(idx, 1);
      } else {
        this.selectedBarangays.push(id);
      }
    }
    this.highlightBarangays();
    this.plotMarkers();
  }

  isBarangaySelected(id: number | 'all'): boolean {
    if (id === 'all') return this.selectedBarangays.length === 0;
    return this.selectedBarangays.includes(id);
  }

  highlightBarangays() {
    if (!this.map || !this.bgyGeoJson) return;
    if (this.highlightBgyLayer && this.map.hasLayer(this.highlightBgyLayer)) {
      this.map.removeLayer(this.highlightBgyLayer);
      this.highlightBgyLayer = null;
    }
    if (this.selectedBarangays.length === 0) {
      if (this.townBounds) {
        this.map.fitBounds(this.townBounds);
      }
      return;
    }

    const selectedNormalizedNames = this.selectedBarangays
      .map(id => this.barangayOptions.find(b => b.id === id)?.name)
      .filter((n): n is string => !!n)
      .map(n => this.normalizeBgyName(n));

    const matchingFeatures = (this.bgyGeoJson.features || []).filter((f: any) => {
      const name = this.normalizeBgyName(f.properties?.adm4_en || '');
      return selectedNormalizedNames.includes(name);
    });

    if (matchingFeatures.length > 0) {
      this.highlightBgyLayer = L.geoJSON(matchingFeatures, {
        style: {
          color: '#eb445a',
          weight: 3,
          fillColor: '#eb445a',
          fillOpacity: 0.25,
          dashArray: '4, 4'
        }
      }).addTo(this.map);
      this.map.fitBounds(this.highlightBgyLayer.getBounds(), { padding: [30, 30], maxZoom: 15 });
    }
  }

  toggleTypeFilter(type: string) {
    if (type === 'all') {
      this.selectedTypes = [];
    } else {
      const idx = this.selectedTypes.indexOf(type);
      if (idx > -1) {
        this.selectedTypes.splice(idx, 1);
      } else {
        this.selectedTypes.push(type);
      }
    }
    this.plotMarkers();
  }

  isTypeSelected(type: string): boolean {
    if (type === 'all') return this.selectedTypes.length === 0;
    return this.selectedTypes.includes(type);
  }

  onCalendarFilterChange(val: DateFilterValue | null) {
    this.customCalendarFilter = val;
    if (val && val.dates.length > 0) {
      this.dateFilter = 'custom';
    } else {
      this.dateFilter = 'all';
    }
    this.plotMarkers();
  }

  setDateFilter(date: string) {
    if (this.dateFilter === date && date !== 'all') {
      this.dateFilter = 'all';
    } else {
      this.dateFilter = date;
      this.customCalendarFilter = null;
    }
    this.plotMarkers();
  }

  toggleMapStyle(style: 'street' | 'satellite') {
    if (style === this.mapStyle || !this.map) return;
    this.mapStyle = style;
    [this.streetLayer, this.satelliteLayer].forEach(l => { if (l && this.map.hasLayer(l)) this.map.removeLayer(l); });
    if (style === 'street') {
      this.streetLayer.addTo(this.map);
    }
    if (style === 'satellite') {
      this.satelliteLayer.addTo(this.map);
    }
    if (this.bgyLabelsLayer && !this.map.hasLayer(this.bgyLabelsLayer)) {
      this.bgyLabelsLayer.addTo(this.map);
    }
  }

  initMap() {
    if (this.map) return;
    this.map = L.map('dispatch-map', { minZoom: 12, zoomControl: true }).setView([15.3014, 120.9274], 13);
    this.streetLayer    = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors', crossOrigin: true });
    this.satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18, attribution: '© Esri' });

    if (this.mapStyle === 'street') {
      this.streetLayer.addTo(this.map);
    } else {
      this.satelliteLayer.addTo(this.map);
    }

    this.map.on('popupopen',  (e: any) => { document.getElementById('dispatch-map')?.classList.add('map-has-selection');    if (e.popup._source?._icon) e.popup._source._icon.classList.add('selected-pin'); });
    this.map.on('popupclose', (e: any) => { document.getElementById('dispatch-map')?.classList.remove('map-has-selection'); if (e.popup._source?._icon) e.popup._source._icon.classList.remove('selected-pin'); setTimeout(() => { this.selectedRequestId = null; this.previewType = null; }); });

    // Local GeoJSON layers loaded directly from project assets
    this.http.get('assets/data/bgysubmuns-municity-304925000.0.1.json').subscribe((json: any) => {
      this.bgyGeoJson = json;
      const labelMarkers: any[] = [];
      (json.features || []).forEach((f: any) => {
        if (f.geometry?.type === 'Polygon' && f.geometry.coordinates[0]?.length) {
          const coords = f.geometry.coordinates[0];
          let latSum = 0; let lngSum = 0;
          coords.forEach((c: number[]) => { lngSum += c[0]; latSum += c[1]; });
          const centroid: [number, number] = [latSum / coords.length, lngSum / coords.length];
          const bgyName = f.properties.adm4_en || 'Barangay';

          const marker = L.marker(centroid, {
            icon: L.divIcon({
              className: 'bgy-clean-label-icon',
              html: `<div class="bgy-map-badge"><span class="bgy-map-badge__dot"></span><span>${bgyName}</span></div>`,
              iconSize: [0, 0],
              iconAnchor: [0, 0]
            }),
            interactive: false
          });
          labelMarkers.push(marker);
        }
      });

      const bgyBorder = L.geoJSON(json, {
        style: { color: 'rgba(211, 47, 47, 0.4)', weight: 1.5, dashArray: '4,4', fillOpacity: 0.02, fillColor: '#D32F2F' }
      });
      this.bgyLabelsLayer = L.layerGroup([bgyBorder, ...labelMarkers]);
      if (this.map) {
        this.bgyLabelsLayer.addTo(this.map);
      }
    });

    this.http.get('assets/data/san-isidro.geojson').subscribe((json: any) => {
      const boundaryLayer = L.geoJSON(json, { filter: (f) => f.geometry.type !== 'Point', style: { color: '#eb445a', weight: 3, fillOpacity: 0 } }).addTo(this.map);
      this.townBounds = boundaryLayer.getBounds();
      this.map.fitBounds(this.townBounds);
      this.map.setMaxBounds(this.townBounds.pad(0.2));
      const hole = json.features[0].geometry.coordinates[0].map((c: any[]) => [c[1], c[0]]);
      L.polygon([[[-90,-180],[90,-180],[90,180],[-90,180]], hole], { color: 'transparent', fillColor: '#888888', fillOpacity: 0.6 }).addTo(this.map);
      this.plotMarkers();
    });
  }

  plotMarkers() {
    if (!this.map) return;
    this.mapMarkers.forEach(m => this.map.removeLayer(m));
    this.mapMarkers = [];
    const iconConfig: Record<string, { viewBox: string; path: string; color: string }> = {
      'Fire': {
        viewBox: '0 0 448 512',
        path: 'M160.5-26.4c9.3-7.8 23-7.5 31.9 .9 12.3 11.6 23.3 24.4 33.9 37.4 13.5 16.5 29.7 38.3 45.3 64.2 5.2-6.8 10-12.8 14.2-17.9 1.1-1.3 2.2-2.7 3.3-4.1 7.9-9.8 17.7-22.1 30.8-22.1 13.4 0 22.8 11.9 30.8 22.1 1.3 1.7 2.6 3.3 3.9 4.8 10.3 12.4 24 30.3 37.7 52.4 27.2 43.9 55.6 106.4 55.6 176.6 0 123.7-100.3 224-224 224S0 411.7 0 288c0-91.1 41.1-170 80.5-225 19.9-27.7 39.7-49.9 54.6-65.1 8.2-8.4 16.5-16.7 25.5-24.2zM225.7 416c25.3 0 47.7-7 68.8-21 42.1-29.4 53.4-88.2 28.1-134.4-4.5-9-16-9.6-22.5-2l-25.2 29.3c-6.6 7.6-18.5 7.4-24.7-.5-17.3-22.1-49.1-62.4-65.3-83-5.4-6.9-15.2-8-21.5-1.9-18.3 17.8-51.5 56.8-51.5 104.3 0 68.6 50.6 109.2 113.7 109.2z',
        color: '#eb445a'
      },
      'Flood': {
        viewBox: '0 0 512 512',
        path: 'M96 320c-53 0-96-43-96-96 0-42.5 27.6-78.6 65.9-91.2-1.3-6.7-1.9-13.7-1.9-20.8 0-61.9 50.1-112 112-112 43.1 0 80.5 24.3 99.2 60 14.7-17.1 36.5-28 60.8-28 44.2 0 80 35.8 80 80 0 5.5-.6 10.8-1.6 16 .5 0 1.1 0 1.6 0 53 0 96 43 96 96s-43 96-96 96L96 320zm6.8 79.6l-32 96C66.6 508.2 53 515 40.4 510.8S21 493 25.2 480.4l32-96C61.4 371.8 75 365 87.6 369.2S107 387 102.8 399.6zm120 0l-32 96c-4.2 12.6-17.8 19.4-30.4 15.2S141 493 145.2 480.4l32-96c4.2-12.6 17.8-19.4 30.4-15.2S227 387 222.8 399.6zm112 0l-32 96c-4.2 12.6-17.8 19.4-30.4 15.2S253 493 257.2 480.4l32-96c4.2-12.6 17.8-19.4 30.4-15.2S339 387 334.8 399.6zm120 0l-32 96c-4.2 12.6-17.8 19.4-30.4 15.2S373 493 377.2 480.4l32-96c4.2-12.6 17.8-19.4 30.4-15.2S459 387 454.8 399.6z',
        color: '#3880ff'
      },
      'Medical': {
        viewBox: '0 0 512 512',
        path: 'M256 107.9L241 87.1C216 52.5 175.9 32 133.1 32 59.6 32 0 91.6 0 165.1l0 2.6c0 23.6 6.2 48 16.6 72.3l106 0c3.2 0 6.1-1.9 7.4-4.9l31.8-76.3c3.7-8.8 12.3-14.6 21.8-14.8s18.3 5.4 22.2 14.1l51.3 113.9 41.4-82.8c4.1-8.1 12.4-13.3 21.5-13.3s17.4 5.1 21.5 13.3l23.2 46.3c1.4 2.7 4.1 4.4 7.2 4.4l123.6 0c10.5-24.3 16.6-48.7 16.6-72.3l0-2.6C512 91.6 452.4 32 378.9 32 336.2 32 296 52.5 271 87.1l-15 20.7zM469.6 288l-97.8 0c-21.2 0-40.6-12-50.1-31l-1.7-3.4-42.5 85.1c-4.1 8.3-12.7 13.5-22 13.3s-17.6-5.7-21.4-14.1l-49.3-109.5-10.5 25.2c-8.7 20.9-29.1 34.5-51.7 34.5l-80.2 0c47.2 73.8 123 141.7 170.4 177.9 12.4 9.4 27.6 14.1 43.1 14.1s30.8-4.6 43.1-14.1C346.6 429.7 422.4 361.8 469.6 288z',
        color: '#2dd36f'
      },
      'Crime': {
        viewBox: '0 0 576 512',
        path: 'M320-32c0-17.7-14.3-32-32-32s-32 14.3-32 32 14.3 32 32 32 32-14.3 32-32zM192 64a32 32 0 1 0 0-64 32 32 0 1 0 0 64zM152 96c-13.3 0-24 10.7-24 24l0 16c0 1 .1 1.9 .2 2.9-74.7 26.3-128.2 97.5-128.2 181.1 0 106 86 192 192 192s192-86 192-192c0-83.7-53.5-154.8-128.2-181.1 .1-.9 .2-1.9 .2-2.9l0-16c0-13.3-10.7-24-24-24l-80 0zM64 320a128 128 0 1 1 256 0 128 128 0 1 1 -256 0zm448 0c0 66.9-51.3 121.8-116.6 127.5-14.3 22.8-32.4 43.1-53.4 59.9 13.5 3 27.6 4.6 42 4.6 106 0 192-86 192-192 0-83.7-53.5-154.8-128.2-181.1 .1-.9 .2-1.9 .2-2.9l0-16c0-13.3-10.7-24-24-24l-80 0c-12.3 0-22.4 9.2-23.8 21.1 30.3 19.2 56.1 45 75.2 75.4 65.4 5.8 116.6 60.6 116.6 127.5zM384 64a32 32 0 1 0 0-64 32 32 0 1 0 0 64z',
        color: '#bc6fff'
      }
    };
    const defaultIcon = {
      viewBox: '0 0 512 512',
      path: 'M256 0c14.7 0 28.2 8.1 35.2 21l216 400c6.7 12.4 6.4 27.4-.8 39.5S486.1 480 472 480L40 480c-14.1 0-27.2-7.4-34.4-19.5s-7.5-27.1-.8-39.5l216-400c7-12.9 20.5-21 35.2-21zm0 352a32 32 0 1 0 0 64 32 32 0 1 0 0-64zm0-192c-18.2 0-32.7 15.5-31.4 33.7l7.4 104c.9 12.5 11.4 22.3 23.9 22.3 12.6 0 23-9.7 23.9-22.3l7.4-104c1.3-18.2-13.1-33.7-31.4-33.7z',
      color: '#eb445a'
    };

    this.filteredActiveRequests.forEach(req => {
      const cfg        = iconConfig[req.incident_name] || defaultIcon;
      const pulseClass = req.status === 'Pending' ? 'sos-pulse-ripple' : '';
      const icon = L.divIcon({
        html: `<div class="custom-fa-marker-wrapper ${pulseClass}">
          <svg viewBox="0 0 30 42" class="vector-pin-shape" style="width:45px;height:60px;display:block;">
            <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="#eb445a"/>
            <circle cx="15" cy="15" r="9" fill="white"/>
            <svg x="8" y="8" width="14" height="14" viewBox="${cfg.viewBox}">
              <path fill="${cfg.color}" d="${cfg.path}"/>
            </svg>
          </svg>
        </div>`,
        className: 'leaflet-blank-div-icon', iconSize: [45,60], iconAnchor: [22.5,60], popupAnchor: [0,-52]
      });
      const popup = `<div class="accessible-popup-box">
        <h2 style="color:#eb445a;font-size:18px;font-weight:bold;margin:0 0 8px 0;border-bottom:2px solid #eb445a20;padding-bottom:4px;">${req.incident_name.toUpperCase()} EMERGENCY</h2>
        <p style="font-size:15px;margin:4px 0;"><b>Citizen:</b> ${req.first_name} ${req.last_name}</p>
        <p style="font-size:15px;margin:4px 0;"><b>Contact:</b> ${req.phone}</p>
        <p style="font-size:13px;margin:4px 0;color:gray;background:var(--ion-color-light);padding:4px;border-radius:4px;"><b>Coords:</b> ${req.latitude}, ${req.longitude}</p>
        <p style="font-size:13px;margin:4px 0;"><b>Barangay:</b> ${req.barangay_name || 'Unresolved'}</p>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <button onclick="window.dispatchEvent(new CustomEvent('map-dispatch',{detail:${req.request_id}}))" style="background:#ffc409;color:black;border:none;padding:10px 14px;font-weight:bold;border-radius:8px;cursor:pointer;font-size:14px;flex:1;">DISPATCH UNIT</button>
          <button onclick="window.dispatchEvent(new CustomEvent('map-resolve',{detail:${req.request_id}}))"  style="background:#2dd36f;color:white;border:none;padding:10px 14px;font-weight:bold;border-radius:8px;cursor:pointer;font-size:14px;flex:1;">RESOLVE</button>
        </div></div>`;
      const marker = L.marker([req.latitude, req.longitude], { icon }).bindPopup(popup).addTo(this.map);
      marker.on('click', () => {
        this.selectedRequestId = req.request_id; this.previewType = 'emergency';
        setTimeout(() => { document.getElementById('request-card-' + req.request_id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
      });
      this.mapMarkers.push(marker);
    });
    window.addEventListener('map-dispatch', (e: any) => { this.map.closePopup(); this.openDispatchModal(e.detail); }, { once: true });
    window.addEventListener('map-resolve',  (e: any) => { this.map.closePopup(); this.resolveEmergency(e.detail); }, { once: true });

    const hazardBarrierPath = 'M32 32C14.3 32 0 46.3 0 64L0 448c0 17.7 14.3 32 32 32s32-14.3 32-32L64 266.3 149.2 96 64 96 64 64c0-17.7-14.3-32-32-32zM405.2 96l-74.3 0-5.4 10.7-90.6 181.3 74.3 0 5.4-10.7 90.6-181.3zM362.8 288l74.3 0 5.4-10.7 90.6-181.3-74.3 0-5.4 10.7-90.6 181.3zM202.8 96l-5.4 10.7-90.6 181.3 74.3 0 5.4-10.7 90.6-181.3-74.3 0zm288 192l85.2 0 0 160c0 17.7 14.3 32 32 32s32-14.3 32-32l0-384c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 53.7-85.2 170.3z';

    this.filteredActiveHazards.forEach(haz => {
      const icon = L.divIcon({
        html: `<div class="custom-fa-marker-wrapper">
          <svg viewBox="0 0 30 42" class="vector-pin-shape" style="width:45px;height:60px;display:block;">
            <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="#ffc409"/>
            <circle cx="15" cy="15" r="9" fill="white"/>
            <svg x="7.5" y="8" width="15" height="14" viewBox="0 0 640 512">
              <path fill="#e0ac00" d="${hazardBarrierPath}"/>
            </svg>
          </svg>
        </div>`,
        className: 'leaflet-blank-div-icon', iconSize: [45,60], iconAnchor: [22.5,60], popupAnchor: [0,-52]
      });
      const popup = `<div class="accessible-popup-box">
        <h2 style="color:#e0ac00;font-size:17px;font-weight:bold;margin:0 0 6px 0;border-bottom:2px solid #ffc40930;padding-bottom:4px;">⚠️ PUBLIC HAZARD LOG</h2>
        <p style="font-size:15px;margin:4px 0;line-height:1.4;background:var(--ion-color-light);padding:8px;border-radius:6px;border:1px solid #ffc40940;">"${haz.description}"</p>
        <p style="font-size:12px;color:gray;margin:6px 0 0 0;">Reported by: ${haz.first_name} ${haz.last_name}</p>
        <p style="font-size:12px;color:gray;margin:2px 0 0 0;"><b>Barangay:</b> ${haz.barangay_name || 'Unresolved'}</p></div>`;
      const marker = L.marker([haz.latitude, haz.longitude], { icon }).bindPopup(popup).addTo(this.map);
      marker.on('click', () => {
        this.selectedRequestId = haz.hazard_id; this.previewType = 'hazard';
        setTimeout(() => { document.getElementById('hazard-card-' + haz.hazard_id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
      });
      this.mapMarkers.push(marker);
    });
  }

  openDispatchModal(requestId: number) {
    this.dispatchForm.request_id = requestId;
    this.dispatchForm.responder_id = null;
    this.dispatchForm.vehicle_id = null;
    this.filteredVehicles = [];
    this.isDispatchModalOpen = true;
    if (this.availableResponders.length === 0 || this.availableVehicles.length === 0) {
      this.api.getDispatchAssets().subscribe((res: any) => {
        this.availableResponders = res.responders || [];
        this.availableVehicles   = res.vehicles   || [];
      });
    }
  }
  onResponderChange() { this.filteredVehicles = this.availableVehicles.filter((v: any) => v.responder_id === this.dispatchForm.responder_id); }

  submitDispatch() {
    if (!this.dispatchForm.responder_id || !this.dispatchForm.vehicle_id || this.isDispatching) return;
    this.isDispatching = true;
    this.api.dispatchEmergency(this.dispatchForm).subscribe({
      next: () => {
        this.isDispatching = false;
        this.ui.showToast('Units dispatched!', 'success');
        this.isDispatchModalOpen = false;
        this.loadData();
      },
      error: () => { this.isDispatching = false; this.ui.showToast('Dispatch failed.', 'danger'); }
    });
  }

  selectIncidentCard(item: any, type: 'emergency' | 'hazard') {
    const id = type === 'emergency' ? item.request_id : item.hazard_id;
    this.selectedRequestId = id;
    this.previewType = type;

    if (item.latitude && item.longitude && this.map) {
      this.map.flyTo([item.latitude, item.longitude], 16, { animate: true, duration: 0.5 });
      const targetMarker = this.mapMarkers.find(m => {
        const latLng = m.getLatLng();
        return Math.abs(latLng.lat - Number(item.latitude)) < 0.0001 && Math.abs(latLng.lng - Number(item.longitude)) < 0.0001;
      });
      if (targetMarker) {
        targetMarker.openPopup();
      }
    }
  }

  resolveEmergency(requestId: number) {
    this.ui.confirm({
      title: 'Resolve Emergency',
      message: 'Mark this emergency as resolved? It will be moved to the archive.',
      icon: 'check',
      iconColor: '#2dd36f',
      confirmLabel: 'Resolve',
      confirmColor: '#2dd36f',
      onConfirm: async () => {
        await firstValueFrom(this.api.resolveEmergency({ request_id: requestId }));
        this.ui.showToast('Emergency resolved and archived.', 'medium');
        this.loadData();
      }
    });
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

  dismissHazard(hazardId: number) {
    this.ui.confirm({
      title: 'Acknowledge Hazard',
      message: 'Remove this hazard from the map? This confirms it has been addressed.',
      icon: 'hazard',
      iconColor: '#ffc409',
      confirmLabel: 'Acknowledge',
      confirmColor: '#ffc409',
      onConfirm: async () => {
        await firstValueFrom(this.api.resolveHazard({ hazard_id: hazardId }));
        this.ui.showToast('Hazard acknowledged.', 'medium');
        this.loadData();
      }
    });
  }

  trackByRequestId(_index: number, r: any): number {
    return r.request_id;
  }

  trackByHazardId(_index: number, h: any): number {
    return h.hazard_id;
  }
}
