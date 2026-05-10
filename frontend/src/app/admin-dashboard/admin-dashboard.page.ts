import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, MenuController } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { addIcons } from 'ionicons';
import { logOutOutline, personAddOutline, shieldCheckmarkOutline, carOutline, checkmarkCircleOutline, archiveOutline, mapOutline, barChartOutline, megaphoneOutline, warningOutline, imageOutline } from 'ionicons/icons';
import * as L from 'leaflet'; 
import Chart from 'chart.js/auto';

// @ts-ignore
const CachedTileLayer = L.TileLayer.extend({
  createTile: function (coords: any, done: any) {
    const tile = document.createElement('img');
    const url = this.getTileUrl(coords);
    tile.crossOrigin = 'Anonymous';
    if ('caches' in window) {
      caches.open('mdrrmo-offline-map').then(cache => {
        cache.match(url).then(response => {
          if (response) { response.blob().then(blob => { tile.src = URL.createObjectURL(blob); done(null, tile); }); } 
          else {
            fetch(url, { mode: 'cors' }).then(networkResponse => {
              if (networkResponse.ok) { cache.put(url, networkResponse.clone()); }
              networkResponse.blob().then(blob => { tile.src = URL.createObjectURL(blob); done(null, tile); });
            }).catch(err => { done(err, tile); });
          }
        });
      });
    } else { tile.src = url; done(null, tile); }
    return tile;
  }
});

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.page.html',
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, HttpClientModule]
})
export class AdminDashboardPage implements OnInit, OnDestroy {
  
  currentRole: string | null = '';
  apiUrl = 'http://127.0.0.1:8000/api';
  
  activeRequests: any[] = [];
  archivedRequests: any[] = [];
  activeHazards: any[] = [];
  availableResponders: any[] = [];
  availableVehicles: any[] = [];
  filteredVehicles: any[] = []; 
  
  viewMode: 'active' | 'hazards' | 'archive' | 'analytics' | 'broadcast' = 'active'; 
  isModalOpen = false;
  isDispatchModalOpen = false;
  
  // Clean Selection State
  selectedRequestId: number | null = null; 
  previewType: 'emergency' | 'hazard' | null = null;
  
  newDispatcher = { first_name: '', last_name: '', phone: '', username: '', email: '', password: '', barangay_id: null };
  dispatchForm = { request_id: null as number | null, responder_id: null, vehicle_id: null };
  broadcastForm = { message: '' };
  recentBroadcast: any = null;

  map: any;
  mapMarkers: any[] = [];
  pollingInterval: any; 

  analyticsData: any = { daily_stats: [], type_stats: [], recent_records: [] };
  filteredAnalyticsRecords: any[] = [];
  trendChartInstance: any;
  typeChartInstance: any;
  trendChartType: 'bar' | 'line' = 'bar'; 
  chartRange = 7; 
  currentFilterLabel: string = 'All Records';

  sosIcon = L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });
  hazardIcon = L.icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] });

  constructor(private router: Router, private http: HttpClient, private toastController: ToastController, private menuCtrl: MenuController) {
    addIcons({ logOutOutline, personAddOutline, shieldCheckmarkOutline, carOutline, checkmarkCircleOutline, archiveOutline, mapOutline, barChartOutline, megaphoneOutline, warningOutline, imageOutline });
  }

  ngOnInit() {}

  ionViewWillEnter() {
    this.currentRole = localStorage.getItem('role');
    this.menuCtrl.enable(true);
    this.loadData();
    this.loadAnalytics(); 
    this.fetchBroadcast(); 
    this.pollingInterval = setInterval(() => { this.pollActiveEmergencies(); }, 5000);
  }

  ionViewDidEnter() {
    setTimeout(() => {
      const mapContainer = document.getElementById('dispatch-map');
      if (mapContainer && !this.map && this.viewMode !== 'analytics') this.initMap();
    }, 250);
  }

  ionViewWillLeave() { if (this.pollingInterval) clearInterval(this.pollingInterval); }
  ngOnDestroy() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    if (this.trendChartInstance) this.trendChartInstance.destroy();
    if (this.typeChartInstance) this.typeChartInstance.destroy();
  }

  segmentChanged() {
    if (this.viewMode === 'analytics') setTimeout(() => this.renderCharts(), 200); 
    else if (this.viewMode === 'active' || this.viewMode === 'broadcast' || this.viewMode === 'hazards') {
      setTimeout(() => { if (this.map) this.map.invalidateSize(); else this.initMap(); }, 250);
    }
  }

  changeDateRange(event: any) { this.chartRange = event.detail.value; this.loadAnalytics(); }
  getFilename(path: string): string { return path ? path.split('/').pop() || 'Unknown File' : 'No File Attachment'; }

  // ... (Analytics fetching logic remains identical)
  loadAnalytics() {
    this.http.get(`${this.apiUrl}/analytics?days=${this.chartRange}`).subscribe((res: any) => {
      this.analyticsData = res;
      this.filteredAnalyticsRecords = res.recent_records; 
      if (this.viewMode === 'analytics') this.renderCharts();
    });
  }

  toggleChartType() { this.trendChartType = this.trendChartType === 'bar' ? 'line' : 'bar'; this.renderCharts(); }
  clearFilter() { this.filteredAnalyticsRecords = this.analyticsData.recent_records; this.currentFilterLabel = 'All Records'; }
  renderCharts() { /* Same as previous */ }

  loadData() {
    this.http.get(`${this.apiUrl}/active-emergencies`).subscribe((res: any) => { this.activeRequests = res; this.plotMarkers(); });
    this.http.get(`${this.apiUrl}/active-hazards`).subscribe((res: any) => { this.activeHazards = res; this.plotMarkers(); });
    this.http.get(`${this.apiUrl}/archived-emergencies`).subscribe((res: any) => this.archivedRequests = res);
    this.http.get(`${this.apiUrl}/dispatch-assets`).subscribe((res: any) => { this.availableResponders = res.responders; this.availableVehicles = res.vehicles; });
  }

  fetchBroadcast() { this.http.get(`${this.apiUrl}/active-broadcast`).subscribe((res: any) => { if (res && res.message) this.recentBroadcast = res; }); }

  pollActiveEmergencies() {
    this.http.get(`${this.apiUrl}/active-emergencies`).subscribe((res: any) => {
      if (res.length !== this.activeRequests.length) { this.activeRequests = res; this.loadData(); this.loadAnalytics(); } 
      else { this.activeRequests = res; }
    });
  }

  initMap() {
    this.map = L.map('dispatch-map', { minZoom: 12 }).setView([15.3014, 120.9274], 13);
    
    // @ts-ignore
    new CachedTileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(this.map);

    // CORE UX FIX: Hook into Leaflet's native popup engine
    this.map.on('popupopen', (e: any) => {
      const mapContainer = document.getElementById('dispatch-map');
      mapContainer?.classList.add('map-has-selection'); // Trigger CSS blur
      
      const marker = e.popup._source;
      if (marker && marker._icon) {
        marker._icon.classList.add('selected-pin'); // Keep this pin bright
      }
    });

    this.map.on('popupclose', (e: any) => {
      const mapContainer = document.getElementById('dispatch-map');
      mapContainer?.classList.remove('map-has-selection'); // Remove CSS blur
      
      const marker = e.popup._source;
      if (marker && marker._icon) {
        marker._icon.classList.remove('selected-pin');
      }

      // Deselect list item
      setTimeout(() => {
        this.selectedRequestId = null;
        this.previewType = null;
      });
    });

    this.http.get('assets/data/san-isidro.geojson').subscribe((json: any) => {
      const boundaryLayer = L.geoJSON(json, { filter: (feature) => feature.geometry.type !== 'Point', style: { color: '#eb445a', weight: 3, fillOpacity: 0 } }).addTo(this.map);
      this.map.fitBounds(boundaryLayer.getBounds());
      this.map.setMaxBounds(boundaryLayer.getBounds().pad(0.2));
      const sanIsidroCoords = json.features[0].geometry.coordinates[0];
      const hole = sanIsidroCoords.map((coord: any[]) => [coord[1], coord[0]]);
      L.polygon([ [[-90, -180], [90, -180], [90, 180], [-90, 180]], hole ], { color: 'transparent', fillColor: '#888888', fillOpacity: 0.6 }).addTo(this.map);
      this.plotMarkers();
      setTimeout(() => { this.map.invalidateSize(); }, 100);
    });
  }

  plotMarkers() {
    if (!this.map) return; 
    this.mapMarkers.forEach(marker => this.map.removeLayer(marker));
    this.mapMarkers = [];

    // Plot Emergencies
    this.activeRequests.forEach(req => {
      // Create clean popup string WITH Lat/Lng
      const popupHtml = `
        <div style="text-align: center;">
          <b style="font-size: 14px;">${req.incident_name} Emergency</b><br>
          ${req.first_name} ${req.last_name}<br>
          <span style="font-size:10px; color:gray;">Lat: ${req.latitude}, Lng: ${req.longitude}</span>
        </div>
      `;

      const marker = L.marker([req.latitude, req.longitude], { icon: this.sosIcon })
        .bindPopup(popupHtml)
        .addTo(this.map);
      
      // On click, sync the list UI
      marker.on('click', () => {
        this.selectedRequestId = req.request_id;
        this.previewType = 'emergency';
        if (this.viewMode !== 'active') { this.viewMode = 'active'; this.segmentChanged(); }

        setTimeout(() => {
          const element = document.getElementById('request-card-' + req.request_id);
          if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      });
      this.mapMarkers.push(marker);
    });

    // Plot Hazards
    this.activeHazards.forEach(haz => {
      const popupHtml = `
        <div style="text-align: center;">
          <b style="font-size: 14px; color: #ffc409;">⚠️ Hazard Report</b><br>
          <span style="font-size:10px; color:gray;">Lat: ${haz.latitude}, Lng: ${haz.longitude}</span>
        </div>
      `;

      const hazardMarker = L.marker([haz.latitude, haz.longitude], { icon: this.hazardIcon })
        .bindPopup(popupHtml)
        .addTo(this.map);
        
      hazardMarker.on('click', () => {
        this.selectedRequestId = haz.hazard_id;
        this.previewType = 'hazard';
        if (this.viewMode !== 'hazards') { this.viewMode = 'hazards'; this.segmentChanged(); }

        setTimeout(() => {
          const element = document.getElementById('hazard-card-' + haz.hazard_id);
          if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      });
      this.mapMarkers.push(hazardMarker);
    });
  }

  submitBroadcast() { /* unchanged */ }
  openDispatchModal(requestId: number) {
    this.dispatchForm.request_id = requestId;
    this.dispatchForm.responder_id = null;
    this.dispatchForm.vehicle_id = null;
    this.filteredVehicles = []; 
    this.isDispatchModalOpen = true;
  }
  onResponderChange() { this.filteredVehicles = this.availableVehicles.filter(v => v.responder_id === this.dispatchForm.responder_id); }

  submitDispatch() {
    if (!this.dispatchForm.responder_id || !this.dispatchForm.vehicle_id) return;
    this.http.post(`${this.apiUrl}/dispatch-emergency`, this.dispatchForm).subscribe({
      next: () => {
        this.showToast('Units Dispatched Successfully!', 'success');
        this.isDispatchModalOpen = false;
        this.map.closePopup(); // Clear map selection automatically
        this.loadData(); 
      }
    });
  }

  resolveEmergency(requestId: number) {
    this.http.post(`${this.apiUrl}/resolve-emergency`, { request_id: requestId }).subscribe({
      next: () => {
        this.showToast('Emergency Resolved and Archived.', 'medium');
        this.map.closePopup();
        this.loadData(); 
      }
    });
  }

  saveDispatcher() { /* unchanged */ }

  async showToast(msg: string, color: string = 'danger') {
    const toast = await this.toastController.create({ message: msg, duration: 3000, position: 'bottom', color: color });
    await toast.present();
  }
}