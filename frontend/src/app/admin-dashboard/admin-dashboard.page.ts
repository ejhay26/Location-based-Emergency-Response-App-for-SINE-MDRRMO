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
import { UserSettingsService } from '../services/user-settings';
import { TourService } from '../services/tour';

// @ts-ignore
const CachedTileLayer = L.TileLayer.extend({
  createTile: function (coords: any, done: any) {
    const tile = document.createElement('img');
    const url  = this.getTileUrl(coords);
    tile.crossOrigin = 'Anonymous';
    const fetchOptions: RequestInit = {
      mode: 'cors', referrerPolicy: 'no-referrer',
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _ionicImports = [
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle,
  IonItem, IonInput, IonLabel, IonList,
  IonSelect, IonSelectOption,
  IonRadioGroup, IonRadio,
  IonToggle, IonBadge,
  IonModal, IonPopover
];

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

  viewMode: 'active' | 'hazards' | 'archive' | 'analytics' | 'broadcast' | 'verifications' | 'dispatchers' | 'citizens' | 'feedback' = 'active';
  accountsSubMode: 'dispatchers' | 'citizens' = 'dispatchers';
  isModalOpen = false;
  isDispatchModalOpen = false;
  isSidebarCollapsed = false;

  // Dark mode is driven by UserSettingsService (same as mobile) not localStorage.
  get isDarkMode(): boolean { return this.userSettings.getBool('dark_mode'); }

  selectedRequestId: number | null = null;
  previewType: 'emergency' | 'hazard' | null = null;

  // ── Media lightbox ────────────────────────────────────────────────────────
  lightboxOpen   = false;
  lightboxUrl    = '';
  lightboxIsVideo = false;

  openLightbox(url: string, isVideo: boolean) {
    this.lightboxUrl    = url;
    this.lightboxIsVideo = isVideo;
    this.lightboxOpen   = true;
  }
  closeLightbox() {
    this.lightboxOpen   = false;
    this.lightboxUrl    = '';
    this.lightboxIsVideo = false;
  }
  // ─────────────────────────────────────────────────────────────────────────

  dispatchForm  = { request_id: null as number | null, responder_id: null, vehicle_id: null };
  broadcastForm = { message: '' };
  recentBroadcast: any = null;

  isDispatcherModalOpen = false;
  editingDispatcher: any = null;
  dispatcherForm = { first_name: '', last_name: '', phone: '', username: '', email: '', password: '', barangay_id: null as number | null };

  // ── Loading state flags ───────────────────────────────────────────────
  isBroadcasting    = false;
  isDispatching     = false;
  isSavingDispatcher = false;

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
  currentFilterLabel = 'All Records';

  constructor(
    private router: Router,
    private http: HttpClient,
    public  api: ApiService,
    private toastController: ToastController,
    private menuCtrl: MenuController,
    private alertCtrl: AlertController,
    private userSettings: UserSettingsService,
    private tour: TourService,
  ) {}

  ngOnInit() {
    // Apply dark mode from the settings service (same source as mobile pages).
    this.userSettings.applyToDom();
  }

  ionViewWillEnter() {
    this.currentRole = localStorage.getItem('role');
    this.menuCtrl.enable(false);
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      // Load fresh settings from DB so dark mode matches what the admin set.
      this.userSettings.loadFromServer(user.user_id);
    }
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
    // Auto-start the guided tour for dispatchers on their first login.
    // Uses a localStorage key per user so it only fires once.
    const role = localStorage.getItem('role');
    if (role === 'dispatcher') {
      const userStr = localStorage.getItem('user');
      const userId  = userStr ? JSON.parse(userStr)?.user_id : null;
      const tourKey = `dispatcherTourSeen_${userId}`;
      if (userId && localStorage.getItem(tourKey) !== 'true') {
        localStorage.setItem(tourKey, 'true');
        // Short delay so the map finishes initializing before the tour dims it.
        setTimeout(() => { this.tour.start(); }, 1200);
      }
    }
  }

  ionViewWillLeave() { if (this.pollingInterval) clearInterval(this.pollingInterval); }

  ngOnDestroy() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    if (this.trendChartInstance)       this.trendChartInstance.destroy();
    if (this.typeChartInstance)        this.typeChartInstance.destroy();
    if (this.hazardTrendChartInstance) this.hazardTrendChartInstance.destroy();
    if (this.hazardTypeChartInstance)  this.hazardTypeChartInstance.destroy();
  }

  toggleSidebar() { this.isSidebarCollapsed = !this.isSidebarCollapsed; setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 300); }

  toggleDarkMode(event: any) {
    this.userSettings.setBool('dark_mode', event.detail.checked);
    document.documentElement.classList.toggle('ion-palette-dark', event.detail.checked);
  }

  async logout() {
    const alert = await this.alertCtrl.create({
      header: 'Logout', message: 'Are you sure you want to logout?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Logout', role: 'destructive', handler: () => {
          this.api.logout().subscribe({ error: () => {} });
          this.api.clearToken();
          this.userSettings.clear();
          localStorage.clear();
          this.router.navigate(['/login']);
        }}
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
    if (this.viewMode === 'analytics') { setTimeout(() => this.renderCharts(), 200); }
    else if (this.viewMode === 'verifications') { this.loadPendingVerifications(); }
    else if (this.viewMode === 'dispatchers')   { this.loadDispatchers(); }
    else if (this.viewMode === 'citizens')      { this.loadCitizens(); }
    else if (this.viewMode === 'feedback')      { this.loadFeedback(); }
    if (['active', 'hazards'].includes(this.viewMode)) {
      setTimeout(() => {
        const mapContainer = document.getElementById('dispatch-map');
        if (!mapContainer) return;
        if (this.map) { this.map.invalidateSize(); setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 250); }
        else           { this.initMap(); }
      }, 400);
    }
  }

  loadPendingVerifications() { this.api.getPendingVerifications().subscribe((res: any) => { this.pendingVerifications = res; }); }
  loadDispatchers()          { this.api.getDispatchers().subscribe((res: any) => { this.dispatchers = res; }); }

  citizens: any[] = [];
  citizenSearch = '';
  citizenFilterStatus: 'all' | 'active' | 'suspended' = 'all';

  get filteredCitizens(): any[] {
    return this.citizens.filter(c => {
      const matchSearch = !this.citizenSearch ||
        `${c.first_name} ${c.last_name} ${c.username} ${c.email} ${c.phone}`
          .toLowerCase().includes(this.citizenSearch.toLowerCase());
      const matchStatus = this.citizenFilterStatus === 'all' ||
        (this.citizenFilterStatus === 'suspended' ? c.account_status === 'banned' : c.account_status === 'active');
      return matchSearch && matchStatus;
    });
  }

  loadCitizens() { this.api.getCitizens().subscribe((res: any) => { this.citizens = res; }); }

  suspendCitizen(citizen: any) {
    const isSuspended = citizen.account_status === 'banned';
    this.showConfirm({
      title: `${isSuspended ? 'Reinstate' : 'Suspend'} Account`,
      message: isSuspended
        ? `Reinstate ${citizen.first_name} ${citizen.last_name}? They will regain full access.`
        : `Suspend ${citizen.first_name} ${citizen.last_name}? They will be locked out immediately.`,
      icon: isSuspended ? 'fa-solid fa-user-check' : 'fa-solid fa-user-slash',
      iconColor: isSuspended ? '#2dd36f' : '#eb445a',
      confirmLabel: isSuspended ? 'Reinstate' : 'Suspend',
      confirmColor: isSuspended ? '#2dd36f' : '#eb445a',
      action: () => {
        const call = isSuspended
          ? this.api.reactivateCitizen({ user_id: citizen.user_id })
          : this.api.suspendCitizen({ user_id: citizen.user_id });
        call.subscribe({
          next: () => { this.showToast(isSuspended ? 'Account reinstated.' : 'Account suspended.', isSuspended ? 'success' : 'warning'); this.loadCitizens(); },
          error: () => this.showToast('Action failed. Try again.', 'danger')
        });
      }
    });
  }

  getProxyUrl(path: string | null | undefined): string {
    if (!path || path.trim() === '') return '';
    if (path.includes('ionicframework.com')) return '';
    if (path.startsWith('blob:') || path.startsWith('data:')) return path;
    try {
      const origin = this.api.apiOrigin;
      if (!origin) return '';
      let relative = path;
      if (/^https?:\/\//i.test(path)) {
        const match = path.match(/\/(storage\/.+)$/);
        if (!match) return '';
        relative = match[1];
      }
      // Handle both new per-user paths (storage/profiles/<id>/...) and
      // legacy flat paths (storage/reports/sos/file.mp4) or old profile paths.
      const filePart = relative.replace(/^storage\//, '');
      return `${origin}/storage-proxy/${filePart}`;
    } catch { return ''; }
  }

  isVideoFile(path: string): boolean {
    return path?.toLowerCase().endsWith('.mp4') || path?.toLowerCase().endsWith('.webm');
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
  clearFilter()     { this.filteredAnalyticsRecords = this.analyticsData.recent_records; this.currentFilterLabel = 'All Records'; }
  filterListByType(type: string) { this.filteredAnalyticsRecords = this.analyticsData.recent_records.filter((r: any) => r.incident_name === type); this.currentFilterLabel = `Filtered: ${type} Emergencies`; }
  filterListByDate(date: string) { this.filteredAnalyticsRecords = this.analyticsData.recent_records.filter((r: any) => r.request_time.startsWith(date)); this.currentFilterLabel = `Filtered: Activity on ${date}`; }

  renderCharts() {
    const trendCanvas = document.getElementById('trendChart') as HTMLCanvasElement;
    const typeCanvas  = document.getElementById('typeChart')  as HTMLCanvasElement;
    if (!trendCanvas || !typeCanvas) return;
    if (this.trendChartInstance) this.trendChartInstance.destroy();
    if (this.typeChartInstance)  this.typeChartInstance.destroy();
    if (this.hazardTrendChartInstance) this.hazardTrendChartInstance.destroy();
    if (this.hazardTypeChartInstance)  this.hazardTypeChartInstance.destroy();
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

  loadData() {
    this.api.getActiveEmergencies().subscribe((res: any)   => { this.activeRequests   = res; this.plotMarkers(); });
    this.api.getActiveHazards().subscribe((res: any)       => { this.activeHazards    = res; this.plotMarkers(); });
    this.api.getArchivedEmergencies().subscribe((res: any) => { this.archivedRequests = res; });
    this.api.getDispatchAssets().subscribe((res: any)      => { this.availableResponders = res.responders; this.availableVehicles = res.vehicles; });
  }

  fetchBroadcast() { this.api.getActiveBroadcast().subscribe((res: any) => { this.recentBroadcast = (res && res.message) ? res : null; }); }

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
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 17, attribution: '© Esri' }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 13, opacity: 0.9 })
    ]);
    this.streetLayer.addTo(this.map);
    this.map.on('popupopen',  (e: any) => { document.getElementById('dispatch-map')?.classList.add('map-has-selection');    if (e.popup._source?._icon) e.popup._source._icon.classList.add('selected-pin'); });
    this.map.on('popupclose', (e: any) => { document.getElementById('dispatch-map')?.classList.remove('map-has-selection'); if (e.popup._source?._icon) e.popup._source._icon.classList.remove('selected-pin'); setTimeout(() => { this.selectedRequestId = null; this.previewType = null; }); });
    this.http.get('assets/data/san-isidro.geojson').subscribe((json: any) => {
      const boundaryLayer = L.geoJSON(json, { filter: (f) => f.geometry.type !== 'Point', style: { color: '#eb445a', weight: 3, fillOpacity: 0 } }).addTo(this.map);
      this.map.fitBounds(boundaryLayer.getBounds());
      this.map.setMaxBounds(boundaryLayer.getBounds().pad(0.2));
      const hole = json.features[0].geometry.coordinates[0].map((c: any[]) => [c[1], c[0]]);
      L.polygon([[[-90,-180],[90,-180],[90,180],[-90,180]], hole], { color: 'transparent', fillColor: '#888888', fillOpacity: 0.6 }).addTo(this.map);
      this.plotMarkers();
    });
  }

  plotMarkers() {
    if (!this.map) return;
    this.mapMarkers.forEach(m => this.map.removeLayer(m));
    this.mapMarkers = [];
    const iconConfig: any = {
      'Fire':    { class: 'fa-solid fa-fire',                color: '#eb445a' },
      'Flood':   { class: 'fa-solid fa-cloud-showers-heavy', color: '#3880ff' },
      'Medical': { class: 'fa-solid fa-heart-pulse',         color: '#2dd36f' },
      'Crime':   { class: 'fa-solid fa-handcuffs',           color: '#bc6fff' }
    };
    this.activeRequests.forEach(req => {
      const cfg        = iconConfig[req.incident_name] || { class: 'fa-solid fa-triangle-exclamation', color: '#eb445a' };
      const pulseClass = req.status === 'Pending' ? 'sos-pulse-ripple' : '';
      const icon = L.divIcon({
        html: `<div class="custom-fa-marker-wrapper ${pulseClass}"><svg viewBox="0 0 30 42" class="vector-pin-shape"><path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="#eb445a"/><circle cx="15" cy="15" r="10" fill="white"/></svg><i class="${cfg.class} pin-inner-fa-icon" style="color:${cfg.color};"></i></div>`,
        className: 'leaflet-blank-div-icon', iconSize: [45,60], iconAnchor: [22.5,60], popupAnchor: [0,-52]
      });
      const popup = `<div class="accessible-popup-box">
        <h2 style="color:#eb445a;font-size:18px;font-weight:bold;margin:0 0 8px 0;border-bottom:2px solid #eb445a20;padding-bottom:4px;">${req.incident_name.toUpperCase()} EMERGENCY</h2>
        <p style="font-size:15px;margin:4px 0;"><b>Citizen:</b> ${req.first_name} ${req.last_name}</p>
        <p style="font-size:15px;margin:4px 0;"><b>Contact:</b> ${req.phone}</p>
        <p style="font-size:13px;margin:4px 0;color:gray;background:var(--ion-color-light);padding:4px;border-radius:4px;"><b>Coords:</b> ${req.latitude}, ${req.longitude}</p>
        <div style="margin-top:12px;display:flex;gap:8px;">
          <button onclick="window.dispatchEvent(new CustomEvent('map-dispatch',{detail:${req.request_id}}))" style="background:#ffc409;color:black;border:none;padding:10px 14px;font-weight:bold;border-radius:8px;cursor:pointer;font-size:14px;flex:1;">DISPATCH UNIT</button>
          <button onclick="window.dispatchEvent(new CustomEvent('map-resolve',{detail:${req.request_id}}))"  style="background:#2dd36f;color:white;border:none;padding:10px 14px;font-weight:bold;border-radius:8px;cursor:pointer;font-size:14px;flex:1;">RESOLVE</button>
        </div></div>`;
      const marker = L.marker([req.latitude, req.longitude], { icon }).bindPopup(popup).addTo(this.map);
      marker.on('click', () => {
        this.selectedRequestId = req.request_id; this.previewType = 'emergency';
        if (this.viewMode !== 'active') { this.viewMode = 'active'; this.segmentChanged(); }
        setTimeout(() => { document.getElementById('request-card-' + req.request_id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
      });
      this.mapMarkers.push(marker);
    });
    window.addEventListener('map-dispatch', (e: any) => { this.map.closePopup(); this.openDispatchModal(e.detail); }, { once: true });
    window.addEventListener('map-resolve',  (e: any) => { this.map.closePopup(); this.resolveEmergency(e.detail); }, { once: true });

    this.activeHazards.forEach(haz => {
      const icon = L.divIcon({
        html: `<div class="custom-fa-marker-wrapper"><svg viewBox="0 0 30 42" class="vector-pin-shape"><path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.7 23.3 0 15 0z" fill="#ffc409"/><circle cx="15" cy="15" r="10" fill="white"/></svg><i class="fa-solid fa-road-barrier pin-inner-fa-icon" style="color:#e0ac00;"></i></div>`,
        className: 'leaflet-blank-div-icon', iconSize: [45,60], iconAnchor: [22.5,60], popupAnchor: [0,-52]
      });
      const popup = `<div class="accessible-popup-box">
        <h2 style="color:#e0ac00;font-size:17px;font-weight:bold;margin:0 0 6px 0;border-bottom:2px solid #ffc40930;padding-bottom:4px;">⚠️ PUBLIC HAZARD LOG</h2>
        <p style="font-size:15px;margin:4px 0;line-height:1.4;background:var(--ion-color-light);padding:8px;border-radius:6px;border-left:4px solid #ffc409;">"${haz.description}"</p>
        <p style="font-size:12px;color:gray;margin:6px 0 0 0;">Reported by: ${haz.first_name} ${haz.last_name}</p></div>`;
      const marker = L.marker([haz.latitude, haz.longitude], { icon }).bindPopup(popup).addTo(this.map);
      marker.on('click', () => {
        this.selectedRequestId = haz.hazard_id; this.previewType = 'hazard';
        if (this.viewMode !== 'hazards') { this.viewMode = 'hazards'; this.segmentChanged(); }
        setTimeout(() => { document.getElementById('hazard-card-' + haz.hazard_id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
      });
      this.mapMarkers.push(marker);
    });
  }

  submitBroadcast() {
    if (!this.broadcastForm.message || this.isBroadcasting) return;
    this.isBroadcasting = true;
    this.api.createBroadcast(this.broadcastForm).subscribe({
      next: () => {
        this.isBroadcasting = false;
        this.showToast('Alert sent to all citizens!', 'success');
        this.broadcastForm.message = '';
        this.fetchBroadcast();
      },
      error: () => { this.isBroadcasting = false; this.showToast('Failed to send alert.', 'danger'); }
    });
  }

  endBroadcast() {
    this.showConfirm({ title: 'Stop Alert', message: 'Citizens will stop seeing this alert. Are you sure?', icon: 'fa-solid fa-circle-stop', iconColor: '#eb445a', confirmLabel: 'Stop Alert', confirmColor: '#eb445a',
      action: () => { this.api.clearBroadcast().subscribe({ next: () => { this.showToast('Alert stopped.', 'medium'); this.fetchBroadcast(); } }); }
    });
  }

  openDispatchModal(requestId: number) { this.dispatchForm.request_id = requestId; this.dispatchForm.responder_id = null; this.dispatchForm.vehicle_id = null; this.filteredVehicles = []; this.isDispatchModalOpen = true; }
  onResponderChange() { this.filteredVehicles = this.availableVehicles.filter((v: any) => v.responder_id === this.dispatchForm.responder_id); }
  submitDispatch() {
    if (!this.dispatchForm.responder_id || !this.dispatchForm.vehicle_id || this.isDispatching) return;
    this.isDispatching = true;
    this.api.dispatchEmergency(this.dispatchForm).subscribe({
      next: () => {
        this.isDispatching = false;
        this.showToast('Units dispatched!', 'success');
        this.isDispatchModalOpen = false;
        this.loadData();
      },
      error: () => { this.isDispatching = false; this.showToast('Dispatch failed.', 'danger'); }
    });
  }

  resolveEmergency(requestId: number) {
    this.showConfirm({ title: 'Resolve Emergency', message: 'Mark this emergency as resolved? It will be moved to the archive.', icon: 'fa-solid fa-circle-check', iconColor: '#2dd36f', confirmLabel: 'Resolve', confirmColor: '#2dd36f',
      action: () => { this.api.resolveEmergency({ request_id: requestId }).subscribe({ next: () => { this.showToast('Emergency resolved and archived.', 'medium'); this.loadData(); } }); }
    });
  }

  markFalseAlarm(requestId: number, citizenName: string) {
    this.showConfirm({
      title: 'Mark as False Alarm',
      message: `Mark this report by ${citizenName} as a false alarm? This will add a strike to their account. At 3 strikes, their account is automatically suspended.`,
      icon: 'fa-solid fa-triangle-exclamation', iconColor: '#eb445a', confirmLabel: 'Mark False Alarm', confirmColor: '#eb445a',
      action: () => {
        this.api.markFalseAlarm({ request_id: requestId }).subscribe({
          next: (res: any) => { this.showToast(res.message, 'warning'); this.loadData(); this.loadAnalytics(); },
          error: (err: any) => this.showToast(err.error?.message || 'Failed to mark false alarm.', 'danger')
        });
      }
    });
  }

  dismissHazard(hazardId: number) {
    this.showConfirm({ title: 'Acknowledge Hazard', message: 'Remove this hazard from the map? This confirms it has been addressed.', icon: 'fa-solid fa-road-barrier', iconColor: '#ffc409', confirmLabel: 'Acknowledge', confirmColor: '#ffc409',
      action: () => { this.api.resolveHazard({ hazard_id: hazardId }).subscribe({ next: () => { this.showToast('Hazard acknowledged.', 'medium'); this.loadData(); } }); }
    });
  }

  approveCitizen(userId: number) {
    this.showConfirm({ title: 'Approve Citizen', message: 'Approve this citizen? They will be able to submit reports.', icon: 'fa-solid fa-user-check', iconColor: '#2dd36f', confirmLabel: 'Approve', confirmColor: '#2dd36f',
      action: () => { this.api.approveUser({ user_id: userId }).subscribe({ next: () => { this.showToast('Citizen approved!', 'success'); this.loadPendingVerifications(); } }); }
    });
  }

  rejectCitizen(userId: number) {
    this.showConfirm({ title: 'Deny Application', message: 'Deny this registration? They will need to register again.', icon: 'fa-solid fa-user-xmark', iconColor: '#eb445a', confirmLabel: 'Deny', confirmColor: '#eb445a',
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
    if (this.isSavingDispatcher) return;
    this.isSavingDispatcher = true;
    if (this.editingDispatcher) {
      const payload: any = { user_id: this.editingDispatcher.user_id, ...this.dispatcherForm };
      if (!payload.password) delete payload.password;
      this.api.updateDispatcher(payload).subscribe({
        next: () => { this.isSavingDispatcher = false; this.showToast('Dispatcher updated!', 'success'); this.isDispatcherModalOpen = false; this.loadDispatchers(); },
        error: () => { this.isSavingDispatcher = false; this.showToast('Update failed.', 'danger'); }
      });
    } else {
      this.api.createDispatcher(this.dispatcherForm).subscribe({
        next: () => { this.isSavingDispatcher = false; this.showToast('Dispatcher created!', 'success'); this.isDispatcherModalOpen = false; this.loadDispatchers(); },
        error: () => { this.isSavingDispatcher = false; this.showToast('Creation failed.', 'danger'); }
      });
    }
  }

  confirmDeactivateDispatcher(dispatcher: any) {
    this.showConfirm({ title: 'Remove Dispatcher', message: `Remove ${dispatcher.first_name} ${dispatcher.last_name}? They will no longer be able to log in.`, icon: 'fa-solid fa-user-slash', iconColor: '#eb445a', confirmLabel: 'Remove', confirmColor: '#eb445a',
      action: () => { this.api.deactivateDispatcher({ user_id: dispatcher.user_id }).subscribe({ next: () => { this.showToast('Dispatcher removed.', 'medium'); this.loadDispatchers(); } }); }
    });
  }

  // ── Archive filtering & sorting ────────────────────────────────────────
  archiveFilter: 'all' | 'resolved' | 'false_alarm' | 'cancelled' = 'all';
  archiveSort: 'newest' | 'oldest' | 'type' = 'newest';
  archiveTypeFilter = 'all';

  get filteredArchivedRequests(): any[] {
    let list = [...this.archivedRequests];
    if (this.archiveFilter === 'resolved')    list = list.filter(r => r.status === 'Resolved' && !r.is_false_alarm);
    if (this.archiveFilter === 'false_alarm') list = list.filter(r => r.is_false_alarm);
    if (this.archiveFilter === 'cancelled')   list = list.filter(r => r.status === 'Cancelled');
    if (this.archiveTypeFilter !== 'all')     list = list.filter(r => r.incident_name === this.archiveTypeFilter);
    if (this.archiveSort === 'newest') list.sort((a, b) => new Date(b.request_time).getTime() - new Date(a.request_time).getTime());
    if (this.archiveSort === 'oldest') list.sort((a, b) => new Date(a.request_time).getTime() - new Date(b.request_time).getTime());
    if (this.archiveSort === 'type')   list.sort((a, b) => a.incident_name.localeCompare(b.incident_name));
    return list;
  }

  get archiveIncidentTypes(): string[] {
    return [...new Set(this.archivedRequests.map(r => r.incident_name))].sort();
  }

  feedbackList: any[] = [];
  loadFeedback() { this.api.getFeedback().subscribe({ next: (res: any) => { this.feedbackList = res; }, error: () => this.showToast('Failed to load feedback.', 'danger') }); }
  clearAllFeedback() {
    this.showConfirm({ title: 'Clear All Feedback', message: 'Permanently delete all feedback? This cannot be undone.', icon: 'fa-solid fa-trash', iconColor: '#eb445a', confirmLabel: 'Clear All', confirmColor: '#eb445a',
      action: () => { this.api.clearFeedback().subscribe({ next: () => { this.showToast('All feedback cleared.', 'medium'); this.feedbackList = []; }, error: () => this.showToast('Failed to clear.', 'danger') }); }
    });
  }
  exportFeedback() { window.open(this.api.exportFeedbackUrl(), '_blank'); }
  categoryLabel(cat: string): string { const m: Record<string,string> = { general: 'General', bug: '🐛 Bug', suggestion: '💡 Suggestion', other: 'Other' }; return m[cat] || cat; }
  categoryColor(cat: string): string { const m: Record<string,string> = { general: '#3880ff', bug: '#eb445a', suggestion: '#2dd36f', other: '#92949c' }; return m[cat] || '#92949c'; }

  async showToast(msg: string, color = 'danger') {
    const toast = await this.toastController.create({ message: msg, duration: 3000, position: 'bottom', color });
    await toast.present();
  }
}
