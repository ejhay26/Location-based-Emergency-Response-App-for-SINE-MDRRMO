import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, MenuController } from '@ionic/angular';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { addIcons } from 'ionicons';
import { logOutOutline, personAddOutline, shieldCheckmarkOutline, carOutline, checkmarkCircleOutline, archiveOutline, mapOutline, barChartOutline, megaphoneOutline } from 'ionicons/icons';
import * as L from 'leaflet'; 
import Chart from 'chart.js/auto';

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
  
  viewMode: 'active' | 'archive' | 'analytics' | 'broadcast' = 'active'; 
  isModalOpen = false;
  isDispatchModalOpen = false;
  selectedRequestId: number | null = null; 
  
  newDispatcher = { first_name: '', last_name: '', phone: '', username: '', email: '', password: '', barangay_id: null };
  dispatchForm = { request_id: null as number | null, responder_id: null, vehicle_id: null };
  broadcastForm = { message: '' };

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

  sosIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  });

  constructor(
    private router: Router, 
    private http: HttpClient,
    private toastController: ToastController,
    private menuCtrl: MenuController
  ) {
    addIcons({ logOutOutline, personAddOutline, shieldCheckmarkOutline, carOutline, checkmarkCircleOutline, archiveOutline, mapOutline, barChartOutline, megaphoneOutline });
  }

  ngOnInit() {}

  ionViewWillEnter() {
    this.currentRole = localStorage.getItem('role');
    this.menuCtrl.enable(true);
    this.loadData();
    this.loadAnalytics(); 

    this.pollingInterval = setInterval(() => {
      this.pollActiveEmergencies();
    }, 5000);
  }

  // FIXED: Added back the missing DidEnter hook to boot the map on initial load!
  ionViewDidEnter() {
    setTimeout(() => {
      const mapContainer = document.getElementById('dispatch-map');
      if (mapContainer && !this.map && this.viewMode !== 'analytics') {
        this.initMap();
      }
    }, 250);
  }

  ionViewWillLeave() { if (this.pollingInterval) clearInterval(this.pollingInterval); }
  
  ngOnDestroy() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    if (this.trendChartInstance) this.trendChartInstance.destroy();
    if (this.typeChartInstance) this.typeChartInstance.destroy();
  }

  segmentChanged() {
    if (this.viewMode === 'analytics') {
      setTimeout(() => this.renderCharts(), 200); 
    } else if (this.viewMode === 'active' || this.viewMode === 'broadcast') {
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
        } else {
          this.initMap();
        }
      }, 250);
    }
  }

  // --- ANALYTICS ---
  changeDateRange(event: any) { this.chartRange = event.detail.value; this.loadAnalytics(); }
  
  loadAnalytics() {
    this.http.get(`${this.apiUrl}/analytics?days=${this.chartRange}`).subscribe((res: any) => {
      this.analyticsData = res;
      this.filteredAnalyticsRecords = res.recent_records; 
      if (this.viewMode === 'analytics') this.renderCharts();
    });
  }

  toggleChartType() {
    this.trendChartType = this.trendChartType === 'bar' ? 'line' : 'bar';
    this.renderCharts();
  }

  clearFilter() {
    this.filteredAnalyticsRecords = this.analyticsData.recent_records;
    this.currentFilterLabel = 'All Records';
  }

  renderCharts() {
    const trendCanvas = document.getElementById('trendChart') as HTMLCanvasElement;
    const typeCanvas = document.getElementById('typeChart') as HTMLCanvasElement;
    if (!trendCanvas || !typeCanvas) return;
    if (this.trendChartInstance) this.trendChartInstance.destroy();
    if (this.typeChartInstance) this.typeChartInstance.destroy();

    const dates = this.analyticsData.daily_stats.map((d: any) => d.date);
    const totals = this.analyticsData.daily_stats.map((d: any) => d.total);

    this.trendChartInstance = new Chart(trendCanvas, {
      type: this.trendChartType,
      data: {
        labels: dates,
        datasets: [{
          label: 'Emergencies',
          data: totals,
          backgroundColor: 'rgba(235, 68, 90, 0.7)', 
          borderColor: '#eb445a',
          borderWidth: 2,
          fill: true,
          tension: 0.3 
        }]
      },
      options: { responsive: true, animation: { duration: 1200, easing: 'easeOutQuart' } }
    });

    const types = this.analyticsData.type_stats.map((t: any) => t.incident_name);
    const typeCounts = this.analyticsData.type_stats.map((t: any) => t.total);

    this.typeChartInstance = new Chart(typeCanvas, {
      type: 'doughnut',
      data: {
        labels: types,
        datasets: [{ data: typeCounts, backgroundColor: ['#eb445a', '#ffc409', '#2dd36f', '#222428'], hoverOffset: 10 }]
      },
      options: { responsive: true, animation: { animateScale: true, animateRotate: true, duration: 1200 } }
    });
  }

  // --- MAP & CORE DATA ---
  loadData() {
    this.http.get(`${this.apiUrl}/active-emergencies`).subscribe((res: any) => {
      this.activeRequests = res;
      this.plotMarkers();
    });
    this.http.get(`${this.apiUrl}/active-hazards`).subscribe((res: any) => {
      this.activeHazards = res;
      this.plotMarkers(); 
    });
    this.http.get(`${this.apiUrl}/archived-emergencies`).subscribe((res: any) => this.archivedRequests = res);
    this.http.get(`${this.apiUrl}/dispatch-assets`).subscribe((res: any) => {
      this.availableResponders = res.responders;
      this.availableVehicles = res.vehicles;
    });
  }

  pollActiveEmergencies() {
    this.http.get(`${this.apiUrl}/active-emergencies`).subscribe((res: any) => {
      if (res.length !== this.activeRequests.length) {
        this.activeRequests = res;
        this.loadData(); 
        this.loadAnalytics(); 
      } else {
        this.activeRequests = res; 
      }
    });
  }

  initMap() {
    this.map = L.map('dispatch-map', { minZoom: 12 }).setView([15.3014, 120.9274], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(this.map);

    this.http.get('assets/data/san-isidro.geojson').subscribe((json: any) => {
      const boundaryLayer = L.geoJSON(json, { filter: (feature) => feature.geometry.type !== 'Point', style: { color: '#eb445a', weight: 3, fillOpacity: 0 } }).addTo(this.map);
      this.map.fitBounds(boundaryLayer.getBounds());
      this.map.setMaxBounds(boundaryLayer.getBounds().pad(0.2));

      const sanIsidroCoords = json.features[0].geometry.coordinates[0];
      const hole = sanIsidroCoords.map((coord: any[]) => [coord[1], coord[0]]);
      L.polygon([ [[-90, -180], [90, -180], [90, 180], [-90, 180]], hole ], { color: 'transparent', fillColor: '#888888', fillOpacity: 0.6 }).addTo(this.map);

      this.plotMarkers();
      
      // FIXED: Force leaflet to snap to the correct container size immediately
      setTimeout(() => {
        this.map.invalidateSize();
      }, 100);
    });
  }

  plotMarkers() {
    if (!this.map) return; 
    this.mapMarkers.forEach(marker => this.map.removeLayer(marker));
    this.mapMarkers = [];

    this.activeRequests.forEach(req => {
      
      let medicalNote = '';
      if (req.blood_type || req.allergies || req.medical_conditions || req.pwd_status) {
        medicalNote = `
          <hr style="margin: 8px 0; border-top: 1px solid #ccc;">
          <b style="color:var(--ion-color-danger); font-size:12px;">⚠️ MEDICAL ALERT</b><br>
          <span style="font-size:11px;">
            <b>Blood:</b> ${req.blood_type || 'N/A'}<br>
            <b>Allergies:</b> ${req.allergies || 'None'}<br>
            <b>Conditions:</b> ${req.medical_conditions || 'None'}<br>
            <b>PWD:</b> ${req.pwd_status || 'No'}
          </span>
        `;
      }

      const marker = L.marker([req.latitude, req.longitude], { icon: this.sosIcon })
        .bindPopup(`
          <b>${req.incident_name}</b><br>${req.first_name} ${req.last_name}
          ${medicalNote}
          <br><img src="http://127.0.0.1:8000/${req.image_proof}" style="max-width:100px; margin-top:5px; border-radius:4px;">
        `).addTo(this.map);
      
      marker.on('click', () => {
        this.selectedRequestId = req.request_id;
        const element = document.getElementById('request-card-' + req.request_id);
        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      this.mapMarkers.push(marker);
    });

    this.activeHazards.forEach(haz => {
      const hazardMarker = L.marker([haz.latitude, haz.longitude], { icon: this.sosIcon })
        .bindPopup(`
          <b style="color:var(--ion-color-danger)">⚠️ HAZARD REPORT</b><br>${haz.description}
          <br>By: ${haz.first_name} ${haz.last_name}
          <br><img src="http://127.0.0.1:8000/${haz.image_proof}" style="max-width:100px; margin-top:5px; border-radius:4px;">
        `).addTo(this.map);
      this.mapMarkers.push(hazardMarker);
    });
  }

  submitBroadcast() {
    if (!this.broadcastForm.message) return;
    this.http.post(`${this.apiUrl}/create-broadcast`, this.broadcastForm).subscribe({
      next: () => {
        this.showToast('Broadcast Pushed to all Citizens!', 'success');
        this.broadcastForm.message = '';
      }
    });
  }

  openDispatchModal(requestId: number) {
    this.dispatchForm.request_id = requestId;
    this.dispatchForm.responder_id = null;
    this.dispatchForm.vehicle_id = null;
    this.filteredVehicles = []; 
    this.isDispatchModalOpen = true;
  }

  onResponderChange() {
    this.dispatchForm.vehicle_id = null; 
    this.filteredVehicles = this.availableVehicles.filter(v => v.responder_id === this.dispatchForm.responder_id);
  }

  submitDispatch() {
    if (!this.dispatchForm.responder_id || !this.dispatchForm.vehicle_id) return;
    this.http.post(`${this.apiUrl}/dispatch-emergency`, this.dispatchForm).subscribe({
      next: () => {
        this.showToast('Units Dispatched Successfully!', 'success');
        this.isDispatchModalOpen = false;
        this.loadData(); 
      }
    });
  }

  resolveEmergency(requestId: number) {
    this.http.post(`${this.apiUrl}/resolve-emergency`, { request_id: requestId }).subscribe({
      next: () => {
        this.showToast('Emergency Resolved and Archived.', 'medium');
        this.selectedRequestId = null;
        this.loadData(); 
      }
    });
  }

  saveDispatcher() {
    this.http.post(`${this.apiUrl}/create-dispatcher`, this.newDispatcher).subscribe({
      next: () => {
        this.showToast('Dispatcher created successfully!', 'success');
        this.isModalOpen = false; 
        this.newDispatcher = { first_name: '', last_name: '', phone: '', username: '', email: '', password: '', barangay_id: null };
      }
    });
  }

  async showToast(msg: string, color: string = 'danger') {
    const toast = await this.toastController.create({ message: msg, duration: 3000, position: 'bottom', color: color });
    await toast.present();
  }
}