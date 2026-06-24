import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastController, MenuController, AlertController } from '@ionic/angular';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle,
  IonItem, IonInput, IonLabel, IonList,
  IonSelect, IonSelectOption,
  IonRadioGroup, IonRadio,
  IonToggle, IonBadge,
  IonModal, IonPopover
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import Chart from 'chart.js/auto';
import { ApiService } from '../services/api';

// @ts-ignore
const CachedTileLayer = L.TileLayer.extend({
  createTile: function (coords: any, done: any) {
    const tile = document.createElement('img');
    const url  = this.getTileUrl(coords);
    tile.crossOrigin = 'Anonymous';
    const fetchOptions: RequestInit = {
      mode: 'cors',
      referrerPolicy: 'no-referrer',
      headers: {
        'User-Agent': 'SINEMDRRMOApp/1.0 (sine-mdrrmo-capstone; contact: ejperez623@gmail.com)',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      }
    };
    const loadTile = (blob: Blob) => { tile.src = URL.createObjectURL(blob); done(null, tile); };
    const fetchFresh = () =>
      fetch(url, fetchOptions)
        .then((net: Response) => {
          if (!net.ok) throw new Error(`OSM tile ${net.status}`);
          const clone = net.clone();
          if ('caches' in window) { caches.open('mdrrmo-tile-cache-v1').then((cache: Cache) => cache.put(url, clone)); }
          return net.blob();
        })
        .then(loadTile)
        .catch((err: any) => done(err, tile));
    if ('caches' in window) {
      caches.open('mdrrmo-tile-cache-v1').then((cache: Cache) => {
        cache.match(url).then((cached: Response | undefined) => {
          if (cached) { cached.blob().then(loadTile); } else { fetchFresh(); }
        });
      });
    } else { fetchFresh(); }
    return tile;
  }
});

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.page.html',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle,
    IonItem, IonInput, IonLabel, IonList,
    IonSelect, IonSelectOption,
    IonRadioGroup, IonRadio,
    IonToggle, IonBadge,
    IonModal, IonPopover
  ]
})
export class AdminDashboardPage implements OnInit, OnDestroy {
  
  currentRole: string | null = '';
  
  activeRequests: any[] = [];
  archivedRequests: any[] = [];
  activeHazards: any[] = [];
  pendingVerifications: any[] = []; 
  dispatchers: any[] = [];
  availableResponders: any[] = [];
  availableVehicles: any[] = [];
  filteredVehicles: any[] = []; 
  
  viewMode: 'active' | 'hazards' | 'archive' | 'analytics' | 'broadcast' | 'verifications' | 'dispatchers' = 'active'; 
  isModalOpen = false;
  isDispatchModalOpen = false;
  isSidebarCollapsed = false; 
  isDarkMode = false;
  
  selectedRequestId: number | null = null; 
  previewType: 'emergency' | 'hazard' | null = null;
  
  newDispatcher = { first_name: '', last_name: '', phone: '', username: '', email: '', password: '', barangay_id: null };
  dispatchForm = { request_id: null as number | null, responder_id: null, vehicle_id: null };
  broadcastForm = { message: '' };
  recentBroadcast: any = null;

  isDispatcherModalOpen = false;
  editingDispatcher: any = null;
  dispatcherForm = { first_name: '', last_name: '', phone: '', username: '', email: '', password: '', barangay_id: null as number | null };

  // Confirmation dialog state
  confirmDialog: { open: boolean; title: string; message: string; icon: string; iconColor: string; confirmLabel: string; confirmColor: string; action: () => void } = {
    open: false, title: '', message: '', icon: '', iconColor: '', confirmLabel: '', confirmColor: '', action: () => {}
  };
  showConfirm(cfg: { title: string; message: string; icon: string; iconColor: string; confirmLabel: string; confirmColor: string; action: () => void }) {
    this.confirmDialog = { open: true, ...cfg };
  }
  runConfirm() { this.confirmDialog.action(); this.confirmDialog.open = false; }

  barangayNames: Record<number, string> = {
    1: 'Alua', 2: 'Calaba', 3: 'Malapit', 4: 'Mangga', 5: 'Poblacion',
    6: 'Pulo', 7: 'San Roque', 8: 'Santo Cristo', 9: 'Tabon'
  };
  getBarangayName(id: number): string { return this.barangayNames[id] || `Barangay #${id}`; }

  map: any;
  mapMarkers: any[] = [];
  pollingInterval: any;
  mapStyle: 'street' | 'satellite' = 'street';
  private streetLayer: any;
  private satelliteLayer: any; 

  analyticsData: any = { daily_stats: [], type_stats: [], recent_records: [], hazard_stats: [], hazard_daily_stats: [] };
  analyticsTab: 'emergency' | 'hazard' = 'emergency';
  filteredAnalyticsRecords: any[] = [];
  trendChartInstance: any;
  typeChartInstance: any;
  hazardTrendChartInstance: any;
  hazardTypeChartInstance: any;
  trendChartType: 'bar' | 'line' = 'bar'; 
  chartRange = 7; 
  currentFilterLabel: string = 'All Records';

  constructor(private router: Router, private http: HttpClient, private api: ApiService, private toastController: ToastController, private menuCtrl: MenuController, private alertCtrl: AlertController) {}

  ngOnInit() {
    this.isDarkMode = localStorage.getItem('darkMode') === 'true';
    document.documentElement.classList.toggle('ion-palette-dark', this.isDarkMode);
  }

  ionViewWillEnter() {
    this.currentRole = localStorage.getItem('role');
    this.menuCtrl.enable(false); 
    this.loadData();
    this.loadAnalytics(); 
    this.fetchBroadcast(); 
    this.loadPendingVerifications();
    this.pollingInterval = setInterval(() => { this.pollActiveEmergencies(); }, 5000);
  }

  ionViewDidEnter() {
    setTimeout(() => {
      const mapContainer = document.getElementById('dispatch-map');
      if (mapContainer && !this.map && (this.viewMode === 'active' || this.viewMode === 'hazards')) this.initMap();
    }, 250);
  }

  ionViewWillLeave() { if (this.pollingInterval) clearInterval(this.pollingInterval); }
  ngOnDestroy() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    if (this.trendChartInstance) this.trendChartInstance.destroy();
    if (this.typeChartInstance) this.typeChartInstance.destroy();
    if (this.hazardTrendChartInstance) this.hazardTrendChartInstance.destroy();
    if (this.hazardTypeChartInstance)  this.hazardTypeChartInstance.destroy();
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 300);
  }

  toggleDarkMode(event: any) {
    this.isDarkMode = event.detail.checked;
    document.documentElement.classList.toggle('ion-palette-dark', this.isDarkMode);
    localStorage.setItem('darkMode', String(this.isDarkMode));
  }

  async logout() {
    const alert = await this.alertCtrl.create({
      header: 'Logout',
      message: 'Are you sure you want to logout?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Logout',
          role: 'destructive',
          handler: () => {
            // Clear dark mode so next login starts fresh
            document.documentElement.classList.remove('ion-palette-dark');
            localStorage.removeItem('darkMode');
            localStorage.clear();
            this.router.navigate(['/login']);
          }
        }
      ]
    });
    await alert.present();
  }

  toggleMapStyle(style: 'street' | 'satellite') {
    if (style === this.mapStyle || !this.map) return;
    [this.streetLayer, this.satelliteLayer].forEach(l => { if (l) this.map.removeLayer(l); });
    this.mapStyle = style;
    if (style === 'street')    this.streetLayer.addTo(this.map);
    if (style === 'satellite') this.satelliteLayer.addTo(this.map);
  }

  switchAnalyticsTab(tab: 'emergency' | 'hazard') {
    this.analyticsTab = tab;
    setTimeout(() => { tab === 'emergency' ? this.renderCharts() : this.renderHazardCharts(); }, 100);
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

  segmentChanged() {
    if (this.viewMode === 'analytics') {
      setTimeout(() => this.renderCharts(), 200); 
    } else if (this.viewMode === 'verifications') {
      this.loadPendingVerifications();
    } else if (this.viewMode === 'dispatchers') {
      this.loadDispatchers();
    }
    
    // Map is kept in DOM via [hidden], so we only need to invalidateSize() after
    // the browser repaints the newly-visible container. The setTimeout gives the
    // CSS transition time to finish before Leaflet recalculates tile positions.
    if (['active', 'hazards'].includes(this.viewMode)) {
      setTimeout(() => {
        const mapContainer = document.getElementById('dispatch-map');
        if (!mapContainer) return;

        if (this.map) {
          // First call after Angular applies the display style
          this.map.invalidateSize();
          // Second call after the browser fully repaints the revealed container
          setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 250);
        } else {
          // First time or map was explicitly destroyed — initialize fresh
          this.initMap();
        }
      }, 400);
    }
  }

  loadPendingVerifications() {
    this.api.getPendingVerifications().subscribe((res: any) => { this.pendingVerifications = res; });
  }

  loadDispatchers() {
    this.api.getDispatchers().subscribe((res: any) => { this.dispatchers = res; });
  }

  getFilename(path: string): string { return path ? path.split('/').pop() || 'Unknown File' : 'No File Attachment'; }
  changeDateRange(event: any) { this.chartRange = event.detail.value; this.loadAnalytics(); }

  loadAnalytics() {
    this.api.getAnalytics(this.chartRange).subscribe((res: any) => {
      this.analyticsData = res; this.filteredAnalyticsRecords = res.recent_records; this.currentFilterLabel = 'All Records';
      if (this.viewMode === 'analytics') this.renderCharts();
    });
  }

  toggleChartType() { this.trendChartType = this.trendChartType === 'bar' ? 'line' : 'bar'; this.renderCharts(); }
  clearFilter() { this.filteredAnalyticsRecords = this.analyticsData.recent_records; this.currentFilterLabel = 'All Records'; }
  filterListByType(type: string) { this.filteredAnalyticsRecords = this.analyticsData.recent_records.filter((r: any) => r.incident_name === type); this.currentFilterLabel = `Filtered: ${type} Emergencies`; }
  filterListByDate(date: string) { this.filteredAnalyticsRecords = this.analyticsData.recent_records.filter((r: any) => r.request_time.startsWith(date)); this.currentFilterLabel = `Filtered: Activity on ${date}`; }

  renderCharts() {
    const trendCanvas = document.getElementById('trendChart') as HTMLCanvasElement;
    const typeCanvas = document.getElementById('typeChart') as HTMLCanvasElement;
    if (!trendCanvas || !typeCanvas) return;
    if (this.trendChartInstance) this.trendChartInstance.destroy();
    if (this.typeChartInstance) this.typeChartInstance.destroy();
    if (this.hazardTrendChartInstance) this.hazardTrendChartInstance.destroy();
    if (this.hazardTypeChartInstance)  this.hazardTypeChartInstance.destroy();
    const dates = this.analyticsData.daily_stats.map((d: any) => d.date);
    this.trendChartInstance = new Chart(trendCanvas, {
      type: this.trendChartType,
      data: {
        labels: dates,
        datasets: [
          { label: 'Fire', data: this.analyticsData.daily_stats.map((d: any) => Number(d.fire) || 0), backgroundColor: 'rgba(235, 68, 90, 0.6)', borderColor: '#eb445a', borderWidth: 2, tension: 0.2 },
          { label: 'Flood', data: this.analyticsData.daily_stats.map((d: any) => Number(d.flood) || 0), backgroundColor: 'rgba(56, 128, 255, 0.6)', borderColor: '#3880ff', borderWidth: 2, tension: 0.2 },
          { label: 'Medical', data: this.analyticsData.daily_stats.map((d: any) => Number(d.medical) || 0), backgroundColor: 'rgba(45, 211, 111, 0.6)', borderColor: '#2dd36f', borderWidth: 2, tension: 0.2 },
          { label: 'Crime', data: this.analyticsData.daily_stats.map((d: any) => Number(d.crime) || 0), backgroundColor: 'rgba(181, 95, 230, 0.6)', borderColor: '#bc6fff', borderWidth: 2, tension: 0.2 },
          { label: 'Others', data: this.analyticsData.daily_stats.map((d: any) => Number(d.others) || 0), backgroundColor: 'rgba(146,148,156,0.6)', borderColor: '#92949c', borderWidth: 2, tension: 0.2 }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { stepSize: 1 }, beginAtZero: true } }, onClick: (event, elements) => { if (elements.length > 0) { const index = elements[0].index; this.filterListByDate(dates[index]); } } }
    });
    const types = this.analyticsData.type_stats.map((t: any) => t.incident_name);
    const typeCounts = this.analyticsData.type_stats.map((t: any) => t.total);
    this.typeChartInstance = new Chart(typeCanvas, {
      type: 'doughnut',
      data: { labels: types, datasets: [{ data: typeCounts, backgroundColor: ['#eb445a', '#3880ff', '#2dd36f', '#bc6fff'], hoverOffset: 10 }] },
      options: { responsive: true, maintainAspectRatio: false, onClick: (event, elements) => { if (elements.length > 0) { const index = elements[0].index; this.filterListByType(types[index]); } } }
    });
  }

  loadData() {
    this.api.getActiveEmergencies().subscribe((res: any) => { this.activeRequests = res; this.plotMarkers(); });
    this.api.getActiveHazards().subscribe((res: any) => { this.activeHazards = res; this.plotMarkers(); });
    this.api.getArchivedEmergencies().subscribe((res: any) => this.archivedRequests = res);
    this.api.getDispatchAssets().subscribe((res: any) => { this.availableResponders = res.responders; this.availableVehicles = res.vehicles; });
  }

  fetchBroadcast() {
    this.api.getActiveBroadcast().subscribe((res: any) => { this.recentBroadcast = (res && res.message) ? res : null; });
  }

  pollActiveEmergencies() {
    this.api.getActiveEmergencies().subscribe((res: any) => {
      if (res.length !== this.activeRequests.length) { this.activeRequests = res; this.loadData(); this.loadAnalytics(); }
      else { this.activeRequests = res; }
    });
  }

  initMap() {
    this.map = L.map('dispatch-map', { minZoom: 12, zoomControl: true }).setView([15.3014, 120.9274], 13);
    // @ts-ignore
    this.streetLayer    = new CachedTileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    this.satelliteLayer = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri' }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, opacity: 0.9 })
    ]);
    this.streetLayer.addTo(this.map);
    this.map.on('popupopen', (e: any) => { const mapContainer = document.getElementById('dispatch-map'); mapContainer?.classList.add('map-has-selection'); const marker = e.popup._source; if (marker && marker._icon) { marker._icon.classList.add('selected-pin'); } });
    this.map.on('popupclose', (e: any) => { const mapContainer = document.getElementById('dispatch-map'); mapContainer?.classList.remove('map-has-selection'); const marker = e.popup._source; if (marker && marker._icon) { marker._icon.classList.remove('selected-pin'); } setTimeout(() => { this.selectedRequestId = null; this.previewType = null; }); });
    this.http.get('assets/data/san-isidro.geojson').subscribe((json: any) => {
      const boundaryLayer = L.geoJSON(json, { filter: (feature) => feature.geometry.type !== 'Point', style: { color: '#eb445a', weight: 3, fillOpacity: 0 } }).addTo(this.map);
      this.map.fitBounds(boundaryLayer.getBounds());
      this.map.setMaxBounds(boundaryLayer.getBounds().pad(0.2));
      const sanIsidroCoords = json.features[0].geometry.coordinates[0];
      const hole = sanIsidroCoords.map((coord: any[]) => [coord[1], coord[0]]);
      L.polygon([ [[-90, -180], [90, -180], [90, 180], [-90, 180]], hole ], { color: 'transparent', fillColor: '#888888', fillOpacity: 0.6 }).addTo(this.map);
      this.plotMarkers();
    });
  }

  plotMarkers() {
    if (!this.map) return; 
    this.mapMarkers.forEach(marker => this.map.removeLayer(marker));
    this.mapMarkers = [];

    const iconConfig: any = {
      'Fire': { class: 'fa-solid fa-fire', color: '#eb445a' },
      'Flood': { class: 'fa-solid fa-cloud-showers-heavy', color: '#3880ff' },
      'Medical': { class: 'fa-solid fa-heart-pulse', color: '#2dd36f' },
      'Crime': { class: 'fa-solid fa-handcuffs', color: '#bc6fff' }
    };

    this.activeRequests.forEach(req => {
      const config = iconConfig[req.incident_name] || { class: 'fa-solid fa-triangle-exclamation', color: '#eb445a' };
      const pulseClass = req.status === 'Pending' ? 'sos-pulse-ripple' : ''; 
      
      const customDivIcon = L.divIcon({
        html: `
          <div class="custom-fa-marker-wrapper ${pulseClass}">
            <svg viewBox="0 0 30 42" class="vector-pin-shape">
              <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="#eb445a"/>
              <circle cx="15" cy="15" r="10" fill="white"/>
            </svg>
            <i class="${config.class} pin-inner-fa-icon" style="color: ${config.color};"></i>
          </div>`,
        className: 'leaflet-blank-div-icon',
        iconSize: [45, 60],
        iconAnchor: [22.5, 60],
        popupAnchor: [0, -52]
      });

      const popupHtml = `
        <div class="accessible-popup-box">
          <h2 style="color:#eb445a; font-size:18px; font-weight:bold; margin:0 0 8px 0; border-bottom:2px solid #eb445a20; padding-bottom:4px;">${req.incident_name.toUpperCase()} EMERGENCY</h2>
          <p style="font-size:15px; margin:4px 0; color:var(--ion-text-color);"><b>Citizen Name:</b> ${req.first_name} ${req.last_name}</p>
          <p style="font-size:15px; margin:4px 0; color:var(--ion-text-color);"><b>Contact Link:</b> ${req.phone}</p>
          <p style="font-size:13px; margin:4px 0; color:gray; background:var(--ion-color-light); padding:4px; border-radius:4px;"><b>Coordinates:</b> ${req.latitude}, ${req.longitude}</p>
          <div style="margin-top:12px; display:flex; gap:8px;">
            <button onclick="window.dispatchEvent(new CustomEvent('map-dispatch', {detail: ${req.request_id}}))" style="background:#ffc409; color:black; border:none; padding:10px 14px; font-weight:black; border-radius:8px; cursor:pointer; font-size:14px; flex:1; box-shadow:0 2px 6px rgba(0,0,0,0.15);">DISPATCH UNIT</button>
            <button onclick="window.dispatchEvent(new CustomEvent('map-resolve', {detail: ${req.request_id}}))" style="background:#2dd36f; color:white; border:none; padding:10px 14px; font-weight:black; border-radius:8px; cursor:pointer; font-size:14px; flex:1; box-shadow:0 2px 6px rgba(0,0,0,0.15);">RESOLVE</button>
          </div>
        </div>
      `;

      const marker = L.marker([req.latitude, req.longitude], { icon: customDivIcon }).bindPopup(popupHtml).addTo(this.map);
      marker.on('click', () => {
        this.selectedRequestId = req.request_id; this.previewType = 'emergency';
        if (this.viewMode !== 'active') { this.viewMode = 'active'; this.segmentChanged(); }
        setTimeout(() => { const element = document.getElementById('request-card-' + req.request_id); element?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
      });
      this.mapMarkers.push(marker);
    });

    window.addEventListener('map-dispatch', (e: any) => { this.map.closePopup(); this.openDispatchModal(e.detail); }, { once: true });
    window.addEventListener('map-resolve', (e: any) => { this.map.closePopup(); this.resolveEmergency(e.detail); }, { once: true });

    this.activeHazards.forEach(haz => {
      const hazardDivIcon = L.divIcon({
        html: `
          <div class="custom-fa-marker-wrapper">
            <svg viewBox="0 0 30 42" class="vector-pin-shape">
              <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="#ffc409"/>
              <circle cx="15" cy="15" r="10" fill="white"/>
            </svg>
            <i class="fa-solid fa-road-barrier pin-inner-fa-icon" style="color: #e0ac00;"></i>
          </div>`,
        className: 'leaflet-blank-div-icon',
        iconSize: [45, 60],
        iconAnchor: [22.5, 60],
        popupAnchor: [0, -52]
      });

      const popupHtml = `
        <div class="accessible-popup-box">
          <h2 style="color:#e0ac00; font-size:17px; font-weight:bold; margin:0 0 6px 0; border-bottom:2px solid #ffc40930; padding-bottom:4px;">⚠️ PUBLIC HAZARD LOG</h2>
          <p style="font-size:15px; margin:4px 0; color:var(--ion-text-color); line-height:1.4; background:var(--ion-color-light); padding:8px; border-radius:6px; border-left:4px solid #ffc409;">"${haz.description}"</p>
          <p style="font-size:12px; color:gray; margin:6px 0 0 0;">Reported by: ${haz.first_name} ${haz.last_name}</p>
        </div>
      `;

      const hazardMarker = L.marker([haz.latitude, haz.longitude], { icon: hazardDivIcon }).bindPopup(popupHtml).addTo(this.map);
      hazardMarker.on('click', () => {
        this.selectedRequestId = haz.hazard_id; this.previewType = 'hazard';
        if (this.viewMode !== 'hazards') { this.viewMode = 'hazards'; this.segmentChanged(); }
        setTimeout(() => { const element = document.getElementById('hazard-card-' + haz.hazard_id); element?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
      });
      this.mapMarkers.push(hazardMarker);
    });
  }

  submitBroadcast() {
    if (!this.broadcastForm.message) return;
    this.api.createBroadcast(this.broadcastForm).subscribe({ next: () => { this.showToast('Alert sent to all citizens!', 'success'); this.broadcastForm.message = ''; this.fetchBroadcast(); } });
  }
  endBroadcast() {
    this.showConfirm({ title: 'Stop Alert', message: 'Citizens will stop seeing this alert immediately. Are you sure?', icon: 'fa-solid fa-circle-stop', iconColor: '#eb445a', confirmLabel: 'Stop Alert', confirmColor: '#eb445a',
      action: () => { this.api.clearBroadcast().subscribe({ next: () => { this.showToast('Alert stopped.', 'medium'); this.fetchBroadcast(); } }); }
    });
  }
  openDispatchModal(requestId: number) { this.dispatchForm.request_id = requestId; this.dispatchForm.responder_id = null; this.dispatchForm.vehicle_id = null; this.filteredVehicles = []; this.isDispatchModalOpen = true; }
  onResponderChange() { this.filteredVehicles = this.availableVehicles.filter((v: any) => v.responder_id === this.dispatchForm.responder_id); }
  submitDispatch() {
    if (!this.dispatchForm.responder_id || !this.dispatchForm.vehicle_id) return;
    this.api.dispatchEmergency(this.dispatchForm).subscribe({ next: () => { this.showToast('Units dispatched!', 'success'); this.isDispatchModalOpen = false; this.loadData(); } });
  }
  resolveEmergency(requestId: number) {
    this.showConfirm({ title: 'Resolve Emergency', message: 'Mark this emergency as resolved? It will be moved to the log archive.', icon: 'fa-solid fa-circle-check', iconColor: '#2dd36f', confirmLabel: 'Resolve', confirmColor: '#2dd36f',
      action: () => { this.api.resolveEmergency({ request_id: requestId }).subscribe({ next: () => { this.showToast('Emergency resolved and archived.', 'medium'); this.loadData(); } }); }
    });
  }
  dismissHazard(hazardId: number) {
    this.showConfirm({ title: 'Acknowledge Hazard', message: 'Remove this hazard from the map and list? This confirms it has been addressed.', icon: 'fa-solid fa-road-barrier', iconColor: '#ffc409', confirmLabel: 'Acknowledge', confirmColor: '#ffc409',
      action: () => { this.api.resolveHazard({ hazard_id: hazardId }).subscribe({ next: () => { this.showToast('Hazard acknowledged and removed.', 'medium'); this.loadData(); } }); }
    });
  }
  approveCitizen(userId: number) {
    this.showConfirm({ title: 'Approve Citizen', message: 'Approve this citizen account? They will be able to use the app and submit emergency reports.', icon: 'fa-solid fa-user-check', iconColor: '#2dd36f', confirmLabel: 'Approve', confirmColor: '#2dd36f',
      action: () => { this.api.approveUser({ user_id: userId }).subscribe({ next: () => { this.showToast('Citizen approved!', 'success'); this.loadPendingVerifications(); } }); }
    });
  }
  rejectCitizen(userId: number) {
    this.showConfirm({ title: 'Deny Application', message: "Deny this citizen's registration? They will need to register again.", icon: 'fa-solid fa-user-xmark', iconColor: '#eb445a', confirmLabel: 'Deny', confirmColor: '#eb445a',
      action: () => { this.api.rejectUser({ user_id: userId }).subscribe({ next: () => { this.showToast('Application denied.', 'medium'); this.loadPendingVerifications(); } }); }
    });
  }
  openDispatcherModal(dispatcher: any | null) {
    this.editingDispatcher = dispatcher;
    this.dispatcherForm = dispatcher
      ? { first_name: dispatcher.first_name, last_name: dispatcher.last_name, phone: dispatcher.phone, username: dispatcher.username, email: dispatcher.email, password: '', barangay_id: dispatcher.barangay_id }
      : { first_name: '', last_name: '', phone: '', username: '', email: '', password: '', barangay_id: null };
    this.isDispatcherModalOpen = true;
  }
  saveDispatcherForm() {
    if (this.editingDispatcher) {
      const payload: any = { user_id: this.editingDispatcher.user_id, ...this.dispatcherForm };
      if (!payload.password) delete payload.password;
      this.api.updateDispatcher(payload).subscribe({ next: () => { this.showToast('Dispatcher updated!', 'success'); this.isDispatcherModalOpen = false; this.loadDispatchers(); } });
    } else {
      this.api.createDispatcher(this.dispatcherForm).subscribe({ next: () => { this.showToast('Dispatcher account created!', 'success'); this.isDispatcherModalOpen = false; this.loadDispatchers(); } });
    }
  }
  confirmDeactivateDispatcher(dispatcher: any) {
    this.showConfirm({ title: 'Remove Dispatcher', message: `Remove ${dispatcher.first_name} ${dispatcher.last_name}'s account? They will no longer be able to log in.`, icon: 'fa-solid fa-user-slash', iconColor: '#eb445a', confirmLabel: 'Remove', confirmColor: '#eb445a',
      action: () => { this.api.deactivateDispatcher({ user_id: dispatcher.user_id }).subscribe({ next: () => { this.showToast('Dispatcher removed.', 'medium'); this.loadDispatchers(); } }); }
    });
  }
  saveDispatcher() {
    this.api.createDispatcher(this.newDispatcher).subscribe({ next: () => { this.showToast('Dispatcher account created!', 'success'); this.newDispatcher = { first_name: '', last_name: '', phone: '', username: '', email: '', password: '', barangay_id: null }; this.loadDispatchers(); } });
  }
  async showToast(msg: string, color: string = 'danger') { const toast = await this.toastController.create({ message: msg, duration: 3000, position: 'bottom', color: color }); await toast.present(); }
}